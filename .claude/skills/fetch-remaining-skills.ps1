# Fetch remaining skills not yet downloaded
$ErrorActionPreference = "SilentlyContinue"
$SKILLS_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$OK = 0
$FAIL = 0

function Get-Skill {
    param(
        [string]$name,
        [string]$repo,
        [string]$path,
        [string]$branch = "main"
    )
    
    $out = Join-Path $SKILLS_DIR "$name.md"
    
    if (Test-Path $out) {
        Write-Host "  ✓ (exists) $name" -ForegroundColor Green
        $script:OK++
        return
    }
    
    $url = "https://raw.githubusercontent.com/$repo/$branch/$path"
    
    try {
        $content = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        $content.Content | Out-File -FilePath $out -Encoding UTF8
        Write-Host "  ✓ $name" -ForegroundColor Green
        $script:OK++
    }
    catch {
        # Try master branch
        $url = "https://raw.githubusercontent.com/$repo/master/$path"
        try {
            $content = Invoke-WebRequest -Uri $url -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
            $content.Content | Out-File -FilePath $out -Encoding UTF8
            Write-Host "  ✓ $name" -ForegroundColor Green
            $script:OK++
        }
        catch {
            Write-Host "  ✗ $name (failed to fetch)" -ForegroundColor Red
            $script:FAIL++
        }
    }
}

Write-Host ""
Write-Host "=== Fetching Remaining Skills ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[ Trail of Bits - Security ]" -ForegroundColor Yellow
Get-Skill "tob-ask-questions" "trailofbits/skills" "plugins/ask-questions-if-underspecified/SKILL.md"
Get-Skill "tob-audit-context" "trailofbits/skills" "plugins/audit-context-building/SKILL.md"
Get-Skill "tob-secure-contracts" "trailofbits/skills" "plugins/building-secure-contracts/SKILL.md"
Get-Skill "tob-constant-time" "trailofbits/skills" "plugins/constant-time-analysis/SKILL.md"
Get-Skill "tob-differential-review" "trailofbits/skills" "plugins/differential-review/SKILL.md"
Get-Skill "tob-fix-review" "trailofbits/skills" "plugins/fix-review/SKILL.md"
Get-Skill "tob-insecure-defaults" "trailofbits/skills" "plugins/insecure-defaults/SKILL.md"
Get-Skill "tob-modern-python" "trailofbits/skills" "plugins/modern-python/SKILL.md"
Get-Skill "tob-property-testing" "trailofbits/skills" "plugins/property-based-testing/SKILL.md"
Get-Skill "tob-semgrep-creator" "trailofbits/skills" "plugins/semgrep-rule-creator/SKILL.md"
Get-Skill "tob-sharp-edges" "trailofbits/skills" "plugins/sharp-edges/SKILL.md"
Get-Skill "tob-static-analysis" "trailofbits/skills" "plugins/static-analysis/SKILL.md"
Get-Skill "tob-testing-handbook" "trailofbits/skills" "plugins/testing-handbook-skills/SKILL.md"
Get-Skill "tob-variant-analysis" "trailofbits/skills" "plugins/variant-analysis/SKILL.md"
Get-Skill "tob-entry-point" "trailofbits/skills" "plugins/entry-point-analyzer/SKILL.md"
Get-Skill "tob-burpsuite" "trailofbits/skills" "plugins/burpsuite-project-parser/SKILL.md"
Get-Skill "tob-firebase-scanner" "trailofbits/skills" "plugins/firebase-apk-scanner/SKILL.md"
Get-Skill "tob-spec-compliance" "trailofbits/skills" "plugins/spec-to-code-compliance/SKILL.md"

Write-Host ""
Write-Host "[ Expo ]" -ForegroundColor Yellow
Get-Skill "expo-app-design" "expo/skills" "plugins/expo-app-design/SKILL.md"
Get-Skill "expo-deployment" "expo/skills" "plugins/expo-deployment/SKILL.md"
Get-Skill "expo-upgrade" "expo/skills" "plugins/upgrading-expo/SKILL.md"

