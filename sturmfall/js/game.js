'use strict';
/* ============================================================
   Game: ein komplettes Match (Luftschiff, Kampf, Sturm, Sieg)
   ============================================================ */

const LOOT_PROB = { wenig: 0.35, normal: 0.55, viel: 0.8 };

class Game {
  constructor(renderer, setup, callbacks, net) {
    this.renderer = renderer;
    this.net = net || null;
    this.isHost = !!(net && net.role === 'host');
    this.isClient = !!(net && net.role === 'client');
    if (this.isClient) setup = net.start.setup;
    this.setup = Object.assign({}, setup);
    this.cb = callbacks || {};
    this.time = 0; this.paused = false; this.over = false; this.pidSeq = 0;
    this.seedText = this.isClient ? String(net.start.seed) : setup.seed && String(setup.seed).trim() ? String(setup.seed).trim() : String(Math.floor(Math.random() * 1e9));
    const seed = hashString(this.seedText);
    this.rng = mulberry32(seed ^ 0x5bd1e995);

    this.scene = new THREE.Scene();
    this.skyColor = new THREE.Color(0xbfe3ff);
    this.scene.fog = new THREE.Fog(this.skyColor.clone(), 60, Settings.viewDist);
    this.camera = new THREE.PerspectiveCamera(Settings.fov, window.innerWidth / window.innerHeight, 0.1, 2400);
    this.hemi = new THREE.HemisphereLight(0xdff1ff, 0x5a6b3a, 0.75); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 0.95);
    this.sunDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    this.sun.castShadow = true;
    this.applyShadowQuality();
    this.scene.add(this.sun); this.scene.add(this.sun.target);

    this.world = new World(this.scene, seed);
    this.world.onStructureDestroyed = (s, by) => this.onStructureDestroyed(s, by);
    this.fx = new Effects(this.scene);
    this.build = new BuildSystem(this);
    this.storm = new Storm(this, this.rng, setup.stormSpeed);
    this.storm.onShrink = () => { this.hud.banner('Der Sturm zieht zusammen!', '#c89bff'); SFX.stormWarn(); };
    this.storm.onWait = () => { this.hud.toast('Neue sichere Zone markiert – schau auf die Karte (' + keyLabel(Settings.keys.map) + ')'); };
    this.pickups = []; this.rockets = [];
    this.actors = [];
    this.hud = new HUD(this);

    if (this.isClient) { this.netSetupClient(net.start); this.netCreateClientActors(net.start); }
    else this.createActors(setup, seed);
    this.matsMode = setup.buildMats;
    if (setup.buildMats === 'viel') for (const a of this.actors) if (a.human) a.mats = { wood: 500, stone: 400, metal: 300 };
    if (setup.buildMats === 'unbegrenzt') for (const a of this.actors) a.mats = { wood: 999, stone: 999, metal: 999 };
    if (!this.isClient) this.spawnFloorLoot();

    this.camYaw = 0; this.camPitch = -0.1; this.camDist = Settings.camDist; this.shake = 0;
    this.recoil = 0; this.curFov = Settings.fov; this.scoped = false;
    this.timeScale = 1; this.slowT = 0; this.slowDur = 1; this.slowMin = 1; this.fovKick = 0; this.streak = 0; this.lastKillT = -99; this.deathReal = 0;
    this.state = 'airship';
    this.spectating = null;
    this.aliveCount = this.actors.length;
    this.chestHumT = 0; this.visT = 0; this.botPickT = 0;
    this.sprintToggled = false; this.crouchToggled = false;
    this.matchTime = 0;

