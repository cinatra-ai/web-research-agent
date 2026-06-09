# Coding Conventions

**Analysis Date:** 2026-06-09

## Repository Nature

This is a **content-only Cinatra agent extension** repo. There is no `src/` directory and no application TypeScript beyond the single CI gate utility `extension-kind-gate.mjs`. Conventions therefore cover:

1. The LLM prompt document (`skills/web-research-agent/SKILL.md`)
2. The agent spec (`cinatra/oas.json`)
3. The CI gate script (`extension-kind-gate.mjs`)
4. Package manifest (`package.json`)

## Naming Patterns

**Files:**
- Agent skill prompt: `skills/<agent-name>/SKILL.md` (kebab-case directory, uppercase filename)
- Agent OAS spec: `cinatra/oas.json` (fixed path required by the platform)
- CI gate utility: `extension-kind-gate.mjs` (kebab-case, `.mjs` ES module extension)
- Package name: `@cinatra-ai/<agent-name>` where `<agent-name>` is kebab-case (e.g. `web-research-agent`)

**Identifiers in `cinatra/oas.json`:**
- Top-level `id`: kebab-case with `-flow` suffix (e.g. `"web-research-agent-flow"`)
- Node `id` values: lowercase short names (`"start"`, `"research"`, `"end"`)
- Data flow edge `name`: snake_case describing the from→to path (e.g. `"start_rows_to_research_rows"`)
- Input/output `title` fields: camelCase (e.g. `"enrichedRows"`, `"extractionNotes"`, `"outputSchema"`)

**Identifiers in `SKILL.md`:**
- JSON field names in schema examples: camelCase (e.g. `enrichedRows`, `extractionNotes`, `webChecks`, `researchNotes`)
- Error tags: snake_case (e.g. `no_data`, `web_search_failed`, `schema_violation`, `input_bounds`, `missing_prompt`)
- Template variable references in Jinja2 user prompts: snake_case matching input titles (e.g. `{{ rows | tojson }}`, `{{ outputSchema | tojson }}`)

**Functions in `extension-kind-gate.mjs`:**
- Exported functions: camelCase verbs (e.g. `parseArgs`, `validateAgent`, `validateWorkflow`, `runGate`)
- Internal helpers: camelCase (e.g. `walkLlmStrings`, `scanOasString`, `wordBoundary`, `prefixOf`, `localOf`)
- Constants: SCREAMING_SNAKE_CASE for fixed sets/patterns (e.g. `LLM_VISIBLE_FIELDS`, `BANNED_PRIMITIVES`, `BPMN_MODEL_NS`)

## Code Style

**Formatting:**
- No Prettier or ESLint config detected; no `.eslintrc*`, `.prettierrc*`, `biome.json` present
- `extension-kind-gate.mjs` uses 2-space indentation consistently
- Single-quoted strings for Node built-in imports; double-quoted strings for string constants and error messages
- Trailing commas on multi-line arrays/objects

**Module system:**
- ES modules throughout (`"type": "module"` in `package.json`)
- `.mjs` extension for the gate script to ensure ESM parsing regardless of `package.json`
- Only Node built-ins imported (`node:fs`, `node:path`) — zero npm dependencies in the gate

**TypeScript config (`tsconfig.json`):**
- `strict: true` with `noImplicitAny: false` (strict mode except implicit any)
- `verbatimModuleSyntax: true` — import type must use `import type`
- Target `ES2023`, module `ESNext`, resolution `bundler`
- Applies to `src/**/*.ts` and `src/**/*.tsx` — currently no files in `src/` exist

## Import Organization

**In `extension-kind-gate.mjs`:**
- All imports at top of file, grouped as a single block of Node built-in named imports
- No third-party imports permitted (zero-dependency constraint)

**Order (when TypeScript src exists):**
1. Node built-ins (`node:*`)
2. External packages
3. Internal modules

**Path Aliases:**
- None configured

