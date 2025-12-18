// src/main.ts

import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

// Ждём загрузку DOM
const startGame = () => {
  const tg = (window as any).Telegram?.WebApp;
  
  if (tg) {
    // Инициализация Telegram Mini App
    tg.ready();
    tg.expand();
    
    // Отключаем вертикальные свайпы (чтобы не закрывалось приложение)
    tg.disableVerticalSwipes?.();
    
    // Устанавливаем цвет хедера
    tg.setHeaderColor('#0a0a12');
    tg.setBackgroundColor('#0a0a12');
    
    console.log('Telegram WebApp initialized:', {
      platform: tg.platform,
      viewportWidth: tg.viewportWidth,
      viewportHeight: tg.viewportHeight,
      viewportStableHeight: tg.viewportStableHeight
    });
  }
  
  // Создаём игру
  const game = new Phaser.Game(gameConfig);
  
  // Обработка изменения размера окна в Telegram
  if (tg) {
    tg.onEvent('viewportChanged', (event: { isStateStable: boolean }) => {
      if (event.isStateStable) {
        game.scale.resize(tg.viewportWidth, tg.viewportStableHeight);
      }
    });
  }
  
  // Fallback для обычного браузера
  window.addEventListener('resize', () => {
    if (!tg) {
      game.scale.resize(window.innerWidth, window.innerHeight);
    }
  });
  
  return game;
};

// Запуск
if (document.readyState === 'complete') {
  startGame();
} else {
  window.addEventListener('load', startGame);
}