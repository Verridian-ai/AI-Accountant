# Agent R01: Platform & Theming Researcher

## Role

Research the current UI architecture, theming system, Tailwind configuration, and platform ecosystem (React Native, Tauri) to inform Waves 25, 27, 28, 29, and 30 planning.

## Phase: A (Research — Start Immediately, Parallel with R02-R03)

## Research Tasks

### 1. Current Theme & Styling Architecture

- [ ] Read `client/tailwind.config.js` — document ALL custom colors, especially gold (#FFCC00), dark backgrounds, neumorphic utilities
- [ ] Read `client/src/index.css` — document ALL CSS custom properties, `@layer` definitions, neumorphic class definitions (`neu-raised`, `neu-inset`, `neu-flat`)
- [ ] Read `client/postcss.config.js` — document PostCSS plugins in use
- [ ] Search `client/src/` for ALL hardcoded color values (hex codes, rgb, hsl) that would need theme-aware replacements
- [ ] Count total UI components in `client/src/` — how many files use neumorphic classes?
- [ ] Document the current dark-only assumption: which components have `bg-[#1a1b2e]`, `bg-[#252640]`, `text-white` etc. hardcoded?

### 2. Component Inventory for Theming

- [ ] Read `client/src/App.tsx` — document ALL routes, tabs, and top-level layout components
- [ ] List ALL feature folders in `client/src/features/` or `client/src/components/`
- [ ] Identify shared/reusable components vs page-specific components
- [ ] Document any existing theme-related code (dark mode toggles, CSS variables, context providers)

### 3. React Native Ecosystem Research

- [ ] Research React Native + Expo latest stable (SDK 52+) — setup requirements, TypeScript support
- [ ] Research React Native styling: how to share Tailwind-like styles (NativeWind, Tamagui, or custom)
- [ ] Research navigation: React Navigation v7 patterns
- [ ] Research biometric auth: expo-local-authentication capabilities (Face ID, Touch ID, fingerprint)
- [ ] Research offline storage: WatermelonDB vs MMKV vs expo-sqlite for offline-first
- [ ] Research push notifications: expo-notifications setup for iOS + Android

### 4. Tauri v2 Ecosystem Research

- [ ] Research Tauri v2 latest stable — Rust backend, webview frontend, plugin system
- [ ] Compare Tauri vs Electron: bundle size (Tauri ~5MB vs Electron ~150MB), memory usage, startup time
- [ ] Research Tauri plugins: system tray, auto-updater, file associations, notifications
- [ ] Research Tauri + existing React app: how to wrap the current Vite+React frontend
- [ ] Research code signing for Windows (Authenticode) and installer creation (WiX/NSIS)

### 5. Design System & Storybook Research

- [ ] Research Storybook 8+ setup with Vite + React + TypeScript + Tailwind
- [ ] Research Framer Motion for micro-interactions and page transitions
- [ ] Research modern SaaS landing page patterns (Jetso.com aesthetic: clean, professional)
- [ ] Document what Wave 22 (Advanced Visualizations) built — Recharts components to polish

## Output Format

Write findings to `wave0c-research/R01-platform-theming.md` with sections:

1. **Current Theme Architecture** — Colors, CSS properties, neumorphic classes, hardcoded values count
2. **Component Inventory** — Total count, feature folders, shared components, theme-awareness gaps
3. **React Native Assessment** — Recommended setup (Expo vs bare), styling strategy, key libraries
4. **Tauri Assessment** — v2 capabilities, comparison with Electron, integration with existing React app
5. **Design System** — Storybook setup plan, animation library recommendation, landing page patterns
6. **Technology Recommendations** — Final verdicts on React Native vs Flutter, Tauri vs Electron, theme strategy

## Completion

- [ ] All sections populated with current file paths, counts, and recommendations
- [ ] Create marker file: `.agent-done-0C-R01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Frontend Architecture | Analyze React/Tailwind/CSS patterns | Expert |
| Mobile Development | React Native + Expo ecosystem knowledge | Advanced |
| Desktop Development | Tauri/Electron comparison | Advanced |
| Design Systems | Storybook, component libraries, theming | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Read all CSS/Tailwind files, count hardcoded colors, map neumorphic classes
- **Sub-agent B**: Inventory all UI components, count files per feature folder
- **Sub-agent C**: Research React Native + Expo setup, offline storage, biometrics
- **Sub-agent D**: Research Tauri v2 capabilities, compare with Electron
- R01 merges all sub-agent findings into final report