Write-Host ""
Write-Host "[ Sentry ]" -ForegroundColor Yellow
Get-Skill "sentry-agents-md" "getsentry/skills" "plugins/sentry-skills/skills/agents-md/SKILL.md"
Get-Skill "sentry-code-review" "getsentry/skills" "plugins/sentry-skills/skills/code-review/SKILL.md"
Get-Skill "sentry-commit" "getsentry/skills" "plugins/sentry-skills/skills/commit/SKILL.md"
Get-Skill "sentry-create-pr" "getsentry/skills" "plugins/sentry-skills/skills/create-pr/SKILL.md"
Get-Skill "sentry-find-bugs" "getsentry/skills" "plugins/sentry-skills/skills/find-bugs/SKILL.md"
Get-Skill "sentry-iterate-pr" "getsentry/skills" "plugins/sentry-skills/skills/iterate-pr/SKILL.md"

Write-Host ""
Write-Host "[ Better Auth ]" -ForegroundColor Yellow
Get-Skill "better-auth-best-practices" "better-auth/skills" "better-auth/best-practices/SKILL.md"
Get-Skill "better-auth-commands" "better-auth/skills" "better-auth/commands/SKILL.md"
Get-Skill "better-auth-create-auth" "better-auth/skills" "better-auth/create-auth/SKILL.md"

Write-Host ""
Write-Host "[ Tinybird ]" -ForegroundColor Yellow
Get-Skill "tinybird-best-practices" "tinybirdco/tinybird-agent-skills" "skills/tinybird-best-practices/SKILL.md"

Write-Host ""
Write-Host "[ Neon ]" -ForegroundColor Yellow
Get-Skill "neon-postgres" "neondatabase/agent-skills" "skills/neon-postgres/SKILL.md"

Write-Host ""
Write-Host "[ HashiCorp / Terraform ]" -ForegroundColor Yellow
Get-Skill "terraform-code-gen" "hashicorp/agent-skills" "terraform/code-generation/SKILL.md"
Get-Skill "terraform-module-gen" "hashicorp/agent-skills" "terraform/module-generation/SKILL.md"
Get-Skill "terraform-provider" "hashicorp/agent-skills" "terraform/provider-development/SKILL.md"

Write-Host ""
Write-Host "[ Sanity ]" -ForegroundColor Yellow
Get-Skill "sanity-best-practices" "sanity-io/agent-toolkit" "skills/sanity-best-practices/SKILL.md"
Get-Skill "sanity-content-modeling" "sanity-io/agent-toolkit" "skills/content-modeling-best-practices/SKILL.md"
Get-Skill "sanity-seo" "sanity-io/agent-toolkit" "skills/seo-aeo-best-practices/SKILL.md"
Get-Skill "sanity-experimentation" "sanity-io/agent-toolkit" "skills/content-experimentation-best-practices/SKILL.md"

Write-Host ""
Write-Host "[ Remotion ]" -ForegroundColor Yellow
Get-Skill "remotion-video" "remotion-dev/skills" "skills/remotion/SKILL.md"

Write-Host ""
Write-Host "[ WordPress ]" -ForegroundColor Yellow
Get-Skill "wp-router" "WordPress/agent-skills" "skills/wordpress-router/SKILL.md" "trunk"
Get-Skill "wp-triage" "WordPress/agent-skills" "skills/wp-project-triage/SKILL.md" "trunk"
Get-Skill "wp-block-dev" "WordPress/agent-skills" "skills/wp-block-development/SKILL.md" "trunk"
Get-Skill "wp-block-themes" "WordPress/agent-skills" "skills/wp-block-themes/SKILL.md" "trunk"
Get-Skill "wp-plugin-dev" "WordPress/agent-skills" "skills/wp-plugin-development/SKILL.md" "trunk"
Get-Skill "wp-rest-api" "WordPress/agent-skills" "skills/wp-rest-api/SKILL.md" "trunk"
Get-Skill "wp-interactivity" "WordPress/agent-skills" "skills/wp-interactivity-api/SKILL.md" "trunk"
Get-Skill "wp-abilities" "WordPress/agent-skills" "skills/wp-abilities-api/SKILL.md" "trunk"
Get-Skill "wp-cli" "WordPress/agent-skills" "skills/wp-wpcli-and-ops/SKILL.md" "trunk"
Get-Skill "wp-performance" "WordPress/agent-skills" "skills/wp-performance/SKILL.md" "trunk"
Get-Skill "wp-phpstan" "WordPress/agent-skills" "skills/wp-phpstan/SKILL.md" "trunk"
Get-Skill "wp-playground" "WordPress/agent-skills" "skills/wp-playground/SKILL.md" "trunk"
Get-Skill "wp-design-system" "WordPress/agent-skills" "skills/wpds/SKILL.md" "trunk"

