'use strict';
/* ============================================================
   Bausystem: Wand, Boden, Rampe, Dach – rastet in ein 4m-Gitter
   ============================================================ */

const BUILD_G = 4, BUILD_H = 4, BUILD_T = 0.25, BUILD_COST = 10;
const BUILD_HP = { wood: 150, stone: 300, metal: 450 };
const BUILD_TYPES = ['wall', 'floor', 'ramp', 'roof'];
const BUILD_NAMES = { wall: 'Wand', floor: 'Boden', ramp: 'Rampe', roof: 'Dach' };

function makeBuildTexture(mat) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  if (mat === 'wood') {
    g.fillStyle = '#b07a44'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? '#a36d3a' : '#bb854d'; g.fillRect(0, i * 32 + 2, 128, 28);
      g.fillStyle = 'rgba(80,45,20,0.5)'; for (let k = 0; k < 6; k++) g.fillRect(Math.random() * 128, i * 32 + 6 + Math.random() * 20, 18 + Math.random() * 30, 1);
      g.fillStyle = '#5a3818'; g.fillRect(6, i * 32 + 14, 3, 3); g.fillRect(119, i * 32 + 14, 3, 3);
    }
    g.strokeStyle = '#6b4220'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
    g.lineWidth = 6; g.beginPath(); g.moveTo(8, 8); g.lineTo(120, 120); g.stroke();
  } else if (mat === 'stone') {
    g.fillStyle = '#8e939a'; g.fillRect(0, 0, 128, 128);
    for (let r = 0; r < 6; r++) for (let k = -1; k < 4; k++) {
      const x = k * 40 + (r % 2 ? 20 : 0), y = r * 21 + 1;
      const s = 130 + Math.floor(Math.random() * 40);
      g.fillStyle = `rgb(${s},${s + 3},${s + 8})`; g.fillRect(x + 2, y + 2, 36, 17);
    }
    g.strokeStyle = '#5f646b'; g.lineWidth = 6; g.strokeRect(3, 3, 122, 122);
  } else {
    g.fillStyle = '#6d7c8c'; g.fillRect(0, 0, 128, 128);
    const grd = g.createLinearGradient(0, 0, 128, 128); grd.addColorStop(0, 'rgba(255,255,255,0.15)'); grd.addColorStop(1, 'rgba(0,0,0,0.15)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#44505c'; g.lineWidth = 3;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
    g.fillStyle = '#c9d3dc';
    for (let i = 0; i < 4; i++) for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(8 + k * 37, 8 + i * 32, 2.5, 0, TAU); g.fill(); }
    g.lineWidth = 7; g.strokeRect(3, 3, 122, 122);
  }
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

