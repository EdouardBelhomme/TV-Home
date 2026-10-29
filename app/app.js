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
  var WALLPAPER_CREDITS = ['Ganapathy Kumar', 'Joshua Wordel', 'Dejan Zakic', 'Aniket Deole', 'Mohammad Alizade', 'John Rodenn Castillo'];

  var ICON_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="#f7f5f0" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  var TOP_BUTTONS = [
    { id: 'wallpaper', label: 'Fond d\'écran', svg: '<svg ' + ICON_ATTRS + '><rect x="3" y="4.5" width="18" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17.5l5-5 3.5 3.5 2.5-2.5 5 5"/></svg>' },
    { id: 'apps', label: 'Toutes les applis', svg: '<svg ' + ICON_ATTRS + '><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>' },
    { id: 'settings', label: 'Réglages', svg: '<svg ' + ICON_ATTRS + '><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>' }
  ];
  var GRID_COLS = 6;

  var DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var MENU_LABELS = { move: 'Déplacer', hide: 'Masquer', show: 'Afficher', cancel: 'Annuler' };

  var state = load();
  var editing = false;
  var menu = null;     // edit-mode menu: { sel, options }
  var moving = false;  // edit mode: the focused app follows ◀ ▶
  var focus = { row: 0, col: 0 }; // row = group in HOME_SHELVES
  var zone = 'dock';   // 'dock' or 'top' (the buttons at the top right)
  var topIndex = 0;
  var sheet = null;    // open panel: { type: 'wallpaper' | 'apps' | 'settings', sel, items }
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
      apps.forEach(function (app, c) { group.appendChild(renderItem(app, zone === 'dock' && r === focus.row && c === focus.col)); });
      dock.appendChild(group);
    });
    var top = document.getElementById('topbar');
    top.innerHTML = '';
    TOP_BUTTONS.forEach(function (b, i) {
      var btn = el('div', 'top-btn' + (zone === 'top' && i === topIndex ? ' focused' : ''));
      btn.innerHTML = b.svg;
      btn.appendChild(el('div', 'label', b.label));
      top.appendChild(btn);
    });
    document.body.classList.toggle('editing', editing);
    document.getElementById('hints').innerHTML = !editing ? ''
      : moving ? '<span>◀ ▶ Déplacer</span><span>OK Poser</span>'
        : '<span>Réorganiser le dock</span><span>OK Options de l\'appli</span><span>Retour Terminer</span>';
    renderSheet();
  }

  // ---------- Sheets: wallpaper picker, all apps, settings ----------
  function openSheet(type) {
    if (type === 'wallpaper') sheet = { type: type, sel: state.wallpaper % WALLPAPERS.length };
    else if (type === 'apps') sheet = { type: type, sel: 0, items: allApps() };
    else sheet = { type: type, sel: 0, items: [{ id: 'edit', label: 'Réorganiser le dock' }, { id: 'diag', label: 'Diagnostic' }, { id: 'close', label: 'Fermer' }] };
  }

  // The apps the TV lists in its own app bar (app/installed.js, generated by tools/sync_installed.py),
  // with the official icons Smart Hub stores on the TV. Without that file, the dock apps.
  function allApps() {
    if (window.TV_INSTALLED_APPS) {
      return window.TV_INSTALLED_APPS.map(function (a) {
        var info = findTizenApp(a);
        return { name: a.name, id: a.id, iconPaths: ['/opt/share/webappservice/apps_icon/all/' + a.samsungId + '/224x224.png', info && info.iconPath] };
      });
    }
    var list = [];
    shelves.forEach(function (s) { s.apps.forEach(function (a) { list.push(a); }); });
    return list;
  }

  function iconUrl(path) {
    return path.charAt(0) === '/' ? 'file://' + path : path;
  }

  // Tries each icon path in turn; falls back to the app's initial when none loads (e.g. in a desktop browser).
  function tvIcon(app) {
    var paths = app.iconPaths.filter(Boolean);
    var box = el('div', 'cell-logo');
    var img = document.createElement('img');
    img.onerror = function () {
      paths.shift();
      if (paths.length) { img.src = iconUrl(paths[0]); return; }
      box.innerHTML = '';
      box.appendChild(el('span', 'wordmark', app.name.charAt(0)));
    };
    img.src = iconUrl(paths[0]);
    img.className = 'tv-icon';
    box.appendChild(img);
    return box;
  }

  // installed.js isn't part of the installed shell's file list, so it is fetched from the same place as this code.
  function loadInstalledApps() {
    var base = window.TV_HOME_SOURCE === 'github' ? 'https://raw.githubusercontent.com/EdouardBelhomme/TV-Home/main/app/'
      : window.TV_HOME_SOURCE === 'local' ? 'app/' : '';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', base + 'installed.js' + (window.TV_HOME_SOURCE === 'github' ? '?t=' + Date.now() : ''));
    xhr.onload = function () {
      if (xhr.status !== 200 && !(xhr.status === 0 && xhr.responseText)) return;
      var s = document.createElement('script');
      s.textContent = xhr.responseText;
      document.body.appendChild(s);
      log('installed.js: ' + (window.TV_INSTALLED_APPS ? window.TV_INSTALLED_APPS.length : 0) + ' applis');
    };
    xhr.send();
  }

  function renderSheet() {
    var host = document.getElementById('sheet');
    host.classList.toggle('show', !!sheet);
    document.body.classList.toggle('sheet-open', !!sheet);
    host.innerHTML = '';
    if (!sheet) return;
    if (sheet.type === 'wallpaper') {
      host.appendChild(el('div', 'sheet-title', 'Fond d\'écran'));
      host.appendChild(el('div', 'sheet-sub', 'Photo : ' + WALLPAPER_CREDITS[sheet.sel] + ' sur Unsplash'));
      var row = el('div', 'thumbs');
      WALLPAPERS.forEach(function (w, i) {
        var t = el('div', 'thumb' + (i === sheet.sel ? ' focused' : '') + (i === state.wallpaper % WALLPAPERS.length ? ' current' : ''));
        t.style.backgroundImage = 'url("' + ASSETS + 'wallpapers/' + w + '-thumb.jpg")';
        row.appendChild(t);
      });
      host.appendChild(row);
    } else if (sheet.type === 'apps') {
      host.appendChild(el('div', 'sheet-title', 'Toutes les applis'));
      host.appendChild(el('div', 'sheet-sub', sheet.items.length + ' applis'));
      var grid = el('div', 'grid');
      var inner = el('div', 'grid-inner');
      var firstRow = Math.max(0, Math.floor(sheet.sel / GRID_COLS) - 2); // keep the focused row on screen
      inner.style.transform = 'translateY(' + (-firstRow * 220) + 'px)';
      sheet.items.forEach(function (a, i) {
        var cell = el('div', 'cell' + (i === sheet.sel ? ' focused' : ''));
        if (a.iconPaths) {
          cell.appendChild(tvIcon(a));
        } else {
          var logo = el('div', 'cell-logo');
          if (a.icon) { var li = document.createElement('img'); li.src = ASSETS + 'icons/' + a.icon; logo.appendChild(li); } else logo.appendChild(el('span', 'wordmark', a.mark || a.name));
          cell.appendChild(logo);
        }
        cell.appendChild(el('div', 'name', a.name + (a.sub ? ' ' + a.sub.toLowerCase() : '')));
        inner.appendChild(cell);
      });
      grid.appendChild(inner);
      host.appendChild(grid);
    } else {
      host.appendChild(el('div', 'sheet-title', 'Réglages'));
      var opts = el('div', 'options');
      sheet.items.forEach(function (o, i) { opts.appendChild(el('div', 'option' + (i === sheet.sel ? ' focused' : ''), o.label)); });
      host.appendChild(opts);
    }
  }

  function sheetKey(k) {
    var n = sheet.type === 'wallpaper' ? WALLPAPERS.length : sheet.items.length;
    if (k === KEY.BACK) { sheet = null; return; }
    if (sheet.type === 'settings') {
      if (k === KEY.UP) sheet.sel = Math.max(0, sheet.sel - 1);
      else if (k === KEY.DOWN) sheet.sel = Math.min(n - 1, sheet.sel + 1);
      else if (k === KEY.ENTER) {
        var choice = sheet.items[sheet.sel].id;
        sheet = null;
        if (choice === 'edit') { zone = 'dock'; toggleEditing(); } else if (choice === 'diag') toggleDiag();
      }
      return;
    }
    var cols = sheet.type === 'apps' ? GRID_COLS : n;
    if (k === KEY.LEFT && sheet.sel % cols > 0) sheet.sel--;
    else if (k === KEY.RIGHT && sheet.sel % cols < cols - 1 && sheet.sel < n - 1) sheet.sel++;
    else if (k === KEY.UP && sheet.sel - cols >= 0) sheet.sel -= cols;
    else if (k === KEY.DOWN && sheet.type === 'apps') sheet.sel = Math.min(n - 1, sheet.sel + cols);
    else if (k === KEY.ENTER) {
      if (sheet.type === 'wallpaper') {
        state.wallpaper = sheet.sel;
        save();
        showWallpaper();
      } else launch(sheet.items[sheet.sel]);
      sheet = null;
    }
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
    if (sheet) {
      sheetKey(k);
    } else if (zone === 'top' && !editing) {
      if (k === KEY.LEFT) topIndex = Math.max(0, topIndex - 1);
      else if (k === KEY.RIGHT) topIndex = Math.min(TOP_BUTTONS.length - 1, topIndex + 1);
      else if (k === KEY.DOWN || k === KEY.BACK) zone = 'dock';
      else if (k === KEY.ENTER) openSheet(TOP_BUTTONS[topIndex].id);
      else if (k === KEY.BLUE) nextWallpaper();
      else if (k === KEY.YELLOW) { zone = 'dock'; toggleEditing(); return e.preventDefault(); }
      else handled = false;
    } else if (editing && moving) {
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
        case KEY.UP: if (!editing) zone = 'top'; break;
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
  loadInstalledApps();
  showWallpaper();
  tick();
  setInterval(tick, 1000);
  clampFocus();
  render();
})();
