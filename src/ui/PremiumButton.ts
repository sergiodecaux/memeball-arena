// src/ui/PremiumButton.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';

export interface PremiumButtonConfig {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize?: number;
  style?: 'primary' | 'secondary' | 'accent' | 'gold';
  iconDraw?: (scene: Phaser.Scene, x: number, y: number, size: number, color: number) => Phaser.GameObjects.Graphics;
  onClick?: () => void;
  disabled?: boolean;
}

export class PremiumButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: PremiumButtonConfig;
  private isHovered: boolean = false;
  private isPressed: boolean = false;

  constructor(scene: Phaser.Scene, config: PremiumButtonConfig) {
    this.scene = scene;
    this.config = config;

    this.container = scene.add.container(config.x, config.y);
    this.container.setDepth(100);

    this.draw();
    if (!config.disabled) {
      this.setupInteraction();
    }
  }

  private getStyleColors(): { 
    bgTop: number; 
    bgBottom: number; 
    border: number; 
    glow: number; 
    text: number;
    shadow: number;
  } {
    const colors = getColors();

    switch (this.config.style) {
      case 'gold':
        return { 
          bgTop: 0xffd700, 
          bgBottom: 0xb8860b, 
          border: 0xffd700, 
          glow: 0xffd700, 
          text: 0x1a1a2e,
          shadow: 0x8b6914,
        };
      case 'accent':
        return { 
          bgTop: 0x00d4aa, 
          bgBottom: 0x008866, 
          border: colors.uiAccent, 
          glow: colors.uiAccent, 
          text: 0xffffff,
          shadow: 0x004433,
        };
      case 'secondary':
        return { 
          bgTop: 0x3a3a5c, 
          bgBottom: 0x1a1a2e, 
          border: 0x5a5a7c, 
          glow: colors.uiPrimary, 
          text: 0xffffff,
          shadow: 0x0a0a15,
        };
      default: // primary
        return { 
          bgTop: 0x6a4c93, 
          bgBottom: 0x3d2963, 
          border: colors.uiPrimary, 
          glow: colors.uiPrimary, 
          text: 0xffffff,
          shadow: 0x1a1a2e,
        };
    }
  }

  private draw(): void {
    this.container.removeAll(true);

    const { width, height, text, fontSize = 18, disabled } = this.config;
    const hw = width / 2;
    const hh = height / 2;
    const radius = 12;
    const style = this.getStyleColors();
    const pressed = this.isPressed;
    const hover = this.isHovered;

    // Тень под кнопкой (3D эффект)
    if (!pressed) {
      const shadow = this.scene.add.graphics();
      shadow.fillStyle(0x000000, 0.4);
      shadow.fillRoundedRect(-hw + 2, -hh + 4, width, height, radius);
      this.container.add(shadow);
    }

    // Основной фон с градиентом
    const bg = this.scene.add.graphics();
    const yOffset = pressed ? 2 : 0;
    
    // Нижняя часть (темнее)
    bg.fillStyle(disabled ? 0x2a2a3a : style.bgBottom, disabled ? 0.5 : 1);
    bg.fillRoundedRect(-hw, -hh + yOffset, width, height, radius);
    
    // Верхняя часть (светлее) - создаёт 3D эффект
    if (!pressed) {
      bg.fillStyle(disabled ? 0x3a3a4a : style.bgTop, disabled ? 0.5 : 1);
      bg.fillRoundedRect(-hw, -hh + yOffset, width, height * 0.6, { tl: radius, tr: radius, bl: 0, br: 0 });
    }
    
    // Внутренний блик
    if (!pressed && !disabled) {
      bg.fillStyle(0xffffff, 0.15);
      bg.fillRoundedRect(-hw + 3, -hh + 3 + yOffset, width - 6, height * 0.35, { tl: radius - 2, tr: radius - 2, bl: 0, br: 0 });
    }
    
    // Рамка
    bg.lineStyle(2, disabled ? 0x4a4a5a : style.border, disabled ? 0.5 : (hover ? 1 : 0.8));
    bg.strokeRoundedRect(-hw, -hh + yOffset, width, height, radius);
    
    this.container.add(bg);

    // Свечение при наведении
    if (hover && !disabled) {
      const glow = this.scene.add.graphics();
      for (let i = 3; i >= 1; i--) {
        glow.lineStyle(8 / i, style.glow, 0.1 * i);
        glow.strokeRoundedRect(-hw - 2, -hh - 2 + yOffset, width + 4, height + 4, radius + 2);
      }
      this.container.addAt(glow, 0);
    }

    // Иконка
    const iconOffset = this.config.iconDraw ? -30 : 0;
    if (this.config.iconDraw) {
      const iconColor = disabled ? 0x6a6a7a : (this.config.style === 'gold' ? 0x1a1a2e : 0xffffff);
      const icon = this.config.iconDraw(this.scene, -hw + 35, yOffset, 18, iconColor);
      this.container.add(icon);
    }

    // Текст
    const label = this.scene.add.text(iconOffset, yOffset, text, {
      fontSize: `${fontSize}px`,
      fontFamily: 'Arial Black, Arial',
      color: disabled ? '#6a6a7a' : hexToString(style.text),
    });
    label.setOrigin(0.5, 0.5);
    
    // Тень текста
    if (!disabled) {
      label.setShadow(1, 2, '#000000', 3, true, true);
    }
    
    this.container.add(label);
  }

  private setupInteraction(): void {
    const { width, height } = this.config;
    const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
    this.container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

    this.container.on('pointerover', () => {
      this.isHovered = true;
      this.draw();
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 100,
        ease: 'Power2',
      });
    });

    this.container.on('pointerout', () => {
      this.isHovered = false;
      this.isPressed = false;
      this.draw();
      this.scene.tweens.add({
        targets: this.container,
        scaleX: 1,
        scaleY: 1,
        duration: 100,
      });
    });

    this.container.on('pointerdown', () => {
      this.isPressed = true;
      this.draw();
      this.container.setScale(0.98);
    });

    this.container.on('pointerup', () => {
      this.isPressed = false;
      this.draw();
      this.container.setScale(1.02);
      if (this.config.onClick) {
        this.config.onClick();
      }
    });
  }

  setEnabled(enabled: boolean): void {
    this.config.disabled = !enabled;
    this.draw();
    
    if (enabled) {
      this.setupInteraction();
    } else {
      this.container.removeInteractive();
    }
  }

  destroy(): void {
    this.container.destroy();
  }
}