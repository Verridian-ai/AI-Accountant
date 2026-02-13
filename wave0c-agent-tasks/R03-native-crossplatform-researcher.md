# Agent R03: Native App & Cross-Platform Researcher

## Role

Research React Native + Expo setup, Tauri v2 capabilities, offline sync strategies, biometric authentication, app store requirements, and cross-platform code sharing patterns. This informs Waves 28, 29, and 30 planning.

## Phase: A (Research — Start Immediately, Parallel with R01, R02)

## Research Tasks

### 1. React Native + Expo Project Setup

- [ ] Research Expo SDK 52+ with TypeScript template — project structure, config files
- [ ] Research monorepo setup: how to share code between `client/` (web) and `mobile/` (React Native)
- [ ] Research shared packages pattern: `packages/shared/` for types, API client, validation, business logic
- [ ] Research EAS Build for iOS and Android — cloud build vs local build
- [ ] Research Expo Router for file-based routing (similar to Next.js)

### 2. iOS-Specific Requirements (Wave 28)

- [ ] Research Apple Human Interface Guidelines — key requirements for financial apps
- [ ] Research Face ID / Touch ID integration via `expo-local-authentication`
- [ ] Research iOS push notifications via APNs + `expo-notifications`
- [ ] Research App Store review guidelines for financial/accounting apps
- [ ] Research iOS-specific UI patterns: bottom tab bar, swipe gestures, haptic feedback
- [ ] Research App Store submission checklist: screenshots (6.7", 6.5", 5.5"), metadata, privacy policy

### 3. Android-Specific Requirements (Wave 29)

- [ ] Research Material Design 3 via `react-native-paper` or `@react-navigation/material-top-tabs`
- [ ] Research Android biometric authentication (fingerprint, face unlock)
- [ ] Research Android-specific features: home screen widgets (via expo-widgets or native module), deep linking
- [ ] Research Google Play Store submission: content rating, data safety form, target API level
- [ ] Research Android app bundle (.aab) vs APK for distribution

### 4. Windows Desktop App (Wave 30)

- [ ] Research Tauri v2 project setup — `create-tauri-app` with existing React frontend
- [ ] Research Tauri system tray plugin — quick actions, status indicators
- [ ] Research Tauri auto-updater — update server setup, differential updates
- [ ] Research Tauri file associations — register .csv, .pdf, .qif file types
- [ ] Research Windows code signing — Authenticode certificate, signing process
- [ ] Research Tauri bundler — MSI installer, NSIS installer, portable executable
- [ ] Research Tauri IPC — communication between Rust backend and React frontend

### 5. Cross-Platform Architecture

- [ ] Research shared state management: Zustand (lightweight) vs Redux Toolkit (full-featured) vs Jotai (atomic)
- [ ] Research API client sharing: can the same fetch/axios client work on web + React Native + Tauri?
- [ ] Research authentication for native apps: OAuth2 PKCE flow, secure token storage (Keychain/Keystore/DPAPI)
- [ ] Research offline data sync strategies:
  - CRDTs (conflict-free replicated data types) — complex but robust
  - Operational transformation — good for collaborative editing
  - Last-write-wins with conflict detection — simple, good for single-user
- [ ] Research offline storage: WatermelonDB (React Native), IndexedDB (web), SQLite (Tauri)
- [ ] Document code sharing percentages: what % of code can be shared across web/iOS/Android/Windows?

### 6. Current GoldLedger API Analysis

- [ ] Read `server/src/index.ts` — document API authentication mechanism (JWT, sessions, etc.)
- [ ] Read `docker-compose.yml` — understand how native apps would connect to the server
- [ ] Read `wave24-orchestration-prompt.md` — understand PWA/service worker approach (overlap with native)
- [ ] Identify API endpoints that native apps would need vs web-only endpoints

## Output Format

Write findings to `wave0c-research/R03-native-crossplatform.md` with sections:

1. **React Native + Expo Setup** — Recommended project structure, monorepo strategy, shared packages
2. **iOS Requirements** — HIG compliance, biometrics, push notifications, App Store checklist
3. **Android Requirements** — Material Design 3, biometrics, widgets, Play Store checklist
4. **Windows Desktop (Tauri)** — Setup, system tray, auto-update, file associations, code signing
5. **Cross-Platform Architecture** — State management recommendation, API client sharing, auth strategy
6. **Offline Sync Strategy** — Recommended approach with justification
7. **Code Sharing Matrix** — Table showing what's shared vs platform-specific for each wave

## Completion

- [ ] All sections populated with specific library versions, setup steps, and recommendations
- [ ] Create marker file: `.agent-done-0C-R03`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| React Native | Expo, EAS Build, native modules | Expert |
| iOS Development | HIG, App Store, biometrics | Advanced |
| Android Development | Material Design, Play Store | Advanced |
| Desktop Development | Tauri v2, Electron comparison | Advanced |
| Cross-Platform Architecture | Code sharing, offline sync | Expert |

## Sub-Agent Delegation Plan

- **Sub-agent A**: Research React Native + Expo setup, monorepo patterns, shared packages
- **Sub-agent B**: Research iOS + Android specific requirements, app store guidelines
- **Sub-agent C**: Research Tauri v2 setup, plugins, Windows-specific features
- **Sub-agent D**: Read current GoldLedger API files, analyze auth mechanism, identify native-needed endpoints
- R03 merges all sub-agent findings into final report

