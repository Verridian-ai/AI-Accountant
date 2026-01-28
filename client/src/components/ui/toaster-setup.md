# Toast Notification Setup Guide

## Current Status

No toast library is currently installed in the project.

## Recommended Library: Sonner

[Sonner](https://sonner.emilkowal.ski/) is a lightweight, opinionated toast component for React. It works well with React 19 and has excellent TypeScript support.

## Installation Steps

### 1. Install sonner

```bash
cd client
npm install sonner
```

### 2. Add Toaster to App.tsx

Add the `Toaster` component to your root App component:

```tsx
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      {/* Your app content */}
      <Toaster
        position="bottom-right"
        richColors
        closeButton
      />
    </>
  );
}
```

### 3. Usage in Components/Hooks

Import and use toast anywhere in your app:

```tsx
import { toast } from 'sonner';

// Success toast
toast.success('Operation completed successfully');

// Error toast
toast.error('Something went wrong');

// Info toast
toast.info('Here is some information');

// Warning toast
toast.warning('Be careful!');

// Promise toast (great for async operations)
toast.promise(saveData(), {
  loading: 'Saving...',
  success: 'Data saved!',
  error: 'Could not save data',
});

// Custom toast with action
toast('Event created', {
  action: {
    label: 'Undo',
    onClick: () => undoAction(),
  },
});
```

## Files to Update After Installation

Replace `console.error` with `toast.error` in these hooks:

1. **`client/src/hooks/useInlineEdit.ts`**
   - Replace error logging with user-visible toast notifications

2. **`client/src/hooks/useTransactionSplit.ts`**
   - Replace error logging with user-visible toast notifications

## Toaster Configuration Options

```tsx
<Toaster
  position="bottom-right"  // or "top-right", "top-center", etc.
  richColors              // Enables colored toasts for different types
  closeButton             // Shows close button on toasts
  duration={4000}         // Default duration in ms
  expand={false}          // Expand toasts on hover
  theme="system"          // "light", "dark", or "system"
/>
```

## Styling with Tailwind

Sonner works out of the box with Tailwind CSS. For custom styling:

```tsx
<Toaster
  toastOptions={{
    classNames: {
      toast: 'bg-background border-border',
      title: 'text-foreground',
      description: 'text-muted-foreground',
    },
  }}
/>
```
