import { TAU, angleDiff, clamp, dist, dist2, lerpAngle, norm, rand, roundedRect } from './util.js';
import { World } from './world.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

export const WEAPONS = {
  pistol: { id: 'pistol', name: "RICK'S KARABINER", short: 'PISTOLE', dmg: 26, rate: .17, spread: .028, mag: 14, reload: 1.0, pellets: 1, speed: 1650, reserve: Infinity, kick: 1.5, sound: 'pistol', pierce: 0, crit: .06 },
  shotgun: { id: 'shotgun', name: 'FORSTFLINTE', short: 'SCHROT', dmg: 13, rate: .78, spread: .20, mag: 6, reload: 1.85, pellets: 9, speed: 1400, reserve: 42, kick: 7, sound: 'shotgun', pierce: 0, crit: .03 },
  smg: { id: 'smg', name: 'MP „GARATH“', short: 'MP', dmg: 14, rate: .072, spread: .075, mag: 34, reload: 1.4, pellets: 1, speed: 1500, reserve: 300, kick: 1.1, sound: 'smg', pierce: 0, crit: .05 },
  rifle: { id: 'rifle', name: 'JAGDGEWEHR', short: 'GEWEHR', dmg: 60, rate: .46, spread: .012, mag: 10, reload: 1.7, pellets: 1, speed: 2100, reserve: 70, kick: 5, sound: 'rifle', pierce: 1, crit: .14 },
};

