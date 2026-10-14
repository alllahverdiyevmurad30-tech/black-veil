// Entry point. game.js is imported dynamically so a missing three.js shows a readable error instead of a blank page.
const boot = document.getElementById('boot');
try {
  if (!window.THREE || String(window.THREE.REVISION) !== '128') throw new Error('Three.js r128 runtime was not loaded. Check vendor/three.min.js or the network mirror fallback.');
  const { Game } = await import('./game.js');
  window.game = new Game();
} catch (e) {
  console.error(e); boot.hidden = false; boot.textContent = 'BLACK VEIL could not start: ' + e.message;
}
