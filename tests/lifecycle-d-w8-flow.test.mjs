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
  assert.deepEqual(start.metadata.cinatra.required, ["prompt"]);
});

test("(18) the rows may come from an artifact or a file", () => {
  const source = start.inputs.find((i) => i.title === "rowsSource");
  assert.ok(source, "there is no way to name where the rows come from");
  assert.deepEqual(source.json_schema.properties.type.enum, ["artifact", "file"]);
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
