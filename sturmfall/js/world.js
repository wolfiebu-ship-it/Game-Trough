'use strict';
/* ============================================================
   Welt: Insel-Terrain, Orte, Häuser, Bäume, Felsen, Truhen,
   Kollisionen (Spatial Hash), Raycasts, Minimap-Bild
   ============================================================ */

const WORLD_SIZE = 560, WORLD_N = 176, ISLAND_R = 215, WATER_Y = 0, CELL = 8;
const MAT_COLORS = { wood: 0xa4713f, stone: 0x9aa0a6, metal: 0x6f7f8e };
const MAT_NAMES = { wood: 'Holz', stone: 'Stein', metal: 'Metall' };

const POI_NAMES = ['Pilzhain', 'Rostige Rinne', 'Neonhafen', 'Windmühlenhof', 'Kristallkrater', 'Alte Sägerei',
  'Sonnenplatz', 'Nebelmoor', 'Kupferkai', 'Blitzbucht', 'Wolkendorf', 'Schrottplatz'];

const _geoCache = new Map();
function boxGeo(w, h, d) {
  const k = w.toFixed(2) + '|' + h.toFixed(2) + '|' + d.toFixed(2);
  let g = _geoCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _geoCache.set(k, g); }
  return g;
}
const _matCache = new Map();
function lambert(color, opts) {
  const k = color + (opts ? JSON.stringify(opts) : '');
  let m = _matCache.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {})); _matCache.set(k, m); }
  return m;
}

/* Mehrere Meshes zu einem Mesh mit Vertex-Farben verschmelzen (spart Draw-Calls).
   items: [{ geo, matrix, color }] */
function mergeToGeometry(items) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const it of items) {
    const P = it.geo.attributes.position, N = it.geo.attributes.normal, n = P.count;
    nm.getNormalMatrix(it.matrix);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(it.matrix);
      pos[(vo + i) * 3] = v.x; pos[(vo + i) * 3 + 1] = v.y; pos[(vo + i) * 3 + 2] = v.z;
      if (N) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor[(vo + i) * 3] = v.x; nor[(vo + i) * 3 + 1] = v.y; nor[(vo + i) * 3 + 2] = v.z; }
      col[(vo + i) * 3] = it.color.r; col[(vo + i) * 3 + 1] = it.color.g; col[(vo + i) * 3 + 2] = it.color.b;
    }
    if (it.geo.index) { const I = it.geo.index.array; for (let k = 0; k < I.length; k++) idx[io++] = I[k] + vo; }
    else for (let k = 0; k < n; k++) idx[io++] = vo + k;
    vo += n;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere(); g.computeBoundingBox();
  return g;
}
const VCOLOR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
function mergeable(m) { return m.isMesh && !m.isInstancedMesh && m.material && !Array.isArray(m.material) && m.material.isMeshLambertMaterial && !m.material.transparent && !m.material.map && !m.material.vertexColors; }
/* Direkte Mesh-Kinder jeder Gruppe (ohne eigene Kinder) zusammenfassen – für Figuren/Waffen */
function compactGroup(root, skip) {
  const groups = [];
  root.traverse(o => { if (!o.isMesh && o.children.length && !(skip && skip.includes(o))) groups.push(o); });
  for (const grp of groups) {
    const ms = grp.children.filter(c => mergeable(c) && c.children.length === 0);
    if (ms.length < 2) continue;
    const items = ms.map(m => { m.updateMatrix(); return { geo: m.geometry, matrix: m.matrix.clone(), color: m.material.color }; });
    const mesh = new THREE.Mesh(mergeToGeometry(items), VCOLOR_MAT);
    mesh.castShadow = ms.some(m => m.castShadow);
    for (const m of ms) grp.remove(m);
    grp.add(mesh);
  }
}

