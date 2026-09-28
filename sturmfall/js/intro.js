'use strict';
/* ============================================================
   Intro: „DESIGNED BY EBU“ – Partikelwirbel, Schockwelle,
   Blitze, Glitch, Explosion, Logo-Einschlag, Wisch-Übergang
   ============================================================ */

const Intro = {
  run(done) {
    const wrap = document.getElementById('intro');
    const cv = wrap.querySelector('canvas');
    const ctx = cv.getContext('2d');
    const skipBtn = document.getElementById('introSkip');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    wrap.classList.remove('hidden'); wrap.style.background = '';
    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const FONT = '900 {S}px "Arial Black", Impact, "Trebuchet MS", sans-serif';
    const font = s => FONT.replace('{S}', Math.round(s));
    const fsE = Math.min(W * 0.3, H * 0.36);
    const cx = W / 2, cy = H * 0.56;
    const easeOutExpo = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
    const easeOutBack = k => { const c = 1.9; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
    const cl = k => k < 0 ? 0 : k > 1 ? 1 : k;
    const rnd = (a, b) => a + Math.random() * (b - a);

    // Zielpunkte aus dem Schriftzug „EBU“ abtasten
    const off = document.createElement('canvas');
    off.width = Math.ceil(W); off.height = Math.ceil(H);
    const o = off.getContext('2d');
    o.fillStyle = '#fff'; o.textAlign = 'center'; o.textBaseline = 'middle';
    o.font = font(fsE); o.fillText('EBU', cx, cy);
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const gap = Math.max(3, Math.round(fsE / 42));
    const parts = [];
    const tw = o.measureText('EBU').width;
    for (let y = 0; y < off.height; y += gap) for (let x = 0; x < off.width; x += gap) {
      if (data[(y * off.width + x) * 4 + 3] > 128) {
        const a = Math.random() * TAU, r = Math.max(W, H) * rnd(0.6, 1.1);
        const hue = 185 + ((x - (cx - tw / 2)) / tw) * 140; // Cyan -> Magenta -> Orange
        parts.push({ tx: x, ty: y, x0: cx + Math.cos(a) * r, y0: cy + Math.sin(a) * r, d: Math.random() * 0.55, c: `hsl(${hue % 360},100%,${rnd(58, 72)}%)`, s: rnd(1.2, 2.6), vx: 0, vy: 0, x: 0, y: 0 });
      }
    }
    // Hintergrund-Sterne
    const stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1) }));
    let bolts = [], sparks = [], boltT = 0, exploded = false;

    const T_FORM = 1.75, T_TYPE = 1.95, T_BOOM = 3.5, T_LOGO = 3.8, T_HIT = 4.25, T_WIPE = 5.7, T_END = 6.5;
    let t = reduce ? T_LOGO + 0.4 : 0, last = performance.now(), running = true, shake = 0;

    const skip = () => { if (t < T_WIPE - 0.6) t = Math.max(t, T_WIPE - 0.6); };
    const onKey = () => skip();
    skipBtn.onclick = e => { e.stopPropagation(); skip(); };
    wrap.onclick = skip;
    window.addEventListener('keydown', onKey);

    const drawBg = (alpha) => {
      ctx.fillStyle = `rgba(7,3,20,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    };
    const drawGrid = (time) => {
      // Synthwave-Boden
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const hy = H * 0.72;
      ctx.strokeStyle = 'rgba(160,60,255,0.18)'; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const k = ((i + (time * 1.6) % 1) / 14);
        const y = hy + Math.pow(k, 2.2) * (H - hy);
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let i = -12; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 20, hy); ctx.lineTo(cx + i * W * 0.16, H); ctx.stroke(); }
      ctx.restore();
    };
    const drawStars = (time, speed) => {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        const x = ((s.x * W + time * speed * 60 * s.z) % W + W) % W;
        ctx.globalAlpha = 0.25 + s.z * 0.5;
        ctx.fillRect(x, s.y * H * 0.7, s.z * 2, s.z * 2);
      }
      ctx.globalAlpha = 1;
    };
    const gradFill = (x0, x1) => {
      const g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, '#39f0ff'); g.addColorStop(0.5, '#ff2ea6'); g.addColorStop(1, '#ffd23f');
      return g;
    };
    const drawEBU = (glitch, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = font(fsE); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (glitch) {
        ctx.globalCompositeOperation = 'lighter';
        const g = 6 + Math.random() * 12;
        ctx.fillStyle = 'rgba(255,0,60,0.8)'; ctx.fillText('EBU', cx - g, cy + rnd(-3, 3));
        ctx.fillStyle = 'rgba(0,255,255,0.8)'; ctx.fillText('EBU', cx + g, cy + rnd(-3, 3));
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.shadowColor = '#ff2ea6'; ctx.shadowBlur = 40;
      ctx.fillStyle = gradFill(cx - tw / 2, cx + tw / 2);
      ctx.fillText('EBU', cx, cy);
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(2, fsE / 60); ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.strokeText('EBU', cx, cy);
      ctx.restore();
    };
    const sliceGlitch = (n) => {
      for (let i = 0; i < n; i++) {
        const y = Math.random() * H, h = rnd(4, 30), dx = rnd(-40, 40);
        ctx.drawImage(cv, 0, y * dpr, cv.width, h * dpr, dx, y, W, h);
      }
    };
    const makeBolt = () => {
      const side = Math.random() < 0.5 ? -1 : 1;
      let x = cx + side * tw * rnd(0.3, 0.52), y = cy + rnd(-fsE * 0.35, fsE * 0.35);
      const pts = [[x, y]];
      const ang = (side < 0 ? Math.PI : 0) + rnd(-0.9, 0.9);
      const len = rnd(W * 0.12, W * 0.35), n = 9;
      for (let i = 1; i <= n; i++) { x += Math.cos(ang) * len / n + rnd(-18, 18); y += Math.sin(ang) * len / n + rnd(-18, 18); pts.push([x, y]); }
      bolts.push({ pts, life: 0.14 });
      for (let i = 0; i < 6; i++) sparks.push({ x, y, vx: rnd(-240, 240), vy: rnd(-240, 120), life: rnd(0.3, 0.7), c: '#bff' });
    };
    const drawBolts = (dt) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const b of bolts) {
        b.life -= dt;
        ctx.strokeStyle = `rgba(190,245,255,${Math.max(0, b.life / 0.14)})`;
        ctx.shadowColor = '#39f0ff'; ctx.shadowBlur = 18;
        for (const lw of [5, 2]) {
          ctx.lineWidth = lw; ctx.beginPath();
          b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
          ctx.stroke();
        }
      }
      ctx.restore();
      bolts = bolts.filter(b => b.life > 0);
    };
    const drawSparks = (dt) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const s of sparks) {
        s.life -= dt; s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 2));
        ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, 3, 3);
      }
      ctx.restore();
      sparks = sparks.filter(s => s.life > 0);
    };
    const ring = (t0, speed, color, width) => {
      const k = t - t0;
      if (k < 0 || k > 0.9) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color; ctx.globalAlpha = 1 - k / 0.9; ctx.lineWidth = width * (1 - k / 0.9) + 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, k * speed, k * speed * 0.55, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    };
    const flash = (t0, dur, max) => {
      const k = (t - t0) / dur;
      if (k < 0 || k > 1) return;
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * max})`; ctx.fillRect(0, 0, W, H);
    };
    const typed = (text, t0, y, size, color, spacing) => {
      const n = Math.floor((t - t0) / 0.055);
      if (n < 0) return;
      const glyphs = '!<>-_\\/[]{}=+*^?#%&';
      ctx.save();
      ctx.font = `800 ${Math.round(size)}px "Trebuchet MS", "Arial Black", sans-serif`;
      ctx.textBaseline = 'middle';
      const widths = [...text].map(ch => ctx.measureText(ch).width + spacing);
      const total = widths.reduce((a, b) => a + b, 0) - spacing;
      let x = cx - total / 2;
      [...text].forEach((ch, i) => {
        let c = ch;
        if (i > n) c = '';
        else if (i >= n - 2 && t - t0 < text.length * 0.055 + 0.15) c = ch === ' ' ? ' ' : glyphs[Math.floor(Math.random() * glyphs.length)];
        ctx.fillStyle = i >= n - 2 ? '#fff' : color;
        ctx.shadowColor = color; ctx.shadowBlur = 16;
        ctx.fillText(c, x, y);
        x += widths[i];
      });
      ctx.restore();
    };
    const drawLogo = (k, alpha) => {
      const fsl = Math.min(W * 0.12, H * 0.2);
      const s = lerp(4.2, 1, easeOutBack(cl(k)));
      ctx.save();
      ctx.globalAlpha = alpha * cl(k * 2);
      ctx.translate(cx, H * 0.47); ctx.scale(s, s); ctx.transform(1, 0, -0.12, 1, 0, 0);
      ctx.font = `italic ${font(fsl)}`;
      ctx.textBaseline = 'middle';
      const w1 = ctx.measureText('STURM').width, w2 = ctx.measureText('FALL').width;
      const x0 = -(w1 + w2) / 2;
      ctx.fillStyle = '#5a2bc4'; ctx.fillText('STURM', x0, fsl * 0.07);
      ctx.fillStyle = '#c46a00'; ctx.fillText('FALL', x0 + w1, fsl * 0.07);
      ctx.shadowColor = 'rgba(255,210,63,0.6)'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#ffffff'; ctx.fillText('STURM', x0, 0);
      ctx.fillStyle = '#ffd23f'; ctx.fillText('FALL', x0 + w1, 0);
      ctx.restore();
    };
    const drawRays = (a) => {
      ctx.save();
      ctx.translate(cx, H * 0.47); ctx.rotate(t * 0.35);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        ctx.rotate(TAU / 14);
        const g = ctx.createLinearGradient(0, 0, Math.max(W, H), 0);
        g.addColorStop(0, `rgba(255,210,63,${0.22 * a})`); g.addColorStop(1, 'rgba(255,46,166,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.max(W, H), -60); ctx.lineTo(Math.max(W, H), 60); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    };

    const frame = now => {
      if (!running) return;
      const real = Math.min(0.25, (now - last) / 1000); last = now;
      t += real; // Echtzeit: das Intro dauert auch bei wenig FPS gleich lang
      const dt = Math.min(0.05, real);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Schütteln
      if (Math.abs(t - T_FORM) < 0.02 || Math.abs(t - T_HIT) < 0.02) shake = 1;
      shake = Math.max(0, shake - dt * 2.5);
      const sx = (Math.random() - 0.5) * 28 * shake * shake, sy = (Math.random() - 0.5) * 28 * shake * shake;

      if (t < T_WIPE) drawBg(t < T_FORM ? 0.3 : t < T_LOGO ? 0.42 : 0.55);
      else { ctx.clearRect(0, 0, W, H); drawBg(1); }
      ctx.save(); ctx.translate(sx, sy);
      drawStars(t, t < T_FORM ? 6 : 1.2);
      drawGrid(t);

      // 1) Partikelwirbel formt „EBU“
      if (t < T_BOOM) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (const p of parts) {
          const k = cl((t - 0.2 - p.d) / 1.05);
          const e = easeOutExpo(k);
          const dx = (p.x0 - p.tx) * (1 - e), dy = (p.y0 - p.ty) * (1 - e);
          const a = (1 - e) * 3.2, ca = Math.cos(a), sa = Math.sin(a);
          p.x = p.tx + dx * ca - dy * sa; p.y = p.ty + dx * sa + dy * ca;
          if (t > T_FORM) { p.x += rnd(-0.8, 0.8); p.y += rnd(-0.8, 0.8); }
          ctx.fillStyle = p.c;
          const s = p.s * (k < 1 ? 1.6 : 1);
          ctx.fillRect(p.x, p.y, s, s);
        }
        ctx.restore();
      }
      // 2) Einschlag: Text, Schockwelle, Blitze, Tippen
      if (t >= T_FORM && t < T_BOOM) {
        const glitch = (t < T_FORM + 0.22) || (t > 2.62 && t < 2.76) || (t > 3.18 && t < 3.3);
        drawEBU(glitch, cl((t - T_FORM) * 5));
        typed('DESIGNED BY', T_TYPE, cy - fsE * 0.66, Math.max(16, fsE * 0.16), '#39f0ff', Math.max(4, fsE * 0.05));
        // Unterstrich
        const uk = cl((t - 2.35) / 0.4);
        if (uk > 0) {
          const g = gradFill(cx - tw / 2, cx + tw / 2);
          ctx.fillStyle = g; ctx.shadowColor = '#ff2ea6'; ctx.shadowBlur = 20;
          ctx.fillRect(cx - tw / 2, cy + fsE * 0.46, tw * uk, Math.max(3, fsE * 0.03));
          ctx.shadowBlur = 0;
        }
        boltT -= dt;
        if (t > 2.0 && boltT <= 0) { boltT = rnd(0.06, 0.16); makeBolt(); }
        if (glitch) sliceGlitch(7);
      }
      drawBolts(dt);
      // 3) Explosion der Partikel
      if (t >= T_BOOM && !exploded) {
        exploded = true;
        for (const p of parts) { const a = Math.atan2(p.ty - cy, p.tx - cx) + rnd(-0.4, 0.4), sp = rnd(300, 1400); p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - rnd(0, 300); p.x = p.tx; p.y = p.ty; }
      }
      if (exploded && t < T_LOGO + 1.2) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const fade = cl(1 - (t - T_BOOM) / 1.3);
        for (const p of parts) {
          p.vx *= 1 - dt * 1.8; p.vy = p.vy * (1 - dt * 1.8) + 200 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          ctx.globalAlpha = fade; ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.s * 1.4, p.s * 1.4);
        }
        ctx.restore();
      }
      // 4) Logo-Einschlag
      if (t >= T_LOGO) {
        const k = (t - T_LOGO) / (T_HIT - T_LOGO);
        if (t > T_HIT) drawRays(cl((t - T_HIT) * 2));
        drawLogo(k, 1);
        if (t > T_HIT + 0.15) {
          const a = cl((t - T_HIT - 0.15) * 2.5);
          ctx.save();
          ctx.globalAlpha = a;
          const fs = Math.max(13, Math.min(W * 0.028, H * 0.045));
          ctx.font = `800 ${Math.round(fs)}px "Trebuchet MS", sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const y = H * 0.47 + Math.min(W * 0.12, H * 0.2) * 0.8;
          ctx.fillStyle = '#cfc4ff';
          const label = 'E I N   S P I E L   V O N   ';
          const lw = ctx.measureText(label).width, ew = ctx.measureText('E B U').width;
          ctx.fillText(label, cx - ew / 2, y);
          ctx.fillStyle = '#39f0ff'; ctx.shadowColor = '#39f0ff'; ctx.shadowBlur = 16;
          ctx.fillText('E B U', cx + lw / 2, y);
          ctx.restore();
        }
        if (Math.random() < 0.5 && t > T_HIT) sparks.push({ x: rnd(0, W), y: -5, vx: rnd(-40, 40), vy: rnd(60, 200), life: 2, c: Math.random() < 0.5 ? '#ffd23f' : '#ff2ea6' });
      }
      drawSparks(dt);
      ring(T_FORM, 1600, '#ff2ea6', 16);
      ring(T_FORM + 0.08, 1100, '#39f0ff', 10);
      ring(T_HIT, 1500, '#ffd23f', 18);
      ctx.restore();
      flash(T_FORM, 0.35, 0.9);
      flash(T_BOOM, 0.25, 0.6);
      flash(T_HIT, 0.3, 0.7);
      // Scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      // 5) Wisch-Übergang zum Menü
      if (t >= T_WIPE) {
        wrap.style.background = 'transparent';
        const k = cl((t - T_WIPE) / (T_END - T_WIPE));
        const p = easeOutExpo(k) * (W + H * 0.6);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p, 0); ctx.lineTo(p - H * 0.6, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p - H * 0.6, H); ctx.stroke();
        ctx.restore();
      }
      if (t >= T_END) { finish(); return; }
      requestAnimationFrame(frame);
    };
    const finish = () => {
      running = false;
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      wrap.classList.add('hidden');
      if (done) done();
    };
    requestAnimationFrame(now => { last = now; frame(now); });
  },
};
