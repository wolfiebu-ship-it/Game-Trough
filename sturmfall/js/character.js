'use strict';
/* ============================================================
   Spielfigur: Gelenk-Rig aus Primitiven + prozedurale Animation
   (Idle, Laufen, Sprinten, Rückwärts, Seitwärts, Ducken, Springen,
   Fallschirm, Gleiter, Zielen, Rückstoß, Nachladen, Ernten,
   Heilen, Tanz-Emotes, Umfallen)
   ============================================================ */

const OUTFITS = [
  { name: 'Kobalt-Kommando', skin: 0xf1c27d, top: 0x2e5fd8, bottom: 0x22304a, shoes: 0x16181d, accent: 0xffd23f, hat: 'cap', back: 'pack' },
  { name: 'Glutfuchs', skin: 0xe0ac69, top: 0xe8622c, bottom: 0x3b2a20, shoes: 0x2a1a10, accent: 0xfff3e0, hat: 'ears', back: 'none' },
  { name: 'Neon-Nova', skin: 0x8d5524, top: 0x1b1b2f, bottom: 0x24243e, shoes: 0xff2ea6, accent: 0x39f0ff, hat: 'visor', back: 'pack' },
  { name: 'Waldläufer', skin: 0xffdbac, top: 0x4e7d3a, bottom: 0x5b4a32, shoes: 0x3b2c1c, accent: 0xa0c060, hat: 'hood', back: 'cape' },
  { name: 'Eisbrecherin', skin: 0xf5d0b5, top: 0xdff4ff, bottom: 0x6fa8dc, shoes: 0xffffff, accent: 0x7fd8ff, hat: 'beanie', back: 'pack' },
  { name: 'Kürbiskopf', skin: 0xf28c28, top: 0x3c2a4d, bottom: 0x222222, shoes: 0x111111, accent: 0x6abf40, hat: 'pumpkin', back: 'cape' },
  { name: 'Goldjunge', skin: 0xc68642, top: 0xf5c542, bottom: 0xd4a017, shoes: 0x7a5a00, accent: 0xffffff, hat: 'crown', back: 'none' },
  { name: 'Agentin Nacht', skin: 0xf1c27d, top: 0x15151a, bottom: 0x15151a, shoes: 0x0c0c0c, accent: 0xd62828, hat: 'hair', back: 'none' },
  { name: 'Punk-Panda', skin: 0xf4f4f4, top: 0x2b2b2b, bottom: 0xe74c3c, shoes: 0x2b2b2b, accent: 0x9b59b6, hat: 'mohawk', back: 'pack' },
  { name: 'Weltraum-Wanda', skin: 0xffe0bd, top: 0xf0f0f0, bottom: 0xd0d0d0, shoes: 0x888888, accent: 0xff7b00, hat: 'astro', back: 'pack' },
];

const POSE_KEYS = ['bodyX', 'bodyY', 'bodyRx', 'bodyRz', 'hipsRy', 'torsoRx', 'torsoRy', 'torsoRz', 'headRx', 'headRy',
  'lShX', 'lShZ', 'lElX', 'rShX', 'rShZ', 'rElX', 'lHipX', 'lHipZ', 'lKnee', 'rHipX', 'rHipZ', 'rKnee', 'cape'];

class CharacterRig {
  constructor(outfitIndex) {
    const o = OUTFITS[outfitIndex % OUTFITS.length];
    this.outfit = o;
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.88);
    this.body = new THREE.Group(); this.body.position.y = 1.0; this.root.add(this.body);
    this.hips = new THREE.Group(); this.body.add(this.hips);
    this.torso = new THREE.Group(); this.torso.position.y = 0.06; this.body.add(this.torso);

