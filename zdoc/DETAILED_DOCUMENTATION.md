# ChatBot Project - Complete Technical Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Component Details](#component-details)
3. [Data Flow & Communication](#data-flow--communication)
4. [Complete Code Walkthrough](#complete-code-walkthrough)
5. [Message Flow Examples](#message-flow-examples)

---

## System Architecture

### Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                         CHATBOT SYSTEM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐                    │
│  │   Customer   │         │    Agent     │                    │
│  │   Browser    │         │  Dashboard   │                    │
│  │ (Port 3000)  │         │ (Port 3000)  │                    │
│  └──────┬───────┘         └──────┬───────┘                    │
│         │                        │                             │
│         │    WebSocket (ws://localhost:8080)                   │
│         │                        │                             │
│         └────────┬───────────────┘                             │
│                  │                                              │
│         ┌────────▼────────┐                                    │
│         │  WebSocket      │                                    │
│         │  Server         │                                    │
│         │  (Port 8080)    │                                    │
│         └────────┬────────┘                                    │
│                  │                                              │
│         ┌────────┼────────┐                                    │
│         │        │        │                                    │
│    ┌────▼───┐ ┌─▼────┐ ┌─▼──────┐                            │
│    │ Queue  │ │ AI   │ │ Agent  │                            │
│    │Manager │ │Logic │ │Manager │                            │
│    └────┬───┘ └─┬────┘ └─┬──────┘                            │
│         │       │        │                                     │
│         │   ┌───▼────────▼───┐                                │
│         │   │  AWS Bedrock   │                                │
│         │   │   AI Agent     │                                │
│         │   └────────────────┘                                │
│         │                                                      │
│    ┌────▼─────────┐                                           │
│    │ Flask Auth   │                                           │
│    │ (Port 5001)  │                                           │
│    └──────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 | Customer & Agent UI |
| WebSocket | Python websockets | Real-time communication |
| AI | AWS Bedrock | Natural language processing |
| Auth | Flask + CSV | User authentication |
| State | In-memory dictionaries | Session management |

---

## Component Details

### 1. Customer Chat Interface (ChatBot.js)

#### State Management
```javascript
// Session & Connection
const [sessionId] = useState(() => crypto.randomUUID()); // Unique ID
const [ws, setWs] = useState(null);                      // WebSocket connection
const [isOpen, setIsOpen] = useState(false);             // Chat window state

// Messages & Communication
const [messages, setMessages] = useState([]);            // Chat history
const [inputText, setInputText] = useState('');          // User input
const [isWaiting, setIsWaiting] = useState(false);       // Loading state

// Voice Input
const [isRecording, setIsRecording] = useState(false);   // Recording state
const [liveTranscript, setLiveTranscript] = useState(''); // Live speech text
const [volumeLevel, setVolumeLevel] = useState(0);       // Mic volume

// Session Management
const [isSessionExpired, setIsSessionExpired] = useState(false);
const SESSION_TIMEOUT = 300000; // 5 minutes in milliseconds
```

#### WebSocket Connection Setup
```javascript
useEffect(() => {
  if (!isOpen) return;
  if (ws) return; // Already connected
  
  // Create WebSocket connection
  const websocket = new WebSocket('ws://localhost:8080');
  
  // Connection opened
  websocket.onopen = () => {
    console.log('Connected to WebSocket');
  };
  
  // Connection closed
  websocket.onclose = () => {
    console.log('WebSocket connection closed');
  };
  
  // Receive messages
  websocket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      // Handle different message types
      if (data.type === 'response') {
        setMessages(prev => [...prev, { 
          text: data.message, 
          sender: 'bot', 
          time: new Date() 
        }]);
        setIsWaiting(false);
      }
      
      if (data.type === 'agent_ack') {
        setIsWaiting(false); // Agent received message
      }
      
      // ... more handlers
    } catch (error) {
      console.error('Message parsing error:', error);
    }
  };
  
  // Error handling
  websocket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  setWs(websocket);
}, [isOpen]);
```

#### Sending Messages
```javascript
const sendMessage = () => {
  if (isSessionExpired || chatEnded) return;
  
  if (inputText.trim() && ws && !isWaiting) {
    // Add message to UI immediately
    setMessages(prev => [...prev, { 
      text: inputText, 
      sender: 'user', 
      time: new Date() 
    }]);
    
    // Send to server via WebSocket
    ws.send(JSON.stringify({ 
      message: inputText, 
      sessionId: sessionId 
    }));
    
    setInputText('');
    setIsWaiting(true); // Show loading indicator
    resetInactivityTimer(); // Reset timeout
  }
};
```

#### Voice Input Implementation
```javascript
useEffect(() => {
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    
    recognitionRef.current.onresult = (event) => {
      if (!isRecordingRef.current) return;
      
      let interim = '';
      let final = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      
      const currentText = final || interim;
      setLiveTranscript(currentText);
      
      // Auto-send after 3 seconds of silence
      if (currentText) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (currentText.trim() && isRecordingRef.current && !isWaiting) {
            if (ws) {
              setMessages(prev => [...prev, { 
                text: currentText, 
                sender: 'user', 
                time: new Date() 
              }]);
              ws.send(JSON.stringify({ 
                message: currentText, 
                sessionId 
              }));
              setIsWaiting(true);
            }
            setLiveTranscript('');
          }
        }, 3000);
      }
    };
  }
}, [ws, isWaiting]);
```

---

### 2. WebSocket Server (chatbot_server.py)

#### Global State Variables
```python
# State dictionaries
available_agents = {}    # {agent_id: websocket} - Available agents
all_agents = {}          # {agent_id: websocket} - All connected agents
agent_status = {}        # {agent_id: "available"|"busy"|"offline"}
active_sessions = {}     # {user_id: agent_id} - Active agent sessions
user_sessions = {}       # {session_id: {ws, paired_agent, history}}
user_queue = []          # [session_id, ...] - FIFO queue
```

#### Main Handler Function
```python
async def handler(websocket):
    session_id = None
    agent_id = None

    try:
        # Listen for messages
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            # Route based on message type
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
            
            elif msg_type == "user_disconnect":
                await handle_user_disconnect(session_id)
                break
            
            elif msg_type == "disconnect":
                break
            
            else:
                # Handle user messages
                if not session_id and data.get("sessionId"):
                    session_id = data.get("sessionId")
                    user_sessions[session_id] = {
                        "ws": websocket, 
                        "paired_agent": None, 
                        "history": []
                    }
                    print(f"User session started: {session_id}")
                
                await handle_user_message(session_id, websocket, data)

    except websockets.exceptions.ConnectionClosed:
        print(f"Connection closed: session={session_id}, agent={agent_id}")
    finally:
        # Cleanup on disconnect
        if agent_id:
            available_agents.pop(agent_id, None)
            all_agents.pop(agent_id, None)
            agent_status.pop(agent_id, None)
        
        if session_id:
            cleanup_session(session_id)
```

#### Agent Connection Handler
```python
async def handle_agent_connect(websocket, data):
    user_role = data.get("role", "agent")
    user_id = data.get("userId")
    
    # Check session limit for non-admin agents
    if user_role != "admin" and user_id in active_sessions:
        await websocket.send(json.dumps({
            "type": "session_limit_error",
            "message": "You can only have one active session."
        }))
        await websocket.close()
        return None
    
    # Generate agent ID
    if user_role != "admin":
        agent_id = f"{user_id}-session"
        active_sessions[user_id] = agent_id
    else:
        # Admin gets timestamp-based ID for multiple sessions
        agent_id = f"{user_id}-{int(time.time())}"
    
    # Register agent
    all_agents[agent_id] = websocket
    make_agent_available(agent_id, websocket)
    print(f"Agent connected: {agent_id} (Role: {user_role})")
    
    # Send confirmation with current stats
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
async def handle_user_message(session_id, websocket, data):
    user_message = data.get("message", "")
    
    # Store in history
    if session_id in user_sessions:
        user_sessions[session_id]["history"].append({
            "sender": "user", 
            "message": user_message
        })
    
    # Check if paired with agent
    if session_id in user_sessions and user_sessions[session_id].get("paired_agent"):
        paired = user_sessions[session_id]["paired_agent"]
        if paired in all_agents:
            # Forward to agent
            await all_agents[paired].send(json.dumps({
                "type": "user_message",
                "sessionId": session_id,
                "message": user_message
            }))
        # Acknowledge to user
        await websocket.send(json.dumps({"type": "agent_ack"}))
        return True
    
    # Check if in queue
    if session_id in user_queue:
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are still #{position} in queue."
        }))
        return True
    
    # Detect intent
    intent = detect_intent(user_message)
    
    if intent == "human_agent":
        # Add to queue
        if session_id not in user_queue:
            user_queue.append(session_id)
        position = user_queue.index(session_id) + 1
        await websocket.send(json.dumps({
            "type": "response",
            "message": f"You are #{position} in queue."
        }))
        await broadcast_stats()
    else:
        # Handle with AI
        response = handle_intent(intent, user_message, session_id)
        if session_id in user_sessions:
            user_sessions[session_id]["history"].append({
                "sender": "bot", 
                "message": response.get("response", "")
            })
        await websocket.send(json.dumps(response))
    
    return False
```


---

### 3. AI Integration (chatbot_logic.py)

#### Intent Detection
```python
def detect_intent(message):
    """Detect if user wants to connect to human agent"""
    message = message.lower()
    
    # Keywords that indicate user wants human agent
    human_agent_keywords = [
        "human", "agent", "representative", "person", 
        "talk to someone", "speak to someone", 
        "customer service", "support", "help me", 
        "connect me", "transfer", "escalate"
    ]
    
    if any(keyword in message for keyword in human_agent_keywords):
        return "human_agent"
    
    # Default to bedrock for all other queries
    return "bedrock"
```

#### AWS Bedrock Integration
```python
import boto3
import time

# Initialize Bedrock client
session = boto3.Session(region_name="us-east-1")
bedrock_agent = session.client('bedrock-agent-runtime')

def invoke_bedrock_agent(user_message, session_id):
    """Invoke AWS Bedrock agent with user message"""
    start_time = time.time()
    
    try:
        # Call Bedrock API
        response = bedrock_agent.invoke_agent(
            agentId="YQJCBMODNB",
            agentAliasId="E0OUO8GNO5",
            sessionId=session_id,
            inputText=user_message
        )
        
        # Parse streaming response
        agent_response = ""
        for event in response['completion']:
            if 'chunk' in event and 'bytes' in event['chunk']:
                agent_response += event['chunk']['bytes'].decode('utf-8')
        
        response_time = time.time() - start_time
        print(f"Bedrock response time: {response_time:.2f} seconds")
        
        return agent_response
    except Exception as e:
        response_time = time.time() - start_time
        print(f"Bedrock error after {response_time:.2f} seconds: {e}")
        return "Sorry, I'm having trouble processing your request."
```

#### Intent Handler
```python
def handle_intent(intent, user_message="", session_id=None):
    """Handle the detected intent"""
    if intent == "human_agent":
        return {
            "response": "I understand you'd like to speak with a human agent."
        }
    
    elif intent == "bedrock":
        if not session_id:
            session_id = "default-session"
        bedrock_response = invoke_bedrock_agent(user_message, session_id)
        return {"response": bedrock_response}
    
    else:
        return {
            "response": "I'm here to help! You can ask me questions."
        }
```

---

### 4. Authentication System (csv_auth.py)

#### Flask Server Setup
```python
from flask import Flask, request, jsonify, session
from flask_cors import CORS
import csv
import os

app = Flask(__name__)
app.secret_key = 'chatbot-session-secret-2024'
CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

USERS_CSV = os.path.join(os.path.dirname(__file__), 'users.csv')
```

#### User Loading
```python
def load_users():
    """Load users from CSV file"""
    users = {}
    with open(USERS_CSV, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            users[row['email']] = row
    return users
```

#### Login Endpoint
```python
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    users = load_users()
    user = users.get(email)
    
    # Validate credentials
    if not user or user['password'] != password:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Check if account is active
    if user['active'] != 'true':
        return jsonify({'error': 'Account inactive'}), 403
    
    # Create session
    session['user'] = {
        'uid': user['uid'],
        'email': email,
        'name': user['name'],
        'role': user['role']
    }
    
    return jsonify({
        'success': True,
        'user': session['user']
    })
```

#### Logout Endpoint
```python
@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success': True})
```

#### Server Startup
```python
if __name__ == '__main__':
    print("Auth Server on port 5001")
    print("Login: admin@company.com/Admin123!")
    app.run(debug=True, port=5001)
```

---

## Data Flow & Communication

### Complete Message Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER SENDS MESSAGE                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Customer Types: "What is my AWS cost?"                      │
│    - Input captured in React state                             │
│    - Message added to UI immediately                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. WebSocket Send (Client → Server)                            │
│    ws.send(JSON.stringify({                                     │
│      message: "What is my AWS cost?",                           │
│      sessionId: "abc-123-def-456"                               │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Server Receives Message                                      │
│    - Parse JSON data                                            │
│    - Extract sessionId and message                              │
│    - Store in user_sessions[sessionId]["history"]              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Check User Status                                            │
│    - Is user paired with agent? → Forward to agent              │
│    - Is user in queue? → Send queue position                    │
│    - Otherwise → Process with AI                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Intent Detection                                             │
│    intent = detect_intent("What is my AWS cost?")              │
│    Result: "bedrock" (no human keywords found)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. AWS Bedrock API Call                                         │
│    response = bedrock_agent.invoke_agent(                       │
│      agentId="YQJCBMODNB",                                      │
│      agentAliasId="E0OUO8GNO5",                                 │
│      sessionId="abc-123-def-456",                               │
│      inputText="What is my AWS cost?"                           │
│    )                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Parse Bedrock Response                                       │
│    - Stream chunks from response['completion']                  │
│    - Decode bytes to UTF-8 string                               │
│    - Combine into full response                                 │
│    Result: "Your AWS cost for December 2025 is $91"            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Send Response to Client                                      │
│    await websocket.send(json.dumps({                            │
│      "type": "response",                                        │
│      "response": "Your AWS cost for December 2025 is $91"      │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Client Receives Response                                     │
│    websocket.onmessage = (event) => {                           │
│      const data = JSON.parse(event.data);                       │
│      if (data.type === 'response') {                            │
│        setMessages(prev => [...prev, {                          │
│          text: data.response,                                   │
│          sender: 'bot',                                         │
│          time: new Date()                                       │
│        }]);                                                     │
│        setIsWaiting(false);                                     │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. Display in UI                                               │
│     - Message appears in chat window                            │
│     - Loading indicator removed                                 │
│     - User can send next message                                │
└─────────────────────────────────────────────────────────────────┘
```

---

### Agent Connection Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    AGENT OPENS DASHBOARD                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent Clicks "Agent Dashboard" Button                       │
│    - New window opens with login form                           │
│    - URL: about:blank (dynamically generated)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Agent Enters Credentials                                     │
│    Email: agent1@company.com                                    │
│    Password: Agent123!                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. HTTP POST to Auth Server                                     │
│    fetch('http://localhost:5001/api/auth/login', {             │
│      method: 'POST',                                            │
│      headers: {'Content-Type': 'application/json'},            │
│      body: JSON.stringify({                                     │
│        email: 'agent1@company.com',                             │
│        password: 'Agent123!'                                    │
│      })                                                         │
│    })                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Auth Server Validates                                        │
│    - Load users from CSV                                        │
│    - Check email exists                                         │
│    - Verify password matches                                    │
│    - Check account is active                                    │
│    - Create session                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Return User Data                                             │
│    Response: {                                                  │
│      success: true,                                             │
│      user: {                                                    │
│        uid: "agent-001",                                        │
│        email: "agent1@company.com",                             │
│        name: "Agent One",                                       │
│        role: "agent"                                            │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Load Dashboard UI                                            │
│    - Replace login form with dashboard                          │
│    - Initialize WebSocket connection                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Connect to WebSocket Server                                  │
│    ws = new WebSocket('ws://localhost:8080');                   │
│    ws.onopen = function() {                                     │
│      ws.send(JSON.stringify({                                   │
│        type: 'agent_connect',                                   │
│        agentId: 'agent-001',                                    │
│        role: 'agent',                                           │
│        userId: 'agent-001'                                      │
│      }));                                                       │
│    };                                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Server Processes Agent Connection                            │
│    - Check if agent already has active session                  │
│    - Generate agent_id: "agent-001-session"                     │
│    - Add to all_agents dictionary                               │
│    - Mark as available                                          │
│    - Send confirmation with queue stats                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Agent Receives Confirmation                                  │
│    Message: {                                                   │
│      type: "agent_connected",                                   │
│      agentId: "agent-001-session",                              │
│      activeCount: 0,                                            │
│      queueCount: 0,                                             │
│      queue: []                                                  │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. Dashboard Ready                                             │
│     - Display "Connected" status                                │
│     - Show queue count: 0                                       │
│     - Enable "Connect Next" button                              │
│     - Ready to receive customers                                │
└─────────────────────────────────────────────────────────────────┘
```


---

### Human Agent Handoff Flow

```
┌─────────────────────────────────────────────────────────────────┐
│          CUSTOMER REQUESTS HUMAN AGENT                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Customer Types: "I need to speak with an agent"             │
│    - Message sent via WebSocket                                 │
│    - sessionId: "customer-abc-123"                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Server Receives Message                                      │
│    data = {                                                     │
│      message: "I need to speak with an agent",                  │
│      sessionId: "customer-abc-123"                              │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Intent Detection                                             │
│    intent = detect_intent("I need to speak with an agent")     │
│    Keywords found: ["agent"]                                    │
│    Result: "human_agent"                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Add Customer to Queue                                        │
│    if session_id not in user_queue:                             │
│        user_queue.append("customer-abc-123")                    │
│    Current queue: ["customer-abc-123"]                          │
│    Position: 1                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Notify Customer                                              │
│    await websocket.send(json.dumps({                            │
│      "type": "response",                                        │
│      "message": "You are #1 in queue. An agent will connect..." │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Broadcast Stats to All Agents                                │
│    await broadcast_stats()                                      │
│    Message to all agents: {                                     │
│      type: "stats_update",                                      │
│      activeCount: 0,                                            │
│      queueCount: 1,                                             │
│      queue: [{                                                  │
│        id: "customer-abc-123",                                  │
│        waiting_time: "2 min"                                    │
│      }]                                                         │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Agent Sees Queue Update                                      │
│    - Dashboard shows: Queue Count: 1                            │
│    - Customer ID displayed: customer-abc-123                    │
│    - "Connect Next" button enabled                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Agent Clicks "Connect Next"                                  │
│    ws.send(JSON.stringify({                                     │
│      type: 'manual_connect'                                     │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9. Server Processes Connection                                  │
│    async def handle_manual_connect(agent_id, websocket):        │
│      if user_queue and agent_status.get(agent_id) == "available": │
│        waiting_session = user_queue.pop(0)  # Remove from queue │
│        await assign_agent_to_user(waiting_session, agent_id, websocket) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 10. Assign Agent to Customer                                    │
│     user_sessions["customer-abc-123"]["paired_agent"] = "agent-001-session" │
│     make_agent_busy("agent-001-session")                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 11. Notify Customer                                             │
│     await user_sessions["customer-abc-123"]["ws"].send({        │
│       type: "response",                                         │
│       message: "You are now connected to a live agent..."       │
│     })                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 12. Send Chat History to Agent                                  │
│     await agent_ws.send(json.dumps({                            │
│       type: "clear_chat"                                        │
│     }))                                                         │
│     await agent_ws.send(json.dumps({                            │
│       type: "user_connected",                                   │
│       sessionId: "customer-abc-123",                            │
│       history: [                                                │
│         {sender: "user", message: "What is my AWS cost?"},      │
│         {sender: "bot", message: "Your cost is $91"},           │
│         {sender: "user", message: "I need to speak with agent"} │
│       ]                                                         │
│     }))                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 13. Agent Dashboard Updates                                     │
│     - Shows chat history                                        │
│     - Displays "User is now live"                               │
│     - Input field enabled                                       │
│     - Status changed to "Busy"                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 14. Live Chat Active                                            │
│     Customer ←→ WebSocket Server ←→ Agent                       │
│     All messages routed directly between them                   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Agent-Customer Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│              AGENT AND CUSTOMER CHATTING                        │
└─────────────────────────────────────────────────────────────────┘

Customer sends: "Can you help me reduce my AWS costs?"
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Customer Message to Server                                   │
│    ws.send(JSON.stringify({                                     │
│      message: "Can you help me reduce my AWS costs?",           │
│      sessionId: "customer-abc-123"                              │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Server Checks Pairing                                        │
│    paired_agent = user_sessions["customer-abc-123"]["paired_agent"] │
│    Result: "agent-001-session"                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Forward to Agent                                             │
│    await all_agents["agent-001-session"].send(json.dumps({      │
│      type: "user_message",                                      │
│      sessionId: "customer-abc-123",                             │
│      message: "Can you help me reduce my AWS costs?"            │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Agent Receives Message                                       │
│    - Message appears in agent dashboard                         │
│    - Displayed as: "User: Can you help me reduce my AWS costs?" │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Agent Types Response                                         │
│    "Yes, I can help! Let me analyze your usage patterns."       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Agent Sends Message                                          │
│    ws.send(JSON.stringify({                                     │
│      type: 'agent_message',                                     │
│      sessionId: 'customer-abc-123',                             │
│      message: 'Yes, I can help! Let me analyze...'              │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Server Processes Agent Message                               │
│    async def handle_agent_message(data):                        │
│      target_session = data.get("sessionId")                     │
│      msg_text = data.get("message")                             │
│      # Store in history                                         │
│      user_sessions[target_session]["history"].append({          │
│        sender: "agent",                                         │
│        message: msg_text                                        │
│      })                                                         │
│      # Forward to customer                                      │
│      await user_sessions[target_session]["ws"].send(...)        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Customer Receives Response                                   │
│    Message: {                                                   │
│      type: "response",                                          │
│      message: "Agent: Yes, I can help! Let me analyze..."       │
│    }                                                            │
│    - Displayed in customer chat window                          │
└─────────────────────────────────────────────────────────────────┘
```

---

### End Chat Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   AGENT ENDS CHAT                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. Agent Clicks "End Chat" Button                              │
│    ws.send(JSON.stringify({                                     │
│      type: 'end_chat',                                          │
│      sessionId: 'customer-abc-123'                              │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Server Processes End Chat                                    │
│    async def handle_end_chat(agent_id, websocket, data):        │
│      target_session = data.get("sessionId")                     │
│      # Unpair agent from customer                               │
│      user_sessions[target_session]["paired_agent"] = None       │
│      # Make agent available again                               │
│      make_agent_available(agent_id, websocket)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Notify Agent                                                 │
│    await websocket.send(json.dumps({                            │
│      type: "chat_ended_by_agent",                               │
│      sessionId: target_session                                  │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Request Customer Feedback                                    │
│    await user_sessions[target_session]["ws"].send(json.dumps({  │
│      type: "feedback_request",                                  │
│      message: "Agent has marked this chat as resolved..."       │
│    }))                                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Customer Sees Feedback Buttons                               │
│    - "Issue Resolved" button                                    │
│    - "Need Another Agent" button                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Customer Clicks "Issue Resolved"                             │
│    ws.send(JSON.stringify({                                     │
│      type: 'feedback_response',                                 │
│      resolved: true,                                            │
│      sessionId: 'customer-abc-123'                              │
│    }));                                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7. Server Processes Feedback                                    │
│    if feedback == true:                                         │
│      # Notify agent                                             │
│      await all_agents[paired_agent].send(json.dumps({           │
│        type: "chat_ended_by_user",                              │
│        sessionId: session_id                                    │
│      }))                                                        │
│      # Thank customer                                           │
│      await websocket.send(json.dumps({                          │
│        type: "chat_resolved",                                   │
│        message: "Thank you for your feedback!"                  │
│      }))                                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8. Update Stats                                                 │
│    await broadcast_stats()                                      │
│    - Agent status: Available                                    │
│    - Queue count updated                                        │
│    - Active count decremented                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Complete Code Examples

### Example 1: Customer Asks AI Question

**Customer Input:**
```
"What are my AWS costs for December 2025?"
```

**Client Code (ChatBot.js):**
```javascript
const sendMessage = () => {
  const message = "What are my AWS costs for December 2025?";
  
  // Add to UI
  setMessages(prev => [...prev, { 
    text: message, 
    sender: 'user', 
    time: new Date() 
  }]);
  
  // Send to server
  ws.send(JSON.stringify({ 
    message: message, 
    sessionId: "abc-123-def-456" 
  }));
  
  setIsWaiting(true);
};
```

**Server Code (chatbot_server.py):**
```python
# Receive message
data = {
  "message": "What are my AWS costs for December 2025?",
  "sessionId": "abc-123-def-456"
}

# Detect intent
intent = detect_intent(data["message"])
# Returns: "bedrock"

# Call AI
response = handle_intent("bedrock", data["message"], data["sessionId"])
# Returns: {"response": "Your AWS cost for December 2025 is $91"}

# Send back to customer
await websocket.send(json.dumps({
  "type": "response",
  "response": "Your AWS cost for December 2025 is $91"
}))
```

**Client Receives:**
```javascript
websocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data = {type: "response", response: "Your AWS cost for December 2025 is $91"}
  
  setMessages(prev => [...prev, { 
    text: "Your AWS cost for December 2025 is $91", 
    sender: 'bot', 
    time: new Date() 
  }]);
  setIsWaiting(false);
};
```

---

### Example 2: Customer Requests Human Agent

**Customer Input:**
```
"I need to speak with a human agent"
```

**Server Processing:**
```python
# 1. Receive message
user_message = "I need to speak with a human agent"
session_id = "abc-123-def-456"

# 2. Detect intent
intent = detect_intent(user_message)
# Keywords found: ["human", "agent"]
# Returns: "human_agent"

# 3. Add to queue
if session_id not in user_queue:
    user_queue.append(session_id)
# user_queue = ["abc-123-def-456"]

# 4. Get position
position = user_queue.index(session_id) + 1
# position = 1

# 5. Notify customer
await websocket.send(json.dumps({
    "type": "response",
    "message": f"You are #{position} in queue. An agent will connect with you shortly..."
}))

# 6. Broadcast to agents
await broadcast_stats()
# Sends to all agents:
# {
#   type: "stats_update",
#   activeCount: 0,
#   queueCount: 1,
#   queue: [{id: "abc-123-def-456", waiting_time: "2 min"}]
# }
```

**Agent Dashboard Receives:**
```javascript
ws.onmessage = function(event) {
  const data = JSON.parse(event.data);
  
  if (data.type === 'stats_update') {
    // Update UI
    document.getElementById('queueCount').textContent = data.queueCount; // 1
    
    // Show customer in queue
    const queueHTML = data.queue.map(customer => 
      `<div>Customer: ${customer.id.substring(0, 8)}... 
       Waiting: ${customer.waiting_time}</div>`
    ).join('');
    
    document.getElementById('customerQueue').innerHTML = queueHTML;
  }
};
```

---

### Example 3: Voice Input

**Customer Speaks:**
```
"Show me my billing breakdown"
```

**Client Code:**
```javascript
// Speech recognition setup
recognitionRef.current.onresult = (event) => {
  let transcript = "";
  
  for (let i = event.resultIndex; i < event.results.length; i++) {
    transcript += event.results[i][0].transcript;
  }
  
  // transcript = "Show me my billing breakdown"
  setLiveTranscript(transcript);
  
  // Auto-send after 3 seconds of silence
  clearTimeout(silenceTimerRef.current);
  silenceTimerRef.current = setTimeout(() => {
    if (transcript.trim() && ws) {
      // Add to messages
      setMessages(prev => [...prev, { 
        text: transcript, 
        sender: 'user', 
        time: new Date() 
      }]);
      
      // Send to server
      ws.send(JSON.stringify({ 
        message: transcript, 
        sessionId: sessionId 
      }));
      
      setIsWaiting(true);
      setLiveTranscript('');
    }
  }, 3000);
};
```

---

## Session Management Details

### Customer Session Timeout

```javascript
// 5-minute inactivity timeout
const SESSION_TIMEOUT = 300000; // milliseconds

const resetInactivityTimer = () => {
  // Clear existing timer
  if (inactivityTimerRef.current) {
    clearTimeout(inactivityTimerRef.current);
  }
  
  // Set new timer
  if (!isWaiting) {
    inactivityTimerRef.current = setTimeout(() => {
      // Session expired
      setIsSessionExpired(true);
      setShowSessionExpiredModal(true);
      
      // Disconnect
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ 
          type: 'disconnect', 
          sessionId 
        }));
        ws.close();
      }
    }, SESSION_TIMEOUT);
  }
};

// Reset timer on user activity
const sendMessage = () => {
  // ... send message code ...
  resetInactivityTimer(); // Reset timeout
};
```

### Agent Session Limits

```python
# Non-admin agents: Single session only
if user_role != "admin" and user_id in active_sessions:
    await websocket.send(json.dumps({
        "type": "session_limit_error",
        "message": "You can only have one active session."
    }))
    await websocket.close()
    return None

# Admin agents: Multiple sessions allowed
if user_role != "admin":
    agent_id = f"{user_id}-session"  # agent-001-session
    active_sessions[user_id] = agent_id
else:
    agent_id = f"{user_id}-{int(time.time())}"  # admin-001-1772620005
```

---

## Error Handling

### WebSocket Connection Errors

**Client Side:**
```javascript
websocket.onerror = (error) => {
  console.error('WebSocket error:', error);
  setMessages(prev => [...prev, { 
    text: "Connection error. Please refresh the page.", 
    sender: 'bot', 
    time: new Date() 
  }]);
};

websocket.onclose = () => {
  console.log('WebSocket connection closed');
  // Optionally implement reconnection logic
};
```

**Server Side:**
```python
try:
    async for message in websocket:
        # Process message
        data = json.loads(message)
        # ... handle message ...
except websockets.exceptions.ConnectionClosed:
    print(f"Connection closed: session={session_id}, agent={agent_id}")
except json.JSONDecodeError:
    print("Invalid JSON received")
    continue
finally:
    # Cleanup resources
    if agent_id:
        available_agents.pop(agent_id, None)
        all_agents.pop(agent_id, None)
    if session_id:
        cleanup_session(session_id)
```

### AWS Bedrock Errors

```python
def invoke_bedrock_agent(user_message, session_id):
    try:
        response = bedrock_agent.invoke_agent(
            agentId="YQJCBMODNB",
            agentAliasId="E0OUO8GNO5",
            sessionId=session_id,
            inputText=user_message
        )
        
        agent_response = ""
        for event in response['completion']:
            if 'chunk' in event and 'bytes' in event['chunk']:
                agent_response += event['chunk']['bytes'].decode('utf-8')
        
        return agent_response
    except Exception as e:
        print(f"Bedrock error: {e}")
        return "Sorry, I'm having trouble processing your request right now."
```

---

## Performance Optimization

### Message Batching
```python
# Broadcast stats to all agents efficiently
async def broadcast_stats():
    stats = {
        "type": "stats_update",
        "activeCount": get_active_count(),
        "queueCount": len(user_queue),
        "queue": get_queue_data()
    }
    
    # Send to all agents concurrently
    tasks = [aws.send(json.dumps(stats)) for aws in all_agents.values()]
    await asyncio.gather(*tasks, return_exceptions=True)
```

### Connection Pooling
```python
# Reuse WebSocket connections
all_agents = {}  # Keep connections alive
user_sessions = {}  # Maintain session state

# Cleanup only on disconnect
finally:
    if agent_id:
        available_agents.pop(agent_id, None)
        all_agents.pop(agent_id, None)
```

---

## Security Considerations

### Input Validation
```python
# Validate message format
try:
    data = json.loads(message)
except json.JSONDecodeError:
    continue  # Ignore invalid messages

# Sanitize user input
user_message = data.get("message", "").strip()
if not user_message:
    continue  # Ignore empty messages
```

### Session Isolation
```python
# Each customer gets unique session
user_sessions = {
    "session-1": {"ws": ws1, "paired_agent": None, "history": []},
    "session-2": {"ws": ws2, "paired_agent": "agent-001", "history": []}
}

# Messages only sent to correct session
if session_id in user_sessions:
    await user_sessions[session_id]["ws"].send(message)
```

### CORS Protection
```python
# Flask auth server
CORS(app, supports_credentials=True, origins=['http://localhost:3000'])

# Only allow requests from frontend
```

---

## Deployment Checklist

- [ ] Configure AWS credentials for Bedrock
- [ ] Update WebSocket URL for production
- [ ] Replace CSV auth with database
- [ ] Enable HTTPS for WebSocket (wss://)
- [ ] Set up load balancing for multiple servers
- [ ] Implement connection retry logic
- [ ] Add logging and monitoring
- [ ] Configure firewall rules
- [ ] Set up SSL certificates
- [ ] Test with multiple concurrent users

---

**End of Documentation**
