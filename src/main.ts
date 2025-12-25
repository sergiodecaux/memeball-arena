// src/main.ts

import Phaser from 'phaser';
import { tgApp } from './utils/TelegramWebApp';
import { BootScene } from './scenes/BootScene';
import { FactionSelectScene } from './scenes/FactionSelectScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { MatchmakingScene } from './scenes/MatchmakingScene';
import { ShopScene } from './scenes/ShopScene';
import { ProfileScene } from './scenes/ProfileScene';
import { ProfileSetupScene } from './scenes/ProfileSetupScene';
import { SettingsScene } from './scenes/SettingsScene';
import { TeamScene } from './scenes/TeamScene'; // ← НОВАЯ СЦЕНА

// Инициализируем Telegram WebApp ДО создания игры
const viewport = tgApp.getViewport();
console.log('[Main] Starting game with viewport:', viewport);

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: viewport.width,
    height: viewport.stableHeight,
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,
    FactionSelectScene,
    MainMenuScene,
    GameScene,
    MatchmakingScene,
    ShopScene,
    ProfileScene,
    ProfileSetupScene,
    SettingsScene,
    TeamScene,           // ← НОВАЯ: замена TacticsScene + TeamModal
  ],
  backgroundColor: '#050505',
  
  // ✅ PIXEL-PERFECT РЕЖИМ — КРИТИЧНО ВАЖНО
  render: {
    pixelArt: true,        // Отключает билинейную фильтрацию
    antialias: false,      // Отключает сглаживание
    antialiasGL: false,    // Отключает WebGL сглаживание
    roundPixels: true,     // Округляет позиции до целых пикселей
  },
};

// Создаём игру
const game = new Phaser.Game(config);

// Обновляем размер при изменении viewport
tgApp.onViewportChange((newViewport) => {
  console.log('[Main] Viewport changed, resizing game:', newViewport);
  game.scale.resize(newViewport.width, newViewport.stableHeight);
});

// Обработка resize окна браузера (для десктопа)
window.addEventListener('resize', () => {
  if (!tgApp.isInTelegram()) {
    game.scale.resize(window.innerWidth, window.innerHeight);
  }
});