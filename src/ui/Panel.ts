// src/ui/Panel.ts

import Phaser from 'phaser';
import { getColors } from '../config/themes';

export interface PanelConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  glowColor?: number;
  glowIntensity?: number;
  borderRadius?: number;
  fillAlpha?: number;
}

export class Panel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Graphics;
  private background: Phaser.GameObjects.Graphics;
  private config: PanelConfig;

  constructor(scene: Phaser.Scene, config: PanelConfig) {
    this.scene = scene;
    this.config = {
      glowIntensity: 0.3,
      borderRadius: 12,
      fillAlpha: 0.6,
      ...config,
    };

    this.container = scene.add.container(config.x, config.y);
    this.glow = scene.add.graphics();
    this.background = scene.add.graphics();

    this.container.add(this.glow);
    this.container.add(this.background);

    this.draw();
  }

  private draw(): void {
    const { width, height, glowColor, glowIntensity, borderRadius, fillAlpha } = this.config;
    const colors = getColors();
    const glow = glowColor || colors.uiPrimary;

    // Внешнее свечение
    for (let i = 4; i >= 1; i--) {
      this.glow.lineStyle(12 / i, glow, (glowIntensity || 0.3) * (i / 4));
      this.glow.strokeRoundedRect(
        -width / 2 - 2,
        -height / 2 - 2,
        width + 4,
        height + 4,
        borderRadius! + 2
      );
    }

    // Основной фон
    this.background.fillStyle(0x000000, fillAlpha);
    this.background.fillRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    // Верхняя светлая полоса
    this.background.fillStyle(0xffffff, 0.05);
    this.background.fillRoundedRect(
      -width / 2 + 2,
      -height / 2 + 2,
      width - 4,
      height / 3,
      { tl: borderRadius! - 2, tr: borderRadius! - 2, bl: 0, br: 0 } as any
    );

    // Рамка
    this.background.lineStyle(1.5, glow, 0.6);
    this.background.strokeRoundedRect(-width / 2, -height / 2, width, height, borderRadius);

    this.drawCornerAccents(width, height, glow);
  }

  private drawCornerAccents(width: number, height: number, color: number): void {
    const size = 15;
    const offset = 5;
    const hw = width / 2;
    const hh = height / 2;

    this.background.lineStyle(2, color, 0.8);

    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([dx, dy]) => {
      const cx = dx * (hw - offset);
      const cy = dy * (hh - offset);

      this.background.beginPath();
      this.background.moveTo(cx, cy - dy * size);
      this.background.lineTo(cx, cy);
      this.background.lineTo(cx - dx * size, cy);
      this.background.strokePath();
    });
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  setDepth(depth: number): void {
    this.container.setDepth(depth);
  }

  add(child: Phaser.GameObjects.GameObject): void {
    this.container.add(child);
  }

  destroy(): void {
    this.container.destroy();
  }
}