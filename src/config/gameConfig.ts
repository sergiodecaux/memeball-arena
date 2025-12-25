// src/config/gameConfig.ts

import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { MatchmakingScene } from '../scenes/MatchmakingScene';
import { GameScene } from '../scenes/GameScene';
import { ShopScene } from '../scenes/ShopScene';
import { ProfileScene } from '../scenes/ProfileScene';
import { SettingsScene } from '../scenes/SettingsScene';
import { TeamScene } from '../scenes/TeamScene'; // ← НОВАЯ сцена Team (замена TacticsScene)
import { ProfileSetupScene } from '../scenes/ProfileSetupScene';
import { FactionSelectScene } from '../scenes/FactionSelectScene';

export const DESIGN_WIDTH = 430;
export const DESIGN_HEIGHT = 932;

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',

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
    FactionSelectScene,  // ← Экран выбора фракции (показывается первым для новых игроков)
    ProfileSetupScene,   // ← Затем настройка профиля
    MainMenuScene,
    MatchmakingScene,
    GameScene,
    ShopScene,
    ProfileScene,
    SettingsScene,
    TeamScene,           // ← НОВАЯ: замена TacticsScene
  ],

  scale: {
    mode: Phaser.Scale.FIT,
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
  },

  // НОВОЕ: для DOM input (поле ввода никнейма)
  dom: {
    createContainer: true,
  },

  banner: false,
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