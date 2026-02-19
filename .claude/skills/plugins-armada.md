# Skill: Plugin Armada — Complete Reference for All 40+ Enabled Plugins

> Every agent has access to all of these. Know what each does and when to use it.
> Plugins extend Claude Code with slash commands, LSP intelligence, and specialist workflows.

---

## HOW PLUGINS WORK

Plugins add slash commands and capabilities to every Claude Code session.
- Invoke with `/plugin-command [args]`
- Some provide LSP (Language Server Protocol) intelligence automatically
- Some provide specialist knowledge injected into context
- All are enabled in `.claude/settings.json` → `enabledPlugins`

---

## CORE WORKFLOW PLUGINS

### superpowers@claude-plugins-official
The most powerful planning + execution plugin.
```
/write-plan [task description]
  → Creates detailed step-by-step implementation plan
  → Breaks complex tasks into atomic steps
  → Use BEFORE starting any multi-step implementation

/execute-plan
  → Executes the plan created by /write-plan in batches
  → Tracks progress, handles errors, continues autonomously

/batch [commands]
  → Run multiple operations in sequence
```
**When to use**: Any task with >3 steps. Always plan before executing.

### everything-claude-code@everything-claude-code
Master reference for all Claude Code capabilities.
```
/plan [task]
  → Creates plan with risk analysis, waits for approval
  → More conservative than /write-plan — good for risky changes

/orchestrate [workflow]
  → Sequential agent workflow coordination
  → Use for multi-phase tasks

/checkpoint
  → Save current state and progress

/review
  → Review all changes made in current session
```

### ralph-loop@claude-plugins-official
Iterative development loop — build → test → fix → repeat.
```
/ralph-loop [task]
  → Starts iterative loop: implement → verify → fix → repeat
  → Continues until all tests pass or task complete
  → Best for: bug fixes, feature implementation with tests

/ralph-status
  → Check current loop iteration status
```
**When to use**: Any fix that requires test-verify-fix cycles.

### feature-dev@claude-plugins-official
Guided feature development from spec to implementation.
```
/feature-dev [feature description]
  → Full feature development workflow:
    1. Spec clarification
    2. Architecture planning
    3. Implementation
    4. Testing
    5. Documentation
```

---

## CODE QUALITY & REVIEW PLUGINS

### code-review@claude-plugins-official
Comprehensive code review with actionable feedback.
```
/code-review [file or diff]
  → Security vulnerabilities
  → Performance issues
  → Code style violations
  → Logic errors
  → Suggests specific fixes
```

### code-simplifier@claude-plugins-official
Reduce complexity, improve readability.
```
/simplify [code or file]
  → Identifies over-engineered patterns
  → Suggests simpler alternatives
  → Reduces cognitive load
  → Preserves behavior
```

### coderabbit@claude-plugins-official
AI-powered PR review assistant.
```
/coderabbit-review
  → Reviews staged changes like a senior engineer
  → Checks for: bugs, security, performance, style
  → Generates review comments

/coderabbit-summary
  → Summarizes what changed and why
```

### semgrep@claude-plugins-official
Static analysis and security scanning.
```
/semgrep [path]
  → Runs semgrep rules against codebase
  → Finds: SQL injection, XSS, hardcoded secrets, insecure patterns
  → Language-aware pattern matching
```

### sonatype-guide@claude-plugins-official
Dependency security and vulnerability guidance.
```
/sonatype-check [package]
  → Check package for known vulnerabilities
  → License compliance
  → Dependency health score
```

### pr-review-toolkit@claude-plugins-official
Full PR review workflow.
```
/pr-review
  → Full pull request review
  → Checks diff, tests, docs, breaking changes

/pr-summary
  → Generate PR description from changes
```

### qodo-skills@claude-plugins-official
Test generation and quality assurance.
```
/qodo-test [function or file]
  → Generates comprehensive test cases
  → Edge cases, happy path, error cases
  → Supports Jest, Vitest, pytest, etc.

/qodo-coverage
  → Analyze test coverage gaps
```

---

## LANGUAGE SERVER PROTOCOL (LSP) PLUGINS
These provide real-time language intelligence — type checking, autocomplete, go-to-definition.

