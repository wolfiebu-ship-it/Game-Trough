'use strict';
/* ============================================================
   HUD: alles, was während des Matches auf dem Bildschirm steht
   ============================================================ */

const WEAPON_ICONS = {
  pistol: [[16, 8, 32, 8], [16, 16, 8, 14], [44, 10, 6, 4]],
  smg: [[10, 9, 40, 9], [30, 18, 6, 12], [16, 18, 6, 9], [50, 11, 8, 4], [4, 11, 8, 6]],
  ar: [[4, 10, 14, 8], [16, 8, 34, 10], [30, 18, 7, 12], [20, 18, 6, 9], [50, 11, 12, 4], [26, 4, 10, 4]],
  shotgun: [[2, 12, 20, 8], [20, 10, 40, 6], [30, 16, 14, 6], [18, 18, 6, 9]],
  sniper: [[2, 12, 16, 8], [16, 10, 30, 8], [46, 11, 16, 3], [22, 4, 18, 5], [20, 18, 6, 9]],
  rocket: [[4, 8, 52, 12], [12, 20, 6, 8], [54, 6, 7, 16], [2, 7, 5, 14]],
};
function weaponIconSVG(id, color) {
  const r = WEAPON_ICONS[id] || [];
  return `<svg viewBox="0 0 64 32" class="wicon">${r.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${color || '#fff'}"/>`).join('')}</svg>`;
}
const PICKAXE_SVG = '<svg viewBox="0 0 64 32" class="wicon"><rect x="12" y="14" width="40" height="4" rx="2" fill="#e8c9a0" transform="rotate(-20 32 16)"/><path d="M40 2 L56 8 L50 12 L38 8 Z" fill="#dfe8f0"/><path d="M40 2 L30 6 L36 10 Z" fill="#b8c6d4"/></svg>';
const BUILD_ICONS = {
  wall: '<svg viewBox="0 0 32 32"><rect x="6" y="5" width="20" height="22" fill="none" stroke="#fff" stroke-width="3"/></svg>',
  floor: '<svg viewBox="0 0 32 32"><path d="M4 20 L16 14 L28 20 L16 26 Z" fill="none" stroke="#fff" stroke-width="3"/></svg>',
  ramp: '<svg viewBox="0 0 32 32"><path d="M4 26 L28 6 L28 26 Z" fill="none" stroke="#fff" stroke-width="3"/></svg>',
  roof: '<svg viewBox="0 0 32 32"><path d="M4 24 L16 6 L28 24 Z" fill="none" stroke="#fff" stroke-width="3"/></svg>',
};

/* Tastenhinweis – auf Touch-Geräten mit Button-Symbolen */
function kh(action) {
  if (Input.touch) return { jump: '⤒', forward: 'Joystick nach vorn', interact: 'E-Knopf', map: 'Karte' }[action] || keyLabel(Settings.keys[action]);
  return keyLabel(Settings.keys[action]);
}

class HUD {
  constructor(game) {
    this.g = game;
    this.root = document.getElementById('hud');
    this.root.classList.remove('hidden');
    this.$ = id => document.getElementById(id);
    this.el = {};
    for (const id of ['hpBar', 'hpText', 'shBar', 'shText', 'slots', 'ammoMag', 'ammoRes', 'ammoBox', 'mats', 'buildBar', 'prompt', 'banner', 'toast',
      'elim', 'killfeed', 'alive', 'kills', 'stormText', 'stormTime', 'stormWarn', 'compass', 'minimap', 'crosshair', 'hitmarker', 'dmgnums',
      'dmgdir', 'progress', 'progressFill', 'progressText', 'scope', 'hurt', 'stormTint', 'fps', 'shipHint', 'spectate', 'bigmap', 'pickups',
      'structHp', 'structFill', 'victory', 'matgain']) this.el[id] = this.$(id);
    this.mm = this.el.minimap.getContext('2d');
    this.bigCtx = this.el.bigmap.querySelector('canvas').getContext('2d');
    this.mapOpen = false;
    this.nums = [];
    this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0;
    this.mmT = 0;
    this.toastT = 0; this.bannerT = 0; this.elimT = 0; this.hitT = 0; this.structT = 0;
    this.lastPrompt = '';
    this.el.killfeed.innerHTML = ''; this.el.pickups.innerHTML = ''; this.el.dmgnums.innerHTML = ''; this.el.dmgdir.innerHTML = '';
    this.el.victory.classList.add('hidden'); this.el.bigmap.classList.add('hidden');
    this.applySettings();
    this.buildCompass();
  }
  applySettings() {
    const cs = this.el.crosshair.style;
    cs.setProperty('--xc', Settings.crosshairColor);
    cs.setProperty('--xs', Settings.crosshairSize);
    this.el.minimap.parentElement.style.display = Settings.minimap ? '' : 'none';
    this.el.fps.style.display = Settings.showFps ? '' : 'none';
    this.root.style.setProperty('--hud-scale', Settings.hudScale);
  }
  setMinimap(c) { this.mapImg = c; }
  buildCompass() {
    const marks = [];
    const names = { 0: 'N', 45: 'NO', 90: 'O', 135: 'SO', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -360; d < 720; d += 15) {
      const n = ((d % 360) + 360) % 360;
      marks.push(`<span class="cm ${names[n] ? 'big' : ''}" style="left:${(d + 360) * 4}px">${names[n] || (n % 45 === 0 ? n : '|')}</span>`);
    }
    this.el.compass.innerHTML = `<div class="cstrip">${marks.join('')}</div><div class="cneedle"></div>`;
    this.cstrip = this.el.compass.querySelector('.cstrip');
  }

  /* ---------- Nachrichten ---------- */
  toast(msg, dur) { this.el.toast.textContent = msg; this.el.toast.classList.add('show'); this.toastT = dur || 2.2; }
  banner(msg, color) { this.el.banner.textContent = msg; this.el.banner.style.color = color || '#fff'; this.el.banner.classList.remove('show'); void this.el.banner.offsetWidth; this.el.banner.classList.add('show'); this.bannerT = 3; }
  elimBanner(name) {
    this.el.elim.innerHTML = `<small>ELIMINIERT</small>${esc(name)}`;
    this.el.elim.classList.remove('show'); void this.el.elim.offsetWidth; this.el.elim.classList.add('show'); this.elimT = 2.2;
  }
  killfeed(html, mine) {
    const d = document.createElement('div');
    d.className = 'kf' + (mine ? ' mine' : '');
    d.innerHTML = html;
    this.el.killfeed.prepend(d);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => d.classList.add('fade'), 6000);
    setTimeout(() => d.remove(), 7000);
  }
  pickupNote(text, color) {
    const d = document.createElement('div'); d.className = 'pn'; d.style.borderColor = color; d.textContent = '+ ' + text;
    this.el.pickups.prepend(d);
    while (this.el.pickups.children.length > 5) this.el.pickups.lastChild.remove();
    setTimeout(() => d.remove(), 2600);
  }
  matGain(mat, n) {
    const d = document.createElement('div'); d.className = 'mg mg-' + mat; d.textContent = '+' + n;
    this.el.matgain.appendChild(d); setTimeout(() => d.remove(), 900);
  }
  structHp(s) {
    if (!s || !s.maxHp || s.indestructible) return;
    this.el.structHp.classList.add('show');
    this.el.structFill.style.width = clamp(s.hp / s.maxHp, 0, 1) * 100 + '%';
    this.el.structHp.querySelector('span').textContent = Math.max(0, Math.ceil(s.hp)) + ' / ' + Math.round(s.maxHp);
    this.structT = 1.2;
  }
  hitmarker(head, kill) {
    const h = this.el.hitmarker;
    h.className = 'show' + (head ? ' head' : '') + (kill ? ' kill' : '');
    this.hitT = 0.18;
  }
  damageNumber(pos, n, head, shield) {
    const d = document.createElement('div');
    d.className = 'dn' + (head ? ' head' : '') + (shield ? ' shield' : '');
    d.textContent = Math.round(n);
    this.el.dmgnums.appendChild(d);
    this.nums.push({ el: d, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.2, (Math.random() - 0.5) * 0.6)), t: 0 });
  }
  damageDir(from) {
    const p = this.g.player;
    const ang = Math.atan2(from.x - p.pos.x, from.z - p.pos.z);
    const rel = angleDiff(this.g.camYaw, ang);
    const d = document.createElement('div'); d.className = 'dd';
    d.style.transform = `rotate(${-rel * 180 / Math.PI}deg)`;
    this.el.dmgdir.appendChild(d);
    setTimeout(() => d.remove(), 1100);
  }
  hurtFlash(kind) {
    const h = kind === 'storm' ? this.el.stormTint : this.el.hurt;
    h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
  }
  victory() {
    this.el.banner.classList.remove('show'); this.el.elim.classList.remove('show');
    this.el.victory.classList.remove('hidden');
  }
  toggleMap(force) {
    this.mapOpen = force != null ? force : !this.mapOpen;
    this.el.bigmap.classList.toggle('hidden', !this.mapOpen);
    if (this.mapOpen) this.drawBigMap();
  }

  /* ---------- Inventar-Anzeige ---------- */
  refreshSlots() {
    const p = this.g.player;
    const slots = [];
    const keyOf = a => keyLabel(Settings.keys[a]);
    slots.push(`<div class="slot ${p.sel === 0 && !p.buildMode ? 'sel' : ''}" style="--rc:#8a8f98"><div class="key">${keyOf('pickaxe')}</div>${PICKAXE_SVG}<div class="cnt">Ernten</div></div>`);
    for (let i = 0; i < 5; i++) {
      const it = p.slots[i];
      let inner = '', rc = 'rgba(255,255,255,0.06)', cnt = '';
      if (it) {
        if (it.type === 'weapon') { rc = RARITIES[it.rarity].color; inner = weaponIconSVG(it.id, '#fff'); cnt = it.mag + ''; }
        else if (it.type === 'consumable') { const c = CONSUMABLES[it.id]; rc = RARITIES[c.rarity].color; inner = `<div class="cicon" style="color:${c.color}">${c.icon}</div>`; cnt = '×' + it.count; }
      }
      slots.push(`<div class="slot ${p.sel === i + 1 && !p.buildMode ? 'sel' : ''} ${it ? 'full' : ''}" style="--rc:${rc}"><div class="key">${keyOf('slot' + (i + 1))}</div>${inner}<div class="cnt">${cnt}</div></div>`);
    }
    this.el.slots.innerHTML = slots.join('');
    // Materialien
    const m = p.mats;
    const inf = this.g.matsMode === 'unbegrenzt';
    this.el.mats.innerHTML = ['wood', 'stone', 'metal'].map(k =>
      `<div class="mat ${p.buildMode && p.buildMat === k ? 'sel' : ''}"><i class="mi mi-${k}"></i><b>${inf ? '∞' : m[k]}</b></div>`).join('');
    // Bauleiste
    this.el.buildBar.classList.toggle('hidden', !p.buildMode);
    if (p.buildMode) {
      this.el.buildBar.innerHTML = BUILD_TYPES.map(t => `<div class="bp ${p.buildType === t ? 'sel' : ''}">${BUILD_ICONS[t]}<span>${keyLabel(Settings.keys[t])}</span><em>${BUILD_NAMES[t]}</em></div>`).join('') +
        `<div class="bmat">${MAT_NAMES[p.buildMat]} <small>[${keyLabel(Settings.keys.material)}] wechseln</small></div>`;
    }
    this.refreshAmmo();
  }
  refreshAmmo() {
    const p = this.g.player;
    const w = p.heldWeapon;
    if (w && !p.buildMode) {
      const st = WEAPONS[w.id];
      this.el.ammoBox.classList.remove('hidden');
      this.el.ammoMag.textContent = w.mag;
      this.el.ammoRes.textContent = p.ammo[st.ammo];
      this.el.ammoBox.style.setProperty('--ac', AMMO[st.ammo].color);
      this.el.ammoBox.querySelector('small').textContent = AMMO[st.ammo].short;
    } else this.el.ammoBox.classList.add('hidden');
  }

  /* ---------- Pro Frame ---------- */
  update(dt) {
    const g = this.g, p = g.player;
    // FPS
    if (Settings.showFps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { this.el.fps.textContent = Math.round(this.fpsN / this.fpsAcc) + ' FPS'; this.fpsAcc = 0; this.fpsN = 0; }
    }
    // Leisten
    const a = g.focusActor();
    this.el.hpBar.style.width = clamp(a.hp, 0, 100) + '%';
    this.el.hpText.textContent = Math.ceil(Math.max(0, a.hp));
    this.el.shBar.style.width = clamp(a.shield, 0, 100) + '%';
    this.el.shText.textContent = Math.ceil(a.shield);
    this.el.alive.textContent = g.aliveCount;
    this.el.kills.textContent = p.kills;
    // Sturm
    const L = g.storm.label();
    this.el.stormText.textContent = L.text;
    this.el.stormTime.textContent = L.time > 0 ? fmtTime(L.time) : '';
    this.el.stormText.parentElement.classList.toggle('shrinking', L.shrinking);
    const out = g.storm.distOutside(p.pos.x, p.pos.z);
    const showWarn = p.alive && g.state === 'play' && (out > 0 || (g.storm.state === 'wait' && dist2(p.pos.x, p.pos.z, g.storm.nextX, g.storm.nextZ) > g.storm.nextR && g.storm.timer < 30));
    this.el.stormWarn.classList.toggle('hidden', !showWarn);
    if (showWarn) {
      const tx = out > 0 ? g.storm.cx : g.storm.nextX, tz = out > 0 ? g.storm.cz : g.storm.nextZ, tr = out > 0 ? g.storm.r : g.storm.nextR;
      const dist = Math.max(0, Math.round(dist2(p.pos.x, p.pos.z, tx, tz) - tr));
      this.el.stormWarn.textContent = (out > 0 ? '⚠ Du bist im Sturm! ' : 'Lauf in die neue Zone! ') + dist + ' m';
    }
    this.el.stormTint.classList.toggle('on', p.alive && out > 0 && g.state !== 'airship');
    // Kompass
    const heading = Math.atan2(Math.sin(g.camYaw), -Math.cos(g.camYaw)) * 180 / Math.PI;
    const hd = (heading + 360) % 360;
    this.cstrip.style.transform = `translateX(${-((hd + 360) * 4) + this.el.compass.clientWidth / 2}px)`;
    // Luftschiff / Zuschauen
    this.el.shipHint.classList.toggle('hidden', !(p.state === 'airship'));
    const hgt = Math.max(0, Math.round(p.pos.y - g.world.heightAt(p.pos.x, p.pos.z)));
    let phase = 'ground', drop = '';
    if (p.state === 'airship') {
      phase = 'ship'; drop = g.doorsT > 0 ? '' : 'Abspringen';
      this.el.shipHint.innerHTML = g.doorsT > 0 ? `Türen öffnen in <b>${Math.ceil(g.doorsT)}</b>` : Input.touch ? 'Tippe auf <b>Abspringen</b>' : `<b>[${kh('jump')}]</b> Abspringen`;
    } else if (p.state === 'skydive') {
      phase = 'sky'; drop = hgt < 110 ? 'Gleiter' : '';
      this.el.shipHint.classList.remove('hidden');
      this.el.shipHint.innerHTML = Input.touch ? `Höhe ${hgt} m · Joystick nach vorn = Sturzflug` : `Höhe ${hgt} m · <b>[${kh('jump')}]</b> Gleiter öffnen · <b>[${kh('forward')}]</b> Sturzflug`;
    } else if (p.state === 'glide') {
      phase = 'sky';
      this.el.shipHint.classList.remove('hidden'); this.el.shipHint.innerHTML = `Höhe ${hgt} m`;
    }
    if (!p.alive || g.state !== 'play' && g.state !== 'airship') phase = 'none';
    if (document.body.dataset.phase !== phase) document.body.dataset.phase = phase;
    if (this.dropLabel !== drop) { this.dropLabel = drop; const d = document.getElementById('tdrop'); d.hidden = !drop; d.querySelector('span').textContent = drop; }
    const spec = g.state === 'dead' && g.spectating && g.spectating.alive;
    this.el.spectate.classList.toggle('hidden', !spec);
    if (spec) this.el.spectate.innerHTML = `Du schaust <b>${esc(g.spectating.name)}</b> zu · ${g.spectating.kills} Elim. · Linksklick: Nächster`;
    // Prompt
    let prompt = '';
    if (p.alive && p.state === 'ground') {
      const t = g.playerInteractTarget();
      if (t) {
        const k = kh('interact');
        if (t.isPickup) {
          const it = t.item;
          const rar = it.type === 'weapon' ? `<span style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name}</span> ` : '';
          const cnt = it.type !== 'weapon' && it.count ? ' ×' + it.count : '';
          const swap = it.type === 'weapon' && p.freeSlot() < 0 ? ' (tauschen)' : '';
          prompt = `<b>[${k}]</b> Aufheben: ${rar}${itemName(it)}${cnt}${swap}`;
        } else prompt = `<b>[${k}]</b> ${t.interact}`;
      }
      if (p.emoteT >= 0) prompt = 'Tanzen … (bewegen zum Abbrechen)';
    }
    if (prompt !== this.lastPrompt) { this.el.prompt.innerHTML = prompt; this.el.prompt.classList.toggle('hidden', !prompt); this.lastPrompt = prompt; }
    // Fortschritt (Heilen / Nachladen)
    let prog = -1, ptxt = '';
    if (p.healT >= 0) { prog = p.healT; const it = p.slots[p.healSlot]; ptxt = it ? CONSUMABLES[it.id].name + ' …' : ''; }
    else if (p.reloadT >= 0) { prog = p.reloadT; ptxt = 'Nachladen …'; }
    this.el.progress.classList.toggle('hidden', prog < 0);
    if (prog >= 0) { this.el.progressFill.style.width = clamp(prog, 0, 1) * 100 + '%'; this.el.progressText.textContent = ptxt; }
    // Fadenkreuz
    const w = p.heldWeapon;
    let gap = 6;
    let mode = 'gun';
    if (p.buildMode) mode = 'dot';
    else if (!p.held) mode = 'circle';
    else if (w) {
      const st = WEAPONS[w.id];
      let s = (p.input.aim ? st.adsSpread : st.spread) + p.bloom;
      if (Math.hypot(p.vel.x, p.vel.z) > 1.5) s += st.spread * 0.35;
      if (!p.grounded) s += st.spread * 0.8;
      if (p.crouch) s *= 0.75;
      gap = 4 + s * 420 / (p.input.aim ? WEAPONS[w.id].zoom : 1);
      if (st.pellets > 1) mode = 'shotgun';
    } else mode = 'dot';
    const cx = this.el.crosshair;
    cx.dataset.mode = mode;
    cx.style.setProperty('--gap', Math.min(90, gap) + 'px');
    cx.classList.toggle('hidden', !p.alive || p.state !== 'ground' || g.scoped || g.state === 'won');
    this.el.scope.classList.toggle('hidden', !g.scoped);
    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.el.hitmarker.className = ''; }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) this.el.toast.classList.remove('show'); }
    if (this.structT > 0) { this.structT -= dt; if (this.structT <= 0) this.el.structHp.classList.remove('show'); }
    // Munition live
    if (w) { this.el.ammoMag.textContent = w.mag; this.el.ammoRes.textContent = p.ammo[WEAPONS[w.id].ammo]; }
    // Materialien live (für Ernte)
    this.matT = (this.matT || 0) - dt;
    if (this.matT <= 0) { this.matT = 0.25; const m = p.mats; const bs = this.el.mats.querySelectorAll('b'); if (bs.length === 3 && g.matsMode !== 'unbegrenzt') { bs[0].textContent = m.wood; bs[1].textContent = m.stone; bs[2].textContent = m.metal; } }
    // Schadenszahlen
    const cam = g.camera, W = window.innerWidth, H = window.innerHeight;
    const v = new THREE.Vector3();
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 0.9) { n.el.remove(); this.nums.splice(i, 1); continue; }
      v.copy(n.pos); v.y += n.t * 1.2; v.project(cam);
      if (v.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = '';
      n.el.style.transform = `translate(${(v.x * 0.5 + 0.5) * W}px, ${(-v.y * 0.5 + 0.5) * H}px) translate(-50%,-50%) scale(${1 + Math.max(0, 0.3 - n.t) * 2})`;
      n.el.style.opacity = n.t > 0.6 ? (0.9 - n.t) / 0.3 : 1;
    }
    // Minimap
    this.mmT -= dt;
    if (this.mmT <= 0 && Settings.minimap) { this.mmT = 1 / 30; this.drawMinimap(); }
    if (this.mapOpen && ((this.bmT = (this.bmT || 0) - dt) <= 0)) { this.bmT = 0.1; this.drawBigMap(); }
  }
  drawMinimap() {
    const g = this.g, ctx = this.mm, c = this.el.minimap;
    const S = c.width;
    const a = g.focusActor();
    const img = this.mapImg; if (!img) return;
    const sc = g.world.minimapScale;
    const viewR = 75 / Settings.minimapZoom; // Meter
    const k = S / (viewR * 2);
    ctx.save();
    ctx.fillStyle = '#2b6aa0'; ctx.fillRect(0, 0, S, S);
    const px = (a.pos.x + WORLD_SIZE / 2) / sc, pz = (a.pos.z + WORLD_SIZE / 2) / sc;
    const r = viewR / sc;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, px - r, pz - r, r * 2, r * 2, 0, 0, S, S);
    const toS = (x, z) => [(x - a.pos.x) * k + S / 2, (z - a.pos.z) * k + S / 2];
    this.drawStorm(ctx, toS, k, S);
    // Luftschiff-Route
    if (g.ship && g.player.state === 'airship') this.drawRoute(ctx, toS);
    // Spieler
    ctx.translate(S / 2, S / 2);
    const heading = Math.atan2(Math.sin(a.isPlayer ? g.camYaw : a.yaw), -Math.cos(a.isPlayer ? g.camYaw : a.yaw));
    ctx.rotate(heading);
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  drawStorm(ctx, toS, k, S) {
    const st = this.g.storm;
    // Sturmbereich einfärben (außerhalb des Kreises)
    const [cx, cz] = toS(st.cx, st.cz);
    ctx.save();
    ctx.beginPath(); ctx.rect(-10, -10, S + 20, S + 20);
    ctx.arc(cx, cz, Math.max(0, st.r * k), 0, TAU, true);
    ctx.fillStyle = 'rgba(120,50,200,0.42)'; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(cx, cz, Math.max(0, st.r * k), 0, TAU); ctx.strokeStyle = '#c89bff'; ctx.lineWidth = 2; ctx.stroke();
    if (st.state === 'wait') {
      const [nx, nz] = toS(st.nextX, st.nextZ);
      ctx.beginPath(); ctx.arc(nx, nz, Math.max(0, st.nextR * k), 0, TAU); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke(); ctx.setLineDash([]);
      // Linie zum Kreis
      const p = this.g.player;
      const d = dist2(p.pos.x, p.pos.z, st.nextX, st.nextZ);
      if (d > st.nextR && p.alive) {
        const [px, pz] = toS(p.pos.x, p.pos.z);
        const t = (d - st.nextR) / d;
        const ex = p.pos.x + (st.nextX - p.pos.x) * t, ez = p.pos.z + (st.nextZ - p.pos.z) * t;
        const [qx, qz] = toS(ex, ez);
        ctx.beginPath(); ctx.moveTo(px, pz); ctx.lineTo(qx, qz); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.setLineDash([3, 4]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
  drawRoute(ctx, toS) {
    const g = this.g;
    const [ax, az] = toS(g.shipFrom.x, g.shipFrom.z), [bx, bz] = toS(g.shipTo.x, g.shipTo.z);
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke(); ctx.setLineDash([]);
    const [sx, sz] = toS(g.ship.position.x, g.ship.position.z);
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(sx, sz, 6, 0, TAU); ctx.fill(); ctx.strokeStyle = '#000'; ctx.stroke();
    ctx.restore();
  }
  drawBigMap() {
    const g = this.g, ctx = this.bigCtx, S = ctx.canvas.width;
    const img = this.mapImg; if (!img) return;
    ctx.drawImage(img, 0, 0, S, S);
    const k = S / WORLD_SIZE;
    const toS = (x, z) => [(x + WORLD_SIZE / 2) * k, (z + WORLD_SIZE / 2) * k];
    // Raster
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i <= 10; i++) {
      const v = i * S / 10;
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(S, v); ctx.stroke();
      if (i < 10) { ctx.fillText('ABCDEFGHIJ'[i], v + 4, 14); ctx.fillText(String(i + 1), 4, v + 16); }
    }
    this.drawStorm(ctx, toS, k, S);
    // Orte
    ctx.textAlign = 'center';
    for (const p of g.world.pois) {
      const [x, z] = toS(p.x, p.z);
      ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
      ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(p.name.toUpperCase(), x, z);
      ctx.fillStyle = '#fff'; ctx.fillText(p.name.toUpperCase(), x, z);
    }
    ctx.textAlign = 'left';
    if (g.ship && g.player.state === 'airship') this.drawRoute(ctx, toS);
    const a = g.focusActor();
    const [px, pz] = toS(a.pos.x, a.pos.z);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(Math.atan2(Math.sin(g.camYaw), -Math.cos(g.camYaw)));
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  }
  dispose() {
    this.root.classList.add('hidden');
    this.el.dmgnums.innerHTML = '';
    this.toggleMap(false);
  }
}
