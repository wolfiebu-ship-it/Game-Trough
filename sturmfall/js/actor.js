'use strict';
/* ============================================================
   Actor: Spieler und Bots – Bewegung, Physik, Inventar, Waffen,
   Heilen, Schaden, Eliminierung
   ============================================================ */

const ACTOR_R = 0.4, ACTOR_H = 1.8, ACTOR_HC = 1.25, STEP_H = 0.62, GRAVITY = 25;
const WALK_SPEED = 5.6, SPRINT_SPEED = 8.0, CROUCH_SPEED = 2.9, JUMP_VEL = 8.2;
const PICKAXE_TIME = 0.55;

class Actor {
  constructor(game, opts) {
    this.game = game;
    this.name = opts.name;
    this.isPlayer = !!opts.isPlayer;
    this.outfitIndex = opts.outfit || 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.state = 'airship';
    this.grounded = false; this.groundCol = null; this.crouch = false; this.sprint = false;
    this.hp = 100; this.shield = 0; this.alive = true;
    this.slots = [null, null, null, null, null];
    this.sel = 0; // 0 = Erntehammer, 1..5 = Slots
    this.ammo = { light: 0, medium: 0, shells: 0, heavy: 0, rockets: 0 };
    this.mats = { wood: 0, stone: 0, metal: 0 };
    this.input = { fx: 0, fz: 0, jump: false, sprint: false, crouch: false, fire: false, aim: false, dive: false };
    this.fireCd = 0; this.reloadT = -1; this.bloom = 0; this.swingT = -1; this.swingHit = false;
    this.healT = -1; this.healSlot = -1; this.emoteT = -1; this.fireKick = 0; this.hurt = 0;
    this.firePrev = false;
    this.buildMode = false; this.buildType = 'wall'; this.buildMat = 'wood';
    this.powerT = -1; this.powerCd = 0; this.powerUnlocked = false;
    this.kills = 0; this.damageDone = 0; this.placement = 0;
    this.lastAttacker = null; this.lastHitTime = -99;
    this.aimOrigin = new THREE.Vector3(); this.aimDir = new THREE.Vector3(0, 0, 1);
    this.fallStartY = 0;
    this.rig = new CharacterRig(this.outfitIndex);
    this.rig.root.visible = false;
    game.scene.add(this.rig.root);
    this.rig.stepCb = () => this.onStep();
    this.deadT = 0;
    this.stormTick = 0;
    this.refreshHeld();
  }
  setShadow(on) {
    if (this.shadowOn === on) return;
    this.shadowOn = on;
    this.rig.root.traverse(o => { if (o.isMesh) o.castShadow = on; });
  }
  get height() { return this.crouch && this.state === 'ground' ? ACTOR_HC : ACTOR_H; }
  get held() { return this.sel === 0 ? null : this.slots[this.sel - 1]; }
  get heldWeapon() { const h = this.held; return h && h.type === 'weapon' ? h : null; }
  chest() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height - 0.45, this.pos.z); }
  headPos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.height - 0.2, this.pos.z); }
  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  refreshHeld() {
    const h = this.held;
    const key = this.buildMode ? 'build' : h ? (h.type + ':' + h.id + ':' + (h.rarity || 0)) : 'pickaxe';
    if (this.buildMode) this.rig.setHeld('build', null);
    else this.rig.setHeld(key, makeHeldMesh(h, this.rig.outfit));
  }
  select(i) {
    if (i === this.sel && !this.buildMode) return;
    this.sel = i; this.buildMode = false;
    this.reloadT = -1; this.healT = -1; this.swingT = -1; this.emoteT = -1;
    this.fireCd = Math.max(this.fireCd, 0.15);
    this.refreshHeld();
    if (this.isPlayer) this.game.hud.refreshSlots();
  }
  setBuildMode(on) {
    this.buildMode = on; this.reloadT = -1; this.healT = -1; this.swingT = -1; this.emoteT = -1;
    this.refreshHeld();
    if (this.isPlayer) this.game.hud.refreshSlots();
  }

  /* ---------------- Inventar ---------------- */
  freeSlot() { return this.slots.indexOf(null); }
  give(item) {
    // gibt übrig gebliebenen Gegenstand zurück (oder null)
    if (item.type === 'ammo') { this.ammo[item.id] += item.count; return null; }
    if (item.type === 'mat') { const cap = 999; const add = Math.min(cap - this.mats[item.id], item.count); this.mats[item.id] += add; return add < item.count ? Object.assign({}, item, { count: item.count - add }) : null; }
    if (item.type === 'consumable') {
      const stack = CONSUMABLES[item.id].stack;
      let left = item.count;
      for (const s of this.slots) if (s && s.type === 'consumable' && s.id === item.id && s.count < stack) { const n = Math.min(left, stack - s.count); s.count += n; left -= n; if (!left) break; }
      if (left > 0) { const f = this.freeSlot(); if (f >= 0) { this.slots[f] = { type: 'consumable', id: item.id, count: left }; left = 0; } }
      if (this.isPlayer) this.game.hud.refreshSlots();
      return left > 0 ? Object.assign({}, item, { count: left }) : null;
    }
    if (item.type === 'weapon') {
      const f = this.freeSlot();
      if (f >= 0) { this.slots[f] = item; if (this.sel === 0 && !this.buildMode && this.isPlayer && !this.slots.some((s, i) => i !== f && s && s.type === 'weapon')) this.select(f + 1); if (this.isPlayer) this.game.hud.refreshSlots(); return null; }
      // Tauschen mit aktueller Waffe/Slot
      const idx = this.sel > 0 ? this.sel - 1 : 0;
      const old = this.slots[idx];
      this.slots[idx] = item;
      this.sel = idx + 1; this.reloadT = -1; this.refreshHeld();
      if (this.isPlayer) this.game.hud.refreshSlots();
      return old;
    }
    return item;
  }
  canTake(item) {
    if (item.type === 'ammo' || item.type === 'mat') return true;
    if (item.type === 'consumable') return this.freeSlot() >= 0 || this.slots.some(s => s && s.type === 'consumable' && s.id === item.id && s.count < CONSUMABLES[item.id].stack);
    return true;
  }

  /* ---------------- Update ---------------- */
  update(dt) {
    const g = this.game, w = g.world;
    if (this.state === 'dead') { this.updateDeath(dt); return; }
    if (this.netMode) { this.updateNet(dt); return; }
    this.fireCd -= dt; this.hurt = Math.max(0, this.hurt - dt * 4); this.fireKick = Math.max(0, this.fireKick - dt * 8);
    if (this.powerT >= 0) { this.powerT += dt; if (this.powerT > 1.15) this.powerT = -1; }
    this.bloom = Math.max(0, this.bloom - dt * 0.09);
    const inp = this.input;

    if (this.state === 'airship') {
      this.rig.root.visible = false;
      return;
    }
    if (this.state === 'skydive' || this.state === 'glide') this.updateAir(dt);
    else this.updateGround(dt);

    // Welt-Grenze
    const R = 268, d = Math.hypot(this.pos.x, this.pos.z);
    if (d > R) { this.pos.x *= R / d; this.pos.z *= R / d; }

    this.updateActions(dt);

    // Sturmschaden (1x pro Sekunde) – online rechnet ihn der Host
    if (!g.isClient && g.storm && g.storm.state !== 'idle' && !g.storm.inside(this.pos.x, this.pos.z)) {
      this.stormTick -= dt;
      if (this.stormTick <= 0) { this.stormTick = 1; this.takeDamage(g.storm.dmg, null, { storm: true }); if (this.isPlayer) SFX.stormTick(); }
    } else this.stormTick = 0.5;

    // Rig (weit entfernte Figuren werden nicht gezeichnet/animiert)
    const rig = this.rig;
    rig.root.visible = !this.farHidden;
    if (this.farHidden) return;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.yaw;
    rig.update(dt, this.animParams());
  }
  updateGround(dt) {
    const w = this.game.world, inp = this.input;
    this.crouch = inp.crouch && this.grounded;
    const wantSprint = inp.sprint && inp.fz > 0.3 && !inp.aim && !this.crouch && this.healT < 0 && this.reloadT < 0;
    this.sprint = wantSprint;
    let speed = this.crouch ? CROUCH_SPEED : wantSprint ? SPRINT_SPEED : WALK_SPEED;
    if (inp.aim && !this.buildMode) speed *= 0.72;
    if (this.healT >= 0) speed = Math.min(speed, 3.2);
    if (this.pos.y < -0.6) speed *= 0.6;
    if (this.emoteT >= 0 && (Math.abs(inp.fx) + Math.abs(inp.fz) > 0.1 || inp.jump)) this.emoteT = -1;
    if (this.emoteT >= 0) speed = 0;
    if (this.powerT >= 0 && this.powerT < 0.9) speed = 0;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = sy * inp.fz - cy * inp.fx, wz = cy * inp.fz + sy * inp.fx;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }
    const acc = this.grounded ? 14 : 2.5;
    this.vel.x = damp(this.vel.x, wx * speed, acc, dt);
    this.vel.z = damp(this.vel.z, wz * speed, acc, dt);
    if (inp.jump && this.grounded && this.emoteT < 0) {
      this.vel.y = JUMP_VEL * (this.pos.y < -0.6 ? 0.6 : 1); this.grounded = false; this.fallStartY = this.pos.y;
      if (this.isPlayer) SFX.jump();
    }
    inp.jump = false;
    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -55) this.vel.y = -55;
    const h = this.height;
    const prevY = this.pos.y;
    this.pos.y += this.vel.y * dt;
    if (this.vel.y > 0) {
      const ceil = w.ceilingAt(this.pos.x, this.pos.z, ACTOR_R, prevY + h, this.pos.y + h);
      if (ceil < Infinity) { this.pos.y = ceil - h - 0.01; this.vel.y = 0; }
    }
    this.pos.x += this.vel.x * dt; this.pos.z += this.vel.z * dt;
    w.collideActor(this.pos, ACTOR_R, h, STEP_H, this.vel);
    const out = {};
    const stepUp = this.grounded ? STEP_H : 0.12;
    const gy = w.groundAt(this.pos.x, this.pos.z, Math.max(this.pos.y, prevY), stepUp, out);
    const wasGrounded = this.grounded;
    if ((this.pos.y <= gy + 0.001 && this.vel.y <= 0.01) || (wasGrounded && this.vel.y <= 0 && this.pos.y - gy < 0.45)) {
      if (!wasGrounded) this.onLand();
      this.pos.y = gy; this.vel.y = 0; this.grounded = true; this.groundCol = out.col;
    } else {
      if (wasGrounded) this.fallStartY = this.pos.y;
      this.grounded = false; this.groundCol = null;
    }
    if (this.pos.y < gy - 1.5) this.pos.y = gy; // Sicherheitsnetz
  }
  onLand() {
    const fall = this.fallStartY - this.pos.y;
    if (fall > 9 && this.state === 'ground') {
      const dmg = Math.round((fall - 9) * 7);
      if (dmg > 0) { if (this.game.isClient) this.game.netSend({ t: 'fd', d: dmg }); else this.takeDamage(dmg, null, { fall: true }); }
    }
    if (this.isPlayer) SFX.land(fall > 5);
  }
  updateAir(dt) {
    const w = this.game.world, inp = this.input;
    const out = {};
    const gy = w.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.3, out);
    const above = this.pos.y - gy;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = sy * inp.fz - cy * inp.fx, wz = cy * inp.fz + sy * inp.fx;
    if (this.state === 'skydive') {
      const dive = inp.fz > 0.5 && inp.dive;
      this.vel.y = damp(this.vel.y, dive ? -19 : -15, 1.2, dt);
      const hs = dive ? 18 : 15;
      this.vel.x = damp(this.vel.x, wx * hs, 2.2, dt); this.vel.z = damp(this.vel.z, wz * hs, 2.2, dt);
      this.diving = dive;
      const auto = this.isPlayer ? Settings.autoGlider : true;
      const openH = this.isPlayer ? 60 : (this.botOpenH || 55);
      if ((auto && above < openH) || (inp.jump && above < 110) || above < 12) {
        this.state = 'glide';
        if (this.isPlayer) SFX.glider();
      }
      inp.jump = false;
    } else {
      this.vel.y = damp(this.vel.y, inp.fz > 0.3 ? -6.5 : -4.8, 2.5, dt);
      const hs = 11 + Math.max(0, inp.fz) * 6;
      this.vel.x = damp(this.vel.x, wx * hs, 2, dt); this.vel.z = damp(this.vel.z, wz * hs, 2, dt);
    }
    this.pos.addScaledVector(this.vel, dt);
    w.collideActor(this.pos, ACTOR_R, ACTOR_H, 0.2, this.vel);
    const gy2 = w.groundAt(this.pos.x, this.pos.z, this.pos.y, 0.4, out);
    if (this.pos.y <= gy2) {
      this.pos.y = gy2; this.state = 'ground'; this.grounded = true; this.vel.set(this.vel.x * 0.3, 0, this.vel.z * 0.3);
      this.fallStartY = this.pos.y;
      if (this.isPlayer) { SFX.land(true); this.game.onPlayerLanded(); }
    }
  }
  updateActions(dt) {
    const g = this.game, inp = this.input;
    if (this.state !== 'ground') { this.firePrev = inp.fire; return; }
    const w = this.heldWeapon;
    const fireEdge = inp.fire && !this.firePrev;
    this.firePrev = inp.fire;
    if (inp.fire && this.emoteT >= 0) this.emoteT = -1;
    if (this.emoteT >= 0) this.emoteT += dt;

    // Nachladen
    if (this.reloadT >= 0 && w) {
      const st = weaponStats(w.id, w.rarity);
      this.reloadT += dt / st.reload;
      if (this.reloadT >= 1) {
        if (st.perShell) {
          if (this.ammo[st.ammo] > 0 && w.mag < st.mag) { w.mag++; this.ammo[st.ammo]--; if (this.isPlayer) SFX.reload(1); }
          this.reloadT = (w.mag < st.mag && this.ammo[st.ammo] > 0) ? 0 : -1;
        } else {
          const need = st.mag - w.mag, n = Math.min(need, this.ammo[st.ammo]);
          w.mag += n; this.ammo[st.ammo] -= n; this.reloadT = -1;
          if (this.isPlayer) SFX.reload(1);
        }
        if (this.isPlayer) g.hud.refreshSlots();
      }
    }
    // Heilen
    if (this.healT >= 0) {
      const it = this.slots[this.healSlot];
      if (!it || it.type !== 'consumable' || this.sel - 1 !== this.healSlot) { this.healT = -1; }
      else {
        const c = CONSUMABLES[it.id];
        this.healT += dt / c.time;
        if (this.healT >= 1) {
          this.healT = -1;
          if (c.heal) this.hp = Math.min(c.overflow ? 100 : c.cap, this.hp + c.heal);
          if (c.id === 'fruit' || it.id === 'fruit') { if (this.hp >= 100) this.shield = Math.min(100, this.shield + 5); }
          if (c.shield) this.shield = Math.min(c.cap, this.shield + c.shield);
          it.count--;
          if (it.count <= 0) { this.slots[this.healSlot] = null; this.select(0); }
          if (this.isPlayer) { if (c.shield) SFX.shieldUp(); else SFX.heal(); g.hud.refreshSlots(); }
          if (this.isPlayer && g.isClient) g.netSend({ t: 'hl', h: this.hp, s: this.shield });
        }
      }
    }
    // Erntehammer-Schwung
    if (this.swingT >= 0) {
      this.swingT += dt / PICKAXE_TIME;
      if (!this.swingHit && this.swingT >= 0.45) { this.swingHit = true; g.harvestHit(this); }
      if (this.swingT >= 1) this.swingT = -1;
    }
    if (this.buildMode) {
      if (inp.fire && this.fireCd <= 0) {
        const s = g.build.place(this, this.buildType, this.buildMat, this.yaw, this.pitch);
        this.fireCd = 0.12;
        if (s) { if (this.isPlayer) SFX.build(this.buildMat); }
        else if (this.isPlayer && fireEdge && this.mats[this.buildMat] < BUILD_COST) { SFX.empty(); g.hud.toast('Nicht genug ' + MAT_NAMES[this.buildMat] + '!'); }
      }
      return;
    }
    const held = this.held;
    if (!held) {
      if (inp.fire && this.swingT < 0 && this.fireCd <= 0) { this.swingT = 0; this.swingHit = false; this.fireCd = PICKAXE_TIME * 0.95; if (this.isPlayer) SFX.swing(); }
      return;
    }
    if (held.type === 'consumable') {
      if (fireEdge && this.healT < 0) {
        const c = CONSUMABLES[held.id];
        const full = c.heal && !c.shield ? this.hp >= (c.overflow ? 100 : c.cap) && !(c.overflow && this.shield < 100) : c.shield ? this.shield >= c.cap : false;
        if (full) { if (this.isPlayer) g.hud.toast(c.heal ? 'Gesundheit ist schon voll genug' : 'Schild ist schon voll genug'); }
        else { this.healT = 0; this.healSlot = this.sel - 1; }
      }
      return;
    }
    if (held.type === 'weapon') {
      const st = weaponStats(held.id, held.rarity);
      const wantFire = st.auto ? inp.fire : fireEdge;
      if (wantFire) {
        if (this.reloadT >= 0 && st.perShell && held.mag > 0) this.reloadT = -1;
        if (this.reloadT < 0 && this.fireCd <= 0) {
          if (held.mag <= 0) {
            if (this.ammo[st.ammo] > 0) this.startReload(); else if (this.isPlayer && fireEdge) { SFX.empty(); g.hud.toast('Keine Munition!'); }
          } else this.fire(held, st);
        }
      }
      if (held.mag <= 0 && this.reloadT < 0 && this.ammo[st.ammo] > 0 && this.fireCd <= 0) this.startReload();
    }
  }
  startReload() {
    const w = this.heldWeapon; if (!w) return;
    const st = weaponStats(w.id, w.rarity);
    if (w.mag >= st.mag || this.ammo[st.ammo] <= 0 || this.reloadT >= 0) return;
    this.reloadT = 0; this.emoteT = -1;
    if (this.isPlayer) SFX.reload(0);
  }
  fire(held, st) {
    const g = this.game;
    this.fireCd = 1 / st.rate;
    held.mag--;
    this.emoteT = -1;
    const moving = Math.hypot(this.vel.x, this.vel.z) > 1.5;
    let spread = (this.input.aim ? st.adsSpread : st.spread) + this.bloom;
    if (moving) spread += st.spread * 0.35;
    if (!this.grounded) spread += st.spread * 0.8;
    if (this.crouch) spread *= 0.75;
    if (st.scope && !this.input.aim) spread = st.spread;
    this.bloom = Math.min(0.07, this.bloom + st.bloom);
    this.fireKick = 1;
    this.rig.root.updateMatrixWorld(true);
    const muzzle = new THREE.Vector3(); this.rig.holder.getWorldPosition(muzzle);
    const dir = this.aimDir.clone();
    muzzle.addScaledVector(dir, held.id === 'sniper' || held.id === 'rocket' ? 0.9 : 0.6);
    g.onShot(this, held, st, muzzle);
    const dirs = [], ends = [];
    if (st.projectile) {
      const d = this.jitter(dir, spread);
      g.spawnRocket(this, muzzle.clone(), d, st);
      dirs.push(d);
    } else {
      for (let i = 0; i < st.pellets; i++) {
        const d = this.jitter(dir, spread);
        dirs.push(d);
        const e = g.hitscan(this, this.aimOrigin, d, st, muzzle, i === 0 || i % 3 === 0);
        if (i === 0 || i % 3 === 0) ends.push([r2(e.x), r2(e.y), r2(e.z)]);
      }
    }
    // online: Client meldet den Schuss an den Host, der Host zeigt ihn allen anderen
    const m3 = [r2(muzzle.x), r2(muzzle.y), r2(muzzle.z)];
    if (g.isClient) g.netSend({ t: 'fire', w: held.id, r: held.rarity || 0, o: [r2(this.aimOrigin.x), r2(this.aimOrigin.y), r2(this.aimOrigin.z)], m: m3, d: dirs.map(d => [r2(d.x * 1000) / 1000, r2(d.y * 1000) / 1000, r2(d.z * 1000) / 1000]) });
    else if (g.isHost && g.netLive) {
      if (st.projectile) g.netBroadcast({ t: 'rk', n: g.nidOf(this), p: m3, d: [dirs[0].x, dirs[0].y, dirs[0].z] });
      else g.netBroadcast({ t: 'sh', n: g.nidOf(this), w: held.id, m: m3, e: ends });
    }
    if (this.isPlayer) g.hud.refreshSlots();
  }
  jitter(dir, spread) {
    if (spread <= 0) return dir.clone();
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * spread;
    const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const u = new THREE.Vector3().crossVectors(dir, up).normalize();
    const v = new THREE.Vector3().crossVectors(u, dir).normalize();
    return dir.clone().addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
  }
  useBestHeal() { // für Bots
    let best = -1, bestScore = 0;
    this.slots.forEach((s, i) => {
      if (!s || s.type !== 'consumable') return;
      const c = CONSUMABLES[s.id];
      let score = 0;
      if (c.shield && this.shield < c.cap) score = (c.cap - this.shield) + 10;
      if (c.heal && this.hp < (c.overflow ? 100 : c.cap)) score = Math.max(score, (c.cap - this.hp) + (c.heal >= 100 ? 5 : 0));
      if (score > bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) { this.select(best + 1); this.healT = 0; this.healSlot = best; return true; }
    return false;
  }

  /* ---------------- Schaden ---------------- */
  takeDamage(amount, attacker, opts) {
    if (!this.alive) return 0;
    if (this.game.state === 'won') return 0; // nach dem Sieg ist man unverwundbar
    if (this.game.isClient) return 0;        // online entscheidet der Host über Schaden
    opts = opts || {};
    let dealt = 0, shieldHit = false;
    if (opts.storm || opts.fall) { dealt = Math.min(this.hp, amount); this.hp -= amount; }
    else {
      if (this.shield > 0) { const s = Math.min(this.shield, amount); this.shield -= s; amount -= s; dealt += s; shieldHit = true; if (this.shield <= 0 && this.isPlayer) SFX.shieldBreak(); }
      const h = Math.min(this.hp, amount); this.hp -= amount; dealt += h;
    }
    this.hurt = 1;
    if (attacker && attacker !== this) { this.lastAttacker = attacker; this.lastHitTime = this.game.time; }
    this.emoteT = -1;
    this.game.onDamage(this, attacker, dealt, opts, shieldHit);
    if (this.hp <= 0) { this.hp = 0; this.die(attacker, opts); }
    return dealt;
  }
  die(killer, opts) {
    if (!this.alive) return;
    this.alive = false;
    this.state = 'dead'; this.deadT = 0;
    this.buildMode = false; this.healT = -1; this.reloadT = -1;
    if (!killer && this.lastAttacker && this.game.time - this.lastHitTime < 10) killer = this.lastAttacker;
    // Wegschleudern: weg vom Schützen, Stärke je nach Waffe
    const k = killer && killer !== this ? killer : null;
    let dx, dz;
    if (k) { dx = this.pos.x - k.pos.x; dz = this.pos.z - k.pos.z; } else { const a = Math.random() * TAU; dx = Math.cos(a); dz = Math.sin(a); }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const wid = opts && opts.weapon && opts.weapon.id;
    const soft = opts && (opts.storm || opts.fall);
    const power = opts && opts.explosion ? 9 : wid === 'shotgun' ? 6.5 : wid === 'sniper' ? 7 : soft ? 1.2 : 4.5;
    this.deathVel = new THREE.Vector3(dx * power, soft ? 2.5 : 6 + power * 0.35, dz * power);
    if (opts && opts.power) this.deathVel.set(dx * 3, 15, dz * 3); // von der Wurzel hochgeschleudert
    this.deathYaw = Math.atan2(-dx, -dz);
    this.deathSpin = soft ? 1.2 : 5 + Math.random() * 3;
    this.deathTumble = 0; this.deathRest = false; this.deathBounced = false; this.dissolved = false; this.glitchT = 0;
    this.rig.root.rotation.order = 'YXZ';
    this.killedByPlayer = !!(k && k.isPlayer);
    this.game.onElimination(this, killer, opts);
    if (this.game.isClient || this.netMode === 'puppet') return; // online verteilt der Host die Beute
    // Beute fallen lassen
    const drops = [];
    for (const s of this.slots) if (s) drops.push(s);
    for (const k in this.ammo) if (this.ammo[k] > 0) drops.push({ type: 'ammo', id: k, count: this.ammo[k] });
    for (const k in this.mats) if (this.mats[k] > 0) drops.push({ type: 'mat', id: k, count: Math.min(this.mats[k], 999) });
    drops.forEach((it, i) => {
      const a = i / Math.max(1, drops.length) * TAU;
      this.game.spawnPickup(it, this.pos.x + Math.cos(a) * 1.2, this.pos.y + 0.6, this.pos.z + Math.sin(a) * 1.2, true);
    });
    this.slots = [null, null, null, null, null];
    for (const k in this.ammo) this.ammo[k] = 0;
    for (const k in this.mats) this.mats[k] = 0;
  }
  /* Online: Figur eines anderen Spielers (oder Bots auf dem Client) folgt den Netzwerkdaten */
  updateNet(dt) {
    const g = this.game, n = this.net, rig = this.rig;
    this.fireKick = Math.max(0, this.fireKick - dt * 8); this.hurt = Math.max(0, this.hurt - dt * 4);
    if (n) {
      if (this.pos.distanceTo(n.pos) > 10 || n.state !== this.state && (n.state === 'skydive' || this.state === 'airship')) this.pos.copy(n.pos);
      else this.pos.lerp(n.pos, 1 - Math.exp(-14 * dt));
      this.yaw = dampAngle(this.yaw, n.yaw, 16, dt); this.pitch = damp(this.pitch, n.pitch, 16, dt);
      this.vel.copy(n.vel);
      this.state = n.state;
      const f = n.flags;
      this.crouch = !!(f & 1); this.sprint = !!(f & 2); this.grounded = !!(f & 4); this.input.aim = !!(f & 8);
      this.buildMode = !!(f & 16); this.diving = !!(f & 256);
      this.healT = f & 32 ? 0.5 : -1;
      this.reloadT = f & 64 ? (g.time * 0.8) % 1 : -1;
      this.emoteT = f & 128 ? Math.max(0, n.emote) + 0 : -1;
      if (f & 512) { if (this.swingT < 0) this.swingT = 0; }
      if (f & 1024) { if (this.powerT < 0) this.powerT = 0; }
      if (this.powerT >= 0) { this.powerT += dt; if (this.powerT > 1.15) this.powerT = -1; }
      if (this.swingT >= 0) { this.swingT += dt / PICKAXE_TIME; if (this.swingT >= 1) this.swingT = -1; }
      if (n.held !== this.netHeldKey) {
        this.netHeldKey = n.held; this.netHeldItem = itemFromHeldKey(n.held);
        if (n.held === 'b') rig.setHeld('build', null); else rig.setHeld('net:' + n.held, makeHeldMesh(this.netHeldItem, rig.outfit));
      }
      if (this.emoteT >= 0) this.emoteT = (this.netEmoteT = (this.netEmoteT || 0) + dt); else this.netEmoteT = 0;
    }
    // Sturmschaden für Mitspieler rechnet der Host
    if (this.netMode === 'proxy' && g.storm.state !== 'idle' && this.state !== 'airship' && !g.storm.inside(this.pos.x, this.pos.z)) {
      this.stormTick -= dt;
      if (this.stormTick <= 0) { this.stormTick = 1; this.takeDamage(g.storm.dmg, null, { storm: true }); }
    } else this.stormTick = 0.5;
    if (this.state === 'airship' || !n) { rig.root.visible = false; return; }
    rig.root.visible = !this.farHidden;
    if (this.farHidden) return;
    rig.root.position.copy(this.pos);
    rig.root.rotation.y = this.yaw;
    rig.update(dt, this.animParams());
  }
  /* Eliminierungs-Animation: durch die Luft fliegen, überschlagen, aufprallen,
     kurz glitchen und dann in leuchtende Würfel zerfallen */
  updateDeath(dt) {
    const g = this.game, w = g.world, rig = this.rig;
    this.deadT += dt;
    if (this.dissolved) return;
    const v = this.deathVel;
    if (!this.deathRest) {
      v.y -= 22 * dt;
      this.pos.addScaledVector(v, dt);
      w.collideActor(this.pos, 0.35, 1.0, 0.3, v);
      const gy = w.groundAt(this.pos.x, this.pos.z, this.pos.y + 0.6, 0.6);
      this.deathTumble += this.deathSpin * dt;
      if (this.pos.y <= gy) {
        this.pos.y = gy;
        if (!this.deathBounced && v.y < -4) {
          this.deathBounced = true;
          v.y = -v.y * 0.35; v.x *= 0.45; v.z *= 0.45; this.deathSpin *= 0.35;
          if (!this.farHidden) {
            g.fx.burst(new THREE.Vector3(this.pos.x, this.pos.y + 0.1, this.pos.z), 0xcfc2a8, 14, 4, 0.18, 0.6, 10);
            const d = g.camera.position.distanceTo(this.pos);
            if (d < 50) SFX.land(true);
          }
        } else { this.deathRest = true; this.restT = this.deadT; v.set(0, 0, 0); }
      }
      if (this.deadT > 3) { this.deathRest = true; this.restT = this.deadT; }
    } else {
      const target = Math.round(this.deathTumble / TAU) * TAU;
      this.deathTumble = damp(this.deathTumble, target, 9, dt);
    }
    rig.root.position.copy(this.pos);
    rig.root.rotation.set(-this.deathTumble, this.deathYaw, 0);
    if (!this.farHidden) rig.update(dt, this.animParams());
    const restFor = this.deathRest ? this.deadT - this.restT : 0;
    if (restFor > 0.5 || this.deadT > 3.4) {
      this.glitchT += dt;
      rig.root.visible = !this.farHidden && Math.floor(this.glitchT * 24) % 3 !== 0;
      if (this.glitchT > 0.42) {
        this.dissolved = true;
        rig.root.visible = true;
        if (!this.farHidden && g.camera.position.distanceTo(this.pos) < 170) g.fx.eliminationFx(this, this.killedByPlayer);
        rig.root.visible = false;
      }
    } else rig.root.visible = !this.farHidden;
  }
  onStep() {
    if (!this.grounded || this.state !== 'ground') return;
    const g = this.game;
    const cam = g.camera.position;
    const d = this.pos.distanceTo(cam);
    if (d > 35) return;
    const vol = (this.isPlayer ? 0.8 : 1.6) * (1 - d / 35) * (this.crouch ? 0.3 : 1) * (this.sprint ? 1.3 : 1);
    SFX.step(vol, g.panFor(this.pos));
  }
  animParams() {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const fwd = this.vel.x * sy + this.vel.z * cy;
    const side = -(this.vel.x * -cy + this.vel.z * sy); // positiv = rechts
    let hold = 'none';
    const h = this.netMode ? this.netHeldItem : this.held;
    if (this.buildMode) hold = 'build';
    else if (this.healT >= 0) hold = 'heal';
    else if (!h) hold = 'pickaxe';
    else if (h.type === 'weapon') hold = h.id === 'rocket' ? 'rocket' : 'gun';
    else hold = 'none';
    let state = this.state;
    if (state === 'ground' && this.emoteT >= 0) state = 'emote';
    if (state === 'dead') state = this.deathRest ? 'dead' : 'ko';
    if (state === 'ground' && this.powerT >= 0) state = 'power';
    const st = h && h.type === 'weapon' ? weaponStats(h.id, h.rarity) : null;
    return {
      state, fwd, side: -side, grounded: this.grounded, vy: this.vel.y, crouch: this.crouch, sprint: this.sprint,
      aim: this.input.aim, pitch: this.pitch, hold, fire: this.fireKick, reload: this.reloadT >= 0 ? (st && st.perShell ? this.reloadT : this.reloadT) : -1,
      swing: this.swingT, hurt: this.hurt, emoteT: Math.max(0, this.emoteT), powerT: this.powerT, dive: this.diving && this.state === 'skydive',
    };
  }
  dispose() { this.game.scene.remove(this.rig.root); }
}
