// src/renderers/FieldRenderer.ts

import Phaser from 'phaser';
import { FIELD, GOAL, FactionArena, FactionId } from '../constants/gameConstants';
import { FieldBounds } from '../types';
import { getFieldSkin, FieldSkinData } from '../data/SkinsCatalog';
import { playerData } from '../data/PlayerData';

type GoalSide = 'top' | 'bottom';
type FieldStyle = 'neon' | 'industrial' | 'carbon' | 'organic' | 'generic';

interface GoalVisual {
  side: GoalSide;
  container: Phaser.GameObjects.Container;
  frame: Phaser.GameObjects.Graphics;
  net: Phaser.GameObjects.Graphics;
  forceField?: Phaser.GameObjects.Graphics;
}

interface ArenaAssets {
  floor: string;
  wallStraight: string;
  wallCorner: string;
  glowColor: number;
  ambientColor: number;
}

// === ЛОГИЧЕСКИЕ РАЗМЕРЫ (НЕ PNG) ===
const WALL_THICKNESS = 64;
const CORNER_SIZE = 64;
const TILE_SCALE = 0.5;

export class FieldRenderer {
  private scene: Phaser.Scene;
  private bounds: FieldBounds;
  private scale: number;
  private skin: FieldSkinData;

  private arena?: FactionArena;
  private factionId?: FactionId;

  private floorTile?: Phaser.GameObjects.TileSprite;
  private wallElements: Phaser.GameObjects.GameObject[] = [];
  private fieldGraphics!: Phaser.GameObjects.Graphics;

  private centerScan?: Phaser.GameObjects.Rectangle;

  private topGoal?: GoalVisual;
  private bottomGoal?: GoalVisual;

  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private cornerPulseTweens: Phaser.Tweens.Tween[] = [];
  
  // Твин пульсации самой разметки
  private markingsPulseTween?: Phaser.Tweens.Tween;

  // FX разметки Cyborg
  private cyborgMarkingFx: Phaser.GameObjects.GameObject[] = [];

  private hasModularAssets = false;
  private hasArenaBackground = false;

  private static readonly DEFAULT_SKIN: FieldSkinData = {
    id: 'field_default',
    name: 'Classic',
    rarity: 'basic',
    price: {},
    style: 'neon',
    fieldColor: 0x1a1a2e,
    lineColor: 0xffffff,
    borderColor: 0x00f2ff,
    goalColor: 0xffffff,
    goalFrameColor: 0xffffff,
    goalNetColor: 0xffffff,
    goalDepthMultiplier: 1,
  };

  private static readonly ARENA_ASSETS: Record<FactionId, ArenaAssets> = {
    cyborg: {
      floor: 'cyborg_floor',
      wallStraight: 'cyborg_wall_straight',
      wallCorner: 'cyborg_wall_corner',
      glowColor: 0x00ffff,
      ambientColor: 0x001830,
    },
    magma: {
      floor: 'magma_floor',
      wallStraight: 'magma_wall_straight',
      wallCorner: 'magma_wall_corner',
      glowColor: 0xff4500, // Оранжевый/Огненный
      ambientColor: 0x1a0800,
    },
    void: {
      floor: 'void_floor',
      wallStraight: 'void_wall_straight',
      wallCorner: 'void_wall_corner',
      glowColor: 0x9d00ff,
      ambientColor: 0x0a0015,
    },
    insect: {
      floor: 'insect_floor',
      wallStraight: 'insect_wall_straight',
      wallCorner: 'insect_wall_corner',
      glowColor: 0x39ff14,
      ambientColor: 0x001a08,
    },
  };

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

    if (arena) {
      this.factionId = arena.id;
    }

    const effectiveSkinId =
      skinId || playerData.get().equippedFieldSkin || 'field_default';
    this.skin = getFieldSkin(effectiveSkinId) || FieldRenderer.DEFAULT_SKIN;

    if (arena) {
      this.skin = {
        ...this.skin,
        fieldColor: arena.ambientColor,
        lineColor: arena.lineColor,
        borderColor: arena.borderColor,
        goalColor: arena.goalColor,
        goalFrameColor: arena.goalColor,
        goalNetColor: arena.lineColor,
        style: arena.style as FieldStyle,
      };
    }

