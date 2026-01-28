import cognee
import asyncio
import os
from dotenv import load_dotenv

async def main():
    load_dotenv(dotenv_path = "../../env.local")
    cognee.prune() # Not async in this version
    print("Cognee pruned successfully")

if __name__ == "__main__":
    asyncio.run(main())
