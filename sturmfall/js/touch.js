'use strict';
/* ============================================================
   Touch-Steuerung für Handy & Tablet:
   linke Hälfte = Joystick, rechte Hälfte wischen = umschauen,
   Buttons für Schießen, Zielen, Springen, Bauen …
   ============================================================ */

const Touch = {
  joyId: null, lookId: null, joyX: 0, joyY: 0, lookX: 0, lookY: 0, btnIds: new Map(),

  init() {
    this.el = document.getElementById('touch');
    this.base = document.getElementById('tjoy');
    this.knob = this.base.querySelector('i');
    if (!Input.touch) return;
    setInterval(() => this.fit(), 500);
    window.addEventListener('resize', () => { this.padScale = 0; setTimeout(() => this.fit(), 50); });
    document.body.classList.add('touch');
    // Erster Start auf dem Handy: sparsame Grafik
    if (Store.get('settings', null) == null) { Object.assign(Settings, QUALITY_PRESETS.niedrig, { quality: 'niedrig' }); saveSettings(); }
    const opt = { passive: false };
    this.el.addEventListener('touchstart', e => this.start(e), opt);
    this.el.addEventListener('touchmove', e => this.move(e), opt);
    this.el.addEventListener('touchend', e => this.end(e), opt);
    this.el.addEventListener('touchcancel', e => this.end(e), opt);
    // Hotbar & Bauleiste antippen
    document.getElementById('slots').addEventListener('click', e => {
      const s = e.target.closest('.slot'); if (!s) return;
      const i = [...s.parentNode.children].indexOf(s);
      Input.vhits.add(i === 0 ? 'pickaxe' : 'slot' + i);
    });
    document.getElementById('buildBar').addEventListener('click', e => {
      const b = e.target.closest('.bp'); if (b) { Input.vhits.add(BUILD_TYPES[[...b.parentNode.querySelectorAll('.bp')].indexOf(b)]); return; }
      if (e.target.closest('.bmat')) Input.vhits.add('material');
    });
    document.getElementById('mats').addEventListener('click', () => Input.vhits.add('material'));
    const hint = document.getElementById('shipHint');
    hint.addEventListener('touchstart', e => { if (hint.classList.contains('tap')) { e.preventDefault(); Input.vhits.add('jump'); } }, { passive: false });
  },
  press(act, id) {
    this.btnIds.set(id, act);
    switch (act) {
      case 'fire': Input.tFire = true; Input.mouseHit[0] = true; break;
      case 'aim': Input.tAim = !Input.tAim; break;
      case 'swap': Input.wheel += 1; break;
      case 'pause': if (Input.onEscape) Input.onEscape(); break;
      default: Input.vhits.add(act); Input.vheld.add(act);
    }
    const b = this.el.querySelector(`[data-act="${act}"]`); if (b) b.classList.add('on');
  },
  release(id) {
    const act = this.btnIds.get(id); if (!act) return;
    this.btnIds.delete(id);
    if (act === 'fire') Input.tFire = false;
    Input.vheld.delete(act);
    const b = this.el.querySelector(`[data-act="${act}"]`);
    if (b && act !== 'aim') b.classList.remove('on');
    if (b && act === 'aim') b.classList.toggle('on', Input.tAim);
  },
  start(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const btn = t.target.closest && t.target.closest('[data-act]');
      if (btn) {
        this.press(btn.dataset.act, t.identifier);
        if (btn.dataset.act === 'fire' && this.lookId == null) { this.lookId = t.identifier; this.lookX = t.clientX; this.lookY = t.clientY; }
        continue;
      }
      if (t.clientX < window.innerWidth * 0.42 && this.joyId == null) {
        this.joyId = t.identifier; this.joyX = t.clientX; this.joyY = t.clientY;
        this.base.style.left = t.clientX + 'px'; this.base.style.top = t.clientY + 'px';
        this.base.classList.add('on'); this.knob.style.transform = '';
        Input.axis.on = true; Input.axis.x = 0; Input.axis.y = 0;
      } else if (this.lookId == null) { this.lookId = t.identifier; this.lookX = t.clientX; this.lookY = t.clientY; }
    }
  },
  move(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) {
        const R = 55;
        let dx = t.clientX - this.joyX, dy = t.clientY - this.joyY;
        const l = Math.hypot(dx, dy);
        if (l > R) { dx *= R / l; dy *= R / l; }
        Input.axis.x = dx / R; Input.axis.y = dy / R;
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      } else if (t.identifier === this.lookId) {
        Input.mdx += (t.clientX - this.lookX) * 1.7; Input.mdy += (t.clientY - this.lookY) * 1.7;
        this.lookX = t.clientX; this.lookY = t.clientY;
      }
    }
  },
  end(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === this.joyId) { this.joyId = null; Input.axis.on = false; Input.axis.x = Input.axis.y = 0; this.base.classList.remove('on'); }
      if (t.identifier === this.lookId) this.lookId = null;
      this.release(t.identifier);
    }
  },
  /* Knopf-Bogen so skalieren, dass er nie in Minimap/Zähler ragt */
  fit() {
    if (!Input.touch || !document.body.classList.contains('playing')) return;
    const pad = document.getElementById('tpad'), tr = document.getElementById('topright');
    if (!pad || !tr || pad.offsetParent === null) return;
    const bottom = window.innerHeight - parseFloat(getComputedStyle(pad).bottom || 0);
    const free = bottom - tr.getBoundingClientRect().bottom - 10;
    const s = Math.max(0.55, Math.min(1, free / 190));
    if (Math.abs(s - (this.padScale || 0)) > 0.01) { this.padScale = s; pad.style.transform = `scale(${s})`; }
  },
  reset() {
    this.joyId = this.lookId = null; this.btnIds.clear();
    this.base.classList.remove('on');
    this.el.querySelectorAll('.on').forEach(b => b.classList.remove('on'));
  },
};
