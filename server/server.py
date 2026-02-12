import asyncio
import websockets

async def handler(websocket):
    async for message in websocket:
        print(f"data from client : {message}")
        await websocket.send("Thanks Buddy!")

async def main():
    async with websockets.serve(handler, "localhost", 8080):
        print("server is listening...")
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
