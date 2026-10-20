/* =============================================================
 * KidCoder Lab - registry.js
 * Exercise registry. Generators are registered by (type, variant)
 * and a level asks for a freshly shuffled set on every run.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  var generators = {};

  function register(type, variant, fn) {
    generators[type + '/' + variant] = fn;
  }

  function get(type, variant) {
    var fn = generators[type + '/' + variant];
    if (!fn) throw new Error('No generator for ' + type + '/' + variant);
    return fn;
  }

  /**
   * Build one practice set for a level.
   * @param level  curriculum level object
   * @param seed   string|number (new seed each run => shuffled repeats)
   * @returns { seed, levelId, items: [exercise] }
   */
  function buildSet(level, seed) {
    var spec = level.exercise || {};
    var count = spec.count || 5;
    var rootRng = U.RNG(U.hashString(level.id + '|' + seed));
    var items = [];
    for (var i = 0; i < count; i++) {
      var subSeed = rootRng.int(1, 2147483646);
      var rng = U.RNG(subSeed);
      rng.seed = level.id + '-' + seed + '-' + i;      // stable id base
      var ex = get(spec.type, spec.variant)(level, rng, i, spec.options || {});
      ex.levelId = level.id;
      ex.index = i;
      ex.xp = Math.round((level.xp || 30) / count);
      items.push(ex);
    }
    // Shuffle presentation order but keep the set reproducible.
    var order = rootRng.shuffle(items.map(function (_, i) { return i; }));
    var shuffled = order.map(function (i) { return items[i]; });
    shuffled.forEach(function (ex, i) { ex.order = i; });
    return { seed: seed, levelId: level.id, items: shuffled };
  }

  App.Exercises = {
    generators: generators,
    register: register,
    get: get,
    buildSet: buildSet
  };
})(window.App);
