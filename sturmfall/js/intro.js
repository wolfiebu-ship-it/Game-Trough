'use strict';
/* ============================================================
   Intro: „DESIGNED BY EBU“
   Die Buchstaben E, B, U hüpfen nacheinander von der Seite herein,
   quetschen sich beim Aufkommen, springen gemeinsam im Takt,
   Konfetti-Explosion, Blitze – dann schlägt das STURMFALL-Logo ein.
   Alles liegt auf einer festen Bühne, die auf jedes Gerät passt.
   Das Intro lässt sich nicht überspringen.
   ============================================================ */

const Intro = {
  run(done) {
    const wrap = document.getElementById('intro');
    const cv = wrap.querySelector('canvas');
    const ctx = cv.getContext('2d');
    wrap.classList.remove('hidden'); wrap.style.background = '';

    let W = 0, H = 0, dpr = 1, SW = 1280, SH = 720, S = 1, OX = 0, OY = 0;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      // Bühne: Querformat 1280×720, Hochformat 720×1200 – immer komplett sichtbar
      if (H > W) { SW = 720; SH = 1200; } else { SW = 1280; SH = 720; }
      S = Math.min(W / SW, H / SH);
      OX = (W - SW * S) / 2; OY = (H - SH * S) / 2;
    };
    resize();
    window.addEventListener('resize', resize);

    const HEAD = '"Arial Black", Impact, "Trebuchet MS", sans-serif';
    const cl = k => k < 0 ? 0 : k > 1 ? 1 : k;
    const rnd = (a, b) => a + Math.random() * (b - a);
    const easeOutCubic = k => 1 - Math.pow(1 - cl(k), 3);
    const easeOutBack = k => { const c = 1.9; k = cl(k); return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

    // Zeitplan (Sekunden)
    const T_WAVE = 2.55, T_BANG = 3.05, T_TYPE = 3.1, T_OUT = 4.35, T_LOGO = 4.55, T_HIT = 5.0, T_WIPE = 6.5, T_END = 7.3;

    const COLORS = [['#7ff8ff', '#1fb8ff'], ['#ff7fd0', '#ff1f8e'], ['#fff07f', '#ffa21f']];
    const letters = ['E', 'B', 'U'].map((ch, i) => ({ ch, i, start: 0.45 + i * 0.42, sx: 1, sy: 1, x: 0, y: 0, rot: 0, landed: -1, squash: 0 }));
    let parts = [], bolts = [], boltT = 0, shake = 0, t = 0, last = performance.now(), running = true, bang = false, hit = false;
    const stars = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), z: rnd(0.2, 1) }));

    // Bühnen-Maße abhängig von der Ausrichtung
    const layout = () => {
      const portrait = SH > SW;
      const F = portrait ? 250 : 270;
      ctx.font = `900 ${F}px ${HEAD}`;
      const ws = letters.map(l => ctx.measureText(l.ch).width);
      const gap = F * 0.13;
      const total = ws.reduce((a, b) => a + b, 0) + gap * 2;
      let x = SW / 2 - total / 2;
      const slots = ws.map(w => { const c = x + w / 2; x += w + gap; return c; });
      const base = portrait ? SH * 0.56 : SH * 0.66; // Grundlinie der Buchstaben
      return { F, ws, slots, base, total, portrait };
    };

    const burst = (x, y, n, cols, sp, up, life, size) => {
      for (let k = 0; k < n; k++) {
        const a = rnd(0, TAU), v = rnd(sp * 0.3, sp);
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, life: rnd(life * 0.6, life), max: life, c: cols[k % cols.length], s: rnd(size * 0.5, size), g: 900, rot: rnd(0, 6), vr: rnd(-12, 12) });
      }
    };
    const dust = (x, y, strength) => {
      for (let k = 0; k < 14 * strength; k++) {
        const dir = k % 2 ? 1 : -1;
        parts.push({ x: x + rnd(-40, 40), y, vx: dir * rnd(80, 360) * strength, vy: -rnd(20, 160) * strength, life: rnd(0.3, 0.6), max: 0.6, c: 'rgba(200,180,255,0.9)', s: rnd(4, 9), g: 300, rot: 0, vr: 0, round: true });
      }
    };

    /* Hüpfbahn eines Buchstabens: 3 Sprünge von links in seine Lücke */
    const HOPS = [[0.5, 300], [0.36, 150], [0.26, 55]];
    const HOP_T = HOPS.reduce((a, h) => a + h[0], 0);
    const updateLetter = (l, L) => {
      const k = t - l.start;
      const slot = L.slots[l.i];
      const fromX = -L.F * 1.2 - l.i * 60;
      if (k < 0) { l.x = fromX; l.y = L.base; l.visible = false; return; }
      l.visible = true;
      if (k < HOP_T) {
        let acc = 0, seg = 0;
        while (seg < HOPS.length - 1 && k > acc + HOPS[seg][0]) { acc += HOPS[seg][0]; seg++; }
        const u = cl((k - acc) / HOPS[seg][0]);
        const prog = (acc + u * HOPS[seg][0]) / HOP_T;
        l.x = fromX + (slot - fromX) * easeOutCubic(prog);
        l.y = L.base - HOPS[seg][1] * 4 * u * (1 - u);
        l.rot = seg === 0 ? -TAU * (1 - u) : 0; // beim ersten Sprung ein Salto
        const vy = 1 - 2 * u;
        l.sx = 1 - Math.abs(vy) * 0.12; l.sy = 1 + Math.abs(vy) * 0.16; // in der Luft strecken
        if (seg !== l.landed && seg > 0) { l.landed = seg; l.squash = 1 - seg * 0.2; dust(l.x, L.base, 0.8); }
      } else {
        if (l.landed !== 99 && l.landed < 99) { l.landed = 99; l.squash = 1.2; dust(slot, L.base, 1.3); shake = Math.max(shake, 0.55); burst(slot, L.base - L.F * 0.4, 18, COLORS[l.i], 520, 200, 0.9, 10); }
        l.x = slot; l.y = L.base; l.rot = 0; l.sx = 1; l.sy = 1;
        // gemeinsamer Wellen-Sprung
        const w = t - T_WAVE - l.i * 0.09;
        if (w > 0 && w < 0.5) { const u = w / 0.5; l.y = L.base - 170 * 4 * u * (1 - u); l.sy = 1.12; l.sx = 0.92; l.rot = Math.sin(u * Math.PI) * (l.i - 1) * 0.25; }
        if (w >= 0.5 && l.landed !== 100) { l.landed = 100; l.squash = 1.3; }
        // danach im Takt wippen
        if (t > T_BANG + 0.2) {
          const ph = (t - T_BANG) * 7 - l.i * 0.9;
          const b = Math.max(0, Math.sin(ph));
          l.y = L.base - b * 22;
          const beat = Math.floor(ph / TAU);
          if (b === 0 && l.beat !== beat) { l.beat = beat; l.squash = Math.max(l.squash, 0.45); }
        }
      }
      if (l.squash > 0) { l.sx *= 1 + l.squash * 0.35; l.sy *= 1 - l.squash * 0.3; l.squash = Math.max(0, l.squash - 0.08); }
    };
    const drawLetter = (l, L, alpha, extraScale) => {
      if (!l.visible || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.scale(l.sx * extraScale, l.sy * extraScale);
      ctx.font = `900 ${L.F}px ${HEAD}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const g = ctx.createLinearGradient(0, -L.F * 0.75, 0, 0);
      g.addColorStop(0, COLORS[l.i][0]); g.addColorStop(1, COLORS[l.i][1]);
      ctx.fillStyle = 'rgba(40,10,90,0.9)'; ctx.fillText(l.ch, 8, 10); // 3D-Kante
      ctx.shadowColor = COLORS[l.i][1]; ctx.shadowBlur = 38;
      ctx.fillStyle = g; ctx.fillText(l.ch, 0, 0);
      ctx.shadowBlur = 0;
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(l.ch, 0, 0);
      ctx.restore();
    };

    const typed = (text, t0, x, y, size, color, spacing) => {
      const n = Math.floor((t - t0) / 0.06);
      if (n < 0) return;
      const glyphs = '!<>-_/[]{}=+*^?#%&';
      ctx.save();
      ctx.font = `800 ${Math.round(size)}px "Trebuchet MS", ${HEAD}`;
      ctx.textBaseline = 'middle';
      const chars = [...text];
      const widths = chars.map(ch => ctx.measureText(ch).width + spacing);
      const total = widths.reduce((a, b) => a + b, 0) - spacing;
      let cx = x - total / 2;
      chars.forEach((ch, i) => {
        let c = ch;
        if (i > n) c = '';
        else if (i >= n - 1 && t - t0 < chars.length * 0.06 + 0.1 && ch !== ' ') c = glyphs[Math.floor(Math.random() * glyphs.length)];
        const pop = cl((t - t0 - i * 0.06) / 0.15);
        ctx.fillStyle = i >= n - 1 ? '#ffffff' : color;
        ctx.shadowColor = color; ctx.shadowBlur = 18;
        ctx.fillText(c, cx, y - (1 - pop) * 16);
        cx += widths[i];
      });
      ctx.restore();
    };
    const makeBolt = (L) => {
      const side = Math.random() < 0.5 ? -1 : 1;
      let x = SW / 2 + side * L.total * rnd(0.42, 0.55), y = L.base - L.F * rnd(0.1, 0.7);
      const pts = [[x, y]];
      const ang = (side < 0 ? Math.PI : 0) + rnd(-0.8, 0.8), len = rnd(140, 300), n = 8;
      for (let i = 1; i <= n; i++) { x += Math.cos(ang) * len / n + rnd(-16, 16); y += Math.sin(ang) * len / n + rnd(-16, 16); pts.push([x, y]); }
      bolts.push({ pts, life: 0.13 });
    };
    const drawBolts = (dt) => {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#39f0ff'; ctx.shadowBlur = 16;
      for (const b of bolts) {
        b.life -= dt;
        ctx.strokeStyle = `rgba(190,245,255,${Math.max(0, b.life / 0.13)})`;
        for (const lw of [6, 2]) { ctx.lineWidth = lw; ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); }
      }
      ctx.restore();
      bolts = bolts.filter(b => b.life > 0);
    };
    const drawParts = (dt) => {
      ctx.save();
      for (const p of parts) {
        p.life -= dt; p.vy += p.g * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        ctx.globalAlpha = cl(p.life / p.max * 1.5);
        ctx.fillStyle = p.c;
        if (p.round) { ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, TAU); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
      }
      ctx.restore();
      parts = parts.filter(p => p.life > 0);
    };
    const ring = (t0, speed, color, width, cx, cy) => {
      const k = t - t0;
      if (k < 0 || k > 0.9) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color; ctx.globalAlpha = 1 - k / 0.9; ctx.lineWidth = width * (1 - k / 0.9) + 1;
      ctx.beginPath(); ctx.ellipse(cx, cy, k * speed, k * speed * 0.45, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    };
    const logoY = () => SH > SW ? SH * 0.45 : SH * 0.46;
    const drawLogo = (k) => {
      ctx.save();
      ctx.font = `italic 900 100px ${HEAD}`;
      const wFull = ctx.measureText('STURMFALL').width;
      const fsl = Math.min(170, (SW * 0.86) / wFull * 100);
      const s = 1 + 3.2 * (1 - easeOutBack(k));
      ctx.globalAlpha = cl(k * 2);
      ctx.translate(SW / 2, logoY()); ctx.scale(s, s); ctx.transform(1, 0, -0.12, 1, 0, 0);
      ctx.font = `italic 900 ${Math.round(fsl)}px ${HEAD}`;
      ctx.textBaseline = 'middle';
      const w1 = ctx.measureText('STURM').width, w2 = ctx.measureText('FALL').width;
      const x0 = -(w1 + w2) / 2;
      ctx.fillStyle = '#5a2bc4'; ctx.fillText('STURM', x0, fsl * 0.07);
      ctx.fillStyle = '#c46a00'; ctx.fillText('FALL', x0 + w1, fsl * 0.07);
      ctx.shadowColor = 'rgba(255,210,63,0.7)'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#ffffff'; ctx.fillText('STURM', x0, 0);
      ctx.fillStyle = '#ffd23f'; ctx.fillText('FALL', x0 + w1, 0);
      ctx.restore();
      return fsl;
    };
    const drawRays = (a) => {
      ctx.save();
      ctx.translate(SW / 2, logoY()); ctx.rotate(t * 0.35);
      ctx.globalCompositeOperation = 'lighter';
      const R = Math.max(SW, SH) * 1.2;
      for (let i = 0; i < 14; i++) {
        ctx.rotate(TAU / 14);
        const g = ctx.createLinearGradient(0, 0, R, 0);
        g.addColorStop(0, `rgba(255,210,63,${0.2 * a})`); g.addColorStop(1, 'rgba(255,46,166,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, -70); ctx.lineTo(R, 70); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    };

    /* Hintergrund über den ganzen Bildschirm */
    const drawBackground = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.8);
      g.addColorStop(0, '#2a0f5c'); g.addColorStop(1, '#07031a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        const x = ((s.x * W + t * 40 * s.z) % W + W) % W;
        ctx.globalAlpha = (0.25 + s.z * 0.55) * (0.6 + 0.4 * Math.sin(t * 3 + s.x * 40));
        ctx.fillRect(x, s.y * H * 0.72, s.z * 2.2, s.z * 2.2);
      }
      ctx.globalAlpha = 1;
      const hy = H * 0.74;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(170,70,255,0.22)'; ctx.lineWidth = 1;
      for (let i = 0; i < 14; i++) { const k = (i + (t * 1.4) % 1) / 14; const y = hy + Math.pow(k, 2.2) * (H - hy); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (let i = -14; i <= 14; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 22, hy); ctx.lineTo(W / 2 + i * W * 0.14, H); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,46,166,0.25)'; ctx.fillRect(0, hy - 1, W, 2);
      // schwenkende Scheinwerfer
      for (const [bx, sp, col] of [[W * 0.2, 0.9, 'rgba(57,240,255,0.10)'], [W * 0.8, -0.8, 'rgba(255,46,166,0.10)']]) {
        ctx.save(); ctx.translate(bx, H); ctx.rotate(Math.sin(t * sp) * 0.5);
        const gg = ctx.createLinearGradient(0, 0, 0, -H * 1.2);
        gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.lineTo(H * 0.35, -H * 1.2); ctx.lineTo(-H * 0.35, -H * 1.2); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    };
    const flash = (t0, dur, max) => {
      const k = (t - t0) / dur;
      if (k < 0 || k > 1) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = `rgba(255,255,255,${(1 - k) * max})`; ctx.fillRect(0, 0, W, H);
    };

    const frame = now => {
      if (!running) return;
      const real = Math.min(0.25, (now - last) / 1000); last = now;
      t += real; // Echtzeit: gleich lang auch bei wenig FPS
      const dt = Math.min(0.05, real);
      const L = layout();
      drawBackground();
      shake = Math.max(0, shake - dt * 2.2);
      const sx = (Math.random() - 0.5) * 30 * shake * shake, sy = (Math.random() - 0.5) * 30 * shake * shake;
      ctx.setTransform(dpr * S, 0, 0, dpr * S, dpr * (OX + sx), dpr * (OY + sy));

      // Schatten unter den Buchstaben
      if (t < T_OUT) {
        for (const l of letters) {
          if (!l.visible) continue;
          const hgt = Math.max(0, L.base - l.y);
          ctx.save(); ctx.globalAlpha = 0.45 * cl(1 - hgt / 350);
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.ellipse(l.x, L.base + 14, Math.max(1, L.ws[l.i] * 0.45 * (1 - hgt / 700)), 14, 0, 0, TAU); ctx.fill();
          ctx.restore();
        }
      }
      // 1) Buchstaben hüpfen herein
      for (const l of letters) updateLetter(l, L);
      if (t >= T_BANG && !bang) {
        bang = true; shake = 1;
        for (const l of letters) burst(l.x, L.base - L.F * 0.4, 30, ['#39f0ff', '#ff2ea6', '#ffd23f', '#ffffff'], 900, 400, 1.4, 14);
      }
      if (t < T_OUT) for (const l of letters) drawLetter(l, L, 1, 1);
      // Abflug nach oben
      if (t >= T_OUT && t < T_OUT + 0.6) {
        const k = (t - T_OUT) / 0.5;
        for (const l of letters) {
          const kk = cl(k * 1.3 - l.i * 0.12);
          const y0 = l.y, r0 = l.rot;
          l.y = L.base - kk * kk * 900; l.rot = kk * (l.i - 1) * 0.8;
          drawLetter(l, L, 1 - kk, 1 + kk * 0.6);
          if (kk > 0 && !l.gone) { l.gone = true; burst(l.x, L.base - L.F * 0.4, 26, COLORS[l.i], 700, 100, 1, 10); }
          l.y = y0; l.rot = r0;
        }
      }
      // 2) DESIGNED BY, Unterstrich, Blitze
      if (t >= T_TYPE && t < T_OUT) {
        typed('DESIGNED BY', T_TYPE, SW / 2, L.base - L.F * 1.02, Math.min(56, SW * 0.06), '#39f0ff', 14);
        const uk = cl((t - T_TYPE - 0.4) / 0.35);
        if (uk > 0) {
          const g = ctx.createLinearGradient(SW / 2 - L.total / 2, 0, SW / 2 + L.total / 2, 0);
          g.addColorStop(0, '#39f0ff'); g.addColorStop(0.5, '#ff2ea6'); g.addColorStop(1, '#ffd23f');
          ctx.save(); ctx.fillStyle = g; ctx.shadowColor = '#ff2ea6'; ctx.shadowBlur = 20;
          ctx.fillRect(SW / 2 - (L.total / 2) * uk, L.base + 36, L.total * uk, 8);
          ctx.restore();
        }
        boltT -= dt;
        if (t > T_TYPE + 0.3 && boltT <= 0) { boltT = rnd(0.08, 0.2); makeBolt(L); }
      }
      drawBolts(dt);
      // 3) Logo-Einschlag
      if (t >= T_LOGO) {
        const k = (t - T_LOGO) / (T_HIT - T_LOGO);
        if (t > T_HIT) drawRays(cl((t - T_HIT) * 2));
        const fsl = drawLogo(cl(k));
        if (t >= T_HIT && !hit) { hit = true; shake = 1; burst(SW / 2, logoY(), 60, ['#ffd23f', '#ffffff', '#ff2ea6'], 1100, 200, 1.4, 12); }
        if (t > T_HIT + 0.15) {
          ctx.save();
          ctx.globalAlpha = cl((t - T_HIT - 0.15) * 2.5);
          const fs = Math.min(38, SW * 0.045);
          ctx.font = `800 ${Math.round(fs)}px "Trebuchet MS", sans-serif`;
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          const y = logoY() + fsl * 0.95;
          const label = 'E I N   S P I E L   V O N   ', who = 'E B U';
          const lw = ctx.measureText(label).width, ew = ctx.measureText(who).width;
          let x = SW / 2 - (lw + ew) / 2;
          ctx.fillStyle = '#cfc4ff'; ctx.fillText(label, x, y);
          x += lw;
          ctx.fillStyle = '#39f0ff'; ctx.shadowColor = '#39f0ff'; ctx.shadowBlur = 16;
          [...who].forEach((c, i) => { const b = Math.max(0, Math.sin(t * 8 - i * 0.7)) * 10; ctx.fillText(c, x, y - b); x += ctx.measureText(c).width; });
          ctx.restore();
        }
        if (Math.random() < 0.6 && t > T_HIT) parts.push({ x: rnd(0, SW), y: -10, vx: rnd(-40, 40), vy: rnd(80, 220), life: 2.5, max: 2.5, c: ['#ffd23f', '#ff2ea6', '#39f0ff'][Math.floor(rnd(0, 3))], s: rnd(6, 12), g: 60, rot: rnd(0, 6), vr: rnd(-8, 8) });
      }
      drawParts(dt);
      ring(T_BANG, 1700, '#ff2ea6', 16, SW / 2, L.base - L.F * 0.4);
      ring(T_BANG + 0.08, 1200, '#39f0ff', 10, SW / 2, L.base - L.F * 0.4);
      ring(T_HIT, 1600, '#ffd23f', 18, SW / 2, logoY());
      flash(T_BANG, 0.3, 0.75);
      flash(T_HIT, 0.3, 0.7);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
      // 4) Wisch-Übergang ins Menü
      if (t >= T_WIPE) {
        wrap.style.background = 'transparent';
        const k = cl((t - T_WIPE) / (T_END - T_WIPE));
        const p = (1 - Math.pow(1 - k, 3)) * (W + H * 0.6);
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(p, 0); ctx.lineTo(p - H * 0.6, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.save(); ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 6; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 20;
        ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p - H * 0.6, H); ctx.stroke(); ctx.restore();
      }
      if (t >= T_END) { finish(); return; }
      requestAnimationFrame(frame);
    };
    const finish = () => {
      running = false;
      window.removeEventListener('resize', resize);
      wrap.classList.add('hidden');
      if (done) done();
    };
    requestAnimationFrame(now => { last = now; frame(now); });
  },
};
