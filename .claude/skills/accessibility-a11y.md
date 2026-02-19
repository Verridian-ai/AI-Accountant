# Accessibility (a11y) Best Practices

## Overview
Web accessibility ensures all users—including those with disabilities—can perceive, understand, navigate, and interact with web applications. This skill covers WCAG 2.1 guidelines, ARIA patterns, keyboard navigation, screen reader support, and testing strategies for building truly accessible, inclusive interfaces.

## Key Patterns

### Pattern 1: WCAG 2.1 Compliance Levels
WCAG 2.1 defines three conformance levels (A, AA, AAA) with increasing accessibility requirements. Most projects aim for Level AA (the legal standard in many jurisdictions).

```html
<!-- ❌ WCAG VIOLATION: No color contrast (1.4:1 ratio) -->
<p style="color: #ffff00; background: #ffffff;">
  This text is unreadable for color-blind users
</p>

<!-- ✅ WCAG AA COMPLIANT: 7:1 contrast ratio -->
<p style="color: #000000; background: #ffffff;">
  This text has sufficient contrast for all users
</p>

<!-- ❌ WCAG VIOLATION: Insufficient link text -->
<p>For more info, <a href="/details">click here</a></p>

<!-- ✅ WCAG AA COMPLIANT: Descriptive link text -->
<p><a href="/details">Learn more about our accessibility features</a></p>

<!-- ❌ WCAG VIOLATION: Form field without label -->
<input type="text" placeholder="Email" />

<!-- ✅ WCAG AA COMPLIANT: Form field with associated label -->
<label htmlFor="email">Email Address</label>
<input id="email" type="email" />
```

**GoldLedger Application**: GoldLedger's neumorphic dark theme must maintain WCAG AA contrast ratios. Gold accent (#FFCC00) requires dark text overlay. Form labels in transaction entry (Wave 1 parser output) must associate with inputs. Wave 24 mobile responsive ensures sufficient touch target sizes (≥44px).

### Pattern 2: ARIA Attributes for Semantic Meaning
Use ARIA (Accessible Rich Internet Applications) attributes to convey meaning, relationships, and state to assistive technologies.

```jsx
// ❌ BAD: No semantic meaning
<div onClick={() => deleteItem(id)}>✕</div>

// ✅ GOOD: Semantic button with ARIA
<button
  aria-label="Delete item"
  onClick={() => deleteItem(id)}
>
  ✕
</button>

// ❌ BAD: Hidden status indicator
<div style={{ display: 'none' }}>Processing...</div>

// ✅ GOOD: ARIA live region announces updates
<div aria-live="polite" aria-atomic="true">
  {status === 'processing' && 'Processing...'}
</div>

// ❌ BAD: No relationship between button and content
<button>Details</button>
<div id="details-panel">Item details...</div>

// ✅ GOOD: Explicit ARIA relationship
<button aria-expanded={isOpen} aria-controls="details-panel">
  Details
</button>
<div id="details-panel" hidden={!isOpen}>
  Item details...
</div>
```

**GoldLedger Application**: Admin dashboard (Wave 20) system health indicators should use `aria-live="polite"` for status updates. Agent monitoring (Wave 20) execution details should use `aria-expanded` for disclosure patterns. Real-time transaction feed (Wave 17) should announce new items via `aria-live`.

### Pattern 3: Keyboard Navigation & Focus Management
Ensure all interactive elements are keyboard accessible with visible focus indicators and logical tab order.

