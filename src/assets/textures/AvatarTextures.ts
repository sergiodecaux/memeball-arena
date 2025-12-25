// src/assets/textures/AvatarTextures.ts

import Phaser from 'phaser';

interface AvatarConfig {
  key: string;
  backgroundColor: number;
  borderColor: number;
  iconColor: number;
  accentColor?: number;
  pattern: 'diamond' | 'triangle' | 'hex' | 'circle' | 'shield' | 'bolt';
}

// Набор доступных аватаров
const AVATAR_CONFIGS: AvatarConfig[] = [
  {
    key: 'avatar_blue',
    backgroundColor: 0x1d4ed8,
    borderColor: 0x93c5fd,
    iconColor: 0xffffff,
    accentColor: 0x0ea5e9,
    pattern: 'diamond',
  },
  {
    key: 'avatar_red',
    backgroundColor: 0xb91c1c,
    borderColor: 0xf97373,
    iconColor: 0xffffff,
    accentColor: 0xf97316,
    pattern: 'triangle',
  },
  {
    key: 'avatar_green',
    backgroundColor: 0x15803d,
    borderColor: 0x4ade80,
    iconColor: 0xffffff,
    accentColor: 0x22c55e,
    pattern: 'hex',
  },
  {
    key: 'avatar_purple',
    backgroundColor: 0x6d28d9,
    borderColor: 0xa855f7,
    iconColor: 0xffffff,
    accentColor: 0xec4899,
    pattern: 'circle',
  },
  {
    key: 'avatar_gold',
    backgroundColor: 0x92400e,
    borderColor: 0xfacc15,
    iconColor: 0x1f2937,
    accentColor: 0xf97316,
    pattern: 'shield',
  },
  {
    key: 'avatar_cyan',
    backgroundColor: 0x0f766e,
    borderColor: 0x22d3ee,
    iconColor: 0xffffff,
    accentColor: 0x06b6d4,
    pattern: 'bolt',
  },
];

// Публичный список ключей, чтобы использовать в UI
export const AVATAR_KEYS = AVATAR_CONFIGS.map((c) => c.key);

export class AvatarTextures {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  generate(): void {
    AVATAR_CONFIGS.forEach((config) => this.createAvatar(config));
  }

  private createAvatar(config: AvatarConfig): void {
    const size = 256;
    const radius = size * 0.5 - 4;
    const cx = size / 2;
    const cy = size / 2;

    const g = this.scene.add.graphics({ x: 0, y: 0 });

    // Фон-круг
    g.fillStyle(config.backgroundColor, 1);
    g.fillCircle(cx, cy, radius);

    // Лёгкий внутренний акцент
    if (config.accentColor) {
      g.fillStyle(config.accentColor, 0.4);
      g.fillCircle(cx, cy, radius * 0.65);
    }

    // Рамка
    g.lineStyle(10, config.borderColor, 1);
    g.strokeCircle(cx, cy, radius - 5);

    // Иконка в центре
    g.fillStyle(config.iconColor, 1);
    const iconRadius = radius * 0.5;
    this.drawIcon(g, config.pattern, cx, cy, iconRadius);

    g.generateTexture(config.key, size, size);
    g.destroy();
  }

  private drawIcon(
    g: Phaser.GameObjects.Graphics,
    pattern: AvatarConfig['pattern'],
    cx: number,
    cy: number,
    r: number
  ) {
    switch (pattern) {
      case 'diamond':
        this.drawDiamond(g, cx, cy, r);
        break;
      case 'triangle':
        this.drawTriangle(g, cx, cy, r);
        break;
      case 'hex':
        this.drawHexagon(g, cx, cy, r);
        break;
      case 'circle':
        this.drawCircleIcon(g, cx, cy, r);
        break;
      case 'shield':
        this.drawShield(g, cx, cy, r);
        break;
      case 'bolt':
        this.drawBolt(g, cx, cy, r);
        break;
    }
  }

  private drawDiamond(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.fillPath();
  }

  private drawTriangle(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    const h = r * 1.2;
    g.beginPath();
    g.moveTo(cx, cy - h);
    g.lineTo(cx + r, cy + h * 0.4);
    g.lineTo(cx - r, cy + h * 0.4);
    g.closePath();
    g.fillPath();
  }

  private drawHexagon(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.DegToRad(60 * i - 30);
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fillPath();
  }

  private drawCircleIcon(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    g.fillCircle(cx, cy, r * 0.9);

    g.fillStyle(0x000000, 0.15);
    g.fillCircle(cx + r * 0.25, cy - r * 0.25, r * 0.4);
  }

  private drawShield(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    const top = cy - r;
    const bottom = cy + r * 0.9;
    const left = cx - r * 0.7;
    const right = cx + r * 0.7;

    g.beginPath();
    g.moveTo(cx, top);
    g.lineTo(right, cy - r * 0.3);
    g.lineTo(right, cy + r * 0.1);
    g.lineTo(cx, bottom);
    g.lineTo(left, cy + r * 0.1);
    g.lineTo(left, cy - r * 0.3);
    g.closePath();
    g.fillPath();

    // Полоска посередине
    g.fillStyle(0xffffff, 0.2);
    g.fillRect(cx - r * 0.2, cy - r * 0.5, r * 0.4, r * 1.2);
  }

  private drawBolt(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    r: number
  ) {
    g.beginPath();
    g.moveTo(cx - r * 0.2, cy - r);
    g.lineTo(cx + r * 0.3, cy - r * 0.1);
    g.lineTo(cx + r * 0.1, cy - r * 0.1);
    g.lineTo(cx + r * 0.4, cy + r);
    g.lineTo(cx - r * 0.3, cy + r * 0.1);
    g.lineTo(cx - r * 0.05, cy + r * 0.1);
    g.closePath();
    g.fillPath();
  }
}