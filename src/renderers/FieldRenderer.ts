// src/renderers/FieldRenderer.ts

import Phaser from 'phaser';
import { GOAL, FactionArena } from '../constants/gameConstants';
import { FieldBounds } from '../types';
import { getFieldSkin, FieldSkinData, FieldEffectConfig } from '../data/SkinsCatalog';
import { playerData } from '../data/PlayerData';

type GoalSide = 'top' | 'bottom';

// Расширенный тип стиля, включающий organic
type FieldStyle = 'neon' | 'industrial' | 'carbon' | 'organic' | 'generic';

interface GoalVisual {
  side: GoalSide;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  net: Phaser.GameObjects.Graphics;
}

export class FieldRenderer {
  private scene: Phaser.Scene;
  private graphics: Phaser.GameObjects.Graphics;
  private floorPattern?: Phaser.GameObjects.TileSprite;
  private bounds: FieldBounds;
  private scale: number;
  private skin: FieldSkinData;
  
  // Арена фракции (опционально)
  private arena?: FactionArena;
  private arenaBackground?: Phaser.GameObjects.Image;
  private arenaVignette?: Phaser.GameObjects.Graphics;

  // Эффекты
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private borderGraphics?: Phaser.GameObjects.Graphics;
  private ambientContainer?: Phaser.GameObjects.Container;

  // Ворота
  private topGoal?: GoalVisual;
  private bottomGoal?: GoalVisual;

  private static readonly DEFAULT_SKIN: FieldSkinData = {
    id: 'field_default',
    name: 'Neon Cyber',
    rarity: 'basic',
    price: {},
    style: 'neon',
    fieldColor: 0x05080a,
    lineColor: 0x00f3ff,
    borderColor: 0x00f3ff,
    goalColor: 0x00f3ff,
    goalFrameColor: 0x00f3ff,
    goalNetColor: 0x00f3ff,
    goalDepthMultiplier: 1,
    textureKey: 'tex_field_circuit'
  };

  /**
   * @param scene - Phaser сцена
   * @param bounds - Границы поля
   * @param fieldScale - Масштаб поля
   * @param skinId - ID скина поля (опционально, если не указан - берётся из playerData)
   * @param arena - Арена фракции (опционально, переопределяет цвета скина)
   */
  constructor(
    scene: Phaser.Scene, 
    bounds: FieldBounds, 
    fieldScale: number = 1,
    skinId?: string,
    arena?: FactionArena
  ) {
    this.scene = scene;
    this.bounds = bounds;
    this.scale = fieldScale;
    this.arena = arena;

    // Определяем скин
    const effectiveSkinId = skinId || playerData.get().equippedFieldSkin || 'field_default';
    this.skin = getFieldSkin(effectiveSkinId) || getFieldSkin('field_default') || FieldRenderer.DEFAULT_SKIN;
    
    // Если передана арена - переопределяем цвета скина
    if (arena) {
      this.skin = {
        ...this.skin,
        fieldColor: arena.ambientColor,
        lineColor: arena.lineColor,
        borderColor: arena.borderColor,
        goalColor: arena.goalColor,
        goalFrameColor: arena.goalColor,
        goalNetColor: arena.lineColor,
        style: arena.style as any,
      };
      console.log('[FieldRenderer] Using arena:', arena.name, 'with style:', arena.style);
    }
    
    console.log('[FieldRenderer] Using skin:', this.skin.id, this.skin.name);

    this.graphics = scene.add.graphics();
  }

  render(): void {
    // Если есть арена - рисуем её фон
    if (this.arena) {
      this.createArenaBackground();
    }
    
    this.createFloor();
    this.drawField();
    this.createGoals();
    this.createEffects();
    
    // Если есть арена - добавляем виньетку поверх
    if (this.arena) {
      this.createArenaVignette();
    }
  }

