import asyncio
import json
import time
import websockets
from chatbot_logic import detect_intent, handle_intent

# State
available_agents = {}
all_agents = {}
agent_status = {}
active_sessions = {}
user_sessions = {}
user_queue = []

# Helper functions
def get_active_count():
    return len([s for s in user_sessions.values() if s.get("paired_agent")])

def get_queue_data():
    return [{"id": s, "waiting_time": "2 min"} for s in user_queue]

async def broadcast_stats():
    stats = {
        "type": "stats_update",
        "activeCount": get_active_count(),
        "queueCount": len(user_queue),
        "queue": get_queue_data()
    }
    for aws in all_agents.values():
        await aws.send(json.dumps(stats))

def make_agent_available(agent_id, websocket):
    agent_status[agent_id] = "available"
    available_agents[agent_id] = websocket

def make_agent_busy(agent_id):
    agent_status[agent_id] = "busy"
    available_agents.pop(agent_id, None)

def cleanup_session(session_id):
    user_sessions.pop(session_id, None)
    if session_id in user_queue:
        user_queue.remove(session_id)

async def assign_agent_to_user(waiting_session, agent_id, agent_ws):
    user_sessions[waiting_session]["paired_agent"] = agent_id
    make_agent_busy(agent_id)
    
    await user_sessions[waiting_session]["ws"].send(json.dumps({
        "type": "response",
        "message": "You are now connected to a live agent. How can I help you?"
    }))
    
    await agent_ws.send(json.dumps({"type": "clear_chat"}))
    await agent_ws.send(json.dumps({
        "type": "user_connected",
        "sessionId": waiting_session,
        "history": user_sessions[waiting_session]["history"]
    }))
    
    await broadcast_stats()
    print(f"Assigned {waiting_session} to {agent_id}")

async def handle_agent_connect(websocket, data):
    user_role = data.get("role", "agent")
    user_id = data.get("userId")
    
    if user_role != "admin" and user_id in active_sessions:
        await websocket.send(json.dumps({
            "type": "session_limit_error",
            "message": "You can only have one active session. Please close other windows."
        }))
        await websocket.close()
        return None
    
    if user_role != "admin":
        agent_id = f"{user_id}-session"
        active_sessions[user_id] = agent_id
    else:
        agent_id = f"{user_id}-{int(time.time())}"
    
    all_agents[agent_id] = websocket
    make_agent_available(agent_id, websocket)
    print(f"Agent connected: {agent_id} (Role: {user_role})")
    
    await websocket.send(json.dumps({
        "type": "agent_connected",
        "agentId": agent_id,
        "activeCount": get_active_count(),
        "queueCount": len(user_queue),
        "queue": get_queue_data()
    }))
    
    return agent_id

async def handle_agent_message(data):
    target_session = data.get("sessionId")
    msg_text = data.get("message", "")
    if target_session in user_sessions:
        user_sessions[target_session]["history"].append({"sender": "agent", "message": msg_text})
        await user_sessions[target_session]["ws"].send(json.dumps({
            "type": "response",
            "message": f"Agent: {msg_text}"
        }))

async def handle_manual_connect(agent_id, websocket):
    if user_queue and agent_id and agent_status.get(agent_id) == "available":
        waiting_session = user_queue.pop(0)
        if waiting_session in user_sessions:
            await assign_agent_to_user(waiting_session, agent_id, websocket)

async def handle_end_chat(agent_id, websocket, data):
    target_session = data.get("sessionId")
    if target_session not in user_sessions:
        return
    
    if user_sessions[target_session].get("paired_agent") == agent_id:
        user_sessions[target_session]["paired_agent"] = None
        make_agent_available(agent_id, websocket)
        
        await websocket.send(json.dumps({
            "type": "chat_ended_by_agent",
            "sessionId": target_session
        }))
    
    await user_sessions[target_session]["ws"].send(json.dumps({
        "type": "feedback_request",
        "message": "Agent has marked this chat as resolved. Is your issue resolved?"
    }))
    
    await broadcast_stats()

