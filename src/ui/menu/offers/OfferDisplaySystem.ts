// src/ui/menu/offers/OfferDisplaySystem.ts
// Система отображения специальных предложений

import Phaser from 'phaser';
import { hexToString, getFonts } from '../../../config/themes';
import { playerData } from '../../../data/PlayerData';
import { i18n } from '../../../localization/i18n';
import { FACTIONS } from '../../../constants/gameConstants';
import { OffersManager, SpecialOffer, OfferType } from '../../../data/OffersManager';
import { UnitData } from '../../../data/UnitsCatalog';
import { getDisplayName } from '../../../data/UnitsRepository';
import { AudioManager } from '../../../managers/AudioManager';
import { hapticImpact, hapticSelection } from '../../../utils/Haptics';
import { tgApp } from '../../../utils/TelegramWebApp';
import { createRoleIcon } from '../../ClassIcons';

export interface OfferDisplayCallbacks {
  onOfferClaimed: () => void;
  onModalClosed: () => void;
}

export class OfferDisplaySystem {
  private scene: Phaser.Scene;
  private s: number;
  private callbacks: OfferDisplayCallbacks;

  private modalContainer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private isTransitioning = false;
  private offersHubButton?: Phaser.GameObjects.Container;
  private hubModalContainer?: Phaser.GameObjects.Container;
  private hubOverlay?: Phaser.GameObjects.Rectangle;
  private currentOffer?: SpecialOffer;
  private offerTimerEvent?: Phaser.Time.TimerEvent;
  private allTimerEvents: Phaser.Time.TimerEvent[] = [];

  constructor(scene: Phaser.Scene, callbacks: OfferDisplayCallbacks) {
    this.scene = scene;
    this.s = tgApp.getUIScale();
    this.callbacks = callbacks;
  }

  checkAndShowOffer(): void {
    if (this.modalContainer || this.isTransitioning) return;

    // ✅ FIX: Скрыть офферы для новичков (меньше 2 матчей)
    const stats = playerData.get().stats;
    if (stats.gamesPlayed < 2) {
      console.log('[OfferDisplaySystem] Skipping offer - player has played less than 2 matches');
      return;
    }

    // Check auto-popup cooldown
    if (!OffersManager.isAutoPopupAllowed()) return;

    let offer = OffersManager.getBestAutoPopupOffer();

    if (!offer) {
      const ownedFactions = playerData.getOwnedFactions();
      if (ownedFactions.length < 4) {
        OffersManager.forceCreateOffer();
        offer = OffersManager.getBestAutoPopupOffer();
      }
    }

    if (offer) {
      OffersManager.markAutoPopupShown();
      this.showOfferModal(offer);
    }
  }

