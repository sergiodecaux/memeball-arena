// src/scenes/BattlePassScene.ts
// Сцена Battle Pass с двумя дорожками (FREE и PREMIUM)

import Phaser from 'phaser';
import { battlePassManager, BattlePassManager } from '../managers/BattlePassManager';
import { getCurrentSeason, getXPProgress, formatTimeRemaining, BattlePassTier, BattlePassReward } from '../data/BattlePassData';
import { getUnitById, getDisplayName } from '../data/UnitsRepository';
import { UnitUnlockCelebration } from '../ui/UnitUnlockCelebration';
import { getFonts } from '../config/themes';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { CHESTS_CATALOG, CHEST_ID_MIGRATION } from '../data/ChestsCatalog';

// ✅ Константа для зоны свайпа
const BATTLE_PASS_SWIPE_EDGE_ZONE = 60;

export class BattlePassScene extends Phaser.Scene {
  private s!: number;
  private scrollContainer!: Phaser.GameObjects.Container;
  private scrollX = 0;
  private maxScrollX = 0;
  private isDragging = false;
  private dragStartX = 0;
  private scrollVelocity = 0;
  private lastPointerX = 0;
  private timerText!: Phaser.GameObjects.Text;
  private swipeManager?: SwipeNavigationManager;
  
  // UI элементы для обновления
  private progressBarFill!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private tierText!: Phaser.GameObjects.Text;
  private progressBarWidth!: number;
  private progressSectionContainer!: Phaser.GameObjects.Container;
  
  // Particle effects
  private emitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  
  // Scroll tilt effect
  private prevScrollX = 0;
  
  // Audio rate limiting
  private lastSwipeSoundTime = 0;
  
  // Флаг: показывали ли модалку премиума в этой сессии
  private premiumModalShownThisSession = false;
  
  // Дебаунс для ресайза
  private resizeDebounceTimer?: Phaser.Time.TimerEvent;
  
  // Активные модальные элементы (для корректной очистки)
  private activeModalOverlay?: Phaser.GameObjects.Rectangle;
  private activeModalContainer?: Phaser.GameObjects.Container;

  // Lazy loading
  private visibleTierNodes: Map<number, Phaser.GameObjects.Container> = new Map();
  private tierWidth: number = 0;
  private tierSpacing: number = 0;
  private totalItemWidth: number = 0;
  private freeTrackY: number = 0;
  private premiumTrackY: number = 0;
  private trackHeight: number = 0;
  private lastVisibleRange: { start: number; end: number } = { start: -1, end: -1 };

  // Protection flags
  private isCreating: boolean = false;
  private isDestroyed: boolean = false;

  // Event subscriptions
  private bpEventCallbacks: { event: string; callback: Function }[] = [];

  constructor() {
    super({ key: 'BattlePassScene' });
  }

