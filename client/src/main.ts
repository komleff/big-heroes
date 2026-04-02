import { Application } from 'pixi.js';

// Точка входа — инициализация PixiJS Application
async function main(): Promise<void> {
  const app = new Application();

  await app.init({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x000000,
    resizeTo: window,
  });

  document.body.appendChild(app.canvas);
}

main();
