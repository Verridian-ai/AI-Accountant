# React Quality — Fix Patterns Reference

All workers must read this before starting. Apply every applicable rule to every file in your assigned directories.

## Golden Rules (non-negotiable)
1. Read EVERY file before editing it
2. Run `cd "C:/Users/Danie/Desktop/CBA Statements Parse/client" && npx tsc --noEmit` after every batch — **0 errors**
3. NEVER use `@ts-ignore`, `@ts-expect-error`, or `as any`
4. Commit after completing each directory: `git add -A && git commit -m "fix(react-quality): [directory] all issues"`
5. Message lead `DONE: [worker-name]` when your task is fully complete

---

## A1 · Form Labels — 235 occurrences

**Problem:** `<label>` has no `htmlFor`, control has no `id` → screen readers can't associate them.

**Fix pattern 1 — add htmlFor + id:**
```tsx
// Before
<label className="...">Email</label>
<input type="email" className="..." />

// After
<label htmlFor="email-input" className="...">Email</label>
<input id="email-input" type="email" className="..." />
```

**Fix pattern 2 — wrap control inside label (no id needed):**
```tsx
<label className="...">
  Email
  <input type="email" className="..." />
</label>
```

**Prefer pattern 1** for inputs that already have names/placeholders. Use a consistent id scheme: `{field-name}-input`, e.g. `amount-input`, `description-input`.

---

## A2 · Clickable Divs — 67 occurrences (33 keyboard + 34 role)

**Problem:** `<div onClick={...}>` has no keyboard access and no semantic role.

**Best fix — convert to button:**
```tsx
// Before
<div onClick={handleClick} className="...">Click me</div>

// After
<button type="button" onClick={handleClick} className="... cursor-pointer">Click me</button>
```

**Alternative — keep div but add role + keyboard:**
```tsx
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
  className="..."
>
  Click me
</div>
```

> Prefer `<button>` — it's simpler and semantically correct. Only use div+role when CSS layout makes button impossible.

---

## A3 · autoFocus — 12 occurrences

**Problem:** `autoFocus` disrupts expected focus flow for screen reader and keyboard users.

**Fix:** Simply remove the `autoFocus` attribute. If focus management is required, use `ref.current?.focus()` inside a `useEffect` with intent.

```tsx
// Before
<input autoFocus type="text" />

// After
<input type="text" />
```

---

## C1 · Array Index Keys — 123 occurrences

**Problem:** `key={idx}` causes React to reuse DOM nodes incorrectly when list order changes.

**Fix — use stable id:**
```tsx
// Before
{items.map((item, idx) => <Row key={idx} item={item} />)}

// After — use item.id if available
{items.map((item) => <Row key={item.id} item={item} />)}

// If no id, composite key from stable fields:
{items.map((item) => <Row key={`${item.date}-${item.description}`} item={item} />)}

// For static config arrays (no data from server), index is acceptable:
{STATIC_TABS.map((tab, i) => <Tab key={tab.id} {...tab} />)}
```

> If items genuinely have no unique field, add a composite from 2+ stable fields. Never use random/Math.random() as key.

---

## C2 · Stale Closure setState — 4 occurrences

**Problem:** Reading state variable in setState callback creates stale closure.

```tsx
// Before (stale if called in async context)
setOffset(pageOffset + 10);

// After
setOffset(prev => prev + 10);
```

---

## C3 · Non-Lazy useState Initializer — 5 occurrences

**Problem:** `useState(expensiveFn())` calls the function on EVERY render, not just the first.

```tsx
// Before
const [items, setItems] = useState(slice());

// After
const [items, setItems] = useState(() => slice());
```

---

## C4 · Default Prop `[]` — 8 occurrences

**Problem:** `{ items = [] }` creates a new array reference each render, breaking memo/deps.

```tsx
// Before
function Table({ rows = [] }: { rows?: Row[] }) { ... }

// After — module-level constant
const EMPTY_ROWS: Row[] = [];
function Table({ rows = EMPTY_ROWS }: { rows?: Row[] }) { ... }
```

---

## P1 · recharts Not Lazy-Loaded — 19 occurrences

**Problem:** recharts (~500 kB) is bundled in the main chunk.

**Fix — React.lazy() + Suspense at the component level:**

For chart wrapper components in `src/components/charts/`:
```tsx
// ChartImpl.tsx (new file — move recharts code here)
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
export function BarChartImpl(props: BarChartProps) { ... }

// BarChart.tsx (updated)
import { lazy, Suspense } from 'react';
const BarChartImpl = lazy(() => import('./BarChartImpl'));

export function BarChartComponent(props: BarChartProps) {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-zinc-500 text-xs">Loading chart…</div>}>
      <BarChartImpl {...props} />
    </Suspense>
  );
}
```

