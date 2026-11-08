import { formatTime, clamp } from './util.js';
import { World, BUILDINGS, MAP, CAMPFIRE, POND } from './world.js';
import { WEAPONS } from './entities.js';
import { Input } from './input.js';
import { Audio } from './audio.js';

const $ = id => document.getElementById(id);

export const UI = {
  game: null,
  screen: 'title',
  controlsReturn: 'title',
  cards: [],
  cardHandler: null,
  bannerTimer: 0,
  minimapBase: null,
  last: {},

  init(game) {
    this.game = game;
    this.refs = {
      hud: $('hud'), title: $('title-screen'), controls: $('controls-screen'),
      levelup: $('levelup-screen'), pause: $('pause-screen'), over: $('gameover-screen'),
      touch: $('touch-ui'), loading: $('loading'),
      banner: $('wave-banner'), bannerSmall: $('banner-small'), bannerBig: $('banner-big'),
      prompt: $('prompt'), promptText: $('prompt-text'), toasts: $('toasts'),
      rickLevel: $('rick-level'), rickHpFill: $('rick-hp-fill'), rickHpText: $('rick-hp-text'),
      rickXpFill: $('rick-xp-fill'), rickArmor: $('rick-armor'),
      buffDmg: $('buff-dmg'), buffSpd: $('buff-spd'),
      louLevel: $('lou-level'), louHpFill: $('lou-hp-fill'), louState: $('lou-state'),
      safiLevel: $('safi-level'), safiHpFill: $('safi-hp-fill'), safiState: $('safi-state'),
      louCard: $('dog-card-lou'), safiCard: $('dog-card-safi'),
      waveNum: $('wave-num'), waveEnemies: $('wave-enemies'), waveTimer: $('wave-timer'),
      score: $('score'), weaponName: $('weapon-name'), ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'),
      reloadBar: $('reload-bar'), reloadFill: $('reload-fill'), dashFill: $('dash-fill'),
      bossBar: $('boss-bar'), bossFill: $('boss-fill'),
      bestWave: $('best-wave'), bestScore: $('best-score'),
      goWave: $('go-wave'), goKills: $('go-kills'), goScore: $('go-score'), goTime: $('go-time'), goRecord: $('go-record'),
      cards: $('cards'), levelupLevel: $('levelup-level'),
      pauseWave: $('pause-wave'), pauseScore: $('pause-score'), pauseKills: $('pause-kills'), pauseTime: $('pause-time'),
      minimap: $('minimap'), touchUI: $('touch-ui'),
    };
    this.bindControls();
    this.buildMinimapBase();
    const best = this.loadBest();
    this.refs.bestWave.textContent = best.wave;
    this.refs.bestScore.textContent = best.score.toLocaleString('de-DE');
    this.soundLabel();
  },

  bindControls() {
    const g = this.game;
    $('btn-play').addEventListener('click', () => g.startRun());
    $('btn-controls').addEventListener('click', () => { this.controlsReturn = 'title'; this.show('controls'); });
    $('btn-controls-back').addEventListener('click', () => this.show(this.controlsReturn));
    $('btn-sound').addEventListener('click', () => this.toggleSound());
    $('btn-pause-mute').addEventListener('click', () => this.toggleSound());
    $('btn-resume').addEventListener('click', () => g.resume());
    $('btn-pause-controls').addEventListener('click', () => { this.controlsReturn = 'pause'; this.show('controls'); });
    $('btn-pause-restart').addEventListener('click', () => g.startRun());
    $('btn-restart').addEventListener('click', () => g.startRun());
    $('btn-menu').addEventListener('click', () => g.toMenu());
    $('btn-sound') && $('btn-sound').addEventListener('click', () => Audio.resume());

    // touch sticks
    const stick = (el, thumb, cb) => {
      let active = null, id = null;
      const update = e => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        let dx = e.clientX - cx, dy = e.clientY - cy;
        const max = r.width * .38;
        const len = Math.hypot(dx, dy);
        if (len > max) { dx = dx / len * max; dy = dy / len * max; }
        thumb.style.transform = `translate(${dx}px, ${dy}px)`;
        cb(dx / max, dy / max, true);
      };
      el.addEventListener('pointerdown', e => {
        e.preventDefault(); active = el; id = e.pointerId;
        el.setPointerCapture(id); update(e);
      });
      el.addEventListener('pointermove', e => { if (active && e.pointerId === id) update(e); });
      const end = e => {
        if (!active || e.pointerId !== id) return;
        active = null; id = null;
        thumb.style.transform = 'translate(0px,0px)';
        cb(0, 0, false);
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    const moveKnob = document.querySelector('#stick-move .stick-knob');
    const aimKnob = document.querySelector('#stick-aim .stick-knob');
    stick($('stick-move'), moveKnob, (x, y, on) => {
      Input.touch.moveX = on ? x : 0;
      Input.touch.moveY = on ? y : 0;
    });
    stick($('stick-aim'), aimKnob, (x, y, on) => {
      Input.touch.aimX = on ? x : 0;
      Input.touch.aimY = on ? y : 0;
      Input.touch.aimActive = on && Math.hypot(x, y) > .2;
      Input.touch.fire = on && Math.hypot(x, y) > .2;
    });
    const dash = $('touch-dash'), reload = $('touch-reload'), use = $('touch-use');
    dash.addEventListener('pointerdown', e => { e.preventDefault(); Input.touch.dash = true; Audio.resume(); });
    reload.addEventListener('pointerdown', e => { e.preventDefault(); Input.touch.reload = true; });
    use.addEventListener('pointerdown', e => { e.preventDefault(); Input.touch.use = true; });
  },

  toggleSound() {
    Audio.init();
    Audio.setMuted(!Audio.muted);
    this.soundLabel();
  },
  soundLabel() {
    const label = Audio.muted ? 'SOUND: AUS' : 'SOUND: AN';
    if ($('btn-sound')) $('btn-sound').textContent = label;
    if ($('btn-pause-mute')) $('btn-pause-mute').textContent = label;
  },

  show(name) {
    this.screen = name;
    const map = { title: 'title', controls: 'controls', levelup: 'levelup', pause: 'pause', gameover: 'over', none: null };
    for (const key of ['title', 'controls', 'levelup', 'pause', 'over']) {
      if (this.refs[key]) this.refs[key].classList.add('hidden');
    }
    const key = map[name];
    if (key && this.refs[key]) this.refs[key].classList.remove('hidden');
    const inGame = ['none', 'levelup', 'pause'].includes(name);
    this.refs.hud.classList.toggle('hidden', !inGame);
    this.refs.touchUI.classList.toggle('hidden', !(inGame && Input.isTouch));
    document.body.classList.toggle('in-game', inGame);
  },

  hideLoading() { this.refs.loading.classList.add('hidden'); },

  update(dt, game) {
    if (!this.refs) return;
    this.updateBanner(dt);
    if (!['none', 'levelup', 'pause'].includes(this.screen)) return;
    const p = game.player;
    if (!p) return;
    const r = this.refs;
    r.rickLevel.textContent = 'LV ' + p.level;
    r.rickHpFill.style.width = clamp(p.hp / p.maxHp * 100, 0, 100) + '%';
    r.rickHpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    r.rickHpFill.parentElement.classList.toggle('low', p.hp / p.maxHp < .3);
    r.rickXpFill.style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    r.rickArmor.textContent = '◈ ' + Math.round(p.shield);
    r.rickArmor.classList.toggle('hidden', p.shield <= 0);
    r.buffDmg.classList.toggle('hidden', p.damageBuff <= 0);
    r.buffSpd.classList.toggle('hidden', p.speedBuff <= 0);

    const dogInfo = (dog, levelEl, fillEl, stateEl, card) => {
      levelEl.textContent = 'LV ' + dog.level;
      fillEl.style.width = clamp(dog.hp / dog.maxHp * 100, 0, 100) + '%';
      const downed = dog.state === 'downed';
      stateEl.textContent = downed ? `VERLETZT ${Math.ceil(dog.downTimer)}s` : dog.target ? 'KÄMPFT' : 'WACH';
      stateEl.classList.toggle('down', downed);
      card.classList.toggle('downed', downed);
    };
    dogInfo(game.dogs[0], r.louLevel, r.louHpFill, r.louState, r.louCard);
    dogInfo(game.dogs[1], r.safiLevel, r.safiHpFill, r.safiState, r.safiCard);

    const w = p.weapon;
    r.weaponName.textContent = w.name;
    r.ammoMag.textContent = w.mag;
    r.ammoReserve.textContent = w.reserve === Infinity ? '/ ∞' : '/ ' + w.reserve;
    r.ammoMag.parentElement.classList.toggle('empty', w.mag === 0);
    r.reloadBar.classList.toggle('hidden', p.reloading <= 0);
    if (p.reloading > 0) r.reloadFill.style.width = (100 - p.reloading / (p.reloadDuration || 1) * 100) + '%';
    const slots = ['pistol', 'shotgun', 'smg', 'rifle'];
    document.querySelectorAll('.slot').forEach((el, i) => {
      el.classList.toggle('active', slots[i] === p.current);
      el.classList.toggle('locked', !p.weapons[slots[i]]);
      if (p.weapons[slots[i]]) el.textContent = `${i + 1} · ${WEAPONS[slots[i]].short}`;
    });
    r.dashFill.style.transform = `scaleY(${clamp(p.dashCd / (p.dashCdMax * p.upgrades.dashCd), 0, 1)})`;
    if (p.dashCd <= 0) r.dashFill.style.background = 'rgba(227,161,60,.55)';
    else r.dashFill.style.background = 'rgba(227,161,60,.18)';

    // wave / score
    const remaining = game.zombies.length + game.pendingSpawns;
    r.waveNum.textContent = game.wave;
    r.waveEnemies.textContent = `${remaining} GEGNER`;
    r.waveTimer.textContent = formatTime(game.runTime);
    r.score.textContent = game.score.toLocaleString('de-DE');
    const boss = game.zombies.find(z => z.isBoss && !z.dead);
    r.bossBar.classList.toggle('hidden', !boss);
    if (boss) r.bossFill.style.width = clamp(boss.hp / boss.maxHp * 100, 0, 100) + '%';

    this.drawMinimap(game);
  },

  banner(small, big, duration = 2.4) {
    const r = this.refs;
    r.bannerSmall.textContent = small;
    r.bannerBig.textContent = big;
    r.banner.classList.add('show');
    this.bannerTimer = duration;
  },
  updateBanner(dt) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.refs.banner.classList.remove('show');
    }
  },

  toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + cls;
    el.innerHTML = text;
    this.refs.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3200);
    const kids = this.refs.toasts.children;
    while (kids.length > 5) kids[0].remove();
  },

  prompt(text) {
    if (this.last.prompt === text) return;
    this.last.prompt = text;
    const el = this.refs.prompt;
    if (!text) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    this.refs.promptText.textContent = text;
  },

  showLevelUp(level, cards, onPick) {
    this.refs.levelupLevel.textContent = level;
    this.cards = cards;
    this.cardHandler = onPick;
    const wrap = this.refs.cards;
    wrap.innerHTML = '';
    cards.forEach((card, i) => {
      const el = document.createElement('button');
      el.className = 'card';
      el.style.setProperty('--accent', card.accent || '#e3a13c');
      el.innerHTML = `<div class="card-cat">${card.cat}</div>
        <div class="card-icon">${card.icon}</div>
        <h3>${card.title}</h3>
        <p>${card.desc}</p>
        <div class="card-foot"><span class="card-key"><kbd>${i + 1}</kbd> WÄHLEN</span><span class="card-stat">${card.stat || ''}</span></div>`;
      el.addEventListener('click', () => this.pickCard(i));
      wrap.appendChild(el);
    });
    this.show('levelup');
  },
  pickCard(i) {
    if (!this.cardHandler || !this.cards[i]) return;
    const cb = this.cardHandler;
    this.cardHandler = null;
    cb(i);
  },
  hideLevelUp() { this.show('none'); },

  updatePause(game) {
    this.refs.pauseWave.textContent = game.wave;
    this.refs.pauseScore.textContent = game.score.toLocaleString('de-DE');
    this.refs.pauseKills.textContent = game.kills;
    this.refs.pauseTime.textContent = formatTime(game.runTime);
    this.soundLabel();
  },

  updateGameOver(game, isRecord) {
    this.refs.goWave.textContent = game.wave;
    this.refs.goKills.textContent = game.kills;
    this.refs.goScore.textContent = game.score.toLocaleString('de-DE');
    this.refs.goTime.textContent = formatTime(game.runTime);
    this.refs.goRecord.classList.toggle('hidden', !isRecord);
  },

  loadBest() {
    try { return JSON.parse(localStorage.getItem('garath-best')) || { wave: 1, score: 0 }; }
    catch { return { wave: 1, score: 0 }; }
  },
  saveBest(wave, score) {
    const prev = this.loadBest();
    const next = { wave: Math.max(prev.wave, wave), score: Math.max(prev.score, score) };
    try { localStorage.setItem('garath-best', JSON.stringify(next)); } catch { }
    this.refs.bestWave.textContent = next.wave;
    this.refs.bestScore.textContent = next.score.toLocaleString('de-DE');
    return score > prev.score;
  },

  buildMinimapBase() {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 190;
    const x = c.getContext('2d');
    const s = 240 / MAP.w;
    const oy = (190 - MAP.h * s) / 2;
    x.fillStyle = '#101710'; x.fillRect(0, 0, 240, 190);
    x.save(); x.translate(0, oy); x.scale(s, s);
    // forest base
    x.fillStyle = '#1d2819'; x.fillRect(0, 0, MAP.w, MAP.h);
    // road
    x.fillStyle = '#3a3d36'; x.fillRect(0, 250, MAP.w, 190);
    // paths
    x.strokeStyle = '#4a402c'; x.lineWidth = 110; x.lineCap = 'round'; x.lineJoin = 'round';
    for (const path of [
      [[1750, 430], [1750, 720], [1715, 1030], [1750, 1420]],
      [[1750, 1420], [1470, 1385], [1230, 1295], [1000, 1195]],
      [[1750, 1420], [2050, 1475], [2350, 1512], [2450, 1512]],
      [[1750, 1420], [1650, 1690], [1360, 1870], [1060, 1960]],
    ]) {
      x.beginPath(); x.moveTo(path[0][0], path[0][1]);
      for (const pt of path.slice(1)) x.lineTo(pt[0], pt[1]);
      x.stroke();
    }
    // pond
    x.fillStyle = '#1c3436'; x.beginPath(); x.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, Math.PI * 2); x.fill();
    // buildings
    for (const b of BUILDINGS) {
      x.fillStyle = '#59492e'; x.fillRect(b.x, b.y, b.w, b.h);
      x.strokeStyle = 'rgba(227,161,60,.55)'; x.lineWidth = 12; x.strokeRect(b.x, b.y, b.w, b.h);
    }
    // trees hint
    x.fillStyle = 'rgba(60,86,48,.5)';
    for (const t of World.trees) { x.beginPath(); x.arc(t.x, t.y, t.r * .55, 0, Math.PI * 2); x.fill(); }
    // campfire
    x.fillStyle = '#e8973c'; x.beginPath(); x.arc(CAMPFIRE.x, CAMPFIRE.y, 45, 0, Math.PI * 2); x.fill();
    x.restore();
    this.minimapBase = c;
    this.minimapScale = s;
    this.minimapOffset = oy;
  },

  drawMinimap(game) {
    const c = this.refs.minimap;
    if (!c) return;
    const x = c.getContext('2d');
    x.clearRect(0, 0, 240, 190);
    x.drawImage(this.minimapBase, 0, 0);
    const s = this.minimapScale, oy = this.minimapOffset;
    const px = game.player.x * s, py = game.player.y * s + oy;
    // viewport
    x.strokeStyle = 'rgba(222,217,199,.12)'; x.lineWidth = 1;
    const vw = game.vw / game.cam.zoom * s, vh = game.vh / game.cam.zoom * s;
    x.strokeRect(px - vw / 2, py - vh / 2, vw, vh);
    // pickups
    x.fillStyle = '#ffd27a';
    for (const pk of game.pickups) { x.beginPath(); x.arc(pk.x * s, pk.y * s + oy, 1.8, 0, Math.PI * 2); x.fill(); }
    // zombies
    for (const z of game.zombies) {
      const d = Math.hypot(z.x - game.player.x, z.y - game.player.y);
      x.fillStyle = z.isBoss ? '#ff7a4a' : d < 700 ? 'rgba(220,80,60,.9)' : 'rgba(220,80,60,.35)';
      x.beginPath(); x.arc(z.x * s, z.y * s + oy, z.isBoss ? 3.4 : 1.9, 0, Math.PI * 2); x.fill();
    }
    // dogs
    for (const d of game.dogs) {
      x.fillStyle = d.state === 'downed' ? '#a05a44' : d.variant === 'lou' ? '#b98853' : '#eee7d4';
      x.beginPath(); x.arc(d.x * s, d.y * s + oy, 2.3, 0, Math.PI * 2); x.fill();
    }
    // player arrow
    x.save(); x.translate(px, py); x.rotate(game.player.angle + Math.PI / 2);
    x.fillStyle = '#ffe0a0';
    x.beginPath(); x.moveTo(0, -5); x.lineTo(3.6, 4); x.lineTo(0, 2); x.lineTo(-3.6, 4); x.closePath(); x.fill();
    x.restore();
    // boss marker
    for (const z of game.zombies) if (z.isBoss) {
      x.strokeStyle = 'rgba(255,110,70,.7)'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(z.x * s, z.y * s + oy, 6, 0, Math.PI * 2); x.stroke();
    }
  },
};
