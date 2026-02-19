import asyncio
import json
import websockets
from chatbot_logic import detect_intent, handle_intent

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
                    break
                
                user_message = data.get("message", "") if isinstance(data, dict) else str(data)
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}")
                user_message = message
            
            # Detect intent and handle
            intent = detect_intent(user_message)
            response = handle_intent(intent, websocket_id, user_message, session_id)
            
            await websocket.send(json.dumps(response))
    
    except websockets.exceptions.ConnectionClosed:
        print(f"Client disconnected - ID: {websocket_id}")

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Simplified Chatbot running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")