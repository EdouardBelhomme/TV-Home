// Home screen logic. Written in ES2017 for the Tizen 5.5 browser (no optional chaining).
(function () {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  var STORE_KEY = 'tv-home:v2';
  var TV_API = 'http://127.0.0.1:8001/api/v2/applications/';
  var TIZENBREW_WS = 'ws://127.0.0.1:8081';
  var TIZENBREW_APP_ID = 'xvvl3S1bvH.TizenBrewStandalone';

  // Images and logos: from jsDelivr when the installed app loaded the code from GitHub (raw.githubusercontent
  // serves SVG as text/plain), from the bundled copy when offline, relative otherwise (browser, TizenBrew).
  var ASSETS = (window.TV_HOME_SOURCE === 'github' ? 'https://cdn.jsdelivr.net/gh/EdouardBelhomme/TV-Home@main/app/'
    : window.TV_HOME_SOURCE === 'local' ? 'app/' : '') + 'assets/';
  var WALLPAPERS = ['misty', 'cove', 'forest', 'valley', 'night', 'peaks'];

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MENU_LABELS = { move: 'Déplacer', hide: 'Masquer', show: 'Afficher', cancel: 'Annuler' };

  var state = load();
  var editing = false;
  var menu = null;     // edit-mode menu: { sel, options }
  var moving = false;  // edit mode: the focused app follows ◀ ▶
  var focus = { row: 0, col: 0 }; // row = group in HOME_SHELVES
  var shelves = buildShelves();

  // ---------- Persistence (localStorage can be unavailable) ----------
  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { order: {}, hidden: {}, wallpaper: 0 };
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

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function renderItem(app, isFocused) {
    var item = el('div', 'item' + (isFocused ? ' focused' : '') + (state.hidden[appKey(app)] ? ' hidden-app' : '') + (isFocused && moving ? ' moving' : ''));
    var logo = el('div', 'logo');
    if (app.icon) {
      var img = document.createElement('img');
      img.src = ASSETS + 'icons/' + app.icon;
      img.alt = '';
      logo.appendChild(img);
    } else {
      logo.appendChild(el('span', 'wordmark', app.mark || app.name));
    }
    item.appendChild(logo);
    item.appendChild(el('div', 'name', app.name));
    if (app.sub) item.appendChild(el('div', 'sub', app.sub));
    if (state.hidden[appKey(app)]) item.appendChild(el('div', 'badge', 'Masquée'));
    if (isFocused && menu) {
      var m = el('div', 'menu');
      menu.options.forEach(function (opt, i) { m.appendChild(el('div', 'opt' + (i === menu.sel ? ' sel' : ''), MENU_LABELS[opt])); });
      item.appendChild(m);
    }
    return item;
  }

  function render() {
    var dock = document.getElementById('dock');
    dock.innerHTML = '';
    shelves.forEach(function (shelf, r) {
      var apps = visibleApps(r);
      if (!apps.length) return;
      var group = el('div', 'group');
      group.appendChild(el('div', 'group-title', shelf.title));
      apps.forEach(function (app, c) { group.appendChild(renderItem(app, r === focus.row && c === focus.col)); });
      dock.appendChild(group);
    });
    document.body.classList.toggle('editing', editing);
    document.getElementById('hints').innerHTML = editing
      ? (moving ? '<span>◀ ▶ Déplacer</span><span>OK Poser</span>' : '<span>OK Options</span><span>Retour Terminer</span>')
      : '<span>Fond d\'écran<i class="dot blue"></i></span><span>Réorganiser<i class="dot yellow"></i></span>';
  }

  // ◀ ▶ walk through every app, crossing from one group to the next.
  function step(dir) {
    var r = focus.row, c = focus.col + dir;
    while (r >= 0 && r < shelves.length) {
      var n = visibleApps(r).length;
      if (c >= 0 && c < n) { focus.row = r; focus.col = c; return; }
      r += dir;
      if (r < 0 || r >= shelves.length) return;
      c = dir > 0 ? 0 : visibleApps(r).length - 1;
    }
  }
  function clampFocus() {
    if (focus.row >= shelves.length) focus.row = shelves.length - 1;
    var n = visibleApps(focus.row).length;
    if (!n) { focus.col = 0; step(1); return; }
    if (focus.col >= n) focus.col = n - 1;
    if (focus.col < 0) focus.col = 0;
  }

  // ---------- Clock & wallpaper ----------
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function tick() {
    var d = new Date();
    document.getElementById('clock').textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var day = DAYS[d.getDay()];
    document.getElementById('date').textContent = day.charAt(0).toUpperCase() + day.slice(1) + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  var wallFront = 'wallA';
  function showWallpaper() {
    var name = WALLPAPERS[state.wallpaper % WALLPAPERS.length];
    var back = wallFront === 'wallA' ? 'wallB' : 'wallA';
    var img = new Image();
    img.onload = function () {
      var b = document.getElementById(back);
      b.style.backgroundImage = 'url("' + img.src + '")';
      b.classList.add('show');
      document.getElementById(wallFront).classList.remove('show');
      wallFront = back;
    };
    img.src = ASSETS + 'wallpapers/' + name + '.jpg';
  }
  function nextWallpaper() {
    state.wallpaper = (state.wallpaper + 1) % WALLPAPERS.length;
    save();
    showWallpaper();
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  // ---------- Diagnostics (red button) ----------
  var logLines = [];
  function log(msg) {
    var d = new Date();
    logLines.push(pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '  ' + msg);
    if (logLines.length > 40) logLines.shift();
    var panel = document.getElementById('diag');
    if (panel.classList.contains('show')) panel.textContent = logLines.join('\n');
  }
  function toggleDiag() {
    var panel = document.getElementById('diag');
    panel.textContent = logLines.join('\n');
    panel.classList.toggle('show');
  }

  // Installed apps as the Tizen runtime knows them (null when the tizen API is not exposed to this page).
  var tizenApps = null;
  function loadTizenApps() {
    var api = window.tizen && window.tizen.application;
    log('page: ' + location.href + (window.TV_HOME_SOURCE ? ' (version ' + window.TV_HOME_SOURCE + ')' : ''));
    log('tizen API: ' + (api ? 'disponible' : 'absente'));
    if (!api) return;
    try {
      api.getAppsInfo(function (list) {
        tizenApps = list;
        log('getAppsInfo: ' + list.length + ' applis');
        window.HOME_SHELVES.forEach(function (s) {
          s.apps.forEach(function (a) { if (a.id) { var info = findTizenApp(a); log('  ' + a.name + ' -> ' + (info ? info.id : '?')); } });
        });
      }, function (err) { log('getAppsInfo erreur: ' + err.name + ' ' + err.message); });
    } catch (e) { log('getAppsInfo exception: ' + e.message); }
  }
  function findTizenApp(app) {
    if (!tizenApps) return null;
    var name = app.name.toLowerCase();
    return tizenApps.filter(function (i) { return i.id === app.id || i.packageId === app.id || i.id.indexOf(app.id + '.') === 0; })[0]
      || tizenApps.filter(function (i) { return (i.name || '').toLowerCase().indexOf(name) === 0; })[0]
      || null;
  }

  // ---------- Launching ----------
  // Tries, in order: the Tizen application API, the TV's remote-control WebSocket, then its REST API.
  function launch(app) {
    if (app.module) return launchModule(app);
    toast('Ouverture de ' + app.name + '…');
    log('lancement ' + app.name + ' (' + app.id + ')');
    launchWithTizen(app, function () {
      launchWithRemoteSocket(app, function () { launchWithRest(app); });
    });
  }

  function launchWithTizen(app, fallback) {
    var api = window.tizen && window.tizen.application;
    if (!api) { log('  tizen: API absente'); return fallback(); }
    var info = findTizenApp(app);
    var target = info ? info.id : app.id;
    try {
      api.launch(target, function () { log('  tizen: OK ' + target); }, function (err) {
        log('  tizen: ' + target + ' -> ' + err.name + ' ' + err.message);
        fallback();
      });
    } catch (e) { log('  tizen exception: ' + e.message); fallback(); }
  }

  function launchWithRemoteSocket(app, fallback) {
    var name = btoa('Accueil TV');
    var ws, done = false;
    function fail(why) { if (done) return; done = true; log('  socket: ' + why); try { ws.close(); } catch (e) { /* ignore */ } fallback(); }
    try { ws = new WebSocket('ws://127.0.0.1:8001/api/v2/channels/samsung.remote.control?name=' + name); } catch (e) { return fail('exception ' + e.message); }
    var timer = setTimeout(function () { fail('pas de reponse (autorisation ?)'); }, 6000);
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      log('  socket: ' + msg.event);
      if (msg.event === 'ms.channel.connect' && !done) {
        done = true;
        clearTimeout(timer);
        ws.send(JSON.stringify({ method: 'ms.channel.emit', params: { event: 'ed.apps.launch', to: 'host', data: { appId: app.id, action_type: 'DEEP_LINK' } } }));
        setTimeout(function () { try { ws.close(); } catch (e) { /* ignore */ } }, 1500);
      } else if (msg.event === 'ms.channel.unauthorized') { clearTimeout(timer); fail('refuse'); }
    };
    ws.onerror = function () { clearTimeout(timer); fail('erreur de connexion'); };
  }

  function launchWithRest(app) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', TV_API + app.id);
    xhr.onload = function () { log('  rest: HTTP ' + xhr.status + ' ' + xhr.responseText); };
    xhr.onerror = function () { log('  rest: erreur reseau'); toast('Impossible d\'ouvrir ' + app.name); };
    try { xhr.send(); } catch (e) { log('  rest exception: ' + e.message); }
  }

  // Inside TizenBrew: asks its local service for the module and launches it the way TizenBrew's own UI does.
  // In the installed app: opens TizenBrew itself (set TizenTube as its auto-launch module to land on YouTube).
  function launchModule(app) {
    toast('Ouverture de ' + app.name + '…');
    if (location.port !== '8081') {
      log('lancement TizenBrew (' + TIZENBREW_APP_ID + ')');
      return launchWithTizen({ name: 'TizenBrew', id: TIZENBREW_APP_ID }, function () { toast('TizenBrew introuvable'); });
    }
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
  // In edit mode the arrows move the focus; OK opens a small menu (move / hide or show / cancel).
  // While moving, ◀ ▶ carry the app within its group and OK or Back drops it.
  function openMenu() {
    var app = visibleApps(focus.row)[focus.col];
    if (!app) return;
    menu = { sel: 0, options: ['move', state.hidden[appKey(app)] ? 'show' : 'hide', 'cancel'] };
  }
  function applyMenu() {
    var app = visibleApps(focus.row)[focus.col];
    var choice = menu.options[menu.sel];
    menu = null;
    if (choice === 'move') moving = true;
    else if (choice === 'hide') state.hidden[appKey(app)] = true;
    else if (choice === 'show') delete state.hidden[appKey(app)];
  }
  function moveApp(dir) {
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
      menu = null;
      moving = false;
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
    if (k === 89) k = KEY.YELLOW; // "y", "b" and "r" for testing in a desktop browser
    if (k === 66) k = KEY.BLUE;
    if (k === 82) k = KEY.RED;
    var handled = true;
    if (editing && moving) {
      if (k === KEY.LEFT) moveApp(-1);
      else if (k === KEY.RIGHT) moveApp(1);
      else if (k === KEY.ENTER || k === KEY.BACK || k === KEY.YELLOW) moving = false;
    } else if (editing && menu) {
      if (k === KEY.UP) menu.sel = Math.max(0, menu.sel - 1);
      else if (k === KEY.DOWN) menu.sel = Math.min(menu.options.length - 1, menu.sel + 1);
      else if (k === KEY.ENTER) applyMenu();
      else if (k === KEY.BACK || k === KEY.YELLOW) menu = null;
    } else {
      switch (k) {
        case KEY.LEFT: step(-1); break;
        case KEY.RIGHT: step(1); break;
        case KEY.ENTER: {
          if (editing) { openMenu(); break; }
          var app = visibleApps(focus.row)[focus.col];
          if (app) launch(app);
          break;
        }
        case KEY.YELLOW: toggleEditing(); return e.preventDefault();
        case KEY.BLUE: nextWallpaper(); break;
        case KEY.RED: toggleDiag(); return e.preventDefault();
        case KEY.BACK: if (editing) { toggleEditing(); return e.preventDefault(); } handled = false; break;
        default: handled = false;
      }
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
  loadTizenApps();
  showWallpaper();
  tick();
  setInterval(tick, 1000);
  clampFocus();
  render();
})();
