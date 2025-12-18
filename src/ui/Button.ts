// src/ui/Button.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';

export interface ButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
  style?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  icon?: string;
  onClick?: () => void;
}

export class Button {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private glow: Phaser.GameObjects.Graphics;
  private background: Phaser.GameObjects.Graphics;
  private shine: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private config: ButtonConfig;
  private isHovered: boolean = false;

  constructor(scene: Phaser.Scene, config: ButtonConfig) {
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(100);

    this.glow = scene.add.graphics();
    this.background = scene.add.graphics();
    this.shine = scene.add.graphics();

    this.container.add(this.glow);
    this.container.add(this.background);
    this.container.add(this.shine);

    const displayText = config.icon ? `${config.icon}  ${config.text}` : config.text;
    this.label = scene.add.text(0, 0, displayText, {
      fontSize: `${config.fontSize || 18}px`,
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    this.label.setOrigin(0.5, 0.5);
    this.container.add(this.label);

    this.draw(false, false);
    this.setupInteraction();
    this.addIdleAnimation();
  }

  private getStyleColors(): { bg: number; border: number; glow: number; text: string } {
    const colors = getColors();

    switch (this.config.style) {
      case 'secondary':
        return { bg: 0x1a1a2e, border: colors.uiPrimary, glow: colors.uiPrimary, text: '#ffffff' };
      case 'accent':
        return { bg: 0x0a2525, border: colors.uiAccent, glow: colors.uiAccent, text: hexToString(colors.uiAccent) };
      case 'danger':
        return { bg: 0x2a0a0a, border: colors.team2Primary, glow: colors.team2Primary, text: '#ffffff' };
      case 'ghost':
        return { bg: 0x000000, border: colors.uiTextSecondary, glow: colors.uiTextSecondary, text: '#888888' };
      default:
        return { bg: 0x0a1a2a, border: colors.uiAccent, glow: colors.uiAccent, text: '#ffffff' };
    }
  }

  private draw(pressed: boolean, hover: boolean): void {
    const { width, height } = this.config;
    const hw = width / 2;
    const hh = height / 2;
    const radius = 10;
    const style = this.getStyleColors();

    this.glow.clear();
    this.background.clear();
    this.shine.clear();

    // Свечение при наведении
    if (hover && this.config.style !== 'ghost') {
      for (let i = 4; i >= 1; i--) {
        this.glow.lineStyle(16 / i, style.glow, 0.15 * i);
        this.glow.strokeRoundedRect(-hw - 3, -hh - 3, width + 6, height + 6, radius + 3);
      }
    }

    // Фон
    const bgAlpha = pressed ? 0.9 : (hover ? 0.8 : 0.6);
    this.background.fillStyle(style.bg, bgAlpha);
    this.background.fillRoundedRect(-hw, -hh, width, height, radius);

    // Градиентный эффект сверху
    if (!pressed) {
      this.background.fillStyle(0xffffff, hover ? 0.1 : 0.05);
      this.background.fillRoundedRect(-hw + 2, -hh + 2, width - 4, height / 2 - 2, { tl: radius - 2, tr: radius - 2, bl: 0, br: 0 });
    }

    // Рамка
    this.background.lineStyle(2, style.border, hover ? 1 : 0.7);
    this.background.strokeRoundedRect(-hw, -hh, width, height, radius);

    // Угловые маркеры
    if (this.config.style === 'accent' || this.config.style === 'primary') {
      this.drawCornerMarkers(hw, hh, style.glow, hover);
    }

    // Блик (shine)
    if (hover && !pressed) {
      this.shine.fillStyle(0xffffff, 0.1);
      this.shine.fillRoundedRect(-hw + 4, -hh + 4, width / 3, height - 8, 6);
    }

    // Обновляем цвет текста
    this.label.setColor(style.text);
    this.label.setY(pressed ? 1 : 0);
  }

  private drawCornerMarkers(hw: number, hh: number, color: number, hover: boolean): void {
    const size = hover ? 8 : 6;
    this.background.lineStyle(2, color, hover ? 1 : 0.5);

    // Левый верхний
    this.background.beginPath();
    this.background.moveTo(-hw, -hh + size);
    this.background.lineTo(-hw, -hh);
    this.background.lineTo(-hw + size, -hh);
    this.background.strokePath();

    // Правый верхний
    this.background.beginPath();
    this.background.moveTo(hw - size, -hh);
    this.background.lineTo(hw, -hh);
    this.background.lineTo(hw, -hh + size);
    this.background.strokePath();

    // Левый нижний
    this.background.beginPath();
    this.background.moveTo(-hw, hh - size);
    this.background.lineTo(-hw, hh);
    this.background.lineTo(-hw + size, hh);
    this.background.strokePath();

    // Правый нижний
    this.background.beginPath();
    this.background.moveTo(hw - size, hh);
    this.background.lineTo(hw, hh);
    this.background.lineTo(hw, hh - size);
    this.background.strokePath();
  }

  private setupInteraction(): void {
    const { width, height } = this.config;
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    this.container.on('pointerover', () => {
      this.isHovered = true;
      this.draw(false, true);
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 150,
        ease: 'Back.easeOut',
      });
    });

    this.container.on('pointerout', () => {
      this.isHovered = false;
      this.draw(false, false);
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
      });
    });

    this.container.on('pointerdown', () => {
      this.draw(true, true);
      this.container.setScale(0.97);
    });

    this.container.on('pointerup', () => {
      this.draw(false, true);
      this.container.setScale(1.03);
      if (this.config.onClick) {
        this.config.onClick();
      }
    });
  }

  private addIdleAnimation(): void {
    // Subtle glow pulse для accent кнопок
    if (this.config.style === 'accent') {
      this.scene.tweens.add({
        targets: this.glow,
        alpha: { from: 0.8, to: 1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  setText(text: string): void {
    const displayText = this.config.icon ? `${this.config.icon}  ${text}` : text;
    this.label.setText(displayText);
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  destroy(): void {
    this.container.destroy();
  }
}