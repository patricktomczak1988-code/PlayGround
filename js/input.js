import { clamp } from './util.js';

class InputManager {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, justDown: false, justUp: false, right: false };
    this.isTouch = false;
    this.pad = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, fire: false, dash: false, reload: false, use: false, start: false };
    this._prevPad = {};
    this.touch = { moveX: 0, moveY: 0, aimX: 0, aimY: 0, aimActive: false, fire: false, dash: false, reload: false, use: false };
    this.anyInput = false;
  }

  init(canvas) {
    this.canvas = canvas;
    this.isTouch = window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && window.innerWidth < 1100);
    window.addEventListener('keydown', e => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.anyInput = true;
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.touch.fire = false; });
    const setMouse = e => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    };
    window.addEventListener('mousemove', setMouse);
    canvas.addEventListener('mousedown', e => {
      setMouse(e);
      if (e.button === 0) { this.mouse.down = true; this.mouse.justDown = true; }
      if (e.button === 2) this.mouse.right = true;
      this.anyInput = true;
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) { this.mouse.down = false; this.mouse.justUp = true; }
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('touchstart', () => { this.anyInput = true; }, { passive: true });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) { gp = p; break; }
    const p = this.pad;
    if (!gp) { p.moveX = p.moveY = p.aimX = p.aimY = 0; p.fire = p.dash = p.reload = p.use = p.start = false; p.aimActive = false; return; }
    const dz = v => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
    p.moveX = dz(gp.axes[0] || 0);
    p.moveY = dz(gp.axes[1] || 0);
    const ax = dz(gp.axes[2] || 0), ay = dz(gp.axes[3] || 0);
    const al = Math.hypot(ax, ay);
    if (al > 0.2) { p.aimX = ax / al; p.aimY = ay / al; p.aimActive = true; }
    else { p.aimX = p.aimY = 0; p.aimActive = false; }
    const btn = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    p.fire = btn(7) || btn(5) || btn(0) && false;
    p.dash = btn(1) || btn(4);
    p.reload = btn(2) || btn(3);
    p.use = btn(3) || btn(4);
    p.start = btn(9);
    if (p.fire) this.anyInput = true;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.justDown = false;
    this.mouse.justUp = false;
    this.touch.dash = false;
    this.touch.reload = false;
    this.touch.use = false;
  }
}

export const Input = new InputManager();