## Error Handling

**In `extension-kind-gate.mjs`:**
- Pure functions return `string[]` errors — never throw for validation failures
- `try/catch` wraps all file I/O (`readFileSync`, `readdirSync`); errors are captured as strings pushed into the errors array
- Early returns with partial error arrays when a prerequisite check fails (e.g. missing `oas.json`, parse failure)
- `main()` wrapped in `try/catch` at invocation site; unexpected errors print to `console.error` then `process.exit(1)`
- Exit codes: `0` = clean, `1` = violations, `2` = dependency-shape regression (used in CI shell script, not in the gate itself)

**In `SKILL.md` (LLM behavioral contract):**
- Two-tier error model: early-error envelopes (aggregate input violations, `rowIndex: -1`) vs. per-row failures (loop continues)
- Canonical error tags are exhaustive and snake_case; novel tags must be snake_case with a `detail` field
- All 4 output keys (`enrichedRows`, `extractionNotes`, `failures`, `webChecks`) MUST be present even on error — never omit a key

## Logging

**Framework:** `console.log` / `console.error` (Node built-in, no logging library)

**Patterns:**
- Success: `console.log(...)` with a checkmark prefix (`✓ extension-kind-gate: ...`)
- Failures: `console.error(...)` with a cross prefix (`✗ extension-kind-gate: N violations`)
- Each violation printed as a bulleted line: `  • <error message>`
- No structured logging (no JSON log output)

## Comments

**When to Comment:**
- File-level block comments (dashes border) document the module's purpose, scope, and constraints — see `extension-kind-gate.mjs` lines 1-34
- Section dividers (dashes) separate logical regions within the file
- Inline comments explain non-obvious decisions (e.g. why `npx` is used instead of `pnpm dlx`)
- JSDoc not used; functions are documented via descriptive names and section comments

**SKILL.md:**
- Uses GitHub-flavored Markdown with `##` and `###` headings to structure the LLM prompt
- Code blocks (` ```json `) show exact required JSON shapes inline
- Bold (**text**) for behavioral constraints ("Use the `web_search` tool ONLY")

## Module Design

**Exports (`extension-kind-gate.mjs`):**
- All validator functions are named exports: `parseArgs`, `validateAgent`, `validateWorkflow`, `validateWorkflowPackageShape`, `validateBpmnSanity`, `findWorkflowSidecars`, `runGate`
- The `main()` function is NOT exported — it is invoked only when the module is the entry point (guarded by `invokedDirectly` check)
- This pattern allows the gate to be unit-tested by importing individual validators without triggering CLI side-effects

**Barrel Files:** Not applicable — no `src/` directory.

## Agent Spec Conventions (`cinatra/oas.json`)

- `agentspec_version` declares the platform version (`"26.1.0"`)
- `component_type: "Flow"` for top-level; nodes use `StartNode`, `ApiNode`, `EndNode`
- All outputs define `default` values on the `EndNode` (`[]` for arrays, `""` for strings) so the caller always receives a complete envelope
- `riskClass: "read_only"` and `requiresApproval: false` on the ApiNode when the agent makes no writes
- `toolbox_ids` on the ApiNode restricts the LLM to declared tools only (here: `["web_search"]`)
- The `user` prompt uses Jinja2 templating with a pyagentspec-input-hint comment listing all interpolated variables

## Package Manifest Conventions (`package.json`)

- `cinatra.apiVersion`: `"cinatra.ai/v1"`
- `cinatra.kind`: `"agent"` (or `"workflow"`)
- `cinatra.dependencies`: empty array `[]` for agents with no upstream agent dependencies
- No `scripts` field — CI drives all checks directly via `node`/`corepack pnpm`
- No `dependencies` or `devDependencies` — first-party `@cinatra-ai/*` packages go in `peerDependencies` with `peerDependenciesMeta.optional: true`

---

*Convention analysis: 2026-06-09*
