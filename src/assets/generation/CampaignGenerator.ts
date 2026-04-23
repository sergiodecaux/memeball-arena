// src/assets/generation/CampaignGenerator.ts

import Phaser from 'phaser';
import { colorToRgb, colorToRgba, lightenColor } from '../../utils/ColorUtils';

/**
 * Генератор fallback-текстур для системы кампании
 */
export class CampaignGenerator {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Генерирует все fallback для карты кампании
   */
  generateCampaignMapFallbacks(): void {
    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Generating campaign map fallbacks...');
    }
    
    const nodeSize = 64;

    this.generateNodeLocked(nodeSize);
    this.generateNodeActive(nodeSize);
    this.generateNodeCompleted(nodeSize);
    this.generateNodeBoss(nodeSize);
    this.generatePathDotted();

    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Campaign map fallbacks generated');
    }
  }

  private generateNodeLocked(nodeSize: number): void {
    if (this.scene.textures.exists('node_locked')) return;

    const canvas = document.createElement('canvas');
    canvas.width = nodeSize;
    canvas.height = nodeSize;
    const ctx = canvas.getContext('2d')!;
    
    // Серый круг
    ctx.beginPath();
    ctx.arc(nodeSize/2, nodeSize/2, nodeSize/2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#333333';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#555555';
    ctx.stroke();
    
    // Замок эмодзи
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#666666';
    ctx.fillText('🔒', nodeSize/2, nodeSize/2);
    
    this.scene.textures.addCanvas('node_locked', canvas);
  }

  private generateNodeActive(nodeSize: number): void {
    if (this.scene.textures.exists('node_active')) return;

    const canvas = document.createElement('canvas');
    canvas.width = nodeSize;
    canvas.height = nodeSize;
    const ctx = canvas.getContext('2d')!;
    
    // Голубое свечение
    const gradient = ctx.createRadialGradient(nodeSize/2, nodeSize/2, 0, nodeSize/2, nodeSize/2, nodeSize/2);
    gradient.addColorStop(0, '#00f2ff');
    gradient.addColorStop(0.6, '#0088ff');
    gradient.addColorStop(1, 'rgba(0, 136, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, nodeSize, nodeSize);
    
    // Центральный круг
    ctx.beginPath();
    ctx.arc(nodeSize/2, nodeSize/2, nodeSize/3, 0, Math.PI * 2);
    ctx.fillStyle = '#00f2ff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    
    // Play иконка
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(nodeSize/2 - 6, nodeSize/2 - 8);
    ctx.lineTo(nodeSize/2 + 8, nodeSize/2);
    ctx.lineTo(nodeSize/2 - 6, nodeSize/2 + 8);
    ctx.closePath();
    ctx.fill();
    
    this.scene.textures.addCanvas('node_active', canvas);
  }

  private generateNodeCompleted(nodeSize: number): void {
    [1, 2, 3].forEach(stars => {
      const key = `node_completed_${stars}star${stars > 1 ? 's' : ''}`;
      if (this.scene.textures.exists(key)) return;

      const canvas = document.createElement('canvas');
      canvas.width = nodeSize;
      canvas.height = nodeSize;
      const ctx = canvas.getContext('2d')!;
      
      // Цвет рамки в зависимости от звёзд
      const frameColors = ['#cd7f32', '#c0c0c0', '#ffd700']; // bronze, silver, gold
      const frameColor = frameColors[stars - 1];
      
      // Круг с рамкой
      ctx.beginPath();
      ctx.arc(nodeSize/2, nodeSize/2, nodeSize/2 - 4, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a2e';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = frameColor;
      ctx.stroke();
      
      // Галочка
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(nodeSize/2 - 10, nodeSize/2);
      ctx.lineTo(nodeSize/2 - 3, nodeSize/2 + 8);
      ctx.lineTo(nodeSize/2 + 12, nodeSize/2 - 8);
      ctx.stroke();
      
      // Звёзды под нодой
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      const starText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      ctx.fillText(starText, nodeSize/2, nodeSize - 6);
      
      this.scene.textures.addCanvas(key, canvas);
    });
  }

  private generateNodeBoss(nodeSize: number): void {
    if (this.scene.textures.exists('node_boss')) return;

    const canvas = document.createElement('canvas');
    canvas.width = nodeSize;
    canvas.height = nodeSize;
    const ctx = canvas.getContext('2d')!;
    
    // Красное свечение
    const gradient = ctx.createRadialGradient(nodeSize/2, nodeSize/2, 0, nodeSize/2, nodeSize/2, nodeSize/2);
    gradient.addColorStop(0, '#ff4444');
    gradient.addColorStop(0.5, '#aa0000');
    gradient.addColorStop(1, 'rgba(170, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, nodeSize, nodeSize);
    
    // Круг с шипами
    ctx.beginPath();
    ctx.arc(nodeSize/2, nodeSize/2, nodeSize/2 - 6, 0, Math.PI * 2);
    ctx.fillStyle = '#330000';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff0000';
    ctx.stroke();
    
    // Череп эмодзи
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💀', nodeSize/2, nodeSize/2);
    
    this.scene.textures.addCanvas('node_boss', canvas);
  }

  private generatePathDotted(): void {
    if (this.scene.textures.exists('path_dotted')) return;

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#00f2ff';
    ctx.globalAlpha = 0.6;
    
    // Точки
    ctx.beginPath();
    ctx.arc(8, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(24, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    
    this.scene.textures.addCanvas('path_dotted', canvas);
  }

  /**
   * Генерирует fallback для звёзд
   */
  generateStarFallbacks(): void {
    const starSize = 32;

    // star_empty
    if (!this.scene.textures.exists('star_empty')) {
      const canvas = document.createElement('canvas');
      canvas.width = starSize;
      canvas.height = starSize;
      const ctx = canvas.getContext('2d')!;
      
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#333333';
      ctx.fillText('☆', starSize/2, starSize/2);
      
      this.scene.textures.addCanvas('star_empty', canvas);
    }

    // star_filled
    if (!this.scene.textures.exists('star_filled')) {
      const canvas = document.createElement('canvas');
      canvas.width = starSize;
      canvas.height = starSize;
      const ctx = canvas.getContext('2d')!;
      
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('★', starSize/2, starSize/2);
      
      // Свечение
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 10;
      ctx.fillText('★', starSize/2, starSize/2);
      
      this.scene.textures.addCanvas('star_filled', canvas);
    }

    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Star fallbacks generated');
    }
  }

  /**
   * Генерирует fallback фоны для глав кампании
   */
  generateCampaignChapterBackgroundFallbacks(): void {
    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Generating campaign chapter background fallbacks...');
    }

    const chapterConfigs: Record<string, { base: number; accent: number; symbol: string }> = {
      magma: { base: 0x1a0800, accent: 0xff4500, symbol: '🔥' },
      cyborg: { base: 0x000a1a, accent: 0x00f2ff, symbol: '⚡' },
      void: { base: 0x0a001a, accent: 0x9d00ff, symbol: '👁' },
      insect: { base: 0x001a0a, accent: 0x39ff14, symbol: '🦗' },
    };

    Object.entries(chapterConfigs).forEach(([chapter, config]) => {
      const key = `bg_chapter_${chapter}`;
      
      if (this.scene.textures.exists(key)) return;
      
      if (import.meta.env.DEV) {
        console.log(`[CampaignGenerator] Generating fallback chapter background: ${key}`);
      }
      
      const width = 1080;
      const height = 1920;
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      // Градиент фона
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, colorToRgb(config.base));
      gradient.addColorStop(0.3, lightenColor(colorToRgb(config.base), 0.1));
      gradient.addColorStop(0.7, colorToRgb(config.base));
      gradient.addColorStop(1, 'black');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      // Декоративные элементы
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 20; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = 50 + Math.random() * 150;
        
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size);
        glow.addColorStop(0, colorToRgba(config.accent, 0.3));
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - size, y - size, size * 2, size * 2);
      }
      ctx.globalAlpha = 1;
      
      // Большой символ в центре
      ctx.font = 'bold 400px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colorToRgba(config.accent, 0.15);
      ctx.fillText(config.symbol, width / 2, height * 0.4);
      
      // Виньетка
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.3,
        width / 2, height / 2, Math.max(width, height) * 0.8
      );
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,0,0.7)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
      
      this.scene.textures.addCanvas(key, canvas);
    });

    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Campaign chapter background fallbacks generated');
    }
  }

  /**
   * Генерирует fallback для боссов
   */
  generateBossFallbacks(): void {
    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Generating boss fallbacks...');
    }

    const bossConfigs: { key: string; color: number; symbol: string }[] = [
      { key: 'boss_krag', color: 0xff4500, symbol: '🔥' },
      { key: 'boss_unit734', color: 0x00f2ff, symbol: '🤖' },
      { key: 'boss_zra', color: 0x9d00ff, symbol: '👁' },
      { key: 'boss_oracle', color: 0x39ff14, symbol: '🦗' },
    ];

    const size = 512;

    bossConfigs.forEach(({ key, color, symbol }) => {
      if (this.scene.textures.exists(key)) return;
      
      if (import.meta.env.DEV) {
        console.log(`[CampaignGenerator] Generating fallback boss: ${key}`);
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 20;
      
      // Внешнее свечение
      const outerGlow = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius * 1.2);
      outerGlow.addColorStop(0, colorToRgba(color, 0.5));
      outerGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerGlow;
      ctx.fillRect(0, 0, size, size);
      
      // Основной круг с градиентом
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const mainColor = '#' + color.toString(16).padStart(6, '0');
      const darkColor = this.darkenColor(mainColor, 0.5);
      gradient.addColorStop(0, mainColor);
      gradient.addColorStop(0.7, this.darkenColor(mainColor, 0.3));
      gradient.addColorStop(1, darkColor);
      
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      
      // Золотая рамка (босс!)
      ctx.lineWidth = 8;
      ctx.strokeStyle = '#ffd700';
      ctx.stroke();
      
      // Вторая рамка
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 15, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,215,0,0.5)';
      ctx.stroke();
      
      // Символ босса
      ctx.font = 'bold 180px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(symbol, cx, cy - 20);
      
      // Корона/метка босса
      ctx.font = 'bold 60px Arial';
      ctx.fillStyle = '#ffd700';
      ctx.fillText('👑', cx, cy + 100);
      
      // Блик
      ctx.beginPath();
      ctx.ellipse(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, radius * 0.15, -Math.PI / 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      
      this.scene.textures.addCanvas(key, canvas);
    });

    if (import.meta.env.DEV) {
      console.log('[CampaignGenerator] Boss fallbacks generated');
    }
  }

  private darkenColor(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);

    const nr = Math.floor(r * (1 - factor));
    const ng = Math.floor(g * (1 - factor));
    const nb = Math.floor(b * (1 - factor));

    return `rgb(${nr},${ng},${nb})`;
  }
}