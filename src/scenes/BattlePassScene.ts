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
import { AssetPackManager } from '../assets/AssetPackManager';
import { getRealUnitTextureKey } from '../utils/TextureHelpers';
import { ensureSafeImageLoading } from '../assets/loading/ImageLoader';
import { loadAudioMenu, loadAudioRewardClaim } from '../assets/loading/AudioLoader';

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
  private loadingUnitRewardIds = new Set<string>();

  // Event subscriptions
  private bpEventCallbacks: { event: string; callback: Function }[] = [];

  /** Нижняя граница блока прогресса — начало зоны горизонтального скролла наград */
  private scrollAreaStartY = 0;

  constructor() {
    super({ key: 'BattlePassScene' });
  }

  preload(): void {
    ensureSafeImageLoading(this);
    if (!this.textures.exists('ui_rewards_coins')) {
      this.load.image('ui_rewards_coins', 'assets/ui/icons/rewards/icon_currency_coins.png');
      this.load.image('ui_rewards_crystals', 'assets/ui/icons/rewards/icon_currency_crystals.png');
    }
    loadAudioMenu(this);
    loadAudioRewardClaim(this);
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
    const maxDim = Math.max(width, height);

    this.add.rectangle(width / 2, height / 2, width + 16, height + 16, 0x080c14, 1);

    const glow = this.add.graphics();
    glow.fillStyle(0x7c3aed, 0.1);
    glow.fillCircle(maxDim * 0.06, height * 0.16, maxDim * 0.52);
    glow.fillStyle(0x0891b2, 0.08);
    glow.fillCircle(width - maxDim * 0.02, height * 0.42, maxDim * 0.48);
    glow.fillStyle(0xfbbf24, 0.04);
    glow.fillCircle(width * 0.48, height * 0.95, maxDim * 0.38);
    glow.setBlendMode(Phaser.BlendModes.ADD);

    const gridSize = 48 * this.s;
    const gridKey = 'bp_grid_texture_v2';
    if (!this.textures.exists(gridKey)) {
      const gridCanvas = document.createElement('canvas');
      gridCanvas.width = Math.ceil(gridSize);
      gridCanvas.height = Math.ceil(gridSize);
      const ctx = gridCanvas.getContext('2d')!;
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(gridCanvas.width, 0);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, gridCanvas.height);
      ctx.stroke();
      this.textures.addCanvas(gridKey, gridCanvas);
    }

    const grid = this.add.tileSprite(0, 0, width, height, gridKey).setOrigin(0, 0).setAlpha(0.85);

    const vignetteTop = this.add.graphics();
    vignetteTop.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.65, 0.65, 0, 0);
    vignetteTop.fillRect(0, 0, width, height * 0.22);

    const vignetteBottom = this.add.graphics();
    vignetteBottom.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.55, 0.55);
    vignetteBottom.fillRect(0, height - height * 0.28, width, height * 0.28);
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

    const headerH = 102 * s;

    const hBg = this.add.graphics();
    hBg.fillGradientStyle(0x0a0f1c, 0x101827, 0x080c14, 0x080c14, 0.98, 0.98, 0.98, 0.98);
    hBg.fillRect(0, 0, width, headerH);
    hBg.fillStyle(season.themeColor, 0.08);
    hBg.fillRect(0, 0, width, 48 * s);
    hBg.lineStyle(3, 0xfbbf24, 0.45);
    hBg.lineBetween(0, headerH, width, headerH);
    hBg.lineStyle(1, 0x22d3ee, 0.35);
    hBg.lineBetween(0, headerH - 2, width, headerH - 2);

    this.add
      .text(width / 2, 38 * s, 'БОЕВОЙ ПРОПУСК', {
        fontSize: `${22 * s}px`,
        fontFamily: fonts.tech,
        color: '#fff6dc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const seasonLine = season.name.toUpperCase();
    this.add
      .text(width / 2, 62 * s, seasonLine, {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.primary,
        color: '#e9d5ff',
        letterSpacing: 3,
      })
      .setOrigin(0.5);

    const tierBadge = this.add.container(width / 2, 86 * s);
    const tierBg = this.add.graphics();
    tierBg.fillStyle(0x1a1528, 0.95);
    tierBg.fillRoundedRect(-58 * s, -13 * s, 116 * s, 26 * s, 12 * s);
    tierBg.lineStyle(1.5, 0xfbbf24, 0.75);
    tierBg.strokeRoundedRect(-58 * s, -13 * s, 116 * s, 26 * s, 12 * s);
    tierBadge.add(tierBg);
    tierBadge.add(
      this.add
        .text(0, 0, `УР. ${progress.currentTier} / ${season.maxTier}`, {
          fontSize: `${11 * s}px`,
          fontFamily: fonts.tech,
          color: '#fde68a',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    this.timerText = this.add.text(width - 16 * s, 22 * s, '', {
      fontSize: `${11 * s}px`,
      fontFamily: fonts.tech,
      color: '#fca5a5',
    }).setOrigin(1, 0);
    this.updateTimer();

    if (progress.isPremium) {
      const premBadge = this.add.container(width - 16 * s, 52 * s);
      const premBg = this.add.graphics();
      premBg.fillGradientStyle(0xfef3c7, 0xfbbf24, 0xd97706, 0xb45309, 1);
      premBg.fillRoundedRect(-62 * s, -11 * s, 62 * s, 22 * s, 11 * s);
      premBg.lineStyle(1, 0xfffbeb, 0.9);
      premBg.strokeRoundedRect(-62 * s, -11 * s, 62 * s, 22 * s, 11 * s);
      premBadge.add(premBg);
      premBadge.add(
        this.add
          .text(-31 * s, 0, 'PREMIUM', {
            fontSize: `${8 * s}px`,
            fontFamily: fonts.tech,
            color: '#1a0f08',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );
    }
  }

  /** Единые координаты панели прогресса (для дорожки наград и updateProgressBar). */
  private getBattlePassProgressBarLayout(): {
    sectionY: number;
    sectionHeight: number;
    barX: number;
    barY: number;
    barHeight: number;
  } {
    const s = this.s;
    const sectionY = 102 * s;
    const sectionHeight = 132 * s;
    return {
      sectionY,
      sectionHeight,
      barX: 28 * s,
      barY: sectionY + 86 * s,
      barHeight: 18 * s,
    };
  }

  private createProgressSection(): void {
    const { width } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const progress = battlePassManager.getProgress();
    const season = getCurrentSeason();
    const xpInfo = getXPProgress(progress.currentXP, progress.currentTier);
    const ly = this.getBattlePassProgressBarLayout();
    const { sectionY, sectionHeight, barX, barY, barHeight } = ly;

    this.progressSectionContainer = this.add.container(0, 0);

    const panelBg = this.add.graphics();
    panelBg.fillGradientStyle(0x111b2e, 0x141e35, 0x0c1220, 0x101828, 1, 1, 1, 1);
    panelBg.fillRoundedRect(14 * s, sectionY, width - 28 * s, sectionHeight, 18 * s);
    panelBg.lineStyle(2, 0xfbbf24, 0.82);
    panelBg.strokeRoundedRect(14 * s, sectionY, width - 28 * s, sectionHeight, 18 * s);
    panelBg.lineStyle(1, 0x22d3ee, 0.38);
    panelBg.strokeRoundedRect(16 * s, sectionY + 2 * s, width - 32 * s, sectionHeight - 4 * s, 16 * s);

    panelBg.fillStyle(season.themeColor, 0.12);
    panelBg.fillRoundedRect(18 * s, sectionY + 4 * s, width - 36 * s, 36 * s, 12 * s);

    this.progressSectionContainer.add(panelBg);

    this.progressSectionContainer.add(
      this.add.text(26 * s, sectionY + 14 * s, `СЕЗОН · ${season.name.toUpperCase()}`, {
        fontSize: `${12 * s}px`,
        fontFamily: fonts.tech,
        color: '#bae6fd',
      })
    );

    if (progress.isPremium) {
      const premBadge = this.add.container(width - 30 * s, sectionY + 24 * s);
      const badgeG = this.add.graphics();
      badgeG.fillGradientStyle(0xfff1b8, 0xfbbf24, 0xd97706, 0xb45309, 1);
      badgeG.fillRoundedRect(-78 * s, -10 * s, 78 * s, 20 * s, 8 * s);
      premBadge.add(badgeG);
      premBadge.add(
        this.add.text(-39 * s, 0, 'VIP АКТИВЕН', {
          fontSize: `${9 * s}px`,
          fontFamily: fonts.tech,
          color: '#1a0f08',
          fontStyle: 'bold',
        }).setOrigin(0.5)
      );
      this.progressSectionContainer.add(premBadge);
    }

    this.tierText = this.add
      .text(width / 2, sectionY + 38 * s, `УРОВЕНЬ ${progress.currentTier}`, {
        fontSize: `${30 * s}px`,
        fontFamily: fonts.tech,
        color: '#fffbeb',
        fontStyle: 'bold',
        stroke: '#1e0f05',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.progressSectionContainer.add(this.tierText);

    this.progressBarWidth = width - 56 * s;

    const barTrack = this.add.graphics();
    barTrack.fillStyle(0x030712, 1);
    barTrack.fillRoundedRect(barX, barY, this.progressBarWidth, barHeight, 9 * s);
    barTrack.lineStyle(1, 0x334155, 0.85);
    barTrack.strokeRoundedRect(barX, barY, this.progressBarWidth, barHeight, 9 * s);
    this.progressSectionContainer.add(barTrack);

    const fillWidth = Math.max(12 * s, this.progressBarWidth * xpInfo.progress);
    this.progressBarFill = this.add
      .rectangle(barX + 2 * s, barY + barHeight / 2, fillWidth - 4 * s, barHeight - 4 * s, 0xf59e0b)
      .setOrigin(0, 0.5);
    if (this.progressBarFill.postFX) {
      this.progressBarFill.postFX.addGradient(0xfbbf24, 0xf97316, 0);
      this.progressBarFill.postFX.addGlow(0xfbbf24, 1, 0, false, 0.06, 8);
    }
    this.progressSectionContainer.add(this.progressBarFill);

    this.progressText = this.add
      .text(barX + this.progressBarWidth / 2, barY + barHeight / 2, `${Math.floor(xpInfo.current)} / ${xpInfo.needed} XP`, {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.tech,
        color: '#f8fafc',
        stroke: '#020617',
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    this.progressSectionContainer.add(this.progressText);

    this.scrollAreaStartY = sectionY + sectionHeight + 12 * s;

    this.createClaimAllButton(width - 106 * s, barY + barHeight / 2);
  }

  private createDualTrackScroll(): void {
    const { width, height } = this.scale;
    const s = this.s;
    const fonts = getFonts();
    const season = getCurrentSeason();
    const progress = battlePassManager.getProgress();

    const startY = this.scrollAreaStartY > 0 ? this.scrollAreaStartY : 248 * s;
    const scrollAreaHeight = height - startY - 88 * s;

    // Сохраняем размеры для lazy loading
    this.tierWidth = 128 * s;
    this.tierSpacing = 22 * s;
    this.totalItemWidth = this.tierWidth + this.tierSpacing;
    
    this.trackHeight = (scrollAreaHeight - 60 * s) / 2;
    this.freeTrackY = 40 * s;
    this.premiumTrackY = this.freeTrackY + this.trackHeight + 20 * s;

    // --- Подписи дорожек ---
    const fw = 148 * s;
    const fh = 24 * s;
    const fx = 16 * s;
    const freeY = startY + this.freeTrackY - 26 * s;

    const freeBg = this.add.graphics();
    freeBg.fillStyle(0x0f172a, 0.92);
    freeBg.fillRoundedRect(fx, freeY, fw, fh, 12 * s);
    freeBg.lineStyle(1.5, 0x38bdf8, 0.9);
    freeBg.strokeRoundedRect(fx, freeY, fw, fh, 12 * s);
    this.add.text(fx + fw / 2, freeY + fh / 2, 'БЕСПЛАТНАЯ ДОРОЖКА', {
      fontSize: `${10 * s}px`,
      fontFamily: fonts.tech,
      color: '#e0f2fe',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const px = fx;
    const premiumY = startY + this.premiumTrackY - 26 * s;
    const pw = progress.isPremium ? fw : fw + 72 * s;

    const premBg = this.add.graphics();
    premBg.fillStyle(0x1a1005, 0.92);
    premBg.fillRoundedRect(px, premiumY, pw, fh, 12 * s);
    premBg.lineStyle(1.5, 0xfbbf24, 0.95);
    premBg.strokeRoundedRect(px, premiumY, pw, fh, 12 * s);
    premBg.fillStyle(0xfbbf24, 0.06);
    premBg.fillRoundedRect(px + 2, premiumY + 2, pw - 4, fh / 2 - 2, { tl: 10 * s, tr: 10 * s, bl: 0, br: 0 });

    const premLine = progress.isPremium ? 'GALAXY PASS' : 'GALAXY PASS  ·  НЕДОСТУПНО';

    this.add.text(px + pw / 2, premiumY + fh / 2, premLine, {
      fontSize: `${10 * s}px`,
      fontFamily: fonts.tech,
      color: '#fff6d6',
      fontStyle: 'bold',
    }).setOrigin(0.5);

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
      /** Первичная отрисовка: запас дорожек, чтобы не было «дыр» при скролле */
      const initialEndTier = Math.min(Math.max(Math.ceil(progress.currentTier / 12) * 14, 20), season.maxTier);
      
      for (let tier = 1; tier <= initialEndTier; tier++) {
        if (this.visibleTierNodes.has(tier)) continue;
        
        const tierData = season.tiers.find(t => t.tier === tier);
        if (!tierData) continue;
        
        const tierContainer = this.add.container(0, 0).setDepth(10);
        const tierCX =
          (tier - 1) * this.totalItemWidth + this.tierWidth / 2 + 30 * this.s;
        tierContainer.setData('tierCenterX', tierCX);

        if (tierData.freeReward) {
          const freeNode = this.createRewardNode(
            tierData, tierData.freeReward, tierCX, this.freeTrackY,
            this.tierWidth, this.trackHeight - 10 * this.s, false, progress
          );
          if (freeNode) tierContainer.add(freeNode);
        }

        if (tierData.premiumReward) {
          const premiumNode = this.createRewardNode(
            tierData, tierData.premiumReward, tierCX, this.premiumTrackY,
            this.tierWidth, this.trackHeight - 10 * this.s, true, progress
          );
          if (premiumNode) tierContainer.add(premiumNode);
        }

        const tierNumY = (this.freeTrackY + this.premiumTrackY) / 2;
        const isHighlight = tier === progress.currentTier;
        const markW = 34 * this.s;
        const markH = 26 * this.s;
        const pill = this.add.graphics();
        pill.fillStyle(isHighlight ? 0x422006 : 0x111b26, isHighlight ? 0.96 : 0.9);
        pill.fillRoundedRect(
          tierCX - markW / 2,
          tierNumY - markH / 2,
          markW,
          markH,
          10 * this.s
        );
        pill.lineStyle(isHighlight ? 2 : 1, isHighlight ? 0xfbbf24 : 0x475569, isHighlight ? 1 : 0.75);
        pill.strokeRoundedRect(
          tierCX - markW / 2,
          tierNumY - markH / 2,
          markW,
          markH,
          10 * this.s
        );
        tierContainer.add(pill);
        tierContainer.add(
          this.add
            .text(tierCX, tierNumY, `${tier}`, {
              fontSize: `${13 * this.s}px`,
              fontFamily: fonts.tech,
              color: isHighlight ? '#fffbeb' : '#94a3b8',
              fontStyle: 'bold',
            })
            .setOrigin(0.5)
            .setDepth(16)
        );

        this.scrollContainer.add(tierContainer);
        this.visibleTierNodes.set(tier, tierContainer);
      }
      
      if (import.meta.env.DEV) {
        console.log(`[BattlePass] Initial force-load: ${this.visibleTierNodes.size} tiers`);
      }

      this.updateVisibleTiers();
    });
  }

  private updateVisibleTiers(): void {
    // Защита от вызова до инициализации или после уничтожения
    if (this.isDestroyed || !this.scrollContainer?.active) return;
    if (!this.totalItemWidth || this.totalItemWidth <= 0) return;

    const { width } = this.scale;
    const season = getCurrentSeason();
    const step = this.totalItemWidth;

    /*
     * Видимость тиров считается в координатах контента: scrollContainer.x = -scrollX.
     * Тир занимает ~step px по горизонтали. Раньше использовался знак −scrollX, из‑за чего
     * при любом горизонтальном скролле оставалось ~7 дорожек вместо догрузки 8–30.
     */
    const padTiers = Math.max(10, Math.ceil(width / Math.max(step, 1)) + 10);
    const startTier = Math.max(1, Math.floor(this.scrollX / step) + 1 - padTiers);
    const endTier = Math.min(season.maxTier, Math.ceil((this.scrollX + width) / step) + padTiers);
    
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
    const fonts = getFonts();

    // Создаём новые видимые тиры
    for (let tier = startTier; tier <= endTier; tier++) {
      if (this.visibleTierNodes.has(tier)) continue;
      
      const tierData = season.tiers.find(t => t.tier === tier);
      if (!tierData) continue;

      const tierContainer = this.add.container(0, 0).setDepth(10);
      const tierCX =
        (tier - 1) * this.totalItemWidth + this.tierWidth / 2 + 30 * this.s;
      tierContainer.setData('tierCenterX', tierCX);

      // FREE reward (верхняя дорожка)
      if (tierData.freeReward) {
        const freeNode = this.createRewardNode(
          tierData,
          tierData.freeReward,
          tierCX,
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
          tierCX,
          this.premiumTrackY,
          this.tierWidth,
          this.trackHeight - 10 * this.s,
          true,
          progress
        );
        if (premiumNode) tierContainer.add(premiumNode);
      }

      const tierNumY = (this.freeTrackY + this.premiumTrackY) / 2;
      const isHighlight = tier === progress.currentTier;
      const markW = 34 * this.s;
      const markH = 26 * this.s;
      const pill = this.add.graphics();
      pill.fillStyle(isHighlight ? 0x422006 : 0x111b26, isHighlight ? 0.96 : 0.9);
      pill.fillRoundedRect(tierCX - markW / 2, tierNumY - markH / 2, markW, markH, 10 * this.s);
      pill.lineStyle(isHighlight ? 2 : 1, isHighlight ? 0xfbbf24 : 0x475569, isHighlight ? 1 : 0.75);
      pill.strokeRoundedRect(tierCX - markW / 2, tierNumY - markH / 2, markW, markH, 10 * this.s);
      tierContainer.add(pill);
      tierContainer.add(
        this.add
          .text(tierCX, tierNumY, `${tier}`, {
            fontSize: `${13 * this.s}px`,
            fontFamily: fonts.tech,
            color: isHighlight ? '#fffbeb' : '#94a3b8',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(16)
      );

      this.scrollContainer.add(tierContainer);
      this.visibleTierNodes.set(tier, tierContainer);
    }
  }

  /**
   * После догрузки PNG наград уже созданные контейнеры тиров не пересоздаются
   * (updateVisibleTiers пропускает tier при visibleTierNodes.has). Сносим видимые узлы и строим заново.
   */
  private rebuildVisibleBattlePassTierNodes(): void {
    if (this.isDestroyed || !this.scrollContainer?.active) return;
    this.visibleTierNodes.forEach((node) => {
      if (node?.active) node.destroy(true);
    });
    this.visibleTierNodes.clear();
    this.lastVisibleRange = { start: -1, end: -1 };
    this.updateVisibleTiers();
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
  private requestBattlePassUnitTexture(unitId: string): void {
    if (this.loadingUnitRewardIds.has(unitId)) {
      return;
    }

    const unit = getUnitById(unitId);
    if (!unit || getRealUnitTextureKey(this, unit)) {
      return;
    }

    this.loadingUnitRewardIds.add(unitId);
    void AssetPackManager.loadUnitAssets(this, [unitId])
      .then(() => {
        this.loadingUnitRewardIds.delete(unitId);
        if (this.scene.isActive() && !this.isDestroyed) {
          this.rebuildVisibleBattlePassTierNodes();
        }
      })
      .catch((error) => {
        this.loadingUnitRewardIds.delete(unitId);
        console.warn('[BattlePassScene] Failed to lazy-load unit reward PNG:', error);
      });
  }

  private createRewardNode(
    tier: BattlePassTier, reward: BattlePassReward,
    x: number, y: number, w: number, h: number,
    isPremium: boolean, progress: any
  ): Phaser.GameObjects.Container {
    const s = this.s;
    const fonts = getFonts();
    const container = this.add.container(x, y);

    /* Центр колонки тира совпадает с container.x; рисуем карточку симметрично [-w/2 .. +w/2],
     * иначе позиция считалась как «левый край» и слоты наезжали друг на друга. */
    const L = -w / 2;
    const R = w / 2;
    const cx = 0;

    const isUnlocked = tier.tier <= progress.currentTier;
    const isClaimed = isPremium
      ? progress.claimedPremiumTiers.includes(tier.tier)
      : progress.claimedFreeTiers.includes(tier.tier);
    const canClaim = battlePassManager.canClaimReward(tier.tier, isPremium);
    const isLockedByPremium = isPremium && !progress.isPremium;
    const isFuture = !isUnlocked;

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

    const cardBg = this.add.graphics();

    if (isPremium && !isFuture && !isClaimed && !isLockedByPremium) {
      cardBg.fillStyle(glowColor, 0.12);
      cardBg.fillRoundedRect(L - 4, -4, w + 8, h + 8, 14 * s);
    }

    cardBg.fillStyle(baseColor, 1);
    cardBg.fillRoundedRect(L, 0, w, h, 10 * s);

    cardBg.fillStyle(accentColor, 0.08);
    cardBg.fillRoundedRect(L, 0, w, h * 0.35, { tl: 10 * s, tr: 10 * s, bl: 0, br: 0 });

    const borderWidth = canClaim ? 2.5 : isPremium ? 1.5 : 1;
    cardBg.lineStyle(borderWidth, accentColor, canClaim ? 1 : 0.5);
    cardBg.strokeRoundedRect(L, 0, w, h, 10 * s);

    if (isPremium && !isClaimed && !isFuture) {
      cardBg.lineStyle(1.5, glowColor, 0.6);
      cardBg.beginPath();
      cardBg.moveTo(L, 12 * s);
      cardBg.lineTo(L, 0);
      cardBg.lineTo(L + 12 * s, 0);
      cardBg.moveTo(R, h - 12 * s);
      cardBg.lineTo(R, h);
      cardBg.lineTo(R - 12 * s, h);
      cardBg.strokePath();
    }

    container.add(cardBg);

    if (canClaim) {
      const pulseGlow = this.add.graphics();
      pulseGlow.lineStyle(3, glowColor, 0.5);
      pulseGlow.strokeRoundedRect(L - 2, -2, w + 4, h + 4, 12 * s);
      container.add(pulseGlow);

      this.tweens.add({
        targets: pulseGlow,
        alpha: { from: 0.7, to: 0.15 },
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    if (isLockedByPremium || isFuture) {
      const lockOverlay = this.add.graphics();
      lockOverlay.fillStyle(0x000000, 0.4);
      lockOverlay.fillRoundedRect(L, 0, w, h, 10 * s);
      lockOverlay.lineStyle(1, 0xffffff, 0.06);
      lockOverlay.strokeRoundedRect(L + 1, 1, w - 2, h - 2, 9 * s);
      container.add(lockOverlay);
    }

    const iconY = h * 0.36;
    const unitIconSize = 50 * s;
    const regularIconSize = 36 * s;

    if (tier.unitRarity && !isClaimed && !isFuture && !isLockedByPremium) {
      const rarityGlow = this.add.graphics();
      const rarityColor = this.getRarityColor(tier.unitRarity);
      rarityGlow.fillStyle(rarityColor, 0.2);
      rarityGlow.fillCircle(cx, iconY, unitIconSize * 0.7);
      container.add(rarityGlow);

      this.tweens.add({
        targets: rarityGlow,
        alpha: { from: 0.2, to: 0.08 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
      });
    }

    const iconAlpha = isFuture || isLockedByPremium ? 0.35 : 1;

    if (reward.type === 'unit' && reward.itemId) {
      const unit = getUnitById(reward.itemId);
      if (unit) {
        const textureKey = getRealUnitTextureKey(this, unit);
        if (textureKey && this.textures.exists(textureKey)) {
          const unitImg = this.add.image(cx, iconY, textureKey);
          unitImg.setDisplaySize(unitIconSize, unitIconSize);
          unitImg.setAlpha(iconAlpha);
          container.add(unitImg);
        } else {
          this.requestBattlePassUnitTexture(unit.id);
          container.add(
            this.add
              .text(cx, iconY, '🎯', { fontSize: `${34 * s}px` })
              .setOrigin(0.5)
              .setAlpha(iconAlpha)
          );
        }
      }
    } else {
      const iconKey = this.getRewardIconKey(reward);
      if (iconKey && this.textures.exists(iconKey)) {
        const icon = this.add.image(cx, iconY, iconKey);
        icon.setDisplaySize(regularIconSize, regularIconSize);
        icon.setAlpha(iconAlpha);
        container.add(icon);
      } else {
        const emoji = this.add
          .text(cx, iconY, this.getRewardEmoji(reward), {
            fontSize: `${20 * s}px`,
          })
          .setOrigin(0.5)
          .setAlpha(iconAlpha);
        container.add(emoji);
      }
    }

    const valueY = h * 0.65;
    const textColor = tier.isUnitReward
      ? this.getRarityHexColor(tier.unitRarity)
      : isPremium
        ? '#e9d5ff'
        : '#cbd5e1';

    const valueText = this.add
      .text(cx, valueY, this.getRewardValueText(reward), {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.primary,
        color: isFuture || isLockedByPremium ? '#64748b' : textColor,
        align: 'center',
        wordWrap: { width: w - 6 },
      })
      .setOrigin(0.5);
    container.add(valueText);

    const statusY = h - 16 * s;

    if (isClaimed) {
      const checkBg = this.add.graphics();
      checkBg.fillStyle(0x22c55e, 1);
      checkBg.fillCircle(cx, statusY, 10 * s);
      container.add(checkBg);

      container.add(
        this.add
          .text(cx, statusY, '✓', {
            fontSize: `${11 * s}px`,
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );
    } else if (canClaim) {
      const btnW = w - 14 * s;
      const btnH = 20 * s;
      const btnColor = isPremium ? 0xfbbf24 : 0x22d3ee;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(btnColor, 1);
      btnBg.fillRoundedRect(cx - btnW / 2, statusY - btnH / 2, btnW, btnH, 4 * s);

      btnBg.fillStyle(0xffffff, 0.15);
      btnBg.fillRoundedRect(
        cx - btnW / 2 + 2,
        statusY - btnH / 2 + 1,
        btnW - 4,
        btnH / 2 - 1,
        { tl: 3 * s, tr: 3 * s, bl: 0, br: 0 }
      );

      const btnText = this.add
        .text(cx, statusY, 'ЗАБРАТЬ', {
          fontSize: `${8 * s}px`,
          fontFamily: fonts.tech,
          color: '#000000',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      const hitArea = this.add
        .rectangle(cx, statusY, btnW, btnH)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation();
        this.claimReward(tier.tier, isPremium);
      });

      container.add(btnBg);
      container.add(btnText);
      container.add(hitArea);
    } else if (isLockedByPremium) {
      container.add(
        this.add
          .text(cx, statusY, '🔒 VIP', {
            fontSize: `${8 * s}px`,
            color: '#a855f7',
            fontFamily: fonts.tech,
          })
          .setOrigin(0.5)
      );

      const hitArea = this.add
        .rectangle(cx, h / 2, w, h)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        if (!this.premiumModalShownThisSession) {
          this.premiumModalShownThisSession = true;
          this.showPremiumModal();
        }
      });
      container.add(hitArea);
    }

    if (isPremium && !isClaimed && !isFuture && !isLockedByPremium) {
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x7c3aed, 1);
      badgeBg.fillRoundedRect(R - 24 * s, 3 * s, 21 * s, 12 * s, 2 * s);
      container.add(badgeBg);

      container.add(
        this.add
          .text(R - 13.5 * s, 9 * s, 'VIP', {
            fontSize: `${6 * s}px`,
            color: '#fef3c7',
            fontFamily: fonts.tech,
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );
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
    
    btn.add(this.add.text(0, 0, 'ЗАБРАТЬ', { fontSize: `${9 * s}px`, fontFamily: fonts.tech, color: '#1a0f08', fontStyle: 'bold' }).setOrigin(0.5));

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
    bg.fillGradientStyle(0x1e293b, 0x151b2e, 0x111b2e, 0x151b2e, 1);
    bg.fillRoundedRect(-120 * s, -100 * s, 240 * s, 200 * s, 20 * s);
    bg.lineStyle(3, 0xfbbf24, 0.9);
    bg.strokeRoundedRect(-120 * s, -100 * s, 240 * s, 200 * s, 20 * s);
    bg.lineStyle(1, 0x22d3ee, 0.45);
    bg.strokeRoundedRect(-118 * s, -98 * s, 236 * s, 196 * s, 18 * s);
    popup.add(bg);

    // 5. Header Text
    const titleText = this.add.text(0, -70 * s, 'НАГРАДА!', {
      fontSize: `${22 * s}px`,
      fontFamily: fonts.tech,
      color: '#fde68a',
      stroke: '#1a0f08',
      strokeThickness: 4,
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
             const texture = getRealUnitTextureKey(this, unit);
             if (!texture) this.requestBattlePassUnitTexture(unit.id);
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
    const tapText = this.add.text(0, 140 * s, 'Нажми для продолжения', {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.primary,
      color: '#bae6fd',
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
    const fonts = getFonts();
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

      const statusText = this.add.text(0, 0, '✦ PREMIUM АКТИВЕН ✦', {
        fontSize: `${14 * s}px`,
        fontFamily: fonts.tech,
        fontStyle: 'bold',
        color: '#fff6d6',
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
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
      const btnText = this.add.text(0, 0, '✦ КУПИТЬ GALAXY PASS ✦', {
        fontSize: `${15 * s}px`,
        fontFamily: fonts.tech,
        fontStyle: 'bold',
        color: '#fffbeb',
      }).setOrigin(0.5).setShadow(0, 2, '#000000', 6, true, true);
      container.add(btnText);

      // Цена под кнопкой
      const priceText = this.add.text(0, btnHeight / 2 + 16 * s, `💎 ${season.premiumPrice.crystals} кристаллов`, {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.primary,
        color: '#ddd6fe',
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
    const bx = 22 * s;
    const by = 24 * s;

    const backWrap = this.add.container(bx, by).setDepth(120);
    const disc = this.add.graphics();
    disc.fillStyle(0x1e293b, 0.92);
    disc.fillCircle(0, 0, 20 * s);
    disc.lineStyle(1.5, 0xfbbf24, 0.55);
    disc.strokeCircle(0, 0, 20 * s);
    backWrap.add(disc);
    const lab = this.add.text(0, 0, '←', {
      fontSize: `${20 * s}px`,
      fontFamily: fonts.primary,
      color: '#fef3c7',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    backWrap.add(lab);
    const hit = this.add.circle(0, 0, 22 * s, 0x000000, 0).setInteractive({ useHandCursor: true });
    backWrap.add(hit);
    hit.on('pointerdown', () => this.handleBack());
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
    
    const scrollTop = this.scrollAreaStartY > 0 ? this.scrollAreaStartY : 248 * this.s;
    const endY = this.scale.height - 82 * this.s;

    if (pointer.y > scrollTop && pointer.y < endY) {
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

  update(_time: number, _delta: number): void {
    if (!this.scrollContainer?.active || this.visibleTierNodes.size === 0) {
      return;
    }

    this.prevScrollX = this.scrollX;

    // Стабильная дорожка: без наклона и без карусельного масштаба (иначе визуальные наложения)
    this.scrollContainer.rotation = 0;
    this.visibleTierNodes.forEach((child) => {
      if (child?.active && child.type === 'Container') {
        child.setScale(1);
      }
    });
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
      const ly = this.getBattlePassProgressBarLayout();
      const fillWidth = Math.max(
        12 * this.s,
        this.progressBarWidth * xpInfo.progress - 4 * this.s
      );
      const pad = 2 * this.s;

      this.tweens.add({
        targets: this.progressBarFill,
        width: fillWidth,
        x: ly.barX + pad,
        duration: 300,
        ease: 'Power2',
      });
    }
    
    // Обновить текст
    if (this.progressText) {
      this.progressText.setText(`${Math.floor(xpInfo.current)} / ${xpInfo.needed} XP`);
    }
    
    if (this.tierText) {
      this.tierText.setText(`УРОВЕНЬ ${progress.currentTier}`);
    }
  }

  // Helper to refresh UI without full scene restart (Smoother UX)
  private updateUIState(): void {
      if (this.scrollContainer) {
        this.visibleTierNodes.clear();
        this.lastVisibleRange = { start: -1, end: -1 };
        this.scrollContainer.removeAll(true);
        this.createDualTrackScroll(); // Re-render tracks to show 'claimed' state
        this.updateVisibleTiers();
      }
      this.updateProgressBar();
  }

  private createClaimAllButton(x: number, y: number): void {
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

    const bg = this.add.graphics();
    bg.fillGradientStyle(0xa7f3d0, 0x4ade80, 0x16a34a, 0x14532d, 1);
    bg.fillRoundedRect(-64 * s, -16 * s, 128 * s, 32 * s, 10 * s);
    bg.lineStyle(2, 0xd1fae5, 0.95);
    bg.strokeRoundedRect(-64 * s, -16 * s, 128 * s, 32 * s, 10 * s);
    btn.add(bg);

    btn.add(
      this.add
        .text(0, 0, `ЗАБРАТЬ ВСЁ (${claimableCount})`, {
          fontSize: `${11 * s}px`,
          fontFamily: fonts.tech,
          color: '#1a0f08',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    btn.setSize(128 * s, 32 * s).setInteractive({ useHandCursor: true });
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
    const fonts = getFonts();

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
    
    bg.lineStyle(2, 0xfbbf24, 0.82);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
    bg.lineStyle(1, 0x22d3ee, 0.42);
    bg.strokeRoundedRect(-modalWidth / 2 + 3, -modalHeight / 2 + 3, modalWidth - 6, modalHeight - 6, 18);
    
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
    const title = this.add.text(0, -modalHeight / 2 + 110 * s, 'GALAXY PASS', {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      fontStyle: 'bold',
      color: '#fde68a',
      align: 'center',
    }).setOrigin(0.5).setShadow(0, 2, '#000000', 4, true, true);
    modal.add(title);

    // Описание
    const description = this.add.text(0, -modalHeight / 2 + 155 * s, 
      'Получите эксклюзивные награды,\nредких юнитов и особые бонусы!', {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.primary,
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
        fontFamily: fonts.primary,
      }).setOrigin(0.5);
      modal.add(benefitText);
    });

    // Цена
    const priceY = modalHeight / 2 - 110 * s;
    const priceText = this.add.text(0, priceY, `💎 ${season.premiumPrice.crystals} кристаллов`, {
      fontSize: `${16 * s}px`,
      fontFamily: fonts.tech,
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

    const buyBtnText = this.add.text(0, buyBtnY, 'ОФОРМИТЬ', {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.tech,
      fontStyle: 'bold',
      color: '#fffbeb',
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
      fontFamily: fonts.primary,
      color: '#cbd5e1',
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
    if (!this.scrollContainer?.active) return;
    const step = this.totalItemWidth > 0 ? this.totalItemWidth : 150 * this.s;
    const currentIndex = Math.max(0, tier - 2);
    const targetScrollX = Math.min(this.maxScrollX, currentIndex * step);

    this.tweens.add({
      targets: this,
      scrollX: targetScrollX,
      duration: 500,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        this.scrollContainer.x = -this.scrollX;
        this.updateVisibleTiers();
      },
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
