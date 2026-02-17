#!/usr/bin/env python3
"""
F10 Phase 1 Step 2: Wire sessionId through Vercel agents to Cognee tools.

For each of the 6 Vercel agents:
1. Extract sessionId from input in execute/executeWithMemory methods
2. Pass sessionId to all cogneeTools.search() calls
3. Pass sessionId to submitSearchFeedback() calls
"""

import re
from pathlib import Path

AGENT_FILES = [
    'server/src/services/claude/agents/vercel/transaction-categorizer.ts',
    'server/src/services/claude/agents/vercel/budget-analyzer.ts',
    'server/src/services/claude/agents/vercel/financial-planner.ts',
    'server/src/services/claude/agents/vercel/tax-strategy.ts',
    'server/src/services/claude/agents/vercel/merchant-intelligence.ts',
]

def add_session_wiring(file_path: str):
    """Add sessionId extraction and passthrough to a Vercel agent file."""

    with open(file_path, 'r') as f:
        content = f.read()

    original_content = content
    agent_name = Path(file_path).stem

    # Step 1: Extract sessionId from input at start of execute/executeWithMemory
    # Pattern: async execute(WithMemory)?(input: ...) { ... }
    # Insert: const { sessionId, userId } = input;

    # Find execute method
    execute_pattern = r'(async (?:execute|executeWithMemory)\s*\([^)]*input:[^)]+\)\s*[^{]*\{)'

    def add_extraction(match):
        method_sig = match.group(1)
        # Check if sessionId extraction already exists
        next_50_chars = content[match.end():match.end()+200]
        if 'sessionId' in next_50_chars and 'input' in next_50_chars:
            return method_sig  # Already has extraction
        return method_sig + '\n    const { sessionId, userId } = input;'

    content = re.sub(execute_pattern, add_extraction, content, count=2)  # Max 2 methods

    # Step 2: Add sessionId to cogneeTools.search() calls
    # Pattern: cogneeTools.search(query, dataset, searchType) or cogneeTools.search(query, dataset)
    # Replace with: cogneeTools.search(query, dataset, searchType, sessionId)

    search_patterns = [
        # 3-arg: search(query, dataset, searchType)
        (r'cogneeTools\.search\(([^,]+),\s*([^,]+),\s*([^)]+)\)',
         r'cogneeTools.search(\1, \2, \3, sessionId)'),
        # 2-arg: search(query, dataset)
        (r'cogneeTools\.search\(([^,]+),\s*([^)]+)\)',
         r'cogneeTools.search(\1, \2, "GRAPH_COMPLETION", sessionId)'),
    ]

    for pattern, replacement in search_patterns:
        # Only replace if sessionId not already in the call
        matches = list(re.finditer(pattern, content))
        for match in reversed(matches):  # Reverse to preserve indices
            if 'sessionId' not in match.group(0):
                content = content[:match.start()] + re.sub(pattern, replacement, match.group(0)) + content[match.end():]

    # Step 3: Add sessionId to searchWithDataPoint, searchWithOntology, temporalSearch calls
    datapoint_patterns = [
        (r'cogneeTools\.searchWithDataPoint\(([^,]+),\s*([^)]+)\)',
         r'cogneeTools.searchWithDataPoint(\1, \2, sessionId)'),
        (r'cogneeTools\.searchWithOntology\(([^,]+),\s*([^)]+)\)',
         r'cogneeTools.searchWithOntology(\1, \2, sessionId)'),
        (r'cogneeTools\.temporalSearch\(([^,]+),\s*([^,]+),\s*([^)]+)\)',
         r'cogneeTools.temporalSearch(\1, \2, \3, sessionId)'),
    ]

    for pattern, replacement in datapoint_patterns:
        matches = list(re.finditer(pattern, content))
        for match in reversed(matches):
            if 'sessionId' not in match.group(0):
                content = content[:match.start()] + re.sub(pattern, replacement, match.group(0)) + content[match.end():]

    # Step 4: Update CogneeTools.search() method signature calls
    # Some agents might create CogneeTools instances - update those too
    # Pattern: await cogneeTools.search(...)
    # This is already handled above

    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f'✅ Updated {agent_name}')
        return True
    else:
        print(f'⏭️  {agent_name} - no changes needed (already wired or no Cognee calls)')
        return False

def update_cognee_tools_signatures():
    """
    Update method signatures in cognee-tools.ts to accept optional sessionId.
    These might already be done from F7, but check helper methods.
    """
    file_path = 'server/src/services/claude/cognee-tools.ts'

    with open(file_path, 'r') as f:
        content = f.read()

    original = content

    # searchWithDataPoint should accept sessionId
    pattern = r'(async searchWithDataPoint\([^)]+dataPointType: string)\)'
    if 'sessionId?' not in re.search(pattern, content, re.DOTALL).group(0) if re.search(pattern, content, re.DOTALL) else '':
        content = re.sub(pattern, r'\1, sessionId?: string)', content)

    # searchWithOntology should accept sessionId
    pattern = r'(async searchWithOntology\([^)]+ontologyType: string)\)'
    if 'sessionId?' not in re.search(pattern, content, re.DOTALL).group(0) if re.search(pattern, content, re.DOTALL) else '':
        content = re.sub(pattern, r'\1, sessionId?: string)', content)

    # temporalSearch should accept sessionId
    pattern = r'(async temporalSearch\([^)]+modules: string\[\])\)'
    if 'sessionId?' not in re.search(pattern, content, re.DOTALL).group(0) if re.search(pattern, content, re.DOTALL) else '':
        content = re.sub(pattern, r'\1, sessionId?: string)', content)

    if content != original:
        with open(file_path, 'w') as f:
            f.write(content)
        print('✅ Updated cognee-tools.ts helper method signatures')
        return True
    else:
        print('⏭️  cognee-tools.ts already has sessionId in helper methods')
        return False

if __name__ == '__main__':
    print('F10 Phase 1 Step 2: Wiring Vercel agents with sessionId\n')

    updated = []
    for agent_file in AGENT_FILES:
        if add_session_wiring(agent_file):
            updated.append(agent_file)

    # Update helper methods
    if update_cognee_tools_signatures():
        updated.append('server/src/services/claude/cognee-tools.ts')

    print(f'\n✅ F10 Step 2 complete! Updated {len(updated)} files')
    if updated:
        print('\nModified files:')
        for f in updated:
            print(f'  - {f}')