    const M = c => lambert(c);
    const box = (parent, w, h, d, color, x, y, z) => {
      const m = new THREE.Mesh(boxGeo(w, h, d), M(color)); m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true; parent.add(m); return m;
    };
    // Unterkörper
    box(this.hips, 0.44, 0.22, 0.27, o.bottom, 0, -0.02, 0);
    box(this.hips, 0.46, 0.06, 0.29, o.accent, 0, 0.08, 0); // Gürtel
    // Oberkörper
    box(this.torso, 0.52, 0.58, 0.3, o.top, 0, 0.3, 0);
    box(this.torso, 0.3, 0.2, 0.05, o.accent, 0, 0.36, 0.16); // Brust-Emblem
    this.neck = new THREE.Group(); this.neck.position.y = 0.62; this.torso.add(this.neck);
    box(this.neck, 0.14, 0.1, 0.14, o.skin, 0, 0.03, 0);
    this.head = box(this.neck, 0.34, 0.36, 0.33, o.skin, 0, 0.24, 0);
    // Gesicht
    const eyeColor = o.hat === 'pumpkin' ? 0xffe04a : 0x1a1a1a;
    const eyeMat = o.hat === 'pumpkin' ? new THREE.MeshBasicMaterial({ color: eyeColor }) : M(eyeColor);
    for (const sx of [-1, 1]) {
      const e = new THREE.Mesh(boxGeo(0.06, o.hat === 'pumpkin' ? 0.08 : 0.07, 0.02), eyeMat);
      e.position.set(sx * 0.08, 0.03, 0.17); this.head.add(e);
    }
    const mouth = new THREE.Mesh(boxGeo(o.hat === 'pumpkin' ? 0.18 : 0.1, 0.025, 0.02), eyeMat); mouth.position.set(0, -0.08, 0.17); this.head.add(mouth);
    this.addHat(o, box);
    // Rücken
    if (o.back === 'pack') {
      box(this.torso, 0.38, 0.42, 0.18, o.accent === 0xffffff ? 0x444444 : o.accent, 0, 0.3, -0.24);
      box(this.torso, 0.3, 0.12, 0.2, o.bottom, 0, 0.1, -0.26);
    } else if (o.back === 'cape') {
      this.capePivot = new THREE.Group(); this.capePivot.position.set(0, 0.58, -0.17); this.torso.add(this.capePivot);
      box(this.capePivot, 0.5, 0.95, 0.03, o.accent, 0, -0.47, 0);
    }
    // Arme
    const arm = (side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.33, 0.52, 0); this.torso.add(sh);
      box(sh, 0.16, 0.16, 0.16, o.top, 0, 0, 0);
      box(sh, 0.14, 0.32, 0.14, o.top, 0, -0.17, 0);
      const el = new THREE.Group(); el.position.y = -0.33; sh.add(el);
      box(el, 0.13, 0.3, 0.13, o.skin, 0, -0.15, 0);
      const hand = new THREE.Group(); hand.position.y = -0.32; el.add(hand);
      box(hand, 0.13, 0.12, 0.13, o.hat === 'visor' || o.hat === 'astro' ? o.accent : o.skin, 0, 0, 0);
      return { sh, el, hand };
    };
    const L = arm(1), R = arm(-1);
    this.lSh = L.sh; this.lEl = L.el; this.lHand = L.hand;
    this.rSh = R.sh; this.rEl = R.el; this.rHand = R.hand;
    // Beine
    const leg = (side) => {
      const hp = new THREE.Group(); hp.position.set(side * 0.12, -0.06, 0); this.hips.add(hp);
      box(hp, 0.19, 0.44, 0.21, o.bottom, 0, -0.22, 0);
      const kn = new THREE.Group(); kn.position.y = -0.44; hp.add(kn);
      box(kn, 0.17, 0.4, 0.19, o.bottom, 0, -0.2, 0);
      box(kn, 0.19, 0.1, 0.3, o.shoes, 0, -0.41, 0.05);
      return { hp, kn };
    };
    const LL = leg(1), RL = leg(-1);
    this.lHip = LL.hp; this.lKnee = LL.kn; this.rHip = RL.hp; this.rKnee = RL.kn;

    // Waffenhalter in der rechten Hand
    this.holder = new THREE.Group(); this.rHand.add(this.holder);
    this.heldKey = null;
    // Gleiter (Drachenschirm)
    this.glider = this.makeGlider(o);
    this.glider.visible = false;
    this.root.add(this.glider);

    compactGroup(this.root, [this.glider, this.holder]);
    this.pose = {}; this.target = {};
    for (const k of POSE_KEYS) { this.pose[k] = 0; this.target[k] = 0; }
    this.phase = 0; this.t = Math.random() * 10; this.stepCb = null; this.lastStepSign = 0;
    this.apply();
  }
  addHat(o, box) {
    const h = this.head;
    switch (o.hat) {
      case 'cap':
        box(h, 0.36, 0.12, 0.35, o.top, 0, 0.19, 0);
        box(h, 0.3, 0.03, 0.18, o.accent, 0, 0.14, 0.24);
        break;
      case 'ears':
        for (const sx of [-1, 1]) {
          const e = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), lambert(o.top)); e.position.set(sx * 0.11, 0.27, 0); e.castShadow = true; h.add(e);
          const t = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 4), lambert(o.accent)); t.position.set(0, 0.07, 0); e.add(t);
        }
        box(h, 0.36, 0.1, 0.35, o.top, 0, 0.16, -0.01);
        box(h, 0.12, 0.08, 0.06, 0x222222, 0, -0.02, 0.19);
        break;
      case 'visor':
        box(h, 0.4, 0.42, 0.39, o.top, 0, 0.02, -0.01);
        { const v = new THREE.Mesh(boxGeo(0.36, 0.12, 0.04), new THREE.MeshBasicMaterial({ color: o.accent })); v.position.set(0, 0.04, 0.2); h.add(v); }
        break;
      case 'hood':
        box(h, 0.42, 0.42, 0.2, o.top, 0, 0.03, -0.1);
        box(h, 0.42, 0.1, 0.38, o.top, 0, 0.21, 0);
        break;
      case 'beanie':
        box(h, 0.37, 0.16, 0.36, o.accent, 0, 0.18, 0);
        { const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), lambert(0xffffff)); p.position.set(0, 0.3, 0); h.add(p); }
        break;
      case 'pumpkin':
        box(h, 0.06, 0.1, 0.06, o.accent, 0, 0.23, 0);
        box(h, 0.38, 0.3, 0.37, o.skin, 0, 0, 0);
        break;
      case 'crown':
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; box(h, 0.07, 0.12, 0.07, 0xffd700, Math.cos(a) * 0.15, 0.24, Math.sin(a) * 0.15); }
        box(h, 0.36, 0.05, 0.35, 0xffd700, 0, 0.19, 0);
        break;
      case 'hair':
        box(h, 0.37, 0.14, 0.36, 0x2a1a12, 0, 0.16, -0.01);
        box(h, 0.37, 0.3, 0.1, 0x2a1a12, 0, 0.02, -0.14);
        box(h, 0.1, 0.3, 0.1, 0x2a1a12, 0, -0.1, -0.24);
        box(h, 0.36, 0.05, 0.02, o.accent, 0, 0.1, 0.17);
        break;
      case 'mohawk':
        for (let i = 0; i < 4; i++) box(h, 0.06, 0.16 - i * 0.02, 0.07, o.accent, 0, 0.24, 0.12 - i * 0.09);
        for (const sx of [-1, 1]) box(h, 0.1, 0.1, 0.02, 0x222222, sx * 0.08, 0.03, 0.175);
        break;
      case 'astro':
        { const g = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), new THREE.MeshPhongMaterial({ color: 0x99ddff, transparent: true, opacity: 0.35, shininess: 120 })); g.position.y = 0.02; h.add(g); }
        box(h, 0.46, 0.08, 0.46, o.top, 0, -0.19, 0);
        break;
    }
  }
  makeGlider(o) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.4); shape.lineTo(1.9, -0.6); shape.lineTo(0, -0.2); shape.lineTo(-1.9, -0.6); shape.lineTo(0, 1.4);
    const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshLambertMaterial({ color: o.accent, side: THREE.DoubleSide }));
    wing.rotation.x = -Math.PI / 2 + 0.15; wing.position.y = 2.75; wing.castShadow = true;
    g.add(wing);
    const stripe = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(0, 1.4); s.lineTo(0.5, 0.86); s.lineTo(0, 0.95); s.lineTo(-0.5, 0.86); s.lineTo(0, 1.4); return s; })()), new THREE.MeshBasicMaterial({ color: o.top, side: THREE.DoubleSide }));
    stripe.position.z = 0.01; wing.add(stripe);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), lambert(0x333333));
    bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.2, 0.15); g.add(bar);
    for (const sx of [-1, 1]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), lambert(0x333333));
      s.position.set(sx * 0.5, 2.5, 0.1); s.rotation.z = sx * 0.4; g.add(s);
    }
    return g;
  }
  setHeld(key, mesh) {
    if (this.heldKey === key) return;
    this.heldKey = key;
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    if (mesh) this.holder.add(mesh);
  }
  apply() {
    const p = this.pose;
    this.body.position.x = p.bodyX;
    this.body.position.y = 1.0 + p.bodyY;
    this.body.rotation.set(p.bodyRx, 0, p.bodyRz);
    this.hips.rotation.y = p.hipsRy;
    this.torso.rotation.set(p.torsoRx, p.torsoRy, p.torsoRz);
    this.neck.rotation.set(p.headRx, p.headRy, 0);
    this.lSh.rotation.set(p.lShX, 0, p.lShZ); this.lEl.rotation.x = p.lElX;
    this.rSh.rotation.set(p.rShX, 0, p.rShZ); this.rEl.rotation.x = p.rElX;
    this.lHip.rotation.set(p.lHipX, 0, p.lHipZ); this.lKnee.rotation.x = p.lKnee;
    this.rHip.rotation.set(p.rHipX, 0, p.rHipZ); this.rKnee.rotation.x = p.rKnee;
    if (this.capePivot) this.capePivot.rotation.x = p.cape;
  }
  /* p: siehe Actor.animParams() */
  update(dt, p) {
    const T = this.target;
    for (const k of POSE_KEYS) T[k] = 0;
    this.t += dt;
    const t = this.t;
    let rate = 14;
    const hold = p.hold; // 'gun' | 'pickaxe' | 'none' | 'build' | 'heal' | 'rocket'
    this.glider.visible = p.state === 'glide';

    if (p.state === 'dead') {
      T.bodyRx = -1.45; T.bodyY = -0.78; T.lShZ = 1.2; T.rShZ = -1.2; T.lShX = -0.3; T.rShX = -0.3;
      T.lHipZ = 0.2; T.rHipZ = -0.2; T.lKnee = 0.3; T.headRx = -0.3; T.cape = 0.2;
      rate = 7;
    } else if (p.state === 'power') {
      // Wurzelkraft: Arme hoch, aufladen – dann auf den Boden schlagen
      const t2 = p.powerT || 0;
      if (t2 < 0.5) {
        const k = t2 / 0.5, tr = Math.sin(t * 40) * 0.04 * k;
        T.lShX = -2.9 * k + tr; T.rShX = -2.9 * k - tr; T.lShZ = 0.5 * k; T.rShZ = -0.5 * k; T.lElX = -0.3; T.rElX = -0.3;
        T.bodyY = 0.12 * k; T.torsoRx = -0.25 * k; T.headRx = -0.45 * k; T.lKnee = 0.2; T.rKnee = 0.2; T.cape = 0.6 * k;
      } else if (t2 < 0.85) {
        T.lShX = -0.9; T.rShX = -0.9; T.lShZ = 0.15; T.rShZ = -0.15; T.lElX = -0.2; T.rElX = -0.2;
        T.bodyY = -0.38; T.torsoRx = 0.55; T.headRx = 0.1; T.lHipX = -0.7; T.rHipX = -0.7; T.lKnee = 1.3; T.rKnee = 1.3; T.cape = -0.4;
      }
      rate = 24;
    } else if (p.state === 'ko') {
      // durch die Luft geschleudert: Arme und Beine rudern wild
      const f = Math.sin(t * 19), f2 = Math.cos(t * 16);
      T.lShX = -2.5 + f * 0.7; T.rShX = -2.5 - f * 0.7; T.lShZ = 0.9 + f2 * 0.3; T.rShZ = -0.9 - f2 * 0.3;
      T.lElX = -0.3; T.rElX = -0.3;
      T.lHipX = f2 * 0.9; T.rHipX = -f2 * 0.9; T.lKnee = 0.7 + f * 0.4; T.rKnee = 0.7 - f * 0.4;
      T.lHipZ = 0.25; T.rHipZ = -0.25; T.headRx = -0.5; T.torsoRx = -0.35; T.cape = -1.2;
      rate = 22;
    } else if (p.state === 'skydive') {
      const flutter = Math.sin(t * 22) * 0.05;
      T.bodyRx = p.dive ? 1.5 : 1.25; T.bodyRz = clamp(p.side * 0.03, -0.5, 0.5); T.bodyY = 0.1;
      T.headRx = -0.95;
      T.lShZ = 1.35 + flutter; T.rShZ = -1.35 - flutter; T.lShX = -0.35 - (p.dive ? 0.6 : 0); T.rShX = T.lShX;
      T.lElX = -0.45; T.rElX = -0.45;
      T.lHipZ = 0.32; T.rHipZ = -0.32; T.lKnee = 0.55 + flutter; T.rKnee = 0.55 - flutter;
      T.lHipX = 0.15; T.rHipX = 0.15; T.cape = -1.2 + flutter * 3;
      if (p.dive) { T.lShZ = 0.35; T.rShZ = -0.35; T.lHipZ = 0.05; T.rHipZ = -0.05; T.lKnee = 0.1; T.rKnee = 0.1; }
    } else if (p.state === 'glide') {
      const sw = Math.sin(t * 2.6);
      T.bodyRx = 0.12 + p.fwd * 0.012; T.bodyRz = clamp(p.side * 0.03, -0.4, 0.4);
      T.lShX = -2.9; T.rShX = -2.9; T.lShZ = 0.28; T.rShZ = -0.28; T.lElX = -0.15; T.rElX = -0.15;
      T.lHipX = sw * 0.25; T.rHipX = -sw * 0.25; T.lKnee = 0.35 + sw * 0.1; T.rKnee = 0.35 - sw * 0.1;
      T.headRx = 0.1; T.cape = 0.5 + sw * 0.1;
    } else if (p.state === 'airship') {
      T.lShX = -0.2; T.rShX = -0.2;
    } else if (p.state === 'emote') {
      this.emote(p.emoteT, T);
      rate = 18;
    } else {
      // ----- Boden -----
      const speed = Math.sqrt(p.fwd * p.fwd + p.side * p.side);
      const moving = speed > 0.4 && p.grounded;
      let a = Math.atan2(p.side, p.fwd), dirSign = 1;
      if (Math.abs(a) > Math.PI / 2 + 0.25) { a = a - Math.PI * Math.sign(a); dirSign = -1; }
      if (moving) {
        T.hipsRy = clamp(-a * 0.8, -1.1, 1.1);
        T.torsoRy = -T.hipsRy;
      }
      this.phase += dt * speed * 1.55 * dirSign;
      const amp = clamp(speed / 6, 0, 1) * (p.sprint ? 1.0 : 0.72) * (p.crouch ? 0.45 : 1);
      const ph = this.phase;
      const s = Math.sin(ph), c = Math.cos(ph);
      if (moving) {
        T.lHipX = -s * amp; T.rHipX = s * amp;
        T.lKnee = 0.12 + amp * 1.35 * Math.max(0, c);
        T.rKnee = 0.12 + amp * 1.35 * Math.max(0, -c);
        T.bodyY = Math.abs(c) * 0.06 * amp - 0.04 * amp;
        T.torsoRx = 0.06 * amp + (p.sprint ? 0.22 : 0);
        T.torsoRz = s * 0.04 * amp;
        T.cape = 0.25 + amp * 0.6 + Math.sin(ph * 2) * 0.08;
        // Schritt-Sounds
        const sign = s > 0 ? 1 : -1;
        if (sign !== this.lastStepSign) { this.lastStepSign = sign; if (this.stepCb) this.stepCb(); }
      } else {
        const br = Math.sin(t * 1.8);
        T.torsoRx = br * 0.02; T.bodyY = br * 0.008;
        T.lKnee = 0.05; T.rKnee = 0.05; T.lHipX = -0.03; T.rHipX = 0.02;
        T.lHipZ = 0.05; T.rHipZ = -0.05; T.cape = 0.08 + br * 0.03;
        T.headRy = Math.sin(t * 0.37) * 0.15;
      }
      if (p.crouch) {
        T.bodyY -= 0.4;
        T.lHipX += -1.0; T.rHipX += -1.0; T.lKnee += 1.9; T.rKnee += 1.9;
        T.torsoRx += 0.3; T.headRx -= 0.2;
      }
      if (!p.grounded) {
        const up = p.vy > 0;
        T.lHipX = -0.75; T.lKnee = 1.25; T.rHipX = up ? 0.2 : -0.2; T.rKnee = up ? 0.55 : 0.9;
        T.bodyY = 0; T.cape = p.vy < 0 ? -0.6 : 0.4;
      }
      // Arme
      const pitch = clamp(p.pitch, -1.2, 1.25);
      const armSwing = (m) => {
        T.lShX = s * amp * 0.95 * m; T.rShX = -s * amp * 0.95 * m;
        T.lElX = -0.25 - amp * 0.55; T.rElX = -0.25 - amp * 0.55;
        T.lShZ = 0.08; T.rShZ = -0.08;
        if (!moving) { T.lShX = Math.sin(t * 1.8) * 0.03; T.rShX = -T.lShX; T.lElX = -0.12; T.rElX = -0.12; }
        if (!p.grounded) { T.lShZ = 0.7; T.rShZ = -0.7; T.lShX = -0.5; T.rShX = -0.9; }
      };
      if ((hold === 'gun' || hold === 'rocket') && !(p.sprint && moving)) {
        const aim = p.aim ? 1 : 0;
        T.torsoRx -= pitch * 0.35; T.headRx = -pitch * 0.45;
        const base = -Math.PI / 2 - pitch * 0.68;
        if (hold === 'rocket') {
          T.rShX = -0.3 - pitch * 0.5; T.rShZ = -0.1; T.rElX = -2.2;
          T.lShX = base + 0.45; T.lShZ = -0.35; T.lElX = -0.5;
          T.torsoRy -= 0.15;
        } else {
          T.rShX = base + (aim ? 0 : 0.28) - p.fire * 0.35; T.rShZ = -0.05; T.rElX = (aim ? -0.08 : -0.35);
          T.lShX = base + 0.2 - p.fire * 0.2; T.lShZ = -0.62; T.lElX = -0.55;
          T.torsoRy += aim ? -0.12 : -0.05;
          T.headRy = 0;
        }
        if (p.reload >= 0) {
          const r = Math.sin(p.reload * Math.PI);
          T.lShX = -0.4 - r * 0.5; T.lShZ = -0.2; T.lElX = -1.2 - r * 0.6;
          T.rShX = -1.0; T.rElX = -0.6; T.torsoRx += 0.08; T.headRx = 0.3;
        }
        if (moving) { T.lHipX *= 0.9; T.rHipX *= 0.9; }
      } else if (hold === 'pickaxe' && p.swing >= 0) {
        const sw = p.swing;
        if (sw < 0.35) { const k = sw / 0.35; T.rShX = lerp(-0.6, -2.9, k); T.rElX = lerp(-0.5, -0.7, k); T.torsoRy = lerp(0, 0.35, k); T.torsoRx -= 0.1 * k; }
        else if (sw < 0.6) { const k = (sw - 0.35) / 0.25; T.rShX = lerp(-2.9, -0.55, k); T.rElX = lerp(-0.7, -0.1, k); T.torsoRy = lerp(0.35, -0.3, k); T.torsoRx += 0.25 * k; }
        else { const k = (sw - 0.6) / 0.4; T.rShX = lerp(-0.55, -0.6, k); T.rElX = lerp(-0.1, -0.5, k); T.torsoRy = lerp(-0.3, 0, k); T.torsoRx += 0.25 * (1 - k); }
        T.lShX = -0.5; T.lElX = -0.9; T.lShZ = 0.15;
        rate = 26;
      } else if (hold === 'build' && !(p.sprint && moving)) {
        armSwing(0.4);
        T.rShX = -1.3 - pitch * 0.5; T.rElX = -0.2; T.rShZ = -0.1;
        T.headRx = -pitch * 0.4;
      } else if (hold === 'heal') {
        const w = Math.sin(t * 6) * 0.08;
        T.lShX = -1.7 + w; T.rShX = -1.7 - w; T.lElX = -1.5; T.rElX = -1.5; T.lShZ = -0.2; T.rShZ = 0.2;
        T.headRx = 0.15;
      } else {
        armSwing(1);
        if (hold === 'pickaxe' && !moving) { T.rShX = -0.35; T.rElX = -1.0; }
      }
      T.torsoRx -= p.hurt * 0.25; T.headRx -= p.hurt * 0.3;
    }
    const k = 1 - Math.exp(-rate * dt);
    for (const key of POSE_KEYS) this.pose[key] += (T[key] - this.pose[key]) * k;
    this.apply();
  }
  emote(e, T) {
    const move = Math.floor(e / 2.6) % 3;
    if (move === 0) { // Hüftwackler
      const s = Math.sin(e * 6.5);
      T.bodyX = s * 0.1; T.bodyRz = s * 0.12; T.bodyY = -0.06 - Math.abs(s) * 0.05;
      T.lShX = -2.5 + s * 0.45; T.rShX = -2.5 - s * 0.45; T.lShZ = 0.35; T.rShZ = -0.35; T.lElX = -0.5; T.rElX = -0.5;
      T.lKnee = 0.35 + Math.max(0, s) * 0.35; T.rKnee = 0.35 + Math.max(0, -s) * 0.35; T.lHipX = -0.15; T.rHipX = -0.15;
      T.headRx = 0.1 + Math.abs(s) * 0.1; T.headRy = -s * 0.2; T.torsoRz = -s * 0.1; T.cape = 0.3;
    } else if (move === 1) { // Roboter
      const beat = Math.floor(e * 4) % 4;
      T.lShX = beat % 2 ? -1.57 : -0.2; T.lElX = -1.57; T.rShX = beat % 2 ? -0.2 : -1.57; T.rElX = -1.57;
      T.lShZ = 0.2; T.rShZ = -0.2;
      T.headRy = [0.5, 0, -0.5, 0][beat]; T.torsoRy = [0.2, 0, -0.2, 0][beat];
      T.bodyY = beat % 2 ? -0.05 : 0; T.lKnee = beat % 2 ? 0.25 : 0.05; T.rKnee = beat % 2 ? 0.05 : 0.25;
    } else { // Hampelmann
      const s = (Math.sin(e * 9) + 1) / 2;
      T.bodyY = Math.abs(Math.sin(e * 4.5)) * 0.22;
      T.lShZ = 0.2 + s * 2.6; T.rShZ = -0.2 - s * 2.6; T.lElX = -0.1; T.rElX = -0.1;
      T.lHipZ = 0.05 + s * 0.35; T.rHipZ = -0.05 - s * 0.35; T.lKnee = 0.15; T.rKnee = 0.15;
      T.headRx = -0.1; T.cape = 0.2 + s * 0.4;
    }
  }
}
