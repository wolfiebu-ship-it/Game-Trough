'use strict';
/* ============================================================
   Audio – alles synthetisch per WebAudio, keine Dateien nötig
   ============================================================ */

const SFX = {
  ctx: null, master: null, sfx: null, noiseBuf: null,
  wind: null, windGain: null, stormHum: null,

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    // Dauerhafter Wind (für Fallschirm / Gleiter)
    const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0;
    src.connect(f); f.connect(this.windGain); this.windGain.connect(this.sfx); src.start();
    this.windFilter = f;
    // Sturm-Brummen
    const o = this.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 48;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    this.stormGain = this.ctx.createGain(); this.stormGain.gain.value = 0;
    o.connect(lp); lp.connect(this.stormGain); this.stormGain.connect(this.sfx); o.start();
  },
  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = Settings.master;
    this.sfx.gain.value = Settings.sfx;
  },
  get ok() { return !!this.ctx && this.ctx.state === 'running'; },
  now() { return this.ctx.currentTime; },

  out(vol, pan) {
    const g = this.ctx.createGain(); g.gain.value = vol;
    if (pan && this.ctx.createStereoPanner) {
      const p = this.ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    return g;
  },
  noise(dur, vol, pan, filterType, freq, q, attack) {
    if (!this.ok || vol < 0.005) return;
    const t = this.now();
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = this.ctx.createBiquadFilter(); f.type = filterType || 'lowpass'; f.frequency.value = freq || 2000; f.Q.value = q || 0.7;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + (attack || 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out(vol, pan));
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  },
  tone(freq, dur, vol, type, pan, freqEnd, delay) {
    if (!this.ok || vol < 0.005) return;
    const t = this.now() + (delay || 0);
    const o = this.ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.out(vol, pan));
    o.start(t); o.stop(t + dur + 0.05);
  },

  /* ---------- Spiel-Sounds ---------- */
  shot(kind, vol, pan) {
    vol = vol == null ? 1 : vol;
    switch (kind) {
      case 'pistol': this.noise(0.18, 0.55 * vol, pan, 'lowpass', 3200); this.tone(180, 0.09, 0.35 * vol, 'square', pan, 60); break;
      case 'smg': this.noise(0.1, 0.4 * vol, pan, 'lowpass', 3800); this.tone(220, 0.06, 0.25 * vol, 'square', pan, 90); break;
      case 'ar': this.noise(0.2, 0.6 * vol, pan, 'lowpass', 2600); this.tone(130, 0.12, 0.4 * vol, 'sawtooth', pan, 50); break;
      case 'shotgun': this.noise(0.45, 0.9 * vol, pan, 'lowpass', 1500); this.tone(90, 0.25, 0.6 * vol, 'sawtooth', pan, 35); break;
      case 'sniper': this.noise(0.7, 0.9 * vol, pan, 'lowpass', 2200); this.tone(70, 0.5, 0.6 * vol, 'sawtooth', pan, 30); this.noise(1.2, 0.2 * vol, pan, 'bandpass', 400, 0.5, 0.05); break;
      case 'rocket': this.noise(0.6, 0.6 * vol, pan, 'bandpass', 700, 0.8, 0.02); this.tone(300, 0.4, 0.3 * vol, 'sawtooth', pan, 80); break;
    }
  },
  explosion(vol, pan) { this.noise(1.3, 1.0 * vol, pan, 'lowpass', 900, 0.5, 0.005); this.tone(60, 0.9, 0.8 * vol, 'sine', pan, 25); },
  hit(head, shield) {
    if (head) { this.tone(1400, 0.12, 0.35, 'triangle', 0, 2200); this.tone(2100, 0.1, 0.2, 'sine', 0, 2800, 0.03); }
    else if (shield) this.tone(900, 0.08, 0.3, 'triangle', 0, 1300);
    else this.tone(620, 0.07, 0.3, 'triangle', 0, 480);
  },
  hurt(shield) { this.noise(0.15, 0.4, 0, 'bandpass', shield ? 2400 : 800, 1.5); },
  shieldBreak() { this.tone(1600, 0.35, 0.3, 'triangle', 0, 300); this.noise(0.3, 0.3, 0, 'highpass', 3000); },
  killBoom() { this.tone(110, 0.5, 0.45, 'sine', 0, 40); this.noise(0.5, 0.35, 0, 'bandpass', 1400, 0.6, 0.02); this.tone(1760, 0.25, 0.12, 'triangle', 0, 2640, 0.05); },
  elim() { this.tone(660, 0.12, 0.3, 'square'); this.tone(990, 0.2, 0.3, 'square', 0, null, 0.1); this.tone(1320, 0.3, 0.25, 'triangle', 0, null, 0.2); },
  pickup() { this.tone(700, 0.08, 0.25, 'triangle', 0, 1200); },
  chest(vol, pan) { const v = vol == null ? 1 : vol; [0, 0.07, 0.14, 0.21].forEach((d, i) => this.tone(880 * Math.pow(1.26, i), 0.25, 0.2 * v, 'triangle', pan, null, d)); },
  chestHum(vol, pan) { this.tone(1760 + Math.random() * 400, 0.3, 0.05 * vol, 'sine', pan); },
  build(mat) { this.noise(0.12, 0.35, 0, 'bandpass', mat === 'wood' ? 700 : mat === 'stone' ? 400 : 1800, 1.2); this.tone(mat === 'metal' ? 520 : 200, 0.08, 0.2, 'square', 0, 120); },
  harvest(mat, vol, pan) {
    const v = vol == null ? 1 : vol;
    if (mat === 'wood') { this.noise(0.12, 0.5 * v, pan, 'bandpass', 600, 2); this.tone(160, 0.06, 0.3 * v, 'triangle', pan, 90); }
    else if (mat === 'stone') { this.noise(0.1, 0.5 * v, pan, 'highpass', 1800); this.tone(300, 0.05, 0.25 * v, 'square', pan, 200); }
    else { this.tone(1200, 0.25, 0.25 * v, 'triangle', pan, 1150); this.noise(0.08, 0.3 * v, pan, 'highpass', 3000); }
  },
  breakPiece(mat, vol, pan) { this.noise(0.5, 0.6 * (vol == null ? 1 : vol), pan, 'lowpass', mat === 'metal' ? 2500 : 900); },
  swing() { this.noise(0.18, 0.18, 0, 'bandpass', 1200, 0.8, 0.06); },
  step(vol, pan) { this.noise(0.06, 0.12 * vol, pan, 'lowpass', 500); },
  jump() { this.noise(0.1, 0.12, 0, 'lowpass', 700); },
  land(hard) { this.noise(hard ? 0.25 : 0.12, hard ? 0.5 : 0.2, 0, 'lowpass', 400); },
  reload(stage) { this.tone(stage ? 900 : 500, 0.05, 0.25, 'square', 0, stage ? 1100 : 380); this.noise(0.05, 0.2, 0, 'highpass', 2500); },
  empty() { this.tone(1500, 0.03, 0.2, 'square'); },
  heal() { this.tone(520, 0.2, 0.2, 'sine', 0, 780); this.tone(780, 0.25, 0.15, 'sine', 0, 1040, 0.1); },
  shieldUp() { this.tone(400, 0.4, 0.2, 'triangle', 0, 1400); },
  glider() { this.noise(0.5, 0.4, 0, 'bandpass', 900, 0.8, 0.05); this.tone(240, 0.3, 0.2, 'triangle', 0, 420); },
  jumpOut() { this.noise(0.6, 0.4, 0, 'bandpass', 1200, 0.5, 0.05); },
  stormWarn() { this.tone(220, 0.6, 0.35, 'sawtooth', 0, 440); this.tone(330, 0.6, 0.25, 'sawtooth', 0, 660, 0.25); },
  stormTick() { this.noise(0.2, 0.35, 0, 'bandpass', 300, 2); this.tone(90, 0.2, 0.3, 'sawtooth', 0, 60); },
  ui() { this.tone(900, 0.05, 0.15, 'triangle', 0, 1100); },
  uiHover() { this.tone(1300, 0.03, 0.05, 'sine'); },
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, 0.25, 'triangle', 0, null, i * 0.12)); },
  defeat() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.5, 0.25, 'triangle', 0, null, i * 0.18)); },

  setWind(v) { if (this.windGain) this.windGain.gain.value = damp(this.windGain.gain.value, v, 6, 1 / 60); if (this.windFilter) this.windFilter.frequency.value = 350 + v * 900; },
  setStorm(v) { if (this.stormGain) this.stormGain.gain.value = damp(this.stormGain.gain.value, v, 4, 1 / 60); },
};
