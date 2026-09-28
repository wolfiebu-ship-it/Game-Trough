'use strict';
/* ============================================================
   Bot-KI: landen, looten, kämpfen, bauen, heilen, Sturm meiden
   ============================================================ */

const BOT_DIFF = {
  leicht: { react: 0.95, aimErr: 0.11, sight: 70, build: 0.0, strafe: 0.4, fireGap: 0.35, name: 'Leicht' },
  normal: { react: 0.5, aimErr: 0.06, sight: 105, build: 0.3, strafe: 0.8, fireGap: 0.12, name: 'Normal' },
  schwer: { react: 0.28, aimErr: 0.032, sight: 140, build: 0.65, strafe: 1.0, fireGap: 0.0, name: 'Schwer' },
  profi: { react: 0.18, aimErr: 0.02, sight: 170, build: 0.9, strafe: 1.0, fireGap: 0.0, name: 'Profi' },
};

const BOT_NAMES = ['PixelPaule', 'Keksmonster', 'LamaLars', 'Turbo-Tina', 'Käsekönig', 'Brotkrümel', 'NudelNinja', 'Zockerzwerg',
  'Blitzbirne', 'Frau Flink', 'Toastbrot3000', 'KnusperKai', 'Gurkenglas', 'Mampfmaschine', 'SchnitzelSepp', 'Wirbelwind',
  'Quietscheente', 'Donnerdackel', 'KakaoKarl', 'Sockenschuss', 'Hüpfburg', 'Dr. Dropzone', 'Baumeister Bob', 'Rampenrudi',
  'Kaktusklaus', 'Pfannkuchen', 'StrudelStefan', 'Muffin-Mia', 'Bananenbert', 'Zuckerwatte', 'Rostlaube', 'Kuschelkralle',
  'Lakritzlotte', 'Goldfisch99', 'Wackelpudding', 'Dosenöffner', 'Sturmsocke', 'Tante Taktik', 'Onkel Oha', 'Nebelnelli',
  'Knallfrosch', 'Brezelboss', 'Glitzergabi', 'Hamsterheinz', 'Pudelmütze', 'Spätzlespeed', 'Zimtzicke', 'Karottenkalle',
  'Fliegenpilz', 'Holzhacker', 'Steinbeißer', 'Metallmaus', 'Pommesprinz'];

