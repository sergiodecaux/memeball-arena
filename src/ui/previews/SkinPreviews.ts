// src/ui/previews/SkinPreviews.ts

import Phaser from 'phaser';
import { CapSkinData, BallSkinData, FieldSkinData } from '../../data/SkinsCatalog';
import { CapClass } from '../../constants/gameConstants';
import { drawClassIcon, getClassColor } from '../ClassIcons';

export interface PreviewOptions {
  /** Включить анимации (свечение, вращение, частицы) */
  animated?: boolean;
  /** Показывать иконку класса для фишек */
  showClassIcon?: boolean;
  /** Показывать тень */
  showShadow?: boolean;
  /** Показывать свечение */
  showGlow?: boolean;
}

interface AnimatedPreview {
  container: Phaser.GameObjects.Container;
  tweens: Phaser.Tweens.Tween[];
  particles?: Phaser.GameObjects.Particles.ParticleEmitter;
}

const DEFAULT_OPTIONS: PreviewOptions = {
  animated: false,
  showClassIcon: true,
  showShadow: true,
  showGlow: true,
};

export class SkinPreviews {
  
  // Храним ссылки на анимированные превью для очистки
  private static activeAnimations: Map<string, AnimatedPreview> = new Map();

  /**
   * Очистить все активные анимации
   */
  static clearAllAnimations(): void {
    this.activeAnimations.forEach((preview, key) => {
      preview.tweens.forEach(tween => tween.destroy());
      preview.particles?.destroy();
      this.activeAnimations.delete(key);
    });
  }

  /**
   * Очистить анимации конкретного превью
   */
  static clearAnimation(id: string): void {
    const preview = this.activeAnimations.get(id);
    if (preview) {
      preview.tweens.forEach(tween => tween.destroy());
      preview.particles?.destroy();
      this.activeAnimations.delete(id);
    }
  }

  // ==================== CAP PREVIEW ====================

