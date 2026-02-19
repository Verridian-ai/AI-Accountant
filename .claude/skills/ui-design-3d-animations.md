# Skill: Award-Winning UI Design, 3D & Advanced Animations

> Production-grade UI design, motion systems, 3D, WebGL, and visual excellence.
> Covers React, Framer Motion, GSAP, Three.js/R3F, CSS, TailwindCSS, shadcn/ui.

---

## DESIGN SYSTEM FOUNDATIONS

### Design Token System (always define first)
```css
:root {
  /* 8pt spacing grid */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px;
  --sp-6: 24px; --sp-8: 32px; --sp-12: 48px; --sp-16: 64px;

  /* Easing library */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-snap: cubic-bezier(0.68, -0.6, 0.32, 1.6);

  /* Duration scale */
  --dur-instant: 50ms; --dur-fast: 150ms; --dur-normal: 250ms;
  --dur-slow: 400ms; --dur-slower: 600ms; --dur-cinematic: 1000ms;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgb(0 0 0/0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0/0.1), 0 2px 4px -2px rgb(0 0 0/0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0/0.1), 0 4px 6px -4px rgb(0 0 0/0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0/0.1), 0 8px 10px -6px rgb(0 0 0/0.1);
  --shadow-glow: 0 0 30px rgb(var(--color-primary-rgb) / 0.35);
}
```

### Award-Winning UI Principles
1. **Purposeful motion** — every animation communicates meaning, not decoration
2. **Spatial hierarchy** — depth, shadow, scale guide attention
3. **Micro-interactions** — every tap/hover/focus has a response
4. **Consistent rhythm** — timing curves form a system, not random values
5. **Accessibility first** — WCAG 2.1 AA, always respect `prefers-reduced-motion`
6. **60fps always** — never animate layout properties (width/height/top/left)
7. **Progressive enhancement** — works without JS, better with it

---

## FRAMER MOTION — PRODUCTION PATTERNS

### Page Transitions
```tsx
import { motion, AnimatePresence } from 'framer-motion'

const pageVariants = {
  initial: { opacity: 0, y: 20, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
```

### Stagger List Animations
```tsx
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
}
const item = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
}

export function AnimatedList({ items }: { items: Item[] }) {
  return (
    <motion.ul variants={container} initial="hidden" animate="show">
      {items.map(i => <motion.li key={i.id} variants={item}>{i.content}</motion.li>)}
    </motion.ul>
  )
}
```

### Shared Element / Layout Transitions
```tsx
export function ExpandableCard({ id, expanded, onClick }: Props) {
  return (
    <motion.div layoutId={`card-${id}`} onClick={onClick}
      style={{ borderRadius: 16 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}>
      <motion.h2 layoutId={`title-${id}`}>{title}</motion.h2>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}>
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
```

### Scroll-Driven Parallax
```tsx
import { useScroll, useTransform, useSpring } from 'framer-motion'

export function ParallaxHero() {
  const { scrollYProgress } = useScroll()
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, -200]),
    { stiffness: 100, damping: 30 })
  const opacity = useTransform(scrollYProgress, [0, 0.4], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 1.1])
  return <motion.section style={{ y, opacity, scale }}>{/* hero */}</motion.section>
}
```

### Gesture Cards (drag + hover + tap)
```tsx
export function GestureCard() {
  return (
    <motion.div
      drag dragConstraints={{ left: -100, right: 100, top: -50, bottom: 50 }}
      dragElastic={0.1}
      whileDrag={{ scale: 1.05, rotate: 2, zIndex: 50 }}
      whileHover={{ scale: 1.02, boxShadow: '0 20px 40px rgb(0 0 0/0.15)' }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
  )
}
```

### useAnimate for Imperative Control
```tsx
import { useAnimate, stagger } from 'framer-motion'

export function SuccessAnimation() {
  const [scope, animate] = useAnimate()

  const onSuccess = async () => {
    await animate('li', { opacity: [0, 1], y: [20, 0] },
      { duration: 0.3, delay: stagger(0.05) })
    await animate('.checkmark', { scale: [0, 1.2, 1], rotate: [0, 10, 0] },
      { duration: 0.5, ease: 'backOut' })
  }

  return <div ref={scope}>{/* content */}</div>
}
```

---

## GSAP — ADVANCED TIMELINE ANIMATIONS

