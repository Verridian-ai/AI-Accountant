---
description: Query or write to the GoldLedger Hive Memory knowledge graph
argument-hint: search "query" | store "content" dataset_name | codify path | rules
allowed-tools: ["mcp__cognee-hive-local__search", "mcp__cognee-hive-local__cognify", "mcp__cognee-hive-local__codify", "mcp__cognee-hive-local__get_developer_rules", "mcp__cognee-hive-local__list_data", "mcp__cognee-hive-local__save_interaction"]
---

# GoldLedger Hive Memory

Interact with the shared agent team knowledge graph.

## Usage
- `/gl-hive search "what caused the ledger to not show transactions"` — query hive memory
- `/gl-hive store "Fixed X by doing Y" hive_agent_fixes` — write a finding to hive memory
- `/gl-hive codify server/src/routes/` — index code into hive memory
- `/gl-hive rules` — get all stored developer rules

## Arguments: $ARGUMENTS

Parse the command from $ARGUMENTS:

### If starts with "search":
Extract the query text and run:
```python
search(query_text=QUERY, query_type="GRAPH_COMPLETION")
```
Also run a CHUNKS search for concrete code references:
```python
search(query_text=QUERY, query_type="CHUNKS")
```
Present both results clearly.

### If starts with "store":
Extract content and dataset_name, then:
```python
cognify(data=CONTENT, dataset_name=DATASET_NAME)
```
Confirm storage and dataset used.

### If starts with "codify":
Extract the path and run:
```python
codify(source_code_path=PATH)
```
This indexes the code into the CODE search type for future queries.

### If "rules":
```python
get_developer_rules()
```
Display all stored developer rules and patterns.

### If no arguments or "status":
```python
list_data()
```
Show all datasets and their content counts.

## Available Datasets
- hive_agent_decisions — architectural decisions and rationale
- hive_agent_patterns — successful workflows and strategies
- hive_agent_errors — bugs, root causes, anti-patterns
- hive_agent_commits — commit history and change rationale
- hive_codebase_architecture — system design
- hive_codebase_routes — API endpoints
- hive_codebase_schema — DB schema
- hive_codebase_services — service implementations
- hive_codebase_types — TypeScript types
- hive_audit_findings — audit issues found
- hive_audit_fixes — fixes applied
- hive_quality_rules — code quality rules
- hive_gst_rules — ATO GST rules
- hive_tax_knowledge — tax brackets and deductions
- hive_financial_patterns — transaction patterns
