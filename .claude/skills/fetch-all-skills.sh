#!/usr/bin/env bash
# Fetch all 300+ skills from VoltAgent/awesome-agent-skills into .claude/skills/
set -e
SKILLS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OK=0; FAIL=0

get() {
  local name="$1" repo="$2" path="$3" branch="${4:-main}"
  local out="$SKILLS_DIR/${name}.md"
  [ -f "$out" ] && { echo "  ✓ (exists) $name"; OK=$((OK+1)); return; }
  local url="https://raw.githubusercontent.com/${repo}/${branch}/${path}"
  local c; c=$(curl -sf "$url" 2>/dev/null)
  if [ -z "$c" ]; then
    url="https://raw.githubusercontent.com/${repo}/master/${path}"
    c=$(curl -sf "$url" 2>/dev/null)
  fi
  if [ -n "$c" ]; then
    echo "$c" > "$out"; echo "  ✓ $name"; OK=$((OK+1))
  else
    echo "  ✗ $name"; FAIL=$((FAIL+1))
  fi
}

echo ""; echo "=== Fetching 300+ Agent Skills ==="; echo ""

echo "[ Anthropic Official ]"
get anthropic-docx              anthropics/skills skills/docx/SKILL.md
get anthropic-doc-coauthoring   anthropics/skills skills/doc-coauthoring/SKILL.md
get anthropic-pptx              anthropics/skills skills/pptx/SKILL.md
get anthropic-xlsx              anthropics/skills skills/xlsx/SKILL.md
get anthropic-pdf               anthropics/skills skills/pdf/SKILL.md
get anthropic-algorithmic-art   anthropics/skills skills/algorithmic-art/SKILL.md
get anthropic-canvas-design     anthropics/skills skills/canvas-design/SKILL.md
get anthropic-frontend-design   anthropics/skills skills/frontend-design/SKILL.md
get anthropic-slack-gif         anthropics/skills skills/slack-gif-creator/SKILL.md
get anthropic-theme-factory     anthropics/skills skills/theme-factory/SKILL.md
get anthropic-web-artifacts     anthropics/skills skills/web-artifacts-builder/SKILL.md
get anthropic-mcp-builder       anthropics/skills skills/mcp-builder/SKILL.md
get anthropic-webapp-testing    anthropics/skills skills/webapp-testing/SKILL.md
get anthropic-brand-guidelines  anthropics/skills skills/brand-guidelines/SKILL.md
get anthropic-internal-comms    anthropics/skills skills/internal-comms/SKILL.md
get anthropic-skill-creator     anthropics/skills skills/skill-creator/SKILL.md

echo ""; echo "[ Vercel ]"
get vercel-react-best-practices  vercel-labs/agent-skills skills/react-best-practices/SKILL.md
get vercel-web-design-guidelines vercel-labs/agent-skills skills/web-design-guidelines/SKILL.md
get vercel-composition-patterns  vercel-labs/agent-skills skills/composition-patterns/SKILL.md
get vercel-react-native          vercel-labs/agent-skills skills/react-native-skills/SKILL.md
get vercel-next-best-practices   vercel-labs/next-skills  skills/next-best-practices/SKILL.md
get vercel-next-cache            vercel-labs/next-skills  skills/next-cache-components/SKILL.md
get vercel-next-upgrade          vercel-labs/next-skills  skills/next-upgrade/SKILL.md

echo ""; echo "[ Cloudflare ]"
get cloudflare-agents-sdk    cloudflare/skills skills/agents-sdk/SKILL.md
get cloudflare-ai-agent      cloudflare/skills skills/building-ai-agent-on-cloudflare/SKILL.md
get cloudflare-mcp-server    cloudflare/skills skills/building-mcp-server-on-cloudflare/SKILL.md
get cloudflare-durable-obj   cloudflare/skills skills/durable-objects/SKILL.md
get cloudflare-web-perf      cloudflare/skills skills/web-perf/SKILL.md
get cloudflare-wrangler      cloudflare/skills skills/wrangler/SKILL.md

echo ""; echo "[ Supabase ]"
get supabase-postgres supabase/agent-skills skills/supabase-postgres-best-practices/SKILL.md

