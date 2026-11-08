const world = {
  width: 2200,
  height: 1700,
};

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = {
  round: document.getElementById('roundValue'),
  health: document.getElementById('healthValue'),
  gold: document.getElementById('goldValue'),
  skill: document.getElementById('skillValue'),
  status: document.getElementById('statusText'),
  message: document.getElementById('messageBox'),
  panel: document.getElementById('upgradePanel'),
  list: document.getElementById('upgradeList'),
};

const keys = {};
const mouse = { x: canvas.width / 2, y: canvas.height / 2, down: false };

const buildings = [
  { x: 220, y: 220, w: 220, h: 180 },
  { x: 620, y: 260, w: 250, h: 180 },
  { x: 1040, y: 240, w: 260, h: 200 },
  { x: 1450, y: 260, w: 220, h: 180 },
  { x: 1820, y: 220, w: 230, h: 180 },
  { x: 330, y: 760, w: 220, h: 210 },
  { x: 820, y: 760, w: 260, h: 210 },
  { x: 1320, y: 740, w: 260, h: 220 },
  { x: 1750, y: 760, w: 240, h: 210 },
  { x: 680, y: 1210, w: 220, h: 200 },
  { x: 1140, y: 1220, w: 240, h: 200 },
  { x: 1540, y: 1185, w: 250, h: 210 },
];

const fences = [
  { x: 150, y: 150, w: 1850, h: 18 },
  { x: 150, y: 150, w: 18, h: 1310 },
  { x: 150, y: 1440, w: 1850, h: 18 },
  { x: 1980, y: 150, w: 18, h: 1310 },
  { x: 500, y: 590, w: 1100, h: 18 },
  { x: 460, y: 1030, w: 1220, h: 18 },
];

const upgradeCatalog = {
  damage: {
    name: 'Sharpshooter',
    description: 'Mehr Schaden pro Treffer.',
    apply: (p) => {
      p.bulletDamage += 6;
      p.critChance = Math.min(0.45, p.critChance + 0.04);
    },
  },
  fireRate: {
    name: 'Schneller Draw',
    description: 'Schnelleres Schießen und weniger Nachladezeit.',
    apply: (p) => {
      p.fireRate *= 0.92;
      p.reloadSpeed = p.reloadSpeed ? p.reloadSpeed * 0.94 : p.fireRate * 0.94;
    },
  },
  vitality: {
    name: 'Robuster Reiter',
    description: 'Mehr Lebensenergie und etwas Gesundheit pro Sekunde.',
    apply: (p) => {
      p.maxHealth += 18;
      p.health = Math.min(p.maxHealth, p.health + 18);
      p.regen += 0.7;
    },
  },
  dogs: {
    name: 'Wolf Pack',
    description: 'Die Hunde schlagen härter und schneller zu.',
    apply: (p) => {
      p.dogDamage += 9;
      p.dogCooldown *= 0.9;
    },
  },
  support: {
    name: 'Treuer Beschützer',
    description: 'Die Hunde folgen enger und ziehen mehr Zombies an.',
    apply: (p) => {
      p.dogRange += 18;
      p.dogSpeed += 25;
      p.supportShield = Math.min(0.65, p.supportShield + 0.08);
    },
  },
  crit: {
    name: 'Lucky Shot',
    description: 'Wahrscheinlichkeit für kritische Treffer steigt.',
    apply: (p) => {
      p.critChance = Math.min(0.6, p.critChance + 0.08);
      p.bulletDamage += 2;
    },
  },
};

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 18,
  speed: 210,
  health: 100,
  maxHealth: 100,
  regen: 0.5,
  aimX: canvas.width / 2,
  aimY: canvas.height / 2,
  facing: 0,
  bulletDamage: 18,
  bulletSpeed: 560,
  fireRate: 0.18,
  critChance: 0.12,
  lastShot: 0,
  dogDamage: 16,
  dogCooldown: 0.9,
  dogRange: 150,
  dogSpeed: 170,
  supportShield: 0,
  invuln: 0,
};

const game = {
  round: 1,
  gold: 0,
  skillPoints: 2,
  state: 'running',
  roundMessageTimer: 0,
  waveSpawned: 0,
  waveQueue: 0,
  over: false,
  startDelay: 0,
  nextRoundReady: false,
  lastTime: 0,
};

