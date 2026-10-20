/* =============================================================
 * KidCoder Lab - audio.js
 * Tiny WebAudio synth. No audio assets -> zero network, instant load.
 * ============================================================= */
(function (App) {
  'use strict';

  var ctx = null;
  var enabled = true;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, gain, delay) {
    if (!enabled) return;
    var ac = ensure();
    if (!ac) return;
    if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignore */ } }
    var start = ac.currentTime + (delay || 0);
    var osc = ac.createOscillator();
    var g = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain == null ? 0.18 : gain, start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g); g.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  var SOUNDS = {
    click: function () { tone(520, 0.06, 'triangle', 0.10); },
    tap: function () { tone(660, 0.05, 'sine', 0.09); },
    correct: function () { tone(660, 0.10, 'sine', 0.16); tone(880, 0.16, 'sine', 0.14, 0.10); },
    wrong: function () { tone(220, 0.18, 'sawtooth', 0.09); tone(180, 0.22, 'sawtooth', 0.08, 0.12); },
    step: function () { tone(400, 0.05, 'square', 0.05); },
    win: function () {
      [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.14, i * 0.10); });
    },
    unlock: function () {
      [440, 587, 880].forEach(function (f, i) { tone(f, 0.22, 'sine', 0.14, i * 0.12); });
    },
    badge: function () { tone(988, 0.12, 'triangle', 0.14); tone(1319, 0.24, 'triangle', 0.12, 0.12); }
  };

  App.audio = {
    play: function (name) {
      var fn = SOUNDS[name];
      if (fn) { try { fn(); } catch (e) { /* never break gameplay */ } }
    },
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; }
  };
})(window.App);
