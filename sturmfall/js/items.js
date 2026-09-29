'use strict';
/* ============================================================
   Waffen, Verbrauchsgegenstände, Munition, Seltenheiten, Modelle
   ============================================================ */

const RARITIES = [
  { name: 'Gewöhnlich', color: '#b8bcc4', hex: 0xb8bcc4, dmg: 1.0, reload: 1.0 },
  { name: 'Ungewöhnlich', color: '#58c94a', hex: 0x58c94a, dmg: 1.05, reload: 0.95 },
  { name: 'Selten', color: '#3d8ff2', hex: 0x3d8ff2, dmg: 1.1, reload: 0.9 },
  { name: 'Episch', color: '#b45cf2', hex: 0xb45cf2, dmg: 1.16, reload: 0.85 },
  { name: 'Legendär', color: '#f2a531', hex: 0xf2a531, dmg: 1.23, reload: 0.8 },
];

const AMMO = {
  light: { name: 'Leichte Munition', short: 'Leicht', color: '#9fd3ff', box: 36 },
  medium: { name: 'Mittlere Munition', short: 'Mittel', color: '#7ee07e', box: 30 },
  shells: { name: 'Schrotpatronen', short: 'Schrot', color: '#ff8f6b', box: 8 },
  heavy: { name: 'Schwere Munition', short: 'Schwer', color: '#e0c060', box: 6 },
  rockets: { name: 'Raketen', short: 'Raketen', color: '#ff5f5f', box: 3 },
};

const WEAPONS = {
  pistol: { name: 'Funken-Pistole', ammo: 'light', dmg: 24, rate: 6.5, mag: 16, reload: 1.35, spread: 0.018, adsSpread: 0.006, bloom: 0.012, head: 2.0, range: 110, auto: false, zoom: 1.25, sound: 'pistol', pellets: 1, rarities: [0, 1, 2], shake: 0.25 },
  smg: { name: 'Hummel-MP', ammo: 'light', dmg: 16, rate: 12, mag: 30, reload: 2.1, spread: 0.035, adsSpread: 0.022, bloom: 0.008, head: 1.75, range: 70, auto: true, zoom: 1.25, sound: 'smg', pellets: 1, rarities: [0, 1, 2, 3], shake: 0.18 },
  ar: { name: 'Sturmkarabiner', ammo: 'medium', dmg: 31, rate: 5.5, mag: 30, reload: 2.3, spread: 0.028, adsSpread: 0.006, bloom: 0.01, head: 2.0, range: 160, auto: true, zoom: 1.6, sound: 'ar', pellets: 1, rarities: [0, 1, 2, 3, 4], shake: 0.3 },
  shotgun: { name: 'Donner-Pumpe', ammo: 'shells', dmg: 10, rate: 0.9, mag: 5, reload: 0.55, perShell: true, spread: 0.075, adsSpread: 0.06, bloom: 0, head: 1.6, range: 36, auto: false, zoom: 1.2, sound: 'shotgun', pellets: 10, rarities: [0, 1, 2, 3, 4], shake: 0.9 },
  sniper: { name: 'Falkenauge', ammo: 'heavy', dmg: 100, rate: 0.45, mag: 1, reload: 2.6, spread: 0.12, adsSpread: 0.0, bloom: 0, head: 2.5, range: 400, auto: false, zoom: 4.2, scope: true, sound: 'sniper', pellets: 1, rarities: [2, 3, 4], shake: 1.2 },
  rocket: { name: 'Knallrohr', ammo: 'rockets', dmg: 80, rate: 0.75, mag: 1, reload: 2.8, spread: 0.02, adsSpread: 0.0, bloom: 0, head: 1, range: 200, auto: false, zoom: 1.4, projectile: true, splash: 5.5, sound: 'rocket', pellets: 1, rarities: [3, 4], shake: 1.0 },
};

const CONSUMABLES = {
  bandage: { name: 'Verband', heal: 15, cap: 75, time: 3.2, stack: 15, color: '#f2f2f2', icon: '✚', rarity: 0 },
  medkit: { name: 'Medikit', heal: 100, cap: 100, time: 8, stack: 3, color: '#ff6b6b', icon: '✚', rarity: 1 },
  minishield: { name: 'Mini-Schild', shield: 25, cap: 50, time: 1.8, stack: 6, color: '#6fc3ff', icon: '◆', rarity: 1 },
  shield: { name: 'Schildtrank', shield: 50, cap: 100, time: 4.5, stack: 3, color: '#3d8ff2', icon: '◆', rarity: 2 },
  fruit: { name: 'Sprudelfrucht', heal: 25, shield: 0, cap: 100, overflow: true, time: 1.2, stack: 4, color: '#ffd23f', icon: '●', rarity: 2 },
};

