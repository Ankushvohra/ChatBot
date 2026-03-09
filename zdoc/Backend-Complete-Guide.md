# ChatBot Backend - Complete Technical Guide

## 🎯 Overview

This guide explains the **complete backend flow** from UI interaction to server response. The backend consists of three main components:

1. **Flask Authentication Server** (Port 5001) - HTTP-based login
2. **WebSocket Server** (Port 8080) - Real-time chat communication
3. **AWS Bedrock Integration** - AI-powered responses

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Authentication Flow](#authentication-flow)
3. [WebSocket Communication](#websocket-communication)
4. [Message Flow Scenarios](#message-flow-scenarios)
5. [State Management](#state-management)
6. [AI Integration](#ai-integration)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
│                      http://localhost:3000                       │
└─────────────────────────────────────────────────────────────────┘
                    │                           │
                    │ HTTP POST                 │ WebSocket
                    │ (Login)                   │ (Chat)
                    ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   Flask Auth Server      │    │   WebSocket Server           │
│   Port 5001              │    │   Port 8080                  │
│   csv_auth.py            │    │   chatbot_server.py          │
└──────────────────────────┘    └──────────────────────────────┘
         │                                   │
         │ Reads                             │ Calls
         ▼                                   ▼
┌──────────────────────────┐    ┌──────────────────────────────┐
│   users.csv              │    │   chatbot_logic.py           │
│   (User Database)        │    │   (Intent Detection & AI)    │
└──────────────────────────┘    └──────────────────────────────┘
                                            │
                                            │ API Call
                                            ▼
                                ┌──────────────────────────────┐
                                │   AWS Bedrock Agent          │
                                │   (AI Response Generation)   │
                                └──────────────────────────────┘
```

---

## 🔐 Authentication Flow

### Step 1: Agent Opens Dashboard

**UI Action:**
```javascript
// Agent Dashboard Login Form
<form onSubmit={handleLogin}>
  <input type="email" value={email} />
  <input type="password" value={password} />
  <button type="submit">Login</button>
</form>
```

### Step 2: UI Sends Login Request

**Frontend Code:**
```javascript
const handleLogin = async (e) => {
  e.preventDefault();
  
  const response = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  // data = { success: true, user: {...} }
};
```

**What's Sent:**
```json
{
  "email": "agent1@company.com",
  "password": "Agent123!"
}
```

### Step 3: Flask Server Receives Request

**Backend Code (csv_auth.py):**
```python
@app.route('/api/auth/login', methods=['POST'])
def login():
    # 1. Extract credentials from request
    data = request.get_json()
    email = data.get('email')        # "agent1@company.com"
    password = data.get('password')  # "Agent123!"
    
    # 2. Load users from CSV file
    users = load_users()
    # users = {
    #   "agent1@company.com": {
    #     "uid": "agent-001",
    #     "email": "agent1@company.com",
    #     "password": "Agent123!",
    #     "name": "Agent One",
    #     "role": "agent",
    #     "active": "true"
    #   }
    # }
    
    # 3. Find user by email
    user = users.get(email)
    
    # 4. Validate credentials
    if not user or user['password'] != password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # 5. Check if account is active
    if user['active'] != 'true':
        return jsonify({'error': 'Account inactive'}), 403
    
    # 6. Create session
    session['user'] = {
        'uid': user['uid'],
        'email': email,
        'name': user['name'],
        'role': user['role']
    }
    
    # 7. Return success response
    return jsonify({
        'success': True,
        'user': session['user']
    })
```

### Step 4: CSV File Structure

**users.csv:**
```csv
uid,email,password,name,role,active
admin-001,admin@company.com,Admin123!,Admin User,admin,true
agent-001,agent1@company.com,Agent123!,Agent One,agent,true
agent-002,agent2@company.com,Agent123!,Agent Two,agent,true
```

**load_users() Function:**
```python
def load_users():
    users = {}
    with open(USERS_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Key: email, Value: entire row as dict
            users[row['email']] = row
    return users
```

### Step 5: Response Back to UI

**Success Response:**
```json
{
  "success": true,
  "user": {
    "uid": "agent-001",
    "email": "agent1@company.com",
    "name": "Agent One",
    "role": "agent"
  }
}
```

**Error Response (Invalid Credentials):**
```json
{
  "error": "Invalid credentials"
}
```

### Step 6: UI Handles Response

```javascript
if (data.success) {
  setUser(data.user);
  setIsAuthenticated(true);
  // Redirect to dashboard
} else {
  setError(data.error);
}
```

---

## 🔌 WebSocket Communication

### Connection Establishment

#### For Customers (ChatBot.js)

**Step 1: Customer Opens Chat**
```javascript
// Generate unique session ID
const [sessionId] = useState(() => crypto.randomUUID());
// Example: "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o"
```

**Step 2: Connect to WebSocket**
```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected to chatbot');
  setIsConnected(true);
};
```

**Step 3: Send First Message**
```javascript
const sendMessage = (message) => {
  ws.send(JSON.stringify({
    type: 'user_message',
    sessionId: sessionId,
    message: message
  }));
};
```

#### For Agents (AgentDashboard.js)

**Step 1: Agent Connects After Login**
```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // Send agent connection message
  ws.send(JSON.stringify({
    type: 'agent_connect',
    userId: user.uid,      // "agent-001"
    role: user.role        // "agent" or "admin"
  }));
};
```

---

## 📨 Message Flow Scenarios

### Scenario 1: Customer Sends AI Query

#### Step 1: Customer Types Message

**UI:**
```javascript
// Customer types: "What are my AWS costs?"
sendMessage("What are my AWS costs?");
```

**Message Sent:**
```json
{
  "type": "user_message",
  "sessionId": "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
  "message": "What are my AWS costs?"
}
```

#### Step 2: WebSocket Server Receives Message

**Backend (chatbot_server.py):**
```python
async def handler(websocket):
    async for message in websocket:
        data = json.loads(message)
        # data = {
        #   "type": "user_message",
        #   "sessionId": "a3f2b1c4...",
        #   "message": "What are my AWS costs?"
        # }
        
        msg_type = data.get("type")
        
        if msg_type == "user_message":
            await handle_user_message(session_id, websocket, data)
```

#### Step 3: Create User Session (First Message Only)

```python
async def handle_user_message(session_id, websocket, data):
    # First time user sends message
    if not session_id and data.get("sessionId"):
        session_id = data.get("sessionId")
        user_sessions[session_id] = {
            "ws": websocket,
            "paired_agent": None,
            "history": []
        }
        print(f"User session started: {session_id}")
```

**State After Creation:**
```python
user_sessions = {
  "a3f2b1c4...": {
    "ws": <WebSocket object>,
    "paired_agent": None,
    "history": []
  }
}
```

#### Step 4: Store Message in History

```python
user_message = data.get("message", "")
user_sessions[session_id]["history"].append({
    "sender": "user",
    "message": user_message
})
```

**History State:**
```python
user_sessions["a3f2b1c4..."]["history"] = [
  {"sender": "user", "message": "What are my AWS costs?"}
]
```

#### Step 5: Check if User is Paired with Agent

```python
# Check if user is already talking to an agent
if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
    # Route to agent (covered in Scenario 2)
    return True

# Check if user is in queue
if session_id in user_queue:
    # User is waiting for agent
    return True
```

#### Step 6: Detect Intent

```python
# Call chatbot_logic.py
intent = detect_intent(user_message)
```

**Intent Detection Logic (chatbot_logic.py):**
```python
def detect_intent(message):
    message = message.lower()  # "what are my aws costs?"
    
    human_agent_keywords = [
        "human", "agent", "representative", "person", 
        "talk to someone", "speak to someone", 
        "customer service", "support", "help me", 
        "connect me", "transfer", "escalate"
    ]
    
    # Check if any keyword matches
    if any(keyword in message for keyword in human_agent_keywords):
        return "human_agent"
    
    # No keywords found - use AI
    return "bedrock"
```

**Result:** `intent = "bedrock"` (no human keywords found)

#### Step 7: Handle Bedrock Intent

```python
response = handle_intent(intent, user_message, session_id)
```

**handle_intent Function (chatbot_logic.py):**
```python
def handle_intent(intent, user_message="", session_id=None):
    if intent == "bedrock":
        if not session_id:
            session_id = "default-session"
        
        # Call AWS Bedrock
        bedrock_response = invoke_bedrock_agent(user_message, session_id)
        
        return {"response": bedrock_response}
```

#### Step 8: Invoke AWS Bedrock

```python
def invoke_bedrock_agent(user_message, session_id):
    start_time = time.time()
    
    try:
        # Call AWS Bedrock API
        response = bedrock_agent.invoke_agent(
            agentId="YQJCBMODNB",
            agentAliasId="E0OUO8GNO5",
            sessionId=session_id,
            inputText=user_message
        )
        
        # Extract response from streaming chunks
        agent_response = ""
        for event in response['completion']:
            if 'chunk' in event and 'bytes' in event['chunk']:
                agent_response += event['chunk']['bytes'].decode('utf-8')
        
        response_time = time.time() - start_time
        print(f"Bedrock response time: {response_time:.2f} seconds")
        
        return agent_response
        
    except Exception as e:
        print(f"Bedrock error: {e}")
        return "Sorry, I'm having trouble processing your request."
```

**AWS Bedrock Response:**
```
"Your AWS costs for this month are $1,234.56. 
Here's the breakdown: EC2: $800, S3: $200, Lambda: $234.56"
```

#### Step 9: Store AI Response in History

```python
if session_id in user_sessions:
    user_sessions[session_id]["history"].append({
        "sender": "bot",
        "message": response.get("response", "")
    })
```

**Updated History:**
```python
user_sessions["a3f2b1c4..."]["history"] = [
  {"sender": "user", "message": "What are my AWS costs?"},
  {"sender": "bot", "message": "Your AWS costs for this month are $1,234.56..."}
]
```

#### Step 10: Send Response to Customer

```python
await websocket.send(json.dumps(response))
```

**Message Sent to UI:**
```json
{
  "response": "Your AWS costs for this month are $1,234.56. Here's the breakdown: EC2: $800, S3: $200, Lambda: $234.56"
}
```

#### Step 11: UI Receives and Displays Response

```javascript
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  setMessages(prev => [...prev, {
    sender: 'bot',
    text: data.response,
    timestamp: new Date()
  }]);
};
```

---

### Scenario 2: Customer Requests Human Agent

#### Step 1: Customer Types Message

```javascript
// Customer types: "I need to talk to a human agent"
sendMessage("I need to talk to a human agent");
```

**Message Sent:**
```json
{
  "type": "user_message",
  "sessionId": "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
  "message": "I need to talk to a human agent"
}
```

#### Step 2: Server Detects Intent

```python
intent = detect_intent("I need to talk to a human agent")
```

**Detection:**
```python
message = "i need to talk to a human agent"  # lowercased

# Check keywords
human_agent_keywords = ["human", "agent", "representative", ...]

# "human" found in message → return "human_agent"
return "human_agent"
```

**Result:** `intent = "human_agent"`

#### Step 3: Add User to Queue

```python
if intent == "human_agent":
    # Add to queue if not already there
    if session_id not in user_queue:
        user_queue.append(session_id)
    
    # Get position in queue
    position = user_queue.index(session_id) + 1
    
    # Send queue position to user
    await websocket.send(json.dumps({
        "type": "response",
        "message": f"You are #{position} in queue. An agent will connect with you shortly..."
    }))
```

**Queue State:**
```python
user_queue = ["a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o"]
```

#### Step 4: Broadcast Stats to All Agents

```python
await broadcast_stats()
```

**broadcast_stats Function:**
```python
async def broadcast_stats():
    stats = {
        "type": "stats_update",
        "activeCount": get_active_count(),  # 0 (no paired users)
        "queueCount": len(user_queue),      # 1
        "queue": get_queue_data()
    }
    
    # Send to all connected agents
    for agent_websocket in all_agents.values():
        await agent_websocket.send(json.dumps(stats))
```

**Message Sent to All Agents:**
```json
{
  "type": "stats_update",
  "activeCount": 0,
  "queueCount": 1,
  "queue": [
    {
      "id": "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
      "waiting_time": "2 min"
    }
  ]
}
```

#### Step 5: Agent Dashboard Updates

```javascript
// Agent Dashboard receives stats_update
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'stats_update') {
    setQueueCount(data.queueCount);  // Shows "1" in UI
    setQueue(data.queue);            // Shows customer in queue list
  }
};
```

#### Step 6: Agent Clicks "Connect to Next Customer"

```javascript
const handleManualConnect = () => {
  ws.send(JSON.stringify({
    type: 'manual_connect'
  }));
};
```

#### Step 7: Server Handles Manual Connect

```python
async def handle_manual_connect(agent_id, websocket):
    # Check if queue has customers and agent is available
    if user_queue and agent_id and agent_status.get(agent_id) == "available":
        # Get first customer from queue (FIFO)
        waiting_session = user_queue.pop(0)
        
        if waiting_session in user_sessions:
            await assign_agent_to_user(waiting_session, agent_id, websocket)
```

**Queue State After:**
```python
user_queue = []  # Empty - customer removed
```

#### Step 8: Assign Agent to Customer

```python
async def assign_agent_to_user(waiting_session, agent_id, agent_ws):
    # 1. Pair customer with agent
    user_sessions[waiting_session]["paired_agent"] = agent_id
    
    # 2. Mark agent as busy
    make_agent_busy(agent_id)
    
    # 3. Notify customer
    await user_sessions[waiting_session]["ws"].send(json.dumps({
        "type": "response",
        "message": "You are now connected to a live agent. How can I help you?"
    }))
    
    # 4. Clear agent's chat window
    await agent_ws.send(json.dumps({"type": "clear_chat"}))
    
    # 5. Send customer history to agent
    await agent_ws.send(json.dumps({
        "type": "user_connected",
        "sessionId": waiting_session,
        "history": user_sessions[waiting_session]["history"]
    }))
    
    # 6. Update all agents with new stats
    await broadcast_stats()
```

**State After Assignment:**
```python
user_sessions = {
  "a3f2b1c4...": {
    "ws": <WebSocket>,
    "paired_agent": "agent-001-session",  # NOW PAIRED
    "history": [
      {"sender": "user", "message": "What are my AWS costs?"},
      {"sender": "bot", "message": "Your AWS costs..."},
      {"sender": "user", "message": "I need to talk to a human agent"}
    ]
  }
}

agent_status = {
  "agent-001-session": "busy"  # Changed from "available"
}

available_agents = {}  # Agent removed from available pool
```

#### Step 9: Customer Sends Message to Agent

```javascript
// Customer types: "I have a billing issue"
sendMessage("I have a billing issue");
```

**Message Sent:**
```json
{
  "type": "user_message",
  "sessionId": "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
  "message": "I have a billing issue"
}
```

#### Step 10: Server Routes to Paired Agent

```python
async def handle_user_message(session_id, websocket, data):
    user_message = data.get("message", "")
    
    # Store in history
    user_sessions[session_id]["history"].append({
        "sender": "user",
        "message": user_message
    })
    
    # Check if paired with agent
    if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
        paired = user_sessions[session_id]["paired_agent"]  # "agent-001-session"
        
        if paired in all_agents:
            # Send to agent
            await all_agents[paired].send(json.dumps({
                "type": "user_message",
                "sessionId": session_id,
                "message": user_message
            }))
        
        # Acknowledge to customer
        await websocket.send(json.dumps({"type": "agent_ack"}))
        return True  # Message handled
```

**Message Sent to Agent:**
```json
{
  "type": "user_message",
  "sessionId": "a3f2b1c4-5d6e-7f8g-9h0i-1j2k3l4m5n6o",
  "message": "I have a billing issue"
}
```

#### Step 11: Agent Responds

```javascript
// Agent types: "I'll help you with that. Can you provide your account ID?"
ws.send(JSON.stringify({
  type: 'agent_message',
  sessionId: currentSession,
  message: "I'll help you with that. Can you provide your account ID?"
}));
```

#### Step 12: Server Routes Agent Message to Customer

```python
async def handle_agent_message(data):
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

**Message Sent to Customer:**
```json
{
  "type": "response",
  "message": "Agent: I'll help you with that. Can you provide your account ID?"
}
```

---

### Scenario 3: Agent Ends Chat

#### Step 1: Agent Clicks "End Chat"

```javascript
const handleEndChat = () => {
  ws.send(JSON.stringify({
    type: 'end_chat',
    sessionId: currentSession
  }));
};
```

#### Step 2: Server Handles End Chat

```python
async def handle_end_chat(agent_id, websocket, data):
    target_session = data.get("sessionId")
    
    if target_session not in user_sessions:
        return
    
    # Verify this agent is paired with this customer
    if user_sessions[target_session].get("paired_agent") == agent_id:
        # Unpair
        user_sessions[target_session]["paired_agent"] = None
        
        # Make agent available again
        make_agent_available(agent_id, websocket)
        
        # Notify agent
        await websocket.send(json.dumps({
            "type": "chat_ended_by_agent",
            "sessionId": target_session
        }))
    
    # Ask customer for feedback
    await user_sessions[target_session]["ws"].send(json.dumps({
        "type": "feedback_request",
        "message": "Agent has marked this chat as resolved. Is your issue resolved?"
    }))
    
    # Update stats
    await broadcast_stats()
```

#### Step 3: Customer Provides Feedback

```javascript
// Customer clicks "Yes" button
ws.send(JSON.stringify({
  type: 'feedback_response',
  resolved: true
}));
```

#### Step 4: Server Handles Feedback

```python
async def handle_feedback_response(session_id, websocket, data):
    feedback = data.get("resolved")
    
    if feedback:  # Customer said "Yes"
        # End chat completely
        await websocket.send(json.dumps({
            "type": "chat_resolved",
            "message": "Thank you for your feedback! Chat has been ended."
        }))
    else:  # Customer said "No"
        # Add back to queue
        if session_id not in user_queue:
            user_queue.append(session_id)
        
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue for another agent. Please wait..."
        }))
        
        await broadcast_stats()
```

---

## 🗄️ State Management

### Global State Variables

```python
# All connected agents (including busy ones)
all_agents = {
  "agent-001-session": <WebSocket>,
  "admin-001-1772620005": <WebSocket>
}

# Only available agents (not busy)
available_agents = {
  "agent-001-session": <WebSocket>
}

# Agent status tracking
agent_status = {
  "agent-001-session": "available",  # or "busy" or "offline"
  "admin-001-1772620005": "busy"
}

# Active sessions for non-admin agents (limit 1 session)
active_sessions = {
  "agent-001": "agent-001-session"
}

# Customer sessions
user_sessions = {
  "a3f2b1c4...": {
    "ws": <WebSocket>,
    "paired_agent": "agent-001-session",
    "history": [
      {"sender": "user", "message": "Hello"},
      {"sender": "bot", "message": "Hi there!"}
    ]
  }
}

# Queue of waiting customers (FIFO)
user_queue = ["b4c5d6e7...", "c5d6e7f8..."]
```

### Agent ID Generation

```python
# For regular agents (limited to 1 session)
if user_role != "admin":
    agent_id = f"{user_id}-session"
    # Example: "agent-001-session"
    
    # Check if already has active session
    if user_id in active_sessions:
        # Reject connection
        await websocket.send(json.dumps({
            "type": "session_limit_error",
            "message": "You can only have one active session."
        }))
        return None
    
    active_sessions[user_id] = agent_id

# For admin (unlimited sessions)
else:
    agent_id = f"{user_id}-{int(time.time())}"
    # Example: "admin-001-1772620005"
```

---

## 🤖 AI Integration

### AWS Bedrock Setup

```python
# Initialize Bedrock client
session = boto3.Session(region_name="us-east-1")
bedrock_agent = session.client('bedrock-agent-runtime')
```

### Invoke Agent

```python
response = bedrock_agent.invoke_agent(
    agentId="YQJCBMODNB",           # Your Bedrock agent ID
    agentAliasId="E0OUO8GNO5",      # Agent alias ID
    sessionId=session_id,            # Customer session ID
    inputText=user_message           # Customer's question
)
```

### Response Processing

```python
# Bedrock returns streaming response
agent_response = ""
for event in response['completion']:
    if 'chunk' in event and 'bytes' in event['chunk']:
        # Decode each chunk and append
        agent_response += event['chunk']['bytes'].decode('utf-8')

return agent_response
```

---

## 🔄 Complete Flow Diagram

```
CUSTOMER                    WEBSOCKET SERVER              AWS BEDROCK
   │                              │                            │
   │──── "What are costs?" ──────>│                            │
   │                              │                            │
   │                              │──── detect_intent() ───────│
   │                              │      (returns "bedrock")   │
   │                              │                            │
   │                              │──── invoke_agent() ───────>│
   │                              │                            │
   │                              │<─── AI Response ───────────│
   │                              │                            │
   │<──── "Your costs are..." ────│                            │
   │                              │                            │
   │                              │                            │
   │──── "Need human agent" ─────>│                            │
   │                              │                            │
   │                              │──── detect_intent() ───────│
   │                              │   (returns "human_agent")  │
   │                              │                            │
   │                              │──── Add to queue ──────────│
   │                              │                            │
   │<──── "You are #1 in queue" ──│                            │
   │                              │                            │
   │                              │──── broadcast_stats() ─────>AGENTS
   │                              │                            │
   │                              │<─── manual_connect ────────│
   │                              │                            │
   │                              │──── assign_agent() ────────│
   │                              │                            │
   │<──── "Connected to agent" ───│                            │
   │                              │                            │
   │──── "I have an issue" ──────>│                            │
   │                              │                            │
   │                              │──── Route to agent ───────>│
   │                              │                            │
   │                              │<─── Agent response ────────│
   │                              │                            │
   │<──── "Agent: I'll help..." ──│                            │
```

---

## 📊 Key Takeaways

### Authentication
- **Flask** handles HTTP login (one-time)
- **CSV file** stores user credentials
- **Session** created on successful login

### WebSocket Communication
- **Persistent connection** for real-time chat
- **Bidirectional** messaging (client ↔ server)
- **State management** tracks all sessions

### Message Routing
- **Intent detection** determines AI vs Human
- **Queue system** manages waiting customers
- **Pairing logic** connects agents to customers

### AI Integration
- **AWS Bedrock** provides AI responses
- **Streaming** response for faster delivery
- **Session-based** conversation context

---

**This is the complete backend flow from UI interaction to server response!**
