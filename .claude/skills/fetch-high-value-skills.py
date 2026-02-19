#!/usr/bin/env python3
"""
Fetch high-value agent skills that are missing from the collection.
Based on research from VoltAgent/awesome-agent-skills and travisvn/awesome-claude-skills.
"""

import urllib.request
import urllib.error
from pathlib import Path
import time

SKILLS_DIR = Path(__file__).parent
OK = 0
FAIL = 0

def get_skill(name, repo, path, branch="main"):
    """Fetch a skill from GitHub and save it."""
    global OK, FAIL
    out = SKILLS_DIR / f"{name}.md"
    
    if out.exists():
        print(f"  ✓ (exists) {name}")
        OK += 1
        return
    
    url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
    
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            content = response.read().decode('utf-8')
            out.write_text(content, encoding='utf-8')
            print(f"  ✓ {name}")
            OK += 1
            return
    except (urllib.error.URLError, urllib.error.HTTPError):
        pass
    
    # Try master branch
    url = f"https://raw.githubusercontent.com/{repo}/master/{path}"
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            content = response.read().decode('utf-8')
            out.write_text(content, encoding='utf-8')
            print(f"  ✓ {name}")
            OK += 1
    except (urllib.error.URLError, urllib.error.HTTPError):
        print(f"  ✗ {name} (failed to fetch)")
        FAIL += 1

print("=" * 60)
print("FETCHING HIGH-VALUE AGENT SKILLS")
print("=" * 60)

# Trail of Bits Security Skills (High Priority)
print("\n🔒 Trail of Bits Security Skills")
trailofbits_skills = [
    ("tob-audit-context", "trailofbits/skills", "plugins/audit-context-building/SKILL.md"),
    ("tob-differential-review", "trailofbits/skills", "plugins/differential-review/SKILL.md"),
    ("tob-static-analysis", "trailofbits/skills", "plugins/static-analysis/SKILL.md"),
    ("tob-sharp-edges", "trailofbits/skills", "plugins/sharp-edges/SKILL.md"),
    ("tob-modern-python", "trailofbits/skills", "plugins/modern-python/SKILL.md"),
    ("tob-property-testing", "trailofbits/skills", "plugins/property-based-testing/SKILL.md"),
    ("tob-fix-review", "trailofbits/skills", "plugins/fix-review/SKILL.md"),
    ("tob-semgrep-creator", "trailofbits/skills", "plugins/semgrep-rule-creator/SKILL.md"),
    ("tob-testing-handbook", "trailofbits/skills", "plugins/testing-handbook-skills/SKILL.md"),
    ("tob-variant-analysis", "trailofbits/skills", "plugins/variant-analysis/SKILL.md"),
]
for name, repo, path in trailofbits_skills:
    get_skill(name, repo, path)

# obra/superpowers Development Workflow
print("\n🚀 obra/superpowers Development Workflow")
superpowers_skills = [
    ("obra-tdd", "obra/superpowers", "skills/test-driven-development/SKILL.md"),
    ("obra-debugging", "obra/superpowers", "skills/systematic-debugging/SKILL.md"),
    ("obra-root-cause", "obra/superpowers", "skills/root-cause-tracing/SKILL.md"),
    ("obra-finish-branch", "obra/superpowers", "skills/finishing-a-development-branch/SKILL.md"),
    ("obra-request-review", "obra/superpowers", "skills/requesting-code-review/SKILL.md"),
    ("obra-receive-review", "obra/superpowers", "skills/receiving-code-review/SKILL.md"),
    ("obra-verify", "obra/superpowers", "skills/verification-before-completion/SKILL.md"),
    ("obra-brainstorm", "obra/superpowers", "skills/brainstorming/SKILL.md"),
    ("obra-writing-plans", "obra/superpowers", "skills/writing-plans/SKILL.md"),
    ("obra-executing-plans", "obra/superpowers", "skills/executing-plans/SKILL.md"),
    ("obra-git-worktrees", "obra/superpowers", "skills/using-git-worktrees/SKILL.md"),
]
for name, repo, path in superpowers_skills:
    get_skill(name, repo, path)

# Context Engineering (muratcankoylan)
print("\n🧠 Context Engineering Skills")
context_skills = [
    ("context-fundamentals", "muratcankoylan/context-fundamentals", "SKILL.md"),
    ("context-degradation", "muratcankoylan/context-degradation", "SKILL.md"),
    ("context-compression", "muratcankoylan/context-compression", "SKILL.md"),
    ("context-optimization", "muratcankoylan/context-optimization", "SKILL.md"),
    ("multi-agent-patterns", "muratcankoylan/multi-agent-patterns", "SKILL.md"),
    ("memory-systems", "muratcankoylan/memory-systems", "SKILL.md"),
    ("tool-design", "muratcankoylan/tool-design", "SKILL.md"),
    ("evaluation", "muratcankoylan/evaluation", "SKILL.md"),
]
for name, repo, path in context_skills:
    get_skill(name, repo, path)

# Vercel Frontend Skills
print("\n⚛️ Vercel Frontend Skills")
vercel_skills = [
    ("vercel-react-best", "vercel-labs/react-best-practices", "SKILL.md"),
    ("vercel-next-best", "vercel-labs/next-best-practices", "SKILL.md"),
    ("vercel-composition", "vercel-labs/composition-patterns", "SKILL.md"),
    ("vercel-next-cache", "vercel-labs/next-cache-components", "SKILL.md"),
    ("vercel-next-upgrade", "vercel-labs/next-upgrade", "SKILL.md"),
]
for name, repo, path in vercel_skills:
    get_skill(name, repo, path)