```jsx
import { useRef } from 'react';

function DialogWithFocusManagement({ isOpen, onClose }) {
  const focusableElements = useRef([]);

  useEffect(() => {
    if (isOpen) {
      // Move focus into dialog
      focusableElements.current[0]?.focus();

      // Trap focus within dialog (prevent Tab out)
      const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
          const current = document.activeElement;
          const lastFocusable = focusableElements.current[focusableElements.current.length - 1];

          if (current === lastFocusable && !e.shiftKey) {
            e.preventDefault();
            focusableElements.current[0]?.focus();
          }
        }

        // Close on Escape
        if (e.key === 'Escape') {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  return (
    <dialog open={isOpen}>
      <button ref={el => focusableElements.current[0] = el}>Close</button>
      {/* More focusable content */}
      <input ref={el => focusableElements.current[1] = el} />
      <button ref={el => focusableElements.current[2] = el} onClick={onClose}>
        Confirm
      </button>
    </dialog>
  );
}

// CSS for visible focus
const styles = `
  button:focus-visible,
  input:focus-visible,
  a:focus-visible {
    outline: 2px solid #0ea5e9;
    outline-offset: 2px;
  }

  :focus:not(:focus-visible) {
    outline: none; /* Hide outline for mouse users */
  }
`;
```

**GoldLedger Application**: All modals (budget editor, tenant settings, admin login) must have focus trapping and Escape-to-close. Tab order should follow logical flow (top-to-bottom, left-to-right). Dashboard tabs should navigate with arrow keys. Wave 24 mobile navigation must be keyboard accessible despite touch-first design.

### Pattern 4: Screen Reader Testing Patterns
Use semantic HTML and ARIA to ensure screen readers announce content correctly.

```jsx
// ❌ BAD: Screen readers can't infer structure
<div>
  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>My Heading</div>
  <div>Paragraph content</div>
  <div style={{ fontSize: '12px' }}>Caption text</div>
</div>

// ✅ GOOD: Semantic HTML structure
<article>
  <h1>My Heading</h1>
  <p>Paragraph content</p>
  <figcaption>Caption text</figcaption>
</article>

// ❌ BAD: Form structure unclear to screen readers
<div>
  <span>Email:</span>
  <input type="text" />
</div>

// ✅ GOOD: Proper form association
<label htmlFor="email">Email:</label>
<input id="email" type="email" />

// ❌ BAD: Tables announced row-by-row
<table>
  <tr><td>January</td><td>100</td></tr>
  <tr><td>February</td><td>200</td></tr>
</table>

// ✅ GOOD: Table headers establish relationships
<table>
  <thead>
    <tr><th>Month</th><th>Revenue</th></tr>
  </thead>
  <tbody>
    <tr><td>January</td><td>$100,000</td></tr>
    <tr><td>February</td><td>$200,000</td></tr>
  </tbody>
</table>
```

**GoldLedger Application**: Financial reports (Wave 13) tables must use `<thead>`, `<tbody>`, `<th>` for proper screen reader navigation. Transaction lists should use semantic list markup (`<ul>`, `<li>`). P&L statements must structure nested items with `<thead>` headers for category grouping. Wave 22 chart visualizations need alt text and data table fallbacks.

### Pattern 5: Color Contrast & Color Independence
Ensure sufficient color contrast and never rely on color alone to convey information.

```css
/* Minimum WCAG AA: 4.5:1 contrast for normal text, 3:1 for large text */
.text-primary {
  color: #1a1a1a;
  background: #ffffff;
  /* Contrast ratio: 21:1 ✅ */
}

.text-error {
  color: #dc2626;
  background: #ffffff;
  /* Contrast ratio: 5.5:1 ✅ */
}

.text-warning {
  color: #ea580c;
  background: #ffffff;
  /* Contrast ratio: 5.2:1 ✅ */
}

/* ❌ BAD: Relies on color alone */
.category-income {
  color: #10b981; /* Green for income */
}

.category-expense {
  color: #ef4444; /* Red for expense */
}

/* ✅ GOOD: Uses icon + color + text */
.category-income {
  color: #10b981;
}

.category-income::before {
  content: '↓ '; /* Income down arrow */
}

.category-expense {
  color: #ef4444;
}

.category-expense::before {
  content: '↑ '; /* Expense up arrow */
}
```

**GoldLedger Application**: GoldLedger's transaction categories use semantic colors (green=revenue, warm=expense). Wave 22 visualizations must add icons/patterns in addition to colors for accessibility. NeumorphicCard shadows provide visual depth but must be paired with text labels for screen readers. Dashboard analytics (Wave 13) must include data tables alongside charts.

