const SYSTEM_PATH = "systems/battletech-foundry-system/assets/vfx";
const SYSTEM_ID = "battletech-foundry-system";

export function weaponEffectProfile(weapon = {}) {
  const name = String(weapon.name ?? "").toLowerCase();
  const type = weapon.system?.weaponType ?? "laser";
  if (name.includes("small laser")) return { key: "smallLaser", texture: `${SYSTEM_PATH}/beam-red.svg`, impact: `${SYSTEM_PATH}/impact-red.svg`, pathType: "linear", frequency: 680, duration: 120 };
  if (name.includes("medium laser")) return { key: "mediumLaser", texture: `${SYSTEM_PATH}/beam-green.svg`, impact: `${SYSTEM_PATH}/impact-green.svg`, pathType: "linear", frequency: 520, duration: 160 };
  if (name.includes("large laser")) return { key: "largeLaser", texture: `${SYSTEM_PATH}/beam-blue.svg`, impact: `${SYSTEM_PATH}/impact-blue.svg`, pathType: "linear", frequency: 360, duration: 220 };
  if (type === "ppc" || name.includes("particle projection")) return { key: "ppc", texture: `${SYSTEM_PATH}/ppc.svg`, impact: `${SYSTEM_PATH}/impact-blue.svg`, pathType: "weave", frequency: 240, duration: 320 };
  if (type === "missile") return { key: "missile", texture: `${SYSTEM_PATH}/missile.svg`, impact: `${SYSTEM_PATH}/impact-orange.svg`, pathType: "arc", frequency: 150, duration: 360 };
  if (type === "autocannon") return { key: "autocannon", texture: `${SYSTEM_PATH}/tracer.svg`, impact: `${SYSTEM_PATH}/impact-orange.svg`, pathType: "linear", frequency: 110, duration: 180 };
  return { key: "laser", texture: `${SYSTEM_PATH}/beam-red.svg`, impact: `${SYSTEM_PATH}/impact-red.svg`, pathType: "linear", frequency: 440, duration: 160 };
}

export function jb2aWeaponEffectProfile(weapon = {}) {
  const name = String(weapon.name ?? "").toLowerCase();
  const type = weapon.system?.weaponType ?? "laser";
  if (name.includes("small laser")) return { projectile: "jb2a.lasershot.red", impact: null };
  if (name.includes("medium laser")) return { projectile: "jb2a.lasershot.green", impact: null };
  if (name.includes("large laser")) return { projectile: "jb2a.lasershot.blue", impact: "jb2a.explosion.02.blue" };
  if (type === "ppc" || name.includes("particle projection")) return { projectile: "jb2a.lightning_bolt.narrow.blue", impact: "jb2a.explosion.04.blue" };
  if (type === "missile") return { projectile: "jb2a.magic_missile.purple", impact: "jb2a.explosion.01.orange" };
  if (type === "autocannon") return { projectile: "jb2a.bullet.01.orange", impact: "jb2a.explosion.01.orange" };
  return { projectile: "jb2a.lasershot.red", impact: null };
}

export async function playJB2AWeaponEffect(origin, target, weapon, { hit = true } = {}) {
  const modules = globalThis.game?.modules;
  if (!modules?.get?.("sequencer")?.active || !modules?.get?.("JB2A_DnD5e")?.active) return false;
  if (typeof globalThis.Sequence !== "function" || !globalThis.Sequencer?.Database?.getEntry) return false;
  const profile = jb2aWeaponEffectProfile(weapon);
  try {
    if (!globalThis.Sequencer.Database.getEntry(profile.projectile)) return false;
    const sequence = new globalThis.Sequence();
    sequence.effect().file(profile.projectile).atLocation(origin).stretchTo(target);
    if (hit && profile.impact && globalThis.Sequencer.Database.getEntry(profile.impact)) {
      sequence.effect().file(profile.impact).atLocation(target);
    }
    await sequence.play();
    return true;
  } catch (error) {
    console.warn("BMFS | JB2A effect unavailable; using built-in effect", error);
    return false;
  }
}

