/* =============================================================
 * KidCoder Lab - home.js
 * Screens: profile picker, world map, category, dashboard,
 * gallery and settings.
 * ============================================================= */
(function (App) {
  'use strict';
  var U = App.util;
  var C = App.Curriculum;

  var Screens = {};
  App.Screens = Screens;

  function starStr(n) {
    var out = '';
    for (var i = 0; i < 3; i++) out += i < n ? '<span class="on">★</span>' : '<span class="off">★</span>';
    return out;
  }

  var AVATAR_BG = ['#ffe1dd', '#fff0cf', '#d9f5e8', '#d9f0fb', '#ece3fd', '#ffe3ef'];
  function avatarBg(seed) {
    var h = 0;
    for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return AVATAR_BG[h % AVATAR_BG.length];
  }

  function catById(id) { return C.CATEGORIES.filter(function (c) { return c.id === id; })[0]; }

  /** The sticker board: stickers unlock from total stars, nothing extra is saved. */
  function stickerBoard(stars) {
    var got = C.stickersUnlocked(stars);
    var next = C.nextSticker(stars);
    var list = U.el('ul.sticker-board');
    C.STICKERS.forEach(function (st, i) {
      var on = stars >= st.stars;
      list.appendChild(U.el('li.sticker' + (on ? '.on' : ''), {
        style: on ? Object.assign(C.catVars(catById(st.cat)), { transform: 'rotate(' + (i % 2 ? 3 : -3) + 'deg)' }) : null,
        title: on ? st.name : 'Unlocks at ' + st.stars + ' stars',
        'aria-label': on ? st.name : 'Locked sticker, unlocks at ' + st.stars + ' stars',
        text: on ? st.emoji : '?'
      }));
    });
    return U.el('div.sticker-wrap', {}, [
      U.el('div.row.between.wrap', {}, [
        U.el('h3', { style: { margin: 0 }, text: '🌟 My sticker board' }),
        U.el('span.muted', { style: { fontWeight: 800, fontSize: '.85rem' }, text: got.length + ' of ' + C.STICKERS.length + ' collected' })
      ]),
      list,
      U.el('p.muted', { style: { margin: '10px 0 0', fontSize: '.9rem' }, text: next
        ? 'Earn ' + (next.stars - stars) + ' more star' + (next.stars - stars === 1 ? '' : 's') + ' to unlock the next sticker.'
        : 'You collected every sticker. Amazing!' })
    ]);
  }
  Screens.stickerBoard = stickerBoard;

  /* ------------------------------ profiles ----------------------------- */

  Screens.profiles = function (container) {
    var profiles = App.store.listProfiles();

    var grid = U.el('div.profile-grid');
    profiles.forEach(function (p) {
      var prog = App.store.loadProgress(p.id);
      var mastered = C.LEVELS.filter(function (l) { return prog.levels[l.id] && prog.levels[l.id].mastered; }).length;
      var card = U.el('div.profile-card.lift', {
        onclick: function (e) {
          if (e.target.classList.contains('del')) return;
          App.audio.play('click');
          App.Progress.attach(p);
          App.store.setActiveId(p.id);
          App.audio.setEnabled((App.Progress.get().settings || {}).sound !== false);
          App.refreshChrome();
          App.go('#/map');
        }
      }, [
        U.el('button.del', { title: 'Delete profile', 'aria-label': 'Delete profile', text: '✕', onclick: function (e) {
          e.stopPropagation();
          if (window.confirm('Delete the profile "' + p.name + '" and all its progress?')) {
            App.store.deleteProfile(p.id);
            Screens.profiles(container);
          }
        } }),
        U.el('div.av', { style: { background: avatarBg(p.id) }, text: p.avatar }),
        U.el('div.nm', { text: p.name }),
        U.el('div.meta', { text: 'age ' + p.age + ' · ' + mastered + '/' + C.LEVELS.length + ' levels' }),
        U.el('div.row', { style: { justifyContent: 'center', gap: '6px', marginTop: '8px' } }, [
          U.el('span.pill.sun', { text: '⭐ ' + (prog.stars || 0) }),
          U.el('span.pill', { text: '✨ ' + (prog.xp || 0) })
        ])
      ]);
      grid.appendChild(card);
    });

    var addCard = U.el('div.profile-card.add.lift', {
      onclick: function () { App.audio.play('click'); openCreateModal(container); }
    }, [
      U.el('div.av', { text: '+' }),
      U.el('div.nm', { text: 'New coder' }),
      U.el('div.meta', { text: 'make a profile' })
    ]);
    grid.appendChild(addCard);

    U.mount(container, [
      U.el('div.welcome', {}, [
        App.fx.shapes(),
        U.el('div.logo-big.floaty', { text: '🧩' }),
        U.el('h1', { text: 'KidCoder Lab' }),
        U.el('p.welcome-sub', {}, ['Learn to code ', U.el('span.highlight', { text: 'one fun step' }), ' at a time!']),
        U.el('div.row.wrap.world-pills', {}, C.CATEGORIES.map(function (c) {
          return U.el('span.pill.tag-cat', { style: C.catVars(c), text: c.icon + ' ' + c.title });
        })),
        U.el('h2.who-title', { text: 'Who is coding today?' })
      ]),
      grid,
      U.el('p.center.muted', { style: { marginTop: '26px' }, text: 'Progress is saved in this browser only. Make a profile for each child.' })
    ]);
  };

  function openCreateModal(container) {
    var name = '';
    var avatar = App.store.AVATARS[0];
    var age = 6;

    var nameInput = U.el('input', { type: 'text', placeholder: 'Name', maxlength: 24, oninput: function (e) { name = e.target.value; } });
    var avatars = U.el('div.avatar-picker');
    App.store.AVATARS.forEach(function (a) {
      var b = U.el('button.avatar-opt' + (a === avatar ? '.on' : ''), {
        text: a,
        type: 'button',
        style: { background: avatarBg(a) },
        onclick: function () {
          avatar = a;
          avatars.querySelectorAll('.avatar-opt').forEach(function (n) { n.classList.remove('on'); });
          b.classList.add('on');
        }
      });
      avatars.appendChild(b);
    });
    var ageSel = U.el('select', { onchange: function (e) { age = parseInt(e.target.value, 10); } });
    for (var i = 4; i <= 14; i++) {
      var o = U.el('option', { value: String(i), text: String(i) + ' years old' });
      if (i === age) o.selected = true;
      ageSel.appendChild(o);
    }

    var box = U.el('div.modalbox', {}, [
      U.el('div.modal-head', {}, [U.el('span.tile.sm', { text: '✨' }), U.el('h3', { style: { margin: 0 }, text: 'Make your coder profile' })]),
      U.el('label.field', {}, [U.el('span', { text: 'Your nickname' }), nameInput]),
      U.el('div.field', {}, [U.el('span', { text: 'Pick an avatar' }), avatars]),
      U.el('label.field', {}, [U.el('span', { text: 'How old are you?' }), ageSel]),
      U.el('div.row', {}, [
        U.el('button.btn.primary', {
          text: 'Start coding! 🚀',
          onclick: function () {
            var nm = (name || '').trim() || 'Coder';
            var p = App.store.createProfile({ name: nm, avatar: avatar, age: age });
            App.Progress.attach(p);
            App.store.setActiveId(p.id);
            App.refreshChrome();
            App.closeModal();
            App.go('#/map');
          }
        }),
        U.el('button.btn.ghost', { text: 'Cancel', onclick: function () { App.closeModal(); } })
      ])
    ]);
    App.openModal(box);
    setTimeout(function () { nameInput.focus(); }, 50);
  }

  /* -------------------------------- map -------------------------------- */

  Screens.map = function (container) {
    var prog = App.Progress.get();
    var totals = App.Progress.totals();
    var next = C.recommendedLevel(prog);
    var nextCat = C.categoryOf(next.id);

    var me = App.Progress.profile() || {};
    var hero = U.el('div.hero', {}, [
      App.fx.shapes(),
      U.el('div.hero-text', {}, [
        U.el('span.pill', { text: '✨ ' + totals.mastered + ' of ' + totals.total + ' levels mastered' }),
        U.el('h1.hero-title', {}, ['Hi ' + (me.name || 'coder') + '! ', U.el('br'), 'Ready to ', U.el('span.highlight', { text: 'code?' })]),
        U.el('p.muted', { text: 'Pick up where you left off, or explore a world below.' }),
        U.el('div.row.wrap', { style: { marginTop: '14px' } }, [
          U.el('button.btn.primary.big', {
            text: '▶ Continue',
            onclick: function () { App.audio.play('click'); App.go('#/level/' + next.id); }
          }),
          U.el('button.btn.ghost', { text: '🗺️ ' + nextCat.title + ' levels', onclick: function () { App.go('#/category/' + nextCat.id); } })
        ])
      ]),
      U.el('div.next-card.lift', {
        style: C.catVars(nextCat),
        onclick: function () { App.audio.play('click'); App.go('#/level/' + next.id); }
      }, [
        U.el('div.row.between', {}, [
          U.el('span.pill.tag-cat', { text: 'Next up' }),
          U.el('span.muted', { style: { fontWeight: 800, fontSize: '.85rem' }, text: nextCat.title + ' · step ' + (next.positionInCategory + 1) })
        ]),
        U.el('div.next-icon.floaty', { text: next.icon }),
        U.el('h3', { style: { margin: '0 0 4px', textAlign: 'center' }, text: next.title }),
        U.el('div.next-stats', {}, [
          U.el('span.stat-chip', { text: '✨ ' + totals.xp + ' XP' }),
          U.el('span.stat-chip', { text: '⭐ ' + totals.stars }),
          U.el('span.stat-chip', { text: '🔥 ' + totals.streak + ' day' + (totals.streak === 1 ? '' : 's') })
        ])
      ])
    ]);

    var grid = U.el('div.cat-grid');
    C.CATEGORIES.forEach(function (cat) {
      var unlocked = C.categoryUnlocked(prog, cat.id);
      var done = C.masteredInCategory(prog, cat.id);
      var card = U.el('div.cat-card' + (unlocked ? '.lift' : '.locked'), {
        style: C.catVars(cat),
        onclick: function () {
          if (!unlocked) {
            App.toast('Finish more of ' + (C.CATEGORIES.filter(function (c) { return c.id === cat.requires.category; })[0] || {}).title + ' first!');
            return;
          }
          App.audio.play('click');
          App.go('#/category/' + cat.id);
        }
      }, [
        U.el('div.row.between', { style: { alignItems: 'flex-start' } }, [
          U.el('span.tile' + (C.CATEGORIES.indexOf(cat) % 2 ? '.alt' : ''), { text: unlocked ? cat.icon : '🔒' }),
          U.el('span.pill.cat-age', { text: 'age ' + cat.age })
        ]),
        U.el('h3', { text: cat.title }),
        U.el('div.blurb', { text: cat.blurb }),
        U.el('div.bar', { role: 'progressbar', 'aria-label': cat.title + ' progress', 'aria-valuemin': 0, 'aria-valuemax': cat.levels.length, 'aria-valuenow': done }, [U.el('i', { style: { width: (done / cat.levels.length * 100) + '%' } })]),
        U.el('div.cat-foot', {}, [
          U.el('span', { text: '★ ' + done + ' / ' + cat.levels.length + ' mastered' }),
          unlocked ? U.el('span.cat-go', { text: (done ? 'Keep going' : 'Start') + ' →' }) : null
        ]),
        unlocked ? null : U.el('div.lock-note', { text: '🔒 Master ' + cat.requires.mastered + ' levels of ' + (catById(cat.requires.category) || {}).title + ' to open' })
      ]);
      grid.appendChild(card);
    });

    var badgeStrip = U.el('div.row.wrap', { style: { marginTop: '20px' } });
    prog.badges.slice(-6).forEach(function (b) {
      var def = C.BADGES.filter(function (x) { return x.id === b.id; })[0];
      if (def) badgeStrip.appendChild(U.el('span.pill.sun', { text: def.icon + ' ' + def.title }));
    });

    U.mount(container, [
      hero,
      U.el('h2', { style: { marginTop: '8px' }, text: 'Choose a world' }),
      U.el('p.muted', { text: 'Worlds open as you master the one before. No skipping — every step builds the next.' }),
      grid,
      U.el('div.card.pad', { style: { marginTop: '22px' } }, [stickerBoard(totals.stars)]),
      U.el('div.row.wrap', { style: { marginTop: '22px' } }, [
        U.el('button.btn.ghost', { text: '📊 My progress', onclick: function () { App.go('#/dashboard'); } }),
        U.el('button.btn.ghost', { text: '🖼️ Gallery', onclick: function () { App.go('#/gallery'); } }),
        U.el('button.btn.ghost', { text: '⚙️ Settings', onclick: function () { App.go('#/settings'); } })
      ]),
      badgeStrip
    ]);
  };

  /* ------------------------------ category ----------------------------- */

  Screens.category = function (container, catId) {
    var cat = C.CATEGORIES.filter(function (c) { return c.id === catId; })[0];
    if (!cat) { App.go('#/map'); return; }
    var prog = App.Progress.get();

    var list = U.el('div.level-list');
    cat.levels.forEach(function (level) {
      var unlocked = C.levelUnlocked(prog, level.id);
      var st = prog.levels[level.id] || {};
      var row = U.el('div.level-row' + (unlocked ? '.lift' : '.locked') + (st.mastered ? '.mastered' : ''), {
        style: C.catVars(cat),
        onclick: function () {
          if (!unlocked) { App.toast('Master the level above first 🔒'); return; }
          App.audio.play('click');
          App.go('#/level/' + level.id);
        }
      }, [
        U.el('span.tile.sm' + (unlocked ? '' : '.off') + (level.positionInCategory % 2 ? '.alt' : ''), { text: unlocked ? level.icon : '🔒' }),
        U.el('div', {}, [
          U.el('div.lt', {}, [U.el('span.lnum', { text: 'Level ' + (level.positionInCategory + 1) }), level.title]),
          U.el('div.ls', { html: level.concept.replace(/<[^>]+>/g, '') })
        ]),
        U.el('div.right', {}, [
          U.el('div.stars', { html: starStr(st.stars || 0) }),
          st.attempts ? U.el('div.ls', { text: Math.round((st.correct / st.attempts) * 100) + '%' }) : null,
          unlocked ? U.el('span.play', { text: st.mastered ? '↻' : '▶' }) : null
        ])
      ]);
      list.appendChild(row);
    });

    U.mount(container, [
      U.el('div.runner-head', {}, [
        U.el('button.btn.icon.ghost', { text: '←', onclick: function () { App.go('#/map'); } })
      ]),
      U.el('div.world-banner', { style: C.catVars(cat) }, [
        App.fx.shapes(),
        U.el('span.tile', { text: cat.icon }),
        U.el('div', {}, [
          U.el('h1', { style: { margin: 0 }, text: cat.title }),
          U.el('div', { text: cat.blurb })
        ])
      ]),
      U.el('div.card.pad', { style: { marginTop: '14px' } }, [
        U.el('div.row.wrap', { style: { gap: '8px' } }, [
          U.el('span.pill.mint', { text: 'age ' + cat.age }),
          cat.skills.map(function (s) { return U.el('span.pill.tag-cat', { style: C.catVars(cat), text: s }); })
        ]),
        U.el('p.muted', { style: { marginTop: '10px', marginBottom: 0 }, text: 'Levels unlock one by one. Repeat any level as often as you like — the exercises are generated fresh every time.' })
      ]),
      list
    ]);
  };

  /* ----------------------------- dashboard ----------------------------- */

  Screens.dashboard = function (container) {
    var prog = App.Progress.get();
    var t = App.Progress.totals();

    var stats = U.el('div.stat-grid', {}, [
      statCard('✨', t.xp, 'XP', '#fff0cf'),
      statCard('⭐', t.stars, 'stars', '#fff0cf'),
      statCard('🏆', t.mastered + '/' + t.total, 'levels mastered', '#d9f5e8'),
      statCard('🎯', Math.round(t.accuracy * 100) + '%', 'accuracy', '#d9f0fb'),
      statCard('⏱️', U.humanTime(t.timeMs), 'time played', '#ece3fd'),
      statCard('🔥', t.streak, 'days practised', '#ffe1dd')
    ]);

    var catBox = U.el('div.stack');
    C.CATEGORIES.forEach(function (cat) {
      var done = C.masteredInCategory(prog, cat.id);
      catBox.appendChild(U.el('div.world-progress', { style: C.catVars(cat) }, [
        U.el('span.tile.sm', { text: cat.icon }),
        U.el('div', { style: { flex: 1 } }, [
          U.el('div.row.between', {}, [
            U.el('b', { text: cat.title }),
            U.el('span.muted', { style: { fontWeight: 800 }, text: done + '/' + cat.levels.length })
          ]),
          U.el('div.bar', { style: { marginTop: '6px' } }, [U.el('i', { style: { width: (done / cat.levels.length * 100) + '%' } })])
        ])
      ]));
    });

    var badges = U.el('div.badge-grid');
    C.BADGES.forEach(function (b) {
      var has = prog.badges.some(function (x) { return x.id === b.id; });
      badges.appendChild(U.el('div.badge-card' + (has ? '' : '.off'), {}, [
        U.el('div.bi', { text: b.icon }),
        U.el('div.bt', { text: b.title }),
        U.el('div.bd', { text: b.desc })
      ]));
    });

    var history = U.el('div.stack');
    prog.history.slice(0, 8).forEach(function (h) {
      var l = C.byId[h.levelId];
      if (!l) return;
      history.appendChild(U.el('div.card.tight', { style: { padding: '10px 14px' } }, [
        U.el('span', { text: l.icon + ' ' + l.title }),
        U.el('span.muted', { text: '  ' + h.correct + '/' + h.total })
      ]));
    });

    U.mount(container, [
      U.el('div.runner-head', {}, [
        U.el('button.btn.icon.ghost', { text: '←', onclick: function () { App.go('#/map'); } }),
        U.el('h2', { style: { margin: 0 }, text: '📊 My progress' })
      ]),
      stats,
      U.el('div.card.pad', { style: { marginTop: '16px' } }, [stickerBoard(t.stars)]),
      U.el('div.card.pad', { style: { marginTop: '16px' } }, [U.el('h3', { text: 'Worlds' }), catBox]),
      U.el('div.card.pad', { style: { marginTop: '16px' } }, [U.el('h3', { text: 'Badges' }), badges]),
      U.el('div.card.pad', { style: { marginTop: '16px' } }, [U.el('h3', { text: 'Recent sessions' }), history.length ? history : U.el('p.muted', { text: 'No practice rounds yet.' })])
    ]);
  };

  function statCard(icon, v, k, bg) {
    return U.el('div.stat-card', {}, [
      U.el('span.stat-icon', { style: { background: bg }, text: icon }),
      U.el('div.v', { text: String(v) }),
      U.el('div.k', { text: k })
    ]);
  }

  /* ------------------------------- gallery ----------------------------- */

  Screens.gallery = function (container) {
    var prog = App.Progress.get();
    var grid = U.el('div.gallery-grid');

    function render() {
      U.clear(grid);
      if (!prog.gallery.length) {
        grid.appendChild(U.el('p.muted', { text: 'Nothing saved yet. Finish the Pixel Artist level or a Python project and it will appear here.' }));
        return;
      }
      prog.gallery.forEach(function (item) {
        var card = U.el('div.gallery-item');
        if (item.type === 'pixel' && item.cells) {
          card.appendChild(miniGrid(item));
        } else if (item.type === 'code') {
          card.appendChild(U.el('div', { style: { fontSize: '34px' }, text: '🐍' }));
        }
        card.appendChild(U.el('div.t', { text: item.title }));
        card.appendChild(U.el('div.muted', { style: { fontSize: '.75rem' }, text: new Date(item.createdAt).toLocaleDateString() }));
        card.appendChild(U.el('button.btn.small.danger', {
          text: 'Delete',
          onclick: function () { App.Progress.galleryRemove(item.id); render(); }
        }));
        if (item.type === 'code' && item.code) {
          card.appendChild(U.el('button.btn.small', {
            text: 'View code',
            onclick: function () {
              App.openModal(U.el('div.modalbox', {}, [
                U.el('h3', { text: item.title }),
                U.el('pre', { style: { background: '#2a2c3f', color: '#f1ecff', padding: '14px', borderRadius: '12px', overflow: 'auto' }, text: item.code })
              ]));
            }
          }));
        }
        grid.appendChild(card);
      });
    }
    render();

    U.mount(container, [
      U.el('div.runner-head', {}, [
        U.el('button.btn.icon.ghost', { text: '←', onclick: function () { App.go('#/map'); } }),
        U.el('h2', { style: { margin: 0 }, text: '🖼️ Gallery' })
      ]),
      grid
    ]);
  };

  function miniGrid(item) {
    var wrap = U.el('div.mini', { style: { gridTemplateColumns: 'repeat(' + item.w + ', 9px)' } });
    item.cells.forEach(function (c) {
      wrap.appendChild(U.el('i', { style: { background: c || '#f4ecdd' } }));
    });
    return wrap;
  }

  /* ------------------------------ settings ----------------------------- */

  Screens.settings = function (container) {
    var p = App.Progress.profile();
    var prog = App.Progress.get();
    var s = prog.settings || {};

    function toggle(key, label) {
      var btn = U.el('button.btn.ghost', {
        text: label + ': ' + (s[key] ? 'ON' : 'OFF'),
        onclick: function () {
          s[key] = !s[key];
          if (key === 'sound') App.audio.setEnabled(s.sound);
          if (key === 'largeText') document.body.classList.toggle('large-text', s.largeText);
          if (key === 'reducedMotion') document.body.classList.toggle('reduce-motion', s.reducedMotion);
          App.Progress.save();
          btn.textContent = label + ': ' + (s[key] ? 'ON' : 'OFF');
        }
      });
      return btn;
    }

    var nameInput = U.el('input', { type: 'text', value: p.name, maxlength: 24 });
    var avatars = U.el('div.avatar-picker');
    var chosenAvatar = p.avatar;
    App.store.AVATARS.forEach(function (a) {
      var b = U.el('button.avatar-opt' + (a === chosenAvatar ? '.on' : ''), {
        text: a,
        onclick: function () {
          chosenAvatar = a;
          avatars.querySelectorAll('.avatar-opt').forEach(function (n) { n.classList.remove('on'); });
          b.classList.add('on');
        }
      });
      avatars.appendChild(b);
    });

    var fileInput = U.el('input', {
      type: 'file', accept: 'application/json,.json',
      onchange: function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var imported = App.store.importProfile(JSON.parse(reader.result), { overwrite: false });
            App.toast('Imported profile: ' + imported.name);
            Screens.profiles(container);
          } catch (err) {
            App.toast('Could not read that file.');
          }
        };
        reader.readAsText(f);
      }
    });

    U.mount(container, [
      U.el('div.runner-head', {}, [
        U.el('button.btn.icon.ghost', { text: '←', onclick: function () { App.go('#/map'); } }),
        U.el('h2', { style: { margin: 0 }, text: '⚙️ Settings' })
      ]),

      U.el('div.card.pad', { style: { marginTop: '10px' } }, [
        U.el('h3', { text: 'Profile' }),
        U.el('label.field', {}, [U.el('span', { text: 'Name' }), nameInput]),
        U.el('label.field', {}, [U.el('span', { text: 'Avatar' }), avatars]),
        U.el('div.row.wrap', {}, [
          U.el('button.btn.primary', {
            text: 'Save',
            onclick: function () {
              App.store.updateProfile(p.id, { name: (nameInput.value || '').trim() || p.name, avatar: chosenAvatar });
              App.Progress.attach(App.store.getProfile(p.id));
              App.refreshChrome();
              App.toast('Saved ✓');
            }
          }),
          U.el('button.btn.ghost', { text: 'Switch profile', onclick: function () { App.go('#/profiles'); } })
        ])
      ]),

      U.el('div.card.pad', { style: { marginTop: '14px' } }, [
        U.el('h3', { text: 'Comfort' }),
        U.el('div.row.wrap', {}, [
          toggle('sound', 'Sound'),
          toggle('animation', 'Animations'),
          toggle('largeText', 'Bigger text'),
          toggle('reducedMotion', 'Less movement')
        ])
      ]),

      U.el('div.card.pad', { style: { marginTop: '14px' } }, [
        U.el('h3', { text: 'Backup' }),
        U.el('p.muted', { text: 'Everything is stored in this browser. Export a file to keep a copy or move to another device.' }),
        U.el('div.row.wrap', {}, [
          U.el('button.btn.ghost', {
            text: '⬇️ Export profile',
            onclick: function () {
              var data = JSON.stringify(App.store.exportProfile(p.id), null, 2);
              var blob = new Blob([data], { type: 'application/json' });
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'kidcoder-' + p.name.replace(/\s+/g, '-').toLowerCase() + '.json';
              a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
            }
          }),
          fileInput
        ]),
        U.el('div.muted', { style: { marginTop: '10px', fontSize: '.85rem' }, text: 'Approximate space used: ' + Math.round(App.store.estimateBytes() / 1024) + ' KB' })
      ]),

      U.el('div.card.pad', { style: { marginTop: '14px' } }, [
        U.el('h3', { text: 'Danger zone' }),
        U.el('div.row.wrap', {}, [
          U.el('button.btn.danger', {
            text: 'Reset all progress for this profile',
            onclick: function () {
              if (window.confirm('Erase XP, stars, badges and gallery for ' + p.name + '?')) {
                App.Progress.reset(p.id);
                App.Progress.attach(p);
                App.refreshChrome();
                App.toast('Progress reset');
              }
            }
          }),
          U.el('button.btn.danger', {
            text: 'Delete this profile',
            onclick: function () {
              if (window.confirm('Delete ' + p.name + ' completely?')) {
                App.store.deleteProfile(p.id);
                App.go('#/profiles');
              }
            }
          })
        ])
      ]),

      U.el('div.card.pad', { style: { marginTop: '14px' } }, [
        U.el('h3', { text: 'About' }),
        U.el('p.muted', { text: 'KidCoder Lab is an offline-first learning platform. It runs entirely in the browser: no account, no server, no tracking. Python is executed by a small built-in engine designed for the subset taught here.' })
      ])
    ]);
  };

  Screens.level = function (container, levelId) {
    App.Runner.render(container, levelId);
  };
})(window.App);