Write-Host ""
Write-Host "[ Transloadit ]" -ForegroundColor Yellow
Get-Skill "transloadit-main" "transloadit/skills" "skills/transloadit/SKILL.md"
Get-Skill "transloadit-robots" "transloadit/skills" "skills/docs-transloadit-robots/SKILL.md"
Get-Skill "transloadit-image-gen" "transloadit/skills" "skills/transform-generate-image-with-transloadit/SKILL.md"
Get-Skill "transloadit-hls" "transloadit/skills" "skills/transform-encode-hls-video-with-transloadit/SKILL.md"
Get-Skill "transloadit-uppy" "transloadit/skills" "skills/integrate-uppy-transloadit-s3-uploading-to-nextjs/SKILL.md"
Get-Skill "transloadit-smartcdn" "transloadit/skills" "skills/integrate-asset-delivery-with-transloadit-smartcdn-in-nextjs/SKILL.md"

Write-Host ""
Write-Host "[ Firecrawl ]" -ForegroundColor Yellow
Get-Skill "firecrawl-cli" "firecrawl/cli" "skills/firecrawl-cli/SKILL.md"

Write-Host ""
Write-Host "[ OpenAI Curated ]" -ForegroundColor Yellow
Get-Skill "openai-cloudflare-deploy" "openai/skills" "skills/.curated/cloudflare-deploy/SKILL.md"
Get-Skill "openai-develop-web-game" "openai/skills" "skills/.curated/develop-web-game/SKILL.md"
Get-Skill "openai-doc" "openai/skills" "skills/.curated/doc/SKILL.md"
Get-Skill "openai-figma-implement" "openai/skills" "skills/.curated/figma-implement-design/SKILL.md"
Get-Skill "openai-figma" "openai/skills" "skills/.curated/figma/SKILL.md"
Get-Skill "openai-gh-address-comments" "openai/skills" "skills/.curated/gh-address-comments/SKILL.md"
Get-Skill "openai-gh-fix-ci" "openai/skills" "skills/.curated/gh-fix-ci/SKILL.md"
Get-Skill "openai-imagegen" "openai/skills" "skills/.curated/imagegen/SKILL.md"
Get-Skill "openai-jupyter" "openai/skills" "skills/.curated/jupyter-notebook/SKILL.md"
Get-Skill "openai-linear" "openai/skills" "skills/.curated/linear/SKILL.md"
Get-Skill "openai-netlify-deploy" "openai/skills" "skills/.curated/netlify-deploy/SKILL.md"
Get-Skill "openai-notion-capture" "openai/skills" "skills/.curated/notion-knowledge-capture/SKILL.md"
Get-Skill "openai-notion-meeting" "openai/skills" "skills/.curated/notion-meeting-intelligence/SKILL.md"
Get-Skill "openai-notion-research" "openai/skills" "skills/.curated/notion-research-documentation/SKILL.md"
Get-Skill "openai-notion-spec" "openai/skills" "skills/.curated/notion-spec-to-implementation/SKILL.md"
Get-Skill "openai-docs" "openai/skills" "skills/.curated/openai-docs/SKILL.md"
Get-Skill "openai-pdf" "openai/skills" "skills/.curated/pdf/SKILL.md"
Get-Skill "openai-playwright" "openai/skills" "skills/.curated/playwright/SKILL.md"
Get-Skill "openai-render-deploy" "openai/skills" "skills/.curated/render-deploy/SKILL.md"
Get-Skill "openai-screenshot" "openai/skills" "skills/.curated/screenshot/SKILL.md"
Get-Skill "openai-security-best" "openai/skills" "skills/.curated/security-best-practices/SKILL.md"
Get-Skill "openai-security-threat" "openai/skills" "skills/.curated/security-threat-model/SKILL.md"
Get-Skill "openai-sentry" "openai/skills" "skills/.curated/sentry/SKILL.md"
Get-Skill "openai-sora" "openai/skills" "skills/.curated/sora/SKILL.md"
Get-Skill "openai-speech" "openai/skills" "skills/.curated/speech/SKILL.md"
Get-Skill "openai-spreadsheet" "openai/skills" "skills/.curated/spreadsheet/SKILL.md"
Get-Skill "openai-transcribe" "openai/skills" "skills/.curated/transcribe/SKILL.md"
Get-Skill "openai-vercel-deploy" "openai/skills" "skills/.curated/vercel-deploy/SKILL.md"
Get-Skill "openai-yeet" "openai/skills" "skills/.curated/yeet/SKILL.md"

