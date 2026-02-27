import asyncio
import json
import websockets
from chatbot_logic import detect_intent, handle_intent

# State
available_agents = {}   # agent_id -> websocket (free agents)
all_agents = {}         # agent_id -> websocket (all connected agents)
agent_status = {}       # agent_id -> status (available/busy/offline)
active_sessions = {}    # user_id -> agent_id (track active sessions per user)
user_sessions = {}      # session_id -> { ws, paired_agent, history }
user_queue = []         # list of session_ids waiting for agent

async def assign_agent_to_user(waiting_session, agent_id, agent_ws):
    user_sessions[waiting_session]["paired_agent"] = agent_id
    available_agents.pop(agent_id, None)
    agent_status[agent_id] = "busy"  # Set agent as busy
    user_ws = user_sessions[waiting_session]["ws"]
    await user_ws.send(json.dumps({
        "type": "response",
        "message": "You are now connected to a live agent. How can I help you?"
    }))
    await agent_ws.send(json.dumps({
        "type": "user_connected",
        "sessionId": waiting_session,
        "history": user_sessions[waiting_session]["history"]
    }))
    
    # Notify all agents about updated queue and active counts
    for aid, aws in all_agents.items():
        await aws.send(json.dumps({
            "type": "stats_update",
            "activeCount": len([s for s in user_sessions.values() if s.get("paired_agent")]),
            "queueCount": len(user_queue),
            "queue": [{"id": s, "waiting_time": "2 min"} for s in user_queue]
        }))
    
    print(f"Assigned {waiting_session} to {agent_id} (Status: {agent_status[agent_id]})")

