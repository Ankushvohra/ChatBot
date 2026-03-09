import boto3
import os
import time


# Initialize Bedrock agent client with profile
session = boto3.Session(profile_name="core-sandbox1", region_name="us-east-1")
# session = boto3.Session(region_name="us-east-1")
bedrock_agent = session.client('bedrock-agent-runtime')


def detect_intent(message):
    """Detect if user wants to connect to human agent"""
    message = message.lower()
    
    # Keywords that indicate user wants human agent
    human_agent_keywords = [
        "human", "agent", "representative", "person", "talk to someone", 
        "speak to someone", "customer service", "support", "help me", 
        "connect me", "transfer", "escalate"
    ]
    
    if any(keyword in message for keyword in human_agent_keywords):
        return "human_agent"
    
    # Default to bedrock for all other queries
    return "bedrock"

def invoke_bedrock_agent(user_message, session_id):
    """Invoke AWS Bedrock agent with user message"""
    start_time = time.time()
    
    try:
        response = bedrock_agent.invoke_agent(
            agentId="YQJCBMODNB",
            agentAliasId="E0OUO8GNO5",
            #agentId="K0FCK2QXIU",
            #agentAliasId="NOIK0DHSAW",
            sessionId=session_id,
            inputText=user_message
        )
        
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
        return "Sorry, I'm having trouble processing your request right now."

def handle_intent(intent, user_message="", session_id=None):
    """Handle the detected intent"""    
    if intent == "bedrock":
        if not session_id:
            session_id = "default-session"
        bedrock_response = invoke_bedrock_agent(user_message, session_id)
        return {"response": bedrock_response}
    
    else:
        return {"response": "I'm here to help! You can ask me questions or request to speak with a human agent."}