### typescript-lsp@claude-plugins-official
Full TypeScript/JavaScript intelligence.
- Real-time type checking
- Hover types, go-to-definition
- Rename symbol across project
- Find all references
- Auto-imports

### pyright-lsp@claude-plugins-official
Python type checking (Pyright).
- Type inference and checking
- Import resolution
- Stub support

### gopls-lsp@claude-plugins-official
Go language server.
- Go type checking, formatting
- Module-aware completions

### rust-analyzer-lsp@claude-plugins-official
Rust language server.
- Borrow checker awareness
- Macro expansion
- Trait implementation hints

### php-lsp@claude-plugins-official
PHP language server.
- Type inference, completion
- Laravel/Symfony aware

### jdtls-lsp@claude-plugins-official
Java language server (Eclipse JDT).
- Full Java intelligence
- Maven/Gradle aware

### clangd-lsp@claude-plugins-official
C/C++ language server.
- Clang-based analysis
- Cross-platform

### swift-lsp@claude-plugins-official
Swift language server.
- iOS/macOS development
- SwiftUI aware

### lua-lsp@claude-plugins-official
Lua language server.
- Neovim plugin development
- Game scripting (Love2D, etc.)

### csharp-lsp@claude-plugins-official
C# language server (OmniSharp).
- .NET/ASP.NET Core
- Unity game development

### kotlin-lsp@claude-plugins-official
Kotlin language server.
- Android development
- Kotlin Multiplatform

---

## SPECIALIST KNOWLEDGE PLUGINS

### context7@claude-plugins-official
Fetches up-to-date library documentation.
```
/context7 [library@version] [topic]
  → Pulls current docs for any library
  → Avoids hallucinated APIs
  → Examples: /context7 react@19 hooks
             /context7 drizzle-orm relations
             /context7 hono middleware
```
**Critical**: Use this before implementing anything with a library you're unsure about.

### security-guidance@claude-plugins-official
Security best practices and vulnerability guidance.
```
/security-review [code or area]
  → OWASP Top 10 checks
  → Auth/authz patterns
  → Input validation
  → Secrets management
  → SQL injection, XSS, CSRF

/security-guide [topic]
  → JWT security best practices
  → OAuth 2.0 flows
  → Rate limiting patterns
```

### huggingface-skills@claude-plugins-official
ML/AI model integration skills.
```
/hf-model [task]
  → Find best HuggingFace model for task
  → Integration code examples
  → Inference API usage

/hf-pipeline [type]
  → Text classification, NER, summarization
  → Image classification, object detection
  → Audio transcription
```

### laravel-boost@claude-plugins-official
Laravel PHP framework specialist.
```
/laravel [topic]
  → Eloquent ORM patterns
  → Blade templates
  → Artisan commands
  → Queue/jobs
  → API resources
```

### vercel@claude-plugins-official
Vercel deployment and Edge Runtime.
```
/vercel-deploy
  → Deployment configuration
  → Edge functions
  → ISR/SSR/SSG strategies
  → Environment variables

/vercel-edge [function]
  → Edge Runtime constraints
  → Middleware patterns
```

---

## DEVELOPMENT WORKFLOW PLUGINS

### commit-commands@claude-plugins-official
Smart git commit workflow.
```
/commit [message?]
  → Stages all changes
  → Generates conventional commit message from diff
  → Runs pre-commit hooks
  → Commits with proper format

/commit-amend
  → Amend last commit

/commit-history
  → Summarize recent commits
```

### hookify@claude-plugins-official
Git hooks management.
```
/hookify-add [hook-type] [command]
  → Add pre-commit, post-commit, pre-push hooks
  → Manage hook scripts

/hookify-list
  → Show all active hooks
```

### playwright@claude-plugins-official
Browser automation and E2E testing.
```
/playwright-test [scenario]
  → Generate Playwright test for UI scenario
  → Page object model patterns
  → Screenshot/video capture

/playwright-record
  → Record browser interactions as test
```

