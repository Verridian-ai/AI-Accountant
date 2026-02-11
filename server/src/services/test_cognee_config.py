import cognee
import os
import asyncio

async def test():
    from cognee.shared.data_models import Node
    print("Cognee version:", cognee.__version__)
    # print("Cognee config:", cognee.config)

asyncio.run(test())
