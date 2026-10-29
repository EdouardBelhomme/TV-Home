// Home screen logic. Written in ES2017 for the Tizen 5.5 browser (no optional chaining).
(function () {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  var STORE_KEY = 'tv-home:v1';
  var TV_API = 'http://127.0.0.1:8001/api/v2/applications/';
  var TIZENBREW_WS = 'ws://127.0.0.1:8081';

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Colour sets for the animated background. "auto" picks one from the time of day.
  var MOODS = {
    aube: ['#5b3a8c', '#c0567a', '#e39b5a'],
    jour: ['#1f5f99', '#2a9d8f', '#6a7fd1'],
    soir: ['#3b2a7a', '#0f5c7a', '#7a2a4f'],
    nuit: ['#151a3d', '#0b3a4a', '#2b1640'],
    foret: ['#1e4d3a', '#3d6b2f', '#0f3b44'],
    braise: ['#7a1f1f', '#a8521c', '#3a1430']
  };
  var MOOD_ORDER = ['auto', 'aube', 'jour', 'soir', 'nuit', 'foret', 'braise'];

  var state = load();
  var editing = false;
  var focus = { row: 0, col: 0 };
  var shelves = buildShelves();
  var TILE_STEP = 300 + 28; // --tile-w + --gap
  var TILES_PER_SCREEN = 5;
  var rowOffset = shelves.map(function () { return 0; });

  // ---------- Persistence (localStorage can be unavailable) ----------
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { order: {}, hidden: {}, mood: 'auto' };
  }
  function save() {
    try { window.localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }
  function appKey(app) { return app.module ? 'module:' + app.module : app.id; }

  function buildShelves() {
    return window.HOME_SHELVES.map(function (shelf, r) {
      var apps = shelf.apps.slice();
      var saved = state.order[r];
      if (saved) {
        apps.sort(function (a, b) {
          var ia = saved.indexOf(appKey(a)), ib = saved.indexOf(appKey(b));
          return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
        });
      }
      return { title: shelf.title, apps: apps };
    });
  }

  // ---------- Rendering ----------
  function visibleApps(r) {
    return shelves[r].apps.filter(function (a) { return editing || !state.hidden[appKey(a)]; });
  }

  function render() {
    var host = document.getElementById('shelves');
    host.innerHTML = '';
    shelves.forEach(function (shelf, r) {
      var row = document.createElement('div');
      row.className = 'row';
      var title = document.createElement('h2');
      title.className = 'row-title';
      title.textContent = shelf.title;
      var tiles = document.createElement('div');
      tiles.className = 'tiles';
      // Scroll the row so the focused tile stays on screen.
      if (r === focus.row) {
        if (focus.col < rowOffset[r]) rowOffset[r] = focus.col;
        if (focus.col > rowOffset[r] + TILES_PER_SCREEN - 1) rowOffset[r] = focus.col - TILES_PER_SCREEN + 1;
      }
      rowOffset[r] = Math.max(0, Math.min(rowOffset[r], visibleApps(r).length - TILES_PER_SCREEN));
      tiles.style.transform = 'translateX(' + (-rowOffset[r] * TILE_STEP) + 'px)';
      visibleApps(r).forEach(function (app, c) {
        var t = document.createElement('div');
        t.className = 'tile' + (state.hidden[appKey(app)] ? ' hidden-app' : '') + (r === focus.row && c === focus.col ? ' focused' : '');
        t.style.setProperty('--tile-color', app.color);
        t.innerHTML = '<div class="mark"></div><div class="label"><div class="name"></div>' + (app.sub ? '<div class="sub"></div>' : '') + '</div>';
        t.querySelector('.mark').textContent = app.mark;
        t.querySelector('.name').textContent = app.name;
        if (app.sub) t.querySelector('.sub').textContent = app.sub;
        tiles.appendChild(t);
      });
      row.appendChild(title);
      row.appendChild(tiles);
      host.appendChild(row);
    });
    document.body.classList.toggle('editing', editing);
    document.getElementById('hints').innerHTML = editing
      ? '<span>◀ ▶ Déplacer</span><span>OK Masquer / afficher</span><span><i class="dot yellow"></i>Terminer</span>'
      : '<span><i class="dot yellow"></i>Réorganiser</span><span><i class="dot blue"></i>Changer d\'ambiance</span>';
  }

  function clampFocus() {
    if (focus.row < 0) focus.row = 0;
    if (focus.row >= shelves.length) focus.row = shelves.length - 1;
    var n = visibleApps(focus.row).length;
    if (focus.col >= n) focus.col = n - 1;
    if (focus.col < 0) focus.col = 0;
  }

  // ---------- Clock & ambiance ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var d = new Date();
    var h = d.getHours();
    document.getElementById('clock').textContent = pad(h) + ':' + pad(d.getMinutes());
    var day = DAYS[d.getDay()];
    document.getElementById('date').textContent = day.charAt(0).toUpperCase() + day.slice(1) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    document.getElementById('greeting').textContent = h < 5 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    if (state.mood === 'auto') applyMood();
  }
  function autoMood() {
    var h = new Date().getHours();
    return h < 6 ? 'nuit' : h < 10 ? 'aube' : h < 17 ? 'jour' : h < 22 ? 'soir' : 'nuit';
  }
  function applyMood() {
    var colors = MOODS[state.mood === 'auto' ? autoMood() : state.mood];
    var root = document.documentElement.style;
    root.setProperty('--c1', colors[0]);
    root.setProperty('--c2', colors[1]);
    root.setProperty('--c3', colors[2]);
  }
  function nextMood() {
    var i = MOOD_ORDER.indexOf(state.mood);
    state.mood = MOOD_ORDER[(i + 1) % MOOD_ORDER.length];
    save();
    applyMood();
    toast('Ambiance : ' + (state.mood === 'auto' ? 'automatique' : state.mood));
  }

  var toastTimer;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ---------- Launching ----------
  function launch(app) {
    if (app.module) return launchModule(app);
    toast('Ouverture de ' + app.name + '…');
    // The TV's local API opens any installed app by its Samsung id; no-cors keeps it a simple request.
    fetch(TV_API + app.id, { method: 'POST', mode: 'no-cors' }).catch(function () {
      try {
        window.tizen.application.launch(app.id, null, function () { toast(app.name + ' introuvable'); });
      } catch (e) { toast('Impossible d\'ouvrir ' + app.name); }
    });
  }

  // Asks TizenBrew's local service for its modules, then launches the matching one the same way TizenBrew's own UI does.
  function launchModule(app) {
    toast('Ouverture de ' + app.name + ' ' + (app.sub || '') + '…');
    var done = false;
    var ws;
    try { ws = new WebSocket(TIZENBREW_WS); } catch (e) { return toast('TizenBrew est injoignable'); }
    var timer = setTimeout(function () {
      if (!done) { done = true; toast('Module introuvable : ajoute-le dans TizenBrew'); try { ws.close(); } catch (e) { /* ignore */ } }
    }, 5000);
    ws.onopen = function () { ws.send(JSON.stringify({ type: 4 })); };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type !== 4 || done || !Array.isArray(msg.payload)) return;
      var mdl = msg.payload.filter(function (m) { return (m.fullName || '').toLowerCase().indexOf(app.module) !== -1; })[0];
      if (!mdl) return;
      done = true;
      clearTimeout(timer);
      (mdl.keys || []).forEach(function (k) { try { window.tizen.tvinputdevice.registerKey(k); } catch (e) { /* ignore */ } });
      ws.send(JSON.stringify({ type: 5, payload: mdl }));
      if (!mdl.evaluateScriptOnDocumentStart) setTimeout(function () { window.location.href = mdl.appPath; }, 150);
    };
    ws.onerror = function () { if (!done) { done = true; clearTimeout(timer); toast('TizenBrew est injoignable'); } };
  }

  // ---------- Editing ----------
  function moveTile(dir) {
    var apps = shelves[focus.row].apps; // editing shows every app, so visible index == array index
    var to = focus.col + dir;
    if (to < 0 || to >= apps.length) return;
    var tmp = apps[focus.col];
    apps[focus.col] = apps[to];
    apps[to] = tmp;
    focus.col = to;
  }
  function toggleEditing() {
    if (editing) {
      shelves.forEach(function (s, r) { state.order[r] = s.apps.map(appKey); });
      save();
      editing = false;
      clampFocus();
      toast('Accueil enregistré');
    } else {
      // Keep focus on the same app once hidden apps reappear.
      var current = visibleApps(focus.row)[focus.col];
      editing = true;
      focus.col = Math.max(0, shelves[focus.row].apps.indexOf(current));
    }
    render();
  }

  // ---------- Input ----------
  function onKey(e) {
    var k = e.keyCode;
    if (k === 89) k = KEY.YELLOW; // "y" and "b" for testing in a desktop browser
    if (k === 66) k = KEY.BLUE;
    var handled = true;
    switch (k) {
      case KEY.LEFT: editing ? moveTile(-1) : focus.col--; break;
      case KEY.RIGHT: editing ? moveTile(1) : focus.col++; break;
      case KEY.UP: focus.row--; break;
      case KEY.DOWN: focus.row++; break;
      case KEY.ENTER: {
        var app = visibleApps(focus.row)[focus.col];
        if (!app) break;
        if (editing) {
          var key = appKey(app);
          if (state.hidden[key]) delete state.hidden[key]; else state.hidden[key] = true;
        } else launch(app);
        break;
      }
      case KEY.YELLOW: toggleEditing(); return e.preventDefault();
      case KEY.BLUE: nextMood(); break;
      case KEY.BACK: if (editing) { toggleEditing(); return e.preventDefault(); } handled = false; break;
      default: handled = false;
    }
    if (!handled) return;
    e.preventDefault();
    clampFocus();
    render();
  }

  try {
    ['ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue'].forEach(function (k) { window.tizen.tvinputdevice.registerKey(k); });
  } catch (e) { /* not running on a TV */ }

  document.addEventListener('keydown', onKey);
  applyMood();
  tick();
  setInterval(tick, 1000);
  render();
})();