  create(): void {
    this.isCreating = true;
    this.isDestroyed = false;

    const { width, height } = this.scale;
    this.s = Math.min(width / 390, height / 844);
    
    // --- GENERIC TEXTURE GENERATION (For Glows/Rays) ---
    if (!this.textures.exists('flare_white')) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xffffff, 1);
        graphics.fillCircle(64, 64, 64);
        graphics.generateTexture('flare_white', 128, 128);
        graphics.destroy();
    }
    // ----------------------------------------------------

    this.createBackground();
    this.createHeader();
    this.createProgressSection();
    
    // ✅ ИСПРАВЛЕНО: SwipeManager создаётся ПЕРЕД скролл-контейнером
    // чтобы его обработчики были в очереди раньше
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
      canSwipe: () => !this.isDragging,
      edgeZoneWidth: BATTLE_PASS_SWIPE_EDGE_ZONE,
    });
    this.swipeManager.enable();
    
    // ✅ Теперь создаём скролл (его обработчики будут ПОСЛЕ swipeManager)
    this.createDualTrackScroll();
    
    this.createPremiumButton();
    this.createBackButton();
    this.createParticles();
    
    this.time.addEvent({ delay: 60000, callback: this.updateTimer, callbackScope: this, loop: true });
    
    // ✅ Сначала отписываемся от старых подписок
    this.bpEventCallbacks.forEach(({ event, callback }) => {
      battlePassManager.off(event, callback as any);
    });
    this.bpEventCallbacks = [];

    // Теперь подписываемся
    const rewardCallback = this.onRewardClaimed.bind(this);
    const xpCallback = this.onXPGained.bind(this);
    const tierCallback = this.onTierUp.bind(this);

    battlePassManager.on(BattlePassManager.EVENTS.REWARD_CLAIMED, rewardCallback);
    battlePassManager.on(BattlePassManager.EVENTS.XP_GAINED, xpCallback);
    battlePassManager.on(BattlePassManager.EVENTS.TIER_UP, tierCallback);

    this.bpEventCallbacks.push(
      { event: BattlePassManager.EVENTS.REWARD_CLAIMED, callback: rewardCallback },
      { event: BattlePassManager.EVENTS.XP_GAINED, callback: xpCallback },
      { event: BattlePassManager.EVENTS.TIER_UP, callback: tierCallback }
    );

    this.isCreating = false;
  }

  private handleBack(): void {
    this.scene.start('MainMenuScene');
  }

  private createBackground(): void {
    const { width, height } = this.scale;

    // 1. Deep Space Base
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x020617, 0x020617, 0x0f172a, 0x0f172a, 1);
    bg.fillRect(0, 0, width, height);

    // ✅ ОПТИМИЗАЦИЯ: Используем текстуру вместо множества линий
    const gridSize = 40 * this.s;
    const gridKey = 'bp_grid_texture';

    if (!this.textures.exists(gridKey)) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = Math.ceil(gridSize);
      gridCanvas.height = Math.ceil(gridSize);
      const ctx = gridCanvas.getContext('2d')!;
      
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(gridCanvas.width, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, gridCanvas.height);
      ctx.stroke();
      
      this.textures.addCanvas(gridKey, gridCanvas);
    }

    // Создаём tileSprite вместо множества линий
    const grid = this.add.tileSprite(0, 0, width, height, gridKey);
    grid.setOrigin(0, 0);
    grid.setAlpha(1);

    // 3. Vignette (Darker corners)
    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0.8, 0, 0); // Top corners dark
    vignette.fillRect(0, 0, width, height / 4);
    
    const vignetteBottom = this.add.graphics();
    vignetteBottom.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.8, 0.8); // Bottom corners dark
    vignetteBottom.fillRect(0, height - (height / 4), width, height / 4);
  }

  private createParticles(): void {
    // Note: In Phaser 3.80+, syntax might differ slightly. Using generic approach.
    // We'll use the 'flare_white' texture we generated earlier.
    
    this.emitter = this.add.particles(0, 0, 'flare_white', {
        frame: 0,
        lifespan: 800,
        speed: { min: 150, max: 350 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 1, end: 0 },
        gravityY: 200,
        emitting: false,
        blendMode: 'ADD'
    });
    this.emitter.setDepth(2000);
  }

  private playConfetti(x: number, y: number, tint: number = 0xffd700): void {
    this.emitter.setPosition(x, y);
    this.emitter.setParticleTint(tint);
    this.emitter.explode(30); // Burst of 30 particles
  }

  private createHeader(): void {
    const { width } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const season = getCurrentSeason();
    const progress = battlePassManager.getProgress();
    
    const hBg = this.add.graphics();
    hBg.fillStyle(0x0f0a1e, 0.9);
    hBg.fillRect(0, 0, width, 100 * s);
    
    for (let i = 0; i < 30; i++) {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xa855f7),
        Phaser.Display.Color.ValueToColor(0x00f2ff), 30, i
      );
      hBg.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      hBg.fillRect(i * (width / 30), 96 * s, width / 30 + 1, 4 * s);
    }
    
    const title = this.add.text(width / 2, 40 * s, 'БОЕВОЙ ПРОПУСК', {
      fontSize: `${28 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5);
    
    // Глитч
    this.time.addEvent({
      delay: 3000, loop: true,
      callback: () => {
        this.tweens.add({ targets: title, x: title.x + Phaser.Math.Between(-3, 3), duration: 50, yoyo: true, repeat: 2 });
      },
    });
    
    const seasonNameRu = 'Галактические Легенды'; // Русское название сезона
    this.add.text(width / 2, 65 * s, seasonNameRu.toUpperCase(), {
      fontSize: `${12 * s}px`, fontFamily: fonts.primary, color: '#a855f7', letterSpacing: 4,
    }).setOrigin(0.5);
    
    const tierBadge = this.add.container(width / 2, 85 * s);
    const tierBg = this.add.graphics();
    tierBg.fillStyle(0x1e1b4b, 1);
    tierBg.fillRoundedRect(-50 * s, -12 * s, 100 * s, 24 * s, 12 * s);
    tierBg.lineStyle(2, 0x00f2ff, 0.5);
    tierBg.strokeRoundedRect(-50 * s, -12 * s, 100 * s, 24 * s, 12 * s);
    tierBadge.add(tierBg);
    tierBadge.add(this.add.text(0, 0, `TIER ${progress.currentTier} / ${season.maxTier}`, {
      fontSize: `${11 * s}px`, fontFamily: fonts.tech, color: '#00f2ff',
    }).setOrigin(0.5));
    
    this.timerText = this.add.text(width - 20 * s, 30 * s, '', {
      fontSize: `${12 * s}px`, fontFamily: fonts.primary, color: '#f87171',
    }).setOrigin(1, 0);
    this.updateTimer();
    
    if (progress.isPremium) {
      const premBadge = this.add.container(width - 20 * s, 55 * s);
      const premBg = this.add.graphics();
      premBg.fillStyle(0xffd700, 0.2);
      premBg.fillRoundedRect(-55 * s, -10 * s, 55 * s, 20 * s, 10 * s);
      premBg.lineStyle(1, 0xffd700, 1);
      premBg.strokeRoundedRect(-55 * s, -10 * s, 55 * s, 20 * s, 10 * s);
      premBadge.add(premBg);
      premBadge.add(this.add.text(-27 * s, 0, '👑 PREMIUM', { fontSize: `${9 * s}px`, color: '#ffd700' }).setOrigin(0.5));
    }
    
    // ✅ ДОБАВЛЕНО: Декоративные линии по бокам заголовка
    const lineLeft = this.add.graphics();
    lineLeft.lineStyle(2, 0xa855f7, 0.6);
    lineLeft.lineBetween(20 * s, 40 * s, width / 2 - 80 * s, 40 * s);
    
    const lineRight = this.add.graphics();
    lineRight.lineStyle(2, 0x00f2ff, 0.6);
    lineRight.lineBetween(width / 2 + 80 * s, 40 * s, width - 20 * s, 40 * s);
    
    // Анимация линий
    this.tweens.add({
      targets: [lineLeft, lineRight],
      alpha: { from: 0.6, to: 0.2 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });
  }

  private createProgressSection(): void {
    const { width } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const progress = battlePassManager.getProgress();
    const season = getCurrentSeason();
    const xpInfo = getXPProgress(progress.currentXP, progress.currentTier);

    const sectionY = 100 * s;
    const sectionHeight = 130 * s; // Slightly taller

    // Container
    this.progressSectionContainer = this.add.container(0, 0);

    // === 1. Main Panel Background (Tech Style) ===
    const panelBg = this.add.graphics();
    // Dark Hex/Tech background
    panelBg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e293b, 0x1e293b, 1);
    panelBg.fillRoundedRect(15 * s, sectionY, width - 30 * s, sectionHeight, 20 * s);
    
    // Cyber Border
    panelBg.lineStyle(2, 0x38bdf8, 0.5);
    panelBg.strokeRoundedRect(15 * s, sectionY, width - 30 * s, sectionHeight, 20 * s);
    
    // Accent Line at top
    panelBg.lineStyle(4, 0x38bdf8, 1);
    panelBg.beginPath();
    panelBg.moveTo(40 * s, sectionY);
    panelBg.lineTo(width - 40 * s, sectionY);
    panelBg.strokePath();

    this.progressSectionContainer.add(panelBg);

    // === 2. Header Texts ===
    // Season Name
    const seasonText = this.add.text(30 * s, sectionY + 20 * s, `SEASON: ${season.name.toUpperCase()}`, {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.tech,
      color: '#38bdf8',
      stroke: '#000',
      strokeThickness: 2
    });
    this.progressSectionContainer.add(seasonText);

    // Premium Badge (if active)
    if (progress.isPremium) {
      const premBadge = this.add.container(width - 30 * s, sectionY + 20 * s);
      const bg = this.add.graphics();
      bg.fillStyle(0xffd700, 0.2);
      bg.fillRoundedRect(-80 * s, 0, 80 * s, 20 * s, 4 * s);
      bg.lineStyle(1, 0xffd700, 1);
      bg.strokeRoundedRect(-80 * s, 0, 80 * s, 20 * s, 4 * s);
      premBadge.add(bg);
      
      premBadge.add(this.add.text(-40 * s, 10 * s, 'VIP PASS', {
        fontSize: `${10 * s}px`, fontFamily: fonts.tech, color: '#ffd700'
      }).setOrigin(0.5));
      
      this.progressSectionContainer.add(premBadge);
    }

    // Current Tier (Big Number)
    this.tierText = this.add.text(width / 2, sectionY + 35 * s, `TIER ${progress.currentTier}`, {
      fontSize: `${32 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#00d4ff',
      strokeThickness: 4,
      shadow: { blur: 10, color: '#00d4ff', fill: true, offsetX: 0, offsetY: 0 }
    }).setOrigin(0.5).setShadow(0, 1, '#000000', 3, true, true);
    this.progressSectionContainer.add(this.tierText);

    // === 3. Progress Bar ===
    const barX = 30 * s;
    const barY = sectionY + 85 * s;
    this.progressBarWidth = width - 60 * s;
    const barHeight = 20 * s;

    // Track (Background)
    const barBg = this.add.graphics();
    barBg.fillStyle(0x020617, 1);
    barBg.fillRoundedRect(barX, barY, this.progressBarWidth, barHeight, 6 * s);
    // Inner shadow effect
    barBg.fillStyle(0x000000, 0.5);
    barBg.fillRect(barX, barY, this.progressBarWidth, barHeight / 2);
    this.progressSectionContainer.add(barBg);

    // Fill
    const fillWidth = Math.max(10 * s, this.progressBarWidth * xpInfo.progress);
    this.progressBarFill = this.add.rectangle(
      barX, 
      barY + barHeight / 2, 
      fillWidth, 
      barHeight,
      0x38bdf8
    ).setOrigin(0, 0.5);
    
    // Gradient effect on fill
    if (this.progressBarFill.postFX) {
        this.progressBarFill.postFX.addGradient(0x38bdf8, 0x00f2ff, 0);
        this.progressBarFill.postFX.addGlow(0x00f2ff, 1, 0, false, 0.1, 10);
    }
    this.progressSectionContainer.add(this.progressBarFill);

    // XP Text
    this.progressText = this.add.text(
      width / 2, 
      barY + barHeight / 2, 
      `${Math.floor(xpInfo.current)} / ${xpInfo.needed} XP`,
      {
        fontSize: `${12 * s}px`,
        fontFamily: fonts.primary,
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 3
      }
    ).setOrigin(0.5).setShadow(0, 1, '#000000', 3, true, true);
    this.progressSectionContainer.add(this.progressText);

    // Claim All Button (if multiple claimable rewards)
    this.createClaimAllButton(width - 100 * s, barY + barHeight / 2);
  }

  private createDualTrackScroll(): void {
    const { width, height } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const season = getCurrentSeason();
    const progress = battlePassManager.getProgress();

    const startY = 160 * s;
    const scrollAreaHeight = height - startY - 100 * s;

    // Сохраняем размеры для lazy loading
    this.tierWidth = 130 * s;
    this.tierSpacing = 20 * s;
    this.totalItemWidth = this.tierWidth + this.tierSpacing;
    
    this.trackHeight = (scrollAreaHeight - 60 * s) / 2;
    this.freeTrackY = 40 * s;
    this.premiumTrackY = this.freeTrackY + this.trackHeight + 20 * s;

    // --- Labels ---
    const freeLabel = this.add.text(20 * s, startY + this.freeTrackY - 20 * s, '🆓 FREE REWARDS', {
      fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#38bdf8',
    });
    
    const premLabel = this.add.container(20 * s, startY + this.premiumTrackY - 20 * s);
    premLabel.add(this.add.text(0, 0, '👑 GALAXY PASS', {
      fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#ffd700',
      shadow: { color: '#ffd700', blur: 10, fill: true, offsetX: 0, offsetY: 0 }
    }));
    if (!progress.isPremium) {
      premLabel.add(this.add.text(140 * s, 0, '🔒 LOCKED', { fontSize: `${10 * s}px`, color: '#64748b' }));
    }

    // --- Mask ---
    const maskShape = this.make.graphics({});
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, startY, width, scrollAreaHeight);
    const mask = maskShape.createGeometryMask();

    // --- Scroll Container ---
    this.scrollContainer = this.add.container(0, startY);
    this.scrollContainer.setMask(mask);

    // --- BACKGROUND TRACKS (только линии, без карточек) ---
    const totalWidth = 30 * s + season.tiers.length * this.totalItemWidth;
    const currentX = 30 * s + (progress.currentTier - 1) * this.totalItemWidth + (this.tierWidth / 2);

    const trackGraphics = this.add.graphics();
    this.scrollContainer.add(trackGraphics);

    // Base Dark Tracks
    trackGraphics.lineStyle(12 * s, 0x0f172a, 1);
    trackGraphics.lineBetween(30 * s, this.freeTrackY + this.trackHeight/2, totalWidth, this.freeTrackY + this.trackHeight/2);
    trackGraphics.lineBetween(30 * s, this.premiumTrackY + this.trackHeight/2, totalWidth, this.premiumTrackY + this.trackHeight/2);

    // Active Progress Tracks
    trackGraphics.lineStyle(8 * s, 0x38bdf8, 1);
    trackGraphics.lineBetween(30 * s, this.freeTrackY + this.trackHeight/2, Math.min(totalWidth, currentX), this.freeTrackY + this.trackHeight/2);
    trackGraphics.lineStyle(12 * s, 0x38bdf8, 0.3);
    trackGraphics.lineBetween(30 * s, this.freeTrackY + this.trackHeight/2, Math.min(totalWidth, currentX), this.freeTrackY + this.trackHeight/2);

    trackGraphics.lineStyle(8 * s, 0xffd700, 1);
    trackGraphics.lineBetween(30 * s, this.premiumTrackY + this.trackHeight/2, Math.min(totalWidth, currentX), this.premiumTrackY + this.trackHeight/2);
    trackGraphics.lineStyle(12 * s, 0xffd700, 0.3);
    trackGraphics.lineBetween(30 * s, this.premiumTrackY + this.trackHeight/2, Math.min(totalWidth, currentX), this.premiumTrackY + this.trackHeight/2);

    // Scroll Init
    this.maxScrollX = Math.max(0, (season.tiers.length * this.totalItemWidth) - width + 60 * s);
    const currentIndex = Math.max(0, progress.currentTier - 2);
    this.scrollX = Math.min(this.maxScrollX, currentIndex * this.totalItemWidth);
    this.scrollContainer.x = -this.scrollX;

    // ✅ ДОБАВЛЕНО: Обработчик ресайза с дебаунсом
    this.scale.on('resize', this.handleResize, this);

    // Inputs
    this.input.on('pointerdown', this.onDragStart, this);
    this.input.on('pointermove', this.onDragMove, this);
    this.input.on('pointerup', this.onDragEnd, this);

    // ✅ ДОБАВИТЬ: После расчёта this.maxScrollX (обычно в конце createDualTrackScroll)

    // Принудительная загрузка первых тиров при старте
    // Используем scene.events.once('update') чтобы гарантировать, что все расчёты завершены
    this.events.once('update', () => {
      if (this.isDestroyed || !this.totalItemWidth) return;
      
      const season = getCurrentSeason();
      const progress = battlePassManager.getProgress();
      const initialEndTier = Math.min(12, season.maxTier);
      
      for (let tier = 1; tier <= initialEndTier; tier++) {
        if (this.visibleTierNodes.has(tier)) continue;
        
        const tierData = season.tiers.find(t => t.tier === tier);
        if (!tierData) continue;
        
        const tierContainer = this.add.container(0, 0).setDepth(10);
        const x = (tier - 1) * this.totalItemWidth + this.tierWidth / 2 + 20 * this.s;

        if (tierData.freeReward) {
          const freeNode = this.createRewardNode(
            tierData, tierData.freeReward, x, this.freeTrackY,
            this.tierWidth, this.trackHeight - 10 * this.s, false, progress
          );
          if (freeNode) tierContainer.add(freeNode);
        }

        if (tierData.premiumReward) {
          const premiumNode = this.createRewardNode(
            tierData, tierData.premiumReward, x, this.premiumTrackY,
            this.tierWidth, this.trackHeight - 10 * this.s, true, progress
          );
          if (premiumNode) tierContainer.add(premiumNode);
        }

        const tierNumY = (this.freeTrackY + this.premiumTrackY) / 2;
        const tierNum = this.add.text(x, tierNumY, `${tier}`, {
          fontSize: `${14 * this.s}px`,
          fontFamily: 'Orbitron, Arial',
          color: '#6b7280',
        }).setOrigin(0.5).setDepth(15);
        tierContainer.add(tierNum);

        this.scrollContainer.add(tierContainer);
        this.visibleTierNodes.set(tier, tierContainer);
      }
      
      if (import.meta.env.DEV) {
        console.log(`[BattlePass] Initial force-load: ${this.visibleTierNodes.size} tiers`);
      }
    });
  }

  private updateVisibleTiers(): void {
    // Защита от вызова до инициализации или после уничтожения
    if (this.isDestroyed || !this.scrollContainer?.active) return;
    if (!this.totalItemWidth || this.totalItemWidth <= 0) return;

    const { width } = this.scale;
    const season = getCurrentSeason();
    
    // ✅ ИСПРАВЛЕНО: Увеличенный буфер для предзагрузки (1.5 экрана в каждую сторону)
    const bufferZone = width * 1.5;
    const viewportLeft = -this.scrollX - bufferZone;
    const viewportRight = -this.scrollX + width + bufferZone;
    
    // ✅ ИСПРАВЛЕНО: Симметричная формула расчёта диапазона
    const startTier = Math.max(1, Math.floor(viewportLeft / this.totalItemWidth) + 1);
    const endTier = Math.min(season.maxTier, Math.ceil(viewportRight / this.totalItemWidth));
    
    // Пропускаем если диапазон не изменился
    if (startTier === this.lastVisibleRange.start && endTier === this.lastVisibleRange.end) {
      return;
    }
    
    // ✅ ДОБАВЛЕНО: Логирование только при изменении (для отладки, можно убрать позже)
    if (import.meta.env.DEV) {
      console.log(`[BattlePass] Updating visible tiers: ${startTier}-${endTier} (was ${this.lastVisibleRange.start}-${this.lastVisibleRange.end})`);
    }
    
    this.lastVisibleRange = { start: startTier, end: endTier };

    // ✅ Буфер удаления — не удаляем сразу за viewport
    const deleteBuffer = 5;
    const tiersToRemove: number[] = [];
    this.visibleTierNodes.forEach((_, tier) => {
      if (tier < startTier - deleteBuffer || tier > endTier + deleteBuffer) {
        tiersToRemove.push(tier);
      }
    });
    
    // Удаляем ПОСЛЕ итерации
    tiersToRemove.forEach(tier => {
      const node = this.visibleTierNodes.get(tier);
      if (node?.active) {
        // ✅ destroy(true) для глубокого удаления (включая tweens)
        node.destroy(true);
      }
      this.visibleTierNodes.delete(tier);
    });

    // ✅ Получаем progress ОДИН раз для всего цикла
    const progress = battlePassManager.getProgress();

    // Создаём новые видимые тиры
    for (let tier = startTier; tier <= endTier; tier++) {
      if (this.visibleTierNodes.has(tier)) continue;
      
      const tierData = season.tiers.find(t => t.tier === tier);
      if (!tierData) continue;

      const tierContainer = this.add.container(0, 0).setDepth(10);
      const x = (tier - 1) * this.totalItemWidth + this.tierWidth / 2 + 20 * this.s;

      // FREE reward (верхняя дорожка)
      if (tierData.freeReward) {
        const freeNode = this.createRewardNode(
          tierData,
          tierData.freeReward,
          x,
          this.freeTrackY,
          this.tierWidth,
          this.trackHeight - 10 * this.s,
          false,
          progress
        );
        if (freeNode) tierContainer.add(freeNode);
      }

      // PREMIUM reward (нижняя дорожка)
      if (tierData.premiumReward) {
        const premiumNode = this.createRewardNode(
          tierData,
          tierData.premiumReward,
          x,
          this.premiumTrackY,
          this.tierWidth,
          this.trackHeight - 10 * this.s,
          true,
          progress
        );
        if (premiumNode) tierContainer.add(premiumNode);
      }

      // Номер тира между дорожками
      const tierNumY = (this.freeTrackY + this.premiumTrackY) / 2;
      const tierNum = this.add.text(x, tierNumY, `${tier}`, {
        fontSize: `${14 * this.s}px`,
        fontFamily: 'Orbitron, Arial',
        color: '#6b7280',
      }).setOrigin(0.5).setDepth(15);
      tierContainer.add(tierNum);

      this.scrollContainer.add(tierContainer);
      this.visibleTierNodes.set(tier, tierContainer);
    }
  }

  private handleResize(): void {
    if (this.isDestroyed) return;
    
    // Дебаунс — не обновляем слишком часто
    this.resizeDebounceTimer?.remove(false);
    this.resizeDebounceTimer = this.time.delayedCall(100, () => {
      if (!this.isDestroyed && this.scrollContainer?.active) {
        // Пересчитываем размеры
        const { width, height } = this.scale;
        this.s = Math.min(width / 390, height / 844);
        
        // Обновляем видимые тиры
        this.lastVisibleRange = { start: -1, end: -1 }; // Сброс для принудительного обновления
        this.updateVisibleTiers();
      }
    });
  }

  /**
   * Получает лучший доступный ключ текстуры (HD или базовый)
   */
  private getBestTextureKey(assetKey: string): string | null {
    const hdKey = `${assetKey}_512`;
    
    // Приоритет: HD версия > базовая версия
    if (this.textures.exists(hdKey)) {
      return hdKey;
    }
    
    if (this.textures.exists(assetKey)) {
      return assetKey;
    }
    
    return null;
  }

  private createRewardNode(
    tier: BattlePassTier, reward: BattlePassReward,
    x: number, y: number, w: number, h: number,
    isPremium: boolean, progress: any
  ): Phaser.GameObjects.Container {
    const s = this.s;
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const isUnlocked = tier.tier <= progress.currentTier;
    const isClaimed = isPremium 
      ? progress.claimedPremiumTiers.includes(tier.tier) 
      : progress.claimedFreeTiers.includes(tier.tier);
    const canClaim = battlePassManager.canClaimReward(tier.tier, isPremium);
    const isLockedByPremium = isPremium && !progress.isPremium;
    const isFuture = !isUnlocked;

    // === ЦВЕТОВАЯ СХЕМА ===
    let baseColor = isPremium ? 0x1a0a2e : 0x0f172a;
    let accentColor = isPremium ? 0x7c3aed : 0x3b82f6;
    let glowColor = isPremium ? 0xa855f7 : 0x60a5fa;
    
    if (isClaimed) {
      baseColor = 0x052e16;
      accentColor = 0x22c55e;
      glowColor = 0x4ade80;
    } else if (canClaim) {
      baseColor = isPremium ? 0x2e1065 : 0x0c4a6e;
      accentColor = isPremium ? 0xfbbf24 : 0x22d3ee;
      glowColor = isPremium ? 0xfcd34d : 0x67e8f9;
    } else if (isFuture || isLockedByPremium) {
      baseColor = 0x030712;
      accentColor = 0x374151;
      glowColor = 0x4b5563;
    }

    // === BACKGROUND ===
    const cardBg = this.add.graphics();
    
    // Внешнее свечение для активных Premium карточек
    if (isPremium && !isFuture && !isClaimed && !isLockedByPremium) {
      cardBg.fillStyle(glowColor, 0.12);
      cardBg.fillRoundedRect(-4, -4, w + 8, h + 8, 14 * s);
    }

    // Основной фон
    cardBg.fillStyle(baseColor, 1);
    cardBg.fillRoundedRect(0, 0, w, h, 10 * s);
    
    // Верхний градиентный слой (имитация)
    cardBg.fillStyle(accentColor, 0.08);
    cardBg.fillRoundedRect(0, 0, w, h * 0.35, { tl: 10 * s, tr: 10 * s, bl: 0, br: 0 });
    
    // Рамка
    const borderWidth = canClaim ? 2.5 : (isPremium ? 1.5 : 1);
    cardBg.lineStyle(borderWidth, accentColor, canClaim ? 1 : 0.5);
    cardBg.strokeRoundedRect(0, 0, w, h, 10 * s);

    // Угловые акценты для Premium
    if (isPremium && !isClaimed && !isFuture) {
      cardBg.lineStyle(1.5, glowColor, 0.6);
      cardBg.beginPath();
      cardBg.moveTo(0, 12 * s); cardBg.lineTo(0, 0); cardBg.lineTo(12 * s, 0);
      cardBg.moveTo(w, h - 12 * s); cardBg.lineTo(w, h); cardBg.lineTo(w - 12 * s, h);
      cardBg.strokePath();
    }

    container.add(cardBg);

    // === АНИМАЦИИ ДЛЯ CLAIMABLE ===
    if (canClaim) {
      const pulseGlow = this.add.graphics();
      pulseGlow.lineStyle(3, glowColor, 0.5);
      pulseGlow.strokeRoundedRect(-2, -2, w + 4, h + 4, 12 * s);
      container.add(pulseGlow);
      
      // ✅ Tweens привязаны к объектам внутри container — destroy(true) их уничтожит
      this.tweens.add({
        targets: pulseGlow,
        alpha: { from: 0.7, to: 0.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.tweens.add({
        targets: container,
        scaleX: { from: 1, to: 1.015 },
        scaleY: { from: 1, to: 1.015 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // === LOCKED OVERLAY ===
    if (isLockedByPremium || isFuture) {
      const lockOverlay = this.add.graphics();
      
      // Диагональные линии
      lockOverlay.lineStyle(1, 0xffffff, 0.04);
      for (let i = -h; i < w + h; i += 10) {
        lockOverlay.moveTo(Math.max(0, i), Math.max(0, -i));
        lockOverlay.lineTo(Math.min(w, i + h), Math.min(h, h - i + h));
      }
      lockOverlay.strokePath();
      
      // Затемнение
      lockOverlay.fillStyle(0x000000, 0.35);
      lockOverlay.fillRoundedRect(0, 0, w, h, 10 * s);
      
      container.add(lockOverlay);
    }

    // === ИКОНКА НАГРАДЫ ===
    const iconY = h * 0.36;
    const unitIconSize = 50 * s;
    const regularIconSize = 36 * s;

    // Свечение редкости для юнитов
    if (tier.unitRarity && !isClaimed && !isFuture && !isLockedByPremium) {
      const rarityGlow = this.add.graphics();
      const rarityColor = this.getRarityColor(tier.unitRarity);
      rarityGlow.fillStyle(rarityColor, 0.2);
      rarityGlow.fillCircle(w / 2, iconY, unitIconSize * 0.7);
      container.add(rarityGlow);
      
      this.tweens.add({
        targets: rarityGlow,
        alpha: { from: 0.2, to: 0.08 },
        duration: 1800,
        yoyo: true,
        repeat: -1
      });
    }

    // Иконка
    const iconAlpha = (isFuture || isLockedByPremium) ? 0.35 : 1;
    
    if (reward.type === 'unit' && reward.itemId) {
      const unit = getUnitById(reward.itemId);
      if (unit) {
        const textureKey = this.getBestTextureKey(unit.assetKey);
        if (textureKey && this.textures.exists(textureKey)) {
          const unitImg = this.add.image(w / 2, iconY, textureKey);
          unitImg.setDisplaySize(unitIconSize, unitIconSize);
          unitImg.setAlpha(iconAlpha);
          container.add(unitImg);
        }
      }
    } else {
      const iconKey = this.getRewardIconKey(reward);
      if (iconKey && this.textures.exists(iconKey)) {
        const icon = this.add.image(w / 2, iconY, iconKey);
        icon.setDisplaySize(regularIconSize, regularIconSize);
        icon.setAlpha(iconAlpha);
        container.add(icon);
      } else {
        const emoji = this.add.text(w / 2, iconY, this.getRewardEmoji(reward), {
          fontSize: `${20 * s}px`
        }).setOrigin(0.5).setAlpha(iconAlpha);
        container.add(emoji);
      }
    }

    // === ТЕКСТ НАГРАДЫ ===
    const valueY = h * 0.65;
    const textColor = tier.isUnitReward 
      ? this.getRarityHexColor(tier.unitRarity) 
      : (isPremium ? '#e9d5ff' : '#cbd5e1');
    
    const valueText = this.add.text(w / 2, valueY, this.getRewardValueText(reward), {
      fontSize: `${9 * s}px`,
      fontFamily: fonts.primary,
      color: (isFuture || isLockedByPremium) ? '#64748b' : textColor,
      align: 'center',
      wordWrap: { width: w - 6 }
    }).setOrigin(0.5);
    container.add(valueText);

    // === СТАТУС ===
    const statusY = h - 16 * s;

    if (isClaimed) {
      const checkBg = this.add.graphics();
      checkBg.fillStyle(0x22c55e, 1);
      checkBg.fillCircle(w / 2, statusY, 10 * s);
      container.add(checkBg);
      
      container.add(this.add.text(w / 2, statusY, '✓', {
        fontSize: `${11 * s}px`,
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5));
    } else if (canClaim) {
      const btnW = w - 14 * s;
      const btnH = 20 * s;
      const btnColor = isPremium ? 0xfbbf24 : 0x22d3ee;
      
      const btnBg = this.add.graphics();
      btnBg.fillStyle(btnColor, 1);
      btnBg.fillRoundedRect(w / 2 - btnW / 2, statusY - btnH / 2, btnW, btnH, 4 * s);
      
      // Блик
      btnBg.fillStyle(0xffffff, 0.15);
      btnBg.fillRoundedRect(
        w / 2 - btnW / 2 + 2, 
        statusY - btnH / 2 + 1, 
        btnW - 4, 
        btnH / 2 - 1, 
        { tl: 3 * s, tr: 3 * s, bl: 0, br: 0 }
      );
      
      const btnText = this.add.text(w / 2, statusY, 'CLAIM', {
        fontSize: `${8 * s}px`,
        fontFamily: fonts.tech,
        color: '#000000',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      const hitArea = this.add.rectangle(w / 2, statusY, btnW, btnH)
        .setInteractive({ useHandCursor: true });
      
      hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation();
        this.claimReward(tier.tier, isPremium);
      });

      container.add(btnBg);
      container.add(btnText);
      container.add(hitArea);
    } else if (isLockedByPremium) {
      container.add(this.add.text(w / 2, statusY, '🔒 VIP', {
        fontSize: `${8 * s}px`,
        color: '#a855f7',
        fontFamily: fonts.tech
      }).setOrigin(0.5));
      
      // Вся карточка кликабельна
      const hitArea = this.add.rectangle(w / 2, h / 2, w, h)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        if (!this.premiumModalShownThisSession) {
          this.premiumModalShownThisSession = true;
          this.showPremiumModal();
        }
      });
      container.add(hitArea);
    }

    // === VIP BADGE для Premium ===
    if (isPremium && !isClaimed && !isFuture && !isLockedByPremium) {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x7c3aed, 1);
      badgeBg.fillRoundedRect(w - 24 * s, 3 * s, 21 * s, 12 * s, 2 * s);
      container.add(badgeBg);
      
      container.add(this.add.text(w - 13.5 * s, 9 * s, 'VIP', {
        fontSize: `${6 * s}px`,
        color: '#fef3c7',
        fontFamily: fonts.tech,
        fontStyle: 'bold'
      }).setOrigin(0.5));
    }

    return container;
  }

  private createClaimButton(x: number, y: number, tier: number, isPremium: boolean, maxWidth: number): Phaser.GameObjects.Container {
    const s = this.s;
    const fonts = getFonts();
    const btn = this.add.container(x, y);
    
    const btnW = Math.min(70 * s, maxWidth);
    const btnH = 22 * s;
    
    const bg = this.add.graphics();
    bg.fillStyle(isPremium ? 0xffd700 : 0x22c55e, 1);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 11 * s);
    btn.add(bg);
    
    btn.add(this.add.text(0, 0, 'CLAIM', { fontSize: `${9 * s}px`, fontFamily: fonts.tech, color: '#000000' }).setOrigin(0.5));
    
    this.tweens.add({ targets: btn, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1 });
    
    btn.setSize(btnW, btnH);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation();
      this.claimReward(tier, isPremium);
    });
    
    return btn;
  }

  private claimReward(tier: number, isPremium: boolean): void {
    // Audio feedback
    if (this.sound && this.sound.get('sfx_ui_success')) {
        this.sound.play('sfx_ui_success', { volume: 0.5 });
    }
    
    const result = battlePassManager.claimReward(tier, isPremium);
    
    if (result) {
      if (result.unitData) {
        const celebration = new UnitUnlockCelebration(this, result.unitData, () => {
          // Refresh UI after unit celebration
          this.updateUIState();
        });
        celebration.show();
      } else {
        this.showRewardPopup(result.reward);
        // Note: updateUIState() is called from showRewardPopup's closePopup callback
      }
    }
  }

  private showRewardPopup(reward: BattlePassReward): void {
    const { width, height } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    
    // 1. Dark Overlay (Block clicks)
    const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.85);
    overlay.setInteractive(); // Block input
    overlay.setDepth(1000);
    overlay.setAlpha(0);

    // 2. Main Container
    const popup = this.add.container(width / 2, height / 2).setDepth(1001);
    popup.setScale(0); // Start small

    // 3. Rotating Rays (God Rays)
    const rays = this.add.graphics();
    rays.fillStyle(0xffd700, 0.1); // Gold rays
    const rayLength = 300 * s;
    const rayWidth = 15; // degrees
    for (let i = 0; i < 12; i++) {
        const startAngle = Phaser.Math.DegToRad(i * 30);
        const endAngle = Phaser.Math.DegToRad(i * 30 + rayWidth);
        rays.beginPath();
        rays.moveTo(0, 0);
        rays.lineTo(Math.cos(startAngle) * rayLength, Math.sin(startAngle) * rayLength);
        rays.lineTo(Math.cos(endAngle) * rayLength, Math.sin(endAngle) * rayLength);
        rays.closePath();
        rays.fillPath();
    }
    // Spin animation
    this.tweens.add({
        targets: rays,
        angle: 360,
        duration: 8000,
        repeat: -1
    });
    popup.add(rays);

    // 4. Panel Background
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 1);
    bg.fillRoundedRect(-120 * s, -100 * s, 240 * s, 200 * s, 20 * s);
    bg.lineStyle(4, 0x00f2ff, 1);
    bg.strokeRoundedRect(-120 * s, -100 * s, 240 * s, 200 * s, 20 * s);
    popup.add(bg);

    // 5. Header Text
    const titleText = this.add.text(0, -70 * s, 'REWARD UNLOCKED!', {
        fontSize: `${22 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffd700',
        stroke: '#000',
        strokeThickness: 4
    }).setOrigin(0.5);
    popup.add(titleText);

    // 6. Reward Icon (Big)
    const iconY = -10 * s;
    const iconSize = 100 * s;
    
    // Glow behind icon
    const glow = this.add.image(0, iconY, 'flare_white');
    glow.setTint(0x00f2ff);
    glow.setAlpha(0.5);
    glow.setScale(2);
    popup.add(glow);

    // Actual Icon
    if (reward.type === 'unit' && reward.itemId) {
         // Unit logic (simplified for popup)
         const unit = getUnitById(reward.itemId);
         if(unit) {
             const texture = this.getBestTextureKey(unit.assetKey);
             if(texture) popup.add(this.add.image(0, iconY, texture).setDisplaySize(iconSize, iconSize));
         }
    } else {
        const iconKey = this.getRewardIconKey(reward);
        if (iconKey && this.textures.exists(iconKey)) {
            popup.add(this.add.image(0, iconY, iconKey).setDisplaySize(iconSize, iconSize));
        } else {
            popup.add(this.add.text(0, iconY, this.getRewardEmoji(reward), { fontSize: `${60 * s}px` }).setOrigin(0.5));
        }
    }

    // 7. Value Text
    const valueText = this.add.text(0, 60 * s, this.getRewardDisplayText(reward), {
        fontSize: `${32 * s}px`,
        fontFamily: fonts.primary,
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 3
    }).setOrigin(0.5);
    popup.add(valueText);

    // 8. "Tap to continue"
    const tapText = this.add.text(0, 140 * s, 'Tap to continue', {
        fontSize: `${14 * s}px`,
        fontFamily: fonts.primary,
        color: '#94a3b8'
    }).setOrigin(0.5);
    tapText.setAlpha(0);
    // Blink animation
    this.tweens.add({ targets: tapText, alpha: 1, duration: 800, yoyo: true, repeat: -1 });
    popup.add(tapText);

    // === ANIMATION SEQUENCE ===
    
    // Define closePopup before using it
    const closePopup = () => {
        this.tweens.add({ 
            targets: [popup, overlay], 
            alpha: 0, 
            scale: { value: 0, targets: popup }, 
            duration: 250, 
            onComplete: () => {
                popup.destroy();
                overlay.destroy();
                // Refresh UI without full restart
                this.updateUIState(); 
            }
        });
    };
    
    // Fade in overlay
    this.tweens.add({ targets: overlay, alpha: 1, duration: 200 });

    // Pop in container (Elastic)
    this.tweens.add({
        targets: popup,
        scale: 1,
        duration: 800,
        ease: 'Elastic.easeOut',
        onComplete: () => {
            // Click handler only after animation
            overlay.on('pointerdown', closePopup);
            const closeZone = this.add.zone(0, 0, width, height).setInteractive();
            closeZone.on('pointerdown', closePopup);
        }
    });
  }

  private createPremiumButton(): void {
    const { width, height } = this.scale;
    const s = this.s;
    const progress = battlePassManager.getProgress();
    const season = getCurrentSeason();

    // Позиция кнопки
    const btnY = height - 75 * s;
    const btnWidth = Math.min(280 * s, width * 0.75);
    const btnHeight = 48 * s;

    const container = this.add.container(width / 2, btnY).setDepth(50);

    if (progress.isPremium) {
      // === PREMIUM АКТИВЕН ===
      const bg = this.add.graphics();
      bg.fillStyle(0x1a1a2e, 0.9);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 14);
      bg.lineStyle(2, 0xffd700, 0.6);
      bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 14);
      container.add(bg);

      const statusText = this.add.text(0, 0, '👑 PREMIUM АКТИВЕН', {
        fontSize: `${14 * s}px`,
        fontFamily: 'Orbitron, Arial',
        fontStyle: 'bold',
        color: '#ffd700',
      }).setOrigin(0.5).setShadow(0, 0, '#ffd700', 6, true, true);
      container.add(statusText);
      
      // ✅ Кнопка неактивна, но видна
      container.setAlpha(0.9);
    } else {
      // === КУПИТЬ PREMIUM ===
      const bg = this.add.graphics();
      
      // Основной фон цвета сезона
      bg.fillStyle(season.themeColor, 1);
      bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 14);
      
      // Highlight сверху
      bg.fillStyle(0xffffff, 0.3);
      bg.fillRoundedRect(
        -btnWidth / 2 + 2, 
        -btnHeight / 2 + 2, 
        btnWidth - 4, 
        btnHeight * 0.4, 
        { tl: 12, tr: 12, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
      );
      
      // Обводка
      bg.lineStyle(1, 0xffffff, 0.3);
      bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 14);
      container.add(bg);

      // ✅ ИСПРАВЛЕНО: Белый текст с тенью для читаемости
      const btnText = this.add.text(0, 0, '✦ КУПИТЬ PREMIUM ✦', {
        fontSize: `${15 * s}px`,
        fontFamily: 'Orbitron, Arial',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 6, true, true);
      container.add(btnText);

      // Цена под кнопкой
      const priceText = this.add.text(0, btnHeight / 2 + 16 * s, 
        `💎 ${season.premiumPrice.crystals} кристаллов`, {
        fontSize: `${11 * s}px`,
        fontFamily: 'Rajdhani, Arial',
        color: '#a78bfa',
      }).setOrigin(0.5).setShadow(0, 1, '#000000', 2, true, true);
      container.add(priceText);

      // Интерактивность
      const hit = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      
      hit.on('pointerover', () => {
        this.tweens.add({
          targets: container,
          scale: 1.03,
          duration: 100,
        });
      });
      hit.on('pointerout', () => {
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: 100,
        });
      });
      hit.on('pointerdown', () => {
        this.showPremiumModal();
      });
      container.add(hit);
    }
  }

  private showPremiumPurchased(): void {
    const { width, height } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    
    const popup = this.add.container(width / 2, height / 2).setDepth(1000);
    popup.add(this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8));
    
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 1);
    bg.fillRoundedRect(-120 * s, -60 * s, 240 * s, 120 * s, 20 * s);
    bg.lineStyle(3, 0xffd700, 1);
    bg.strokeRoundedRect(-120 * s, -60 * s, 240 * s, 120 * s, 20 * s);
    popup.add(bg);
    
    popup.add(this.add.text(0, 0, '👑 PREMIUM\nАКТИВИРОВАН!', {
      fontSize: `${22 * s}px`, fontFamily: fonts.tech, color: '#ffd700', align: 'center',
    }).setOrigin(0.5));
    
    popup.setScale(0);
    this.tweens.add({ targets: popup, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.time.delayedCall(1500, () => this.scene.restart());
  }

  private showNotEnoughCrystals(): void {
    const { width, height } = this.scale;
    const s = this.s;
    
    const text = this.add.text(width / 2, height / 2, '💎 Недостаточно кристаллов!', {
      fontSize: `${16 * s}px`, color: '#ef4444', backgroundColor: '#1e293b', padding: { x: 20, y: 12 },
    }).setOrigin(0.5).setDepth(1000);
    
    this.tweens.add({ targets: text, alpha: 0, y: height / 2 - 50, duration: 1500, onComplete: () => text.destroy() });
  }

  private createBackButton(): void {
    const s = this.s;
    const fonts = getFonts();
    
    const btn = this.add.text(20 * s, 15 * s, '← НАЗАД', {
      fontSize: `${14 * s}px`, fontFamily: fonts.primary, color: '#94a3b8',
    }).setInteractive({ useHandCursor: true });
    
    btn.on('pointerover', () => btn.setColor('#ffffff'));
    btn.on('pointerout', () => btn.setColor('#94a3b8'));
    btn.on('pointerdown', () => this.handleBack());
  }

  private updateTimer(): void {
    const remaining = battlePassManager.getTimeRemaining();
    this.timerText?.setText(`⏱ ${formatTimeRemaining(remaining)}`);
  }

  // === УТИЛИТЫ ===

  private getRewardIconKey(reward: BattlePassReward): string | null {
    switch (reward.type) {
      case 'coins':
        // ✅ ИСПРАВЛЕНО: Проверяем оба варианта ключей
        if (this.textures.exists('ui_rewards_coins')) return 'ui_rewards_coins';
        if (this.textures.exists('reward_coins_256')) return 'reward_coins_256';
        return null;
        
      case 'crystals':
        if (this.textures.exists('ui_rewards_crystals')) return 'ui_rewards_crystals';
        if (this.textures.exists('reward_crystals_256')) return 'reward_crystals_256';
        return null;
        
      case 'xp':
        // XP нет иконки, используем emoji
        return null;
        
      case 'card_pack':
        if (this.textures.exists('reward_cards_256')) return 'reward_cards_256';
        return null;
        
      case 'fragments':
        if (this.textures.exists('reward_fragments_256')) return 'reward_fragments_256';
        return null;
        
      // ✅ ДОБАВЛЕНО:
      case 'tournament_key_fragment':
        return 'tournament_key_full_256';
      case 'tournament_ticket':
        return 'tournament_ticket_256x128';
        
      case 'chest':
        // ✅ ИСПРАВЛЕНО: Правильные ключи сундуков
        if (reward.itemId) {
          // Пробуем точный ключ (chest_small_512, chest_medium_512, etc.)
          const exactKey512 = `${reward.itemId}_512`;
          const exactKey256 = `${reward.itemId}_256`;
          
          if (this.textures.exists(exactKey512)) return exactKey512;
          if (this.textures.exists(exactKey256)) return exactKey256;
          if (this.textures.exists(reward.itemId)) return reward.itemId;
        }
        // Fallback на любой доступный сундук
        if (this.textures.exists('chest_medium_512')) return 'chest_medium_512';
        if (this.textures.exists('chest_small_512')) return 'chest_small_512';
        return null;
        
      case 'unit':
        // Для юнитов используется отдельная логика в createRewardNode
        return null;
        
      default:
        return null;
    }
  }

  private getRewardEmoji(reward: BattlePassReward): string {
    switch (reward.type) {
      case 'coins': return '💰';
      case 'crystals': return '💎';
      case 'xp': return '⭐';
      case 'unit': return '🎯';
      case 'fragments': return '🧩';
      case 'chest': return '📦';
      case 'card_pack': return '🃏';
      // ✅ ДОБАВЛЕНО:
      case 'tournament_key_fragment': return '🔑';
      case 'tournament_ticket': return '🎫';
      default: return '🎁';
    }
  }

  private getChestDisplayName(itemId: string): string {
    // ✅ Миграция старых ID
    const migratedId = CHEST_ID_MIGRATION[itemId] || itemId;
    
    // ✅ Получить из каталога
    const chest = CHESTS_CATALOG[migratedId];
    if (chest) {
      return chest.nameRu;
    }
    
    // Fallback
    return 'Сундук';
  }

  private getRewardValueText(reward: BattlePassReward): string {
    switch (reward.type) {
      case 'coins': case 'crystals': case 'xp': case 'fragments': return `${reward.amount}`;
      case 'unit':
        const unit = getUnitById(reward.itemId || '');
        return unit?.name || 'Unit';
      case 'chest': return this.getChestDisplayName(reward.itemId || 'chest_small');
      case 'card_pack': return 'Карты';
      default: return '';
    }
  }

  private getRewardDisplayText(reward: BattlePassReward): string {
    switch (reward.type) {
      case 'coins': return `💰 ${reward.amount}`;
      case 'crystals': return `💎 ${reward.amount}`;
      case 'xp': return `⭐ ${reward.amount}`;
      case 'unit':
        const unit = getUnitById(reward.itemId || '');
        return unit ? `🎯 ${getDisplayName(unit)}` : '🎯 Unit';
      case 'fragments': return `🧩 ${reward.amount}`;
      case 'chest': return '📦 Сундук';
      case 'card_pack': return '🃏 Карты';
      default: return reward.type;
    }
  }

  private getRarityColor(rarity?: string): number {
    switch (rarity) {
      case 'rare': return 0x3b82f6;
      case 'epic': return 0xa855f7;
      case 'legendary': return 0xf59e0b;
      default: return 0x94a3b8;
    }
  }

  private getRarityHexColor(rarity?: string): string {
    switch (rarity) {
      case 'rare': return '#3b82f6';
      case 'epic': return '#a855f7';
      case 'legendary': return '#f59e0b';
      default: return '#ffffff';
    }
  }

  // === SCROLL ===

  private onDragStart(pointer: Phaser.Input.Pointer): void {
    // ✅ ИСПРАВЛЕНО: Используем константу вместо магического числа
    if (pointer.x <= BATTLE_PASS_SWIPE_EDGE_ZONE) {
      return;
    }
    
    const startY = 160 * this.s;
    const endY = this.scale.height - 100 * this.s;
    
    if (pointer.y > startY && pointer.y < endY) {
      this.isDragging = true;
      this.dragStartX = pointer.x + this.scrollX;
      this.lastPointerX = pointer.x;
      this.scrollVelocity = 0;
    }
  }

  private onDragMove(pointer: Phaser.Input.Pointer): void {
    if (!this.isDragging) return;
    
    this.scrollVelocity = this.lastPointerX - pointer.x;
    this.lastPointerX = pointer.x;
    
    // Audio feedback for fast scrolling
    if (Math.abs(this.scrollVelocity) > 10 && this.sound && this.sound.get('sfx_ui_swipe')) {
        // Rate limit: only play every 100ms
        if (!this.lastSwipeSoundTime || (Date.now() - this.lastSwipeSoundTime) > 100) {
            this.sound.play('sfx_ui_swipe', { volume: 0.2, rate: 1.5 });
            this.lastSwipeSoundTime = Date.now();
        }
    }
    
    this.scrollX = this.dragStartX - pointer.x;
    this.scrollX = Phaser.Math.Clamp(this.scrollX, 0, this.maxScrollX);
    this.scrollContainer.x = -this.scrollX;
    
    // ✅ Обновляем видимые тиры при скролле
    this.updateVisibleTiers();
  }

  private onDragEnd(): void {
    this.isDragging = false;
    
    if (Math.abs(this.scrollVelocity) > 3) {
      this.tweens.add({
        targets: this,
        // ✅ Увеличить множитель с 8 до 25
        scrollX: Phaser.Math.Clamp(this.scrollX + this.scrollVelocity * 25, 0, this.maxScrollX),
        duration: 300,  // ✅ Уменьшить с 400 до 300
        ease: 'Quad.easeOut',  // ✅ Более плавное затухание
        onUpdate: () => { 
          this.scrollContainer.x = -this.scrollX;
          this.updateVisibleTiers();
        },
      });
    }
    
    // ✅ Финальное обновление видимых тиров
    this.time.delayedCall(300, () => {
      this.updateVisibleTiers();
    });
  }

  update(time: number, delta: number): void {
    // 1. Tilt Effect
    if (this.scrollContainer) {
        const velocity = this.scrollX - this.prevScrollX;
        this.prevScrollX = this.scrollX;
        const targetSkew = Phaser.Math.Clamp(velocity * 0.05, -0.05, 0.05);
        this.scrollContainer.rotation = Phaser.Math.Linear(this.scrollContainer.rotation, targetSkew, 0.1);

        // 2. CAROUSEL SCALING EFFECT
        const centerX = this.scale.width / 2;
        const worldContainerX = this.scrollContainer.x;
        
        this.scrollContainer.each((child: any) => {
            // Filter: Only apply to reward Containers (not Graphics like track lines)
            if (child.type === 'Container') {
                const childWorldX = worldContainerX + child.x;
                const dist = Math.abs(centerX - childWorldX);
                const maxDist = this.scale.width * 0.6; // Distance where scale is min
                
                // Calculate scale: 1.0 at center, 0.85 at edges
                let targetScale = 1.0;
                if (dist < maxDist) {
                    // Cosine interpolation for smooth drop-off
                    const ratio = dist / maxDist;
                    targetScale = 0.85 + (0.15 * Math.cos(ratio * Math.PI / 2));
                } else {
                    targetScale = 0.85;
                }
                
                // Apply scale smoothly
                child.setScale(Phaser.Math.Linear(child.scaleX, targetScale, 0.2));
            }
        });
    }
  }

  private onRewardClaimed(): void {
    // Play confetti at the center of the screen
    const { width, height } = this.scale;
    this.playConfetti(width / 2, height / 2, 0xffd700);
  }

  private onXPGained(data: { amount: number; source: string; total: number }): void {
    // Обновить прогресс-бар
    this.updateProgressBar();
    
    // Показать анимацию получения XP
    this.showXPGainAnimation(data.amount, data.source);
  }

  private onTierUp(data: { tier: number }): void {
    // Обновить UI
    this.updateProgressBar();
    this.updateTierCards();
    
    // Прокрутить к новому тиру
    this.scrollToTier(data.tier);
    
    // Показать анимацию повышения тира
    this.showTierUpAnimation(data.tier);
  }

  private updateProgressBar(): void {
    const progress = battlePassManager.getProgress();
    const xpInfo = getXPProgress(progress.currentXP, progress.currentTier);
    
    // Обновить ширину заполнения прогресс-бара
    if (this.progressBarFill) {
      const fillWidth = Math.max(10 * this.s, this.progressBarWidth * xpInfo.progress);
      const barX = 30 * this.s;
      const barY = 100 * this.s + 85 * this.s;
      const barHeight = 20 * this.s;
      
      this.tweens.add({
        targets: this.progressBarFill,
        width: fillWidth,
        x: barX,
        duration: 300,
        ease: 'Power2'
      });
    }
    
    // Обновить текст
    if (this.progressText) {
      this.progressText.setText(`${Math.floor(xpInfo.current)} / ${xpInfo.needed} XP`);
    }
    
    if (this.tierText) {
      this.tierText.setText(`TIER ${progress.currentTier}`);
    }
  }

  // Helper to refresh UI without full scene restart (Smoother UX)
  private updateUIState(): void {
      if (this.scrollContainer) {
        this.scrollContainer.removeAll(true);
        this.createDualTrackScroll(); // Re-render tracks to show 'claimed' state
      }
      this.updateProgressBar();
  }

  private createClaimAllButton(x: number, y: number): void {
    const progress = battlePassManager.getProgress();
    const season = getCurrentSeason();
    
    // Calculate claimable count manually
    let claimableCount = 0;
    season.tiers.forEach(t => {
        if (battlePassManager.canClaimReward(t.tier, false)) claimableCount++;
        if (battlePassManager.canClaimReward(t.tier, true)) claimableCount++;
    });

    if (claimableCount < 2) return;

    const s = this.s;
    const fonts = getFonts();

    const btn = this.add.container(x, y);
    
    // Background
    const bg = this.add.graphics();
    bg.fillStyle(0x22c55e, 1);
    bg.fillRoundedRect(-60*s, -15*s, 120*s, 30*s, 8*s);
    // Glow
    bg.lineStyle(2, 0xa7f3d0, 1);
    bg.strokeRoundedRect(-60*s, -15*s, 120*s, 30*s, 8*s);
    btn.add(bg);

    // Text
    btn.add(this.add.text(0, 0, `CLAIM ALL (${claimableCount})`, {
        fontSize: `${12*s}px`, fontFamily: fonts.tech, color: '#000', fontStyle: 'bold'
    }).setOrigin(0.5));

    // Interaction
    btn.setSize(120*s, 30*s).setInteractive({ useHandCursor: true });
    
    // Pulse
    this.tweens.add({ targets: btn, scale: 1.05, duration: 600, yoyo: true, repeat: -1 });

    btn.on('pointerdown', () => this.handleClaimAll(btn));
    
    this.progressSectionContainer.add(btn);
  }

  private async handleClaimAll(btn: Phaser.GameObjects.Container): Promise<void> {
     btn.removeInteractive();
     btn.setAlpha(0.5);
     
     // Lock input
     this.input.enabled = false;
     
     // Get all claimable tiers
     const progress = battlePassManager.getProgress();
     const season = getCurrentSeason();
     
     // Find all claimable items
     const tiersToClaim: {tier: number, isPremium: boolean}[] = [];
     
     season.tiers.forEach(t => {
         if (battlePassManager.canClaimReward(t.tier, false)) tiersToClaim.push({tier: t.tier, isPremium: false});
         if (battlePassManager.canClaimReward(t.tier, true)) tiersToClaim.push({tier: t.tier, isPremium: true});
     });

     // Execute in sequence
     for (const item of tiersToClaim) {
         this.claimReward(item.tier, item.isPremium); // Reuse existing method
         
         // Play sound
         if (this.sound && this.sound.get('sfx_ui_success')) {
             this.sound.play('sfx_ui_success', { volume: 0.5 });
         }
         
         // Wait a bit for visual satisfaction
         await new Promise<void>(r => this.leakGuard.setTimeout(() => r(), 250));
     }
     
     // Unlock input
     this.input.enabled = true;
     btn.destroy();
     
     // Refresh UI
     this.updateUIState();
  }

  private showPremiumModal(): void {
    if (this.isDestroyed) return;
    
    // Закрываем предыдущую модалку если есть
    this.closeActiveModal();
    
    const { width, height } = this.scale;
    const s = this.s;
    const season = getCurrentSeason();

    // Затемнение фона
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(100)
      .setInteractive();
    
    // Анимация появления overlay
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.85,
      duration: 200,
    });
    
    this.activeModalOverlay = overlay;

    const modal = this.add.container(width / 2, height / 2).setDepth(101).setAlpha(0).setScale(0.9);
    this.activeModalContainer = modal;

    // Фон модалки
    const modalWidth = Math.min(340 * s, width * 0.9);
    const modalHeight = 400 * s;
    
    const bg = this.add.graphics();
    
    // Основной фон
    bg.fillStyle(0x1a1a2e, 0.98);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
    
    // Градиентная обводка (цвет сезона)
    bg.lineStyle(2, season.themeColor, 0.8);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
    
    // Свечение сверху
    bg.fillStyle(season.themeColor, 0.15);
    bg.fillRoundedRect(
      -modalWidth / 2 + 2, 
      -modalHeight / 2 + 2, 
      modalWidth - 4, 
      60 * s, 
      { tl: 18, tr: 18, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
    );
    modal.add(bg);

    // Иконка премиума
    const crownIcon = this.add.text(0, -modalHeight / 2 + 50 * s, '👑', {
      fontSize: `${48 * s}px`,
    }).setOrigin(0.5);
    modal.add(crownIcon);

    // Заголовок
    const title = this.add.text(0, -modalHeight / 2 + 110 * s, 'РАЗБЛОКИРОВАТЬ PREMIUM', {
      fontSize: `${18 * s}px`,
      fontFamily: 'Orbitron, Arial',
      fontStyle: 'bold',
      color: '#ffd700',
      align: 'center',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
    modal.add(title);

    // Описание
    const description = this.add.text(0, -modalHeight / 2 + 155 * s, 
      'Получите эксклюзивные награды,\nредких юнитов и особые бонусы!', {
      fontSize: `${13 * s}px`,
      fontFamily: 'Rajdhani, Arial',
      color: '#b8c0cc',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    modal.add(description);

    // Преимущества
    const benefits = [
      '✦ Эксклюзивные юниты',
      '✦ Двойные награды за каждый тир',
      '✦ Особые скины и эффекты',
      '✦ Бонусные кристаллы',
    ];
    
    const benefitsStartY = -modalHeight / 2 + 210 * s;
    benefits.forEach((benefit, i) => {
      const benefitText = this.add.text(0, benefitsStartY + i * 26 * s, benefit, {
        fontSize: `${12 * s}px`,
        fontFamily: 'Rajdhani, Arial',
        color: '#a78bfa',
      }).setOrigin(0.5);
      modal.add(benefitText);
    });

    // Цена
    const priceY = modalHeight / 2 - 110 * s;
    const priceText = this.add.text(0, priceY, `💎 ${season.premiumPrice.crystals} кристаллов`, {
      fontSize: `${16 * s}px`,
      fontFamily: 'Orbitron, Arial',
      fontStyle: 'bold',
      color: '#00d4ff',
    }).setOrigin(0.5).setShadow(0, 0, '#00d4ff', 8, true, true);
    modal.add(priceText);

    // Кнопка "Купить"
    const buyBtnY = modalHeight / 2 - 60 * s;
    const buyBtnWidth = modalWidth * 0.7;
    const buyBtnHeight = 46 * s;
    
    const buyBtnBg = this.add.graphics();
    buyBtnBg.fillStyle(season.themeColor, 1);
    buyBtnBg.fillRoundedRect(-buyBtnWidth / 2, buyBtnY - buyBtnHeight / 2, buyBtnWidth, buyBtnHeight, 12);
    buyBtnBg.fillStyle(0xffffff, 0.25);
    buyBtnBg.fillRoundedRect(
      -buyBtnWidth / 2, 
      buyBtnY - buyBtnHeight / 2, 
      buyBtnWidth, 
      buyBtnHeight / 2, 
      { tl: 12, tr: 12, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
    );
    modal.add(buyBtnBg);

    const buyBtnText = this.add.text(0, buyBtnY, 'КУПИТЬ PREMIUM', {
      fontSize: `${14 * s}px`,
      fontFamily: 'Orbitron, Arial',
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setShadow(0, 1, '#000000', 3, true, true);
    modal.add(buyBtnText);

    const buyHit = this.add.rectangle(0, buyBtnY, buyBtnWidth, buyBtnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    buyHit.on('pointerdown', () => {
      const success = battlePassManager.purchasePremium();
      if (success) {
        this.closeActiveModal();
        this.scene.restart();
      }
    });
    modal.add(buyHit);

    // Кнопка "Позже" (стилизованная)
    const closeY = modalHeight / 2 - 18 * s;
    const closeBtnWidth = 80 * s;
    const closeBtnHeight = 28 * s;
    
    const closeBtnBg = this.add.graphics();
    closeBtnBg.lineStyle(1, 0x6b7280, 0.6);
    closeBtnBg.strokeRoundedRect(-closeBtnWidth / 2, closeY - closeBtnHeight / 2, closeBtnWidth, closeBtnHeight, 8);
    modal.add(closeBtnBg);
    
    const closeText = this.add.text(0, closeY, 'Позже', {
      fontSize: `${12 * s}px`,
      fontFamily: 'Rajdhani, Arial',
      color: '#9ca3af',
    }).setOrigin(0.5);
    modal.add(closeText);
    
    const closeHit = this.add.rectangle(0, closeY, closeBtnWidth, closeBtnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => {
      this.closeActiveModal();
    });
    modal.add(closeHit);

    // Закрытие по клику на overlay
    overlay.on('pointerdown', () => {
      this.closeActiveModal();
    });
    
    // Анимация появления модалки
    this.tweens.add({
      targets: modal,
      alpha: 1,
      scale: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });
  }

  private closeActiveModal(): void {
    if (this.activeModalOverlay?.active) {
      this.tweens.add({
        targets: this.activeModalOverlay,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          this.activeModalOverlay?.destroy();
          this.activeModalOverlay = undefined;
        }
      });
    }
    
    if (this.activeModalContainer?.active) {
      this.tweens.add({
        targets: this.activeModalContainer,
        alpha: 0,
        scale: 0.9,
        duration: 150,
        onComplete: () => {
          this.activeModalContainer?.destroy(true);
          this.activeModalContainer = undefined;
        }
      });
    }
  }

  private updateTierCards(): void {
    // Пересоздать карточки тиров с обновленными данными
    // Это можно оптимизировать, но для простоты пересоздаем секцию
    if (this.progressSectionContainer) {
      this.progressSectionContainer.destroy();
    }
    this.createProgressSection();
  }

  private scrollToTier(tier: number): void {
    const season = getCurrentSeason();
    const tierWidth = 100 * this.s;
    const tierSpacing = 12 * this.s;
    const currentIndex = Math.max(0, tier - 2);
    const targetScrollX = Math.min(this.maxScrollX, currentIndex * (tierWidth + tierSpacing));
    
    this.tweens.add({
      targets: this,
      scrollX: targetScrollX,
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.scrollContainer.x = -this.scrollX;
      }
    });
  }

  private showXPGainAnimation(amount: number, source: string): void {
    const { width } = this.scale;
    const s = this.s;
    
    const sourceLabels: Record<string, string> = {
      'goal': '⚽ ГОЛ!',
      'match_win': '🏆 ПОБЕДА!',
      'match_loss': '💪 МАТЧ СЫГРАН',
      'match_draw': '🤝 НИЧЬЯ',
      'clean_sheet': '🧤 СУХОЙ МАТЧ!'
    };
    
    const label = sourceLabels[source] || source;
    
    const xpText = this.add.text(width / 2, 180 * s, `${label}\n+${amount} XP`, {
      fontSize: `${20 * s}px`,
      fontFamily: 'Arial Black',
      color: '#00ff00',
      stroke: '#000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5).setAlpha(0).setDepth(1000);
    
    this.tweens.add({
      targets: xpText,
      y: 150 * s,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: xpText,
          alpha: 0,
          y: 120 * s,
          duration: 500,
          delay: 1000,
          onComplete: () => xpText.destroy()
        });
      }
    });
  }

  private showTierUpAnimation(tier: number): void {
    const { width, height } = this.scale;
    const s = this.s;
    
    // Затемнение фона
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setAlpha(0).setDepth(2000);
    
    // Текст повышения тира
    const tierUpText = this.add.text(width / 2, height / 2, `🎉 TIER ${tier} 🎉`, {
      fontSize: `${32 * s}px`,
      fontFamily: 'Arial Black',
      color: '#ffd700',
      stroke: '#000',
      strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0).setScale(0.5).setDepth(2001);
    
    // Анимация
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200
    });
    
    this.tweens.add({
      targets: tierUpText,
      alpha: 1,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: [overlay, tierUpText],
          alpha: 0,
          duration: 500,
          delay: 1500,
          onComplete: () => {
            overlay.destroy();
            tierUpText.destroy();
          }
        });
      }
    });
  }

  shutdown(): void {
    this.isDestroyed = true;
    
    // Сбрасываем флаг модалки
    this.premiumModalShownThisSession = false;
    
    // Закрываем активную модалку
    this.closeActiveModal();
    
    // Отменяем дебаунс ресайза
    this.resizeDebounceTimer?.remove(false);
    this.resizeDebounceTimer = undefined;
    
    // ✅ Отписываемся от resize
    this.scale.off('resize', this.handleResize, this);
    
    // Отписываемся от событий BattlePassManager
    this.bpEventCallbacks.forEach(({ event, callback }) => {
      battlePassManager.off(event, callback as any);
    });
    this.bpEventCallbacks = [];
    
    // Уничтожаем SwipeManager
    this.swipeManager?.destroy();
    this.swipeManager = undefined;
    
    // Очищаем видимые тиры
    this.visibleTierNodes.forEach(node => {
      if (node?.active) {
        node.destroy(true);
      }
    });
    this.visibleTierNodes.clear();
    
    // Очищаем частицы
    if (this.emitter?.active) {
      this.emitter.destroy();
    }
  }
}
