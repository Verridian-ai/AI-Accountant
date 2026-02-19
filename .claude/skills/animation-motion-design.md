# Animation & Motion Design

## Overview
Modern web animation libraries enable smooth transitions, complex sequences, and performant interactive experiences. This skill covers Motion (formerly Framer Motion), GSAP for professional-grade animations, layout animation patterns, and performance optimization techniques for building delightful user interfaces.

## Key Patterns

### Pattern 1: Layout Animations with Motion `layout` Prop
The `layout` prop automatically animates position and size changes when React re-renders, creating smooth transitions without manual animation definitions.

```jsx
import { motion } from 'motion/react';

function AnimatedList({ items, selectedId }) {
  return (
    <motion.div layout className="flex gap-2">
      {items.map(item => (
        <motion.div
          key={item.id}
          layout
          className={selectedId === item.id ? 'bg-blue-500' : 'bg-gray-200'}
        >
          {item.name}
        </motion.div>
      ))}
    </motion.div>
  );
}

// When selectedId changes, layout animates size/position smoothly
// No explicit animate prop needed—layout handles it
```

**GoldLedger Application**: Dashboard widgets and grid layouts (Wave 22) could use layout animations for smooth rearrangement when widgets are added/removed. The `DashboardGrid` component would benefit from `layout` prop for re-order animations.

### Pattern 2: Shared Element Transitions with `layoutId`
Create seamless transitions between components by using `layoutId` to morph one element into another across DOM structure changes.

```jsx
import { motion } from 'motion/react';

function ListItemExpander() {
  const [expanded, setExpanded] = useState(null);

  return (
    <div>
      {items.map(item => (
        <motion.div key={item.id} layout>
          <motion.button onClick={() => setExpanded(item.id)}>
            {item.name}
          </motion.button>

          {expanded === item.id && (
            <motion.div layoutId={`details-${item.id}`}>
              {item.details}
            </motion.div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
```

**GoldLedger Application**: Transaction details expansion (Wave 14 payment matching review) or account detail sheets could use shared element transitions for visual continuity when drilling into item details.

### Pattern 3: GSAP Timeline for Complex Sequences
GSAP timelines enable orchestrating multiple tweens with precise timing, delays, and overlaps—ideal for complex, non-linear animations.

```javascript
import gsap from 'gsap';

// Modular timeline pattern
function createIntroAnimation() {
  const tl = gsap.timeline();
  tl.from('.logo', { opacity: 0, duration: 0.5 }, 0)
    .from('.title', { opacity: 0, y: 20, duration: 0.5 }, 0.2)
    .from('.subtitle', { opacity: 0, duration: 0.3 }, 0.4);
  return tl;
}

function createContenAnimation() {
  const tl = gsap.timeline();
  tl.from('.content', { opacity: 0, y: 40, duration: 0.8, stagger: 0.1 });
  return tl;
}

// Master timeline stitching sequences together
const master = gsap.timeline();
master
  .add(createIntroAnimation())
  .add(createContenAnimation(), '+=1'); // 1s gap between sequences
```

**GoldLedger Application**: Admin dashboard (Wave 20) system health checks animation could use GSAP timelines for sequential health indicator animations. Report generation visualizations (Wave 13) could animate in data series sequentially.

### Pattern 4: High-Frequency Event Animations with `quickTo()`
For animations triggered by frequent events (mousemove, scroll), use GSAP's `quickTo()` to optimize performance.

```javascript
import gsap from 'gsap';

// Optimize mouse tracking
const elements = document.querySelectorAll('.card');
const tweeners = Array.from(elements).map(el =>
  gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' })
);

document.addEventListener('mousemove', (e) => {
  tweeners.forEach((tweener, i) => {
    tweener(e.clientX - window.innerWidth / 2);
  });
});

// Optimize scroll tracking
const setRotation = gsap.quickSetter('.spinner', 'rotation', 'deg');
document.addEventListener('scroll', () => {
  setRotation(window.scrollY * 0.5);
});
```

**GoldLedger Application**: Real-time transaction feed (Wave 17 cross-module intelligence timeline) could use `quickTo()` for smooth position updates as new transactions arrive via SSE. Chart animations (Wave 22 Recharts) could optimize axis value tweens.

### Pattern 5: Motion Component Variants for State Machines
Define animation states as motion component variants to create reusable, composable animation patterns.

