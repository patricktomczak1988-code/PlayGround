import { Game } from './game.js';

const game = new Game(document.getElementById('game'));
window.__game = game;
game.init();

// keep audio alive after tab switches without auto-pausing the action
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    import('./audio.js').then(m => m.Audio.resume()).catch(() => {});
  }
});
