# Technology Stack

**Analysis Date:** 2026-06-09

## Languages

**Primary:**
- JSON — agent flow definition (`cinatra/oas.json`), package manifest (`package.json`)
- Markdown — agent system prompt / skill definition (`skills/web-research-agent/SKILL.md`)

**Secondary:**
- TypeScript (ES2023, strict mode) — tsconfig present (`tsconfig.json`), targets `src/` but no `src/` directory exists in this extraction; configuration is pre-wired for future TypeScript sources
- JavaScript (ESM) — CI gate utility (`extension-kind-gate.mjs`, `"type": "module"`)

## Runtime

**Environment:**
- Node.js 24 (specified in `.github/workflows/ci.yml` `setup-node` step)

**Package Manager:**
- pnpm (via corepack, `corepack pnpm install`)
- Lockfile: not committed (CI uses `--no-frozen-lockfile`)

## Frameworks

**Core:**
- Cinatra AgentSpec v26.1.0 — flow-based LLM orchestration platform; the agent is defined as a `Flow` component type in `cinatra/oas.json`
- No application framework (this is a content-only agent extension with no runtime code beyond the gate utility)

**Testing:**
- Not applicable — no test files present; CI skips tests for source-mirror repos (host-internal peer dependencies resolved by monorepo)

**Build/Dev:**
- TypeScript compiler (`tsc`) — configured via `tsconfig.json`; compile target is `dist/`, source root `src/`
- corepack — manages pnpm version in CI

## Key Dependencies

**Critical:**
- `@cinatra-ai/*` packages — declared as optional peerDependencies only (none present in `package.json` currently); the cinatra monorepo provides them. Direct inclusion in `dependencies`/`devDependencies` is explicitly prohibited by CI gate.

**Infrastructure:**
- No runtime npm dependencies declared in `package.json`

## Configuration

**Environment:**
- `CINATRA_BASE_URL` — runtime environment variable injected by the Cinatra platform; used in `cinatra/oas.json` as `{{CINATRA_BASE_URL}}/api/llm-bridge` for the `ApiNode` URL
- No `.env` file read (platform-injected at runtime)

**Build:**
- `tsconfig.json` — standalone strict TypeScript config; targets `ES2023`, `ESNext` modules, `bundler` module resolution, outputs to `dist/`
- `package.json` — declares `"type": "module"` (ESM), package name `@cinatra-ai/web-research-agent`, version `0.1.0`, license `Apache-2.0`

## Platform Requirements

**Development:**
- Node.js 24+
- corepack / pnpm
- No local install required for content-only changes (flow defined entirely in `cinatra/oas.json` + `skills/web-research-agent/SKILL.md`)

**Production:**
- Deployed to Cinatra Marketplace via `registry.cinatra.ai` through the marketplace submission saga (triggered by GitHub Release)
- Runtime execution: Cinatra platform invokes `/api/llm-bridge` with `agent_id: web-research-agent`; the bridge auto-discovers `SKILL.md` and injects the `web_search` toolbox

---

*Stack analysis: 2026-06-09*
