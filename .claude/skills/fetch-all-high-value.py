#!/usr/bin/env python3
"""
Fetch ALL high-value agent skills with correct repository paths.
Based on actual GitHub repository structures.
"""

import urllib.request
import urllib.error
from pathlib import Path

SKILLS_DIR = Path(__file__).parent
OK = 0
FAIL = 0

def fetch_skill(name, url):
    """Fetch a skill from a direct URL."""
    global OK, FAIL
    out = SKILLS_DIR / f"{name}.md"
    
    if out.exists():
        print(f"  ✓ (exists) {name}")
        OK += 1
        return
    
    try:
        with urllib.request.urlopen(url, timeout=15) as response:
            content = response.read().decode('utf-8')
            out.write_text(content, encoding='utf-8')
            print(f"  ✓ {name}")
            OK += 1
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  ✗ {name} ({e})")
        FAIL += 1

print("=" * 70)
print("FETCHING ALL HIGH-VALUE AGENT SKILLS")
print("=" * 70)

# Trail of Bits Security Skills
# Structure: plugins/{plugin-name}/skills/{skill-name}/SKILL.md
print("\n🔒 Trail of Bits Security Skills (trailofbits/skills)")
tob_base = "https://raw.githubusercontent.com/trailofbits/skills/main/plugins"
tob_skills = [
    ("tob-audit-context", f"{tob_base}/audit-context-building/skills/audit-context-building/SKILL.md"),
    ("tob-differential-review", f"{tob_base}/differential-review/skills/differential-review/SKILL.md"),
    ("tob-static-analysis", f"{tob_base}/static-analysis/skills/static-analysis/SKILL.md"),
    ("tob-sharp-edges", f"{tob_base}/sharp-edges/skills/sharp-edges/SKILL.md"),
    ("tob-modern-python", f"{tob_base}/modern-python/skills/modern-python/SKILL.md"),
    ("tob-property-testing", f"{tob_base}/property-based-testing/skills/property-based-testing/SKILL.md"),
    ("tob-semgrep-creator", f"{tob_base}/semgrep-rule-creator/skills/semgrep-rule-creator/SKILL.md"),
    ("tob-variant-analysis", f"{tob_base}/variant-analysis/skills/variant-analysis/SKILL.md"),
    ("tob-testing-handbook", f"{tob_base}/testing-handbook-skills/skills/testing-handbook-skills/SKILL.md"),
    ("tob-insecure-defaults", f"{tob_base}/insecure-defaults/skills/insecure-defaults/SKILL.md"),
]
for name, url in tob_skills:
    fetch_skill(name, url)

# Context Engineering Skills
print("\n🧠 Context Engineering (muratcankoylan/Agent-Skills-for-Context-Engineering)")
ctx_base = "https://raw.githubusercontent.com/muratcankoylan/Agent-Skills-for-Context-Engineering/main/skills"
ctx_skills = [
    ("context-fundamentals", f"{ctx_base}/context-fundamentals/SKILL.md"),
    ("context-degradation", f"{ctx_base}/context-degradation/SKILL.md"),
    ("context-compression", f"{ctx_base}/context-compression/SKILL.md"),
    ("context-optimization", f"{ctx_base}/context-optimization/SKILL.md"),
    ("multi-agent-patterns", f"{ctx_base}/multi-agent-patterns/SKILL.md"),
    ("memory-systems", f"{ctx_base}/memory-systems/SKILL.md"),
    ("tool-design", f"{ctx_base}/tool-design/SKILL.md"),
    ("evaluation", f"{ctx_base}/evaluation/SKILL.md"),
    ("advanced-evaluation", f"{ctx_base}/advanced-evaluation/SKILL.md"),
    ("project-development", f"{ctx_base}/project-development/SKILL.md"),
]
for name, url in ctx_skills:
    fetch_skill(name, url)

# Vercel Frontend Skills
print("\n⚛️ Vercel Frontend (vercel-labs/agent-skills)")
vercel_base = "https://raw.githubusercontent.com/vercel-labs/agent-skills/main/skills"
vercel_skills = [
    ("vercel-react-best", f"{vercel_base}/react-best-practices/SKILL.md"),
    ("vercel-web-design", f"{vercel_base}/web-design-guidelines/SKILL.md"),
    ("vercel-react-native", f"{vercel_base}/react-native-guidelines/SKILL.md"),
    ("vercel-composition", f"{vercel_base}/composition-patterns/SKILL.md"),
]
for name, url in vercel_skills:
    fetch_skill(name, url)

# obra/superpowers Development Workflow
print("\n🚀 obra/superpowers Development Workflow")
obra_base = "https://raw.githubusercontent.com/obra/superpowers/main/skills"
obra_skills = [
    ("obra-root-cause", f"{obra_base}/root-cause-tracing/SKILL.md"),
]
for name, url in obra_skills:
    fetch_skill(name, url)

# OpenAI Curated Skills
print("\n🤖 OpenAI Curated Skills")
openai_base = "https://raw.githubusercontent.com/openai/skills/main/skills"
openai_skills = [
    ("openai-gh-comments", f"{openai_base}/gh-address-comments/SKILL.md"),
    ("openai-notion-knowledge", f"{openai_base}/notion-knowledge-capture/SKILL.md"),
]
for name, url in openai_skills:
    fetch_skill(name, url)

print("\n" + "=" * 70)
print(f"✅ Successfully fetched: {OK}")
print(f"❌ Failed to fetch: {FAIL}")
print(f"📦 Total skills in directory: {len(list(SKILLS_DIR.glob('*.md')))}")
print("=" * 70)

