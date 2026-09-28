'use strict';
/* ============================================================
   Einstellungen, Tastenbelegung, Statistik (werden gespeichert)
   ============================================================ */

const ACTIONS = [
  ['forward', 'Vorwärts'], ['back', 'Rückwärts'], ['left', 'Links'], ['right', 'Rechts'],
  ['jump', 'Springen / Abspringen'], ['sprint', 'Sprinten'], ['crouch', 'Ducken'],
  ['interact', 'Aufheben / Öffnen'], ['reload', 'Nachladen'],
  ['build', 'Baumodus an/aus'], ['material', 'Baumaterial wechseln'], ['rotate', 'Bauteil drehen'],
  ['pickaxe', 'Erntehammer'], ['slot1', 'Slot 1'], ['slot2', 'Slot 2'], ['slot3', 'Slot 3'], ['slot4', 'Slot 4'], ['slot5', 'Slot 5'],
  ['wall', 'Bauen: Wand'], ['floor', 'Bauen: Boden'], ['ramp', 'Bauen: Rampe'], ['roof', 'Bauen: Dach'],
  ['emote', 'Tanzen (Emote)'], ['map', 'Karte'], ['drop', 'Gegenstand fallen lassen'],
];

const DEFAULT_KEYS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  jump: 'Space', sprint: 'ShiftLeft', crouch: 'KeyC',
  interact: 'KeyE', reload: 'KeyR',
  build: 'KeyQ', material: 'KeyG', rotate: 'KeyT',
  pickaxe: 'Digit1', slot1: 'Digit2', slot2: 'Digit3', slot3: 'Digit4', slot4: 'Digit5', slot5: 'Digit6',
  wall: 'KeyZ', floor: 'KeyX', ramp: 'KeyV', roof: 'KeyF',
  emote: 'KeyB', map: 'KeyM', drop: 'KeyH',
};

const DEFAULT_SETTINGS = {
  // Steuerung
  sens: 1.0, adsSens: 0.75, scopeSens: 0.45, invertY: false,
  toggleSprint: false, toggleCrouch: true, autoGlider: true, autoPickup: true,
  // Grafik
  quality: 'hoch', shadows: true, renderScale: 1.0, viewDist: 520, fov: 80,
  showFps: false, cameraShake: true, particles: true, showIntro: true,
  // Audio
  master: 0.8, sfx: 0.9, music: 0.45,
  // HUD
  crosshairColor: '#ffffff', crosshairSize: 1.0, damageNumbers: true, minimap: true,
  minimapZoom: 1.0, hudScale: 1.0,
  // Kamera
  shoulder: 'rechts', camDist: 4.2,
  // Profil
  playerName: 'Spieler', outfit: 0,
  keys: Object.assign({}, DEFAULT_KEYS),
};

const DEFAULT_MATCH = {
  bots: 24, difficulty: 'normal', seed: '', stormSpeed: 'normal', start: 'luftschiff', loot: 'normal', buildMats: 'normal',
};

const QUALITY_PRESETS = {
  niedrig: { shadows: false, renderScale: 0.7, viewDist: 320, particles: false },
  mittel: { shadows: true, renderScale: 0.85, viewDist: 420, particles: true },
  hoch: { shadows: true, renderScale: 1.0, viewDist: 520, particles: true },
  ultra: { shadows: true, renderScale: 1.25, viewDist: 700, particles: true },
};

function loadSettings() {
  const s = Object.assign({}, DEFAULT_SETTINGS, Store.get('settings', {}));
  s.keys = Object.assign({}, DEFAULT_KEYS, (Store.get('settings', {}) || {}).keys || {});
  return s;
}
const Settings = loadSettings();
function saveSettings() { Store.set('settings', Settings); }
function resetSettings() {
  const name = Settings.playerName, outfit = Settings.outfit;
  Object.assign(Settings, JSON.parse(JSON.stringify(DEFAULT_SETTINGS)));
  Settings.playerName = name; Settings.outfit = outfit;
  saveSettings();
}

const MatchSetup = Object.assign({}, DEFAULT_MATCH, Store.get('match', {}));
function saveMatchSetup() { Store.set('match', MatchSetup); }

const Stats = Object.assign({ played: 0, wins: 0, kills: 0, top10: 0, damage: 0, bestKills: 0, bestPlace: 0, timeAlive: 0 }, Store.get('stats', {}));
function saveStats() { Store.set('stats', Stats); }

function keyLabel(code) {
  if (!code) return '—';
  const map = {
    Space: 'Leertaste', ShiftLeft: 'Shift links', ShiftRight: 'Shift rechts', ControlLeft: 'Strg links', ControlRight: 'Strg rechts',
    AltLeft: 'Alt', Tab: 'Tab', CapsLock: 'Feststell', Enter: 'Enter', Backspace: 'Rück',
    Mouse3: 'Maus 4', Mouse4: 'Maus 5', Mouse1: 'Mausrad-Klick',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