class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.noise = makeNoise(seed);
    this.group = new THREE.Group(); scene.add(this.group);
    this.cells = new Map();
    this.stamp = 1;
    this.structures = [];
    this.interactables = [];
    this.lootSpots = [];
    this.pois = [];
    this.houses = [];
    this.wobbling = [];
    this.nextId = 1;
    this.time = 0;
    this.onStructureDestroyed = null;
    this.tmpArr = [];
    this.batches = new Map(); this.batching = true; this.dirtyBatches = new Set();

    this.placePOIs();
    this.genHeights();
    this.buildTerrain();
    this.buildWaterAndSky();
    this.buildPOIs();
    this.scatterNature();
    this.scatterExtras();
    this.batching = false;
    for (const b of this.batches.values()) this.rebuildBatch(b);
    this.buildMinimap();
  }

  /* ---------------- Terrain ---------------- */
  baseHeight(x, z) {
    const n = this.noise;
    const d = Math.sqrt(x * x + z * z) / ISLAND_R + n.fbm(x * 0.012 + 5, z * 0.012 - 3, 3) * 0.2;
    const island = smoothstep(1.0, 0.74, d);
    const hills = n.fbm(x * 0.0065 + 11, z * 0.0065 + 7, 5) * 0.5 + 0.5;
    const mountain = Math.pow(clamp(hills, 0, 1), 2.2) * 44;
    const detail = n.fbm(x * 0.045, z * 0.045, 3) * 1.4;
    return (2.6 + mountain + detail) * island - 8 * (1 - island);
  }
  placePOIs() {
    const rng = this.rng;
    const names = POI_NAMES.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    const types = ['town', 'town', 'farm', 'industrial', 'town', 'industrial', 'farm', 'town'];
    let tries = 0;
    while (this.pois.length < 8 && tries++ < 800) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 150;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.baseHeight(x, z);
      if (h < 2.5 || h > 26) continue;
      if (this.pois.some(p => dist2(p.x, p.z, x, z) < 72)) continue;
      const type = types[this.pois.length];
      const radius = type === 'town' ? 26 : type === 'industrial' ? 24 : 20;
      this.pois.push({ name: names[this.pois.length], x, z, h: Math.max(3, h), r: radius, type });
    }
  }
  genHeights() {
    const N = WORLD_N, S = WORLD_SIZE, c = S / N;
    this.hN = N; this.hCell = c;
    this.heights = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = -S / 2 + i * c, z = -S / 2 + j * c;
      let h = this.baseHeight(x, z);
      for (const p of this.pois) {
        const w = smoothstep(p.r + 16, p.r, dist2(p.x, p.z, x, z));
        if (w > 0) h = lerp(h, p.h, w);
      }
      this.heights[j * (N + 1) + i] = h;
    }
  }
  heightAt(x, z) {
    const N = this.hN, c = this.hCell;
    const fx = (x + WORLD_SIZE / 2) / c, fz = (z + WORLD_SIZE / 2) / c;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= N || j >= N) return -8;
    const u = fx - i, v = fz - j, H = this.heights, W = N + 1;
    const h00 = H[j * W + i], h10 = H[j * W + i + 1], h01 = H[(j + 1) * W + i], h11 = H[(j + 1) * W + i + 1];
    if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
    return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  }
  slopeAt(x, z) {
    const e = 1.5;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z), dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.sqrt(dx * dx + dz * dz) / (2 * e);
  }
  terrainColor(x, z, h, slope, out) {
    const n = this.noise.noise(x * 0.08, z * 0.08) * 0.5 + 0.5;
    const n2 = this.noise.fbm(x * 0.015 + 40, z * 0.015, 2) * 0.5 + 0.5;
    let r, g, b;
    if (h < 0.4) { r = 0.78; g = 0.72; b = 0.5; }
    else if (h < 1.8) { r = 0.9; g = 0.83; b = 0.58; }
    else if (h > 30 || slope > 1.05) { const s = 0.46 + n * 0.1; r = s; g = s * 0.98; b = s * 0.95; if (h > 38) { r = g = b = 0.93; } }
    else {
      r = lerp(0.3, 0.42, n2) + n * 0.03; g = lerp(0.58, 0.66, n); b = lerp(0.24, 0.3, n2);
      if (n2 > 0.75) { r += 0.08; g -= 0.03; b -= 0.02; } // trockene Wiese
      if (slope > 0.7) { const t = (slope - 0.7) / 0.35; r = lerp(r, 0.5, t); g = lerp(g, 0.48, t); b = lerp(b, 0.42, t); }
    }
    for (const p of this.pois) {
      const d = dist2(p.x, p.z, x, z);
      if (d < p.r - 2) {
        const pave = p.type === 'farm' ? [0.62, 0.5, 0.33] : p.type === 'industrial' ? [0.45, 0.45, 0.47] : [0.66, 0.63, 0.58];
        const w = smoothstep(p.r - 2, p.r - 6, d) * (0.85 + n * 0.15);
        r = lerp(r, pave[0], w); g = lerp(g, pave[1], w); b = lerp(b, pave[2], w);
      }
    }
    out[0] = r; out[1] = g; out[2] = b;
  }
  buildTerrain() {
    const N = this.hN, c = this.hCell, W = N + 1, S = WORLD_SIZE;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3);
    const tmp = [0, 0, 0];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * W + i, x = -S / 2 + i * c, z = -S / 2 + j * c, h = this.heights[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      this.terrainColor(x, z, h, this.slopeAt(x, z), tmp);
      col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2];
    }
    const idx = new Uint32Array(N * N * 6); let p = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = (j + 1) * W + i, cc = j * W + i + 1, d = (j + 1) * W + i + 1;
      idx[p++] = a; idx[p++] = b; idx[p++] = cc;
      idx[p++] = cc; idx[p++] = b; idx[p++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.group.add(this.terrain);
  }
  buildWaterAndSky() {
    const wgeo = new THREE.PlaneGeometry(4000, 4000, 1, 1); wgeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wgeo, new THREE.MeshPhongMaterial({ color: 0x2f8fd0, transparent: true, opacity: 0.82, shininess: 90, specular: 0x99ccff }));
    this.water.position.y = WATER_Y - 0.25;
    this.water.receiveShadow = true;
    this.group.add(this.water);
    // Himmel
    const sgeo = new THREE.SphereGeometry(1800, 24, 16);
    const smat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x3a7fd9) }, mid: { value: new THREE.Color(0x9fd3f5) }, bot: { value: new THREE.Color(0xe6f3ff) }, tint: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 tint; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bot, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c*tint,1.0); }',
    });
    this.sky = new THREE.Mesh(sgeo, smat);
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);
    // Sonne
    const sun = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 12), new THREE.MeshBasicMaterial({ color: 0xfff4c8, fog: false }));
    sun.position.set(700, 900, 500);
    this.sky.add(sun);
    // Wolken
    this.clouds = [];
    const cmat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x8a96a8, flatShading: true, transparent: true, opacity: 0.9, fog: false });
    const cgeo = new THREE.IcosahedronGeometry(1, 1);
    for (let i = 0; i < 30; i++) {
      const g = new THREE.Group();
      const n = 3 + Math.floor(this.rng() * 4);
      for (let k = 0; k < n; k++) {
        const m = new THREE.Mesh(cgeo, cmat);
        const s = rr(this.rng, 6, 13);
        m.scale.set(s * 1.4, s * 0.6, s);
        m.position.set(k * 9 - n * 4.5 + rr(this.rng, -3, 3), rr(this.rng, -2, 2), rr(this.rng, -4, 4));
        g.add(m);
      }
      g.position.set(rr(this.rng, -450, 450), rr(this.rng, 200, 250), rr(this.rng, -450, 450));
      this.clouds.push(g); this.group.add(g);
    }
  }

  /* ---------------- Kollisionen ---------------- */
  cellKey(cx, cz) { return (cx + 2048) * 4096 + (cz + 2048); }
  addCollider(c) {
    const x0 = Math.floor(c.min.x / CELL), x1 = Math.floor(c.max.x / CELL);
    const z0 = Math.floor(c.min.z / CELL), z1 = Math.floor(c.max.z / CELL);
    c.stamp = 0;
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const k = this.cellKey(cx, cz);
      let a = this.cells.get(k);
      if (!a) { a = []; this.cells.set(k, a); }
      a.push(c);
    }
    return c;
  }
  removeCollider(c) {
    const x0 = Math.floor(c.min.x / CELL), x1 = Math.floor(c.max.x / CELL);
    const z0 = Math.floor(c.min.z / CELL), z1 = Math.floor(c.max.z / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const a = this.cells.get(this.cellKey(cx, cz));
      if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); }
    }
  }
  query(minx, minz, maxx, maxz) {
    const out = this.tmpArr; out.length = 0;
    const s = ++this.stamp;
    const x0 = Math.floor(minx / CELL), x1 = Math.floor(maxx / CELL);
    const z0 = Math.floor(minz / CELL), z1 = Math.floor(maxz / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const a = this.cells.get(this.cellKey(cx, cz));
      if (!a) continue;
      for (let i = 0; i < a.length; i++) { const c = a[i]; if (c.stamp !== s) { c.stamp = s; out.push(c); } }
    }
    return out;
  }
  rampY(c, x, z) {
    let t;
    switch (c.ramp) {
      case 1: t = (x - c.min.x) / (c.max.x - c.min.x); break;
      case 2: t = (z - c.min.z) / (c.max.z - c.min.z); break;
      case 3: t = (c.max.x - x) / (c.max.x - c.min.x); break;
      default: t = (c.max.z - z) / (c.max.z - c.min.z); break;
    }
    return c.min.y + clamp(t, 0, 1) * (c.max.y - c.min.y);
  }
  /* Bodenhöhe unter einem Punkt (Terrain, Kisten, Böden, Rampen) */
  groundAt(x, z, footY, step, out) {
    let g = this.heightAt(x, z), s = null;
    if (g < -1.3) g = -1.3; // Wasser trägt (schwimmen)
    const m = 0.28;
    const list = this.query(x - m, z - m, x + m, z + m);
    for (let i = 0; i < list.length; i++) {
      const c = list[i];
      if (x < c.min.x - m || x > c.max.x + m || z < c.min.z - m || z > c.max.z + m) continue;
      let top;
      if (c.ramp) {
        if (x < c.min.x - 0.05 || x > c.max.x + 0.05 || z < c.min.z - 0.05 || z > c.max.z + 0.05) continue;
        top = this.rampY(c, x, z);
      } else top = c.max.y;
      if (top <= footY + step && top > g) { g = top; s = c; }
    }
    if (out) out.col = s;
    return g;
  }
  /* Kreis gegen Boxen in XZ auflösen. pos wird verändert. */
  collideActor(pos, r, h, step, vel) {
    let hitWall = false;
    for (let iter = 0; iter < 2; iter++) {
      const list = this.query(pos.x - r, pos.z - r, pos.x + r, pos.z + r);
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.ramp || c.noBlock) continue;
        if (pos.y + step >= c.max.y || pos.y + h - 0.1 <= c.min.y) continue;
        const cx = clamp(pos.x, c.min.x, c.max.x), cz = clamp(pos.z, c.min.z, c.max.z);
        let dx = pos.x - cx, dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        hitWall = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = r - d;
          dx /= d; dz /= d;
          pos.x += dx * push; pos.z += dz * push;
          if (vel) { const vn = vel.x * dx + vel.z * dz; if (vn < 0) { vel.x -= vn * dx; vel.z -= vn * dz; } }
        } else {
          const l = pos.x - c.min.x, rr_ = c.max.x - pos.x, b = pos.z - c.min.z, f = c.max.z - pos.z;
          const mn = Math.min(l, rr_, b, f);
          if (mn === l) pos.x = c.min.x - r; else if (mn === rr_) pos.x = c.max.x + r;
          else if (mn === b) pos.z = c.min.z - r; else pos.z = c.max.z + r;
        }
      }
    }
    return hitWall;
  }
  ceilingAt(x, z, r, fromY, toY) {
    const list = this.query(x - r, z - r, x + r, z + r);
    let best = Infinity;
    const m = r * 0.6;
    for (const c of list) {
      if (c.noBlock) continue;
      if (x < c.min.x - m || x > c.max.x + m || z < c.min.z - m || z > c.max.z + m) continue;
      let bottom = c.min.y;
      if (c.ramp) bottom = this.rampY(c, x, z) - 0.3;
      if (bottom >= fromY - 0.05 && bottom < toY && bottom < best) best = bottom;
    }
    return best;
  }

  /* ---------------- Raycast ---------------- */
  raycast(o, d, maxT, opts) {
    opts = opts || {};
    let best = { t: maxT, hit: false, col: null, struct: null, n: null };
    // Kandidaten entlang des Strahls einsammeln
    const s = ++this.stamp;
    const cand = [];
    const stepLen = CELL * 0.5;
    const steps = Math.ceil(maxT / stepLen) + 1;
    let lastKey = null;
    for (let i = 0; i <= steps; i++) {
      const t = Math.min(i * stepLen, maxT);
      const px = o.x + d.x * t, pz = o.z + d.z * t;
      const cx0 = Math.floor((px - 1) / CELL), cx1 = Math.floor((px + 1) / CELL);
      const cz0 = Math.floor((pz - 1) / CELL), cz1 = Math.floor((pz + 1) / CELL);
      for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
        const k = this.cellKey(cx, cz);
        if (k === lastKey) continue;
        const a = this.cells.get(k);
        if (!a) continue;
        for (const c of a) if (c.stamp !== s) { c.stamp = s; cand.push(c); }
      }
    }
    for (const c of cand) {
      if (opts.ignore && c.struct === opts.ignore) continue;
      if (c.noShoot && !opts.includeAll) continue;
      if (c.ramp) {
        const k = (c.max.y - c.min.y) / ((c.ramp === 1 || c.ramp === 3) ? (c.max.x - c.min.x) : (c.max.z - c.min.z));
        const ax = c.ramp === 1 ? 1 : c.ramp === 3 ? -1 : 0, az = c.ramp === 2 ? 1 : c.ramp === 4 ? -1 : 0;
        const f0 = o.y - this.rampY(c, o.x, o.z);
        const den = d.y - k * (d.x * ax + d.z * az);
        if (Math.abs(den) < 1e-6) continue;
        const t = -f0 / den;
        if (t <= 0 || t >= best.t) continue;
        const px = o.x + d.x * t, pz = o.z + d.z * t;
        if (px < c.min.x || px > c.max.x || pz < c.min.z || pz > c.max.z) continue;
        const nl = Math.sqrt(k * k + 1);
        best = { t, hit: true, col: c, struct: c.struct, n: { x: -k * ax / nl, y: 1 / nl, z: -k * az / nl } };
      } else {
        const r = rayBox(o, d, c.min, c.max, best.t);
        if (r && r.t < best.t && r.t > 0) best = { t: r.t, hit: true, col: c, struct: c.struct, n: r.n };
      }
    }
    // Terrain
    const tstep = opts.coarse ? 3 : 1.2;
    let prevT = 0, prevD = o.y - this.heightAt(o.x, o.z);
    if (prevD > 0) {
      for (let t = tstep; t < best.t + tstep; t += tstep) {
        const tt = Math.min(t, best.t);
        const px = o.x + d.x * tt, py = o.y + d.y * tt, pz = o.z + d.z * tt;
        const dd = py - this.heightAt(px, pz);
        if (dd < 0) {
          let a = prevT, b = tt;
          for (let k = 0; k < 8; k++) { const m = (a + b) / 2; const y = o.y + d.y * m - this.heightAt(o.x + d.x * m, o.z + d.z * m); if (y > 0) a = m; else b = m; }
          if (b < best.t) best = { t: b, hit: true, col: null, struct: null, n: { x: 0, y: 1, z: 0 }, terrain: true };
          break;
        }
        prevT = tt; prevD = dd;
        if (tt >= best.t) break;
      }
    }
    best.point = new THREE.Vector3(o.x + d.x * best.t, o.y + d.y * best.t, o.z + d.z * best.t);
    return best;
  }
  lineOfSight(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (L < 0.01) return true;
    const d = { x: dx / L, y: dy / L, z: dz / L };
    const r = this.raycast(a, d, L, { coarse: true });
    return !r.hit;
  }

  /* ---------------- Strukturen ---------------- */
  addStructure(s) {
    s.id = this.nextId++;
    s.alive = true;
    s.maxHp = s.maxHp || s.hp;
    s.colliders = s.colliders || [];
    for (const c of s.colliders) { c.struct = s; this.addCollider(c); }
    if (s.mesh) {
      s.mesh.userData.struct = s;
      if (this.batching && !s.interact && s.kind !== 'build') {
        const B = 48, key = Math.floor(s.mesh.position.x / B) + ':' + Math.floor(s.mesh.position.z / B);
        let b = this.batches.get(key);
        if (!b) { b = { parts: [], mesh: null }; this.batches.set(key, b); }
        b.parts.push(s); s.batch = b;
      } else this.group.add(s.mesh);
    }
    this.structures.push(s);
    if (s.interact) this.interactables.push(s);
    return s;
  }
  boxCollider(cx, y0, cz, w, h, d, extra) {
    return Object.assign({ min: { x: cx - w / 2, y: y0, z: cz - d / 2 }, max: { x: cx + w / 2, y: y0 + h, z: cz + d / 2 }, ramp: 0 }, extra || {});
  }
  /* einfache Box-Struktur (Wandsegment, Kiste, Container...) */
  addBox(cx, y0, cz, w, h, d, color, mat, hp, extra) {
    const mesh = new THREE.Mesh(boxGeo(w, h, d), lambert(color));
    mesh.position.set(cx, y0 + h / 2, cz);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return this.addStructure(Object.assign({
      kind: 'box', mat, hp, mesh, center: mesh.position.clone(),
      colliders: [this.boxCollider(cx, y0, cz, w, h, d)],
    }, extra || {}));
  }
  damageStructure(s, amount, by, harvest) {
    if (!s || !s.alive || s.indestructible) return 0;
    s.hp -= amount;
    s.shake = 0.25;
    if (this.wobbling.indexOf(s) < 0) this.wobbling.push(s);
    if (s.hp <= 0) { this.destroyStructure(s, by); return amount; }
    if (s.onDamage) s.onDamage(s);
    return amount;
  }
  destroyStructure(s, by) {
    if (!s.alive) return;
    s.alive = false;
    for (const c of s.colliders) this.removeCollider(c);
    if (s.batch) this.dirtyBatches.add(s.batch);
    else if (s.mesh) { this.group.remove(s.mesh); }
    if (s.inst) for (const it of s.inst) { const m = new THREE.Matrix4().makeScale(0, 0, 0); it.mesh.setMatrixAt(it.index, m); it.mesh.instanceMatrix.needsUpdate = true; }
    const i = this.interactables.indexOf(s); if (i >= 0) this.interactables.splice(i, 1);
    if (this.onStructureDestroyed) this.onStructureDestroyed(s, by);
  }

  rebuildBatch(b) {
    const items = [], extra = [];
    for (const s of b.parts) {
      if (!s.alive) continue;
      s.mesh.updateMatrixWorld(true);
      s.mesh.traverse(o => {
        if (!o.isMesh) return;
        if (mergeable(o)) items.push({ geo: o.geometry, matrix: o.matrixWorld.clone(), color: o.material.color });
      });
    }
    if (b.mesh) { this.group.remove(b.mesh); b.mesh.geometry.dispose(); b.mesh = null; }
    if (!items.length) return;
    b.mesh = new THREE.Mesh(mergeToGeometry(items), VCOLOR_MAT);
    b.mesh.castShadow = true; b.mesh.receiveShadow = true;
    this.group.add(b.mesh);
  }

  /* ---------------- Orte & Häuser ---------------- */
  buildPOIs() {
    for (const p of this.pois) {
      const rng = this.rng;
      if (p.type === 'town') {
        const n = ri(rng, 4, 6);
        for (let i = 0; i < n; i++) {
          const a = i / n * TAU + rr(rng, -0.25, 0.25), r = rr(rng, 11, p.r - 8);
          const x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r;
          const w = ri(rng, 4, 6) * 2, d = ri(rng, 4, 5) * 2;
          const doorSide = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 3 : 1) : (Math.sin(a) > 0 ? 2 : 4);
          this.buildHouse(x, z, w, d, rng() < 0.6 ? 2 : 1, doorSide, rng() < 0.3 ? 'stone' : 'wood');
        }
        for (let i = 0; i < 3; i++) this.buildCar(p.x + rr(rng, -8, 8), p.z + rr(rng, -8, 8), rng() < 0.5);
        this.addChestAt(p.x + rr(rng, -3, 3), p.z + rr(rng, -3, 3), p.h);
      } else if (p.type === 'farm') {
        this.buildHouse(p.x - 6, p.z, 14, 10, 1, 1, 'barn');
        this.buildHouse(p.x + 10, p.z + 8, 8, 8, 2, 4, 'wood');
        // Silo
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 11, 14), lambert(0xc9ccd1));
        silo.position.set(p.x + 10, p.h + 5.5, p.z - 9); silo.castShadow = true;
        this.addStructure({ kind: 'silo', mat: 'metal', hp: 900, mesh: silo, center: silo.position.clone(), colliders: [this.boxCollider(p.x + 10, p.h - 1, p.z - 9, 4.4, 12, 4.4)] });
        for (let i = 0; i < 7; i++) { // Heuballen
          const x = p.x + rr(rng, -16, 16), z = p.z + rr(rng, -16, 16);
          if (dist2(x, z, p.x - 6, p.z) < 10 || dist2(x, z, p.x + 10, p.z + 8) < 7) continue;
          this.addBox(x, this.heightAt(x, z) - 0.1, z, 2, 1.4, 1.4, 0xe3c565, 'wood', 120, { kind: 'hay' });
        }
        // Zaun
        for (let i = 0; i < 26; i++) {
          const a = i / 26 * TAU; const x = p.x + Math.cos(a) * (p.r + 2), z = p.z + Math.sin(a) * (p.r + 2);
          if (i % 7 === 0) continue;
          const h = this.heightAt(x, z);
          const post = this.addBox(x, h - 0.2, z, 0.3, 1.3, 0.3, 0x8a5a33, 'wood', 40, { kind: 'fence', yieldMul: 0.5 });
        }
        this.addChestAt(p.x + 3, p.z + 12, p.h);
      } else if (p.type === 'industrial') {
        this.buildHouse(p.x, p.z - 4, 16, 12, 1, 2, 'warehouse');
        const colors = [0xc0392b, 0x2e86c1, 0x27ae60, 0xd68910, 0x7d3c98];
        for (let i = 0; i < 6; i++) {
          const x = p.x + rr(rng, -18, 18), z = p.z + rr(rng, 6, 18) * (rng() < 0.5 ? 1 : -1);
          if (Math.abs(x - p.x) < 10 && Math.abs(z - (p.z - 4)) < 9) continue;
          const along = rng() < 0.5;
          const h = this.heightAt(x, z);
          this.addBox(x, h - 0.3, z, along ? 7 : 2.6, 2.9, along ? 2.6 : 7, pick(rng, colors), 'metal', 600, { kind: 'container' });
          if (rng() < 0.35) this.addBox(x, h + 2.6, z, along ? 7 : 2.6, 2.9, along ? 2.6 : 7, pick(rng, colors), 'metal', 600, { kind: 'container' });
        }
        for (let i = 0; i < 10; i++) {
          const x = p.x + rr(rng, -20, 20), z = p.z + rr(rng, -20, 20);
          if (Math.abs(x - p.x) < 9.5 && Math.abs(z - (p.z - 4)) < 7.5) continue;
          this.buildBarrel(x, z);
        }
        this.addChestAt(p.x + rr(rng, -14, 14), p.z + 14, p.h);
      }
    }
    // Einzelne Häuser verstreut
    let placed = 0, tries = 0;
    while (placed < 9 && tries++ < 300) {
      const a = this.rng() * TAU, r = Math.sqrt(this.rng()) * 175;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.pois.some(p => dist2(p.x, p.z, x, z) < p.r + 22)) continue;
      if (this.houses.some(h => dist2(h.x, h.z, x, z) < 30)) continue;
      const h = this.heightAt(x, z);
      if (h < 2 || this.slopeAt(x, z) > 0.35) continue;
      this.buildHouse(x, z, 8, 8, this.rng() < 0.5 ? 2 : 1, ri(this.rng, 1, 4), this.rng() < 0.5 ? 'stone' : 'wood', true);
      placed++;
    }
  }
  buildHouse(cx, cz, w, d, floors, doorSide, style, flattenCheck) {
    const rng = this.rng;
    // Grundhöhe: niedrigster Punkt unter der Grundfläche -> Fundament
    let base = Infinity, top = -Infinity;
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
      const h = this.heightAt(cx + i * w / 2, cz + k * d / 2);
      base = Math.min(base, h); top = Math.max(top, h);
    }
    const y0 = base + Math.min(0.3, top - base) ;
    const FH = style === 'warehouse' ? 6 : style === 'barn' ? 5.2 : 3.6;
    const T = 0.3;
    const palette = {
      wood: [0xe8d6b0, 0xc96f4a, 0x7fa7c9, 0xe7e2d8, 0x9bb37a, 0xd9a441, 0xb784a7],
      stone: [0xb9b2a8, 0xa39a8e, 0xc7c0b5],
      barn: [0xa8322d], warehouse: [0x8d99a6],
    }[style];
    const wallColor = pick(rng, palette);
    const mat = style === 'stone' ? 'stone' : style === 'warehouse' ? 'metal' : 'wood';
    const hp = mat === 'stone' ? 380 : mat === 'metal' ? 500 : 250;
    const roofColor = pick(rng, [0x7b3f2e, 0x4a4a52, 0x3e5c76, 0x6d4c41]);
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const house = { x: cx, z: cz, w, d, y0, floors, FH };
    this.houses.push(house);
    // Fundament (unzerstörbar)
    const fundH = y0 - base + 0.8;
    const fund = new THREE.Mesh(boxGeo(w + 0.4, fundH, d + 0.4), lambert(0x8f8a82));
    fund.position.set(cx, y0 - fundH / 2, cz); fund.receiveShadow = true;
    this.addStructure({ kind: 'floor', mat: 'stone', hp: 1, indestructible: true, mesh: fund, colliders: [this.boxCollider(cx, y0 - fundH, cz, w + 0.4, fundH, d + 0.4)] });
    const winMat = lambert(0x35597d);
    const addWall = (ax, az, bx, bz, fy, hasDoor, hasWindow) => {
      // Wand von (ax,az) nach (bx,bz), achsenparallel
      const alongX = Math.abs(bx - ax) > Math.abs(bz - az);
      const L = alongX ? Math.abs(bx - ax) : Math.abs(bz - az);
      const s0 = alongX ? Math.min(ax, bx) : Math.min(az, bz);
      const fixed = alongX ? az : ax;
      const segs = [];
      if (hasDoor) {
        const dc = s0 + L / 2 + rr(rng, -L / 4, L / 4), dw = style === 'warehouse' ? 4 : style === 'barn' ? 3.2 : 1.6, dh = style === 'warehouse' ? 4 : style === 'barn' ? 3.6 : 2.6;
        segs.push([s0, dc - dw / 2, 0, FH]);
        segs.push([dc + dw / 2, s0 + L, 0, FH]);
        segs.push([dc - dw / 2, dc + dw / 2, dh, FH]);
      } else {
        // in 2 Stücke teilen, damit Zerstörung kleinteiliger ist
        const mid = s0 + L / 2;
        segs.push([s0, mid, 0, FH]); segs.push([mid, s0 + L, 0, FH]);
      }
      for (const [a, b, ya, yb] of segs) {
        const len = b - a; if (len < 0.2) continue;
        const h = yb - ya, c = (a + b) / 2;
        const sx = alongX ? c : fixed, sz = alongX ? fixed : c;
        const s = this.addBox(sx, fy + ya, sz, alongX ? len : T, h, alongX ? T : len, wallColor, mat, hp, { kind: 'wall' });
        if (hasWindow && !hasDoor && ya === 0 && len > 2 && style !== 'warehouse') {
          const win = new THREE.Mesh(boxGeo(alongX ? 1.2 : T + 0.06, 1.1, alongX ? T + 0.06 : 1.2), winMat);
          win.position.set(0, 0.35 - (h / 2 - 1.45) + 0.2, 0);
          s.mesh.add(win);
        }
      }
    };
    for (let f = 0; f < floors; f++) {
      const fy = y0 + f * FH;
      addWall(x0, z0, x1, z0, fy, doorSide === 2 && f === 0, true);          // -z Seite
      addWall(x0, z1, x1, z1, fy, doorSide === 4 && f === 0, true);          // +z Seite
      addWall(x0, z0 + T / 2, x0, z1 - T / 2, fy, doorSide === 3 && f === 0, true);  // -x
      addWall(x1, z0 + T / 2, x1, z1 - T / 2, fy, doorSide === 1 && f === 0, true);  // +x
      // Boden-Platte (Innen)
      if (f > 0) {
        const stairLen = FH, sw = 1.5;
        const fy2 = fy;
        const floorColor = 0xb08a5a;
        // Loch für Treppe an der -x/-z Ecke
        const holeX1 = x0 + T + stairLen;
        const holeZ1 = z0 + T + sw;
        const f1 = new THREE.Mesh(boxGeo(x1 - holeX1 - T / 2, 0.3, holeZ1 - z0 - T / 2), lambert(floorColor));
        f1.position.set((holeX1 + x1 - T / 2) / 2, fy2 - 0.15, (z0 + T / 2 + holeZ1) / 2); f1.receiveShadow = true; f1.castShadow = true;
        this.addStructure({ kind: 'floor', mat: 'wood', hp: 1, indestructible: true, mesh: f1, colliders: [this.boxCollider(f1.position.x, fy2 - 0.3, f1.position.z, x1 - holeX1 - T / 2, 0.3, holeZ1 - z0 - T / 2)] });
        const f2 = new THREE.Mesh(boxGeo(w - T, 0.3, z1 - holeZ1 - T / 2), lambert(floorColor));
        f2.position.set(cx, fy2 - 0.15, (holeZ1 + z1 - T / 2) / 2); f2.receiveShadow = true; f2.castShadow = true;
        this.addStructure({ kind: 'floor', mat: 'wood', hp: 1, indestructible: true, mesh: f2, colliders: [this.boxCollider(cx, fy2 - 0.3, f2.position.z, w - T, 0.3, z1 - holeZ1 - T / 2)] });
        // Treppe (Rampe steigt Richtung +x)
        const sy = fy - FH;
        const rampLen = Math.sqrt(stairLen * stairLen + FH * FH);
        const stair = new THREE.Mesh(boxGeo(rampLen, 0.25, sw - 0.1), lambert(0x8c6239));
        stair.position.set(x0 + T + stairLen / 2, sy + FH / 2, z0 + T + sw / 2);
        stair.rotation.z = Math.atan2(FH, stairLen); stair.castShadow = true;
        this.addStructure({ kind: 'stairs', mat: 'wood', hp: 1, indestructible: true, mesh: stair, colliders: [{ min: { x: x0 + T, y: sy, z: z0 + T }, max: { x: holeX1, y: fy, z: holeZ1 }, ramp: 1 }] });
      }
      // Truhen & Beute
      const fx = rr(rng, x0 + 1.4, x1 - 1.4), fz = rr(rng, z0 + 2.4, z1 - 1.4);
      if (rng() < 0.75) this.addChest(fx, fy, fz, rng() * TAU);
      else if (rng() < 0.6) this.addAmmoBox(fx, fy, fz);
      for (let k = 0; k < 2; k++) this.lootSpots.push({ x: rr(rng, x0 + 1.2, x1 - 1.2), y: fy + 0.05, z: rr(rng, z0 + 2.2, z1 - 1.2) });
    }
    // Dach
    const ry = y0 + floors * FH;
    const roof = new THREE.Mesh(boxGeo(w + 0.6, 0.35, d + 0.6), lambert(roofColor));
    roof.position.set(cx, ry + 0.175, cz); roof.castShadow = true; roof.receiveShadow = true;
    this.addStructure({ kind: 'roof', mat, hp: hp * 2, mesh: roof, center: roof.position.clone(), colliders: [this.boxCollider(cx, ry, cz, w + 0.6, 0.35, d + 0.6)] });
    if (style === 'barn' || style === 'wood') {
      // Satteldach-Optik (nur Deko, geht mit dem Dach kaputt)
      const th = 0.45, hd = (d + 0.8) / 2, L = hd / Math.cos(th) + 0.1, rise = hd * Math.tan(th);
      for (const sgn of [1, -1]) {
        const panel = new THREE.Mesh(boxGeo(w + 0.8, 0.22, L), lambert(roofColor));
        panel.position.set(0, 0.2 + rise / 2, sgn * hd / 2); panel.rotation.x = sgn * th; panel.castShadow = true;
        roof.add(panel);
      }
      const tri = new THREE.Shape(); tri.moveTo(-hd + 0.4, 0); tri.lineTo(hd - 0.4, 0); tri.lineTo(0, rise - 0.1); tri.lineTo(-hd + 0.4, 0);
      const tg = new THREE.ExtrudeGeometry(tri, { depth: 0.2, bevelEnabled: false });
      for (const sgn of [1, -1]) {
        const gable = new THREE.Mesh(tg, lambert(wallColor));
        gable.rotation.y = Math.PI / 2; gable.position.set(sgn * (w / 2 - 0.1) - 0.1, 0.17, 0);
        roof.add(gable);
      }
    } else {
      const chim = new THREE.Mesh(boxGeo(0.8, 1.4, 0.8), lambert(0x6d5e57));
      chim.position.set(w / 2 - 1.2, 0.8, d / 2 - 1.2); chim.castShadow = true; roof.add(chim);
    }
    return house;
  }
  buildCar(x, z, truck) {
    const h = this.heightAt(x, z);
    const color = pick(this.rng, [0xd64541, 0x3498db, 0xf1c40f, 0x2ecc71, 0xecf0f1, 0x34495e]);
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(truck ? 2.2 : 1.9, 0.9, truck ? 5 : 4), lambert(color)); body.position.y = 0.75; g.add(body);
    const cab = new THREE.Mesh(boxGeo(truck ? 2.1 : 1.7, 0.8, truck ? 1.8 : 2.2), lambert(0x9fc6e8)); cab.position.set(0, 1.55, truck ? 1.4 : -0.2); g.add(cab);
    if (truck) { const bed = new THREE.Mesh(boxGeo(2.2, 0.6, 3), lambert(0x555555)); bed.position.set(0, 1.4, -0.9); g.add(bed); }
    const wg = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    for (const [wx, wz] of [[-1, 1.3], [1, 1.3], [-1, -1.3], [1, -1.3]]) { const wm = new THREE.Mesh(wg, lambert(0x222222)); wm.rotation.z = Math.PI / 2; wm.position.set(wx * (truck ? 1.1 : 0.95), 0.38, wz * (truck ? 1.25 : 1)); g.add(wm); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    const rot = this.rng() < 0.5;
    if (rot) g.rotation.y = Math.PI / 2;
    g.position.set(x, h, z);
    const W = truck ? 2.2 : 1.9, L = truck ? 5 : 4;
    this.addStructure({ kind: 'car', mat: 'metal', hp: 450, mesh: g, center: new THREE.Vector3(x, h + 1, z), colliders: [this.boxCollider(x, h, z, rot ? L : W, 1.9, rot ? W : L)] });
  }
  buildBarrel(x, z) {
    const h = this.heightAt(x, z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.2, 10), lambert(pick(this.rng, [0x2f6f9f, 0xb03a2e, 0x6e7b30])));
    m.position.set(x, h + 0.6, z); m.castShadow = true;
    this.addStructure({ kind: 'barrel', mat: 'metal', hp: 120, mesh: m, center: m.position.clone(), colliders: [this.boxCollider(x, h, z, 0.9, 1.2, 0.9)] });
  }
  addChestAt(x, z, y) { this.addChest(x, Math.max(y, this.heightAt(x, z)), z, this.rng() * TAU); }
  addChest(x, y, z, rot) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(1.0, 0.5, 0.62), lambert(0xb07a2a, { emissive: 0x3a2400 }));
    body.position.y = 0.25; g.add(body);
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.31); g.add(lidPivot);
    const lid = new THREE.Mesh(boxGeo(1.02, 0.22, 0.64), lambert(0xf2c14e, { emissive: 0x7a5200 }));
    lid.position.set(0, 0.11, 0.32); lidPivot.add(lid);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.18, depthWrite: false }));
    glow.position.y = 0.35; g.add(glow);
    g.traverse(o => { if (o.isMesh && o !== glow) o.castShadow = true; });
    g.position.set(x, y, z); g.rotation.y = rot;
    return this.addStructure({
      kind: 'chest', mat: 'wood', hp: 150, mesh: g, center: new THREE.Vector3(x, y + 0.4, z), lid: lidPivot, glow, opened: false,
      colliders: [this.boxCollider(x, y, z, 0.9, 0.55, 0.9, { noBlock: true })],
      interact: 'Truhe öffnen', pos: new THREE.Vector3(x, y + 0.4, z),
    });
  }
  addAmmoBox(x, y, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(boxGeo(0.9, 0.45, 0.55), lambert(0x4f6b35));
    body.position.y = 0.225; g.add(body);
    const stripe = new THREE.Mesh(boxGeo(0.92, 0.08, 0.57), lambert(0xe0c341)); stripe.position.y = 0.3; g.add(stripe);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.position.set(x, y, z); g.rotation.y = this.rng() * TAU;
    return this.addStructure({
      kind: 'ammobox', mat: 'wood', hp: 80, mesh: g, center: new THREE.Vector3(x, y + 0.3, z), opened: false,
      colliders: [this.boxCollider(x, y, z, 0.8, 0.45, 0.8, { noBlock: true })],
      interact: 'Munitionskiste öffnen', pos: new THREE.Vector3(x, y + 0.3, z),
    });
  }

  /* ---------------- Natur (instanziert für Performance) ---------------- */
  scatterNature() {
    const rng = this.rng;
    const MAXT = 360, MAXR = 170, MAXB = 260;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 7); trunkGeo.translate(0, 0.5, 0);
    const pineGeo = new THREE.ConeGeometry(1, 1, 7); pineGeo.translate(0, 0.5, 0);
    const roundGeo = new THREE.IcosahedronGeometry(1, 0);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const bushGeo = new THREE.IcosahedronGeometry(1, 0);
    const mk = (geo, color, n) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }), n);
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m); return m;
    };
    this.iTrunk = mk(trunkGeo, 0x7a5230, MAXT);
    this.iPine = mk(pineGeo, 0x2f7d45, MAXT * 2);
    this.iRound = mk(roundGeo, 0x4f9a3c, MAXT);
    this.iRock = mk(rockGeo, 0x8d9096, MAXR);
    this.iBush = mk(bushGeo, 0x3f8f3a, MAXB);
    this.iBush.castShadow = false;
    const col = new THREE.Color();
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(), P = new THREE.Vector3(), E = new THREE.Euler();
    const addInst = (mesh, x, y, z, sx, sy, sz, ry, rx, color) => {
      const i = mesh.count++;
      E.set(rx || 0, ry || 0, 0); Q.setFromEuler(E); S.set(sx, sy, sz); P.set(x, y, z);
      M.compose(P, Q, S); mesh.setMatrixAt(i, M);
      if (color) mesh.setColorAt(i, col.setHex(color));
      return { mesh, index: i, base: M.clone() };
    };
    const free = (x, z, r) => {
      if (this.pois.some(p => dist2(p.x, p.z, x, z) < p.r + r)) return false;
      if (this.houses.some(h => Math.abs(h.x - x) < h.w / 2 + r + 1 && Math.abs(h.z - z) < h.d / 2 + r + 1)) return false;
      return true;
    };
    let tries = 0, trees = 0;
    while (trees < MAXT && tries++ < 6000) {
      const x = rr(rng, -ISLAND_R, ISLAND_R), z = rr(rng, -ISLAND_R, ISLAND_R);
      const h = this.heightAt(x, z);
      if (h < 2.2 || h > 34 || this.slopeAt(x, z) > 0.8) continue;
      // Wälder: Rauschen bestimmt Dichte
      const dens = this.noise.fbm(x * 0.02 + 90, z * 0.02 - 30, 3) * 0.5 + 0.5;
      if (rng() > dens * 1.4 - 0.25) continue;
      if (!free(x, z, 2)) continue;
      const pine = h > 14 || rng() < 0.45;
      const s = rr(rng, 0.85, 1.35);
      const trunkH = (pine ? 2.2 : 2.8) * s;
      const inst = [addInst(this.iTrunk, x, h - 0.2, z, s, trunkH + 0.2, s, rng() * TAU)];
      const leafColor = pine ? pick(rng, [0x2f7d45, 0x2a6e3e, 0x37894c]) : pick(rng, [0x4f9a3c, 0x5fae45, 0x6ba83a, 0xc98a2b]);
      if (pine) {
        inst.push(addInst(this.iPine, x, h + trunkH * 0.55, z, 2.2 * s, 3.6 * s, 2.2 * s, rng() * TAU, 0, leafColor));
        inst.push(addInst(this.iPine, x, h + trunkH * 0.55 + 2.2 * s, z, 1.6 * s, 3 * s, 1.6 * s, rng() * TAU, 0, leafColor));
      } else {
        inst.push(addInst(this.iRound, x, h + trunkH + 1.2 * s, z, 2.3 * s, 2.0 * s, 2.3 * s, rng() * TAU, rng(), leafColor));
      }
      const top = pine ? h + trunkH * 0.55 + 5.2 * s : h + trunkH + 3.2 * s;
      this.addStructure({ kind: 'tree', mat: 'wood', hp: 220 * s, inst, center: new THREE.Vector3(x, h + 1.2, z), colliders: [this.boxCollider(x, h - 0.5, z, 0.7 * s, top - h + 0.5, 0.7 * s)] });
      trees++;
    }
    let rocks = 0; tries = 0;
    while (rocks < MAXR && tries++ < 3000) {
      const x = rr(rng, -ISLAND_R, ISLAND_R), z = rr(rng, -ISLAND_R, ISLAND_R);
      const h = this.heightAt(x, z);
      if (h < 1.5) continue;
      if (!free(x, z, 3)) continue;
      const s = rr(rng, 0.8, 2.6);
      const sy = s * rr(rng, 0.55, 0.9);
      const inst = [addInst(this.iRock, x, h + sy * 0.25, z, s * 1.2, sy, s, rng() * TAU, rng() * 0.3, pick(rng, [0x8d9096, 0x9a9690, 0x7f858c, 0xa3a39c]))];
      this.addStructure({ kind: 'rock', mat: 'stone', hp: 180 * s, inst, center: new THREE.Vector3(x, h + sy * 0.5, z), colliders: [this.boxCollider(x, h - 0.5, z, s * 1.6, sy * 1.1 + 0.5, s * 1.4)] });
      rocks++;
    }
    let bushes = 0; tries = 0;
    while (bushes < MAXB && tries++ < 3000) {
      const x = rr(rng, -ISLAND_R, ISLAND_R), z = rr(rng, -ISLAND_R, ISLAND_R);
      const h = this.heightAt(x, z);
      if (h < 2 || h > 30) continue;
      if (!free(x, z, 1)) continue;
      const s = rr(rng, 0.7, 1.3);
      addInst(this.iBush, x, h + 0.3 * s, z, s * 1.2, s * 0.9, s * 1.2, rng() * TAU, 0, pick(rng, [0x3f8f3a, 0x4a9a3f, 0x357a33]));
      bushes++;
    }
    for (const m of [this.iTrunk, this.iPine, this.iRound, this.iRock, this.iBush]) {
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  scatterExtras() {
    const rng = this.rng;
    // Truhen in der Wildnis
    let n = 0, tries = 0;
    while (n < 14 && tries++ < 400) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 185;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.heightAt(x, z);
      if (h < 2 || this.slopeAt(x, z) > 0.4) continue;
      this.addChest(x, h, z, rng() * TAU); n++;
    }
    // Freie Beutepunkte
    for (let i = 0; i < 50; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 185;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = this.heightAt(x, z);
      if (h < 1.5) continue;
      this.lootSpots.push({ x, y: h + 0.05, z });
    }
    for (const p of this.pois) for (let i = 0; i < 6; i++) {
      const x = p.x + rr(rng, -p.r, p.r), z = p.z + rr(rng, -p.r, p.r);
      const g = this.groundAt(x, z, 100, 0);
      this.lootSpots.push({ x, y: g + 0.05, z });
    }
  }

  randomLandPoint(rng, cx, cz, r) {
    for (let i = 0; i < 200; i++) {
      const a = rng() * TAU, d = Math.sqrt(rng()) * r;
      const x = (cx || 0) + Math.cos(a) * d, z = (cz || 0) + Math.sin(a) * d;
      if (this.heightAt(x, z) > 2) return { x, z };
    }
    return { x: cx || 0, z: cz || 0 };
  }

  /* ---------------- Minimap-Bild ---------------- */
  buildMinimap() {
    const S = 512;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(S, S);
    const tmp = [0, 0, 0];
    const scale = WORLD_SIZE / S;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = -WORLD_SIZE / 2 + (i + 0.5) * scale, z = -WORLD_SIZE / 2 + (j + 0.5) * scale;
      const h = this.heightAt(x, z);
      let r, g, b;
      if (h < -0.2) { const dd = clamp(-h / 8, 0, 1); r = lerp(70, 30, dd); g = lerp(160, 100, dd); b = lerp(215, 170, dd); }
      else {
        this.terrainColor(x, z, h, this.slopeAt(x, z), tmp);
        const shade = 0.8 + clamp((this.heightAt(x - 2, z - 2) - h) * -0.08, -0.25, 0.25);
        r = tmp[0] * 255 * shade; g = tmp[1] * 255 * shade; b = tmp[2] * 255 * shade;
      }
      const k = (j * S + i) * 4;
      img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const toPx = v => (v + WORLD_SIZE / 2) / scale;
    ctx.fillStyle = 'rgba(60,50,45,0.85)';
    for (const h of this.houses) ctx.fillRect(toPx(h.x - h.w / 2), toPx(h.z - h.d / 2), h.w / scale, h.d / scale);
    // Baumpunkte
    ctx.fillStyle = 'rgba(30,80,40,0.55)';
    for (const s of this.structures) if (s.kind === 'tree') { ctx.beginPath(); ctx.arc(toPx(s.center.x), toPx(s.center.z), 1.6, 0, TAU); ctx.fill(); }
    this.minimapCanvas = cv;
    this.minimapScale = scale;
  }

  update(dt, camPos) {
    this.time += dt;
    if (this.dirtyBatches.size) { for (const b of this.dirtyBatches) this.rebuildBatch(b); this.dirtyBatches.clear(); }
    for (const c of this.clouds) { c.position.x += dt * 1.6; if (c.position.x > 450) c.position.x = -450; }
    this.sky.position.copy(camPos);
    this.water.position.x = camPos.x; this.water.position.z = camPos.z;
    // Wackeln getroffener Objekte
    for (let i = this.wobbling.length - 1; i >= 0; i--) {
      const s = this.wobbling[i];
      s.shake -= dt;
      const a = s.shake > 0 ? Math.sin(s.shake * 60) * s.shake * 0.25 : 0;
      if (s.mesh && s.alive) { s.mesh.rotation.z = a * 0.3; if (!s.baseScale) s.baseScale = s.mesh.scale.x; }
      if (s.inst && s.alive) {
        for (const it of s.inst) {
          const m = it.base.clone();
          m.elements[12] += a * 0.6; m.elements[14] += a * 0.3;
          it.mesh.setMatrixAt(it.index, m); it.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      if (s.shake <= 0 || !s.alive) this.wobbling.splice(i, 1);
    }
    // Truhen glitzern
    const pulse = 0.14 + Math.sin(this.time * 4) * 0.06;
    for (const s of this.interactables) if (s.kind === 'chest' && !s.opened) s.glow.material.opacity = pulse;
  }
}