const bullets = [];
const zombies = [];
const dogTeam = [];
const particles = [];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function randBetween(min, max) {
  return min + Math.random() * (max - min);
}

function rectCircleCollision(rect, circle) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.w);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy < circle.radius * circle.radius;
}

function isBlocked(x, y, radius) {
  const test = { x, y, radius };
  return fences.some((f) => rectCircleCollision(f, test)) || buildings.some((b) => rectCircleCollision(b, test));
}

function addParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: randBetween(-90, 90),
      vy: randBetween(-90, 90),
      life: randBetween(0.3, 0.8),
      color,
      radius: randBetween(2, 5),
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function randomSpawnPoint() {
  let x = randBetween(190, world.width - 190);
  let y = randBetween(190, world.height - 190);
  let attempts = 0;

  while ((isBlocked(x, y, 18) || Math.hypot(x - player.x, y - player.y) < 360) && attempts < 100) {
    x = randBetween(190, world.width - 190);
    y = randBetween(190, world.height - 190);
    attempts += 1;
  }

  return { x, y };
}

function spawnZombie() {
  const point = randomSpawnPoint();
  const hp = 18 + game.round * 8;
  zombies.push({
    x: point.x,
    y: point.y,
    radius: 18,
    speed: 40 + game.round * 10,
    health: hp,
    maxHealth: hp,
    damage: 7 + game.round * 2,
    hitCooldown: 0,
    color: '#9ad36d',
  });
}

function spawnDog(offset) {
  dogTeam.push({
    x: player.x,
    y: player.y,
    radius: 12,
    offset,
    angle: 0,
    attackCooldown: 0,
    color: '#d4c7b0',
  });
}

function spawnWave() {
  const count = 7 + game.round * 2;
  game.waveQueue = count;
  game.waveSpawned = 0;
  game.startDelay = 0.6;
  hud.status.textContent = `Runde ${game.round} — Zombies nähern sich`;
}

function populateUpgrades() {
  hud.list.innerHTML = '';
  const keys = Object.keys(upgradeCatalog);
  keys.forEach((key) => {
    const upgrade = upgradeCatalog[key];
    const card = document.createElement('div');
    card.className = 'upgrade-card';

    card.innerHTML = `
      <h3>${upgrade.name}</h3>
      <p>${upgrade.description}</p>
      <button data-upgrade="${key}">Verbessern</button>
    `;

    card.querySelector('button').addEventListener('click', () => {
      if (game.skillPoints <= 0 || game.state !== 'upgrade') return;
      upgradeCatalog[key].apply(player);
      game.skillPoints -= 1;
      game.state = 'running';
      hud.panel.classList.add('hidden');
      hud.message.classList.add('hidden');
      if (game.skillPoints <= 0) {
        game.round += 1;
        game.state = 'running';
        hud.status.textContent = `Runde ${game.round} — Dorf sichern`;
        spawnWave();
      } else {
        hud.status.textContent = 'Fähigkeiten verbessert — weiter kämpfen';
      }
      updateHud();
    });
    hud.list.appendChild(card);
  });
}

function updateHud() {
  hud.round.textContent = String(game.round);
  hud.health.textContent = `${Math.ceil(player.health)} / ${player.maxHealth}`;
  hud.gold.textContent = String(game.gold);
  hud.skill.textContent = String(game.skillPoints);
}

function showMessage(text) {
  hud.message.textContent = text;
  hud.message.classList.remove('hidden');
  game.roundMessageTimer = 1.8;
}

function checkRoundState() {
  if (zombies.length === 0 && game.waveQueue === 0 && game.state === 'running' && !game.over) {
    game.state = 'upgrade';
    game.skillPoints += 1;
    hud.status.textContent = `Runde ${game.round} — Runde abgeschlossen`;
    hud.panel.classList.remove('hidden');
    player.invuln = 0;
    showMessage('Runde gewonnen! Wähle eine Verbesserung.');
    updateHud();
  }
}

