// src/assets/generation/UIGenerator.ts

import Phaser from 'phaser';
import { colorToRgb, colorToRgba } from '../../utils/ColorUtils';

/**
 * Генератор fallback-текстур для UI элементов
 */
export class UIGenerator {
  constructor(private scene: Phaser.Scene) {}

  /**
   * Генерирует fallback для scoreboard
   */
  generateScoreboardFallback(): void {
    if (this.scene.textures.exists('ui_scoreboard')) {
      console.log('✅ [UIGenerator] ui_scoreboard.png loaded');
      return;
    }
    
    console.log('[UIGenerator] Generating fallback scoreboard texture');
    
    const width = 600;
    const height = 100;
    
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, width, height);
    
    const cornerRadius = 24;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    (ctx as any).roundRect(0, 0, width, height, cornerRadius);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    (ctx as any).roundRect(4, 4, width - 8, height - 8, cornerRadius - 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    (ctx as any).roundRect(2, 2, width - 4, height - 4, cornerRadius - 1);
    ctx.stroke();
    
    const cornerSize = 20;
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(10, cornerSize + 10);
    ctx.lineTo(10, 10);
    ctx.lineTo(cornerSize + 10, 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(width - cornerSize - 10, 10);
    ctx.lineTo(width - 10, 10);
    ctx.lineTo(width - 10, cornerSize + 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(10, height - cornerSize - 10);
    ctx.lineTo(10, height - 10);
    ctx.lineTo(cornerSize + 10, height - 10);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(width - cornerSize - 10, height - 10);
    ctx.lineTo(width - 10, height - 10);
    ctx.lineTo(width - 10, height - cornerSize - 10);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(width / 2, 20);
    ctx.lineTo(width / 2, height - 20);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    [80, 520].forEach(x => {
      ctx.beginPath();
      ctx.arc(x, height / 2, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    this.scene.textures.addCanvas('ui_scoreboard', canvas);
    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Scoreboard fallback texture generated');
    }
  }

  /**
   * Генерирует fallback для портретов персонажей
   */
  generatePortraitFallbacks(): void {
    const portraits: { key: string; emoji: string; color: number }[] = [
      { key: 'commander_nova', emoji: '👩‍✈️', color: 0x00f2ff },
      { key: 'portrait_krag', emoji: '🔥', color: 0xff4500 },
      { key: 'portrait_unit734', emoji: '🤖', color: 0x00f2ff },
      { key: 'portrait_zra', emoji: '👁', color: 0x9d00ff },
      { key: 'portrait_oracle', emoji: '🦗', color: 0x39ff14 },
      { key: 'portrait_announcer', emoji: '📢', color: 0xffd700 },
    ];

    portraits.forEach(({ key, emoji, color }) => {
      if (this.scene.textures.exists(key)) {
        return;
      }

      if (import.meta.env.DEV) {
        console.log(`[UIGenerator] Generating fallback portrait: ${key}`);
      }

      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;

      // Фон с градиентом
      const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      gradient.addColorStop(0, colorToRgba(color, 0.4));
      gradient.addColorStop(1, colorToRgba(color, 0.1));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);

      // Круг
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 10, 0, Math.PI * 2);
      ctx.fillStyle = colorToRgba(color, 0.2);
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = colorToRgb(color);
      ctx.stroke();

      // Внутренний круг
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 20, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
      ctx.fill();

      // Эмодзи
      ctx.font = '100px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(emoji, size/2, size/2);

      // Декоративная рамка
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2 - 5, 0, Math.PI * 2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = colorToRgba(color, 0.6);
      ctx.stroke();

      this.scene.textures.addCanvas(key, canvas);
    });

    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Portrait fallbacks generated');
    }
  }

  /**
   * Генерирует fallback для портретов с эмоциями
   */
  generateEmotionPortraitFallbacks(): void {
    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Generating emotion portrait fallbacks...');
    }

    const characterConfigs: { 
      character: string; 
      emotions: string[]; 
      color: number; 
      symbol: string;
    }[] = [
      { character: 'nova', emotions: ['neutral', 'happy', 'determined', 'surprised', 'sad'], color: 0x00f2ff, symbol: '👩‍✈️' },
      { character: 'krag', emotions: ['neutral', 'angry', 'surprised'], color: 0xff4500, symbol: '🔥' },
      { character: 'unit734', emotions: ['neutral'], color: 0x00f2ff, symbol: '🤖' },
      { character: 'zra', emotions: ['neutral', 'mysterious'], color: 0x9d00ff, symbol: '👁' },
      { character: 'oracle', emotions: ['neutral', 'menacing'], color: 0x39ff14, symbol: '🦗' },
      { character: 'announcer', emotions: ['neutral', 'happy', 'excited'], color: 0xffd700, symbol: '📢' },
    ];

    const size = 256;

    characterConfigs.forEach(({ character, emotions, color, symbol }) => {
      emotions.forEach(emotion => {
        const key = `portrait_${character}_${emotion}`;
        
        if (this.scene.textures.exists(key)) return;
        
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        
        // Фон с градиентом
        const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
        gradient.addColorStop(0, colorToRgba(color, 0.4));
        gradient.addColorStop(1, colorToRgba(color, 0.1));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        
        // Круглая рамка
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = colorToRgb(color);
        ctx.stroke();
        
        // Символ персонажа
        ctx.font = '80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(symbol, size/2, size/2 - 20);
        
        // Эмоция текстом
        const emotionEmojis: Record<string, string> = {
          neutral: '😐',
          happy: '😊',
          determined: '😤',
          surprised: '😲',
          sad: '😢',
          angry: '😠',
          mysterious: '🔮',
          menacing: '😈',
          excited: '🤩',
        };
        
        ctx.font = '40px Arial';
        ctx.fillText(emotionEmojis[emotion] || '❓', size/2, size/2 + 60);
        
        // Внешняя декоративная рамка
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/2 - 5, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = colorToRgba(color, 0.6);
        ctx.stroke();
        
        this.scene.textures.addCanvas(key, canvas);
      });
    });

    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Emotion portrait fallbacks generated');
    }
  }

  /**
   * Генерирует текстуру металлического кольца
   */
  generateMetalRingTexture(): void {
    if (this.scene.textures.exists('metal_ring')) return;

    if (import.meta.env.DEV) {
      console.warn('[UIGenerator] metal_ring.png not found — generating fallback');
    }

    const size = 256;
    const canvas = this.scene.textures.createCanvas('metal_ring', size, size);
    const ctx = canvas.getContext();
    const cx = size / 2;
    const cy = size / 2;
    
    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, 124, 0, Math.PI * 2);
    ctx.arc(cx, cy, 108, 0, Math.PI * 2, true);
    const outerGrad = ctx.createRadialGradient(cx, cy, 108, cx, cy, 124);
    outerGrad.addColorStop(0, '#555555');
    outerGrad.addColorStop(0.5, '#888888');
    outerGrad.addColorStop(1, '#333333');
    ctx.fillStyle = outerGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 118, 0, Math.PI * 2);
    ctx.arc(cx, cy, 112, 0, Math.PI * 2, true);
    const midGrad = ctx.createLinearGradient(cx - 120, cy - 120, cx + 120, cy + 120);
    midGrad.addColorStop(0, '#d0d0d0');
    midGrad.addColorStop(0.3, '#ffffff');
    midGrad.addColorStop(0.5, '#e8e8e8');
    midGrad.addColorStop(0.7, '#c0c0c0');
    midGrad.addColorStop(1, '#a0a0a0');
    ctx.fillStyle = midGrad;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 112, 0, Math.PI * 2);
    ctx.arc(cx, cy, 108, 0, Math.PI * 2, true);
    ctx.fillStyle = '#cccccc';
    ctx.fill();

    canvas.refresh();
    if (import.meta.env.DEV) {
      console.log('[UIGenerator] metal_ring fallback texture generated');
    }
  }

  /**
   * Генерирует текстуру свечения (aura)
   */
  generateAuraTexture(): void {
    // ✅ OPTIMIZED: Skip if texture already exists
    if (this.scene.textures.exists('aura_glow')) {
      return;
    }
    
    const size = 128;
    const center = size / 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, size, size);
    
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.65, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.75, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.85, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    this.scene.textures.addCanvas('aura_glow', canvas);
    
    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Aura texture generated');
    }
  }

  /**
   * Генерирует текстуру кольца выбора
   */
  generateSelectedRingTexture(): void {
    // ✅ OPTIMIZED: Skip if texture already exists
    if (this.scene.textures.exists('aura_selected_ring')) {
      return;
    }
    
    const size = 128;
    const center = size / 2;
    
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    
    ctx.clearRect(0, 0, size, size);
    
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.70, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(0.78, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.83, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.88, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(0.95, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    this.scene.textures.addCanvas('aura_selected_ring', canvas);
  }

  /**
   * Генерирует текстуры частиц для фракций
   */
  generateFactionParticleTextures(): void {
    this.generateSparkTexture();
    this.generateSmokeTexture();
    this.generateDripTexture();
    this.generateGlitchTexture();

    if (import.meta.env.DEV) {
      console.log('[UIGenerator] Faction particle textures generated');
    }
  }

  private generateSparkTexture(): void {
    if (this.scene.textures.exists('p_spark')) return;

    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(255, 200, 100, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(255, 200, 100, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * size / 2, cy + Math.sin(angle) * size / 2);
      ctx.stroke();
    }

    this.scene.textures.addCanvas('p_spark', canvas);
  }

  private generateSmokeTexture(): void {
    if (this.scene.textures.exists('p_smoke')) return;

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(200, 150, 255, 0.8)');
    gradient.addColorStop(0.3, 'rgba(150, 100, 200, 0.5)');
    gradient.addColorStop(0.6, 'rgba(100, 50, 150, 0.3)');
    gradient.addColorStop(1, 'rgba(50, 0, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 5; i++) {
      const ox = cx + (Math.random() - 0.5) * size * 0.4;
      const oy = cy + (Math.random() - 0.5) * size * 0.4;
      const r = size * 0.15 + Math.random() * size * 0.1;
      
      const g2 = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g2.addColorStop(0, 'rgba(200, 150, 255, 0.4)');
      g2.addColorStop(1, 'rgba(100, 50, 150, 0)');
      
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    this.scene.textures.addCanvas('p_smoke', canvas);
  }

  private generateDripTexture(): void {
    if (this.scene.textures.exists('p_drip')) return;

    const size = 24;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cx = size / 2;
    const cy = size / 2;

    const gradient = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, size / 2);
    gradient.addColorStop(0, 'rgba(150, 255, 100, 1)');
    gradient.addColorStop(0.3, 'rgba(80, 255, 50, 0.9)');
    gradient.addColorStop(0.7, 'rgba(50, 200, 30, 0.6)');
    gradient.addColorStop(1, 'rgba(30, 150, 20, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx - 3, cy - 3, 4, 3, -Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    this.scene.textures.addCanvas('p_drip', canvas);
  }

  private generateGlitchTexture(): void {
    if (this.scene.textures.exists('p_glitch')) return;

    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = 'rgba(0, 242, 255, 0.9)';
    ctx.fillRect(2, 2, size - 4, size - 4);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(0, size / 2 - 1, size, 2);
    
    ctx.fillStyle = 'rgba(0, 136, 255, 0.6)';
    ctx.fillRect(size / 2 - 1, 0, 2, size);

    this.scene.textures.addCanvas('p_glitch', canvas);
  }
}