function playProceduralAudio(profile, hit) {
  const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = profile.key === "autocannon" ? "square" : profile.key === "missile" ? "sawtooth" : "sine";
  oscillator.frequency.setValueAtTime(profile.frequency, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, profile.frequency * (hit ? 0.55 : 1.25)), context.currentTime + (profile.duration / 1000));
  gain.gain.setValueAtTime(0.06, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (profile.duration / 1000));
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + (profile.duration / 1000));
  oscillator.addEventListener("ended", () => void context.close());
}

export function mechPresentationProfile(actor = {}) {
  const stored = actor.flags?.[SYSTEM_ID]?.presentation ?? {};
  const tonnage = Number(actor.system?.mech?.tonnage ?? 50);
  const weightClass = stored.weightClass ?? (tonnage <= 35 ? "light" : tonnage <= 55 ? "medium" : tonnage <= 75 ? "heavy" : "assault");
  return {
    weightClass,
    accent: stored.accent ?? "hsl(195 72% 55%)",
    frequency: Number(stored.frequency ?? ({ light: 150, medium: 125, heavy: 100, assault: 80 }[weightClass])),
    duration: Number(stored.duration ?? ({ light: 420, medium: 500, heavy: 580, assault: 660 }[weightClass])),
    image: stored.image ?? actor.img ?? "icons/svg/mystery-man.svg",
    sound: stored.sound ?? null
  };
}

export async function playMechActivationEffect(token, actor, { visual = true, audio = true } = {}) {
  if (!token || !actor) return false;
  const profile = mechPresentationProfile(actor);
  if (audio && profile.sound) {
    const helper = globalThis.AudioHelper ?? globalThis.foundry?.audio?.AudioHelper;
    await helper?.play?.({ src: profile.sound, volume: 0.32, autoplay: true, loop: false }, false);
  }
  if (!visual || !globalThis.canvas?.ready || !globalThis.CONFIG?.Canvas?.vfx?.enabled) return Boolean(audio && profile.sound);
  const effect = new foundry.canvas.vfx.VFXEffect({
    name: `BMFS activation: ${actor.name ?? "BattleMech"}`,
    components: {
      activation: {
        type: "singleAttack",
        path: [
          { reference: "origin", property: "center" },
          { reference: "target", property: "center" }
        ],
        pathType: "linear",
        projectile: { texture: profile.image, speed: 1000, size: { w: 1, h: 1 }, animations: [{ function: "followPath", params: {} }] },
        impact: { texture: profile.image, duration: profile.duration, size: { w: 96, h: 96 } }
      }
    },
    timeline: [{ component: "activation", position: 0 }]
  });
  await effect.play({ origin: token.document ?? token, target: token.document ?? token });
  return true;
}

export async function playWeaponEffect(origin, target, weapon, { hit = true, audio = true, jb2a = true } = {}) {
  if (!globalThis.canvas?.ready || !origin || !target) return false;
  const profile = weaponEffectProfile(weapon);
  if (audio) playProceduralAudio(profile, hit);
  if (jb2a && await playJB2AWeaponEffect(origin, target, weapon, { hit })) return true;
  if (!globalThis.CONFIG?.Canvas?.vfx?.enabled) return false;
  const effect = new foundry.canvas.vfx.VFXEffect({
    name: `BMFS ${profile.key}`,
    components: {
      flight: {
        type: "singleAttack",
        path: [
          { reference: "origin", property: "center" },
          { reference: "target", property: "center" }
        ],
        pathType: profile.pathType,
        projectile: {
          texture: profile.texture,
          speed: profile.key === "missile" ? 70 : 240,
          size: profile.key === "ppc" ? { w: 64, h: 22 } : { w: 46, h: 12 },
          animations: [{ function: "followPath", params: {} }]
        },
        ...(hit ? { impact: {
          texture: profile.impact,
          duration: 260,
          size: { w: 58, h: 58 }
        } } : {})
      }
    },
    timeline: [{ component: "flight", position: 0 }]
  });
  await effect.play({ origin: origin.document ?? origin, target: target.document ?? target });
  return true;
}
