import boto3
import os
import time

aws_profile = os.getenv('AWS_PROFILE', 'core-sandbox1')
aws_region = os.getenv('AWS_DEFAULT_REGION', 'us-east-1')

# Initialize Bedrock agent client with profile
session = boto3.Session(profile_name=aws_profile)
bedrock_agent = session.client('bedrock-agent-runtime', region_name=aws_region)

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
            # agentId="YQJCBMODNB",
            # agentAliasId="E0OUO8GNO5",
            agentId="K0FCK2QXIU",
            agentAliasId="NOIK0DHSAW",
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

def handle_intent(intent, websocket_id, user_message="", session_id=None):
    """Handle the detected intent"""
    if intent == "human_agent":
        return {
            "response": "I understand you'd like to speak with a human agent. This feature will be available soon. For now, I can help you with your questions using AI assistance."
        }
    
    elif intent == "bedrock":
        bedrock_response = invoke_bedrock_agent(user_message, session_id or str(websocket_id))
        return {"response": bedrock_response}
    
    else:
        return {"response": "I'm here to help! You can ask me questions or request to speak with a human agent."}
