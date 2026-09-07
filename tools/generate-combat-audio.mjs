import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, "assets", "audio", "combat");
await mkdir(output, { recursive: true });

const profiles = {
  "laser-small": { frequency: 760, end: 460, seconds: 0.23, wave: "sine", noise: 0.03 },
  "laser-medium": { frequency: 570, end: 310, seconds: 0.3, wave: "sine", noise: 0.04 },
  "laser-large": { frequency: 390, end: 180, seconds: 0.42, wave: "sine", noise: 0.05 },
  ppc: { frequency: 260, end: 80, seconds: 0.58, wave: "saw", noise: 0.2 },
  missile: { frequency: 170, end: 65, seconds: 0.62, wave: "saw", noise: 0.25 },
  ballistic: { frequency: 105, end: 70, seconds: 0.32, wave: "square", noise: 0.32 },
  "melee-hit": { frequency: 88, end: 42, seconds: 0.42, wave: "square", noise: 0.48 },
  "melee-miss": { frequency: 430, end: 720, seconds: 0.28, wave: "sine", noise: 0.08 }
};

function wav(profile, seed) {
  const rate = 22050;
  const samples = Math.floor(rate * profile.seconds);
  const data = Buffer.alloc(samples * 2);
  let random = seed >>> 0;
  for (let index = 0; index < samples; index += 1) {
    const time = index / rate;
    const progress = index / samples;
    const frequency = profile.frequency * Math.pow(profile.end / profile.frequency, progress);
    const phase = 2 * Math.PI * frequency * time;
    const tone = profile.wave === "square" ? Math.sign(Math.sin(phase)) : profile.wave === "saw" ? 2 * ((frequency * time) % 1) - 1 : Math.sin(phase);
    random = (1664525 * random + 1013904223) >>> 0;
    const noise = ((random / 0xffffffff) * 2 - 1) * profile.noise;
    const attack = Math.min(1, time * 45);
    const envelope = attack * Math.pow(1 - progress, 2.1);
    data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round((tone * 0.68 + noise) * envelope * 32767))), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

for (const [name, profile] of Object.entries(profiles)) {
  const seed = [...name].reduce((total, character) => total * 31 + character.charCodeAt(0), 17);
  await writeFile(join(output, `${name}.wav`), wav(profile, seed));
}
console.log(`Generated ${Object.keys(profiles).length} synchronized combat sounds.`);
