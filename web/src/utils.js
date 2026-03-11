export function formatSince(ts) {
  if (!ts) return "never";
  const deltaMs = Math.max(0, Date.now() - ts);
  const s = Math.floor(deltaMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${(m % 60)}m ago`;
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomHash(slot) {
  const hex = (Math.imul(slot, 2654435761) >>> 0).toString(16).padStart(8, "0");
  const tail = (Math.random() * 0xffffffff >>> 0).toString(16).padStart(8, "0");
  return `0x${hex}${tail}...`;
}

export function truncateRoot(root) {
  if (!root || typeof root !== "string") return "0x-";
  return root.length > 13 ? `${root.slice(0, 12)}...` : root;
}

export function asNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function pickFirstNumber(obj, keys, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return null;
  seen.add(obj);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const n = asNumber(obj[key]);
      if (n != null) return n;
    }
  }
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of values) {
    const n = pickFirstNumber(v, keys, seen);
    if (n != null) return n;
  }
  return null;
}

export function pickFirstString(obj, keys, seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return null;
  seen.add(obj);
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && typeof obj[key] === "string") return obj[key];
  }
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const v of values) {
    const s = pickFirstString(v, keys, seen);
    if (typeof s === "string") return s;
  }
  return null;
}
