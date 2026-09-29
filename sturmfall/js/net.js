'use strict';
/* ============================================================
   Online: Freundes-Code, Freunde, Online-Status, Einladungen, Lobby.
   Direktverbindungen zwischen den Spielern (WebRTC über PeerJS).
   Der PeerJS-Vermittlungsserver hilft nur beim Verbinden –
   das Spiel selbst läuft direkt von Spieler zu Spieler.
   ============================================================ */

const NET_PREFIX = 'sturmfall-v1-';
const NET_MAX_PLAYERS = 8;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const Net = {
  peer: null, status: 'offline', error: '',
  friends: [],          // [{ code, name }]
  fstate: {},           // code -> { online, name, lobby, conn }
  lobby: null,          // { isHost, hostCode, members: [{ code, name, outfit, conn }], conn (Client) , inGame }
  notes: [],            // Einladungen / Freundschaftsanfragen
  onChange: null, onStart: null, onGameMsg: null, onPeerLeft: null, onHostLost: null, onBack: null,

  supported() { return typeof window.RTCPeerConnection !== 'undefined' && typeof window.Peer !== 'undefined'; },
  code() {
    let c = Store.get('netcode', null);
    if (!c || !/^[A-Z0-9]{6}$/.test(c)) {
      c = ''; for (let i = 0; i < 6; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      Store.set('netcode', c);
    }
    return c;
  },
  me() { return { code: this.code(), name: Settings.playerName || 'Spieler', outfit: Settings.outfit }; },
  changed() { if (this.onChange) this.onChange(); },

  /* ---------- Verbindung zum Vermittlungsserver ---------- */
  peerOptions() {
    const q = new URLSearchParams(location.search);
    const o = { debug: 0 };
    if (q.get('peerhost')) {
      o.host = q.get('peerhost');
      o.port = parseInt(q.get('peerport') || '443', 10);
      o.path = q.get('peerpath') || '/';
      o.secure = q.get('peersecure') !== '0';
    }
    return o;
  },
  connect() {
    if (this.peer && !this.peer.destroyed) { if (this.peer.disconnected) this.peer.reconnect(); return; }
    this.friends = Store.get('friends', []);
    if (!this.supported()) { this.status = 'unsupported'; this.changed(); return; }
    this.status = 'connecting'; this.error = ''; this.changed();
    let peer;
    try { peer = new Peer(NET_PREFIX + this.code(), this.peerOptions()); }
    catch (e) { this.status = 'error'; this.error = 'Verbindung nicht möglich: ' + e.message; this.changed(); return; }
    this.peer = peer;
    peer.on('open', () => { this.status = 'online'; this.changed(); this.pingFriends(); });
    peer.on('connection', conn => this.incoming(conn));
    peer.on('disconnected', () => { if (this.status === 'online') { this.status = 'connecting'; this.changed(); } setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 2000); });
    peer.on('error', err => {
      const t = err && err.type;
      if (t === 'peer-unavailable') {
        const m = /sturmfall-v1-([A-Z0-9]{6})/.exec(err.message || '');
        if (m) this.markOffline(m[1]);
        if (this.joining && m && m[1] === this.joining) { this.joining = null; this.notify({ type: 'info', text: 'Diese Lobby ist nicht erreichbar (Spieler offline oder falscher Code).' }); }
        return;
      }
      if (t === 'unavailable-id') { this.status = 'error'; this.error = 'Dein Code wird schon benutzt – ist das Spiel noch in einem anderen Tab offen?'; }
      else if (t === 'browser-incompatible') { this.status = 'unsupported'; }
      else if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed') { this.status = 'error'; this.error = 'Keine Verbindung zum Online-Dienst. Prüfe dein Internet.' + (window.self !== window.top ? ' In einer eingebetteten Vorschau (z. B. der Claude-App) ist Online-Spielen gesperrt – öffne die veröffentlichte Webseite des Spiels.' : ''); }
      else { this.error = 'Online-Fehler: ' + (err.message || t); }
      this.changed();
    });
    if (!this.pingTimer) this.pingTimer = setInterval(() => this.pingFriends(), 15000);
  },

  /* ---------- Freunde ---------- */
  saveFriends() { Store.set('friends', this.friends); },
  addFriend(code, name) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return 'Ein Freundes-Code hat 6 Zeichen.';
    if (code === this.code()) return 'Das ist dein eigener Code.';
    if (!this.friends.some(f => f.code === code)) { this.friends.push({ code, name: name || '' }); this.saveFriends(); }
    this.send(code, { t: 'freq' });
    this.changed();
    return null;
  },
  removeFriend(code) {
    this.friends = this.friends.filter(f => f.code !== code); this.saveFriends();
    const s = this.fstate[code]; if (s && s.conn) s.conn.close();
    delete this.fstate[code]; this.changed();
  },
  lobbyInfo() {
    if (!this.lobby || !this.lobby.isHost) return null;
    return { n: this.lobby.members.length + 1, open: !this.lobby.inGame && this.lobby.members.length + 1 < NET_MAX_PLAYERS };
  },
  hello() { const m = this.me(); return { t: 'hello', name: m.name, lobby: this.lobbyInfo() }; },
  markOffline(code) { const s = this.fstate[code]; if (s) { s.online = false; s.conn = null; this.changed(); } },
  friendConn(code, cb) {
    const s = this.fstate[code] || (this.fstate[code] = { online: false });
    if (s.conn && s.conn.open) { cb(s.conn); return; }
    if (!this.peer || this.peer.destroyed || this.peer.disconnected) return;
    if (s.connecting) { (s.queue = s.queue || []).push(cb); return; }
    s.connecting = true; s.queue = [cb];
    const conn = this.peer.connect(NET_PREFIX + code, { label: 'f', serialization: 'json', metadata: { code: this.code() } });
    const fail = setTimeout(() => { if (!conn.open) { s.connecting = false; s.queue = []; this.markOffline(code); try { conn.close(); } catch (e) { /* egal */ } } }, 9000);
    conn.on('open', () => {
      clearTimeout(fail); s.connecting = false; s.conn = conn; this.wireFriend(conn, code);
      conn.send(this.hello());
      const q = s.queue || []; s.queue = []; q.forEach(f => f(conn));
    });
    conn.on('error', () => { clearTimeout(fail); s.connecting = false; this.markOffline(code); });
  },
  send(code, msg) { this.friendConn(code, c => c.send(msg)); },
  pingFriends() {
    if (this.status !== 'online') return;
    for (const f of this.friends) {
      const s = this.fstate[f.code];
      if (s && s.conn && s.conn.open) s.conn.send(this.hello());
      else this.friendConn(f.code, () => {});
    }
  },
  wireFriend(conn, code) {
    if (conn._wired) return; conn._wired = true;
    conn.on('data', d => this.friendMsg(code, conn, d));
    conn.on('close', () => { const s = this.fstate[code]; if (s && s.conn === conn) { s.conn = null; s.online = false; this.changed(); } });
  },
  friendMsg(code, conn, d) {
    if (!d || typeof d !== 'object') return;
    const s = this.fstate[code] || (this.fstate[code] = {});
    const friend = this.friends.find(f => f.code === code);
    if (d.t === 'hello') {
      s.online = true; s.name = String(d.name || '').slice(0, 16); s.lobby = d.lobby || null; s.conn = conn;
      if (friend && friend.name !== s.name) { friend.name = s.name; this.saveFriends(); }
      this.changed();
    } else if (d.t === 'freq') {
      if (!friend) this.notify({ type: 'freq', code, name: s.name || code, text: `${s.name || code} möchte mit dir befreundet sein.` });
    } else if (d.t === 'inv') {
      this.notify({ type: 'inv', code, name: s.name || code, text: `${s.name || code} lädt dich in die Lobby ein!` });
    }
  },
  notify(n) { n.id = Math.random().toString(36).slice(2); this.notes.push(n); this.changed(); if (n.type === 'info') setTimeout(() => this.dismiss(n.id), 6000); },
  dismiss(id) { this.notes = this.notes.filter(n => n.id !== id); this.changed(); },
  invite(code) { this.send(code, { t: 'inv' }); },

  /* ---------- eingehende Verbindungen ---------- */
  incoming(conn) {
    const code = conn.metadata && conn.metadata.code;
    if (!code) { conn.close(); return; }
    if (conn.label === 'f') {
      const s = this.fstate[code] || (this.fstate[code] = {});
      conn.on('open', () => { s.conn = conn; s.online = true; this.wireFriend(conn, code); conn.send(this.hello()); this.changed(); });
    } else if (conn.label === 'l') {
      conn.on('open', () => this.hostAccept(conn, code));
    }
  },

  /* ---------- Lobby (Host) ---------- */
  createLobby() {
    if (this.lobby) this.leaveLobby();
    this.lobby = { isHost: true, hostCode: this.code(), members: [], inGame: false };
    this.pingFriends(); this.changed();
  },
  hostAccept(conn, code) {
    const L = this.lobby;
    conn.on('data', d => this.hostMsg(code, conn, d));
    conn.on('close', () => this.memberLeft(code));
    conn.on('error', () => this.memberLeft(code));
    if (!L || !L.isHost) { conn.send({ t: 'deny', r: 'Diese Lobby gibt es nicht mehr.' }); setTimeout(() => conn.close(), 500); return; }
    if (L.inGame) { conn.send({ t: 'deny', r: 'Das Match läuft schon – warte, bis es vorbei ist.' }); setTimeout(() => conn.close(), 500); return; }
    if (L.members.length + 1 >= NET_MAX_PLAYERS) { conn.send({ t: 'deny', r: 'Die Lobby ist voll.' }); setTimeout(() => conn.close(), 500); return; }
    L.members = L.members.filter(m => m.code !== code);
    L.members.push({ code, name: 'Spieler', outfit: 0, conn });
  },
  hostMsg(code, conn, d) {
    const L = this.lobby; if (!L || !L.isHost || !d) return;
    const m = L.members.find(x => x.code === code); if (!m) return;
    if (d.t === 'join' || d.t === 'me') {
      m.name = String(d.name || 'Spieler').slice(0, 16); m.outfit = (d.outfit | 0) % OUTFITS.length;
      this.broadcastLobby(); this.changed();
      if (d.t === 'join') this.notify({ type: 'info', text: `${m.name} ist der Lobby beigetreten.` });
    } else if (d.t === 'leave') { this.memberLeft(code); }
    else if (this.onGameMsg) this.onGameMsg(d, code);
  },
  memberLeft(code) {
    const L = this.lobby; if (!L || !L.isHost) return;
    const m = L.members.find(x => x.code === code); if (!m) return;
    L.members = L.members.filter(x => x.code !== code);
    this.notify({ type: 'info', text: `${m.name} hat die Lobby verlassen.` });
    if (L.inGame && this.onPeerLeft) this.onPeerLeft(code);
    this.broadcastLobby(); this.changed();
  },
  lobbyState() {
    const L = this.lobby, me = this.me();
    return { t: 'lobby', host: L.hostCode, inGame: L.inGame, setup: Object.assign({}, MatchSetup),
      players: [{ code: me.code, name: me.name, outfit: me.outfit, host: true }].concat(L.members.map(m => ({ code: m.code, name: m.name, outfit: m.outfit }))) };
  },
  broadcastLobby() { if (!this.lobby || !this.lobby.isHost) return; const s = this.lobbyState(); for (const m of this.lobby.members) this.sendMember(m.code, s); },
  sendMember(code, msg) { const L = this.lobby; if (!L) return; const m = L.members.find(x => x.code === code); if (m && m.conn && m.conn.open) { try { m.conn.send(msg); } catch (e) { /* Verbindung weg */ } } },
  broadcast(msg, except) { const L = this.lobby; if (!L || !L.isHost) return; for (const m of L.members) if (m.code !== except && m.conn && m.conn.open) { try { m.conn.send(msg); } catch (e) { /* egal */ } } },

  /* ---------- Lobby (Mitspieler) ---------- */
  joinLobby(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return 'Ein Lobby-Code hat 6 Zeichen.';
    if (code === this.code()) { this.createLobby(); return null; }
    if (!this.peer || this.status !== 'online') return 'Du bist noch nicht mit dem Online-Dienst verbunden.';
    if (this.lobby) this.leaveLobby();
    this.joining = code;
    const conn = this.peer.connect(NET_PREFIX + code, { label: 'l', serialization: 'json', reliable: true, metadata: { code: this.code() } });
    this.lobby = { isHost: false, hostCode: code, members: [], conn, players: [], setup: null, connecting: true };
    const fail = setTimeout(() => { if (!conn.open && this.lobby && this.lobby.conn === conn) { this.lobby = null; this.joining = null; this.notify({ type: 'info', text: 'Beitreten hat nicht geklappt – ist der Host online?' }); } }, 12000);
    conn.on('open', () => {
      clearTimeout(fail); this.joining = null;
      if (!this.lobby || this.lobby.conn !== conn) { conn.close(); return; }
      this.lobby.connecting = false;
      const me = this.me(); conn.send({ t: 'join', name: me.name, outfit: me.outfit });
      this.changed();
    });
    conn.on('data', d => this.clientMsg(conn, d));
    conn.on('close', () => {
      if (!this.lobby || this.lobby.conn !== conn) return;
      const inGame = this.lobby.inGameLocal;
      this.lobby = null;
      this.notify({ type: 'info', text: 'Die Verbindung zur Lobby wurde beendet.' });
      if (inGame && this.onHostLost) this.onHostLost();
      this.changed();
    });
    this.changed();
    return null;
  },
  clientMsg(conn, d) {
    const L = this.lobby; if (!L || L.conn !== conn || !d) return;
    if (d.t === 'lobby') { L.players = d.players; L.setup = d.setup; L.inGame = d.inGame; this.changed(); }
    else if (d.t === 'deny') { this.notify({ type: 'info', text: d.r || 'Beitreten abgelehnt.' }); this.lobby = null; conn.close(); this.changed(); }
    else if (d.t === 'start') { L.inGameLocal = true; if (this.onStart) this.onStart(d); }
    else if (d.t === 'back') { L.inGameLocal = false; if (this.onBack) this.onBack(); this.changed(); }
    else if (this.onGameMsg) this.onGameMsg(d, L.hostCode);
  },
  sendHost(msg) { const L = this.lobby; if (L && !L.isHost && L.conn && L.conn.open) { try { L.conn.send(msg); } catch (e) { /* egal */ } } },
  updateMe() {
    const L = this.lobby; if (!L) return;
    if (L.isHost) this.broadcastLobby(); else { const me = this.me(); this.sendHost({ t: 'me', name: me.name, outfit: me.outfit }); }
    this.changed();
  },
  leaveLobby() {
    const L = this.lobby; if (!L) return;
    if (L.isHost) { this.broadcast({ t: 'deny', r: 'Der Host hat die Lobby geschlossen.' }); for (const m of L.members) setTimeout(() => { try { m.conn.close(); } catch (e) { /* egal */ } }, 300); }
    else { this.sendHost({ t: 'leave' }); setTimeout(() => { try { L.conn.close(); } catch (e) { /* egal */ } }, 200); }
    this.lobby = null; this.pingFriends(); this.changed();
  },
};
