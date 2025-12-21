// src/renderers/FieldRenderer.ts

import Phaser from 'phaser';
import { GOAL } from '../constants/gameConstants';
import { FieldBounds } from '../types';
import { getFieldSkin, FieldSkinData, FieldEffectConfig } from '../data/SkinsCatalog';
import { playerData } from '../data/PlayerData';

export class FieldRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private floorPattern?: Phaser.GameObjects.TileSprite;
  private bounds: FieldBounds;
  private scale: number;
  private skin: FieldSkinData;

  // Эффекты
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private borderGraphics?: Phaser.GameObjects.Graphics;
  private ambientContainer?: Phaser.GameObjects.Container;

  private static readonly DEFAULT_SKIN: FieldSkinData = {
    id: 'field_default',
    name: 'Cyber Grid',
    rarity: 'basic',
    price: {},
    fieldColor: 0x0f172a,
    lineColor: 0x0ea5e9,
    borderColor: 0x1e40af,
    goalColor: 0x0ea5e9,
  };

  /**
   * @param scene - Phaser сцена
   * @param bounds - Границы поля
   * @param fieldScale - Масштаб поля
   * @param skinId - ID скина поля (опционально, если не указан - берётся из playerData)
   */
  constructor(
    scene: Phaser.Scene, 
    bounds: FieldBounds, 
    fieldScale: number = 1,
    skinId?: string
  ) {
    this.scene = scene;
    this.bounds = bounds;
    this.scale = fieldScale;

    // Определяем скин
    const effectiveSkinId = skinId || playerData.get().equippedFieldSkin || 'field_default';
    this.skin = getFieldSkin(effectiveSkinId) || getFieldSkin('field_default') || FieldRenderer.DEFAULT_SKIN;
    
    console.log('[FieldRenderer] Using skin:', this.skin.id, this.skin.name);

    this.graphics = scene.add.graphics();
  }

  render(): void {
    this.createFloor();
    this.drawField();
    this.createEffects();
  }

  private createFloor(): void {
    const { bounds, skin, scene } = this;

    // Тёмный фон под всем
    const darkBg = scene.add.rectangle(
      bounds.centerX,
      bounds.centerY,
      bounds.width + 100,
      bounds.height + 100,
      0x020617
    );
    darkBg.setDepth(-15);

    const textureKey = skin.textureKey;

    if (textureKey && scene.textures.exists(textureKey)) {
      this.floorPattern = scene.add.tileSprite(
        bounds.centerX,
        bounds.centerY,
        bounds.width,
        bounds.height,
        textureKey
      );
      this.floorPattern.setTint(skin.fieldColor);
      this.floorPattern.setAlpha(0.25);
      this.floorPattern.setDepth(-10);
    } else {
      const bg = scene.add.rectangle(
        bounds.centerX,
        bounds.centerY,
        bounds.width,
        bounds.height,
        skin.fieldColor
      );
      bg.setDepth(-10);
    }
  }

  private drawField(): void {
    const g = this.graphics;
    const b = this.bounds;
    const s = this.skin;

    g.clear();
    g.setDepth(1);

    // Граница с неоновым эффектом
    g.lineStyle(12, s.borderColor, 0.15);
    g.strokeRect(b.left, b.top, b.width, b.height);
    g.lineStyle(6, s.borderColor, 0.3);
    g.strokeRect(b.left, b.top, b.width, b.height);
    g.lineStyle(3, s.borderColor, 0.8);
    g.strokeRect(b.left, b.top, b.width, b.height);

    // Центральная линия
    g.lineStyle(2, s.lineColor, 0.6);
    g.lineBetween(b.left, b.centerY, b.right, b.centerY);

    // Центральный круг
    const circleRadius = 60 * this.scale;
    g.lineStyle(2, s.lineColor, 0.6);
    g.strokeCircle(b.centerX, b.centerY, circleRadius);
    g.fillStyle(s.lineColor, 0.08);
    g.fillCircle(b.centerX, b.centerY, circleRadius);
    g.fillStyle(s.lineColor, 1);
    g.fillCircle(b.centerX, b.centerY, 4);

    // Штрафные зоны
    const penaltyWidth = 140 * this.scale;
    const penaltyHeight = 50 * this.scale;
    
    g.lineStyle(2, s.lineColor, 0.5);
    g.strokeRect(b.centerX - penaltyWidth / 2, b.top, penaltyWidth, penaltyHeight);
    g.strokeRect(b.centerX - penaltyWidth / 2, b.bottom - penaltyHeight, penaltyWidth, penaltyHeight);

    // Ворота
    this.drawGoal(b.centerX, b.top, s.goalColor, -1);
    this.drawGoal(b.centerX, b.bottom, s.goalColor, 1);

    // Угловые дуги
    const cornerRadius = 15 * this.scale;
    g.lineStyle(2, s.lineColor, 0.4);
    g.beginPath();
    g.arc(b.left, b.top, cornerRadius, 0, Math.PI / 2);
    g.strokePath();
    g.beginPath();
    g.arc(b.right, b.top, cornerRadius, Math.PI / 2, Math.PI);
    g.strokePath();
    g.beginPath();
    g.arc(b.left, b.bottom, cornerRadius, -Math.PI / 2, 0);
    g.strokePath();
    g.beginPath();
    g.arc(b.right, b.bottom, cornerRadius, Math.PI, -Math.PI / 2);
    g.strokePath();
  }

  private drawGoal(x: number, y: number, color: number, direction: number): void {
    const g = this.graphics;
    const goalWidth = GOAL.WIDTH * this.scale;
    const goalDepth = GOAL.DEPTH * this.scale;

    // Зона ворот (свечение)
    g.fillStyle(color, 0.1);
    g.fillRect(
      x - goalWidth / 2,
      direction === -1 ? y - goalDepth : y,
      goalWidth,
      goalDepth
    );

    // Каркас ворот
    g.lineStyle(4, color, 1);
    g.beginPath();

    if (direction === -1) {
      g.moveTo(x - goalWidth / 2, y);
      g.lineTo(x - goalWidth / 2, y - goalDepth);
      g.lineTo(x + goalWidth / 2, y - goalDepth);
      g.lineTo(x + goalWidth / 2, y);
    } else {
      g.moveTo(x - goalWidth / 2, y);
      g.lineTo(x - goalWidth / 2, y + goalDepth);
      g.lineTo(x + goalWidth / 2, y + goalDepth);
      g.lineTo(x + goalWidth / 2, y);
    }
    g.strokePath();

    // Линия ворот
    g.lineStyle(2, 0xffffff, 0.7);
    g.lineBetween(x - goalWidth / 2, y, x + goalWidth / 2, y);

    // Внешнее свечение ворот
    g.lineStyle(8, color, 0.15);
    g.lineBetween(x - goalWidth / 2, y, x + goalWidth / 2, y);
  }

  private createEffects(): void {
    if (!this.skin.effects) return;

    this.ambientContainer = this.scene.add.container(0, 0);
    this.ambientContainer.setDepth(0);

    for (const effect of this.skin.effects) {
      switch (effect.type) {
        case 'particles':
          this.createParticleEffect(effect);
          break;
        case 'ambient':
          this.createAmbientEffect(effect);
          break;
        case 'border':
          this.createBorderEffect(effect);
          break;
      }
    }
  }

  private createParticleEffect(effect: FieldEffectConfig): void {
    const { bounds, scene } = this;
    
    const texKey = effect.particleTexture || 'p_glow';
    if (!scene.textures.exists(texKey)) return;

    const colors = effect.particleColors || [0xffffff];
    const count = effect.particleCount || 20;

    const emitter = scene.add.particles(bounds.centerX, bounds.centerY, texKey, {
      x: { min: bounds.left - bounds.centerX + 20, max: bounds.right - bounds.centerX - 20 },
      y: { min: bounds.top - bounds.centerY + 20, max: bounds.bottom - bounds.centerY - 20 },
      speed: effect.particleSpeed || 10,
      scale: effect.particleScale || { start: 0.3, end: 0 },
      alpha: effect.particleAlpha || { start: 0.6, end: 0 },
      lifespan: effect.particleLifespan || 2000,
      frequency: (effect.particleLifespan || 2000) / count,
      tint: colors,
      blendMode: 'ADD',
      quantity: 1,
    });

    emitter.setDepth(2);
    this.particleEmitters.push(emitter);
  }

  private createAmbientEffect(effect: FieldEffectConfig): void {
    if (!effect.ambientGlow) return;

    const { bounds, scene } = this;
    const color = effect.glowColor || this.skin.lineColor;
    const intensity = effect.glowIntensity || 0.2;

    this.glowGraphics = scene.add.graphics();
    this.glowGraphics.setDepth(-5);

    // Центральное свечение
    for (let r = 150; r > 0; r -= 3) {
      const alpha = intensity * (r / 150) * (r / 150);
      this.glowGraphics.fillStyle(color, alpha * 0.5);
      this.glowGraphics.fillCircle(bounds.centerX, bounds.centerY, r * this.scale);
    }

    // Свечение от ворот
    const goalWidth = GOAL.WIDTH * this.scale;
    for (let r = 80; r > 0; r -= 2) {
      const alpha = intensity * 0.5 * (r / 80);
      this.glowGraphics.fillStyle(this.skin.goalColor, alpha);
      this.glowGraphics.fillEllipse(bounds.centerX, bounds.top, goalWidth + r, r);
      this.glowGraphics.fillEllipse(bounds.centerX, bounds.bottom, goalWidth + r, r);
    }

    // Анимация пульсации
    scene.tweens.add({
      targets: this.glowGraphics,
      alpha: { from: 0.7, to: 1 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  private createBorderEffect(effect: FieldEffectConfig): void {
    const { bounds, scene } = this;
    const color = effect.glowColor || this.skin.borderColor;
    const intensity = effect.glowIntensity || 0.5;

    this.borderGraphics = scene.add.graphics();
    this.borderGraphics.setDepth(3);

    const drawBorder = (alpha: number) => {
      this.borderGraphics!.clear();

      // Многослойное свечение
      for (let i = 4; i >= 1; i--) {
        this.borderGraphics!.lineStyle(12 / i, color, alpha * intensity * i * 0.15);
        this.borderGraphics!.strokeRect(
          bounds.left - i * 2,
          bounds.top - i * 2,
          bounds.width + i * 4,
          bounds.height + i * 4
        );
      }

      // Яркие углы
      const cornerSize = 30 * this.scale;
      this.borderGraphics!.lineStyle(3, color, alpha * intensity);

      // Верхний левый
      this.borderGraphics!.beginPath();
      this.borderGraphics!.moveTo(bounds.left, bounds.top + cornerSize);
      this.borderGraphics!.lineTo(bounds.left, bounds.top);
      this.borderGraphics!.lineTo(bounds.left + cornerSize, bounds.top);
      this.borderGraphics!.strokePath();

      // Верхний правый
      this.borderGraphics!.beginPath();
      this.borderGraphics!.moveTo(bounds.right - cornerSize, bounds.top);
      this.borderGraphics!.lineTo(bounds.right, bounds.top);
      this.borderGraphics!.lineTo(bounds.right, bounds.top + cornerSize);
      this.borderGraphics!.strokePath();

      // Нижний левый
      this.borderGraphics!.beginPath();
      this.borderGraphics!.moveTo(bounds.left, bounds.bottom - cornerSize);
      this.borderGraphics!.lineTo(bounds.left, bounds.bottom);
      this.borderGraphics!.lineTo(bounds.left + cornerSize, bounds.bottom);
      this.borderGraphics!.strokePath();

      // Нижний правый
      this.borderGraphics!.beginPath();
      this.borderGraphics!.moveTo(bounds.right - cornerSize, bounds.bottom);
      this.borderGraphics!.lineTo(bounds.right, bounds.bottom);
      this.borderGraphics!.lineTo(bounds.right, bounds.bottom - cornerSize);
      this.borderGraphics!.strokePath();
    };

    drawBorder(1);

    if (effect.borderPulse) {
      scene.tweens.add({
        targets: { alpha: 1 },
        alpha: { from: 0.5, to: 1 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        onUpdate: (tween) => {
          const alpha = tween.getValue();
          drawBorder(alpha);
        }
      });
    }

    if (effect.animatedBorder) {
      // Бегущий свет по периметру
      this.createRunningLight(color, intensity);
    }
  }

  private createRunningLight(color: number, intensity: number): void {
    const { bounds, scene } = this;

    const light = scene.add.graphics();
    light.setDepth(4);

    const perimeter = (bounds.width + bounds.height) * 2;
    let progress = 0;

    scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        progress = (progress + 2) % perimeter;
        light.clear();

        const pos = this.getPointOnPerimeter(progress, perimeter);
        
        // Свечение бегущего света
        for (let r = 20; r > 0; r -= 4) {
          light.fillStyle(color, intensity * (r / 20) * 0.3);
          light.fillCircle(pos.x, pos.y, r);
        }

        // Яркий центр
        light.fillStyle(0xffffff, intensity * 0.8);
        light.fillCircle(pos.x, pos.y, 3);
      }
    });
  }

  private getPointOnPerimeter(progress: number, perimeter: number): { x: number; y: number } {
    const { bounds } = this;
    const w = bounds.width;
    const h = bounds.height;

    let p = progress;

    // Верхняя сторона
    if (p < w) {
      return { x: bounds.left + p, y: bounds.top };
    }
    p -= w;

    // Правая сторона
    if (p < h) {
      return { x: bounds.right, y: bounds.top + p };
    }
    p -= h;

    // Нижняя сторона
    if (p < w) {
      return { x: bounds.right - p, y: bounds.bottom };
    }
    p -= w;

    // Левая сторона
    return { x: bounds.left, y: bounds.bottom - p };
  }

  update(): void {
    if (this.floorPattern) {
      this.floorPattern.tilePositionX += 0.3;
      this.floorPattern.tilePositionY += 0.15;
    }
  }

  destroy(): void {
    this.particleEmitters.forEach(e => e.destroy());
    this.glowGraphics?.destroy();
    this.borderGraphics?.destroy();
    this.ambientContainer?.destroy();
    this.floorPattern?.destroy();
    this.graphics.destroy();
  }
}