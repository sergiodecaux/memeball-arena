// src/assets/textures/CapTextures.ts

import { TextureGenerator } from './TextureGenerator';

export class CapTextures extends TextureGenerator {
  private readonly S = 128;
  private readonly C = 64;

  generate(): void {
    this.createBasicSkins();
    this.createCommonSkins();
    this.createRareSkins();
    this.createEpicSkins();
    this.createLegendarySkins();
    
    // ========== ГЕНЕРИРУЕМ ПОДЛОЖКУ-КОМАНДУ ==========
    this.generateTeamBase();
  }

  // ==================== BASIC ====================

  private createBasicSkins(): void {
    let g = this.createGraphics();
    g.fillStyle(0x0891b2);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x06b6d4);
    g.fillCircle(this.C, this.C, 50);
    g.lineStyle(2, 0x22d3ee, 0.8);
    g.strokeRect(44, 44, 40, 40);
    g.lineStyle(1.5, 0x22d3ee, 0.6);
    for (let i = 0; i < 4; i++) {
      g.lineBetween(44, 50 + i * 10, 30, 50 + i * 10);
      g.lineBetween(84, 50 + i * 10, 98, 50 + i * 10);
      g.lineBetween(50 + i * 10, 44, 50 + i * 10, 30);
      g.lineBetween(50 + i * 10, 84, 50 + i * 10, 98);
    }
    g.fillStyle(0x67e8f9);
    g.fillCircle(this.C, this.C, 12);
    this.finish(g, 'skin_basic_cyan', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0xbe185d);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0xd946ef);
    g.fillCircle(this.C, this.C, 50);
    g.lineStyle(3, 0xf0abfc, 0.7);
    g.strokeCircle(this.C, this.C, 40);
    g.lineStyle(2, 0xf0abfc, 0.5);
    g.strokeCircle(this.C, this.C, 30);
    g.strokeCircle(this.C, this.C, 20);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.fillCircle(this.C + Math.cos(angle) * 40, this.C + Math.sin(angle) * 40, 3);
    }
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 8);
    this.finish(g, 'skin_basic_magenta', this.S, this.S);
  }

  // ==================== COMMON ====================

  private createCommonSkins(): void {
    let g = this.createGraphics();
    g.fillStyle(0x1e3a8a);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x3b82f6);
    g.fillCircle(this.C, this.C, 52);
    g.lineStyle(4, 0xfde047);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x2 = this.C + Math.cos(angle) * 55;
      const y2 = this.C + Math.sin(angle) * 55;
      const mx1 = this.C + Math.cos(angle) * 20;
      const my1 = this.C + Math.sin(angle) * 20;
      const mx2 = this.C + Math.cos(angle + 0.15) * 35;
      const my2 = this.C + Math.sin(angle + 0.15) * 35;
      const mx3 = this.C + Math.cos(angle - 0.1) * 45;
      const my3 = this.C + Math.sin(angle - 0.1) * 45;
      g.beginPath();
      g.moveTo(this.C, this.C);
      g.lineTo(mx1, my1);
      g.lineTo(mx2, my2);
      g.lineTo(mx3, my3);
      g.lineTo(x2, y2);
      g.strokePath();
    }
    g.fillStyle(0xfef3c7);
    g.fillCircle(this.C, this.C, 15);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 8);
    this.finish(g, 'skin_electric', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x0e7490);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x06b6d4);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(2, 0x67e8f9, 0.5);
    for (let y = 30; y < 100; y += 15) {
      g.beginPath();
      g.moveTo(20, y);
      for (let x = 20; x < 110; x += 5) {
        g.lineTo(x, y + Math.sin((x - 20) / 10) * 5);
      }
      g.strokePath();
    }
    g.fillStyle(0xcffafe, 0.7);
    g.fillCircle(40, 45, 6);
    g.fillCircle(85, 50, 4);
    g.fillCircle(50, 75, 5);
    g.fillCircle(78, 80, 3);
    g.fillStyle(0xfbbf24);
    g.beginPath();
    g.moveTo(65, 60);
    g.lineTo(80, 65);
    g.lineTo(65, 70);
    g.lineTo(55, 65);
    g.closePath();
    g.fillPath();
    this.finish(g, 'skin_aqua', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x0f0f0f);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x1f2937, 0.8);
    g.fillCircle(50, 55, 35);
    g.fillCircle(80, 60, 30);
    g.fillCircle(60, 80, 25);
    g.fillStyle(0x7c3aed);
    g.fillEllipse(48, 55, 12, 8);
    g.fillEllipse(80, 55, 12, 8);
    g.fillStyle(0xffffff);
    g.fillCircle(50, 55, 3);
    g.fillCircle(82, 55, 3);
    g.lineStyle(2, 0x7c3aed);
    g.beginPath();
    g.arc(64, 65, 20, 0.2, Math.PI - 0.2);
    g.strokePath();
    this.finish(g, 'skin_shadow', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0xfecdd3);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0xfda4af);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(4, 0x854d0e);
    g.beginPath();
    g.moveTo(25, 90);
    g.lineTo(50, 60);
    g.lineTo(80, 55);
    g.lineTo(100, 35);
    g.strokePath();
    g.lineBetween(50, 60, 40, 40);
    g.lineBetween(80, 55, 85, 75);
    const flowers = [[40, 40], [85, 50], [100, 35], [60, 65], [85, 75]];
    flowers.forEach(([fx, fy]) => {
      g.fillStyle(0xffffff);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillEllipse(fx + Math.cos(angle) * 6, fy + Math.sin(angle) * 6, 5, 8);
      }
      g.fillStyle(0xfbbf24);
      g.fillCircle(fx, fy, 3);
    });
    this.finish(g, 'skin_sakura', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x312e81);
    g.fillCircle(this.C, this.C, 64);
    g.lineStyle(1, 0x818cf8, 0.4);
    for (let i = 0; i < 12; i++) {
      const y = 20 + i * 8;
      g.lineBetween(20, y, 108, y);
    }
    for (let i = 0; i < 12; i++) {
      const x = 20 + i * 8;
      g.lineBetween(x, 20, x, 108);
    }
    g.lineStyle(3, 0x34d399);
    g.beginPath();
    g.moveTo(64, 30);
    g.lineTo(90, 80);
    g.lineTo(38, 80);
    g.closePath();
    g.strokePath();
    g.fillStyle(0xf472b6, 0.5);
    g.fillCircle(50, 50, 15);
    g.fillStyle(0xfbbf24, 0.5);
    g.fillCircle(80, 70, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(64, 60, 8);
    this.finish(g, 'skin_hologram', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x14532d);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x22c55e);
    g.fillCircle(this.C, this.C, 55);
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 8);
    g.lineStyle(8, 0x000000);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
      g.beginPath();
      g.arc(this.C, this.C, 30, angle - 0.5, angle + 0.5);
      g.strokePath();
    }
    g.fillStyle(0x4ade80);
    g.beginPath();
    g.moveTo(35, 85);
    g.lineTo(40, 95);
    g.lineTo(45, 85);
    g.arc(40, 85, 5, 0, Math.PI, true);
    g.fillPath();
    g.beginPath();
    g.moveTo(80, 80);
    g.lineTo(85, 92);
    g.lineTo(90, 80);
    g.arc(85, 80, 5, 0, Math.PI, true);
    g.fillPath();
    this.finish(g, 'skin_toxic', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x0284c7);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x0ea5e9);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(3, 0xffffff);
    this.drawSnowflake(g, this.C, this.C, 35);
    g.lineStyle(1.5, 0xe0f2fe);
    this.drawSnowflake(g, 35, 40, 12);
    this.drawSnowflake(g, 90, 45, 10);
    this.drawSnowflake(g, 40, 90, 10);
    g.fillStyle(0xbae6fd, 0.8);
    g.beginPath();
    g.moveTo(85, 75);
    g.lineTo(95, 85);
    g.lineTo(85, 100);
    g.lineTo(75, 85);
    g.closePath();
    g.fillPath();
    this.finish(g, 'skin_ice', this.S, this.S);
  }

  // ==================== RARE ====================

  private createRareSkins(): void {
    let g = this.createGraphics();
    g.fillStyle(0x7f1d1d);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0xdc2626);
    g.fillCircle(this.C, this.C, 55);
    g.fillStyle(0xfbbf24);
    g.fillEllipse(this.C, this.C + 5, 20, 25);
    g.fillStyle(0xf97316);
    g.beginPath();
    g.moveTo(this.C - 10, this.C);
    g.lineTo(20, 35);
    g.lineTo(25, 50);
    g.lineTo(30, 45);
    g.lineTo(35, 55);
    g.lineTo(this.C - 5, this.C + 10);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(this.C + 10, this.C);
    g.lineTo(108, 35);
    g.lineTo(103, 50);
    g.lineTo(98, 45);
    g.lineTo(93, 55);
    g.lineTo(this.C + 5, this.C + 10);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xfcd34d);
    g.fillCircle(this.C, this.C - 15, 12);
    g.fillStyle(0x000000);
    g.fillCircle(this.C - 4, this.C - 17, 3);
    g.fillCircle(this.C + 4, this.C - 17, 3);
    g.fillStyle(0xef4444);
    g.beginPath();
    g.moveTo(this.C - 8, this.C + 25);
    g.lineTo(this.C - 15, this.C + 55);
    g.lineTo(this.C, this.C + 45);
    g.lineTo(this.C + 15, this.C + 55);
    g.lineTo(this.C + 8, this.C + 25);
    g.closePath();
    g.fillPath();
    this.finish(g, 'skin_phoenix', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x0c4a6e);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x0ea5e9);
    g.fillCircle(this.C, this.C, 55);
    g.fillStyle(0xbae6fd);
    g.beginPath();
    g.moveTo(25, 65);
    g.lineTo(35, 30);
    g.lineTo(45, 50);
    g.lineTo(55, 25);
    g.lineTo(64, 45);
    g.lineTo(73, 25);
    g.lineTo(83, 50);
    g.lineTo(93, 30);
    g.lineTo(103, 65);
    g.lineTo(103, 80);
    g.lineTo(25, 80);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(55, 25);
    g.lineTo(60, 35);
    g.lineTo(55, 45);
    g.lineTo(50, 35);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(73, 25);
    g.lineTo(78, 35);
    g.lineTo(73, 45);
    g.lineTo(68, 35);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0xffffff, 0.6);
    this.drawSnowflake(g, 30, 50, 8);
    this.drawSnowflake(g, 98, 50, 8);
    this.finish(g, 'skin_frost_king', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 64);
    g.lineStyle(2, 0x7c3aed, 0.6);
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.1) {
        const r = 5 + a * 7;
        const angle = a + (i / 4) * Math.PI * 2;
        const x = this.C + Math.cos(angle) * r * 0.5;
        const y = this.C + Math.sin(angle) * r * 0.5;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    g.fillStyle(0x581c87);
    g.fillCircle(this.C, this.C, 15);
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 10);
    g.fillStyle(0xffffff);
    g.fillCircle(30, 35, 2);
    g.fillCircle(95, 40, 1.5);
    g.fillCircle(25, 85, 1.5);
    g.fillCircle(100, 90, 2);
    this.finish(g, 'skin_void', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x1e3a8a);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x3b82f6);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(2, 0xfde047, 0.4);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      g.lineBetween(
        this.C + Math.cos(angle) * 20,
        this.C + Math.sin(angle) * 20,
        this.C + Math.cos(angle) * 55,
        this.C + Math.sin(angle) * 55
      );
    }
    g.fillStyle(0x6b7280);
    g.fillRect(60, 50, 8, 45);
    g.lineStyle(2, 0x854d0e);
    for (let y = 55; y < 90; y += 8) {
      g.lineBetween(58, y, 70, y + 4);
    }
    g.fillStyle(0x9ca3af);
    g.fillRect(45, 30, 38, 25);
    g.lineStyle(2, 0x3b82f6);
    g.lineBetween(55, 35, 55, 50);
    g.lineBetween(50, 42, 60, 42);
    g.lineBetween(68, 35, 75, 50);
    g.lineBetween(68, 50, 75, 35);
    this.finish(g, 'skin_thunder', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x365314);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x3f6212);
    g.fillCircle(this.C, this.C, 55);
    g.fillStyle(0x78350f);
    g.fillRect(58, 50, 12, 50);
    g.lineStyle(4, 0x78350f);
    g.lineBetween(58, 95, 40, 105);
    g.lineBetween(70, 95, 88, 105);
    g.lineBetween(64, 100, 64, 110);
    g.fillStyle(0x22c55e);
    g.fillCircle(64, 45, 30);
    g.fillStyle(0x4ade80);
    g.fillCircle(50, 40, 18);
    g.fillCircle(78, 40, 18);
    g.fillCircle(64, 30, 15);
    g.fillStyle(0x86efac);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = 64 + Math.cos(angle) * 25;
      const y = 42 + Math.sin(angle) * 20;
      g.fillEllipse(x, y, 8, 5);
    }
    this.finish(g, 'skin_nature', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x1c1917);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x292524);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(5, 0xff4500);
    g.lineBetween(this.C, 25, this.C - 15, 55);
    g.lineBetween(this.C - 15, 55, this.C - 30, 75);
    g.lineBetween(this.C, 25, this.C + 20, 60);
    g.lineBetween(this.C + 20, 60, this.C + 10, 90);
    g.lineBetween(this.C - 15, 55, this.C + 5, 80);
    g.lineStyle(8, 0xfbbf24, 0.3);
    g.lineBetween(this.C, 25, this.C - 15, 55);
    g.lineBetween(this.C, 25, this.C + 20, 60);
    g.fillStyle(0x7f1d1d);
    g.fillCircle(this.C, this.C, 18);
    g.fillStyle(0xef4444);
    g.fillCircle(this.C, this.C, 12);
    g.fillStyle(0xfbbf24);
    g.fillCircle(this.C, this.C, 6);
    this.finish(g, 'skin_magma', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x064e3b);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x10b981);
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const x = 16 + col * 14 + (row % 2) * 7;
        const y = 16 + row * 12;
        if (Phaser.Math.Distance.Between(x, y, this.C, this.C) < 58) {
          g.fillRoundedRect(x - 5, y - 4, 10, 8, 3);
        }
      }
    }
    g.fillStyle(0x000000);
    g.fillEllipse(this.C, this.C, 35, 25);
    g.fillStyle(0xfbbf24);
    g.fillEllipse(this.C, this.C, 28, 20);
    g.fillStyle(0x000000);
    g.fillEllipse(this.C, this.C, 8, 18);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(this.C - 8, this.C - 5, 4);
    this.finish(g, 'skin_dragon', this.S, this.S);
  }

  // ==================== EPIC ====================

  private createEpicSkins(): void {
    let g = this.createGraphics();
    g.fillStyle(0x0f172a);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0xffffff);
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 40;
      g.fillCircle(
        this.C + Math.cos(angle) * dist,
        this.C + Math.sin(angle) * dist,
        Math.random() > 0.7 ? 2 : 1
      );
    }
    g.fillStyle(0xfbbf24);
    g.fillCircle(40, 50, 20);
    g.lineStyle(2, 0xfcd34d);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.lineBetween(
        40 + Math.cos(angle) * 22,
        50 + Math.sin(angle) * 22,
        40 + Math.cos(angle) * 32,
        50 + Math.sin(angle) * 32
      );
    }
    g.fillStyle(0xe2e8f0);
    g.fillCircle(88, 50, 18);
    g.fillStyle(0x0f172a);
    g.fillCircle(95, 50, 15);
    g.lineStyle(1, 0x6366f1, 0.5);
    g.strokeCircle(this.C, this.C, 45);
    this.finish(g, 'skin_celestial', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x1e1b4b);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0xffffff, 0.3);
    g.beginPath();
    g.moveTo(this.C, 25);
    g.lineTo(this.C + 35, 85);
    g.lineTo(this.C - 35, 85);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xffffff);
    g.beginPath();
    g.moveTo(this.C, 25);
    g.lineTo(this.C + 35, 85);
    g.lineTo(this.C - 35, 85);
    g.closePath();
    g.strokePath();
    g.lineStyle(3, 0xffffff);
    g.lineBetween(15, 45, this.C - 10, 55);
    const colors = [0xef4444, 0xf97316, 0xfbbf24, 0x22c55e, 0x3b82f6, 0x8b5cf6];
    colors.forEach((color, i) => {
      g.lineStyle(3, color);
      g.lineBetween(this.C + 10, 55 + i * 2, 105, 30 + i * 8);
    });
    this.finish(g, 'skin_rainbow', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x1c1917);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x450a0a);
    g.fillCircle(this.C, this.C, 55);
    g.fillStyle(0x292524);
    g.beginPath();
    g.moveTo(30, 50);
    g.lineTo(15, 15);
    g.lineTo(25, 20);
    g.lineTo(40, 45);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(98, 50);
    g.lineTo(113, 15);
    g.lineTo(103, 20);
    g.lineTo(88, 45);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xef4444);
    g.fillEllipse(45, 50, 15, 10);
    g.fillEllipse(83, 50, 15, 10);
    g.fillStyle(0xfbbf24);
    g.fillCircle(45, 50, 5);
    g.fillCircle(83, 50, 5);
    g.fillStyle(0x7f1d1d);
    g.beginPath();
    g.moveTo(64, 55);
    g.lineTo(58, 68);
    g.lineTo(70, 68);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0x000000);
    g.beginPath();
    g.moveTo(45, 80);
    g.lineTo(55, 78);
    g.lineTo(64, 85);
    g.lineTo(73, 78);
    g.lineTo(83, 80);
    g.strokePath();
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(52, 78);
    g.lineTo(55, 90);
    g.lineTo(58, 78);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(70, 78);
    g.lineTo(73, 90);
    g.lineTo(76, 78);
    g.closePath();
    g.fillPath();
    this.finish(g, 'skin_infernal', this.S, this.S);

    g = this.createGraphics();
    for (let r = 64; r > 0; r -= 4) {
      g.fillStyle(0xfef3c7, 0.05 + (64 - r) / 200);
      g.fillCircle(this.C, this.C, r);
    }
    g.fillStyle(0xffffff);
    g.beginPath();
    g.moveTo(this.C - 5, this.C - 10);
    g.lineTo(15, 25);
    g.lineTo(10, 40);
    g.lineTo(15, 55);
    g.lineTo(20, 70);
    g.lineTo(this.C - 5, this.C + 10);
    g.closePath();
    g.fillPath();
    g.beginPath();
    g.moveTo(this.C + 5, this.C - 10);
    g.lineTo(113, 25);
    g.lineTo(118, 40);
    g.lineTo(113, 55);
    g.lineTo(108, 70);
    g.lineTo(this.C + 5, this.C + 10);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0xe2e8f0);
    g.lineBetween(20, 35, 55, this.C);
    g.lineBetween(25, 50, 55, this.C);
    g.lineBetween(108, 35, 73, this.C);
    g.lineBetween(103, 50, 73, this.C);
    g.lineStyle(4, 0xfcd34d);
    g.strokeCircle(this.C, 30, 20);
    g.fillStyle(0xfde68a);
    g.fillCircle(this.C, this.C, 15);
    this.finish(g, 'skin_divine', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x0f172a);
    g.fillCircle(this.C, this.C, 64);
    g.lineStyle(2, 0x06b6d4, 0.6);
    g.strokeEllipse(this.C, this.C, 100, 40);
    g.lineStyle(2, 0xd946ef, 0.6);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const x = this.C + Math.cos(a) * 50;
      const y = this.C + Math.sin(a) * 20 * Math.cos(a * 0.5 + 1);
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineStyle(2, 0x22d3ee, 0.6);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const x = this.C + Math.cos(a) * 50;
      const y = this.C + Math.sin(a) * 20 * Math.cos(a * 0.5 - 1);
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.fillStyle(0x06b6d4);
    g.fillCircle(this.C + 45, this.C, 5);
    g.fillStyle(0xd946ef);
    g.fillCircle(this.C - 30, this.C - 25, 5);
    g.fillStyle(0x22d3ee);
    g.fillCircle(this.C - 30, this.C + 25, 5);
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 12);
    g.fillStyle(0xef4444);
    g.fillCircle(this.C - 3, this.C - 2, 5);
    g.fillStyle(0x3b82f6);
    g.fillCircle(this.C + 3, this.C + 2, 5);
    this.finish(g, 'skin_quantum', this.S, this.S);

    g = this.createGraphics();
    g.fillStyle(0x020617);
    g.fillCircle(this.C, this.C, 64);
    g.lineStyle(8, 0x6366f1, 0.3);
    for (let arm = 0; arm < 2; arm++) {
      g.beginPath();
      for (let a = 0; a < Math.PI * 3; a += 0.1) {
        const r = 5 + a * 8;
        const angle = a + arm * Math.PI;
        const x = this.C + Math.cos(angle) * r;
        const y = this.C + Math.sin(angle) * r;
        if (a === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    g.fillStyle(0xffffff);
    for (let i = 0; i < 50; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 55;
      g.fillCircle(
        this.C + Math.cos(angle) * dist,
        this.C + Math.sin(angle) * dist,
        Math.random() > 0.8 ? 1.5 : 0.8
      );
    }
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(this.C, this.C, 10);
    g.fillStyle(0xfef3c7);
    g.fillCircle(this.C, this.C, 6);
    this.finish(g, 'skin_galaxy', this.S, this.S);
  }

  // ==================== LEGENDARY ====================

  private createLegendarySkins(): void {
    const g = this.createGraphics();
    g.fillStyle(0x0f0f0f);
    g.fillCircle(this.C, this.C, 64);
    g.fillStyle(0x1e1b4b);
    g.fillCircle(this.C, this.C, 55);
    g.lineStyle(6, 0x581c87);
    for (let i = 0; i < 8; i++) {
      const startAngle = (i / 8) * Math.PI * 2;
      g.beginPath();
      g.moveTo(this.C, this.C);
      for (let t = 0; t < 1; t += 0.1) {
        const angle = startAngle + Math.sin(t * 5) * 0.3;
        const dist = t * 55;
        g.lineTo(
          this.C + Math.cos(angle) * dist,
          this.C + Math.sin(angle) * dist
        );
      }
      g.strokePath();
    }
    g.fillStyle(0x7c3aed);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      g.fillCircle(
        this.C + Math.cos(angle) * 40,
        this.C + Math.sin(angle) * 40,
        4
      );
    }
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 20);
    g.fillStyle(0xa855f7);
    g.fillCircle(this.C, this.C, 15);
    g.fillStyle(0x000000);
    g.fillCircle(this.C, this.C, 8);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(this.C - 5, this.C - 5, 4);
    this.finish(g, 'skin_demon', this.S, this.S);
  }

  // ========== НОВАЯ ТЕКСТУРА: Подложка-команда ==========
  private generateTeamBase(): void {
    const g = this.createGraphics();

    // Основа — толстый белый круг (будет тонироваться в цвет команды)
    g.fillStyle(0xffffff);
    g.fillCircle(this.C, this.C, 62);

    // Внутренний вырез — чтобы мем был виден в центре
    g.fillStyle(0x000000, 0.08);
    g.fillCircle(this.C, this.C, 48);

    // Жирная чёрная обводка снизу для объёма
    g.lineStyle(7, 0x000000, 0.4);
    g.strokeCircle(this.C, this.C, 63);

    // Блик сверху (светлая окантовка)
    g.lineStyle(3, 0xffffff, 0.7);
    g.strokeCircle(this.C, this.C, 59);

    this.finish(g, 'team_base_circle', this.S, this.S);
  }

  // ==================== HELPER ====================

  protected drawSnowflake(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const x2 = cx + Math.cos(angle) * size;
      const y2 = cy + Math.sin(angle) * size;
      g.lineBetween(cx, cy, x2, y2);
      
      const branchLen = size * 0.4;
      const branchPos = size * 0.6;
      const bx = cx + Math.cos(angle) * branchPos;
      const by = cy + Math.sin(angle) * branchPos;
      
      g.lineBetween(
        bx, by,
        bx + Math.cos(angle + 0.5) * branchLen,
        by + Math.sin(angle + 0.5) * branchLen
      );
      g.lineBetween(
        bx, by,
        bx + Math.cos(angle - 0.5) * branchLen,
        by + Math.sin(angle - 0.5) * branchLen
      );
    }
  }
}