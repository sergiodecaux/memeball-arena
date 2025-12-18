// src/config/gameConfig.ts

import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { ShopScene } from '../scenes/ShopScene';
import { ProfileScene } from '../scenes/ProfileScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { TacticsScene } from '../scenes/TacticsScene';

// Базовые размеры дизайна (ваши оригинальные)
export const DESIGN_WIDTH = 430;
export const DESIGN_HEIGHT = 932;
const ASPECT_RATIO = DESIGN_WIDTH / DESIGN_HEIGHT; // ~0.46 (портретный)

// Рассчитываем размеры с сохранением пропорций
const calculateGameSize = () => {
  const tg = (window as any).Telegram?.WebApp;
  
  let screenWidth: number;
  let screenHeight: number;
  
  if (tg) {
    tg.ready();
    tg.expand();
    screenWidth = tg.viewportWidth || window.innerWidth;
    screenHeight = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
  } else {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
  }
  
  let gameWidth: number;
  let gameHeight: number;
  
  const screenAspect = screenWidth / screenHeight;
  
  if (screenAspect > ASPECT_RATIO) {
    // Экран шире чем нужно (десктоп/планшет) - ограничиваем по высоте
    gameHeight = screenHeight;
    gameWidth = gameHeight * ASPECT_RATIO;
  } else {
    // Экран уже или равен (мобильный) - ограничиваем по ширине
    gameWidth = screenWidth;
    gameHeight = gameWidth / ASPECT_RATIO;
  }
  
  return {
    width: Math.floor(gameWidth),
    height: Math.floor(gameHeight)
  };
};

const gameSize = calculateGameSize();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  
  // Фиксированные пропорции дизайна
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  
  backgroundColor: '#0a0a12',
  
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  
  scene: [
    BootScene,
    MainMenuScene,
    GameScene,
    ShopScene,
    ProfileScene,
    SettingsScene,
    TacticsScene,
  ],
  
  scale: {
    mode: Phaser.Scale.FIT,  // Вписать с сохранением пропорций
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
  },
  
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
  },
  
  input: {
    activePointers: 3,
  }
};

// Хелпер для получения масштаба (если понадобится)
export const getScale = (game: Phaser.Game) => {
  return game.scale.displaySize.width / DESIGN_WIDTH;
};