class BotBrain {
  constructor(actor, game, diffKey, rng) {
    this.a = actor; this.g = game; this.rng = rng;
    this.d = BOT_DIFF[diffKey] || BOT_DIFF.normal;
    actor.bot = this;
    actor.botOpenH = rr(rng, 30, 55);
    this.target = null; this.visible = false; this.lastSeen = null; this.lastSeenT = -99;
    this.think = rr(rng, 0, 0.3);
    this.way = null; this.goal = 'roam'; this.goalObj = null;
    this.reactT = 0; this.strafeDir = 1; this.strafeT = 0;
    this.aimErr = new THREE.Vector3(); this.errT = 0;
    this.buildCd = 0; this.stuckT = 0; this.stuckN = 0; this.lastPos = new THREE.Vector3(); this.sideT = 0; this.sideDir = 1;
    this.chopT = 0; this.ignore = new Map(); this.fireToggle = false; this.healWait = 0; this.jumpCd = 0;
    this.dropTarget = null; this.deadline = 0; this.chopping = 0;
  }
  update(dt) {
    const a = this.a, inp = a.input;
    if (!a.alive) return;
    if (a.state === 'skydive' || a.state === 'glide') {
      const t = this.dropTarget || { x: 0, z: 0 };
      const dx = t.x - a.pos.x, dz = t.z - a.pos.z, d = Math.hypot(dx, dz);
      a.yaw = dampAngle(a.yaw, Math.atan2(dx, dz), 3, dt);
      inp.fz = d > 3 ? 1 : 0; inp.fx = 0; inp.dive = d < a.pos.y * 1.1;
      return;
    }
    if (a.state !== 'ground') return;
    this.think -= dt; this.buildCd -= dt; this.errT -= dt; this.jumpCd -= dt; this.healWait -= dt;
    if (this.think <= 0) { this.think = 0.22 + this.rng() * 0.12; this.decide(); }
    inp.jump = false; inp.fire = false; inp.aim = false; inp.sprint = false; inp.crouch = false;
    if (this.goal === 'heal') { this.doHeal(dt); return; }
    if (this.target && this.target.alive && (this.visible || this.g.time - this.lastSeenT < 4)) this.fight(dt);
    else this.travel(dt);
  }
  decide() {
    const a = this.a, g = this.g, rng = this.rng;
    // --- Wahrnehmung ---
    let best = null, bestD = this.d.sight;
    const eye = a.headPos();
    const recentAttacker = a.lastAttacker && a.lastAttacker.alive && g.time - a.lastHitTime < 3 ? a.lastAttacker : null;
    const cands = [];
    for (const o of g.actors) {
      if (o === a || !o.alive || o.state !== 'ground') continue;
      const d = a.pos.distanceTo(o.pos);
      if (d > this.d.sight && o !== recentAttacker) continue;
      cands.push([o, d]);
    }
    cands.sort((x, y) => x[1] - y[1]);
    let checks = 0;
    this.visible = false;
    for (const [o, d] of cands) {
      if (checks++ > 3) break;
      // Blickfeld: hinten sieht man schlechter
      const f = a.forward(), to = new THREE.Vector3(o.pos.x - a.pos.x, 0, o.pos.z - a.pos.z).normalize();
      const facing = f.dot(to);
      if (facing < -0.2 && d > 12 && o !== recentAttacker) continue;
      if (g.world.lineOfSight(eye, o.chest())) {
        if (d < bestD || o === recentAttacker) { best = o; bestD = d; if (o === recentAttacker) break; }
      }
    }
    if (!best && recentAttacker) { best = recentAttacker; }
    // beim aktuellen Ziel bleiben, solange es sichtbar und nicht viel weiter weg ist
    const cur = this.target;
    if (cur && cur.alive && best && best !== cur && best !== recentAttacker) {
      const dc = a.pos.distanceTo(cur.pos);
      if (dc < this.d.sight && dc < bestD * 1.6 && g.world.lineOfSight(eye, cur.chest())) best = cur;
    }
    const armed = a.slots.some(w => w && w.type === 'weapon' && (w.mag > 0 || a.ammo[WEAPONS[w.id].ammo] > 0));
    if (best && !armed && best !== recentAttacker && a.pos.distanceTo(best.pos) > 9) best = null;
    if (!armed && this.target && this.target !== recentAttacker && a.pos.distanceTo(this.target.pos) > 9) this.target = null;
    if (best) {
      if (best !== this.target) { this.reactT = this.d.react * rr(rng, 0.7, 1.3); this.target = best; }
      this.visible = g.world.lineOfSight(eye, best.chest());
      if (this.visible) { this.lastSeen = best.pos.clone(); this.lastSeenT = g.time; }
    } else if (this.target && (!this.target.alive || g.time - this.lastSeenT > 4)) this.target = null;

    // --- Heilen? ---
    const hasHeal = a.slots.some(s => s && s.type === 'consumable');
    const needHeal = a.hp < 70 || a.shield < 50;
    if (this.goal === 'heal' && a.healT >= 0) return;
    if (!this.target && hasHeal && needHeal && g.time - a.lastHitTime > 2.5 && this.healWait <= 0) {
      if (a.useBestHeal()) { this.goal = 'heal'; return; }
    }
    if (this.goal === 'heal') this.goal = 'roam';

    // --- Sturm ---
    const s = g.storm;
    const outside = s.distOutside(a.pos.x, a.pos.z);
    if (outside > -6 || (s.state === 'shrink' && outside > -20)) {
      this.goal = 'storm';
      const tx = s.state === 'wait' ? s.nextX : s.cx, tz = s.state === 'wait' ? s.nextZ : s.cz;
      if (!this.way || this.wayGoal !== 'storm' || rng() < 0.1) { const p = g.world.randomLandPoint(rng, tx, tz, Math.max(4, (s.state === 'wait' ? s.nextR : s.r) * 0.5)); this.setWay(p.x, p.z, 'storm'); }
      return;
    }
    // --- Looten ---
    const weapons = a.slots.filter(x => x && x.type === 'weapon');
    const ammoOk = weapons.some(w => a.ammo[WEAPONS[w.id].ammo] + w.mag > 0);
    const wantLoot = weapons.length < 2 || !ammoOk || (!hasHeal && rng() < 0.3) || (a.mats.wood < 60 && this.d.build > 0 && rng() < 0.15);
    if (this.goal === 'loot' && this.goalObj && g.time > this.deadline) { this.ignore.set(this.goalObj, true); this.goalObj = null; this.goal = 'roam'; }
    if (wantLoot && (this.goal !== 'loot' || !this.goalValid())) {
      const obj = this.findLoot(weapons.length === 0 ? 55 : 70);
      if (obj) {
        this.goal = 'loot'; this.goalObj = obj; this.setWay(obj.pos.x, obj.pos.z, 'loot');
        this.deadline = g.time + a.pos.distanceTo(obj.pos) / 4 + 9;
        return;
      }
    }
    if (this.goal === 'loot' && this.goalValid()) return;
    // Material abbauen, wenn Bauen möglich und wenig Holz
    if (this.d.build > 0 && a.mats.wood < 40 && this.goal !== 'chop' && rng() < 0.3) {
      const tree = this.findTree();
      if (tree) { this.goal = 'chop'; this.goalObj = tree; this.chopT = 0; this.setWay(tree.center.x, tree.center.z, 'chop'); return; }
    }
    if (this.goal === 'chop' && this.goalObj && this.goalObj.alive && this.chopT < 6) return;
    // --- Herumstreifen ---
    if (!this.way || this.goal !== 'roam' || dist2(a.pos.x, a.pos.z, this.way.x, this.way.z) < 4 || rng() < 0.01) {
      this.goal = 'roam';
      const tx = s.state === 'wait' ? s.nextX : s.cx, tz = s.state === 'wait' ? s.nextZ : s.cz;
      const r = s.state === 'idle' ? 160 : Math.max(5, (s.state === 'wait' ? s.nextR : s.r) * 0.8);
      const p = g.world.randomLandPoint(rng, tx, tz, r);
      this.setWay(p.x, p.z, 'roam');
    }
  }
  goalValid() {
    const o = this.goalObj;
    if (!o) return false;
    if (o.isPickup) return !o.taken;
    return o.alive && !o.opened;
  }
  setWay(x, z, tag) { this.way = new THREE.Vector3(x, 0, z); this.wayGoal = tag; this.stuckN = 0; }
  findLoot(radius) {
    const a = this.a, g = this.g;
    let best = null, bd = radius;
    for (const s of g.world.interactables) {
      if (s.opened || this.ignore.has(s)) continue;
      const d = a.pos.distanceTo(s.pos) + Math.abs(s.pos.y - a.pos.y) * 3;
      if (d < bd) { bd = d; best = s; }
    }
    for (const p of g.pickups) {
      if (p.taken || this.ignore.has(p) || p.item.type === 'mat') continue;
      if (p.item.type === 'consumable' && !a.canTake(p.item)) continue;
      if (p.item.type === 'weapon' && a.freeSlot() < 0) continue;
      const d = a.pos.distanceTo(p.pos) * (p.item.type === 'weapon' ? 0.7 : 1) + Math.abs(p.pos.y - a.pos.y) * 3;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  findTree() {
    const a = this.a;
    const list = this.g.world.query(a.pos.x - 25, a.pos.z - 25, a.pos.x + 25, a.pos.z + 25);
    let best = null, bd = 1e9;
    for (const c of list) { const s = c.struct; if (!s || !s.alive || s.kind !== 'tree') continue; const d = a.pos.distanceTo(s.center); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  bestWeaponFor(dist) {
    const a = this.a;
    let best = 0, bs = -1;
    a.slots.forEach((w, i) => {
      if (!w || w.type !== 'weapon') return;
      const st = WEAPONS[w.id];
      if (w.mag <= 0 && a.ammo[st.ammo] <= 0) return;
      let score = 10 + w.rarity * 3;
      if (w.id === 'shotgun') score += dist < 12 ? 40 : dist < 20 ? 10 : -20;
      if (w.id === 'sniper') score += dist > 60 ? 45 : dist > 30 ? 10 : -25;
      if (w.id === 'ar') score += dist > 12 ? 25 : 10;
      if (w.id === 'smg') score += dist < 25 ? 28 : 0;
      if (w.id === 'pistol') score += 5;
      if (w.id === 'rocket') score += dist > 10 && dist < 70 ? 22 : -30;
      if (w.mag <= 0) score -= 15;
      if (score > bs) { bs = score; best = i + 1; }
    });
    return best;
  }
  fight(dt) {
    const a = this.a, t = this.target, inp = a.input, g = this.g, rng = this.rng;
    if (a.buildMode) a.setBuildMode(false);
    const tp = this.visible ? t.chest() : (this.lastSeen ? this.lastSeen.clone().setY(this.lastSeen.y + 1.3) : t.chest());
    const dist = a.pos.distanceTo(t.pos);
    // Waffe wählen
    const want = this.bestWeaponFor(dist);
    if (want !== a.sel && a.fireCd < 0.05 && a.reloadT < 0 && rng() < 0.2) a.select(want);
    const w = a.heldWeapon;
    // Zielen mit Fehler
    if (this.errT <= 0) {
      this.errT = 0.35 + rng() * 0.3;
      const e = this.d.aimErr * (1 + (a.grounded ? 0 : 1) + Math.hypot(t.vel.x, t.vel.z) * 0.06) * (t.crouch ? 1.2 : 1);
      this.aimErr.set((rng() - 0.5) * 2 * e, (rng() - 0.5) * 2 * e, (rng() - 0.5) * 2 * e);
    }
    const eye = a.chest();
    const dir = tp.clone().sub(eye).normalize().add(this.aimErr).normalize();
    const desiredYaw = Math.atan2(dir.x, dir.z), desiredPitch = Math.asin(clamp(dir.y, -1, 1));
    a.yaw = dampAngle(a.yaw, desiredYaw, 9, dt);
    a.pitch = damp(a.pitch, desiredPitch, 9, dt);
    a.aimOrigin.copy(eye);
    a.aimDir.set(Math.sin(a.yaw) * Math.cos(a.pitch), Math.sin(a.pitch), Math.cos(a.yaw) * Math.cos(a.pitch));
    this.reactT -= dt;
    const aligned = Math.abs(angleDiff(a.yaw, desiredYaw)) < 0.12;
    if (w) {
      const st = WEAPONS[w.id];
      inp.aim = dist > 18 && w.id !== 'shotgun';
      if (this.visible && this.reactT <= 0 && aligned && dist < st.range * 1.1) {
        this.fireToggle = !this.fireToggle;
        const gap = this.d.fireGap > 0 && Math.sin(g.time * 3 + a.pos.x) > 1 - this.d.fireGap * 2;
        inp.fire = !gap && (st.auto ? true : this.fireToggle);
      }
      if (w.mag <= 0 && a.ammo[st.ammo] > 0) a.startReload();
    } else {
      // Nahkampf mit Erntehammer oder weglaufen
      if (dist < 2.5 && aligned) inp.fire = true;
    }
    // Bewegung: seitwärts ausweichen + Wunschdistanz
    this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafeT = 0.5 + rng() * 1.2; this.strafeDir = rng() < 0.5 ? -1 : 1; }
    const pref = !w ? 1.5 : w.id === 'shotgun' ? 5 : w.id === 'smg' ? 12 : w.id === 'sniper' ? 70 : 25;
    inp.fx = this.strafeDir * this.d.strafe;
    inp.fz = dist > pref + 6 ? 1 : dist < pref - 6 ? -0.7 : 0;
    if (!this.visible) { inp.fz = 1; inp.fx = 0; }
    if (this.jumpCd <= 0 && rng() < 0.012 * (this.d.strafe + 0.2)) { inp.jump = true; this.jumpCd = 1; }
    // Bauen bei Beschuss
    if (this.buildCd <= 0 && g.time - a.lastHitTime < 0.4 && a.lastAttacker === t && rng() < this.d.build) {
      const mat = a.mats.wood >= 10 ? 'wood' : a.mats.stone >= 10 ? 'stone' : a.mats.metal >= 10 ? 'metal' : null;
      if (mat) {
        const yawTo = Math.atan2(t.pos.x - a.pos.x, t.pos.z - a.pos.z);
        g.build.place(a, 'wall', mat, yawTo, 0);
        if (rng() < 0.5 && a.mats[mat] >= 10) g.build.place(a, 'ramp', mat, yawTo, 0);
        this.buildCd = 2.5 + rng() * 3;
      }
    }
    this.stuckCheck(dt, true);
  }
  travel(dt) {
    const a = this.a, inp = a.input, g = this.g;
    if (a.buildMode) a.setBuildMode(false);
    if (!this.way) { inp.fz = 0; inp.fx = 0; return; }
    let tx = this.way.x, tz = this.way.z;
    const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz);
    // Nachladen in Ruhe
    const w = a.heldWeapon;
    if (w && w.mag < WEAPONS[w.id].mag * 0.5) a.startReload();
    if (this.chopping > 0) {
      this.chopping -= dt;
      if (a.sel !== 0) a.select(0);
      inp.fire = true; inp.fz = 0.3; inp.fx = 0;
      a.aimOrigin.copy(a.chest()); a.aimDir.copy(a.forward());
      return;
    }
    if (this.goal === 'chop' && this.goalObj && this.goalObj.alive && d < 2.6) {
      this.chopT += dt;
      if (a.sel !== 0) a.select(0);
      a.yaw = dampAngle(a.yaw, Math.atan2(dx, dz), 10, dt);
      a.aimOrigin.copy(a.chest()); a.aimDir.copy(a.forward());
      inp.fire = true; inp.fz = 0; inp.fx = 0;
      return;
    }
    if (this.goal === 'loot' && this.goalObj && d < 1.8 && Math.abs(this.goalObj.pos.y - a.pos.y) < 2.2) {
      const o = this.goalObj;
      if (o.isPickup) { if (!o.taken) g.takePickup(a, o); }
      else if (!o.opened) g.openContainer(o, a);
      this.goalObj = null; this.goal = 'roam'; this.way = null;
      this.think = 0.05;
      return;
    }
    a.yaw = dampAngle(a.yaw, Math.atan2(dx, dz), 6, dt);
    a.pitch = damp(a.pitch, 0, 4, dt);
    const far = d > 25;
    inp.fz = d > 1.2 ? 1 : 0;
    inp.sprint = far || this.goal === 'storm';
    inp.fx = this.sideT > 0 ? this.sideDir : 0;
    if (this.sideT > 0) this.sideT -= dt;
    // beste Waffe bereithalten
    if (a.sel === 0 || (a.held && a.held.type !== 'weapon')) { const bw = this.bestWeaponFor(30); if (bw) a.select(bw); }
    a.aimOrigin.copy(a.chest()); a.aimDir.copy(a.forward());
    this.stuckCheck(dt, false);
  }
  stuckCheck(dt, fighting) {
    const a = this.a, inp = this.a.input;
    this.stuckT += dt;
    if (this.stuckT < 0.8) return;
    const moved = Math.hypot(a.pos.x - this.lastPos.x, a.pos.z - this.lastPos.z);
    this.lastPos.copy(a.pos); this.stuckT = 0;
    const trying = Math.abs(inp.fz) > 0.5 || Math.abs(inp.fx) > 0.5;
    if (!trying || moved > 1.2) { this.stuckN = Math.max(0, this.stuckN - 1); return; }
    this.stuckN++;
    if (!fighting && this.stuckN >= 2) {
      const hit = this.g.world.raycast(a.chest(), a.forward(), 2.2);
      if (hit.hit && hit.struct && !hit.struct.indestructible) { this.chopping = 2.2; return; }
    }
    if (this.stuckN === 1 || this.stuckN === 3) inp.jump = true;
    if (this.stuckN === 2) { this.sideT = 0.9; this.sideDir = this.rng() < 0.5 ? -1 : 1; }
    if (this.stuckN === 4 && !fighting) { this.chopping = 1.6; }
    if (this.stuckN >= 6) {
      if (this.goalObj) this.ignore.set(this.goalObj, true);
      this.goal = 'roam'; this.way = null; this.goalObj = null; this.stuckN = 0;
    }
  }
  doHeal(dt) {
    const a = this.a, inp = a.input;
    inp.fz = 0; inp.fx = 0; inp.fire = false;
    if (a.healT < 0) {
      // nächstes Heilmittel oder fertig
      this.goal = 'roam';
      if ((a.hp < 75 || a.shield < 50) && a.useBestHeal()) this.goal = 'heal';
      else this.healWait = 4;
    }
    if (a.lastAttacker && this.g.time - a.lastHitTime < 0.5) { a.healT = -1; this.goal = 'roam'; this.healWait = 3; this.think = 0; }
  }
}
