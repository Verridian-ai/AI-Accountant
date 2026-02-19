# Design Systems & Tokens

## Overview
Modern design systems use design tokens—reusable design decisions captured as data—to maintain consistency across products and enable rapid theme switching. This skill covers token architecture, Storybook component documentation, design system patterns, and Material Design 3 principles for building cohesive, scalable UI libraries.

## Key Patterns

### Pattern 1: Design Token Architecture
Design tokens represent atomic design decisions (colors, typography, spacing, shadows) as single sources of truth shared between design and code.

```json
{
  "color": {
    "primary": {
      "50": "#f0f9ff",
      "100": "#e0f2fe",
      "500": "#0ea5e9",
      "900": "#0c2d6b"
    },
    "semantic": {
      "success": "{color.primary.500}",
      "error": "{color.red.500}",
      "warning": "{color.amber.500}",
      "info": "{color.blue.500}"
    }
  },
  "typography": {
    "fontSize": {
      "xs": "12px",
      "sm": "14px",
      "base": "16px",
      "lg": "18px",
      "xl": "20px"
    },
    "fontWeight": {
      "normal": 400,
      "medium": 500,
      "semibold": 600,
      "bold": 700
    },
    "lineHeight": {
      "tight": 1.2,
      "normal": 1.5,
      "loose": 1.75
    }
  },
  "spacing": {
    "0": "0",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "6": "24px",
    "8": "32px"
  }
}
```

**GoldLedger Application**: GoldLedger's Tailwind CSS configuration (`tailwind.config.js`) defines tokens for the neumorphic gold theme. Color tokens from `categoryColors.ts` (green=revenue, warm=expense) serve as semantic tokens for transaction visualization. The gold accent (#FFCC00) is system-wide primary token.

### Pattern 2: Semantic Token Mapping
Map design tokens to semantic meanings (success, error, warning) to decouple visual design from semantic intent.

```css
/* Token definitions */
--color-primary-500: #0ea5e9;
--color-red-500: #ef4444;
--color-amber-500: #f59e0b;

/* Semantic mapping */
--color-success: var(--color-primary-500);
--color-error: var(--color-red-500);
--color-warning: var(--color-amber-500);
--color-info: var(--color-blue-500);

/* Component usage */
.alert-success {
  background-color: var(--color-success);
  border-color: var(--color-success);
}

.alert-error {
  background-color: var(--color-error);
  border-color: var(--color-error);
}
```

**GoldLedger Application**: GoldLedger's neumorphic classes (`neu-raised`, `neu-inset`) map tokens to shadow depths. Transaction categories use semantic colors: `green` for revenue (income), `warm tones` for expenses (outcomes), `neutral` for transfers. Wave 23 tenant themes could extend token mappings per tenant brand.

### Pattern 3: Theme-Aware Token Switching
Enable theme switching (dark/light mode) by scoping token values to theme selectors.

```css
:root {
  --color-bg-primary: #ffffff;
  --color-text-primary: #000000;
  --color-border: #e5e7eb;
}

[data-theme="dark"] {
  --color-bg-primary: #1a1a1a;
  --color-text-primary: #ffffff;
  --color-border: #404040;
}

/* Tailwind config integration */
export default {
  theme: {
    colors: {
      bg: {
        primary: 'var(--color-bg-primary)',
        secondary: 'var(--color-bg-secondary)',
      },
      text: {
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
      },
    },
  },
};
```

**GoldLedger Application**: GoldLedger uses neumorphic dark theme (`dark:` Tailwind prefix) throughout. Theme switching could be enhanced via CSS variables for tenant-specific brands (Wave 23 multi-tenant). Admin panel (Wave 20) has separate theme tokens scoped to `/admin` route.

### Pattern 4: Storybook Component Documentation
Use Storybook with MDX and Doc Blocks to create living component documentation integrated with stories.

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Button component for primary and secondary actions.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline'],
      description: 'Button style variant',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Button size',
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: {
    variant: 'primary',
    children: 'Click me',
  },
};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
};
```

```mdx
import { Canvas, Meta } from '@storybook/blocks';
import * as ButtonStories from './Button.stories';

<Meta of={ButtonStories} />

# Button

Button is a clickable interactive element that triggers a response.

## Usage

<Canvas of={ButtonStories.Primary} />

## Variants

The button supports three variants:

- **Primary**: Main action (blue background)
- **Secondary**: Secondary action (outline)
- **Outline**: Minimal style

<Canvas of={ButtonStories.Secondary} />
```

**GoldLedger Application**: GoldLedger could benefit from Storybook for documenting shadcn/ui components, custom form fields, and financial dashboard visualizations. A Storybook instance would showcase NeumorphicCard, AmountInput, TransactionTable components across all variants/states.

### Pattern 5: Material Design 3 Type Scale
Define a comprehensive typography system with clear hierarchy using Material Design 3 principles.

```typescript
// typographyTokens.ts
export const typography = {
  displayLarge: {
    fontSize: '57px',
    fontWeight: 400,
    lineHeight: '64px',
    letterSpacing: '-0.5px',
  },
  displayMedium: {
    fontSize: '45px',
    fontWeight: 400,
    lineHeight: '52px',
    letterSpacing: '0px',
  },
  headlineLarge: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: '40px',
    letterSpacing: '0px',
  },
  headlineMedium: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '36px',
    letterSpacing: '0px',
  },
  titleLarge: {
    fontSize: '22px',
    fontWeight: 700,
    lineHeight: '28px',
    letterSpacing: '0px',
  },
  bodyLarge: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '24px',
    letterSpacing: '0.5px',
  },
  bodyMedium: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '20px',
    letterSpacing: '0.25px',
  },
  labelLarge: {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    letterSpacing: '0.1px',
  },
};

