// Lifecycle D W8 — the web research agent's plain-language ending
// (cinatra#3096 item 19).
//
// (19) A run that ends closes with a plain sentence — how many rows were
// enriched, or how many could not be and that each carries a note saying why,
// or, when nothing was researched, why not — never with the raw values the run
// hands on. The failure tags the research step names come from the pack's
// declared skill, cinatra-ai/web-research-skill; every one of them reaches its
// own sentence or the fallback sentence, and a bare tag is never printed.
//
// The last two arms re-state the runtime loader's two mount rules over this
// flow, as cinatra-ai/email-recipient-selection-agent holds them in its own
// suite: (A) every input a step requires has a source on every path that
// reaches it, and (B) an OutputMessageNode declares only inputs its template
// reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));

const refs = oas.$referenced_components;
const nodesOfType = (type) => Object.values(refs).filter((n) => n.component_type === type);
const controlEdges = (oas.control_flow_connections ?? []).map((e) => ({
  from: e.from_node.$component_ref,
  to: e.to_node.$component_ref,
}));
const hasEdge = (from, to) => controlEdges.some((e) => e.from === from && e.to === to);
const dataEdges = (oas.data_flow_connections ?? []).map((e) => [
  e.source_node.$component_ref + "." + e.source_output,
  e.destination_node.$component_ref + "." + e.destination_input,
]);
const countDataEdges = (from, to) => dataEdges.filter(([f, t]) => f === from && t === to).length;
const outsideComment = (message) => String(message ?? "").replace(/\{#[\s\S]*?#\}/g, "");

const MESSAGE =
  "{# pyagentspec-input-hint (do not remove): {{ enrichedRows }} {{ failures }} #}" +
  "{% if not enrichedRows and failures and failures[0].error == 'missing_prompt' %}" +
  "No rows were researched: the research question was empty, so there was nothing to look up." +
  "{% elif not enrichedRows and failures and failures[0].error == 'input_bounds' %}" +
  "No rows were researched: a run takes from 1 to 20 rows and at most 10 sources, and this request was outside those limits." +
  "{% elif not enrichedRows and failures %}No rows were researched: the research could not start." +
  "{% elif not enrichedRows %}No rows were researched: the run received no rows to work on." +
  "{% elif failures | length >= enrichedRows | length %}" +
  "None of the {{ enrichedRows | length }} rows could be enriched; each row carries a note saying why." +
  "{% elif failures %}{{ failures | length }} of the {{ enrichedRows | length }} rows could not be enriched, " +
  "with a note on each saying why; the other rows were enriched." +
  "{% elif enrichedRows | length == 1 %}One row was enriched." +
  "{% else %}{{ enrichedRows | length }} rows were enriched.{% endif %}";

// ---------------------------------------------------------------------------
// (19) a plain-language ending on an empty or failed result
// ---------------------------------------------------------------------------

test("(19) the run ends in plain language, never in the envelope", () => {
  const summary = refs.research_summary;
  assert.ok(summary, "the run has no closing statement");
  assert.equal(summary.component_type, "OutputMessageNode");
  assert.ok(oas.nodes.some((n) => n.$component_ref === "research_summary"), "the closing statement is not a step of the flow");
  assert.ok(hasEdge("research", "research_summary"), "the research step does not pass the closing statement");
  assert.ok(hasEdge("research_summary", "end"), "the closing statement does not lead to the end");
  assert.ok(!hasEdge("research", "end"), "the run still jumps straight to its end");
  assert.deepEqual(
    refs.end.outputs.map((o) => o.title),
    ["enrichedRows", "extractionNotes", "failures", "webChecks"],
    "the end node no longer carries the values the run hands on",
  );
});

test("(19) an empty, failed or enriched run ends in plain language", () => {
  const summary = refs.research_summary;
  assert.ok(summary, "the run has no closing statement");
  const message = String(summary.message ?? "");
  assert.equal(
    message,
    MESSAGE,
    "each outcome does not reach its own sentence: nothing researched, rows failed, rows enriched",
  );
  assert.match(message, /no rows were researched/i, "an empty or refused run has no plain-language ending");
  assert.match(message, /could not be enriched/i, "a failed row has no plain-language ending");
  assert.match(message, /rows were enriched/i, "an enriched run has no plain-language ending");
  const rendered = outsideComment(message);
  assert.match(rendered, /\benrichedRows\b/, "the sentence never reads the enriched rows");
  assert.match(rendered, /\bfailures\b/, "the sentence never reads the failures");
  assert.equal(summary.metadata?.cinatra?.purpose, "plain-language-web-research-ending");
  assert.deepEqual(summary.inputs, [
    { title: "enrichedRows", type: "array", default: [] },
    { title: "failures", type: "array", default: [] },
  ]);
  assert.equal(countDataEdges("research.enrichedRows", "research_summary.enrichedRows"), 1);
  assert.equal(countDataEdges("research.failures", "research_summary.failures"), 1);
});

test("(19) every failure tag the research step names reaches a plain sentence", () => {
  const summary = refs.research_summary;
  assert.ok(summary, "the run has no closing statement");
  const failures = refs.research.outputs.find((o) => o.title === "failures");
  const described = failures.json_schema.items.properties.error.description;
  const listed = described.slice(described.indexOf(":") + 1, described.indexOf(";"));
  const tags = [...listed.matchAll(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g)].map((m) => m[0]).sort();
  assert.deepEqual(
    tags,
    ["input_bounds", "missing_prompt", "no_data", "schema_violation", "web_search_failed"],
    "the research step names a failure tag the closing statement was not written for",
  );
  const message = String(summary.message ?? "");
  const tested = [...message.matchAll(/\.error\s*==\s*'([^']+)'/g)].map((m) => m[1]);
  for (const tag of tested) {
    assert.ok(tags.includes(tag), `the closing statement tests a tag the research step never names: ${tag}`);
  }
  const fallback = message.indexOf("{% elif not enrichedRows and failures %}");
  const empty = message.indexOf("{% elif not enrichedRows %}");
  assert.ok(fallback >= 0, "a refusal with any other tag has no plain sentence");
  assert.ok(empty >= 0 && fallback < empty, "a refused run is read as an empty one");
  const rendered = outsideComment(message);
  assert.doesNotMatch(rendered, /\{\{\s*failures\s*\}\}/, "the closing statement prints the failure list");
  assert.doesNotMatch(rendered, /\{\{[^}]*\.error[^}]*\}\}/, "the closing statement prints a bare failure tag");
});

