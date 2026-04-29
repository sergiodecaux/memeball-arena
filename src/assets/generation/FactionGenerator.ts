// src/assets/generation/FactionGenerator.ts

import Phaser from 'phaser';
import { FACTIONS, FACTION_IDS, FactionId, FACTION_ARENAS, FactionArena } from '../../constants/gameConstants';
import { UNITS_CATALOG } from '../../data/UnitsCatalog';
import { UNITS_REPOSITORY } from '../../data/UnitsRepository';
import { colorToRgb, colorToRgba, lightenColor, darkenColorRgb, darkenColor } from '../../utils/ColorUtils';

/**
 * Генератор fallback-текстур для фракций
 */
export class FactionGenerator {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Генерирует fallback для токенов фракций
   */
  generateFactionFallbacks(): void {
    const size = 256;

    for (const factionId of FACTION_IDS) {
      const faction = FACTIONS[factionId];

      if (this.scene.textures.exists(faction.assetKey)) {
        continue;
      }

      if (import.meta.env.DEV) {
        console.log(`[FactionGenerator] Generating fallback for faction: ${faction.assetKey}`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 8;

      ctx.clearRect(0, 0, size, size);

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const mainColor = '#' + faction.color.toString(16).padStart(6, '0');
      const secColor = '#' + faction.colorSecondary.toString(16).padStart(6, '0');

      gradient.addColorStop(0, secColor);
      gradient.addColorStop(0.7, mainColor);
      gradient.addColorStop(1, darkenColor(mainColor, 0.3));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 10, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      ctx.font = 'bold 80px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      
      const symbols: Record<FactionId, string> = {
        magma: '🔥',
        cyborg: '⚡',
        void: '👁',
        insect: '🦠',
      };
      
      ctx.fillText(symbols[factionId] || '?', cx, cy);

      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      this.scene.textures.addCanvas(faction.assetKey, canvas);
    }
  }

  /**
   * Генерирует fallback для юнитов
   */
  generateUnitFallbacks(): void {
    const size = 512;

    UNITS_CATALOG.forEach((unit) => {
      if (this.scene.textures.exists(unit.assetKey)) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log(`[FactionGenerator] Generating HD fallback for unit: ${unit.assetKey}`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 16;

      ctx.clearRect(0, 0, size, size);

      const faction = FACTIONS[unit.factionId];
      const mainColor = '#' + faction.color.toString(16).padStart(6, '0');
      const secColor = '#' + faction.colorSecondary.toString(16).padStart(6, '0');

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, secColor);
      gradient.addColorStop(0.7, mainColor);
      gradient.addColorStop(1, darkenColor(mainColor, 0.3));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 20, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      ctx.font = 'bold 160px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      
      const classIcons: Record<string, string> = {
        balanced: '⚖️',
        tank: '🛡️',
        sniper: '🎯',
        trickster: '✨',
      };
      
      ctx.fillText(classIcons[unit.capClass] || '?', cx, cy);

      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      this.scene.textures.addCanvas(unit.assetKey, canvas);
    });
  }

  /**
   * Генерирует fallback для арен
   */
  generateArenaFallbacks(): void {
    for (const factionId of FACTION_IDS) {
      const arena = FACTION_ARENAS[factionId];
      
      if (this.scene.textures.exists(arena.assetKey)) continue;
      
      if (import.meta.env.DEV) {
        console.log(`[FactionGenerator] Generating fallback arena: ${arena.name}`);
      }
      
      const width = 1080;
      const height = 1920;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      const baseColor = colorToRgb(arena.ambientColor);
      const lighterColor = lightenColor(baseColor, 0.15);
      const darkerColor = darkenColorRgb(baseColor, 0.4);
      
      gradient.addColorStop(0, lighterColor);
      gradient.addColorStop(0.5, baseColor);
      gradient.addColorStop(1, darkerColor);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      this.drawArenaPattern(ctx, arena, width, height);
      
      ctx.strokeStyle = colorToRgba(arena.lineColor, 0.4);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, 200, 0, Math.PI * 2);
      ctx.stroke();
      
      const glowGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, 300
      );
      glowGradient.addColorStop(0, colorToRgba(arena.lineColor, 0.15));
      glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);
      
      const vignetteGradient = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
      vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vignetteGradient;
      ctx.fillRect(0, 0, width, height);
      
      this.scene.textures.addCanvas(arena.assetKey, canvas);
    }
  }

  private drawArenaPattern(ctx: CanvasRenderingContext2D, arena: FactionArena, width: number, height: number): void {
    const lineColor = colorToRgba(arena.lineColor, 0.12);
    const accentColor = colorToRgba(arena.lineColor, 0.25);
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    
    switch (arena.style) {
      case 'neon':
        this.drawHexGrid(ctx, width, height, 80, lineColor);
        break;
      case 'industrial':
        this.drawIndustrialGrid(ctx, width, height, 100, lineColor, accentColor);
        break;
      case 'carbon':
        this.drawDiagonalGrid(ctx, width, height, 60, lineColor);
        break;
      case 'organic':
        this.drawOrganicPattern(ctx, width, height, 70, lineColor, accentColor);
        break;
      default:
        this.drawSimpleGrid(ctx, width, height, 100, lineColor);
    }
  }

  private drawHexGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    
    const h = size * Math.sqrt(3);
    const cols = Math.ceil(width / (size * 1.5)) + 2;
    const rows = Math.ceil(height / h) + 2;
    
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const x = col * size * 1.5;
        const y = row * h + (col % 2 ? h / 2 : 0);
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  private drawIndustrialGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, lineColor: string, accentColor: string): void {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    ctx.fillStyle = accentColor;
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawDiagonalGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    
    for (let i = -height; i < width + height; i += size) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
    
    for (let i = -height; i < width + height; i += size) {
      ctx.beginPath();
      ctx.moveTo(i + height, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
  }

  private drawOrganicPattern(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, lineColor: string, accentColor: string): void {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    
    const cells: { x: number; y: number; r: number }[] = [];
    const count = Math.floor((width * height) / (size * size * 4));
    
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = size * 0.3 + Math.random() * size * 0.4;
      
      let valid = true;
      for (const cell of cells) {
        const dist = Math.sqrt((x - cell.x) ** 2 + (y - cell.y) ** 2);
        if (dist < cell.r + r - 10) {
          valid = false;
          break;
        }
      }
      
      if (valid) {
        cells.push({ x, y, r });
        
        ctx.beginPath();
        const points = 8 + Math.floor(Math.random() * 4);
        for (let j = 0; j <= points; j++) {
          const angle = (j / points) * Math.PI * 2;
          const variation = 0.8 + Math.random() * 0.4;
          const px = x + r * variation * Math.cos(angle);
          const py = y + r * variation * Math.sin(angle);
          if (j === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, accentColor);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
  }

  private drawSimpleGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number, color: string): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    for (let y = 0; y < height; y += size) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    for (let x = 0; x < width; x += size) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  /**
   * Генерирует fallback для артов фракций (VS Screen)
   */
  generateFactionArtFallbacks(): void {
    const factionArtConfig: Record<FactionId, { symbol: string; colors: [string, string] }> = {
      magma: { symbol: '🔥', colors: ['#ff4500', '#ff6b35'] },
      cyborg: { symbol: '⚡', colors: ['#00f2ff', '#0088ff'] },
      void: { symbol: '👁', colors: ['#9d00ff', '#cc44ff'] },
      insect: { symbol: '🦠', colors: ['#39ff14', '#00ff00'] },
    };

    for (const factionId of FACTION_IDS) {
      const artKey = `art_${factionId}`;
      
      if (this.scene.textures.exists(artKey)) continue;

      if (import.meta.env.DEV) {
        console.log(`[FactionGenerator] Generating fallback art: ${artKey}`);
      }

      const width = 400;
      const height = 600;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      const config = factionArtConfig[factionId];
      const faction = FACTIONS[factionId];

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, config.colors[1]);
      gradient.addColorStop(0.5, config.colors[0]);
      gradient.addColorStop(1, darkenColor(config.colors[0], 0.5));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const y = (height / 10) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y + 50);
        ctx.stroke();
      }

      ctx.font = 'bold 150px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(config.symbol, width / 2, height / 2 - 50);

      ctx.font = 'bold 32px Arial';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(faction.name.toUpperCase(), width / 2, height - 100);

      const glowGradient = ctx.createRadialGradient(
        width / 2, height / 2, 0,
        width / 2, height / 2, Math.max(width, height)
      );
      glowGradient.addColorStop(0, 'rgba(255,255,255,0.1)');
      glowGradient.addColorStop(0.5, 'rgba(0,0,0,0)');
      glowGradient.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = glowGradient;
      ctx.fillRect(0, 0, width, height);

      this.scene.textures.addCanvas(artKey, canvas);
    }
  }

  /**
   * Генерирует fallback для UI превью фракций
   */
  generateFactionUIBackgroundFallbacks(): void {
    if (import.meta.env.DEV) {
      console.log('[FactionGenerator] Generating faction preview fallbacks if needed...');
    }

    const factionUIConfigs: Record<string, { base: number; accent: number }> = {
      magma: { base: 0x1a0800, accent: 0xff4500 },
      cyber: { base: 0x000a1a, accent: 0x00f2ff },
      void: { base: 0x0a001a, accent: 0x9d00ff },
      terran: { base: 0x001a0a, accent: 0x39ff14 },
    };

    for (const [uiId, colors] of Object.entries(factionUIConfigs)) {
      const key = `faction_preview_${uiId}`;
      
      if (this.scene.textures.exists(key)) {
        continue;
      }
      
      if (import.meta.env.DEV) {
        console.warn(`[FactionGenerator] Generating fallback for: ${key}`);
      }
      this.generatePreviewFallback(key, colors, uiId);
    }
  }

  private generatePreviewFallback(
    key: string, 
    colors: { base: number; accent: number }, 
    uiId: string
  ): void {
    const width = 1080;
    const height = 1920;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    const baseR = (colors.base >> 16) & 0xff;
    const baseG = (colors.base >> 8) & 0xff;
    const baseB = colors.base & 0xff;
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, `rgb(${baseR}, ${baseG}, ${baseB})`);
    gradient.addColorStop(0.5, lightenColor(colorToRgb(colors.base), 0.2));
    gradient.addColorStop(1, 'black');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    ctx.font = 'bold 300px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colorToRgba(colors.accent, 0.2);
    
    const symbols: Record<string, string> = {
      magma: '🔥',
      cyber: '⚡',
      void: '👁',
      terran: '🦠'
    };
    ctx.fillText(symbols[uiId] || '?', width / 2, height * 0.4);

    const vignette = ctx.createLinearGradient(0, height * 0.5, 0, height);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.9)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, height * 0.5, width, height * 0.5);

    this.scene.textures.addCanvas(key, canvas);
    if (import.meta.env.DEV) {
      console.log(`[FactionGenerator] Generated UI preview fallback: ${key}`);
    }
  }

  /**
   * ✅ NEW: Генерирует fallback для UNITS_REPOSITORY (80 новых уникальных юнитов)
   * Создает ключи и для unit.id, и для unit.assetKey: разные сцены используют разные идентификаторы.
   */
  generateUnitsRepositoryFallbacks(): void {
    const size = 512;

    UNITS_REPOSITORY.forEach((unit) => {
      if (this.scene.textures.exists(unit.id) && this.scene.textures.exists(unit.assetKey)) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log(`[FactionGenerator] Generating HD fallback for unit: ${unit.id} (path: ${unit.assetPath})`);
      }

      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 16;

      ctx.clearRect(0, 0, size, size);

      const faction = FACTIONS[unit.factionId];
      const mainColor = '#' + faction.color.toString(16).padStart(6, '0');
      const secColor = '#' + (faction.colorSecondary || faction.color).toString(16).padStart(6, '0');

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      gradient.addColorStop(0, secColor);
      gradient.addColorStop(0.7, mainColor);
      gradient.addColorStop(1, darkenColor(mainColor, 0.3));

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 12;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, radius - 20, 0, Math.PI * 2);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();

      ctx.font = 'bold 160px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      
      const classIcons: Record<string, string> = {
        balanced: '⚖️',
        tank: '🛡️',
        sniper: '🎯',
        trickster: '✨',
      };
      
      ctx.fillText(classIcons[unit.role] || '?', cx, cy);

      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();

      if (!this.scene.textures.exists(unit.id)) {
        this.scene.textures.addCanvas(unit.id, canvas);
      }

      if (!this.scene.textures.exists(unit.assetKey)) {
        this.scene.textures.addCanvas(unit.assetKey, canvas);
      }
    });

    if (import.meta.env.DEV) {
      console.log(`[FactionGenerator] ✅ Generated fallbacks for ${UNITS_REPOSITORY.length} units from UNITS_REPOSITORY`);
    }
  }
}