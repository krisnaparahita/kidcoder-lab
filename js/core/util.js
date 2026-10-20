/* =============================================================
 * KidCoder Lab - util.js
 * Small dependency-free helpers: seeded RNG, DOM builder, format.
 * Global namespace: window.App
 * ============================================================= */
window.App = window.App || {};

(function (App) {
  'use strict';

  /* ------------------------------ RNG ------------------------------ */

  function hashString(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  /** Deterministic 32-bit PRNG (mulberry32). Same seed -> same exercise. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Seeded random helper used by every exercise generator.
   * Deterministic output lets us grade without storing full answers.
   */
  function RNG(seed) {
    var next = mulberry32(typeof seed === 'string' ? hashString(seed) : seed >>> 0);
    var api = {
      seed: seed,
      next: next,
      /** float in [0,1) */
      float: function () { return next(); },
      /** integer in [min,max] inclusive */
      int: function (min, max) { return min + Math.floor(next() * (max - min + 1)); },
      /** true with probability p */
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
      /** Fisher-Yates copy */
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
          var j = Math.floor(next() * (i + 1));
          var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      /** n distinct elements (n <= arr.length) */
      sample: function (arr, n) {
        return api.shuffle(arr).slice(0, Math.min(n, arr.length));
      },
      /** weighted pick: items = [{weight, ...}] */
      weighted: function (items) {
        var total = 0;
        for (var i = 0; i < items.length; i++) total += (items[i].weight || 0);
        var r = next() * total;
        for (var i = 0; i < items.length; i++) {
          r -= (items[i].weight || 0);
          if (r <= 0) return items[i];
        }
        return items[items.length - 1];
      }
    };
    return api;
  }

  /* ----------------------------- DOM ------------------------------ */

  /**
   * el('div.card', {text:'hi'}, [ child, 'plain text' ])
   * Tag supports `tag.class1.class2#id` shorthand.
   */
  function el(spec, attrs, children) {
    var tag = 'div', id = null, classes = [];
    if (typeof spec === 'string') {
      var m = /^([a-zA-Z0-9]+)/.exec(spec);
      tag = m ? m[1] : 'div';
      var rest = spec.slice(tag.length);
      rest.split(/(?=[.#])/).forEach(function (part) {
        if (!part) return;
        if (part[0] === '.') classes.push(part.slice(1));
        else if (part[0] === '#') id = part.slice(1);
      });
    }
    var node = document.createElement(tag);
    if (id) node.id = id;
    if (classes.length) node.className = classes.join(' ');

    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class' || k === 'className') {
          node.className = (node.className ? node.className + ' ' : '') + v;
        } else if (k === 'text') {
          node.textContent = String(v);
        } else if (k === 'html') {
          node.innerHTML = v;
        } else if (k === 'style' && typeof v === 'object') {
          Object.assign(node.style, v);
        } else if (k === 'dataset' && typeof v === 'object') {
          Object.assign(node.dataset, v);
        } else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else if (k === 'disabled' || k === 'checked' || k === 'selected') {
          node[k] = !!v;
        } else {
          node.setAttribute(k, String(v));
        }
      });
    }

    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'object' && c.nodeType ? c : document.createTextNode(String(c)));
      });
    }
    return node;
  }

  function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function mount(node, children) { clear(node); (Array.isArray(children) ? children : [children]).forEach(function (c) { if (c) node.appendChild(c); }); return node; }
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------------------------- format ---------------------------- */

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function humanTime(ms) {
    var s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s / 60);
    if (m < 60) return m + 'm ' + (s % 60) + 's';
    var h = Math.floor(m / 60);
    return h + 'h ' + (m % 60) + 'm';
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pct(a, b) { return b <= 0 ? 0 : Math.round((a / b) * 100); }

  /** Deep clone of plain JSON-ish data (profiles, progress, exercises). */
  function clone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(clone);
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = clone(obj[k]); });
    return out;
  }

  /** Very small template engine: fmt("Hi {name}", {name:'Ada'}) */
  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] !== undefined ? String(vars[k]) : '{' + k + '}';
    });
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  App.util = {
    RNG: RNG,
    mulberry32: mulberry32,
    hashString: hashString,
    el: el,
    clear: clear,
    mount: mount,
    qs: qs,
    qsa: qsa,
    escapeHtml: escapeHtml,
    uid: uid,
    todayKey: todayKey,
    humanTime: humanTime,
    clamp: clamp,
    pct: pct,
    clone: clone,
    fmt: fmt,
    sleep: sleep
  };
})(window.App);
