// src/assets/textures/BallTextures.ts

import { TextureGenerator } from './TextureGenerator';

export class BallTextures extends TextureGenerator {
  private readonly S = 64;
  private readonly C = 32;

  generate(): void {
    this.createBasicBalls();
    this.createCommonBalls();
    this.createRareBalls();
    this.createEpicBalls();
    this.createLegendaryBalls();
  }

  // ==================== BASIC ====================

  private createBasicBalls(): void {
    // Classic Tech - футбольный мяч с техно-стилем
    const g = this.createGraphics();
    
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 30);
    
    // Пятиугольники
    g.fillStyle(0x1a1a2e);
    this.drawPentagon(g, this.C, this.C, 10);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      this.drawPentagon(g, this.C + Math.cos(angle) * 18, this.C + Math.sin(angle) * 18, 6);
    }
    
    // Неоновая обводка
    g.lineStyle(2, 0x00ffff, 0.8);
    g.strokeCircle(this.C, this.C, 30);
    
    // Блик
    g.fillStyle(0xffffff, 0.5);
    g.fillEllipse(this.C - 8, this.C - 8, 10, 6);
    
    this.finish(g, 'ball_default', this.S, this.S);
  }

  // ==================== COMMON ====================

  private createCommonBalls(): void {
    // Tennis Ball
    let g = this.createGraphics();
    g.fillStyle(0xbef264);
    g.fillCircle(this.C, this.C, 30);
    
    // Характерные линии
    g.lineStyle(3, 0x84cc16);
    g.beginPath();
    g.arc(this.C - 12, this.C, 20, -0.7, 0.7);
    g.strokePath();
    g.beginPath();
    g.arc(this.C + 12, this.C, 20, Math.PI - 0.7, Math.PI + 0.7);
    g.strokePath();
    
    // Текстура
    g.lineStyle(1, 0x84cc16, 0.3);
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 25;
      const x = this.C + Math.cos(angle) * dist;
      const y = this.C + Math.sin(angle) * dist;
      g.lineBetween(x, y, x + 2, y + 2);
    }
    
    g.lineStyle(2, 0xd9f99d, 0.6);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_tennis', this.S, this.S);

    // Beach Ball
    g = this.createGraphics();
    const colors = [0xffffff, 0xef4444, 0xffffff, 0x3b82f6, 0xffffff, 0xfbbf24];
    
    for (let i = 0; i < 6; i++) {
      const startAngle = (i / 6) * Math.PI * 2;
      const endAngle = ((i + 1) / 6) * Math.PI * 2;
      
      g.fillStyle(colors[i]);
      g.beginPath();
      g.moveTo(this.C, this.C);
      g.arc(this.C, this.C, 30, startAngle, endAngle);
      g.closePath();
      g.fillPath();
    }
    
    // Швы
    g.lineStyle(1, 0x000000, 0.2);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      g.lineBetween(this.C, this.C, this.C + Math.cos(angle) * 30, this.C + Math.sin(angle) * 30);
    }
    
    // Блик
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(this.C - 8, this.C - 10, 8, 5);
    
    g.lineStyle(2, 0xffffff);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_beach', this.S, this.S);
  }

  // ==================== RARE ====================

  private createRareBalls(): void {
    // Golden Orb
    let g = this.createGraphics();
    
    g.fillStyle(0xb45309);
    g.fillCircle(this.C, this.C, 30);
    g.fillStyle(0xfcd34d);
    g.fillCircle(this.C, this.C, 26);
    g.fillStyle(0xfef3c7);
    g.fillCircle(this.C - 5, this.C - 5, 10);
    
    // Узоры
    g.lineStyle(1, 0xb45309, 0.4);
    for (let i = 0; i < 3; i++) {
      g.strokeCircle(this.C, this.C, 10 + i * 7);
    }
    
    // Блики
    g.fillStyle(0xffffff, 0.7);
    g.fillEllipse(this.C - 10, this.C - 10, 6, 4);
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(this.C + 8, this.C + 8, 3);
    
    g.lineStyle(2, 0xfcd34d);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_golden', this.S, this.S);

    // Disco Ball
    g = this.createGraphics();
    
    g.fillStyle(0x808080);
    g.fillCircle(this.C, this.C, 30);
    
    // Зеркальные квадратики
    const tileSize = 5;
    const tileColors = [0xffffff, 0xc0c0c0, 0xe0e0e0, 0xa0a0a0];
    
    for (let row = -6; row <= 6; row++) {
      for (let col = -6; col <= 6; col++) {
        const x = this.C + col * tileSize;
        const y = this.C + row * tileSize;
        const dist = Math.sqrt((x - this.C) ** 2 + (y - this.C) ** 2);
        
        if (dist < 28) {
          g.fillStyle(tileColors[Math.floor(Math.random() * tileColors.length)]);
          g.fillRect(x - tileSize / 2, y - tileSize / 2, tileSize - 1, tileSize - 1);
        }
      }
    }
    
    // Цветные отблески
    g.fillStyle(0xff69b4, 0.5);
    g.fillCircle(this.C - 8, this.C - 5, 4);
    g.fillStyle(0x00ffff, 0.5);
    g.fillCircle(this.C + 10, this.C + 8, 3);
    g.fillStyle(0xffd700, 0.5);
    g.fillCircle(this.C - 5, this.C + 10, 3);
    
    g.lineStyle(2, 0xffffff);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_disco', this.S, this.S);
  }

  // ==================== EPIC ====================

  private createEpicBalls(): void {
    // Plasma Core
    let g = this.createGraphics();
    
    g.fillStyle(0x4f46e5, 0.4);
    g.fillCircle(this.C, this.C, 30);
    g.fillStyle(0x818cf8, 0.6);
    g.fillCircle(this.C, this.C, 24);
    g.fillStyle(0xc4b5fd);
    g.fillCircle(this.C, this.C, 16);
    
    // Плазменные разряды
    g.lineStyle(2, 0xffffff, 0.8);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(this.C, this.C);
      const mx = this.C + Math.cos(angle + 0.2) * 10;
      const my = this.C + Math.sin(angle + 0.2) * 10;
      g.lineTo(mx, my);
      g.lineTo(this.C + Math.cos(angle) * 22, this.C + Math.sin(angle) * 22);
      g.strokePath();
    }
    
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 6);
    
    g.lineStyle(2, 0x818cf8);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_plasma', this.S, this.S);

    // Meteor
    g = this.createGraphics();
    
    g.fillStyle(0x7f1d1d);
    g.fillCircle(this.C, this.C, 30);
    g.fillStyle(0xef4444);
    g.fillCircle(this.C, this.C, 24);
    g.fillStyle(0xf97316);
    g.fillCircle(this.C, this.C, 16);
    g.fillStyle(0xfbbf24);
    g.fillCircle(this.C, this.C, 8);
    
    // Кратеры
    g.fillStyle(0x7f1d1d, 0.7);
    g.fillCircle(this.C - 10, this.C - 8, 4);
    g.fillCircle(this.C + 8, this.C + 5, 3);
    g.fillCircle(this.C - 5, this.C + 10, 3);
    
    g.lineStyle(2, 0xf97316);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_meteor', this.S, this.S);

    // Snowball
    g = this.createGraphics();
    
    g.fillStyle(0xbae6fd);
    g.fillCircle(this.C, this.C, 30);
    g.fillStyle(0xe0f2fe);
    g.fillCircle(this.C, this.C, 24);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 16);
    
    // Снежинки
    g.lineStyle(1, 0xbae6fd, 0.7);
    this.drawMiniSnowflake(g, this.C - 10, this.C - 8, 4);
    this.drawMiniSnowflake(g, this.C + 12, this.C + 5, 3);
    this.drawMiniSnowflake(g, this.C - 5, this.C + 12, 3);
    
    // Блеск
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(this.C - 10, this.C - 10, 3);
    g.fillCircle(this.C + 5, this.C - 8, 2);
    
    g.lineStyle(2, 0xe0f2fe);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_snowball', this.S, this.S);

    // Electric Orb
    g = this.createGraphics();
    
    g.fillStyle(0x1e3a8a);
    g.fillCircle(this.C, this.C, 30);
    g.fillStyle(0x3b82f6);
    g.fillCircle(this.C, this.C, 22);
    
    // Молнии
    g.lineStyle(2, 0xfbbf24);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(this.C, this.C);
      const midX = this.C + Math.cos(angle + 0.2) * 12;
      const midY = this.C + Math.sin(angle + 0.2) * 12;
      g.lineTo(midX, midY);
      g.lineTo(this.C + Math.cos(angle) * 26, this.C + Math.sin(angle) * 26);
      g.strokePath();
    }
    
    g.fillStyle(0xfef3c7);
    g.fillCircle(this.C, this.C, 8);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 4);
    
    g.lineStyle(2, 0x60a5fa);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_electric', this.S, this.S);
  }

  // ==================== LEGENDARY ====================

  private createLegendaryBalls(): void {
    // Sun Eater (Inferno)
    let g = this.createGraphics();
    
    // Корона
    g.fillStyle(0xff4500, 0.4);
    g.fillCircle(this.C, this.C, 30);
    
    // Языки пламени
    g.fillStyle(0xef4444);
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const x = this.C + Math.cos(angle) * 18;
      const y = this.C + Math.sin(angle) * 18;
      
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(this.C + Math.cos(angle) * 30, this.C + Math.sin(angle) * 30);
      g.lineTo(this.C + Math.cos(angle + 0.12) * 22, this.C + Math.sin(angle + 0.12) * 22);
      g.closePath();
      g.fillPath();
    }
    
    g.fillStyle(0xff4500);
    g.fillCircle(this.C, this.C, 16);
    g.fillStyle(0xfacc15);
    g.fillCircle(this.C, this.C, 10);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 4);
    
    this.finish(g, 'ball_inferno', this.S, this.S);

    // Black Hole
    g = this.createGraphics();
    
    // Аккреционный диск
    g.lineStyle(4, 0x7c3aed, 0.4);
    g.strokeCircle(this.C, this.C, 28);
    g.lineStyle(3, 0xa855f7, 0.6);
    g.strokeCircle(this.C, this.C, 22);
    g.lineStyle(2, 0xc4b5fd, 0.8);
    g.strokeCircle(this.C, this.C, 16);
    
    // Чёрная дыра
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 12);
    
    // Искривление света
    g.lineStyle(1, 0xffffff, 0.3);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      g.beginPath();
      for (let t = 0; t < 1; t += 0.1) {
        const r = 12 + t * 16;
        const a = angle + t * 0.4;
        const x = this.C + Math.cos(a) * r;
        const y = this.C + Math.sin(a) * r;
        if (t === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    
    g.lineStyle(2, 0x7c3aed);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_blackhole', this.S, this.S);

    // Star Core
    g = this.createGraphics();
    
    g.fillStyle(0xfcd34d, 0.3);
    g.fillCircle(this.C, this.C, 30);
    
    // Лучи звезды
    g.fillStyle(0xfcd34d);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(this.C, this.C);
      g.lineTo(this.C + Math.cos(angle - 0.12) * 10, this.C + Math.sin(angle - 0.12) * 10);
      g.lineTo(this.C + Math.cos(angle) * 28, this.C + Math.sin(angle) * 28);
      g.lineTo(this.C + Math.cos(angle + 0.12) * 10, this.C + Math.sin(angle + 0.12) * 10);
      g.closePath();
      g.fillPath();
    }
    
    g.fillStyle(0xfef3c7);
    g.fillCircle(this.C, this.C, 8);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 4);
    
    this.finish(g, 'ball_starcore', this.S, this.S);

    // Portal Sphere
    g = this.createGraphics();
    
    // Портальные кольца
    g.lineStyle(4, 0x06b6d4, 0.5);
    g.strokeCircle(this.C, this.C, 28);
    g.lineStyle(3, 0xd946ef, 0.6);
    g.strokeCircle(this.C, this.C, 22);
    
    // Спираль
    g.lineStyle(2, 0x22d3ee, 0.8);
    g.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.15) {
      const r = 4 + a * 4;
      const x = this.C + Math.cos(a) * r;
      const y = this.C + Math.sin(a) * r;
      if (a === 0) g.moveTo(x, y);
      else if (r < 26) g.lineTo(x, y);
    }
    g.strokePath();
    
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(this.C, this.C, 5);
    
    g.lineStyle(2, 0x22d3ee);
    g.strokeCircle(this.C, this.C, 30);
    
    this.finish(g, 'ball_portal', this.S, this.S);
  }

  // ==================== HELPERS ====================

  private drawPentagon(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const px = x + Math.cos(angle) * size;
      const py = y + Math.sin(angle) * size;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
  }

  private drawMiniSnowflake(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      g.lineBetween(x, y, x + Math.cos(angle) * size, y + Math.sin(angle) * size);
    }
  }
}