import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

console.log('🚀 Starting Galaxy League...');

// Простая инициализация Telegram WebApp (если доступен)
const tg = (window as any).Telegram?.WebApp;
if (tg) {
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor('#050505');
    tg.setBackgroundColor('#050505');
    console.log('[Main] Telegram WebApp initialized');
  } catch (e) {
    console.warn('[Main] Telegram WebApp init failed:', e);
  }
}

// Создаём игру сразу, без async/await
const game = new Phaser.Game(gameConfig);

// Обработка resize
window.addEventListener('resize', () => {
  game.scale.refresh();
});

// Сохраняем ссылку на игру
(window as any).game = game;
(window as any).__GAME__ = game;

console.log('[Main] Phaser.Game created');