    if (this.isClient) {
      const st = net.start;
      if (st.spawns) {
        this.state = 'play';
        st.spawns.forEach((s, i) => { const a = this.actors[i]; if (!a) return; a.pos.set(s[0], s[1], s[2]); a.yaw = s[3]; a.state = 'ground'; a.grounded = true; });
        this.camYaw = this.player.yaw;
        this.hud.banner('Los geht\'s! Finde Waffen!', '#ffd23f');
      } else this.startAirship(st.ship);
    } else {
      if (this.isHost) this.netSetupHost();
      if (setup.start === 'boden') this.startOnGround();
      else this.startAirship();
      this.storm.start();
    }
    this.hud.refreshSlots();
    this.hud.setMinimap(this.world.minimapCanvas);
  }
  createActors(setup, seed) {
    // Spieler
    this.player = new Actor(this, { name: Settings.playerName || 'Spieler', isPlayer: true, outfit: Settings.outfit });
    this.player.human = true;
    this.actors.push(this.player);
    // Mitspieler (online, nur beim Host)
    if (this.isHost) for (const m of this.net.members) {
      const a = new Actor(this, { name: m.name, outfit: m.outfit });
      a.netMode = 'proxy'; a.owner = m.code; a.human = true;
      this.actors.push(a);
    }
    // Bots
    const names = BOT_NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const nb = clamp(setup.bots | 0, 1, 49);
    for (let i = 0; i < nb; i++) {
      const a = new Actor(this, { name: names[i % names.length] + (i >= names.length ? ' ' + (i + 1) : ''), outfit: Math.floor(this.rng() * OUTFITS.length) });
      new BotBrain(a, this, setup.difficulty, mulberry32(seed + i * 7919));
      a.mats.wood = ri(this.rng, 0, 120); a.mats.stone = ri(this.rng, 0, 40);
      this.actors.push(a);
    }
  }

  applyShadowQuality() {
    const q = Settings.quality;
    this.renderer.shadowMap.enabled = Settings.shadows;
    this.sun.castShadow = Settings.shadows;
    const size = q === 'ultra' ? 4096 : q === 'hoch' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const s = 70;
    const cam = this.sun.shadow.camera;
    cam.left = -s; cam.right = s; cam.top = s; cam.bottom = -s; cam.near = 1; cam.far = 400;
    cam.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    if (this.scene) this.scene.fog.far = Settings.viewDist;
    if (this.camera) { this.camera.far = Math.max(2400, Settings.viewDist * 3); this.camera.updateProjectionMatrix(); }
  }

  /* ---------------- Start ---------------- */
  startAirship(route) {
    const a = this.rng() * TAU;
    const off = rr(this.rng, -70, 70);
    const nx = -Math.sin(a), nz = Math.cos(a);
    this.shipFrom = new THREE.Vector3(Math.cos(a) * 320 + nx * off, 120, Math.sin(a) * 320 + nz * off);
    this.shipTo = new THREE.Vector3(-Math.cos(a) * 320 + nx * off, 120, -Math.sin(a) * 320 + nz * off);
    if (route) { this.shipFrom.set(route[0], route[1], route[2]); this.shipTo.set(route[3], route[4], route[5]); }
    this.shipT = 0; this.shipDur = this.shipFrom.distanceTo(this.shipTo) / 22;
    this.doorsT = 4;
    this.ship = this.makeAirship();
    this.scene.add(this.ship);
    this.ship.position.copy(this.shipFrom);
    this.ship.lookAt(this.shipTo.x, 120, this.shipTo.z);
    this.camYaw = Math.atan2(this.shipTo.x - this.shipFrom.x, this.shipTo.z - this.shipFrom.z) + 0.8;
    const dir = this.shipTo.clone().sub(this.shipFrom);
    for (const act of this.actors) {
      act.state = 'airship';
      act.pos.copy(this.shipFrom);
      if (act.bot) {
        // Landeziel: Ort oder zufällige Stelle
        const poi = this.rng() < 0.7 ? pick(this.rng, this.world.pois) : null;
        const tgt = poi ? this.world.randomLandPoint(this.rng, poi.x, poi.z, poi.r * 0.8) : this.world.randomLandPoint(this.rng, 0, 0, 190);
        act.bot.dropTarget = tgt;
        // Zeitpunkt: nächster Punkt der Route zum Ziel
        const t = clamp(((tgt.x - this.shipFrom.x) * dir.x + (tgt.z - this.shipFrom.z) * dir.z) / dir.lengthSq(), 0.05, 0.97);
        act.bot.jumpAt = clamp(t + rr(this.rng, -0.12, 0.05), 0.04, 0.97);
      }
    }
    this.hud.banner('Willkommen im Luftschiff!', '#ffd23f');
  }
  makeAirship() {
    const g = new THREE.Group();
    const env = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), lambert(0xf2f2f2));
    env.scale.set(5.5, 5.5, 17); g.add(env);
    for (let i = -2; i <= 2; i++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.9, 24, 1, true), new THREE.MeshLambertMaterial({ color: i % 2 ? 0x3d8ff2 : 0xffd23f, side: THREE.DoubleSide }));
      const z = i * 4.5, r = Math.sqrt(Math.max(0.01, 1 - (z / 17) * (z / 17))) * 5.56;
      band.scale.set(r, 1, r); band.rotation.x = Math.PI / 2; band.position.z = z; g.add(band);
    }
    const gond = new THREE.Mesh(boxGeo(3.2, 2.2, 7), lambert(0x6b4a2c)); gond.position.set(0, -6.2, 0); g.add(gond);
    const win = new THREE.Mesh(boxGeo(3.3, 0.7, 5.6), lambert(0x9fd3ff, { emissive: 0x335577 })); win.position.set(0, -5.9, 0); g.add(win);
    for (const [x, y, r] of [[0, 5, 0], [5, 0, Math.PI / 2], [-5, 0, -Math.PI / 2], [0, -5, Math.PI]]) {
      const fin = new THREE.Mesh(boxGeo(0.3, 4, 4), lambert(0xe8622c)); fin.position.set(x * 0.9, y * 0.9, -14); fin.rotation.z = r; g.add(fin);
    }
    this.prop = new THREE.Group(); this.prop.position.set(0, -6.2, -3.8); g.add(this.prop);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(boxGeo(0.3, 2.6, 0.1), lambert(0x333333)); b.rotation.z = i * TAU / 3; b.position.y = 0; this.prop.add(b); }
    const sign = new THREE.Mesh(boxGeo(0.2, 1.6, 8), lambert(0xffffff, { emissive: 0x444444 })); sign.position.set(5.6, 0, 0); g.add(sign);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }
  startOnGround() {
    this.state = 'play';
    for (const a of this.actors) {
      const p = this.world.randomLandPoint(this.rng, 0, 0, 185);
      a.pos.set(p.x, this.world.groundAt(p.x, p.z, 200, 0), p.z);
      a.state = 'ground'; a.grounded = true;
      a.yaw = this.rng() * TAU;
    }
    this.camYaw = this.player.yaw;
    this.hud.banner('Los geht\'s! Finde Waffen!', '#ffd23f');
  }
  onPlayerLanded() {
    const p = this.player;
    let near = null, nd = 1e9;
    for (const poi of this.world.pois) { const d = dist2(poi.x, poi.z, p.pos.x, p.pos.z); if (d < nd) { nd = d; near = poi; } }
    if (near && nd < near.r + 20) this.hud.banner(near.name, '#ffffff');
    if (!p.slots.some(s => s)) this.hud.toast('Such dir Waffen! Truhen summen golden.', 3.5);
  }
  jumpOut(a) {
    a.state = 'skydive';
    const dir = this.shipTo.clone().sub(this.shipFrom).normalize();
    a.pos.copy(this.ship.position).add(new THREE.Vector3(0, -8, 0));
    a.vel.set(dir.x * 12, -5, dir.z * 12);
    a.yaw = Math.atan2(dir.x, dir.z);
    if (a.isPlayer) { SFX.jumpOut(); this.state = 'play'; this.camYaw = a.yaw; this.camPitch = -0.5; }
  }

  /* ---------------- Beute ---------------- */
  spawnFloorLoot() {
    const prob = LOOT_PROB[this.setup.loot] || 0.55;
    for (const s of this.world.lootSpots) {
      if (this.rng() > prob) continue;
      const r = this.rng();
      if (r < 0.45) {
        const w = rollWeapon(this.rng, 0);
        this.spawnPickup(w, s.x, s.y, s.z);
        this.spawnPickup(ammoFor(w.id), s.x + 0.7, s.y, s.z + 0.3);
      } else if (r < 0.75) this.spawnPickup(rollConsumable(this.rng), s.x, s.y, s.z);
      else { const id = pick(this.rng, Object.keys(AMMO).filter(k => k !== 'rockets')); this.spawnPickup({ type: 'ammo', id, count: AMMO[id].box }, s.x, s.y, s.z); }
    }
  }
  spawnPickup(item, x, y, z, toss, id, vel) {
    const mesh = makePickupMesh(item);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    const p = { item, pos: mesh.position, mesh, vel: new THREE.Vector3(), taken: false, isPickup: true, t: Math.random() * 6, settled: !toss };
    p.id = id != null ? id : ++this.pidSeq;
    if (toss) { if (vel) p.vel.set(vel[0], vel[1], vel[2]); else p.vel.set((Math.random() - 0.5) * 3, 4 + Math.random() * 2, (Math.random() - 0.5) * 3); }
    if (!toss) { const gy = this.world.groundAt(x, z, y + 0.5, 1); mesh.position.y = gy; }
    this.pickups.push(p);
    if (this.isHost && this.netLive) this.netBroadcast({ t: 'pa', id: p.id, it: item, x: r2(x), y: r2(y), z: r2(z), v: toss ? [r2(p.vel.x), r2(p.vel.y), r2(p.vel.z)] : null });
    return p;
  }
  removePickup(p) {
    p.taken = true;
    this.scene.remove(p.mesh);
    const i = this.pickups.indexOf(p); if (i >= 0) this.pickups.splice(i, 1);
    if (this.isHost && this.netLive) this.netBroadcast({ t: 'pr', id: p.id });
  }
  takePickup(a, p) {
    if (p.taken) return false;
    if (this.isClient) {
      if (!a.isPlayer || (p.reqT && this.time - p.reqT < 1)) return false;
      if (!a.canTake(p.item)) { this.hud.toast('Kein Platz im Inventar'); return false; }
      p.reqT = this.time; this.netSend({ t: 'tk', id: p.id });
      return true;
    }
    if (!a.canTake(p.item)) { if (a.isPlayer) this.hud.toast('Kein Platz im Inventar'); return false; }
    const it = p.item;
    const left = a.give(it);
    this.removePickup(p);
    if (left) {
      const f = a.forward();
      this.spawnPickup(left, a.pos.x + f.x * 0.8, a.pos.y + 0.8, a.pos.z + f.z * 0.8, true);
    }
    if (a.isPlayer) {
      SFX.pickup();
      const cnt = it.count && it.type !== 'weapon' ? ' ×' + it.count : '';
      this.hud.pickupNote(itemName(it) + cnt, it.type === 'weapon' ? RARITIES[it.rarity].color : it.type === 'ammo' ? AMMO[it.id].color : '#ffffff');
      this.hud.refreshSlots();
    }
    return true;
  }
  openContainer(s, a) {
    if (s.opened || !s.alive) return;
    if (this.isClient) { if (a.isPlayer && (!s.reqT || this.time - s.reqT > 1)) { s.reqT = this.time; this.netSend({ t: 'op', id: s.id }); } return; }
    if (this.isHost && this.netLive && s.kind === 'chest') this.netBroadcast({ t: 'co', id: s.id });
    s.opened = true;
    const i = this.world.interactables.indexOf(s); if (i >= 0) this.world.interactables.splice(i, 1);
    const p = s.pos;
    const d = this.camera.position.distanceTo(p);
    if (s.kind === 'chest') {
      s.lid.rotation.x = -1.9; s.glow.visible = false;
      SFX.chest(a.isPlayer ? 1 : clamp(1 - d / 40, 0, 1), this.panFor(p));
      const w = rollWeapon(this.rng, 0.8);
      this.spawnPickup(w, p.x, p.y + 0.4, p.z, true);
      this.spawnPickup(ammoFor(w.id), p.x, p.y + 0.4, p.z, true);
      if (this.rng() < 0.75) this.spawnPickup(rollConsumable(this.rng), p.x, p.y + 0.4, p.z, true);
      this.spawnPickup({ type: 'mat', id: pick(this.rng, ['wood', 'wood', 'stone', 'metal']), count: 30 }, p.x, p.y + 0.4, p.z, true);
      this.fx.burst(p, 0xffd060, 20, 4, 0.12, 0.8, 3);
    } else {
      SFX.pickup();
      const kinds = Object.keys(AMMO).filter(k => k !== 'rockets');
      for (let k = 0; k < 3; k++) { const id = pick(this.rng, kinds); this.spawnPickup({ type: 'ammo', id, count: AMMO[id].box }, p.x, p.y + 0.3, p.z, true); }
      this.world.destroyStructure(s, a);
    }
  }
  playerInteractTarget() {
    const a = this.player;
    if (a.state !== 'ground') return null;
    const f = new THREE.Vector3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
    let best = null, bs = 1e9;
    const consider = (obj, pos, maxD) => {
      const dx = pos.x - a.pos.x, dz = pos.z - a.pos.z, dy = pos.y - (a.pos.y + 0.5);
      const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.5);
      if (d > maxD || Math.abs(dy) > 2) return;
      const dot = d > 0.01 ? (dx * f.x + dz * f.z) / Math.hypot(dx, dz) : 1;
      const score = d - dot * 0.9;
      if (score < bs) { bs = score; best = obj; }
    };
    for (const s of this.world.interactables) if (!s.opened) consider(s, s.pos, 2.6);
    for (const p of this.pickups) if (!p.taken && p.settled) consider(p, p.pos, 2.3);
    return best;
  }
  playerInteract() {
    const t = this.playerInteractTarget();
    if (!t) return;
    if (t.isPickup) this.takePickup(this.player, t);
    else this.openContainer(t, this.player);
  }
  dropHeld() {
    const a = this.player;
    if (a.sel === 0 || a.buildMode) return;
    const it = a.slots[a.sel - 1]; if (!it) return;
    a.slots[a.sel - 1] = null;
    const f = a.forward();
    if (this.isClient) this.netSend({ t: 'dr', it, x: a.pos.x + f.x * 1.5, y: a.pos.y + 0.8, z: a.pos.z + f.z * 1.5 });
    else this.spawnPickup(it, a.pos.x + f.x * 1.5, a.pos.y + 0.8, a.pos.z + f.z * 1.5, true);
    a.select(0);
    this.hud.refreshSlots();
  }

  /* ---------------- Kampf ---------------- */
  hitscan(shooter, origin, dir, st, muzzle, drawTracer) {
    const range = st.range * 1.3;
    const wr = this.world.raycast(origin, dir, range);
    let bestT = wr.hit ? wr.t : range, hitA = null, head = false;
    for (const a of this.actors) {
      if (a === shooter || !a.alive || a.state === 'airship') continue;
      const cx = a.pos.x - origin.x, cy = a.pos.y + 1 - origin.y, cz = a.pos.z - origin.z;
      const along = cx * dir.x + cy * dir.y + cz * dir.z;
      if (along < 0 || along > bestT + 1.5) continue;
      const px = cx - dir.x * along, py = cy - dir.y * along, pz = cz - dir.z * along;
      if (px * px + py * py + pz * pz > 4) continue;
      const hgt = a.height;
      const th = raySphere(origin, dir, { x: a.pos.x, y: a.pos.y + hgt - 0.22, z: a.pos.z }, 0.27);
      const tb = rayCapsule(origin, dir, { x: a.pos.x, y: a.pos.y + 0.35, z: a.pos.z }, { x: a.pos.x, y: a.pos.y + hgt - 0.55, z: a.pos.z }, 0.38);
      if (th > 0 && th < bestT && (tb < 0 || th <= tb + 0.2)) { bestT = th; hitA = a; head = true; }
      else if (tb > 0 && tb < bestT) { bestT = tb; hitA = a; head = false; }
    }
    const end = new THREE.Vector3().copy(origin).addScaledVector(dir, bestT);
    if (this.isClient) {
      if (hitA) this.fx.hitSpark(end, hitA.shield > 0);
      else if (wr.hit && bestT < range && (drawTracer || st.pellets === 1)) this.fx.impact(end, 5, wr.struct ? MAT_COLORS[wr.struct.mat] : 0x9a8a6a);
      if (drawTracer) this.fx.tracer(muzzle, end, 0xfff2a0);
      return end;
    }
    if (hitA) {
      const dist = bestT;
      const fall = dist > st.range * 0.55 ? lerp(1, 0.6, clamp((dist - st.range * 0.55) / (st.range * 0.75), 0, 1)) : 1;
      const dmg = Math.max(1, Math.round(st.dmg * (head ? st.head : 1) * fall));
      hitA.takeDamage(dmg, shooter, { head, weapon: st });
      this.fx.hitSpark(end, hitA.shield > 0);
    } else if (wr.hit && bestT < range) {
      if (wr.struct) {
        const mul = st.pellets > 1 ? 0.9 : st.id === 'sniper' ? 1.5 : 1;
        const s = wr.struct;
        this.world.damageStructure(s, st.dmg * mul, shooter);
        if (shooter.isPlayer && s.alive && s.kind === 'build') this.hud.structHp(s);
      }
      if (drawTracer || st.pellets === 1) this.fx.impact(end, 5, wr.struct ? MAT_COLORS[wr.struct.mat] : 0x9a8a6a);
    }
    if (drawTracer) this.fx.tracer(muzzle, end, shooter.isPlayer ? 0xfff2a0 : 0xffc0a0);
    return end;
  }
  onShot(a, held, st, muzzle) {
    const d = a.isPlayer ? 0 : this.camera.position.distanceTo(a.pos);
    const vol = a.isPlayer ? 1 : Math.pow(clamp(1 - d / 220, 0, 1), 1.6) * 0.9;
    if (vol > 0.01) SFX.shot(st.sound, vol, a.isPlayer ? 0 : this.panFor(a.pos));
    if (d < 120) this.fx.muzzle(muzzle, st.pellets > 1 || held.id === 'sniper', a.isPlayer);
    if (a.isPlayer) {
      const kick = { pistol: 0.012, smg: 0.009, ar: 0.014, shotgun: 0.05, sniper: 0.07, rocket: 0.04 }[held.id] || 0.01;
      this.recoil += kick * (a.input.aim ? 0.7 : 1);
      if (Settings.cameraShake) this.shake = Math.min(1, this.shake + st.shake * 0.25);
    }
  }
  spawnRocket(a, pos, dir, st, visual) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), lambert(0x556b2f)); body.rotation.x = Math.PI / 2; g.add(body);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 8), lambert(0xd62828)); tip.rotation.x = Math.PI / 2; tip.position.z = 0.4; g.add(tip);
    g.position.copy(pos); g.lookAt(pos.clone().add(dir));
    this.scene.add(g);
    this.rockets.push({ owner: a, pos: g.position, vel: dir.clone().multiplyScalar(58), mesh: g, st, life: 5, visual: visual || this.isClient });
  }
  updateRockets(dt) {
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      r.vel.y -= 2 * dt;
      const step = r.vel.length() * dt;
      const dir = r.vel.clone().normalize();
      let hit = this.world.raycast(r.pos, dir, step);
      let boom = hit.hit || r.life <= 0 ? (hit.hit ? hit.point : r.pos.clone()) : null;
      if (!boom) for (const a of this.actors) {
        if (a === r.owner && r.life > 4.8) continue;
        if (!a.alive || a.state === 'airship') continue;
        const c = a.chest();
        if (c.distanceTo(r.pos) < 1.0) { boom = r.pos.clone(); break; }
      }
      if (boom) { this.explode(boom, r.owner, r.st, r.visual); this.scene.remove(r.mesh); this.rockets.splice(i, 1); continue; }
      r.pos.addScaledVector(dir, step);
      r.mesh.lookAt(r.pos.clone().add(dir));
      if (Math.random() < 0.8) this.fx.spawn(r.pos.x, r.pos.y, r.pos.z, (Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5), Math.random() < 0.5 ? 0xffa040 : 0x777777, 0.18, 0.5, -1);
    }
  }
  explode(p, owner, st, visual) {
    this.fx.explosion(p);
    const d = this.camera.position.distanceTo(p);
    SFX.explosion(clamp(1 - d / 250, 0, 1), this.panFor(p));
    if (Settings.cameraShake) this.shake = Math.min(1.5, this.shake + clamp(1 - d / 40, 0, 1) * 1.2);
    if (visual) return;
    const R = st.splash;
    for (const a of this.actors) {
      if (!a.alive || a.state === 'airship') continue;
      const dd = a.chest().distanceTo(p);
      if (dd < R) a.takeDamage(Math.round(st.dmg * (1 - dd / R * 0.7)), owner, { explosion: true, weapon: st });
    }
    const list = this.world.query(p.x - R, p.z - R, p.x + R, p.z + R).slice();
    const done = new Set();
    for (const c of list) {
      const s = c.struct; if (!s || done.has(s)) continue; done.add(s);
      const cx = clamp(p.x, c.min.x, c.max.x), cy = clamp(p.y, c.min.y, c.max.y), cz = clamp(p.z, c.min.z, c.max.z);
      const dd = Math.hypot(p.x - cx, p.y - cy, p.z - cz);
      if (dd < R) this.world.damageStructure(s, 400 * (1 - dd / R * 0.5), owner);
    }
  }
  harvestHit(a) {
    const origin = a.aimOrigin.clone(), dir = a.aimDir.clone();
    if (a.isPlayer) { origin.copy(a.chest()); }
    if (this.isClient) {
      // nur Optik – den echten Schlag rechnet der Host
      const rr_ = this.world.raycast(origin, dir, 3.2);
      if (rr_.hit && rr_.struct && !rr_.struct.indestructible) { SFX.harvest(rr_.struct.mat, 1, 0); this.fx.harvestHit(rr_.point, rr_.struct.mat); }
      this.netSend({ t: 'hv', o: [r2(origin.x), r2(origin.y), r2(origin.z)], d: [r2(dir.x), r2(dir.y), r2(dir.z)] });
      return;
    }
    const reach = a.isPlayer ? 3.2 : 2.8;
    // Gegner treffen?
    for (const o of this.actors) {
      if (o === a || !o.alive || o.state !== 'ground') continue;
      const c = o.chest();
      const to = c.clone().sub(a.chest()); const d = to.length();
      if (d < 2.4 && to.normalize().dot(a.forward()) > 0.5) {
        o.takeDamage(20, a, { melee: true });
        this.fx.hitSpark(c, o.shield > 0);
        return;
      }
    }
    const r = this.world.raycast(origin, dir, reach);
    if (!r.hit) {
      // Fallback: nach vorne in Brusthöhe
      const r2 = this.world.raycast(a.chest(), a.forward(), 2.6);
      if (!r2.hit || !r2.struct) return;
      r.struct = r2.struct; r.point = r2.point; r.hit = true;
    }
    const s = r.struct;
    if (!s) { this.fx.impact(r.point, 4, 0x8a7a5a); return; }
    if (s.indestructible || !s.alive) { this.fx.impact(r.point); return; }
    const crit = a.isPlayer && Math.random() < 0.25;
    const dmg = s.kind === 'build' ? 50 : (crit ? 100 : 50);
    const d = this.camera.position.distanceTo(r.point);
    SFX.harvest(s.mat, a.isPlayer ? 1 : clamp(1 - d / 40, 0, 1), a.isPlayer ? 0 : this.panFor(r.point));
    this.fx.harvestHit(r.point, s.mat);
    // Material
    if (s.kind !== 'build' && s.kind !== 'chest' && s.kind !== 'ammobox') {
      const base = s.kind === 'tree' ? 9 : s.kind === 'rock' ? 8 : s.mat === 'metal' ? 7 : 6;
      const gain = Math.round(base * (s.yieldMul || 1) * (crit ? 2 : 1));
      if (this.matsMode !== 'unbegrenzt') a.mats[s.mat] = Math.min(999, a.mats[s.mat] + gain);
      if (a.isPlayer) this.hud.matGain(s.mat, gain);
      if (this.isHost && a.netMode === 'proxy' && this.matsMode !== 'unbegrenzt') Net.sendMember(a.owner, { t: 'mt', m: s.mat, n: gain });
    }
    this.world.damageStructure(s, dmg, a);
    if (a.isPlayer) { this.hud.structHp(s); if (crit) this.hud.toast('Volltreffer! ×2', 0.6); }
  }
  onStructureDestroyed(s, by) {
    this.build.onDestroyed(s);
    const d = this.camera.position.distanceTo(s.center || s.mesh.position);
    if (d < 150) {
      this.fx.debris(s.center || s.mesh.position, s.mat, s.kind === 'tree' ? 24 : 16);
      SFX.breakPiece(s.mat, clamp(1 - d / 80, 0, 1), this.panFor(s.center || s.mesh.position));
    }
    if (s.kind === 'tree') this.fx.burst(new THREE.Vector3(s.center.x, s.center.y + 3, s.center.z), 0x3f8f3a, 20, 5, 0.3, 1.2, 10);
    if (s.kind === 'chest' && !s.opened) { s.opened = true; if (!this.isClient) this.openContainerLootOnly(s); }
    if (this.isHost && this.netLive) this.netBroadcast({ t: 'sx', id: s.id });
    // Dinge, die auf zerstörten Teilen standen, fallen (Schwerkraft macht das automatisch)
  }
  openContainerLootOnly(s) {
    const p = s.pos;
    const w = rollWeapon(this.rng, 0.5);
    this.spawnPickup(w, p.x, p.y + 0.4, p.z, true);
    this.spawnPickup(ammoFor(w.id), p.x, p.y + 0.4, p.z, true);
  }
  onDamage(victim, attacker, dealt, opts, shieldHit) {
    if (attacker) attacker.damageDone += dealt;
    if (this.isHost && this.netLive) {
      // Mitspieler über Schaden informieren
      if (victim.netMode === 'proxy') Net.sendMember(victim.owner, { t: 'hp', h: Math.max(0, Math.round(victim.hp)), s: Math.round(victim.shield), a: this.nidOf(attacker),
        f: (opts.storm ? 1 : 0) | (opts.fall ? 2 : 0) | (opts.head ? 4 : 0) | (shieldHit ? 8 : 0) });
      if (attacker && attacker.netMode === 'proxy' && attacker !== victim) {
        const hp = victim.headPos();
        Net.sendMember(attacker.owner, { t: 'hit', p: [r2(hp.x), r2(hp.y), r2(hp.z)], d: Math.round(dealt), h: !!opts.head, s: !!shieldHit, k: victim.hp <= 0 });
      }
    }
    if (attacker && attacker.isPlayer && victim !== attacker) {
      if (Settings.damageNumbers) this.hud.damageNumber(victim.headPos(), dealt, opts.head, shieldHit);
      this.hud.hitmarker(opts.head, victim.hp <= 0);
      SFX.hit(opts.head, shieldHit);
    }
    if (victim.isPlayer) {
      if (attacker && attacker !== victim) this.hud.damageDir(attacker.pos);
      if (!opts.storm) SFX.hurt(shieldHit);
      this.hud.hurtFlash(opts.storm ? 'storm' : 'hit');
      if (Settings.cameraShake && !opts.storm) this.shake = Math.min(1, this.shake + 0.3);
    }
  }
  onElimination(victim, killer, opts) {
    this.aliveCount = this.actors.filter(a => a.alive).length;
    if (this.isHost && this.netLive) {
      const o = { storm: !!(opts && opts.storm), fall: !!(opts && opts.fall), melee: !!(opts && opts.melee), explosion: !!(opts && opts.explosion), left: !!(opts && opts.left), pw: !!(opts && opts.power), w: opts && opts.weapon ? opts.weapon.id : null };
      this.netBroadcast({ t: 'el', v: this.nidOf(victim), k: killer && killer !== victim ? this.nidOf(killer) : -1, o, al: this.aliveCount });
    }
    victim.placement = this.aliveCount + 1;
    const wname = opts && opts.weapon ? opts.weapon.name : null;
    let msg;
    if (opts && opts.left) msg = `<b>${esc(victim.name)}</b> hat das Spiel verlassen`;
    else if (opts && opts.storm && !killer) msg = `<b>${esc(victim.name)}</b> wurde vom Sturm erwischt`;
    else if (opts && opts.fall && !killer) msg = `<b>${esc(victim.name)}</b> ist zu tief gefallen`;
    else if (killer && killer !== victim) msg = `<b>${esc(killer.name)}</b> ${wname ? 'hat' : 'hat'} <b>${esc(victim.name)}</b> ${wname ? 'mit ' + esc(wname) + ' ' : opts && opts.melee ? 'mit dem Erntehammer ' : ''}eliminiert`;
    else msg = `<b>${esc(victim.name)}</b> hat sich selbst eliminiert`;
    this.hud.killfeed(msg, victim.isPlayer || (killer && killer.isPlayer));
    if (this.camera.position.distanceTo(victim.pos) < 160) this.fx.killImpact(victim.chest(), !!(killer && killer.isPlayer));
    if (killer && killer !== victim) {
      killer.kills++;
      if (killer.isPlayer) {
        if (this.time - this.lastKillT < 7) this.streak++; else this.streak = 1;
        this.lastKillT = this.time;
        this.hud.elimBanner(victim.name, Math.round(killer.pos.distanceTo(victim.pos)), this.streak);
        this.slowmo(0.6, 0.28); this.fovKick = 8;
        if (Settings.cameraShake) this.shake = Math.min(1, this.shake + 0.45);
        SFX.elim(); SFX.killBoom();
      }
      // Bots: Schild auffüllen durch Eliminierung (kleiner Bonus)
    }
    if (victim.isPlayer) {
      this.state = 'dead';
      this.deathInfo = { killer: killer && killer !== victim ? killer.name : null, weapon: wname, storm: opts && opts.storm };
      this.player.input.fire = false;
      SFX.defeat();
      this.slowmo(1.5, 0.25); this.fovKick = -6;
      this.deathReal = performance.now();
      document.body.classList.add('dying');
      this.hud.deathBanner(this.deathInfo.killer, opts && opts.storm);
      setTimeout(() => { if (!this.disposed) this.finish(false); }, 3600);
      this.spectating = killer && killer.alive && killer !== victim ? killer : null;
    }
    if (this.aliveCount <= 1 && !this.over && !this.isClient) {
      const winner = this.actors.find(a => a.alive);
      if (winner && this.isHost && this.netLive) this.netBroadcast({ t: 'wn', n: this.nidOf(winner) });
      if (winner) { winner.placement = 1; this.winner = winner; }
      if (winner && winner.isPlayer) {
        this.state = 'won'; this.over = true;
        winner.emoteT = 0;
        SFX.victory();
        this.hud.victory();
        setTimeout(() => { if (!this.disposed) this.finish(true); }, 5500);
      } else {
        this.over = true;
        if (this.player.alive === false && this.state !== 'dead') this.finish(false);
        else if (this.endShown) this.cb.onUpdateEnd && this.cb.onUpdateEnd(this.endInfo(false));
      }
    }
  }
  endInfo(won) {
    const p = this.player;
    return {
      won, place: won ? 1 : p.placement, total: this.actors.length, kills: p.kills, damage: Math.round(p.damageDone),
      time: this.matchTime, killer: this.deathInfo ? this.deathInfo.killer : null, weapon: this.deathInfo ? this.deathInfo.weapon : null,
      storm: this.deathInfo ? this.deathInfo.storm : false, winner: this.winner ? this.winner.name : null, seed: this.seedText,
    };
  }
  finish(won) {
    if (this.endShown) return;
    this.endShown = true;
    const info = this.endInfo(won);
    Stats.played++; Stats.kills += info.kills; Stats.damage += info.damage; Stats.timeAlive += Math.round(info.time);
    if (won) Stats.wins++;
    if (info.place <= 10) Stats.top10++;
    Stats.bestKills = Math.max(Stats.bestKills, info.kills);
    Stats.bestPlace = Stats.bestPlace ? Math.min(Stats.bestPlace, info.place) : info.place;
    saveStats();
    if (this.cb.onEnd) this.cb.onEnd(info);
  }
  spectateNext() {
    const alive = this.actors.filter(a => a.alive && a.state !== 'airship');
    if (!alive.length) return;
    const i = alive.indexOf(this.spectating);
    this.spectating = alive[(i + 1) % alive.length];
  }

  /* ---------------- Hilfen ---------------- */
  panFor(pos) {
    const c = this.camera;
    const dx = pos.x - c.position.x, dz = pos.z - c.position.z;
    const l = Math.hypot(dx, dz) || 1;
    const rx = Math.cos(this.camYaw), rz = -Math.sin(this.camYaw);
    return clamp(-(dx * rx + dz * rz) / l, -1, 1) * 0.8;
  }
  camForward() {
    const cp = Math.cos(this.camPitch);
    return new THREE.Vector3(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
  }

  /* ---------------- Spieler-Eingabe ---------------- */
  handleInput(dt) {
    const p = this.player, inp = p.input;
    if (this.menuOpen) { Input.takeMouse(); inp.fz = inp.fx = 0; inp.fire = false; inp.aim = false; inp.sprint = false; return; }
    const [mx, my] = Input.takeMouse();
    const w = p.heldWeapon;
    const ads = inp.aim && !p.buildMode && w && p.state === 'ground';
    const scoped = ads && WEAPONS[w.id].scope;
    const mult = scoped ? Settings.scopeSens : ads ? Settings.adsSens : 1;
    const k = 0.0022 * Settings.sens * mult;
    if (this.state !== 'won') {
      this.camYaw -= mx * k;
      this.camPitch -= my * k * (Settings.invertY ? -1 : 1);
    }
    this.camPitch = clamp(this.camPitch, -1.45, 1.4);
    // Rückstoß erholt sich
    if (this.recoil > 0) { const r = Math.min(this.recoil, dt * 0.25 + this.recoil * dt * 10); this.camPitch += r; this.recoil -= r; }

    if (this.state === 'dead' || this.state === 'won' || !p.alive) {
      inp.fz = inp.fx = 0; inp.fire = false; inp.aim = false;
      if (this.state === 'dead' && Input.mouseHit[0]) this.spectateNext();
      return;
    }
    inp.fz = (Input.held('forward') ? 1 : 0) - (Input.held('back') ? 1 : 0);
    inp.fx = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    if (Input.pressed('jump')) {
      if (p.state === 'airship') { if (this.doorsT <= 0) this.jumpOut(p); else this.hud.toast('Die Türen sind noch zu!'); }
      else inp.jump = true;
    }
    if (Settings.toggleSprint) { if (Input.pressed('sprint')) this.sprintToggled = !this.sprintToggled; if (inp.fz <= 0) this.sprintToggled = false; inp.sprint = this.sprintToggled; }
    else inp.sprint = Input.held('sprint');
    inp.dive = true;
    if (Settings.toggleCrouch) { if (Input.pressed('crouch')) this.crouchToggled = !this.crouchToggled; if (inp.sprint && inp.fz > 0) this.crouchToggled = false; inp.crouch = this.crouchToggled; }
    else inp.crouch = Input.held('crouch');
    if (Input.axis.on) {
      inp.fz = -Input.axis.y; inp.fx = Input.axis.x;
      if (Math.hypot(Input.axis.x, Input.axis.y) > 0.92 && inp.fz > 0.6) inp.sprint = true;
    }
    inp.fire = Input.mouse[0] || Input.tFire;
    inp.aim = Input.mouse[2] || Input.tAim;
    if (p.state !== 'ground') { inp.fire = false; inp.aim = false; }

    if (Input.pressed('reload')) p.startReload();
    if (Input.pressed('pickaxe')) p.select(0);
    for (let i = 1; i <= 5; i++) if (Input.pressed('slot' + i)) p.select(i);
    if (Input.wheel) {
      if (p.buildMode) {
        const i = BUILD_TYPES.indexOf(p.buildType);
        p.buildType = BUILD_TYPES[(i + (Input.wheel > 0 ? 1 : 3)) % 4];
        this.hud.refreshSlots();
      } else {
        const order = [0, 1, 2, 3, 4, 5].filter(i => i === 0 || p.slots[i - 1]);
        let i = order.indexOf(p.sel); if (i < 0) i = 0;
        i = (i + (Input.wheel > 0 ? 1 : order.length - 1)) % order.length;
        p.select(order[i]);
      }
    }
    if (Input.pressed('build')) { p.setBuildMode(!p.buildMode); SFX.ui(); }
    for (const t of BUILD_TYPES) if (Input.pressed(t)) { p.buildType = t; if (!p.buildMode) p.setBuildMode(true); else this.hud.refreshSlots(); }
    if (Input.pressed('material')) {
      const ms = ['wood', 'stone', 'metal'];
      p.buildMat = ms[(ms.indexOf(p.buildMat) + 1) % 3]; this.hud.refreshSlots(); SFX.ui();
    }
    if (Input.pressed('emote') && p.state === 'ground' && p.grounded) { p.emoteT = p.emoteT >= 0 ? -1 : 0; if (p.buildMode) p.setBuildMode(false); }
    if (Input.pressed('map')) this.hud.toggleMap();
    if (Input.pressed('power') && p.powerUnlocked) this.tryPower();
    if (Input.pressed('interact')) this.playerInteract();
    if (Input.pressed('drop')) this.dropHeld();
    if (Input.pressed('rotate') && p.buildMode) { this.hud.toast('Bauteile drehen sich automatisch mit deiner Blickrichtung'); }

    // Blick -> Figur
    if (p.state !== 'airship' && p.emoteT < 0) p.yaw = this.camYaw;
    p.pitch = this.camPitch;
    // Zielpunkt über die Kamera bestimmen
    const f = this.camForward();
    p.aimOrigin.copy(p.chest());
    if (p.state === 'ground' && (inp.fire || p.buildMode || p.sel === 0)) {
      const cam = this.camera.position;
      const r = this.world.raycast(cam, f, 300, {});
      let T = r.t;
      for (const a of this.actors) {
        if (a === p || !a.alive || a.state === 'airship') continue;
        const t = rayCapsule(cam, f, { x: a.pos.x, y: a.pos.y + 0.3, z: a.pos.z }, { x: a.pos.x, y: a.pos.y + a.height - 0.2, z: a.pos.z }, 0.42);
        if (t > 0 && t < T) T = t;
      }
      const target = cam.clone().addScaledVector(f, T);
      const d = target.clone().sub(p.aimOrigin);
      if (d.length() < 1.2 || d.dot(f) < 0) p.aimDir.copy(f); else p.aimDir.copy(d.normalize());
    } else p.aimDir.copy(f);
  }

  /* ---------------- Update ---------------- */
  slowmo(dur, min) { if (this.net) return; this.slowT = dur; this.slowDur = dur; this.slowMin = min; } // online keine Zeitlupe (alle teilen eine Zeit)
  update(dt) {
    if (this.paused && !this.net) return;
    // Zeitlupe (bei Eliminierungen)
    const real = dt;
    if (this.slowT > 0) { this.slowT -= real; const k = clamp(this.slowT / this.slowDur, 0, 1); this.timeScale = lerp(1, this.slowMin, Math.min(1, k * 1.7)); }
    else this.timeScale = 1;
    dt *= this.timeScale;
    this.fovKick = damp(this.fovKick, 0, 4, real);
    if (this.deathReal && document.body.classList.contains('dying') && performance.now() - this.deathReal > 2900) document.body.classList.remove('dying');
    this.time += dt;
    if (this.state !== 'airship') this.matchTime += dt;
    this.handleInput(dt);
    // Luftschiff
    if (this.ship) {
      this.doorsT -= dt;
      this.shipT += dt / this.shipDur;
      const t = Math.min(1, this.shipT);
      this.ship.position.lerpVectors(this.shipFrom, this.shipTo, t);
      this.prop.rotation.z += dt * 12;
      for (const a of this.actors) {
        if (a.state !== 'airship') continue;
        a.pos.copy(this.ship.position);
        if (this.doorsT <= 0 && ((a.bot && t >= a.bot.jumpAt) || (t >= 1 && !a.netMode))) this.jumpOut(a);
      }
      if (t >= 1 && this.actors.every(a => a.state !== 'airship')) {
        this.ship.position.addScaledVector(this.shipTo.clone().sub(this.shipFrom).normalize(), dt * 22);
        if (this.shipT > 1.6) { this.scene.remove(this.ship); this.ship = null; }
      }
    }
    for (const a of this.actors) { if (a.bot && a.alive) a.bot.update(dt); }
    for (const a of this.actors) a.update(dt);
    // Bots sammeln Munition/Material automatisch ein
    this.botPickT -= dt;
    if (this.botPickT <= 0) {
      this.botPickT = 0.4;
      for (const a of this.actors) {
        if (!a.alive || a.state !== 'ground' || a.netMode) continue;
        if (this.isClient && !a.isPlayer) continue;
        if (a.isPlayer && !Settings.autoPickup) continue;
        for (const p of this.pickups) {
          if (p.taken || !p.settled || (p.item.type !== 'ammo' && p.item.type !== 'mat')) continue;
          if (Math.abs(p.pos.x - a.pos.x) < 1.4 && Math.abs(p.pos.z - a.pos.z) < 1.4 && Math.abs(p.pos.y - a.pos.y) < 1.5) this.takePickup(a, p);
        }
      }
    }
    this.powerUpdate(dt);
    this.updatePickups(dt);
    this.updateRockets(dt);
    this.storm.update(dt);
    this.build.update(dt);
    this.updateCamera(dt);
    this.world.update(dt, this.camera.position);
    this.fx.update(dt);
    // Bauvorschau
    const p = this.player;
    if (p.alive && p.buildMode && p.state === 'ground' && this.state === 'play') this.buildPreview = this.build.updateGhost(p, p.buildType, p.buildMat, p.yaw, p.pitch, true);
    else { this.build.hideGhosts(); this.buildPreview = null; }
    // Licht folgt dem Spieler
    const focus = this.focusActor().pos;
    this.sun.position.copy(focus).addScaledVector(this.sunDir, 150);
    this.sun.target.position.copy(focus);
    // Sturm-Atmosphäre
    const inStorm = this.state !== 'airship' && !this.storm.inside(this.camera.position.x, this.camera.position.z);
    this.stormMix = damp(this.stormMix || 0, inStorm ? 1 : 0, 3, dt);
    const fogCol = this.skyColor.clone().lerp(new THREE.Color(0x6a3aa8), this.stormMix);
    this.scene.fog.color.copy(fogCol);
    this.scene.fog.near = lerp(60, 8, this.stormMix);
    this.scene.fog.far = lerp(Settings.viewDist, 90, this.stormMix);
    this.world.sky.material.uniforms.tint.value.setRGB(lerp(1, 0.6, this.stormMix), lerp(1, 0.4, this.stormMix), lerp(1, 0.9, this.stormMix));
    SFX.setStorm(inStorm && p.alive ? 0.25 : 0);
    SFX.setWind(p.alive && (p.state === 'skydive' || p.state === 'glide') ? (p.state === 'skydive' ? 0.5 : 0.25) : this.state === 'airship' ? 0.1 : 0);
    // Truhen-Summen
    this.chestHumT -= dt;
    if (this.chestHumT <= 0) {
      this.chestHumT = 0.5;
      let best = null, bd = 14;
      for (const s of this.world.interactables) if (s.kind === 'chest' && !s.opened) { const d = s.pos.distanceTo(this.camera.position); if (d < bd) { bd = d; best = s; } }
      if (best) SFX.chestHum(1 - bd / 14, this.panFor(best.pos));
    }
    // Sichtbarkeit weit entfernter Objekte
    this.visT -= dt;
    if (this.visT <= 0) {
      this.visT = 0.4;
      const c = this.camera.position;
      for (const pk of this.pickups) pk.mesh.visible = pk.pos.distanceTo(c) < 110;
      for (const a of this.actors) {
        const d = a.pos.distanceTo(c);
        a.farHidden = d > 160 && a !== this.focusActor();
        a.setShadow(d < 55);
      }
    }
    this.hud.update(dt);
    this.netUpdate(real);
  }
  updatePickups(dt) {
    for (const p of this.pickups) {
      p.t += dt;
      if (!p.settled) {
        p.vel.y -= 18 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const gy = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.3, 0.3);
        if (p.pos.y <= gy) { p.pos.y = gy; p.settled = true; p.vel.set(0, 0, 0); }
      } else {
        // Boden könnte verschwunden sein
        const gy = this.world.groundAt(p.pos.x, p.pos.z, p.pos.y + 0.2, 0.3);
        if (gy < p.pos.y - 0.05) { p.settled = false; }
      }
      const inner = p.mesh.userData.inner;
      inner.rotation.y += dt * 1.2;
      inner.position.y = 0.35 + Math.sin(p.t * 2.5) * 0.08;
    }
  }
  focusActor() {
    // nach dem eigenen Tod zuerst den eigenen Flug zeigen, dann zuschauen
    if (this.state === 'dead' && performance.now() - this.deathReal < 2700) return this.player;
    if ((this.state === 'dead') && this.spectating && this.spectating.alive) return this.spectating;
    if (this.state === 'dead' && (!this.spectating || !this.spectating.alive)) { this.spectateNext(); if (this.spectating) return this.spectating; }
    return this.player;
  }
  updateCamera(dt) {
    const cam = this.camera, p = this.player;
    const a = this.focusActor();
    const spectate = a !== p;
    this.shake = Math.max(0, this.shake - dt * 3);
    let pivot, dist, shoulder = 0, up = 0.25;
    const w = p.heldWeapon;
    const ads = !spectate && p.input.aim && !p.buildMode && w && p.state === 'ground' && p.alive;
    let fov = Settings.fov;
    this.scoped = false;
    if (!spectate && p.state === 'airship' && this.ship) {
      pivot = this.ship.position.clone(); dist = 42; up = 4;
    } else if (a.state === 'skydive' || a.state === 'glide') {
      pivot = a.pos.clone().add(new THREE.Vector3(0, 1.4, 0)); dist = a.state === 'skydive' ? 7 : 6.5; up = 0.6;
      fov += a.state === 'skydive' ? 6 : 0;
    } else if (this.state === 'won') {
      this.camYaw += dt * 0.4;
      pivot = a.pos.clone().add(new THREE.Vector3(0, 1.2, 0)); dist = 4.5; this.camPitch = damp(this.camPitch, -0.2, 3, dt);
    } else {
      pivot = a.pos.clone().add(new THREE.Vector3(0, (a.alive ? a.height : 1) - 0.12, 0));
      dist = ads ? 2.4 : Settings.camDist;
      shoulder = (Settings.shoulder === 'links' ? -1 : 1) * (ads ? 0.95 : 0.62);
      if (ads) up = 0.32;
      if (spectate) { this.camYaw = dampAngle(this.camYaw, a.yaw, 5, dt); this.camPitch = damp(this.camPitch, a.pitch * 0.5 - 0.1, 5, dt); }
      if (ads) { fov = Settings.fov / WEAPONS[w.id].zoom; if (WEAPONS[w.id].scope) this.scoped = true; }
      if (a.sprint) fov += 5;
      if (p.emoteT >= 0 && !spectate) dist = 4.8;
    }
    this.camDist = damp(this.camDist, dist, 10, dt);
    fov += this.fovKick;
    this.curFov = damp(this.curFov, fov, 14, dt);
    if (Math.abs(cam.fov - this.curFov) > 0.01) { cam.fov = this.curFov; cam.updateProjectionMatrix(); }
    const f = this.camForward();
    const right = new THREE.Vector3(-Math.cos(this.camYaw), 0, Math.sin(this.camYaw));
    const base = pivot.clone().addScaledVector(right, shoulder).add(new THREE.Vector3(0, up, 0));
    // Kollision
    const back = f.clone().negate();
    let d = this.camDist;
    if (p.state !== 'airship' || spectate) {
      const r = this.world.raycast(base, back, d + 0.3, { includeAll: false });
      if (r.hit) d = Math.max(0.4, r.t - 0.3);
    }
    cam.position.copy(base).addScaledVector(back, d);
    const gy = this.world.heightAt(cam.position.x, cam.position.z);
    if (cam.position.y < gy + 0.3) cam.position.y = gy + 0.3;
    if (cam.position.y < -0.05 && cam.position.y > -0.6) cam.position.y = 0.1;
    if (this.shake > 0.001) {
      const s = this.shake * 0.08;
      cam.position.x += (Math.random() - 0.5) * s; cam.position.y += (Math.random() - 0.5) * s; cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.lookAt(cam.position.clone().add(f));
    // Spieler beim Zielen durchsichtig/ausblenden, wenn Kamera sehr nah
    p.rig.root.visible = p.rig.root.visible && !(this.scoped) && !(d < 0.8 && !spectate);
  }
  render() {
    this.renderer.render(this.scene, this.camera);
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  dispose() {
    this.disposed = true;
    if (this.net) { Net.onGameMsg = null; Net.onPeerLeft = null; }
    document.body.classList.remove('dying');
    this.hud.dispose();
    this.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map) m.map.dispose(); m.dispose(); } }
    });
    if (this.sun.shadow.map) this.sun.shadow.map.dispose();
    this.renderer.renderLists.dispose();
    SFX.setWind(0); SFX.setStorm(0);
  }
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