function shoot() {
  const now = performance.now() / 1000;
  if (now - player.lastShot < player.fireRate) return;
  player.lastShot = now;

  const playerScreenX = player.x - camera.x;
  const playerScreenY = player.y - camera.y;
  const dx = mouse.x - playerScreenX;
  const dy = mouse.y - playerScreenY;
  const angle = Math.atan2(dy, dx);
  player.facing = angle;

  const spread = 0.06;
  const shotAngle = angle + randBetween(-spread, spread);
  const speed = player.bulletSpeed;
  bullets.push({
    x: player.x,
    y: player.y,
    vx: Math.cos(shotAngle) * speed,
    vy: Math.sin(shotAngle) * speed,
    radius: 5,
    damage: player.bulletDamage,
    ttl: 1.2,
    color: '#f1d08e',
    crit: Math.random() < player.critChance,
  });
}

function fireBullets(dt) {
  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.ttl -= dt;

    let hit = false;
    for (let z = zombies.length - 1; z >= 0; z -= 1) {
      const zombie = zombies[z];
      if (distance(bullet, zombie) < bullet.radius + zombie.radius) {
        const damage = bullet.crit ? bullet.damage * 1.9 : bullet.damage;
        zombie.health -= damage;
        addParticles(zombie.x, zombie.y, bullet.crit ? '#f8d57d' : '#f9d47a', 8);
        if (zombie.health <= 0) {
          game.gold += 10;
          addParticles(zombie.x, zombie.y, '#d4f26d', 18);
          zombies.splice(z, 1);
        }
        hit = true;
        break;
      }
    }

    if (hit || bullet.ttl <= 0 || bullet.x < 0 || bullet.y < 0 || bullet.x > world.width || bullet.y > world.height) {
      bullets.splice(i, 1);
    }
  }
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) dy -= 1;
  if (keys['s'] || keys['arrowdown']) dy += 1;
  if (keys['a'] || keys['arrowleft']) dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx || dy) {
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const nextX = player.x + nx * player.speed * dt;
    const nextY = player.y + ny * player.speed * dt;

    if (!isBlocked(nextX, player.y, player.radius)) player.x = nextX;
    if (!isBlocked(player.x, nextY, player.radius)) player.y = nextY;
  }

  player.x = clamp(player.x, 60, world.width - 60);
  player.y = clamp(player.y, 60, world.height - 60);

  player.health = clamp(player.health + player.regen * dt, 0, player.maxHealth);
  if (player.invuln > 0) player.invuln -= dt;

  if (mouse.down && !hud.panel.classList.contains('hidden')) {
    mouse.down = false;
  }

  if (mouse.down && game.state === 'running') {
    shoot();
  }
}

function updateDogs(dt) {
  if (dogTeam.length === 0) return;

  dogTeam.forEach((dog, index) => {
    const target = player;
    const angle = Math.atan2(target.y - dog.y, target.x - dog.x);
    const orbit = (index - 0.5) * Math.PI;
    const orbitX = Math.cos(angle + orbit) * player.dogRange * 0.35;
    const orbitY = Math.sin(angle + orbit) * player.dogRange * 0.35;
    const desireX = target.x + orbitX - dog.x;
    const desireY = target.y + orbitY - dog.y;
    const len = Math.hypot(desireX, desireY) || 1;
    dog.x += (desireX / len) * player.dogSpeed * dt;
    dog.y += (desireY / len) * player.dogSpeed * dt;
    dog.attackCooldown -= dt;

    const nearest = zombies.reduce((best, z) => {
      const d = distance(dog, z);
      if (d < best.dist) return { dist: d, zombie: z };
      return best;
    }, { dist: Infinity, zombie: null });

    if (nearest.zombie && nearest.dist < player.dogRange) {
      const attackRange = 34;
      if (nearest.dist <= attackRange && dog.attackCooldown <= 0) {
        nearest.zombie.health -= player.dogDamage;
        nearest.zombie.hitCooldown = 0.2;
        addParticles(nearest.zombie.x, nearest.zombie.y, '#d7d2c7', 10);
        dog.attackCooldown = player.dogCooldown;
        if (nearest.zombie.health <= 0) {
          game.gold += 12;
          addParticles(nearest.zombie.x, nearest.zombie.y, '#9ae884', 20);
          zombies.splice(zombies.indexOf(nearest.zombie), 1);
        }
      }
    }
  });
}

