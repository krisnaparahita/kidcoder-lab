/* =============================================================
 * KidCoder Lab - fx.js
 * Small, dependency-free celebration effects: confetti bursts,
 * cheer words and the floating background shapes. Everything is
 * decorative (aria-hidden) and switched off under reduced motion.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  var COLOURS = ['#f75d59', '#f3ba25', '#2cce99', '#36b6e9', '#a87eeb', '#fd89b9'];
  var CHEERS = ['Awesome!', 'Nailed it!', 'Super!', 'You got it!', 'Brilliant!', 'Woohoo!', 'Great thinking!', 'Spot on!'];
  var CHEER_EMOJI = ['🎉', '🌟', '🚀', '🥳', '✨', '💪', '🙌', '🏅'];

  function calm() {
    if (document.body.classList.contains('reduce-motion')) return true;
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /** Confetti that falls across the whole screen. `count` pieces, removed after it lands. */
  function confetti(count) {
    if (calm()) return;
    var n = count || 70;
    var layer = U.el('div.confetti', { 'aria-hidden': 'true' });
    for (var i = 0; i < n; i++) {
      var piece = U.el('i');
      var size = 7 + Math.random() * 7;
      piece.style.left = (Math.random() * 100) + 'vw';
      piece.style.width = size + 'px';
      piece.style.height = (size * (Math.random() < .5 ? 1 : 1.8)) + 'px';
      piece.style.background = COLOURS[i % COLOURS.length];
      piece.style.borderRadius = Math.random() < .35 ? '50%' : '3px';
      piece.style.animationDelay = (Math.random() * .5) + 's';
      piece.style.animationDuration = (1.6 + Math.random() * 1.4) + 's';
      piece.style.setProperty('--spin', (Math.random() < .5 ? -1 : 1) * (360 + Math.random() * 540) + 'deg');
      piece.style.setProperty('--drift', (Math.random() * 160 - 80) + 'px');
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 3600);
  }

  /** A small burst of pieces from the centre of `node` (used on a correct answer). */
  function burst(node) {
    if (calm() || !node) return;
    var r = node.getBoundingClientRect();
    var layer = U.el('div.burst', { 'aria-hidden': 'true' });
    layer.style.left = (r.left + r.width / 2) + 'px';
    layer.style.top = (r.top + r.height / 2) + 'px';
    for (var i = 0; i < 16; i++) {
      var a = (Math.PI * 2 * i) / 16;
      var d = 60 + Math.random() * 50;
      var p = U.el('i');
      p.style.background = COLOURS[i % COLOURS.length];
      p.style.setProperty('--x', Math.cos(a) * d + 'px');
      p.style.setProperty('--y', Math.sin(a) * d + 'px');
      layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(function () { if (layer.parentNode) layer.parentNode.removeChild(layer); }, 900);
  }

  function cheer() {
    var i = Math.floor(Math.random() * CHEERS.length);
    return { word: CHEERS[i], emoji: CHEER_EMOJI[i % CHEER_EMOJI.length] };
  }

  /** Decorative shapes that drift slowly behind a hero block. */
  function shapes() {
    return U.el('div.float-shapes', { 'aria-hidden': 'true' }, [
      U.el('span.fs.fs-sun'),
      U.el('span.fs.fs-sky'),
      U.el('span.fs.fs-tri'),
      U.el('span.fs.fs-code', { text: '</>' }),
      U.el('span.fs.fs-plus', { text: '+' })
    ]);
  }

  App.fx = { confetti: confetti, burst: burst, cheer: cheer, shapes: shapes, calm: calm };
})(window.App);