Write-Host ""
Write-Host "[ fal.ai ]" -ForegroundColor Yellow
Get-Skill "fal-audio" "fal-ai-community/skills" "skills/claude.ai/fal-audio/SKILL.md"
Get-Skill "fal-generate" "fal-ai-community/skills" "skills/claude.ai/fal-generate/SKILL.md"
Get-Skill "fal-image-edit" "fal-ai-community/skills" "skills/claude.ai/fal-image-edit/SKILL.md"
Get-Skill "fal-platform" "fal-ai-community/skills" "skills/claude.ai/fal-platform/SKILL.md"
Get-Skill "fal-upscale" "fal-ai-community/skills" "skills/claude.ai/fal-upscale/SKILL.md"
Get-Skill "fal-workflow" "fal-ai-community/skills" "skills/claude.ai/fal-workflow/SKILL.md"

Write-Host ""
Write-Host "[ obra/superpowers ]" -ForegroundColor Yellow
Get-Skill "obra-brainstorming" "obra/superpowers" "skills/brainstorming/SKILL.md"
Get-Skill "obra-writing-plans" "obra/superpowers" "skills/writing-plans/SKILL.md"
Get-Skill "obra-executing-plans" "obra/superpowers" "skills/executing-plans/SKILL.md"
Get-Skill "obra-parallel-agents" "obra/superpowers" "skills/dispatching-parallel-agents/SKILL.md"
Get-Skill "obra-sharing-skills" "obra/superpowers" "skills/sharing-skills/SKILL.md"
Get-Skill "obra-using-superpowers" "obra/superpowers" "skills/using-superpowers/SKILL.md"
Get-Skill "obra-tdd" "obra/superpowers" "skills/test-driven-development/SKILL.md"
Get-Skill "obra-subagent-dev" "obra/superpowers" "skills/subagent-driven-development/SKILL.md"
Get-Skill "obra-systematic-debug" "obra/superpowers" "skills/systematic-debugging/SKILL.md"
Get-Skill "obra-root-cause" "obra/superpowers" "skills/root-cause-tracing/SKILL.md"
Get-Skill "obra-testing-subagents" "obra/superpowers" "skills/testing-skills-with-subagents/SKILL.md"
Get-Skill "obra-testing-antipatterns" "obra/superpowers" "skills/testing-anti-patterns/SKILL.md"
Get-Skill "obra-finish-branch" "obra/superpowers" "skills/finishing-a-development-branch/SKILL.md"
Get-Skill "obra-request-review" "obra/superpowers" "skills/requesting-code-review/SKILL.md"
Get-Skill "obra-receive-review" "obra/superpowers" "skills/receiving-code-review/SKILL.md"
Get-Skill "obra-git-worktrees" "obra/superpowers" "skills/using-git-worktrees/SKILL.md"
Get-Skill "obra-verification" "obra/superpowers" "skills/verification-before-completion/SKILL.md"
Get-Skill "obra-condition-waiting" "obra/superpowers" "skills/condition-based-waiting/SKILL.md"
Get-Skill "obra-writing-skills" "obra/superpowers" "skills/writing-skills/SKILL.md"
Get-Skill "obra-defense-in-depth" "obra/superpowers" "skills/defense-in-depth/SKILL.md"

Write-Host ""
Write-Host "[ Context Engineering ]" -ForegroundColor Yellow
Get-Skill "ctx-fundamentals" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/context-fundamentals/SKILL.md"
Get-Skill "ctx-degradation" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/context-degradation/SKILL.md"
Get-Skill "ctx-compression" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/context-compression/SKILL.md"
Get-Skill "ctx-optimization" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/context-optimization/SKILL.md"
Get-Skill "ctx-multi-agent" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/multi-agent-patterns/SKILL.md"
Get-Skill "ctx-memory-systems" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/memory-systems/SKILL.md"
Get-Skill "ctx-tool-design" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/tool-design/SKILL.md"
Get-Skill "ctx-evaluation" "muratcankoylan/Agent-Skills-for-Context-Engineering" "skills/evaluation/SKILL.md"