  /**
   * Создаёт фоновое изображение арены
   */
  private createArenaBackground(): void {
    if (!this.arena) return;
    
    const { bounds, scene } = this;
    const { width, height } = scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Проверяем, загружена ли текстура арены
    if (scene.textures.exists(this.arena.assetKey)) {
      this.arenaBackground = scene.add.image(centerX, centerY, this.arena.assetKey);
      this.arenaBackground.setDepth(-20);
      
      // Масштабируем под экран
      const scaleX = width / this.arenaBackground.width;
      const scaleY = height / this.arenaBackground.height;
      const scale = Math.max(scaleX, scaleY) * 1.1; // +10% чтобы покрыть края
      this.arenaBackground.setScale(scale);
      
      // Лёгкое затемнение
      this.arenaBackground.setAlpha(0.9);
      
      console.log(`[FieldRenderer] Arena background: ${this.arena.name} (${this.arena.assetKey})`);
    } else {
      console.warn(`[FieldRenderer] Arena texture not found: ${this.arena.assetKey}`);
    }
  }

  /**
   * Создаёт виньетку поверх арены для фокусировки на центре
   */
  private createArenaVignette(): void {
    if (!this.arena) return;
    
    const { bounds, scene } = this;
    const { width, height } = scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    
    this.arenaVignette = scene.add.graphics();
    this.arenaVignette.setDepth(0.5); // Между фоном и полем
    
    // Создаём радиальную виньетку через множество концентрических эллипсов
    const maxRadius = Math.max(width, height) * 0.8;
    const steps = 20;
    
    for (let i = steps; i >= 0; i--) {
      const ratio = i / steps;
      const radius = maxRadius * (0.5 + ratio * 0.5);
      const alpha = (1 - ratio) * 0.4; // Максимум 0.4 альфа на краях
      
      this.arenaVignette.fillStyle(0x000000, alpha / steps);
      this.arenaVignette.fillEllipse(centerX, centerY, radius * 2, radius * 2);
    }
  }

