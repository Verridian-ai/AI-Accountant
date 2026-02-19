# React Component Patterns & Architecture

## Overview
Modern React component architecture emphasizes composition, hooks-based state management, and adherence to the Rules of Hooks. This skill covers React 19 patterns, Radix UI primitives, shadcn/ui composition strategies, and Tailwind CSS responsive design for building scalable, accessible, and type-safe component systems.

## Key Patterns

### Pattern 1: Hooks at Top Level (Rules of Hooks)
React requires all hooks to be called at the top level of function components or custom hooks. This enables React to maintain consistent hook order between renders.

```jsx
// ✅ CORRECT: Hooks at top level
function Counter() {
  const [count, setCount] = useState(0);
  const theme = useContext(ThemeContext);
  useEffect(() => {
    // side effect
  }, []);

  if (count === 0) return null; // ✅ Can return early
  return <div>{count}</div>;
}

// ❌ WRONG: Hooks in conditional or loop
function BadCounter({ cond }) {
  if (cond) {
    const [count, setCount] = useState(0); // ❌ VIOLATION
  }
}
```

**GoldLedger Application**: All custom hooks in `client/src/features/*/hooks.ts` must follow top-level hook convention. Hooks like `useSSE`, `useTransactions`, `useDashboard` are correctly placed at component level.

### Pattern 2: Custom Hooks for Logic Extraction
Extract reusable logic into custom hooks to maintain focused components and encourage code reuse across the component tree.

```jsx
// useWindowWidth.ts - Custom hook pattern
function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

// Usage in component
function ResponsiveLayout() {
  const width = useWindowWidth();
  return <div className={width < 768 ? 'mobile' : 'desktop'} />;
}
```

**GoldLedger Application**: GoldLedger uses custom hooks extensively: `useOffline` for PWA sync, `useSSE` for real-time updates, `useDashboard` for analytics, `useServiceWorker` for offline capability.

### Pattern 3: Radix UI Primitives for Accessibility
Build accessible components using Radix primitives which handle ARIA attributes, focus management, and keyboard navigation automatically.

```jsx
import { AccessibleIcon, VisuallyHidden } from 'radix-ui';
import { GearIcon } from '@radix-ui/react-icons';

// ✅ Accessible icon pattern
function SettingsButton() {
  return (
    <button>
      <AccessibleIcon label="Settings">
        <GearIcon />
      </AccessibleIcon>
    </button>
  );
}

// ✅ Screen reader text without visual display
function IconButton() {
  return (
    <button>
      <GearIcon />
      <VisuallyHidden>Settings</VisuallyHidden>
    </button>
  );
}
```

**GoldLedger Application**: GoldLedger's admin dashboard uses Radix primitives via shadcn/ui. Components in `client/src/features/admin/components/` inherit WAI-ARIA compliance from Radix base layer.

### Pattern 4: shadcn/ui Component Composition
shadcn/ui provides copy-paste components built on Radix primitives + Tailwind CSS, designed for composition and customization.

```jsx
// Component composition with shadcn/ui
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';

function EditDialog({ isOpen, onClose }) {
  const form = useForm();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <FormField name="title" render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <input {...field} />
              </FormControl>
            </FormItem>
          )} />
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**GoldLedger Application**: Forms throughout GoldLedger use shadcn/ui composition with React Hook Form + Zod validation (Tenant forms, Budget editor, Transaction filters). Custom registries enable team-specific component extensions.

### Pattern 5: Mobile-First Responsive Design with Tailwind
Apply unprefixed utilities for mobile, then override with breakpoint-prefixed utilities for larger screens (sm, md, lg, xl, 2xl).

```jsx
// Mobile-first responsive pattern
function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {/* Single column on mobile, 2 on sm, 3 on md, 4 on lg */}
      <div className="p-4 md:p-6 lg:p-8">
        <h2 className="text-lg md:text-xl lg:text-2xl font-bold">Title</h2>
        <p className="text-sm md:text-base hidden sm:block">Description</p>
      </div>
    </div>
  );
}

