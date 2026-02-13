# Agent 7: Cognee Payroll Datasets

## Role
Configure Cognee datasets for employee and payroll data, and add indexing/search methods for payroll NL queries.

## Priority: SUB-WAVE 2 (After Agent 2 completes)

## Files to MODIFY

### 1. `server/src/services/claude/cognee-tools.ts`
**Purpose**: Add 2 new datasets and indexing/search methods for payroll
**CRITICAL**: Read the full file (671+ lines). Add to the COGNEE_DATASETS constant and add new methods at the end.

#### Step 1: Add dataset constants
Find the `COGNEE_DATASETS` constant and add:
```typescript
// Wave 4: Payroll datasets
employee_profiles: 'employee_profiles',
pay_structures: 'pay_structures',
```

#### Step 2: Add employee indexing method
```typescript
/**
 * Index employee profile data for NL queries (Wave 4)
 * Indexes: name, email, employment type, status, start date
 */
async indexEmployee(employee: {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  employmentType: string;
  status: string;
  startDate: string;
}, userId?: string): Promise<void> {
  const dataset = this.prefixDataset(COGNEE_DATASETS.employee_profiles);
  const data = [
    `Employee: ${employee.firstName} ${employee.lastName}`,
    `Email: ${employee.email ?? 'not provided'}`,
    `Type: ${employee.employmentType}`,
    `Status: ${employee.status}`,
    `Start Date: ${employee.startDate}`,
    `Employee ID: ${employee.id}`,
  ].join('\n');

  await this.client.add([data], dataset, userId ?? this.config.userId);
}

/**
 * Index pay structure data for NL queries (Wave 4)
 */
async indexPayStructure(structure: {
  employeeName: string;
  categoryName: string;
  rate: number; // cents
  rateType: string;
  hoursPerWeek?: number;
  annualSalary?: number; // cents
}, userId?: string): Promise<void> {
  const dataset = this.prefixDataset(COGNEE_DATASETS.pay_structures);
  const rateDollars = (structure.rate / 100).toFixed(2);
  const salaryDollars = structure.annualSalary ? (structure.annualSalary / 100).toFixed(2) : 'N/A';

  const data = [
    `Employee: ${structure.employeeName}`,
    `Pay Category: ${structure.categoryName}`,
    `Rate: $${rateDollars} (${structure.rateType})`,
    `Hours/Week: ${structure.hoursPerWeek ?? 'N/A'}`,
    `Annual Salary: $${salaryDollars}`,
  ].join('\n');

  await this.client.add([data], dataset, userId ?? this.config.userId);
}
```

#### Step 3: Add employee search methods
```typescript
/**
 * Search employees by name or attribute (Wave 4)
 * Uses CHUNKS_LEXICAL for name matching
 */
async searchEmployees(query: string, topK: number = 5, userId?: string): Promise<string[]> {
  const dataset = this.prefixDataset(COGNEE_DATASETS.employee_profiles);
  return this.client.search(query, dataset, topK, 'CHUNKS_LEXICAL', userId ?? this.config.userId);
}

/**
 * Search pay structures and rates (Wave 4)
 * Uses CHUNKS for semantic matching on rates and categories
 */
async searchPayStructures(query: string, topK: number = 5, userId?: string): Promise<string[]> {
  const dataset = this.prefixDataset(COGNEE_DATASETS.pay_structures);
  return this.client.search(query, dataset, topK, 'CHUNKS', userId ?? this.config.userId);
}
```

#### Step 4: Update _moduleToDataset mapping
Find the `_moduleToDataset()` method and add:
```typescript
case 'payroll':
case 'employees':
  return COGNEE_DATASETS.employee_profiles;
case 'pay_structures':
case 'pay':
  return COGNEE_DATASETS.pay_structures;
```

## Verification
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] `COGNEE_DATASETS.employee_profiles` = 'employee_profiles'
- [ ] `COGNEE_DATASETS.pay_structures` = 'pay_structures'
- [ ] `indexEmployee()` compiles and calls client.add with correct dataset
- [ ] `indexPayStructure()` compiles and calls client.add with correct dataset
- [ ] `searchEmployees()` uses CHUNKS_LEXICAL search type
- [ ] `searchPayStructures()` uses CHUNKS search type
- [ ] All methods pass userId through to CogneeClient
- [ ] `_moduleToDataset('payroll')` returns employee_profiles
- [ ] Create marker file: `.agent-done-W04-07`

## Dependencies
- **Agent 2** must complete employee service (for data shape reference)
