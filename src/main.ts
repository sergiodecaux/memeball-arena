// src/main.ts

import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig';

const startGame = () => {
  const tg = (window as any).Telegram?.WebApp;
  
  if (tg) {
    try {
      tg.ready();
    } catch (e) {
      console.warn('tg.ready() failed:', e);
    }
    
    try {
      tg.expand();
    } catch (e) {
      console.warn('tg.expand() failed:', e);
    }
    
    // Эти функции могут не поддерживаться в старых версиях
    try {
      if (tg.disableVerticalSwipes) {
        tg.disableVerticalSwipes();
      }
    } catch (e) {
      console.warn('disableVerticalSwipes not supported');
    }
    
    try {
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#0a0a12');
      }
    } catch (e) {
      console.warn('setHeaderColor not supported');
    }
    
    try {
      if (tg.setBackgroundColor) {
        tg.setBackgroundColor('#0a0a12');
      }
    } catch (e) {
      console.warn('setBackgroundColor not supported');
    }
  }
  
  // Создаём игру
  const game = new Phaser.Game(gameConfig);
  
  return game;
};

// Запуск после загрузки DOM
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(startGame, 100);
} else {
  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(startGame, 100);
  });
}