function weaponStats(id, rarity) {
  const w = WEAPONS[id], r = RARITIES[rarity];
  return Object.assign({}, w, { id, dmg: w.dmg * r.dmg, reload: w.reload * r.reload, rarity });
}
function itemName(it) {
  if (!it) return '';
  if (it.type === 'weapon') return WEAPONS[it.id].name;
  if (it.type === 'consumable') return CONSUMABLES[it.id].name;
  if (it.type === 'ammo') return AMMO[it.id].name;
  if (it.type === 'mat') return MAT_NAMES[it.id];
  return '?';
}
function itemRarity(it) {
  if (it.type === 'weapon') return it.rarity;
  if (it.type === 'consumable') return CONSUMABLES[it.id].rarity;
  return 0;
}

/* ---------- Beute-Tabellen ---------- */
function rollRarity(rng, allowed, bonus) {
  const w = [50, 28, 14, 6, 2].map((v, i) => [i, i >= 2 ? v * (1 + (bonus || 0)) : v]);
  const filtered = w.filter(e => allowed.indexOf(e[0]) >= 0);
  return weightedPick(rng, filtered);
}
function rollWeapon(rng, bonus) {
  const id = weightedPick(rng, [['pistol', 18], ['smg', 16], ['ar', 26], ['shotgun', 24], ['sniper', 8], ['rocket', 4]]);
  const rarity = rollRarity(rng, WEAPONS[id].rarities, bonus);
  return { type: 'weapon', id, rarity, mag: WEAPONS[id].mag };
}
function rollConsumable(rng) {
  const id = weightedPick(rng, [['bandage', 30], ['medkit', 10], ['minishield', 26], ['shield', 14], ['fruit', 12]]);
  return { type: 'consumable', id, count: id === 'bandage' ? 5 : id === 'minishield' ? 3 : id === 'fruit' ? 2 : 1 };
}
function ammoFor(id) { return { type: 'ammo', id: WEAPONS[id].ammo, count: AMMO[WEAPONS[id].ammo].box }; }

