<!-- refreshed: 2026-06-09 -->
# Architecture

**Analysis Date:** 2026-06-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    External Caller / Orchestrator            │
│   (e.g., @cinatra-ai/list-curator-agent)                     │
└────────────────────────┬────────────────────────────────────┘
                         │  {rows, prompt, sources, outputSchema}
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        StartNode                            │
│  `cinatra/oas.json` → $referenced_components.start          │
│  Validates required inputs (rows, prompt)                    │
└────────────────────────┬────────────────────────────────────┘
                         │ DataFlowEdges (all 4 inputs)
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    ApiNode: "research"                       │
│  `cinatra/oas.json` → $referenced_components.research        │
│  POST {{CINATRA_BASE_URL}}/api/llm-bridge                    │
│  LLM: OpenAI gpt-5.5 + web_search tool                      │
│  System prompt injected from SKILL.md via agent_id lookup    │
└────────────────────────┬────────────────────────────────────┘
                         │ {enrichedRows, extractionNotes,
                         │  failures, webChecks}
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                        EndNode                              │
│  `cinatra/oas.json` → $referenced_components.end             │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Flow manifest | Declares the full Cinatra agent spec (inputs, outputs, nodes, edges) | `cinatra/oas.json` |
| StartNode | Receives and passes through all four inputs; marks `rows` and `prompt` as required | `cinatra/oas.json` → `$referenced_components.start` |
| ApiNode (research) | Calls `/api/llm-bridge` with the SKILL.md system prompt, passes rows+prompt+sources+outputSchema as the user turn, runs the LLM with `web_search` toolbox | `cinatra/oas.json` → `$referenced_components.research` |
| EndNode | Accepts and surfaces the four output fields with defaults (`[]` / `""`) | `cinatra/oas.json` → `$referenced_components.end` |
| SKILL.md | LLM-facing behavioral specification — 5-step recipe (validate, plan, per-row loop, failure handling, return envelope) | `skills/web-research-agent/SKILL.md` |
| extension-kind-gate | CI self-validation script — scans `cinatra/oas.json` for banned CRM primitives in LLM-visible strings; validates workflow BPMN shape for workflow-kind repos | `extension-kind-gate.mjs` |
| package.json | Cinatra agent manifest (`cinatra.kind: "agent"`, `cinatra.dependencies: []`) | `package.json` |

## Pattern Overview

**Overall:** Cinatra single-step LLM-bridge agent (stateless enricher pattern)

**Key Characteristics:**
- No application code executes at runtime — the entire enrichment logic lives in the SKILL.md system prompt, interpreted by the LLM
- One ApiNode calls `/api/llm-bridge`; the Cinatra platform resolves SKILL.md from `agent_id: "web-research-agent"` and injects it as the system prompt
- Only one external tool is allowed: `web_search`. All MCP primitives are explicitly banned
- The agent is stateless — it persists nothing and dispatches no sub-agents
- Hard input bounds (rows 1-20, sources 0-10) are enforced inside the LLM via the SKILL.md instructions and also declared via JSON Schema in the OAS inputs

## Layers

**Flow Definition Layer:**
- Purpose: Declares the agent's API contract, node graph, and data routing
- Location: `cinatra/oas.json`
- Contains: Flow spec (agentspec_version, inputs, outputs, nodes, control/data flow edges, referenced_components)
- Depends on: Cinatra platform (runtime resolves `$component_ref`, `{{CINATRA_BASE_URL}}`, SKILL.md injection)
- Used by: Cinatra marketplace runtime, external callers

**Behavioral Specification Layer:**
- Purpose: Governs LLM reasoning — input validation, search strategy, per-row loop, failure taxonomy, output envelope contract
- Location: `skills/web-research-agent/SKILL.md`
- Contains: Step-by-step recipe, failure tags, output JSON schema, webChecks/enrichedRows/failures contracts
- Depends on: LLM (OpenAI gpt-5.5) interpreting it as a system prompt
- Used by: ApiNode's `agent_id` lookup → `/api/llm-bridge` system field

**Package Manifest Layer:**
- Purpose: Identifies the package as a Cinatra `agent` kind with no dependencies
- Location: `package.json`
- Contains: NPM metadata + `cinatra.apiVersion`, `cinatra.kind`, `cinatra.dependencies`
- Depends on: Nothing
- Used by: Cinatra extraction tooling, npm registry

**CI Gate Layer:**
- Purpose: Pre-publish sanity gate — scans OAS for retired CRM primitive references in LLM-visible strings
- Location: `extension-kind-gate.mjs`
- Contains: `validateAgent`, `validateWorkflow`, `validateBpmnSanity`, `runGate` (self-contained, zero Node deps beyond builtins)
- Depends on: Node.js builtins only (`fs`, `path`)
- Used by: `.github/workflows/ci.yml`

## Data Flow

### Primary Request Path

1. Caller submits `{rows, prompt, sources?, outputSchema?}` to the Flow entry point (`cinatra/oas.json` → StartNode)
2. StartNode passes all four fields via DataFlowEdges to the ApiNode (`research`)
3. ApiNode POSTs to `{{CINATRA_BASE_URL}}/api/llm-bridge` with:
   - `agent_id: "web-research-agent"` (platform injects SKILL.md as system prompt)
   - `user`: Jinja2 template rendering rows, prompt, sources, outputSchema as JSON
   - `toolbox_ids: ["web_search"]`
   - `cinatra_llm: { preferredProvider: "openai", preferredModel: "gpt-5.5" }`
4. LLM executes SKILL.md 5-step recipe: validates → plans → per-row web_search loop → captures failures → composes envelope
5. LLM returns strict JSON `{enrichedRows, extractionNotes, failures, webChecks}`
6. ApiNode forwards outputs via DataFlowEdges to EndNode
7. EndNode surfaces the four outputs to the caller (with defaults `[]`/`""` if absent)