    this.fieldGraphics = scene.add.graphics();
    this.checkAssets();
  }

  private checkAssets(): void {
    const { scene } = this;

    if (this.arena) {
      this.hasArenaBackground = scene.textures.exists(this.arena.assetKey);
      console.log(
        `[FieldRenderer] Arena background '${this.arena.assetKey}': ${this.hasArenaBackground}`
      );
    }

    if (this.factionId && FieldRenderer.ARENA_ASSETS[this.factionId]) {
      const assets = FieldRenderer.ARENA_ASSETS[this.factionId];
      this.hasModularAssets =
        scene.textures.exists(assets.floor) &&
        scene.textures.exists(assets.wallStraight) &&
        scene.textures.exists(assets.wallCorner);

      // Если есть арт поля field_<faction>.png — не смешиваем с модульным полом/стенами
      // (иначе тайлы перекрывают PNG; у киборгов это уже было задано отдельно).
      if (this.hasArenaBackground) {
        this.hasModularAssets = false;
      }

      console.log(
        `[FieldRenderer] Modular assets for '${this.factionId}': ${this.hasModularAssets}`
      );
    }
  }

  render(): void {
    console.log('[FieldRenderer] Rendering arena...');

    // 🔹 СПЕЦИАЛЬНО ДЛЯ CYBORG:
    if (this.factionId === 'cyborg') {
      this.createBackground();           // -10: field_cyborg.png
      this.drawFieldMarkings();          //  1: разметка (новая схема)
      this.createCyborgCenterScan();     //  1: сканирующий луч
      this.createGoals();                // 15
      this.createCyborgEffects();        // 20
      this.createVignette();             // 100
      this.animateMarkings(true);        // Анимация "живых" линий
      console.log('[FieldRenderer] Rendered CYBORG arena with background + markings + FX');
      return;
    }

    // === ОБЫЧНЫЙ ПАЙПЛАЙН ДЛЯ ДРУГИХ ФРАКЦИЙ ===
    this.createBackground();         // -10
    this.createFloor();              // 0
    this.drawFieldMarkings();        // 1
    this.createPerimeterWalls();     // 10
    this.createGoals();              // 15
    this.createAtmosphericEffects(); // 20
    this.createVignette();           // 100
    this.animateMarkings(false);     // Анимация "живых" линий

    console.log('[FieldRenderer] Arena rendered successfully');
  }

  // ==================== BACKGROUND ====================

  private createBackground(): void {
    const { scene } = this;
    const { width, height } = scene.scale;

    let bgColor = 0x0a0a15;
    if (this.factionId && FieldRenderer.ARENA_ASSETS[this.factionId]) {
      bgColor = FieldRenderer.ARENA_ASSETS[this.factionId].ambientColor;
    }

    const bg = scene.add.rectangle(width / 2, height / 2, width, height, bgColor);
    bg.setDepth(-10);

    if (this.hasArenaBackground && this.arena) {
      const arenaBg = scene.add.image(width / 2, height / 2, this.arena.assetKey);
      const scaleX = width / arenaBg.width;
      const scaleY = height / arenaBg.height;
      arenaBg.setScale(Math.max(scaleX, scaleY));
      arenaBg.setDepth(-9);
    }
  }

  // ==================== FLOOR (не cyborg) ====================

  private createFloor(): void {
    const { bounds, scene } = this;

    if (this.hasModularAssets && this.factionId) {
      const assets = FieldRenderer.ARENA_ASSETS[this.factionId];

      this.floorTile = scene.add.tileSprite(
        bounds.centerX,
        bounds.centerY,
        bounds.width,
        bounds.height,
        assets.floor
      );
      this.floorTile.setTileScale(TILE_SCALE);
      this.floorTile.setDepth(0);
      return;
    }

    if (this.hasArenaBackground) {
      return;
    }

    const g = scene.add.graphics();
    g.setDepth(0);

    const topColor = this.lightenColor(this.skin.fieldColor, 0.05);
    const bottomColor = this.darkenColor(this.skin.fieldColor, 0.1);

    const steps = 15;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const color = this.lerpColor(topColor, bottomColor, t);
      const y = bounds.top + (bounds.height / steps) * i;
      const h = bounds.height / steps + 1;
      g.fillStyle(color, 1);
      g.fillRect(bounds.left, y, bounds.width, h);
    }
  }

  // ==================== FIELD MARKINGS (NEW LAYOUT) ====================

  private drawFieldMarkings(): void {
    const g = this.fieldGraphics;
    const b = this.bounds;
    const { scale } = this;

    // Определяем цвет линий в зависимости от фракции или скина
    let baseColor = this.skin.lineColor;
    if (this.factionId && FieldRenderer.ARENA_ASSETS[this.factionId]) {
      baseColor = FieldRenderer.ARENA_ASSETS[this.factionId].glowColor;
    }

    const isCyborg = this.factionId === 'cyborg';
    const lineAlpha = this.hasArenaBackground || isCyborg ? 0.9 : 1.0;
    
    // Толщина линий
    const lineWidth = isCyborg ? 3 * scale : 2.5 * scale;
    const heavyLineWidth = isCyborg ? 4 * scale : 3 * scale;

    g.clear();
    g.setDepth(1);

    // Включаем режим наложения ADD для неонового эффекта, если это уместно
    if (isCyborg || this.factionId === 'magma' || this.factionId === 'void') {
       g.setBlendMode(Phaser.BlendModes.ADD);
    }

    // === ГЕОМЕТРИЯ (Схема "Magma" с картинки 2) ===
    // Пропорции, близкие к референсу
    const fieldWidth = b.width;
    const fieldHeight = b.height;

    // 1. Штрафная площадь (Большой прямоугольник)
    const penaltyWidth = fieldWidth * 0.55;  // ~55% ширины поля
    const penaltyHeight = fieldHeight * 0.16; // ~16% высоты поля

    // 2. Вратарская зона (Малый прямоугольник внутри штрафной)
    const goalAreaWidth = fieldWidth * 0.28; // ~28% ширины поля
    const goalAreaHeight = fieldHeight * 0.06; // ~6% высоты поля

    // 3. Центральный круг
    const circleRadius = fieldWidth * 0.16; // Чуть меньше, чем на стандартном поле

    // 4. Дуга штрафной
    const arcRadius = fieldWidth * 0.10;

    // 5. Угловые засечки
    const cornerSize = fieldWidth * 0.03;

    // --- РИСОВАНИЕ ---

    // Внешний контур поля (если не модульные стены или если это киберы с прозрачным фоном)
    if (!this.hasModularAssets || isCyborg) {
      g.lineStyle(heavyLineWidth, baseColor, lineAlpha);
      g.strokeRect(b.left, b.top, b.width, b.height);
    }

    // Центральная линия
    g.lineStyle(lineWidth, baseColor, lineAlpha * 0.8);
    g.lineBetween(b.left, b.centerY, b.right, b.centerY);

    // Центральный круг
    g.lineStyle(heavyLineWidth, baseColor, lineAlpha);
    g.strokeCircle(b.centerX, b.centerY, circleRadius);

    // Центральная точка
    g.fillStyle(baseColor, 1);
    g.fillCircle(b.centerX, b.centerY, 5 * scale);

    // --- ЗОНЫ (ВЕРХ / НИЗ) ---

    const drawZone = (isTop: boolean) => {
      const baseY = isTop ? b.top : b.bottom;
      const direction = isTop ? 1 : -1;
      
      // Y-координата линии штрафной
      const penaltyLineY = baseY + (penaltyHeight * direction);
      
      // Y-координата линии вратарской
      const goalAreaLineY = baseY + (goalAreaHeight * direction);

      g.lineStyle(lineWidth, baseColor, lineAlpha);

      // 1. Штрафная площадь (Большая)
      // Левая, Правая, Горизонтальная линии
      const pLeft = b.centerX - penaltyWidth / 2;
      const pRight = b.centerX + penaltyWidth / 2;
      
      // Рисуем прямоугольник от линии ворот
      g.strokeRect(pLeft, isTop ? baseY : baseY - penaltyHeight, penaltyWidth, penaltyHeight);

      // 2. Вратарская зона (Малая)
      const gLeft = b.centerX - goalAreaWidth / 2;
      
      // Рисуем малый прямоугольник
      g.strokeRect(gLeft, isTop ? baseY : baseY - goalAreaHeight, goalAreaWidth, goalAreaHeight);

      // 3. Дуга штрафной
      // Рисуем только часть дуги, выходящую за пределы штрафной
      g.beginPath();
      // Угол start/end зависит от стороны
      const startAngle = isTop ? 0 : Math.PI;
      const endAngle = isTop ? Math.PI : 0; // Для Phaser Arc (по часовой)
      // На самом деле нам нужно рисовать сегмент. 
      // Проще: полная дуга с центром на линии штрафной, ограниченная углами.
      
      g.arc(
        b.centerX, 
        penaltyLineY, 
        arcRadius, 
        isTop ? 0 : Math.PI, 
        isTop ? Math.PI : 0, 
        false
      );
      g.strokePath();

      // 4. Точка пенальти
      const spotY = baseY + (penaltyHeight * 0.7 * direction); // Точка на 70% глубины штрафной
      g.fillStyle(baseColor, 0.9);
      g.fillCircle(b.centerX, spotY, 4 * scale);
    };

    drawZone(true);  // Верх
    drawZone(false); // Низ

    // --- УГЛОВЫЕ ---
    g.lineStyle(lineWidth, baseColor, lineAlpha);
    
    // Левый верх
    g.beginPath();
    g.moveTo(b.left, b.top + cornerSize);
    g.lineTo(b.left + cornerSize, b.top);
    g.strokePath();

    // Правый верх
    g.beginPath();
    g.moveTo(b.right, b.top + cornerSize);
    g.lineTo(b.right - cornerSize, b.top);
    g.strokePath();

    // Левый низ
    g.beginPath();
    g.moveTo(b.left, b.bottom - cornerSize);
    g.lineTo(b.left + cornerSize, b.bottom);
    g.strokePath();

    // Правый низ
    g.beginPath();
    g.moveTo(b.right, b.bottom - cornerSize);
    g.lineTo(b.right - cornerSize, b.bottom);
    g.strokePath();

    // ===== ДОПОЛНИТЕЛЬНЫЕ FX ДЛЯ CYBORG =====
    if (isCyborg) {
      this.createCyborgMarkingFx(circleRadius, baseColor);
    }
  }

  // Анимация разметки (пульсация) для эффекта "живого поля"
  private animateMarkings(isHighTech: boolean): void {
    if (this.markingsPulseTween) {
      this.markingsPulseTween.stop();
    }

    // Для кибер/техно стилей пульсация более резкая, для других более плавная
    const duration = isHighTech ? 1500 : 3000;
    const minAlpha = isHighTech ? 0.7 : 0.85;

    this.markingsPulseTween = this.scene.tweens.add({
      targets: this.fieldGraphics,
      alpha: { from: 1, to: minAlpha },
      duration: duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  // Создаёт неоновые FX для разметки Cyborg (центр-круг + бегущие точки)
  private createCyborgMarkingFx(circleRadius: number, color: number): void {
    this.cyborgMarkingFx.forEach(obj => obj.destroy());
    this.cyborgMarkingFx = [];

    const b = this.bounds;
    const { scene } = this;

    // 1) Мягкое свечение вокруг центрального круга
    const centerGlow = scene.add.circle(
      b.centerX,
      b.centerY,
      circleRadius * 1.1,
      color,
      0.15
    );
    centerGlow.setDepth(1);
    centerGlow.setBlendMode(Phaser.BlendModes.ADD);

    // Добавляем glow FX если поддерживается (Phaser 3.60+)
    try {
      const fxTarget = centerGlow as any;
      if (fxTarget.preFX) {
        fxTarget.preFX.addGlow(color, 4, 0.7);
      }
    } catch {
      // ignore
    }

    scene.tweens.add({
      targets: centerGlow,
      alpha: { from: 0.1, to: 0.25 },
      scale: { from: 1, to: 1.05 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.cyborgMarkingFx.push(centerGlow);

    // 2) Бегущие точки по центровой линии (data flow effect)
    const dotRadius = 3 * this.scale;
    const dotAlpha = 0.8;

    const createDot = (delay: number) => {
      const dot = scene.add.circle(
        b.left,
        b.centerY,
        dotRadius,
        color,
        dotAlpha
      );
      dot.setDepth(1);
      dot.setBlendMode(Phaser.BlendModes.ADD);

      scene.tweens.add({
        targets: dot,
        x: { from: b.left, to: b.right },
        alpha: { from: dotAlpha, to: 0 },
        scale: { from: 1, to: 0.5 },
        duration: 2500,
        repeat: -1,
        delay,
        ease: 'Linear', // Linear для равномерного движения данных
        onRepeat: () => {
          dot.alpha = dotAlpha;
          dot.scale = 1;
        },
      });

      this.cyborgMarkingFx.push(dot);
    };

    // Запускаем 3 точки с разной задержкой
    createDot(0);
    createDot(800);
    createDot(1600);
  }

  // ==================== CYBORG CENTER SCAN ====================

  private createCyborgCenterScan(): void {
    const { scene } = this;
    if (this.factionId !== 'cyborg') return;

    const b = this.bounds;

    this.centerScan?.destroy();
    this.centerScan = undefined;

    const color = FieldRenderer.ARENA_ASSETS.cyborg.glowColor;

    const scan = scene.add.rectangle(
      b.centerX,
      b.top,
      b.width,
      15 * this.scale, // Чуть толще
      color,
      0.15
    );
    scan.setDepth(1);
    scan.setBlendMode(Phaser.BlendModes.ADD);
    this.centerScan = scan;

    scene.tweens.add({
      targets: scan,
      y: b.bottom,
      alpha: { from: 0.15, to: 0.05 }, // Затухает к краям
      duration: 3500,
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeInOut',
    });
  }

  // ==================== PERIMETER WALLS (не cyborg) ====================

  private createPerimeterWalls(): void {
    // Киборги и поля с полноэкранным PNG уже содержат борта — не рисуем второй слой
    if (this.factionId === 'cyborg' || this.hasArenaBackground) {
      return;
    }

    if (this.hasModularAssets && this.factionId) {
      this.createModularWalls();
      return;
    }

    this.createFallbackWalls();
  }

  private createModularWalls(): void {
    if (!this.factionId) return;

    const assets = FieldRenderer.ARENA_ASSETS[this.factionId];
    const b = this.bounds;
    const { scene } = this;

    const left = b.left;
    const right = b.right;
    const top = b.top;
    const bottom = b.bottom;
    const H = b.height;

    const wallThickness = WALL_THICKNESS * this.scale;
    const cornerScale = TILE_SCALE * this.scale;

    const goalWidth = GOAL.WIDTH * this.scale;
    const goalHalfWidth = goalWidth / 2;
    const gateLeftX = b.centerX - goalHalfWidth;
    const gateRightX = b.centerX + goalHalfWidth;

    const leftWall = scene.add.tileSprite(
      left,
      b.centerY,
      H,
      wallThickness,
      assets.wallStraight
    );
    leftWall
      .setTileScale(TILE_SCALE)
      .setAngle(-90)
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.wallElements.push(leftWall);

    const rightWall = scene.add.tileSprite(
      right,
      b.centerY,
      H,
      wallThickness,
      assets.wallStraight
    );
    rightWall
      .setTileScale(TILE_SCALE)
      .setAngle(90)
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.wallElements.push(rightWall);

    const topWallLeftWidth = gateLeftX - left;
    const topWallRightWidth = right - gateRightX;

    if (topWallLeftWidth > 0) {
      const topWallLeft = scene.add.tileSprite(
        left + topWallLeftWidth / 2,
        top,
        topWallLeftWidth,
        wallThickness,
        assets.wallStraight
      );
      topWallLeft
        .setTileScale(TILE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(10);
      this.wallElements.push(topWallLeft);
    }

    if (topWallRightWidth > 0) {
      const topWallRight = scene.add.tileSprite(
        right - topWallRightWidth / 2,
        top,
        topWallRightWidth,
        wallThickness,
        assets.wallStraight
      );
      topWallRight
        .setTileScale(TILE_SCALE)
        .setOrigin(0.5, 1)
        .setDepth(10);
      this.wallElements.push(topWallRight);
    }

    if (topWallLeftWidth > 0) {
      const bottomWallLeft = scene.add.tileSprite(
        left + topWallLeftWidth / 2,
        bottom,
        topWallLeftWidth,
        wallThickness,
        assets.wallStraight
      );
      bottomWallLeft
        .setTileScale(TILE_SCALE)
        .setOrigin(0.5, 0)
        .setFlipY(true)
        .setDepth(10);
      this.wallElements.push(bottomWallLeft);
    }

    if (topWallRightWidth > 0) {
      const bottomWallRight = scene.add.tileSprite(
        right - topWallRightWidth / 2,
        bottom,
        topWallRightWidth,
        wallThickness,
        assets.wallStraight
      );
      bottomWallRight
        .setTileScale(TILE_SCALE)
        .setOrigin(0.5, 0)
        .setFlipY(true)
        .setDepth(10);
      this.wallElements.push(bottomWallRight);
    }

    const overlap = 4 * this.scale;

    const cornerTL = scene.add.image(left + overlap, top + overlap, assets.wallCorner)
      .setOrigin(1, 1)
      .setScale(cornerScale)
      .setDepth(10);
    this.wallElements.push(cornerTL);

    const cornerTR = scene.add.image(right - overlap, top + overlap, assets.wallCorner)
      .setOrigin(0, 1)
      .setFlipX(true)
      .setScale(cornerScale)
      .setDepth(10);
    this.wallElements.push(cornerTR);

    const cornerBL = scene.add.image(left + overlap, bottom - overlap, assets.wallCorner)
      .setOrigin(1, 0)
      .setFlipY(true)
      .setScale(cornerScale)
      .setDepth(10);
    this.wallElements.push(cornerBL);

    const cornerBR = scene.add.image(right - overlap, bottom - overlap, assets.wallCorner)
      .setOrigin(0, 0)
      .setFlipX(true)
      .setFlipY(true)
      .setScale(cornerScale)
      .setDepth(10);
    this.wallElements.push(cornerBR);

    const corners = [cornerTL, cornerTR, cornerBL, cornerBR];
    corners.forEach((corner, index) => {
      const tween = this.scene.tweens.add({
        targets: corner,
        alpha: { from: 1, to: 0.5 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        delay: index * 200,
        ease: 'Sine.easeInOut',
      });
      this.cornerPulseTweens.push(tween);
    });

    this.applyWallGlow(assets.glowColor);
  }

  private createFallbackWalls(): void {
    const { bounds, scene, skin } = this;
    const g = scene.add.graphics();
    g.setDepth(10);

    const wallThickness = 16 * this.scale;
    const goalHalfWidth = (GOAL.WIDTH * this.scale) / 2;

    const wallColor = this.darkenColor(skin.borderColor, 0.4);
    const highlightColor = this.lightenColor(skin.borderColor, 0.1);

    g.fillStyle(wallColor, 1);
    g.fillRect(
      bounds.left - wallThickness,
      bounds.top - wallThickness,
      wallThickness,
      bounds.height + wallThickness * 2
    );
    g.fillStyle(highlightColor, 1);
    g.fillRect(bounds.left - 3, bounds.top, 3, bounds.height);

    g.fillStyle(wallColor, 1);
    g.fillRect(
      bounds.right,
      bounds.top - wallThickness,
      wallThickness,
      bounds.height + wallThickness * 2
    );
    g.fillStyle(highlightColor, 1);
    g.fillRect(bounds.right, bounds.top, 3, bounds.height);

    const topSideWidth = bounds.width / 2 - goalHalfWidth;

    g.fillStyle(wallColor, 1);
    g.fillRect(
      bounds.left - wallThickness,
      bounds.top - wallThickness,
      topSideWidth + wallThickness,
      wallThickness
    );
    g.fillRect(
      bounds.centerX + goalHalfWidth,
      bounds.top - wallThickness,
      topSideWidth + wallThickness,
      wallThickness
    );

    g.fillStyle(highlightColor, 1);
    g.fillRect(bounds.left, bounds.top - 3, topSideWidth, 3);
    g.fillRect(bounds.centerX + goalHalfWidth, bounds.top - 3, topSideWidth, 3);

    g.fillStyle(wallColor, 1);
    g.fillRect(
      bounds.left - wallThickness,
      bounds.bottom,
      topSideWidth + wallThickness,
      wallThickness
    );
    g.fillRect(
      bounds.centerX + goalHalfWidth,
      bounds.bottom,
      topSideWidth + wallThickness,
      wallThickness
    );

    g.fillStyle(highlightColor, 1);
    g.fillRect(bounds.left, bounds.bottom, topSideWidth, 3);
    g.fillRect(bounds.centerX + goalHalfWidth, bounds.bottom, topSideWidth, 3);

    g.lineStyle(2, skin.borderColor, 0.7);
    g.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
  }

  // ==================== FX / VIGNETTE ====================

  private applyWallGlow(glowColor: number): void {
    this.wallElements.forEach((element) => {
      if (
        element instanceof Phaser.GameObjects.Image ||
        element instanceof Phaser.GameObjects.TileSprite
      ) {
        try {
          const fxTarget = element as any;
          if (fxTarget.preFX) {
            fxTarget.preFX.addGlow(glowColor, 2, 0.5);
          }
        } catch {
          // ignore
        }
      }
    });
  }

  private createGoals(): void {
    this.topGoal = this.createGoalVisual('top');
    this.bottomGoal = this.createGoalVisual('bottom');
  }

  private createGoalVisual(side: GoalSide): GoalVisual {
    const { bounds, scene, skin } = this;

    const isTop = side === 'top';
    const x = bounds.centerX;
    const y = isTop ? bounds.top : bounds.bottom;

    const goalWidth = GOAL.WIDTH * this.scale;
    const goalDepth = GOAL.DEPTH * this.scale * (skin.goalDepthMultiplier ?? 1);
    const postWidth = 6 * this.scale;

    const container = scene.add.container(x, y);
    container.setDepth(15);

    const frame = scene.add.graphics();
    const startY = isTop ? -goalDepth : 0;
    const endY = isTop ? 0 : goalDepth;

    const frameColor = skin.goalFrameColor || skin.goalColor;
    const darkColor = this.darkenColor(frameColor, 0.5);

    frame.fillStyle(darkColor, 1);
    frame.fillRect(-goalWidth / 2, startY, goalWidth, goalDepth);

    frame.fillStyle(frameColor, 1);
    frame.fillRect(-goalWidth / 2 - postWidth, startY, postWidth, goalDepth);
    frame.fillRect(goalWidth / 2, startY, postWidth, goalDepth);

    const barY = isTop ? startY : endY - postWidth;
    frame.fillRect(-goalWidth / 2 - postWidth, barY, goalWidth + postWidth * 2, postWidth);

    frame.fillStyle(0xffffff, 1);
    frame.fillRect(-goalWidth / 2, isTop ? -2 : 0, goalWidth, 3);

    container.add(frame);

    const net = scene.add.graphics();
    const netAlpha = 0.3;
    const netStep = 7 * this.scale;
    const pad = 3 * this.scale;

    net.lineStyle(1, 0xffffff, netAlpha);

    const netLeft = -goalWidth / 2 + pad;
    const netRight = goalWidth / 2 - pad;
    const netTop = startY + pad;
    const netBottom = isTop ? -pad : goalDepth - pad;

    for (let nx = netLeft; nx <= netRight; nx += netStep) {
      net.beginPath();
      net.moveTo(nx, netTop);
      net.lineTo(nx, netBottom);
      net.strokePath();
    }

    const step = isTop ? -netStep : netStep;
    for (let ny = netTop; isTop ? ny >= netBottom : ny <= netBottom; ny += step) {
      net.beginPath();
      net.moveTo(netLeft, ny);
      net.lineTo(netRight, ny);
      net.strokePath();
    }

    container.add(net);

    let forceField: Phaser.GameObjects.Graphics | undefined;
    if (this.factionId === 'cyborg' || this.factionId === 'void') {
      forceField = scene.add.graphics();
      const ffColor =
        FieldRenderer.ARENA_ASSETS[this.factionId ?? 'cyborg']?.glowColor || 0x00ffff;
      forceField.fillStyle(ffColor, 0.08);
      forceField.fillRect(-goalWidth / 2, startY, goalWidth, goalDepth);
      container.add(forceField);

      scene.tweens.add({
        targets: forceField,
        alpha: { from: 0.05, to: 0.15 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    return { side, container, frame, net, forceField };
  }

  private createAtmosphericEffects(): void {
    if (!this.factionId) return;

    // Вместо просто стиля, проверяем ID фракции для более точного выбора эффектов
    if (this.factionId === 'magma') {
        this.createMagmaEffects();
    } else if (this.factionId === 'void') {
        this.createVoidEffects();
    } else if (this.factionId === 'insect') {
        this.createInsectEffects();
    } else {
        // Fallback по стилю
        const style = this.getFieldStyle();
        if (style === 'neon') this.createCyborgEffects();
        else if (style === 'industrial') this.createMagmaEffects();
    }
  }

  private createCyborgEffects(): void {
    const { scene, bounds } = this;
    if (!scene.textures.exists('p_glow')) return;

    // Мелкие светящиеся частицы по полю (данные/глитч)
    const emitter = scene.add.particles(bounds.centerX, bounds.centerY, 'p_glow', {
      x: {
        min: bounds.left - bounds.centerX + 30,
        max: bounds.right - bounds.centerX - 30,
      },
      y: {
        min: bounds.top - bounds.centerY + 30,
        max: bounds.bottom - bounds.centerY - 30,
      },
      speed: { min: 5, max: 20 },
      scale: { start: 0.12, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 2500,
      frequency: 200,
      tint: [0x00ffff, 0x0088ff, 0xffffff],
      blendMode: 'ADD',
    });
    emitter.setDepth(20);
    this.particleEmitters.push(emitter);

    // Редкий диагональный sweep-блик (как блик на стекле)
    const sweepEmitter = scene.add.particles(bounds.left - 60, bounds.bottom + 60, 'p_glow', {
      speed: { min: 200, max: 250 },
      angle: { min: -55, max: -35 },
      scale: { start: 0.6, end: 0.1 },
      alpha: { start: 0.3, end: 0 },
      lifespan: 1500,
      quantity: 1,
      frequency: 6000, // Очень редко
      tint: [0x00ffff, 0x0088ff],
      blendMode: 'ADD',
    });
    sweepEmitter.setDepth(20);
    this.particleEmitters.push(sweepEmitter);
  }

  private createMagmaEffects(): void {
    const { scene, bounds } = this;
    if (!scene.textures.exists('p_spark')) return;

    // 1. Угольки, летящие снизу вверх
    const emitter = scene.add.particles(bounds.centerX, bounds.bottom + 50, 'p_spark', {
      x: { min: bounds.left - bounds.centerX, max: bounds.right - bounds.centerX },
      speedY: { min: -50, max: -100 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: 2000,
      frequency: 150,
      tint: [0xff4500, 0xff6600, 0xffff00], // Огонь
      blendMode: 'ADD',
    });

    emitter.setDepth(20);
    this.particleEmitters.push(emitter);

    // 2. Тепловое искажение (имитация через частицы дыма)
    if (scene.textures.exists('p_smoke')) {
        const heatEmitter = scene.add.particles(bounds.centerX, bounds.centerY, 'p_smoke', {
            x: { min: bounds.left - bounds.centerX, max: bounds.right - bounds.centerX },
            y: { min: bounds.top - bounds.centerY, max: bounds.bottom - bounds.centerY },
            speedY: { min: -10, max: -30 },
            scale: { start: 0.5, end: 0.8 },
            alpha: { start: 0.05, end: 0 },
            lifespan: 3000,
            frequency: 400,
            tint: 0x000000, // Темный дым
        });
        heatEmitter.setDepth(19);
        this.particleEmitters.push(heatEmitter);
    }
  }

  private createVoidEffects(): void {
    const { scene, bounds } = this;
    if (!scene.textures.exists('p_smoke')) return;

    // Туман пустоты, медленно клубящийся
    const emitter = scene.add.particles(bounds.centerX, bounds.centerY, 'p_smoke', {
      x: { min: bounds.left - bounds.centerX, max: bounds.right - bounds.centerX },
      y: { min: bounds.top - bounds.centerY, max: bounds.bottom - bounds.centerY },
      speed: { min: 2, max: 6 },
      scale: { start: 0.5, end: 0.2 },
      alpha: { start: 0.2, end: 0 },
      lifespan: 4500,
      frequency: 300,
      tint: [0x9d00ff, 0x6600aa, 0x4b0082],
      blendMode: 'ADD',
    });

    emitter.setDepth(20);
    this.particleEmitters.push(emitter);
  }

  private createInsectEffects(): void {
    const { scene, bounds } = this;
    if (!scene.textures.exists('p_glow')) return;

    // "Светлячки" или споры
    const emitter = scene.add.particles(bounds.centerX, bounds.centerY, 'p_glow', {
      x: { min: bounds.left - bounds.centerX + 40, max: bounds.right - bounds.centerX - 40 },
      y: { min: bounds.top - bounds.centerY + 40, max: bounds.bottom - bounds.centerY - 40 },
      speed: { min: 10, max: 25 },
      scale: { start: 0.2, end: 0.05 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 3000,
      frequency: 150,
      tint: [0x39ff14, 0xccff00], // Ядовито-зеленый
      blendMode: 'ADD',
    });

    emitter.setDepth(20);
    this.particleEmitters.push(emitter);
  }

  private createVignette(): void {
    const { scene } = this;
    const { width, height } = scene.scale;

    const g = scene.add.graphics();
    g.setDepth(100);

    const maxRadius = Math.max(width, height);

    for (let i = 0; i < 8; i++) {
      const ratio = i / 8;
      const innerRadius = maxRadius * (0.45 + ratio * 0.3);
      const alpha = (1 - ratio) * 0.15; // Чуть темнее

      g.fillStyle(0x000000, alpha / 8);
      g.fillEllipse(width / 2, height / 2, innerRadius * 2, innerRadius * 2);
    }
  }

  // ==================== PUBLIC HELPERS ====================

  playGoalPostHit(side: GoalSide, intensity: number): void {
    const goal = side === 'top' ? this.topGoal : this.bottomGoal;
    if (!goal) return;

    const clamped = Phaser.Math.Clamp(intensity, 0, 1);

    this.scene.tweens.add({
      targets: goal.container,
      scaleX: 1 + 0.04 * clamped,
      scaleY: 1 + 0.04 * clamped,
      yoyo: true,
      duration: 90,
      ease: 'Quad.easeOut',
    });

    this.scene.tweens.add({
      targets: goal.net,
      alpha: { from: 0.25, to: 0.7 },
      yoyo: true,
      duration: 110,
    });

    if (clamped > 0.4) {
      this.scene.cameras.main.shake(90, 0.007 * clamped);
    }

    const b = this.bounds;
    const impactX = b.centerX;
    const impactY = side === 'top' ? b.top : b.bottom;

    const waveColor = this.skin.goalFrameColor || this.skin.goalColor || 0xffffff;

    const shock = this.scene.add.circle(
      impactX,
      impactY,
      6 * this.scale,
      waveColor,
      0.9
    );
    shock.setDepth(16);
    shock.setBlendMode(Phaser.BlendModes.ADD);

    this.scene.tweens.add({
      targets: shock,
      radius: { from: 6 * this.scale, to: 40 * this.scale * (0.6 + clamped) },
      alpha: { from: 0.9, to: 0 },
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => shock.destroy(),
    });
  }

  playImpactEffect(x: number, y: number, intensity: number): void {
    if (intensity < 0.3) return;

    this.scene.cameras.main.shake(40, 0.003 * intensity);

    const flash = this.scene.add.graphics();
    flash.setDepth(50);
    flash.fillStyle(0xffffff, 0.25 * intensity);
    flash.fillCircle(x, y, 25 * intensity);

    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 1.8,
      duration: 120,
      onComplete: () => flash.destroy(),
    });

    const wallSprites = this.wallElements.filter(
      (e) =>
        e instanceof Phaser.GameObjects.TileSprite ||
        e instanceof Phaser.GameObjects.Image
    ) as (Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite)[];

    if (!wallSprites.length) return;

    let nearest: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite | null = null;
    let minDist = Number.MAX_VALUE;

    wallSprites.forEach((el) => {
      const d = Phaser.Math.Distance.Between(x, y, el.x, el.y);
      if (d < minDist) {
        minDist = d;
        nearest = el;
      }
    });

    if (!nearest) return;

    const glowColor =
      (this.factionId && FieldRenderer.ARENA_ASSETS[this.factionId]?.glowColor) ||
      0xffffff;

    try {
      const fxTarget = nearest as any;
      if (fxTarget.preFX) {
        const fx = fxTarget.preFX.addGlow(glowColor, 5, 1);
        this.scene.time.delayedCall(140, () => {
          try {
            fx.destroy();
          } catch {
            /* ignore */
          }
        });
      }
    } catch {
      // ignore
    }
  }

  private getFieldStyle(): FieldStyle {
    if (this.arena) return this.arena.style as FieldStyle;
    return (this.skin.style as FieldStyle) || 'generic';
  }

  private lightenColor(color: number, amount: number): number {
    const r = Math.min(255, ((color >> 16) & 0xff) + 255 * amount);
    const g = Math.min(255, ((color >> 8) & 0xff) + 255 * amount);
    const b = Math.min(255, (color & 0xff) + 255 * amount);
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  private darkenColor(color: number, amount: number): number {
    const r = Math.max(0, ((color >> 16) & 0xff) * (1 - amount));
    const g = Math.max(0, ((color >> 8) & 0xff) * (1 - amount));
    const b = Math.max(0, (color & 0xff) * (1 - amount));
    return (Math.floor(r) << 16) | (Math.floor(g) << 8) | Math.floor(b);
  }

  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff,
      g1 = (color1 >> 8) & 0xff,
      b1 = color1 & 0xff;
    const r2 = (color2 >> 16) & 0xff,
      g2 = (color2 >> 8) & 0xff,
      b2 = color2 & 0xff;
    const r = Math.floor(r1 + (r2 - r1) * t);
    const g = Math.floor(g1 + (g2 - g1) * t);
    const b = Math.floor(b1 + (b2 - b1) * t);
    return (r << 16) | (g << 8) | b;
  }

  update(): void {
    if (this.floorTile) {
      this.floorTile.tilePositionX += 0.1;
      this.floorTile.tilePositionY += 0.05;
    }
  }

  destroy(): void {
    this.particleEmitters.forEach((e) => e.destroy());
    this.particleEmitters = [];

    this.wallElements.forEach((e) => e.destroy());
    this.wallElements = [];

    this.cornerPulseTweens.forEach((t) => t.stop());
    this.cornerPulseTweens = [];
    
    if (this.markingsPulseTween) this.markingsPulseTween.stop();

    this.floorTile?.destroy();
    this.fieldGraphics.destroy();

    this.centerScan?.destroy();
    this.centerScan = undefined;

    this.cyborgMarkingFx.forEach(obj => obj.destroy());
    this.cyborgMarkingFx = [];

    this.topGoal?.container.destroy(true);
    this.bottomGoal?.container.destroy(true);
    this.topGoal = undefined;
    this.bottomGoal = undefined;
  }
}