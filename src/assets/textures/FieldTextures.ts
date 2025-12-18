// src/assets/textures/FieldTextures.ts

import { TextureGenerator } from './TextureGenerator';

export class FieldTextures extends TextureGenerator {
  generate(): void {
    this.createHexGrid();
    this.createCircuit();
  }

  private createHexGrid(): void {
    const g = this.createGraphics();
    g.lineStyle(1, 0xffffff, 0.8);
    this.drawHexagon(g, 32, 32, 28);
    g.lineStyle(1, 0xffffff, 0.3);
    this.drawHexagon(g, 32, 32, 20);
    this.finish(g, 'tex_field_hex', 64, 64);
  }

  private createCircuit(): void {
    const g = this.createGraphics();
    g.lineStyle(2, 0xffffff, 0.8);
    g.beginPath();
    g.moveTo(0, 32);
    g.lineTo(20, 32);
    g.lineTo(20, 12);
    g.lineTo(32, 12);
    g.moveTo(64, 32);
    g.lineTo(44, 32);
    g.lineTo(44, 52);
    g.lineTo(32, 52);
    g.moveTo(32, 0);
    g.lineTo(32, 64);
    g.strokePath();
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(20, 12, 3);
    g.fillCircle(44, 52, 3);
    g.fillCircle(32, 32, 4);
    this.finish(g, 'tex_field_circuit', 64, 64);
  }
}