/* ---------- Modelle ---------- */
function makeWeaponMesh(id, rarity) {
  const g = new THREE.Group();
  const rc = RARITIES[rarity || 0].hex;
  const dark = 0x2d3036, mid = 0x4a4f57;
  const b = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(boxGeo(w, h, d), lambert(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch (id) {
    case 'pistol':
      b(0.08, 0.1, 0.32, mid, 0, 0.06, 0.1); b(0.07, 0.17, 0.08, dark, 0, -0.04, 0); b(0.085, 0.03, 0.2, rc, 0, 0.12, 0.1); break;
    case 'smg':
      b(0.09, 0.13, 0.46, dark, 0, 0.05, 0.12); b(0.07, 0.2, 0.07, mid, 0, -0.08, 0.16); b(0.07, 0.15, 0.08, dark, 0, -0.05, -0.02);
      b(0.04, 0.04, 0.14, mid, 0, 0.07, 0.42); b(0.095, 0.04, 0.3, rc, 0, 0.13, 0.1); b(0.06, 0.08, 0.2, mid, 0, 0.04, -0.2); break;
    case 'ar':
      b(0.09, 0.14, 0.62, dark, 0, 0.05, 0.16); b(0.08, 0.2, 0.12, mid, 0, -0.1, 0.2); b(0.07, 0.15, 0.08, dark, 0, -0.05, -0.02);
      b(0.08, 0.13, 0.3, mid, 0, 0.03, -0.25); b(0.035, 0.035, 0.28, dark, 0, 0.08, 0.58); b(0.1, 0.035, 0.44, rc, 0, 0.135, 0.18);
      b(0.05, 0.07, 0.14, 0x111111, 0, 0.17, 0.12); break;
    case 'shotgun':
      b(0.09, 0.11, 0.5, 0x6b4a2c, 0, 0.04, -0.12); b(0.07, 0.07, 0.72, dark, 0, 0.08, 0.36); b(0.09, 0.09, 0.2, rc, 0, 0.02, 0.36);
      b(0.07, 0.15, 0.08, 0x6b4a2c, 0, -0.05, -0.02); break;
    case 'sniper':
      b(0.08, 0.12, 0.7, 0x3b4a3a, 0, 0.04, 0.05); b(0.035, 0.035, 0.6, dark, 0, 0.07, 0.68); b(0.07, 0.15, 0.08, dark, 0, -0.05, -0.02);
      b(0.09, 0.14, 0.3, 0x3b4a3a, 0, 0.02, -0.4);
      { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.34, 8), lambert(0x111111)); s.rotation.x = Math.PI / 2; s.position.set(0, 0.17, 0.08); g.add(s); }
      b(0.1, 0.03, 0.36, rc, 0, 0.11, 0.05); break;
    case 'rocket': {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 10), lambert(0x4b5d3a)); t.rotation.x = Math.PI / 2; t.position.set(0, 0.12, 0.15); t.castShadow = true; g.add(t);
      const r1 = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.1, 10), lambert(rc)); r1.rotation.x = Math.PI / 2; r1.position.set(0, 0.12, 0.66); g.add(r1);
      const r2 = r1.clone(); r2.position.z = -0.36; g.add(r2);
      b(0.07, 0.15, 0.08, dark, 0, -0.03, 0); break;
    }
  }
  return g;
}
function makePickaxeMesh(color) {
  const g = new THREE.Group();
  const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6), lambert(0x7a5230)); h.position.y = -0.3; g.add(h);
  const head = new THREE.Mesh(boxGeo(0.08, 0.1, 0.62), lambert(color || 0x9fb3c8)); head.position.set(0, -0.68, 0.08); g.add(head);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), lambert(0xe9eef2)); tip.rotation.x = Math.PI / 2; tip.position.set(0, -0.68, 0.46); g.add(tip);
  const grip = new THREE.Mesh(boxGeo(0.09, 0.14, 0.09), lambert(0xff5d5d)); grip.position.y = 0.02; g.add(grip);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function makeHeldMesh(it, outfit) {
  if (!it) return makePickaxeMesh(outfit && outfit.accent);
  if (it.type === 'weapon') {
    const m = makeWeaponMesh(it.id, it.rarity);
    compactGroup(m);
    m.rotation.x = Math.PI / 2; m.position.set(0, -0.06, 0.02);
    const wrap = new THREE.Group(); wrap.add(m); return wrap;
  }
  if (it.type === 'consumable') {
    const c = CONSUMABLES[it.id];
    const m = new THREE.Mesh(it.id === 'fruit' ? new THREE.SphereGeometry(0.1, 8, 6) : boxGeo(0.12, 0.2, 0.12), lambert(new THREE.Color(c.color).getHex()));
    m.position.y = -0.1; const g = new THREE.Group(); g.add(m); return g;
  }
  return null;
}
/* Modell eines Bodengegenstands (mit Seltenheits-Leuchten) */
function makePickupMesh(it) {
  const g = new THREE.Group();
  const inner = new THREE.Group(); g.add(inner);
  let color = 0xffffff;
  if (it.type === 'weapon') {
    const m = makeWeaponMesh(it.id, it.rarity); compactGroup(m); m.scale.setScalar(1.25); m.rotation.y = Math.PI / 2; inner.add(m);
    color = RARITIES[it.rarity].hex;
  } else if (it.type === 'consumable') {
    const c = CONSUMABLES[it.id];
    color = new THREE.Color(c.color).getHex();
    let m;
    if (it.id === 'fruit') m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), lambert(color));
    else if (it.id === 'bandage') m = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.18, 10), lambert(0xf5f5f5));
    else if (it.id === 'medkit') m = new THREE.Mesh(boxGeo(0.45, 0.3, 0.3), lambert(0xf5f5f5));
    else m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.42, 8), new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 }));
    inner.add(m);
    if (it.id === 'medkit') { const cr = new THREE.Mesh(boxGeo(0.2, 0.06, 0.32), lambert(0xe74c3c)); cr.position.y = 0.16; inner.add(cr); const cr2 = new THREE.Mesh(boxGeo(0.06, 0.06, 0.2), lambert(0xe74c3c)); cr2.position.y = 0.16; inner.add(cr2); }
    color = RARITIES[c.rarity].hex;
  } else if (it.type === 'ammo') {
    const a = AMMO[it.id];
    const m = new THREE.Mesh(boxGeo(0.4, 0.22, 0.26), lambert(0x4f6b35)); inner.add(m);
    const s = new THREE.Mesh(boxGeo(0.42, 0.06, 0.28), lambert(new THREE.Color(a.color).getHex())); s.position.y = 0.06; inner.add(s);
    color = 0xb8bcc4;
  } else if (it.type === 'mat') {
    const m = new THREE.Mesh(it.id === 'wood' ? boxGeo(0.5, 0.18, 0.18) : new THREE.DodecahedronGeometry(0.2, 0), lambert(MAT_COLORS[it.id])); inner.add(m);
    if (it.id === 'wood') { const m2 = m.clone(); m2.position.y = 0.18; m2.rotation.y = 0.5; inner.add(m2); }
    color = 0xb8bcc4;
  }
  inner.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.55, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
  if (it.type === 'weapon' && it.rarity >= 2) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 3.5, 8, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = 1.75; g.add(beam);
  }
  g.userData.inner = inner;
  return g;
}