```jsx
import { motion } from 'motion/react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: { opacity: 1, x: 0 },
};

function AnimatedList({ items, isVisible }) {
  return (
    <motion.ul
      variants={containerVariants}
      initial="hidden"
      animate={isVisible ? 'visible' : 'hidden'}
    >
      {items.map(item => (
        <motion.li key={item.id} variants={itemVariants}>
          {item.name}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

**GoldLedger Application**: Form field animations (loan comparison forms, budget editor) could use variant patterns for error states, success states, and loading states. Notification center alerts could animate in with variants.

### Pattern 6: SVG Path Animations
Animate SVG stroke, fill, and path morphing for engaging data visualizations and custom graphics.

```jsx
import { motion } from 'motion/react';

function AnimatedChart() {
  return (
    <motion.svg width="300" height="300">
      <motion.circle
        cx="150"
        cy="150"
        r="100"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
        initial={{ strokeDashoffset: 628 }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: 2 }}
      />

      <motion.path
        d="M 50 150 Q 150 50, 250 150"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5 }}
      />
    </motion.svg>
  );
}
```

**GoldLedger Application**: Analytics dashboards (Wave 13 P&L visualization) or market feeds (Wave 10) could animate SVG charts with path drawing animations. Knowledge graph visualization (Wave 16) could animate node connections.

## Best Practices

- **GPU Acceleration**: Animate `transform` and `opacity` for better performance—avoid animating layout properties
- **Timing Functions**: Use easing functions (ease-out for enters, ease-in for exits) to create natural motion
- **Stagger Animations**: Stagger children items for visual interest: `transition: { staggerChildren: 0.1 }`
- **Cleanup**: Always unsubscribe from animation events and cancel timelines in `useEffect` cleanup
- **Prefers Reduced Motion**: Respect `prefers-reduced-motion` media query for accessibility: `motion.supported = !prefersReducedMotion`
- **Duration Targets**: Keep animations under 500ms for UI feedback, 1-3s for storytelling, 0.2-0.3s for micro-interactions
- **CSS-in-JS Trade-offs**: Motion/GSAP add overhead; consider native CSS animations for simple transitions
- **Performance Monitoring**: Use DevTools Performance tab to profile animation frame rates—aim for 60fps

## Common Pitfalls

- **Animating Layout**: Avoid animating `width`/`height` directly—use `transform: scale()` instead
- **Over-Animation**: Too many animations creates visual noise; be intentional with motion
- **Blocking Animation**: Synchronous animations block main thread—use `requestAnimationFrame`
- **Memory Leaks**: Forgetting to cancel GSAP tweens/timelines causes memory accumulation
- **Accessibility Ignored**: Animations distract users with motion sensitivity; always respect `prefers-reduced-motion`
- **Tween Conflicts**: Multiple tweens targeting same property cause fighting—use single timeline or cancel previous
- **Hard-Coded Values**: Animate data-driven values, not magic numbers; break animations into reusable functions
- **Mobile Performance**: Heavy animations tank mobile performance—profile on actual devices, not desktop

## GoldLedger Application

GoldLedger's animation strategy:

1. **Layout Animations**: Dashboard widgets (Wave 22) benefit from Motion `layout` prop for grid rearrangement
2. **Form States**: Login/auth flows could animate form errors, success states using Motion variants
3. **Notification Toasts**: Toast notifications could use Motion for enter/exit with `layoutId` for stacking
4. **Chart Animations**: Recharts integration (Wave 22) could layer GSAP for axis animations
5. **Real-Time Updates**: SSE streaming updates (Wave 17) could animate incoming transaction rows with stagger

Key candidates for animation:
- Admin health check indicators (Wave 20) — sequential GSAP timeline
- Transaction feed (Wave 17) — staggered list animations
- Budget vs actual variance (Wave 13) — SVG bar chart morphing
- Knowledge graph nodes (Wave 16) — node entrance animations

## References

- [Motion Documentation](https://motion.dev/)
- [Motion Layout Animations](https://motion.dev/docs/react-layout-animations)
- [GSAP Documentation](https://gsap.com/docs/v3/)
- [GSAP Timelines](https://gsap.com/docs/v3/GSAP/Timeline)
- [Web Animation Performance](https://web.dev/animations-guide/)
