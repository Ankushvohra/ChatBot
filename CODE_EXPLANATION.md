# Chatbot Server Code Explanation

## Table of Contents
1. [Overview](#overview)
2. [Key Concepts](#key-concepts)
3. [Function Explanations](#function-explanations)
4. [Async Programming](#async-programming)

---

## Overview

This is an **intent-based chatbot server** that uses WebSocket for real-time communication. It handles employee leave queries using NLP and maintains conversation state.

**Tech Stack:**
- `websockets` - Real-time communication
- `pandas` - Data handling
- `spacy` - Natural Language Processing
- `asyncio` - Asynchronous programming

---

## Key Concepts

### 1. Pandas iloc

**What:** Integer-location based indexing for DataFrames

```python
emp = employee.iloc[0]  # Gets first row (position 0)
```

**Examples:**
- `iloc[0]` → first row
- `iloc[1]` → second row
- `iloc[-1]` → last row
- `iloc[0:3]` → first three rows

### 2. Boolean Indexing

**What:** Filtering DataFrames based on conditions

```python
employee = employee_df[employee_df['Enterprise ID'] == employee_id.upper()]
```

**Step-by-step:**
1. `employee_df['Enterprise ID'] == 'EMP001'` → Creates boolean Series `[True, False, False]`
2. `employee_df[boolean_series]` → Keeps only True rows

**SQL Equivalent:**
```sql
SELECT * FROM employee_df WHERE "Enterprise ID" = 'EMP001'
```

### 3. Regex match.group()

**What:** Extracts matched text from regex Match object

```python
match = re.search(r'EMP\s*\d{3}', "My ID is EMP 001")
match.group(0)  # Returns: "EMP 001"
```

**Group Numbers:**
- `group(0)` - Entire match
- `group(1)` - First captured group (in parentheses)
- `group(2)` - Second captured group

### 4. Base64 Encoding

**What:** Converts data to text-safe format for transmission

```python
csv_base64 = base64.b64encode(csv_data.encode()).decode()
```

**Flow:**
```
String → Bytes → Base64 Bytes → Base64 String
"ABC"  → b'ABC' → b'QUJD'      → "QUJD"
```

---

## Function Explanations

### detect_intent(message)

**Purpose:** Identifies user's intent from their message

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

**How it works:**
1. Converts message to lowercase
2. Checks priority intent first ("all_employees_leave")
3. Loops through other intents
4. Returns first matching intent or "unknown"

**Example:**
```python
detect_intent("show me all employees leave")  # → "all_employees_leave"
detect_intent("what is the leave policy?")    # → "leave_policy"
detect_intent("hello")                        # → "unknown"
```

**Why priority matters:** Without it, "all employees leave" would match "leave_policy" first.

---

### extract_employee_id(message)

**Purpose:** Extracts employee ID from user message using regex

```python
def extract_employee_id(message):
    match = re.search(r'EMP\s*\d{3}', message.upper())
    if match:
        return match.group(0).replace(' ', '')
    return None
```

**Regex Pattern:** `r'EMP\s*\d{3}'`
- `EMP` - Literal text "EMP"
- `\s*` - Zero or more whitespace (allows "EMP001" or "EMP 001")
- `\d{3}` - Exactly 3 digits

**Examples:**
```python
extract_employee_id("My ID is EMP001")      # → "EMP001"
extract_employee_id("emp 123")              # → "EMP123"
extract_employee_id("EMP  456")             # → "EMP456"
extract_employee_id("hello")                # → None
```

---

### is_affirmative(message)

**Purpose:** Detects if user's message is affirmative (yes/agreement) using NLP

```python
def is_affirmative(message):
    doc = nlp(message.lower())
    affirmative_words = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "please", "definitely", "absolutely"}
    
    for token in doc:
        if token.lemma_ in affirmative_words or token.text in affirmative_words:
            return True
    return False
```

**How it works:**
1. Processes message with spaCy NLP
2. Checks each token (word)
3. Compares both `token.text` (original) and `token.lemma_` (base form)
4. Returns True if any affirmative word found

**Why lemma?** Handles word variations:
- "running" → "run"
- "better" → "good"

**Examples:**
```python
is_affirmative("Yes!")           # → True
is_affirmative("Okay sure")      # → True
is_affirmative("no")             # → False
```

---

### get_employee_leave_balance(employee_id)

**Purpose:** Retrieves and formats employee leave balance

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
        # ... more fields
    )
```

**Flow:**
1. **Filter DataFrame** - Find matching employee ID
2. **Check if empty** - No employee found
3. **Check for duplicates** - Data quality issue
4. **Extract first row** - Using `iloc[0]`
5. **Format response** - Return formatted string

**Example:**
```python
# Input: "EMP001"
# Output:
# Leave Balance for EMP001:
# • Total Balance: 160 hours
# • Fiscal Year Balance: 160 hours
# ...
```

---

### get_all_employees_leave()

**Purpose:** Converts entire employee DataFrame to base64-encoded CSV

```python
def get_all_employees_leave():
    csv_data = employee_df.to_csv(index=False)
    csv_base64 = base64.b64encode(csv_data.encode()).decode()
    return csv_base64
```

**Steps:**
1. `to_csv(index=False)` - Convert DataFrame to CSV string (no row numbers)
2. `.encode()` - Convert string to bytes
3. `b64encode()` - Encode bytes to base64
4. `.decode()` - Convert base64 bytes to string

**Why Base64?** Safely transmit data over WebSocket/JSON which only support text.

---

### async handler(websocket)

**Purpose:** Manages each client's WebSocket connection and messages

```python
async def handler(websocket):
    print("Client connected")
    websocket_id = id(websocket)
    
    try:
        async for message in websocket:
            # Parse message
            # Check session state
            # Process based on state
            # Send response
    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
        user_sessions.pop(websocket_id, None)
```

**Components:**

1. **Connection Setup**
   - Creates unique session ID
   - Prints connection message

2. **Message Loop**
   - `async for message in websocket` - Continuously listens
   - Runs until connection closes

3. **State Machine**
   ```python
   if session_state == "awaiting_confirmation":
       # Handle yes/no response
   elif session_state == "awaiting_employee_id":
       # Handle employee ID input
   else:
       # Handle new intent detection
   ```

4. **Cleanup**
   - Removes session data on disconnect

**Flow:**
```
Client connects
    ↓
Create session ID
    ↓
Loop: Wait for message
    ↓
Parse message
    ↓
Check session state
    ↓
Process based on state
    ↓
Send response
    ↓
Repeat loop
```

---

### async main()

**Purpose:** Starts WebSocket server and keeps it running

```python
async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Intent-Based Chatbot running on ws://localhost:8080")
        await asyncio.Future()
```

**Components:**

1. **Start Server**
   - `websockets.serve(handler, "localhost", 8080)`
   - Calls `handler()` for each new connection

2. **Print Confirmation**
   - Shows server is ready

3. **Keep Running Forever**
   - `await asyncio.Future()` - Never completes
   - Prevents server from stopping

**What happens:**
```
Start Program
    ↓
main() called
    ↓
Server starts on localhost:8080
    ↓
Print "running..."
    ↓
await asyncio.Future() ← Stuck here forever (intentionally)
    ↓
[Server keeps running, accepting connections]
```

---

## Async Programming

### What is Async?

**Async** enables running multiple tasks concurrently without blocking.

### Restaurant Waiter Analogy

**Synchronous (Bad Waiter):**
```python
def serve_customers():
    take_order()           # Customer 1
    wait_for_food()        # Stands in kitchen (BLOCKED!)
    deliver_food()
    
    take_order()           # Customer 2 (had to wait!)
    wait_for_food()        # Stands in kitchen (BLOCKED!)
    deliver_food()
```
**Problem:** Waiter waits in kitchen. Customer 2 waits forever!

**Asynchronous (Smart Waiter):**
```python
async def serve_customers():
    take_order()           # Customer 1
    await wait_for_food()  # "I'll come back" → Serves others
    deliver_food()
    
    take_order()           # Customer 2 (while C1's food cooks)
    await wait_for_food()  # "I'll come back" → Serves others
    deliver_food()
```
**Smart:** Takes multiple orders, checks back when ready!

### Chatbot Example

**Without Async (Synchronous):**
```python
# User A connects
receive_message()  # Waiting... (EVERYONE ELSE BLOCKED)
process_message()
send_response()

# User B connects (had to wait for User A)
receive_message()
process_message()
send_response()
```
**Result:** Only 1 user at a time. Slow!

**With Async (Your Code):**
```python
async def handler(websocket):
    async for message in websocket:
        # Process
        await websocket.send(response)  # Send, then handle others
```

**Timeline:**
```
Time 0: User A connects → waiting for message
Time 1: User B connects → waiting for message (A still waiting)
Time 2: User C connects → waiting for message (A, B still waiting)
Time 3: User A sends message → process → send response
Time 4: User B sends message → process → send response
```
**All 3 users handled simultaneously!**

### Key Keywords

**`async def`** - Declares an async function
```python
async def handler(websocket):  # This is an async function
```

**`await`** - Pauses execution, lets other tasks run
```python
await websocket.send(data)  # Pause here, handle other clients
```

**`async for`** - Async loop
```python
async for message in websocket:  # Non-blocking iteration
```

**`async with`** - Async context manager
```python
async with websockets.serve(handler, "localhost", 8080):
```

### When to Use Async?

Use async when **waiting** for something:
- ✅ Network requests (websocket.send)
- ✅ File operations
- ✅ Database queries
- ❌ Math calculations (no waiting, just computing)

### Simple Rule

1. **`async def`** = "This function can pause and let others run"
2. **`await`** = "Pause here, do other work, come back later"
3. **`async for`** = "Loop but let others run between iterations"

---

## Complete Flow

### User Journey Example

1. **User connects**
   ```
   Client → WebSocket → handler() called
   ```

2. **User asks: "What is the leave policy?"**
   ```
   detect_intent() → "leave_policy"
   handle_intent() → Sets state to "awaiting_confirmation"
   Response: "Employees get 20 paid leaves. Want your balance? (Yes/No)"
   ```

3. **User replies: "Yes"**
   ```
   is_affirmative() → True
   State changes to "awaiting_employee_id"
   Response: "Please provide your Employee ID (e.g., EMP001):"
   ```

4. **User replies: "EMP001"**
   ```
   extract_employee_id() → "EMP001"
   get_employee_leave_balance() → Fetches data
   Response: "Leave Balance for EMP001: ..."
   State cleared
   ```

5. **User disconnects**
   ```
   ConnectionClosed exception → Cleanup session
   ```

---

## Summary

This chatbot demonstrates:
- **Intent detection** - Understanding user queries
- **State management** - Multi-turn conversations
- **NLP** - Natural language understanding with spaCy
- **Async programming** - Handling multiple users simultaneously
- **Data handling** - Pandas for employee data
- **Real-time communication** - WebSocket protocol

The async architecture allows the server to handle hundreds of concurrent users efficiently without blocking.
