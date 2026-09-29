'use strict';
/* ============================================================
   Geheimcode „DEMIRCI“: Wurzelkraft
   Aufladen (Arme hoch, grüne Pixel, Beben) → Schlag auf den Boden →
   Pixel-Wurzeln brechen in Wellen aus der Erde, riesige Wurzeln
   spießen Gegner auf und schleudern sie hoch, dann zerbröseln sie.
   ============================================================ */

const POWER_CODE = 'DEMIRCI';
const POWER_COOLDOWN = 12;
const POWER_RADIUS = 15;
const POWER_WEAPON = { id: 'roots', name: 'Demirci-Wurzeln', pellets: 1 };

/* ---------- Pixel-Wurzeln (instanzierte Würfel) ---------- */
class RootFX {
  constructor(scene) {
    this.MAX = 2200;
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), this.MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.castShadow = true; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.roots = [];
    this.M = new THREE.Matrix4(); this.Q = new THREE.Quaternion(); this.E = new THREE.Euler(); this.P = new THREE.Vector3(); this.S = new THREE.Vector3(); this.C = new THREE.Color();
    this.t = 0;
  }
  add(x, y, z, o) {
    const n = o.segs || 8;
    const bark = [0x4a2e17, 0x5b3a1e, 0x6b4526, 0x3d2612, 0x2f5a22];
    const segs = [];
    for (let i = 0; i < n; i++) {
      const tip = i >= n - 2;
      segs.push({ c: tip ? (i === n - 1 ? 0x9dff6a : 0x55d63c) : bark[Math.floor(Math.random() * bark.length)], ry: Math.random() * 1.5, rx: (Math.random() - 0.5) * 0.3 });
      if (!tip && i > 0 && Math.random() < (o.big ? 0.55 : 0.3)) {
        const a = Math.random() * TAU;
        segs[segs.length - 1].thorn = { a, c: Math.random() < 0.5 ? 0x2f5a22 : 0x3d2612 };
      }
    }
    this.roots.push({ x, y, z, h: o.h, s: o.size, bx: o.bx || 0, bz: o.bz || 0, delay: o.delay || 0, t: -(o.delay || 0), life: o.life || 1.7, segs, big: !!o.big, onBurst: o.onBurst, burst: false });
  }
  update(dt, fx) {
    this.t += dt;
    const M = this.M, Q = this.Q, E = this.E, P = this.P, S = this.S, C = this.C;
    let k = 0;
    for (let r = this.roots.length - 1; r >= 0; r--) {
      const R = this.roots[r];
      R.t += dt;
      if (R.t < 0) continue;
      if (!R.burst) { R.burst = true; if (R.onBurst) R.onBurst(R); }
      if (R.t > R.life) {
        if (fx) fx.burst(new THREE.Vector3(R.x, R.y + R.h * 0.3, R.z), 0x5b3a1e, R.big ? 14 : 5, 3, R.s * 0.5, 0.7, 12);
        this.roots.splice(r, 1); continue;
      }
    }
    for (const R of this.roots) {
      if (R.t < 0) continue;
      // Wachsen mit Überschwingen, halten, dann einziehen
      const grow = R.big ? 0.14 : 0.2;
      let g;
      if (R.t < grow) { const u = R.t / grow; g = 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2); }
      else if (R.t > R.life - 0.4) g = Math.max(0, (R.life - R.t) / 0.4);
      else g = 1;
      const n = R.segs.length, hs = R.h / n;
      const shown = Math.min(n, Math.ceil(g * n));
      for (let i = 0; i < shown && k < this.MAX - 2; i++) {
        const u = i / n, seg = R.segs[i];
        const wig = Math.sin(this.t * 7 + i * 0.9 + R.x) * 0.04 * u;
        const bend = u * u;
        P.set(R.x + R.bx * bend + wig, R.y + (i + 0.5) * hs * Math.min(1.08, g), R.z + R.bz * bend + wig);
        const size = R.s * (1 - 0.55 * u) * (i === shown - 1 && g < 1 ? 0.8 : 1);
        E.set(seg.rx + R.bz * 0.08 * u, seg.ry, -R.bx * 0.08 * u); Q.setFromEuler(E);
        S.set(size, hs * 1.15, size);
        M.compose(P, Q, S); this.mesh.setMatrixAt(k, M); this.mesh.setColorAt(k, C.setHex(seg.c)); k++;
        if (seg.thorn && k < this.MAX - 1) {
          const ts = size * 0.45;
          P.x += Math.cos(seg.thorn.a) * size * 0.6; P.z += Math.sin(seg.thorn.a) * size * 0.6; P.y += hs * 0.2;
          E.set(0.6, seg.thorn.a, 0.4); Q.setFromEuler(E); S.set(ts, ts * 1.6, ts);
          M.compose(P, Q, S); this.mesh.setMatrixAt(k, M); this.mesh.setColorAt(k, C.setHex(seg.thorn.c)); k++;
        }
      }
    }
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

