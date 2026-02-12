import asyncio
import json
import pandas as pd
import websockets
import spacy
import re

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

employee_df = pd.read_csv("employee_leave_balance.csv")
user_sessions = {}

INTENTS = {
    "leave_policy": ["leave", "paid leave", "leave policy"],
    "office_timing": ["office timing", "working hours", "office hours"],
    "wfh_policy": ["work from home", "wfh", "remote work"]
}

def detect_intent(message):
    message = message.lower()
    for intent, keywords in INTENTS.items():
        for keyword in keywords:
            if keyword in message:
                return intent
    return "unknown"

def extract_employee_id(message):
    """Extract employee ID using regex"""
    match = re.search(r'EMP\s*\d{3}', message.upper())
    if match:
        return match.group(0).replace(' ', '')
    return None

def is_affirmative(message):
    """Use NLP to detect affirmative responses"""
    doc = nlp(message.lower())
    affirmative_words = {"yes", "yeah", "yep", "yup", "sure", "ok", "okay", "please", "definitely", "absolutely"}
    
    for token in doc:
        if token.lemma_ in affirmative_words or token.text in affirmative_words:
            return True
    return False

def get_employee_leave_balance(employee_id):
    employee = employee_df[employee_df['Enterprise ID'] == employee_id.upper()]
    
    if employee.empty:
        return f"No record found for {employee_id}. Please check the ID."
    
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

def handle_intent(intent, websocket_id):
    if intent == "leave_policy":
        user_sessions[websocket_id] = "awaiting_confirmation"
        return "Employees get 20 paid leaves annually.\n\nWould you like to get details about your leave balance? (Yes/No)"
    
    elif intent == "office_timing":
        return "Office timing is 9 AM to 6 PM."
    
    elif intent == "wfh_policy":
        return "Hybrid work model is allowed."
    
    return "Sorry, I didn't understand your request."

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
                    response_text = "Please provide your Employee ID (e.g., EMP001):"
                else:
                    user_sessions.pop(websocket_id, None)
                    response_text = "Okay! Let me know if you need anything else."
            
            elif session_state == "awaiting_employee_id":
                emp_id = extract_employee_id(user_message)
                if emp_id:
                    response_text = get_employee_leave_balance(emp_id)
                    user_sessions.pop(websocket_id, None)
                else:
                    response_text = "I couldn't find a valid Employee ID. Please provide it in format EMP001."
            
            else:
                intent = detect_intent(user_message)
                response_text = handle_intent(intent, websocket_id) if intent != "unknown" else "Sorry, I didn't understand your request."
            
            await websocket.send(json.dumps({"response": response_text}))
    
    except websockets.exceptions.ConnectionClosed:
        print("Client disconnected")
        user_sessions.pop(websocket_id, None)

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

# employee_df = pd.read_csv("employee_leave_balance.csv")
# user_sessions = {}

# INTENTS = {
#     "leave_policy": ["leave", "paid leave", "leave policy"],
#     "office_timing": ["office timing", "working hours", "office hours"],
#     "wfh_policy": ["work from home", "wfh", "remote work"]
# }

# def detect_intent(message):
#     message = message.lower()
#     for intent, keywords in INTENTS.items():
#         for keyword in keywords:
#             if keyword in message:
#                 return intent
#     return "unknown"

# def get_employee_leave_balance(employee_id):
#     employee = employee_df[employee_df['Enterprise ID'] == employee_id.upper()]
    
#     if employee.empty:
#         return f"No record found for {employee_id}. Please check the ID."
    
#     emp = employee.iloc[0]
#     return (
#         f"Leave Balance for {employee_id}:\n"
#         f"• Total Balance: {emp['Total Balance']} hours\n"
#         f"• Fiscal Year Balance: {emp['Fiscal Year Balance']} hours\n"
#         f"• Vacation: {emp['Vacation']} hours\n"
#         f"• Casual Leave Remaining: {emp['Casual Leave Remaining']} days\n"
#         f"• Sick Leave Remaining: {emp['Sick and Wellness Leave Remaining']} days\n"
#         f"• Casual Leave Taken: {emp['Casual Leave Taken']} days\n"
#         f"• Sick Leave Taken: {emp['Sick and Wellness Leave Taken']} days"
#     )

# def handle_intent(intent, websocket_id):
#     if intent == "leave_policy":
#         user_sessions[websocket_id] = "awaiting_confirmation"
#         return "Employees get 20 paid leaves annually.\n\nWould you like to get details about your leave balance? (Yes/No)"
    
#     elif intent == "office_timing":
#         return "Office timing is 9 AM to 6 PM."
    
#     elif intent == "wfh_policy":
#         return "Hybrid work model is allowed."
    
#     return "Sorry, I didn't understand your request."

# async def handler(websocket):
#     print("Client connected")
#     websocket_id = id(websocket)
    
#     try:
#         async for message in websocket:
#             print("Received:", message)
            
#             try:
#                 data = json.loads(message)
#                 user_message = data.get("message", "") if isinstance(data, dict) else str(data)
#             except json.JSONDecodeError:
#                 user_message = message
            
#             session_state = user_sessions.get(websocket_id)
            
#             if session_state == "awaiting_confirmation":
#                 msg_lower = user_message.strip().lower().rstrip('.,!?')
#                 if any(word in msg_lower for word in ["yes", "y", "sure", "ok", "yeah", "yep", "yup", "please"]):
#                     user_sessions[websocket_id] = "awaiting_employee_id"
#                     response_text = "Please provide your Employee ID (e.g., EMP001):"
#                 else:
#                     user_sessions.pop(websocket_id, None)
#                     response_text = "Okay! Let me know if you need anything else."
            
#             elif session_state == "awaiting_employee_id":
#                 response_text = get_employee_leave_balance(user_message.strip())
#                 user_sessions.pop(websocket_id, None)
            
#             else:
#                 intent = detect_intent(user_message)
#                 response_text = handle_intent(intent, websocket_id) if intent != "unknown" else "Sorry, I didn't understand your request."
            
#             await websocket.send(json.dumps({"response": response_text}))
    
#     except websockets.exceptions.ConnectionClosed:
#         print("Client disconnected")
#         user_sessions.pop(websocket_id, None)

# async def main():
#     async with websockets.serve(handler, "localhost", 8080):
#         print("Intent-Based Chatbot running on ws://localhost:8080")
#         await asyncio.Future()

# if __name__ == "__main__":
#     asyncio.run(main())
