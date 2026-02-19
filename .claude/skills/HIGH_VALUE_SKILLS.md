# High-Value Agent Skills to Fetch

## ✅ FETCH COMPLETE - 249 Total Skills

**Successfully fetched 22 new high-value skills** from verified repositories:
- ✅ **10 Context Engineering skills** (muratcankoylan/Agent-Skills-for-Context-Engineering)
- ✅ **8 Trail of Bits security skills** (trailofbits/skills)
- ✅ **4 Vercel frontend skills** (vercel-labs/agent-skills)

**Total skills in `.claude/skills/`: 249**

---

Based on research from GitHub's top skill repositories (Feb 2026), here are the most valuable skills to add to your collection.

## 🔥 Top Priority Skills (Fetch These First)

### Security & Code Quality (Trail of Bits)
- **audit-context-building** - Deep architectural context via ultra-granular code analysis
- **differential-review** - Security-focused diff review with git history analysis
- **static-analysis** - Static analysis toolkit with CodeQL, Semgrep, and SARIF
- **sharp-edges** - Identify error-prone APIs and dangerous configurations
- **modern-python** - Modern Python tooling with uv, ruff, ty, and pytest best practices
- **property-based-testing** - Property-based testing for multiple languages and smart contracts

### Development Workflow (obra/superpowers)
- **test-driven-development** - Write tests before implementing code
- **systematic-debugging** - Methodical problem-solving in code
- **root-cause-tracing** - Investigate and identify fundamental problems
- **finishing-a-development-branch** - Complete Git code branches
- **requesting-code-review** - Initiate code review processes
- **receiving-code-review** - Process and incorporate code feedback
- **verification-before-completion** - Validate work before finalizing

### Context Engineering (muratcankoylan)
- **context-fundamentals** - Understand context anatomy in agent systems
- **context-degradation** - Recognize patterns of context failure
- **context-compression** - Design compression strategies for long sessions
- **context-optimization** - Apply compaction, masking, and caching strategies
- **multi-agent-patterns** - Master orchestrator, peer-to-peer, and hierarchical architectures
- **memory-systems** - Design short-term, long-term, and graph-based memory
- **tool-design** - Build tools that agents can use effectively
- **evaluation** - Build evaluation frameworks for agent systems

## 💎 High-Value Specialized Skills

### Database & Backend
- **neon-postgres** (neondatabase) - Neon Serverless Postgres best practices
- **postgres** (sanjay3290) - Execute safe read-only SQL queries
- **azure-cosmos-ts/py/java/rust** (microsoft) - Cosmos DB NoSQL with global distribution

### Frontend & UI
- **react-best-practices** (vercel-labs) - React best practices and patterns
- **next-best-practices** (vercel-labs) - Next.js recommended patterns
- **composition-patterns** (vercel-labs) - React component composition
- **frontend-ui-dark-ts** (microsoft) - Dark-themed React with Tailwind
- **ui-skills** (ibelick) - Opinionated UI/UX design patterns
- **platform-design-skills** (ehmo) - 300+ design rules from Apple HIG, Material Design 3, WCAG 2.2

### AI & ML
- **AI-research-SKILLs** (zechenzhangAGI) - 77 AI research skills for model training, inference, MLOps
- **agent-framework-azure-ai-py** (microsoft) - Agent Framework for Azure AI Foundry
- **hugging-face-*** (huggingface) - HF Hub CLI, datasets, evaluation, model training

### Cloud & Infrastructure
- **cloudflare-*** (cloudflare) - Workers, Durable Objects, AI agents, MCP servers
- **terraform-*** (hashicorp) - Terraform code generation, modules, providers
- **aws-skills** (zxkane) - AWS development with infrastructure automation

### Documentation & Content
- **doc-coauthoring** (anthropics) - Collaborative document editing
- **docx/pdf/pptx/xlsx** (anthropics) - Document manipulation
- **seo-aeo-best-practices** (sanity-io) - SEO and answer engine optimization

## 🎯 Productivity & Automation

### n8n Workflow Automation
- **n8n-code-javascript** - JavaScript in n8n Code nodes
- **n8n-code-python** - Python coding in n8n Code nodes
- **n8n-expression-syntax** - n8n expression syntax
- **n8n-mcp-tools-expert** - MCP tools guide
- **n8n-workflow-patterns** - Workflow patterns for webhook, HTTP, database, AI

### Project Management
- **linear-claude-skill** (wrsmith108) - Manage Linear issues, projects, teams
- **github** (callstackincubator) - GitHub workflow patterns for PRs, code review
- **notion-*** (openai) - Notion knowledge capture, meeting intelligence, research

### Marketing & SEO
- **claude-seo** (AgriciDaniel) - Universal SEO skill for website analysis
- **email-marketing-bible** (CosmoBlk) - 55K-word email marketing guide
- **marketingskills** (coreyhaines31) - 23+ marketing skills for SEO, copywriting, email, ads

## 🛠️ Developer Tools

### Testing & QA
- **playwright** (openai/lackeyjb) - Browser automation
- **webapp-testing** (anthropics) - Test local web apps using Playwright
- **testing-handbook-skills** (trailofbits) - Fuzzers, static analysis, sanitizers

### Build & Deploy
- **vercel-deploy** (openai) - Deploy to Vercel
- **cloudflare-deploy** (openai) - Deploy to Cloudflare
- **netlify-deploy** (openai) - Deploy to Netlify
- **render-deploy** (openai) - Deploy to Render

### Code Review & Quality
- **code-review** (getsentry) - Perform code reviews
- **find-bugs** (getsentry) - Find and identify bugs
- **commit** (sentry) - Create commits with best practices

## 📦 How to Fetch These Skills

The Python script `fetch-remaining-skills.py` already includes most of these.
For additional skills not in the script, you can manually fetch them:

```bash
# Example: Fetch a specific skill
curl -o .claude/skills/skill-name.md \
  https://raw.githubusercontent.com/org/repo/main/path/to/SKILL.md
```

## 🔗 Key Repositories

1. **VoltAgent/awesome-agent-skills** - 380+ skills, most comprehensive collection
2. **travisvn/awesome-claude-skills** - Curated list with quality focus
3. **anthropics/skills** - Official Anthropic skills
4. **obra/superpowers** - 20+ battle-tested development workflow skills
5. **trailofbits/skills** - Security-focused skills from security experts
6. **microsoft/skills** - Azure SDK and platform-specific skills (TS/Python/.NET/Java/Rust)

## 💡 Selection Criteria

Skills were selected based on:
- **Proven usage** - Published by reputable dev teams or widely adopted
- **Practical value** - Solves real-world problems
- **Quality** - Well-documented, maintained, tested
- **Relevance** - Applicable to GoldLedger's tech stack (TypeScript, React, PostgreSQL, AI)

## 🎓 Next Steps

1. Run `python .claude/skills/fetch-remaining-skills.py` to get the base collection
2. Review the fetched skills in `.claude/skills/`
3. Test high-priority skills relevant to your current work
4. Create custom skills for GoldLedger-specific workflows