class BuildSystem {
  constructor(game) {
    this.game = game; this.world = game.world;
    this.pieces = new Map();
    this.mats = {};
    for (const m of ['wood', 'stone', 'metal']) this.mats[m] = new THREE.MeshLambertMaterial({ map: makeBuildTexture(m) });
    this.geo = {
      wall: new THREE.BoxGeometry(BUILD_G, BUILD_H, BUILD_T),
      floor: new THREE.BoxGeometry(BUILD_G, BUILD_T, BUILD_G),
      ramp: new THREE.BoxGeometry(BUILD_G, BUILD_T, Math.hypot(BUILD_G, BUILD_H)),
      roof: new THREE.ConeGeometry(BUILD_G * 0.72, 1.8, 4, 1),
    };
    this.geo.roof.rotateY(Math.PI / 4);
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0x5fc8ff, transparent: true, opacity: 0.38, depthWrite: false });
    this.ghostEdge = new THREE.LineBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.9 });
    this.ghosts = {};
    for (const t of BUILD_TYPES) {
      const m = new THREE.Mesh(this.geo[t], this.ghostMat); m.visible = false; m.renderOrder = 5;
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(this.geo[t]), this.ghostEdge); m.add(e);
      game.scene.add(m); this.ghosts[t] = m;
    }
    this.growing = [];
  }
  dirFromYaw(yaw) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    if (Math.abs(fx) > Math.abs(fz)) return fx > 0 ? 1 : 3; // 1:+x 3:-x
    return fz > 0 ? 2 : 4; // 2:+z 4:-z
  }
  nearbyRef(x, z, feet) {
    let best = null, bd = 1e9;
    for (const s of this.pieces.values()) {
      const d = Math.abs(s.px - x) + Math.abs(s.pz - z);
      if (d > 14) continue;
      const dy = Math.abs(s.base - feet);
      if (dy > 9) continue;
      const score = d + dy * 2;
      if (score < bd) { bd = score; best = s; }
    }
    return best;
  }
  compute(actor, type, yaw, pitch) {
    const p = actor.pos, feet = p.y;
    const dir = this.dirFromYaw(yaw);
    const dx = dir === 1 ? 1 : dir === 3 ? -1 : 0, dz = dir === 2 ? 1 : dir === 4 ? -1 : 0;
    const ci = Math.floor(p.x / BUILD_G), ck = Math.floor(p.z / BUILD_G);
    // Grundhöhe bestimmen
    let base;
    const col = actor.groundCol;
    const onRamp = col && col.struct && col.struct.kind === 'build' && col.struct.buildType === 'ramp';
    const ref = this.nearbyRef(p.x, p.z, feet);
    if (onRamp) {
      const rs = col.struct;
      base = rs.base;
      if (rs.dir === dir && (type === 'ramp' || type === 'floor' || type === 'wall')) base = rs.base + BUILD_H;
      if (type === 'wall' && rs.dir === dir) base = rs.base + BUILD_H * (feet - rs.base > BUILD_H * 0.5 ? 1 : 0);
    } else if (ref) {
      base = ref.base + Math.floor((feet - ref.base + 0.7) / BUILD_H) * BUILD_H;
    } else {
      base = type === 'wall' ? feet - 0.3 : feet - 0.02;
    }
    let ti = ci, tk = ck;
    const r = { type, dir, valid: true };
    if (type === 'wall') {
      if (pitch > 0.8) base += BUILD_H;
      if (dir === 1 || dir === 3) {
        const ex = dir === 1 ? ci + 1 : ci;
        r.x = ex * BUILD_G; r.z = (ck + 0.5) * BUILD_G; r.rotY = Math.PI / 2;
        r.key = 'wx:' + ex + ':' + ck;
        r.box = [r.x, base, r.z, BUILD_T, BUILD_H, BUILD_G];
      } else {
        const ez = dir === 2 ? ck + 1 : ck;
        r.x = (ci + 0.5) * BUILD_G; r.z = ez * BUILD_G; r.rotY = 0;
        r.key = 'wz:' + ci + ':' + ez;
        r.box = [r.x, base, r.z, BUILD_G, BUILD_H, BUILD_T];
      }
      r.y = base + BUILD_H / 2;
    } else if (type === 'floor') {
      if (pitch < -0.9) { ti = ci; tk = ck; } else { ti = ci + dx; tk = ck + dz; }
      if (pitch > 0.75) base += BUILD_H;
      r.x = (ti + 0.5) * BUILD_G; r.z = (tk + 0.5) * BUILD_G; r.y = base - BUILD_T / 2; r.rotY = 0;
      r.key = 'f:' + ti + ':' + tk;
      r.box = [r.x, base - BUILD_T, r.z, BUILD_G, BUILD_T, BUILD_G];
    } else if (type === 'ramp') {
      ti = ci + dx; tk = ck + dz;
      if (!onRamp && ref && feet - base > BUILD_H * 0.5) base += BUILD_H;
      r.x = (ti + 0.5) * BUILD_G; r.z = (tk + 0.5) * BUILD_G; r.y = base + BUILD_H / 2;
      r.key = 'r:' + ti + ':' + tk;
      r.ramp = { min: { x: ti * BUILD_G, y: base, z: tk * BUILD_G }, max: { x: (ti + 1) * BUILD_G, y: base + BUILD_H, z: (tk + 1) * BUILD_G }, ramp: dir };
    } else { // roof
      base += BUILD_H;
      r.x = (ci + 0.5) * BUILD_G; r.z = (ck + 0.5) * BUILD_G; r.y = base + 0.9; r.rotY = 0;
      r.key = 'c:' + ci + ':' + ck;
      r.box = [r.x, base - 0.1, r.z, BUILD_G, 0.3, BUILD_G];
    }
    r.base = base;
    r.key += ':' + Math.round(base * 2);
    if (this.pieces.has(r.key)) r.valid = false;
    return r;
  }
  setRampRotation(obj, dir) {
    const a = Math.atan2(BUILD_H, BUILD_G);
    obj.rotation.set(0, 0, 0);
    // Rampe entlang lokaler +z aufsteigend, dann um Y drehen
    obj.rotation.order = 'YXZ';
    obj.rotation.x = -a;
    obj.rotation.y = dir === 2 ? 0 : dir === 1 ? Math.PI / 2 : dir === 4 ? Math.PI : -Math.PI / 2;
  }
  updateGhost(actor, type, mat, yaw, pitch, show) {
    for (const t of BUILD_TYPES) this.ghosts[t].visible = false;
    if (!show) return null;
    const r = this.compute(actor, type, yaw, pitch);
    const g = this.ghosts[type];
    g.visible = true;
    g.position.set(r.x, r.y, r.z);
    if (type === 'ramp') this.setRampRotation(g, r.dir); else { g.rotation.set(0, r.rotY, 0); }
    const afford = actor.mats[mat] >= BUILD_COST;
    const ok = r.valid && afford;
    this.ghostMat.color.setHex(ok ? 0x5fc8ff : 0xff5a5a);
    this.ghostEdge.color.setHex(ok ? 0xbfeaff : 0xffb0b0);
    r.ok = ok; r.afford = afford;
    return r;
  }
  hideGhosts() { for (const t of BUILD_TYPES) this.ghosts[t].visible = false; }
  place(actor, type, mat, yaw, pitch) {
    if (actor.mats[mat] < BUILD_COST) return null;
    const r = this.compute(actor, type, yaw, pitch);
    if (!r.valid) return null;
    actor.mats[mat] -= BUILD_COST;
    // online: Client schickt den Bauwunsch an den Host, der baut es für alle
    if (this.game.isClient) { this.game.netSend({ t: 'bd', r: JSON.parse(JSON.stringify(r)), m: mat }); return { pending: true }; }
    return this.create(r, mat, actor);
  }
  create(r, mat, owner, forceId) {
    const type = r.type;
    if (this.pieces.has(r.key)) return null;
    const wire = this.game.isHost && this.game.netLive ? JSON.parse(JSON.stringify(r)) : null;
    const mesh = new THREE.Mesh(this.geo[type], this.mats[mat]);
    mesh.position.set(r.x, r.y, r.z);
    if (type === 'ramp') this.setRampRotation(mesh, r.dir); else mesh.rotation.set(0, r.rotY, 0);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.scale.setScalar(0.2);
    let colliders;
    if (r.ramp) colliders = [r.ramp];
    else colliders = [this.world.boxCollider(r.box[0], r.box[1], r.box[2], r.box[3], r.box[4], r.box[5])];
    const maxHp = BUILD_HP[mat];
    const s = this.world.addStructure({
      kind: 'build', buildType: type, mat, hp: maxHp * 0.35, maxHp, mesh, colliders, key: r.key, base: r.base, dir: r.dir,
      px: r.x, pz: r.z, owner, forceId, center: new THREE.Vector3(r.x, r.y, r.z), grow: 0,
    });
    this.pieces.set(r.key, s);
    this.growing.push(s);
    if (wire) this.game.netBroadcast({ t: 'bp', id: s.id, r: wire, m: mat });
    return s;
  }
  onDestroyed(s) { if (s.key && this.pieces.get(s.key) === s) this.pieces.delete(s.key); }
  update(dt) {
    for (let i = this.growing.length - 1; i >= 0; i--) {
      const s = this.growing[i];
      if (!s.alive) { this.growing.splice(i, 1); continue; }
      s.grow += dt;
      s.mesh.scale.setScalar(Math.min(1, 0.2 + s.grow * 6));
      const buildTime = s.mat === 'wood' ? 1.2 : s.mat === 'stone' ? 2.4 : 3.6;
      s.hp = Math.min(s.maxHp, s.hp + s.maxHp * 0.65 * dt / buildTime);
      if (s.grow >= buildTime) { s.mesh.scale.setScalar(1); this.growing.splice(i, 1); }
    }
  }
}
