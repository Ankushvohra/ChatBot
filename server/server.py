import asyncio
import json
import websockets

# -------------------------------
# INTENT DEFINITIONS
# -------------------------------

INTENTS = {
    "leave_policy": ["leave", "paid leave", "leave policy"],
    "office_timing": ["office timing", "working hours", "office hours"],
    "wfh_policy": ["work from home", "wfh", "remote work"]
}

# -------------------------------
# INTENT DETECTION
# -------------------------------

def detect_intent(message):
    message = message.lower()

    for intent, keywords in INTENTS.items():
        for keyword in keywords:
            if keyword in message:
                return intent

    return "unknown"

# -------------------------------
# INTENT HANDLER
# -------------------------------

def handle_intent(intent):
    if intent == "leave_policy":
        return "Employees get 20 paid leaves annually."

    elif intent == "office_timing":
        return "Office timing is 9 AM to 6 PM."

    elif intent == "wfh_policy":
        return "Hybrid work model is allowed."

    return "Sorry, I didn't understand your request."

# -------------------------------
# WEBSOCKET HANDLER
# -------------------------------

async def handler(websocket):
    print("Client connected")

    try:
        async for message in websocket:
            print("Received:", message)

            try:
                data = json.loads(message)
                if isinstance(data, dict):
                    user_message = data.get("message", "")
                else:
                    user_message = str(data)
            except json.JSONDecodeError:
                user_message = message

            intent = detect_intent(user_message)

            if intent == "unknown":
                response_text = "Sorry, I didn't understand your request."
            else:
                response_text = handle_intent(intent)

            response = {"response": response_text}

            await websocket.send(json.dumps(response))

    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")

# -------------------------------
# START SERVER
# -------------------------------

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("Intent-Based Chatbot running on ws://localhost:8080")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())



# import asyncio
# import json
# import pandas as pd
# import websockets
# from rapidfuzz import fuzz

# # Load CSV once
# df = pd.read_csv("data.csv")

# # Store active clients
# connected_clients = set()


# def get_best_match(user_message):
#     user_message = user_message.lower()
#     best_score = 0
#     best_answer = "Sorry, I couldn't find a good answer."

#     for _, row in df.iterrows():
#         score = fuzz.partial_ratio(user_message, row["question"].lower())

#         if score > best_score:
#             best_score = score
#             best_answer = row["answer"]

#     # Threshold to avoid wrong answers
#     if best_score < 60:
#         return "Sorry, I didn't understand your question."

#     return best_answer


# async def handler(websocket):
#     print("Client connected")
#     connected_clients.add(websocket)

#     try:
#         async for message in websocket:
#             print("Received:", message)

#             # Expecting JSON from client
#             data = json.loads(message)
#             user_message = data.get("message", "")

#             response_text = get_best_match(user_message)

#             response = {
#                 "response": response_text
#             }

#             await websocket.send(json.dumps(response))

#     except websockets.exceptions.ConnectionClosed:
#         print("Client disconnected")

#     finally:
#         connected_clients.remove(websocket)


# async def main():
#     async with websockets.serve(handler, "localhost", 8080):
#         print("WebSocket CSV Chatbot running on ws://localhost:8080")
#         await asyncio.Future()  # Run forever


# if __name__ == "__main__":
#     asyncio.run(main())
