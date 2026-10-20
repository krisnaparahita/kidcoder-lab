/* =============================================================
 * KidCoder Lab - app.js
 * Hash router + chrome (top bar, modal, toast) + boot sequence.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  var screenEl = null;
  var chromeEl = null;
  var modalHost = null;

  /* -------------------------------- chrome ----------------------------- */

  function buildChrome() {
    var bar = U.el('div.topbar');
    var brand = U.el('div.brand', {}, [
      U.el('div.logo', { text: '🧩' }),
      U.el('span', { class: 'hide-sm', text: 'KidCoder Lab' })
    ]);
    brand.style.cursor = 'pointer';
    brand.onclick = function () { App.go('#/map'); };
    bar.appendChild(brand);

    var nav = U.el('div.row', { style: { gap: '6px' } }, [
      U.el('button.btn.small.ghost', { text: '🗺️ Map', onclick: function () { App.go('#/map'); } }),
      U.el('button.btn.small.ghost', { text: '📊', title: 'Progress', onclick: function () { App.go('#/dashboard'); } }),
      U.el('button.btn.small.ghost', { text: '🖼️', title: 'Gallery', onclick: function () { App.go('#/gallery'); } })
    ]);
    bar.appendChild(nav);

    var me = U.el('div.me');
    bar.appendChild(me);
    chromeEl = bar;
    return bar;
  }

  App.refreshChrome = function () {
    if (!chromeEl) return;
    var me = chromeEl.querySelector('.me');
    U.clear(me);
    var p = App.Progress.profile();
    if (!p) return;
    var d = App.Progress.get();
    me.appendChild(U.el('span.stat-chip', { text: '✨ ' + (d.xp || 0) }));
    me.appendChild(U.el('span.stat-chip', { text: '⭐ ' + (d.stars || 0) }));
    var who = U.el('button.who', {
      title: 'Settings',
      onclick: function () { App.go('#/settings'); }
    }, [
      U.el('span.av', { text: p.avatar }),
      U.el('span', { text: p.name })
    ]);
    me.appendChild(who);
  };

  /* -------------------------------- modal ------------------------------ */

  App.openModal = function (node) {
    App.closeModal();
    var host = U.el('div.modal', {
      onclick: function (e) { if (e.target === host) App.closeModal(); }
    }, [node]);
    document.body.appendChild(host);
    modalHost = host;
  };

  App.closeModal = function () {
    if (modalHost && modalHost.parentNode) modalHost.parentNode.removeChild(modalHost);
    modalHost = null;
  };

  var toastTimer = null;
  App.toast = function (msg) {
    var t = U.el('div.toast', { text: msg });
    document.body.appendChild(t);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (t.parentNode) t.parentNode.removeChild(t);
    }, 2600);
  };

  /* -------------------------------- router ----------------------------- */

  function parseHash() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    return { name: parts[0] || 'map', arg: parts[1] || null };
  }

  App.go = function (hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  };

  function render() {
    var route = parseHash();
    var profile = App.Progress.profile();

    if (!profile) {
      chromeEl.classList.add('hidden');
      U.clear(screenEl);
      App.Screens.profiles(screenEl);
      return;
    }
    chromeEl.classList.remove('hidden');
    App.refreshChrome();
    U.clear(screenEl);

    if (route.name === 'level' && route.arg) {
      if (!App.Curriculum.levelUnlocked(App.Progress.get(), route.arg)) {
        App.toast('That level is still locked 🔒');
        route = { name: 'map' };
      } else {
        App.Screens.level(screenEl, route.arg);
        return;
      }
    }

    switch (route.name) {
      case 'category': App.Screens.category(screenEl, route.arg); break;
      case 'dashboard': App.Screens.dashboard(screenEl); break;
      case 'gallery': App.Screens.gallery(screenEl); break;
      case 'settings': App.Screens.settings(screenEl); break;
      case 'profiles': App.Screens.profiles(screenEl); break;
      default: App.Screens.map(screenEl);
    }
  }

  /* --------------------------------- boot ------------------------------ */

  function applySettings(d) {
    var s = d.settings || {};
    App.audio.setEnabled(s.sound !== false);
    document.body.classList.toggle('large-text', !!s.largeText);
    document.body.classList.toggle('reduce-motion', !!s.reducedMotion);
  }

  function boot() {
    var root = document.getElementById('app');
    screenEl = U.el('main.screen');
    var bar = buildChrome();
    root.appendChild(bar);
    root.appendChild(screenEl);

    var client = App.store.getClient();
    var active = client.activeProfileId ? App.store.getProfile(client.activeProfileId) : null;
    if (active) {
      App.Progress.attach(active);
      applySettings(App.Progress.get());
    }

    if (!location.hash) {
      location.hash = active ? '#/map' : '#/profiles';
    }
    window.addEventListener('hashchange', render);
    render();

    // first-run helper
    if (!active && App.store.listProfiles().length === 0) {
      setTimeout(function () {
        App.toast('Create a profile to start — it saves on this device.');
      }, 600);
    }

    if (!App.store.isPersistent) {
      setTimeout(function () {
        App.toast('Browser storage is blocked: progress will not be saved.');
      }, 900);
    }
  }

  App.start = boot;
  App.render = render;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window.App);