// Custom breakpoints
function DarkModeResponsive() {
  return (
    <div className="bg-white dark:bg-slate-900 md:bg-gray-50 dark:md:bg-slate-800">
      Content that changes color based on theme and screen size
    </div>
  );
}
```

**GoldLedger Application**: Wave 24 mobile responsive overhaul uses mobile-first design. All pages have responsive breakpoints (375/768/1024px). SidebarNavigation (256px desktop, 64px tablet, hidden mobile) and BottomNavigation (5-tab bar on mobile) exemplify this pattern.

### Pattern 6: Component Composition Over Props Drilling
Use React composition patterns (render props, slot pattern) to avoid deep prop drilling and maintain component flexibility.

```jsx
// Slot pattern - flexible composition
function Card({ title, children, footer }) {
  return (
    <div className="border rounded">
      {title && <h3 className="font-bold">{title}</h3>}
      <div>{children}</div>
      {footer && <div className="text-sm text-gray-500">{footer}</div>}
    </div>
  );
}

// Usage with composition
<Card
  title="Analytics"
  footer={<span>Updated 2 hours ago</span>}
>
  <AnalyticsChart />
  <SummaryStats />
</Card>
```

**GoldLedger Application**: Dashboard components use composition extensively. `DashboardGrid` wraps customizable `WidgetPicker` slots. Feature components like `AdminLayout` compose `AdminNavigation`, `AdminHeader`, `AdminContent` as compositional units.

## Best Practices

- **Hook Dependencies**: Always include all referenced variables in dependency arrays to prevent stale closures
- **Key Props**: Use stable, semantic keys in lists (IDs, not array indices) to preserve component state
- **Error Boundaries**: Wrap components in error boundaries to gracefully handle rendering errors
- **Memoization**: Use `React.memo()` and `useMemo()` sparingly—only for expensive renders with stable props
- **Lazy Loading**: Use `React.lazy()` with Suspense for code splitting large route components
- **Context Splitting**: Create multiple contexts for different concerns (theme, auth, notifications) to minimize re-renders
- **TypeScript Generics**: Use generic component types for flexible, reusable components: `<T extends Base>`
- **Prop Validation**: Prefer TypeScript types over PropTypes for better IDE support and compile-time safety

## Common Pitfalls

- **Infinite Loops**: Missing dependencies in `useEffect` can cause infinite re-renders
- **Stale Closures**: Event handlers capturing old state/props due to missing dependencies
- **Over-memoization**: Using `memo()` on all components wastes memory—profile before optimizing
- **Props in Refs**: Storing props in refs defeats React's render model; use state instead
- **useCallback Abuse**: Creating wrapper functions for every callback increases complexity without benefit
- **Conditional Rendering Bugs**: Logic errors in ternary operators or `&&` chains cause unexpected renders
- **Context Thrashing**: Context changes trigger all consumer re-renders—split contexts by frequency
- **Missing Keys**: Array renders without unique `key` props lose component state on reorder

## GoldLedger Application

GoldLedger's React codebase follows these patterns throughout:

1. **Custom Hooks** (`client/src/features/*/hooks.ts`) handle domain logic separation
2. **shadcn/ui Components** provide accessible, composable building blocks
3. **Tailwind Responsive** design ensures mobile-first UX (Wave 24 implementation)
4. **Form Composition** uses React Hook Form + Zod for validation (tenant forms, budgets, transactions)
5. **Error Boundaries** wrap major features to prevent cascading failures
6. **Code Splitting** via React.lazy() for lazy-loaded tabs (reports, dashboards, admin)

Key files demonstrating patterns:
- `client/src/App.tsx` — Route composition, lazy loading setup
- `client/src/features/admin/components/AdminDashboard.tsx` — Complex composition
- `client/src/features/tenant/TenantSwitcher.tsx` — Context + hooks pattern
- `client/src/hooks/useSSE.ts` — Custom hook with cleanup

## References

- [React 19 Docs](https://react.dev/learn)
- [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- [Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
- [Radix UI Primitives](https://www.radix-ui.com/primitives)
- [shadcn/ui Documentation](https://ui.shadcn.com/docs)
- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