For feature components that import recharts DIRECTLY (not via wrapper): extract the recharts JSX into a separate `*Chart.tsx` file and lazy-load it.

---

## P2 · Permanent will-change — 2 occurrences

**Problem:** `will-change: transform` applied always wastes GPU memory.

```tsx
// Before — always promoted
style={{ willChange: 'transform' }}

// After — only during active animation
const [isDragging, setIsDragging] = useState(false);
style={{ willChange: isDragging ? 'transform' : 'auto' }}
```

---

## P3 · touchend without passive — 1 occurrence

```tsx
// Before
element.addEventListener('touchend', handler);

// After
element.addEventListener('touchend', handler, { passive: true });
```

---

## P4 · Barrel Import — 1 occurrence

```tsx
// Before (imports entire barrel)
import { StatementCard } from './components';

// After (direct import, tree-shakeable)
import { StatementCard } from './components/StatementCard';
```

---

## Ar1 · useEffect Simulating Event Handler — 6 occurrences

**Problem:** `useEffect` watching a prop/state to trigger side effect = event handler disguised as effect.

```tsx
// Before
useEffect(() => {
  if (submitted) {
    doSomething();
    setSubmitted(false);
  }
}, [submitted]);

// After — move to the event handler
const handleSubmit = () => {
  doSomething();
};
```

---

## Ar2 · Multiple setState in useEffect — 32 occurrences

**Problem:** Multiple `setState` calls in one `useEffect` cause multiple re-renders and interleaved state.

```tsx
// Before
useEffect(() => {
  setLoading(true);
  setError(null);
  setData(null);
  fetchData().then(d => { setData(d); setLoading(false); });
}, [id]);

// After — useReducer
type State = { loading: boolean; error: string | null; data: Data | null };
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: Data }
  | { type: 'FETCH_ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START':   return { loading: true, error: null, data: null };
    case 'FETCH_SUCCESS': return { loading: false, error: null, data: action.data };
    case 'FETCH_ERROR':   return { loading: false, error: action.error, data: null };
    default: return state;
  }
}

const [state, dispatch] = useReducer(reducer, { loading: false, error: null, data: null });

useEffect(() => {
  dispatch({ type: 'FETCH_START' });
  fetchData().then(d => dispatch({ type: 'FETCH_SUCCESS', data: d }));
}, [id]);
```

---

## Ar3 · Excessive useState (≥6) — 122 occurrences

**When to convert:** When ≥6 `useState` calls are semantically related (e.g. all for a form, all for a fetch, all for a modal).

```tsx
// Before — 7 separate states
const [name, setName] = useState('');
const [email, setEmail] = useState('');
const [phone, setPhone] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [success, setSuccess] = useState(false);
const [touched, setTouched] = useState(false);

// After — one useReducer for form state
type FormState = { name: string; email: string; phone: string; loading: boolean; error: string | null; success: boolean; touched: boolean };
const initialState: FormState = { name: '', email: '', phone: '', loading: false, error: null, success: false, touched: false };
type FormAction = { type: 'SET_FIELD'; field: keyof FormState; value: string | boolean | null } | { type: 'SUBMIT_START' } | { type: 'SUBMIT_SUCCESS' } | { type: 'SUBMIT_ERROR'; error: string };

function formReducer(state: FormState, action: FormAction): FormState { ... }
const [form, dispatch] = useReducer(formReducer, initialState);
```

> **Important:** Keep UNRELATED state as separate `useState`. Only group truly related state.

---

## Ar4 · Inline Render Functions — 15 occurrences

**Problem:** `renderChartSpecificFields()` defined inside component = new function ref every render, breaks reconciliation.

```tsx
// Before — inside Component function
function Dashboard() {
  const renderSummary = () => <div>...</div>;
  return <div>{renderSummary()}</div>;
}

// After — named component at module scope
function DashboardSummary() { return <div>...</div>; }

function Dashboard() {
  return <div><DashboardSummary /></div>;
}
```

---

## Ar5 · Component Defined Inside Component — 3 occurrences (ERRORS)

Already fixed as errors. Workers: verify your directories have no remaining instances.

---

## Components > 300 Lines — 60 occurrences

For components > 300 lines, extract logical sections:
1. Create `ComponentName/` directory
2. Move component to `ComponentName/ComponentName.tsx`
3. Extract sub-sections to `ComponentName/SubSection.tsx`
4. Re-export from `ComponentName/index.tsx`
5. Replace original file with 1-line shim: `export * from './ComponentName/index';`

Only do this if the component is genuinely too large. Do NOT split arbitrarily.