# Database Skills
print("\n🗄️ Database Skills")
db_skills = [
    ("neon-postgres", "neondatabase/using-neon", "SKILL.md"),
    ("supabase-postgres", "supabase/postgres-best-practices", "SKILL.md"),
    ("sanjay-postgres", "sanjay3290/postgres", "SKILL.md"),
]
for name, repo, path in db_skills:
    get_skill(name, repo, path)

# UI/UX Design Skills
print("\n🎨 UI/UX Design Skills")
design_skills = [
    ("ui-skills", "ibelick/ui-skills", "SKILL.md"),
    ("platform-design", "ehmo/platform-design-skills", "SKILL.md"),
    ("ui-ux-pro", "nextlevelbuilder/ui-ux-pro-max-skill", "SKILL.md"),
]
for name, repo, path in design_skills:
    get_skill(name, repo, path)

# Testing & QA
print("\n🧪 Testing & QA Skills")
testing_skills = [
    ("playwright-skill", "lackeyjb/playwright-skill", "SKILL.md"),
    ("ios-simulator", "conorluddy/ios-simulator-skill", "SKILL.md"),
]
for name, repo, path in testing_skills:
    get_skill(name, repo, path)

# OpenAI Curated Skills
print("\n🤖 OpenAI Curated Skills")
openai_skills = [
    ("openai-playwright", "openai/skills", "skills/playwright/SKILL.md"),
    ("openai-security-best", "openai/skills", "skills/security-best-practices/SKILL.md"),
    ("openai-security-threat", "openai/skills", "skills/security-threat-model/SKILL.md"),
    ("openai-gh-fix-ci", "openai/skills", "skills/gh-fix-ci/SKILL.md"),
    ("openai-gh-comments", "openai/skills", "skills/gh-address-comments/SKILL.md"),
    ("openai-notion-knowledge", "openai/skills", "skills/notion-knowledge-capture/SKILL.md"),
    ("openai-notion-meeting", "openai/skills", "skills/notion-meeting-intelligence/SKILL.md"),
    ("openai-notion-research", "openai/skills", "skills/notion-research-documentation/SKILL.md"),
]
for name, repo, path in openai_skills:
    get_skill(name, repo, path)

# n8n Automation
print("\n🔄 n8n Automation Skills")
n8n_skills = [
    ("n8n-javascript", "czlonkowski/n8n-code-javascript", "SKILL.md"),
    ("n8n-python", "czlonkowski/n8n-code-python", "SKILL.md"),
    ("n8n-expressions", "czlonkowski/n8n-expression-syntax", "SKILL.md"),
    ("n8n-mcp-tools", "czlonkowski/n8n-mcp-tools-expert", "SKILL.md"),
    ("n8n-workflows", "czlonkowski/n8n-workflow-patterns", "SKILL.md"),
]
for name, repo, path in n8n_skills:
    get_skill(name, repo, path)

# Productivity & Project Management
print("\n📋 Productivity & Project Management")
productivity_skills = [
    ("linear-skill", "wrsmith108/linear-claude-skill", "SKILL.md"),
    ("readme-gen", "Shpigford/readme", "SKILL.md"),
    ("screenshots", "Shpigford/screenshots", "SKILL.md"),
    ("changelog-gen", "ComposioHQ/changelog-generator", "SKILL.md"),
]
for name, repo, path in productivity_skills:
    get_skill(name, repo, path)

# SEO & Marketing
print("\n📈 SEO & Marketing Skills")
marketing_skills = [
    ("claude-seo", "AgriciDaniel/claude-seo", "SKILL.md"),
    ("email-marketing", "CosmoBlk/email-marketing-bible", "SKILL.md"),
]
for name, repo, path in marketing_skills:
    get_skill(name, repo, path)

# Infrastructure & DevOps
print("\n☁️ Infrastructure & DevOps")
infra_skills = [
    ("terraform-skill", "antonbabenko/terraform-skill", "SKILL.md"),
    ("aws-skills", "zxkane/aws-skills", "SKILL.md"),
]
for name, repo, path in infra_skills:
    get_skill(name, repo, path)

# Specialized Domain Skills
print("\n🔬 Specialized Domain Skills")
specialized_skills = [
    ("scientific-skills", "K-Dense-AI/claude-scientific-skills", "SKILL.md"),
    ("rails-upgrade", "robzolkos/skill-rails-upgrade", "SKILL.md"),
    ("swift-patterns", "efremidze/swift-patterns-skill", "SKILL.md"),
    ("swiftui-expert", "AvdLee/swiftui-expert-skill", "SKILL.md"),
]
for name, repo, path in specialized_skills:
    get_skill(name, repo, path)

# Community Productivity
print("\n🛠️ Community Productivity Tools")
community_skills = [
    ("nutrient-docs", "PSPDFKit-labs/nutrient-agent-skill", "SKILL.md"),
    ("varlock-secrets", "wrsmith108/varlock-claude-skill", "SKILL.md"),
    ("beautiful-prose", "SHADOWPR0/beautiful_prose", "SKILL.md"),
]
for name, repo, path in community_skills:
    get_skill(name, repo, path)

print("\n" + "=" * 60)
print(f"✅ Successfully fetched: {OK}")
print(f"❌ Failed to fetch: {FAIL}")
print(f"📦 Total skills in directory: {len(list(SKILLS_DIR.glob('*.md')))}")
print("=" * 60)