Write-Host ""
Write-Host "[ Community: Development ]" -ForegroundColor Yellow
Get-Skill "community-terraform" "antonbabenko/terraform-skill" "SKILL.md"
Get-Skill "community-aws" "zxkane/aws-skills" "SKILL.md"
Get-Skill "community-rails-upgrade" "robzolkos/skill-rails-upgrade" "SKILL.md"
Get-Skill "community-ios-simulator" "conorluddy/ios-simulator-skill" "SKILL.md"
Get-Skill "community-playwright" "lackeyjb/playwright-skill" "SKILL.md"
Get-Skill "community-ui-skills" "ibelick/ui-skills" "SKILL.md"
Get-Skill "community-ui-ux-pro" "nextlevelbuilder/ui-ux-pro-max-skill" "SKILL.md"
Get-Skill "community-threejs" "CloudAI-X/threejs-skills" "SKILL.md"
Get-Skill "community-swiftui" "AvdLee/SwiftUI-Agent-Skill" "swiftui-expert-skill/SKILL.md"
Get-Skill "community-swift-patterns" "efremidze/swift-patterns-skill" "swift-patterns/SKILL.md"
Get-Skill "community-startup" "rameerez/claude-code-startup-skills" "SKILL.md"
Get-Skill "community-model-routing" "zscole/model-hierarchy-skill" "SKILL.md"
Get-Skill "community-deep-research" "sanjay3290/ai-skills" "skills/deep-research/SKILL.md"
Get-Skill "community-postgres" "sanjay3290/ai-skills" "skills/postgres/SKILL.md"
Get-Skill "community-recursive" "massimodeluisa/recursive-decomposition-skill" "SKILL.md"
Get-Skill "community-apple-hig" "raintree-technology/apple-hig-skills" "SKILL.md"
Get-Skill "community-security-blue" "SHADOWPR0/security-bluebook-builder" "SKILL.md"
Get-Skill "community-clickhouse" "ClickHouse/agent-skills" "SKILL.md"
Get-Skill "community-cloudflare-eng" "dmmulroy/cloudflare-skill" "skills/cloudflare/SKILL.md"
Get-Skill "community-seo" "AgriciDaniel/claude-seo" "SKILL.md"
Get-Skill "community-bootstrap" "alinaqi/claude-bootstrap" "SKILL.md"
Get-Skill "community-makepad" "ZhangHanDong/makepad-skills" "SKILL.md"
Get-Skill "community-ai-research" "zechenzhangAGI/AI-research-SKILLs" "SKILL.md"
Get-Skill "community-design-rules" "ehmo/platform-design-skills" "SKILL.md"
Get-Skill "community-swiftui-ios26" "AvdLee/SwiftUI-Agent-Skill" "swiftui-expert-skill/SKILL.md"
Get-Skill "community-swift-server" "Joannis/claude-skills" "SKILL.md"
Get-Skill "community-app-store" "rudrankriyam/app-store-connect-cli-skills" "SKILL.md"

Write-Host ""
Write-Host "[ Community: n8n Automation ]" -ForegroundColor Yellow
Get-Skill "n8n-code-js" "czlonkowski/n8n-skills" "skills/n8n-code-javascript/SKILL.md"
Get-Skill "n8n-code-py" "czlonkowski/n8n-skills" "skills/n8n-code-python/SKILL.md"
Get-Skill "n8n-expr" "czlonkowski/n8n-skills" "skills/n8n-expression-syntax/SKILL.md"
Get-Skill "n8n-mcp" "czlonkowski/n8n-skills" "skills/n8n-mcp-tools-expert/SKILL.md"
Get-Skill "n8n-nodes" "czlonkowski/n8n-skills" "skills/n8n-node-configuration/SKILL.md"

Write-Host ""
Write-Host "[ Community: Marketing ]" -ForegroundColor Yellow
Get-Skill "marketing-seo" "AgriciDaniel/claude-seo" "SKILL.md"
Get-Skill "marketing-email-bible" "CosmoBlk/email-marketing-bible" "SKILL.md"

Write-Host ""
Write-Host "[ Community: Productivity ]" -ForegroundColor Yellow
Get-Skill "productivity-memory" "hanfang/claude-memory-skill" "SKILL.md"
Get-Skill "productivity-readme" "Shpigford/skills" "readme/SKILL.md"
Get-Skill "productivity-founder" "ognjengt/founder-skills" "SKILL.md"
Get-Skill "productivity-linear" "wrsmith108/linear-claude-skill" "SKILL.md"

