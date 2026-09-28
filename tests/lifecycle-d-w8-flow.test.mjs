// W8 (cinatra#3096) item 18 — the goal as one text field, the rows from an artifact or a file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));
const refs = oas.$referenced_components;
const start = refs.start;

test("(18) the goal is one text field, and the only thing the run insists on", () => {
  const prompt = start.inputs.find((i) => i.title === "prompt");
  assert.equal(prompt.type, "string");
  assert.ok(prompt.description, "the goal field does not say what it is for");
  assert.deepEqual(start.metadata.cinatra.required, ["rowsSource", "prompt"]);
});

test("(18) the rows may come from an artifact or a file", () => {
  const source = start.inputs.find((i) => i.title === "rowsSource");
  assert.ok(source, "there is no way to name where the rows come from");
  assert.deepEqual(source.json_schema.properties.type.enum, ["artifact"]);
  assert.ok(!(start.metadata.cinatra.hidden ?? []).includes("rowsSource"), "the source is hidden from the person");
  const rows = start.inputs.find((i) => i.title === "rows");
  assert.deepEqual(rows.default, [], "the rows are still demanded up front");
  assert.equal(rows.json_schema.minItems, undefined, "an empty rows list is still refused");
  assert.match(refs.research.data.system, /rowsSource/, "the step never reads the source");
  assert.ok(
    (oas.data_flow_connections ?? []).some((e) => e.source_output === "rowsSource" && e.destination_node.$component_ref === "research"),
    "the source never reaches the step",
  );
});

const LLM_BRIDGE = "/api/llm-bridge";
const PASSTHROUGH = "/api/agents/passthrough";
// The tools the host's deterministic passthrough serves, as declared in the
// host's src/lib/extension-scoped-tools.ts.
const PASSTHROUGH_TOOLS = ["extension_data", "extension_tool", "artifacts_list", "artifacts_get", "artifact_content_read"];
const ROWS_ROAD =
  '{% if rows %}given{% elif rowsSource and rowsSource.type == "artifact" and rowsSource.ref %}artifact{% else %}none{% endif %}';
const ROWS_SOURCE_DESCRIPTION =
  "Where the rows come from: a structured-data artifact already in the workspace. A file becomes such an artifact when it is uploaded to the Artifacts library.";

/** The node ids a run passes, from `start`, when `rows_road` renders `road`. */
function walk(road) {
  const edges = oas.control_flow_connections ?? [];
  const ids = ["start"];
  let at = "start";
  while (at !== "end" && ids.length < 20) {
    const out = edges.filter((e) => e.from_node.$component_ref === at);
    let next;
    if (refs[at]?.component_type === "BranchingNode") {
      const branch = refs[at].mapping?.[road] ?? "default";
      assert.ok((refs[at].branches ?? []).includes(branch), `node ${at} does not declare the branch ${branch}`);
      next = out.filter((e) => e.from_branch === branch);
    } else {
      next = out;
    }
    assert.equal(next.length, 1, `node ${at} has ${next.length} way(s) on for the road ${road}`);
    at = next[0].to_node.$component_ref;
    ids.push(at);
  }
  return ids;
}

const hasDataEdge = (from, output, to, input) =>
  (oas.data_flow_connections ?? []).some(
    (e) =>
      e.source_node.$component_ref === from &&
      e.source_output === output &&
      e.destination_node.$component_ref === to &&
      e.destination_input === input,
  );

test("(18) rows handed over directly never reach the read", () => {
  assert.equal(refs.rows_road?.template, ROWS_ROAD, "the road is not chosen by the rows and their source");
  assert.ok(!("given" in (refs.rows_source.mapping ?? {})), "rows handed over are mapped to a branch");
  const ids = walk("given");
  assert.deepEqual(ids, ["start", "rows_road", "rows_source", "research", "research_summary", "end"]);
  assert.deepEqual(
    ids.filter((id) => refs[id]?.component_type === "ApiNode" && String(refs[id].url).includes(PASSTHROUGH)),
    [],
    "rows handed over are read again",
  );
});

