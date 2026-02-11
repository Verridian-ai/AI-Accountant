# Python Agent System (Prototype — Not Connected)

These Python agents are a prototype implementation that is NOT connected to any API routes.
The production system uses TypeScript Claude agents in `../claude/agents/`.

This code is retained for reference but should not be used in production.
To enable: would need to fix pydantic-ai dependency, stdin/env communication protocol,
and response format (expects 'content' field, Python returns 'message').