echo ""; echo "[ Google Labs / Stitch ]"
get stitch-design-md        google-labs-code/stitch-skills skills/design-md/SKILL.md
get stitch-enhance-prompt   google-labs-code/stitch-skills skills/enhance-prompt/SKILL.md
get stitch-react-components google-labs-code/stitch-skills skills/react-components/SKILL.md
get stitch-remotion         google-labs-code/stitch-skills skills/remotion/SKILL.md
get stitch-shadcn-ui        google-labs-code/stitch-skills skills/shadcn-ui/SKILL.md
get stitch-loop             google-labs-code/stitch-skills skills/stitch-loop/SKILL.md

echo ""; echo "[ Hugging Face ]"
get hf-cli            huggingface/skills skills/hugging-face-cli/SKILL.md
get hf-datasets       huggingface/skills skills/hugging-face-datasets/SKILL.md
get hf-evaluation     huggingface/skills skills/hugging-face-evaluation/SKILL.md
get hf-jobs           huggingface/skills skills/hugging-face-jobs/SKILL.md
get hf-model-trainer  huggingface/skills skills/hugging-face-model-trainer/SKILL.md
get hf-paper-pub      huggingface/skills skills/hugging-face-paper-publisher/SKILL.md
get hf-tool-builder   huggingface/skills skills/hugging-face-tool-builder/SKILL.md
get hf-trackio        huggingface/skills skills/hugging-face-trackio/SKILL.md

echo ""; echo "[ Stripe ]"
get stripe-best-practices stripe/ai skills/stripe-best-practices/SKILL.md
get stripe-upgrade        stripe/ai skills/upgrade-stripe/SKILL.md

echo ""; echo "[ CallStack ]"
get callstack-rn-best-practices callstackincubator/agent-skills skills/react-native-best-practices/SKILL.md
get callstack-github            callstackincubator/agent-skills skills/github/SKILL.md
get callstack-rn-upgrade        callstackincubator/agent-skills skills/upgrading-react-native/SKILL.md

echo ""; echo "[ Trail of Bits - Security ]"
get tob-ask-questions       trailofbits/skills plugins/ask-questions-if-underspecified/SKILL.md
get tob-audit-context       trailofbits/skills plugins/audit-context-building/SKILL.md
get tob-secure-contracts    trailofbits/skills plugins/building-secure-contracts/SKILL.md
get tob-constant-time       trailofbits/skills plugins/constant-time-analysis/SKILL.md
get tob-differential-review trailofbits/skills plugins/differential-review/SKILL.md
get tob-fix-review          trailofbits/skills plugins/fix-review/SKILL.md
get tob-insecure-defaults   trailofbits/skills plugins/insecure-defaults/SKILL.md
get tob-modern-python       trailofbits/skills plugins/modern-python/SKILL.md
get tob-property-testing    trailofbits/skills plugins/property-based-testing/SKILL.md
get tob-semgrep-creator     trailofbits/skills plugins/semgrep-rule-creator/SKILL.md
get tob-sharp-edges         trailofbits/skills plugins/sharp-edges/SKILL.md
get tob-static-analysis     trailofbits/skills plugins/static-analysis/SKILL.md
get tob-testing-handbook    trailofbits/skills plugins/testing-handbook-skills/SKILL.md
get tob-variant-analysis    trailofbits/skills plugins/variant-analysis/SKILL.md
get tob-entry-point         trailofbits/skills plugins/entry-point-analyzer/SKILL.md

echo ""; echo "[ Expo ]"
get expo-app-design expo/skills plugins/expo-app-design/SKILL.md
get expo-deployment expo/skills plugins/expo-deployment/SKILL.md
get expo-upgrade    expo/skills plugins/upgrading-expo/SKILL.md

echo ""; echo "[ Sentry ]"
get sentry-agents-md   getsentry/skills plugins/sentry-skills/skills/agents-md/SKILL.md
get sentry-code-review getsentry/skills plugins/sentry-skills/skills/code-review/SKILL.md
get sentry-commit      getsentry/skills plugins/sentry-skills/skills/commit/SKILL.md
get sentry-create-pr   getsentry/skills plugins/sentry-skills/skills/create-pr/SKILL.md
get sentry-find-bugs   getsentry/skills plugins/sentry-skills/skills/find-bugs/SKILL.md
get sentry-iterate-pr  getsentry/skills plugins/sentry-skills/skills/iterate-pr/SKILL.md

