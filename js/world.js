import { TAU, clamp, dist2, mulberry32, pointInRect, rand, roundedRect } from './util.js';

export const MAP = { w: 3600, h: 2600 };

export const PATHS = [
  [[1750, 430], [1750, 720], [1715, 1030], [1750, 1420]],
  [[1750, 1420], [1470, 1385], [1230, 1295], [1000, 1195]],
  [[1750, 1420], [2050, 1475], [2350, 1512], [2450, 1512]],
  [[1750, 1420], [1650, 1690], [1360, 1870], [1060, 1960]],
  [[1750, 660], [1950, 690], [2170, 755]],
];

export const BUILDINGS = [
  { id: 'gasthaus', x: 2450, y: 1180, w: 810, h: 760, name: 'ZUM ALTEN FORST', floor: 'wood' },
  { id: 'bunker', x: 500, y: 950, w: 480, h: 370, name: 'ZIVILSCHUTZ', floor: 'concrete' },
  { id: 'kiosk', x: 2060, y: 560, w: 220, h: 200, name: 'KIOSK', floor: 'tile' },
];

const FLOOR_RECTS = BUILDINGS.map(b => ({ x: b.x + 20, y: b.y + 20, w: b.w - 40, h: b.h - 40 }));

export const POND = { x: 880, y: 2110, rx: 255, ry: 152 };
export const CAMPFIRE = { x: 1750, y: 1420 };
export const PLAYER_START = { x: 1620, y: 1535 };

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function nearPath(x, y, radius = 68) {
  for (const path of PATHS) for (let i = 0; i < path.length - 1; i++) {
    if (segDist(x, y, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]) < radius) return true;
  }
  return false;
}

class WorldModel {
  constructor() {
    this.walls = [];
    this.solids = [];
    this.trees = [];
    this.bushes = [];
    this.rocks = [];
    this.cars = [];
    this.props = [];
    this.fences = [];
    this.lights = [];
    this.blood = [];
    this.corpses = [];
    this.seed = 20261108;
    this.time = 0;
    this.motes = [];
    this.ground = null;
    this.tufts = [];
  }

  init() {
    this.rng = mulberry32(this.seed);
    this.buildMap();
    this.generateForest();
    this.generateDetails();
    this.makeGround();
    this.makeMotes();
  }

  addWall(x, y, w, h, mat = 'stone') {
    const wall = { x, y, w, h, mat };
    this.walls.push(wall);
    this.solids.push(wall);
    return wall;
  }

