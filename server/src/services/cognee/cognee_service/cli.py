"""Cognee integration service — CLI interface."""

import asyncio
import json
import sys

from .service import CogneeService


async def main():
    """CLI interface for running CogneeService operations."""
    from uuid import UUID

    class UUIDEncoder(json.JSONEncoder):
        def default(self, obj):
            if isinstance(obj, UUID):
                return str(obj)
            return json.JSONEncoder.default(self, obj)

    service = CogneeService()

    if len(sys.argv) < 2:
        print(json.dumps({"status": "error", "message": "No command provided"}))
        return

    command = sys.argv[1]

    try:
        if command == "add_statement":
            data = json.loads(sys.argv[2])
            result = await service.add_statement_data(**data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "add_transaction":
            tx = json.loads(sys.argv[2])
            result = await service.add_transaction(tx)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "search":
            query = sys.argv[2]
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            results = await service.search_similar_transactions(query, limit)
            print(json.dumps({"status": "success", "results": results}, cls=UUIDEncoder))

        elif command == "suggest_category":
            description = sys.argv[2]
            result = await service.suggest_category(description)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "gst_ruling":
            tx_type = sys.argv[2]
            result = await service.get_gst_ruling(tx_type)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "seed_gst":
            result = await service.seed_gst_rules()
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "add_correction":
            data = json.loads(sys.argv[2])
            result = await service.add_correction(**data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "store_bas":
            data = json.loads(sys.argv[2])
            result = await service.store_bas_period(data)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "trace_flows":
            account_id = sys.argv[2]
            result = await service.trace_account_flows(account_id)
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "prune":
            result = await service.prune_all()
            print(json.dumps(result, cls=UUIDEncoder))

        elif command == "prune_dataset":
            dataset = sys.argv[2]
            result = await service.prune_dataset(dataset)
            print(json.dumps(result, cls=UUIDEncoder))

        else:
            print(json.dumps({"status": "error", "message": f"Unknown command: {command}"}))

    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}, cls=UUIDEncoder))


if __name__ == "__main__":
    asyncio.run(main())