Write-Host ""
Write-Host "[ Microsoft - TypeScript ]" -ForegroundColor Yellow
Get-Skill "ms-frontend-dark" "microsoft/skills" ".github/skills/frontend-ui-dark-ts/SKILL.md"
Get-Skill "ms-react-flow" "microsoft/skills" ".github/skills/react-flow-node-ts/SKILL.md"
Get-Skill "ms-zustand" "microsoft/skills" ".github/skills/zustand-store-ts/SKILL.md"
Get-Skill "ms-azure-cosmos-ts" "microsoft/skills" ".github/skills/azure-cosmos-ts/SKILL.md"
Get-Skill "ms-azure-postgres-ts" "microsoft/skills" ".github/skills/azure-postgres-ts/SKILL.md"
Get-Skill "ms-azure-search-ts" "microsoft/skills" ".github/skills/azure-search-documents-ts/SKILL.md"
Get-Skill "ms-azure-identity-ts" "microsoft/skills" ".github/skills/azure-identity-ts/SKILL.md"
Get-Skill "ms-azure-storage-ts" "microsoft/skills" ".github/skills/azure-storage-blob-ts/SKILL.md"
Get-Skill "ms-azure-keyvault-ts" "microsoft/skills" ".github/skills/azure-keyvault-secrets-ts/SKILL.md"
Get-Skill "ms-azure-servicebus-ts" "microsoft/skills" ".github/skills/azure-servicebus-ts/SKILL.md"
Get-Skill "ms-azure-eventhub-ts" "microsoft/skills" ".github/skills/azure-eventhub-ts/SKILL.md"
Get-Skill "ms-azure-pubsub-ts" "microsoft/skills" ".github/skills/azure-web-pubsub-ts/SKILL.md"
Get-Skill "ms-azure-playwright-ts" "microsoft/skills" ".github/skills/azure-microsoft-playwright-testing-ts/SKILL.md"
Get-Skill "ms-azure-opentelemetry-ts" "microsoft/skills" ".github/skills/azure-monitor-opentelemetry-ts/SKILL.md"
Get-Skill "ms-azure-ai-projects-ts" "microsoft/skills" ".github/skills/azure-ai-projects-ts/SKILL.md"
Get-Skill "ms-azure-voicelive-ts" "microsoft/skills" ".github/skills/azure-ai-voicelive-ts/SKILL.md"
Get-Skill "ms-m365-agents-ts" "microsoft/skills" ".github/skills/m365-agents-ts/SKILL.md"

Write-Host ""
Write-Host "[ Microsoft - Python ]" -ForegroundColor Yellow
Get-Skill "ms-fastapi-router" "microsoft/skills" ".github/skills/fastapi-router-py/SKILL.md"
Get-Skill "ms-pydantic-models" "microsoft/skills" ".github/skills/pydantic-models-py/SKILL.md"
Get-Skill "ms-azure-cosmos-py" "microsoft/skills" ".github/skills/azure-cosmos-py/SKILL.md"
Get-Skill "ms-azure-ai-ml" "microsoft/skills" ".github/skills/azure-ai-ml-py/SKILL.md"
Get-Skill "ms-azure-ai-projects-py" "microsoft/skills" ".github/skills/azure-ai-projects-py/SKILL.md"
Get-Skill "ms-azure-identity-py" "microsoft/skills" ".github/skills/azure-identity-py/SKILL.md"
Get-Skill "ms-azure-storage-py" "microsoft/skills" ".github/skills/azure-storage-blob-py/SKILL.md"
Get-Skill "ms-azure-keyvault-py" "microsoft/skills" ".github/skills/azure-keyvault-py/SKILL.md"
Get-Skill "ms-azure-search-py" "microsoft/skills" ".github/skills/azure-search-documents-py/SKILL.md"
Get-Skill "ms-azure-servicebus-py" "microsoft/skills" ".github/skills/azure-servicebus-py/SKILL.md"
Get-Skill "ms-azure-eventhub-py" "microsoft/skills" ".github/skills/azure-eventhub-py/SKILL.md"
Get-Skill "ms-azure-openai-py" "microsoft/skills" ".github/skills/azure-ai-contentunderstanding-py/SKILL.md"
Get-Skill "ms-azure-voicelive-py" "microsoft/skills" ".github/skills/azure-ai-voicelive-py/SKILL.md"
Get-Skill "ms-azure-speech-py" "microsoft/skills" ".github/skills/azure-ai-transcription-py/SKILL.md"
Get-Skill "ms-azure-translate-py" "microsoft/skills" ".github/skills/azure-ai-translation-text-py/SKILL.md"
Get-Skill "ms-m365-agents-py" "microsoft/skills" ".github/skills/m365-agents-py/SKILL.md"
Get-Skill "ms-agent-framework-py" "microsoft/skills" ".github/skills/agent-framework-azure-ai-py/SKILL.md"