echo ""; echo "[ Better Auth ]"
get better-auth-best-practices better-auth/skills better-auth/best-practices/SKILL.md
get better-auth-commands       better-auth/skills better-auth/commands/SKILL.md
get better-auth-create-auth    better-auth/skills better-auth/create-auth/SKILL.md

echo ""; echo "[ Tinybird ]"
get tinybird-best-practices tinybirdco/tinybird-agent-skills skills/tinybird-best-practices/SKILL.md

echo ""; echo "[ Neon ]"
get neon-postgres neondatabase/agent-skills skills/neon-postgres/SKILL.md

echo ""; echo "[ HashiCorp / Terraform ]"
get terraform-code-gen    hashicorp/agent-skills terraform/code-generation/SKILL.md
get terraform-module-gen  hashicorp/agent-skills terraform/module-generation/SKILL.md
get terraform-provider    hashicorp/agent-skills terraform/provider-development/SKILL.md

echo ""; echo "[ Sanity ]"
get sanity-best-practices   sanity-io/agent-toolkit skills/sanity-best-practices/SKILL.md
get sanity-content-modeling sanity-io/agent-toolkit skills/content-modeling-best-practices/SKILL.md
get sanity-seo              sanity-io/agent-toolkit skills/seo-aeo-best-practices/SKILL.md
get sanity-experimentation  sanity-io/agent-toolkit skills/content-experimentation-best-practices/SKILL.md

echo ""; echo "[ Remotion ]"
get remotion-video remotion-dev/skills skills/remotion/SKILL.md

echo ""; echo "[ WordPress ]"
get wp-router       WordPress/agent-skills skills/wordpress-router/SKILL.md trunk
get wp-triage       WordPress/agent-skills skills/wp-project-triage/SKILL.md trunk
get wp-block-dev    WordPress/agent-skills skills/wp-block-development/SKILL.md trunk
get wp-block-themes WordPress/agent-skills skills/wp-block-themes/SKILL.md trunk
get wp-plugin-dev   WordPress/agent-skills skills/wp-plugin-development/SKILL.md trunk
get wp-rest-api     WordPress/agent-skills skills/wp-rest-api/SKILL.md trunk
get wp-interactivity WordPress/agent-skills skills/wp-interactivity-api/SKILL.md trunk
get wp-abilities    WordPress/agent-skills skills/wp-abilities-api/SKILL.md trunk
get wp-cli          WordPress/agent-skills skills/wp-wpcli-and-ops/SKILL.md trunk
get wp-performance  WordPress/agent-skills skills/wp-performance/SKILL.md trunk
get wp-phpstan      WordPress/agent-skills skills/wp-phpstan/SKILL.md trunk
get wp-playground   WordPress/agent-skills skills/wp-playground/SKILL.md trunk

echo ""; echo "[ Transloadit ]"
get transloadit-main      transloadit/skills skills/transloadit/SKILL.md
get transloadit-robots    transloadit/skills skills/docs-transloadit-robots/SKILL.md
get transloadit-image-gen transloadit/skills "skills/transform-generate-image-with-transloadit/SKILL.md"
get transloadit-hls       transloadit/skills "skills/transform-encode-hls-video-with-transloadit/SKILL.md"
get transloadit-uppy      transloadit/skills "skills/integrate-uppy-transloadit-s3-uploading-to-nextjs/SKILL.md"
get transloadit-smartcdn  transloadit/skills "skills/integrate-asset-delivery-with-transloadit-smartcdn-in-nextjs/SKILL.md"

echo ""; echo "[ Firecrawl ]"
get firecrawl-cli firecrawl/cli skills/firecrawl-cli/SKILL.md

