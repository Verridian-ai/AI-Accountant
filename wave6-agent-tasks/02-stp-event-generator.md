# Agent 2: STP Event Generator

## Role
Build the STP Phase 2 event generation service that creates compliant XML payloads from pay run data, manages event lifecycle (draft/submitted/accepted/rejected), and handles EOFY finalisation.

## Priority: SUB-WAVE 2 (After Agent 1)

## Files to CREATE

### 1. `server/src/services/payroll/stp-service.ts`
**Purpose**: STP Phase 2 event generation and management

**Class**: `STPService`
**Constructor**: `constructor(private db: any)`

**Interfaces**:

```typescript
interface STPEventInput {
  userId: string;
  payRunId: string;
  eventType: 'pay_event' | 'update' | 'finalisation';
}

interface STPEmployeeYTDData {
  employeeId: string;
  employeeName: string;
  tfn: string;
  birthDate: string;                    // REVISION: D02 COMP-01 — mandatory Phase 2
  residenceCountry: string;             // REVISION: D02 COMP-01 — default 'AU'
  addressCountryCode: string;           // REVISION: D02 COMP-01
  employmentBasis: 'full_time' | 'part_time' | 'casual' | 'labour_hire';  // REVISION: D02 COMP-01
  incomeStreamCode: string;             // REVISION: D02 COMP-01 — SAW, CHP, SWP, etc.
  taxTreatmentCode: string;             // REVISION: D02 COMP-01 — 6-char code (e.g., RTSFFP)
  cessationType?: string;               // REVISION: D02 COMP-01 — for terminated employees
  cessationDate?: string;               // REVISION: D02 COMP-01
  grossPayments: number;                // cents
  ordinaryTimeEarnings: number;         // REVISION: D02 COMP-01 — disaggregated gross
  overtimePayments: number;             // REVISION: D02 COMP-01
  bonusesCommissions: number;           // REVISION: D02 COMP-01
  paidLeave: number;                    // REVISION: D02 COMP-01
  allowancesIncome: number;             // REVISION: D02 COMP-01
  taxWithheld: number;                  // cents
  superGuarantee: number;               // cents
  reportableSuper: number;              // cents
  rfba: number;                         // cents
  lumpSumA: number;                     // cents
  lumpSumB: number;                     // cents
  lumpSumD: number;                     // cents
  lumpSumE: number;                     // cents
  etpCode?: string;                     // R, O, S, P, D, N, B, T
  etpAmount: number;                    // cents
}

interface STPEventResult {
  eventId: string;
  eventType: string;
  status: string;
  employeeCount: number;
  xmlPayload: string;
  totals: {
    grossPayments: number;
    taxWithheld: number;
    superGuarantee: number;
  };
}

interface STPSubmissionResult {
  eventId: string;
  status: 'submitted' | 'rejected';
  atoResponseId?: string;
  message: string;
}
```

> **REVISION NOTE (D02 CRIT-04): CRITICAL SECURITY FIX — STP XML TFN Encryption**
> The `stp_events.xmlPayload` column stores STP XML containing employee TFNs. Storing TFNs
> in plaintext in this column BYPASSES the entire TFN encryption system from Wave 4.
>
> **MANDATORY requirements:**
> 1. `stp_events.xmlPayload` MUST be ENCRYPTED at rest using AES-256-GCM (same encryption
>    utility from Wave 4: `encryptField`/`decryptField` from `encryption.ts`)
> 2. Decrypt ONLY when transmitting to ATO (`submitToATO()`) or when explicitly viewing
>    event detail with an `includeXml=true` query parameter
> 3. `GET /api/payroll/stp/events` (list endpoint) MUST NEVER include `xmlPayload` in responses
> 4. `getEventDetail()` returns XML payload ONLY with explicit decrypt flag
> 5. Add audit logging for every XML decryption operation (TFN access logging)

> **REVISION NOTE (D02 COMP-01): STP Phase 2 Missing Required Fields**
> The following ATO Phase 2 mandatory fields MUST be added to the XML and data model:
> - `IncomeStreamCode` (SAW, CHP, SWP, etc.) — per employee
> - `TaxTreatmentCode` (6-char: e.g., RTSFFP for regular full-time)
> - `PaymentFrequency` (weekly/fortnightly/monthly — must match pay run frequency)
> - `PayeeBirthDate` (mandatory for Phase 2)
> - `PayeeResidenceCountry` (default 'AU')
> - `CountryCode` for address
> - `EmploymentBasis` (full_time/part_time/casual/labour_hire)
> - `CessationType` and `CessationDate` (for terminated employees)
> - Gross disaggregation: `OrdinaryTimeEarnings`, `OvertimePayments`, `BonusesCommissions`, `PaidLeave`, `AllowancesIncome`
>
> Add `incomeStreamCode` and `taxTreatmentCode` to the `STPEmployeeYTDData` interface.
> If these fields don't exist on `employees` table, add them to the Wave 4 employee schema
> or store in a new `stp_employee_config` table within the Wave 6 migration (0018).

