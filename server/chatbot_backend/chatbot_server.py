import asyncio
import json
import websockets
from chatbot_logic import (
    detect_intent, 
    extract_employee_id, 
    is_affirmative, 
    get_employee_leave_balance, 
    handle_intent
)

user_sessions = {}

async def handler(websocket):
    print("Client connected")
    websocket_id = id(websocket)
    
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
                response = handle_intent(intent, websocket_id, user_sessions) if intent != "unknown" else {"response": "Sorry, I didn't understand your request."}
            
            await websocket.send(json.dumps(response))
    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
        user_sessions.pop(websocket_id, None)

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Intent-Based Chatbot running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())