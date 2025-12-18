// src/assets/textures/ParticleTextures.ts

import { TextureGenerator } from './TextureGenerator';

export class ParticleTextures extends TextureGenerator {
  generate(): void {
    this.createGlow();
    this.createSpark();
    this.createFlame();
    this.createSmoke();
    this.createBubble();
    this.createShard();
    this.createPetal();
    this.createStar();
    this.createRing();
    this.createDust();
  }

  private createGlow(): void {
    const g = this.createGraphics();
    for (let r = 16; r > 0; r -= 2) {
      g.fillStyle(0xffffff, (r / 16) * 0.8);
      g.fillCircle(16, 16, r);
    }
    this.finish(g, 'p_glow', 32, 32);
  }

  private createSpark(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(8, 0); g.lineTo(10, 6); g.lineTo(16, 8);
    g.lineTo(10, 10); g.lineTo(8, 16); g.lineTo(6, 10);
    g.lineTo(0, 8); g.lineTo(6, 6);
    g.closePath();
    g.fillPath();
    g.fillCircle(8, 8, 2);
    this.finish(g, 'p_spark', 16, 16);
  }

  private createFlame(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 1);
    g.beginPath();
    g.moveTo(12, 0); g.lineTo(20, 12); g.lineTo(18, 24);
    g.lineTo(12, 32); g.lineTo(6, 24); g.lineTo(4, 12);
    g.closePath();
    g.fillPath();
    this.finish(g, 'p_flame', 24, 32);
  }

  private createSmoke(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(16, 16, 12);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(10, 12, 8);
    g.fillCircle(22, 14, 9);
    g.fillStyle(0xffffff, 0.2);
    g.fillCircle(14, 22, 7);
    this.finish(g, 'p_smoke', 32, 32);
  }

  private createBubble(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(8, 8, 7);
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.strokeCircle(8, 8, 7);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(5, 5, 2);
    this.finish(g, 'p_bubble', 16, 16);
  }

  private createShard(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 0.9);
    g.beginPath();
    g.moveTo(6, 0); g.lineTo(12, 5); g.lineTo(10, 16);
    g.lineTo(4, 18); g.lineTo(0, 8);
    g.closePath();
    g.fillPath();
    this.finish(g, 'p_shard', 12, 18);
  }

  private createPetal(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 0.9);
    g.fillEllipse(5, 7, 8, 12);
    this.finish(g, 'p_petal', 10, 14);
  }

  private createStar(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 1);
    this.drawStar(g, 8, 8, 5, 8, 4, true);
    this.finish(g, 'p_star', 16, 16);
  }

  private createRing(): void {
    const g = this.createGraphics();
    g.lineStyle(2, 0xffffff, 0.8);
    g.strokeCircle(8, 8, 6);
    this.finish(g, 'p_ring', 16, 16);
  }

  private createDust(): void {
    const g = this.createGraphics();
    g.fillStyle(0xffffff, 0.6);
    g.fillCircle(4, 4, 3);
    g.fillStyle(0xffffff, 0.3);
    g.fillCircle(4, 4, 4);
    this.finish(g, 'p_dust', 8, 8);
  }
}