  /**
   * ✅ ПЕРЕРАБОТАНО: Кнопка предложений теперь в вертикальном layout справа
   * Размещена ниже окна монет и кристаллов
   */
  renderOffersHubButton(): void {
    this.destroyOffersHubButton();

    const hubOffers = OffersManager.getHubOffers();
    if (hubOffers.length === 0) return;

    const { width } = this.scene.cameras.main;
    const s = this.s;
    const topInset = tgApp.getTopInset();
    const fonts = getFonts();
    
    // Параметры кнопки (как у панели валюты)
    const btnWidth = 110 * s;
    const btnHeight = 42 * s;
    
    // Позиция: справа, ниже валюты (которая на headerY = topInset + 70)
    const headerY = topInset + 70 * s;
    const x = width - 15 * s - btnWidth; // Выравнивание с панелью валюты
    const y = headerY + 55 * s; // Чуть ниже валюты
    
    const container = this.scene.add.container(x, y).setDepth(60);
    this.offersHubButton = container;

    // Фон (как у панели валюты)
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
    bg.lineStyle(1, 0xffd700, 0.7);
    bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
    container.add(bg);

    // Тонкое свечение
    const glow = this.scene.add.graphics();
    glow.fillStyle(0xffd700, 0.15);
    glow.fillRoundedRect(-1 * s, -1 * s, btnWidth + 2 * s, btnHeight + 2 * s, 11 * s);
    container.addAt(glow, 0);

    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.15, to: 0.05 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
    });

    // Иконка подарка слева
    const iconX = 16 * s;
    const iconY = btnHeight / 2;
    const iconSize = 20 * s;
    
    if (this.scene.textures.exists('ui_rewards_daily')) {
      const dailyIcon = this.scene.add.image(iconX, iconY, 'ui_rewards_daily');
      dailyIcon.setDisplaySize(iconSize, iconSize);
      dailyIcon.setOrigin(0.5);
      container.add(dailyIcon);
    } else {
      const iconText = this.scene.add.text(iconX, iconY, '🎁', {
        fontSize: `${16 * s}px`,
      }).setOrigin(0.5);
      container.add(iconText);
    }

    // Текст справа от иконки (без подзаголовка)
    const textX = 32 * s;
    const titleText = this.scene.add.text(textX, iconY, 'ПРЕДЛОЖЕНИЯ', {
      fontFamily: fonts.tech,
      fontSize: `${10 * s}px`,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    container.add(titleText);

    // Компактный бейдж с количеством
    const count = Math.min(hubOffers.length, 9);
    if (count > 0) {
      const badgeSize = 16 * s;
      const badgeX = btnWidth - 6 * s;
      const badgeY = 6 * s;
      
      const badgeBg = this.scene.add.graphics();
      badgeBg.fillStyle(0xff2222, 1);
      badgeBg.fillCircle(badgeX, badgeY, badgeSize / 2);
      badgeBg.lineStyle(1 * s, 0xffffff, 0.8);
      badgeBg.strokeCircle(badgeX, badgeY, badgeSize / 2);
      container.add(badgeBg);

      const badgeText = this.scene.add.text(badgeX, badgeY, count.toString(), {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(badgeText);

      this.scene.tweens.add({
        targets: [badgeBg, badgeText],
        scale: { from: 1, to: 1.12 },
        duration: 600,
        yoyo: true,
        repeat: -1,
      });
    }

    // Hit area
    const hit = this.scene.add.rectangle(btnWidth / 2, btnHeight / 2, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hit);

    hit.on('pointerover', () => {
      this.scene.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 120 });
      bg.clear();
      bg.fillStyle(0x000000, 0.9);
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
      bg.lineStyle(1, 0xffd700, 1);
      bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
    });
    
    hit.on('pointerout', () => {
      this.scene.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 120 });
      bg.clear();
      bg.fillStyle(0x000000, 0.8);
      bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
      bg.lineStyle(1, 0xffd700, 0.7);
      bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 10 * s);
    });
    
    hit.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.showOffersHubModal();
    });

    // Entrance animation
    container.setScale(0).setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 400,
    });
  }

  destroyOffersHubButton(): void {
    if (this.offersHubButton) {
      this.scene.tweens.killTweensOf(this.offersHubButton);
      this.offersHubButton.destroy();
      this.offersHubButton = undefined;
    }
  }

  showOffersHubModal(): void {
    if (this.hubModalContainer || this.isTransitioning) return;

    this.isTransitioning = true;
    AudioManager.getInstance().playUISwoosh();
    hapticImpact('medium');

    const offers = OffersManager.getHubOffers();
    if (offers.length === 0) {
      this.isTransitioning = false;
      return;
    }

    const { width, height } = this.scene.cameras.main;
    const s = this.s;

    // Overlay
    this.hubOverlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(198)
      .setInteractive();
    this.scene.tweens.add({ targets: this.hubOverlay, alpha: 0.85, duration: 200 });

    this.hubOverlay.on('pointerdown', () => {
      this.closeHubModal();
    });

    // Modal container
    const modalW = Math.min(280 * s, width - 40);
    const modalH = Math.min(420 * s, height - 80);
    this.hubModalContainer = this.scene.add.container(width / 2, height / 2).setDepth(200);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1a, 0.98);
    bg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20 * s);
    bg.lineStyle(3, 0xffd700, 0.9);
    bg.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20 * s);
    this.hubModalContainer.add(bg);

    // Title
    const fonts = getFonts();
    const titleY = -modalH / 2 + 28 * s;
    const title = this.scene.add.text(0, titleY, '🎁 СПЕЦПРЕДЛОЖЕНИЯ', {
      fontSize: `${16 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.hubModalContainer.add(title);

    // Подзаголовок
    const subtitle = this.scene.add.text(0, titleY + 18 * s, 'ТОЛЬКО ДЛЯ ВАС', {
      fontSize: `${9 * s}px`,
      fontFamily: fonts.tech,
      color: '#94a3b8',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    this.hubModalContainer.add(subtitle);

    // Разделитель
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, 0xffd700, 0.35);
    divider.lineBetween(-modalW / 2 + 20 * s, titleY + 32 * s, modalW / 2 - 20 * s, titleY + 32 * s);
    this.hubModalContainer.add(divider);

    // Close button
    const closeBtn = this.scene.add.text(modalW / 2 - 25 * s, titleY, '✕', {
      fontSize: `${20 * s}px`,
      color: '#888888',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.hubModalContainer.add(closeBtn);

    closeBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      AudioManager.getInstance().playUIClick();
      this.closeHubModal();
    });

    // Offer cards
    const cardSpacing = 110 * s;
    const startY = -modalH / 2 + 86 * s;
    const cardW = modalW - 50 * s;
    const cardH = 92 * s;

    offers.slice(0, 3).forEach((offer, index) => {
      const cardY = startY + index * cardSpacing;
      this.createHubOfferCard(0, cardY, cardW, cardH, offer);
    });

    // Entrance animation
    this.hubModalContainer.setScale(0.8).setAlpha(0);
    this.scene.tweens.add({
      targets: this.hubModalContainer,
      scale: 1,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isTransitioning = false;
      },
    });
  }

  private createHubOfferCard(x: number, y: number, w: number, h: number, offer: SpecialOffer): void {
    const s = this.s;
    const fonts = getFonts();

    const card = this.scene.add.container(x, y);
    this.hubModalContainer!.add(card);

    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x101020, 0.96);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    // Верхняя полоса
    bg.fillStyle(offer.accentColor, 0.18);
    bg.fillRoundedRect(-w / 2, -h / 2, w, 28 * s, {
      tl: 12 * s,
      tr: 12 * s,
      bl: 0,
      br: 0,
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    bg.lineStyle(2, offer.accentColor, 0.7);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    card.add(bg);

    const glow = this.scene.add.graphics();
    glow.fillStyle(offer.accentColor, 0.08);
    glow.fillRoundedRect(-w / 2 - 2 * s, -h / 2 - 2 * s, w + 4 * s, h + 4 * s, 14 * s);
    card.addAt(glow, 0);

    // Icon
    const iconX = -w / 2 + 44 * s;
    const iconY = 0;
    const iconSize = 56 * s;

    if (offer.type === 'faction' && offer.factionId) {
      const faction = FACTIONS[offer.factionId];
      if (faction && this.scene.textures.exists(faction.assetKey)) {
        const icon = this.scene.add.image(iconX, iconY, faction.assetKey);
        icon.setDisplaySize(Math.round(iconSize), Math.round(iconSize));
        card.add(icon);
      } else {
        const emoji = this.scene.add.text(iconX, iconY, '🛸', { fontSize: `${28 * s}px` }).setOrigin(0.5);
        card.add(emoji);
      }
    } else if (offer.type === 'unit_pack' && offer.unitIds && offer.unitIds.length > 0) {
      const units = OffersManager.getOfferUnits(offer);
      if (units.length > 0 && this.scene.textures.exists(units[0].assetKey)) {
        const icon = this.scene.add.image(iconX, iconY, units[0].assetKey);
        icon.setDisplaySize(Math.round(iconSize), Math.round(iconSize));
        card.add(icon);
      } else {
        const emoji = this.scene.add.text(iconX, iconY, '⚡', { fontSize: `${28 * s}px` }).setOrigin(0.5);
        card.add(emoji);
      }
    } else {
      const emoji = this.scene.add.text(iconX, iconY, '💰', { fontSize: `${28 * s}px` }).setOrigin(0.5);
      card.add(emoji);
    }

    // Text
    const textX = iconX + 62 * s;
    const title = this.scene.add.text(textX, -h / 2 + 22 * s, this.getHubOfferTitle(offer), {
      fontSize: `${12 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(offer.accentColor),
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    card.add(title);

    const subtitle = this.scene.add.text(textX, -h / 2 + 46 * s, this.getHubOfferSubtitle(offer), {
      fontSize: `${9 * s}px`,
      color: '#cbd5e1',
      wordWrap: { width: w - (textX + 24 * s) },
    }).setOrigin(0, 0.5);
    card.add(subtitle);

    // Discount badge
    const badgeX = w / 2 - 30 * s;
    const badge = this.scene.add.container(badgeX, 0);
    card.add(badge);

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xff2222, 1);
    badgeBg.fillCircle(0, 0, 20 * s);
    badge.add(badgeBg);

    const badgeText = this.scene.add.text(0, 0, `-${offer.discountPercent}%`, {
      fontSize: `${10 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    badge.add(badgeText);

    // Hit area
    const hit = this.scene.add.rectangle(0, 0, w, h, 0, 0)
      .setInteractive({ useHandCursor: true });
    card.add(hit);

    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.closeHubModal();
      this.showOfferModal(offer);
    });
  }

  private getHubOfferTitle(offer: SpecialOffer): string {
    const factionNameMap: Record<string, string> = {
      magma: 'МАГМА',
      cyborg: 'КИБОРГИ',
      void: 'ПУСТОТА',
      insect: 'НАСЕКОМЫЕ',
    };

    if (offer.type === 'faction' && offer.factionId) {
      const name = factionNameMap[offer.factionId] || offer.factionId.toUpperCase();
      return `ФРАКЦИЯ: ${name}`;
    }

    if (offer.type === 'unit_pack') {
      return 'ПАК ФИШЕК';
    }

    return 'СПЕЦПРЕДЛОЖЕНИЕ';
  }

  private getHubOfferSubtitle(offer: SpecialOffer): string {
    const count = offer.unitIds?.length || 0;
    const discount = offer.discountPercent ? `СКИДКА -${offer.discountPercent}%` : '';
    const units = count > 0 ? `${count} ФИШКИ` : '';

    if (offer.type === 'faction') {
      return discount || 'ДОСТУП ОТКРЫТ';
    }

    if (offer.type === 'unit_pack') {
      return [units, discount].filter(Boolean).join(' • ') || 'НАБОР С БОНУСАМИ';
    }

    return discount || 'ОГРАНИЧЕННОЕ ВРЕМЯ';
  }

  private closeHubModal(): void {
    if (this.hubOverlay) {
      this.scene.tweens.killTweensOf(this.hubOverlay);
      this.scene.tweens.add({
        targets: this.hubOverlay,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          if (this.hubOverlay) {
            this.hubOverlay.destroy();
            this.hubOverlay = undefined;
          }
        },
      });
    }

    if (this.hubModalContainer) {
      this.scene.tweens.add({
        targets: this.hubModalContainer,
        scale: 0.9,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          if (this.hubModalContainer) {
            this.scene.tweens.killTweensOf(this.hubModalContainer);
            this.hubModalContainer.removeAll(true);
            this.hubModalContainer.destroy();
            this.hubModalContainer = undefined;
          }
          this.isTransitioning = false;
        },
      });
    }
  }

  private createMinimizedOfferCard(x: number, y: number, offer: SpecialOffer): Phaser.GameObjects.Container {
    const s = this.s;
    const size = 60 * s;

    const container = this.scene.add.container(x, y).setDepth(60);

    // Внешнее свечение
    const outerGlow = this.scene.add.graphics();
    outerGlow.fillStyle(offer.accentColor, 0.5);
    outerGlow.fillCircle(0, 0, size / 2 + 12 * s);
    container.add(outerGlow);

    this.scene.tweens.add({
      targets: outerGlow,
      alpha: { from: 0.5, to: 0.1 },
      scale: { from: 1, to: 1.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Внутреннее свечение
    const innerGlow = this.scene.add.graphics();
    innerGlow.fillStyle(0xffffff, 0.3);
    innerGlow.fillCircle(0, 0, size / 2 + 6 * s);
    container.add(innerGlow);

    this.scene.tweens.add({
      targets: innerGlow,
      alpha: { from: 0.3, to: 0.05 },
      scale: { from: 1, to: 1.2 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      delay: 200,
    });

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.95);
    bg.fillCircle(0, 0, size / 2);
    bg.lineStyle(3, offer.accentColor, 1);
    bg.strokeCircle(0, 0, size / 2);
    container.add(bg);

    // Иконка
    this.addOfferIcon(container, offer, size);

    // Бейдж скидки
    this.addDiscountBadge(container, offer, size);

    // Текст "HOT DEAL"
    const dealText = this.scene.add.text(0, size / 2 + 10 * s, i18n.t('hotDeal'), {
      fontSize: `${9 * s}px`,
      fontFamily: getFonts().tech,
      color: hexToString(offer.accentColor),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(dealText);

    this.scene.tweens.add({
      targets: dealText,
      alpha: { from: 1, to: 0.4 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Область нажатия
    const hitSize = size + 30 * s;
    const hit = this.scene.add.rectangle(0, 5 * s, hitSize, hitSize, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hit);

    hit.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      OffersManager.expandOffer(offer.id);
      this.refreshMinimizedOffers();
      this.showOfferModal(offer);
    });

    // Анимация появления
    container.setScale(0).setAlpha(0);
    this.scene.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 400,
    });

    return container;
  }

  private addOfferIcon(container: Phaser.GameObjects.Container, offer: SpecialOffer, size: number): void {
    const s = this.s;
    let iconKey: string | null = null;

    if (offer.type === 'unit_pack' && offer.unitIds && offer.unitIds.length > 0) {
      const units = OffersManager.getOfferUnits(offer);
      if (units.length > 0 && this.scene.textures.exists(units[0].assetKey)) {
        iconKey = units[0].assetKey;
      }
    } else if (offer.factionId) {
      const faction = FACTIONS[offer.factionId];
      if (faction && this.scene.textures.exists(faction.assetKey)) {
        iconKey = faction.assetKey;
      }
    }

    if (iconKey) {
      const icon = this.scene.add.image(0, 0, iconKey);
      icon.setDisplaySize(Math.round(size * 0.65), Math.round(size * 0.65));
      container.add(icon);

      this.scene.tweens.add({
        targets: icon,
        angle: { from: -5, to: 5 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const emoji = offer.type === 'faction' ? '🛸' : '⚡';
      container.add(
        this.scene.add.text(0, 0, emoji, { fontSize: `${24 * s}px` }).setOrigin(0.5)
      );
    }
  }

  private addDiscountBadge(container: Phaser.GameObjects.Container, offer: SpecialOffer, size: number): void {
    const s = this.s;
    const badgeX = size / 2 - 5 * s;
    const badgeY = -size / 2 + 5 * s;

    const badge = this.scene.add.container(badgeX, badgeY);
    container.add(badge);

    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xff2222, 1);
    badgeBg.fillCircle(0, 0, 14 * s);
    badge.add(badgeBg);

    badge.add(
      this.scene.add.text(0, 0, `${offer.discountPercent}%`, {
        fontSize: `${8 * s}px`,
        fontFamily: getFonts().tech,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    this.scene.tweens.add({
      targets: badge,
      scale: { from: 1, to: 1.25 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  refreshMinimizedOffers(): void {
    // Legacy method - now just refresh hub button
    this.renderOffersHubButton();
  }

  showOfferModal(offer: SpecialOffer): void {
    if (this.modalContainer || this.isTransitioning) return;

    this.isTransitioning = true;
    this.currentOffer = offer;
    AudioManager.getInstance().playUISwoosh();
    hapticImpact('medium');

    this.createOverlay();

    const s = this.s;
    const { width, height } = this.scene.cameras.main;

    const isUnitPack = offer.type === 'unit_pack';
    const modalW = Math.min(300 * s, width - 30);
    const modalH = Math.min(isUnitPack ? 420 * s : 400 * s, height - 100);

    this.modalContainer = this.scene.add.container(width / 2, height / 2).setDepth(200);

    const fonts = getFonts();

    // Свечение модалки
    this.addModalGlow(offer, modalW, modalH);
    
    // Тень и фон
    this.addModalBackground(offer, modalW, modalH);

    // Анимированный градиент
    this.addAnimatedGradient(offer, modalW, modalH);

    // Рамка
    this.addModalBorder(offer, modalW, modalH);

    // Искры по углам
    this.createSparkles(offer, modalW, modalH);

    // Анимированный бейдж скидки
    this.createAnimatedDiscountBadge(offer, modalW, modalH);

    // Заголовок
    const titleY = -modalH / 2 + 38 * s;
    const titleGlow = this.scene.add.text(0, titleY, '✨ ОГРАНИЧЕННОЕ ПРЕДЛОЖЕНИЕ ✨', {
      fontSize: `${12 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(offer.accentColor),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.modalContainer.add(titleGlow);

    this.scene.tweens.add({
      targets: titleGlow,
      alpha: { from: 1, to: 0.5 },
      scale: { from: 1, to: 1.05 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Тонкий разделитель под заголовком
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, offer.accentColor, 0.35);
    divider.lineBetween(-modalW / 2 + 24 * s, titleY + 14 * s, modalW / 2 - 24 * s, titleY + 14 * s);
    this.modalContainer.add(divider);

    // Контент
    if (isUnitPack) {
      this.renderUnitPackOffer(offer, modalW, modalH);
    } else {
      this.renderFactionOffer(offer, modalW, modalH);
    }

    // Футер с ценой и кнопками
    this.renderOfferFooter(offer, modalW, modalH);

    // Анимация появления
    this.modalContainer.setScale(0.8).setAlpha(0);
    this.scene.tweens.add({
      targets: this.modalContainer,
      scale: 1,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isTransitioning = false;
      },
    });
  }

  private createOverlay(): void {
    const { width, height } = this.scene.cameras.main;
    this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(199)
      .setInteractive();
    this.overlay.on('pointerdown', () => this.minimizeAndCloseCurrentOffer());
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.85, duration: 200 });
  }

  private minimizeAndCloseCurrentOffer(): void {
    if (this.currentOffer) {
      OffersManager.minimizeOffer(this.currentOffer.id);
    }
    this.currentOffer = undefined;
    this.closeModal(() => {
      this.renderOffersHubButton();
      this.callbacks.onModalClosed();
    });
  }

  private addModalGlow(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const modalGlow = this.scene.add.graphics();
    modalGlow.fillStyle(offer.accentColor, 0.3);
    modalGlow.fillRoundedRect(-modalW / 2 - 15, -modalH / 2 - 15, modalW + 30, modalH + 30, 25 * s);
    this.modalContainer!.add(modalGlow);

    this.scene.tweens.add({
      targets: modalGlow,
      alpha: { from: 0.3, to: 0.1 },
      scale: { from: 1, to: 1.03 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  private addModalBackground(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    
    // Тень
    const shadow = this.scene.add.graphics();
    shadow.fillStyle(0x000000, 0.6);
    shadow.fillRoundedRect(-modalW / 2 + 8, -modalH / 2 + 8, modalW, modalH, 20 * s);
    this.modalContainer!.add(shadow);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0d0d1a, 0.98);
    bg.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20 * s);
    this.modalContainer!.add(bg);
  }

  private addAnimatedGradient(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const topGradient = this.scene.add.graphics();
    this.modalContainer!.add(topGradient);

    let gradientPhase = 0;
    const gradientTimer = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (!topGradient.active) return;
        gradientPhase += 0.1;
        topGradient.clear();
        for (let i = 0; i < 70 * s; i++) {
          const wave = Math.sin(gradientPhase + i * 0.05) * 0.15 + 0.85;
          const alpha = 0.5 * (1 - i / (70 * s)) * wave;
          topGradient.fillStyle(offer.accentColor, alpha);
          topGradient.fillRect(-modalW / 2, -modalH / 2 + i, modalW, 1);
        }
      },
      loop: true,
    });
    this.allTimerEvents.push(gradientTimer);
  }

  private addModalBorder(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const border = this.scene.add.graphics();
    border.lineStyle(3, offer.accentColor, 0.9);
    border.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 20 * s);
    this.modalContainer!.add(border);

    this.scene.tweens.add({
      targets: border,
      alpha: { from: 0.9, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
  }

  private createSparkles(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const corners = [
      { x: -modalW / 2, y: -modalH / 2 },
      { x: modalW / 2, y: -modalH / 2 },
      { x: -modalW / 2, y: modalH / 2 },
      { x: modalW / 2, y: modalH / 2 },
    ];

    corners.forEach((corner, i) => {
      const sparkle = this.scene.add.text(corner.x, corner.y, '✦', {
        fontSize: `${16 * s}px`,
        color: hexToString(offer.accentColor),
      }).setOrigin(0.5);
      this.modalContainer!.add(sparkle);

      this.scene.tweens.add({
        targets: sparkle,
        alpha: { from: 1, to: 0.2 },
        scale: { from: 1, to: 0.6 },
        rotation: { from: 0, to: Math.PI * 2 },
        duration: 1500,
        yoyo: true,
        repeat: -1,
        delay: i * 200,
      });
    });
  }

  private createAnimatedDiscountBadge(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const fonts = getFonts();

    const badge = this.scene.add.container(modalW / 2 - 5 * s, -modalH / 2 + 5 * s);
    this.modalContainer!.add(badge);

    // Свечение бейджа
    const badgeGlow = this.scene.add.graphics();
    badgeGlow.fillStyle(0xff0000, 0.5);
    badgeGlow.fillCircle(0, 0, 35 * s);
    badge.add(badgeGlow);

    this.scene.tweens.add({
      targets: badgeGlow,
      alpha: { from: 0.5, to: 0.1 },
      scale: { from: 1, to: 1.5 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });

    // Фон бейджа
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xff2222, 1);
    badgeBg.fillRoundedRect(-32 * s, -18 * s, 64 * s, 36 * s, 10 * s);
    badgeBg.lineStyle(2, 0xffffff, 0.5);
    badgeBg.strokeRoundedRect(-32 * s, -18 * s, 64 * s, 36 * s, 10 * s);
    badge.add(badgeBg);

    // Текст скидки
    badge.add(
      this.scene.add.text(0, -2 * s, `-${offer.discountPercent}%`, {
        fontSize: `${18 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    this.scene.tweens.add({
      targets: badge,
      scale: { from: 1, to: 1.12 },
      angle: { from: -3, to: 3 },
      duration: 300,
      yoyo: true,
      repeat: -1,
    });
  }

  private renderFactionOffer(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const fonts = getFonts();
    const faction = offer.factionId ? FACTIONS[offer.factionId] : null;
    if (!faction) return;

    const contentY = -modalH / 2 + 78 * s;
    const cardW = modalW - 40 * s;
    const cardH = 150 * s;

    const card = this.scene.add.container(0, contentY + cardH / 2);
    this.modalContainer!.add(card);

    // Фон карточки
    const cardBg = this.scene.add.graphics();
    cardBg.fillStyle(0x0a0a15, 0.95);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14 * s);
    cardBg.fillStyle(offer.accentColor, 0.25);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, 50 * s, {
      tl: 14 * s,
      tr: 14 * s,
      bl: 0,
      br: 0,
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    cardBg.lineStyle(2, offer.accentColor, 0.7);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14 * s);
    card.add(cardBg);

    // Иконка фракции
    const iconX = -cardW / 2 + 50 * s;
    const iconY = 0;

    const iconGlow = this.scene.add.graphics();
    iconGlow.fillStyle(offer.accentColor, 0.5);
    iconGlow.fillCircle(iconX, iconY, 35 * s);
    card.add(iconGlow);

    this.scene.tweens.add({
      targets: iconGlow,
      alpha: { from: 0.5, to: 0.2 },
      scale: { from: 1, to: 1.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    if (faction.assetKey && this.scene.textures.exists(faction.assetKey)) {
      const icon = this.scene.add.image(iconX, iconY, faction.assetKey)
        .setDisplaySize(Math.round(55 * s), Math.round(55 * s));
      card.add(icon);

      this.scene.tweens.add({
        targets: icon,
        angle: { from: -5, to: 5 },
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const circle = this.scene.add.graphics();
      circle.fillStyle(offer.accentColor, 0.8);
      circle.fillCircle(iconX, iconY, 25 * s);
      card.add(circle);
      card.add(
        this.scene.add.text(iconX, iconY, faction.name.charAt(0), {
          fontSize: `${22 * s}px`,
          fontFamily: fonts.tech,
          color: '#ffffff',
        }).setOrigin(0.5)
      );
    }

    // Текст
    const textX = iconX + 50 * s;
    const factionName = (i18n.t(faction.id) || faction.name).toUpperCase();
    
    card.add(
      this.scene.add.text(textX, -cardH / 2 + 24 * s, factionName, {
        fontSize: `${14 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(offer.accentColor),
        fontStyle: 'bold',
      }).setOrigin(0, 0.5)
    );

    const factionDesc = i18n.t(faction.id + 'Desc') || faction.description;
    card.add(
      this.scene.add.text(textX, -cardH / 2 + 52 * s, factionDesc, {
        fontSize: `${9 * s}px`,
        color: '#cbd5e1',
        wordWrap: { width: cardW - 120 * s },
        lineSpacing: 2,
      }).setOrigin(0, 0)
    );

    // Статы
    const statsY = cardH / 2 - 22 * s;
    const massPercent = Math.round(faction.stats.mass * 100);
    const speedPercent = Math.round((faction.stats.speed || 1) * 100);

    card.add(
      this.scene.add.text(textX, statsY, `⚖️ МАССА: ${massPercent}%   💨 СКОРОСТЬ: ${speedPercent}%`, {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: '#94a3b8',
      }).setOrigin(0, 0.5)
    );

    // Бонус
    const bonusY = contentY + cardH + 26 * s;
    const bonusBg = this.scene.add.graphics();
    bonusBg.fillStyle(0x22cc22, 0.18);
    bonusBg.fillRoundedRect(-cardW / 2 + 18 * s, bonusY - 14 * s, cardW - 36 * s, 28 * s, 14 * s);
    bonusBg.lineStyle(1, 0x44ff44, 0.5);
    bonusBg.strokeRoundedRect(-cardW / 2 + 18 * s, bonusY - 14 * s, cardW - 36 * s, 28 * s, 14 * s);
    this.modalContainer!.add(bonusBg);

    const bonusText = this.scene.add.text(0, bonusY, '🎁 БОНУС: СТАРТОВАЯ ФИШКА', {
      fontSize: `${10 * s}px`,
      fontFamily: fonts.tech,
      color: '#44ff44',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.modalContainer!.add(bonusText);

    this.scene.tweens.add({
      targets: [bonusBg, bonusText],
      alpha: { from: 1, to: 0.6 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  private renderUnitPackOffer(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const fonts = getFonts();

    const units = OffersManager.getOfferUnits(offer);
    if (units.length === 0) return;

    const contentY = -modalH / 2 + 76 * s;

    // Заголовок
    const packTitle = this.scene.add.text(0, contentY, '⚡ МОЩНЫЙ ПАК ⚡', {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.modalContainer!.add(packTitle);

    this.scene.tweens.add({
      targets: packTitle,
      scale: { from: 1, to: 1.05 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Карточки юнитов
    const cardW = (modalW - 60 * s) / 2;
    const cardH = 150 * s;
    const cardsY = contentY + 34 * s + cardH / 2;

    units.forEach((unit, index) => {
      const offsetX = units.length === 1 ? 0 : (index === 0 ? -cardW / 2 - 8 * s : cardW / 2 + 8 * s);
      this.createUnitOfferCard(offsetX, cardsY, cardW, cardH, unit, offer.accentColor, index);
    });

    // Подпись
    const labelY = cardsY + cardH / 2 + 18 * s;
    this.modalContainer!.add(
      this.scene.add.text(0, labelY, `ОТКРЫВАЕТ ${units.length} ПРЕМИУМ ФИШКИ`, {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(offer.accentColor),
      }).setOrigin(0.5)
    );
  }

  private createUnitOfferCard(
    x: number,
    y: number,
    w: number,
    h: number,
    unit: UnitData,
    accentColor: number,
    index: number
  ): void {
    const s = this.s;
    const fonts = getFonts();

    const card = this.scene.add.container(x, y);
    this.modalContainer!.add(card);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    bg.lineStyle(2, accentColor, 0.6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12 * s);
    card.add(bg);

    const iconY = -h / 2 + 50 * s;

    // Свечение иконки
    const glow = this.scene.add.graphics();
    glow.fillStyle(accentColor, 0.4);
    glow.fillCircle(0, iconY, 32 * s);
    card.add(glow);

    this.scene.tweens.add({
      targets: glow,
      alpha: { from: 0.4, to: 0.15 },
      scale: { from: 1, to: 1.2 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      delay: index * 200,
    });

    // Иконка юнита
    if (unit.assetKey && this.scene.textures.exists(unit.assetKey)) {
      // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
      const icon = this.scene.add.image(0, iconY, unit.assetKey).setDisplaySize(Math.round(69 * s), Math.round(69 * s));
      card.add(icon);

      this.scene.tweens.add({
        targets: icon,
        y: iconY - 3 * s,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: index * 150,
      });
    } else {
      const circle = this.scene.add.graphics();
      circle.fillStyle(accentColor, 0.6);
      circle.fillCircle(0, iconY, 25 * s);
      card.add(circle);
    }

    // Имя юнита
    card.add(
      this.scene.add.text(0, iconY + 42 * s, getDisplayName(unit), {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: w - 12 * s },
        align: 'center',
      }).setOrigin(0.5)
    );

    // Класс
    const classColors: Record<string, number> = {
      balanced: 0x22c55e,
      tank: 0x3b82f6,
      sniper: 0xf59e0b,
      trickster: 0xa855f7,
    };
    const classColor = classColors[unit.capClass] || 0x888888;
    const classNameMap: Record<string, string> = {
      balanced: 'БАЛАНС',
      tank: 'ТАНК',
      sniper: 'СНАЙПЕР',
      trickster: 'ХИТРЕЦ',
    };
    const className = classNameMap[unit.capClass] || unit.capClass;

    // Создаём контейнер для иконки роли и текста
    const roleContainer = this.scene.add.container(0, iconY + 58 * s);
    
    // Иконка роли (PNG с fallback на эмодзи)
    const roleIconSize = 12 * s;
    const roleIcon = createRoleIcon(this.scene, -className.length * 2.5 * s, 0, unit.capClass as any, roleIconSize);
    roleContainer.add(roleIcon);
    
    // Текст названия роли
    const roleText = this.scene.add.text(roleIconSize / 2 + 2 * s, 0, className.toUpperCase(), {
      fontSize: `${8 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(classColor),
    }).setOrigin(0, 0.5);
    roleContainer.add(roleText);
    
    card.add(roleContainer);

    // Редкость
    const rarityColors: Record<string, number> = {
      common: 0x9ca3af,
      rare: 0x3b82f6,
      epic: 0xa855f7,
      legendary: 0xf59e0b,
    };

    const rarityColor = rarityColors[unit.rarity] || 0x888888;
    const rarityBg = this.scene.add.graphics();
    rarityBg.fillStyle(rarityColor, 0.3);
    rarityBg.fillRoundedRect(-30 * s, h / 2 - 24 * s, 60 * s, 18 * s, 9 * s);
    card.add(rarityBg);

    const rarityNameMap: Record<string, string> = {
      common: 'ОБЫЧН.',
      rare: 'РЕДК.',
      epic: 'ЭПИК',
      legendary: 'ЛЕГЕНД.',
    };
    const rarityName = rarityNameMap[unit.rarity] || unit.rarity;
    card.add(
      this.scene.add.text(0, h / 2 - 15 * s, rarityName.toUpperCase(), {
        fontSize: `${8 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(rarityColor),
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );
  }

  private renderOfferFooter(offer: SpecialOffer, modalW: number, modalH: number): void {
    const s = this.s;
    const fonts = getFonts();
    const canAfford = playerData.get().coins >= offer.discountedPrice;

    // Цены
    const priceY = modalH / 2 - 98 * s;
    this.renderPrices(offer, priceY, canAfford);

    // Таймер
    const timerY = priceY + 24 * s;
    this.renderTimer(offer, timerY);

    // Кнопка покупки
    const btnY = modalH / 2 - 42 * s;
    const btnW = modalW - 50 * s;
    const btnH = 44 * s;
    this.renderBuyButton(offer, btnY, btnW, btnH, canAfford);

    // Кнопка "Позже"
    const skipY = btnY + 36 * s;
    this.renderSkipButton(offer, skipY);
  }

  private renderPrices(offer: SpecialOffer, priceY: number, canAfford: boolean): void {
    const s = this.s;
    const fonts = getFonts();

    const priceBg = this.scene.add.graphics();
    priceBg.fillStyle(0x000000, 0.5);
    priceBg.fillRoundedRect(-100 * s, priceY - 20 * s, 200 * s, 40 * s, 12 * s);
    this.modalContainer!.add(priceBg);

    // Старая цена
    const oldPrice = this.scene.add.text(-45 * s, priceY, `💰 ${this.formatNumber(offer.originalPrice)}`, {
      fontSize: `${11 * s}px`,
      fontFamily: fonts.tech,
      color: '#666666',
    }).setOrigin(0.5);
    this.modalContainer!.add(oldPrice);

    // Зачёркивание
    const strike = this.scene.add.graphics();
    strike.lineStyle(2, 0xff4444, 0.9);
    strike.lineBetween(-45 * s - oldPrice.width / 2 - 5, priceY, -45 * s + oldPrice.width / 2 + 5, priceY);
    this.modalContainer!.add(strike);

    // Стрелка
    this.modalContainer!.add(
      this.scene.add.text(0, priceY, '→', { fontSize: `${13 * s}px`, color: '#aaaaaa' }).setOrigin(0.5)
    );

    // Новая цена
    const newPrice = this.scene.add.text(50 * s, priceY, `💰 ${this.formatNumber(offer.discountedPrice)}`, {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.modalContainer!.add(newPrice);

    this.scene.tweens.add({
      targets: newPrice,
      scale: { from: 1, to: 1.1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    });
  }

  private renderTimer(offer: SpecialOffer, timerY: number): void {
    const s = this.s;
    const fonts = getFonts();

    const timerText = this.scene.add.text(0, timerY, `⏰ ДО КОНЦА: ${OffersManager.getTimeRemaining(offer)}`, {
      fontSize: `${10 * s}px`,
      fontFamily: fonts.tech,
      color: '#ff8844',
    }).setOrigin(0.5);
    this.modalContainer!.add(timerText);

    this.scene.tweens.add({
      targets: timerText,
      alpha: { from: 1, to: 0.5 },
      duration: 500,
      yoyo: true,
      repeat: -1,
    });

    // Обновление таймера
    this.offerTimerEvent = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        if (timerText && timerText.active) {
          timerText.setText(`⏰ ДО КОНЦА: ${OffersManager.getTimeRemaining(offer)}`);
        }
      },
      loop: true,
    });
  }

  private renderBuyButton(offer: SpecialOffer, btnY: number, btnW: number, btnH: number, canAfford: boolean): void {
    const s = this.s;
    const fonts = getFonts();

    const btnContainer = this.scene.add.container(0, btnY);
    this.modalContainer!.add(btnContainer);

    if (canAfford) {
      const btnGlow = this.scene.add.graphics();
      btnGlow.fillStyle(offer.accentColor, 0.4);
      btnGlow.fillRoundedRect(-btnW / 2 - 5, -btnH / 2 - 5, btnW + 10, btnH + 10, 15 * s);
      btnContainer.add(btnGlow);

      this.scene.tweens.add({
        targets: btnGlow,
        alpha: { from: 0.4, to: 0.1 },
        scale: { from: 1, to: 1.05 },
        duration: 500,
        yoyo: true,
        repeat: -1,
      });
    }

    const btnBg = this.scene.add.graphics();
    if (canAfford) {
      btnBg.fillStyle(offer.accentColor, 1);
    } else {
      btnBg.fillStyle(0x333344, 1);
    }
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14 * s);
    btnBg.lineStyle(2, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14 * s);
    btnContainer.add(btnBg);

    const btnText = this.scene.add.text(0, 0, canAfford ? '🎁 ЗАБРАТЬ СЕЙЧАС' : '💰 НЕ ХВАТАЕТ МОНЕТ', {
      fontSize: `${13 * s}px`,
      fontFamily: fonts.tech,
      color: canAfford ? '#ffffff' : '#666666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btnContainer.add(btnText);

    if (canAfford) {
      this.scene.tweens.add({
        targets: btnContainer,
        scale: { from: 1, to: 1.03 },
        duration: 300,
        yoyo: true,
        repeat: -1,
      });

      const btnHit = this.scene.add.rectangle(0, 0, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
      btnHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        if (OffersManager.claimOffer(offer.id)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          hapticImpact('heavy');
          this.closeModal(() => this.showPurchaseCelebration(offer));
        }
      });
      btnContainer.add(btnHit);
    }
  }

  private renderSkipButton(offer: SpecialOffer, skipY: number): void {
    const s = this.s;
    const fonts = getFonts();

    const skipBg = this.scene.add.graphics();
    skipBg.fillStyle(0x333344, 0.5);
    skipBg.fillRoundedRect(-70 * s, skipY - 14 * s, 140 * s, 28 * s, 14 * s);
    this.modalContainer!.add(skipBg);

    const skipBtn = this.scene.add.text(0, skipY, '✕ ПОЗЖЕ', {
      fontSize: `${11 * s}px`,
      fontFamily: fonts.tech,
      color: '#888888',
    }).setOrigin(0.5);
    this.modalContainer!.add(skipBtn);

    const skipHit = this.scene.add.rectangle(0, skipY, 160 * s, 40 * s, 0, 0)
      .setInteractive({ useHandCursor: true });
    this.modalContainer!.add(skipHit);

    skipHit.on('pointerover', () => {
      skipBtn.setColor('#bbbbbb');
      skipBg.clear();
      skipBg.fillStyle(0x444455, 0.7);
      skipBg.fillRoundedRect(-70 * s, skipY - 14 * s, 140 * s, 28 * s, 14 * s);
    });

    skipHit.on('pointerout', () => {
      skipBtn.setColor('#888888');
      skipBg.clear();
      skipBg.fillStyle(0x333344, 0.5);
      skipBg.fillRoundedRect(-70 * s, skipY - 14 * s, 140 * s, 28 * s, 14 * s);
    });

    skipHit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      AudioManager.getInstance().playUIClick();
      hapticSelection();
      this.minimizeAndCloseCurrentOffer();
    });
  }

  showPurchaseCelebration(offer: SpecialOffer): void {
    const { width, height } = this.scene.cameras.main;
    const s = this.s;

    // Вспышка
    const flash = this.scene.add.rectangle(width / 2, height / 2, width, height, offer.accentColor, 0.6)
      .setDepth(300);
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 600,
      onComplete: () => flash.destroy(),
    });

    // Текст
    const text = this.scene.add.text(width / 2, height / 2, '🎉 ПОЛУЧЕНО! 🎉', {
      fontSize: `${32 * s}px`,
      fontFamily: getFonts().tech,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(301).setScale(0);

    this.scene.tweens.add({
      targets: text,
      scale: 1.2,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: text,
          scale: 1,
          duration: 200,
          onComplete: () => {
            this.scene.tweens.add({
              targets: text,
              alpha: 0,
              y: height / 2 - 80,
              duration: 800,
              delay: 500,
              onComplete: () => {
                text.destroy();
                this.callbacks.onOfferClaimed();
              },
            });
          },
        });
      },
    });

    // Партиклы
    for (let i = 0; i < 30; i++) {
      const particle = this.scene.add.circle(
        width / 2,
        height / 2,
        Phaser.Math.Between(4, 12),
        Phaser.Math.RND.pick([offer.accentColor, 0xffd700, 0xffffff, 0xff6600]),
        1
      ).setDepth(302);

      const angle = (i / 30) * Math.PI * 2;
      const distance = Phaser.Math.Between(150, 300);

      this.scene.tweens.add({
        targets: particle,
        x: width / 2 + Math.cos(angle) * distance,
        y: height / 2 + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(800, 1400),
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  closeModal(callback?: () => void): void {
    if (this.isTransitioning && !callback) return;
    this.isTransitioning = true;

    // Очистка таймеров
    if (this.offerTimerEvent) {
      this.offerTimerEvent.destroy();
      this.offerTimerEvent = undefined;
    }

    this.allTimerEvents.forEach(event => {
      if (event && event.destroy) event.destroy();
    });
    this.allTimerEvents = [];

    const cleanup = () => {
      if (this.modalContainer) {
        this.scene.tweens.killTweensOf(this.modalContainer);
        this.modalContainer.removeAll(true);
        this.modalContainer.destroy();
        this.modalContainer = undefined;
      }

      if (this.overlay) {
        this.scene.tweens.killTweensOf(this.overlay);
        this.overlay.destroy();
        this.overlay = undefined;
      }

      this.isTransitioning = false;
      callback?.();
    };

    if (this.modalContainer) {
      this.scene.tweens.add({
        targets: this.modalContainer,
        scale: 0.9,
        alpha: 0,
        duration: 150,
      });
    }

    if (this.overlay) {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: 150,
        onComplete: cleanup,
      });
    } else {
      cleanup();
    }
  }

  isModalOpen(): boolean {
    return !!this.modalContainer;
  }

  isInTransition(): boolean {
    return this.isTransitioning;
  }

  destroy(): void {
    this.closeModal();
    this.closeHubModal();
    this.destroyOffersHubButton();
    this.currentOffer = undefined;
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  }

  /**
   * ✅ УЛУЧШЕННЫЙ: Создание карточки оффера с красивым оформлением
   */
  private createOfferCard(
    offer: SpecialOffer,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const s = this.s;
    const fonts = getFonts();
    
    // ═══════════════════════════════════════════════════════════════
    // УЛУЧШЕННЫЙ ФОН С ГРАДИЕНТОМ
    // ═══════════════════════════════════════════════════════════════
    const bgGraphics = this.scene.add.graphics();
    
    // Основной тёмный фон
    bgGraphics.fillStyle(0x0a0a14, 0.95);
    bgGraphics.fillRoundedRect(-width/2, -height/2, width, height, 16 * s);
    
    // Акцентная рамка
    bgGraphics.lineStyle(2, offer.accentColor, 0.8);
    bgGraphics.strokeRoundedRect(-width/2, -height/2, width, height, 16 * s);
    
    // Градиентная полоса сверху
    bgGraphics.fillStyle(offer.accentColor, 0.3);
    bgGraphics.fillRoundedRect(-width/2, -height/2, width, 40 * s, { 
      tl: 16 * s, 
      tr: 16 * s, 
      bl: 0, 
      br: 0 
    } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    
    container.add(bgGraphics);
    
    // ═══════════════════════════════════════════════════════════════
    // БЕЙДЖ СКИДКИ (угловой треугольник)
    // ═══════════════════════════════════════════════════════════════
    if (offer.discountPercent > 0) {
      const badgeSize = 55 * s;
      const badge = this.scene.add.graphics();
      
      // Красный треугольник в правом верхнем углу
      badge.fillStyle(0xFF3B3B, 1);
      badge.beginPath();
      badge.moveTo(width/2 - badgeSize, -height/2);
      badge.lineTo(width/2, -height/2);
      badge.lineTo(width/2, -height/2 + badgeSize);
      badge.closePath();
      badge.fill();
      
      // Текст скидки
      const discountText = this.scene.add.text(
        width/2 - 16 * s,
        -height/2 + 16 * s,
        `-${offer.discountPercent}%`,
        {
          fontFamily: fonts.tech,
          fontSize: `${11 * s}px`,
          color: '#FFFFFF',
          fontStyle: 'bold',
        }
      ).setOrigin(0.5).setRotation(Math.PI / 4);
      
      container.add([badge, discountText]);
    }
    
    // ═══════════════════════════════════════════════════════════════
    // ИКОНКА ТИПА ОФФЕРА
    // ═══════════════════════════════════════════════════════════════
    const typeIcon = this.getOfferTypeIcon(offer.type);
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(offer.accentColor, 0.2);
    iconBg.fillCircle(-width/2 + 25 * s, -height/2 + 20 * s, 18 * s);
    
    const iconText = this.scene.add.text(
      -width/2 + 25 * s,
      -height/2 + 20 * s,
      typeIcon,
      { fontSize: `${20 * s}px` }
    ).setOrigin(0.5);
    
    container.add([iconBg, iconText]);
    
    // ═══════════════════════════════════════════════════════════════
    // ЗАГОЛОВОК
    // ═══════════════════════════════════════════════════════════════
    const title = this.scene.add.text(0, -height/2 + 55 * s, offer.title, {
      fontFamily: fonts.tech,
      fontSize: `${18 * s}px`,
      color: '#FFFFFF',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
    
    // Подзаголовок
    const subtitle = this.scene.add.text(0, -height/2 + 78 * s, offer.subtitle, {
      fontFamily: fonts.primary,
      fontSize: `${13 * s}px`,
      color: hexToString(offer.accentColor),
    }).setOrigin(0.5);
    
    container.add([title, subtitle]);
    
    // ═══════════════════════════════════════════════════════════════
    // РАЗДЕЛИТЕЛЬ
    // ═══════════════════════════════════════════════════════════════
    const divider = this.scene.add.graphics();
    divider.lineStyle(1, offer.accentColor, 0.3);
    divider.lineBetween(-width/2 + 20 * s, -height/2 + 95 * s, width/2 - 20 * s, -height/2 + 95 * s);
    container.add(divider);
    
    // ═══════════════════════════════════════════════════════════════
    // ОПИСАНИЕ
    // ═══════════════════════════════════════════════════════════════
    const description = this.scene.add.text(0, -height/2 + 130 * s, offer.description, {
      fontFamily: fonts.primary,
      fontSize: `${12 * s}px`,
      color: '#AAAAAA',
      align: 'center',
      wordWrap: { width: width - 30 * s },
      lineSpacing: 4,
    }).setOrigin(0.5, 0);
    container.add(description);
    
    // ═══════════════════════════════════════════════════════════════
    // ТАЙМЕР
    // ═══════════════════════════════════════════════════════════════
    const timerY = height/2 - 75 * s;
    const timerBg = this.scene.add.graphics();
    timerBg.fillStyle(0x331111, 0.8);
    timerBg.fillRoundedRect(-60 * s, timerY - 12 * s, 120 * s, 24 * s, 12 * s);
    
    const timerText = this.scene.add.text(
      0, timerY,
      '⏰ ' + this.formatTimeRemaining(offer.expiresAt),
      {
        fontFamily: fonts.primary,
        fontSize: `${12 * s}px`,
        color: '#FF6B6B',
      }
    ).setOrigin(0.5);
    
    container.add([timerBg, timerText]);
    
    // Сохраняем ссылку для обновления
    (container as any).timerText = timerText;
    (container as any).offer = offer;
    
    // ═══════════════════════════════════════════════════════════════
    // ЦЕНЫ
    // ═══════════════════════════════════════════════════════════════
    const priceY = height/2 - 45 * s;
    
    // Старая цена (зачёркнутая)
    const oldPrice = this.scene.add.text(-35 * s, priceY, `${offer.originalPrice}`, {
      fontFamily: fonts.primary,
      fontSize: `${14 * s}px`,
      color: '#666666',
    }).setOrigin(0.5);
    
    // Линия зачёркивания
    const strikethrough = this.scene.add.graphics();
    strikethrough.lineStyle(2, 0x666666, 1);
    const oldPriceWidth = oldPrice.width;
    strikethrough.lineBetween(-35 * s - oldPriceWidth/2 - 3, priceY, -35 * s + oldPriceWidth/2 + 3, priceY);
    
    // Новая цена
    const newPrice = this.scene.add.text(35 * s, priceY, `${offer.discountedPrice} 💎`, {
      fontFamily: fonts.tech,
      fontSize: `${20 * s}px`,
      color: '#FFD700',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    container.add([oldPrice, strikethrough, newPrice]);
    
    // ═══════════════════════════════════════════════════════════════
    // КНОПКА ПОКУПКИ
    // ═══════════════════════════════════════════════════════════════
    const btnWidth = width - 30 * s;
    const btnHeight = 40 * s;
    const btnY = height/2 - 5 * s;
    
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(offer.accentColor, 1);
    btnBg.fillRoundedRect(-btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 10 * s);
    
    const btnText = this.scene.add.text(0, btnY, 'КУПИТЬ', {
      fontFamily: fonts.tech,
      fontSize: `${14 * s}px`,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    container.add([btnBg, btnText]);
    
    // ═══════════════════════════════════════════════════════════════
    // ИНТЕРАКТИВНОСТЬ — ТОЧНЫЕ ГРАНИЦЫ
    // ═══════════════════════════════════════════════════════════════
    const hitArea = new Phaser.Geom.Rectangle(-width/2, -height/2, width, height);
    container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    
    // Hover эффект
    container.on('pointerover', () => {
      container.setScale(1.02);
      btnBg.clear();
      btnBg.fillStyle(0xFFFFFF, 1);
      btnBg.fillRoundedRect(-btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 10 * s);
    });
    
    container.on('pointerout', () => {
      container.setScale(1);
      btnBg.clear();
      btnBg.fillStyle(offer.accentColor, 1);
      btnBg.fillRoundedRect(-btnWidth/2, btnY - btnHeight/2, btnWidth, btnHeight, 10 * s);
    });
    
    container.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.showOfferModal(offer);
    });
    
    return container;
  }

  private getOfferTypeIcon(type: OfferType): string {
    const icons: Record<string, string> = {
      'galaxy_starter': '🚀',
      'elite_squad': '⚔️',
      'faction_mastery': '🏆',
      'weekend_special': '🎉',
      'legendary_drop': '👑',
      'season_pass_bonus': '📈',
      'daily_deal': '🔥',
      'faction': '🛡️',
      'unit_pack': '📦',
      'starter_bundle': '🎁',
      'unit': '👤',
    };
    return icons[type] || '🎁';
  }

  private formatTimeRemaining(expiresAt: number): string {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) return 'Истекло';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours >= 48) {
      const days = Math.floor(hours / 24);
      return `${days}д ${hours % 24}ч`;
    }
    if (hours >= 24) {
      return `1д ${hours - 24}ч`;
    }
    return `${hours}ч ${minutes}м`;
  }
}