### firecrawl@claude-plugins-official
Web scraping and content extraction.
```
/firecrawl [url]
  → Scrape and extract structured content from URL
  → Convert to markdown
  → Extract specific data points

/firecrawl-search [query]
  → Search and extract from multiple pages
```
**Use for**: Research agents gathering internet knowledge.

---

## AI & AGENT PLUGINS

### agent-sdk-dev@claude-plugins-official
Claude Agent SDK development patterns.
```
/agent-sdk [task]
  → Build Claude agents with tools
  → MCP server integration
  → Multi-agent orchestration patterns
  → Session management
```

### cognee-expert@cognee-expert
Cognee knowledge graph specialist (local plugin).
```
/cognee [topic]
  → Expert guidance on Cognee configuration
  → DataPoint model design
  → Pipeline customization
  → Search optimization
  → Ontology design
```
**Source**: `C:\Users\Danie\Desktop\cognee-expert`

---

## OUTPUT & STYLE PLUGINS

### explanatory-output-style@claude-plugins-official
Structured, educational output format.
- Adds explanations to code changes
- Documents WHY not just WHAT
- Good for: complex refactors, teaching moments

### learning-output-style@claude-plugins-official
Learning-focused output with examples.
- Step-by-step breakdowns
- Multiple examples per concept
- Good for: onboarding, documentation

---

## DOCUMENTATION & MANAGEMENT PLUGINS

### claude-md-management@claude-plugins-official
CLAUDE.md file management.
```
/claude-md-update [section]
  → Update CLAUDE.md with new rules/context
  → Add project-specific knowledge

/claude-md-review
  → Review and optimize CLAUDE.md
```

### claude-code-setup@claude-plugins-official
Project setup and configuration.
```
/setup [project-type]
  → Initialize project structure
  → Configure linting, formatting, testing
  → Set up CI/CD

/setup-review
  → Audit current project setup
```

### skill-creator@claude-plugins-official
Create new skill files.
```
/create-skill [topic]
  → Research and create a new skill file
  → Saves to .claude/skills/
  → Structured format with examples
```
**Use this**: When agents discover knowledge worth preserving as a skill.

### serena@claude-plugins-official
Semantic code search and navigation.
```
/serena-search [query]
  → Semantic search across codebase
  → Find by intent, not just text
  → Cross-file relationship understanding
```

### greptile@claude-plugins-official (if available)
AI-powered codebase Q&A.
```
/greptile [question]
  → Ask questions about the codebase
  → Understands entire repo context
```

---

## PLUGIN SELECTION GUIDE

| Task | Best Plugin(s) |
|------|---------------|
| Plan complex task | `/write-plan` (superpowers) |
| Execute plan | `/execute-plan` (superpowers) |
| Fix bug iteratively | `/ralph-loop` |
| New feature | `/feature-dev` |
| Code review | `/code-review`, `/coderabbit-review` |
| Security audit | `/security-review`, `/semgrep` |
| Generate tests | `/qodo-test` |
| Library docs | `/context7 [lib]` |
| Scrape internet | `/firecrawl [url]` |
| Git commit | `/commit` |
| E2E test | `/playwright-test` |
| ML/AI models | `/hf-model` |
| TypeScript types | typescript-lsp (automatic) |
| Python types | pyright-lsp (automatic) |
| Create new skill | `/create-skill` |
| Cognee questions | `/cognee` |
| Deploy to Vercel | `/vercel-deploy` |

---

## COMBINING PLUGINS FOR MAXIMUM POWER

### Research → Implement → Test → Commit
```
1. /firecrawl [relevant URL]        # gather internet knowledge
2. /context7 [library] [topic]      # get current library docs
3. /write-plan [implementation]     # plan the work
4. /execute-plan                    # implement
5. /qodo-test [new code]            # generate tests
6. /ralph-loop                      # test-fix loop
7. /code-review                     # final review
8. /commit                          # commit with good message
```

### Audit → Fix → Verify
```
1. /semgrep [path]                  # static analysis
2. /security-review [area]          # security check
3. /code-review [files]             # quality review
4. /write-plan [fixes needed]       # plan fixes
5. /execute-plan                    # fix
6. /commit                          # commit
```
