#!/usr/bin/env python3
"""
F10 Phase 1 Step 3: Wire sessionId through Claude SDK agents to Cognee tools.

For gst-calculator (the only non-Vercel agent in Phase 1 that needs wiring):
1. Extract sessionId from input in execute method
2. Pass sessionId to all cogneeTools.search() calls
"""

import re

def add_session_wiring_claude_sdk(file_path: str):
    """Add sessionId extraction and passthrough to a Claude SDK agent file."""

    with open(file_path, 'r') as f:
        content = f.read()

    original_content = content

    # Step 1: Extract sessionId from input at start of execute
    # Pattern: async execute(input: GSTCalculatorInput): Promise<...> {
    # Insert after opening brace: const { sessionId, userId } = input;

    execute_pattern = r'(async execute\s*\(\s*input:\s*[^)]+\)\s*:\s*Promise[^{]*\{)'

    def add_extraction(match):
        method_sig = match.group(1)
        # Check if already has extraction
        next_200 = content[match.end():match.end()+200]
        if 'sessionId' in next_200 and '= input' in next_200:
            return method_sig
        return method_sig + '\n    const { sessionId, userId } = input;'

    content = re.sub(execute_pattern, add_extraction, content, count=1)

    # Step 2: Add sessionId to cogneeTools.search() calls
    # Pattern: cogneeTools.search(query, dataset, searchType) or cogneeTools.search(query, dataset)

    search_patterns = [
        # 3-arg with searchType
        (r'cogneeTools\.search\(([^,]+),\s*([^,]+),\s*([^)]+)\)',
         r'cogneeTools.search(\1, \2, \3, sessionId)'),
        # 2-arg without searchType
        (r'cogneeTools\.search\(([^,]+),\s*([^)]+)\)',
         r'cogneeTools.search(\1, \2, "GRAPH_COMPLETION", sessionId)'),
    ]

    for pattern, replacement in search_patterns:
        matches = list(re.finditer(pattern, content))
        for match in reversed(matches):
            if 'sessionId' not in match.group(0):
                content = content[:match.start()] + re.sub(pattern, replacement, match.group(0)) + content[match.end():]

    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f'✅ Updated gst-calculator.ts')
        return True
    else:
        print(f'⏭️  gst-calculator.ts - no changes needed')
        return False

if __name__ == '__main__':
    print('F10 Phase 1 Step 3: Wiring gst-calculator (Claude SDK agent) with sessionId\n')

    updated = add_session_wiring_claude_sdk('server/src/services/claude/agents/gst-calculator.ts')

    if updated:
        print('\n✅ F10 Step 3 complete!')
    else:
        print('\n⏭️  No changes needed')