// ---------------------------------------------------------------------------
// (A) every required step input has a source on every path that reaches it
// ---------------------------------------------------------------------------

/** The inputs a node CONSUMES: an EndNode names them under `outputs`, every
 *  other node declares `inputs`. */
function consumedInputs(node) {
  if (node.component_type === "EndNode") return node.outputs ?? [];
  return node.inputs ?? [];
}

/** Walk the flow the way the runtime loader does, returning each input it
 *  would demand from the StartStep. */
function unsourcedInputs() {
  const steps = new Map();
  for (const ref of oas.nodes ?? []) steps.set(ref.$component_ref, refs[ref.$component_ref]);
  const beginId = oas.start_node.$component_ref;
  const startTitles = new Set((steps.get(beginId)?.inputs ?? []).map((i) => i.title));
  const flowDataEdges = (oas.data_flow_connections ?? []).map((e) => ({
    from: e.source_node.$component_ref,
    key: `${e.destination_node.$component_ref}.${e.destination_input}`,
  }));
  const successors = (id) => controlEdges.filter((e) => e.from === id).map((e) => e.to);

  const violations = [];
  const visited = new Map();
  const queue = [[beginId, new Set()]];
  while (queue.length > 0) {
    const [id, incoming] = queue.pop();
    let produced = incoming;
    if (visited.has(id)) {
      const seen = visited.get(id);
      if ([...seen].every((k) => produced.has(k))) continue;
      produced = new Set([...produced].filter((k) => seen.has(k)));
    }
    visited.set(id, produced);

    const node = steps.get(id);
    if (!node) continue;
    if (id !== beginId) {
      for (const descriptor of consumedInputs(node)) {
        const key = `${id}.${descriptor.title}`;
        if (produced.has(key)) continue;
        if (Object.hasOwn(descriptor, "default")) continue;
        if (startTitles.has(descriptor.title)) continue;
        violations.push(key);
      }
    }

    const next = new Set(produced);
    for (const edge of flowDataEdges) if (edge.from === id) next.add(edge.key);
    for (const child of successors(id)) queue.push([child, new Set(next)]);
  }
  return violations;
}

test("every required step input has a source on every path that reaches it", () => {
  const found = unsourcedInputs();
  assert.deepEqual(
    found,
    [],
    "the runtime refuses to mount a flow whose step requires an input the StartStep does not carry: " + found.join(", "),
  );
});

// ---------------------------------------------------------------------------
// (B) an OutputMessageNode declares only inputs its template reads
// ---------------------------------------------------------------------------

test("an output message declares only inputs its template reads", () => {
  const offenders = [];
  for (const node of nodesOfType("OutputMessageNode")) {
    const rendered = outsideComment(node.message);
    for (const { title } of node.inputs ?? []) {
      if (!new RegExp(`\\b${title}\\b`).test(rendered)) offenders.push(`${node.id}.${title}`);
    }
  }
  assert.deepEqual(offenders, [], "the runtime rejects an input the template never reads: " + offenders.join(", "));
});
