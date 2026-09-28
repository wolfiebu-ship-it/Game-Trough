'use strict';
/* ============================================================
   Effekte: Partikel (instanziert), Leuchtspuren, Mündungsfeuer,
   Explosionen, Einschläge
   ============================================================ */

class Effects {
  constructor(scene) {
    this.scene = scene;
    this.MAX = 900;
    this.parts = [];
    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), this.MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.tracers = [];
    const tmat = () => new THREE.LineBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 1 });
    for (let i = 0; i < 48; i++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const l = new THREE.Line(g, tmat()); l.visible = false; l.frustumCulled = false; scene.add(l);
      this.tracers.push({ line: l, life: 0 });
    }
    this.tracerIdx = 0;
    // Mündungsfeuer
    this.flashes = [];
    const fgeo = new THREE.SphereGeometry(0.16, 6, 4);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.9 }));
      m.visible = false; scene.add(m); this.flashes.push({ m, life: 0 });
    }
    this.flashIdx = 0;
    this.light = new THREE.PointLight(0xffc070, 0, 8); scene.add(this.light);
    this.lightLife = 0;
    // Explosionen
    this.booms = [];
    this.M = new THREE.Matrix4(); this.C = new THREE.Color(); this.Q = new THREE.Quaternion(); this.E = new THREE.Euler();
    this.V = new THREE.Vector3(); this.S = new THREE.Vector3();
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, grav) {
    if (this.parts.length >= this.MAX) this.parts.shift();
    this.parts.push({ x, y, z, vx, vy, vz, color, size, life, max: life, grav: grav == null ? 14 : grav, rx: Math.random() * 6, ry: Math.random() * 6, spin: (Math.random() - 0.5) * 12 });
  }
  burst(p, color, n, speed, size, life, grav) {
    if (!Settings.particles) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, u = Math.random() * 2 - 1, s = speed * (0.4 + Math.random() * 0.6);
      const r = Math.sqrt(1 - u * u);
      this.spawn(p.x, p.y, p.z, Math.cos(a) * r * s, Math.abs(u) * s + speed * 0.3, Math.sin(a) * r * s, color, size * (0.6 + Math.random() * 0.6), life * (0.6 + Math.random() * 0.6), grav);
    }
  }
  impact(p, n, color) { this.burst(p, color || 0xdddddd, 5, 3, 0.07, 0.35, 8); }
  debris(center, mat, n) { this.burst(center, MAT_COLORS[mat] || 0xaaaaaa, n || 16, 6, 0.28, 1.1, 18); }
  harvestHit(p, mat) { this.burst(p, MAT_COLORS[mat] || 0xaaaaaa, 6, 4, 0.14, 0.6, 16); }
  hitSpark(p, shield) { this.burst(p, shield ? 0x6fc3ff : 0xffffff, 8, 4, 0.08, 0.35, 4); }
  dissolve(center) {
    const cols = [0x6ff0ff, 0xb45cf2, 0xffffff];
    for (let i = 0; i < (Settings.particles ? 60 : 20); i++) {
      this.spawn(center.x + (Math.random() - 0.5) * 0.8, center.y + Math.random() * 1.7 - 0.8, center.z + (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2, cols[i % 3], 0.1 + Math.random() * 0.12, 1.2 + Math.random(), -1);
    }
  }
  explosion(p) {
    this.burst(p, 0xffa030, 40, 11, 0.4, 0.8, 4);
    this.burst(p, 0x555555, 30, 5, 0.6, 1.5, -2);
    this.burst(p, 0xffee88, 20, 15, 0.2, 0.4, 0);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.85 }));
    m.position.copy(p); this.scene.add(m);
    this.booms.push({ m, life: 0.45 });
    this.light.position.copy(p); this.light.intensity = 6; this.light.distance = 30; this.lightLife = 0.3;
  }
  tracer(a, b, color) {
    const t = this.tracers[this.tracerIdx++ % this.tracers.length];
    const pos = t.line.geometry.attributes.position.array;
    pos[0] = a.x; pos[1] = a.y; pos[2] = a.z; pos[3] = b.x; pos[4] = b.y; pos[5] = b.z;
    t.line.geometry.attributes.position.needsUpdate = true;
    t.line.material.color.setHex(color || 0xfff2a0);
    t.line.material.opacity = 0.9; t.line.visible = true; t.life = 0.09;
  }
  muzzle(p, big, withLight) {
    const f = this.flashes[this.flashIdx++ % this.flashes.length];
    f.m.position.copy(p); f.m.scale.setScalar(big ? 1.8 : 1); f.m.visible = true; f.life = 0.05; f.m.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    if (withLight) { this.light.position.copy(p); this.light.intensity = 2.5; this.light.distance = 8; this.lightLife = 0.05; }
  }
  update(dt) {
    const M = this.M, C = this.C, Q = this.Q, E = this.E, V = this.V, S = this.S;
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.vy -= p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.rx += p.spin * dt; p.ry += p.spin * dt * 0.7;
    }
    for (const p of this.parts) {
      const s = p.size * Math.min(1, p.life / p.max * 2.5);
      E.set(p.rx, p.ry, 0); Q.setFromEuler(E); V.set(p.x, p.y, p.z); S.set(s, s, s);
      M.compose(V, Q, S); this.mesh.setMatrixAt(n, M); this.mesh.setColorAt(n, C.setHex(p.color)); n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    for (const t of this.tracers) if (t.life > 0) { t.life -= dt; t.line.material.opacity = Math.max(0, t.life / 0.09); if (t.life <= 0) t.line.visible = false; }
    for (const f of this.flashes) if (f.life > 0) { f.life -= dt; if (f.life <= 0) f.m.visible = false; }
    if (this.lightLife > 0) { this.lightLife -= dt; if (this.lightLife <= 0) this.light.intensity = 0; }
    for (let i = this.booms.length - 1; i >= 0; i--) {
      const b = this.booms[i]; b.life -= dt;
      const k = 1 - b.life / 0.45;
      b.m.scale.setScalar(1 + k * 5); b.m.material.opacity = 0.85 * (1 - k);
      if (b.life <= 0) { this.scene.remove(b.m); b.m.geometry.dispose(); b.m.material.dispose(); this.booms.splice(i, 1); }
    }
  }
  dispose() {
    this.scene.remove(this.mesh);
  }
}