echo ""; echo "[ OpenAI Curated ]"
get openai-cloudflare-deploy   openai/skills skills/.curated/cloudflare-deploy/SKILL.md
get openai-develop-web-game    openai/skills skills/.curated/develop-web-game/SKILL.md
get openai-doc                 openai/skills skills/.curated/doc/SKILL.md
get openai-figma-implement     openai/skills skills/.curated/figma-implement-design/SKILL.md
get openai-figma               openai/skills skills/.curated/figma/SKILL.md
get openai-gh-address-comments openai/skills skills/.curated/gh-address-comments/SKILL.md
get openai-gh-fix-ci           openai/skills skills/.curated/gh-fix-ci/SKILL.md
get openai-imagegen            openai/skills skills/.curated/imagegen/SKILL.md
get openai-jupyter             openai/skills skills/.curated/jupyter-notebook/SKILL.md
get openai-linear              openai/skills skills/.curated/linear/SKILL.md
get openai-netlify-deploy      openai/skills skills/.curated/netlify-deploy/SKILL.md
get openai-notion-capture      openai/skills skills/.curated/notion-knowledge-capture/SKILL.md
get openai-notion-meeting      openai/skills skills/.curated/notion-meeting-intelligence/SKILL.md
get openai-notion-research     openai/skills skills/.curated/notion-research-documentation/SKILL.md
get openai-notion-spec         openai/skills skills/.curated/notion-spec-to-implementation/SKILL.md
get openai-docs                openai/skills skills/.curated/openai-docs/SKILL.md
get openai-pdf                 openai/skills skills/.curated/pdf/SKILL.md
get openai-playwright          openai/skills skills/.curated/playwright/SKILL.md
get openai-render-deploy       openai/skills skills/.curated/render-deploy/SKILL.md
get openai-screenshot          openai/skills skills/.curated/screenshot/SKILL.md
get openai-security-best       openai/skills skills/.curated/security-best-practices/SKILL.md
get openai-security-threat     openai/skills skills/.curated/security-threat-model/SKILL.md
get openai-sentry              openai/skills skills/.curated/sentry/SKILL.md
get openai-sora                openai/skills skills/.curated/sora/SKILL.md
get openai-speech              openai/skills skills/.curated/speech/SKILL.md
get openai-spreadsheet         openai/skills skills/.curated/spreadsheet/SKILL.md
get openai-transcribe          openai/skills skills/.curated/transcribe/SKILL.md
get openai-vercel-deploy       openai/skills skills/.curated/vercel-deploy/SKILL.md
get openai-yeet                openai/skills skills/.curated/yeet/SKILL.md

echo ""; echo "[ fal.ai ]"
get fal-audio      fal-ai-community/skills skills/claude.ai/fal-audio/SKILL.md
get fal-generate   fal-ai-community/skills skills/claude.ai/fal-generate/SKILL.md
get fal-image-edit fal-ai-community/skills skills/claude.ai/fal-image-edit/SKILL.md
get fal-platform   fal-ai-community/skills skills/claude.ai/fal-platform/SKILL.md
get fal-upscale    fal-ai-community/skills skills/claude.ai/fal-upscale/SKILL.md
get fal-workflow   fal-ai-community/skills skills/claude.ai/fal-workflow/SKILL.md

echo ""; echo "[ obra/superpowers ]"
get obra-brainstorming        obra/superpowers skills/brainstorming/SKILL.md
get obra-writing-plans        obra/superpowers skills/writing-plans/SKILL.md
get obra-executing-plans      obra/superpowers skills/executing-plans/SKILL.md
get obra-parallel-agents      obra/superpowers skills/dispatching-parallel-agents/SKILL.md
get obra-sharing-skills       obra/superpowers skills/sharing-skills/SKILL.md
get obra-using-superpowers    obra/superpowers skills/using-superpowers/SKILL.md
get obra-tdd                  obra/superpowers skills/test-driven-development/SKILL.md
get obra-subagent-dev         obra/superpowers skills/subagent-driven-development/SKILL.md
get obra-systematic-debug     obra/superpowers skills/systematic-debugging/SKILL.md
get obra-root-cause           obra/superpowers skills/root-cause-tracing/SKILL.md
get obra-testing-subagents    obra/superpowers skills/testing-skills-with-subagents/SKILL.md
get obra-testing-antipatterns obra/superpowers skills/testing-anti-patterns/SKILL.md
get obra-finish-branch        obra/superpowers skills/finishing-a-development-branch/SKILL.md
get obra-request-review       obra/superpowers skills/requesting-code-review/SKILL.md
get obra-receive-review       obra/superpowers skills/receiving-code-review/SKILL.md
get obra-git-worktrees        obra/superpowers skills/using-git-worktrees/SKILL.md
get obra-verification         obra/superpowers skills/verification-before-completion/SKILL.md
get obra-condition-waiting    obra/superpowers skills/condition-based-waiting/SKILL.md
get obra-writing-skills       obra/superpowers skills/writing-skills/SKILL.md
get obra-defense-in-depth     obra/superpowers skills/defense-in-depth/SKILL.md

