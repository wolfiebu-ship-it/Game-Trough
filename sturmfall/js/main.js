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
  Touch.init();
  lobby = new Lobby();
  UI.init();
  window.addEventListener('resize', () => {
    applyPixelRatio();
    lobby.resize(window.innerWidth, window.innerHeight);
    if (window.game) window.game.resize(window.innerWidth, window.innerHeight);
  });
  Input.onLockChange = (locked, withoutLock) => {
    const g = window.game;
    document.getElementById('clicklock').classList.add('hidden');
    if (!g) return;
    if (locked) {
      UI.hideAll(); g.paused = false; g.menuOpen = false; Input.enabled = true;
      if (withoutLock && !Input.touch && !g.freeHintShown) { g.freeHintShown = true; g.hud.toast('Maus wird ohne Sperre benutzt – zum Drehen an den Rand fahren oder ins Bild klicken', 4); }
    }
    else if (!g.endShown || g.spectateMode) {
      if (g.endShown && g.spectateMode) { g.spectateMode = false; UI.showEnd(g.endInfo(g.state === 'won')); return; }
      pauseGame();
    }
  };
  Input.onEscape = () => {
    const g = window.game; if (!g) return;
    if (g.endShown) { if (g.spectateMode) { g.spectateMode = false; Input.unlock(); UI.showEnd(g.endInfo(g.state === 'won')); } return; }
    if (!g.paused) pauseGame();
  };
  cv.addEventListener('click', () => {
    const g = window.game;
    if (g && !Input.locked && !Input.touch && !g.paused && (!g.endShown || g.spectateMode)) Input.lock();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && window.game && !window.game.net && !window.game.paused && !window.game.endShown) pauseGame(); });
  // Online-Ereignisse
  Net.onStart = msg => { UI.hideAll(); startMatch({ role: 'client', start: msg }); };
  Net.onBack = () => { if (window.game) { window.game.dispose(); window.game = null; } Input.unlock(); Input.enabled = false; UI.show('lobby'); };
  Net.onHostLost = () => {
    const g = window.game; if (!g || !g.isClient) return;
    g.hud.banner('Verbindung zum Host verloren', '#ff8a8a');
    setTimeout(() => { if (window.game === g) { g.dispose(); window.game = null; Input.unlock(); Input.enabled = false; UI.show('online'); } }, 2500);
  };
  // erste Nutzerinteraktion schaltet Audio frei
  const unlock = () => { SFX.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
  document.getElementById('loading').classList.add('hidden');
  Intro.run();
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
    last = now;
    const g = window.game;
    document.body.classList.toggle('playing', !!(g && !g.paused && Input.active && !UI.screen));
    if (g) { g.update(dt); g.render(); }
    else { lobby.update(dt); renderer.render(lobby.scene, lobby.camera); }
    Input.endFrame();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // Debug-/Testzugang
  window.SF = { startMatch, quitToMenu, get game() { return window.game; } };
}

function startMatch(net) {
  if (window.game) { window.game.dispose(); window.game = null; }
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  UI.hideAll();
  const ld = document.getElementById('loading');
  ld.querySelector('p').textContent = 'Insel wird erzeugt …';
  ld.classList.remove('hidden');
  setTimeout(() => {
    try {
      window.game = new Game(renderer, MatchSetup, {
        onEnd: info => { Input.unlock(); window.game.paused = false; window.game.menuOpen = false; UI.showEnd(info); },
        onUpdateEnd: info => { if (UI.screen === 'end') UI.showEnd(info); },
      }, net);
      if (net && net.role === 'host') window.game.netSendStart();
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
/* Online: Host startet das Match für alle in der Lobby */
function startOnlineMatch() {
  const L = Net.lobby; if (!L || !L.isHost) return;
  startMatch({ role: 'host', members: L.members.map(m => ({ code: m.code, name: m.name, outfit: m.outfit })) });
}
function backToLobby() {
  const g = window.game;
  if (g) { g.dispose(); window.game = null; }
  Input.unlock(); Input.enabled = false;
  if (Net.lobby && Net.lobby.isHost) { Net.lobby.inGame = false; Net.broadcast({ t: 'back' }); Net.broadcastLobby(); }
  if (Net.lobby) UI.show('lobby'); else UI.show('online');
}
function pauseGame() {
  const g = window.game; if (!g) return;
  if (g.net) { g.menuOpen = true; } else g.paused = true;
  Input.enabled = false;
  Input.free = false; Input.tFire = false; Input.axis.on = false; Input.vheld.clear(); Touch.reset();
  if (document.pointerLockElement) document.exitPointerLock();
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
  const g = window.game;
  if (g && g.isHost && Net.lobby) { backToLobby(); return; }
  if (g) { g.dispose(); window.game = null; }
  if (g && g.isClient && Net.lobby) { Input.unlock(); Input.enabled = false; UI.show('lobby'); return; }
  Input.unlock(); Input.enabled = false;
  document.getElementById('clicklock').classList.add('hidden');
  UI.show('menu');
}

window.addEventListener('DOMContentLoaded', boot);
