import test from "node:test";
import assert from "node:assert/strict";
import { applyAction } from "./worker.js";

const run = "2026-11-17-0";
test("caps and one role per run", () => {
  const s = {};
  assert.equal(applyAction(s, { run, role: "tank", name: "A", cls: "warrior", action: "join" }), null);
  assert.ok(applyAction(s, { run, role: "tank", name: "B", cls: "paladin", action: "join" }));
  assert.equal(applyAction(s, { run, role: "healer", name: "A", cls: "warrior", action: "join" }), null);
  assert.equal(s[run].tank.length, 0);
  assert.equal(s[run].healer.length, 1);
});
test("failed move keeps old spot", () => {
  const s = {};
  applyAction(s, { run, role: "tank", name: "A", cls: "warrior", action: "join" });
  applyAction(s, { run, role: "healer", name: "B", cls: "priest", action: "join" });
  assert.ok(applyAction(s, { run, role: "healer", name: "A", cls: "warrior", action: "join" }));
  assert.equal(s[run].tank.length, 1);
});
test("rejects bad input", () => {
  assert.ok(applyAction({}, { run: "bad", role: "dps", name: "A", cls: "mage", action: "join" }));
  assert.ok(applyAction({}, { run, role: "dps", name: "A", cls: "nope", action: "join" }));
});
