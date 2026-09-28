'use strict';
/* ============================================================
   STURMFALL – Hilfsfunktionen (Mathe, Zufall, Rauschen, Speicher)
   ============================================================ */

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
function smoothstep(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function dampAngle(a, b, lambda, dt) { return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt)); }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rr(rng, a, b) { return a + (b - a) * rng(); }
function ri(rng, a, b) { return Math.floor(a + (b - a + 1) * rng()); }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function weightedPick(rng, list) { // [[item, weight], ...]
  let total = 0; for (const e of list) total += e[1];
  let r = rng() * total;
  for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
  return list[list.length - 1][0];
}

/* Wertrauschen (Value Noise) mit fbm – deterministisch per Seed */
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const SIZE = 256;
  const perm = new Uint16Array(SIZE * 2);
  const vals = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i++) { perm[i] = i; vals[i] = rng() * 2 - 1; }
  for (let i = SIZE - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
  for (let i = 0; i < SIZE; i++) perm[i + SIZE] = perm[i];
  function v(ix, iz) { return vals[perm[(perm[ix & 255] + iz) & 511]]; }
  function noise(x, z) {
    const x0 = Math.floor(x), z0 = Math.floor(z);
    const fx = x - x0, fz = z - z0;
    const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const a = v(x0, z0), b = v(x0 + 1, z0), c = v(x0, z0 + 1), d = v(x0 + 1, z0 + 1);
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uz);
  }
  function fbm(x, z, oct) {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < (oct || 4); i++) { s += noise(x * f, z * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return s / norm;
  }
  return { noise, fbm };
}

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60), r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}

/* localStorage mit Fallback – funktioniert auch, wenn der Speicher blockiert ist */
const Store = {
  mem: {},
  get(key, def) {
    try {
      const raw = localStorage.getItem('sturmfall.' + key);
      if (raw != null) return JSON.parse(raw);
    } catch (e) { if (key in this.mem) return this.mem[key]; }
    return def;
  },
  set(key, val) {
    this.mem[key] = val;
    try { localStorage.setItem('sturmfall.' + key, JSON.stringify(val)); } catch (e) { /* egal */ }
  },
};

/* Kürzeste Distanz Strahl <-> Strecke (für Treffer-Kapseln) */
function rayCapsule(o, d, a, b, r) {
  // o,d: Strahl (d normiert); a,b: Kapsel-Achse; gibt t zurück oder -1
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
  const oax = o.x - a.x, oay = o.y - a.y, oaz = o.z - a.z;
  const baba = bax * bax + bay * bay + baz * baz;
  const bard = bax * d.x + bay * d.y + baz * d.z;
  const baoa = bax * oax + bay * oay + baz * oaz;
  const rdoa = d.x * oax + d.y * oay + d.z * oaz;
  const oaoa = oax * oax + oay * oay + oaz * oaz;
  const A = baba - bard * bard;
  let B = baba * rdoa - baoa * bard;
  let C = baba * oaoa - baoa * baoa - r * r * baba;
  let h = B * B - A * C;
  if (h >= 0 && A > 1e-8) {
    const t = (-B - Math.sqrt(h)) / A;
    const y = baoa + t * bard;
    if (y > 0 && y < baba && t > 0) return t;
    // Kappen
    const ocx = y <= 0 ? oax : o.x - b.x, ocy = y <= 0 ? oay : o.y - b.y, ocz = y <= 0 ? oaz : o.z - b.z;
    B = d.x * ocx + d.y * ocy + d.z * ocz;
    C = ocx * ocx + ocy * ocy + ocz * ocz - r * r;
    h = B * B - C;
    if (h > 0) { const t2 = -B - Math.sqrt(h); if (t2 > 0) return t2; }
  }
  return -1;
}
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
/* Strahl gegen achsenparallele Box, gibt {t, n} oder null */
function rayBox(o, d, min, max, maxT) {
  let tmin = 0, tmax = maxT, nAxis = -1, nSign = 0;
  const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z], mn = [min.x, min.y, min.z], mx = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(da[i]) < 1e-9) {
      if (oa[i] < mn[i] || oa[i] > mx[i]) return null;
    } else {
      const inv = 1 / da[i];
      let t1 = (mn[i] - oa[i]) * inv, t2 = (mx[i] - oa[i]) * inv;
      let s = -1;
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
      if (t1 > tmin) { tmin = t1; nAxis = i; nSign = s; }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }
  if (nAxis < 0) return { t: 0, n: { x: 0, y: 1, z: 0 } };
  const n = { x: 0, y: 0, z: 0 };
  n[['x', 'y', 'z'][nAxis]] = nSign;
  return { t: tmin, n };
}
