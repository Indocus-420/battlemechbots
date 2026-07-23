import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the system manifest enables the authenticated Foundry system socket", () => {
  const manifest = JSON.parse(readFileSync(new URL("../system.json", import.meta.url), "utf8"));
  assert.equal(manifest.socket, true);
  assert.equal(manifest.version, "0.14.0-alpha.0");
  assert.equal(manifest.compatibility.minimum, "14.363");
  assert.equal(manifest.compatibility.verified, "14.364");
});