  buildMap() {
    const W = this.addWall.bind(this);
    // ---------------- Gasthaus "Zum alten Forst" ----------------
    const g = BUILDINGS[0];
    W(g.x, g.y, g.w, 24, 'stone');
    W(g.x, g.y, 24, 300, 'stone');
    W(g.x, g.y + 392, 24, g.h - 392, 'stone');
    W(g.x, g.y + g.h - 24, 330, 24, 'stone');
    W(g.x + 440, g.y + g.h - 24, 370, 24, 'stone');
    W(g.x + g.w - 24, g.y, 24, g.h, 'stone');
    // inner walls with doors
    W(2860, 1204, 16, 196, 'wood');
    W(2860, 1490, 16, 162, 'wood');
    W(2860, 1770, 16, 130, 'wood');
    W(2876, 1652, 124, 16, 'wood');
    W(3090, 1652, 146, 16, 'wood');
    // bar, tables, furniture
    this.addProp(2500, 1260, 74, 322, 'bar');
    this.addProp(2660, 1300, 82, 82, 'table');
    this.addProp(2660, 1480, 82, 82, 'table');
    this.addProp(2620, 1710, 82, 82, 'table');
    this.addProp(2884, 1204, 320, 48, 'counter');
    this.addProp(3176, 1300, 52, 168, 'shelf');
    this.addProp(2920, 1750, 76, 76, 'crate');
    this.addProp(3030, 1818, 66, 66, 'crate');
    this.addProp(3110, 1730, 58, 58, 'crate');
    // rug
    this.props.push({ x: 2695, y: 1440, w: 170, h: 220, type: 'rug' });

    // ---------------- Bunker ----------------
    const b = BUILDINGS[1];
    W(b.x, b.y, b.w, 22, 'concrete');
    W(b.x, b.y, 22, b.h, 'concrete');
    W(b.x + b.w - 22, b.y, 22, 200, 'concrete');
    W(b.x + b.w - 22, b.y + 290, 22, b.h - 290, 'concrete');
    W(b.x, b.y + b.h - 22, b.w, 22, 'concrete');
    W(522, 1130, 158, 16, 'concrete');
    W(770, 1130, 188, 16, 'concrete');
    this.addProp(540, 982, 116, 44, 'bunk');
    this.addProp(540, 1048, 44, 112, 'locker');
    this.addProp(824, 988, 96, 44, 'desk');
    this.addProp(854, 1212, 66, 48, 'crate');

    // ---------------- Kiosk ----------------
    const k = BUILDINGS[2];
    W(k.x, k.y, k.w, 18, 'brick');
    W(k.x, k.y, 18, k.h, 'brick');
    W(k.x + k.w - 18, k.y, 18, k.h, 'brick');
    W(k.x, k.y + k.h - 18, 80, 18, 'brick');
    W(k.x + 150, k.y + k.h - 18, 70, 18, 'brick');
    this.addProp(2090, 646, 150, 38, 'counter');
    this.addProp(2244, 592, 24, 110, 'shelf');

    // ---------------- road wrecks ----------------
    this.cars.push({ x: 690, y: 292, w: 152, h: 70, rot: 0.04, color: '#5b5a4a', type: 'van' });
    this.cars.push({ x: 1440, y: 302, w: 162, h: 72, rot: -0.05, color: '#4c4f4a', type: 'car' });
    this.cars.push({ x: 2630, y: 288, w: 150, h: 68, rot: 0.09, color: '#3f4a52', type: 'police' });
    for (const c of this.cars) this.solids.push({ x: c.x + 6, y: c.y + 6, w: c.w - 12, h: c.h - 12, mat: 'car' });

    // ---------------- fences / sandbags / logs ----------------
    const fence = (x, y, w, h) => { this.fences.push({ x, y, w, h }); this.solids.push({ x, y, w, h, mat: 'fence' }); };
    fence(2400, 2005, 220, 14);
    fence(2710, 2005, 280, 14);
    fence(3250, 1980, 14, 160);
    fence(2360, 1180, 14, 120);
    // sandbags around the camp (gaps for movement)
    const bag = (x, y, w, h) => this.addProp(x, y, w, h, 'sandbag');
    bag(1530, 1300, 118, 26);
    bag(1850, 1300, 118, 26);
    bag(1480, 1600, 120, 26);
    bag(1900, 1580, 104, 26);
    bag(1690, 1260, 92, 24);
    // logs
    this.addProp(1230, 1760, 168, 30, 'log');
    this.addProp(2090, 1090, 156, 28, 'log');
    this.addProp(1930, 820, 130, 26, 'log');
    this.addProp(980, 700, 144, 28, 'log');

    // ---------------- lights ----------------
    this.lights.push({ x: CAMPFIRE.x, y: CAMPFIRE.y, r: 360, color: [255, 151, 62], intensity: 0.95, flicker: 0.18 });
    this.lights.push({ x: 2600, y: 1470, r: 300, color: [255, 196, 118], intensity: 0.66, flicker: 0.03 });
    this.lights.push({ x: 3030, y: 1480, r: 270, color: [255, 188, 112], intensity: 0.6, flicker: 0.04 });
    this.lights.push({ x: 3140, y: 1850, r: 180, color: [255, 176, 100], intensity: 0.42, flicker: 0.06 });
    this.lights.push({ x: 700, y: 1180, r: 250, color: [186, 210, 255], intensity: 0.5, flicker: 0.28 });
    this.lights.push({ x: 2180, y: 660, r: 180, color: [255, 214, 150], intensity: 0.45, flicker: 0.02 });
    for (const lx of [420, 1200, 2380, 3160]) this.lights.push({ x: lx, y: 468, r: 235, color: [255, 189, 110], intensity: 0.55, flicker: 0.12 });
    this.lights.push({ x: 1750, y: 430, r: 150, color: [255, 120, 80], intensity: 0.3, flicker: 0.3 });

    // spawn beacon points (used for ambient direction / minimap)
    this.spawns = [
      [180, 480], [3500, 640], [3400, 2300], [1750, 2490], [130, 2150], [2050, 120],
      [2900, 800], [500, 560], [1350, 1150], [2380, 2180], [900, 1600], [3000, 1950],
    ];
  }

  addProp(x, y, w, h, type) {
    const prop = { x, y, w, h, type };
    this.props.push(prop);
    if (!['rug'].includes(type)) this.solids.push(prop);
    return prop;
  }

  generateForest() {
    const rng = this.rng;
    const blocked = (x, y, pad) => {
      if (x < 34 || y < 34 || x > MAP.w - 34 || y > MAP.h - 34) return true;
      if (y < 490) return true;
      if (dist2(x, y, CAMPFIRE.x, CAMPFIRE.y) < 255 * 255) return true;
      for (const b of BUILDINGS) {
        if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
      }
      const px = (x - POND.x) / (POND.rx + 80), py = (y - POND.y) / (POND.ry + 80);
      if (px * px + py * py < 1) return true;
      for (const p of this.props) if (p.type === 'log' && x > p.x - 40 && x < p.x + p.w + 40 && y > p.y - 40 && y < p.y + p.h + 40) return true;
      return false;
    };

    // border forest ring (dense)
    for (let i = 0; i < 150; i++) {
      const side = (rng() * 4) | 0;
      let x, y;
      if (side === 0) { x = 20 + rng() * (MAP.w - 40); y = 10 + rng() * 120; }
      else if (side === 1) { x = 20 + rng() * (MAP.w - 40); y = MAP.h - 20 - rng() * 100; }
      else if (side === 2) { x = 10 + rng() * 110; y = rng() * MAP.h; }
      else { x = MAP.w - 10 - rng() * 110; y = rng() * MAP.h; }
      if (y < 500 && y > 200) y += 300;
      this.addTree(x, y, rng);
    }

    let tries = 0, count = 0;
    while (count < 285 && tries < 6000) {
      tries++;
      const x = 80 + rng() * (MAP.w - 160);
      const y = 520 + rng() * (MAP.h - 610);
      if (blocked(x, y, 72)) continue;
      if (nearPath(x, y, 76) && rng() > 0.14) continue;
      if (this.trees.some(t => dist2(x, y, t.x, t.y) < 60 * 60)) continue;
      if (zonesNear(x, y)) continue;
      this.addTree(x, y, rng);
      count++;
    }

    // a few hand-placed landmark trees
    for (const [x, y, s] of [[2280, 700, 1.4], [2260, 1680, 1.5], [1120, 720, 1.35], [1480, 1900, 1.3], [2900, 980, 1.25], [610, 1760, 1.4], [3200, 1080, 1.2]]) {
      this.addTree(x, y, mulberry32((x * y) | 0), s);
    }
  }

