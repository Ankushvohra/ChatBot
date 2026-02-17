# ChatBot Backend Flow Explanation

## Overview
The backend is a WebSocket-based chatbot server that handles employee queries about leave policies, office timings, and employee data using NLP for intent detection.

## Entry Point: main.py

```python
import sys
import os

# Set working directory to server folder
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), 'chatbot_backend'))

from chatbot_backend.chatbot_server import main
import asyncio

if __name__ == "__main__":
    asyncio.run(main())
```

**What happens:**
1. Sets working directory to server folder
2. Adds chatbot_backend to Python path
3. Imports and runs the main server function

## Core Server: chatbot_server.py

### Server Initialization
- Creates WebSocket server on `localhost:8080`
- Maintains `user_sessions` dictionary to track conversation states
- Each client gets unique websocket ID for session management

### Message Processing Flow

#### 1. Connection Handling
```python
async def handler(websocket):
    websocket_id = id(websocket)
```
- Each client connection gets unique ID
- Sessions tracked in `user_sessions` dictionary

#### 2. Message Parsing
```python
try:
    data = json.loads(message)
    user_message = data.get("message", "")
except json.JSONDecodeError:
    user_message = message
```
- Attempts JSON parsing first
- Falls back to plain text if JSON parsing fails

#### 3. Session State Management
Three possible states:
- **No state**: Initial message processing
- **awaiting_confirmation**: Waiting for yes/no response
- **awaiting_employee_id**: Waiting for employee ID input

#### 4. State-Based Response Logic

**awaiting_confirmation state:**
- Uses NLP to detect affirmative responses
- If yes → transitions to "awaiting_employee_id"
- If no → clears session and ends conversation

**awaiting_employee_id state:**
- Extracts employee ID using regex pattern
- Fetches leave balance from CSV data
- Clears session after providing response

**No state (initial):**
- Detects intent using NLP
- Routes to appropriate handler function

#### 5. Special Handling: Employee Leave Operation
```python
if response.get("type") == "employee_leave_operation":
    await websocket.send(json.dumps({"type": "status", "message": "Fetching employee records..."}))
    await asyncio.sleep(20)
    # ... more progress updates
    csv_data = get_all_employees_leave()
    await websocket.send(json.dumps({
        "response": "Here are the leave details for all employees (10 employees):",
        "file": {
            "data": csv_data,
            "filename": "employee_leave_balance.csv",
            "type": "text/csv"
        }
    }))
```
- Simulates long-running operation with progress updates
- 60-second total processing time (3 × 20 seconds)
- Returns CSV file as base64 encoded data

## Business Logic: chatbot_logic.py

### NLP Components
- **spaCy**: English language model for text processing
- **Pandas**: CSV data manipulation
- **Regex**: Pattern matching for employee IDs

### Intent Detection System
```python
INTENTS = {
    "leave_policy": ["leave", "paid leave", "leave policy"],
    "all_employees_leave": ["all employees", "employee details", ...],
    "office_timing": ["office timing", "working hours", ...],
    "wfh_policy": ["work from home", "wfh", "remote work"]
}
```

**Detection Process:**
1. **NLP Analysis**: Tokenizes message, removes stop words
2. **Keyword Matching**: Checks for specific word combinations
3. **Entity Recognition**: Identifies employee, data, leave-related terms
4. **Fallback**: Uses simple keyword matching if NLP fails

### Core Functions

#### `detect_intent(message)`
- Processes message through spaCy NLP pipeline
- Uses semantic analysis with keyword sets
- Returns intent string or "unknown"

#### `extract_employee_id(message)`
- Regex pattern: `EMP\s*\d{3}`
- Handles variations like "EMP 001" or "EMP001"
- Returns formatted ID or None

#### `is_affirmative(message)`
- NLP-based affirmative detection
- Recognizes: yes, yeah, sure, ok, definitely, etc.
- Uses lemmatization for better matching

#### `get_employee_leave_balance(employee_id)`
- Queries CSV data using pandas
- Handles multiple/no records scenarios
- Returns formatted leave balance information

#### `get_all_employees_leave()`
- Converts entire CSV to base64 encoded string
- Used for file download functionality

#### `handle_intent(intent, websocket_id, user_sessions)`
- Routes intents to appropriate responses
- Manages session state transitions
- Returns structured response objects

## Data Flow Summary

1. **Client connects** → WebSocket handler created
2. **Message received** → JSON parsing attempted
3. **Session check** → Determines current conversation state
4. **Intent detection** → NLP analysis of user message
5. **Response generation** → Business logic processes intent
6. **Special operations** → Long-running tasks with progress updates
7. **Response sent** → JSON response back to client
8. **Session cleanup** → Remove session on disconnect

## Key Features

- **Stateful Conversations**: Multi-turn dialogues with context
- **NLP-Powered**: Advanced intent detection using spaCy
- **Progress Updates**: Real-time status for long operations
- **File Downloads**: CSV data delivery via WebSocket
- **Error Handling**: Graceful handling of malformed inputs
- **Session Management**: Per-client conversation tracking

## Technology Stack

- **WebSockets**: Real-time bidirectional communication
- **AsyncIO**: Asynchronous programming for concurrent connections
- **spaCy**: Natural language processing
- **Pandas**: Data manipulation and CSV handling
- **Base64**: File encoding for WebSocket transmission