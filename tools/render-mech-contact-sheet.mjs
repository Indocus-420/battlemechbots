import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.env.NODE_PATH, "package.json"));
const sharp = require("sharp");

const root = path.resolve(import.meta.dirname, "..");
async function renderSheet(directory, output, columns = 5) {
  const files = (await fs.readdir(path.join(root, "assets", directory))).filter(file => file.endsWith(".svg")).sort();
  const size = 180;
  const gap = 10;
  const rows = Math.ceil(files.length / columns);
  const composites = await Promise.all(files.map(async (file, index) => ({
    input: await sharp(path.join(root, "assets", directory, file)).resize(size, size).png().toBuffer(),
    left: gap + (index % columns) * (size + gap),
    top: gap + Math.floor(index / columns) * (size + gap)
  })));
  await sharp({ create: {
    width: gap + columns * (size + gap), height: gap + rows * (size + gap), channels: 4, background: "#111821"
  }}).composite(composites).png().toFile(path.join(root, "tools", output));
  return files.length;
}

const mechs = await renderSheet("mechs", "mech-contact-sheet.png");
const items = await renderSheet("items", "item-contact-sheet.png", 8);
const vehicles = await renderSheet("vehicles", "vehicle-contact-sheet.png", 3);
console.log(`Rendered ${mechs} mechs, ${items} items, and ${vehicles} vehicles.`);