// Tailwind config
export const typographyConfig = {
  extend: {
    fontSize: {
      'display-lg': ['57px', { lineHeight: '64px', letterSpacing: '-0.5px' }],
      'display-md': ['45px', { lineHeight: '52px', letterSpacing: '0px' }],
      'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '700' }],
    },
  },
};
```

**GoldLedger Application**: GoldLedger's typography follows implicit hierarchy. Dashboard headers use larger sizes (headline), body text for descriptions, labels for form fields. Wave 22 chart labels could align with Material Design type scale. Admin system (Wave 20) UI could formalize typography tokens for consistency.

### Pattern 6: Component Variants System
Define component variants in design tokens to enable consistent styling across all component instances.

```typescript
// buttonVariants.ts
export const buttonVariants = {
  primary: {
    background: 'var(--color-primary-500)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
  },
  secondary: {
    background: 'var(--color-gray-100)',
    color: 'var(--color-gray-900)',
    border: '1px solid var(--color-gray-300)',
    padding: '8px 16px',
    borderRadius: '6px',
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-primary-500)',
    border: '2px solid var(--color-primary-500)',
    padding: '8px 16px',
    borderRadius: '6px',
  },
  sizes: {
    sm: { padding: '6px 12px', fontSize: '12px' },
    md: { padding: '8px 16px', fontSize: '14px' },
    lg: { padding: '12px 20px', fontSize: '16px' },
  },
};

// Usage in component
function Button({ variant = 'primary', size = 'md', ...props }) {
  const styles = {
    ...buttonVariants[variant],
    ...buttonVariants.sizes[size],
  };
  return <button style={styles} {...props} />;
}
```

**GoldLedger Application**: shadcn/ui components (via Tailwind classes) define variants for buttons, dialogs, inputs. Custom variants for financial components (AmountInput, DatePicker, TransactionFilter) could be documented as design token variants in Storybook.

## Best Practices

- **Single Source of Truth**: Maintain tokens in one format (JSON/YAML) and generate code/CSS from it
- **Semantic Over Descriptive**: Use meaningful names (`color-success`) instead of implementation details (`color-green-500`)
- **Hierarchical Organization**: Group tokens by category (color, typography, spacing) with sub-levels
- **Documentation**: Every token needs context—when to use, examples, do's and don'ts
- **Version Control**: Track token changes in Git—tokenization is version control
- **Fallback Values**: Always provide fallbacks for CSS variable usage in older browsers
- **Testing Token Coverage**: Document which components use which tokens for impact analysis
- **Accessibility**: Ensure sufficient color contrast ratios (WCAG AA minimum 4.5:1)

## Common Pitfalls

- **Inconsistent Naming**: Non-semantic names (`blue-dark-2`) make tokens hard to use and maintain
- **Too Many Variants**: Excessive variants fragment the design system—aim for focused, reusable set
- **Missing Documentation**: Tokens without examples or context are unused; document liberally
- **Hard-Coded Values**: Mixing tokens with hard-coded values undermines consistency
- **Unmaintained Tokens**: Orphaned tokens accumulate over time—regularly audit and clean up
- **Font Loading Delays**: Tokens referencing web fonts can cause layout shifts—use `font-display: swap`
- **Theme Switching Overhead**: Too many CSS variables slow down theme switches—optimize selectively
- **Accessibility Ignored**: Color tokens without contrast testing create inaccessible designs

## GoldLedger Application

GoldLedger's design system maturity:

1. **Current Tokens**: Gold theme (#FFCC00), neumorphic shadows, dark mode CSS classes via Tailwind
2. **Category Colors**: Semantic colors for transaction type (revenue green, expense warm, system neutral)
3. **Typography Implicit**: Headers, body, labels follow hierarchy but not formally tokenized
4. **Component Variants**: shadcn/ui provides button, form, dialog variants
5. **Future: Storybook**: Document custom components (NeumorphicCard, AmountInput) with variants
6. **Future: Tenant Tokens**: Wave 23 multi-tenant could define per-tenant color tokens

Key files for token management:
- `client/src/features/transactions/constants/categories.ts` — category color semantic tokens
- `client/tailwind.config.js` — design token configuration (colors, spacing, fonts)
- `client/src/components/` — reusable component variants
- `.storybook/` — future Storybook documentation setup

## References

- [Storybook Documentation](https://storybook.js.org/)
- [Storybook Doc Blocks](https://storybook.js.org/docs/writing-docs/doc-blocks)
- [Material Design 3 Tokens](https://m3.material.io/blog/material-theme-builder)
- [Design Tokens Community Group](https://design-tokens.github.io/community-group/format/)
- [Tailwind CSS Configuration](https://tailwindcss.com/docs/configuration)
