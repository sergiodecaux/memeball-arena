// src/ui/menu/MenuBackground.ts
// Фон главного меню с градиентами, сеткой и партиклами

import Phaser from 'phaser';
import { getColors } from '../../config/themes';
import { tgApp } from '../../utils/TelegramWebApp';

export class MenuBackground {
  private scene: Phaser.Scene;
  private s: number;
  private floatingElements: Phaser.GameObjects.Arc[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.s = tgApp.getUIScale();
  }

  create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();

    // Базовый фон
    this.scene.add.rectangle(width / 2, height / 2, width, height, 0x050505).setDepth(-1);

    // Фоновое изображение или заливка
    if (this.scene.textures.exists('ui_home_bg')) {
      this.scene.add.image(width / 2, height / 2, 'ui_home_bg')
        .setDisplaySize(width, height)
        .setDepth(0);
    } else {
      const bg = this.scene.add.graphics();
      bg.fillStyle(0x050505, 1);
      bg.fillRect(0, 0, width, height);
      bg.setDepth(0);
    }

    // Радиальные градиенты
    const gradientGraphics = this.scene.add.graphics().setDepth(1);
    this.drawRadialGradient(gradientGraphics, width / 2, 0, height * 0.9, colors.backgroundGradientTop, 0.65);
    this.drawRadialGradient(gradientGraphics, width / 2, height, height * 0.4, colors.uiAccentPink, 0.12);

    // Сетка
    this.createGrid(width, height);

    // Партиклы
    this.createParticles(width, height);
  }

  private drawRadialGradient(
    graphics: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    maxR: number,
    color: number,
    maxAlpha: number
  ): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      graphics.fillStyle(color, maxAlpha * Math.pow(1 - ratio, 2));
      graphics.fillCircle(cx, cy, maxR * ratio);
    }
  }

  private createGrid(width: number, height: number): void {
    const grid = this.scene.add.graphics().setDepth(1);
    grid.lineStyle(1, 0x1a1a2e, 0.15);
    
    for (let x = 0; x <= width; x += 50 * this.s) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 50 * this.s) {
      grid.lineBetween(0, y, width, y);
    }
  }

  private createParticles(width: number, height: number): void {
    const colors = getColors();
    const particleColors = [colors.uiAccent, colors.uiAccentPink, colors.uiPrimary];

    for (let i = 0; i < 15; i++) {
      const particle = this.scene.add.circle(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(100, height - 100),
        Phaser.Math.FloatBetween(1, 2.5),
        Phaser.Math.RND.pick(particleColors),
        Phaser.Math.FloatBetween(0.2, 0.45)
      ).setDepth(2);
      
      this.floatingElements.push(particle);
    }
  }

  startAnimations(): void {
    this.floatingElements.forEach((particle, i) => {
      this.scene.tweens.add({
        targets: particle,
        y: particle.y - Phaser.Math.Between(20, 40),
        alpha: { from: particle.alpha, to: 0.1 },
        duration: Phaser.Math.Between(4000, 8000),
        yoyo: true,
        repeat: -1,
        delay: i * 100,
        ease: 'Sine.easeInOut',
      });
    });
  }

  update(): void {
    // Можно добавить динамические эффекты при необходимости
  }

  destroy(): void {
    this.floatingElements.forEach(el => {
      if (el && el.active) {
        this.scene.tweens.killTweensOf(el);
        el.destroy();
      }
    });
    this.floatingElements = [];
  }
}