> **REVISION NOTE (D02): ATO Certificate Management**
> Production STP submission requires ATO digital certificates. Design the `submitToATO()`
> method with a **pluggable submission adapter** pattern:
> - `interface STPSubmissionAdapter { submit(xml: string, cert?: Buffer): Promise<STPSubmissionResult> }`
> - `MockSTPAdapter` for development (current mock behavior)
> - `ATOSTPAdapter` for production (reads cert from `ATO_STP_CERT_PATH`, signs request)
> - Selected via `ATO_STP_MODE` env var ('mock' | 'production')

> **REVISION NOTE (D02): STP Failure Error Handling**
> When ATO submission fails:
> 1. Set `stp_events.status` to 'error' (add 'error' to status enum)
> 2. Store error details in a new `errorMessage` column on `stp_events`
> 3. Implement retry logic: max 3 retries with exponential backoff (1s, 5s, 30s)
> 4. After max retries, notify admin via SSE event: `stp_submission_failed: { eventId, error }`
> 5. Add `retryCount` column to `stp_events` to track attempts

**Methods**:

- [ ] **`generateSTPEvent(input: STPEventInput): Promise<STPEventResult>`**
  - Fetches pay run with lines and summary from DB
  - Calculates YTD figures by querying all pay run summaries for the current FY (Jul 1 → Jun 30)
  - Builds STP Phase 2 XML using `_buildXML()` helper — **MUST include ALL Phase 2 mandatory fields (REVISION: D02 COMP-01)**
  - **ENCRYPTS xmlPayload** using `encryptField()` before storing (REVISION: D02 CRIT-04)
  - Inserts `stp_events` row with status='draft'
  - Inserts `stp_employee_ytd` rows for each employee
  - Returns event **WITHOUT xmlPayload** (encrypted payload only accessible via detail endpoint)

- [ ] **`submitToATO(eventId: string): Promise<STPSubmissionResult>`**
  - Validates event status is 'draft' or 'error' (retry case)
  - **DECRYPTS** XML payload using `decryptField()` (REVISION: D02 CRIT-04)
  - **Logs TFN decryption** to audit trail (REVISION: D02 CRIT-04)
  - Calls submission adapter (mock or production based on `ATO_STP_MODE`)
  - On success: Updates status to 'submitted', sets submissionDate, resets retryCount
  - On failure: Implements retry with exponential backoff (1s, 5s, 30s), max 3 retries (REVISION: D02)
  - After max retries: Sets status to 'error', stores errorMessage, emits SSE `stp_submission_failed`
  - Returns submission result with ATO response ID (mock: generates UUID)

- [ ] **`generateFinalisation(userId: string, financialYear: string): Promise<STPEventResult>`**
  - Queries all pay runs for the FY period (Jul 1 → Jun 30)
  - Calculates complete YTD totals for all employees
  - Generates 'finalisation' event type XML
  - Must include all Phase 2 mandatory fields
  - ATO due date: 14 July after FY end

- [ ] **`listSTPEvents(params: { userId: string; status?: string; offset?: number; limit?: number }): Promise<{ data: STPEvent[]; total: number }>`**
  - Paginated list of STP events for user
  - Optional status filter
  - **MUST NEVER include `xmlPayload` in list responses** (REVISION: D02 CRIT-04) — SELECT only non-sensitive columns

- [ ] **`getEmployeeYTD(employeeId: string, financialYear?: string): Promise<STPEmployeeYTDData>`**
  - Calculates running YTD totals by summing all pay run summaries within the FY
  - If no FY provided, uses current Australian FY

- [ ] **`getEventDetail(eventId: string, includeXml?: boolean): Promise<STPEventResult & { employees: STPEmployeeYTDData[] }>`**
  - Returns full event with employee YTD breakdown
  - **xmlPayload is ONLY included when `includeXml=true`** — and is decrypted on demand (REVISION: D02 CRIT-04)
  - When decrypting, **log to audit trail**: `{ action: 'stp_xml_decrypt', eventId, timestamp }`

