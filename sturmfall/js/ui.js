'use strict';
/* ============================================================
   Menüs: Hauptmenü, Neues Spiel, Einstellungen, Spind,
   Statistik, Hilfe, Pause, Endbildschirm + 3D-Lobby
   ============================================================ */

class Lobby {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x241447, 18, 60);
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 200);
    this.scene.add(new THREE.HemisphereLight(0xd8c8ff, 0x302050, 0.9));
    const key = new THREE.DirectionalLight(0xfff0e0, 0.9); key.position.set(4, 8, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fe0ff, 0.6); rim.position.set(-6, 4, -6); this.scene.add(rim);
    // Hintergrund
    const bg = new THREE.Mesh(new THREE.SphereGeometry(80, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { t: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float t; varying vec3 vP; void main(){ float h = vP.y*0.5+0.5; vec3 a = vec3(0.09,0.05,0.2); vec3 b = vec3(0.45,0.2,0.75); vec3 c = mix(a,b,pow(h,1.5)); float s = sin(vP.x*20.0+t)*sin(vP.y*16.0-t*0.7); c += vec3(0.1,0.05,0.15)*smoothstep(0.7,1.0,s); gl_FragColor = vec4(c,1.0); }',
    }));
    this.bg = bg; this.scene.add(bg);
    // Plattform
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.4, 32), new THREE.MeshLambertMaterial({ color: 0x3a2a6a }));
    plat.position.y = -0.2; plat.receiveShadow = true; this.scene.add(plat);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: 0x39f0ff }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; this.scene.add(ring);
    this.ring = ring;
    // schwebende Würfel
    this.floaters = [];
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: [0x39f0ff, 0xff2ea6, 0xffd23f][i % 3] }));
      const a = Math.random() * TAU, r = 5 + Math.random() * 10;
      m.position.set(Math.cos(a) * r, Math.random() * 6 - 1, Math.sin(a) * r - 6);
      m.userData.s = Math.random() * 2 + 0.5;
      this.scene.add(m); this.floaters.push(m);
    }
    this.rotY = -0.35; this.drag = null; this.emoteT = -1; this.t = 0;
    this.setOutfit(Settings.outfit);
    const cv = document.getElementById('view');
    cv.addEventListener('pointerdown', e => { if (!window.game) this.drag = e.clientX; });
    window.addEventListener('pointerup', () => this.drag = null);
    window.addEventListener('pointermove', e => { if (this.drag != null && !window.game) { this.rotY += (e.clientX - this.drag) * 0.01; this.drag = e.clientX; } });
  }
  setOutfit(i) {
    if (this.rig) this.scene.remove(this.rig.root);
    this.rig = new CharacterRig(i);
    this.rig.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.rig.setHeld('pickaxe', makePickaxeMesh(OUTFITS[i].accent));
    this.rig.root.scale.setScalar(1);
    this.scene.add(this.rig.root);
  }
  dance() { this.emoteT = 0; }
  update(dt) {
    this.t += dt;
    this.bg.material.uniforms.t.value = this.t;
    if (this.emoteT >= 0) { this.emoteT += dt; if (this.emoteT > 7.8) this.emoteT = -1; }
    const walk = this.walkPreview;
    this.rig.update(dt, {
      state: this.emoteT >= 0 ? 'emote' : 'ground', fwd: walk ? 6 : 0, side: 0, grounded: true, vy: 0, crouch: false, sprint: false,
      aim: false, pitch: 0, hold: 'pickaxe', fire: 0, reload: -1, swing: -1, hurt: 0, emoteT: Math.max(0, this.emoteT), dive: false,
    });
    if (this.drag == null) this.rotY += dt * 0.15;
    this.rig.root.rotation.y = this.rotY;
    for (const f of this.floaters) { f.rotation.x += dt * f.userData.s; f.rotation.y += dt * f.userData.s * 0.7; f.position.y += Math.sin(this.t * f.userData.s) * dt * 0.3; }
    this.ring.material.color.setHSL((this.t * 0.05) % 1, 0.9, 0.6);
    const wide = window.innerWidth / window.innerHeight > 1.1;
    const off = !wide ? 0 : this.layout === 'left' ? 1.7 : -1.6;
    this.camX = damp(this.camX == null ? off : this.camX, off, 5, dt);
    this.camera.position.set(this.camX, 1.45, 6.2);
    this.camera.lookAt(this.camX, 1.0, 0);
    this.rig.root.position.x = wide ? 0.2 : 0;
  }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
}

