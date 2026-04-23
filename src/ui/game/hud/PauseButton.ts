// src/ui/game/hud/PauseButton.ts
// Компонент кнопки паузы

import Phaser from 'phaser';
import { getColors } from '../../../config/themes';
import { tgApp } from '../../../utils/TelegramWebApp';

// Константы для позиционирования
const PAUSE_BTN_MARGIN_RIGHT = 40;
const PAUSE_BTN_MARGIN_BOTTOM = 120; // Отступ от нижнего края (выше панели карт)

export interface PauseButtonConfig {
  onPress?: () => void;
}

export class PauseButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: PauseButtonConfig;
  private isEnabled = true;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PauseButtonConfig = {}) {
    this.scene = scene;
    this.config = config;
    
    this.container = this.create(x, y);
  }

  private create(x: number, y: number): Phaser.GameObjects.Container {
    const colors = getColors();
    const container = this.scene.add.container(x, y).setDepth(100);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(0, 0, 22);
    bg.lineStyle(2, colors.uiAccent, 0.5);
    bg.strokeCircle(0, 0, 22);
    container.add(bg);

    // Иконка паузы
    const icon = this.scene.add.graphics();
    icon.fillStyle(colors.uiAccent, 1);
    icon.fillRect(-7, -8, 4, 16);
    icon.fillRect(3, -8, 4, 16);
    container.add(icon);

    // Интерактивность
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, 22),
      Phaser.Geom.Circle.Contains
    );

    container.on('pointerover', () => {
      if (this.isEnabled) container.setScale(1.1);
    });

    container.on('pointerout', () => {
      container.setScale(1);
    });

    container.on('pointerdown', () => {
      if (this.isEnabled && this.config.onPress) {
        this.config.onPress();
      }
    });

    return container;
  }

  // ========== PUBLIC API ==========

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.container.setAlpha(enabled ? 1 : 0.5);
    
    if (enabled) {
      this.container.setInteractive();
    } else {
      this.container.disableInteractive();
    }
  }

  setOnPress(callback: () => void): void {
    this.config.onPress = callback;
  }

  setPosition(x: number, y: number): void {
    this.container.setPosition(x, y);
  }

  /**
   * Обновляет позицию кнопки с учетом текущих размеров экрана и безопасных зон
   */
  updatePosition(): void {
    const camera = this.scene.cameras.main;
    const safeBottom = tgApp.getBottomInset();
    
    const x = camera.width - PAUSE_BTN_MARGIN_RIGHT;
    const y = camera.height - safeBottom - PAUSE_BTN_MARGIN_BOTTOM;
    
    this.setPosition(x, y);
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  destroy(): void {
    this.container.destroy();
  }
}