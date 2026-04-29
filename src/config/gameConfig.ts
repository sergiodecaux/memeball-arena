import Phaser from 'phaser';
import { BootScene } from '../scenes/BootScene';
import { MainMenuScene } from '../scenes/MainMenuScene';
import { GameScene } from '../scenes/GameScene';
import { MatchVSScene } from '../scenes/MatchVSScene';

export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

function getMobileGameSize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  return {
    width: Math.max(320, Math.min(width, 1920)),
    height: Math.max(480, Math.min(height, 1080)),
  };
}

const { width, height } = getMobileGameSize();

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width,
  height,
  backgroundColor: '#050505',
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 0 },
      debug: false,
      enableSleeping: true,
    },
  },
  scene: [
    BootScene,
    MainMenuScene,
    GameScene,
    MatchVSScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
    antialiasGL: true,
    powerPreference: 'high-performance',
    batchSize: 2048,
    maxTextures: 8,
    roundPixels: true,
    transparent: false,
    clearBeforeRender: true,
  },
  fps: {
    target: 60,
    min: 30,
    forceSetTimeOut: false,
    smoothStep: true,
  },
  input: {
    activePointers: 3,
    touch: {
      target: null,
      capture: true,
    },
  },
  dom: {
    createContainer: true,
  },
  disableContextMenu: true,
  banner: false,
  callbacks: {
    preBoot: (game) => {
      if (game.canvas) {
        game.canvas.style.touchAction = 'none';
      }
    },
    postBoot: (game) => {
      console.log('[Game] Booted successfully');

      const handleResize = () => {
        const size = getMobileGameSize();
        game.scale.resize(size.width, size.height);
      };

      window.addEventListener('resize', handleResize);
      window.addEventListener('orientationchange', () => {
        setTimeout(handleResize, 100);
      });
    },
  },
};

export const getScale = (game: Phaser.Game) => {
  return game.scale.displaySize.width / DESIGN_WIDTH;
};

export const applyScreenScale = (game: Phaser.Game, scale: number) => {
  const newWidth = Math.round(DESIGN_WIDTH / scale);
  const newHeight = Math.round(DESIGN_HEIGHT / scale);
  game.scale.setGameSize(newWidth, newHeight);
};