test("(18) a rows artifact is read before the research", () => {
  assert.equal(refs.rows_source?.mapping?.artifact, "artifact");
  assert.deepEqual(walk("artifact"), ["start", "rows_road", "rows_source", "rows_ref", "read_rows", "research", "research_summary", "end"]);
  assert.equal(refs.rows_ref.template, "{{ rowsSource.ref }}");
  const read = refs.read_rows;
  assert.ok(read.url.endsWith("/api/agents/passthrough"), "the read does not go through the passthrough");
  assert.equal(read.http_method, "POST", "the read is not a POST to the passthrough");
  assert.deepEqual(read.data, {
    tool: "artifact_content_read",
    input: { artifactId: "{{ rowsArtifactId }}" },
    agent_run_id: "{{ cinatra_run_id }}",
  });
  assert.ok(hasDataEdge("rows_ref", "output", "read_rows", "rowsArtifactId"), "the source's reference never reaches the read");
  assert.ok(hasDataEdge("read_rows", "text", "research", "rowsText"), "the rows that were read never reach the step");
  assert.match(refs.research.data.user, /Rows read from the named artifact[^\n]*\{\{ rowsText \}\}/, "the step's text never shows the rows that were read");
  assert.ok(hasDataEdge("start", "cinatra_run_id", "read_rows", "cinatra_run_id"), "the run id never reaches the read");
  const rowsText = refs.research.inputs.find((i) => i.title === "rowsText");
  assert.equal(rowsText?.default, "", "the step has no rows text when nothing was read");
  for (const inputs of [oas.inputs, start.inputs]) {
    const last = inputs[inputs.length - 1];
    assert.equal(last.title, "cinatra_run_id", "the run id is not the last input");
    assert.equal(last.default, "", "the run id has no empty default");
  }
  const hidden = start.metadata.cinatra.hidden ?? [];
  assert.equal(hidden[hidden.length - 1], "cinatra_run_id", "the run id is not declared as plumbing");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(
    (pkg.cinatra.dependencies ?? []).some((d) => d.kind === "artifact" && d.packageName === "@cinatra-ai/json-artifact"),
    "the package declares no JSON artifact dependency, so the read is not admitted",
  );
});

test("(18) a source that names no artifact ends the run in plain words and never researches", () => {
  assert.equal(refs.rows_source?.mapping?.none, "none");
  const ids = walk("none");
  assert.deepEqual(ids, ["start", "rows_road", "rows_source", "research_summary", "end"]);
  assert.deepEqual(
    ids.filter((id) => String(refs[id]?.url ?? "").includes(LLM_BRIDGE)),
    [],
    "a source that names no artifact still researches",
  );
  for (const inputs of [oas.inputs, start.inputs]) {
    const source = inputs.find((i) => i.title === "rowsSource");
    assert.deepEqual(source.json_schema.properties.type.enum, ["artifact"]);
    assert.equal(source.description, ROWS_SOURCE_DESCRIPTION, "the source does not say how a file becomes an artifact");
  }
  for (const i of refs.research_summary.inputs) assert.ok("default" in i, `the ending's input ${i.title} has no default`);
  for (const outputs of [refs.end.outputs, oas.outputs]) {
    for (const o of outputs) assert.ok("default" in o, `the output ${o.title} has no default`);
  }
  for (const o of oas.outputs) {
    const endCopy = refs.end.outputs.find((e) => e.title === o.title);
    assert.deepEqual(o.default, endCopy?.default, `the flow's output ${o.title} does not carry the ending's default`);
  }
});

test("(18) every tool a step's text names is one the flow can reach", () => {
  const offenders = new Set();
  const texts = [];
  for (const comp of Object.values(refs)) {
    if (comp?.component_type !== "ApiNode") continue;
    for (const text of [comp.data?.system, comp.data?.user]) if (typeof text === "string") texts.push(text);
    if (!String(comp.url).includes(LLM_BRIDGE)) continue;
    const tools = new Set(comp.data?.toolbox_ids ?? []);
    for (const text of [comp.data?.system ?? "", comp.data?.user ?? ""]) {
      for (const line of text.split("\n")) {
        if (line.includes("Do not call") || line.includes("Do NOT call")) continue;
        for (const token of line.match(/\b[a-z]+(?:_[a-z]+)+\b/g) ?? []) if (!tools.has(token)) offenders.add(token);
      }
    }
  }
  assert.deepEqual([...offenders], [], "a step's text names a tool its node cannot reach");
  assert.deepEqual(refs.research.data.toolbox_ids, ["web_search"], "the research step reaches more than the web search");
  for (const text of texts) assert.ok(!text.includes("read the file"), "a step's text asks for a file read");
  for (const comp of Object.values(refs)) {
    if (comp?.component_type !== "ApiNode" || !String(comp.url).includes(PASSTHROUGH)) continue;
    assert.ok(PASSTHROUGH_TOOLS.includes(comp.data?.tool), `${comp.id} calls ${comp.data?.tool}, which the passthrough does not serve`);
  }
});
