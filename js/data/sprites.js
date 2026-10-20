/* =============================================================
 * KidCoder Lab - sprites.js
 * Pixel-art library used by the Pixel Lab.
 * Each sprite is 8x8 "string art": one character per pixel.
 * '.' = empty. Any other char picks a colour from the palette.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;

  /** Canonical colours. Keys are stable so saved art never changes hue. */
  var PALETTE = {
    red: '#e03131',
    orange: '#f76707',
    yellow: '#fcc419',
    green: '#2f9e44',
    blue: '#1c7ed6',
    purple: '#7048e8',
    pink: '#e64980',
    cyan: '#22b8cf',
    brown: '#a0522d',
    black: '#1f2440'
  };
  var PALETTE_NAMES = Object.keys(PALETTE);
  var SWATCHES = PALETTE_NAMES.map(function (n) { return { key: n, hex: PALETTE[n], label: n }; });

  /* char -> default palette key */
  var CHARS = {
    R: 'red', O: 'orange', Y: 'yellow', G: 'green', B: 'blue',
    P: 'purple', M: 'pink', C: 'cyan', N: 'brown', K: 'black'
  };

  var SPRITES = [
    { id: 'heart', title: 'Heart', rows: [
      '.RR..RR.',
      'RRRRRRRR',
      'RRRRRRRR',
      'RRRRRRRR',
      '.RRRRRR.',
      '..RRRR..',
      '...RR...',
      '........'
    ] },
    { id: 'star', title: 'Star', rows: [
      '...YY...',
      '...YY...',
      '.YYYYYY.',
      'YYYYYYYY',
      '.YYYYYY.',
      '..YYYY..',
      '.YY..YY.',
      '........'
    ] },
    { id: 'smiley', title: 'Smiley', rows: [
      '..YYYY..',
      '.YYYYYY.',
      'YYKYYKYY',
      'YYYYYYYY',
      'YKYYYYKY',
      'YYKKKKYY',
      '.YYYYYY.',
      '..YYYY..'
    ] },
    { id: 'cat', title: 'Cat', rows: [
      'N......N',
      'NN....NN',
      'NNNNNNNN',
      'NKNNNNKN',
      'NNNNNNNN',
      'NNMNNMNN',
      '.NNNNNN.',
      '..NNNN..'
    ] },
    { id: 'robot', title: 'Robot', rows: [
      '..BBBB..',
      '.BBBBBB.',
      'BBWBBWBB',
      'BBBBBBBB',
      'BBKKKKBB',
      'BBBBBBBB',
      '.BBBBBB.',
      '.B....B.'
    ] },
    { id: 'rocket', title: 'Rocket', rows: [
      '...RR...',
      '..RRRR..',
      '..RCCR..',
      '..RRRR..',
      '..RRRR..',
      '.RRRRRR.',
      'R.RRRR.R',
      '..O..O..'
    ] },
    { id: 'house', title: 'House', rows: [
      '...RR...',
      '..RRRR..',
      '.RRRRRR.',
      'RRRRRRRR',
      '.NNNNNN.',
      '.NNKKNN.',
      '.NNKKNN.',
      '.NNNNNN.'
    ] },
    { id: 'tree', title: 'Tree', rows: [
      '...GG...',
      '..GGGG..',
      '.GGGGGG.',
      'GGGGGGGG',
      '..GGGG..',
      '...NN...',
      '...NN...',
      '..NNNN..'
    ] },
    { id: 'mushroom', title: 'Mushroom', rows: [
      '..RRRR..',
      '.RRRRRR.',
      '.RWRRWR.',
      'RRRRRRRR',
      '.WWWWWW.',
      '.WWWWWW.',
      '..WWWW..',
      '..WWWW..'
    ] },
    { id: 'ghost', title: 'Ghost', rows: [
      '..WWWW..',
      '.WWWWWW.',
      'WWKWWKWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'WWWWWWWW',
      'W.WW.WW.'
    ] },
    { id: 'apple', title: 'Apple', rows: [
      '...NN...',
      '..GNN...',
      '..RRRR..',
      '.RRRRRR.',
      'RRRRRRRR',
      'RRRRRRRR',
      '.RRRRRR.',
      '..RRRR..'
    ] },
    { id: 'cupcake', title: 'Cupcake', rows: [
      '...MM...',
      '..MMMM..',
      '.MMMMMM.',
      '.YYYYYY.',
      '..YYYY..',
      '.OOOOOO.',
      '.OOOOOO.',
      '..OOOO..'
    ] },
    { id: 'frog', title: 'Frog', rows: [
      'G......G',
      'GG....GG',
      'GGGGGGGG',
      'GWGGGGWG',
      'GGGGGGGG',
      'GKKKKKKG',
      '.GGGGGG.',
      'G......G'
    ] },
    { id: 'boat', title: 'Boat', rows: [
      '..WW....',
      '..WWW...',
      '..WWWW..',
      '..WW....',
      'RRRRRRRR',
      '.RRRRRR.',
      '..CCCC..',
      '.CCCCCC.'
    ] },
    { id: 'flower', title: 'Flower', rows: [
      '...MM...',
      '..MMMM..',
      'MMMYYMMM',
      'MMMYYMMM',
      '..MMMM..',
      '...GG...',
      '...GG...',
      '...GG...'
    ] },
    { id: 'fish', title: 'Fish', rows: [
      '...CCC..',
      '..CCCCC.',
      '.CKCCCCC',
      'CCCCCCCC',
      'CCKCCCCC',
      '.CCCCC..',
      '...CCC..',
      '........'
    ] },
    { id: 'diamond', title: 'Diamond', rows: [
      '...CC...',
      '..CCCC..',
      '.CCCCCC.',
      'CCCCCCCC',
      '.CCCCCC.',
      '..CCCC..',
      '...CC...',
      '........'
    ] },
    { id: 'plus', title: 'Plus', rows: [
      '...GG...',
      '...GG...',
      'GGGGGGGG',
      'GGGGGGGG',
      '...GG...',
      '...GG...',
      '...GG...',
      '........'
    ] }
  ];

  var byId = {};
  SPRITES.forEach(function (s) { byId[s.id] = s; });

  /** Which palette characters a sprite uses, in order of appearance. */
  function usedChars(sprite) {
    var seen = {}, out = [];
    sprite.rows.forEach(function (row) {
      for (var i = 0; i < row.length; i++) {
        var c = row[i];
        if (c !== '.' && c !== ' ' && !seen[c]) { seen[c] = true; out.push(c); }
      }
    });
    return out;
  }

  /**
   * Build a grid from a sprite.
   * opts: { colors: {char: paletteName}, flip, rotate }
   */
  function build(sprite, opts) {
    opts = opts || {};
    var chars = usedChars(sprite);
    var map = {};
    chars.forEach(function (c) {
      var key = (opts.colors && opts.colors[c]) || CHARS[c] || 'black';
      map[c] = PALETTE[key] || key;
    });
    // white is used literally by a few sprites (robot eyes, mushroom)
    map.W = '#ffffff';
    var palette = {};
    sprite.rows.forEach(function (r) {
      for (var i = 0; i < r.length; i++) palette[r[i]] = map[r[i]] || null;
    });
    var g = App.Grid.fromRows(sprite.rows, palette);
    if (opts.flip) g = App.Grid.flipX(g);
    if (opts.rotate) {
      var times = ((opts.rotate % 4) + 4) % 4;
      for (var t = 0; t < times; t++) g = App.Grid.rotate90(g);
    }
    return g;
  }

  /** Randomised variant of a sprite (same shape, different look). */
  function randomVariant(rng, spriteId) {
    var sprite = spriteId ? byId[spriteId] : rng.pick(SPRITES);
    if (!sprite) sprite = SPRITES[0];
    var chars = usedChars(sprite).filter(function (c) { return c !== 'W'; });
    var pool = rng.shuffle(PALETTE_NAMES);
    var colors = {};
    chars.forEach(function (c, i) {
      // keep the "natural" colour most of the time so sprites stay recognisable
      if (rng.chance(0.45)) colors[c] = pool[i % pool.length];
    });
    var grid = build(sprite, {
      colors: colors,
      flip: rng.chance(0.5),
      rotate: rng.chance(0.25) ? rng.int(1, 3) : 0
    });
    return { grid: grid, title: sprite.title, spriteId: sprite.id };
  }

  /* ------------------------- procedural shapes ------------------------- */

  /** Simple geometric patterns for the earliest levels. */
  function randomShape(rng, size) {
    size = size || 8;
    var g = App.Grid.create(size, size);
    var colour = PALETTE[rng.pick(PALETTE_NAMES)];
    var kind = rng.pick(['square', 'rect', 'diagonal', 'triangle', 'pyramid', 'border', 'zigzag', 'checker', 'stairs']);
    var x, y;
    if (kind === 'square') {
      var s = rng.int(3, size - 2), ox = rng.int(0, size - s), oy = rng.int(0, size - s);
      for (y = 0; y < s; y++) for (x = 0; x < s; x++) App.Grid.set(g, ox + x, oy + y, colour);
    } else if (kind === 'rect') {
      var rw = rng.int(3, size), rh = rng.int(2, size), rx = rng.int(0, size - rw), ry = rng.int(0, size - rh);
      for (y = 0; y < rh; y++) for (x = 0; x < rw; x++) App.Grid.set(g, rx + x, ry + y, colour);
    } else if (kind === 'diagonal') {
      for (y = 0; y < size; y++) App.Grid.set(g, y, y, colour);
    } else if (kind === 'triangle') {
      for (y = 0; y < size; y++) for (x = 0; x <= y; x++) App.Grid.set(g, x, y, colour);
    } else if (kind === 'pyramid') {
      for (y = 0; y < size; y++) {
        for (x = size - 1 - y; x <= size - 1 + y && x < size; x++) {
          if (x >= 0) App.Grid.set(g, x, y, colour);
        }
      }
    } else if (kind === 'border') {
      for (x = 0; x < size; x++) { App.Grid.set(g, x, 0, colour); App.Grid.set(g, x, size - 1, colour); }
      for (y = 0; y < size; y++) { App.Grid.set(g, 0, y, colour); App.Grid.set(g, size - 1, y, colour); }
    } else if (kind === 'zigzag') {
      for (x = 0; x < size; x++) App.Grid.set(g, x, (x % 4 < 2) ? 1 : size - 2, colour);
    } else if (kind === 'checker') {
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if ((x + y) % 2 === 0) App.Grid.set(g, x, y, colour);
    } else {
      for (y = 0; y < size; y++) for (x = 0; x <= y; x++) App.Grid.set(g, x, size - 1 - y, colour);
    }
    return { grid: g, title: kind, spriteId: 'shape-' + kind };
  }

  App.Sprites = {
    PALETTE: PALETTE,
    PALETTE_NAMES: PALETTE_NAMES,
    SWATCHES: SWATCHES,
    SPRITES: SPRITES,
    byId: byId,
    usedChars: usedChars,
    build: build,
    randomVariant: randomVariant,
    randomShape: randomShape
  };
})(window.App);
