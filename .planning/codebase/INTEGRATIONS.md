# External Integrations

**Analysis Date:** 2026-06-09

## APIs & External Services

**Cinatra LLM Bridge:**
- Service: Cinatra platform internal `/api/llm-bridge` endpoint
  - SDK/Client: `ApiNode` in `cinatra/oas.json` — HTTP POST via Cinatra flow engine
  - Auth: Platform-managed; URL templated as `{{CINATRA_BASE_URL}}/api/llm-bridge`
  - Purpose: Routes the research request to an LLM with the `web_search` toolbox injected

**LLM Provider:**
- Service: OpenAI
  - Preferred model: `gpt-5.5` (declared in `cinatra/oas.json` under `metadata.cinatra.llm` and `data.cinatra_llm`)
  - Auth: Managed by the Cinatra platform; not directly configured in this repo
  - Purpose: Executes the stateless web-research enrichment loop described in `skills/web-research-agent/SKILL.md`

**Web Search:**
- Toolbox: `web_search` (Cinatra-managed toolbox)
  - Declared in `cinatra/oas.json` under `metadata.cinatra.toolboxes: ["web_search"]` and `data.toolbox_ids: ["web_search"]`
  - Auth: Managed by the Cinatra platform
  - Purpose: The ONLY tool the LLM is permitted to call during enrichment; used to verify and enrich caller-supplied rows. MCP primitives (`contacts_*`, `accounts_*`, `objects_*`, etc.) are explicitly forbidden.

## Data Storage

**Databases:**
- Not applicable — this agent is explicitly stateless. It does not persist data. `cinatra.objects` writes are prohibited by the SKILL.md contract.

**File Storage:**
- Not applicable

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Cinatra platform — handles all auth for `/api/llm-bridge` and toolbox access. No auth configuration exists in this repo.

## Monitoring & Observability

**Error Tracking:**
- Not detected — no error tracking SDK integrated

**Logs:**
- Agent returns structured failure metadata in the `failures[]` and `webChecks[]` output fields; no external logging integration

## CI/CD & Deployment

**Hosting:**
- Cinatra Marketplace / `registry.cinatra.ai`

**CI Pipeline:**
- GitHub Actions
  - `ci.yml` — runs on push/PR to `main`; validates package shape (no first-party dep leakage), typechecks TypeScript, runs tests if present, dry-run packs, runs `extension-kind-gate.mjs` OAS validation
  - `release.yml` — triggered on GitHub Release `published` event; delegates to `cinatra-ai/.github/.github/workflows/reusable-extension-release.yml@main` for marketplace submission
  - Secret: `CINATRA_MARKETPLACE_VENDOR_TOKEN` (org-level GitHub secret, consumed by reusable release workflow)

## Environment Configuration

**Required env vars:**
- `CINATRA_BASE_URL` — base URL of the Cinatra platform, injected at runtime; used in `cinatra/oas.json` ApiNode URL template

**Secrets location:**
- `CINATRA_MARKETPLACE_VENDOR_TOKEN` — GitHub org secret (not stored in this repo)
- `.npmrc` file is present — note existence only, contents not read

## Webhooks & Callbacks

**Incoming:**
- Not applicable — the agent is invoked synchronously by the Cinatra flow engine via `/api/llm-bridge`

**Outgoing:**
- The LLM makes outbound HTTP requests via the `web_search` toolbox during enrichment (arbitrary public URLs determined at runtime based on research prompt). These are not configurable webhook endpoints — they are ad-hoc search/fetch operations.

## Orchestrator Contract

**Caller pattern:**
- This agent is designed to be called by an upstream orchestrator (e.g., `@cinatra-ai/list-curator-agent`) that chunks larger row sets into batches of 1-20 rows before invoking this agent
- The agent itself never calls sub-agents (`agent_run` is explicitly prohibited)
- Input bounds enforced: `rows.length` in `[1, 20]`, `sources.length <= 10`

---

*Integration audit: 2026-06-09*
