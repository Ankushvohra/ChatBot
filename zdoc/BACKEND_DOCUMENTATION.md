# ChatBot Backend - Complete Technical Documentation

## Table of Contents
1. [Backend Architecture](#backend-architecture)
2. [WebSocket Server](#websocket-server)
3. [AI Integration](#ai-integration)
4. [Authentication Server](#authentication-server)
5. [Message Types & Responses](#message-types--responses)
6. [Complete Flow Examples](#complete-flow-examples)

---

## Backend Architecture

### System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND SYSTEM                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         WebSocket Server (Port 8080)                     │  │
│  │         chatbot_server.py                                │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │                                                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │  │
│  │  │   Queue     │  │   Session   │  │   Agent     │    │  │
│  │  │  Manager    │  │   Manager   │  │  Manager    │    │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │  │
│  │                                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         AI Logic (chatbot_logic.py)                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • Intent Detection                                      │  │
│  │  • AWS Bedrock Integration                               │  │
│  │  • Response Generation                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Authentication Server (Port 5001)                │  │
│  │         csv_auth.py                                      │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │  • User Validation                                       │  │
│  │  • Session Management                                    │  │
│  │  • Role-based Access                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component        | Technology        | Version | Purpose                               |
|------------------|-------------------|---------|---------------------------------------|
| WebSocket Server | Python websockets | 12.0    | Real-time bidirectional communication |
| AI Service       | AWS Bedrock       | Latest  | Natural language processing           |
| Auth Server      | Flask             | 2.x     | User authentication & sessions        |
| HTTP Server      | Flask-CORS        | Latest  | Cross-origin resource sharing         |
| Data Storage     | CSV               | -       | User credentials (temporary)          |
| Runtime          | Python            | 3.8+    | Async/await support                   |

---

## WebSocket Server

### File: `chatbot_server.py`

#### Global State Management

```python
import asyncio
import json
import time
import websockets
from chatbot_logic import detect_intent, handle_intent

# ============================================
# GLOBAL STATE DICTIONARIES
# ============================================

# Available agents ready to take customers
available_agents = {}
# Structure: {agent_id: websocket_connection}
# Example: {"agent-001-session": <websocket object>}

# All connected agents (available + busy)
all_agents = {}
# Structure: {agent_id: websocket_connection}
# Example: {"agent-001-session": <websocket>, "admin-001-1772620005": <websocket>}

# Agent status tracking
agent_status = {}
# Structure: {agent_id: status_string}
# Example: {"agent-001-session": "available"}
# Possible values: "available", "busy", "offline"

# Active agent sessions (prevents duplicate logins)
active_sessions = {}
# Structure: {user_id: agent_id}
# Example: {"agent-001": "agent-001-session"}

# Customer sessions with connection and state
user_sessions = {}
# Structure: {session_id: {ws, paired_agent, history}}
# Example: {
#   "abc-123-def-456": {
#     "ws": <websocket object>,
#     "paired_agent": "agent-001-session",
#     "history": [
#       {"sender": "user", "message": "Hello"},
#       {"sender": "bot", "message": "Hi! How can I help?"}
#     ]
#   }
# }

# Customer queue (FIFO)
user_queue = []
# Structure: [session_id1, session_id2, ...]
# Example: ["abc-123", "def-456", "ghi-789"]
```

#### Helper Functions

```python
# ============================================
# HELPER FUNCTIONS
# ============================================

def get_active_count():
    """
    Count customers currently paired with agents
    
    Returns:
        int: Number of active customer-agent pairs
    """
    return len([s for s in user_sessions.values() if s.get("paired_agent")])
    # Example return: 3 (means 3 customers are chatting with agents)

def get_queue_data():
    """
    Get formatted queue information
    
    Returns:
        list: Queue data with customer IDs and wait times
    """
    return [{"id": s, "waiting_time": "2 min"} for s in user_queue]
    # Example return: [
    #   {"id": "abc-123", "waiting_time": "2 min"},
    #   {"id": "def-456", "waiting_time": "2 min"}
    # ]

async def broadcast_stats():
    """
    Send queue statistics to all connected agents
    
    Sends:
        {
            "type": "stats_update",
            "activeCount": 3,
            "queueCount": 2,
            "queue": [...]
        }
    """
    stats = {
        "type": "stats_update",
        "activeCount": get_active_count(),
        "queueCount": len(user_queue),
        "queue": get_queue_data()
    }
    
    # Send to all agents concurrently
    for aws in all_agents.values():
        await aws.send(json.dumps(stats))

def make_agent_available(agent_id, websocket):
    """
    Mark agent as available to take customers
    
    Args:
        agent_id (str): Agent identifier
        websocket: WebSocket connection object
    """
    agent_status[agent_id] = "available"
    available_agents[agent_id] = websocket

def make_agent_busy(agent_id):
    """
    Mark agent as busy (chatting with customer)
    
    Args:
        agent_id (str): Agent identifier
    """
    agent_status[agent_id] = "busy"
    available_agents.pop(agent_id, None)

def cleanup_session(session_id):
    """
    Remove customer session and queue entry
    
    Args:
        session_id (str): Customer session identifier
    """
    user_sessions.pop(session_id, None)
    if session_id in user_queue:
        user_queue.remove(session_id)
```

#### Main Handler Function

```python
# ============================================
# MAIN WEBSOCKET HANDLER
# ============================================

async def handler(websocket):
    """
    Main WebSocket connection handler
    Processes all incoming messages and routes them appropriately
    
    Args:
        websocket: WebSocket connection object
    """
    session_id = None  # Customer session ID
    agent_id = None    # Agent ID

    try:
        # Listen for messages continuously
        async for message in websocket:
            try:
                # Parse JSON message
                data = json.loads(message)
            except json.JSONDecodeError:
                # Invalid JSON, skip this message
                continue

            # Get message type
            msg_type = data.get("type")

            # ============================================
            # ROUTE MESSAGES BASED ON TYPE
            # ============================================

            if msg_type == "agent_connect":
                # Agent connecting to system
                agent_id = await handle_agent_connect(websocket, data)
                if not agent_id:
                    return  # Connection rejected
            
            elif msg_type == "agent_message":
                # Agent sending message to customer
                await handle_agent_message(data)
            
            elif msg_type == "manual_connect":
                # Agent manually connecting to next customer
                await handle_manual_connect(agent_id, websocket)
            
            elif msg_type == "end_chat":
                # Agent ending chat with customer
                await handle_end_chat(agent_id, websocket, data)
            
            elif msg_type == "agent_status":
                # Agent changing status (available/busy/offline)
                await handle_agent_status(agent_id, websocket, data)
            
            elif msg_type == "user_disconnect":
                # Customer disconnecting
                await handle_user_disconnect(session_id)
                break
            
            elif msg_type == "feedback_response":
                # Customer providing feedback
                await handle_feedback_response(session_id, websocket, data)
                continue
            
            elif msg_type == "disconnect":
                # Generic disconnect
                break
            
            else:
                # Default: Handle as user message
                if not session_id and data.get("sessionId"):
                    # First message from customer - create session
                    session_id = data.get("sessionId")
                    user_sessions[session_id] = {
                        "ws": websocket, 
                        "paired_agent": None, 
                        "history": []
                    }
                    print(f"User session started: {session_id}")
                
                # Process user message
                await handle_user_message(session_id, websocket, data)

    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed: session={session_id}, agent={agent_id}")
    
    finally:
        # ============================================
        # CLEANUP ON DISCONNECT
        # ============================================
        
        if agent_id:
            # Remove agent from all tracking dictionaries
            available_agents.pop(agent_id, None)
            all_agents.pop(agent_id, None)
            agent_status.pop(agent_id, None)
            
            # Remove from active sessions
            for user_id, session_agent_id in list(active_sessions.items()):
                if session_agent_id == agent_id:
                    active_sessions.pop(user_id, None)
                    break
        
        if session_id:
            # Clean up customer session
            cleanup_session(session_id)
```

#### Agent Connection Handler

```python
# ============================================
# AGENT CONNECTION HANDLER
# ============================================

async def handle_agent_connect(websocket, data):
    """
    Handle agent connecting to the system
    
    Args:
        websocket: Agent's WebSocket connection
        data: Connection data containing role and userId
        
    Returns:
        str: Generated agent_id or None if rejected
        
    Sends to Agent:
        Success: {
            "type": "agent_connected",
            "agentId": "agent-001-session",
            "activeCount": 0,
            "queueCount": 0,
            "queue": []
        }
        
        Error: {
            "type": "session_limit_error",
            "message": "You can only have one active session."
        }
    """
    user_role = data.get("role", "agent")  # "agent" or "admin"
    user_id = data.get("userId")           # "agent-001", "admin-001"
    
    # ============================================
    # CHECK SESSION LIMITS
    # ============================================
    
    # Non-admin agents can only have ONE active session
    if user_role != "admin" and user_id in active_sessions:
        await websocket.send(json.dumps({
            "type": "session_limit_error",
            "message": "You can only have one active session. Please close other windows."
        }))
        await websocket.close()
        return None
    
    # ============================================
    # GENERATE AGENT ID
    # ============================================
    
    if user_role != "admin":
        # Regular agent: user_id + "-session"
        agent_id = f"{user_id}-session"
        # Example: "agent-001-session"
        active_sessions[user_id] = agent_id
    else:
        # Admin: user_id + timestamp (allows multiple sessions)
        agent_id = f"{user_id}-{int(time.time())}"
        # Example: "admin-001-1772620005"
    
    # ============================================
    # REGISTER AGENT
    # ============================================
    
    all_agents[agent_id] = websocket
    make_agent_available(agent_id, websocket)
    print(f"Agent connected: {agent_id} (Role: {user_role})")
    
    # ============================================
    # SEND CONFIRMATION
    # ============================================
    
    await websocket.send(json.dumps({
        "type": "agent_connected",
        "agentId": agent_id,
        "activeCount": get_active_count(),
        "queueCount": len(user_queue),
        "queue": get_queue_data()
    }))
    
    return agent_id
```

#### User Message Handler

```python
# ============================================
# USER MESSAGE HANDLER
# ============================================

async def handle_user_message(session_id, websocket, data):
    """
    Handle message from customer
    
    Args:
        session_id (str): Customer session ID
        websocket: Customer's WebSocket connection
        data: Message data
        
    Returns:
        bool: True if message was handled specially, False otherwise
        
    Possible Responses:
        1. If paired with agent:
           To Agent: {
               "type": "user_message",
               "sessionId": "abc-123",
               "message": "Hello"
           }
           To Customer: {"type": "agent_ack"}
           
        2. If in queue:
           To Customer: {
               "type": "response",
               "message": "You are still #2 in queue..."
           }
           
        3. If requesting human agent:
           To Customer: {
               "type": "response",
               "message": "You are #1 in queue..."
           }
           To All Agents: stats_update
           
        4. If AI query:
           To Customer: {
               "type": "response",
               "response": "AI generated response..."
           }
    """
    user_message = data.get("message", "")
    
    # ============================================
    # STORE IN HISTORY
    # ============================================
    
    if session_id in user_sessions:
        user_sessions[session_id]["history"].append({
            "sender": "user", 
            "message": user_message
        })
    
    # ============================================
    # CHECK IF PAIRED WITH AGENT
    # ============================================
    
    if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
        paired = user_sessions[session_id]["paired_agent"]
        
        if paired in all_agents:
            # Forward message to agent
            await all_agents[paired].send(json.dumps({
                "type": "user_message",
                "sessionId": session_id,
                "message": user_message
            }))
        
        # Acknowledge to customer
        await websocket.send(json.dumps({"type": "agent_ack"}))
        return True
    
    # ============================================
    # CHECK IF IN QUEUE
    # ============================================
    
    if session_id in user_queue:
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are still #{position} in queue. Please wait for an agent..."
        }))
        return True
    
    # ============================================
    # DETECT INTENT
    # ============================================
    
    intent = detect_intent(user_message)
    # Returns: "human_agent" or "bedrock"
    
    if intent == "human_agent":
        # ============================================
        # ADD TO QUEUE
        # ============================================
        
        if session_id not in user_queue:
            user_queue.append(session_id)
        
        position = user_queue.index(session_id) + 1
        
        # Notify customer
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue. An agent will connect with you shortly..."
        }))
        
        # Update all agents
        await broadcast_stats()
    
    else:
        # ============================================
        # HANDLE WITH AI
        # ============================================
        
        response = handle_intent(intent, user_message, session_id)
        # Returns: {"response": "AI generated text..."}
        
        # Store AI response in history
        if session_id in user_sessions:
            user_sessions[session_id]["history"].append({
                "sender": "bot", 
                "message": response.get("response", "")
            })
        
        # Send to customer
        await websocket.send(json.dumps(response))
    
    return False
```

#### Agent Message Handler

```python
# ============================================
# AGENT MESSAGE HANDLER
# ============================================

async def handle_agent_message(data):
    """
    Handle message from agent to customer
    
    Args:
        data: Message data containing sessionId and message
        
    Sends to Customer:
        {
            "type": "response",
            "message": "Agent: Hello, how can I help you?"
        }
    """
    target_session = data.get("sessionId")
    msg_text = data.get("message", "")
    
    if target_session in user_sessions:
        # Store in history
        user_sessions[target_session]["history"].append({
            "sender": "agent", 
            "message": msg_text
        })
        
        # Send to customer
        await user_sessions[target_session]["ws"].send(json.dumps({
            "type": "response",
            "message": f"Agent: {msg_text}"
        }))
```

#### Manual Connect Handler

```python
# ============================================
# MANUAL CONNECT HANDLER
# ============================================

async def handle_manual_connect(agent_id, websocket):
    """
    Handle agent manually connecting to next customer in queue
    
    Args:
        agent_id (str): Agent identifier
        websocket: Agent's WebSocket connection
        
    Process:
        1. Check if queue has customers
        2. Check if agent is available
        3. Pop first customer from queue
        4. Assign agent to customer
    """
    if user_queue and agent_id and agent_status.get(agent_id) == "available":
        # Get first customer in queue (FIFO)
        waiting_session = user_queue.pop(0)
        
        if waiting_session in user_sessions:
            await assign_agent_to_user(waiting_session, agent_id, websocket)
```

#### Assign Agent to User

```python
# ============================================
# ASSIGN AGENT TO USER
# ============================================

async def assign_agent_to_user(waiting_session, agent_id, agent_ws):
    """
    Pair agent with customer and notify both parties
    
    Args:
        waiting_session (str): Customer session ID
        agent_id (str): Agent identifier
        agent_ws: Agent's WebSocket connection
        
    Sends to Customer:
        {
            "type": "response",
            "message": "You are now connected to a live agent..."
        }
        
    Sends to Agent:
        1. {"type": "clear_chat"}
        2. {
            "type": "user_connected",
            "sessionId": "abc-123",
            "history": [...]
        }
        
    Broadcasts to All Agents:
        stats_update message
    """
    # Pair them
    user_sessions[waiting_session]["paired_agent"] = agent_id
    make_agent_busy(agent_id)
    
    # Notify customer
    await user_sessions[waiting_session]["ws"].send(json.dumps({
        "type": "response",
        "message": "You are now connected to a live agent. How can I help you?"
    }))
    
    # Clear agent's chat window
    await agent_ws.send(json.dumps({"type": "clear_chat"}))
    
    # Send chat history to agent
    await agent_ws.send(json.dumps({
        "type": "user_connected",
        "sessionId": waiting_session,
        "history": user_sessions[waiting_session]["history"]
    }))
    
    # Update all agents
    await broadcast_stats()
    print(f"Assigned {waiting_session} to {agent_id}")
```


#### End Chat Handler

```python
# ============================================
# END CHAT HANDLER
# ============================================

async def handle_end_chat(agent_id, websocket, data):
    """
    Handle agent ending chat with customer
    
    Args:
        agent_id (str): Agent identifier
        websocket: Agent's WebSocket connection
        data: Contains sessionId
        
    Sends to Agent:
        {
            "type": "chat_ended_by_agent",
            "sessionId": "abc-123"
        }
        
    Sends to Customer:
        {
            "type": "feedback_request",
            "message": "Agent has marked this chat as resolved..."
        }
        
    Broadcasts to All Agents:
        stats_update message
    """
    target_session = data.get("sessionId")
    
    if target_session not in user_sessions:
        return
    
    # Check if this agent is paired with this customer
    if user_sessions[target_session].get("paired_agent") == agent_id:
        # Unpair them
        user_sessions[target_session]["paired_agent"] = None
        
        # Make agent available again
        make_agent_available(agent_id, websocket)
        
        # Notify agent
        await websocket.send(json.dumps({
            "type": "chat_ended_by_agent",
            "sessionId": target_session
        }))
    
    # Request feedback from customer
    await user_sessions[target_session]["ws"].send(json.dumps({
        "type": "feedback_request",
        "message": "Agent has marked this chat as resolved. Is your issue resolved?"
    }))
    
    # Update all agents
    await broadcast_stats()
```

#### Feedback Response Handler

```python
# ============================================
# FEEDBACK RESPONSE HANDLER
# ============================================

async def handle_feedback_response(session_id, websocket, data):
    """
    Handle customer feedback after chat ends
    
    Args:
        session_id (str): Customer session ID
        websocket: Customer's WebSocket connection
        data: Contains resolved (boolean)
        
    If resolved = true:
        Sends to Customer: {
            "type": "chat_resolved",
            "message": "Thank you for your feedback!"
        }
        Sends to Agent: {
            "type": "chat_ended_by_user",
            "sessionId": "abc-123"
        }
        
    If resolved = false:
        Adds customer back to queue
        Sends to Customer: {
            "type": "response",
            "message": "You are #1 in queue for another agent..."
        }
    """
    feedback = data.get("resolved")
    
    if feedback:
        # ============================================
        # ISSUE RESOLVED
        # ============================================
        
        if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
            paired_agent = user_sessions[session_id]["paired_agent"]
            user_sessions[session_id]["paired_agent"] = None
            
            if paired_agent in all_agents:
                # Make agent available
                make_agent_available(paired_agent, all_agents[paired_agent])
                
                # Notify agent
                await all_agents[paired_agent].send(json.dumps({
                    "type": "chat_ended_by_user",
                    "sessionId": session_id
                }))
        
        # Thank customer
        await websocket.send(json.dumps({
            "type": "chat_resolved",
            "message": "Thank you for your feedback! Chat has been ended."
        }))
    
    else:
        # ============================================
        # NEED ANOTHER AGENT
        # ============================================
        
        # Add back to queue
        if session_id not in user_queue:
            user_queue.append(session_id)
        
        position = user_queue.index(session_id) + 1
        
        # Notify customer
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue for another agent. Please wait..."
        }))
        
        # Update all agents
        await broadcast_stats()
```

#### User Disconnect Handler

```python
# ============================================
# USER DISCONNECT HANDLER
# ============================================

async def handle_user_disconnect(session_id):
    """
    Handle customer disconnecting from chat
    
    Args:
        session_id (str): Customer session ID
        
    Sends to Agent (if paired):
        {
            "type": "user_disconnected",
            "sessionId": "abc-123",
            "message": "User has disconnected from the chat"
        }
        
    Broadcasts to All Agents:
        stats_update message
    """
    if session_id not in user_sessions:
        return
    
    # Check if paired with agent
    paired_agent = user_sessions[session_id].get("paired_agent")
    
    if paired_agent and paired_agent in all_agents:
        # Notify agent
        await all_agents[paired_agent].send(json.dumps({
            "type": "user_disconnected",
            "sessionId": session_id,
            "message": "User has disconnected from the chat"
        }))
        
        # Make agent available again
        make_agent_available(paired_agent, all_agents[paired_agent])
        
        # Update all agents
        await broadcast_stats()
    
    # Clean up session
    cleanup_session(session_id)
```

#### Server Startup

```python
# ============================================
# SERVER STARTUP
# ============================================

async def main():
    """
    Start WebSocket server
    
    Server Configuration:
        - Host: localhost
        - Port: 8080
        - Protocol: WebSocket (ws://)
    """
    async with websockets.serve(handler, "localhost", 8080):
        print("Chatbot WebSocket running on ws://localhost:8080")
        await asyncio.Future()  # Run forever

if __name__ == "__main__":
    asyncio.run(main())
```

---

## AI Integration

### File: `chatbot_logic.py`

#### AWS Bedrock Setup

```python
import boto3
import os
import time

# ============================================
# AWS BEDROCK CLIENT INITIALIZATION
# ============================================

# Create AWS session
session = boto3.Session(region_name="us-east-1")

# Initialize Bedrock Agent Runtime client
bedrock_agent = session.client('bedrock-agent-runtime')

# Agent Configuration
AGENT_ID = "YQJCBMODNB"
AGENT_ALIAS_ID = "E0OUO8GNO5"
```

#### Intent Detection

```python
# ============================================
# INTENT DETECTION
# ============================================

def detect_intent(message):
    """
    Detect if user wants to connect to human agent
    
    Args:
        message (str): User's message
        
    Returns:
        str: "human_agent" or "bedrock"
        
    Examples:
        detect_intent("I need help") -> "bedrock"
        detect_intent("I want to speak with an agent") -> "human_agent"
        detect_intent("Connect me to support") -> "human_agent"
    """
    message = message.lower()
    
    # Keywords that indicate user wants human agent
    human_agent_keywords = [
        "human", 
        "agent", 
        "representative", 
        "person", 
        "talk to someone", 
        "speak to someone", 
        "customer service", 
        "support", 
        "help me", 
        "connect me", 
        "transfer", 
        "escalate"
    ]
    
    # Check if any keyword is in message
    if any(keyword in message for keyword in human_agent_keywords):
        return "human_agent"
    
    # Default to AI handling
    return "bedrock"
```

#### AWS Bedrock Invocation

```python
# ============================================
# AWS BEDROCK INVOCATION
# ============================================

def invoke_bedrock_agent(user_message, session_id):
    """
    Invoke AWS Bedrock agent with user message
    
    Args:
        user_message (str): User's question/message
        session_id (str): Session identifier for context
        
    Returns:
        str: AI-generated response
        
    API Call Structure:
        bedrock_agent.invoke_agent(
            agentId="YQJCBMODNB",
            agentAliasId="E0OUO8GNO5",
            sessionId="abc-123-def-456",
            inputText="What is my AWS cost?"
        )
        
    Response Structure:
        {
            'completion': [
                {
                    'chunk': {
                        'bytes': b'Your AWS cost for December 2025 is $91'
                    }
                }
            ]
        }
        
    Example:
        Input: "What is my AWS cost for December 2025?"
        Output: "Your AWS cost for December 2025 is $91"
    """
    start_time = time.time()
    
    try:
        # ============================================
        # CALL AWS BEDROCK API
        # ============================================
        
        response = bedrock_agent.invoke_agent(
            agentId=AGENT_ID,
            agentAliasId=AGENT_ALIAS_ID,
            sessionId=session_id,
            inputText=user_message
        )
        
        # ============================================
        # PARSE STREAMING RESPONSE
        # ============================================
        
        agent_response = ""
        
        # Response comes in chunks
        for event in response['completion']:
            if 'chunk' in event and 'bytes' in event['chunk']:
                # Decode bytes to UTF-8 string
                chunk_text = event['chunk']['bytes'].decode('utf-8')
                agent_response += chunk_text
        
        # ============================================
        # LOG PERFORMANCE
        # ============================================
        
        response_time = time.time() - start_time
        print(f"Bedrock response time: {response_time:.2f} seconds")
        
        return agent_response
    
    except Exception as e:
        # ============================================
        # ERROR HANDLING
        # ============================================
        
        response_time = time.time() - start_time
        print(f"Bedrock error after {response_time:.2f} seconds: {e}")
        
        return "Sorry, I'm having trouble processing your request right now."
```

#### Intent Handler

```python
# ============================================
# INTENT HANDLER
# ============================================

def handle_intent(intent, user_message="", session_id=None):
    """
    Handle the detected intent
    
    Args:
        intent (str): Detected intent ("human_agent" or "bedrock")
        user_message (str): User's message
        session_id (str): Session identifier
        
    Returns:
        dict: Response object
        
    Response Format:
        {
            "response": "AI generated text or message"
        }
        
    Examples:
        1. Human Agent Request:
           Input: intent="human_agent"
           Output: {
               "response": "I understand you'd like to speak with a human agent."
           }
           
        2. AI Query:
           Input: intent="bedrock", user_message="What is my cost?"
           Output: {
               "response": "Your AWS cost for December 2025 is $91"
           }
    """
    if intent == "human_agent":
        # ============================================
        # HUMAN AGENT REQUEST
        # ============================================
        
        return {
            "response": "I understand you'd like to speak with a human agent. This feature will be available soon. For now, I can help you with your questions using AI assistance."
        }
    
    elif intent == "bedrock":
        # ============================================
        # AI QUERY
        # ============================================
        
        if not session_id:
            session_id = "default-session"
        
        # Call AWS Bedrock
        bedrock_response = invoke_bedrock_agent(user_message, session_id)
        
        return {"response": bedrock_response}
    
    else:
        # ============================================
        # UNKNOWN INTENT
        # ============================================
        
        return {
            "response": "I'm here to help! You can ask me questions or request to speak with a human agent."
        }
```

---

## Authentication Server

### File: `csv_auth.py`

#### Flask Server Setup

```python
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import csv
import os

# ============================================
# FLASK APP INITIALIZATION
# ============================================

app = Flask(__name__)
app.secret_key = 'chatbot-session-secret-2024'

# Enable CORS for frontend
CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

# CSV file path
USERS_CSV = os.path.join(os.path.dirname(__file__), 'users.csv')
```

#### User Loading Function

```python
# ============================================
# USER LOADING
# ============================================

def load_users():
    """
    Load users from CSV file
    
    CSV Format:
        uid,email,password,name,role,active
        admin-001,admin@company.com,Admin123!,Admin User,admin,true
        agent-001,agent1@company.com,Agent123!,Agent One,agent,true
        
    Returns:
        dict: Users dictionary keyed by email
        
    Example Return:
        {
            "admin@company.com": {
                "uid": "admin-001",
                "email": "admin@company.com",
                "password": "Admin123!",
                "name": "Admin User",
                "role": "admin",
                "active": "true"
            },
            "agent1@company.com": {
                "uid": "agent-001",
                "email": "agent1@company.com",
                "password": "Agent123!",
                "name": "Agent One",
                "role": "agent",
                "active": "true"
            }
        }
    """
    users = {}
    
    with open(USERS_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            users[row['email']] = row
    
    return users
```

#### Login Endpoint

```python
# ============================================
# LOGIN ENDPOINT
# ============================================

@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Handle user login
    
    Request Body:
        {
            "email": "agent1@company.com",
            "password": "Agent123!"
        }
        
    Success Response (200):
        {
            "success": true,
            "user": {
                "uid": "agent-001",
                "email": "agent1@company.com",
                "name": "Agent One",
                "role": "agent"
            }
        }
        
    Error Responses:
        401 - Invalid credentials:
            {"error": "Invalid credentials"}
            
        403 - Account inactive:
            {"error": "Account inactive"}
    """
    # ============================================
    # GET REQUEST DATA
    # ============================================
    
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    # ============================================
    # LOAD AND VALIDATE USER
    # ============================================
    
    users = load_users()
    user = users.get(email)
    
    # Check if user exists and password matches
    if not user or user['password'] != password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if account is active
    if user['active'] != 'true':
        return jsonify({'error': 'Account inactive'}), 403
    
    # ============================================
    # CREATE SESSION
    # ============================================
    
    session['user'] = {
        'uid': user['uid'],
        'email': email,
        'name': user['name'],
        'role': user['role']
    }
    
    # ============================================
    # RETURN SUCCESS
    # ============================================
    
    return jsonify({
        'success': True,
        'user': session['user']
    })
```

#### Logout Endpoint

```python
# ============================================
# LOGOUT ENDPOINT
# ============================================

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """
    Handle user logout
    
    Response (200):
        {"success": true}
    """
    session.pop('user', None)
    return jsonify({'success': True})
```

#### Server Startup

```python
# ============================================
# SERVER STARTUP
# ============================================

if __name__ == '__main__':
    print("Auth Server on port 5001")
    print("Login: admin@company.com/Admin123!")
    app.run(debug=True, port=5001)
```

---

## Message Types & Responses

### Complete Message Reference

#### 1. Agent Connect

**From Agent to Server:**
```json
{
  "type": "agent_connect",
  "agentId": "agent-001",
  "role": "agent",
  "userId": "agent-001"
}
```

**Server Response (Success):**
```json
{
  "type": "agent_connected",
  "agentId": "agent-001-session",
  "activeCount": 0,
  "queueCount": 0,
  "queue": []
}
```

**Server Response (Error - Session Limit):**
```json
{
  "type": "session_limit_error",
  "message": "You can only have one active session. Please close other windows."
}
```

#### 2. User Message (Customer to Server)

**From Customer to Server:**
```json
{
  "message": "What is my AWS cost?",
  "sessionId": "abc-123-def-456"
}
```

**Server Response (AI):**
```json
{
  "type": "response",
  "response": "Your AWS cost for December 2025 is $91"
}
```

**Server Response (Queue Position):**
```json
{
  "type": "response",
  "message": "You are #1 in queue. An agent will connect with you shortly..."
}
```

**Server Response (Already in Queue):**
```json
{
  "type": "response",
  "message": "You are still #2 in queue. Please wait for an agent..."
}
```

#### 3. User Message Forwarded to Agent

**From Server to Agent:**
```json
{
  "type": "user_message",
  "sessionId": "abc-123-def-456",
  "message": "Can you help me reduce costs?"
}
```

**From Server to Customer (Acknowledgment):**
```json
{
  "type": "agent_ack"
}
```

#### 4. Agent Message

**From Agent to Server:**
```json
{
  "type": "agent_message",
  "sessionId": "abc-123-def-456",
  "message": "Yes, I can help you with that!"
}
```

**From Server to Customer:**
```json
{
  "type": "response",
  "message": "Agent: Yes, I can help you with that!"
}
```

#### 5. Manual Connect

**From Agent to Server:**
```json
{
  "type": "manual_connect"
}
```

**From Server to Customer:**
```json
{
  "type": "response",
  "message": "You are now connected to a live agent. How can I help you?"
}
```

**From Server to Agent:**
```json
{
  "type": "clear_chat"
}
```

**Then:**
```json
{
  "type": "user_connected",
  "sessionId": "abc-123-def-456",
  "history": [
    {"sender": "user", "message": "What is my cost?"},
    {"sender": "bot", "message": "Your cost is $91"},
    {"sender": "user", "message": "I need an agent"}
  ]
}
```

#### 6. Stats Update

**From Server to All Agents:**
```json
{
  "type": "stats_update",
  "activeCount": 3,
  "queueCount": 2,
  "queue": [
    {"id": "abc-123", "waiting_time": "2 min"},
    {"id": "def-456", "waiting_time": "2 min"}
  ]
}
```

#### 7. End Chat

**From Agent to Server:**
```json
{
  "type": "end_chat",
  "sessionId": "abc-123-def-456"
}
```

**From Server to Agent:**
```json
{
  "type": "chat_ended_by_agent",
  "sessionId": "abc-123-def-456"
}
```

**From Server to Customer:**
```json
{
  "type": "feedback_request",
  "message": "Agent has marked this chat as resolved. Is your issue resolved?"
}
```

#### 8. Feedback Response

**From Customer to Server (Resolved):**
```json
{
  "type": "feedback_response",
  "resolved": true,
  "sessionId": "abc-123-def-456"
}
```

**Server Response:**
```json
{
  "type": "chat_resolved",
  "message": "Thank you for your feedback! Chat has been ended."
}
```

**From Customer to Server (Not Resolved):**
```json
{
  "type": "feedback_response",
  "resolved": false,
  "sessionId": "abc-123-def-456"
}
```

**Server Response:**
```json
{
  "type": "response",
  "message": "You are #1 in queue for another agent. Please wait..."
}
```

#### 9. User Disconnect

**From Customer to Server:**
```json
{
  "type": "user_disconnect",
  "sessionId": "abc-123-def-456"
}
```

**From Server to Agent (if paired):**
```json
{
  "type": "user_disconnected",
  "sessionId": "abc-123-def-456",
  "message": "User has disconnected from the chat"
}
```

---

## Complete Flow Examples

### Example 1: Customer Asks AI Question

```
Step 1: Customer sends message
→ Client to Server:
{
  "message": "What is my AWS cost for December 2025?",
  "sessionId": "abc-123"
}

Step 2: Server processes
- Store in history
- Check if paired with agent: NO
- Check if in queue: NO
- Detect intent: "bedrock"

Step 3: Call AWS Bedrock
→ Server to AWS:
invoke_agent(
  agentId="YQJCBMODNB",
  agentAliasId="E0OUO8GNO5",
  sessionId="abc-123",
  inputText="What is my AWS cost for December 2025?"
)

Step 4: AWS responds
← AWS to Server:
{
  'completion': [
    {'chunk': {'bytes': b'Your AWS cost for December 2025 is $91'}}
  ]
}

Step 5: Server sends to customer
→ Server to Client:
{
  "type": "response",
  "response": "Your AWS cost for December 2025 is $91"
}
```

### Example 2: Customer Requests Human Agent

```
Step 1: Customer sends message
→ Client to Server:
{
  "message": "I need to speak with an agent",
  "sessionId": "abc-123"
}

Step 2: Server processes
- Store in history
- Check if paired: NO
- Check if in queue: NO
- Detect intent: "human_agent" (keyword: "agent")

Step 3: Add to queue
- user_queue.append("abc-123")
- user_queue = ["abc-123"]
- position = 1

Step 4: Notify customer
→ Server to Client:
{
  "type": "response",
  "message": "You are #1 in queue. An agent will connect with you shortly..."
}

Step 5: Broadcast to all agents
→ Server to All Agents:
{
  "type": "stats_update",
  "activeCount": 0,
  "queueCount": 1,
  "queue": [
    {"id": "abc-123", "waiting_time": "2 min"}
  ]
}
```

### Example 3: Agent Connects to Customer

```
Step 1: Agent clicks "Connect Next"
→ Agent to Server:
{
  "type": "manual_connect"
}

Step 2: Server processes
- Check queue: ["abc-123"]
- Check agent status: "available"
- Pop from queue: waiting_session = "abc-123"
- user_queue = []

Step 3: Pair them
- user_sessions["abc-123"]["paired_agent"] = "agent-001-session"
- agent_status["agent-001-session"] = "busy"

Step 4: Notify customer
→ Server to Customer:
{
  "type": "response",
  "message": "You are now connected to a live agent. How can I help you?"
}

Step 5: Clear agent chat
→ Server to Agent:
{
  "type": "clear_chat"
}

Step 6: Send history to agent
→ Server to Agent:
{
  "type": "user_connected",
  "sessionId": "abc-123",
  "history": [
    {"sender": "user", "message": "What is my cost?"},
    {"sender": "bot", "message": "Your cost is $91"},
    {"sender": "user", "message": "I need to speak with an agent"}
  ]
}

Step 7: Update all agents
→ Server to All Agents:
{
  "type": "stats_update",
  "activeCount": 1,
  "queueCount": 0,
  "queue": []
}
```

### Example 4: Live Chat Between Agent and Customer

```
Step 1: Customer sends message
→ Customer to Server:
{
  "message": "Can you help me reduce costs?",
  "sessionId": "abc-123"
}

Step 2: Server checks pairing
- paired_agent = "agent-001-session"
- Agent is paired!

Step 3: Forward to agent
→ Server to Agent:
{
  "type": "user_message",
  "sessionId": "abc-123",
  "message": "Can you help me reduce costs?"
}

Step 4: Acknowledge to customer
→ Server to Customer:
{
  "type": "agent_ack"
}

Step 5: Agent types response
→ Agent to Server:
{
  "type": "agent_message",
  "sessionId": "abc-123",
  "message": "Yes! Let me analyze your usage patterns."
}

Step 6: Forward to customer
→ Server to Customer:
{
  "type": "response",
  "message": "Agent: Yes! Let me analyze your usage patterns."
}
```

### Example 5: Agent Ends Chat

```
Step 1: Agent clicks "End Chat"
→ Agent to Server:
{
  "type": "end_chat",
  "sessionId": "abc-123"
}

Step 2: Server unpairs
- user_sessions["abc-123"]["paired_agent"] = None
- agent_status["agent-001-session"] = "available"

Step 3: Notify agent
→ Server to Agent:
{
  "type": "chat_ended_by_agent",
  "sessionId": "abc-123"
}

Step 4: Request customer feedback
→ Server to Customer:
{
  "type": "feedback_request",
  "message": "Agent has marked this chat as resolved. Is your issue resolved?"
}

Step 5: Customer clicks "Issue Resolved"
→ Customer to Server:
{
  "type": "feedback_response",
  "resolved": true,
  "sessionId": "abc-123"
}

Step 6: Thank customer
→ Server to Customer:
{
  "type": "chat_resolved",
  "message": "Thank you for your feedback! Chat has been ended."
}

Step 7: Notify agent
→ Server to Agent:
{
  "type": "chat_ended_by_user",
  "sessionId": "abc-123"
}

Step 8: Update all agents
→ Server to All Agents:
{
  "type": "stats_update",
  "activeCount": 0,
  "queueCount": 0,
  "queue": []
}
```

---

## Error Handling

### WebSocket Errors

```python
try:
    async for message in websocket:
        data = json.loads(message)
        # Process message
except websockets.exceptions.ConnectionClosed:
    print(f"Connection closed: session={session_id}")
except json.JSONDecodeError:
    print("Invalid JSON received")
    continue
finally:
    # Cleanup resources
    cleanup_session(session_id)
```

### AWS Bedrock Errors

```python
try:
    response = bedrock_agent.invoke_agent(...)
    return agent_response
except Exception as e:
    print(f"Bedrock error: {e}")
    return "Sorry, I'm having trouble processing your request."
```

### Authentication Errors

```python
# Invalid credentials
if not user or user['password'] != password:
    return jsonify({'error': 'Invalid credentials'}), 401

# Inactive account
if user['active'] != 'true':
    return jsonify({'error': 'Account inactive'}), 403
```

---

## Performance Considerations

### Concurrent Message Broadcasting

```python
# Send to all agents concurrently
async def broadcast_stats():
    stats = {...}
    tasks = [aws.send(json.dumps(stats)) for aws in all_agents.values()]
    await asyncio.gather(*tasks, return_exceptions=True)
```

### Connection Pooling

```python
# Reuse WebSocket connections
all_agents = {}  # Keep connections alive
user_sessions = {}  # Maintain session state
```

### Memory Management

```python
# Clean up on disconnect
finally:
    if agent_id:
        available_agents.pop(agent_id, None)
        all_agents.pop(agent_id, None)
    if session_id:
        cleanup_session(session_id)
```

---

**End of Backend Documentation**
