# Agent 10: Testing & Validation

## Role
Run the full verification plan for Wave 4, checking TypeScript compilation, encryption, security, backward compatibility, and documenting results.

## Priority: SUB-WAVE 5 (After ALL agents complete)

## Verification Steps

### Step 1: TypeScript Compilation
```bash
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit
```
Both must pass clean. Fix any new errors (check git diff to identify wave 4 errors vs pre-existing).

### Step 2: Schema Verification
- [ ] Verify `employees` exists in schema.ts with all 14 columns
- [ ] Verify `employeeBankDetails` exists in schema.ts with all 7 columns
- [ ] Verify `employeeSuperFunds` exists in schema.ts with all 7 columns (including `usi`)
- [ ] Verify `employeeTaxDeclarations` exists in schema.ts with all 8 columns
- [ ] Verify `payCategories` exists in schema.ts with all 10 columns (including `multiplier`, `isTaxable`, `isSuperBearing`)
- [ ] Verify `payStructures` exists in schema.ts with all 7 columns
- [ ] Verify `employeeDocuments` exists in schema.ts with all 6 columns
- [ ] Verify ALL 7 tables have matching pgTable definitions in postgres-schema.ts
- [ ] Verify 14 type exports (7 select + 7 insert)
- [ ] Verify migration `0016_employee_management.sql` has valid PostgreSQL syntax

### Step 3: Encryption Verification
- [ ] File `server/src/services/encryption.ts` exists
- [ ] `encryptField('test')` → string in "iv:tag:data" format
- [ ] `decryptField(encryptField('test'))` → 'test' (roundtrip)
- [ ] `maskTFN('123456789')` → '***-***-**9'
- [ ] `maskAccountNumber('12345678')` → '****5678'
- [ ] `validateTFN('123456782')` → true (valid check digit)
- [ ] `validateBSB('062000')` → true
- [ ] Graceful degradation without TFN_ENCRYPTION_KEY env var
- [ ] [UNENCRYPTED] prefix when key not set

### Step 4: Employee Service CRUD
- [ ] `employeeService.createEmployee(...)` — creates with encrypted TFN
- [ ] `employeeService.getEmployee(id)` — returns with masked TFN
- [ ] `employeeService.listEmployees(userId)` — returns paginated list with masked TFNs
- [ ] `employeeService.updateEmployee(id, { taxFileNumber: '...' })` — re-encrypts TFN
- [ ] `employeeService.terminateEmployee(id)` — sets status to 'terminated'
- [ ] `employeeService.addBankDetails(empId, ...)` — encrypts account number
- [ ] `employeeService.getBankDetails(empId)` — returns masked account numbers
- [ ] `employeeService.addSuperFund(empId, ...)` — defaults to 11.5% rate
- [ ] `employeeService.submitTaxDeclaration(empId, ...)` — stores ATO declaration fields

### Step 5: Pay Structure Service
- [ ] `payStructureService.createPayCategory(...)` — creates with all fields
- [ ] `payStructureService.listPayCategories(userId)` — paginated list
- [ ] `payStructureService.seedDefaultCategories(userId)` — creates 12 defaults
- [ ] `payStructureService.setPayStructure(...)` — creates with effective date
- [ ] `payStructureService.getPayStructure(empId)` — returns current (deduped by category)
- [ ] `payStructureService.calculateGrossPay(empId, hours)` — correct breakdown

### Step 6: API Endpoints
- [ ] GET `/api/payroll/employees` — paginated with status filter
- [ ] POST `/api/payroll/employees` — creates with Zod validation
- [ ] GET `/api/payroll/employees/:id` — returns masked employee
- [ ] PATCH `/api/payroll/employees/:id` — updates with Zod validation
- [ ] DELETE `/api/payroll/employees/:id` — soft-delete
- [ ] GET `/api/payroll/employees/:id/bank-details` — masked
- [ ] POST `/api/payroll/employees/:id/bank-details` — validates BSB
- [ ] GET `/api/payroll/employees/:id/super` — returns super
- [ ] POST `/api/payroll/employees/:id/super` — validates ABN format
- [ ] GET `/api/payroll/employees/:id/tax-declaration` — returns current
- [ ] POST `/api/payroll/employees/:id/tax-declaration` — validates
- [ ] GET `/api/payroll/pay-categories` — paginated
- [ ] POST `/api/payroll/pay-categories` — validates
- [ ] GET `/api/payroll/employees/:id/pay-structure` — current
- [ ] POST `/api/payroll/employees/:id/pay-structure` — validates

### Step 7: Payroll Agent Enhancement
- [ ] `payroll_agent` has 4 new tools: lookup_employee, get_employee_pay_details, calculate_gross_pay, check_super_compliance
- [ ] Existing payroll_agent tools preserved
- [ ] Agent types updated in types.ts (if applicable)
- [ ] Agent config updated in config.ts (if applicable)

### Step 8: Cognee Datasets
- [ ] `COGNEE_DATASETS.employee_profiles` defined in cognee-tools.ts
- [ ] `COGNEE_DATASETS.pay_structures` defined in cognee-tools.ts
- [ ] `indexEmployee()` method compiles
- [ ] `indexPayStructure()` method compiles
- [ ] `searchEmployees()` uses CHUNKS_LEXICAL
- [ ] `searchPayStructures()` uses CHUNKS
- [ ] `_moduleToDataset('payroll')` returns 'employee_profiles'

### Step 9: UI Components
- [ ] PayrollDashboard.tsx renders with tabs
- [ ] EmployeeList.tsx renders with search and pagination
- [ ] EmployeeDetail.tsx renders all 6 sections
- [ ] EmployeeOnboarding.tsx renders 5-step wizard
- [ ] PayCategoryManager.tsx renders grouped categories
- [ ] PayStructureEditor.tsx renders pay structure table
- [ ] 'payroll' tab in BottomNavigation
- [ ] App.tsx renders PayrollDashboard on payroll tab

### Step 10: Security Checklist
- [ ] TFN never appears in API responses as plaintext
- [ ] Bank account numbers never appear in API responses as plaintext
- [ ] TFN_ENCRYPTION_KEY referenced from env var, not hardcoded
- [ ] No TFN values in console.log or error messages
- [ ] Zod validation on all POST/PATCH endpoints
- [ ] BSB format validation prevents injection
- [ ] TFN format validation prevents injection

### Step 11: Marker Files
Verify all Wave 4 agent markers exist:
- [ ] `.agent-done-W04-01` (schema)
- [ ] `.agent-done-W04-02` (employee service)
- [ ] `.agent-done-W04-03` (pay structure service)
- [ ] `.agent-done-W04-04` (encryption)
- [ ] `.agent-done-W04-05` (payroll agent)
- [ ] `.agent-done-W04-06` (API endpoints)
- [ ] `.agent-done-W04-07` (Cognee datasets)
- [ ] `.agent-done-W04-08` (UI employees)
- [ ] `.agent-done-W04-09` (UI pay structures)

## Final Actions
1. Fix any compilation errors found
2. Create marker file: `.agent-done-W04-10`
3. Create wave completion marker: `.agent-done-wave4`
4. Report results summary to team lead

## Dependencies
- **ALL agents (1-9)** must complete before validation begins