function updateZombies(dt) {
  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const z = zombies[i];
    z.hitCooldown = Math.max(0, z.hitCooldown - dt);

    const dx = player.x - z.x;
    const dy = player.y - z.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;

    const nextX = z.x + nx * z.speed * dt;
    const nextY = z.y + ny * z.speed * dt;

    if (!isBlocked(nextX, z.y, z.radius)) z.x = nextX;
    if (!isBlocked(z.x, nextY, z.radius)) z.y = nextY;

    if (distance(z, player) < z.radius + player.radius + 2) {
      if (z.hitCooldown <= 0) {
        const baseDamage = z.damage + (game.round * 0.5);
        const dmg = baseDamage * (1 - player.supportShield);
        player.health -= dmg;
        player.invuln = 0.25;
        z.hitCooldown = 0.5;
        addParticles(player.x, player.y, '#ff8877', 8);
      }
      if (player.health <= 0) {
        player.health = 0;
        game.over = true;
        game.state = 'gameover';
        showMessage('Das Dorf ist gefallen. Drücke R zum Neustart.');
      }
    }
  }
}

function updateWave(dt) {
  if (game.state !== 'running' || game.over) return;

  if (game.waveQueue > 0) {
    game.startDelay -= dt;
    if (game.startDelay <= 0) {
      spawnZombie();
      game.waveQueue -= 1;
      game.startDelay = Math.max(0.28, 0.75 - game.round * 0.03);
    }
  }
}

function updateCamera() {
  const targetX = player.x - canvas.width / 2;
  const targetY = player.y - canvas.height / 2;
  const camX = clamp(targetX, 0, world.width - canvas.width);
  const camY = clamp(targetY, 0, world.height - canvas.height);
  camera.x = camX;
  camera.y = camY;
}

const camera = { x: 0, y: 0 };

function drawBackground() {
  ctx.fillStyle = '#3a653a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const viewOffsetX = camera.x;
  const viewOffsetY = camera.y;

  ctx.save();
  ctx.translate(-viewOffsetX, -viewOffsetY);

  ctx.fillStyle = '#426d3d';
  ctx.fillRect(0, 0, world.width, world.height);

  for (let x = 0; x < world.width; x += 70) {
    for (let y = 0; y < world.height; y += 70) {
      ctx.fillStyle = (x + y) % 140 === 0 ? '#4d7d44' : '#3f683a';
      ctx.fillRect(x, y, 70, 70);
    }
  }

  ctx.fillStyle = '#b58b5d';
  ctx.fillRect(110, 140, 1860, 25);
  ctx.fillRect(110, 1440, 1860, 25);
  ctx.fillRect(110, 140, 25, 1330);
  ctx.fillRect(1965, 140, 25, 1330);

  ctx.fillStyle = '#9b7b52';
  ctx.fillRect(510, 540, 1180, 80);
  ctx.fillRect(430, 1020, 1320, 80);

  for (const building of buildings) {
    ctx.fillStyle = '#8a562d';
    ctx.fillRect(building.x, building.y, building.w, building.h);
    ctx.fillStyle = '#57381d';
    ctx.fillRect(building.x + 18, building.y + 18, building.w - 36, building.h - 36);
    ctx.fillStyle = '#c8ae76';
    for (let ix = 0; ix < building.w; ix += 40) {
      ctx.fillRect(building.x + ix + 10, building.y + 10, 6, 18);
    }
  }

  ctx.restore();
}

function drawPlayer() {
  const screenX = player.x - camera.x;
  const screenY = player.y - camera.y;

  ctx.save();
  ctx.translate(screenX, screenY);

  ctx.fillStyle = '#5f3b22';
  ctx.fillRect(-6, -5, 12, 18);

  ctx.fillStyle = '#d9b376';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f3e0b2';
  ctx.fillRect(-12, -18, 24, 12);
  ctx.fillStyle = '#2c210f';
  ctx.fillRect(-10, -22, 20, 6);

  ctx.strokeStyle = '#7a4226';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(Math.cos(player.facing) * 26, Math.sin(player.facing) * 26);
  ctx.stroke();

  ctx.restore();
}

