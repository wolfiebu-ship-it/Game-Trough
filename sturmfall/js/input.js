'use strict';
/* ============================================================
   Eingabe: Tastatur, Maus, Pointer-Lock, frei belegbare Tasten
   ============================================================ */

const Input = {
  down: new Set(), hits: new Set(),
  mdx: 0, mdy: 0, wheel: 0,
  mouse: [false, false, false], mouseHit: [false, false, false],
  locked: false, canvas: null, rebindCb: null, enabled: false,

  init(canvas) {
    this.canvas = canvas;
    window.addEventListener('keydown', e => {
      if (this.rebindCb) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb(e.code); return; }
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (this.enabled && e.code !== 'Escape' && e.code !== 'F11' && e.code !== 'F12') e.preventDefault();
      if (!this.down.has(e.code)) this.hits.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', e => { this.down.delete(e.code); });
    window.addEventListener('blur', () => { this.down.clear(); this.mouse = [false, false, false]; });
    window.addEventListener('mousedown', e => {
      if (this.rebindCb && e.button !== 0) { e.preventDefault(); const cb = this.rebindCb; this.rebindCb = null; cb('Mouse' + e.button); return; }
      if (!this.locked) return;
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
      if (!this.locked) return;
      // Ausreißer (Browser-Bug beim Sperren) ignorieren
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mdx += e.movementX; this.mdy += e.movementY;
    });
    window.addEventListener('wheel', e => { if (this.locked) { this.wheel += Math.sign(e.deltaY); } }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.mouse = [false, false, false]; this.down.clear(); }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  },
  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { if (this.onLockFail) this.onLockFail(); });
    } catch (e) { if (this.onLockFail) this.onLockFail(); }
  },
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); },

  held(action) { return this.down.has(Settings.keys[action]); },
  pressed(action) { return this.hits.has(Settings.keys[action]); },
  consume(action) { this.hits.delete(Settings.keys[action]); },
  takeMouse() { const r = [this.mdx, this.mdy]; this.mdx = 0; this.mdy = 0; return r; },
  endFrame() { this.hits.clear(); this.mouseHit = [false, false, false]; this.wheel = 0; },
};