### ScrollTrigger Pinned Section
```tsx
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
gsap.registerPlugin(ScrollTrigger)

export function PinnedSection() {
  const ref = useRef<HTMLDivElement>(null)
  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: ref.current, start: 'top top',
        end: '+=200%', scrub: 1, pin: true
      }
    })
    tl.from('.title', { y: 80, opacity: 0, duration: 1, ease: 'power3.out' })
      .from('.subtitle', { y: 40, opacity: 0, duration: 0.8 }, '-=0.5')
      .from('.cards', { y: 60, opacity: 0, stagger: 0.15, duration: 0.6 }, '-=0.3')
  }, { scope: ref })
  return <section ref={ref}>{/* content */}</section>
}
```

### Text Split Animation
```tsx
import { SplitText } from 'gsap/SplitText'
gsap.registerPlugin(SplitText)

export function RevealHeading({ text }: { text: string }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useGSAP(() => {
    const split = new SplitText(ref.current, { type: 'chars,words' })
    gsap.from(split.chars, {
      opacity: 0, y: 40, rotateX: -90,
      stagger: 0.02, duration: 0.6, ease: 'back.out(1.7)',
      transformOrigin: '0% 50% -50',
    })
    return () => split.revert()
  }, { scope: ref })
  return <h1 ref={ref}>{text}</h1>
}
```

### Counter Animation
```tsx
export function AnimatedCounter({ target }: { target: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useGSAP(() => {
    gsap.from({ val: 0 }, {
      val: target, duration: 2, ease: 'power2.out',
      onUpdate() { if (ref.current) ref.current.textContent = Math.round(this.targets()[0].val).toLocaleString() }
    })
  })
  return <span ref={ref}>0</span>
}
```

---

## THREE.JS / REACT THREE FIBER — 3D UI

### Canvas Setup
```tsx
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, Float } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration } from '@react-three/postprocessing'
import * as THREE from 'three'

export function Scene3D() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      dpr={[1, 2]}>
      <Suspense fallback={null}>
        <Environment preset="city" />
        <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
          <AnimatedMesh />
        </Float>
        <EffectComposer>
          <Bloom luminanceThreshold={0.9} intensity={0.5} />
          <ChromaticAberration offset={[0.002, 0.002]} />
        </EffectComposer>
        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Suspense>
    </Canvas>
  )
}
```

### Animated Distort Sphere
```tsx
import { useFrame } from '@react-three/fiber'
import { MeshDistortMaterial } from '@react-three/drei'

function AnimatedMesh() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.rotation.y = t * 0.2
    ref.current.scale.setScalar(1 + Math.sin(t * 0.5) * 0.05)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.5, 64, 64]} />
      <MeshDistortMaterial color="#6366f1" roughness={0.1} metalness={0.8}
        distort={0.4} speed={2} envMapIntensity={1} />
    </mesh>
  )
}
```

### GPU Particle System
```tsx
import { Points, PointMaterial } from '@react-three/drei'

function Particles({ count = 5000 }) {
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      p[i*3] = (Math.random()-0.5)*10
      p[i*3+1] = (Math.random()-0.5)*10
      p[i*3+2] = (Math.random()-0.5)*10
    }
    return p
  }, [count])
  const ref = useRef<THREE.Points>(null)
  useFrame((_, dt) => { if (ref.current) { ref.current.rotation.y += dt*0.05 } })
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial size={0.02} color="#a855f7" sizeAttenuation transparent opacity={0.8} />
    </Points>
  )
}
```

### Custom Shader Material
```tsx
import { shaderMaterial } from '@react-three/drei'
import { extend } from '@react-three/fiber'

const WaveMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color('#6366f1') },
  /* glsl vertex */ `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 pos = position;
      pos.z += sin(pos.x * 3.0 + uTime) * 0.1;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }`,
  /* glsl fragment */ `
    uniform vec3 uColor;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(uColor * (0.5 + vUv.y * 0.5), 1.0);
    }`
)
extend({ WaveMaterial })
```

---

## CSS ADVANCED TECHNIQUES

### Glassmorphism
```css
.glass {
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15);
}
```

### Animated Gradient Border (CSS @property)
```css
@property --angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }

.gradient-border {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--bg), var(--bg)) padding-box,
    conic-gradient(from var(--angle), #6366f1, #a855f7, #ec4899, #6366f1) border-box;
  animation: spin 3s linear infinite;
}
@keyframes spin { to { --angle: 360deg; } }
```

### Shimmer Skeleton
```css
.skeleton {
  background: linear-gradient(90deg,
    rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
```

### Mesh Gradient Background
```css
.mesh-bg {
  background:
    radial-gradient(ellipse at 20% 50%, rgba(120,119,198,0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(255,119,198,0.3) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, rgba(120,219,255,0.3) 0%, transparent 50%),
    #0f0f1a;
}
```

