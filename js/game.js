import { TAU, clamp, damp, dist, dist2, lerp, rand, randInt, chance, choice, shuffle } from './util.js';
import { World, MAP, CAMPFIRE, PLAYER_START, BUILDINGS } from './world.js';
import { Player, Dog, Zombie, Bullet, Pickup, WEAPONS } from './entities.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';

const TAU2 = Math.PI * 2;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.zoom = 1;
    this.cam = { x: CAMPFIRE.x, y: CAMPFIRE.y, zoom: 1, shake: 0 };
    this.time = 0;
    this.runTime = 0;
    this.state = 'loading';
    this.paused = false;
    this.score = 0;
    this.kills = 0;
    this.wave = 1;
    this.pendingSpawns = 0;
    this.spawnTimer = 0;
    this.waveActive = false;
    this.intermission = 0;
    this.waveQueue = 0;
    this.pendingLevelUps = 0;
    this.leveling = false;
    this.aimWorld = { x: 0, y: 0 };
    this.scrollDelta = 0;
    this.hurtFlash = 0;
    this.supplyTimer = 40;
    this.bullets = [];
    this.zombies = [];
    this.pickups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.afterimages = [];
    this.telegraphs = [];
    this.shockwaves = [];
    this.crates = [];
    this.decals = [];
    this.menuAngle = 0;
    this.player = null;
    this.dogs = [];
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.lightScale = .5;
    this.boundLoop = this.loop.bind(this);
    this.fog = Array.from({ length: 7 }, () => ({ x: rand(0, 2000), y: rand(0, 1400), r: rand(260, 620), s: rand(3, 10), a: rand(.02, .05) }));
    this.fireflies = Array.from({ length: 34 }, () => ({ x: rand(0, 1600), y: rand(0, 1000), p: rand(0, TAU), s: rand(.2, .8) }));
    this.fpsSmoothed = 60;
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.canvas.addEventListener('wheel', e => { this.scrollDelta = Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    Input.init(this.canvas);
    World.init();
    UI.init(this);
    this.setupMenuScene();
    this.state = 'title';
    UI.show('title');
    UI.hideLoading();
    requestAnimationFrame(this.boundLoop);
  }

  resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
    this.zoom = clamp(Math.max(this.vw / 1250, this.vh / 1250), 0.52, 1.32);
    this.cam.zoom = this.zoom;
    this.lightCanvas.width = Math.round(this.vw * this.lightScale);
    this.lightCanvas.height = Math.round(this.vh * this.lightScale);
    if (!Input.mouse.x) { Input.mouse.x = this.vw / 2; Input.mouse.y = this.vh / 2; }
  }

  setupMenuScene() {
    this.player = new Player(PLAYER_START.x, PLAYER_START.y);
    this.player.angle = -0.4;
    this.dogs = [
      new Dog('Lou', 'lou', PLAYER_START.x - 58, PLAYER_START.y + 42, 'lou'),
      new Dog('Safi', 'safi', PLAYER_START.x + 46, PLAYER_START.y + 52, 'safi'),
    ];
    this.dogs[0].angle = -0.2; this.dogs[1].angle = 0.2;
    this.menuZombies = [];
    for (const [x, y, a] of [[2180, 1610, 3.4], [1320, 1240, .6], [2050, 1280, 2.8]]) {
      const z = new Zombie(x, y, 'walker', 1); z.angle = a; z.spawn = 0; z.walk = rand(0, 6);
      this.menuZombies.push(z);
    }
    this.zombies = this.menuZombies;
    this.bullets = []; this.pickups = []; this.particles = [];
  }

  startRun() {
    Audio.init();
    Audio.resume();
    this.state = 'playing';
    this.runTime = 0;
    this.score = 0;
    this.kills = 0;
    this.wave = 1;
    this.pendingSpawns = 0;
    this.spawnTimer = 0;
    this.waveActive = false;
    this.intermission = .45;
    this.pendingLevelUps = 0;
    this.leveling = false;
    this.bullets = [];
    this.zombies = [];
    this.pickups = [];
    this.particles = [];
    this.floatingTexts = [];
    this.afterimages = [];
    this.telegraphs = [];
    this.shockwaves = [];
    this.decals = [];
    this.supplyTimer = 42;
    this.hurtFlash = 0;
    this.menuZombies = [];
    this.player = new Player(PLAYER_START.x, PLAYER_START.y);
    this.player.angle = -0.2;
    this.dogs = [
      new Dog('Lou', 'lou', PLAYER_START.x - 55, PLAYER_START.y + 38, 'lou'),
      new Dog('Safi', 'safi', PLAYER_START.x + 48, PLAYER_START.y + 45, 'safi'),
    ];
    this.crates = [
      { x: 612, y: 1022, type: 'weapon', weapon: 'shotgun', label: 'FORSTFLINTE', opened: false },
      { x: 3152, y: 1862, type: 'weapon', weapon: 'smg', label: 'MP GARATH', opened: false },
      { x: 2168, y: 655, type: 'weapon', weapon: 'rifle', label: 'JAGDGEWEHR', opened: false },
      { x: 1945, y: 1490, type: 'supply', label: 'VORRÄTE', opened: false },
    ];
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.cam.shake = 0;
    UI.show('none');
    UI.banner('GARATHER WALD · 22:47', 'ÜBERLEBE DIE NACHT', 3.2);
    UI.toast('Halte <b>E</b> gedrückt, um Lou und Safi wiederzubeleben.', 'dog');
    this.addFireBurst(this.player.x, this.player.y, 8);
    this.startWave(1);
  }

  toMenu() {
    this.state = 'title';
    Audio.resume();
    this.setupMenuScene();
    UI.show('title');
  }

  startWave(n) {
    this.wave = n;
    this.waveActive = true;
    this.pendingSpawns = 6 + Math.round(n * 3.4);
    this.spawnTimer = 0;
    this.intermission = 0;
    this.waveQueue = this.pendingSpawns;
    const boss = n % 5 === 0;
    UI.banner(`WELLE ${n}`, boss ? 'DER KOLOSS ERWACHT' : n === 1 ? 'DIE HERDE KOMMT' : 'SIE RIECHEN EUCH', 2.6);
    Audio.wave();
    if (boss) {
      this.pendingSpawns += 0;
      setTimeout(() => this.spawnBoss(n), 1100);
    }
    if (n === 1) {
      for (let i = 0; i < 2; i++) this.spawnZombieAt(rand(0, TAU2));
      this.pendingSpawns -= 2;
    }
  }

  spawnBoss(n) {
    if (this.state !== 'playing') return;
    const a = rand(0, TAU2);
    const pos = this.findSpawn(a, 720);
    const z = new Zombie(pos.x, pos.y, 'boss', n);
    this.zombies.push(z);
    this.spawnTimer = 2.5;
    Audio.bossRoar();
    this.shake(14);
    UI.banner('WARNUNG', 'DER KOLOSS VON GARATH', 3.2);
  }

  findSpawn(angleBias, minDist = 680) {
    for (let i = 0; i < 60; i++) {
      const a = angleBias + rand(-.7, .7);
      const d = rand(minDist, minDist + 360);
      const x = clamp(this.player.x + Math.cos(a) * d, 80, MAP.w - 80);
      const y = clamp(this.player.y + Math.sin(a) * d, 80, MAP.h - 80);
      if (World.insideBuilding(x, y)) continue;
      if (World.isBlocked(x, y, 22)) continue;
      if (dist2(x, y, this.player.x, this.player.y) < (minDist * .8) ** 2) continue;
      return { x, y };
    }
    const sp = choice(World.spawns);
    return { x: sp[0], y: sp[1] };
  }

  spawnZombieAt(a) {
    const pos = this.findSpawn(a, 620);
    this.spawnZombie(pos.x, pos.y);
    return pos;
  }

  spawnZombie(x, y) {
    const w = this.wave;
    let type = 'walker';
    const r = Math.random();
    if (w >= 3 && r < .16) type = 'brute';
    else if (w >= 2 && r < .50) type = 'runner';
    const lvl = 1 + (w - 1) * .7;
    const z = new Zombie(x, y, type, lvl);
    this.zombies.push(z);
    return z;
  }

  spawnDrops(x, y, count = 1, forceType = null) {
    const types = ['medkit', 'ammo', 'adrenaline', 'speed', 'shield', 'treat'];
    for (let i = 0; i < count; i++) {
      const type = forceType || choice(types);
      const a = rand(0, TAU2), d = rand(12, 34);
      this.pickups.push(new Pickup(x + Math.cos(a) * d, y + Math.sin(a) * d, type));
    }
  }

  addFireBurst(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU2), s = rand(20, 80);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(1, 2.5), life: rand(.15, .35), maxLife: .35, color: 'rgba(255,200,120,', type: 'spark' });
    }
  }

  // ===================== LOOP =====================
  loop(ts) {
    requestAnimationFrame(this.boundLoop);
    const now = ts / 1000;
    if (!this.lastTs) this.lastTs = now;
    let dt = Math.min(now - this.lastTs, .05);
    this.lastTs = now;
    this.time += dt;
    this.fpsSmoothed = lerp(this.fpsSmoothed, 1 / Math.max(.001, now - (this.prevNow || now)), .05);
    this.prevNow = now;
    Input.pollGamepad();

    // global keys
    if (Input.hit('KeyM')) UI.toggleSound();
    if (this.state === 'playing') {
      if (Input.hit('Escape') || Input.hit('KeyP') || Input.pad.start) this.pauseGame();
      else this.update(dt);
    } else if (this.state === 'paused') {
      if (Input.hit('Escape') || Input.hit('KeyP') || Input.pad.start) this.resume();
    } else if (this.state === 'levelup') {
      for (let i = 0; i < 3; i++) if (Input.hit('Digit' + (i + 1)) || Input.hit('Numpad' + (i + 1))) UI.pickCard(i);
    } else if (this.state === 'title') {
      this.updateMenu(dt);
      if (Input.hit('Enter') || Input.hit('Space')) this.startRun();
    } else if (this.state === 'gameover') {
      if (Input.hit('Enter')) this.startRun();
    }

    UI.update(dt, this);
    Input.endFrame();
    this.render();
  }

  updateMenu(dt) {
    this.menuAngle += dt * .07;
    const p = this.player;
    p.walk += dt * 1.2;
    p.angle = damp(p.angle, Math.sin(this.menuAngle) * .6 - .1, 2, dt);
    this.dogs.forEach((d, i) => {
      d.walk += dt * (i ? 2.4 : 1.8);
      d.angle = damp(d.angle, Math.sin(this.menuAngle * 1.3 + i) * .5, 2, dt);
    });
    const targetX = CAMPFIRE.x + Math.cos(this.menuAngle * .55) * 120;
    const targetY = CAMPFIRE.y + Math.sin(this.menuAngle * .42) * 70;
    this.cam.x = damp(this.cam.x, targetX, 1.2, dt);
    this.cam.y = damp(this.cam.y, targetY - 20, 1.2, dt);
    this.cam.zoom = damp(this.cam.zoom, 1.06, 2, dt);
    this.updateParticles(dt);
    this.spawnCampfireParticles(dt);
    this.updateFireflies(dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
  }

  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    UI.updatePause(this);
    UI.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    Audio.resume();
    this.state = 'playing';
    UI.show('none');
  }

  // ===================== UPDATE =====================
  update(dt) {
    this.runTime += dt;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);
    this.supplyTimer -= dt;
    this.player.update(dt, this);
    this.dogs.forEach(d => d.update(dt, this));
    for (const z of this.zombies) z.update(dt, this);
    for (const b of this.bullets) b.update(dt, this);
    for (const p of this.pickups) p.update(dt, this);

    this.zombies = this.zombies.filter(z => !z.dead);
    this.bullets = this.bullets.filter(b => !b.dead);
    this.pickups = this.pickups.filter(p => !p.dead);
    this.decals = this.decals.filter(d => d.life === undefined || d.life > 0);

    this.updateWave(dt);
    this.updateInteractions();
    this.updateParticles(dt);
    this.updateFireflies(dt);
    this.spawnCampfireParticles(dt);

    if (this.supplyTimer <= 0) {
      this.supplyTimer = 48 + rand(0, 14);
      const a = rand(0, TAU2);
      for (let i = 0; i < 14; i++) {
        const x = this.player.x + Math.cos(a + i) * 110, y = this.player.y + Math.sin(a + i) * 110;
        if (!World.isBlocked(x, y, 16)) { this.spawnDrops(x, y, 1); this.ring(x, y, 26, 'rgba(255,210,122,'); break; }
      }
    }

    // camera
    const p = this.player;
    const look = 74;
    const aim = this.getAim(p);
    const tx = p.x + Math.cos(aim ?? p.angle) * look;
    const ty = p.y + Math.sin(aim ?? p.angle) * look;
    this.cam.x = damp(this.cam.x, tx, 6, dt);
    this.cam.y = damp(this.cam.y, ty, 6, dt);
    const halfW = this.vw / (2 * this.zoom), halfH = this.vh / (2 * this.zoom);
    this.cam.x = halfW * 2 > MAP.w ? MAP.w / 2 : clamp(this.cam.x, halfW, MAP.w - halfW);
    this.cam.y = halfH * 2 > MAP.h ? MAP.h / 2 : clamp(this.cam.y, halfH, MAP.h - halfH);
    this.cam.zoom = damp(this.cam.zoom, this.zoom, 5, dt);
    this.cam.shake = Math.max(0, this.cam.shake - dt * 26);
    this.afterimages = this.afterimages.filter(a => (a.life -= dt) > 0);
    this.telegraphs = this.telegraphs.filter(t => (t.life -= dt) > 0);
    this.shockwaves = this.shockwaves.filter(s => (s.life -= dt) > 0);
    for (const s of this.shockwaves) s.r = lerp(s.r, s.maxR, 1 - Math.exp(-8 * dt));

    if (p.hp > 0 && p.shield <= 0 && p.hitFlash > 0) { /* handled */ }
  }

  updateWave(dt) {
    if (!this.waveActive) {
      this.intermission -= dt;
      if (this.intermission <= 0) this.startWave(this.wave + 1);
      return;
    }
    const alive = this.zombies.length;
    if (this.pendingSpawns > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0 && alive < 34 + Math.min(16, this.wave)) {
        const burst = this.pendingSpawns > 4 && Math.random() < .38 ? 2 : 1;
        for (let i = 0; i < burst && this.pendingSpawns > 0; i++) {
          this.spawnZombieAt(rand(0, TAU2));
          this.pendingSpawns--;
        }
        this.spawnTimer = Math.max(.22, 1.02 - this.wave * .04) * rand(.75, 1.25);
      }
    }
    if (this.pendingSpawns <= 0 && this.zombies.length === 0) {
      this.waveActive = false;
      this.intermission = 9;
      this.score += this.wave * 35;
      this.player.heal(this.wave % 5 === 0 ? 30 : 14);
      this.dogs.forEach(d => { if (d.state !== 'downed') d.heal(30); });
      UI.banner(`WELLE ${this.wave}`, 'ÜBERSTANDEN', 2.8);
      UI.toast(`Welle ${this.wave} überstanden · <b>+${this.wave * 35}</b> Punkte`);
      this.spawnDrops(this.player.x + rand(-60, 60), this.player.y + rand(-60, 60), 2);
      Audio.levelup();
    }
  }

  updateInteractions() {
    const p = this.player;
    let best = null, bd = 1e9, kind = null;
    for (const c of this.crates) {
      if (c.opened) continue;
      const d = dist2(p.x, p.y, c.x, c.y);
      if (d < 82 * 82 && d < bd) { bd = d; best = c; kind = 'crate'; }
    }
    for (const d of this.dogs) {
      if (d.state === 'downed') {
        const dd = dist2(p.x, p.y, d.x, d.y);
        if (dd < 74 * 74 && dd < bd) { bd = dd; best = d; kind = 'dog'; }
      }
    }
    this.interactTarget = best;
    this.interactKind = kind;
    if (!best) { UI.prompt(''); return; }
    if (kind === 'crate') {
      const done = best.type === 'weapon' ? 'Waffe nehmen' : 'Vorräte öffnen';
      UI.prompt(`${done} · ${best.label}`);
    } else {
      UI.prompt(`${best.name} wiederbeleben · ${Math.ceil(best.downTimer)}s`);
    }
    if (Input.hit('KeyE') || Input.touch.use || Input.pad.use) {
      if (kind === 'crate') this.openCrate(best);
      else best.revive(this, .6);
      this.interactTarget = null;
      UI.prompt('');
    }
  }

  openCrate(crate) {
    crate.opened = true;
    this.score += 45;
    Audio.pickup();
    this.ring(crate.x, crate.y, 34, 'rgba(255,210,122,');
    this.addFireBurst(crate.x, crate.y, 10);
    if (crate.type === 'weapon') {
      this.player.addWeapon(crate.weapon, this);
      this.floatingText(crate.x, crate.y - 16, crate.label, '#ffd27a');
    } else {
      this.spawnDrops(crate.x, crate.y, 3);
      this.player.heal(20);
      this.toast('VORRÄTE GEFUNDEN');
    }
  }

  // ===================== AIM / LEVEL =====================
  getAim(player) {
    if (!player) return null;
    if (Input.touch.aimActive) return Math.atan2(Input.touch.aimY, Input.touch.aimX);
    if (Input.pad.aimActive) return Math.atan2(Input.pad.aimY, Input.pad.aimX);
    const mouseAim = (Input.mouse.x || !Input.isTouch) && !Input.pad.fire ? null : null;
    const useMouse = !Input.isTouch && !Input.pad.aimActive;
    if (useMouse) {
      const w = this.screenToWorld(Input.mouse.x, Input.mouse.y);
      this.aimWorld = w;
      return Math.atan2(w.y - player.y, w.x - player.x);
    }
    if (Input.pad.fire) {
      let best = null, bd = 560 * 560;
      for (const z of this.zombies) {
        if (z.dead) continue;
        const d = dist2(player.x, player.y, z.x, z.y);
        if (d < bd) { bd = d; best = z; }
      }
      if (best) return Math.atan2(best.y - player.y, best.x - player.x);
      const mv = Math.hypot(Input.pad.moveX, Input.pad.moveY);
      if (mv > .2) return Math.atan2(Input.pad.moveY, Input.pad.moveX);
    }
    if (Input.isTouch) {
      if (player.moving) return player.angle;
      return player.angle;
    }
    return player.angle;
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.vw / 2) / this.cam.zoom + this.cam.x,
      y: (sy - this.vh / 2) / this.cam.zoom + this.cam.y,
    };
  }

  gainXp(n) {
    const p = this.player;
    p.xp += n;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(90 * Math.pow(1.24, p.level - 1));
      this.pendingLevelUps++;
    }
    if (this.pendingLevelUps > 0 && this.state === 'playing' && !this.leveling) this.openLevelUp();
  }

  makeCards() {
    const pool = this.upgradePool();
    return shuffle(pool).slice(0, 3);
  }

  openLevelUp() {
    this.leveling = true;
    this.state = 'levelup';
    this.cam.shake = 0;
    Audio.levelup();
    const cards = this.makeCards();
    UI.showLevelUp(this.player.level, cards, i => this.pickUpgrade(i, cards));
  }

  pickUpgrade(i, cards) {
    const card = cards[i];
    if (card) card.apply(this);
    this.pendingLevelUps = Math.max(0, this.pendingLevelUps - 1);
    Audio.powerup();
    UI.toast(`<b>${card ? card.title : 'Verbesserung'}</b> gewählt`);
    if (this.pendingLevelUps > 0) {
      setTimeout(() => {
        if (this.state === 'levelup') {
          const next = this.makeCards();
          UI.showLevelUp(this.player.level, next, j => this.pickUpgrade(j, next));
        }
      }, 220);
    } else {
      this.leveling = false;
      this.state = 'playing';
      UI.show('none');
    }
  }

  upgradePool() {
    const p = this.player, lou = this.dogs[0], safi = this.dogs[1];
    return [
      { cat: 'RICK', icon: '✦', title: 'Scharfe Munition', desc: 'Deine Projektile richten 18 % mehr Schaden an.', stat: '+18 % SCHADEN', accent: '#e3a13c', apply: g => { g.player.upgrades.damage *= 1.18; } },
      { cat: 'RICK', icon: '⌁', title: 'Schnellfeuer', desc: 'Der Abzug sitzt lockerer. Erhöht die Feuerrate um 13 %.', stat: '+13 % FEUERRATE', accent: '#e3a13c', apply: g => { g.player.upgrades.fireRate *= 1.13; } },
      { cat: 'RICK', icon: '✚', title: 'Zäher Hund', desc: 'Du hältst mehr aus. +25 max. Leben und sofortige Heilung.', stat: '+25 LEBEN', accent: '#c95a44', apply: g => { g.player.maxHp += 25; g.player.hp = Math.min(g.player.maxHp, g.player.hp + 35); } },
      { cat: 'RICK', icon: '➤', title: 'Federleicht', desc: 'Beweg dich schneller durch den Wald. +8 % Tempo.', stat: '+8 % TEMPO', accent: '#7ec4a0', apply: g => { g.player.upgrades.speed *= 1.08; } },
      { cat: 'RICK', icon: '⟲', title: 'Ausweichrolle', desc: 'Die Ausweichrolle ist 20 % schneller wieder bereit.', stat: '-20 % COOLDOWN', accent: '#7ec4a0', apply: g => { g.player.upgrades.dashCd *= .8; } },
      { cat: 'RICK', icon: '✧', title: 'Panzerbrechend', desc: 'Kugeln durchschlagen einen weiteren Zombie.', stat: '+1 DURCHSCHLAG', accent: '#d18c4a', apply: g => { g.player.upgrades.pierce += 1; } },
      { cat: 'RICK', icon: '◈', title: 'Präzision', desc: 'Treffer ins Ziel verursachen doppelten Schaden. +8 % Kritchance.', stat: '+8 % KRIT', accent: '#e3a13c', apply: g => { g.player.upgrades.crit += .08; } },
      { cat: 'RICK', icon: '⛨', title: 'Feldarzt', desc: 'Nachladen geht 22 % schneller und du regenerierst 2 Leben pro Sekunde.', stat: '+REGEN', accent: '#c95a44', apply: g => { g.player.upgrades.reload *= .78; g.player.upgrades.regen += 2; } },
      { cat: 'RUDEL', icon: '♥', title: 'Rudelpflege', desc: 'Lou und Safi erhalten +25 max. Leben und werden vollständig geheilt.', stat: '+25 HUNDE-LEBEN', accent: '#a8c56c', apply: g => { for (const d of g.dogs) { d.maxHp += 25; d.hp = d.state === 'downed' ? d.hp : d.maxHp; } } },
      { cat: 'LOU', icon: '❖', title: 'Lous Bestie', desc: 'Lou beißt 30 % härter. Der braune Schäferhund wird zur Waffe.', stat: '+30 % LOU-SCHADEN', accent: '#b98853', apply: g => { g.dogs[0].dmg *= 1.3; } },
      { cat: 'SAFI', icon: '❖', title: 'Safis Blitz', desc: 'Safi greift 28 % schneller an und bewegt sich 12 % schneller.', stat: '+28 % SAFI-TEMPO', accent: '#eee7d4', apply: g => { g.dogs[1].attackRate *= .78; g.dogs[1].speed *= 1.12; } },
      { cat: 'RUDEL', icon: '☠', title: 'Bisswunden', desc: 'Beide Hunde verursachen 22 % mehr Schaden.', stat: '+22 % RUDEL-SCHADEN', accent: '#a8c56c', apply: g => { for (const d of g.dogs) d.dmg *= 1.22; } },
      { cat: 'RUDEL', icon: '⇢', title: 'Wachhunde', desc: 'Lou und Safi sind 15 % schneller und wittern Gegner früher.', stat: '+15 % HUNDE-TEMPO', accent: '#a8c56c', apply: g => { for (const d of g.dogs) d.speed *= 1.15; } },
      { cat: 'RICK', icon: '☰', title: 'Notfallversorgung', desc: 'Heilt sofort 50 Leben und füllt etwas Munition auf.', stat: 'SOFORT-HILFE', accent: '#c95a44', apply: g => { g.player.hp = Math.min(g.player.maxHp, g.player.hp + 50); for (const k of Object.keys(g.player.weapons)) { const w = g.player.weapons[k]; if (w.reserve !== Infinity) w.reserve += Math.ceil(WEAPONS[k].reserve * .35); } } },
    ];
  }

  // ===================== COMBAT =====================
  damageZombie(z, dmg, source, crit) {
    if (!z || z.dead) return;
    z.takeDamage(dmg, this, crit, source);
    if (source instanceof Player) { source.stats.hits++; source.stats.dmg += dmg; }
    if (Math.random() < .75) this.floatingText(z.x + rand(-8, 8), z.y - z.r - 8, Math.round(dmg).toString(), crit ? '#ffd27a' : '#e6dfc8', crit ? 15 : 11);
    if (!crit) Audio.hit();
  }

  killZombie(z, source) {
    if (z.dead) return;
    z.dead = true;
    this.kills++;
    this.score += z.score + this.wave * 2;
    const isDog = source instanceof Dog;
    if (source instanceof Player) source.stats.kills++;
    this.gainXp(Math.round(z.xp * (isDog ? .75 : 1)));
    const dogShare = isDog ? source : null;
    for (const d of this.dogs) {
      if (d === dogShare) d.gainXp(Math.round(z.xp * 1.5), this);
      else if (d.state !== 'downed') d.gainXp(Math.round(z.xp * .45), this);
    }
    this.bloodBurst(z.x, z.y, z.isBoss ? 36 : 12, z.angle);
    Audio.kill();
    this.shake(z.isBoss ? 16 : 3);
    if (z.isBoss) {
      this.spawnDrops(z.x, z.y, 5);
      this.shockwaves.push({ x: z.x, y: z.y, r: 20, maxR: 160, life: .7, maxLife: .7, color: 'rgba(255,120,60,' });
      UI.banner('KOLOSS BESIEGT', `WELLE ${this.wave}`, 3);
      Audio.bossRoar();
    }
    // corpse decal
    this.decals.push({ type: 'corpse', x: z.x, y: z.y, angle: z.angle, scale: z.scale, tint: Math.random(), life: undefined });
    if (this.decals.length > 46) this.decals.shift();
    this.decals.push({ type: 'blood', x: z.x, y: z.y, r: rand(8, 18) * z.scale, tint: Math.random() });
    if (this.decals.length > 90) this.decals.shift();
    // drops
    const dropChance = z.isBoss ? 1 : z.type === 'brute' ? .45 : .15;
    if (chance(dropChance)) this.spawnDrops(z.x, z.y, 1, z.type === 'brute' ? choice(['ammo', 'medkit', 'shield']) : null);
    // occasional ammo to avoid dead ends
    if (this.kills % 12 === 0) this.spawnDrops(z.x, z.y, 1, 'ammo');
  }

  bossSlam(boss) {
    this.shake(20);
    Audio.explosion();
    this.shockwaves.push({ x: boss.x, y: boss.y, r: 24, maxR: 190, life: .8, maxLife: .8, color: 'rgba(255,120,60,' });
    this.bloodBurst(boss.x, boss.y, 22, boss.angle);
    const p = this.player;
    if (dist(p.x, p.y, boss.x, boss.y) < 175) p.takeDamage(30, this);
    for (const d of this.dogs) if (dist(d.x, d.y, boss.x, boss.y) < 175) d.takeDamage(24, this);
  }

  telegraph(x, y, r, life) {
    this.telegraphs.push({ x, y, r, life, maxLife: life });
  }

  onPlayerDown() {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    Audio.bossRoar();
    this.shake(24);
    this.hurtFlash = 1.4;
    const isRecord = UI.saveBest(this.wave, this.score);
    UI.updateGameOver(this, isRecord);
    setTimeout(() => { if (this.state === 'gameover') UI.show('gameover'); }, 700);
  }

  // ===================== EFFECTS =====================
  shake(n) { this.cam.shake = Math.max(this.cam.shake, n); }

  bloodBurst(x, y, n, angle) {
    for (let i = 0; i < n; i++) {
      const a = angle + Math.PI + rand(-.9, .9);
      const s = rand(30, 190);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(1.2, 4), life: rand(.25, .7), maxLife: .7, color: 'rgba(120,24,16,', type: 'blood', vdamp: 4, gravity: 20 });
    }
  }
  sparks(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU2), s = rand(30, 140);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: rand(.8, 2), life: rand(.1, .35), maxLife: .35, color, type: 'spark' });
    }
  }
  ring(x, y, r, color) {
    this.shockwaves.push({ x, y, r: r * .2, maxR: r, life: .45, maxLife: .45, color });
  }
  muzzleFlash(x, y, angle, kind) {
    this.addFireBurst(x, y, kind === 'shotgun' ? 8 : 4);
    this.flashLight = { x, y, life: .09, maxLife: .09, r: kind === 'shotgun' ? 190 : 120 };
  }
  damageNumber(x, y, text, color) { this.floatingText(x, y, text, color, 13); }
  floatingText(x, y, text, color = '#e6dfc8', size = 12) {
    this.floatingTexts.push({ x, y, text, color, size, life: .9, maxLife: .9, vy: -34 });
    if (this.floatingTexts.length > 60) this.floatingTexts.shift();
  }
  toast(text, cls) { UI.toast(text, cls); }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.vdamp) { const k = Math.exp(-p.vdamp * dt); p.vx *= k; p.vy *= k; }
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.grow) p.r += p.r * p.grow * dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
    if (this.particles.length > 620) this.particles.splice(0, this.particles.length - 620);
    for (const f of this.floatingTexts) { f.life -= dt; f.y += f.vy * dt; f.vy *= Math.exp(-2.5 * dt); }
    this.floatingTexts = this.floatingTexts.filter(f => f.life > 0);
    if (this.flashLight) { this.flashLight.life -= dt; if (this.flashLight.life <= 0) this.flashLight = null; }
    // fade decals? keep
  }

  updateFireflies(dt) {
    for (const f of this.fireflies) {
      f.p += dt * f.s;
      f.x += Math.cos(f.p) * 6 * dt;
      f.y += Math.sin(f.p * 1.3) * 4 * dt;
    }
  }

  spawnCampfireParticles(dt) {
    if (Math.random() < dt * 22) {
      const x = CAMPFIRE.x + rand(-11, 11), y = CAMPFIRE.y + rand(-6, 6);
      this.particles.push({
        x, y, vx: rand(-8, 8), vy: rand(-55, -25), r: rand(1.4, 4), life: rand(.4, 1.1), maxLife: 1.1,
        color: Math.random() < .4 ? 'rgba(255,220,140,' : 'rgba(255,120,40,', type: 'fire', grow: -.5,
      });
    }
    if (Math.random() < dt * 5) {
      this.particles.push({ x: CAMPFIRE.x + rand(-20, 20), y: CAMPFIRE.y - 10, vx: rand(-6, 6), vy: rand(-26, -12), r: rand(3, 7), life: rand(.9, 1.8), maxLife: 1.8, color: 'rgba(90,85,70,', type: 'smoke', grow: 1.2 });
    }
  }

  // ===================== RENDER =====================
  render() {
    const ctx = this.ctx, vw = this.vw, vh = this.vh;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#080d09'; ctx.fillRect(0, 0, vw, vh);

    const sh = this.cam.shake;
    const shakeX = sh ? rand(-sh, sh) : 0;
    const shakeY = sh ? rand(-sh, sh) : 0;
    const camX = this.cam.x + shakeX, camY = this.cam.y + shakeY;
    const z = this.cam.zoom;
    this.renderCam = { x: camX, y: camY, z };

    // ground (screen-space for 1:1 texture sharpness)
    World.drawGround(ctx, { x: camX, y: camY, zoom: z }, vw, vh);

    ctx.save();
    ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (vw / 2 - camX * z), this.dpr * (vh / 2 - camY * z));
    const view = { x: camX, y: camY, w: vw / z, h: vh / z };

    World.drawWater(ctx, this.time);
    this.drawDecals(ctx);
    this.drawAfterimages(ctx);
    this.drawStructures(ctx);
    this.drawCrates(ctx);
    this.drawCampfireBase(ctx);
    for (const p of this.pickups) p.draw(ctx, this.time);
    this.drawTelegraphs(ctx);
    // low bushes
    for (const b of World.bushes) {
      if (Math.abs(b.x - camX) < view.w / 2 + 80 && Math.abs(b.y - camY) < view.h / 2 + 80) World.drawBush(ctx, b);
    }
    this.drawShockwaves(ctx);
    this.drawSorted(ctx, camX, camY, view);
    this.drawBullets(ctx);
    this.drawParticles(ctx);
    this.drawFire(ctx);
    this.drawFloatingTexts(ctx);
    ctx.restore();

    this.renderLighting(camX, camY);
    this.drawScreenFx(ctx);
  }

  drawSorted(ctx, camX, camY, view) {
    const drawables = [];
    for (const tree of World.trees) {
      if (Math.abs(tree.x - camX) < view.w / 2 + 140 && Math.abs(tree.y - camY) < view.h / 2 + 140) {
        drawables.push({ y: tree.y, draw: () => World.drawTree(ctx, tree, this.time) });
      }
    }
    for (const z of this.zombies) {
      if (z.dead) continue;
      if (Math.abs(z.x - camX) > view.w / 2 + 120 || Math.abs(z.y - camY) > view.h / 2 + 120) continue;
      drawables.push({ y: z.y, draw: () => z.draw(ctx, this.time) });
    }
    for (const d of this.dogs) {
      if (Math.abs(d.x - camX) > view.w / 2 + 80 || Math.abs(d.y - camY) > view.h / 2 + 80) continue;
      drawables.push({ y: d.y + 2, draw: () => d.draw(ctx, this.time) });
    }
    if (this.player) drawables.push({ y: this.player.y + 4, draw: () => this.drawPlayer(ctx) });
    drawables.sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw();
    this.drawMuzzle(ctx);
    // dog revive rings
    for (const dog of this.dogs) if (dog.state === 'downed') {
      ctx.save();
      ctx.strokeStyle = 'rgba(214,120,80,.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(dog.x, dog.y, 26 + Math.sin(this.time * 3) * 3, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    p.draw(ctx, this.time);
    if (p.shield > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(120,200,225,${.22 + Math.sin(this.time * 3) * .06})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawMuzzle(ctx) {
    const p = this.player;
    if (!p || p.muzzle <= 0) return;
    const x = p.x + Math.cos(p.angle) * 30, y = p.y + Math.sin(p.angle) * 30;
    const a = p.angle;
    const big = p.weapon.id === 'shotgun' ? 1.5 : 1;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,220,140,.9)';
    ctx.beginPath();
    ctx.moveTo(0, -4 * big); ctx.lineTo(26 * big, 0); ctx.lineTo(0, 4 * big); ctx.lineTo(8 * big, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,50,.55)';
    ctx.beginPath(); ctx.arc(6, 0, 11 * big, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ===================== WORLD LAYERS =====================
  drawStructures(ctx) {
    // world floor labels
    ctx.save();
    ctx.globalAlpha = .3;
    ctx.fillStyle = '#d9c9a2';
    ctx.font = '600 30px Bahnschrift, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('ZUM ALTEN FORST', 2860, 1908);
    ctx.font = '600 16px Bahnschrift, Arial';
    ctx.fillText('SEIT 1908', 2860, 1930);
    ctx.font = '600 20px Bahnschrift, Arial';
    ctx.fillText('ZIVILSCHUTZ', 740, 1290);
    ctx.font = '600 15px Bahnschrift, Arial';
    ctx.fillText('KIOSK · GARATH', 2170, 740);
    ctx.restore();

    // fences
    for (const f of World.fences) World.drawFence(ctx, f);
    for (const p of World.props) if (p.type === 'rug') World.drawRug(ctx, p);
    for (const p of World.props) if (p.type !== 'rug') World.drawProp(ctx, p);
    for (const c of World.cars) World.drawCar(ctx, c);

    // walls
    for (const w of World.walls) this.drawWall(ctx, w);
    // windows / signs
    this.drawSigns(ctx);
    // lamps
    for (const l of World.lights) {
      if (l.r < 200) continue;
      if (l.x === CAMPFIRE.x && l.y === CAMPFIRE.y) continue;
      this.drawLamp(ctx, l);
    }
  }

  drawWall(ctx, w) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.fillRect(w.x + 6, w.y + 8, w.w, w.h);
    let base = '#3e4036', light = '#5c5e50', line = 'rgba(20,22,16,.35)';
    if (w.mat === 'wood') { base = '#4a3523'; light = '#6b4f34'; line = 'rgba(20,12,6,.4)'; }
    if (w.mat === 'concrete') { base = '#47493f'; light = '#666858'; }
    if (w.mat === 'brick') { base = '#4e3d32'; light = '#6d5645'; line = 'rgba(24,14,10,.4)'; }
    ctx.fillStyle = base; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = light; ctx.fillRect(w.x, w.y, w.w, 3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(w.x, w.y + w.h - 3, w.w, 3);
    if (w.mat === 'wood') {
      const vert = w.h > w.w;
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      if (vert) for (let y = w.y + 12; y < w.y + w.h; y += 18) { ctx.beginPath(); ctx.moveTo(w.x + 2, y); ctx.lineTo(w.x + w.w - 2, y); ctx.stroke(); }
      else for (let x = w.x + 18; x < w.x + w.w; x += 26) { ctx.beginPath(); ctx.moveTo(x, w.y + 2); ctx.lineTo(x, w.y + w.h - 2); ctx.stroke(); }
    } else if (w.mat === 'brick') {
      ctx.strokeStyle = line; ctx.lineWidth = 1;
      for (let y = w.y + 7; y < w.y + w.h; y += 10) {
        ctx.beginPath(); ctx.moveTo(w.x, y); ctx.lineTo(w.x + w.w, y); ctx.stroke();
      }
    } else {
      ctx.fillStyle = 'rgba(180,180,150,.04)';
      ctx.fillRect(w.x + 3, w.y + 4, w.w - 6, 2);
    }
    ctx.restore();
  }

  drawSigns(ctx) {
    // wooden park sign near road
    const sx = 1590, sy = 500;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(sx - 55, sy + 4, 120, 12);
    ctx.fillStyle = '#4a3a24'; ctx.fillRect(sx - 60, sy - 28, 120, 34);
    ctx.strokeStyle = '#7b633c'; ctx.lineWidth = 2; ctx.strokeRect(sx - 57, sy - 25, 114, 28);
    ctx.fillStyle = '#cfc39c'; ctx.font = 'bold 14px Bahnschrift, Arial'; ctx.textAlign = 'center';
    ctx.fillText('GARATHER WALD', sx, sy - 7);
    ctx.font = '8px Bahnschrift, Arial'; ctx.fillStyle = '#a89c78';
    ctx.fillText('BETRETEN AUF EIGENE GEFAHR', sx, sy + 3);
    ctx.fillStyle = '#3a2c1c'; ctx.fillRect(sx - 8, sy + 6, 5, 30); ctx.fillRect(sx + 4, sy + 6, 5, 30);
    ctx.restore();
    // gasthaus hanging sign
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(2418, 1490, 9, 44);
    ctx.fillStyle = '#3a2b1a'; ctx.fillRect(2404, 1480, 46, 28);
    ctx.fillStyle = '#c9a25c'; ctx.font = 'bold 12px Bahnschrift, Arial'; ctx.textAlign = 'center';
    ctx.fillText('FORST', 2427, 1499);
    ctx.restore();
  }

  drawLamp(ctx, l) {
    ctx.save();
    const off = l.flicker > .2 && Math.sin(this.time * 13 + l.x) > .93;
    ctx.globalAlpha = off ? .4 : 1;
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(l.x + 6, l.y + 9, 11, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2c2e28'; ctx.fillRect(l.x - 2, l.y - 6, 5, 16);
    ctx.fillStyle = '#43443a'; ctx.fillRect(l.x - 8, l.y - 10, 17, 6);
    ctx.fillStyle = off ? '#7a6a44' : '#ffd28a';
    ctx.beginPath(); ctx.arc(l.x, l.y - 7, 3.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawCrates(ctx) {
    for (const c of this.crates) {
      if (c.opened) {
        ctx.save();
        ctx.globalAlpha = .5;
        ctx.fillStyle = '#2c2416'; ctx.fillRect(c.x - 22, c.y - 16, 44, 32);
        ctx.strokeStyle = '#544326'; ctx.strokeRect(c.x - 22, c.y - 16, 44, 32);
        ctx.restore();
        continue;
      }
      const pulse = .5 + Math.sin(this.time * 2.6 + c.x) * .2;
      ctx.save();
      ctx.fillStyle = `rgba(255,210,122,${.05 + pulse * .05})`;
      ctx.beginPath(); ctx.arc(c.x, c.y, 38, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(c.x + 3, c.y + 17, 24, 9, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#4d3a22'; roundedBox(ctx, c.x - 24, c.y - 19, 48, 38, 4); ctx.fill();
      ctx.fillStyle = c.type === 'weapon' ? '#6d5730' : '#5b4a2e'; roundedBox(ctx, c.x - 21, c.y - 16, 42, 32, 3); ctx.fill();
      ctx.strokeStyle = '#2c2112'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(c.x - 21, c.y - 16); ctx.lineTo(c.x + 21, c.y + 16); ctx.moveTo(c.x + 21, c.y - 16); ctx.lineTo(c.x - 21, c.y + 16); ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,122,.85)';
      if (c.type === 'weapon') {
        ctx.fillRect(c.x - 11, c.y - 3, 22, 4); ctx.fillRect(c.x + 3, c.y + 1, 4, 5);
      } else {
        ctx.fillRect(c.x - 8, c.y - 8, 16, 16);
        ctx.fillStyle = '#4d3a22'; ctx.fillRect(c.x - 2, c.y - 5, 4, 10); ctx.fillRect(c.x - 5, c.y - 2, 10, 4);
      }
      ctx.restore();
    }
  }

  drawCampfireBase(ctx) {
    ctx.save();
    // stones
    for (let i = 0; i < 11; i++) {
      const a = i / 11 * TAU;
      ctx.fillStyle = i % 2 ? '#4a4a40' : '#3f4037';
      ctx.beginPath(); ctx.ellipse(CAMPFIRE.x + Math.cos(a) * 24, CAMPFIRE.y + Math.sin(a) * 20, 7, 5, a, 0, TAU); ctx.fill();
    }
    // logs
    ctx.save(); ctx.translate(CAMPFIRE.x, CAMPFIRE.y);
    ctx.rotate(.4); ctx.fillStyle = '#4c3520'; ctx.fillRect(-17, -5, 34, 10);
    ctx.rotate(-.9); ctx.fillStyle = '#553b22'; ctx.fillRect(-15, -4, 30, 9);
    ctx.fillStyle = 'rgba(255,140,60,.35)'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // sandbags / supplies near camp
    ctx.fillStyle = '#4a3a26'; ctx.fillRect(CAMPFIRE.x + 62, CAMPFIRE.y + 36, 30, 20);
    ctx.restore();
  }

  drawFire(ctx) {
    const t = this.time;
    const x = CAMPFIRE.x, y = CAMPFIRE.y - 4;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const flick = .8 + Math.sin(t * 9) * .1 + Math.sin(t * 17) * .05;
    for (let i = 0; i < 3; i++) {
      const h = (22 + i * 8) * flick;
      const w = 15 - i * 3;
      const sway = Math.sin(t * 6 + i) * 4;
      const g = ctx.createLinearGradient(x, y, x, y - h);
      g.addColorStop(0, 'rgba(255,170,50,.55)');
      g.addColorStop(.6, `rgba(255,${120 + i * 30},30,.32)`);
      g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x - w * .4 + sway, y - h * .6, x + sway * .7, y - h);
      ctx.quadraticCurveTo(x + w * .5 + sway, y - h * .5, x + w, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,210,120,.7)';
    ctx.beginPath(); ctx.ellipse(x, y - 4, 12, 7, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawTelegraphs(ctx) {
    for (const t of this.telegraphs) {
      const k = 1 - t.life / t.maxLife;
      ctx.save();
      ctx.strokeStyle = `rgba(230,90,50,${.35 + Math.sin(this.time * 12) * .15})`;
      ctx.fillStyle = `rgba(210,60,35,${.05 + k * .1})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,160,100,.7)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * k, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawShockwaves(ctx) {
    for (const s of this.shockwaves) {
      const a = clamp(s.life / s.maxLife, 0, 1);
      ctx.save();
      ctx.strokeStyle = s.color + (a * .7) + ')';
      ctx.lineWidth = 3 + (1 - a) * 5;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  drawDecals(ctx) {
    for (const d of this.decals) {
      if (d.type === 'blood') {
        ctx.save();
        ctx.fillStyle = `rgba(66,16,12,${.25 + d.tint * .25})`;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * .65, d.tint * TAU, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (d.type === 'corpse') {
        ctx.save();
        ctx.translate(d.x, d.y); ctx.rotate(d.angle); ctx.scale(d.scale, d.scale);
        ctx.globalAlpha = .85;
        ctx.fillStyle = 'rgba(5,7,5,.4)'; ctx.beginPath(); ctx.ellipse(2, 4, 22, 10, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = d.tint > .5 ? '#41453a' : '#46392f';
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 8, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6f6f5c'; ctx.beginPath(); ctx.arc(17, -1, 5.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#3a392e'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-25, -13); ctx.moveTo(-10, 5); ctx.lineTo(-23, 12); ctx.stroke();
        ctx.fillStyle = 'rgba(80,20,14,.55)'; ctx.beginPath(); ctx.ellipse(2, 2, 17, 7, .2, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  drawAfterimages(ctx) {
    for (const a of this.afterimages) {
      ctx.save();
      ctx.globalAlpha = a.life * .6;
      ctx.translate(a.x, a.y); ctx.rotate(a.a);
      ctx.fillStyle = 'rgba(180,200,170,.3)';
      ctx.beginPath(); ctx.ellipse(0, 0, 16, 12, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }

  drawBullets(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      ctx.strokeStyle = b.kind === 'shotgun' ? 'rgba(255,200,120,.55)' : 'rgba(255,225,150,.75)';
      ctx.lineWidth = b.kind === 'rifle' ? 2.4 : 1.5;
      ctx.beginPath(); ctx.moveTo(b.px, b.py); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,240,190,.9)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 1.8, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.fillStyle = p.color + a + ')';
      if (p.type === 'shell') {
        ctx.translate(p.x, p.y); ctx.rotate(p.life * 20);
        ctx.fillRect(-1.8, -1, 3.6, 2);
      } else if (p.type === 'spark') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      } else if (p.type === 'smoke') {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.type === 'fire') {
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + a * .8), 0, TAU); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  drawFloatingTexts(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of this.floatingTexts) {
      const a = clamp(f.life / f.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = `bold ${f.size}px Bahnschrift, Arial`;
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }

  // ===================== LIGHTING =====================
  renderLighting(camX, camY) {
    const lc = this.lightCtx, lw = this.lightCanvas.width, lh = this.lightCanvas.height;
    const ls = this.lightScale;
    const z = this.cam.zoom * ls;
    const ox = this.vw / 2 * ls, oy = this.vh / 2 * ls;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalCompositeOperation = 'source-over';
    const night = lc.createLinearGradient(0, 0, 0, lh);
    night.addColorStop(0, 'rgb(42,48,62)');
    night.addColorStop(1, 'rgb(30,35,45)');
    lc.fillStyle = night;
    lc.fillRect(0, 0, lw, lh);
    lc.globalCompositeOperation = 'lighter';

    const add = (x, y, r, color = [255, 238, 205], intensity = 1) => {
      const sx = (x - camX) * z + ox, sy = (y - camY) * z + oy, rr = r * this.cam.zoom * ls;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > lw || sy - rr > lh || rr <= 0) return;
      const g = lc.createRadialGradient(sx, sy, 0, sx, sy, rr);
      const c = `${color[0]},${color[1]},${color[2]}`;
      g.addColorStop(0, `rgba(${c},${clamp(intensity, 0, 1)})`);
      g.addColorStop(.35, `rgba(${c},${clamp(intensity * .55, 0, 1)})`);
      g.addColorStop(.72, `rgba(${c},${clamp(intensity * .16, 0, 1)})`);
      g.addColorStop(1, `rgba(${c},0)`);
      lc.fillStyle = g;
      lc.beginPath(); lc.arc(sx, sy, rr, 0, TAU); lc.fill();
    };

    const p = this.player;
    if (p) add(p.x, p.y, 235, [255, 240, 210], .82);
    if (p) {
      const sx = (p.x - camX) * z + ox, sy = (p.y - camY) * z + oy;
      const len = (this.state === 'title' ? 380 : 560) * this.cam.zoom * ls;
      const half = .34;
      lc.save();
      lc.translate(sx, sy);
      lc.rotate(p.angle);
      lc.beginPath();
      lc.moveTo(0, 0);
      lc.arc(0, 0, len, -half, half);
      lc.closePath();
      lc.clip();
      const g = lc.createRadialGradient(0, 0, 20 * this.cam.zoom * ls, 0, 0, len);
      g.addColorStop(0, 'rgba(255,242,210,.92)');
      g.addColorStop(.55, 'rgba(255,232,190,.38)');
      g.addColorStop(1, 'rgba(255,226,180,0)');
      lc.fillStyle = g;
      lc.fillRect(-len, -len, len * 2, len * 2);
      lc.restore();
    }
    const flick = 1 + Math.sin(this.time * 11) * .06 + Math.sin(this.time * 23) * .03;
    add(CAMPFIRE.x, CAMPFIRE.y, 390 * flick, [255, 151, 62], .88);
    for (const l of World.lights) {
      if (l.x === CAMPFIRE.x && l.y === CAMPFIRE.y) continue;
      const f = l.flicker ? 1 + Math.sin(this.time * (7 + l.x % 5) + l.y) * l.flicker : 1;
      add(l.x, l.y, l.r * f, l.color, l.intensity);
    }
    for (const b of BUILDINGS) {
      add(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * .46, [255, 196, 130], .38);
      add(b.x + 30, b.y + b.h - 30, 80, [220, 190, 140], .22);
    }
    for (const pk of this.pickups) add(pk.x, pk.y, 70, [255, 205, 120], .35);
    if (this.flashLight) add(this.flashLight.x, this.flashLight.y, this.flashLight.r, [255, 200, 120], .9);
    for (const zz of this.zombies) if (zz.isBoss) add(zz.x, zz.y, 170, [255, 100, 60], .35 + Math.sin(this.time * 4) * .08);

    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.lightCanvas, 0, 0, this.vw, this.vh);
    ctx.restore();

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    const glow = (x, y, r, color, a) => {
      const sx = (x - camX) * this.cam.zoom + this.vw / 2;
      const sy = (y - camY) * this.cam.zoom + this.vh / 2;
      if (sx + r < 0 || sy + r < 0 || sx - r > this.vw || sy - r > this.vh) return;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0, `rgba(${color},${a})`);
      g.addColorStop(.5, `rgba(${color},${a * .3})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
    };
    glow(CAMPFIRE.x, CAMPFIRE.y, 190 * this.cam.zoom, '255,140,60', .2 + Math.sin(this.time * 8) * .03);
    for (const l of World.lights) {
      if (l.r < 200 || l.x === CAMPFIRE.x) continue;
      glow(l.x, l.y, 90 * this.cam.zoom, '255,190,110', .07);
    }
    if (this.flashLight) glow(this.flashLight.x, this.flashLight.y, this.flashLight.r * this.cam.zoom, '255,190,90', .35 * (this.flashLight.life / this.flashLight.maxLife));
    ctx.restore();

    this.drawAtmosphere(camX, camY);
  }

  drawAtmosphere(camX, camY) {
    const ctx = this.ctx, vw = this.vw, vh = this.vh, z = this.cam.zoom;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < this.fog.length; i++) {
      const f = this.fog[i];
      const sx = ((f.x + this.time * f.s - camX * .25) % 2400 + 2400) % 2400 - 600;
      const sy = ((f.y + Math.sin(this.time * .07 + i) * 40 - camY * .2) % 1600 + 1600) % 1600 - 400;
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, f.r);
      g.addColorStop(0, `rgba(120,140,130,${f.a})`);
      g.addColorStop(1, 'rgba(120,140,130,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(sx, sy, f.r, 0, TAU); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fireflies) {
      const wx = CAMPFIRE.x + Math.cos(f.p) * (120 + Math.sin(f.p * .7) * 110) + Math.sin(f.p * .3) * 60;
      const wy = CAMPFIRE.y + Math.sin(f.p * 1.2) * (70 + Math.cos(f.p * .9) * 50);
      const sx = (wx - camX) * z + vw / 2, sy = (wy - camY) * z + vh / 2;
      if (sx < -20 || sy < -20 || sx > vw + 20 || sy > vh + 20) continue;
      const a = (.35 + Math.sin(f.p * 3) * .3) * (.5 + .5 * Math.sin(f.p * .7));
      ctx.fillStyle = `rgba(180,230,120,${clamp(a, 0, 1) * .5})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.4, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawScreenFx(ctx) {
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.hurtFlash > 0) {
      const a = clamp(this.hurtFlash, 0, 1);
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * .25, this.vw / 2, this.vh / 2, this.vh * .75);
      g.addColorStop(0, 'rgba(130,20,12,0)');
      g.addColorStop(1, `rgba(150,25,15,${a * .55})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    if (this.player && this.player.hp > 0 && this.player.hp / this.player.maxHp < .3 && this.state === 'playing') {
      const pulse = .12 + Math.sin(this.time * 5) * .05;
      const g = ctx.createRadialGradient(this.vw / 2, this.vh / 2, this.vh * .3, this.vw / 2, this.vh / 2, this.vh * .8);
      g.addColorStop(0, 'rgba(120,15,10,0)');
      g.addColorStop(1, `rgba(140,18,12,${pulse})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.vw, this.vh);
    }
    ctx.restore();
  }
}

function roundedBox(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
