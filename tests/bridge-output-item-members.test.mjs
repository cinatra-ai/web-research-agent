// The bridge outputs of this agent declare what a consumer reads.
//
// The runtime asks the model for exactly the shape this package declares, and
// an object level with no declared members is sent closed and empty — so an
// answer carries nothing inside it. Every list output therefore either declares
// its item members here, or records in its own description that its shape is
// intentionally free-form and why.
//
// The three places a shape is declared — the flow's own outputs, the research
// node's outputs and the end node's outputs — must say the same thing, because
// the level a consumer reads depends on where it reads.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oas = JSON.parse(readFileSync(path.join(root, "cinatra/oas.json"), "utf8"));
const components = oas.$referenced_components ?? {};

/** Every place one output title is declared: the flow, the research node, the end node. */
function sites(title) {
  const found = [];
  const push = (where, outputs) => {
    const declared = (outputs ?? []).find((o) => o?.title === title);
    if (declared) found.push({ where, declared });
  };
  push("flow", oas.outputs);
  push("research", components.research?.outputs);
  push("end", components.end?.outputs);
  return found;
}

/** The member map a declaration carries, in either agentspec spelling. */
function members(declared) {
  const items = declared.items ?? declared.json_schema?.items ?? null;
  if (!items || typeof items !== "object" || Array.isArray(items)) return null;
  const props = items.properties;
  if (!props || typeof props !== "object" || Object.keys(props).length === 0) return null;
  return props;
}

const FREE_FORM_WORDS = ["free-form", "free form", "freeform", "arbitrary", "unstructured"];

test("enrichedRows records in its own description that its shape is intentionally free-form", () => {
  const found = sites("enrichedRows");
  assert.equal(found.length, 3, "enrichedRows is not declared in all three places");
  for (const { where, declared } of found) {
    const text = declared.description;
    assert.equal(typeof text, "string", `${where}: enrichedRows carries no description`);
    assert.ok(
      FREE_FORM_WORDS.some((word) => text.toLowerCase().includes(word)),
      `${where}: enrichedRows' description does not record the shape as free-form`,
    );
    assert.ok(
      /researchNotes/.test(text) && /outputSchema/.test(text),
      `${where}: enrichedRows' description does not say what the row carries or why the shape is the caller's`,
    );
  }
});

test("failures declares the members its consumers read", () => {
  const found = sites("failures");
  assert.equal(found.length, 3, "failures is not declared in all three places");
  for (const { where, declared } of found) {
    const props = members(declared);
    assert.notEqual(props, null, `${where}: failures declares no item members`);
    for (const name of ["rowIndex", "error", "detail"]) {
      assert.ok(props[name], `${where}: failures does not declare ${name}`);
    }
    assert.equal(props.rowIndex.type, "integer", `${where}: failures.rowIndex is not an integer`);
    assert.equal(props.error.type, "string", `${where}: failures.error is not a string`);
    assert.equal(props.detail.type, "string", `${where}: failures.detail is not a string`);
  }
});

test("webChecks declares the members its consumers read", () => {
  const found = sites("webChecks");
  assert.equal(found.length, 3, "webChecks is not declared in all three places");
  for (const { where, declared } of found) {
    const props = members(declared);
    assert.notEqual(props, null, `${where}: webChecks declares no item members`);
    for (const name of ["url", "reachable", "note"]) {
      assert.ok(props[name], `${where}: webChecks does not declare ${name}`);
    }
    assert.equal(props.url.type, "string", `${where}: webChecks.url is not a string`);
    assert.equal(props.reachable.type, "boolean", `${where}: webChecks.reachable is not a boolean`);
    assert.equal(props.note.type, "string", `${where}: webChecks.note is not a string`);
  }
});

test("the three declaration places agree, member for member", () => {
  for (const title of ["failures", "webChecks"]) {
    const shapes = sites(title).map(({ where, declared }) => ({
      where,
      names: Object.keys(members(declared) ?? {}).sort(),
    }));
    assert.ok(shapes[0].names.length > 0, `${title}: no place declares any member`);
    for (const shape of shapes.slice(1)) {
      assert.deepEqual(shape.names, shapes[0].names, `${title}: ${shape.where} declares other members than ${shapes[0].where}`);
    }
  }
});
