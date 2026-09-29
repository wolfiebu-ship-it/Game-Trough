'use strict';
/* ============================================================
   Online-Match: Der Host berechnet Bots, Sturm, Beute, Treffer und
   Eliminierungen. Jeder Mitspieler steuert seine eigene Figur und
   schickt Bewegung, Schüsse und Aktionen an den Host.
   ============================================================ */

const NET_STATES = ['ground', 'airship', 'skydive', 'glide', 'dead'];
const r2 = v => Math.round(v * 100) / 100;

function heldKeyOf(a) {
  if (a.buildMode) return 'b';
  const h = a.held;
  if (!h) return '';
  if (h.type === 'weapon') return 'w:' + h.id + ':' + (h.rarity || 0);
  if (h.type === 'consumable') return 'c:' + h.id;
  return '';
}
function itemFromHeldKey(k) {
  if (!k || k === 'b') return null;
  const p = k.split(':');
  if (p[0] === 'w' && WEAPONS[p[1]]) return { type: 'weapon', id: p[1], rarity: parseInt(p[2], 10) || 0, mag: 1 };
  if (p[0] === 'c' && CONSUMABLES[p[1]]) return { type: 'consumable', id: p[1], count: 1 };
  return null;
}
function netFlags(a) {
  return (a.crouch ? 1 : 0) | (a.sprint ? 2 : 0) | (a.grounded ? 4 : 0) | (a.input.aim ? 8 : 0) | (a.buildMode ? 16 : 0) |
    (a.healT >= 0 ? 32 : 0) | (a.reloadT >= 0 ? 64 : 0) | (a.emoteT >= 0 ? 128 : 0) | (a.diving ? 256 : 0) | (a.swingT >= 0 ? 512 : 0) | (a.powerT >= 0 && a.powerT < 0.6 ? 1024 : 0);
}
function packState(a) {
  return [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw), r2(a.pitch), Math.max(0, NET_STATES.indexOf(a.state)), netFlags(a), heldKeyOf(a),
    r2(a.vel.x), r2(a.vel.y), r2(a.vel.z), a.emoteT >= 0 ? r2(a.emoteT) : -1];
}
function unpackState(s) {
  return { pos: new THREE.Vector3(s[0], s[1], s[2]), yaw: s[3], pitch: s[4], state: NET_STATES[s[5]] || 'ground', flags: s[6], held: s[7],
    vel: new THREE.Vector3(s[8], s[9], s[10]), emote: s[11] };
}

