// ✅ ИЗМЕНЕНО: Удалена кнопка "Назад", добавлен SwipeNavigationManager, улучшена типографика

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor, getFonts, TYPOGRAPHY, getTextStyle, applyTextShadow } from '../config/themes';
import { playerData, getRankByLevel, getXPForLevel } from '../data/PlayerData';
import {
  getBallSkin,
  getFieldSkin,
  getRarityName,
  BallSkinData,
  FieldSkinData,
} from '../data/SkinsCatalog';
import { getUnit } from '../data/UnitsCatalog';
import { i18n } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { AudioManager } from '../managers/AudioManager';
import { FACTIONS, FactionId, SWIPE_NAVIGATION } from '../constants/gameConstants';
import { hapticSelection, hapticImpact } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';

type ProfileTab = 'stats' | 'trophies' | 'achievements';

export class ProfileScene extends Phaser.Scene {
  private currentTab: ProfileTab = 'stats';
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private scrollVelocity: number = 0;
  private holoRing?: Phaser.GameObjects.Graphics;
  
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  private contentTop = 0;
  private visibleAreaBottom = 0;

  // Swipe Navigation
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isSwipeActive: boolean = false;
  private swipeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private swipeArrow?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'ProfileScene' });
  }

  create(): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;

    console.log('[ProfileScene] Insets - Top:', this.topInset, 'Bottom:', this.bottomInset);

    AudioManager.getInstance().init(this);

    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.isDragging = false;
    this.isSwipeActive = false;

    const { height } = this.cameras.main;
    // ✅ ИЗМЕНЕНО: Убран отступ под кнопку "Назад"
    this.visibleAreaBottom = height - 20 - this.bottomInset;

    this.createBackground();
    this.createHeader();
    this.createPlayerCard();
    this.createTabs();
    this.createContentArea();
    // ✅ УДАЛЕНО: this.createBottomBackButton();
    this.createSwipeIndicator();
    this.renderContent();
    this.setupScrolling();
    this.setupSwipeNavigation();
  }

  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.contentContainer.y = this.contentTop - this.scrollY;
    }
  }

  // ========== SWIPE NAVIGATION ==========

  private createSwipeIndicator(): void {
    const { height } = this.cameras.main;
    const colors = getColors();

    // Индикатор у левого края
    this.swipeIndicator = this.add.graphics();
    this.swipeIndicator.setDepth(50);

    // Вертикальная полоска
    this.swipeIndicator.fillStyle(
      SWIPE_NAVIGATION.INDICATOR_COLOR,
      SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
    );
    this.swipeIndicator.fillRoundedRect(
      0,
      this.headerHeight + 20,
      SWIPE_NAVIGATION.INDICATOR_WIDTH,
      height - this.headerHeight - 60 - this.bottomInset,
      2
    );

    // Пульсация
    this.tweens.add({
      targets: this.swipeIndicator,
      alpha: { from: 0.3, to: 0.6 },
      duration: SWIPE_NAVIGATION.PULSE_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Overlay для эффекта свайпа (изначально скрыт)
    this.swipeOverlay = this.add.graphics();
    this.swipeOverlay.setDepth(200);
    this.swipeOverlay.setVisible(false);

    // Контейнер для стрелки "назад"
    this.swipeArrow = this.add.container(40, height / 2);
    this.swipeArrow.setDepth(201);
    this.swipeArrow.setVisible(false);
    this.swipeArrow.setAlpha(0);

    const arrowBg = this.add.graphics();
    arrowBg.fillStyle(0x000000, 0.7);
    arrowBg.fillCircle(0, 0, 28);
    arrowBg.lineStyle(2, colors.uiAccent, 0.8);
    arrowBg.strokeCircle(0, 0, 28);
    this.swipeArrow.add(arrowBg);

    const arrowText = this.add.text(0, 0, '◀', {
      fontSize: `${SWIPE_NAVIGATION.ARROW_SIZE}px`,
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    this.swipeArrow.add(arrowText);
  }

  private setupSwipeNavigation(): void {
    const { width, height } = this.cameras.main;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Проверяем, что касание в зоне левого края
      if (pointer.x <= SWIPE_NAVIGATION.EDGE_ZONE_WIDTH) {
        this.swipeStartX = pointer.x;
        this.swipeStartY = pointer.y;
        this.swipeStartTime = Date.now();
        this.isSwipeActive = true;

        // Подсветка индикатора
        if (this.swipeIndicator) {
          this.swipeIndicator.clear();
          this.swipeIndicator.fillStyle(
            SWIPE_NAVIGATION.INDICATOR_COLOR,
            SWIPE_NAVIGATION.INDICATOR_ALPHA_ACTIVE
          );
          this.swipeIndicator.fillRoundedRect(
            0,
            this.headerHeight + 20,
            SWIPE_NAVIGATION.INDICATOR_WIDTH + 2,
            height - this.headerHeight - 60 - this.bottomInset,
            2
          );
        }

        hapticSelection();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaY = Math.abs(pointer.y - this.swipeStartY);

      // Проверяем вертикальный дрифт
      if (deltaY > SWIPE_NAVIGATION.MAX_VERTICAL_DRIFT) {
        this.cancelSwipe();
        return;
      }

      if (deltaX > 10) {
        // Блокируем скролл
        this.isDragging = false;

        // Показываем прогресс свайпа
        const progress = Math.min(deltaX / (width * SWIPE_NAVIGATION.THRESHOLD_PERCENT), 1);
        this.showSwipeProgress(progress, deltaX);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaTime = Date.now() - this.swipeStartTime;
      const velocity = deltaX / (deltaTime / 1000);

      const thresholdDistance = width * SWIPE_NAVIGATION.THRESHOLD_PERCENT;

      // Проверяем условия срабатывания
      if (deltaX >= thresholdDistance || velocity >= SWIPE_NAVIGATION.VELOCITY_THRESHOLD) {
        this.completeSwipe();
      } else {
        this.cancelSwipe();
      }
    });
  }

  private showSwipeProgress(progress: number, deltaX: number): void {
    const { width, height } = this.cameras.main;

    // Overlay с градиентом
    if (this.swipeOverlay) {
      this.swipeOverlay.setVisible(true);
      this.swipeOverlay.clear();

      const alpha = progress * SWIPE_NAVIGATION.DIMMING_MAX;
      
      // Градиентное затемнение слева
      for (let i = 0; i < 20; i++) {
        const segmentAlpha = alpha * (1 - i / 20);
        this.swipeOverlay.fillStyle(0x000000, segmentAlpha);
        this.swipeOverlay.fillRect(
          (deltaX / 20) * i,
          0,
          deltaX / 20 + 1,
          height
        );
      }
    }

    // Стрелка
    if (this.swipeArrow) {
      this.swipeArrow.setVisible(true);
      this.swipeArrow.setAlpha(progress);
      this.swipeArrow.x = 40 + deltaX * 0.3;
    }
  }

  private completeSwipe(): void {
    hapticImpact('medium');
    AudioManager.getInstance().playUISwoosh();

    const { width } = this.cameras.main;

    // Анимация завершения
    this.tweens.add({
      targets: this.swipeOverlay,
      alpha: 1,
      duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
      ease: 'Quad.easeOut',
    });

    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: width / 2,
        alpha: 0,
        duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
        ease: 'Quad.easeOut',
      });
    }

    // Переход в главное меню
    this.time.delayedCall(SWIPE_NAVIGATION.ANIMATION_DURATION, () => {
      this.scene.start('MainMenuScene');
    });
  }

  private cancelSwipe(): void {
    this.isSwipeActive = false;
    const { height } = this.cameras.main;

    // Возврат индикатора
    if (this.swipeIndicator) {
      this.swipeIndicator.clear();
      this.swipeIndicator.fillStyle(
        SWIPE_NAVIGATION.INDICATOR_COLOR,
        SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
      );
      this.swipeIndicator.fillRoundedRect(
        0,
        this.headerHeight + 20,
        SWIPE_NAVIGATION.INDICATOR_WIDTH,
        height - this.headerHeight - 60 - this.bottomInset,
        2
      );
    }

    // Скрытие overlay с анимацией
    if (this.swipeOverlay) {
      this.tweens.add({
        targets: this.swipeOverlay,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeOverlay?.setVisible(false);
        },
      });
    }

    // Скрытие стрелки
    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: 40,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeArrow?.setVisible(false);
        },
      });
    }
  }

  // ========== BACKGROUND ==========

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);

    this.drawRadialGradient(bg, width / 2, 0, height * 0.6, colors.backgroundGradientTop, 0.5);
    this.drawRadialGradient(bg, width / 2, height, height * 0.3, colors.uiAccentPink, 0.08);

    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x <= width; x += 50) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 50) bg.lineBetween(0, y, width, y);

    this.createParticles(12);
  }

  private drawRadialGradient(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    maxR: number,
    color: number,
    maxAlpha: number
  ): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      g.fillStyle(color, maxAlpha * Math.pow(1 - ratio, 2));
      g.fillCircle(cx, cy, maxR * ratio);
    }
  }

  private createParticles(count: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const particleColors = [colors.uiAccent, colors.uiAccentPink, colors.uiPrimary];

    for (let i = 0; i < count; i++) {
      const p = this.add.circle(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(100, height - 100),
        Phaser.Math.FloatBetween(1, 2.5),
        Phaser.Math.RND.pick(particleColors),
        Phaser.Math.FloatBetween(0.2, 0.4)
      );

      this.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(30, 60),
        alpha: { from: p.alpha, to: 0.1 },
        duration: Phaser.Math.Between(4000, 7000),
        yoyo: true,
        repeat: -1,
        delay: i * 150,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.lineStyle(2, colors.uiAccentPink, 0.3);
    headerBg.lineBetween(0, this.headerHeight, width, this.headerHeight);
    headerBg.setDepth(100);

    const titleGlow = this.add.graphics();
    titleGlow.fillStyle(colors.uiAccentPink, 0.1);
    titleGlow.fillEllipse(width / 2, 40 + this.topInset, 140, 40);
    titleGlow.setDepth(100);

    // ✅ УЛУЧШЕНО: Используем типографику
    const title = this.add
      .text(width / 2, 40 + this.topInset, i18n.t('profile').toUpperCase(), {
        fontSize: `${TYPOGRAPHY.sizes.xl}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(101);
    
    applyTextShadow(title, 'medium');
  }

  private createPlayerCard(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const rank = getRankByLevel(data.level);
    const nickname = playerData.getNickname ? playerData.getNickname() : data.username;
    const avatarId = playerData.getAvatarId ? playerData.getAvatarId() : undefined;

    // ✅ ИСПРАВЛЕНО: Увеличен отступ от шапки (было 125, стало 145)
    const cardY = 145 + this.topInset;
    const cardWidth = width - 48;
    const cardHeight = 160;

    const container = this.add.container(width / 2, cardY);

    const glow = this.add.graphics();
    glow.lineStyle(8, rank.color, 0.1);
    glow.strokeRoundedRect(-cardWidth / 2 - 4, -cardHeight / 2 - 4, cardWidth + 8, cardHeight + 8, 18);
    container.add(glow);

    // ✅ УЛУЧШЕНО: Многослойные тени для карточки
    const shadowBg = this.add.graphics();
    shadowBg.fillStyle(0x000000, 0.3);
    shadowBg.fillRoundedRect(-cardWidth / 2 + 4, -cardHeight / 2 + 4, cardWidth, cardHeight, 16);
    shadowBg.fillStyle(0x000000, 0.2);
    shadowBg.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth, cardHeight, 16);
    container.add(shadowBg);

    const bg = this.add.graphics();
    bg.fillStyle(0x14101e, 0.95);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

    for (let i = 0; i < 50; i++) {
      bg.fillStyle(rank.color, 0.1 * (1 - i / 50));
      bg.fillRect(-cardWidth / 2, -cardHeight / 2 + i, cardWidth, 1);
    }

    // Glass effect
    bg.fillStyle(0xffffff, 0.05);
    bg.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth - 4, cardHeight * 0.4, { tl: 14, tr: 14, bl: 0, br: 0 });

    bg.fillStyle(rank.color, 0.8);
    bg.fillRoundedRect(-40, -cardHeight / 2 + 1, 80, 3, 2);
    bg.lineStyle(2, rank.color, 0.5);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
    container.add(bg);

    const avatarX = -cardWidth / 2 + 56;
    this.createAvatarWithHoloRing(container, avatarX, -6, rank, data.level, avatarId);

    const infoX = avatarX + 70;
    
    // ✅ УЛУЧШЕНО: Типографика для никнейма
    const nameText = this.add
      .text(infoX, -35, nickname, {
        fontSize: `${TYPOGRAPHY.sizes.lg}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
      })
      .setOrigin(0, 0.5);
    applyTextShadow(nameText, 'subtle');
    container.add(nameText);

    const rankBg = this.add.graphics();
    rankBg.fillStyle(rank.color, 0.15);
    rankBg.fillRoundedRect(infoX, -18, 95, 24, 12);
    rankBg.lineStyle(1, rank.color, 0.5);
    rankBg.strokeRoundedRect(infoX, -18, 95, 24, 12);
    container.add(rankBg);

    container.add(this.add.text(infoX + 16, -6, '👑', { fontSize: `${TYPOGRAPHY.sizes.xs}px` }).setOrigin(0.5));
    container.add(
      this.add
        .text(infoX + 60, -6, rank.name, {
          fontSize: `${TYPOGRAPHY.sizes.xs}px`,
          fontFamily: fonts.tech,
          color: hexToString(rank.color),
        })
        .setOrigin(0.5)
    );

    const faction = playerData.getFaction();
    if (faction) {
      const factionColor = this.getFactionColor(faction);
      const factionName = this.getFactionName(faction);

      const factionBg = this.add.graphics();
      factionBg.fillStyle(factionColor, 0.15);
      factionBg.fillRoundedRect(infoX, 8, 120, 24, 12);
      factionBg.lineStyle(1, factionColor, 0.5);
      factionBg.strokeRoundedRect(infoX, 8, 120, 24, 12);
      container.add(factionBg);

      container.add(
        this.add.text(infoX + 16, 20, '🛸', { fontSize: `${TYPOGRAPHY.sizes.xs}px` }).setOrigin(0.5)
      );
      container.add(
        this.add
          .text(infoX + 75, 20, factionName, {
            fontSize: `${TYPOGRAPHY.sizes.xs}px`,
            fontFamily: fonts.tech,
            color: hexToString(factionColor),
          })
          .setOrigin(0.5)
      );
    }

    const xpBarWidth = cardWidth - 180;
    const xpBarX = infoX;
    const xpBarY = 46;
    const xpNeeded = getXPForLevel(data.level);
    const xpProgress = Math.min(data.xp / xpNeeded, 1);

    const xpBar = this.add.graphics();
    xpBar.fillStyle(0x1a1a2e, 1);
    xpBar.fillRoundedRect(xpBarX, xpBarY, xpBarWidth, 16, 8);

    if (xpProgress > 0) {
      xpBar.fillStyle(rank.color, 1);
      xpBar.fillRoundedRect(
        xpBarX,
        xpBarY,
        Math.max(xpBarWidth * xpProgress, 16),
        16,
        8
      );
      xpBar.fillStyle(0xffffff, 0.15);
      xpBar.fillRoundedRect(
        xpBarX + 2,
        xpBarY + 2,
        Math.max(xpBarWidth * xpProgress - 4, 12),
        6,
        4
      );
    }

    xpBar.lineStyle(1, rank.color, 0.3);
    xpBar.strokeRoundedRect(xpBarX, xpBarY, xpBarWidth, 16, 8);
    container.add(xpBar);

    container.add(
      this.add
        .text(xpBarX + xpBarWidth / 2, xpBarY + 8, `${data.xp} / ${xpNeeded} XP`, {
          fontSize: `${TYPOGRAPHY.sizes.xs}px`,
          fontFamily: fonts.tech,
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );

    const currencyX = cardWidth / 2 - 20;
    // Монеты
    if (this.textures.exists('ui_rewards_coins')) {
      const coinsIcon = this.add.image(currencyX - 45, 2, 'ui_rewards_coins');
      coinsIcon.setDisplaySize(16, 16);
      coinsIcon.setOrigin(0.5, 0.5);
      container.add(coinsIcon);
    } else {
      container.add(this.add.text(currencyX - 45, 2, '💰', { fontSize: `${TYPOGRAPHY.sizes.md}px` }).setOrigin(0.5));
    }
    container.add(
      this.add
        .text(currencyX, 2, `${data.coins}`, {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiGold),
        })
        .setOrigin(1, 0.5)
    );
    // Кристаллы
    if (this.textures.exists('ui_rewards_crystals')) {
      const crystalsIcon = this.add.image(currencyX - 45, 22, 'ui_rewards_crystals');
      crystalsIcon.setDisplaySize(16, 16);
      crystalsIcon.setOrigin(0.5, 0.5);
      container.add(crystalsIcon);
    } else {
      container.add(this.add.text(currencyX - 45, 22, '💎', { fontSize: `${TYPOGRAPHY.sizes.md}px` }).setOrigin(0.5));
    }
    container.add(
      this.add
        .text(currencyX, 22, `${data.crystals}`, {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: '#60a5fa',
        })
        .setOrigin(1, 0.5)
    );
  }

  private createAvatarWithHoloRing(
    container: Phaser.GameObjects.Container,
    x: number,
    y: number,
    rank: { color: number; name: string },
    level: number,
    avatarTextureKey?: string
  ): void {
    this.holoRing = this.add.graphics();
    this.drawHoloRing(this.holoRing, x, y, 42, rank.color);
    container.add(this.holoRing);

    this.tweens.add({
      targets: this.holoRing,
      angle: 360,
      duration: 15000,
      repeat: -1,
      ease: 'Linear',
    });

    const avatarRadius = 32;
    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(0x1a1a2e, 1);
    avatarBg.fillCircle(x, y, avatarRadius);
    avatarBg.lineStyle(3, rank.color, 0.8);
    avatarBg.strokeCircle(x, y, avatarRadius);
    container.add(avatarBg);

    // КНОПКА СМЕНЫ АВАТАРКИ (интерактивная область)
    avatarBg.setInteractive(new Phaser.Geom.Circle(x, y, avatarRadius), Phaser.Geom.Circle.Contains);
    avatarBg.on('pointerdown', () => {
      import('../utils/Haptics').then(({ hapticImpact }) => {
        hapticImpact('light');
      });
      this.openAvatarSelection();
    });

    if (avatarTextureKey && this.textures.exists(avatarTextureKey)) {
      const avatarImage = this.add.image(x, y, avatarTextureKey);
      avatarImage.setDisplaySize(avatarRadius * 1.8, avatarRadius * 1.8);
      container.add(avatarImage);
    } else {
      const profileIcon = Icons.drawProfile(this, x, y, 22, 0xffffff);
      container.add(profileIcon);
    }

    const levelBadge = this.add.graphics();
    levelBadge.fillStyle(rank.color, 1);
    levelBadge.fillCircle(x + 22, y + 22, 14);
    levelBadge.lineStyle(2, 0xffffff, 1);
    levelBadge.strokeCircle(x + 22, y + 22, 14);
    container.add(levelBadge);

    container.add(
      this.add
        .text(x + 22, y + 22, `${level}`, {
          fontSize: `${TYPOGRAPHY.sizes.xs}px`,
          fontFamily: getFonts().tech,
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );
  }

  private drawHoloRing(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    radius: number,
    color: number
  ): void {
    const segments = 24;
    g.lineStyle(2, color, 0.5);

    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const startAngle = (i / segments) * Math.PI * 2;
        const endAngle = ((i + 0.7) / segments) * Math.PI * 2;
        g.beginPath();
        g.arc(x, y, radius, startAngle, endAngle, false);
        g.strokePath();
      }
    }

    g.lineStyle(1, color, 0.2);
    g.strokeCircle(x, y, radius - 8);
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    // ✅ ИСПРАВЛЕНО: Увеличен отступ (было 250, стало 280)
    const tabY = 280 + this.topInset;
    const tabW = (width - 50) / 3;
    const tabH = 40;
    const skewAngle = -12;

    const tabs: { id: ProfileTab; label: string; icon: string }[] = [
      { id: 'stats', label: 'СТАТИСТИКА', icon: '📊' },
      { id: 'trophies', label: 'ТРОФЕИ', icon: '🏆' },
      { id: 'achievements', label: 'ДОСТИЖЕНИЯ', icon: '🎖️' },
    ];

    tabs.forEach((tab, index) => {
      const x = 25 + index * (tabW + 5);
      const isActive = tab.id === this.currentTab;
      const container = this.add.container(x + tabW / 2, tabY).setDepth(50);

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, true);
        bg.lineStyle(2, colors.uiAccent, 0.8);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, false);
      } else {
        bg.lineStyle(1.5, colors.uiAccent, 0.6);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, false);
      }
      container.add(bg);

      container.add(
        this.add
          .text(0, 0, `${tab.icon} ${tab.label.toUpperCase()}`, {
            fontSize: `${TYPOGRAPHY.sizes.xs}px`,
            fontFamily: fonts.tech,
            color: isActive ? '#000000' : hexToString(colors.uiAccent),
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );

      if (!isActive) {
        const hit = this.add
          .rectangle(0, 0, tabW, tabH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        container.add(hit);
        hit.on('pointerover', () =>
          this.tweens.add({ targets: container, scale: 1.05, duration: 80 })
        );
        hit.on('pointerout', () =>
          this.tweens.add({ targets: container, scale: 1, duration: 80 })
        );
        hit.on('pointerdown', () => {
          AudioManager.getInstance().playUIClick();
          hapticSelection();
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.scene.restart();
        });
      }
    });
  }

  private drawSkewedRect(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    skewDeg: number,
    fill: boolean
  ): void {
    const skewRad = Phaser.Math.DegToRad(skewDeg);
    const skewOffset = Math.tan(skewRad) * h;
    const pts = [
      { x: x - skewOffset / 2, y },
      { x: x + w - skewOffset / 2, y },
      { x: x + w + skewOffset / 2, y: y + h },
      { x: x + skewOffset / 2, y: y + h },
    ];
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => g.lineTo(p.x, p.y));
    g.closePath();
    if (fill) g.fillPath();
    else g.strokePath();
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    
    // ✅ ИСПРАВЛЕНО: Увеличен отступ (было 300, стало 330)
    this.contentTop = 330 + this.topInset;
    // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
    const visibleHeight = height - this.contentTop - 20 - this.bottomInset;

    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.contentTop, width, visibleHeight);
    maskShape.setVisible(false);

    this.contentContainer = this.add.container(0, this.contentTop);
    this.contentContainer.setMask(maskShape.createGeometryMask());
  }

  // ✅ УДАЛЕНО: createBottomBackButton() - полностью удалён

  private renderContent(): void {
    this.contentContainer.removeAll(true);

    switch (this.currentTab) {
      case 'stats':
        this.renderStats();
        break;
      case 'trophies':
        this.renderTrophies();
        break;
      case 'achievements':
        this.renderAchievements();
        break;
    }
  }

  private renderStats(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const stats = playerData.get().stats;
    let currentY = 15;

    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
    const goalDiff = stats.goalsScored - stats.goalsConceded;

    const statGroups = [
      {
        title: '🎮 ' + i18n.t('totalGames'),
        color: colors.uiAccent,
        items: [
          { label: i18n.t('totalGames'), value: stats.gamesPlayed, color: colors.uiAccent },
          { label: i18n.t('wins'), value: stats.wins, color: 0x4ade80 },
          { label: i18n.t('losses'), value: stats.losses, color: 0xef4444 },
          { label: i18n.t('draws'), value: stats.draws, color: colors.uiGold },
          { label: i18n.t('winRate'), value: `${winRate}%`, color: colors.uiAccentPink },
        ],
      },
      {
        title: '⚽ ' + i18n.t('goalsScored'),
        color: 0x4ade80,
        items: [
          { label: i18n.t('goalsScored'), value: stats.goalsScored, color: 0x4ade80 },
          { label: i18n.t('goalsConceded'), value: stats.goalsConceded, color: 0xef4444 },
          {
            label: i18n.t('goalDifference'),
            value: goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`,
            color: goalDiff >= 0 ? 0x4ade80 : 0xef4444,
          },
        ],
      },
      {
        title: '🔥 ' + i18n.t('bestStreak'),
        color: colors.uiGold,
        items: [
          { label: i18n.t('currentStreak'), value: stats.currentWinStreak, color: colors.uiAccent },
          { label: i18n.t('bestStreak'), value: stats.longestWinStreak, color: colors.uiGold },
          { label: i18n.t('perfectGames'), value: stats.perfectGames, color: colors.uiAccentPink },
          {
            label: i18n.t('playTime'),
            value: this.formatPlayTime(stats.totalPlayTime),
            color: colors.uiPrimary,
          },
        ],
      },
    ];

    statGroups.forEach((group, groupIndex) => {
      if (groupIndex > 0) currentY += 15;

      // ✅ УЛУЧШЕНО: Типографика для заголовков групп
      const groupTitle = this.add
        .text(25, currentY, group.title.toUpperCase(), {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: hexToString(group.color),
          letterSpacing: 1,
        });
      this.contentContainer.add(groupTitle);

      const line = this.add.graphics();
      line.lineStyle(1, group.color, 0.2);
      line.lineBetween(25, currentY + 20, width - 25, currentY + 20);
      this.contentContainer.add(line);

      currentY += 35;

      group.items.forEach((item, i) => {
        const isLast = i === group.items.length - 1;
        const itemHeight = 52;

        const itemBg = this.add.graphics();
        itemBg.fillStyle(0x14101e, 0.9);

        if (i === 0 && isLast) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, 12);
        } else if (i === 0) {
          itemBg.fillRoundedRect(
            20,
            currentY,
            width - 40,
            itemHeight,
            { tl: 12, tr: 12, bl: 0, br: 0 } as any
          );
        } else if (isLast) {
          itemBg.fillRoundedRect(
            20,
            currentY,
            width - 40,
            itemHeight,
            { tl: 0, tr: 0, bl: 12, br: 12 } as any
          );
        } else {
          itemBg.fillRect(20, currentY, width - 40, itemHeight);
        }

        itemBg.fillStyle(item.color, 0.6);
        itemBg.fillRect(20, currentY + 2, 3, itemHeight - 4);

        if (!isLast) {
          itemBg.lineStyle(1, colors.glassBorder, 0.1);
          itemBg.lineBetween(35, currentY + itemHeight, width - 25, currentY + itemHeight);
        }

        this.contentContainer.add(itemBg);
        
        // ✅ УЛУЧШЕНО: Типографика
        this.contentContainer.add(
          this.add
            .text(40, currentY + itemHeight / 2, item.label, {
              fontSize: `${TYPOGRAPHY.sizes.sm}px`,
              fontFamily: fonts.tech,
              color: '#aaaaaa',
            })
            .setOrigin(0, 0.5)
        );
        this.contentContainer.add(
          this.add
            .text(width - 35, currentY + itemHeight / 2, String(item.value), {
              fontSize: `${TYPOGRAPHY.sizes.lg}px`,
              fontFamily: fonts.tech,
              color: hexToString(item.color),
            })
            .setOrigin(1, 0.5)
        );

        currentY += itemHeight;
      });

      currentY += 10;
    });

    // ✅ ИЗМЕНЕНО: Расчёт maxScrollY без bottomBarHeight
    const visibleHeight = height - this.contentTop - 20 - this.bottomInset;
    this.maxScrollY = Math.max(0, currentY - visibleHeight + 50);
  }

  private renderTrophies(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    let currentY = 15;

    const league = data.leagueProgress;
    const currentTier = league?.currentTier;
    const bestTier = league?.seasonBestTier || currentTier;

    this.contentContainer.add(
      this.add.text(25, currentY, 'ЛИГИ', {
        fontSize: `${TYPOGRAPHY.sizes.sm}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiAccent),
        letterSpacing: 1,
      })
    );
    currentY += 28;

    const leagueCards: { title: string; tier?: any; isCurrent: boolean }[] = [
      { title: 'Текущая лига', tier: currentTier, isCurrent: true },
      { title: 'Лучшая лига за сезон', tier: bestTier, isCurrent: false },
    ];

    leagueCards.forEach((item) => {
      const h = 86;
      const cardBg = this.add.graphics();
      cardBg.fillStyle(0x14101e, 0.95);
      cardBg.fillRoundedRect(20, currentY, width - 40, h, 12);
      cardBg.lineStyle(1.5, colors.uiAccent, 0.15);
      cardBg.strokeRoundedRect(20, currentY, width - 40, h, 12);
      this.contentContainer.add(cardBg);

      const iconKey = item.tier ? this.getLeagueIconKey(item.tier) : undefined;
      if (iconKey && this.textures.exists(iconKey)) {
        const icon = this.add.image(50, currentY + h / 2, iconKey);
        icon.setDisplaySize(58, 58);
        icon.setOrigin(0.5);
        this.contentContainer.add(icon);
      } else {
        this.contentContainer.add(
          this.add.text(50, currentY + h / 2, '🏆', { fontSize: `${TYPOGRAPHY.sizes.lg}px` }).setOrigin(0.5)
        );
      }

      this.contentContainer.add(
        this.add.text(90, currentY + 20, item.title, {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: '#ffffff',
        }).setOrigin(0, 0.5)
      );

      // Формируем текст лиги с дивизионом и звездами (для текущей лиги)
      let tierLabel = item.tier ? this.formatLeagueTierName(item.tier) : 'Нет данных';
      if (item.isCurrent && league) {
        tierLabel += ` • Дивизион ${league.division}`;
        tierLabel += ` • ${league.stars}/${league.maxStars} ⭐`;
      }
      
      this.contentContainer.add(
        this.add.text(90, currentY + 44, tierLabel, {
          fontSize: `${TYPOGRAPHY.sizes.xs}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
        }).setOrigin(0, 0.5)
      );

      currentY += h + 10;
    });

    currentY += 10;
    this.contentContainer.add(
      this.add.text(25, currentY, 'ТУРНИРНЫЕ КУБКИ', {
        fontSize: `${TYPOGRAPHY.sizes.sm}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiAccent),
        letterSpacing: 1,
      })
    );
    currentY += 32;

    // Подсчёт кубков из истории турниров
    const tournamentState = data.tournamentState;
    const cupCounts: Record<string, number> = {
      rookie: 0,
      minor: 0,
      major: 0,
      apex: 0,
    };

    if (tournamentState && tournamentState.history) {
      tournamentState.history.forEach((entry) => {
        if (entry.bestPlacement === '1') {
          // Победа в турнире (1 место)
          cupCounts[entry.tier] += 1;
        }
      });
    }

    const trophyList = [
      { tier: 'apex', title: 'Galactic Apex', desc: 'Главный титул сезона', iconKey: 'cup_galactic_apex_512', color: 0xe11d48 },
      { tier: 'major', title: 'Major Cup', desc: 'Победы в топ-турнирах', iconKey: 'cup_major_512', color: 0xfbbf24 },
      { tier: 'minor', title: 'Minor Cup', desc: 'Победы в минорных лигах', iconKey: 'cup_minor_512', color: 0x3b82f6 },
      { tier: 'rookie', title: 'Rookie Draft', desc: 'Стартовый кубок новичков', iconKey: 'cup_rookie_draft_512', color: 0x10b981 },
    ];

    trophyList.forEach((trophy) => {
      const count = cupCounts[trophy.tier];
      const h = 70;
      const cardBg = this.add.graphics();
      
      // Если есть кубки - подсветка
      if (count > 0) {
        cardBg.fillStyle(trophy.color, 0.05);
        cardBg.fillRoundedRect(20, currentY, width - 40, h, 10);
      }
      
      cardBg.fillStyle(0x0f111d, count > 0 ? 0.85 : 0.95);
      cardBg.fillRoundedRect(20, currentY, width - 40, h, 10);
      cardBg.lineStyle(1, count > 0 ? trophy.color : colors.glassBorder, count > 0 ? 0.4 : 0.2);
      cardBg.strokeRoundedRect(20, currentY, width - 40, h, 10);
      this.contentContainer.add(cardBg);

      const iconKey = trophy.iconKey || this.getTrophyIconKey(trophy.title);
      if (iconKey && this.textures.exists(iconKey)) {
        const icon = this.add.image(50, currentY + h / 2, iconKey);
        icon.setDisplaySize(54, 54);
        icon.setOrigin(0.5);
        icon.setAlpha(count > 0 ? 1 : 0.3);
        this.contentContainer.add(icon);
      } else {
        const iconEmoji = this.add.text(50, currentY + h / 2, '🏅', { fontSize: `${TYPOGRAPHY.sizes.lg}px` }).setOrigin(0.5);
        iconEmoji.setAlpha(count > 0 ? 1 : 0.3);
        this.contentContainer.add(iconEmoji);
      }

      this.contentContainer.add(
        this.add.text(90, currentY + 20, trophy.title, {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: count > 0 ? '#ffffff' : '#666677',
        }).setOrigin(0, 0.5)
      );

      this.contentContainer.add(
        this.add.text(90, currentY + 44, trophy.desc, {
          fontSize: `${TYPOGRAPHY.sizes.xs}px`,
          fontFamily: fonts.primary,
          color: count > 0 ? '#9ca3af' : '#555566',
          wordWrap: { width: width - 180 },
        }).setOrigin(0, 0.5)
      );

      // Счётчик побед
      const countBg = this.add.graphics();
      countBg.fillStyle(count > 0 ? trophy.color : 0x1a1a2e, count > 0 ? 0.15 : 0.8);
      countBg.fillCircle(width - 55, currentY + h / 2, 20);
      countBg.lineStyle(2, count > 0 ? trophy.color : 0x3a3a4a, count > 0 ? 0.6 : 0.2);
      countBg.strokeCircle(width - 55, currentY + h / 2, 20);
      this.contentContainer.add(countBg);

      this.contentContainer.add(
        this.add
          .text(width - 55, currentY + h / 2, `x${count}`, {
            fontSize: `${TYPOGRAPHY.sizes.sm}px`,
            fontFamily: fonts.tech,
            color: count > 0 ? hexToString(trophy.color) : '#555566',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      );

      currentY += h + 8;
    });

    const visibleHeight = height - this.contentTop - 20 - this.bottomInset;
    this.maxScrollY = Math.max(0, currentY - visibleHeight + 50);
  }

  private createUnitPreview(x: number, y: number, unit: any): void {
    const factionColor = this.getFactionColor(unit.factionId);
    const g = this.add.graphics();
    g.fillStyle(factionColor, 0.3);
    g.fillCircle(x, y, 26);
    g.lineStyle(2, factionColor, 0.7);
    g.strokeCircle(x, y, 26);
    this.contentContainer.add(g);
  }

  private createBallPreview(x: number, y: number, skin: BallSkinData): void {
    const size = 22;
    if (skin.hasGlow) {
      this.contentContainer.add(this.add.circle(x, y, size + 6, skin.glowColor, 0.2));
    }
    this.contentContainer.add(this.add.ellipse(x + 2, y + 2, size * 1.4, size, 0x000000, 0.25));

    const texKey = skin.textureKey;
    if (texKey && this.textures.exists(texKey)) {
      this.contentContainer.add(this.add.sprite(x, y, texKey).setScale((size * 2) / 64));
    } else {
      const ball = this.add.circle(x, y, size, skin.primaryColor);
      ball.setStrokeStyle(2, skin.secondaryColor || skin.glowColor);
      this.contentContainer.add(ball);
    }
  }

  private createFieldPreview(x: number, y: number, skin: FieldSkinData): void {
    const fw = 65,
      fh = 42;
    const field = this.add.graphics();
    field.fillStyle(skin.fieldColor, 1);
    field.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 4);
    field.lineStyle(1, skin.lineColor, 0.6);
    field.lineBetween(x - fw / 2, y, x + fw / 2, y);
    field.strokeCircle(x, y, 8);
    field.lineStyle(1.5, skin.borderColor);
    field.strokeRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 4);
    field.lineStyle(1.5, skin.goalColor);
    field.strokeRect(x - 12, y - fh / 2 - 2, 24, 3);
    field.strokeRect(x - 12, y + fh / 2 - 1, 24, 3);
    this.contentContainer.add(field);
  }

  private renderAchievements(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const stats = data.stats;
    let currentY = 15;

    // ============================================================
    // 🎯 ИГРОВЫЕ ДОСТИЖЕНИЯ (ПОЛНЫЙ СПИСОК)
    // ============================================================
    const achievements = [
      // ========== БАЗОВЫЕ ==========
      { id: 'first_win', iconKey: 'achievement_first_victory', name: 'Первый вкус победы', desc: 'Одержи свою первую победу', icon: '🏆', color: 0x10b981, unlocked: stats.wins >= 1 },
      { id: 'games_50', iconKey: 'achievement_loyal_player', name: 'Верный игрок', desc: 'Сыграй 50 матчей', icon: '🎮', color: 0x3b82f6, unlocked: stats.gamesPlayed >= 50 },
      { id: 'games_100', iconKey: 'achievement_centurion', name: 'Центурион', desc: 'Сыграй 100 матчей', icon: '💯', color: 0xa855f7, unlocked: stats.gamesPlayed >= 100 },
      { id: 'level_10', iconKey: 'achievement_rising_star', name: 'Rising Star', desc: 'Достигни 10 уровня', icon: '⭐', color: 0xfbbf24, unlocked: data.level >= 10 },
      { id: 'level_25', iconKey: 'achievement_veteran', name: 'Veteran', desc: 'Достигни 25 уровня', icon: '👑', color: 0xa855f7, unlocked: data.level >= 25 },
      { id: 'level_50', iconKey: 'achievement_master', name: 'Мастер', desc: 'Достигни 50 уровня', icon: '🌟', color: 0xe11d48, unlocked: data.level >= 50 },

      // ========== КАМБЭКИ ==========
      { id: 'comeback_02', iconKey: 'achievement_comeback', name: 'Камбэк 0:2', desc: 'Отыграйся с 0:2 и победи', icon: '↩️', color: 0xf59e0b, unlocked: false },
      { id: 'comeback_03', iconKey: 'achievement_comeback_epic', name: 'Эпический камбэк 0:3', desc: 'Отыграйся с 0:3 и победи', icon: '🔄', color: 0xef4444, unlocked: false },
      { id: 'comeback_04', iconKey: 'achievement_comeback_legendary', name: 'Легенда 0:4', desc: 'Отыграйся с 0:4 и победи', icon: '🌀', color: 0xe11d48, unlocked: false },

      // ========== ГОЛЫ ==========
      { id: 'first_goal', iconKey: 'achievement_first_goal', name: 'Первый гол', desc: 'Забей свой первый гол', icon: '⚽', color: 0x10b981, unlocked: stats.goalsScored >= 1 },
      { id: 'hat_trick', iconKey: 'achievement_hat_trick', name: 'Хет-трик', desc: 'Забей 3 гола в одном матче', icon: '🎯', color: 0xfbbf24, unlocked: false },
      { id: 'goal_spree', iconKey: 'achievement_goal_spree', name: 'Результативный', desc: 'Забей 5+ голов в матче', icon: '🚀', color: 0xef4444, unlocked: false },
      { id: 'goals_50', iconKey: 'achievement_goal_scorer', name: 'Бомбардир', desc: 'Забей 50 голов (всего)', icon: '🏅', color: 0x3b82f6, unlocked: stats.goalsScored >= 50 },
      { id: 'goals_200', iconKey: 'achievement_goal_machine', name: 'Машина голов', desc: 'Забей 200 голов (всего)', icon: '💥', color: 0xa855f7, unlocked: stats.goalsScored >= 200 },
      { id: 'sniper_goal', iconKey: 'achievement_sniper_goal', name: 'Снайпер', desc: 'Забей гол Sniper юнитом', icon: '🎯', color: 0x06b6d4, unlocked: false },
      { id: 'trickster_curve', iconKey: 'achievement_trickster_curve', name: 'Магия Trickster', desc: 'Забей крученый гол Trickster', icon: '🌀', color: 0x8b5cf6, unlocked: false },

      // ========== ЗАЩИТА ==========
      { id: 'clean_sheet', iconKey: 'achievement_clean_sheet', name: 'Стальная стена', desc: 'Победи, не пропустив голов', icon: '🛡️', color: 0x06b6d4, unlocked: stats.perfectGames >= 1 },
      { id: 'perfect_5', iconKey: 'achievement_perfect_defender', name: 'Идеальная защита', desc: 'Выиграй 5 матчей "на ноль"', icon: '🏰', color: 0xa855f7, unlocked: stats.perfectGames >= 5 },
      { id: 'tank_wall', iconKey: 'achievement_tank_wall', name: 'Танковая оборона', desc: 'Заблокируй 10 ударов Tank юнитом', icon: '🚛', color: 0xf59e0b, unlocked: false },

      // ========== СЕРИИ ПОБЕД ==========
      { id: 'win_streak_3', iconKey: 'achievement_win_streak', name: 'Серия побед', desc: 'Выиграй 3 матча подряд', icon: '🔥', color: 0xfbbf24, unlocked: stats.longestWinStreak >= 3 },
      { id: 'win_streak_5', iconKey: 'achievement_win_streak_epic', name: 'Непобедимый', desc: 'Выиграй 5 матчей подряд', icon: '⚡', color: 0xef4444, unlocked: stats.longestWinStreak >= 5 },
      { id: 'win_streak_10', iconKey: 'achievement_win_streak_legendary', name: 'Легенда', desc: 'Выиграй 10 матчей подряд', icon: '👑', color: 0xe11d48, unlocked: stats.longestWinStreak >= 10 },

      // ========== ДРАМАТУРГИЯ ==========
      { id: 'clutch', iconKey: 'achievement_clutch', name: 'На последней секунде', desc: 'Забей победный гол в последние 10 сек', icon: '⏱️', color: 0xef4444, unlocked: false },
      { id: 'overtime_hero', iconKey: 'achievement_overtime_hero', name: 'Герой овертайма', desc: 'Забей победный гол в овертайме', icon: '⏳', color: 0xa855f7, unlocked: false },

      // ========== СПОСОБНОСТИ ФРАКЦИЙ ==========
      { id: 'lava_master', iconKey: 'achievement_lava_master', name: 'Мастер лавы', desc: 'Используй Lava Pool (Magma) 20 раз', icon: '🔥', color: 0xf59e0b, unlocked: false },
      { id: 'shield_expert', iconKey: 'achievement_shield_expert', name: 'Эксперт щита', desc: 'Отрази 15 ударов EMP Shield (Cyborg)', icon: '⚡', color: 0x06b6d4, unlocked: false },
      { id: 'swap_tactician', iconKey: 'achievement_swap_tactician', name: 'Тактик телепортации', desc: 'Используй Phase Swap (Void) 30 раз', icon: '🌀', color: 0x8b5cf6, unlocked: false },
      { id: 'toxin_hunter', iconKey: 'achievement_toxin_hunter', name: 'Охотник с токсином', desc: 'Оглуши 25 юнитов Neurotoxin (Insect)', icon: '☣️', color: 0x10b981, unlocked: false },

      // ========== РЕЖИМЫ ==========
      { id: 'campaign_hero', iconKey: 'achievement_campaign_hero', name: 'Герой кампании', desc: 'Пройди первую главу кампании', icon: '📖', color: 0x3b82f6, unlocked: false },
      { id: 'league_climber', iconKey: 'achievement_league_climber', name: 'Восхождение', desc: 'Поднимись до ранга Planet в лиге', icon: '🪐', color: 0xfbbf24, unlocked: false },
      { id: 'tournament_champ', iconKey: 'achievement_tournament_champion', name: 'Чемпион турнира', desc: 'Победи в турнире', icon: '🏆', color: 0xe11d48, unlocked: false },

      // ========== КОЛЛЕКЦИЯ ==========
      { id: 'collector_20', iconKey: 'achievement_collector', name: 'Коллекционер', desc: 'Собери 20 уникальных юнитов', icon: '🃏', color: 0x3b82f6, unlocked: (data.ownedUniqueUnits?.length || 0) >= 20 },
      { id: 'collector_50', iconKey: 'achievement_master_collector', name: 'Мастер коллекции', desc: 'Собери 50 уникальных юнитов', icon: '🎴', color: 0xa855f7, unlocked: (data.ownedUniqueUnits?.length || 0) >= 50 },
      { id: 'collector_80', iconKey: 'achievement_complete_collection', name: 'Полная коллекция', desc: 'Собери все 80 юнитов', icon: '💎', color: 0xe11d48, unlocked: (data.ownedUniqueUnits?.length || 0) >= 80 },
    ];

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    // ✅ УЛУЧШЕНО: Типографика
    this.contentContainer.add(
      this.add
        .text(25, currentY, 'ДОСТИЖЕНИЯ', {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
          letterSpacing: 1,
        })
    );
    this.contentContainer.add(
      this.add
        .text(width - 30, currentY, `${unlockedCount}/${achievements.length}`, {
          fontSize: `${TYPOGRAPHY.sizes.sm}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
        })
        .setOrigin(1, 0)
    );

    const line = this.add.graphics();
    line.lineStyle(1, colors.uiAccent, 0.2);
    line.lineBetween(25, currentY + 20, width - 25, currentY + 20);
    this.contentContainer.add(line);

    currentY += 35;

    currentY += 20;

    achievements.forEach((achievement) => {
      const cardHeight = 84;
      const cardBg = this.add.graphics();

      // ✅ УЛУЧШЕНО: Многослойные тени
      if (achievement.unlocked) {
        cardBg.fillStyle(0x000000, 0.15);
        cardBg.fillRoundedRect(22, currentY + 2, width - 40, cardHeight, 12);
      }

      cardBg.fillStyle(
        achievement.unlocked ? achievement.color : 0x14101e,
        achievement.unlocked ? 0.08 : 0.95
      );
      cardBg.fillRoundedRect(20, currentY, width - 40, cardHeight, 12);
      
      // Glass effect для разблокированных
      if (achievement.unlocked) {
        cardBg.fillStyle(0xffffff, 0.03);
        cardBg.fillRoundedRect(22, currentY + 2, width - 44, cardHeight * 0.35, { tl: 10, tr: 10, bl: 0, br: 0 } as any);
      }
      
      cardBg.lineStyle(
        1.5,
        achievement.unlocked ? achievement.color : colors.glassBorder,
        achievement.unlocked ? 0.5 : 0.15
      );
      cardBg.strokeRoundedRect(20, currentY, width - 40, cardHeight, 12);
      this.contentContainer.add(cardBg);

      const iconX = 58;
      const iconY = currentY + cardHeight / 2;

      const iconBg = this.add.graphics();
      iconBg.fillStyle(
        achievement.unlocked ? achievement.color : 0x1a1a2e,
        achievement.unlocked ? 0.2 : 0.8
      );
      iconBg.fillCircle(iconX, iconY, 24);
      iconBg.lineStyle(
        2,
        achievement.unlocked ? achievement.color : 0x3a3a4a,
        achievement.unlocked ? 0.6 : 0.2
      );
      iconBg.strokeCircle(iconX, iconY, 24);
      this.contentContainer.add(iconBg);

      // ✅ ИСПОЛЬЗОВАТЬ PNG ИКОНКУ ВМЕСТО ЭМОДЗИ
      if (this.textures.exists(achievement.iconKey)) {
        const iconImg = this.add.image(iconX, iconY, achievement.iconKey);
        iconImg.setDisplaySize(38, 38);
        iconImg.setAlpha(achievement.unlocked ? 1 : 0.3);
        this.contentContainer.add(iconImg);
      } else {
        // Fallback на эмодзи, если PNG не загружен
        const iconText = this.add
          .text(iconX, iconY, achievement.icon, { fontSize: `${TYPOGRAPHY.sizes.xl}px` })
          .setOrigin(0.5);
        iconText.setAlpha(achievement.unlocked ? 1 : 0.3);
        this.contentContainer.add(iconText);
      }

      // ✅ УЛУЧШЕНО: Типографика
      this.contentContainer.add(
        this.add
          .text(100, currentY + 26, achievement.name, {
            fontSize: `${TYPOGRAPHY.sizes.md}px`,
            fontFamily: fonts.tech,
            color: achievement.unlocked ? '#ffffff' : '#555566',
          })
      );
      this.contentContainer.add(
        this.add
          .text(100, currentY + 48, achievement.desc, {
            fontSize: `${TYPOGRAPHY.sizes.xs}px`,
            color: achievement.unlocked ? '#999999' : '#444455',
          })
      );

      if (achievement.unlocked) {
        // ✅ Получаем количество разблокировок
        const achievementData = playerData.get().achievements.find(a => a.id === achievement.id);
        const count = achievementData?.count || 1;
        
        // Фон для счетчика/галочки
        const checkBg = this.add.graphics();
        checkBg.fillStyle(achievement.color, 0.15);
        checkBg.fillCircle(width - 55, iconY, 18);
        checkBg.lineStyle(2, achievement.color, 0.6);
        checkBg.strokeCircle(width - 55, iconY, 18);
        this.contentContainer.add(checkBg);
        
        // Показываем счетчик если больше 1 раза, иначе галочку
        if (count > 1) {
          this.contentContainer.add(
            this.add
              .text(width - 55, iconY, `x${count}`, {
                fontSize: '11px',
                fontFamily: fonts.tech,
                color: hexToString(achievement.color),
                fontStyle: 'bold',
              })
              .setOrigin(0.5)
          );
        } else {
          this.contentContainer.add(
            this.add
              .text(width - 55, iconY, '✓', {
                fontSize: `${TYPOGRAPHY.sizes.md}px`,
                color: hexToString(achievement.color),
              })
              .setOrigin(0.5)
          );
        }
      } else {
        this.contentContainer.add(
          this.add
            .text(width - 55, iconY, '🔒', { fontSize: `${TYPOGRAPHY.sizes.lg}px` })
            .setOrigin(0.5)
            .setAlpha(0.3)
        );
      }

      currentY += cardHeight + 10;
    });

    // ✅ ИЗМЕНЕНО: Расчёт maxScrollY без bottomBarHeight
    const visibleHeight = height - this.contentTop - 20 - this.bottomInset;
    this.maxScrollY = Math.max(0, currentY - visibleHeight + 50);
  }

  private formatPlayTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private getFactionColor(faction: string): number {
    const f = FACTIONS[faction as FactionId];
    return f ? f.color : 0x00f2ff;
  }

  private getFactionName(faction: string): string {
    const f = FACTIONS[faction as FactionId];
    return f ? f.name : 'Unknown';
  }

  private getLeagueIconKey(tier: any): string | undefined {
    const map: Record<string, string> = {
      meteorite: 'league_badge_meteorite_512',
      comet: 'league_badge_comet_512',
      planet: 'league_badge_planet_512',
      star: 'league_badge_star_512',
      nebula: 'league_badge_nebula_512',
      core: 'league_badge_core_512',
    };
    return map[tier] || undefined;
  }

  private formatLeagueTierName(tier: any): string {
    const map: Record<string, string> = {
      meteorite: 'Meteorite League',
      comet: 'Comet League',
      planet: 'Planet League',
      star: 'Star League',
      nebula: 'Nebula League',
      core: 'Core League',
    };
    return map[tier] || 'Неизвестно';
  }

  private getTrophyIconKey(title: string): string | undefined {
    const lower = title.toLowerCase();
    if (lower.includes('gold')) return 'trophy_gold';
    if (lower.includes('silver')) return 'trophy_silver';
    if (lower.includes('bronze')) return 'trophy_bronze';
    return undefined;
  }

  private setupScrolling(): void {
    const dragThreshold = this.contentTop;
    const { height } = this.cameras.main;

    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.scrollVelocity = 0;
      this.contentContainer.y = this.contentTop - this.scrollY;
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // ✅ ИЗМЕНЕНО: Проверяем, что не в зоне свайпа и не ниже контента
      if (p.x > SWIPE_NAVIGATION.EDGE_ZONE_WIDTH && p.y > dragThreshold && p.y < this.visibleAreaBottom) {
        this.dragStartY = p.y;
        this.isDragging = true;
        this.scrollVelocity = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging && !this.isSwipeActive) {
        const delta = this.dragStartY - p.y;
        this.scrollVelocity = delta;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.dragStartY = p.y;
        this.contentContainer.y = this.contentTop - this.scrollY;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  private openAvatarSelection(): void {
    import('../ui/AvatarSelectionOverlay').then(({ AvatarSelectionOverlay }) => {
      new AvatarSelectionOverlay(this, () => {
        // После закрытия перерисовываем шапку с новой аватаркой
        this.contentContainer.removeAll(true);
        // Перерисовываем весь экран
        this.createHeader();
        this.renderContent();
      });
    });
  }
}