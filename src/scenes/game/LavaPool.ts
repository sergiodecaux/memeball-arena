// src/scenes/game/LavaPool.ts
// ✅ ИЗМЕНЕНО: Полная переработка на "жидкую" лаву с vertex animation

import Phaser from 'phaser';
import { ABILITY_CONFIG, COLLISION_CATEGORIES, FACTIONS } from '../../constants/gameConstants';

interface LavaVertex {
  baseAngle: number;
  baseRadius: number;
  phaseOffset: number;
  amplitude: number;
  frequency: number;
}

export class LavaPool {
  public readonly id: string;
  public duration: number;
  
  private scene: Phaser.Scene;
  private x: number;
  private y: number;
  private radius: number;
  
  public sensor: MatterJS.BodyType;
  
  // Layers (от нижнего к верхнему)
  private glowLayer: Phaser.GameObjects.Graphics;      // Подложка свечения
  private mainLayer: Phaser.GameObjects.Graphics;      // Основная масса
  private coreLayer: Phaser.GameObjects.Graphics;      // Яркое ядро
  private surfaceLayer: Phaser.GameObjects.Graphics;   // Поверхностные детали
  
  // Particle emitters
  private bubbleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  
  // Animation state
  private time: number = 0;
  private spawnProgress: number = 0;
  private isSpawning: boolean = true;
  private isDying: boolean = false;
  private deathProgress: number = 0;
  
  // Vertex data для жидкой анимации
  private outerVertices: LavaVertex[] = [];
  private middleVertices: LavaVertex[] = [];
  private innerVertices: LavaVertex[] = [];
  
  // Цвета
  private readonly COLOR_GLOW = 0xff2200;
  private readonly COLOR_OUTER = 0xff4400;
  private readonly COLOR_MAIN = 0xff6600;
  private readonly COLOR_CORE = 0xffaa00;
  private readonly COLOR_HOT = 0xffdd44;
  
  // Конфигурация
  private readonly VERTEX_COUNT = 24;           // Количество вершин многоугольника
  private readonly WAVE_SPEED = 0.03;           // Скорость волн
  private readonly SPAWN_DURATION = 400;        // ms
  private readonly DEATH_DURATION = 300;        // ms

  constructor(scene: Phaser.Scene, x: number, y: number, id: string, radius?: number) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.id = id;
    this.radius = radius || ABILITY_CONFIG.MAGMA_LAVA_RADIUS;
    this.duration = ABILITY_CONFIG.MAGMA_LAVA_DURATION;