Write-Host ""
Write-Host "[ Microsoft - .NET ]" -ForegroundColor Yellow
Get-Skill "ms-azure-ai-agents-net" "microsoft/skills" ".github/skills/azure-ai-agents-persistent-dotnet/SKILL.md"
Get-Skill "ms-azure-openai-net" "microsoft/skills" ".github/skills/azure-ai-openai-dotnet/SKILL.md"
Get-Skill "ms-azure-cosmos-net" "microsoft/skills" ".github/skills/azure-resource-manager-cosmosdb-dotnet/SKILL.md"
Get-Skill "ms-azure-identity-net" "microsoft/skills" ".github/skills/azure-identity-dotnet/SKILL.md"
Get-Skill "ms-azure-storage-net" "microsoft/skills" ".github/skills/azure-storage-blob-dotnet/SKILL.md"
Get-Skill "ms-azure-keyvault-net" "microsoft/skills" ".github/skills/azure-security-keyvault-keys-dotnet/SKILL.md"
Get-Skill "ms-azure-search-net" "microsoft/skills" ".github/skills/azure-search-documents-dotnet/SKILL.md"
Get-Skill "ms-azure-servicebus-net" "microsoft/skills" ".github/skills/azure-servicebus-dotnet/SKILL.md"
Get-Skill "ms-azure-eventhub-net" "microsoft/skills" ".github/skills/azure-eventhub-dotnet/SKILL.md"
Get-Skill "ms-m365-agents-net" "microsoft/skills" ".github/skills/m365-agents-dotnet/SKILL.md"
Get-Skill "ms-azure-voicelive-net" "microsoft/skills" ".github/skills/azure-ai-voicelive-dotnet/SKILL.md"
Get-Skill "ms-mcp-builder-ms" "microsoft/skills" ".github/skills/mcp-builder/SKILL.md"
Get-Skill "ms-skill-creator-ms" "microsoft/skills" ".github/skills/skill-creator/SKILL.md"

Write-Host ""
Write-Host "[ Microsoft - Java ]" -ForegroundColor Yellow
Get-Skill "ms-azure-cosmos-java" "microsoft/skills" ".github/skills/azure-cosmos-java/SKILL.md"
Get-Skill "ms-azure-identity-java" "microsoft/skills" ".github/skills/azure-identity-java/SKILL.md"
Get-Skill "ms-azure-eventhub-java" "microsoft/skills" ".github/skills/azure-eventhub-java/SKILL.md"
Get-Skill "ms-azure-ai-agents-java" "microsoft/skills" ".github/skills/azure-ai-agents-persistent-java/SKILL.md"
Get-Skill "ms-azure-voicelive-java" "microsoft/skills" ".github/skills/azure-ai-voicelive-java/SKILL.md"

Write-Host ""
Write-Host "[ Microsoft - Rust ]" -ForegroundColor Yellow
Get-Skill "ms-azure-cosmos-rust" "microsoft/skills" ".github/skills/azure-cosmos-rust/SKILL.md"
Get-Skill "ms-azure-identity-rust" "microsoft/skills" ".github/skills/azure-identity-rust/SKILL.md"
Get-Skill "ms-azure-keyvault-rust" "microsoft/skills" ".github/skills/azure-keyvault-secrets-rust/SKILL.md"
Get-Skill "ms-azure-storage-rust" "microsoft/skills" ".github/skills/azure-storage-blob-rust/SKILL.md"

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  Done: $OK fetched, $FAIL failed"
$TOTAL = (Get-ChildItem "$SKILLS_DIR\*.md" -ErrorAction SilentlyContinue).Count
Write-Host "  Total .md files in skills/: $TOTAL"
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

