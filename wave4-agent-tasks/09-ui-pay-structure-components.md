# Agent 9: Pay Structure UI Components

## Role
Build the pay category manager and pay structure editor UI components.

## Priority: SUB-WAVE 4 (After Agent 6 completes)

## Files to CREATE

### 1. `client/src/features/payroll/components/PayCategoryManager.tsx`
**Purpose**: CRUD interface for managing pay categories (ordinary, overtime, allowance, deduction, super, leave)
**Pattern**: Follow existing manager patterns, neumorphic dark theme

```tsx
// Key structure:
// - Category list grouped by type (Ordinary, Overtime, Allowance, Deduction, Super, Leave)
// - Type badges with semantic colors:
//   - ordinary: blue
//   - overtime: purple
//   - allowance: green
//   - deduction: red
//   - super: gold (#FFCC00)
//   - leave: teal
// - Each category shows: Name, Rate Type, Default Rate, Multiplier, Active toggle
// - "Add Category" button → opens inline form or modal
// - Edit/Delete actions per category
// - "Seed Defaults" button to populate standard Australian categories
```

Features:
- [ ] Grouped display by category type
- [ ] Rate display: hourly shows "$/hr", annual shows "$/year", fixed shows "$"
- [ ] Multiplier display for overtime (e.g. "1.5x", "2.0x")
- [ ] Taxable and Super-bearing indicators (checkmarks)
- [ ] Active/Inactive toggle
- [ ] Create form with all fields
- [ ] "Seed Default Categories" button (calls seedDefaultCategories)
- [ ] Responsive layout

### 2. `client/src/features/payroll/components/PayStructureEditor.tsx`
**Purpose**: Configure employee pay rates with effective date tracking
**Pattern**: Form with category selection and rate configuration

```tsx
// Key structure:
// - Header: Employee name and current pay summary
// - Current Structure: Table showing active pay category assignments
//   - Category Name | Rate Type | Rate | Hours/Week | Annual Salary | Effective Date
// - "Add Pay Item" button → form:
//   - Pay Category dropdown (from API)
//   - Rate input (in dollars, stored as cents)
//   - Hours per week (for hourly)
//   - Annual salary (for salaried)
//   - Effective date picker
// - History view: all past pay structure changes
// - Summary: Calculated weekly/fortnightly/monthly pay breakdown
```

Features:
- [ ] Current pay structure table
- [ ] Add new pay item form with category dropdown
- [ ] Rate input with dollar/cent formatting (input $35.00 → store 3500 cents)
- [ ] Conditional fields: hoursPerWeek shown for hourly, annualSalary for annual
- [ ] Effective date picker (defaults to today)
- [ ] History toggle to show all past changes
- [ ] Pay summary calculation:
  - Weekly gross = Σ(rate × hours × multiplier) for all categories
  - Fortnightly = weekly × 2
  - Monthly = annual / 12
  - Annual = sum of all annual rates
- [ ] Super guarantee line item (11.5% of OTE)

## Files to MODIFY

### 3. `client/src/api.ts`
**Purpose**: Add pay category API functions (if not already added by Agent 8)

```typescript
// Wave 4: Pay Category API functions
export async function fetchPayCategories(userId: string, params?: {
  page?: number; limit?: number;
}): Promise<{ data: any[]; total: number }> {
  const query = new URLSearchParams({ userId, ...params as any }).toString();
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories?${query}`);
  return res.json();
}

export async function createPayCategory(data: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/api/payroll/pay-categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function seedDefaultPayCategories(userId: string): Promise<void> {
  // This calls a seed endpoint or creates categories one by one
  const defaults = [
    { userId, name: 'Base Hourly', type: 'ordinary', rateType: 'hourly' },
    { userId, name: 'Base Salary', type: 'ordinary', rateType: 'annual' },
    { userId, name: 'Overtime 1.5x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Overtime 2.0x', type: 'overtime', rateType: 'hourly' },
    { userId, name: 'Meal Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Travel Allowance', type: 'allowance', rateType: 'fixed' },
    { userId, name: 'Union Fees', type: 'deduction', rateType: 'fixed' },
    { userId, name: 'Super Guarantee', type: 'super', rateType: 'fixed' },
    { userId, name: 'Salary Sacrifice Super', type: 'super', rateType: 'fixed' },
    { userId, name: 'Annual Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Personal/Carer Leave', type: 'leave', rateType: 'hourly' },
    { userId, name: 'Long Service Leave', type: 'leave', rateType: 'hourly' },
  ];
  for (const cat of defaults) {
    await createPayCategory(cat);
  }
}
```

**Note**: If Agent 8 already added `fetchPayCategories` and `createPayCategory` to api.ts, do NOT duplicate them. Only add `seedDefaultPayCategories`.

## Verification
- [ ] `cd client && npx tsc --noEmit` passes clean
- [ ] PayCategoryManager renders grouped categories
- [ ] PayCategoryManager supports CRUD operations
- [ ] PayStructureEditor renders current pay structure
- [ ] PayStructureEditor adds new pay items with effective dates
- [ ] Rate formatting: cents ↔ dollars conversion correct
- [ ] Pay summary calculation produces correct weekly/monthly/annual figures
- [ ] Super guarantee line at 11.5% displayed
- [ ] Create marker file: `.agent-done-W04-09`

## Dependencies
- **Agent 6** must complete API endpoints
- **Coordinates with Agent 8**: Agent 8 adds employee API functions to api.ts first, Agent 9 adds pay category functions if needed
