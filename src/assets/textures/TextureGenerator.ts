// src/assets/textures/TextureGenerator.ts

import Phaser from 'phaser';

export class TextureGenerator {
  protected scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // ИСПРАВЛЕНО: используем add.graphics() вместо make.graphics()
  protected createGraphics(): Phaser.GameObjects.Graphics {
    const g = this.scene.add.graphics();
    g.setVisible(false);  // Скрываем, так как используем только для генерации текстур
    return g;
  }

  protected drawHexagon(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, fill = false): void {
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    fill ? g.fillPath() : g.strokePath();
  }

  protected drawStar(g: Phaser.GameObjects.Graphics, cx: number, cy: number, points: number, outerR: number, innerR: number, fill = false): void {
    g.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    fill ? g.fillPath() : g.strokePath();
  }

  protected drawSnowflake(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x2 = cx + Math.cos(angle) * size;
      const y2 = cy + Math.sin(angle) * size;
      g.lineBetween(cx, cy, x2, y2);
      const bx = cx + Math.cos(angle) * size * 0.6;
      const by = cy + Math.sin(angle) * size * 0.6;
      g.lineBetween(bx, by, bx + Math.cos(angle + 0.5) * size * 0.3, by + Math.sin(angle + 0.5) * size * 0.3);
      g.lineBetween(bx, by, bx + Math.cos(angle - 0.5) * size * 0.3, by + Math.sin(angle - 0.5) * size * 0.3);
    }
  }

  protected drawLightning(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, segments: number = 5): void {
    const dx = (x2 - x1) / segments;
    const dy = (y2 - y1) / segments;
    
    g.beginPath();
    g.moveTo(x1, y1);
    
    for (let i = 1; i < segments; i++) {
      const nx = x1 + dx * i + (Math.random() - 0.5) * 15;
      const ny = y1 + dy * i + (Math.random() - 0.5) * 10;
      g.lineTo(nx, ny);
    }
    g.lineTo(x2, y2);
    g.strokePath();
  }

  protected finish(g: Phaser.GameObjects.Graphics, key: string, w: number, h: number): void {
    g.generateTexture(key, w, h);
    g.destroy();
  }
}