    this.initializeVertices();
    this.createTextures();
    this.createPhysics();
    this.createLayers();
    this.createParticles();
    this.startSpawnAnimation();
  }

  /**
   * Инициализация вершин для жидкой анимации
   */
  private initializeVertices(): void {
    // Внешний контур
    for (let i = 0; i < this.VERTEX_COUNT; i++) {
      const angle = (i / this.VERTEX_COUNT) * Math.PI * 2;
      this.outerVertices.push({
        baseAngle: angle,
        baseRadius: this.radius,
        phaseOffset: Math.random() * Math.PI * 2,
        amplitude: 3 + Math.random() * 4,  // 3-7 пикселей колебания
        frequency: 0.8 + Math.random() * 0.4,  // Разная частота
      });
    }

    // Средний слой (меньше вершин, больше амплитуда)
    const middleCount = Math.floor(this.VERTEX_COUNT * 0.75);
    for (let i = 0; i < middleCount; i++) {
      const angle = (i / middleCount) * Math.PI * 2;
      this.middleVertices.push({
        baseAngle: angle,
        baseRadius: this.radius * 0.65,
        phaseOffset: Math.random() * Math.PI * 2,
        amplitude: 4 + Math.random() * 5,
        frequency: 1.0 + Math.random() * 0.5,
      });
    }

    // Внутреннее ядро (ещё меньше, ещё активнее)
    const innerCount = Math.floor(this.VERTEX_COUNT * 0.5);
    for (let i = 0; i < innerCount; i++) {
      const angle = (i / innerCount) * Math.PI * 2;
      this.innerVertices.push({
        baseAngle: angle,
        baseRadius: this.radius * 0.35,
        phaseOffset: Math.random() * Math.PI * 2,
        amplitude: 2 + Math.random() * 3,
        frequency: 1.5 + Math.random() * 0.5,
      });
    }
  }

  /**
   * Создание процедурных текстур для частиц
   */
  private createTextures(): void {
    // Текстура пузырька
    if (!this.scene.textures.exists('vfx_lava_bubble')) {
      const size = 16;
      const canvas = this.scene.textures.createCanvas('vfx_lava_bubble', size, size);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, 'rgba(255, 221, 68, 1)');
      grad.addColorStop(0.3, 'rgba(255, 170, 0, 0.9)');
      grad.addColorStop(0.7, 'rgba(255, 102, 0, 0.5)');
      grad.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
      canvas!.refresh();
    }

    // Текстура искры
    if (!this.scene.textures.exists('vfx_lava_spark')) {
      const size = 8;
      const canvas = this.scene.textures.createCanvas('vfx_lava_spark', size, size);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, 'rgba(255, 255, 200, 1)');
      grad.addColorStop(0.5, 'rgba(255, 200, 50, 0.8)');
      grad.addColorStop(1, 'rgba(255, 100, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
      canvas!.refresh();
    }

    // Текстура дыма
    if (!this.scene.textures.exists('vfx_lava_smoke')) {
      const size = 32;
      const canvas = this.scene.textures.createCanvas('vfx_lava_smoke', size, size);
      const ctx = canvas!.getContext();
      const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      grad.addColorStop(0, 'rgba(80, 40, 20, 0.4)');
      grad.addColorStop(0.5, 'rgba(60, 30, 15, 0.2)');
      grad.addColorStop(1, 'rgba(40, 20, 10, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
      ctx.fill();
      canvas!.refresh();
    }
  }

  private createPhysics(): void {
    this.sensor = this.scene.matter.add.circle(this.x, this.y, this.radius, {
      isSensor: true,
      isStatic: true,
      label: `lava_${this.id}`,
      collisionFilter: {
        category: COLLISION_CATEGORIES.LAVA,
        mask: COLLISION_CATEGORIES.CAP | COLLISION_CATEGORIES.BALL,
      },
    });
  }

  /**
   * Создание графических слоёв
   */
  private createLayers(): void {
    // Слой 1: Внешнее свечение (самый нижний)
    this.glowLayer = this.scene.add.graphics();
    this.glowLayer.setDepth(5);
    this.glowLayer.setBlendMode(Phaser.BlendModes.ADD);
    this.glowLayer.setAlpha(0);

    // Слой 2: Основная масса лавы
    this.mainLayer = this.scene.add.graphics();
    this.mainLayer.setDepth(6);
    this.mainLayer.setAlpha(0);

    // Слой 3: Яркое ядро
    this.coreLayer = this.scene.add.graphics();
    this.coreLayer.setDepth(7);
    this.coreLayer.setBlendMode(Phaser.BlendModes.ADD);
    this.coreLayer.setAlpha(0);

    // Слой 4: Поверхностные детали (блики, трещины)
    this.surfaceLayer = this.scene.add.graphics();
    this.surfaceLayer.setDepth(8);
    this.surfaceLayer.setBlendMode(Phaser.BlendModes.ADD);
    this.surfaceLayer.setAlpha(0);
  }

  /**
   * Создание систем частиц
   */
  private createParticles(): void {
    // Пузырьки - всплывают из лавы
    this.bubbleEmitter = this.scene.add.particles(this.x, this.y, 'vfx_lava_bubble', {
      speed: { min: 15, max: 40 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.9, end: 0 },
      lifespan: { min: 600, max: 1200 },
      frequency: 150,
      quantity: 1,
      blendMode: 'ADD',
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, this.radius * 0.6),
      },
      angle: { min: -110, max: -70 },
      gravityY: -20,
    });
    this.bubbleEmitter.setDepth(9);
    this.bubbleEmitter.stop();

    // Искры - вылетают вверх
    this.sparkEmitter = this.scene.add.particles(this.x, this.y, 'vfx_lava_spark', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 300, max: 600 },
      frequency: 400,
      quantity: 1,
      blendMode: 'ADD',
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, this.radius * 0.4),
      },
      angle: { min: -120, max: -60 },
      gravityY: 50,
    });
    this.sparkEmitter.setDepth(10);
    this.sparkEmitter.stop();

    // Дым - медленно поднимается
    this.smokeEmitter = this.scene.add.particles(this.x, this.y, 'vfx_lava_smoke', {
      speed: { min: 5, max: 15 },
      scale: { start: 0.3, end: 1.2 },
      alpha: { start: 0.3, end: 0 },
      lifespan: { min: 1500, max: 2500 },
      frequency: 300,
      quantity: 1,
      blendMode: 'NORMAL',
      emitZone: {
        type: 'random',
        source: new Phaser.Geom.Circle(0, 0, this.radius * 0.5),
      },
      angle: { min: -100, max: -80 },
      rotate: { min: 0, max: 360 },
    });
    this.smokeEmitter.setDepth(11);
    this.smokeEmitter.stop();
  }

  /**
   * Анимация появления
   */
  private startSpawnAnimation(): void {
    this.isSpawning = true;
    this.spawnProgress = 0;

    // Звук появления
    try {
      (window as any).AudioManager?.getInstance?.()?.playSFX?.('sfx_lava_spawn');
    } catch {}

    // Эффект вспышки при появлении
    const flash = this.scene.add.circle(this.x, this.y, this.radius * 0.5, 0xffff00, 0.8);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(12);
    
    this.scene.tweens.add({
      targets: flash,
      scale: 3,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Вычисление позиции вершины с волновой анимацией
   */
  private getVertexPosition(vertex: LavaVertex, scale: number = 1): { x: number; y: number } {
    const wave = Math.sin(this.time * vertex.frequency + vertex.phaseOffset);
    const radius = (vertex.baseRadius + wave * vertex.amplitude) * scale;
    
    // Добавляем небольшое вращение всей формы
    const rotationOffset = Math.sin(this.time * 0.5) * 0.05;
    const angle = vertex.baseAngle + rotationOffset;
    
    return {
      x: this.x + Math.cos(angle) * radius,
      y: this.y + Math.sin(angle) * radius,
    };
  }

  /**
   * Отрисовка жидкого многоугольника
   */
  private drawLiquidShape(
    graphics: Phaser.GameObjects.Graphics,
    vertices: LavaVertex[],
    fillColor: number,
    fillAlpha: number,
    strokeColor?: number,
    strokeWidth?: number,
    scale: number = 1
  ): void {
    if (vertices.length < 3) return;

    const points: Phaser.Math.Vector2[] = [];
    
    for (const vertex of vertices) {
      const pos = this.getVertexPosition(vertex, scale);
      points.push(new Phaser.Math.Vector2(pos.x, pos.y));
    }

    // Рисуем с помощью кривых Безье для плавности
    graphics.beginPath();
    
    // Начинаем с первой точки
    const first = points[0];
    graphics.moveTo(first.x, first.y);

    // Проходим через все точки, используя квадратичные кривые
    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const nextNext = points[(i + 2) % points.length];
      
      // Контрольная точка - середина между next и nextNext
      const cpX = (current.x + next.x) / 2;
      const cpY = (current.y + next.y) / 2;
      
      graphics.lineTo(cpX, cpY);
    }

    graphics.closePath();

    // Заливка
    if (fillAlpha > 0) {
      graphics.fillStyle(fillColor, fillAlpha);
      graphics.fillPath();
    }

    // Обводка
    if (strokeColor !== undefined && strokeWidth !== undefined) {
      graphics.lineStyle(strokeWidth, strokeColor, 1);
      graphics.strokePath();
    }
  }

  /**
   * Отрисовка свечения (градиентные круги)
   */
  private drawGlow(): void {
    this.glowLayer.clear();
    
    const scale = this.getAnimationScale();
    const alpha = this.getAnimationAlpha();

    // Внешнее мягкое свечение
    const glowRadius = this.radius * 1.4 * scale;
    const steps = 5;
    
    for (let i = steps; i >= 0; i--) {
      const t = i / steps;
      const r = glowRadius * (0.7 + t * 0.3);
      const a = (1 - t) * 0.15 * alpha;
      
      this.glowLayer.fillStyle(this.COLOR_GLOW, a);
      this.glowLayer.fillCircle(this.x, this.y, r);
    }

    // Пульсирующее кольцо
    const pulseRadius = this.radius * (1.1 + Math.sin(this.time * 2) * 0.1) * scale;
    this.glowLayer.lineStyle(2, this.COLOR_CORE, 0.3 * alpha);
    this.glowLayer.strokeCircle(this.x, this.y, pulseRadius);
  }

  /**
   * Отрисовка основной массы лавы
   */
  private drawMainBody(): void {
    this.mainLayer.clear();
    
    const scale = this.getAnimationScale();
    const alpha = this.getAnimationAlpha();

    // Внешний контур (тёмный)
    this.drawLiquidShape(
      this.mainLayer,
      this.outerVertices,
      this.COLOR_OUTER,
      0.9 * alpha,
      0x331100,
      2,
      scale
    );

    // Средний слой (основной цвет)
    this.drawLiquidShape(
      this.mainLayer,
      this.middleVertices,
      this.COLOR_MAIN,
      0.85 * alpha,
      undefined,
      undefined,
      scale
    );
  }

  /**
   * Отрисовка яркого ядра
   */
  private drawCore(): void {
    this.coreLayer.clear();
    
    const scale = this.getAnimationScale();
    const alpha = this.getAnimationAlpha();

    // Внутреннее ядро
    this.drawLiquidShape(
      this.coreLayer,
      this.innerVertices,
      this.COLOR_CORE,
      0.7 * alpha,
      undefined,
      undefined,
      scale
    );

    // Горячая точка в центре
    const hotspotPulse = 0.8 + Math.sin(this.time * 3) * 0.2;
    const hotspotRadius = this.radius * 0.15 * scale * hotspotPulse;
    
    this.coreLayer.fillStyle(this.COLOR_HOT, 0.6 * alpha);
    this.coreLayer.fillCircle(this.x, this.y, hotspotRadius);
  }

  /**
   * Отрисовка поверхностных деталей
   */
  private drawSurface(): void {
    this.surfaceLayer.clear();
    
    const scale = this.getAnimationScale();
    const alpha = this.getAnimationAlpha();

    // Мерцающие "трещины" на поверхности
    const crackCount = 5;
    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + this.time * 0.3;
      const innerR = this.radius * 0.2 * scale;
      const outerR = this.radius * (0.5 + Math.sin(this.time * 2 + i) * 0.15) * scale;
      
      const x1 = this.x + Math.cos(angle) * innerR;
      const y1 = this.y + Math.sin(angle) * innerR;
      const x2 = this.x + Math.cos(angle) * outerR;
      const y2 = this.y + Math.sin(angle) * outerR;
      
      const crackAlpha = (0.3 + Math.sin(this.time * 4 + i * 1.5) * 0.2) * alpha;
      this.surfaceLayer.lineStyle(1.5, this.COLOR_HOT, crackAlpha);
      this.surfaceLayer.lineBetween(x1, y1, x2, y2);
    }

    // Блики на поверхности
    const highlightCount = 3;
    for (let i = 0; i < highlightCount; i++) {
      const t = this.time * 0.5 + i * 2;
      const angle = t % (Math.PI * 2);
      const distance = this.radius * (0.3 + Math.sin(t * 0.7) * 0.2) * scale;
      
      const hx = this.x + Math.cos(angle) * distance;
      const hy = this.y + Math.sin(angle) * distance;
      const hRadius = 3 + Math.sin(t * 2) * 2;
      
      this.surfaceLayer.fillStyle(0xffffff, 0.4 * alpha);
      this.surfaceLayer.fillCircle(hx, hy, hRadius);
    }
  }

  /**
   * Получение масштаба для анимации появления/исчезновения
   */
  private getAnimationScale(): number {
    if (this.isSpawning) {
      // Elastic ease out
      const t = this.spawnProgress;
      const c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
    
    if (this.isDying) {
      return 1 - this.deathProgress;
    }
    
    return 1;
  }

  /**
   * Получение прозрачности для анимации
   */
  private getAnimationAlpha(): number {
    if (this.isSpawning) {
      return Math.min(1, this.spawnProgress * 2);
    }
    
    if (this.isDying) {
      return 1 - this.deathProgress;
    }
    
    // Затухание при малом duration
    if (this.duration <= 1) {
      return 0.6;
    }
    
    return 1;
  }

  /**
   * Обновление лавы (вызывается каждый кадр)
   */
  public update(delta: number = 16): void {
    this.time += this.WAVE_SPEED;

    // Обновление анимации появления
    if (this.isSpawning) {
      this.spawnProgress += delta / this.SPAWN_DURATION;
      if (this.spawnProgress >= 1) {
        this.spawnProgress = 1;
        this.isSpawning = false;
        
        // Включаем частицы после появления
        this.bubbleEmitter?.start();
        this.sparkEmitter?.start();
        this.smokeEmitter?.start();
      }
      
      // Обновляем альфу слоёв
      const alpha = this.getAnimationAlpha();
      this.glowLayer.setAlpha(alpha);
      this.mainLayer.setAlpha(alpha);
      this.coreLayer.setAlpha(alpha);
      this.surfaceLayer.setAlpha(alpha);
    }

    // Обновление анимации смерти
    if (this.isDying) {
      this.deathProgress += delta / this.DEATH_DURATION;
      if (this.deathProgress >= 1) {
        this.finalDestroy();
        return;
      }
    }

    // Перерисовка всех слоёв
    this.drawGlow();
    this.drawMainBody();
    this.drawCore();
    this.drawSurface();
  }

  /**
   * Уменьшение длительности (вызывается при смене хода)
   */
  public decrementDuration(): void {
    this.duration--;
    
    // Визуальное угасание
    if (this.duration <= 1) {
      // Замедляем частицы
      if (this.bubbleEmitter) {
        this.bubbleEmitter.frequency = 300;
      }
      if (this.sparkEmitter) {
        this.sparkEmitter.frequency = 800;
      }
    }
  }

  /**
   * Проверка: истекла ли лужа
   */
  public isExpired(): boolean {
    return this.duration <= 0;
  }

  /**
   * Получение позиции
   */
  public getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /**
   * Получение радиуса
   */
  public getRadius(): number {
    return this.radius;
  }

  /**
   * Проверка: находится ли точка внутри лавы
   */
  public containsPoint(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.sqrt(dx * dx + dy * dy) <= this.radius;
  }

  /**
   * Применение эффекта вязкости к объекту
   */
  public applyViscosity(body: MatterJS.BodyType): void {
    if (!body.velocity) return;
    
    // Замедление (0.92 как в ТЗ)
    const viscosity = 0.92;
    
    this.scene.matter.body.setVelocity(body, {
      x: body.velocity.x * viscosity,
      y: body.velocity.y * viscosity,
    });
    
    // Небольшое вращение (эффект затягивания)
    const toCenter = {
      x: this.x - body.position.x,
      y: this.y - body.position.y,
    };
    const dist = Math.sqrt(toCenter.x * toCenter.x + toCenter.y * toCenter.y);
    
    if (dist > 5) {
      const pullStrength = 0.0005;
      this.scene.matter.body.applyForce(body, body.position, {
        x: toCenter.x * pullStrength,
        y: toCenter.y * pullStrength,
      });
    }
  }

  /**
   * Уничтожение лужи (с анимацией)
   */
  public destroy(): void {
    if (this.isDying) return;
    
    this.isDying = true;
    this.deathProgress = 0;

    // Останавливаем частицы
    this.bubbleEmitter?.stop();
    this.sparkEmitter?.stop();
    this.smokeEmitter?.stop();

    // Финальная вспышка
    const flash = this.scene.add.circle(this.x, this.y, this.radius * 0.3, 0xffaa00, 0.6);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(12);
    
    this.scene.tweens.add({
      targets: flash,
      scale: 2,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Финальное удаление всех объектов
   */
  private finalDestroy(): void {
    this.glowLayer.destroy();
    this.mainLayer.destroy();
    this.coreLayer.destroy();
    this.surfaceLayer.destroy();
    
    this.bubbleEmitter?.destroy();
    this.sparkEmitter?.destroy();
    this.smokeEmitter?.destroy();
    
    this.scene.matter.world.remove(this.sensor);
  }
}