async def handler(websocket):
    session_id = None
    agent_id = None

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            # --- Agent connects ---
            if msg_type == "agent_connect":
                agent_id = data.get("agentId", "agent-001")
                user_role = data.get("role", "agent")  # Get user role
                user_id = data.get("userId")  # Get user ID
                
                # Check if non-admin user already has active session
                if user_role != "admin" and user_id in active_sessions:
                    await websocket.send(json.dumps({
                        "type": "session_limit_error",
                        "message": "You can only have one active session. Please close other windows."
                    }))
                    await websocket.close()
                    return
                
                # Generate unique agent_id for each session
                if user_role != "admin":
                    agent_id = f"{user_id}-session"
                    active_sessions[user_id] = agent_id
                else:
                    # Admin can have multiple sessions with unique IDs
                    import time
                    agent_id = f"{user_id}-{int(time.time())}"
                
                available_agents[agent_id] = websocket
                all_agents[agent_id] = websocket
                agent_status[agent_id] = "available"  # Set initial status
                print(f"Agent connected: {agent_id} (Role: {user_role})")

                # Only assign if agent is available
                if user_queue and agent_status[agent_id] == "available":
                    waiting_session = user_queue.pop(0)
                    if waiting_session in user_sessions:
                        await assign_agent_to_user(waiting_session, agent_id, websocket)

                await websocket.send(json.dumps({
                    "type": "agent_connected",
                    "agentId": agent_id,
                    "activeCount": len([s for s in user_sessions.values() if s.get("paired_agent")]),
                    "queueCount": len(user_queue),
                    "queue": [{"id": s, "waiting_time": "2 min"} for s in user_queue]
                }))

            # --- Agent sends message to user ---
            elif msg_type == "agent_message":
                target_session = data.get("sessionId")
                msg_text = data.get("message", "")
                if target_session and target_session in user_sessions:
                    user_sessions[target_session]["history"].append({"sender": "agent", "message": msg_text})
                    await user_sessions[target_session]["ws"].send(json.dumps({
                        "type": "response",
                        "message": f"Agent: {msg_text}"
                    }))
            
            # --- Agent ends chat ---
            elif msg_type == "end_chat":
                target_session = data.get("sessionId")
                if target_session and target_session in user_sessions:
                    # Notify user that chat ended and disable chat
                    await user_sessions[target_session]["ws"].send(json.dumps({
                        "type": "chat_ended",
                        "message": "Agent has ended the chat. Thank you for contacting us!"
                    }))
                    # Remove pairing
                    user_sessions[target_session]["paired_agent"] = None
                    
                    # Make agent available again
                    if agent_id:
                        agent_status[agent_id] = "available"  # Reset to available
                        available_agents[agent_id] = websocket
                        
                        # Check if there are waiting customers to assign
                        if user_queue:
                            waiting_session = user_queue.pop(0)
                            if waiting_session in user_sessions:
                                await assign_agent_to_user(waiting_session, agent_id, websocket)
                    
                    # Update stats for all agents
                    for aid, aws in all_agents.items():
                        await aws.send(json.dumps({
                            "type": "stats_update",
                            "activeCount": len([s for s in user_sessions.values() if s.get("paired_agent")]),
                            "queueCount": len(user_queue),
                            "queue": [{"id": s, "waiting_time": "2 min"} for s in user_queue]
                        }))

            # --- Agent sets status ---
            elif msg_type == "agent_status":
                if agent_id:
                    status = data.get("status")
                    agent_status[agent_id] = status
                    
                    if status == "available":
                        # Add back to available agents if not already there
                        if agent_id not in available_agents:
                            available_agents[agent_id] = websocket
                        # Assign waiting customer if any
                        if user_queue:
                            waiting_session = user_queue.pop(0)
                            if waiting_session in user_sessions:
                                await assign_agent_to_user(waiting_session, agent_id, websocket)
                    else:
                        # Remove from available agents if busy/offline
                        available_agents.pop(agent_id, None)

            # --- User message ---
            else:
                if not session_id and data.get("sessionId"):
                    session_id = data.get("sessionId")
                    user_sessions[session_id] = {"ws": websocket, "paired_agent": None, "history": []}
                    print(f"User session started: {session_id}")

                if data.get("type") == "disconnect":
                    break

                user_message = data.get("message", "")

                if session_id and session_id in user_sessions:
                    user_sessions[session_id]["history"].append({"sender": "user", "message": user_message})

                # If paired with agent, relay via all_agents (not available_agents)
                if session_id and user_sessions.get(session_id, {}).get("paired_agent"):
                    paired = user_sessions[session_id]["paired_agent"]
                    if paired in all_agents:
                        await all_agents[paired].send(json.dumps({
                            "type": "user_message",
                            "sessionId": session_id,
                            "message": user_message
                        }))
                    # Ack to clear isWaiting on user side
                    await websocket.send(json.dumps({"type": "agent_ack"}))
                    continue

                intent = detect_intent(user_message)

                if intent == "human_agent":
                    # Only connect to available agents
                    available_agent_ids = [aid for aid in available_agents.keys() if agent_status.get(aid) == "available"]
                    
                    if available_agent_ids:
                        agent_id_assigned = available_agent_ids[0]
                        agent_ws = available_agents[agent_id_assigned]
                        await assign_agent_to_user(session_id, agent_id_assigned, agent_ws)
                        print(f"Auto-connected {session_id} to {agent_id_assigned}")
                    else:
                        if session_id not in user_queue:
                            user_queue.append(session_id)
                        position = user_queue.index(session_id) + 1
                        await websocket.send(json.dumps({
                            "type": "response",
                            "message": f"All agents are busy. You are #{position} in queue. Please wait..."
                        }))
                else:
                    response = handle_intent(intent, user_message, session_id)
                    await websocket.send(json.dumps(response))

    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed: session={session_id}, agent={agent_id}")
    finally:
        if agent_id:
            available_agents.pop(agent_id, None)
            all_agents.pop(agent_id, None)
            agent_status.pop(agent_id, None)  # Remove agent status
            
            # Remove from active sessions if not admin
            for user_id, session_agent_id in list(active_sessions.items()):
                if session_agent_id == agent_id:
                    active_sessions.pop(user_id, None)
                    break
                    
        if session_id and session_id in user_sessions:
            user_sessions.pop(session_id)
        if session_id and session_id in user_queue:
            user_queue.remove(session_id)


async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Chatbot WebSocket running on ws://localhost:8080")
        await asyncio.Future()