- [ ] **`_buildXML(event: STPEventInput, employees: STPEmployeeYTDData[], businessAbn: string, payDate: string): string`** (private)
  - Constructs STP Phase 2 XML structure (REVISED: D02 COMP-01 — includes ALL mandatory Phase 2 fields):
  ```xml
  <STPReport>
    <Header>
      <SoftwareId>GOLDLEDGER_V1</SoftwareId>
      <ABN>{businessAbn}</ABN>
      <PaymentDate>{payDate}</PaymentDate>
      <EventType>{eventType}</EventType>
      <PaymentFrequency>{frequency}</PaymentFrequency>  <!-- REVISION: D02 COMP-01 -->
    </Header>
    <Employees>
      <Employee>
        <TFN>{tfn}</TFN>
        <FullName>{name}</FullName>
        <PayeeBirthDate>{birthDate}</PayeeBirthDate>  <!-- REVISION: D02 COMP-01 -->
        <PayeeResidenceCountry>{country}</PayeeResidenceCountry>  <!-- REVISION: D02 COMP-01, default 'AU' -->
        <AddressCountryCode>{countryCode}</AddressCountryCode>  <!-- REVISION: D02 COMP-01 -->
        <EmploymentBasis>{employmentBasis}</EmploymentBasis>  <!-- REVISION: D02 COMP-01 (full_time/part_time/casual/labour_hire) -->
        <IncomeStreamCode>{incomeStreamCode}</IncomeStreamCode>  <!-- REVISION: D02 COMP-01 (SAW, CHP, etc.) -->
        <TaxTreatmentCode>{taxTreatmentCode}</TaxTreatmentCode>  <!-- REVISION: D02 COMP-01 (6-char code e.g. RTSFFP) -->
        <CessationType>{cessationType}</CessationType>  <!-- REVISION: D02 COMP-01 (if terminated) -->
        <CessationDate>{cessationDate}</CessationDate>  <!-- REVISION: D02 COMP-01 (if terminated) -->
        <GrossPayments>{grossPayments}</GrossPayments>
        <OrdinaryTimeEarnings>{ote}</OrdinaryTimeEarnings>  <!-- REVISION: D02 COMP-01 — disaggregated gross -->
        <OvertimePayments>{overtime}</OvertimePayments>  <!-- REVISION: D02 COMP-01 -->
        <BonusesCommissions>{bonuses}</BonusesCommissions>  <!-- REVISION: D02 COMP-01 -->
        <PaidLeave>{paidLeave}</PaidLeave>  <!-- REVISION: D02 COMP-01 -->
        <AllowancesIncome>{allowances}</AllowancesIncome>  <!-- REVISION: D02 COMP-01 -->
        <TotalTaxWithheld>{taxWithheld}</TotalTaxWithheld>
        <SuperGuarantee>{superGuarantee}</SuperGuarantee>
        <ReportableEmployerSuperContributions>{reportableSuper}</ReportableEmployerSuperContributions>
        <ReportableFringeBenefitsAmount>{rfba}</ReportableFringeBenefitsAmount>
        <LumpSumPaymentA>{lumpSumA}</LumpSumPaymentA>
        <LumpSumPaymentB>{lumpSumB}</LumpSumPaymentB>
        <LumpSumPaymentD>{lumpSumD}</LumpSumPaymentD>
        <LumpSumPaymentE>{lumpSumE}</LumpSumPaymentE>
        <EmploymentTerminationPaymentCode>{etpCode}</EmploymentTerminationPaymentCode>
        <EmploymentTerminationPaymentAmount>{etpAmount}</EmploymentTerminationPaymentAmount>
      </Employee>
    </Employees>
  </STPReport>
  ```
  - All monetary values in the XML are INTEGER cents (as stored in DB)
  - Omit optional fields that are zero (lump sums, ETP) but always include gross, tax, super
  - **REVISION (D02 COMP-01)**: Must include ALL Phase 2 disaggregated gross fields, employment basis, income stream code, tax treatment code

- [ ] **`_getCurrentFY(): { start: string; end: string }`** (private)
  - Returns current Australian financial year boundaries
  - If current month >= July: start = Jul 1 of current year, end = Jun 30 of next year
  - If current month < July: start = Jul 1 of previous year, end = Jun 30 of current year

**UUID generation**: Use `crypto.randomUUID()`

## Verification
- [ ] STP XML includes ALL Phase 2 mandatory ATO fields (GrossPayments, TotalTaxWithheld, SuperGuarantee, ReportableEmployerSuperContributions, RFBA, LumpSumA/B/D/E, ETP)
- [ ] **REVISION (D02 COMP-01)**: XML includes IncomeStreamCode, TaxTreatmentCode, PaymentFrequency, PayeeBirthDate, PayeeResidenceCountry, CountryCode, EmploymentBasis, CessationType/Date, disaggregated gross (OTE, overtime, bonuses, paidLeave, allowances)
- [ ] **REVISION (D02 CRIT-04)**: `xmlPayload` is ENCRYPTED in `stp_events` table — verify by reading raw DB value
- [ ] **REVISION (D02 CRIT-04)**: `listSTPEvents()` response does NOT contain xmlPayload
- [ ] **REVISION (D02 CRIT-04)**: `getEventDetail()` only includes XML when `includeXml=true`
- [ ] **REVISION (D02)**: Submission failure sets status='error', stores errorMessage, retries up to 3 times
- [ ] YTD calculation sums all pay runs within the correct Australian FY (Jul 1 → Jun 30)
- [ ] Finalisation event includes complete FY totals
- [ ] Mock ATO submission updates event status and records response ID
- [ ] Event lifecycle: draft → submitted → accepted/rejected (+ error on failure)
- [ ] All monetary values as INTEGER cents throughout
- [ ] `cd server && npx tsc --noEmit` passes clean
- [ ] Create marker file: `.agent-done-W06-02`

## Dependencies
- **Agent 1**: Schema tables must exist (stp_events, stp_employee_ytd)
- **Wave 5**: pay_runs, pay_run_summary tables must exist
- **Wave 4**: employees table must exist
