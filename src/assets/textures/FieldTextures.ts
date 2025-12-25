import { TextureGenerator } from './TextureGenerator';

export class FieldTextures extends TextureGenerator {
  generate(): void {
    this.createHexGrid();
    this.createCircuit();
    this.createIndustrialStripes();
    this.createCarbonDots();
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

  /** Диагональные индустриальные полосы для Industrial Zone */
  private createIndustrialStripes(): void {
    const size = 128;
    const g = this.createGraphics();

    // Базовый фон
    g.fillStyle(0x1a1a1a, 1);
    g.fillRect(0, 0, size, size);

    // Тёмные диагональные полосы
    g.lineStyle(8, 0x262626, 1);
    for (let x = -size; x < size * 2; x += 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + size, size);
      g.strokePath();
    }

    this.finish(g, 'tex_field_industrial', size, size);
  }

  /** Карбон / перфорация для Elite Carbon */
  private createCarbonDots(): void {
    const size = 64;
    const g = this.createGraphics();

    // Тёмный фон
    g.fillStyle(0x141414, 1);
    g.fillRect(0, 0, size, size);

    // Мелкие точки
    const step = 8;
    for (let x = step / 2; x < size; x += step) {
      for (let y = step / 2; y < size; y += step) {
        g.fillStyle(0x000000, 0.6);
        g.fillCircle(x, y, 1.2);
      }
    }

    this.finish(g, 'tex_field_carbon', size, size);
  }
}