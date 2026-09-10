// W8 (cinatra#3096) item (18) — the inputs a person sets are drawn on the setup form.
// The setup form draws the fields named in metadata.cinatra.required; a field
// left out of both lists is never shown and never prompted for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));
const start = oas.$referenced_components.start;
const meta = start.metadata.cinatra;

function covers() {
  const declared = new Set([...(meta.required ?? []), ...(meta.hidden ?? [])]);
  return start.inputs.map((i) => i.title).filter((t) => !declared.has(t));
}

test("(18) the row source is drawn on the setup form beside the goal", () => {
  for (const field of ["rowsSource", "prompt"]) {
    assert.ok((meta.required ?? []).includes(field), `${field} is not drawn on the setup form`);
    assert.ok(!(meta.hidden ?? []).includes(field), `${field} is hidden from the person`);
  }
});

test("every setup input is either drawn or declared as plumbing", () => {
  assert.deepEqual(covers(), [], "these inputs are in neither required nor hidden");
});

test("(18) the rows a dispatcher passes are declared as plumbing with their default", () => {
  for (const field of ["rows"]) {
    assert.ok((meta.hidden ?? []).includes(field), `${field} is not declared as plumbing`);
    const declared = start.inputs.find((i) => i.title === field);
    assert.notEqual(declared.default, undefined, `${field} is hidden without a default`);
  }
});

test("(18) the research step declares the row source it reads", () => {
  const research = oas.$referenced_components.research;
  const declared = new Set(research.inputs.map((i) => i.title));
  const body = JSON.stringify([research.url, research.data, research.query_params, research.headers]);
  const referenced = new Set([...body.matchAll(/{{\s*([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]));
  referenced.delete("CINATRA_BASE_URL");
  for (const name of referenced) {
    assert.ok(declared.has(name), `${name} is referenced by the step but not declared in its inputs`);
  }
  assert.ok(declared.has("rowsSource"), "the row source never reaches the step");
});
