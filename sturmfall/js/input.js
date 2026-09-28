'use strict';
/* ============================================================
   Eingabe: Tastatur, Maus (mit oder ohne Maussperre), Touch,
   frei belegbare Tasten
   ============================================================ */

const Input = {
  down: new Set(), hits: new Set(),
  vheld: new Set(), vhits: new Set(),          // virtuelle Tasten (Touch-Buttons)
  axis: { x: 0, y: 0, on: false },             // virtueller Joystick
  tFire: false, tAim: false,
  mdx: 0, mdy: 0, wheel: 0, mx: null, my: null,
  mouse: [false, false, false], mouseHit: [false, false, false],
  locked: false, free: false, canvas: null, rebindCb: null, enabled: false,
  touch: false, lastTouch: 0,

  /* aktiv = Kamera folgt Maus/Finger (mit Sperre, ohne Sperre oder per Touch) */
  get active() { return this.locked || this.free; },

  init(canvas) {
    this.canvas = canvas;
    this.touch = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
    window.addEventListener('keydown', e => {
      if (this.rebindCb) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb(e.code); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (e.code === 'Escape' && this.free && !this.locked && this.onEscape) { this.onEscape(); return; }
      if (this.enabled && e.code !== 'Escape' && e.code !== 'F11' && e.code !== 'F12') e.preventDefault();
      if (!this.down.has(e.code)) this.hits.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse = [false, false, false]; });
    window.addEventListener('touchstart', () => { this.lastTouch = performance.now(); }, { passive: true, capture: true });
    const fromTouch = () => performance.now() - this.lastTouch < 900;
    window.addEventListener('mousedown', e => {
      if (fromTouch()) return;
      if (this.rebindCb && e.button !== 0) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb('Mouse' + e.button); return; }
      if (!this.active) return;
      if (!this.locked && e.target !== this.canvas) return; // Klicks auf Menüs/HUD sind keine Schüsse
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      if (e.button === 3 || e.button === 4) { this.hits.add('Mouse' + e.button); this.down.add('Mouse' + e.button); return; }
      if (e.button === 1) { this.hits.add('Mouse1'); this.down.add('Mouse1'); }
      if (!this.mouse[b]) this.mouseHit[b] = true;
      this.mouse[b] = true;
    });
    window.addEventListener('mouseup', e => {
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      this.mouse[b] = false;
      this.down.delete('Mouse' + e.button);
    });
    window.addEventListener('contextmenu', e => { if (this.enabled) e.preventDefault(); });
    window.addEventListener('mousemove', e => {
      if (fromTouch()) return;
      this.mx = e.clientX; this.my = e.clientY;
      if (!this.active) return;
      // Ausreißer (Browser-Bug beim Sperren) ignorieren
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mdx += e.movementX; this.mdy += e.movementY;
    });
    document.addEventListener('mouseleave', () => { this.mx = null; });
    window.addEventListener('wheel', e => { if (this.active) { this.wheel += Math.sign(e.deltaY); } }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === this.canvas;
      clearTimeout(this.lockTimer);
      if (this.locked) { this.free = false; if (this.onLockChange) this.onLockChange(true); return; }
      this.mouse = [false, false, false]; this.down.clear();
      if (was && this.onLockChange) this.onLockChange(false);
    });
  },
  /* Maussperre anfordern; klappt das nicht (Handy, eingebettete Seite, Browser verweigert),
     wird ohne Sperre gespielt statt hängen zu bleiben. */
  lock() {
    if (this.touch || !this.canvas.requestPointerLock) { this.setFree(); return; }
    const fail = () => { if (!this.locked) this.setFree(); };
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(fail);
    } catch (e) { fail(); return; }
    clearTimeout(this.lockTimer);
    this.lockTimer = setTimeout(fail, 700);
  },
  setFree() {
    if (this.locked) return;
    const was = this.free;
    this.free = true;
    if (!was && this.onLockChange) this.onLockChange(true, true);
  },
  unlock() {
    clearTimeout(this.lockTimer);
    this.free = false;
    this.tFire = false; this.tAim = false; this.axis.on = false; this.axis.x = this.axis.y = 0; this.vheld.clear();
    if (document.pointerLockElement) document.exitPointerLock();
  },

  held(action) { return this.down.has(Settings.keys[action]) || this.vheld.has(action); },
  pressed(action) { return this.hits.has(Settings.keys[action]) || this.vhits.has(action); },
  consume(action) { this.hits.delete(Settings.keys[action]); this.vhits.delete(action); },
  takeMouse() {
    // Ohne Maussperre: am Bildschirmrand weiterdrehen
    if (this.free && !this.locked && !this.touch && this.mx != null) {
      const W = window.innerWidth, edge = Math.max(30, W * 0.05);
      if (this.mx < edge) this.mdx -= (edge - this.mx) * 0.35;
      else if (this.mx > W - edge) this.mdx += (this.mx - (W - edge)) * 0.35;
    }
    const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r;
  },
  endFrame() { this.hits.clear(); this.vhits.clear(); this.mouseHit = [false, false, false]; this.wheel = 0; },
};
