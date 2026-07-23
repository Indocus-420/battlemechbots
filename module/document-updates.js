function cloneValue(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build a complete Item system payload while changing only the requested fields.
 *
 * Foundry v14 can re-apply TypeDataModel defaults when an embedded Item receives
 * only dotted system updates. Sending the complete source prevents unrelated
 * fields such as critical-slot count and component effect from being reset.
 */
export function mergeItemSystemSource(systemSource, changes = {}) {
  const merged = cloneValue(systemSource ?? {});
  for (const [path, value] of Object.entries(changes)) {
    const parts = path.split(".");
    let target = merged;
    for (const part of parts.slice(0, -1)) target = target[part] ??= {};
    target[parts.at(-1)] = cloneValue(value);
  }
  return merged;
}
