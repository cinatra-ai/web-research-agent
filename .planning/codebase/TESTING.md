# Testing Patterns

**Analysis Date:** 2026-06-09

## Repository Nature

This is a **content-only Cinatra agent extension** repo. There is no `src/` directory and no application TypeScript. No test framework (Jest, Vitest, Mocha, etc.) is installed or configured. No `*.test.*` or `*.spec.*` files exist anywhere in the repo.

The only executable code is `extension-kind-gate.mjs`, a self-contained CI validation gate. Testing for this repo is entirely CI-gate-driven.

## Test Framework

**Runner:** Not applicable — no test framework installed

**Assertion Library:** Not applicable

**Run Commands:**
```bash
# No test script defined in package.json.
# CI runs the following instead of a test suite:

node extension-kind-gate.mjs --package-root .    # Agent OAS validation gate
npm pack --dry-run                                # Package shape validation
```

## CI Gate as Quality Assurance

The primary quality mechanism is `extension-kind-gate.mjs`, a zero-dependency Node script run in GitHub Actions (`/.github/workflows/ci.yml`, `kind-gates` job).

**What the gate validates for `kind: "agent"`:**
- `cinatra/oas.json` parses as valid JSON
- No retired CRM primitive names appear in LLM-visible fields (`system`, `user`, `description`) of the OAS
- No banned type hints (`@cinatra-ai/entity-accounts:account`, `@cinatra-ai/entity-contacts:contact`) appear in LLM-visible strings

**Banned primitive list (enforced by `BANNED_PRIMITIVES` in `extension-kind-gate.mjs`):**
- `lists_*`, `accounts_*`, `contacts_*` family — all retired; must use `crm_*` facade instead

**Exit codes:**
- `0` — gate passes
- `1` — one or more violations found

## Gate Function Design (Testable Units)

All gate validators in `extension-kind-gate.mjs` are exported pure functions (string[] in/out), making them importable for unit testing without triggering CLI side-effects:

| Function | Validates |
|---|---|
| `parseArgs(argv)` | CLI argument parsing |
| `validateAgent(packageRoot)` | Agent OAS JSON + banned primitives |
| `validateWorkflow(packageRoot)` | Workflow package shape + BPMN sidecar |
| `validateWorkflowPackageShape(pkg)` | `package.json` shape for workflow kind |
| `validateBpmnSanity(xml)` | BPMN XML well-formedness + namespace + process count |
| `findWorkflowSidecars(packageRoot)` | Finds all `cinatra/workflow.bpmn` files recursively |
| `runGate(packageRoot)` | Dispatches to `validateAgent` or `validateWorkflow` by kind |

These functions are the intended test surface if unit tests are added in the future.

## Test File Organization

**Location:** No test files exist. If added:
- Co-locate test files next to `extension-kind-gate.mjs` at repo root, or place in a `test/` directory
- Naming: `extension-kind-gate.test.mjs` or `test/extension-kind-gate.test.mjs`

**Structure:** Not applicable — no tests exist.

## Mocking

**Framework:** Not applicable

**Patterns:** The gate functions accept `packageRoot` as a string, so tests would use a temporary directory with fixture files rather than mocking `fs` calls. All validators are pure with respect to their return values (no side effects beyond reading files).

## Fixtures and Factories

**Test Data:** No fixtures exist. If added, fixtures would include:
- Minimal valid `cinatra/oas.json` (no banned primitives)
- `cinatra/oas.json` containing banned CRM primitives
- Valid and malformed `cinatra/workflow.bpmn` XML

**Location:** Not applicable — no test infrastructure exists.

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**View Coverage:** Not applicable.

## Test Types

**Unit Tests:** Not present. The gate's exported pure functions are designed to be unit-testable.

**Integration Tests:** Not present. The GitHub Actions CI acts as the integration check — it runs the gate against the actual repo files on every push and pull request to `main`.

**E2E Tests:** Not applicable.

## CI Pipeline as Test Substitute

The full CI pipeline (`.github/workflows/ci.yml`) runs in two jobs:

**`build` job (sequential steps):**
1. Classify repo — detects first-party `@cinatra-ai/*` peer dependencies
2. Install dependencies (skipped for source-mirror repos with first-party peers)
3. Typecheck (skipped for source mirrors; uses `tsc --noEmit` for standalone repos)
4. Test — runs `pnpm test --if-present` (no-op here since no `test` script is defined)
5. Pack dry run — `npm pack --dry-run` validates publish payload shape

**`kind-gates` job (runs after `build`):**
- Runs `node extension-kind-gate.mjs --package-root .` to validate agent OAS surface

**Trigger:** Push and pull_request to `main` branch.

## Common Patterns

**Async Testing:** Not applicable — no async code in `extension-kind-gate.mjs` (all I/O is synchronous `readFileSync`/`readdirSync`).

**Error Testing:** The gate functions return string arrays of errors; assertions would check that the returned array is empty (pass) or contains specific error substrings (fail).

## Gaps

- No test suite exists for `extension-kind-gate.mjs` despite it being complex validation logic (XML parser, regex-based primitive scanner, recursive directory walker)
- The `validateBpmnSanity` function's tag-balance walk and namespace resolution logic is non-trivial and untested beyond the live CI run
- No property-based or fuzz testing for the BPMN XML parser path

---

*Testing analysis: 2026-06-09*
