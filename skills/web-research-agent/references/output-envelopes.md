# Output Envelopes

## Early-error envelope — input bounds violated

Return this immediately when `rows.length` is outside [1, 20] or `sources.length` exceeds 10 (do NOT process any row):

```json
{
  "enrichedRows": [],
  "extractionNotes": "Input bounds violated — rows.length must be in [1, 20] and sources.length must be at most 10.",
  "failures": [{ "rowIndex": -1, "error": "input_bounds" }],
  "webChecks": []
}
```

## Early-error envelope — missing prompt

Return this immediately when `prompt` is empty or missing (do NOT process any row):

```json
{
  "enrichedRows": [],
  "extractionNotes": "prompt must be a non-empty string.",
  "failures": [{ "rowIndex": -1, "error": "missing_prompt" }],
  "webChecks": []
}
```

## Success envelope shape

Return EXACTLY this JSON shape (no Markdown, no surrounding prose):

```json
{
  "enrichedRows": [
    { "<original fields>": "...", "researchNotes": ["..."] }
  ],
  "extractionNotes": "1-3 sentence narrative — N rows researched, M failures, P URLs checked.",
  "failures": [
    { "rowIndex": 2, "error": "no_data", "detail": "no public information found about the field" }
  ],
  "webChecks": [
    { "url": "https://example.com", "reachable": true }
  ]
}
```

Rules:
- All 4 keys MUST be present (use `[]` for empty arrays, never omit).
- `enrichedRows.length === rows.length` in success cases; `[]` only in early-error envelopes.
- `extractionNotes` is a non-empty string in all cases.

## webChecks entry shape

```json
{
  "url": "https://example.com",
  "resolvedUrl": "https://example.com/final",
  "reachable": true,
  "note": "optional 1-sentence note"
}
```

- `url` (required) — the URL as first attempted.
- `resolvedUrl` (optional) — final URL after redirects, if known.
- `reachable` (required, strict boolean) — `false` for 404/timeout/CAPTCHA/no-content/JS-rendered-with-no-static-content.
- `note` (optional) — e.g. "redirected to /pricing-2024", "CAPTCHA-protected", "no static content".

Each URL is captured EXACTLY ONCE (deduplicated by URL). Unreachable URLs are still captured — they are observations, not failures, unless the unreachability is the row's central verifiable fact and no alternative source is available.

## enrichedRows contract

Every input row gets one slot in `enrichedRows[]` at the same index. Each slot is the ORIGINAL row plus:

- `researchNotes: string[]` — REQUIRED. 1-N notes documenting what was verified, corroborated, corrected, or could-not-be-confirmed. Even on failure, include at least one note describing the research attempt. Never omit; never set to an empty array.
- Any additional fields the caller's `outputSchema` requests.

If `outputSchema` is non-empty:

- The composed slot MUST conform to `outputSchema`. If not, the slot is the ORIGINAL row plus `researchNotes: ["skipped due to schema_violation: <reason>"]`, AND the row is added to `failures[]` with `{rowIndex, error: "schema_violation", detail: "<reason>"}`.

If `outputSchema` is `{}` (default):

- The composed slot is the ORIGINAL row plus `researchNotes`. No schema validation is performed.

**Invariant:** `enrichedRows.length === rows.length`. The per-row loop runs to completion; failures are captured in `failures[]` while the row slot is still emitted.

## failures entry shape

```json
{
  "rowIndex": 2,
  "error": "no_data",
  "detail": "no public information found about the company headcount field"
}
```

- `rowIndex` — 0-indexed position in `rows[]`. Aggregate-level failures use `rowIndex: -1`.
- `error` — short snake_case tag. Canonical tags: `no_data`, `web_search_failed`, `schema_violation`, `input_bounds`, `missing_prompt`. Invent a short snake_case tag for novel failure modes and document it in `detail`.
- `detail` — optional 1-sentence elaboration.