const SETTINGS_UI = {
  'Steuerung': [
    { k: 'sens', label: 'Maus-Empfindlichkeit', type: 'range', min: 0.1, max: 5, step: 0.05, fmt: v => v.toFixed(2) },
    { k: 'adsSens', label: 'Empfindlichkeit beim Zielen', type: 'range', min: 0.1, max: 2, step: 0.05, fmt: v => '×' + v.toFixed(2) },
    { k: 'scopeSens', label: 'Empfindlichkeit mit Zielfernrohr', type: 'range', min: 0.1, max: 2, step: 0.05, fmt: v => '×' + v.toFixed(2) },
    { k: 'invertY', label: 'Y-Achse invertieren', type: 'toggle' },
    { k: 'toggleSprint', label: 'Sprinten umschalten (statt halten)', type: 'toggle' },
    { k: 'toggleCrouch', label: 'Ducken umschalten (statt halten)', type: 'toggle' },
    { k: 'autoGlider', label: 'Gleiter automatisch öffnen', type: 'toggle' },
    { k: 'autoPickup', label: 'Munition & Material automatisch aufheben', type: 'toggle' },
  ],
  'Tasten': 'keys',
  'Grafik': [
    { k: 'quality', label: 'Qualitäts-Voreinstellung', type: 'select', options: [['niedrig', 'Niedrig'], ['mittel', 'Mittel'], ['hoch', 'Hoch'], ['ultra', 'Ultra']] },
    { k: 'shadows', label: 'Schatten', type: 'toggle' },
    { k: 'renderScale', label: 'Render-Auflösung', type: 'range', min: 0.5, max: 1.5, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'viewDist', label: 'Sichtweite', type: 'range', min: 200, max: 900, step: 10, fmt: v => v + ' m' },
    { k: 'fov', label: 'Sichtfeld (FOV)', type: 'range', min: 60, max: 110, step: 1, fmt: v => v + '°' },
    { k: 'particles', label: 'Partikel-Effekte', type: 'toggle' },
    { k: 'cameraShake', label: 'Kamera-Wackeln', type: 'toggle' },
    { k: 'showFps', label: 'FPS anzeigen', type: 'toggle' },
  ],
  'Audio': [
    { k: 'master', label: 'Gesamtlautstärke', type: 'range', min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'sfx', label: 'Effekte', type: 'range', min: 0, max: 1, step: 0.01, fmt: v => Math.round(v * 100) + ' %' },
  ],
  'HUD': [
    { k: 'crosshairColor', label: 'Fadenkreuz-Farbe', type: 'color' },
    { k: 'crosshairSize', label: 'Fadenkreuz-Größe', type: 'range', min: 0.5, max: 2, step: 0.05, fmt: v => '×' + v.toFixed(2) },
    { k: 'damageNumbers', label: 'Schadenszahlen anzeigen', type: 'toggle' },
    { k: 'minimap', label: 'Minimap anzeigen', type: 'toggle' },
    { k: 'minimapZoom', label: 'Minimap-Zoom', type: 'range', min: 0.5, max: 2.5, step: 0.05, fmt: v => '×' + v.toFixed(2) },
    { k: 'hudScale', label: 'HUD-Größe', type: 'range', min: 0.7, max: 1.3, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
  ],
  'Kamera': [
    { k: 'shoulder', label: 'Schulter-Seite', type: 'select', options: [['rechts', 'Rechts'], ['links', 'Links']] },
    { k: 'camDist', label: 'Kamera-Abstand', type: 'range', min: 2.5, max: 7, step: 0.1, fmt: v => v.toFixed(1) + ' m' },
  ],
};

/* Bestätigung per zweitem Klick (Browser-Dialoge sind nicht überall erlaubt) */
function confirmClick(btn, question, action) {
  const label = btn.textContent;
  let armed = false, timer = null;
  btn.addEventListener('click', () => {
    if (armed) { clearTimeout(timer); armed = false; btn.textContent = label; btn.classList.remove('armed'); action(); return; }
    armed = true; btn.textContent = question; btn.classList.add('armed');
    timer = setTimeout(() => { armed = false; btn.textContent = label; btn.classList.remove('armed'); }, 3000);
  });
}

const UI = {
  screen: null, prev: null, settingsTab: 'Steuerung',
  init() {
    this.$ = id => document.getElementById(id);
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { SFX.init(); SFX.ui(); this.show(b.dataset.go); }));
    document.querySelectorAll('button').forEach(b => b.addEventListener('mouseenter', () => SFX.uiHover()));
    this.$('btnStart').addEventListener('click', () => { SFX.init(); this.readSetup(); startMatch(); });
    this.$('btnQuick').addEventListener('click', () => { SFX.init(); startMatch(); });
    this.$('btnResume').addEventListener('click', () => resumeGame());
    this.$('btnPauseSettings').addEventListener('click', () => { this.prev = 'pause'; this.show('settings'); });
    this.$('btnPauseHelp').addEventListener('click', () => { this.prev = 'pause'; this.show('help'); });
    confirmClick(this.$('btnLeave'), 'Wirklich verlassen?', () => quitToMenu());
    this.$('btnSettingsBack').addEventListener('click', () => this.back());
    this.$('btnHelpBack').addEventListener('click', () => this.back());
    confirmClick(this.$('btnSettingsReset'), 'Wirklich zurücksetzen?', () => { resetSettings(); applySettingsLive(); this.renderSettings(); });
    this.$('btnAgain').addEventListener('click', () => { startMatch(); });
    this.$('btnEndMenu').addEventListener('click', () => quitToMenu());
    this.$('btnSpectate').addEventListener('click', () => { this.hideAll(); window.game.spectateMode = true; Input.lock(); });
    this.$('btnDance').addEventListener('click', () => lobby.dance());
    this.$('btnWalk').addEventListener('click', () => { lobby.walkPreview = !lobby.walkPreview; this.$('btnWalk').textContent = lobby.walkPreview ? 'Stehen' : 'Laufen'; });
    this.$('clicklock').addEventListener('click', () => { Input.lock(); });
    confirmClick(this.$('btnResetStats'), 'Wirklich löschen?', () => { for (const k in Stats) Stats[k] = 0; saveStats(); this.renderStats(); });
    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' && !Input.rebindCb) {
        if (this.screen === 'settings' || this.screen === 'help') this.back();
        else if (['setup', 'locker', 'stats'].includes(this.screen)) this.show('menu');
      }
    });
    this.initOnline();
    this.fillSetup();
    this.show('menu');
  },
  hideAll() { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); this.screen = null; },
  show(name) {
    if (name === 'settings' && this.screen !== 'settings' && this.screen !== 'pause') this.prev = this.screen || 'menu';
    if (name === 'help' && this.screen !== 'help' && this.screen !== 'pause') this.prev = this.screen || 'menu';
    this.hideAll();
    const el = this.$('scr-' + name);
    if (el) el.classList.remove('hidden');
    this.screen = name;
    document.body.classList.toggle('in-menu', ['menu', 'setup', 'locker', 'stats', 'online', 'lobby'].includes(name) || (!window.game && (name === 'settings' || name === 'help')));
    if (name === 'settings') this.renderSettings();
    if (name === 'locker') this.renderLocker();
    if (typeof lobby !== 'undefined' && lobby) lobby.layout = name === 'locker' ? 'left' : 'right';
    if (name === 'stats') this.renderStats();
    if (name === 'help') this.renderHelp();
    if (name === 'online') { Net.connect(); this.renderOnline(); }
    if (name === 'lobby') this.renderLobby();
    if (name === 'menu') { this.$('menuName').textContent = Settings.playerName || 'Spieler'; this.$('menuOutfit').textContent = OUTFITS[Settings.outfit].name; this.$('menuWins').textContent = Stats.wins; }
  },
  back() { const p = this.prev || 'menu'; this.prev = null; this.show(window.game && !window.game.endShown ? 'pause' : p === 'pause' && !window.game ? 'menu' : p); },

  /* ----- Neues Spiel ----- */
  fillSetup() {
    const s = MatchSetup;
    this.$('setName').value = Settings.playerName || 'Spieler';
    this.$('setBots').value = s.bots; this.$('setBotsVal').textContent = s.bots;
    this.$('setBots').oninput = () => this.$('setBotsVal').textContent = this.$('setBots').value;
    this.$('setDiff').value = s.difficulty;
    this.$('setStart').value = s.start;
    this.$('setStorm').value = s.stormSpeed;
    this.$('setLoot').value = s.loot;
    this.$('setMats').value = s.buildMats;
    this.$('setSeed').value = s.seed || '';
    this.$('btnRandomSeed').onclick = () => { this.$('setSeed').value = Math.random().toString(36).slice(2, 8).toUpperCase(); };
  },
  readSetup() {
    Settings.playerName = (this.$('setName').value || 'Spieler').slice(0, 16); saveSettings();
    MatchSetup.bots = parseInt(this.$('setBots').value, 10) || 24;
    MatchSetup.difficulty = this.$('setDiff').value;
    MatchSetup.start = this.$('setStart').value;
    MatchSetup.stormSpeed = this.$('setStorm').value;
    MatchSetup.loot = this.$('setLoot').value;
    MatchSetup.buildMats = this.$('setMats').value;
    MatchSetup.seed = this.$('setSeed').value.trim();
    saveMatchSetup();
  },

  /* ----- Einstellungen ----- */
  renderSettings() {
    const tabs = this.$('setTabs'), body = this.$('setBody');
    tabs.innerHTML = Object.keys(SETTINGS_UI).map(t => `<button class="tab ${t === this.settingsTab ? 'on' : ''}" data-tab="${t}">${t}</button>`).join('');
    tabs.querySelectorAll('.tab').forEach(b => b.onclick = () => { this.settingsTab = b.dataset.tab; SFX.ui(); this.renderSettings(); });
    const def = SETTINGS_UI[this.settingsTab];
    if (def === 'keys') { this.renderKeys(body); return; }
    body.innerHTML = def.map(d => {
      const v = Settings[d.k];
      let ctl = '';
      if (d.type === 'range') ctl = `<input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}" data-k="${d.k}"><output>${d.fmt ? d.fmt(v) : v}</output>`;
      else if (d.type === 'toggle') ctl = `<label class="switch"><input type="checkbox" data-k="${d.k}" ${v ? 'checked' : ''}><span></span></label>`;
      else if (d.type === 'select') ctl = `<select data-k="${d.k}">${d.options.map(([val, l]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
      else if (d.type === 'color') ctl = `<input type="color" value="${v}" data-k="${d.k}">`;
      return `<div class="row"><span>${d.label}</span><div class="ctl">${ctl}</div></div>`;
    }).join('') + (this.settingsTab === 'Steuerung' ? '<p class="hint">Tipp: Die Empfindlichkeit bestimmt, wie schnell du dich mit der Maus umschaust. Beim Zielen (rechte Maustaste) wird sie mit dem zweiten Wert multipliziert.</p>' : '');
    body.querySelectorAll('[data-k]').forEach(inp => {
      const d = def.find(x => x.k === inp.dataset.k);
      const upd = () => {
        let v;
        if (d.type === 'range') { v = parseFloat(inp.value); inp.nextElementSibling.textContent = d.fmt ? d.fmt(v) : v; }
        else if (d.type === 'toggle') v = inp.checked;
        else v = inp.value;
        Settings[d.k] = v;
        if (d.k === 'quality') { Object.assign(Settings, QUALITY_PRESETS[v]); saveSettings(); applySettingsLive(); this.renderSettings(); return; }
        saveSettings(); applySettingsLive();
      };
      inp.addEventListener(d.type === 'range' || d.type === 'color' ? 'input' : 'change', upd);
    });
  },
  renderKeys(body) {
    body.innerHTML = '<p class="hint">Klicke auf eine Taste und drücke dann die neue Taste (auch Maustaste 4/5 oder Mausrad-Klick). Esc bricht ab. Linke/rechte Maustaste sind fest: Schießen/Bauen und Zielen.</p>' +
      ACTIONS.map(([k, l]) => `<div class="row"><span>${l}</span><div class="ctl"><button class="keybtn" data-a="${k}">${keyLabel(Settings.keys[k])}</button></div></div>`).join('') +
      '<div class="row"><span>Schießen / Bauen / Ernten</span><div class="ctl"><button class="keybtn" disabled>Linke Maustaste</button></div></div>' +
      '<div class="row"><span>Zielen (ADS)</span><div class="ctl"><button class="keybtn" disabled>Rechte Maustaste</button></div></div>' +
      '<div class="row"><span>Pause / Menü</span><div class="ctl"><button class="keybtn" disabled>Esc</button></div></div>';
    body.querySelectorAll('.keybtn[data-a]').forEach(b => b.onclick = () => {
      b.textContent = 'Taste drücken …'; b.classList.add('wait');
      Input.rebindCb = code => {
        if (code !== 'Escape' && code !== 'Mouse0' && code !== 'Mouse2') {
          const a = b.dataset.a, old = Settings.keys[a];
          for (const k in Settings.keys) if (k !== a && Settings.keys[k] === code) Settings.keys[k] = old;
          Settings.keys[a] = code; saveSettings();
        }
        this.renderSettings();
        if (window.game) window.game.hud.refreshSlots();
      };
    });
  },

  /* ----- Spind ----- */
  renderLocker() {
    const list = this.$('outfits');
    list.innerHTML = OUTFITS.map((o, i) => {
      const c = n => '#' + n.toString(16).padStart(6, '0');
      return `<button class="outfit ${i === Settings.outfit ? 'on' : ''}" data-i="${i}"><span class="sw" style="background:linear-gradient(135deg, ${c(o.top)} 0 50%, ${c(o.accent)} 50% 70%, ${c(o.bottom)} 70%)"></span>${o.name}</button>`;
    }).join('');
    list.querySelectorAll('.outfit').forEach(b => b.onclick = () => {
      Settings.outfit = parseInt(b.dataset.i, 10); saveSettings(); lobby.setOutfit(Settings.outfit); SFX.ui(); this.renderLocker();
    });
  },
  renderStats() {
    const s = Stats;
    const kd = s.played ? (s.kills / Math.max(1, s.played - s.wins)).toFixed(2) : '0.00';
    const rows = [['Matches gespielt', s.played], ['Siege (#1)', s.wins], ['Siegquote', s.played ? Math.round(s.wins / s.played * 100) + ' %' : '–'], ['Top 10', s.top10],
      ['Eliminierungen', s.kills], ['K/D', kd], ['Meiste Elim. in einem Match', s.bestKills], ['Beste Platzierung', s.bestPlace ? '#' + s.bestPlace : '–'],
      ['Schaden gesamt', s.damage], ['Überlebenszeit gesamt', fmtTime(s.timeAlive)]];
    this.$('statsBody').innerHTML = rows.map(([a, b]) => `<div class="stat"><b>${b}</b><span>${a}</span></div>`).join('');
  },
  renderHelp() {
    const k = a => `<kbd>${keyLabel(Settings.keys[a])}</kbd>`;
    this.$('helpBody').innerHTML = `
      <div class="helpcols">
      <div><h3>Bewegung</h3>
        <p>${k('forward')}${k('left')}${k('back')}${k('right')} laufen · ${k('sprint')} sprinten · ${k('crouch')} ducken · ${k('jump')} springen</p>
        <p>Im Luftschiff: ${k('jump')} abspringen. Im freien Fall: ${k('forward')} für Sturzflug, ${k('jump')} öffnet den Gleiter.</p>
        <h3>Kampf</h3>
        <p><kbd>Linke Maus</kbd> schießen · <kbd>Rechte Maus</kbd> zielen · ${k('reload')} nachladen</p>
        <p>${k('pickaxe')} Erntehammer · ${k('slot1')}–${k('slot5')} Inventar · <kbd>Mausrad</kbd> durchschalten</p>
        <p>${k('interact')} aufheben / Truhen öffnen · ${k('drop')} Gegenstand fallen lassen</p>
        <h3>Sonstiges</h3>
        <p>${k('map')} Karte · ${k('emote')} tanzen · <kbd>Esc</kbd> Pause</p></div>
      <div><h3>Bauen</h3>
        <p>${k('build')} Baumodus an/aus, oder direkt: ${k('wall')} Wand · ${k('floor')} Boden · ${k('ramp')} Rampe · ${k('roof')} Dach</p>
        <p><kbd>Linke Maus</kbd> platzieren (gedrückt halten zum Dauerbauen) · ${k('material')} Material wechseln · <kbd>Mausrad</kbd> Bauteil wechseln</p>
        <p>Jedes Teil kostet 10 Material. Holz baut schnell, Stein ist stabiler, Metall am stärksten – braucht aber länger, bis es volle Stärke hat.</p>
        <h3>Tipps</h3>
        <p>Schlag Bäume, Felsen, Autos und Wände mit dem Erntehammer ab, um Material zu sammeln. Triffst du die Stelle zur richtigen Zeit, gibt es manchmal einen Volltreffer (doppelt Material).</p>
        <p>Goldene Truhen summen – folge dem Geräusch! Farben zeigen die Seltenheit: <span style="color:${RARITIES[0].color}">Gewöhnlich</span>, <span style="color:${RARITIES[1].color}">Ungewöhnlich</span>, <span style="color:${RARITIES[2].color}">Selten</span>, <span style="color:${RARITIES[3].color}">Episch</span>, <span style="color:${RARITIES[4].color}">Legendär</span>.</p>
        <p>Bleib in der sicheren Zone. Der Sturm schrumpft in Phasen und wird immer gefährlicher. Schild schützt nicht vor dem Sturm!</p>
        <p>Kopftreffer machen deutlich mehr Schaden. Heilen: Verband (bis 75), Medikit (bis 100), Mini-Schild (bis 50 Schild), Schildtrank, Sprudelfrucht.</p></div>
      </div>`;
  },

  /* ----- Online ----- */
  initOnline() {
    const $ = this.$;
    Net.onChange = () => this.netRefresh();
    $('btnCopyCode').onclick = () => this.copy(Net.code(), $('btnCopyCode'));
    $('btnCopyLobby').onclick = () => this.copy(Net.lobby ? Net.lobby.hostCode : '', $('btnCopyLobby'));
    $('btnCreateLobby').onclick = () => { SFX.init(); SFX.ui(); Net.createLobby(); this.show('lobby'); };
    const join = () => { const err = Net.joinLobby($('joinCode').value); if (err) { $('friendMsg').textContent = err; return; } this.show('lobby'); };
    $('btnJoinCode').onclick = join;
    $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
    const add = () => { const err = Net.addFriend($('friendCode').value); $('friendMsg').textContent = err || 'Freund hinzugefügt – sobald er online ist, siehst du ihn hier.'; if (!err) $('friendCode').value = ''; };
    $('btnAddFriend').onclick = add;
    $('friendCode').addEventListener('keydown', e => { if (e.key === 'Enter') add(); });
    $('netName').addEventListener('change', () => { Settings.playerName = ($('netName').value || 'Spieler').slice(0, 16); saveSettings(); Net.updateMe(); });
    $('btnLeaveLobby').onclick = () => { Net.leaveLobby(); this.show('online'); };
    $('btnLobbyStart').onclick = () => { if (Net.lobby && Net.lobby.isHost) { SFX.init(); startOnlineMatch(); } };
    $('btnToLobby').onclick = () => backToLobby();
    const code = () => {
      const g = window.game, v = $('secretCode').value;
      $('secretCode').value = '';
      if (g && g.checkCode(v)) resumeGame(); else { $('secretCode').placeholder = 'Falscher Code'; setTimeout(() => $('secretCode').placeholder = 'Geheimcode', 1500); }
    };
    $('btnCode').onclick = code;
    $('secretCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') code(); });
  },
  copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = 'Kopiert!'; setTimeout(() => btn.textContent = t, 1200); };
    try { navigator.clipboard.writeText(text).then(done, () => this.selectText(text)); } catch (e) { this.selectText(text); }
  },
  selectText(text) { this.$('friendMsg').textContent = 'Dein Code: ' + text + ' (bitte abschreiben)'; },
  netRefresh() {
    this.renderNotes();
    if (this.screen === 'online') this.renderOnline();
    if (this.screen === 'lobby') { if (!Net.lobby) this.show('online'); else this.renderLobby(); }
  },
  statusLabel(s) {
    return { online: 'Online', connecting: 'Verbinde …', offline: 'Offline', error: 'Fehler', unsupported: 'Nicht verfügbar' }[s] || s;
  },
  renderOnline() {
    const $ = this.$;
    $('netMyCode').textContent = Net.code();
    $('netDot').className = 'dot-' + Net.status;
    $('netStatusText').textContent = this.statusLabel(Net.status);
    if (document.activeElement !== $('netName')) $('netName').value = Settings.playerName || 'Spieler';
    let err = Net.error;
    if (Net.status === 'unsupported') err = 'Online-Spielen ist hier nicht möglich. Öffne das Spiel auf der veröffentlichten Webseite (z. B. GitHub Pages) in Chrome, Edge, Firefox oder Safari.';
    $('netError').textContent = err; $('netError').classList.toggle('hidden', !err);
    const inLobby = Net.lobby && Net.lobby.isHost;
    $('friendList').innerHTML = Net.friends.length ? Net.friends.map(f => {
      const s = Net.fstate[f.code] || {};
      const name = esc(s.name || f.name || 'Unbekannt');
      let pill = s.online ? '<em class="pill on">Online</em>' : '<em class="pill">Offline</em>';
      if (s.online && s.lobby) pill = `<em class="pill lob">In Lobby (${s.lobby.n}/${NET_MAX_PLAYERS})</em>`;
      const btns = [];
      if (s.online && s.lobby && s.lobby.open) btns.push(`<button class="small" data-join="${f.code}">Beitreten</button>`);
      if (s.online && inLobby) btns.push(`<button class="small" data-inv="${f.code}">Einladen</button>`);
      btns.push(`<button class="small ghost" data-del="${f.code}" title="Entfernen">✕</button>`);
      return `<div class="fitem"><div><b>${name}</b><code>${f.code}</code></div>${pill}<div class="fbtns">${btns.join('')}</div></div>`;
    }).join('') : '<p class="hint">Noch keine Freunde. Tauscht eure Freundes-Codes aus und tragt sie oben ein.</p>';
    $('friendList').querySelectorAll('[data-join]').forEach(b => b.onclick = () => { if (!Net.joinLobby(b.dataset.join)) this.show('lobby'); });
    $('friendList').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { Net.invite(b.dataset.inv); b.textContent = 'Eingeladen'; b.disabled = true; });
    $('friendList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => Net.removeFriend(b.dataset.del));
  },
  renderLobby() {
    const $ = this.$, L = Net.lobby;
    if (!L) return;
    $('lobbyCode').textContent = L.hostCode;
    const me = Net.me();
    const players = L.isHost ? Net.lobbyState().players : (L.players || []);
    $('lobbyCount').textContent = L.connecting ? 'Verbinde mit dem Host …' : `${players.length} / ${NET_MAX_PLAYERS} Spieler`;
    const hex = n => '#' + n.toString(16).padStart(6, '0');
    $('lobbyPlayers').innerHTML = players.map(p => {
      const o = OUTFITS[p.outfit % OUTFITS.length];
      return `<div class="pitem"><span class="sw" style="background:linear-gradient(135deg, ${hex(o.top)} 0 50%, ${hex(o.accent)} 50% 70%, ${hex(o.bottom)} 70%)"></span><b>${esc(p.name)}</b>${p.host ? '<em class="pill lob">Host</em>' : ''}${p.code === me.code ? '<em class="pill on">Du</em>' : ''}</div>`;
    }).join('') || '<p class="hint">…</p>';
    // Freunde einladen
    const online = Net.friends.filter(f => (Net.fstate[f.code] || {}).online && !players.some(p => p.code === f.code));
    $('lobbyInvite').innerHTML = !L.isHost ? '<p class="hint">Nur der Host kann einladen – schick Freunden einfach den Lobby-Code.</p>'
      : online.length ? online.map(f => `<div class="fitem"><div><b>${esc((Net.fstate[f.code] || {}).name || f.name)}</b><code>${f.code}</code></div><div class="fbtns"><button class="small" data-inv="${f.code}">Einladen</button></div></div>`).join('')
        : '<p class="hint">Gerade ist kein Freund online. Du kannst auch den Lobby-Code teilen.</p>';
    $('lobbyInvite').querySelectorAll('[data-inv]').forEach(b => b.onclick = () => { Net.invite(b.dataset.inv); b.textContent = 'Eingeladen'; b.disabled = true; });
    // Einstellungen
    const s = L.isHost ? MatchSetup : (L.setup || MatchSetup);
    const sel = (id, label, opts, val) => `<label>${label} <select data-set="${id}" ${L.isHost ? '' : 'disabled'}>${opts.map(([v, t]) => `<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${t}</option>`).join('')}</select></label>`;
    if (!this.lobbySetupFocus) {
      $('lobbySetup').innerHTML =
        sel('bots', 'Bots', [0, 5, 10, 15, 20, 30, 40].map(n => [n, n === 0 ? 'Keine' : n]), s.bots) +
        sel('difficulty', 'Schwierigkeit', [['leicht', 'Leicht'], ['normal', 'Normal'], ['schwer', 'Schwer'], ['profi', 'Profi']], s.difficulty) +
        sel('start', 'Start', [['luftschiff', 'Luftschiff-Absprung'], ['boden', 'Direkt am Boden']], s.start) +
        sel('stormSpeed', 'Sturm-Tempo', [['langsam', 'Langsam'], ['normal', 'Normal'], ['schnell', 'Schnell'], ['turbo', 'Turbo']], s.stormSpeed) +
        sel('loot', 'Beute', [['wenig', 'Wenig'], ['normal', 'Normal'], ['viel', 'Viel']], s.loot) +
        sel('buildMats', 'Baumaterial', [['normal', 'Normal'], ['viel', 'Viel'], ['unbegrenzt', 'Unbegrenzt']], s.buildMats);
      $('lobbySetup').querySelectorAll('[data-set]').forEach(el => {
        el.onfocus = () => this.lobbySetupFocus = true; el.onblur = () => this.lobbySetupFocus = false;
        el.onchange = () => { const k = el.dataset.set; MatchSetup[k] = k === 'bots' ? parseInt(el.value, 10) : el.value; saveMatchSetup(); Net.broadcastLobby(); this.lobbySetupFocus = false; };
      });
    }
    $('btnLobbyStart').classList.toggle('hidden', !L.isHost);
    $('lobbyWait').textContent = L.isHost ? (L.inGame ? 'Match läuft …' : 'Wenn alle da sind: Match starten!') : L.inGame ? 'Das Match läuft gerade – du bist beim nächsten dabei.' : 'Warte, bis der Host das Match startet …';
  },
  renderNotes() {
    const box = this.$('netnotes');
    box.innerHTML = Net.notes.map(n => {
      const btn = n.type === 'inv' ? `<button class="small primary" data-acc="${n.id}">Beitreten</button>` : n.type === 'freq' ? `<button class="small primary" data-acc="${n.id}">Annehmen</button>` : '';
      return `<div class="note"><span>${esc(n.text)}</span>${btn}<button class="small ghost" data-x="${n.id}">✕</button></div>`;
    }).join('');
    box.querySelectorAll('[data-x]').forEach(b => b.onclick = () => Net.dismiss(b.dataset.x));
    box.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => {
      const n = Net.notes.find(x => x.id === b.dataset.acc); if (!n) return;
      Net.dismiss(n.id);
      if (n.type === 'freq') { Net.addFriend(n.code, n.name); if (this.screen !== 'online' && !window.game) this.show('online'); }
      if (n.type === 'inv') { if (window.game) quitToMenu(); if (!Net.joinLobby(n.code)) this.show('lobby'); }
    });
  },

  /* ----- Pause & Ende ----- */
  showEnd(info) {
    const t = this.$('endTitle');
    if (info.won) { t.innerHTML = '#1 SIEG!'; t.className = 'won'; }
    else { t.innerHTML = `Platz <b>#${info.place}</b>`; t.className = ''; }
    let sub = '';
    if (!info.won) {
      if (info.killer) sub = `Eliminiert von <b>${esc(info.killer)}</b>${info.weapon ? ' (' + esc(info.weapon) + ')' : ''}`;
      else if (info.storm) sub = 'Der Sturm hat dich erwischt.';
      else sub = 'Du wurdest eliminiert.';
      if (info.winner) sub += `<br>Gewinner: <b>${esc(info.winner)}</b>`;
    } else sub = `Letzte(r) von ${info.total} – großartig gespielt, ${esc(Settings.playerName)}!`;
    this.$('endSub').innerHTML = sub;
    this.$('endStats').innerHTML = [['Platz', '#' + info.place + ' / ' + info.total], ['Eliminierungen', info.kills], ['Schaden', info.damage], ['Überlebt', fmtTime(info.time)]]
      .map(([a, b]) => `<div class="stat"><b>${b}</b><span>${a}</span></div>`).join('') + `<p class="seed">Karten-Seed: <code>${esc(info.seed)}</code></p>`;
    const canSpec = !info.won && window.game && window.game.actors.some(a => a.alive) && !window.game.over;
    this.$('btnSpectate').classList.toggle('hidden', !canSpec);
    const online = !!(window.game && window.game.net && Net.lobby);
    this.$('btnToLobby').classList.toggle('hidden', !online);
    this.$('btnAgain').classList.toggle('hidden', online);
    this.show('end');
  },
};
