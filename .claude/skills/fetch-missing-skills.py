#!/usr/bin/env python3
"""
Fetch missing high-value skills with multiple path pattern attempts.
"""

import urllib.request
import urllib.error
from pathlib import Path

SKILLS_DIR = Path(__file__).parent
OK = 0
FAIL = 0

def try_fetch(url, timeout=10):
    """Try to fetch from a URL."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.read().decode('utf-8')
    except (urllib.error.URLError, urllib.error.HTTPError):
        return None

def get_skill_multi_path(name, repo, possible_paths):
    """Try multiple possible paths for a skill."""
    global OK, FAIL
    out = SKILLS_DIR / f"{name}.md"
    
    if out.exists():
        print(f"  ✓ (exists) {name}")
        OK += 1
        return
    
    # Try all possible paths with both main and master branches
    for path in possible_paths:
        for branch in ["main", "master"]:
            url = f"https://raw.githubusercontent.com/{repo}/{branch}/{path}"
            content = try_fetch(url)
            if content:
                out.write_text(content, encoding='utf-8')
                print(f"  ✓ {name}")
                OK += 1
                return
    
    print(f"  ✗ {name} (failed to fetch)")
    FAIL += 1

print("=" * 60)
print("FETCHING MISSING HIGH-VALUE SKILLS")
print("=" * 60)

# Trail of Bits - try multiple path patterns
print("\n🔒 Trail of Bits Security Skills")
tob_skills = [
    ("tob-audit-context", "trailofbits/skills", ["audit-context-building/SKILL.md", "plugins/audit-context-building/SKILL.md", "SKILL.md"]),
    ("tob-differential-review", "trailofbits/skills", ["differential-review/SKILL.md", "plugins/differential-review/SKILL.md"]),
    ("tob-static-analysis", "trailofbits/skills", ["static-analysis/SKILL.md", "plugins/static-analysis/SKILL.md"]),
    ("tob-sharp-edges", "trailofbits/skills", ["sharp-edges/SKILL.md", "plugins/sharp-edges/SKILL.md"]),
    ("tob-modern-python", "trailofbits/skills", ["modern-python/SKILL.md", "plugins/modern-python/SKILL.md"]),
    ("tob-property-testing", "trailofbits/skills", ["property-based-testing/SKILL.md", "plugins/property-based-testing/SKILL.md"]),
    ("tob-semgrep-creator", "trailofbits/skills", ["semgrep-rule-creator/SKILL.md", "plugins/semgrep-rule-creator/SKILL.md"]),
    ("tob-variant-analysis", "trailofbits/skills", ["variant-analysis/SKILL.md", "plugins/variant-analysis/SKILL.md"]),
]
for name, repo, paths in tob_skills:
    get_skill_multi_path(name, repo, paths)

# Context Engineering - individual repos
print("\n🧠 Context Engineering Skills")
context_skills = [
    ("context-fundamentals", "muratcankoylan/context-fundamentals", ["SKILL.md", "skill.md", "README.md"]),
    ("context-degradation", "muratcankoylan/context-degradation", ["SKILL.md", "skill.md", "README.md"]),
    ("context-compression", "muratcankoylan/context-compression", ["SKILL.md", "skill.md", "README.md"]),
    ("context-optimization", "muratcankoylan/context-optimization", ["SKILL.md", "skill.md", "README.md"]),
    ("multi-agent-patterns", "muratcankoylan/multi-agent-patterns", ["SKILL.md", "skill.md", "README.md"]),
    ("memory-systems", "muratcankoylan/memory-systems", ["SKILL.md", "skill.md", "README.md"]),
    ("tool-design", "muratcankoylan/tool-design", ["SKILL.md", "skill.md", "README.md"]),
    ("evaluation", "muratcankoylan/evaluation", ["SKILL.md", "skill.md", "README.md"]),
]
for name, repo, paths in context_skills:
    get_skill_multi_path(name, repo, paths)

# Vercel Labs
print("\n⚛️ Vercel Frontend Skills")
vercel_skills = [
    ("vercel-react-best", "vercel-labs/react-best-practices", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("vercel-next-best", "vercel-labs/next-best-practices", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("vercel-composition", "vercel-labs/composition-patterns", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
]
for name, repo, paths in vercel_skills:
    get_skill_multi_path(name, repo, paths)

# UI/UX Design
print("\n🎨 UI/UX Design Skills")
design_skills = [
    ("ui-skills", "ibelick/ui-skills", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("platform-design", "ehmo/platform-design-skills", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
]
for name, repo, paths in design_skills:
    get_skill_multi_path(name, repo, paths)

# Testing
print("\n🧪 Testing & QA Skills")
testing_skills = [
    ("playwright-skill", "lackeyjb/playwright-skill", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("ios-simulator", "conorluddy/ios-simulator-skill", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
]
for name, repo, paths in testing_skills:
    get_skill_multi_path(name, repo, paths)

# n8n Automation
print("\n🔄 n8n Automation Skills")
n8n_skills = [
    ("n8n-javascript", "czlonkowski/n8n-code-javascript", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("n8n-python", "czlonkowski/n8n-code-python", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("n8n-expressions", "czlonkowski/n8n-expression-syntax", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("n8n-mcp-tools", "czlonkowski/n8n-mcp-tools-expert", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
    ("n8n-workflows", "czlonkowski/n8n-workflow-patterns", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
]
for name, repo, paths in n8n_skills:
    get_skill_multi_path(name, repo, paths)

# SEO & Marketing
print("\n📈 SEO & Marketing Skills")
marketing_skills = [
    ("claude-seo", "AgriciDaniel/claude-seo", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md"]),
]
for name, repo, paths in marketing_skills:
    get_skill_multi_path(name, repo, paths)

# Infrastructure
print("\n☁️ Infrastructure & DevOps")
infra_skills = [
    ("aws-skills", "zxkane/aws-skills", ["SKILL.md", "skill.md", ".claude/skills/SKILL.md", "skills/SKILL.md"]),
]
for name, repo, paths in infra_skills:
    get_skill_multi_path(name, repo, paths)

print("\n" + "=" * 60)
print(f"✅ Successfully fetched: {OK}")
print(f"❌ Failed to fetch: {FAIL}")
print(f"📦 Total skills in directory: {len(list(SKILLS_DIR.glob('*.md')))}")
print("=" * 60)

