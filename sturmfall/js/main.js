'use strict';
/* ============================================================
   Start: Renderer, Hauptschleife, Match starten/pausieren/beenden
   ============================================================ */

let renderer, lobby;
window.game = null;

function applyPixelRatio() {
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1) * Settings.renderScale);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}
function applySettingsLive() {
  SFX.applyVolumes();
  applyPixelRatio();
  const g = window.game;
  if (g) { g.applyShadowQuality(); g.hud.applySettings(); g.hud.refreshSlots(); }
}

function boot() {
  const cv = document.getElementById('view');
  if (typeof THREE === 'undefined') { document.getElementById('fatal').classList.remove('hidden'); return; }
  try {
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.getElementById('fatal').classList.remove('hidden');
    document.getElementById('fatal').querySelector('p').textContent = 'Dein Browser unterstützt kein WebGL. Bitte aktiviere Hardwarebeschleunigung oder nutze einen aktuellen Browser.';
    return;
  }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  applyPixelRatio();
  Input.init(cv);
  lobby = new Lobby();
  UI.init();
  window.addEventListener('resize', () => {
    applyPixelRatio();
    lobby.resize(window.innerWidth, window.innerHeight);
    if (window.game) window.game.resize(window.innerWidth, window.innerHeight);
  });
  Input.onLockChange = locked => {
    const g = window.game;
    document.getElementById('clicklock').classList.add('hidden');
    if (!g) return;
    if (locked) { UI.hideAll(); g.paused = false; }
    else if (!g.endShown || g.spectateMode) {
      if (g.endShown && g.spectateMode) { g.spectateMode = false; UI.showEnd(g.endInfo(g.state === 'won')); return; }
      pauseGame();
    }
  };
  Input.onLockFail = () => { if (window.game && !window.game.endShown) document.getElementById('clicklock').classList.remove('hidden'); };
  cv.addEventListener('click', () => {
    const g = window.game;
    if (g && !Input.locked && !g.paused && (!g.endShown || g.spectateMode)) Input.lock();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && window.game && !window.game.paused && !window.game.endShown) pauseGame(); });
  // erste Nutzerinteraktion schaltet Audio frei
  const unlock = () => { SFX.init(); if (!window.game) SFX.playMusic('menu'); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  document.getElementById('loading').classList.add('hidden');
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
    last = now;
    const g = window.game;
    if (g) { g.update(dt); g.render(); }
    else { lobby.update(dt); renderer.render(lobby.scene, lobby.camera); }
    Input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // Debug-/Testzugang
  window.SF = { startMatch, quitToMenu, get game() { return window.game; } };
}

function startMatch() {
  if (window.game) { window.game.dispose(); window.game = null; }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.hideAll();
  const ld = document.getElementById('loading');
  ld.querySelector('p').textContent = 'Insel wird erzeugt …';
  ld.classList.remove('hidden');
  setTimeout(() => {
    try {
      window.game = new Game(renderer, MatchSetup, {
        onEnd: info => { Input.unlock(); window.game.paused = false; UI.showEnd(info); },
      });
    } catch (e) {
      console.error(e);
      ld.querySelector('p').textContent = 'Fehler beim Erzeugen: ' + e.message;
      return;
    }
    ld.classList.add('hidden');
    document.body.classList.remove('in-menu');
    Input.enabled = true;
    Input.lock();
  }, 30);
}
function pauseGame() {
  const g = window.game; if (!g) return;
  g.paused = true;
  Input.enabled = false;
  UI.show('pause');
}
function resumeGame() {
  const g = window.game; if (!g) return;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.hideAll();
  Input.enabled = true;
  Input.lock();
}
function quitToMenu() {
  if (window.game) { window.game.dispose(); window.game = null; }
  Input.unlock(); Input.enabled = false;
  document.getElementById('clicklock').classList.add('hidden');
  SFX.playMusic('menu');
  UI.show('menu');
}

window.addEventListener('DOMContentLoaded', boot);