### View Transitions API
```css
::view-transition-old(root) { animation: fade-out 0.3s ease; }
::view-transition-new(root) { animation: fade-in 0.3s ease; }

@keyframes fade-out { to { opacity: 0; transform: translateY(-10px); } }
@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } }
```

---

## TAILWIND CSS — ADVANCED PATTERNS

### Animation Utilities (extend config)
```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      animation: {
        'fade-up': 'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fadeIn 0.3s ease both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'shimmer': 'shimmer 1.5s infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.9)' }, to: { opacity: '1', transform: 'scale(1)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        glowPulse: { '0%,100%': { boxShadow: '0 0 20px rgba(99,102,241,0.4)' }, '50%': { boxShadow: '0 0 40px rgba(99,102,241,0.8)' } },
      },
    }
  }
}
```

### Component Patterns
```tsx
// Animated card with hover lift
<div className="group relative rounded-2xl bg-white/5 border border-white/10 p-6
  transition-all duration-300 ease-out
  hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-white/20
  hover:bg-white/8 cursor-pointer">
  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5
    opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
</div>

// Gradient text
<h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400
  bg-clip-text text-transparent font-bold text-5xl tracking-tight">
  Award-Winning UI
</h1>

// Glass button
<button className="relative px-6 py-3 rounded-xl font-medium
  bg-white/10 backdrop-blur-sm border border-white/20
  hover:bg-white/15 hover:border-white/30
  active:scale-95 transition-all duration-150
  shadow-lg shadow-black/10">
```

---

## SHADCN/UI — ADVANCED USAGE

### Custom Animated Dialog
```tsx
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { motion, AnimatePresence } from 'framer-motion'

export function AnimatedDialog({ open, onClose, children }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <AnimatePresence>
        {open && (
          <DialogContent asChild forceMount>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
              <DialogHeader>{/* header */}</DialogHeader>
              {children}
            </motion.div>
          </DialogContent>
        )}
      </AnimatePresence>
    </Dialog>
  )
}
```

### Command Palette (cmdk)
```tsx
import { Command } from 'cmdk'

export function CommandPalette() {
  return (
    <Command.Dialog open={open} onOpenChange={setOpen}
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl overflow-hidden">
        <Command.Input placeholder="Search commands..." className="w-full px-4 py-3 bg-transparent border-b border-white/10 outline-none" />
        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-zinc-500">No results found.</Command.Empty>
          {groups.map(g => (
            <Command.Group key={g.label} heading={g.label}>
              {g.items.map(item => (
                <Command.Item key={item.id} onSelect={item.action}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer
                    aria-selected:bg-white/10 transition-colors">
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </motion.div>
    </Command.Dialog>
  )
}
```

---

## PERFORMANCE RULES

1. **Only animate** `transform`, `opacity`, `filter` — never `width`, `height`, `top`, `left`
2. **Use `will-change: transform`** sparingly, only on elements that animate frequently
3. **`useReducedMotion()`** — always check and disable animations for accessibility
4. **Canvas/WebGL** — use `dpr={[1, 2]}` to cap pixel ratio on high-DPI screens
5. **Lazy-load** Three.js scenes with `Suspense` + dynamic import
6. **Dispose** Three.js geometries/materials/textures in cleanup functions
7. **`useFrame` delta** — always use delta time for frame-rate-independent animations

```tsx
// Accessibility: always wrap animations
import { useReducedMotion } from 'framer-motion'
const shouldReduce = useReducedMotion()
const variants = shouldReduce ? { initial: {}, animate: {} } : fullVariants
```

---

## ICON SYSTEMS

```tsx
// Lucide React (preferred)
import { ArrowRight, Check, X, ChevronDown, Loader2 } from 'lucide-react'
<Loader2 className="w-4 h-4 animate-spin" />

// Animated icon wrapper
export function AnimatedIcon({ icon: Icon, className }: Props) {
  return (
    <motion.div whileHover={{ rotate: 15, scale: 1.1 }} whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
      <Icon className={className} />
    </motion.div>
  )
}
```

---

## DATA VISUALIZATION (Recharts + D3)

```tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export function AnimatedAreaChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" stroke="#ffffff20" tick={{ fill: '#ffffff60', fontSize: 12 }} />
        <YAxis stroke="#ffffff20" tick={{ fill: '#ffffff60', fontSize: 12 }} />
        <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
        <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2}
          fill="url(#colorGradient)" animationDuration={1000} animationEasing="ease-out" />
      </AreaChart>
    </ResponsiveContainer>
  )
}
```
