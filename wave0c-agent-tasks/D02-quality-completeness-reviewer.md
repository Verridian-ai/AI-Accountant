# Agent D02: Quality & Completeness Reviewer

## Role

Verify ALL 6 wave plans are COMPLETE — every table, endpoint, component, agent, and test is accounted for. Check quality of writing, consistency of format, adherence to templates, security review, and accessibility standards.

## Phase: C (Debate — After W01 completes, Parallel with D01)

## Prerequisites

Wait for `.agent-done-0C-W01` then read ALL generated wave files for Waves 25-30.

## Review Focus Areas

### 1. 10-Point Spec Completeness

For EACH of Waves 25-30, verify ALL 10 spec points are present:

- [ ] Dependencies & estimated complexity
- [ ] Agent team composition (exactly 10 agents per wave)
- [ ] Database schema changes (BOTH SQLite AND PostgreSQL where applicable)
- [ ] API endpoints (method, path, description)
- [ ] UI components (file paths, component names)
- [ ] Cognee integration (datasets, queries) where applicable
- [ ] Testing criteria (specific assertions, not vague)
- [ ] Performance benchmarks (measurable targets)
- [ ] Accessibility standards (WCAG 2.1 AA compliance criteria)
- [ ] Coordination rules (sub-wave execution order)

### 2. Template Adherence

- [ ] Do ALL orchestration prompts follow `wave11-orchestration-prompt.md` structure?
- [ ] Do ALL agent task files follow `wave11-agent-tasks/01-*.md` structure?
- [ ] Do ALL launch scripts follow `launch-wave11.sh` structure?
- [ ] Are section headings consistent across all 6 waves?
- [ ] Are table formats consistent?
- [ ] Are completion markers correctly formatted (`.agent-done-W{N}-{XX}`)?

### 3. Quality of Instructions

- [ ] Are agent task instructions specific enough to implement? (file paths, not vague descriptions)
- [ ] Are testing criteria measurable? ("tsc --noEmit passes" not "code works")
- [ ] Are sub-wave execution orders logical?
- [ ] Do agent tasks reference correct existing file paths from the codebase?
- [ ] Are code examples provided where complex patterns are needed?

### 4. Security Review

- [ ] Wave 25: Does theme toggle prevent XSS via CSS injection?
- [ ] Wave 28-29: Is biometric auth implemented securely (no fallback to plain password)?
- [ ] Wave 28-29: Is offline data encrypted at rest on mobile devices?
- [ ] Wave 28-29: Are API tokens stored in secure storage (Keychain/Keystore), not AsyncStorage?
- [ ] Wave 30: Is Tauri IPC properly sandboxed? Are permissions minimal?
- [ ] Wave 30: Is the auto-updater using HTTPS with certificate pinning?

### 5. Accessibility Standards

- [ ] Wave 25: Do BOTH themes meet WCAG 2.1 AA contrast ratios (4.5:1 for text, 3:1 for large text)?
- [ ] Wave 26: Are aria-label, role, and tabIndex requirements specified for every interactive component?
- [ ] Wave 27: Do animations respect `prefers-reduced-motion` media query?
- [ ] Wave 28-29: Are mobile accessibility features specified (VoiceOver, TalkBack)?
- [ ] Wave 30: Are Windows accessibility features specified (Narrator, high contrast mode)?

### 6. Missing Elements Check

- [ ] Are there any tables mentioned in specs but missing from plans?
- [ ] Are there any endpoints mentioned but not assigned to an agent?
- [ ] Are there any UI components mentioned but not in any task file?
- [ ] Are error handling patterns specified for each wave?
- [ ] Are loading states and empty states specified for UI components?
- [ ] Are migration file paths correctly numbered (continuing from existing migrations)?

### 7. Cross-Wave Consistency

- [ ] Does Wave 29 correctly reference Wave 28's shared codebase?
- [ ] Does Wave 30 correctly reference the existing React frontend?
- [ ] Are shared packages (`packages/shared/`) consistently referenced across Waves 28-30?
- [ ] Is the dependency chain (25→26→27→28→29, 25+26→30) correctly reflected in all launch scripts?

## Output Format

Write review to `wave0c-reviews/D02-completeness-review.md` with:

1. **Completeness Matrix** — 6×10 grid (waves × spec points) with ✅/❌
2. **Missing Elements** — Specific items not found in plans (severity: HIGH)
3. **Quality Issues** — Vague or insufficient instructions (severity: MEDIUM)
4. **Template Deviations** — Format inconsistencies (severity: LOW)
5. **Security Findings** — Per-wave security assessment
6. **Accessibility Findings** — Per-wave a11y assessment
7. **Per-Wave Quality Verdict** — COMPLETE / INCOMPLETE for each wave

## Completion

- [ ] All 6 wave plans completeness-verified
- [ ] Create marker file: `.agent-done-0C-D02`

## Skills Manifest

| Skill | Description | Proficiency |
|-------|-------------|-------------|
| Quality Assurance | Systematic completeness verification | Expert |
| Template Compliance | Format and structure validation | Expert |
| Security Review | Native app and web security assessment | Advanced |
| Accessibility Audit | WCAG 2.1 AA compliance verification | Advanced |
| Technical Writing Review | Clarity and specificity assessment | Expert |

