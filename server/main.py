import sys
import os

# Set working directory to server folder
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(__file__), 'chatbot_backend'))

from chatbot_backend.chatbot_server import main
import asyncio

if __name__ == "__main__":
    asyncio.run(main())