### Pattern 6: Accessible Forms with Validation
Provide clear labels, error messages, and validation feedback accessible to all users.

```jsx
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  amount: z.number().min(0, 'Amount must be positive'),
});

function AccessibleForm() {
  const { register, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  return (
    <form>
      <div>
        <label htmlFor="email">
          Email Address
          <span aria-label="required">*</span>
        </label>
        <input
          id="email"
          {...register('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <div id="email-error" role="alert">
            {errors.email.message}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="amount">Amount ($)</label>
        <input
          id="amount"
          type="number"
          {...register('amount', { valueAsNumber: true })}
          aria-invalid={!!errors.amount}
          aria-describedby={errors.amount ? 'amount-error' : undefined}
        />
        {errors.amount && (
          <div id="amount-error" role="alert">
            {errors.amount.message}
          </div>
        )}
      </div>

      <button type="submit">
        Submit
      </button>
    </form>
  );
}
```

**GoldLedger Application**: All forms (transaction entry, budget editor, tenant settings) should follow this pattern. Wave 24 form validation should announce errors via `role="alert"`. Multi-step forms (payment matching rule configuration) should use `aria-current="step"` for progress indication.

## Best Practices

- **Semantic HTML First**: Use native elements (`<button>`, `<input>`, `<nav>`) before reaching for ARIA
- **Test with Real Assistive Tech**: Screen reader testing tools are vital—use NVDA (Windows), JAWS, VoiceOver (Mac/iOS)
- **Focus Visible Indicators**: Never remove outline; customize with `outline-offset` if needed
- **Alt Text for Images**: Describe purpose, not just content ("Save transaction" not "floppy disk icon")
- **Keyboard Shortcuts**: Document them and avoid conflicts with assistive tech shortcuts
- **Accessible Names**: Buttons/links need text content or `aria-label`; form inputs need `<label>`
- **Color + Symbol**: Never convey critical info via color alone; add patterns, icons, or text
- **Motion Sensitivity**: Respect `prefers-reduced-motion` media query; disable parallax, autoplay

## Common Pitfalls

- **Empty Links/Buttons**: `<a href="#"><img /></a>` lacks accessible name for screen readers
- **Forgotten Labels**: `<input />` without `<label>` makes form inaccessible
- **ARIA Misuse**: `role="button"` on `<div>` doesn't provide keyboard handling—use `<button>`
- **Focus Loss**: Changing focus unexpectedly (opening modal without focus trap) disorients users
- **Color Only**: Status indicated by color alone is inaccessible to colorblind users
- **Unlabeled SVG**: `<svg><path d="..."/></svg>` lacks semantic meaning; add `<title>` or `aria-label`
- **Ignored Validation**: Form validation errors not announced via `role="alert"` are missed by screen readers
- **Busy Live Regions**: Too many `aria-live` regions create noise—use selectively for important updates

## GoldLedger Application

GoldLedger's accessibility roadmap:

1. **Current**: Dark neumorphic theme requires contrast testing
2. **Forms**: All forms (transaction entry, tenant setup, budget editor) need proper labels and error handling
3. **Tables**: Financial reports (P&L, balance sheet) must use semantic `<table>` markup
4. **Navigation**: Dashboard tabs and navigation drawers need keyboard focus management
5. **Real-Time**: SSE updates (Wave 17 transaction feed) should announce via `aria-live="polite"`
6. **Charts**: Wave 22 visualizations need alt text and accessible data tables as fallback

Key files for accessibility:
- `client/src/features/transactions/components/TransactionEntry.tsx` — form accessibility
- `client/src/features/admin/components/AdminDashboard.tsx` — keyboard navigation
- `client/src/features/reports/components/BalanceSheet.tsx` — table semantics
- `client/src/components/NotificationCenter.tsx` — live region announcements

## References

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Color Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [MDN Web Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [The A11y Project Checklist](https://www.a11yproject.com/checklist/)