  addTree(x, y, rng, forceScale) {
    const type = rng() < 0.42 ? 'pine' : 'oak';
    const scale = forceScale || (0.78 + rng() * 0.66);
    const tree = {
      x, y, type, scale,
      r: (type === 'pine' ? 40 : 46) * scale,
      trunk: 12 * scale,
      tint: rng(),
      phase: rng() * TAU,
      sway: type === 'pine' ? 0.008 : 0.014,
    };
    this.trees.push(tree);
    this.solids.push({ x: x - tree.trunk, y: y - tree.trunk * 0.8, w: tree.trunk * 2, h: tree.trunk * 1.6, mat: 'trunk', tree: true });
  }

  generateDetails() {
    const rng = this.rng;
    for (let i = 0; i < 130; i++) {
      const x = 70 + rng() * (MAP.w - 140), y = 520 + rng() * (MAP.h - 590);
      if (nearPath(x, y, 54)) continue;
      if (y < 500) continue;
      if (this.trees.some(t => dist2(x, y, t.x, t.y) < 40 * 40)) continue;
      if (FLOOR_RECTS.some(r => pointInRect(x, y, r))) continue;
      if (dist2(x, y, CAMPFIRE.x, CAMPFIRE.y) < 190 * 190) continue;
      this.bushes.push({ x, y, r: 12 + rng() * 17, tint: rng(), type: rng() < 0.3 ? 'fern' : 'bush' });
    }
    for (let i = 0; i < 46; i++) {
      const x = 80 + rng() * (MAP.w - 160), y = 540 + rng() * (MAP.h - 620);
      if (nearPath(x, y, 70) || FLOOR_RECTS.some(r => pointInRect(x, y, r))) continue;
      const r = 11 + rng() * 18;
      this.rocks.push({ x, y, r, tint: rng() });
      this.solids.push({ x: x - r * .7, y: y - r * .5, w: r * 1.4, h: r, mat: 'rock' });
    }
    // scattered debris along the road
    for (let i = 0; i < 34; i++) {
      this.blood.push({ x: 60 + rng() * (MAP.w - 120), y: 270 + rng() * 230, r: 3 + rng() * 12, a: 0.25 + rng() * 0.3, seed: rng() });
    }
    // old corpses
    for (const [x, y, a] of [[800, 405, 1.1], [1580, 372, -0.6], [2820, 410, 2.4], [2180, 1520, 0.3], [1120, 1250, 2.1], [2000, 1760, -1.2]]) {
      this.corpses.push({ x, y, a, tint: rng() });
    }
  }

  makeMotes() {
    const rng = mulberry32(7733);
    for (let i = 0; i < 90; i++) {
      this.motes.push({ x: rng() * 1200, y: rng() * 800, r: 0.7 + rng() * 1.4, s: 0.15 + rng() * 0.5, p: rng() * TAU, glow: rng() < 0.3 });
    }
  }