export const ZOMBIE_TYPES = {
  walker: { hp: 64, speed: 56, dmg: 9, r: 15, xp: 12, score: 10, scale: 1, skin: '#8a9272', shirt: '#4b4c3b' },
  runner: { hp: 44, speed: 122, dmg: 7, r: 13, xp: 15, score: 14, scale: .94, skin: '#9a9c7c', shirt: '#553f36' },
  brute: { hp: 340, speed: 43, dmg: 22, r: 25, xp: 52, score: 55, scale: 1.45, skin: '#787f61', shirt: '#3c4638' },
  boss: { hp: 1350, speed: 40, dmg: 32, r: 40, xp: 340, score: 600, scale: 2.1, skin: '#6e7758', shirt: '#2f3a2c' },
};

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 15;
    this.angle = -Math.PI / 2;
    this.walk = 0; this.moving = false;
    this.maxHp = 100; this.hp = 100; this.shield = 0;
    this.speed = 238;
    this.level = 1; this.xp = 0; this.xpNext = 90;
    this.weapons = { pistol: { ...WEAPONS.pistol, mag: 14, magSize: WEAPONS.pistol.mag, reserve: Infinity, owned: true } };
    this.current = 'pistol';
    this.fireCd = 0; this.reloading = 0; this.reloadDuration = 0;
    this.dashCd = 0; this.dashTime = 0; this.dashCdMax = 1.7;
    this.invuln = 0; this.hitFlash = 0; this.muzzle = 0; this.recoil = 0;
    this.damageBuff = 0; this.speedBuff = 0;
    this.upgrades = { damage: 1, fireRate: 1, speed: 1, pierce: 0, crit: 0, dashCd: 1, reload: 1, armor: 0, regen: 0 };
    this.dashDir = { x: 0, y: -1 };
    this.stats = { shots: 0, hits: 0, kills: 0, dmg: 0 };
    this.regenTimer = 0;
  }

  get weapon() { return this.weapons[this.current]; }
  get maxSpeed() { return this.speed * this.upgrades.speed * (this.speedBuff > 0 ? 1.34 : 1); }

  addWeapon(id, game) {
    if (this.weapons[id]) {
      const w = this.weapons[id];
      if (w.reserve !== Infinity) w.reserve += WEAPONS[id].reserve;
      this.current = id;
      game.toast(`<b>${WEAPONS[id].name}</b> · Munition aufgefüllt`);
    } else {
      const base = WEAPONS[id];
      this.weapons[id] = { ...base, mag: base.mag, magSize: base.mag, reserve: base.reserve, owned: true };
      this.current = id;
      game.toast(`<b>${base.name}</b> gefunden`);
      Audio.powerup();
    }
  }

  switchWeapon(id, game) {
    if (!this.weapons[id] || this.current === id) return;
    this.current = id;
    this.reloading = 0;
    this.fireCd = Math.max(this.fireCd, .2);
    game.toast(`${WEAPONS[id].short} AUSGERÜSTET`, 'dog');
  }

  tryReload(game) {
    const w = this.weapon;
    if (this.reloading > 0 || w.mag >= w.magSize) return;
    if (w.reserve <= 0) { Audio.empty(); return; }
    this.reloading = w.reload / this.upgrades.reload;
    this.reloadDuration = this.reloading;
    Audio.reload();
  }

  finishReload() {
    const w = this.weapon;
    const need = w.magSize - w.mag;
    const take = w.reserve === Infinity ? need : Math.min(need, w.reserve);
    w.mag += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    Audio.reloadDone();
  }

  update(dt, game) {
    const t = game.time;
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.recoil = Math.max(0, this.recoil - dt * 18);
    this.damageBuff = Math.max(0, this.damageBuff - dt);
    this.speedBuff = Math.max(0, this.speedBuff - dt);
    if (this.upgrades.regen > 0 && this.hp > 0) {
      this.regenTimer += dt;
      if (this.regenTimer > 3) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + this.upgrades.regen); }
    }
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.reloading = 0; this.finishReload(); }
    }

    let mx = 0, my = 0;
    if (Input.down('KeyW') || Input.down('ArrowUp')) my -= 1;
    if (Input.down('KeyS') || Input.down('ArrowDown')) my += 1;
    if (Input.down('KeyA') || Input.down('ArrowLeft')) mx -= 1;
    if (Input.down('KeyD') || Input.down('ArrowRight')) mx += 1;
    mx += Input.pad.moveX + Input.touch.moveX;
    my += Input.pad.moveY + Input.touch.moveY;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    this.moving = ml > .08;

    // aim
    const aim = game.getAim(this);
    if (aim) this.angle = aim;

    // start dash
    const dashPressed = Input.hit('ShiftLeft') || Input.hit('ShiftRight') || Input.hit('Space') || Input.touch.dash || Input.pad.dash;
    if (dashPressed && this.dashCd <= 0 && this.dashTime <= 0) {
      this.dashTime = .18;
      this.dashCd = this.dashCdMax * this.upgrades.dashCd;
      this.invuln = Math.max(this.invuln, .34);
      this.dashDir = this.moving ? norm(mx, my) : { x: Math.cos(this.angle), y: Math.sin(this.angle) };
      Audio.dash();
      game.afterimages.push({ x: this.x, y: this.y, a: this.angle, life: .35 });
      game.shake(3);
    }

    if (this.dashTime > 0) {
      this.dashTime -= dt;
      World.moveCircle(this, this.dashDir.x * 880 * dt, this.dashDir.y * 880 * dt, this.r);
      this.walk += dt * 15;
      if (Math.random() < .7) game.particles.push({ x: this.x + rand(-8, 8), y: this.y + rand(-8, 8), vx: -this.dashDir.x * rand(10, 50), vy: -this.dashDir.y * rand(10, 50), r: rand(2, 5), life: .3, maxLife: .3, color: 'rgba(180,170,140,', type: 'dust', grow: 1.5 });
    } else {
      const sp = this.maxSpeed;
      World.moveCircle(this, mx * sp * dt, my * sp * dt, this.r);
      if (this.moving) this.walk += dt * (6 + sp / 45);
    }

    // footprints
    if (this.moving && Math.random() < dt * 8) {
      game.particles.push({ x: this.x - Math.cos(this.angle) * 6, y: this.y - Math.sin(this.angle) * 6, vx: 0, vy: 0, r: 2.5, life: 1.2, maxLife: 1.2, color: 'rgba(50,45,30,', type: 'foot', fade: true });
    }

    // shooting
    const firing = Input.mouse.down || Input.touch.fire || Input.pad.fire;
    if (firing && this.reloading <= 0 && this.fireCd <= 0 && this.dashTime <= 0) {
      const w = this.weapon;
      if (w.mag <= 0) {
        Audio.empty();
        this.fireCd = .25;
        this.tryReload(game);
      } else {
        this.shoot(game);
      }
    }

    // reload input
    if ((Input.hit('KeyR') || Input.touch.reload || Input.pad.reload) && this.reloading <= 0) this.tryReload(game);

    // weapon switch
    const slots = ['pistol', 'shotgun', 'smg', 'rifle'];
    for (let i = 0; i < 4; i++) if (Input.hit('Digit' + (i + 1))) this.switchWeapon(slots[i], game);
    if (Math.abs(game.scrollDelta) > 0) {
      let idx = slots.indexOf(this.current);
      idx = (idx + (game.scrollDelta > 0 ? 1 : 3)) % 4;
      for (let k = 0; k < 4 && !this.weapons[slots[idx]]; k++) idx = (idx + 1) % 4;
      this.switchWeapon(slots[idx], game);
      game.scrollDelta = 0;
    }
  }

  shoot(game) {
    const w = this.weapon;
    const dmgMul = this.damageBuff > 0 ? 2 : 1;
    this.fireCd = w.rate / this.upgrades.fireRate;
    this.muzzle = .07;
    this.recoil = w.kick;
    w.mag--;
    this.stats.shots++;
    const baseAngle = this.angle + (Math.random() - .5) * this.recoil * .02;
    for (let i = 0; i < w.pellets; i++) {
      const spread = (Math.random() - .5) * w.spread * 2 + (this.moving ? .012 : 0);
      const a = baseAngle + spread;
      const crit = Math.random() < (w.crit + this.upgrades.crit);
      const dmg = w.dmg * this.upgrades.damage * dmgMul * (crit ? 2 : 1);
      game.bullets.push(new Bullet(
        this.x + Math.cos(a) * 24, this.y + Math.sin(a) * 24,
        Math.cos(a) * w.speed, Math.sin(a) * w.speed,
        dmg, w.pierce + this.upgrades.pierce, crit, w.id
      ));
    }
    Audio.shoot(w.sound);
    game.shake(w.kick * .55);
    game.muzzleFlash(this.x + Math.cos(this.angle) * 30, this.y + Math.sin(this.angle) * 30, this.angle, w.id);
    // shell
    const sa = this.angle + Math.PI / 2 + rand(-.3, .3);
    game.particles.push({ x: this.x, y: this.y, vx: Math.cos(sa) * rand(40, 90), vy: Math.sin(sa) * rand(40, 90), r: 2, life: .9, maxLife: .9, color: 'rgba(200,160,70,', type: 'shell', vdamp: 3 });
    // recoil push player a bit
    this.x -= Math.cos(this.angle) * w.kick * .4;
    this.y -= Math.sin(this.angle) * w.kick * .4;
  }

  takeDamage(amount, game) {
    if (this.invuln > 0 || this.hp <= 0) return;
    let dmg = amount;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed; dmg -= absorbed;
      game.ring(this.x, this.y, 30, 'rgba(120,200,225,');
    }
    if (dmg > 0) this.hp -= dmg;
    this.hitFlash = .18;
    this.invuln = .45;
    game.shake(9);
    game.hurtFlash = 1;
    Audio.hurt();
    game.damageNumber(this.x, this.y - 24, `-${Math.round(dmg + (this.shield ? 0 : 0))}`, '#e46a52');
    if (this.hp <= 0) { this.hp = 0; game.onPlayerDown(); }
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  draw(ctx, t) {
    const { x, y, angle } = this;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,.42)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 7, 18, 10, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    if (this.invuln > 0 && Math.floor(t * 30) % 2 === 0) ctx.globalAlpha = .55;
    ctx.rotate(angle);
    const bob = Math.sin(this.walk) * (this.moving ? 1.6 : .3);
    // legs
    ctx.fillStyle = '#2f332a';
    const legOff = Math.sin(this.walk) * (this.moving ? 6 : 0);
    roundedRect(ctx, -7 + legOff, -8, 13, 6, 3); ctx.fill();
    roundedRect(ctx, -7 - legOff, 2, 13, 6, 3); ctx.fill();
    ctx.fillStyle = '#1d1f1a';
    roundedRect(ctx, 2 + legOff, -8, 5, 6, 2); ctx.fill();
    roundedRect(ctx, 2 - legOff, 2, 5, 6, 2); ctx.fill();
    // backpack
    ctx.fillStyle = '#4a3c28'; roundedRect(ctx, -11, -7, 9, 14, 3); ctx.fill();
    ctx.fillStyle = '#5d4b32'; roundedRect(ctx, -10, -5, 4, 10, 2); ctx.fill();
    // torso
    ctx.fillStyle = this.hitFlash > 0 ? '#d8d2b8' : '#4a513c';
    roundedRect(ctx, -7, -9 + bob * .2, 17, 18, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    roundedRect(ctx, -5, -8 + bob * .2, 13, 6, 3); ctx.fill();
    // tactical vest strap
    ctx.fillStyle = '#31362a'; ctx.fillRect(-2, -9, 4, 18);
    ctx.fillStyle = '#b08a4c'; ctx.fillRect(1, -8, 2, 16);
    // arms + gun
    const kick = this.recoil * .8;
    ctx.fillStyle = '#3f4634';
    roundedRect(ctx, 2, -9, 10, 5, 2.5); ctx.fill();
    roundedRect(ctx, 2, 4, 10, 5, 2.5); ctx.fill();
    ctx.fillStyle = '#c49a6c';
    roundedRect(ctx, 10, -7, 5, 4, 2); ctx.fill();
    roundedRect(ctx, 10, 3, 5, 4, 2); ctx.fill();
    // weapon
    const w = this.weapon;
    const gunLen = w.id === 'shotgun' ? 28 : w.id === 'rifle' ? 31 : w.id === 'smg' ? 23 : 18;
    ctx.translate(-kick, 0);
    ctx.fillStyle = '#1b1d1a';
    roundedRect(ctx, 9, -2.6, gunLen, 5.2, 1.5); ctx.fill();
    ctx.fillStyle = '#2d302b';
    ctx.fillRect(12, -3.6, gunLen * .42, 1.7);
    ctx.fillStyle = '#3b3a2e';
    roundedRect(ctx, 10, 1, 7, 4.5, 1.5); ctx.fill();
    if (w.id === 'shotgun') { ctx.fillStyle = '#4b3622'; roundedRect(ctx, 6, -2, 8, 4, 2); ctx.fill(); }
    if (w.id === 'rifle') { ctx.fillStyle = '#1b1d1a'; roundedRect(ctx, 12, -5, 12, 2.5, 1); ctx.fill(); }
    ctx.fillStyle = '#0f110e'; ctx.fillRect(9 + gunLen - 2, -1.6, 4, 3.2);
    // head
    ctx.fillStyle = '#c49a6c';
    ctx.beginPath(); ctx.arc(2.5, -0.5, 6.6, 0, TAU); ctx.fill();
    // beanie
    ctx.fillStyle = '#3a4033';
    ctx.beginPath(); ctx.arc(2, -1.4, 6.4, Math.PI * .84, Math.PI * 2.12); ctx.fill();
    ctx.fillStyle = '#2b3026'; ctx.fillRect(-4.2, -2.4, 8, 2);
    // beard
    ctx.fillStyle = '#5c4a33'; ctx.beginPath(); ctx.arc(5.2, 1.4, 3.4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#1b1b16'; ctx.beginPath(); ctx.arc(7.5, 0.4, 1, 0, TAU); ctx.fill();
    // collar / scarf
    ctx.fillStyle = '#a06a3c'; ctx.fillRect(1, -7, 4, 4);
    ctx.restore();
  }
}

