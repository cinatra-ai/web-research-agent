# Web Research Agent

Hand this agent a small batch of rows — companies, contacts, claims, anything — together with a plain-language research goal, and it will look each one up on the open web and return enriched results. Useful for fact-checking a list, filling in missing fields like headcount or headquarters, and capturing which sources backed each answer.

Install from the Cinatra marketplace. The agent is stateless and requires no external credentials; it uses the `web_search` toolbox provided by the platform.

Invoke with two required inputs: `rows` (an array of 1–20 plain objects) and `prompt` (a natural-language research goal such as "verify the claim against current public information" or "find each company's current headcount and headquarters"). Two optional inputs let callers add context: `sources` (up to 10 reference objects — URL-type sources are fetched, object-type refs are advisory context only and not fetched) and `outputSchema` (a JSON Schema that each enriched row must conform to).

The agent returns four outputs. `enrichedRows` mirrors the input array at the same indices, each row extended with a `researchNotes` string array and any fields the caller's `outputSchema` requests. `extractionNotes` is a short narrative summarising the run. `failures` lists per-row errors with a `rowIndex`, a `error` tag (`no_data`, `web_search_failed`, `schema_violation`), and an optional `detail`. `webChecks` records every URL the agent attempted with a `reachable` boolean and an optional `note`.

For development, clone the repo and run `node extension-kind-gate.mjs` to validate the manifest and README before publishing. The gate mirrors the marketplace extension contract and helps catch issues early; the marketplace runs a broader validation pass at publish time.

If the agent returns an `input_bounds` error, `rows` was outside 1–20 or `sources` exceeded 10 — chunk the input upstream. If `prompt` is empty the agent returns a `missing_prompt` envelope immediately. A `no_data` failure means web search returned nothing usable; the row slot is still present in `enrichedRows` with a note.

## Works with

- The open web (via web search)

## Capabilities

- Enrich a batch of rows from a natural-language research goal
- Verify claims against current public information
- Fill in missing fields like headcount, headquarters, or current role
- Record per-row research notes and reasoning
- Capture per-URL reachability checks for audit and follow-up
