# Agent D01: Architecture & Integration Reviewer

## Role

Challenge ALL architecture decisions in the Wave 25-30 plans. Focus on cross-platform architecture, API compatibility, theme system design, dependency graph correctness, and integration with existing Waves 1-24. Be adversarial but constructive.

## Phase: C (Debate — After W01 completes)

## Prerequisites

Wait for `.agent-done-0C-W01` then read ALL generated wave files for Waves 25-30.

## Review Focus Areas

### 1. Theme Architecture (Wave 25)

- [ ] Is CSS custom properties the right approach, or should we use CSS-in-JS (styled-components, Emotion)?
- [ ] Does the Tailwind `dark:` variant strategy scale to 177+ components?
- [ ] How does the theme toggle interact with server-side rendering (if any)?
- [ ] Are there edge cases where gold (#FFCC00) has poor contrast on light backgrounds?
- [ ] Is localStorage + DB persistence the right dual-storage approach, or is it over-engineered?
- [ ] Does the theme system work correctly with neumorphic shadows in light mode?

### 2. Code Quality Migration Strategy (Wave 26)

- [ ] Is a big-bang `strict: true` migration realistic, or should it be incremental per-directory?
- [ ] Will ESLint + Prettier changes create massive git diffs that block other waves?
- [ ] Is the bundle optimization strategy specific enough (which dependencies to replace/remove)?
- [ ] Are error boundaries placed at the right granularity (route-level vs component-level)?

### 3. Cross-Platform Architecture (Waves 28-30)

- [ ] Is the monorepo structure (`packages/shared/`) the right approach for code sharing?
- [ ] Can the same API client work across web, React Native, and Tauri without modification?
- [ ] Is the offline sync strategy (from R03 research) appropriate for a financial app?
- [ ] Are there data consistency risks with offline-first in an accounting application?
- [ ] Is OAuth2 PKCE the right auth flow for native apps, or should we use device tokens?
- [ ] How do native apps handle the Docker-based backend? Direct API calls or API gateway?

### 4. Dependency Chain Correctness

- [ ] Is the dependency chain 25→26→27→28→29 correct, or can some waves run in parallel?
- [ ] Could Wave 30 (Tauri) start before Wave 27 (UI/UX) since it wraps the existing frontend?
- [ ] Are there circular dependencies between any waves?
- [ ] Does Wave 28 truly need Wave 27 complete, or just Wave 26?

### 5. Integration with Waves 1-24

- [ ] Do the Wave 25-30 plans reference the correct existing file paths?
- [ ] Are new API endpoints consistent with the existing API pattern (Hono routes)?
- [ ] Do native apps account for ALL existing features (52+ tables, 13+ agents)?
- [ ] Is the Cognee integration (if any) compatible with existing datasets?

### 6. Missing Concerns

- [ ] Security: How do native apps store sensitive financial data locally?
- [ ] Privacy: GDPR/privacy implications of mobile app data storage
- [ ] Performance: What are the performance targets for native apps (startup time, memory)?
- [ ] Testing: Are there E2E testing strategies for native apps (Detox, Maestro)?
- [ ] CI/CD: How are native apps built and deployed? (EAS Build, GitHub Actions)
- [ ] Versioning: How do native app versions sync with web app versions?

## Output Format

Write review to `wave0c-reviews/D01-architecture-review.md` with:

1. **Critical Issues** — Must-fix before execution (severity: HIGH)
2. **Design Concerns** — Should-fix, architectural improvements (severity: MEDIUM)
3. **Suggestions** — Nice-to-have improvements (severity: LOW)
4. **Per-Wave Verdict** — APPROVE / NEEDS REVISION for each of Waves 25-30

## Completion

- [ ] All 6 wave plans reviewed
- [ ] Create marker file: `.agent-done-0C-D01`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Architecture Review | Challenge cross-platform design decisions | Expert |
| API Design | Evaluate REST API consistency and compatibility | Expert |
| Security Analysis | Assess native app security patterns | Advanced |
| System Integration | Verify backward compatibility with existing waves | Expert |