async def handle_agent_status(agent_id, websocket, data):
    if not agent_id:
        return
    
    status = data.get("status")
    agent_status[agent_id] = status
    
    if status == "available":
        available_agents[agent_id] = websocket
    else:
        available_agents.pop(agent_id, None)

async def handle_user_disconnect(session_id):
    if session_id not in user_sessions:
        return
    
    paired_agent = user_sessions[session_id].get("paired_agent")
    if paired_agent and paired_agent in all_agents:
        await all_agents[paired_agent].send(json.dumps({
            "type": "user_disconnected",
            "sessionId": session_id,
            "message": "User has disconnected from the chat"
        }))
        
        make_agent_available(paired_agent, all_agents[paired_agent])
        await broadcast_stats()
    
    cleanup_session(session_id)

async def handle_feedback_response(session_id, websocket, data):
    feedback = data.get("resolved")
    
    if feedback:
        if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
            paired_agent = user_sessions[session_id]["paired_agent"]
            user_sessions[session_id]["paired_agent"] = None
            
            if paired_agent in all_agents:
                make_agent_available(paired_agent, all_agents[paired_agent])
                await all_agents[paired_agent].send(json.dumps({
                    "type": "chat_ended_by_user",
                    "sessionId": session_id
                }))
        
        await websocket.send(json.dumps({
            "type": "chat_resolved",
            "message": "Thank you for your feedback! Chat has been ended."
        }))
    else:
        if session_id not in user_queue:
            user_queue.append(session_id)
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue for another agent. Please wait..."
        }))
        await broadcast_stats()

async def handle_user_message(session_id, websocket, data):
    user_message = data.get("message", "")
    
    if session_id in user_sessions:
        user_sessions[session_id]["history"].append({"sender": "user", "message": user_message})
    
    # Relay to paired agent
    if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
        paired = user_sessions[session_id]["paired_agent"]
        if paired in all_agents:
            await all_agents[paired].send(json.dumps({
                "type": "user_message",
                "sessionId": session_id,
                "message": user_message
            }))
        await websocket.send(json.dumps({"type": "agent_ack"}))
        return True
    
    # Check if in queue
    if session_id in user_queue:
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are still #{position} in queue. Please wait for an agent..."
        }))
        return True
    
    # Handle intent
    intent = detect_intent(user_message)
    
    if intent == "human_agent":
        if session_id not in user_queue:
            user_queue.append(session_id)
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue. An agent will connect with you shortly..."
        }))
        await broadcast_stats()
    else:
        response = handle_intent(intent, user_message, session_id)
        if session_id in user_sessions:
            user_sessions[session_id]["history"].append({"sender": "bot", "message": response.get("response", "")})
        await websocket.send(json.dumps(response))
    
    return False

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

            if msg_type == "agent_connect":
                agent_id = await handle_agent_connect(websocket, data)
                if not agent_id:
                    return
            
            elif msg_type == "agent_message":
                await handle_agent_message(data)
            
            elif msg_type == "manual_connect":
                await handle_manual_connect(agent_id, websocket)
            
            elif msg_type == "end_chat":
                await handle_end_chat(agent_id, websocket, data)
            
            elif msg_type == "agent_status":
                await handle_agent_status(agent_id, websocket, data)
            
            elif msg_type == "user_disconnect":
                await handle_user_disconnect(session_id)
                break
            
            elif msg_type == "feedback_response":
                await handle_feedback_response(session_id, websocket, data)
                continue
            
            elif msg_type == "disconnect":
                break
            
            else:
                if not session_id and data.get("sessionId"):
                    session_id = data.get("sessionId")
                    user_sessions[session_id] = {"ws": websocket, "paired_agent": None, "history": []}
                    print(f"User session started: {session_id}")
                
                if await handle_user_message(session_id, websocket, data):
                    continue

    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed: session={session_id}, agent={agent_id}")
    finally:
        if agent_id:
            available_agents.pop(agent_id, None)
            all_agents.pop(agent_id, None)
            agent_status.pop(agent_id, None)
            
            for user_id, session_agent_id in list(active_sessions.items()):
                if session_agent_id == agent_id:
                    active_sessions.pop(user_id, None)
                    break
        
        if session_id:
            cleanup_session(session_id)


async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Chatbot WebSocket running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())