export class Dog {
  constructor(name, key, x, y, variant) {
    this.name = name; this.key = key;
    this.x = x; this.y = y; this.r = 14;
    this.variant = variant; // lou | safi
    this.maxHp = variant === 'lou' ? 120 : 100;
    this.hp = this.maxHp;
    this.level = 1; this.xp = 0; this.xpNext = 65;
    this.dmg = variant === 'lou' ? 24 : 16;
    this.attackRate = variant === 'lou' ? .95 : .62;
    this.speed = variant === 'lou' ? 252 : 282;
    this.angle = 0; this.walk = 0; this.moving = false;
    this.state = 'follow';
    this.target = null;
    this.attackCd = rand(0, .4);
    this.bite = 0;
    this.downTimer = 0;
    this.hitFlash = 0;
    this.barkCd = rand(2, 6);
    this.slot = variant === 'lou' ? -1 : 1;
    this.stuck = 0;
    this.ring = 0;
  }

  update(dt, game) {
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.bite = Math.max(0, this.bite - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.barkCd = Math.max(0, this.barkCd - dt);
    this.ring = Math.max(0, this.ring - dt);
    if (this.state === 'downed') {
      this.downTimer -= dt;
      this.walk += dt * 2;
      if (game.player.hp > 0) {
        const d = dist(this.x, this.y, game.player.x, game.player.y);
        if (d > 36) World.moveCircle(this, (game.player.x - this.x) / d * 42 * dt, (game.player.y - this.y) / d * 42 * dt, this.r);
      }
      if (this.downTimer <= 0) this.revive(game, .35);
      return;
    }
    // find target
    let best = null, bd = 1e9;
    for (const z of game.zombies) {
      if (z.dead) continue;
      const d = dist2(this.x, this.y, z.x, z.y);
      if (d < bd && d < 420 * 420) { bd = d; best = z; }
    }
    this.target = best;
    let tx, ty, speed;

    if (best) {
      tx = best.x; ty = best.y;
      const d = Math.sqrt(bd);
      if (d < best.r + 27 && this.attackCd <= 0) {
        // bite
        this.attackCd = this.attackRate;
        this.bite = .22;
        const dmg = this.dmg * (1 + (this.level - 1) * .13);
        game.damageZombie(best, dmg, this, false);
        game.bloodBurst(best.x, best.y, 5, this.angle);
        Audio.bark();
        game.shake(2);
        this.x += Math.cos(this.angle) * 10;
        this.y += Math.sin(this.angle) * 10;
      }
      speed = this.speed * 1.12;
      // lunge around target
      if (d < 70) speed *= .9;
    } else {
      const p = game.player;
      const back = 62;
      const side = 44 * this.slot;
      const baseA = p.moving ? Math.atan2(p.y - (p.y - Math.sin(p.angle)), p.x - (p.x - Math.cos(p.angle))) : p.angle;
      const ca = Math.cos(p.angle + Math.PI * .5), sa = Math.sin(p.angle + Math.PI * .5);
      tx = p.x - Math.cos(p.angle) * back + ca * side;
      ty = p.y - Math.sin(p.angle) * back + sa * side;
      speed = this.speed;
      // keep away from player overlap
      const pd = dist(this.x, this.y, p.x, p.y);
      if (pd < 34) { tx = this.x - (p.x - this.x); ty = this.y - (p.y - this.y); }
    }

    // avoid other dog
    let sepX = 0, sepY = 0;
    for (const d of game.dogs) {
      if (d === this || d.state === 'downed') continue;
      const dd = dist(this.x, this.y, d.x, d.y);
      if (dd < 44 && dd > 0) { sepX += (this.x - d.x) / dd * (44 - dd); sepY += (this.y - d.y) / dd * (44 - dd); }
    }
    let dx = tx - this.x + sepX * 1.2, dy = ty - this.y + sepY * 1.2;
    const dl = Math.hypot(dx, dy);
    this.moving = dl > 12;
    if (this.moving) {
      dx /= dl; dy /= dl;
      const desired = Math.atan2(dy, dx);
      this.angle = lerpAngle(this.angle, desired, 1 - Math.exp(-12 * dt));
      const beforeX = this.x, beforeY = this.y;
      World.moveCircle(this, Math.cos(this.angle) * speed * dt, Math.sin(this.angle) * speed * dt, this.r);
      const moved = dist(beforeX, beforeY, this.x, this.y);
      if (moved < speed * dt * .25) {
        this.stuck += dt;
        if (this.stuck > 1.1) { this.stuck = 0; World.moveCircle(this, Math.cos(this.angle + Math.PI / 2) * speed * dt * 2, Math.sin(this.angle + Math.PI / 2) * speed * dt * 2, this.r); }
      } else this.stuck = 0;
      this.walk += dt * (9 + speed / 55);
    } else {
      this.angle = lerpAngle(this.angle, best ? Math.atan2(best.y - this.y, best.x - this.x) : game.player.angle, 1 - Math.exp(-6 * dt));
      this.walk += dt * 2;
    }
    if (best && this.barkCd <= 0) { this.barkCd = rand(6, 12); if (Math.random() < .5) Audio.bark(); }

    // too far from player: catch up teleport
    const far = dist(this.x, this.y, game.player.x, game.player.y);
    if (far > 1150) {
      const a = Math.random() * TAU;
      for (let i = 0; i < 12; i++) {
        const nx = game.player.x + Math.cos(a + i) * 70, ny = game.player.y + Math.sin(a + i) * 70;
        if (!World.isBlocked(nx, ny, this.r)) { this.x = nx; this.y = ny; break; }
      }
    }
  }

  takeDamage(n, game) {
    if (this.state === 'downed') return;
    this.hp -= n;
    this.hitFlash = .16;
    game.damageNumber(this.x, this.y - 22, `-${Math.round(n)}`, '#e8b27a');
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'downed';
      this.downTimer = 24;
      this.target = null;
      Audio.growl();
      game.toast(`<b>${this.name}</b> ist verletzt! Halte E gedrückt.`, 'bad');
      game.shake(5);
    }
  }

