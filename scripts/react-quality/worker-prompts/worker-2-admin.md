# Worker 2 — Admin + Auth + Tenant + Subscription + Context

You are worker-2-admin on the react-quality agent team.

## YOUR FILE OWNERSHIP (never touch files outside these paths)
```
client/src/features/admin/
client/src/features/auth/
client/src/features/settings/
client/src/features/tenant/
client/src/features/subscription/
client/src/context/
```

## STEP 1 — Read your instructions
Read these files before touching any code:
- `scripts/react-quality/rules-reference.md` — all fix patterns with code examples
- `scripts/react-quality/react-doctor-full-report.txt` — grep for your file paths to find exact line numbers

## STEP 2 — Run react-doctor on your directories
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx -y react-doctor@latest src/features/admin/ src/features/auth/ src/features/settings/ src/features/tenant/ src/features/subscription/ src/context/ --verbose 2>&1
```

## STEP 3 — Fix each file, applying ALL applicable rules

Work file-by-file. After every 5 files: `npx tsc --noEmit` → must be 0 errors.

### High-priority files in your domain:
- `admin/UserManager.tsx` — form labels (8×), keyboard handler (2×), role (2×), excessive useState
- `admin/UserManagement/UserManagement.tsx` — keyboard handler, role, excessive useState, array key, large component
- `admin/AgentConfigManager.tsx` — form labels (3×), keyboard handler, role, excessive useState
- `admin/FeatureFlagManager.tsx` — form labels (3×), keyboard handler, role, excessive useState
- `admin/SubscriptionOverview.tsx` — array key (2×), excessive useState
- `admin/ParserHealth.tsx` — array key (2×), excessive useState, large component
- `admin/ActivityLog.tsx` — array key, excessive useState
- `admin/AdminDashboard.tsx` — array key, excessive useState, large component
- `admin/AgentExecutionDetail.tsx` — keyboard handler, role, array key
- `admin/CogneeGraphViewer/CogneeGraphViewer.tsx` — excessive useState, multiple setState in useEffect
- `admin/CogneeGraphViewer/components/DetailPanel.tsx` — array key
- `admin/AgentCostDashboard.tsx` — array key (2×)
- `admin/AgentMonitor.tsx` — excessive useState
- `admin/FeedbackQueue/FeedbackQueue.tsx` — keyboard handler (3×), role (3×)
- `admin/SystemMetrics.tsx` — array key, excessive useState, large component
- `admin/SystemHealthDashboard.tsx` — array key (2×)
- `admin/CogneeManager.tsx` — excessive useState
- `admin/CogneeSearchTester.tsx` — form labels (3×), excessive useState
- `admin/AdminLayout.tsx` — inline render function
- `admin/CogneeGraph2DFallback/CogneeGraph2DFallback.tsx` — excessive useState
- `auth/Auth.tsx` — form labels (2×), array key, excessive useState
- `auth/AdminLogin.tsx` — form labels (2×)
- `settings/Settings.tsx` — useEffect→event handler, excessive useState, array key
- `tenant/TenantCreate.tsx` — form labels (3×), autoFocus, excessive useState
- `tenant/TenantSettings.tsx` — form labels (7×), multiple setState in useEffect, excessive useState
- `tenant/MemberManager.tsx` — form labels (2×), excessive useState
- `tenant/PermissionMatrix.tsx` — excessive useState
- `tenant/TenantSwitcher.tsx` — non-lazy useState initializer
- `subscription/UsageDashboard.tsx` — array key
- `context/SSEContext.tsx` — multiple setState in useEffect

## STEP 4 — Final check
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse/client"
npx tsc --noEmit
npx -y react-doctor@latest src/features/admin/ src/features/auth/ src/features/settings/ src/features/tenant/ src/features/subscription/ src/context/ --verbose 2>&1 | tail -20
```

## STEP 5 — Commit
```bash
cd "C:/Users/Danie/Desktop/CBA Statements Parse"
git add client/src/features/admin/ client/src/features/auth/ client/src/features/settings/ client/src/features/tenant/ client/src/features/subscription/ client/src/context/
git commit -m "fix(react-quality): worker-2 admin/auth/tenant — all warnings resolved"
```

## STEP 6 — Report done
Send message to lead: `DONE: worker-2-admin — [N] files fixed, TSC clean`
Then mark your task as completed using TaskUpdate.
