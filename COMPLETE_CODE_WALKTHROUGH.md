# Complete Chatbot Code Walkthrough

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Imports and Setup](#imports-and-setup)
3. [Global Variables](#global-variables)
4. [Intent Configuration](#intent-configuration)
5. [Core Functions](#core-functions)
6. [WebSocket Handler](#websocket-handler)
7. [Server Startup](#server-startup)
8. [Complete Flow Diagram](#complete-flow-diagram)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     CHATBOT ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client (Browser)                                            │
│       ↓ WebSocket Connection                                 │
│  Server (Python)                                             │
│       ↓                                                      │
│  ┌──────────────────────────────────────────────┐           │
│  │  1. Receive Message                          │           │
│  │  2. Parse JSON                               │           │
│  │  3. Check Session State                      │           │
│  │  4. Process Intent/Response                  │           │
│  │  5. Send Response                            │           │
│  └──────────────────────────────────────────────┘           │
│       ↓                                                      │
│  Data Sources:                                               │
│  - employee_leave_balance.csv (Pandas DataFrame)             │
│  - user_sessions (In-memory state)                           │
│  - spaCy NLP Model                                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Imports and Setup

### Line 1-7: Import Libraries

```python
import asyncio
import json
import pandas as pd
import websockets
import spacy
import re
import base64
```

**Purpose of each import:**

| Import | Purpose |
|--------|---------|
| `asyncio` | Asynchronous programming - handle multiple clients |
| `json` | Parse/create JSON messages |
| `pandas` | Data manipulation (employee records) |
| `websockets` | WebSocket server for real-time communication |
| `spacy` | Natural Language Processing |
| `re` | Regular expressions (extract employee IDs) |
| `base64` | Encode CSV files for transmission |

### Line 9-10: Load NLP Model

```python
nlp = spacy.load("en_core_web_sm")
```

**What it does:**
- Loads spaCy's English language model
- Used for tokenization and lemmatization
- Enables understanding of word variations

---

## Global Variables

### Line 12-13: Data and Session Storage

```python
employee_df = pd.read_csv("employee_leave_balance.csv")
user_sessions = {}
```

**employee_df:**
- Pandas DataFrame containing all employee leave data
- Loaded once at startup
- Columns: Enterprise ID, Total Balance, Vacation, etc.

**user_sessions:**
- Dictionary tracking conversation state for each user
- Key: websocket_id (unique per connection)
- Value: state string ("awaiting_confirmation", "awaiting_employee_id")
- Example: `{12345: "awaiting_employee_id", 67890: "awaiting_confirmation"}`

---

## Intent Configuration

### Line 15-20: Intent Definitions

```python
INTENTS = {
    "leave_policy": ["leave", "paid leave", "leave policy"],
    "all_employees_leave": ["all employees", "all employee leave", "everyone leave", "all leave details", "leave details all"],
    "office_timing": ["office timing", "working hours", "office hours"],
    "wfh_policy": ["work from home", "wfh", "remote work"]
}
```

**Structure:**
- Dictionary mapping intent names to keyword lists
- Used for intent detection from user messages

**Intent Types:**

| Intent | Triggers | Action |
|--------|----------|--------|
| `leave_policy` | "leave", "paid leave" | Show policy, ask for balance |
| `all_employees_leave` | "all employees" | Send CSV file |
| `office_timing` | "office timing" | Show office hours |
| `wfh_policy` | "work from home" | Show WFH policy |

---

## Core Functions

### Function 1: detect_intent()

**Lines 22-34**

```python
def detect_intent(message):
    message = message.lower()
    # Check more specific intents first
    if any(keyword in message for keyword in INTENTS["all_employees_leave"]):
        return "all_employees_leave"
    
    for intent, keywords in INTENTS.items():
        if intent == "all_employees_leave":
            continue
        for keyword in keywords:
            if keyword in message:
                return intent
    return "unknown"
```

**Purpose:** Identify what the user wants

**Algorithm:**
1. Convert message to lowercase
2. Check priority intent first (all_employees_leave)
3. Loop through remaining intents
4. Return first match or "unknown"

**Example Flow:**
```
Input: "show me all employees leave"
  ↓
message.lower() = "show me all employees leave"
  ↓
Check: "all employees" in message? YES
  ↓
Return: "all_employees_leave"
```

---

### Function 2: extract_employee_id()

**Lines 36-41**

```python
def extract_employee_id(message):
    """Extract employee ID using regex"""
    match = re.search(r'EMP\s*\d{3}', message.upper())
    if match:
        return match.group(0).replace(' ', '')
    return None
```

**Purpose:** Extract employee ID from any text

**Regex Pattern:** `r'EMP\s*\d{3}'`
- `EMP` - Literal "EMP"
- `\s*` - Zero or more spaces
- `\d{3}` - Exactly 3 digits

**Example Flow:**
```
Input: "My ID is EMP 001"
  ↓
message.upper() = "MY ID IS EMP 001"
  ↓
re.search() finds: "EMP 001"
  ↓
match.group(0) = "EMP 001"
  ↓
.replace(' ', '') = "EMP001"
  ↓
Return: "EMP001"
```

---

### Function 3: is_affirmative()

**Lines 43-51**

```python
def is_affirmative(message):
    """Use NLP to detect affirmative responses"""
    doc = nlp(message.lower())
    affirmative_words = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "please", "definitely", "absolutely"}
    
    for token in doc:
        if token.lemma_ in affirmative_words or token.text in affirmative_words:
            return True
    return False
```

**Purpose:** Detect yes/agreement in user message

**How it works:**
1. Process message with spaCy NLP
2. Loop through each word (token)
3. Check both original text and lemma (base form)
4. Return True if any affirmative word found

**Example Flow:**
```
Input: "Yeah, sure!"
  ↓
nlp() tokenizes: ["Yeah", ",", "sure", "!"]
  ↓
Loop tokens:
  - "Yeah" → lemma: "yeah" → in affirmative_words? YES
  ↓
Return: True
```

---

### Function 4: get_employee_leave_balance()

**Lines 53-71**

```python
def get_employee_leave_balance(employee_id):
    employee = employee_df[employee_df['Enterprise ID'] == employee_id.upper()]
    
    if employee.empty:
        return f"No record found for {employee_id}. Please check the ID."
    
    if len(employee) > 1:
        return f"Warning: Multiple records found for {employee_id}. Please contact HR."
    
    emp = employee.iloc[0]
    return (
        f"Leave Balance for {employee_id}:\n"
        f"• Total Balance: {emp['Total Balance']} hours\n"
        f"• Fiscal Year Balance: {emp['Fiscal Year Balance']} hours\n"
        f"• Vacation: {emp['Vacation']} hours\n"
        f"• Casual Leave Remaining: {emp['Casual Leave Remaining']} days\n"
        f"• Sick Leave Remaining: {emp['Sick and Wellness Leave Remaining']} days\n"
        f"• Casual Leave Taken: {emp['Casual Leave Taken']} days\n"
        f"• Sick Leave Taken: {emp['Sick and Wellness Leave Taken']} days"
    )
```

**Purpose:** Fetch and format employee leave data

**Steps:**
1. Filter DataFrame for matching employee ID
2. Check if empty (no employee found)
3. Check for duplicates (data quality)
4. Extract first row using iloc[0]
5. Format and return response

**Example Flow:**
```
Input: "EMP001"
  ↓
Filter: employee_df[employee_df['Enterprise ID'] == 'EMP001']
  ↓
Result: 1 row found
  ↓
emp = row data
  ↓
Format string with emp['Total Balance'], emp['Vacation'], etc.
  ↓
Return: "Leave Balance for EMP001:\n• Total Balance: 160 hours\n..."
```

---

### Function 5: get_all_employees_leave()

**Lines 73-77**

```python
def get_all_employees_leave():
    """Generate CSV data for all employees"""
    csv_data = employee_df.to_csv(index=False)
    csv_base64 = base64.b64encode(csv_data.encode()).decode()
    return csv_base64
```

**Purpose:** Export all employee data as downloadable CSV

**Steps:**
1. Convert DataFrame to CSV string
2. Encode string to bytes
3. Encode bytes to base64
4. Decode base64 bytes to string
5. Return base64 string

**Why Base64?** WebSocket/JSON only support text, not binary data.

**Example Flow:**
```
employee_df (DataFrame)
  ↓
.to_csv() → "Enterprise ID,Total Balance\nEMP001,160\n..."
  ↓
.encode() → b'Enterprise ID,Total Balance\nEMP001,160\n...'
  ↓
b64encode() → b'RW50ZXJwcmlzZSBJRCxUb3RhbCBCYWxhbmNl...'
  ↓
.decode() → "RW50ZXJwcmlzZSBJRCxUb3RhbCBCYWxhbmNl..."
  ↓
Return base64 string
```

---

### Function 6: handle_intent()

**Lines 79-99**

```python
def handle_intent(intent, websocket_id):
    if intent == "leave_policy":
        user_sessions[websocket_id] = "awaiting_confirmation"
        return {"response": "Employees get 20 paid leaves annually.\n\nWould you like to get details about your leave balance? (Yes/No)"}
    
    elif intent == "all_employees_leave":
        csv_data = get_all_employees_leave()
        return {
            "response": f"Here are the leave details for all employees ({len(employee_df)} employees):",
            "file": {
                "data": csv_data,
                "filename": "employee_leave_balance.csv",
                "type": "text/csv"
            }
        }
    
    elif intent == "office_timing":
        return {"response": "Office timing is 9 AM to 6 PM."}
    
    elif intent == "wfh_policy":
        return {"response": "Hybrid work model is allowed."}
    
    return {"response": "Sorry, I didn't understand your request."}
```

**Purpose:** Generate appropriate response based on detected intent

**Intent Handlers:**

| Intent | Action | State Change |
|--------|--------|--------------|
| `leave_policy` | Show policy, ask for confirmation | Set to "awaiting_confirmation" |
| `all_employees_leave` | Generate CSV file | None |
| `office_timing` | Show office hours | None |
| `wfh_policy` | Show WFH policy | None |
| Unknown | Error message | None |

---

## WebSocket Handler

### Function 7: handler()

**Lines 101-145**

```python
async def handler(websocket):
    print("Client connected")
    websocket_id = id(websocket)
    print(websocket_id)
    
    try:
        async for message in websocket:
            print("Received:", message)
            
            try:
                data = json.loads(message)
                user_message = data.get("message", "") if isinstance(data, dict) else str(data)
            except json.JSONDecodeError:
                user_message = message
            
            session_state = user_sessions.get(websocket_id)
            
            if session_state == "awaiting_confirmation":
                if is_affirmative(user_message):
                    user_sessions[websocket_id] = "awaiting_employee_id"
                    response = {"response": "Please provide your Employee ID (e.g., EMP001):"}
                else:
                    user_sessions.pop(websocket_id, None)
                    response = {"response": "Okay! Let me know if you need anything else."}
            
            elif session_state == "awaiting_employee_id":
                emp_id = extract_employee_id(user_message)
                if emp_id:
                    response = {"response": get_employee_leave_balance(emp_id)}
                    user_sessions.pop(websocket_id, None)
                else:
                    response = {"response": "I couldn't find a valid Employee ID. Please provide it in format EMP001."}
            
            else:
                intent = detect_intent(user_message)
                response = handle_intent(intent, websocket_id) if intent != "unknown" else {"response": "Sorry, I didn't understand your request."}
            
            await websocket.send(json.dumps(response))
    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
        user_sessions.pop(websocket_id, None)
```

**Purpose:** Main connection handler for each client

**Components:**

#### 1. Connection Setup (Lines 102-104)
```python
print("Client connected")
websocket_id = id(websocket)
print(websocket_id)
```
- Creates unique ID for this connection
- Used to track conversation state

#### 2. Message Loop (Line 107)
```python
async for message in websocket:
```
- Continuously listens for messages
- Non-blocking (other clients can be served)

#### 3. Parse Message (Lines 110-114)
```python
try:
    data = json.loads(message)
    user_message = data.get("message", "") if isinstance(data, dict) else str(data)
except json.JSONDecodeError:
    user_message = message
```
- Tries to parse JSON
- Falls back to raw string if parsing fails

#### 4. State Machine (Lines 116-137)

**State: awaiting_confirmation**
```python
if session_state == "awaiting_confirmation":
    if is_affirmative(user_message):
        user_sessions[websocket_id] = "awaiting_employee_id"
        response = {"response": "Please provide your Employee ID (e.g., EMP001):"}
    else:
        user_sessions.pop(websocket_id, None)
        response = {"response": "Okay! Let me know if you need anything else."}
```
- User was asked "Want your leave balance?"
- If yes → ask for employee ID
- If no → clear state

**State: awaiting_employee_id**
```python
elif session_state == "awaiting_employee_id":
    emp_id = extract_employee_id(user_message)
    if emp_id:
        response = {"response": get_employee_leave_balance(emp_id)}
        user_sessions.pop(websocket_id, None)
    else:
        response = {"response": "I couldn't find a valid Employee ID. Please provide it in format EMP001."}
```
- User was asked for employee ID
- Extract ID from message
- If valid → show balance, clear state
- If invalid → ask again

**State: None (default)**
```python
else:
    intent = detect_intent(user_message)
    response = handle_intent(intent, websocket_id) if intent != "unknown" else {"response": "Sorry, I didn't understand your request."}
```
- New conversation or after state cleared
- Detect intent and handle

#### 5. Send Response (Line 139)
```python
await websocket.send(json.dumps(response))
```
- Convert response dict to JSON
- Send to client
- `await` allows other clients to be served

#### 6. Cleanup (Lines 141-143)
```python
except websockets.exceptions.ConnectionClosed:
    print("Client disconnected")
    user_sessions.pop(websocket_id, None)
```
- Handles disconnection
- Removes session data

---

## Server Startup

### Function 8: main()

**Lines 147-150**

```python
async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Intent-Based Chatbot running on ws://localhost:8080")
        await asyncio.Future()
```

**Purpose:** Start and run WebSocket server

**Components:**

1. **Start Server**
   ```python
   async with websockets.serve(handler, "localhost", 8080):
   ```
   - Creates WebSocket server
   - Listens on localhost:8080
   - Calls `handler()` for each new connection

2. **Print Status**
   ```python
   print("Intent-Based Chatbot running on ws://localhost:8080")
   ```

3. **Keep Running**
   ```python
   await asyncio.Future()
   ```
   - Creates a Future that never completes
   - Keeps server alive indefinitely

### Entry Point

**Lines 152-153**

```python
if __name__ == "__main__":
    asyncio.run(main())
```

**Purpose:** Start the application

- Checks if script is run directly
- Starts async event loop
- Runs main() function

---

## Complete Flow Diagram

### Scenario 1: User Asks About Leave Policy

```
User: "What is the leave policy?"
    ↓
WebSocket receives message
    ↓
handler() called
    ↓
Parse JSON: user_message = "What is the leave policy?"
    ↓
Check session_state: None (no active conversation)
    ↓
detect_intent("What is the leave policy?")
    ↓
Returns: "leave_policy"
    ↓
handle_intent("leave_policy", websocket_id)
    ↓
Sets: user_sessions[websocket_id] = "awaiting_confirmation"
    ↓
Returns: {"response": "Employees get 20 paid leaves annually.\n\nWould you like to get details about your leave balance? (Yes/No)"}
    ↓
Send response to user
    ↓
Wait for next message...
```

### Scenario 2: User Confirms and Provides ID

```
User: "Yes"
    ↓
handler() receives message
    ↓
Check session_state: "awaiting_confirmation"
    ↓
is_affirmative("Yes") → True
    ↓
Sets: user_sessions[websocket_id] = "awaiting_employee_id"
    ↓
Response: "Please provide your Employee ID (e.g., EMP001):"
    ↓
Send response
    ↓
Wait for next message...
    ↓
User: "EMP001"
    ↓
handler() receives message
    ↓
Check session_state: "awaiting_employee_id"
    ↓
extract_employee_id("EMP001") → "EMP001"
    ↓
get_employee_leave_balance("EMP001")
    ↓
Query DataFrame → Find employee
    ↓
Format response with leave details
    ↓
Clear state: user_sessions.pop(websocket_id)
    ↓
Send response to user
    ↓
Conversation complete
```

### Scenario 3: Multiple Users Simultaneously

```
Time 0:
  User A connects → handler(websocket_A) starts
  
Time 1:
  User B connects → handler(websocket_B) starts
  User A sends message → handler(websocket_A) processes
  
Time 2:
  User C connects → handler(websocket_C) starts
  User B sends message → handler(websocket_B) processes
  User A waiting for response
  
Time 3:
  User A receives response
  User B receives response
  User C sends message → handler(websocket_C) processes
```

**Key Point:** All handled concurrently thanks to async/await!

---

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    STATE MACHINE                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [No State]                                              │
│      │                                                   │
│      │ User asks about leave policy                      │
│      ↓                                                   │
│  [awaiting_confirmation]                                 │
│      │                                                   │
│      ├─→ User says "Yes"                                 │
│      │   ↓                                               │
│      │   [awaiting_employee_id]                          │
│      │       │                                           │
│      │       ├─→ Valid ID provided                       │
│      │       │   ↓                                       │
│      │       │   Show balance → [No State]               │
│      │       │                                           │
│      │       └─→ Invalid ID                              │
│      │           ↓                                       │
│      │           Stay in [awaiting_employee_id]          │
│      │                                                   │
│      └─→ User says "No"                                  │
│          ↓                                               │
│          [No State]                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Summary

This chatbot demonstrates:

1. **Async Architecture** - Handle multiple users simultaneously
2. **State Management** - Track multi-turn conversations
3. **Intent Detection** - Understand user queries
4. **NLP Integration** - Natural language understanding
5. **Data Handling** - Pandas for employee records
6. **Real-time Communication** - WebSocket protocol
7. **File Transfer** - Base64 encoding for CSV export

The code is structured to be maintainable, scalable, and efficient for handling concurrent users in a production environment.
