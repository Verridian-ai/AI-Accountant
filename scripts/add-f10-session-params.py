#!/usr/bin/env python3
"""
Add sessionId and userId parameters to 6 agent input types for F10 Phase 1.
"""

def add_f10_params(file_path: str):
    with open(file_path, 'r') as f:
        lines = f.readlines()

    # Target interfaces to modify
    interfaces_to_modify = [
        'CategorizerInput',
        'GSTCalculatorInput',
        'BudgetAnalyzerInput',
        'MerchantIntelligenceInput',
        'TaxStrategyInput',
        'FinancialPlannerInput',
    ]

    # F10 fields to add
    f10_fields = [
        '  // F10: Session context for conversational memory and feedback\n',
        '  sessionId?: string;\n',
        '  userId?: string;\n',
    ]

    i = 0
    while i < len(lines):
        line = lines[i]
        # Check if this line starts an interface we want to modify
        for interface_name in interfaces_to_modify:
            if f'export interface {interface_name}' in line and '{' in line:
                # Find the closing brace
                brace_count = line.count('{') - line.count('}')
                j = i + 1
                while j < len(lines) and brace_count > 0:
                    brace_count += lines[j].count('{') - lines[j].count('}')
                    if brace_count == 0:
                        # Found closing brace at line j
                        # Check if already has sessionId
                        interface_block = ''.join(lines[i:j+1])
                        if 'sessionId?' not in interface_block:
                            # Insert F10 fields before closing brace
                            lines[j:j] = f10_fields
                            print(f'✅ Added F10 params to {interface_name} at line {j}')
                            j += len(f10_fields)  # Adjust index for inserted lines
                        else:
                            print(f'⏭️  {interface_name} already has F10 params')
                        break
                    j += 1
                break
        i += 1

    with open(file_path, 'w') as f:
        f.writelines(lines)

    print('\n✅ F10 session params added successfully!')

if __name__ == '__main__':
    add_f10_params('server/src/services/claude/types.ts')