/* ---------- Spiel-Logik ---------- */
Object.assign(Game.prototype, {
  rootsFx() { if (!this._roots) this._roots = new RootFX(this.scene); return this._roots; },
  /* Geheimcode prüfen (Tastatur-Puffer oder Eingabefeld) */
  checkCode(text) {
    const p = this.player;
    if (String(text || '').toUpperCase().replace(/[^A-Z]/g, '').endsWith(POWER_CODE)) {
      this.codeBuf = '';
      // Beim Tippen öffnet das "M" die Karte – wieder schließen
      if (this.hud.mapOpen) this.hud.toggleMap(false);
      if (!p.alive) return true;
      if (!p.powerUnlocked) {
        p.powerUnlocked = true; p.powerCd = 0;
        this.hud.powerUnlocked();
        SFX.powerUnlock();
      }
      this.tryPower();
      return true;
    }
    return false;
  },
  tryPower() {
    const p = this.player;
    if (!p.powerUnlocked || !p.alive) return;
    if (p.state !== 'ground') { this.hud.toast('Die Wurzelkraft geht nur am Boden!'); return; }
    if (p.powerCd > 0) { this.hud.toast('Wurzelkraft lädt noch … ' + Math.ceil(p.powerCd) + ' s'); return; }
    p.powerCd = POWER_COOLDOWN;
    if (this.isClient) { this.powerCharge(p); this.netSend({ t: 'pw' }); }
    else this.castPower(p);
  },
  /* Host / offline: Kraft ausführen */
  castPower(a, fromNet) {
    if (!a.alive || a.state !== 'ground') return;
    if (!fromNet || !this.isClient) this.powerCharge(a);
    if (this.isHost && this.netLive) this.netBroadcast({ t: 'pw1', n: this.nidOf(a) }, a.owner);
    const at = this.time + 0.55;
    (this.powerEvents = this.powerEvents || []).push({ at, fn: () => this.powerBurstHost(a) });
  },
  powerBurstHost(a) {
    if (!a.alive) return;
    const c = a.pos.clone();
    const targets = [];
    for (const o of this.actors) {
      if (o === a || !o.alive || o.state === 'airship') continue;
      if (o.pos.distanceTo(c) < POWER_RADIUS) targets.push(o);
    }
    const tp = targets.map(o => [r2(o.pos.x), r2(o.pos.y), r2(o.pos.z)]);
    this.powerBurst(c, tp, a);
    if (this.isHost && this.netLive) this.netBroadcast({ t: 'pw2', c: [r2(c.x), r2(c.y), r2(c.z)], tg: tp, n: this.nidOf(a) });
    // Schaden kommt, wenn die Riesenwurzel unter dem Ziel hochschießt
    setTimeout(() => {
      if (this.disposed) return;
      for (const o of targets) {
        if (!o.alive) continue;
        o.takeDamage(75, a, { power: true, weapon: POWER_WEAPON });
        if (o.alive && !o.netMode) { o.vel.y = 12; o.grounded = false; o.fallStartY = o.pos.y + 20; }
      }
      const R = 9;
      const list = this.world.query(c.x - R, c.z - R, c.x + R, c.z + R).slice(), done = new Set();
      for (const col of list) {
        const s = col.struct; if (!s || done.has(s) || s.indestructible) continue; done.add(s);
        if (s.center && s.center.distanceTo(c) < R) this.world.damageStructure(s, s.kind === 'build' ? 400 : 120, a);
      }
    }, 180);
  },
  /* Optik: Aufladen */
  powerCharge(a) {
    a.powerT = 0;
    const c = a.pos, fx = this.fx;
    const cols = [0x6dff4a, 0x2fbf3a, 0xb6ff8a, 0x5b3a1e];
    const n = Settings.particles ? 70 : 24;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * TAU, r = 1.2 + Math.random() * 2.2;
      fx.spawn(c.x + Math.cos(ang) * r, c.y + Math.random() * 0.6, c.z + Math.sin(ang) * r, -Math.cos(ang) * 1.2, 1.5 + Math.random() * 3, -Math.sin(ang) * 1.2,
        cols[i % cols.length], 0.08 + Math.random() * 0.1, 0.6 + Math.random() * 0.5, -1, { sw: 5, cx: c.x, cz: c.z });
    }
    fx.anim('ring', c, 0x6dff4a, 0.6);
    fx.light.position.set(c.x, c.y + 1.5, c.z); fx.light.color.setHex(0x6dff4a); fx.light.intensity = 3; fx.light.distance = 12; fx.lightLife = 0.6;
    const d = this.camera.position.distanceTo(c);
    if (d < 120) SFX.powerCharge(clamp(1 - d / 120, 0, 1));
    if (a === this.player && Settings.cameraShake) this.shake = Math.min(1, this.shake + 0.3);
  },
  /* Optik: Schlag + Wurzelwellen + Riesenwurzeln unter den Zielen */
  powerBurst(c, targets, a) {
    const roots = this.rootsFx(), w = this.world, fx = this.fx;
    const d = this.camera.position.distanceTo(c);
    if (d < 160) SFX.powerBurst(clamp(1 - d / 160, 0, 1));
    if (Settings.cameraShake) this.shake = Math.min(1.5, this.shake + clamp(1 - d / 45, 0, 1) * 1.3);
    fx.anim('ring', c, 0x6dff4a, 1.0);
    fx.anim('shell', new THREE.Vector3(c.x, c.y + 0.5, c.z), 0x9dff6a, 0.4);
    fx.burst(new THREE.Vector3(c.x, c.y + 0.2, c.z), 0x5b3a1e, Settings.particles ? 40 : 14, 8, 0.22, 0.9, 16);
    // Wellen aus Wurzeln
    for (const rad of [2.4, 4.8, 7.2, 9.6, 12]) {
      const cnt = Math.round(rad * 2.1);
      for (let i = 0; i < cnt; i++) {
        const ang = i / cnt * TAU + rad * 0.37 + (Math.random() - 0.5) * 0.3;
        const x = c.x + Math.cos(ang) * rad, z = c.z + Math.sin(ang) * rad;
        const y = w.groundAt(x, z, c.y + 4, 8) - 0.3;
        const h = rr(Math.random, 1.4, 2.9) * (1.15 - rad * 0.03);
        roots.add(x, y, z, { h, size: rr(Math.random, 0.32, 0.5), segs: 7, delay: 0.02 + rad * 0.035, life: 1.5 + Math.random() * 0.4,
          bx: Math.cos(ang) * 0.9, bz: Math.sin(ang) * 0.9,
          onBurst: Math.random() < 0.35 ? (R) => fx.burst(new THREE.Vector3(R.x, R.y + 0.3, R.z), 0x6b4526, 4, 3, 0.14, 0.5, 14) : null });
      }
    }
    // Riesenwurzeln unter den Gegnern
    for (const t of targets) {
      const x = t[0], z = t[2], y = w.groundAt(x, z, t[1] + 2, 6) - 0.4;
      roots.add(x, y, z, { h: 5.2, size: 0.8, segs: 11, delay: 0.14, life: 1.9, big: true, bx: (Math.random() - 0.5) * 0.8, bz: (Math.random() - 0.5) * 0.8,
        onBurst: (R) => {
          fx.burst(new THREE.Vector3(R.x, R.y + 0.4, R.z), 0x4a2e17, Settings.particles ? 26 : 10, 7, 0.24, 0.9, 14);
          fx.burst(new THREE.Vector3(R.x, R.y + 2.5, R.z), 0x9dff6a, Settings.particles ? 16 : 6, 5, 0.1, 0.6, 4);
          fx.anim('ring', new THREE.Vector3(R.x, R.y + 0.4, R.z), 0x9dff6a, 0.6);
          const dd = this.camera.position.distanceTo(new THREE.Vector3(R.x, R.y, R.z));
          if (dd < 90) SFX.rootStab(clamp(1 - dd / 90, 0, 1));
        } });
      for (let k = 0; k < 4; k++) {
        const ang = k / 4 * TAU + Math.random();
        roots.add(x + Math.cos(ang) * 0.9, y, z + Math.sin(ang) * 0.9, { h: 2.4, size: 0.4, segs: 7, delay: 0.2 + k * 0.03, life: 1.6, bx: Math.cos(ang) * 0.8, bz: Math.sin(ang) * 0.8 });
      }
    }
  },
  powerUpdate(dt) {
    const p = this.player;
    if (p.powerCd > 0) p.powerCd -= dt;
    if (this.powerEvents && this.powerEvents.length) {
      for (let i = this.powerEvents.length - 1; i >= 0; i--) if (this.time >= this.powerEvents[i].at) { const e = this.powerEvents[i]; this.powerEvents.splice(i, 1); e.fn(); }
    }
    if (this._roots) this._roots.update(dt, this.fx);
    // Tastatur-Code mitschreiben
    for (const code of Input.hits) if (code.startsWith('Key')) {
      this.codeBuf = ((this.codeBuf || '') + code.slice(3)).slice(-12);
      if (this.codeBuf.endsWith(POWER_CODE)) this.checkCode(this.codeBuf);
    }
  },
});
