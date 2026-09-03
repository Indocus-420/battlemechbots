import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

test("builds a duplicate-safe Foundry vehicle import from local HBS data", () => {
  const source = path.resolve("C:/Users/Indocus/Documents/Codex/2026-08-05/pl/outputs/hbs-battletech-foundry-import.json");
  if (!fs.existsSync(source)) return;
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "bmb-hbs-vehicles-"));
  execFileSync(process.execPath, ["tools/build-hbs-vehicle-import.mjs", source, output], { cwd: path.resolve("."), stdio: "pipe" });
  const payload = JSON.parse(fs.readFileSync(path.join(output, "hbs-vehicles-foundry-actors.json"), "utf8"));
  const report = JSON.parse(fs.readFileSync(path.join(output, "hbs-vehicles-validation.json"), "utf8"));
  assert.equal(payload.actors.length, 21);
  assert.equal(new Set(payload.actors.map(actor => actor.name)).size, 21);
  assert.equal(new Set(payload.actors.map(actor => actor.flags["battletech-foundry-system"].hbsSourceId)).size, 21);
  assert.equal(report.passed, true);
  assert.equal(report.unresolvedComponents, 0);
  assert.equal(report.embeddedItemCount, 79);
  assert.ok(payload.actors.every(actor => actor.img.endsWith(".svg")));
  assert.ok(payload.actors.every(actor => actor.prototypeToken.texture.src === actor.img));
  assert.ok(payload.actors.every(actor => actor.flags["battletech-foundry-system"].presentation.sound.endsWith(".wav")));
  const macro = fs.readFileSync(path.join(output, "import-hbs-vehicles-foundry-macro.js"), "utf8");
  assert.match(macro, /battletech-foundry-system/);
  assert.match(macro, /nameConflict\?\.type === "vehicle"/);
  assert.match(macro, /managed\.update\(\{folder:folder\.id, name:source\.name, img:source\.img, prototypeToken:source\.prototypeToken/);
});