  /**
   * Превью фишки
   */
  static createCapPreview(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    skin: CapSkinData,
    radius: number,
    capClass: CapClass = 'balanced',
    options: PreviewOptions = {}
  ): void {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const tweens: Phaser.Tweens.Tween[] = [];

    // === Свечение ===
    if (opts.showGlow && skin.hasGlow) {
      const glowColor = skin.glowColor || skin.primaryColor;
      const glow = scene.add.circle(x, y, radius + 8, glowColor, opts.animated ? 0.3 : 0.25);
      container.add(glow);

      if (opts.animated) {
        const tween = scene.tweens.add({
          targets: glow,
          alpha: { from: 0.2, to: 0.5 },
          scale: { from: 1, to: 1.1 },
          duration: 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        tweens.push(tween);
      }
    }

    // === Тень ===
    if (opts.showShadow) {
      container.add(
        scene.add.ellipse(x + 2, y + 2, radius * 1.8, radius * 1.4, 0x000000, 0.3)
      );
    }

    // === Основной спрайт/графика ===
    const textureKey = skin.visual.textureKey;
    
    if (textureKey && scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 128;
      const sprite = scene.add.sprite(x, y, textureKey).setScale(scale);
      container.add(sprite);

      // Лёгкое покачивание только в анимированном режиме
      if (opts.animated) {
        const tween = scene.tweens.add({
          targets: sprite,
          angle: { from: -2, to: 2 },
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        tweens.push(tween);
      }
    } else {
      // Fallback графика
      const g = scene.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      g.lineStyle(3, skin.secondaryColor);
      g.strokeCircle(x, y, radius);
      
      // Блик
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(x - radius * 0.3, y - radius * 0.3, radius * 0.5, radius * 0.35);
      container.add(g);
    }

    // === Иконка класса ===
    if (opts.showClassIcon) {
      const iconX = x + radius * 0.55;
      const iconY = y - radius * 0.55;
      const iconRadius = radius * 0.28;
      
      container.add(scene.add.circle(iconX, iconY, iconRadius + 2, 0x000000, 0.6));
      container.add(drawClassIcon(scene, iconX, iconY, capClass, iconRadius, getClassColor(capClass)));
    }

    // === Частицы (только анимированный режим) ===
    if (opts.animated && skin.visual.particleEffect) {
      this.addParticleEffect(scene, container, x, y, radius, skin.visual.particleEffect, tweens);
    }

    // Сохраняем для очистки
    if (opts.animated && tweens.length > 0) {
      this.activeAnimations.set(skin.id, { container, tweens });
    }
  }

  // ==================== BALL PREVIEW ====================

  /**
   * Превью мяча
   */
  static createBallPreview(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    skin: BallSkinData,
    radius: number,
    options: PreviewOptions = {}
  ): void {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const tweens: Phaser.Tweens.Tween[] = [];

    // === Свечение ===
    if (opts.showGlow && skin.hasGlow) {
      const glow = scene.add.circle(x, y, radius + 6, skin.glowColor, opts.animated ? 0.25 : 0.2);
      container.add(glow);
      
      if (opts.animated) {
        const tween = scene.tweens.add({
          targets: glow,
          alpha: { from: 0.2, to: 0.45 },
          scale: { from: 1, to: 1.15 },
          duration: 1000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        tweens.push(tween);
      }
    }

    // === Тень ===
    if (opts.showShadow) {
      container.add(
        scene.add.ellipse(x + 2, y + 2, radius * 1.6, radius * 1.2, 0x000000, 0.25)
      );
    }

    // === Основной спрайт ===
    const textureKey = skin.textureKey;
    
    if (textureKey && scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 64;
      const sprite = scene.add.sprite(x, y, textureKey).setScale(scale);
      container.add(sprite);
      
      // Вращение только в анимированном режиме
      if (opts.animated) {
        const tween = scene.tweens.add({
          targets: sprite,
          angle: 360,
          duration: 8000,
          repeat: -1,
          ease: 'Linear'
        });
        tweens.push(tween);
      }
    } else {
      // Fallback
      const g = scene.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      
      // Паттерн мяча
      g.fillStyle(skin.secondaryColor);
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.fillCircle(
          x + Math.cos(angle) * radius * 0.5, 
          y + Math.sin(angle) * radius * 0.5, 
          radius * 0.15
        );
      }
      g.fillCircle(x, y, radius * 0.2);
      
      g.lineStyle(2, skin.glowColor);
      g.strokeCircle(x, y, radius);
      container.add(g);
    }

    // === Частицы ===
    if (opts.animated && skin.particleEffect) {
      this.addParticleEffect(scene, container, x, y, radius, skin.particleEffect, tweens);
    }

    if (opts.animated && tweens.length > 0) {
      this.activeAnimations.set(skin.id, { container, tweens });
    }
  }

  // ==================== FIELD PREVIEW ====================

  /**
   * Превью поля
   */
  static createFieldPreview(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    skin: FieldSkinData,
    width: number,
    height: number,
    options: PreviewOptions = {}
  ): void {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const tweens: Phaser.Tweens.Tween[] = [];

    const g = scene.add.graphics();
    
    // === Фон поля ===
    g.fillStyle(skin.fieldColor);
    g.fillRoundedRect(x - width / 2, y - height / 2, width, height, 6);
    
    // === Разметка ===
    g.lineStyle(1.5, skin.lineColor, 0.8);
    g.strokeRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width - 8, height - 8, 4);
    
    // Центральная линия
    g.lineBetween(x - width / 2 + 4, y, x + width / 2 - 4, y);
    
    // Центральный круг
    const circleRadius = Math.min(width, height) * 0.15;
    g.strokeCircle(x, y, circleRadius);
    
    // === Ворота ===
    const goalWidth = width * 0.3;
    const goalHeight = height * 0.1;
    
    g.fillStyle(skin.goalColor, 0.3);
    g.fillRect(x - goalWidth / 2, y - height / 2, goalWidth, goalHeight);
    g.fillRect(x - goalWidth / 2, y + height / 2 - goalHeight, goalWidth, goalHeight);
    
    g.lineStyle(2, skin.goalColor, 0.8);
    g.strokeRect(x - goalWidth / 2, y - height / 2, goalWidth, goalHeight);
    g.strokeRect(x - goalWidth / 2, y + height / 2 - goalHeight, goalWidth, goalHeight);
    
    // === Штрафные зоны ===
    const penaltyWidth = width * 0.5;
    const penaltyHeight = height * 0.18;
    g.lineStyle(1, skin.lineColor, 0.5);
    g.strokeRect(x - penaltyWidth / 2, y - height / 2 + 4, penaltyWidth, penaltyHeight);
    g.strokeRect(x - penaltyWidth / 2, y + height / 2 - penaltyHeight - 4, penaltyWidth, penaltyHeight);
    
    // === Рамка ===
    g.lineStyle(2, skin.borderColor);
    g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, 6);
    
    container.add(g);

    // === Эффекты (только анимированный режим) ===
    if (opts.animated && skin.effects?.length) {
      this.addFieldEffects(scene, container, x, y, width, height, skin.effects, tweens);
    }

    if (opts.animated && tweens.length > 0) {
      this.activeAnimations.set(skin.id, { container, tweens });
    }
  }

  // ==================== PARTICLE EFFECTS ====================

  private static addParticleEffect(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    radius: number,
    config: any,
    tweens: Phaser.Tweens.Tween[]
  ): void {
    // Упрощённые частицы через graphics + tweens
    const particleCount = Math.min(config.quantity || 3, 5); // Максимум 5
    
    for (let i = 0; i < particleCount; i++) {
      const color = config.color?.[i % config.color.length] || 0xffffff;
      const particle = scene.add.circle(
        x + (Math.random() - 0.5) * radius,
        y + (Math.random() - 0.5) * radius,
        (config.scale?.start || 0.3) * 8,
        color,
        0.6
      );
      container.add(particle);

      const tween = scene.tweens.add({
        targets: particle,
        x: x + (Math.random() - 0.5) * radius * 2,
        y: y + (Math.random() - 0.5) * radius * 2 + (config.gravityY ? -20 : 0),
        alpha: 0,
        scale: config.scale?.end || 0,
        duration: config.lifespan || 1000,
        repeat: -1,
        delay: i * 200,
        onRepeat: () => {
          particle.setPosition(
            x + (Math.random() - 0.5) * radius,
            y + (Math.random() - 0.5) * radius
          );
          particle.setAlpha(0.6);
          particle.setScale(1);
        }
      });
      tweens.push(tween);
    }
  }

  private static addFieldEffects(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    width: number, height: number,
    effects: any[],
    tweens: Phaser.Tweens.Tween[]
  ): void {
    effects.forEach(effect => {
      switch (effect.type) {
        case 'border':
        case 'ambient': {
          const glowColor = effect.glowColor || 0xffffff;
          const glowIntensity = effect.glowIntensity || 0.3;
          
          const glow = scene.add.graphics();
          glow.lineStyle(3, glowColor, glowIntensity);
          glow.strokeRoundedRect(x - width/2 - 2, y - height/2 - 2, width + 4, height + 4, 8);
          container.add(glow);
          
          if (effect.borderPulse || effect.animatedBorder) {
            const tween = scene.tweens.add({
              targets: glow,
              alpha: { from: glowIntensity, to: glowIntensity * 2 },
              duration: 1500,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
            });
            tweens.push(tween);
          }
          break;
        }
        
        case 'particles': {
          const colors = effect.particleColors || [0xffffff];
          const count = Math.min(effect.particleCount || 10, 8); // Максимум 8
          
          for (let i = 0; i < count; i++) {
            const px = x + (Math.random() - 0.5) * (width - 20);
            const py = y + (Math.random() - 0.5) * (height - 20);
            const color = colors[Math.floor(Math.random() * colors.length)];
            
            const particle = scene.add.circle(px, py, 2, color, 0.5);
            container.add(particle);
            
            const tween = scene.tweens.add({
              targets: particle,
              y: py - 15,
              alpha: 0,
              duration: effect.particleLifespan || 2000,
              repeat: -1,
              delay: Math.random() * 1000,
              onRepeat: () => {
                particle.setPosition(
                  x + (Math.random() - 0.5) * (width - 20),
                  y + (Math.random() - 0.5) * (height - 20)
                );
                particle.setAlpha(0.5);
              }
            });
            tweens.push(tween);
          }
          break;
        }
      }
    });
  }

  // ==================== STATIC PREVIEWS (для списков) ====================

  /**
   * Быстрый статичный превью фишки (без анимаций)
   */
  static createCapPreviewStatic(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: CapSkinData,
    radius: number
  ): void {
    this.createCapPreview(scene, container, x, y, skin, radius, 'balanced', {
      animated: false,
      showClassIcon: false,
      showShadow: true,
      showGlow: true
    });
  }

  /**
   * Быстрый статичный превью мяча
   */
  static createBallPreviewStatic(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: BallSkinData,
    radius: number
  ): void {
    this.createBallPreview(scene, container, x, y, skin, radius, {
      animated: false,
      showShadow: true,
      showGlow: true
    });
  }

  /**
   * Быстрый статичный превью поля
   */
  static createFieldPreviewStatic(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: FieldSkinData,
    width: number, height: number
  ): void {
    this.createFieldPreview(scene, container, x, y, skin, width, height, {
      animated: false,
      showGlow: false
    });
  }

  // ==================== ANIMATED PREVIEWS (для детального просмотра) ====================

  /**
   * Анимированный превью фишки (для модального окна)
   */
  static createCapPreviewAnimated(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: CapSkinData,
    radius: number,
    capClass: CapClass = 'balanced'
  ): void {
    this.createCapPreview(scene, container, x, y, skin, radius, capClass, {
      animated: true,
      showClassIcon: true,
      showShadow: true,
      showGlow: true
    });
  }

  /**
   * Анимированный превью мяча
   */
  static createBallPreviewAnimated(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: BallSkinData,
    radius: number
  ): void {
    this.createBallPreview(scene, container, x, y, skin, radius, {
      animated: true,
      showShadow: true,
      showGlow: true
    });
  }

  /**
   * Анимированный превью поля
   */
  static createFieldPreviewAnimated(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: FieldSkinData,
    width: number, height: number
  ): void {
    this.createFieldPreview(scene, container, x, y, skin, width, height, {
      animated: true,
      showGlow: true
    });
  }
}