Object.assign(Game.prototype, {
  /* ---------- Aufbau ---------- */
  netSetupHost() {
    this.netLive = false;
    this.netT = 0; this.netInvT = 0;
    Net.onGameMsg = (m, from) => this.netHandleHost(m, from);
    Net.onPeerLeft = code => {
      const a = this.actors.find(x => x.owner === code);
      if (a && a.alive) a.die(null, { left: true });
    };
    this.world.onStructureDamaged = s => this.netBroadcast({ t: 'sd', id: s.id, hp: Math.round(s.hp) });
  },
  netSendStart() {
    const ship = this.shipFrom ? [this.shipFrom.x, this.shipFrom.y, this.shipFrom.z, this.shipTo.x, this.shipTo.y, this.shipTo.z] : null;
    const spawns = this.setup.start === 'boden' ? this.actors.map(a => [r2(a.pos.x), r2(a.pos.y), r2(a.pos.z), r2(a.yaw)]) : null;
    const actors = this.actors.map((a, i) => ({ n: i, name: a.name, outfit: a.outfitIndex, h: a.human ? 1 : 0 }));
    const pickups = this.pickups.map(p => [p.id, p.item, r2(p.pos.x), r2(p.pos.y), r2(p.pos.z)]);
    for (const a of this.actors) {
      if (a.netMode !== 'proxy') continue;
      Net.sendMember(a.owner, { t: 'start', seed: this.seedText, setup: this.setup, you: this.actors.indexOf(a), actors, ship, spawns, pickups });
    }
    Net.lobby.inGame = true; Net.broadcastLobby();
    this.netLive = true;
  },
  netSetupClient(start) {
    this.netT = 0; this.netInvT = 0; this.lastInv = '';
    Net.onGameMsg = m => this.netHandleClient(m);
    this.storm.remote = true;
  },
  netCreateClientActors(start) {
    for (const d of start.actors) {
      const mine = d.n === start.you;
      const a = new Actor(this, { name: d.name, isPlayer: mine, outfit: d.outfit });
      if (mine) { a.name = Settings.playerName || d.name; this.player = a; }
      else a.netMode = 'puppet';
      a.human = !!d.h;
      a.nid = d.n;
      this.actors.push(a);
    }
    for (const p of start.pickups) this.spawnPickup(p[1], p[2], p[3], p[4], false, p[0]);
  },
  netSend(msg) { if (this.isClient) Net.sendHost(msg); },
  netBroadcast(msg, except) { if (this.isHost && this.netLive) Net.broadcast(msg, except); },
  nidOf(a) { return a ? this.actors.indexOf(a) : -1; },

  /* ---------- pro Frame ---------- */
  netUpdate(dt) {
    if (!this.net) return;
    this.netT -= dt;
    if (this.isHost) {
      if (!this.netLive || this.netT > 0) return;
      this.netT = 1 / 12;
      const s = this.storm;
      Net.broadcast({
        t: 'ss', a: this.actors.map((a, i) => (a.alive ? [i].concat(packState(a)) : null)).filter(Boolean),
        st: [r2(s.cx), r2(s.cz), r2(s.r), r2(s.nextX), r2(s.nextZ), r2(s.nextR), s.state, r2(s.timer), s.phase, s.dmg],
        al: this.aliveCount, sh: this.ship ? r2(this.shipT) : -1,
      });
    } else {
      const p = this.player;
      if (this.netT <= 0) { this.netT = 1 / 15; if (p.alive) this.netSend({ t: 'ps', s: packState(p) }); }
      this.netInvT -= dt;
      if (this.netInvT <= 0) {
        this.netInvT = 1;
        const inv = JSON.stringify([p.slots, p.ammo, p.mats]);
        if (inv !== this.lastInv) { this.lastInv = inv; this.netSend({ t: 'inv', slots: p.slots, ammo: p.ammo, mats: p.mats }); }
      }
    }
  },

  /* ---------- Host empfängt ---------- */
  netHandleHost(m, from) {
    const a = this.actors.find(x => x.owner === from);
    if (!a) return;
    switch (m.t) {
      case 'ps': if (a.alive) a.net = unpackState(m.s); break;
      case 'inv': a.slots = m.slots || a.slots; a.ammo = m.ammo || a.ammo; a.mats = m.mats || a.mats; break;
      case 'hl': if (a.alive) { a.hp = clamp(+m.h || 0, 1, 100); a.shield = clamp(+m.s || 0, 0, 100); } break;
      case 'fd': if (a.alive) a.takeDamage(clamp(+m.d || 0, 0, 200), null, { fall: true }); break;
      case 'fire': this.netHostFire(a, m, from); break;
      case 'pw': if (a.alive && (!a.powerNetCd || this.time > a.powerNetCd)) { a.powerNetCd = this.time + POWER_COOLDOWN - 1; this.castPower(a, true); } break;
      case 'hv': if (a.alive) { a.aimOrigin.set(m.o[0], m.o[1], m.o[2]); a.aimDir.set(m.d[0], m.d[1], m.d[2]).normalize(); this.harvestHit(a); } break;
      case 'tk': {
        const p = this.pickups.find(x => x.id === m.id);
        if (p && !p.taken && a.alive) { this.removePickup(p); Net.sendMember(from, { t: 'gv', it: p.item }); }
        break;
      }
      case 'dr': if (m.it && m.it.type) this.spawnPickup(m.it, +m.x, +m.y, +m.z, true); break;
      case 'op': { const s = this.world.byId.get(m.id); if (s && s.alive && !s.opened && a.alive) this.openContainer(s, a); break; }
      case 'bd': {
        const r = m.r; if (!r || !r.key || !BUILD_HP[m.m]) break;
        if (this.build.pieces.has(r.key) || !a.alive) Net.sendMember(from, { t: 'mt', m: m.m, n: BUILD_COST, silent: 1 });
        else this.build.create(r, m.m, a);
        break;
      }
    }
  },
  netHostFire(a, m, from) {
    if (!a.alive || !WEAPONS[m.w]) return;
    const st = weaponStats(m.w, clamp(m.r | 0, 0, 4));
    const held = { id: m.w, rarity: st.rarity };
    const muzzle = new THREE.Vector3(m.m[0], m.m[1], m.m[2]);
    a.fireKick = 1;
    this.onShot(a, held, st, muzzle, true);
    if (st.projectile) {
      const d = new THREE.Vector3(m.d[0][0], m.d[0][1], m.d[0][2]).normalize();
      this.spawnRocket(a, muzzle.clone(), d, st);
      this.netBroadcast({ t: 'rk', n: this.nidOf(a), p: m.m, d: m.d[0] }, from);
      return;
    }
    const origin = new THREE.Vector3(m.o[0], m.o[1], m.o[2]);
    const ends = [];
    m.d.slice(0, 12).forEach((d, i) => {
      const dir = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      const e = this.hitscan(a, origin, dir, st, muzzle, i === 0 || i % 3 === 0);
      if (i === 0 || i % 3 === 0) ends.push([r2(e.x), r2(e.y), r2(e.z)]);
    });
    this.netBroadcast({ t: 'sh', n: this.nidOf(a), w: m.w, m: m.m, e: ends }, from);
  },

  /* ---------- Client empfängt ---------- */
  netHandleClient(m) {
    const p = this.player;
    switch (m.t) {
      case 'ss': {
        for (const e of m.a) {
          const a = this.actors[e[0]];
          if (!a || a === p || !a.alive) continue;
          a.net = unpackState(e.slice(1));
        }
        const s = this.storm, v = m.st;
        s.cx = v[0]; s.cz = v[1]; s.r = v[2]; s.nextX = v[3]; s.nextZ = v[4]; s.nextR = v[5];
        const prevState = s.state, prevPhase = s.phase;
        s.state = v[6]; s.timer = v[7]; s.phase = v[8]; s.dmg = v[9];
        if (s.state === 'shrink' && prevState === 'wait' && s.onShrink) s.onShrink(s.phase);
        else if (s.state === 'wait' && prevState === 'shrink' && s.phase !== prevPhase && s.onWait) s.onWait(s.phase);
        s.apply();
        this.aliveCount = m.al;
        if (m.sh >= 0 && this.ship) this.shipT = m.sh;
        break;
      }
      case 'hp': {
        if (!p.alive) break;
        const before = p.hp + p.shield, hadShield = p.shield > 0;
        p.hp = m.h; p.shield = m.s; p.hurt = 1;
        const att = m.a >= 0 ? this.actors[m.a] : null;
        if (att && att !== p) { p.lastAttacker = att; p.lastHitTime = this.time; }
        p.emoteT = -1;
        this.onDamage(p, att, Math.max(0, before - p.hp - p.shield), { storm: !!(m.f & 1), fall: !!(m.f & 2), head: !!(m.f & 4) }, hadShield && !!(m.f & 8));
        break;
      }
      case 'hit': {
        if (Settings.damageNumbers) this.hud.damageNumber(new THREE.Vector3(m.p[0], m.p[1], m.p[2]), m.d, m.h, m.s);
        this.hud.hitmarker(m.h, m.k);
        SFX.hit(m.h, m.s);
        p.damageDone += m.d;
        break;
      }
      case 'sh': {
        const a = this.actors[m.n];
        if (!a || a === p) break;
        a.fireKick = 1;
        const st = WEAPONS[m.w] || WEAPONS.ar;
        const muzzle = new THREE.Vector3(m.m[0], m.m[1], m.m[2]);
        this.onShot(a, { id: m.w }, st, muzzle, true);
        for (const e of m.e) {
          const end = new THREE.Vector3(e[0], e[1], e[2]);
          this.fx.tracer(muzzle, end, 0xffc0a0);
          if (end.distanceTo(this.camera.position) < 120) this.fx.impact(end, 4, 0xbbbbbb);
        }
        break;
      }
      case 'rk': {
        const a = this.actors[m.n];
        if (!a || a === p) break;
        this.spawnRocket(a, new THREE.Vector3(m.p[0], m.p[1], m.p[2]), new THREE.Vector3(m.d[0], m.d[1], m.d[2]).normalize(), weaponStats('rocket', 3), true);
        break;
      }
      case 'boom': this.explode(new THREE.Vector3(m.p[0], m.p[1], m.p[2]), null, weaponStats('rocket', 3), true); break;
      case 'pa': this.spawnPickup(m.it, m.x, m.y, m.z, !!m.v, m.id, m.v); break;
      case 'pr': { const pk = this.pickups.find(x => x.id === m.id); if (pk) this.removePickup(pk); break; }
      case 'gv': {
        const it = m.it;
        if (!p.alive) { this.netSend({ t: 'dr', it, x: p.pos.x, y: p.pos.y + 0.8, z: p.pos.z }); break; }
        const left = p.give(it);
        SFX.pickup();
        const cnt = it.count && it.type !== 'weapon' ? ' ×' + it.count : '';
        this.hud.pickupNote(itemName(it) + cnt, it.type === 'weapon' ? RARITIES[it.rarity].color : it.type === 'ammo' ? AMMO[it.id].color : '#ffffff');
        this.hud.refreshSlots();
        if (left) { const f = p.forward(); this.netSend({ t: 'dr', it: left, x: p.pos.x + f.x * 0.8, y: p.pos.y + 0.8, z: p.pos.z + f.z * 0.8 }); }
        break;
      }
      case 'mt': if (p.alive && p.mats[m.m] != null) { p.mats[m.m] = Math.min(999, p.mats[m.m] + m.n); if (!m.silent) this.hud.matGain(m.m, m.n); } break;
      case 'co': {
        const s = this.world.byId.get(m.id);
        if (s && !s.opened) {
          s.opened = true;
          const i = this.world.interactables.indexOf(s); if (i >= 0) this.world.interactables.splice(i, 1);
          if (s.kind === 'chest') { s.lid.rotation.x = -1.9; s.glow.visible = false; SFX.chest(clamp(1 - this.camera.position.distanceTo(s.pos) / 40, 0, 1), this.panFor(s.pos)); this.fx.burst(s.pos, 0xffd060, 20, 4, 0.12, 0.8, 3); }
        }
        break;
      }
      case 'sd': {
        const s = this.world.byId.get(m.id);
        if (s && s.alive) {
          if (m.hp < s.hp) { s.shake = 0.25; if (this.world.wobbling.indexOf(s) < 0) this.world.wobbling.push(s); if (s.center && s.center.distanceTo(this.camera.position) < 60) this.fx.harvestHit(s.center.clone().add(new THREE.Vector3(0, 0.5, 0)), s.mat); }
          s.hp = m.hp;
        }
        break;
      }
      case 'sx': { const s = this.world.byId.get(m.id); if (s && s.alive) this.world.destroyStructure(s, null); break; }
      case 'bp': this.build.create(m.r, m.m, null, m.id); break;
      case 'el': {
        const v = this.actors[m.v], k = m.k >= 0 ? this.actors[m.k] : null;
        if (!v || !v.alive) break;
        const opts = { storm: !!m.o.storm, fall: !!m.o.fall, melee: !!m.o.melee, explosion: !!m.o.explosion, left: !!m.o.left };
        if (m.o.w && WEAPONS[m.o.w]) opts.weapon = weaponStats(m.o.w, 0);
        if (m.o.pw) { opts.power = true; opts.weapon = POWER_WEAPON; }
        v.die(k, opts);
        this.aliveCount = m.al;
        break;
      }
      case 'pw1': { const a = this.actors[m.n]; if (a && a !== p) this.powerCharge(a); break; }
      case 'pw2': this.powerBurst(new THREE.Vector3(m.c[0], m.c[1], m.c[2]), m.tg, this.actors[m.n]); break;
      case 'wn': this.netWinner(this.actors[m.n]); break;
    }
  },
  netWinner(winner) {
    if (!winner || this.over && this.winner) return;
    this.over = true; this.winner = winner; winner.placement = 1;
    if (winner === this.player) {
      this.state = 'won'; winner.emoteT = 0;
      SFX.victory(); this.hud.victory();
      setTimeout(() => { if (!this.disposed) this.finish(true); }, 5500);
    } else if (this.endShown && this.cb.onUpdateEnd) this.cb.onUpdateEnd(this.endInfo(false));
  },
});
