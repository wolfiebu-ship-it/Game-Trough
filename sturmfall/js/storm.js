'use strict';
/* ============================================================
   Der Sturm: schrumpfende sichere Zone in mehreren Phasen
   ============================================================ */

const STORM_PHASES = [
  // wait: Zeit bis Schrumpfen, shrink: Dauer, radius: Ziel, dmg: Schaden/Sek
  { wait: 70, shrink: 45, radius: 150, dmg: 1 },
  { wait: 50, shrink: 40, radius: 95, dmg: 2 },
  { wait: 40, shrink: 35, radius: 60, dmg: 4 },
  { wait: 35, shrink: 30, radius: 34, dmg: 6 },
  { wait: 30, shrink: 25, radius: 16, dmg: 8 },
  { wait: 25, shrink: 25, radius: 6, dmg: 10 },
  { wait: 20, shrink: 30, radius: 0, dmg: 12 },
];
const STORM_SPEED = { langsam: 1.4, normal: 1.0, schnell: 0.6, turbo: 0.35 };

class Storm {
  constructor(game, rng, speedKey) {
    this.game = game; this.world = game.world; this.rng = rng;
    this.mul = STORM_SPEED[speedKey] || 1;
    this.cx = 0; this.cz = 0; this.r = 420; this.dmg = 1;
    this.phase = -1; this.state = 'idle'; this.timer = 0;
    this.from = null; this.to = null;
    this.nextX = 0; this.nextZ = 0; this.nextR = 420;
    const geo = new THREE.CylinderGeometry(1, 1, 400, 128, 1, true);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { time: { value: 0 }, color: { value: new THREE.Color(0x9b4dff) } },
      vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float time; uniform vec3 color; varying vec2 vUv; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        void main(){
          float a = vUv.x * 160.0;
          float s = n(vec2(a + time*0.8, vW.y*0.05 - time*0.6)) * 0.6 + n(vec2(a*2.3 - time, vW.y*0.12 + time*0.4)) * 0.4;
          float bolt = step(0.985, n(vec2(a*0.7, time*3.0)));
          float d = distance(cameraPosition.xz, vW.xz);
          float alpha = (0.32 + s * 0.28) * mix(0.18, 1.0, smoothstep(260.0, 70.0, d));
          vec3 c = color * (0.75 + s * 0.6) + bolt * vec3(0.6,0.5,1.0);
          gl_FragColor = vec4(c, alpha);
        }`,
    });
    this.wall = new THREE.Mesh(geo, this.mat);
    this.wall.position.y = 100; this.wall.renderOrder = 3;
    this.wall.frustumCulled = false;
    game.scene.add(this.wall);
    this.apply();
  }
  start() {
    this.phase = 0; this.state = 'wait';
    this.timer = STORM_PHASES[0].wait * this.mul;
    this.pickNext();
  }
  pickNext() {
    const ph = STORM_PHASES[this.phase];
    const nr = ph.radius;
    const maxOff = Math.max(0, this.r - nr) * (this.phase === 0 ? 0.35 : 0.8);
    for (let i = 0; i < 40; i++) {
      const a = this.rng() * TAU, d = Math.sqrt(this.rng()) * maxOff;
      const x = this.cx + Math.cos(a) * d, z = this.cz + Math.sin(a) * d;
      if (this.world.heightAt(x, z) > 2 || i === 39) { this.nextX = x; this.nextZ = z; break; }
    }
    if (this.phase === 0) { const len = Math.hypot(this.nextX, this.nextZ); if (len > 60) { this.nextX *= 60 / len; this.nextZ *= 60 / len; } }
    this.nextR = nr;
    this.dmg = this.phase > 0 ? STORM_PHASES[this.phase - 1].dmg : 1;
  }
  update(dt) {
    this.mat.uniforms.time.value += dt;
    if (this.remote) { this.apply(); return; } // online: Werte kommen vom Host
    if (this.state === 'idle' || this.state === 'done') { this.apply(); return; }
    this.timer -= dt;
    const ph = STORM_PHASES[this.phase];
    if (this.state === 'wait') {
      if (this.timer <= 0) {
        this.state = 'shrink'; this.timer = ph.shrink * this.mul;
        this.from = { x: this.cx, z: this.cz, r: this.r };
        this.dmg = ph.dmg;
        if (this.onShrink) this.onShrink(this.phase);
      }
    } else if (this.state === 'shrink') {
      const k = 1 - Math.max(0, this.timer) / (ph.shrink * this.mul);
      this.cx = lerp(this.from.x, this.nextX, k); this.cz = lerp(this.from.z, this.nextZ, k); this.r = lerp(this.from.r, this.nextR, k);
      if (this.timer <= 0) {
        this.phase++;
        if (this.phase >= STORM_PHASES.length) { this.state = 'done'; this.phase = STORM_PHASES.length - 1; }
        else { this.state = 'wait'; this.timer = STORM_PHASES[this.phase].wait * this.mul; this.pickNext(); this.dmg = ph.dmg; if (this.onWait) this.onWait(this.phase); }
      }
    }
    this.apply();
  }
  apply() {
    const r = Math.max(0.5, this.r);
    this.wall.scale.set(r, 1, r);
    this.wall.position.set(this.cx, 100, this.cz);
  }
  inside(x, z) { return dist2(x, z, this.cx, this.cz) <= this.r; }
  distOutside(x, z) { return dist2(x, z, this.cx, this.cz) - this.r; }
  label() {
    if (this.state === 'wait') return { text: 'Sturm zieht zusammen in', time: this.timer, shrinking: false };
    if (this.state === 'shrink') return { text: 'Sturm schrumpft!', time: this.timer, shrinking: true };
    if (this.state === 'done') return { text: 'Letzte Zone', time: 0, shrinking: false };
    return { text: 'Sturm formt sich', time: 0, shrinking: false };
  }
  dispose() { this.game.scene.remove(this.wall); }
}