  revive(game, hpPercent = .55) {
    this.state = 'follow';
    this.hp = Math.max(1, Math.round(this.maxHp * hpPercent));
    this.downTimer = 0;
    this.ring = .8;
    game.toast(`<b>${this.name}</b> ist wieder auf den Beinen!`, 'dog');
    game.ring(this.x, this.y, 55, 'rgba(168,197,108,');
    Audio.bark();
  }

  gainXp(n, game) {
    if (this.state === 'downed') return;
    this.xp += n;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = Math.round(this.xpNext * 1.32);
      this.maxHp += 16;
      this.hp = Math.min(this.maxHp, this.hp + 24);
      this.dmg *= 1.12;
      this.speed *= 1.025;
      game.toast(`<b>${this.name}</b> erreicht Level ${this.level}`, 'dog');
      game.ring(this.x, this.y, 40, 'rgba(168,197,108,');
      Audio.levelup();
    }
  }

  draw(ctx, t) {
    const down = this.state === 'downed';
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.beginPath(); ctx.ellipse(this.x + 3, this.y + 6, 20, 9, 0, 0, TAU); ctx.fill();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (down) { ctx.rotate(Math.PI / 2); ctx.scale(.92, 1); ctx.globalAlpha = .8; }
    if (this.hitFlash > 0) ctx.globalAlpha = .6;
    const cream = this.variant === 'safi';
    const body = cream ? '#ddd6c2' : '#7b4a27';
    const dark = cream ? '#b3a98e' : '#55311a';
    const light = cream ? '#f0ead9' : '#9c6433';
    const bob = Math.sin(this.walk) * (this.moving ? 1.4 : .2);
    // tail
    ctx.save();
    ctx.translate(-16, 1);
    ctx.rotate(Math.sin(t * 4 + (this.slot)) * .3);
    ctx.strokeStyle = body; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -5, -13, -2); ctx.stroke();
    ctx.restore();
    // legs
    ctx.fillStyle = dark;
    const lo = Math.sin(this.walk) * 5;
    const lo2 = Math.sin(this.walk + Math.PI) * 5;
    roundedRect(ctx, -9 + lo, -10, 7, 5, 2.5); ctx.fill();
    roundedRect(ctx, -9 + lo2, 5, 7, 5, 2.5); ctx.fill();
    roundedRect(ctx, 8 - lo2, -10, 7, 5, 2.5); ctx.fill();
    roundedRect(ctx, 8 - lo, 5, 7, 5, 2.5); ctx.fill();
    // body
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(-3, 0, 16, 9.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(-8, 0, 8, 7.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = light;
    ctx.beginPath(); ctx.ellipse(-1, 2, 11, 5, 0, 0, TAU); ctx.fill();
    // neck / head
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.ellipse(11, 0, 9, 8, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(19, 0, 7, 5.5, 0, 0, TAU); ctx.fill();
    // snout
    ctx.fillStyle = cream ? '#cabfa4' : '#8a5a30';
    ctx.beginPath(); ctx.ellipse(24, 0, 5, 3.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#191813';
    ctx.beginPath(); ctx.arc(27.5, 0, 2.2, 0, TAU); ctx.fill();
    // ears
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.moveTo(8, -7); ctx.lineTo(5, -16); ctx.lineTo(14, -9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, 7); ctx.lineTo(5, 16); ctx.lineTo(14, 9); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#12110d';
    ctx.beginPath(); ctx.arc(17, -3.5, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(17, 3.5, 1.6, 0, TAU); ctx.fill();
    // collar
    ctx.strokeStyle = this.variant === 'lou' ? '#b53a2c' : '#3b6f8f';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(10, 0, 8, -.9, .9); ctx.stroke();
    ctx.fillStyle = '#d8b45c';
    ctx.beginPath(); ctx.arc(10, 7, 2, 0, TAU); ctx.fill();
    // attack bite flash
    if (this.bite > 0) {
      ctx.fillStyle = 'rgba(255,240,210,.55)';
      ctx.beginPath(); ctx.arc(28, 0, 6, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (this.state === 'downed') {
      ctx.save();
      ctx.translate(this.x, this.y - 34);
      ctx.fillStyle = 'rgba(8,10,8,.78)';
      ctx.fillRect(-30, -7, 60, 13);
      ctx.fillStyle = '#d06a4e';
      ctx.font = 'bold 9px Bahnschrift, Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.name.toUpperCase()} · ${Math.ceil(this.downTimer)}s`, 0, 2.5);
      ctx.restore();
    }
  }
}

let zombieId = 1;
export class Zombie {
  constructor(x, y, type, level = 1, isBoss = false) {
    const def = ZOMBIE_TYPES[type];
    this.id = zombieId++;
    this.x = x; this.y = y; this.type = type;
    this.r = def.r;
    this.maxHp = Math.round(def.hp * (1 + (level - 1) * .16) * (isBoss ? 1.25 : 1));
    this.hp = this.maxHp;
    this.speed = def.speed * (1 + Math.min(.5, (level - 1) * .025)) * rand(.88, 1.12);
    this.dmg = def.dmg + level * 1.4;
    this.xp = def.xp; this.score = def.score;
    this.scale = def.scale;
    this.angle = rand(0, TAU);
    this.walk = rand(0, 6);
    this.attackCd = rand(.2, 1);
    this.windup = 0;
    this.stagger = 0;
    this.hitFlash = 0;
    this.dead = false;
    this.spawn = 1;
    this.target = null;
    this.isBoss = isBoss || type === 'boss';
    this.slamCd = 3;
    this.slamWind = 0;
    this.lunge = 0;
    this.phase = rand(0, TAU);
    this.seed = Math.random();
    this.shirt = def.shirt;
    this.skin = def.skin;
    if (this.isBoss) { this.slamCd = 4; this.shirt = '#2c3527'; }
  }

  update(dt, game) {
    if (this.dead) return;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.spawn = Math.max(0, this.spawn - dt * 2);
    this.stagger = Math.max(0, this.stagger - dt);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.slamCd = Math.max(0, this.slamCd - dt);
    this.bite = 0;

    // choose target
    let target = game.player;
    let bestD = dist2(this.x, this.y, target.x, target.y);
    for (const dog of game.dogs) {
      if (dog.state === 'downed') continue;
      const d = dist2(this.x, this.y, dog.x, dog.y) * 1.35;
      if (d < bestD) { bestD = d; target = dog; }
    }
    this.target = target;

    if (this.stagger > 0) { this.walk += dt * 2; return; }
    const dx = target.x - this.x, dy = target.y - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const desired = Math.atan2(dy, dx);
    this.angle = lerpAngle(this.angle, desired, 1 - Math.exp(-(this.type === 'runner' ? 10 : 4) * dt));
    this.walk += dt * (this.type === 'runner' ? 14 : this.type === 'brute' ? 3.4 : 5.2);

    // boss slam
    if (this.isBoss) {
      if (this.slamWind > 0) {
        this.slamWind -= dt;
        if (this.slamWind <= 0) {
          game.bossSlam(this);
          this.slamCd = 5;
        }
        return;
      }
      if (this.slamCd <= 0 && d < 150) {
        this.slamWind = 1.0;
        this.slamCd = 6;
        game.telegraph(this.x, this.y, 155, 1.0);
        Audio.growl();
        return;
      }
    }

    const reach = this.r + target.r + 8;
    if (this.windup > 0) {
      this.windup -= dt;
      if (this.windup <= 0) {
        if (dist(this.x, this.y, target.x, target.y) < reach + 22) {
          if (target === game.player) target.takeDamage(this.dmg, game);
          else target.takeDamage(this.dmg, game);
          game.bloodBurst(target.x, target.y, 4, this.angle);
          this.attackCd = this.type === 'runner' ? .75 : 1.15;
        }
      }
      return;
    }
    if (d < reach && this.attackCd <= 0) {
      this.windup = this.type === 'runner' ? .22 : .38;
      this.lunge = .3;
      if (this.type === 'runner' && Math.random() < .5) Audio.growl();
      return;
    }
    // movement with separation
    let sx = 0, sy = 0;
    for (const z of game.zombies) {
      if (z === this || z.dead) continue;
      const dd = dist2(this.x, this.y, z.x, z.y);
      const sep = (this.r + z.r + 4) ** 2;
      if (dd < sep && dd > 0.01) {
        const dl = Math.sqrt(dd);
        sx += (this.x - z.x) / dl * (1 - dl / (this.r + z.r + 4));
        sy += (this.y - z.y) / dl * (1 - dl / (this.r + z.r + 4));
      }
    }
    let vx = Math.cos(this.angle) + sx * 1.6;
    let vy = Math.sin(this.angle) + sy * 1.6;
    if (this.lunge > 0) { this.lunge -= dt; vx *= 1.5; vy *= 1.5; }
    const vlen = Math.hypot(vx, vy) || 1;
    vx /= vlen; vy /= vlen;
    // obstacle avoidance
    const ahead = World.isBlocked(this.x + vx * (this.r + 16), this.y + vy * (this.r + 16), this.r * .8);
    if (ahead) {
      const side = this.seed > .5 ? 1 : -1;
      vx = vx * .35 - vy * side * .95;
      vy = vy * .35 + vx * side * .95;
    }
    const sp = this.speed * (this.isBoss ? (this.slamWind > 0 ? .2 : 1) : 1);
    const beforeX = this.x, beforeY = this.y;
    World.moveCircle(this, vx * sp * dt, vy * sp * dt, this.r);
    if (dist(beforeX, beforeY, this.x, this.y) < sp * dt * .2) {
      // slide fallback
      World.moveCircle(this, -vy * sp * dt * .8, vx * sp * dt * .8, this.r);
    }
  }

  takeDamage(n, game, crit, source) {
    if (this.dead) return;
    this.hp -= n;
    this.hitFlash = .12;
    if (this.type === 'brute' || this.isBoss) this.stagger = Math.max(this.stagger, .05);
    else if (Math.random() < .12) this.stagger = .18;
    if (this.hp <= 0) { this.hp = 0; game.killZombie(this, source || game.player); }
  }

  draw(ctx, t) {
    const s = this.scale;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(this.x + 4 * s, this.y + 7 * s, 19 * s, 10 * s, 0, 0, TAU); ctx.fill();
    ctx.translate(this.x, this.y);
    if (this.spawn > 0) ctx.globalAlpha = 1 - this.spawn;
    ctx.rotate(this.angle);
    ctx.scale(s, s);
    const bob = Math.sin(this.walk) * 1.2;
    const flash = this.hitFlash > 0;
    // legs
    ctx.fillStyle = '#31332b';
    const lo = Math.sin(this.walk) * 5;
    roundedRect(ctx, -8 + lo, -7, 13, 5, 2); ctx.fill();
    roundedRect(ctx, -8 - lo, 2, 13, 5, 2); ctx.fill();
    // arms reaching forward
    ctx.strokeStyle = flash ? '#d8d6c2' : this.skin;
    ctx.lineWidth = 4.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(17, -10 + Math.sin(this.walk + 1) * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(2, 7); ctx.lineTo(17, 10 + Math.sin(this.walk) * 2); ctx.stroke();
    // hands
    ctx.fillStyle = this.skin;
    ctx.beginPath(); ctx.arc(18, -10 + Math.sin(this.walk + 1) * 2, 2.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(18, 10 + Math.sin(this.walk) * 2, 2.6, 0, TAU); ctx.fill();
    // torso
    ctx.fillStyle = flash ? '#e6e1c8' : this.shirt;
    roundedRect(ctx, -9, -9 + bob * .2, 18, 18, 5); ctx.fill();
    // torn shirt
    ctx.fillStyle = 'rgba(15,16,12,.35)';
    ctx.beginPath(); ctx.moveTo(-4, -9); ctx.lineTo(1, -2); ctx.lineTo(-2, 8); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(90,25,18,.55)';
    ctx.beginPath(); ctx.ellipse(3, 1, 4.5, 3, .4, 0, TAU); ctx.fill();
    // head
    ctx.fillStyle = flash ? '#f0ead2' : this.skin;
    ctx.beginPath(); ctx.arc(2, 0, 7, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(30,30,22,.4)';
    ctx.beginPath(); ctx.arc(-.5, -1, 5.4, 0, TAU); ctx.fill();
    // eyes glow
    ctx.fillStyle = this.isBoss ? '#ff8a3c' : '#d6d38a';
    ctx.beginPath(); ctx.arc(5, -3, 1.5, 0, TAU); ctx.arc(5, 3, 1.5, 0, TAU); ctx.fill();
    // jaw
    ctx.fillStyle = 'rgba(90,30,25,.7)';
    ctx.beginPath(); ctx.ellipse(6.5, 0, 2.6, 2, 0, 0, TAU); ctx.fill();
    // shirt details
    ctx.strokeStyle = 'rgba(0,0,0,.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(4, -6); ctx.moveTo(-6, 6); ctx.lineTo(3, 6); ctx.stroke();
    if (this.isBoss) {
      ctx.fillStyle = '#3a3f2e';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#565a42'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * TAU;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); ctx.stroke();
      }
    }
    ctx.restore();

    // health bar
    if (this.hp < this.maxHp || this.isBoss) {
      const w = this.isBoss ? 90 : 32 * this.scale;
      const yy = this.y - (28 * this.scale) - 8;
      if (this.isBoss) return;
      ctx.fillStyle = 'rgba(5,7,5,.7)'; ctx.fillRect(this.x - w / 2 - 1, yy - 1, w + 2, 5);
      ctx.fillStyle = this.type === 'brute' ? '#c04a32' : '#b8723f';
      ctx.fillRect(this.x - w / 2, yy, w * (this.hp / this.maxHp), 3);
    }
  }
}

export class Bullet {
  constructor(x, y, vx, vy, dmg, pierce, crit, kind) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.dmg = dmg; this.pierce = pierce; this.crit = crit;
    this.kind = kind; this.life = .7; this.dead = false;
    this.hits = new Set();
    this.px = x; this.py = y;
  }
  update(dt, game) {
    this.px = this.x; this.py = this.y;
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    if (World.isBlocked(this.x, this.y, 2)) {
      this.dead = true;
      game.sparks(this.x, this.y, 3, '#d8c890');
      return;
    }
    for (const z of game.zombies) {
      if (z.dead || this.hits.has(z.id)) continue;
      if (dist2(this.x, this.y, z.x, z.y) < (z.r + 5) ** 2) {
        this.hits.add(z.id);
        game.damageZombie(z, this.dmg, game.player, this.crit);
        game.bloodBurst(this.x, this.y, this.crit ? 9 : 4, Math.atan2(this.vy, this.vx));
        if (this.crit) { Audio.crit(); game.floatingText(this.x, this.y - 12, 'KRITISCH', '#ffd27a'); }
        if (this.pierce > 0) { this.pierce--; } else { this.dead = true; }
        break;
      }
    }
  }
}

export class Pickup {
  constructor(x, y, type) {
    this.x = x; this.y = y; this.type = type; this.t = Math.random() * 6; this.dead = false; this.life = 45; this.r = 18;
  }
  update(dt, game) {
    this.t += dt; this.life -= dt;
    if (this.life <= 0) this.dead = true;
    if (game.player.hp > 0 && dist2(this.x, this.y, game.player.x, game.player.y) < 34 * 34) {
      this.collect(game);
    }
  }
  collect(game) {
    if (this.dead) return;
    this.dead = true;
    const p = game.player;
    let label = '';
    switch (this.type) {
      case 'medkit':
        p.heal(38);
        game.dogs.forEach(d => { if (d.state !== 'downed') d.heal(20); });
        label = '+38 LEBEN'; break;
      case 'ammo':
        for (const k of Object.keys(p.weapons)) {
          const w = p.weapons[k];
          if (w.reserve !== Infinity) w.reserve = Math.min(WEAPONS[k].reserve * 2, w.reserve + Math.ceil(WEAPONS[k].reserve * .45));
        }
        label = 'MUNITION AUFGEFÜLLT'; break;
      case 'adrenaline':
        p.damageBuff = 12; label = 'ADRENALIN · DMG ×2'; break;
      case 'speed':
        p.speedBuff = 12; label = 'HETZJAGD · TEMPO'; break;
      case 'shield':
        p.shield = Math.max(p.shield, 60); label = '+60 SCHILD'; break;
      case 'treat':
        game.dogs.forEach(d => { if (d.state === 'downed') d.revive(game, .6); else d.hp = Math.min(d.maxHp, d.hp + 55); });
        label = 'LECKERLI · HUNDE GEHEILT'; break;
    }
    game.floatingText(this.x, this.y - 10, label, '#ffd27a');
    game.toast(label.replace('·', '<b>·</b>'));
    Audio.powerup();
    game.ring(this.x, this.y, 30, this.type === 'medkit' ? 'rgba(210,90,80,' : 'rgba(255,210,122,');
  }
  draw(ctx, t) {
    const bob = Math.sin(this.t * 2.4) * 3;
    ctx.save();
    ctx.translate(this.x, this.y + bob);
    const colors = {
      medkit: ['#c4473a', '#ff8c78'], ammo: ['#b6903f', '#ffd27a'], adrenaline: ['#c0772e', '#ffbe62'],
      speed: ['#3f8b8a', '#7ee0d8'], shield: ['#3e6f9c', '#8dcdff'], treat: ['#7d9a52', '#c6e58a'],
    }[this.type] || ['#ccc', '#fff'];
    ctx.fillStyle = `rgba(${this.type === 'medkit' ? '196,71,58' : '227,161,60'},.12)`;
    ctx.beginPath(); ctx.arc(0, 0, 24 + Math.sin(this.t * 2) * 2, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.beginPath(); ctx.ellipse(2, 12, 12, 5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = colors[0];
    roundedRect(ctx, -9, -9, 18, 18, 4); ctx.fill();
    ctx.strokeStyle = colors[1]; ctx.lineWidth = 1.5;
    roundedRect(ctx, -9, -9, 18, 18, 4); ctx.stroke();
    ctx.fillStyle = colors[1];
    if (this.type === 'medkit') {
      ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
    } else if (this.type === 'ammo') {
      ctx.fillRect(-5, -6, 3, 11); ctx.fillRect(-1, -6, 3, 11); ctx.fillRect(3, -6, 3, 11);
    } else if (this.type === 'adrenaline') {
      ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 1); ctx.lineTo(0, 1); ctx.lineTo(3, 8); ctx.lineTo(-5, -1); ctx.lineTo(0, -1); ctx.closePath(); ctx.fill();
    } else if (this.type === 'speed') {
      ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(2, 0); ctx.lineTo(-6, 6); ctx.lineTo(-2, 0); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(8, 0); ctx.lineTo(0, 6); ctx.lineTo(4, 0); ctx.closePath(); ctx.fill();
    } else if (this.type === 'shield') {
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -4); ctx.lineTo(5, 5); ctx.lineTo(0, 8); ctx.lineTo(-5, 5); ctx.lineTo(-7, -4); ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(-2, -1, 4, 0, TAU); ctx.fill();
      ctx.fillRect(-10, 1, 16, 4);
    }
    ctx.restore();
  }
  heal() { }
}

// add Dog.heal
Dog.prototype.heal = function (n) { if (this.state !== 'downed') this.hp = Math.min(this.maxHp, this.hp + n); };
