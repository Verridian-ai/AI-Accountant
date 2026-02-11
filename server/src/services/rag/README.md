# Local RAG Pipeline — UNUSED PROTOTYPE

This directory contains ~3,500 lines of a local RAG pipeline (dense/sparse search,
cross-encoder reranking, chunking, citations, namespace management).

## Status: NOT CONNECTED

- **Not imported** by any route, service, or agent in the application.
- Uses **SQLite FTS5** which is incompatible with the current PostgreSQL setup.
- The application uses the **Cognee REST API** for all RAG operations
  (via `server/src/services/cognee_client.ts`).

## Do not wire in

This code was a prototype before Cognee integration. If RAG functionality
is needed, use the Cognee client at `../cognee_client.ts` instead.
