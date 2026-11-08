/* Procedural audio: no external assets. */
import { clamp, rand } from './util.js';

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.started = false;
    this.lastGrowl = 0;
    this.ambientNodes = [];
  }

  init() {
    if (this.started) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.started = true;
      this.startAmbience();
    } catch (e) { this.started = false; }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  noiseBuffer(seconds = 1) {
    const n = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  startAmbience() {
    if (!this.ctx) return;
    const c = this.ctx;
    // wind / forest bed
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(3);
    src.loop = true;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    const gain = c.createGain();
    gain.gain.value = 0.055;
    src.connect(filter).connect(gain).connect(this.master);
    src.start();
    // slow wind movement
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    // low drone
    const drone = c.createOscillator();
    drone.type = 'sawtooth';
    drone.frequency.value = 41;
    const dfilter = c.createBiquadFilter();
    dfilter.type = 'lowpass';
    dfilter.frequency.value = 120;
    const dgain = c.createGain();
    dgain.gain.value = 0.018;
    drone.connect(dfilter).connect(dgain).connect(this.master);
    drone.start();
    this.ambientNodes.push(src, lfo, drone);
    // distant crows / creaks scheduled
    const tick = () => {
      if (!this.ctx) return;
      if (!this.muted && Math.random() < 0.55) this.ambientCreak();
      setTimeout(tick, 7000 + Math.random() * 9000);
    };
    setTimeout(tick, 5000);
  }

  ambientCreak() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(rand(220, 340), t);
    o.frequency.exponentialRampToValueAtTime(rand(90, 150), t + 0.6);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.025, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 0.9);
  }

  // --- helpers ---
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, vol = 0.3, filterType = 'lowpass', freq = 1200, q = 1, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(Math.max(0.1, dur));
    const f = c.createBiquadFilter();
    f.type = filterType; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  shoot(kind = 'pistol') {
    if (!this.ctx) return;
    if (kind === 'shotgun') {
      this.noise(0.34, 0.55, 'lowpass', 1400, 0.7, 0, 260);
      this.tone(90, 0.22, 'square', 0.2, 40);
      this.noise(0.1, 0.25, 'highpass', 2400, 0.6);
    } else if (kind === 'smg') {
      this.noise(0.11, 0.28, 'bandpass', 1700, 0.9);
      this.tone(140, 0.08, 'square', 0.1, 60);
    } else if (kind === 'rifle') {
      this.noise(0.28, 0.45, 'lowpass', 2000, 0.8, 0, 300);
      this.tone(110, 0.18, 'sawtooth', 0.14, 44);
    } else {
      this.noise(0.13, 0.3, 'bandpass', 1500, 1);
      this.tone(180, 0.09, 'square', 0.09, 70);
    }
  }

  reload() { this.noise(0.06, 0.18, 'highpass', 1800, 1); this.tone(520, 0.05, 'square', 0.05, 320); }
  reloadDone() { this.tone(680, 0.06, 'square', 0.08, 900); this.noise(0.08, 0.14, 'highpass', 2200); }
  empty() { this.tone(900, 0.04, 'square', 0.1, 600); }
  hit() { this.noise(0.07, 0.16, 'lowpass', 900, 1); }
  crit() { this.tone(1250, 0.07, 'triangle', 0.14, 700); }
  kill() { this.noise(0.24, 0.2, 'lowpass', 500, 0.8, 0, 120); this.tone(72, 0.3, 'sine', 0.12, 38); }
  hurt() { this.noise(0.22, 0.3, 'lowpass', 380, 1); this.tone(120, 0.3, 'sawtooth', 0.1, 50); }
  pickup() { this.tone(600, 0.09, 'triangle', 0.16, 900); this.tone(900, 0.12, 'triangle', 0.12, 1300, 0.08); }
  powerup() { [440, 660, 880].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.14, f * 1.2, i * 0.07)); }
  levelup() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.32, 'triangle', 0.17, f, i * 0.09)); }
  dash() { this.noise(0.25, 0.24, 'bandpass', 900, 0.7, 0, 340); }
  bark() {
    this.noise(0.1, 0.22, 'bandpass', 700, 2);
    this.tone(330, 0.1, 'square', 0.13, 180);
    this.tone(250, 0.09, 'sawtooth', 0.08, 140, 0.08);
  }
  growl() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (t - this.lastGrowl < 0.5) return;
    this.lastGrowl = t;
    this.tone(rand(65, 95), 0.5, 'sawtooth', 0.06, 45);
    this.noise(0.4, 0.05, 'lowpass', 300, 1);
  }
  bossRoar() {
    this.tone(58, 1.2, 'sawtooth', 0.32, 26);
    this.noise(1.1, 0.35, 'lowpass', 500, 0.7, 0, 90);
    this.tone(110, 0.9, 'square', 0.14, 40, 0.1);
  }
  explosion() {
    this.noise(0.8, 0.5, 'lowpass', 900, 0.8, 0, 60);
    this.tone(60, 0.6, 'sine', 0.3, 25);
  }
  door() { this.noise(0.18, 0.18, 'bandpass', 420, 1.4, 0, 200); }
  wave() { [220, 277, 330].forEach((f, i) => this.tone(f, 0.65, 'sawtooth', 0.07, f, i * 0.02)); }
}

export const Audio = new AudioEngine();