  // =============== ground ===============
  makeGround() {
    const c = document.createElement('canvas');
    c.width = MAP.w; c.height = MAP.h;
    const x = c.getContext('2d');
    const rng = mulberry32(99117);
    // base
    const base = x.createLinearGradient(0, 0, MAP.w, MAP.h);
    base.addColorStop(0, '#1c2618'); base.addColorStop(0.45, '#182114'); base.addColorStop(1, '#131b12');
    x.fillStyle = base; x.fillRect(0, 0, MAP.w, MAP.h);

    // broad organic patches
    for (let i = 0; i < 240; i++) {
      const px = rng() * MAP.w, py = rng() * MAP.h, r = 40 + rng() * 190;
      x.globalAlpha = 0.05 + rng() * 0.08;
      x.fillStyle = ['#2c3a22', '#121a10', '#332d1d', '#25301c', '#1b2416'][(rng() * 5) | 0];
      x.beginPath(); x.ellipse(px, py, r, r * (0.4 + rng() * 0.7), rng() * TAU, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;

    // yard / clearing gravel
    this.paintBlob(x, 2840, 2000, 500, 260, '#3a352a', 0.55);
    this.paintBlob(x, 1750, 1420, 260, 220, '#3d3526', 0.85);
    this.paintBlob(x, 880, 1935, 320, 120, '#2a2e1b', 0.5);

    // dirt paths
    for (const path of PATHS) this.paintPath(x, path, 110, '#2f2a20', '#453b29');
    this.paintPath(x, [[1750, 1420], [1715, 1200], [1660, 980], [1640, 760], [1700, 500]], 44, '#2c281e', '#3b3425');

    // road
    this.paintRoad(x, rng);

    // pond
    this.paintPond(x, rng);

    // building floors
    this.paintBuildingFloors(x, rng);

    // grass detail
    for (let i = 0; i < 7200; i++) {
      const px = rng() * MAP.w, py = 470 + rng() * (MAP.h - 470);
      if (py < 500) continue;
      if (FLOOR_RECTS.some(r => pointInRect(px, py, r))) continue;
      if (nearPath(px, py, 48)) continue;
      const pxn = (px - POND.x) / POND.rx, pyn = (py - POND.y) / POND.ry;
      if (pxn * pxn + pyn * pyn < 1) continue;
      const h = 3 + rng() * 8;
      x.strokeStyle = ['#39481f', '#2f421d', '#44531f', '#28371a', '#4a4a22'][(rng() * 5) | 0];
      x.globalAlpha = 0.35 + rng() * 0.4;
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(px, py); x.lineTo(px + (rng() - .5) * 4, py - h);
      if (rng() < .5) { x.moveTo(px + 2, py); x.lineTo(px + 4, py - h * .7); }
      x.stroke();
    }
    x.globalAlpha = 1;

    // little flowers / mushrooms
    for (let i = 0; i < 190; i++) {
      const px = 100 + rng() * (MAP.w - 200), py = 540 + rng() * (MAP.h - 600);
      if (nearPath(px, py, 34) || FLOOR_RECTS.some(r => pointInRect(px, py, r))) continue;
      if (rng() < 0.55) { x.fillStyle = 'rgba(190,185,120,.7)'; x.fillRect(px, py, 1.6, 1.6); }
      else { x.fillStyle = 'rgba(120,70,54,.8)'; x.beginPath(); x.arc(px, py, 1.8, 0, TAU); x.fill(); }
    }

    // leaves & twigs
    for (let i = 0; i < 900; i++) {
      const px = 70 + rng() * (MAP.w - 140), py = 520 + rng() * (MAP.h - 580);
      x.fillStyle = ['#4a3c1e', '#5a4522', '#332c18', '#3e3d22'][(rng() * 4) | 0];
      x.globalAlpha = 0.25 + rng() * 0.35;
      x.save(); x.translate(px, py); x.rotate(rng() * TAU);
      x.fillRect(0, 0, 2 + rng() * 4, 1 + rng() * 1.5);
      x.restore();
    }
    x.globalAlpha = 1;

    // old blood
    for (const b of this.blood) {
      x.fillStyle = `rgba(58,18,14,${b.a})`;
      x.beginPath(); x.ellipse(b.x, b.y, b.r, b.r * 0.6, b.seed * TAU, 0, TAU); x.fill();
    }
    // corpses
    for (const co of this.corpses) this.paintCorpse(x, co);

    this.ground = c;
  }

  paintBlob(x, cx, cy, rx, ry, color, alpha) {
    x.save();
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * TAU;
      const n = 0.82 + Math.sin(a * 3 + cx) * 0.09 + Math.sin(a * 7 + cy) * 0.05;
      const px = cx + Math.cos(a) * rx * n, py = cy + Math.sin(a) * ry * n;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath(); x.fill(); x.restore();
  }

  paintPath(x, pts, width, outer, inner) {
    x.save();
    x.lineCap = 'round'; x.lineJoin = 'round';
    for (let pass = 0; pass < 3; pass++) {
      x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
      x.lineWidth = width - pass * 17;
      x.strokeStyle = pass === 0 ? outer : pass === 1 ? inner : 'rgba(90,78,52,.32)';
      x.globalAlpha = pass === 2 ? 0.5 : 1;
      x.stroke();
    }
    x.restore();
  }

  paintRoad(x, rng) {
    x.fillStyle = '#232722'; x.fillRect(0, 250, MAP.w, 190);
    x.fillStyle = '#2c302a'; x.fillRect(0, 240, MAP.w, 16);
    x.fillRect(0, 434, MAP.w, 30);
    x.fillStyle = 'rgba(180,175,140,.28)';
    for (let i = 0; i < 28; i++) x.fillRect(30 + i * 130, 344, 62, 4);
    x.fillStyle = 'rgba(90,88,74,.35)'; x.fillRect(0, 250, MAP.w, 3);
    // cracks
    x.strokeStyle = 'rgba(10,12,10,.55)'; x.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
      const px = rng() * MAP.w, py = 255 + rng() * 180;
      x.beginPath(); x.moveTo(px, py);
      x.lineTo(px + (rng() - .5) * 36, py + (rng() - .5) * 22);
      if (rng() < .4) x.lineTo(px + (rng() - .5) * 60, py + (rng() - .5) * 30);
      x.stroke();
    }
    // rust patches
    for (let i = 0; i < 26; i++) {
      x.fillStyle = 'rgba(60,45,30,.16)';
      x.beginPath(); x.ellipse(rng() * MAP.w, 270 + rng() * 160, 30 + rng() * 60, 14 + rng() * 30, 0, 0, TAU); x.fill();
    }
    // crosswalk near kiosk
    x.fillStyle = 'rgba(190,188,160,.20)';
    for (let i = 0; i < 7; i++) x.fillRect(1980 + i * 26, 250, 13, 190);
  }

  paintPond(x, rng) {
    const { x: cx, y: cy, rx, ry } = POND;
    // muddy shore
    x.save();
    x.fillStyle = '#2b2a1c'; x.beginPath(); x.ellipse(cx, cy, rx + 26, ry + 22, 0, 0, TAU); x.fill();
    x.fillStyle = '#33301f'; x.beginPath(); x.ellipse(cx, cy, rx + 10, ry + 9, 0, 0, TAU); x.fill();
    // water
    const wg = x.createRadialGradient(cx - 50, cy - 40, 20, cx, cy, rx);
    wg.addColorStop(0, '#223b38'); wg.addColorStop(0.55, '#1a2d2c'); wg.addColorStop(1, '#111d1d');
    x.fillStyle = wg; x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fill();
    // reflections
    x.globalAlpha = 0.16; x.strokeStyle = '#9fb7a4'; x.lineWidth = 1;
    for (let i = 0; i < 42; i++) {
      const px = cx - rx * .8 + rng() * rx * 1.6;
      const py = cy - ry * .8 + rng() * ry * 1.6;
      if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > .8) continue;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + 10 + rng() * 26, py); x.stroke();
    }
    x.globalAlpha = 0.5; x.fillStyle = '#3b4a2d';
    for (let i = 0; i < 60; i++) {
      const a = rng() * TAU, rr = 0.9 + rng() * .13;
      const px = cx + Math.cos(a) * rx * rr, py = cy + Math.sin(a) * ry * rr;
      x.strokeStyle = '#556138'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rng() - .5) * 5, py - 10 - rng() * 14); x.stroke();
    }
    x.restore();
  }

  paintBuildingFloors(x, rng) {
    const g = BUILDINGS[0];
    // wood floor
    x.fillStyle = '#3a2c20'; x.fillRect(g.x + 20, g.y + 20, g.w - 40, g.h - 40);
    for (let y = g.y + 24; y < g.y + g.h - 20; y += 22) {
      x.fillStyle = 'rgba(16,10,6,.35)'; x.fillRect(g.x + 20, y, g.w - 40, 1.4);
      for (let px = g.x + 20; px < g.x + g.w - 20; px += 150 + rng() * 80) {
        x.fillStyle = 'rgba(20,13,8,.3)'; x.fillRect(px, y, 1, 21);
      }
    }
    for (let i = 0; i < 80; i++) {
      x.fillStyle = `rgba(90,66,40,${0.05 + rng() * .08})`;
      x.fillRect(g.x + 24 + rng() * (g.w - 60), g.y + 24 + rng() * (g.h - 60), 10 + rng() * 60, 1.5 + rng() * 3);
    }
    // kitchen tile
    x.save(); x.beginPath(); x.rect(2876, 1204, 360, 448); x.clip();
    x.fillStyle = '#3a3b33'; x.fillRect(2876, 1204, 360, 448);
    for (let i = 0; i < 11; i++) for (let j = 0; j < 13; j++) {
      x.fillStyle = (i + j) % 2 ? 'rgba(210,205,180,.035)' : 'rgba(0,0,0,.06)';
      x.fillRect(2876 + i * 34, 1204 + j * 35, 32, 33);
    }
    x.restore();
    // bunker
    const b = BUILDINGS[1];
    x.fillStyle = '#36382f'; x.fillRect(b.x + 20, b.y + 20, b.w - 40, b.h - 40);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(0,0,0,${.04 + rng() * .1})`;
      x.beginPath(); x.ellipse(b.x + 30 + rng() * (b.w - 60), b.y + 30 + rng() * (b.h - 60), 4 + rng() * 20, 3 + rng() * 12, 0, 0, TAU); x.fill();
    }
    // kiosk tile
    const k = BUILDINGS[2];
    x.fillStyle = '#3c382c'; x.fillRect(k.x + 18, k.y + 18, k.w - 36, k.h - 36);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) {
      x.strokeStyle = 'rgba(0,0,0,.14)'; x.strokeRect(k.x + 18 + i * 24, k.y + 18 + j * 24, 24, 24);
    }
    // doorway thresholds
    x.fillStyle = 'rgba(80,70,52,.35)';
    x.fillRect(2450, 1460, 26, 110);
    x.fillRect(2780, 1916, 110, 26);
    x.fillRect(958, 1150, 24, 90);
    x.fillRect(2140, 742, 70, 20);
  }

  paintCorpse(x, co) {
    x.save(); x.translate(co.x, co.y); x.rotate(co.a);
    x.fillStyle = 'rgba(6,8,6,.35)'; x.beginPath(); x.ellipse(3, 5, 22, 10, 0, 0, TAU); x.fill();
    x.fillStyle = co.tint < .5 ? '#46483b' : '#4a3d33';
    x.beginPath(); x.ellipse(0, 0, 17, 8, 0, 0, TAU); x.fill();
    x.fillStyle = '#6b6856'; x.beginPath(); x.arc(16, -2, 6, 0, TAU); x.fill();
    x.strokeStyle = '#3c3a2f'; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(-10, -6); x.lineTo(-24, -14); x.moveTo(-10, 6); x.lineTo(-22, 12); x.stroke();
    x.fillStyle = 'rgba(70,20,15,.5)'; x.beginPath(); x.ellipse(4, 3, 16, 7, .3, 0, TAU); x.fill();
    x.restore();
  }

  // =============== drawing ===============
  drawGround(ctx, cam, vw, vh) {
    const sx = clamp(cam.x - vw / 2 - 20, 0, MAP.w);
    const sy = clamp(cam.y - vh / 2 - 20, 0, MAP.h);
    const sw = Math.min(vw + 40, MAP.w - sx), sh = Math.min(vh + 40, MAP.h - sy);
    const zoom = cam.zoom;
    // ground image drawn in screen coordinates for crispness
    ctx.drawImage(this.ground, sx, sy, sw, sh,
      (sx - (cam.x - vw / 2)) * zoom, (sy - (cam.y - vh / 2)) * zoom, sw * zoom, sh * zoom);
  }

  drawWater(ctx, t) {
    const { x, y, rx, ry } = POND;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#9eb9a6'; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const p = (t * 0.12 + i * 0.37) % 1;
      const py = y - ry * 0.55 + p * ry * 1.1;
      const w = Math.sin(p * Math.PI) * rx * 0.6;
      ctx.globalAlpha = Math.sin(p * Math.PI) * 0.13;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(i * 2 + t * .3) * 24, py, w * 0.25, 2, 0, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  drawStructures(ctx, t) {
    // fences first
    for (const f of this.fences) this.drawFence(ctx, f);
    // props
    for (const p of this.props) {
      if (p.type === 'rug') this.drawRug(ctx, p);
    }
    for (const p of this.props) if (p.type !== 'rug') this.drawProp(ctx, p);
    // cars
    for (const c of this.cars) this.drawCar(ctx, c);
  }

  drawFence(ctx, f) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(f.x + 4, f.y + 5, f.w, f.h);
    ctx.fillStyle = '#5b5340'; ctx.fillRect(f.x, f.y, f.w, f.h);
    ctx.fillStyle = '#7a7057'; ctx.fillRect(f.x, f.y, f.w, 3);
    ctx.fillStyle = '#3d372b';
    const along = f.w > f.h;
    const n = Math.floor((along ? f.w : f.h) / 16);
    for (let i = 0; i < n; i++) {
      if (along) ctx.fillRect(f.x + i * 16, f.y, 2, f.h); else ctx.fillRect(f.x, f.y + i * 16, f.w, 2);
    }
    ctx.restore();
  }

  drawRug(ctx, p) {
    ctx.save();
    ctx.fillStyle = '#4a2f24'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = 'rgba(160,120,70,.3)'; ctx.lineWidth = 3; ctx.strokeRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
    ctx.strokeStyle = 'rgba(20,12,8,.5)'; ctx.lineWidth = 1; ctx.strokeRect(p.x + 14, p.y + 14, p.w - 28, p.h - 28);
    ctx.restore();
  }

  drawProp(ctx, p) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(p.x + 5, p.y + 6, p.w, p.h);
    switch (p.type) {
      case 'bar':
        ctx.fillStyle = '#4b3724'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#6b4f33'; ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        for (let y = p.y + 12; y < p.y + p.h; y += 26) ctx.fillRect(p.x + 4, y, p.w - 8, 2);
        ctx.fillStyle = '#7f5f40'; ctx.fillRect(p.x, p.y, p.w, 5);
        break;
      case 'table':
        ctx.fillStyle = '#5a4229'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#7a5b3a'; ctx.fillRect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(p.x + 10, p.y + 10, p.w - 20, p.h - 20);
        break;
      case 'counter':
        ctx.fillStyle = '#4a4c40'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#6d6e5e'; ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 6);
        break;
      case 'shelf':
        ctx.fillStyle = '#3d392c'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = 'rgba(20,16,10,.7)';
        for (let i = 0; i < 4; i++) ctx.fillRect(p.x + 3, p.y + 8 + i * (p.h / 4), p.w - 6, 3);
        ctx.fillStyle = 'rgba(160,140,80,.35)';
        for (let i = 0; i < 6; i++) ctx.fillRect(p.x + 6 + (i * 7) % (p.w - 12), p.y + 12 + (i * 23) % (p.h - 20), 5, 8);
        break;
      case 'crate':
        ctx.fillStyle = '#5a4528'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#2e2414'; ctx.lineWidth = 2; ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
        ctx.beginPath(); ctx.moveTo(p.x + 3, p.y + 3); ctx.lineTo(p.x + p.w - 3, p.y + p.h - 3);
        ctx.moveTo(p.x + p.w - 3, p.y + 3); ctx.lineTo(p.x + 3, p.y + p.h - 3); ctx.stroke();
        break;
      case 'sandbag':
        ctx.fillStyle = '#665f45';
        for (let i = 0; i < Math.max(2, Math.round(p.w / 34)); i++) {
          roundedRect(ctx, p.x + i * (p.w / 4), p.y, p.w / 4 + 5, p.h / 2, 8); ctx.fill();
          roundedRect(ctx, p.x + 8 + i * (p.w / 4), p.y + p.h / 2, p.w / 4 + 5, p.h / 2, 8); ctx.fill();
        }
        break;
      case 'log':
        ctx.fillStyle = '#4c3d27'; roundedRect(ctx, p.x, p.y, p.w, p.h, p.h / 2); ctx.fill();
        ctx.fillStyle = '#5e4c31'; roundedRect(ctx, p.x + 2, p.y + 2, p.w - 4, p.h - 8, p.h / 2); ctx.fill();
        ctx.fillStyle = '#3a2e1d'; ctx.beginPath(); ctx.ellipse(p.x + p.w - 3, p.y + p.h / 2, 4, p.h / 2 - 3, 0, 0, TAU); ctx.fill();
        break;
      case 'bunk':
        ctx.fillStyle = '#4b4c3c'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#6c6850'; ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
        ctx.fillStyle = '#7d7a5e'; ctx.fillRect(p.x + 6, p.y + 5, p.w - 12, 8);
        break;
      case 'locker':
        ctx.fillStyle = '#3e423c'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.strokeStyle = '#252822'; ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
        ctx.fillStyle = '#767a6c'; ctx.fillRect(p.x + p.w - 10, p.y + p.h / 2 - 8, 3, 16);
        break;
      case 'desk':
        ctx.fillStyle = '#46382a'; ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = '#5d4b36'; ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4);
        ctx.fillStyle = '#a2a08a'; ctx.fillRect(p.x + 12, p.y + 8, 24, 18);
        break;
    }
    ctx.restore();
  }

  drawCar(ctx, c) {
    ctx.save();
    ctx.translate(c.x + c.w / 2, c.y + c.h / 2);
    ctx.rotate(c.rot);
    const w = c.w, h = c.h;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    roundedRect(ctx, -w / 2 + 5, -h / 2 + 7, w, h, 16); ctx.fill();
    ctx.fillStyle = c.color;
    roundedRect(ctx, -w / 2, -h / 2, w, h, 17); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,22,.85)';
    roundedRect(ctx, -w * .22, -h * .40, w * .40, h * .8, 6); ctx.fill();
    ctx.fillStyle = 'rgba(130,150,145,.20)';
    roundedRect(ctx, -w * .17, -h * .34, w * .26, h * .68, 4); ctx.fill();
    ctx.fillStyle = '#1b1d1a';
    ctx.fillRect(-w * .34, -h / 2 - 2, 26, 5); ctx.fillRect(w * .18, -h / 2 - 2, 26, 5);
    ctx.fillRect(-w * .34, h / 2 - 3, 26, 5); ctx.fillRect(w * .18, h / 2 - 3, 26, 5);
    ctx.fillStyle = 'rgba(120,110,80,.5)';
    ctx.fillRect(-w / 2 + 6, -h / 2 + 4, w - 12, 2);
    if (c.type === 'police') {
      ctx.fillStyle = '#2b3a55'; ctx.fillRect(-w * .12, -h / 2 + 2, w * .24, h * .94);
      ctx.fillStyle = '#ccb96a'; ctx.fillRect(-w * .35, -h / 2 + 3, w * .7, 2);
      ctx.fillStyle = 'rgba(80,110,160,.8)'; ctx.fillRect(-6, -h / 2 + 1, 12, 5);
    }
    if (c.type === 'van') { ctx.fillStyle = 'rgba(90,88,70,.35)'; ctx.fillRect(-w * .28, -h / 2 + 3, w * .56, h - 6); }
    // rust
    ctx.fillStyle = 'rgba(70,48,25,.35)';
    ctx.beginPath(); ctx.ellipse(w * .3, h * .2, 14, 6, .3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawTree(ctx, tree, t) {
    const { x, y, type, scale, tint } = tree;
    const sway = Math.sin(t * 0.7 + tree.phase) * tree.sway * 10 * scale;
    ctx.save();
    // trunk shadow
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(x + 14, y + 8, 24 * scale, 11 * scale, 0, 0, TAU); ctx.fill();
    if (type === 'pine') {
      const r = tree.r;
      const layers = [
        { rr: r * 1.0, c: tint > .5 ? '#1d2c1a' : '#22311c', off: 0 },
        { rr: r * .74, c: tint > .5 ? '#26371f' : '#2b3c23', off: -r * .12 },
        { rr: r * .48, c: '#344826', off: -r * .24 },
        { rr: r * .24, c: '#41552d', off: -r * .34 },
      ];
      for (const L of layers) {
        ctx.fillStyle = L.c;
        ctx.beginPath();
        const cx = x + sway * (1 + L.off / r), cy = y - r * .28 + L.off;
        for (let i = 0; i <= 22; i++) {
          const a = (i / 22) * TAU;
          const spike = 0.72 + Math.cos(a * 7) * 0.22 + Math.sin(a * 3 + tree.phase) * 0.1;
          const px = cx + Math.cos(a) * L.rr * spike;
          const py = cy + Math.sin(a) * L.rr * spike * 0.92;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.closePath(); ctx.fill();
      }
      // moon rim
      ctx.strokeStyle = 'rgba(140,170,120,.12)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x - r * .12 + sway, y - r * .45, r * .58, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
      // trunk top
      ctx.fillStyle = '#3a2b1b'; ctx.beginPath(); ctx.arc(x, y, tree.trunk * .8, 0, TAU); ctx.fill();
    } else {
      const r = tree.r;
      const blobs = [
        { dx: -r * .28, dy: -r * .14, rr: r * .62, c: '#26341d' },
        { dx: r * .3, dy: -r * .08, rr: r * .56, c: '#22301a' },
        { dx: 0, dy: -r * .34, rr: r * .60, c: '#2c3c21' },
        { dx: -r * .06, dy: -r * .1, rr: r * .54, c: '#334525' },
        { dx: r * .16, dy: -r * .38, rr: r * .35, c: '#3b4d29' },
        { dx: -r * .34, dy: -r * .34, rr: r * .30, c: '#314226' },
      ];
      ctx.fillStyle = 'rgba(0,0,0,.3)';
      ctx.beginPath(); ctx.ellipse(x + 16, y + 6, r * .8, r * .42, 0, 0, TAU); ctx.fill();
      for (const b of blobs) {
        ctx.fillStyle = b.c;
        ctx.beginPath(); ctx.ellipse(x + b.dx + sway, y - r * .3 + b.dy, b.rr, b.rr * .92, 0, 0, TAU); ctx.fill();
      }
      // highlight leaves
      ctx.fillStyle = 'rgba(110,140,80,.16)';
      for (let i = 0; i < 7; i++) {
        const a = i * 2.1 + tree.phase;
        ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * .42 + sway, y - r * .42 + Math.sin(a) * r * .25, r * .16, r * .10, a, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = '#3a2b1b'; ctx.beginPath(); ctx.arc(x, y, tree.trunk * .85, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(x + 2, y + 2, tree.trunk * .6, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  drawBush(ctx, b) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(b.x + 4, b.y + 5, b.r, b.r * .7, 0, 0, TAU); ctx.fill();
    const base = b.type === 'fern' ? '#2b4122' : '#2f4022';
    ctx.fillStyle = base;
    ctx.beginPath(); ctx.ellipse(b.x, b.y, b.r, b.r * .78, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = b.tint > .5 ? '#3d5129' : '#374a26';
    for (let i = 0; i < 5; i++) {
      const a = i * 1.7 + b.tint * 5;
      ctx.beginPath(); ctx.ellipse(b.x + Math.cos(a) * b.r * .4, b.y + Math.sin(a) * b.r * .3, b.r * .45, b.r * .3, a, 0, TAU); ctx.fill();
    }
    if (b.type === 'fern') {
      ctx.strokeStyle = '#4d6234'; ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * .35;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(a) * b.r * 1.2, b.y + Math.sin(a) * b.r * .9); ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawRock(ctx, rock) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.ellipse(rock.x + 4, rock.y + 4, rock.r, rock.r * .7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rock.tint > .5 ? '#4b4c42' : '#41443c';
    ctx.beginPath();
    for (let i = 0; i <= 9; i++) {
      const a = (i / 9) * TAU, rr = rock.r * (0.82 + Math.sin(i * 2.7 + rock.tint * 9) * .16);
      const px = rock.x + Math.cos(a) * rr, py = rock.y + Math.sin(a) * rr * .75;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(150,155,135,.18)';
    ctx.beginPath(); ctx.ellipse(rock.x - rock.r * .2, rock.y - rock.r * .2, rock.r * .45, rock.r * .25, -.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // =============== collision ===============
  isBlocked(x, y, r = 14) {
    if (x < 30 + r || y < 30 + r || x > MAP.w - 30 - r || y > MAP.h - 30 - r) return true;
    const px = (x - POND.x) / (POND.rx + r), py = (y - POND.y) / (POND.ry + r);
    if (px * px + py * py < 1) return true;
    for (const s of this.solids) {
      if (s.mat === 'trunk' || s.mat === 'rock') continue;
      if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
    }
    for (const t of this.trees) if (dist2(x, y, t.x, t.y) < (t.trunk * .9 + r) ** 2) return true;
    for (const rk of this.rocks) if (dist2(x, y, rk.x, rk.y) < (rk.r * .75 + r) ** 2) return true;
    return false;
  }

  moveCircle(ent, dx, dy, r) {
    ent.x += dx;
    for (let pass = 0; pass < 2; pass++) {
      this.resolve(ent, r);
    }
    ent.y += dy;
    for (let pass = 0; pass < 2; pass++) this.resolve(ent, r);
    // world bounds
    ent.x = clamp(ent.x, 34 + r, MAP.w - 34 - r);
    ent.y = clamp(ent.y, 34 + r, MAP.h - 34 - r);
  }

  resolve(ent, r) {
    // pond ellipse
    const ex = (ent.x - POND.x) / (POND.rx + r), ey = (ent.y - POND.y) / (POND.ry + r);
    const ed = ex * ex + ey * ey;
    if (ed < 1 && ed > 0.00001) {
      const k = 1 / Math.sqrt(ed);
      ent.x = POND.x + (ent.x - POND.x) * k;
      ent.y = POND.y + (ent.y - POND.y) * k;
    }
    for (const s of this.solids) {
      const cx = clamp(ent.x, s.x, s.x + s.w);
      const cy = clamp(ent.y, s.y, s.y + s.h);
      const dx = ent.x - cx, dy = ent.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (r - d) / d;
          ent.x += dx * push; ent.y += dy * push;
        } else {
          const left = ent.x - s.x, right = s.x + s.w - ent.x;
          const top = ent.y - s.y, bottom = s.y + s.h - ent.y;
          const m = Math.min(left, right, top, bottom);
          if (m === left) ent.x = s.x - r;
          else if (m === right) ent.x = s.x + s.w + r;
          else if (m === top) ent.y = s.y - r;
          else ent.y = s.y + s.h + r;
        }
      }
    }
    for (const t of this.trees) {
      const rr = t.trunk * .9 + r;
      if (dist2(ent.x, ent.y, t.x, t.y) < rr * rr) {
        const d = Math.hypot(ent.x - t.x, ent.y - t.y) || 0.01;
        ent.x = t.x + (ent.x - t.x) / d * rr;
        ent.y = t.y + (ent.y - t.y) / d * rr;
      }
    }
    for (const rk of this.rocks) {
      const rr = rk.r * .75 + r;
      if (dist2(ent.x, ent.y, rk.x, rk.y) < rr * rr) {
        const d = Math.hypot(ent.x - rk.x, ent.y - rk.y) || 0.01;
        ent.x = rk.x + (ent.x - rk.x) / d * rr;
        ent.y = rk.y + (ent.y - rk.y) / d * rr;
      }
    }
  }

  lineBlocked(x1, y1, x2, y2) {
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 30);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 10)) return true;
    }
    return false;
  }

  insideBuilding(x, y) {
    return BUILDINGS.find(b => x > b.x + 18 && x < b.x + b.w - 18 && y > b.y + 18 && y < b.y + b.h - 18) || null;
  }
}

function zonesNear(x, y) {
  // keep a couple of clearings open for fights
  const zones = [[2350, 900, 190], [900, 1500, 190], [2700, 2200, 200], [1250, 2250, 170], [3200, 1500, 180]];
  return zones.some(([zx, zy, r]) => dist2(x, y, zx, zy) < r * r);
}

export const World = new WorldModel();