### Early-Error Path (input bounds violation)

1. LLM validates `rows.length` and `sources.length` on entry (Step 1 of SKILL.md)
2. Returns early-error envelope immediately without processing any row:
   - `enrichedRows: []`, `failures: [{rowIndex: -1, error: "input_bounds"}]`
3. Caller receives the envelope as the normal output (no exception raised)

### CI Validation Path

1. `.github/workflows/ci.yml` runs `node extension-kind-gate.mjs --package-root .`
2. Gate reads `package.json` to determine `cinatra.kind`
3. For `kind: "agent"`: parses `cinatra/oas.json`, walks all LLM-visible string fields (`system`, `user`, `description`), checks against `BANNED_PRIMITIVES` list
4. Exits 0 (pass) or 1 (violations found)

**State Management:**
- None. The agent is explicitly stateless. No `objects_save`, no sub-agent dispatch, no side effects.

## Key Abstractions

**Output Envelope:**
- Purpose: Strict 4-key JSON contract returned by the LLM in all cases (success and early-error)
- Examples: `{enrichedRows, extractionNotes, failures, webChecks}`
- Pattern: All 4 keys always present; `enrichedRows.length === rows.length` in success cases; `[]` in early-error cases

**Failure Tag:**
- Purpose: Canonical snake_case error codes captured in `failures[].error`
- Tags: `no_data`, `web_search_failed`, `schema_violation`, `input_bounds`, `missing_prompt`
- Pattern: Row-level failures use `rowIndex >= 0`; aggregate failures use `rowIndex: -1`

**webChecks Entry:**
- Purpose: Per-URL reachability observation captured during the per-row loop
- Pattern: Deduplicated by URL; `reachable: boolean` is strict; unreachable URLs are still captured

**outputSchema passthrough:**
- Purpose: Optional JSON Schema allowing callers to enforce a specific shape on each enriched row
- Pattern: When `{}` (default), rows are passthrough + `researchNotes`; when non-empty, LLM must conform or emit `schema_violation`

## Entry Points

**Flow Entry Point:**
- Location: `cinatra/oas.json` → `start_node: { $component_ref: "start" }`
- Triggers: Cinatra platform runtime invocation (API call from orchestrator or UI)
- Responsibilities: Accept `rows` (required, 1-20 items), `prompt` (required), `sources` (optional, default `[]`), `outputSchema` (optional, default `{}`)

**CI Entry Point:**
- Location: `extension-kind-gate.mjs` → `main()`
- Triggers: `node extension-kind-gate.mjs --package-root .` (called from CI)
- Responsibilities: Validate agent OAS for banned primitives; exit 0 or 1

## Architectural Constraints

- **Statelessness:** The LLM MUST NOT call any MCP write primitive or persist data. Enforced by SKILL.md instruction and OAS `riskClass: "read_only"`.
- **Tool restriction:** Only `web_search` is available to the LLM. All MCP primitives (`contacts_*`, `accounts_*`, `objects_*`, `lists_*`, `scrape_*`, `agent_*`) are banned.
- **Input bounds:** `rows.length` must be 1-20; `sources.length` must be 0-10. Declared in OAS JSON Schema AND enforced by LLM via SKILL.md.
- **Global state:** None. No module-level singletons. `extension-kind-gate.mjs` is pure-function based.
- **Circular imports:** Not applicable — no application module graph.
- **Output invariant:** `enrichedRows.length === rows.length` in all non-early-error cases. Every row gets a slot even on failure.

## Anti-Patterns

### Calling MCP primitives from the LLM

**What happens:** LLM issues a `contacts_list`, `objects_save`, or `agent_run` call
**Why it's wrong:** This agent is an internal enrichment step; MCP primitives are reserved for orchestrators. It also violates the `riskClass: "read_only"` contract.
**Do this instead:** Use `web_search` only. Orchestrators (e.g., `@cinatra-ai/list-curator-agent`) handle CRM interactions upstream.

### Omitting keys from the output envelope

**What happens:** LLM returns only `{enrichedRows}` or omits `failures: []` when there are no failures
**Why it's wrong:** All 4 keys (`enrichedRows`, `extractionNotes`, `failures`, `webChecks`) are required in every response; omitting them breaks callers that rely on the contract
**Do this instead:** Always include all 4 keys; use `[]` for empty arrays, never omit

### Aborting the run on a single-row failure

**What happens:** LLM stops processing rows after a `no_data` or `web_search_failed` error
**Why it's wrong:** The per-row loop must run to completion; failures are captured in `failures[]` while the slot is still emitted in `enrichedRows`
**Do this instead:** Append the failure to `failures[]`, emit the original row + a `researchNotes` note, and continue to the next row

## Error Handling

**Strategy:** Non-aborting per-row failure capture with canonical tags

**Patterns:**
- Aggregate errors (input bounds, missing prompt) → early-error envelope returned immediately, `rowIndex: -1`
- Row-level errors → captured in `failures[]` with `rowIndex`, canonical `error` tag, optional `detail`; loop continues
- Schema violations → row slot emitted with fallback `researchNotes` describing the violation; `schema_violation` added to `failures[]`

## Cross-Cutting Concerns

**Logging:** Not applicable — no application runtime. Cinatra platform handles LLM call logging.
**Validation:** Input bounds checked by LLM per SKILL.md Step 1; also declared as JSON Schema constraints in OAS inputs.
**Authentication:** Handled by Cinatra platform (`{{CINATRA_BASE_URL}}` resolution and LLM-bridge auth); not in scope for this repo.

---

*Architecture analysis: 2026-06-09*