  private createFloor(): void {
    const { bounds, skin, scene } = this;

    // Тёмный фон под всем (если нет арены)
    if (!this.arena) {
      const darkBg = scene.add.rectangle(
        bounds.centerX,
        bounds.centerY,
        bounds.width + 100,
        bounds.height + 100,
        0x020617
      );
      darkBg.setDepth(-15);
    }

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
      this.floorPattern.setAlpha(this.arena ? 0.15 : 0.25); // Прозрачнее если есть арена
      this.floorPattern.setDepth(-10);
    } else {
      const bg = scene.add.rectangle(
        bounds.centerX,
        bounds.centerY,
        bounds.width,
        bounds.height,
        skin.fieldColor
      );
      bg.setAlpha(this.arena ? 0.7 : 1); // Полупрозрачно если есть арена
      bg.setDepth(-10);
    }
  }

  /**
   * Получает стиль поля с поддержкой organic
   */
  private getFieldStyle(): FieldStyle {
    const skinStyle = this.skin.style || 'generic';
    // Приводим к расширенному типу
    if (skinStyle === 'neon' || skinStyle === 'industrial' || skinStyle === 'carbon') {
      return skinStyle;
    }
    // Проверяем арену для organic стиля
    if (this.arena?.style === 'organic') {
      return 'organic';
    }
    return 'generic';
  }

  private drawField(): void {
    const g = this.graphics;
    const b = this.bounds;
    const s = this.skin;
    const style = this.getFieldStyle();
    
    // Интенсивность свечения из арены
    const glowIntensity = this.arena?.glowIntensity || 1.0;

    g.clear();
    g.setDepth(1);

    // Граница/борта поля под разные стили
    if (style === 'neon') {
      // Неоновый «трёхслойный» бордюр
      g.lineStyle(12, s.borderColor, 0.18 * glowIntensity);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.lineStyle(6, s.borderColor, 0.35 * glowIntensity);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.lineStyle(3, s.borderColor, 0.9);
      g.strokeRect(b.left, b.top, b.width, b.height);
    } else if (style === 'industrial') {
      // Толстый тёмный бордюр + внутренняя светлая рамка
      g.fillStyle(0x111111, 1);
      g.fillRect(b.left - 8, b.top - 8, b.width + 16, b.height + 16);

      g.lineStyle(10, s.borderColor, 1);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.lineStyle(3, 0x555555, 0.8);
      g.strokeRect(b.left + 6, b.top + 6, b.width - 12, b.height - 12);
    } else if (style === 'carbon') {
      // «Премиальный» серый бордюр без сильного свечения
      g.fillStyle(0x101010, 1);
      g.fillRect(b.left - 6, b.top - 6, b.width + 12, b.height + 12);

      g.lineStyle(8, s.borderColor, 0.9);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.lineStyle(2, 0xaaaaaa, 0.4);
      g.strokeRect(b.left + 6, b.top + 6, b.width - 12, b.height - 12);
    } else if (style === 'organic') {
      // Органический стиль для Insect
      g.fillStyle(0x0a1a0f, 0.9);
      g.fillRect(b.left - 6, b.top - 6, b.width + 12, b.height + 12);

      // Волнистая граница (имитация)
      g.lineStyle(6, s.borderColor, 0.7);
      g.strokeRect(b.left, b.top, b.width, b.height);
      
      // Внутреннее "пульсирующее" свечение
      g.lineStyle(12, s.borderColor, 0.15 * glowIntensity);
      g.strokeRect(b.left + 3, b.top + 3, b.width - 6, b.height - 6);
    } else {
      // Фоллбек
      g.lineStyle(8, s.borderColor, 0.3);
      g.strokeRect(b.left, b.top, b.width, b.height);
      g.lineStyle(3, s.borderColor, 0.9);
      g.strokeRect(b.left, b.top, b.width, b.height);
    }

    // Центральная линия
    const lineAlpha = style === 'organic' ? 0.5 : 0.6;
    g.lineStyle(2, s.lineColor, lineAlpha);
    g.lineBetween(b.left, b.centerY, b.right, b.centerY);

    // Центральный круг
    const circleRadius = 60 * this.scale;
    g.lineStyle(2, s.lineColor, lineAlpha);
    g.strokeCircle(b.centerX, b.centerY, circleRadius);
    
    const fillAlpha = style === 'carbon' ? 0.05 : (style === 'organic' ? 0.1 : 0.08);
    g.fillStyle(s.lineColor, fillAlpha);
    g.fillCircle(b.centerX, b.centerY, circleRadius);
    g.fillStyle(s.lineColor, 1);
    g.fillCircle(b.centerX, b.centerY, 4);

    // Штрафные зоны
    const penaltyWidth = 140 * this.scale;
    const penaltyHeight = 50 * this.scale;
    
    const penaltyAlpha = style === 'carbon' ? 0.45 : lineAlpha;
    g.lineStyle(2, s.lineColor, penaltyAlpha);
    g.strokeRect(b.centerX - penaltyWidth / 2, b.top, penaltyWidth, penaltyHeight);
    g.strokeRect(b.centerX - penaltyWidth / 2, b.bottom - penaltyHeight, penaltyWidth, penaltyHeight);

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
    
    // Дополнительные эффекты для арены
    if (this.arena) {
      this.drawArenaAccents(g);
    }
  }

  /**
   * Рисует дополнительные акценты для арены фракции
   */
  private drawArenaAccents(g: Phaser.GameObjects.Graphics): void {
    if (!this.arena) return;
    
    const b = this.bounds;
    const color = this.arena.lineColor;
    const intensity = this.arena.glowIntensity;
    
    // Свечение в углах поля
    const cornerGlowSize = 40 * this.scale;
    const corners = [
      { x: b.left, y: b.top },
      { x: b.right, y: b.top },
      { x: b.left, y: b.bottom },
      { x: b.right, y: b.bottom },
    ];
    
    corners.forEach(corner => {
      // Мягкое свечение
      for (let r = cornerGlowSize; r > 0; r -= 5) {
        const alpha = (r / cornerGlowSize) * 0.1 * intensity;
        g.fillStyle(color, alpha);
        g.fillCircle(corner.x, corner.y, r);
      }
    });
    
    // Акцентные точки на центральной линии
    const dotCount = 5;
    const dotSpacing = b.width / (dotCount + 1);
    
    g.fillStyle(color, 0.6);
    for (let i = 1; i <= dotCount; i++) {
      const x = b.left + dotSpacing * i;
      g.fillCircle(x, b.centerY, 3 * this.scale);
    }
  }

  /** Создаём визуальные ворота (рама + сетка) сверху и снизу */
  private createGoals(): void {
    this.topGoal = this.createGoalVisual('top');
    this.bottomGoal = this.createGoalVisual('bottom');
  }

  private createGoalVisual(side: GoalSide): GoalVisual {
    const { bounds, scene } = this;
    const s = this.skin;
    const style = this.getFieldStyle();

    const isTop = side === 'top';
    const x = bounds.centerX;
    const y = isTop ? bounds.top : bounds.bottom;
    const dir = isTop ? -1 : 1;

    const goalWidth = GOAL.WIDTH * this.scale;
    const baseDepth = GOAL.DEPTH * this.scale;
    const depthMultiplier = s.goalDepthMultiplier ?? 1;
    const goalDepth = baseDepth * depthMultiplier;

    const frameColor = s.goalFrameColor ?? s.goalColor;
    const netColor = s.goalNetColor ?? 0xffffff;

    const container = scene.add.container(x, y);
    container.setDepth(5);

    // Фон внутри ворот (тёмная коробка)
    const bg = scene.add.graphics();
    const boxColor =
      style === 'neon' ? 0x00141a :
      style === 'industrial' ? 0x101010 :
      style === 'organic' ? 0x051a0a :
      0x050505;

    const startY = isTop ? -goalDepth : 0;
    bg.fillStyle(boxColor, style === 'neon' ? 0.9 : 1);
    bg.fillRect(-goalWidth / 2, startY, goalWidth, goalDepth);

    // Внутренняя тень по краю
    bg.lineStyle(2, 0x000000, 0.7);
    bg.strokeRect(-goalWidth / 2, startY, goalWidth, goalDepth);

    container.add(bg);

    // Сетка ворот
    const net = scene.add.graphics();
    const netAlpha =
      style === 'neon' ? 0.4 :
      style === 'carbon' ? 0.75 :
      style === 'organic' ? 0.5 :
      0.5;

    net.lineStyle(1.5 * this.scale, netColor, netAlpha);

    const pad = 4 * this.scale;
    const netLeft = -goalWidth / 2 + pad;
    const netRight = goalWidth / 2 - pad;
    const netTop = startY + pad;
    const netBottom = startY + goalDepth - pad;

    if (style === 'industrial') {
      // Диагональная «рабица»
      const step = 10 * this.scale;
      const height = netBottom - netTop;

      net.lineStyle(1.3 * this.scale, netColor, netAlpha);

      for (let x0 = netLeft - height; x0 < netRight + height; x0 += step) {
        net.beginPath();
        net.moveTo(x0, netBottom);
        net.lineTo(x0 + height, netTop);
        net.strokePath();
      }
      for (let x0 = netLeft; x0 < netRight + height; x0 += step) {
        net.beginPath();
        net.moveTo(x0, netTop);
        net.lineTo(x0 - height, netBottom);
        net.strokePath();
      }
    } else if (style === 'organic') {
      // Органическая "паутина" для Insect
      const step = 8 * this.scale;
      
      // Вертикальные линии с небольшим изгибом
      for (let x0 = netLeft; x0 <= netRight + 0.01; x0 += step) {
        net.beginPath();
        const wobble = Math.sin(x0 * 0.1) * 2;
        net.moveTo(x0 + wobble, netTop);
        net.lineTo(x0 - wobble, netBottom);
        net.strokePath();
      }
      
      // Горизонтальные линии
      for (let y0 = netTop; y0 <= netBottom + 0.01; y0 += step) {
        net.beginPath();
        net.moveTo(netLeft, y0);
        net.lineTo(netRight, y0);
        net.strokePath();
      }
    } else {
      // Квадратная сетка
      const step = (style === 'carbon' ? 6 : 8) * this.scale;

      for (let x0 = netLeft; x0 <= netRight + 0.01; x0 += step) {
        net.beginPath();
        net.moveTo(x0, netTop);
        net.lineTo(x0, netBottom);
        net.strokePath();
      }
      for (let y0 = netTop; y0 <= netBottom + 0.01; y0 += step) {
        net.beginPath();
        net.moveTo(netLeft, y0);
        net.lineTo(netRight, y0);
        net.strokePath();
      }
    }

    container.add(net);

    // Рама ворот
    const frame = scene.add.graphics();
    const mainThickness =
      style === 'carbon' ? 5 * this.scale :
      style === 'industrial' ? 4 * this.scale :
      style === 'organic' ? 5 * this.scale :
      4 * this.scale;

    frame.lineStyle(mainThickness, frameColor, 1);
    frame.beginPath();

    if (isTop) {
      frame.moveTo(-goalWidth / 2, 0);
      frame.lineTo(-goalWidth / 2, -goalDepth);
      frame.lineTo(goalWidth / 2, -goalDepth);
      frame.lineTo(goalWidth / 2, 0);
    } else {
      frame.moveTo(-goalWidth / 2, 0);
      frame.lineTo(-goalWidth / 2, goalDepth);
      frame.lineTo(goalWidth / 2, goalDepth);
      frame.lineTo(goalWidth / 2, 0);
    }
    frame.strokePath();

    // Линия ворот по линии поля
    frame.lineStyle(2 * this.scale, 0xffffff, style === 'carbon' ? 0.95 : 0.75);
    frame.beginPath();
    frame.moveTo(-goalWidth / 2, 0);
    frame.lineTo(goalWidth / 2, 0);
    frame.strokePath();

    // Внешнее лёгкое свечение для неона и органического стиля
    if (style === 'neon' || style === 'organic') {
      const glowIntensity = this.arena?.glowIntensity || 1.0;
      frame.lineStyle(7 * this.scale, frameColor, 0.25 * glowIntensity);
      frame.beginPath();
      frame.moveTo(-goalWidth / 2, 0);
      frame.lineTo(goalWidth / 2, 0);
      frame.strokePath();
    }

    // Красная линия в глубине ворот для Elite Carbon / Void
    if (style === 'carbon') {
      const accentColor = this.arena?.id === 'void' ? 0x9d00ff : 0xff0040;
      const backY = isTop ? startY : startY + goalDepth;
      frame.lineStyle(3 * this.scale, accentColor, 0.9);
      frame.beginPath();
      frame.moveTo(-goalWidth / 2, backY);
      frame.lineTo(goalWidth / 2, backY);
      frame.strokePath();
    }

    container.add(frame);

    // Лёгкая тень от ворот на поле
    const shadow = scene.add.graphics();
    const shadowWidth = goalWidth * 1.1;
    const shadowHeight = 18 * this.scale;
    shadow.fillStyle(0x000000, 0.6);
    shadow.fillEllipse(0, dir * (shadowHeight * 0.8), shadowWidth, shadowHeight);
    shadow.setAlpha(style === 'neon' ? 0.7 : 0.9);
    shadow.setDepth(-1);
    container.add(shadow);

    return { side, container, frame, net };
  }

  /** Анимация «удара в штангу» — мнущиеся ворота */
  playGoalPostHit(side: GoalSide, intensity: number): void {
    const goal = side === 'top' ? this.topGoal : this.bottomGoal;
    if (!goal) return;

    const clamped = Phaser.Math.Clamp(intensity, 0, 1);
    const scaleAmount = 1 + 0.05 * clamped;
    const duration = 120 + 100 * clamped;

    this.scene.tweens.add({
      targets: goal.container,
      scaleX: scaleAmount,
      scaleY: scaleAmount,
      yoyo: true,
      duration,
      ease: 'Quad.easeOut'
    });

    this.scene.tweens.add({
      targets: goal.net,
      alpha: { from: goal.net.alpha, to: Math.min(1, goal.net.alpha + 0.3) },
      yoyo: true,
      duration,
      ease: 'Sine.easeOut'
    });
    
    // Дополнительная вспышка цвета арены при ударе
    if (this.arena) {
      const flash = this.scene.add.graphics();
      flash.setDepth(10);
      
      const goalY = side === 'top' ? this.bounds.top : this.bounds.bottom;
      const goalWidth = GOAL.WIDTH * this.scale;
      
      flash.fillStyle(this.arena.lineColor, 0.5 * clamped);
      flash.fillRect(
        this.bounds.centerX - goalWidth / 2 - 10,
        goalY - 20,
        goalWidth + 20,
        40
      );
      
      this.scene.tweens.add({
        targets: flash,
        alpha: 0,
        duration: duration * 2,
        onComplete: () => flash.destroy()
      });
    }
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
    const intensity = (effect.glowIntensity || 0.2) * (this.arena?.glowIntensity || 1.0);

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
    const intensity = (effect.glowIntensity || 0.5) * (this.arena?.glowIntensity || 1.0);

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
    
    this.arenaBackground?.destroy();
    this.arenaVignette?.destroy();

    this.topGoal?.container.destroy(true);
    this.bottomGoal?.container.destroy(true);
    this.topGoal = undefined;
    this.bottomGoal = undefined;
  }
}