import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { MatchVSScene } from '../scenes/MatchVSScene';
// import { LeakGuardPlugin } from '../plugins/LeakGuardPlugin';
// import { tgApp } from '../utils/TelegramWebApp';
// ⚡ Остальные сцены импортируются динамически через SceneLoader

export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

// Упрощаем, без проверки производительности
const isLowEnd = false;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT,
  backgroundColor: '#050505', // Унифицировано с Telegram theme-color
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [
    BootScene,        // Core: Загрузка ассетов
    MainMenuScene,    // Core: Главное меню
    GameScene,        // Core: Игровая сцена
    MatchVSScene,    // Core: VS экран перед матчем
    // Остальные сцены загружаются динамически через SceneLoader
  ],
  scale: {
    mode: Phaser.Scale.RESIZE, // ИЗМЕНЕНО: Был FIT. RESIZE лучше для TWA.
    parent: 'game-container',
    width: '100%',
    height: '100%',
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // ОПТИМИЗАЦИЯ РЕНДЕРА (зависит от класса производительности)
  render: {
    pixelArt: false,
    antialias: !isLowEnd, // Отключаем сглаживание на слабых устройствах
    antialiasGL: !isLowEnd,
    powerPreference: 'default',
    batchSize: isLowEnd ? 1024 : 2048,
    maxTextures: isLowEnd ? 2 : 4,
  },
  
  // ОПТИМИЗАЦИЯ FPS (зависит от класса производительности)
  fps: {
    target: isLowEnd ? 30 : 60, // 30 FPS для слабых андроидов
    min: 30, // ✅ Разрешаем падение FPS вместо крашей
    forceSetTimeOut: true, // Стабильнее для таймингов на мобилках
  },
  
  input: {
    activePointers: 3,
    touch: {
      capture: true,  // Захватывать touch события
    },
  },
  dom: {
    createContainer: true,
  },
  disableContextMenu: true,
  banner: false,
  // plugins: {
  //   scene: [
  //     {
  //       key: 'LeakGuard',
  //       plugin: LeakGuardPlugin,
  //       mapping: 'leakGuard',
  //       start: true,
  //     },
  //   ],
  // },
  callbacks: {
    preBoot: (game) => {
      // Дополнительная защита при загрузке
      if (game.canvas) {
        game.canvas.style.touchAction = 'none';
      }
    }
  },
};

export const getScale = (game: Phaser.Game) => {
  return game.scale.displaySize.width / DESIGN_WIDTH;
};

/**
 * Применить пользовательский масштаб экрана
 */
export const applyScreenScale = (game: Phaser.Game, scale: number) => {
  const baseWidth = DESIGN_WIDTH;
  const baseHeight = DESIGN_HEIGHT;

  // Уменьшаем базовый размер = игра становится больше на экране
  const newWidth = Math.round(baseWidth / scale);
  const newHeight = Math.round(baseHeight / scale);

  game.scale.setGameSize(newWidth, newHeight);
};