function drawDogs() {
  dogTeam.forEach((dog, index) => {
    const px = dog.x - camera.x;
    const py = dog.y - camera.y;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#d3d0cb';
    ctx.beginPath();
    ctx.arc(0, 0, dog.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#685d48';
    ctx.fillRect(-10, -4, 20, 8);
    ctx.fillStyle = '#4d3d2f';
    ctx.fillRect(-8, -14, 5, 12);
    ctx.fillRect(3, -14, 5, 12);
    ctx.restore();
  });
}

function drawBullets() {
  bullets.forEach((bullet) => {
    const x = bullet.x - camera.x;
    const y = bullet.y - camera.y;
    ctx.fillStyle = bullet.crit ? '#ffdd82' : '#f7d373';
    ctx.beginPath();
    ctx.arc(x, y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawZombies() {
  zombies.forEach((zombie) => {
    const x = zombie.x - camera.x;
    const y = zombie.y - camera.y;

    ctx.fillStyle = '#819e5c';
    ctx.beginPath();
    ctx.arc(x, y, zombie.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#262522';
    ctx.fillRect(x - 16, y - 30, 32, 5);
    ctx.fillStyle = '#59d359';
    const hpWidth = 32 * (zombie.health / zombie.maxHealth);
    ctx.fillRect(x - 16, y - 30, hpWidth, 5);
  });
}

function drawParticles() {
  particles.forEach((p) => {
    const x = p.x - camera.x;
    const y = p.y - camera.y;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.fillRect(x, y, p.radius, p.radius);
    ctx.globalAlpha = 1;
  });
}

function drawHudWorld() {
  const playerScreenX = player.x - camera.x;
  const playerScreenY = player.y - camera.y;

  ctx.fillStyle = '#fff6d1';
  ctx.font = 'bold 14px Arial';
  ctx.fillText('Cowboy', playerScreenX - 18, playerScreenY - 36);

  if (game.state === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 42px Arial';
    ctx.fillText('Dorf verloren', 300, 260);
    ctx.font = '22px Arial';
    ctx.fillText('Drücke R für einen neuen Versuch', 280, 310);
  }
}

function render() {
  drawBackground();
  drawBullets();
  drawZombies();
  drawDogs();
  drawPlayer();
  drawParticles();
  drawHudWorld();
}

function update(dt) {
  if (game.state === 'running') {
    updatePlayer(dt);
    updateDogs(dt);
    updateZombies(dt);
    fireBullets(dt);
    updateWave(dt);
    checkRoundState();
  }

  updateParticles(dt);
  updateCamera();
  updateHud();

  if (game.roundMessageTimer > 0) {
    game.roundMessageTimer -= dt;
    if (game.roundMessageTimer <= 0) {
      hud.message.classList.add('hidden');
    }
  }
}

let lastFrame = performance.now();
function gameLoop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.035);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

function handleKey(e, isDown) {
  const key = e.key.toLowerCase();
  if (key === 'r' && game.over) {
    restartGame();
    return;
  }
  keys[key] = isDown;
}

function restartGame() {
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.health = 100;
  player.maxHealth = 100;
  player.regen = 0.5;
  player.bulletDamage = 18;
  player.bulletSpeed = 560;
  player.fireRate = 0.18;
  player.critChance = 0.12;
  player.lastShot = 0;
  player.dogDamage = 16;
  player.dogCooldown = 0.9;
  player.dogRange = 150;
  player.dogSpeed = 170;
  player.supportShield = 0;
  bullets.length = 0;
  zombies.length = 0;
  dogTeam.length = 0;
  particles.length = 0;
  game.gold = 0;
  game.skillPoints = 0;
  game.round = 1;
  game.state = 'running';
  game.over = false;
  game.waveQueue = 0;
  spawnDog(0);
  spawnDog(1);
  updateCamera();
  showMessage('Neues Dorf. Die erste Runde beginnt.');
  spawnWave();
  hud.panel.classList.add('hidden');
  updateHud();
}

window.addEventListener('keydown', (event) => handleKey(event, true));
window.addEventListener('keyup', (event) => handleKey(event, false));

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  const playerScreenX = player.x - camera.x;
  const playerScreenY = player.y - camera.y;
  player.facing = Math.atan2(mouse.y - playerScreenY, mouse.x - playerScreenX);
});

canvas.addEventListener('mousedown', () => {
  mouse.down = true;
});

canvas.addEventListener('mouseup', () => {
  mouse.down = false;
});

window.addEventListener('contextmenu', (event) => event.preventDefault());

function initialSetup() {
  populateUpgrades();
  restartGame();
}

initialSetup();
requestAnimationFrame(gameLoop);
