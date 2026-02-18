import pandas as pd
import spacy
import re
import base64
import boto3

# Load spaCy model
nlp = spacy.load("en_core_web_sm")

# Initialize Bedrock agent client
session = boto3.Session(profile_name='core-sandbox1')
bedrock_agent = session.client('bedrock-agent-runtime', region_name='us-east-1')

# Load employee data
employee_df = pd.read_csv("employee_leave_balance.csv")

INTENTS = {
    "leave_policy": ["leave", "paid leave", "leave policy"],
    "all_employees_leave": ["all employees", "all employee", "employee details", "all employee details", "everyone leave", "all leave details", "leave details all", "employee data", "all data", "data of employees", "employees data", "give me", "wanna know about all", "want to know about all"],
    "office_timing": ["office timing", "working hours", "office hours"],
    "wfh_policy": ["work from home", "wfh", "remote work"]
}

def detect_intent(message):
    message = message.lower()
    doc = nlp(message)
    
    # Extract key entities and tokens
    tokens = [token.lemma_ for token in doc if not token.is_stop and not token.is_punct]
    
    # NLP-based intent detection
    employee_keywords = {"employee", "staff", "worker", "people"}
    all_keywords = {"all", "every", "entire", "complete", "total"}
    data_keywords = {"data", "detail", "information", "record", "file", "list"}
    leave_keywords = {"leave", "vacation", "holiday", "time", "balance"}
    
    # Check for all employees data request
    if (any(word in tokens for word in employee_keywords) and 
        (any(word in tokens for word in all_keywords) or any(word in tokens for word in data_keywords))):
        return "all_employees_leave"
    
    # Check for leave policy
    if any(word in tokens for word in leave_keywords) and "policy" in tokens:
        return "leave_policy"
    
    # Check for office timing
    if any(word in tokens for word in ["office", "work", "timing", "hour", "schedule"]):
        return "office_timing"
    
    # Check for WFH policy
    if any(word in tokens for word in ["wfh", "remote", "home"]):
        return "wfh_policy"
    
    # Fallback to keyword matching
    if any(keyword in message for keyword in INTENTS["all_employees_leave"]):
        return "all_employees_leave"
    
    for intent, keywords in INTENTS.items():
        if intent == "all_employees_leave":
            continue
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

def get_all_employees_leave():
    """Generate CSV data for all employees"""
    csv_data = employee_df.to_csv(index=False)
    csv_base64 = base64.b64encode(csv_data.encode()).decode()
    return csv_base64

def format_cost_data(response_text):
    """Format cost breakdown data into a readable table"""
    # Check if response contains cost data pattern
    cost_pattern = r'(\d{4}\.\d{2}):\s*\$([\d,]+)'
    matches = re.findall(cost_pattern, response_text)
    
    if len(matches) >= 2:  # If multiple cost entries found
        # Extract the intro text before the cost data
        intro_match = re.search(r'^(.*?)(?=\d{4}\.\d{2})', response_text)
        intro_text = intro_match.group(1).strip() if intro_match else ""
        
        # Create formatted table
        table_html = f"""
{intro_text}

@@htmlstart@@
<table border="1" cellpadding="8" cellspacing="0">
<tr>
<th style="color: white; background-color: #9333ea;">Month</th>
<th style="color: white; background-color: #9333ea;">Cost</th>
</tr>"""
        
        for month, cost in matches:
            table_html += f"""
<tr>
<td>{month}</td>
<td>${cost}</td>
</tr>"""
        
        table_html += """
</table>
@@htmlend@@"""
        
        return table_html
    
    return response_text

def invoke_bedrock_agent(user_message, session_id):
    """Invoke AWS Bedrock agent with user message"""
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
        return None

def handle_intent(intent, websocket_id, user_sessions, user_message=""):
    if intent == "leave_policy":
        user_sessions[websocket_id] = "awaiting_confirmation"
        return {"response": "Employees get 20 paid leaves annually.\n\nWould you like to get details about your leave balance? (Yes/No)"}
    
    elif intent == "all_employees_leave":
        return {"type": "employee_leave_operation"}
    
    elif intent == "office_timing":
        return {"response": "Office timing is 9 AM to 6 PM."}
    
    elif intent == "wfh_policy":
        return {"response": "Hybrid work model is allowed."}
    
    else:
        bedrock_response = invoke_bedrock_agent(user_message, str(websocket_id))
        if bedrock_response:
            formatted_response = format_cost_data(bedrock_response)
            return {"response": formatted_response}
        else:
            return {"response": "Sorry, I didn't understand your request."}