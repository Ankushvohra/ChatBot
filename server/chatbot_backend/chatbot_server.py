import asyncio
import json
import time
import websockets
from chatbot_logic import (
    detect_intent, 
    extract_employee_id, 
    is_affirmative, 
    get_employee_leave_balance, 
    get_all_employees_leave,
    handle_intent
)

user_sessions = {}
session_timestamps = {}
SESSION_TIMEOUT = 300  # 5 minutes

async def check_session_timeout(websocket, websocket_id):
    """Check if session has expired and notify client"""
    while websocket_id in session_timestamps:
        await asyncio.sleep(10)  # Check every 10 seconds
        
        if websocket_id in session_timestamps:
            last_activity = session_timestamps[websocket_id]
            elapsed = time.time() - last_activity
            
            if elapsed > SESSION_TIMEOUT:
                try:
                    await websocket.send(json.dumps({
                        "type": "session_expired",
                        "response": "Session expired due to inactivity. Please refresh to continue."
                    }))
                    await asyncio.sleep(0.5)
                    await websocket.close(1000, "Session timeout")
                except Exception as e:
                    print(f"Error closing session {websocket_id}: {e}")
                
                user_sessions.pop(websocket_id, None)
                session_timestamps.pop(websocket_id, None)
                break

async def process_with_timeout_pause(websocket_id, operation):
    """Handle long-running operations"""
    await operation

async def handler(websocket):
    websocket_id = id(websocket)
    session_id = None
    
    try:
        async for message in websocket:
            print("Received:", message)
            
            try:
                data = json.loads(message)
                
                # Capture session ID from first message
                if not session_id and data.get("sessionId"):
                    session_id = data.get("sessionId")
                    print(f"Session started - Session ID: {session_id}")
                
                # Handle disconnect message
                if data.get("type") == "disconnect":
                    print(f"Session ended - Session ID: {session_id}")
                    user_sessions.pop(websocket_id, None)
                    break  # Exit the loop to close connection
                
                user_message = data.get("message", "") if isinstance(data, dict) else str(data)
            except json.JSONDecodeError as e:
                print(f"Client disconnected - ID: {websocket_id}, Reason: {e}")
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
                response = handle_intent(intent, websocket_id, user_sessions, user_message)
            
            # Handle employee leave operation with progress updates
            if response.get("type") == "employee_leave_operation":
                async def process_employee_data():
                    await asyncio.sleep(60)
                    csv_data = get_all_employees_leave()
                    await websocket.send(json.dumps({
                        "response": "Here are the leave details for all employees :",
                        "file": {
                            "data": csv_data,
                            "filename": "employee_leave_balance.csv",
                            "type": "text/csv"
                        }
                    }))
                
                await process_with_timeout_pause(websocket_id, process_employee_data())
            else:
                await websocket.send(json.dumps(response))
    
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected - ID: {websocket_id}")
        user_sessions.pop(websocket_id, None)

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Intent-Based Chatbot running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")