echo ""; echo "[ Context Engineering ]"
get ctx-fundamentals  muratcankoylan/Agent-Skills-for-Context-Engineering skills/context-fundamentals/SKILL.md
get ctx-degradation   muratcankoylan/Agent-Skills-for-Context-Engineering skills/context-degradation/SKILL.md
get ctx-compression   muratcankoylan/Agent-Skills-for-Context-Engineering skills/context-compression/SKILL.md
get ctx-optimization  muratcankoylan/Agent-Skills-for-Context-Engineering skills/context-optimization/SKILL.md
get ctx-multi-agent   muratcankoylan/Agent-Skills-for-Context-Engineering skills/multi-agent-patterns/SKILL.md
get ctx-memory-systems muratcankoylan/Agent-Skills-for-Context-Engineering skills/memory-systems/SKILL.md
get ctx-tool-design   muratcankoylan/Agent-Skills-for-Context-Engineering skills/tool-design/SKILL.md
get ctx-evaluation    muratcankoylan/Agent-Skills-for-Context-Engineering skills/evaluation/SKILL.md

echo ""; echo "[ Community: Development ]"
get community-terraform     antonbabenko/terraform-skill SKILL.md
get community-aws           zxkane/aws-skills SKILL.md
get community-rails-upgrade robzolkos/skill-rails-upgrade SKILL.md
get community-ios-simulator conorluddy/ios-simulator-skill SKILL.md
get community-playwright    lackeyjb/playwright-skill SKILL.md
get community-ui-skills     ibelick/ui-skills SKILL.md
get community-ui-ux-pro     nextlevelbuilder/ui-ux-pro-max-skill SKILL.md
get community-threejs       CloudAI-X/threejs-skills SKILL.md
get community-swiftui       AvdLee/SwiftUI-Agent-Skill swiftui-expert-skill/SKILL.md
get community-swift-patterns efremidze/swift-patterns-skill swift-patterns/SKILL.md
get community-startup       rameerez/claude-code-startup-skills SKILL.md
get community-model-routing zscole/model-hierarchy-skill SKILL.md
get community-deep-research sanjay3290/ai-skills skills/deep-research/SKILL.md
get community-postgres      sanjay3290/ai-skills skills/postgres/SKILL.md
get community-recursive     massimodeluisa/recursive-decomposition-skill SKILL.md
get community-apple-hig     raintree-technology/apple-hig-skills SKILL.md
get community-security-blue SHADOWPR0/security-bluebook-builder SKILL.md
get community-clickhouse    ClickHouse/agent-skills SKILL.md
get community-cloudflare-eng dmmulroy/cloudflare-skill skills/cloudflare/SKILL.md
get community-n8n-js        czlonkowski/n8n-skills skills/n8n-code-javascript/SKILL.md
get community-n8n-py        czlonkowski/n8n-skills skills/n8n-code-python/SKILL.md
get community-n8n-expr      czlonkowski/n8n-skills skills/n8n-expression-syntax/SKILL.md
get community-n8n-mcp       czlonkowski/n8n-skills skills/n8n-mcp-tools-expert/SKILL.md
get community-n8n-nodes     czlonkowski/n8n-skills skills/n8n-node-configuration/SKILL.md
get community-seo           AgriciDaniel/claude-seo SKILL.md
get community-changelog     ComposioHQ/awesome-claude-skills changelog-generator/SKILL.md master
get community-bootstrap     alinaqi/claude-bootstrap SKILL.md
get community-makepad       ZhangHanDong/makepad-skills SKILL.md
get community-ai-research   zechenzhangAGI/AI-research-SKILLs SKILL.md
get community-design-rules  ehmo/platform-design-skills SKILL.md

echo ""
echo "================================================================"
echo "  Done: $OK fetched, $FAIL failed"
echo "================================================================"
echo ""
echo "Skills saved to: $SKILLS_DIR"
echo "Total files: $(ls "$SKILLS_DIR"/*.md 2>/dev/null | wc -l)"
