// ✅ ИЗМЕНЕНО: Кинематографическое открытие пака с 5 фазами и tap-skip

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../config/themes';
import { playerData } from '../data/PlayerData';
import {
  BALL_SKINS, FIELD_SKINS, BallSkinData, FieldSkinData,
  formatPrice, getRarityName, getRarityColor as getSkinRarityColor,
} from '../data/SkinsCatalog';
import {
  getUnit, getUnitsByFaction, UnitData as CatalogUnitData,
  getRarityColor as getUnitRarityColor, getClassColor, getClassIcon,
  getClassName, formatPrice as formatUnitPrice,
  getRarityName as getUnitRarityName,
} from '../data/UnitsCatalog';
import { getShopUnitsFromRepository, getPremiumUnits, UnitData as RepositoryUnitData, getDisplayName } from '../data/UnitsRepository'; // ✅ НОВОЕ: Магазинные юниты из репозитория

// ✅ Union type для работы с юнитами из обоих источников
type AnyUnitData = CatalogUnitData | RepositoryUnitData;
import { FACTIONS, FactionId, FACTION_IDS, FactionConfig, getFactionPrice } from '../constants/gameConstants';
import { FACTION_UI, getUIFactionByGameFaction } from '../constants/factionUiConfig';
import { AudioManager } from '../managers/AudioManager';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import {
  CARDS_CATALOG,
  CardDefinition,
  CardRarity,
  getCard,
  getCardsByFaction,
  getCardsByRarity,
  openCardPack,
  BOOSTER_PRICES,
  BOOSTER_CARD_COUNT,
} from '../data/CardsCatalog';
import { getAllChests, getChestById, getChestByIdCompat, ChestData } from '../data/ChestsCatalog';
import { openChest, applyRewardsToPlayer, summarizeRewards, RewardItem, RewardSummary } from '../data/ChestLoot';
import { UNITS_REPOSITORY } from '../data/UnitsRepository';
import { tgApp } from '../utils/TelegramWebApp';
import { loadImagesShop } from '../assets/loading/ImageLoader';
import { loadAudioShop } from '../assets/loading/AudioLoader';
import { AssetPackManager } from '../assets/AssetPackManager';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { TOURNAMENT_KEY_KEYS } from '../config/assetKeys';
import { ChestPreviewModal } from '../ui/modals/ChestPreviewModal';

/**
 * Предотвращает нативные события браузера на pointer событии
 */
function preventNativeEvent(pointer: Phaser.Input.Pointer): void {
  if (pointer.event) {
    pointer.event.preventDefault();
    pointer.event.stopPropagation();
  }
}

type ShopTab = 'teams' | 'units' | 'balls' | 'avatars' | 'cards' | 'keys';

interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

interface BoosterResult {
  cards: CardDefinition[];
  factionId?: FactionId;
}

export class ShopScene extends Phaser.Scene {
  private currentTab: ShopTab = 'teams';
  private scrollY = 0;
  private maxScrollY = 0;
  private tabsContainer?: Phaser.GameObjects.Container;
  private contentContainer!: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private crystalsText!: Phaser.GameObjects.Text;
  private cards: Card[] = [];
  private visibleAreaTop = 0;
  private visibleAreaBottom = 0;
  private isDragging = false;
  private lastPointerY = 0;
  private scrollVelocity = 0;
  private isOverlayOpen = false;
  private dragDistance = 0;
  private pointerStartY = 0;
  private boosterOverlay: Phaser.GameObjects.Container | null = null;
  private swipeManager?: SwipeNavigationManager;

  private topInset = 0;
  private bottomInset = 0;

  // ==================== BOOSTER ANIMATION STATE ====================
  private boosterAnimationPhase: number = -1; // -1 = не активна, 0-5 = фазы
  private boosterAnimationTweens: Phaser.Tweens.Tween[] = [];
  private boosterAnimationTimers: Phaser.Time.TimerEvent[] = [];
  private boosterPendingCards: CardDefinition[] = [];
  private boosterPendingFactionId?: FactionId;

  // ==================== CHEST ANIMATION STATE ====================
  private chestOverlay: Phaser.GameObjects.Container | null = null;
  private chestAnimationPhase: number = -1;
  private chestAnimationTweens: Phaser.Tweens.Tween[] = [];
  private chestAnimationTimers: Phaser.Time.TimerEvent[] = [];
  private chestPendingRewards: RewardItem[] = [];
  private chestPendingSummary: any = null;
  private chestPendingId: string | null = null;
  private chestPreviewModal?: ChestPreviewModal;

  constructor() {
    super({ key: 'ShopScene' });
  }

  preload(): void {
    loadImagesShop(this);
    loadAudioShop(this);
  }

  create(): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    console.log('[ShopScene] Insets - Top:', this.topInset, 'Bottom:', this.bottomInset);

    AudioManager.getInstance().init(this);
    this.resetState();
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createContentArea();
    this.renderContent();
    this.setupScrolling();
    if (this.currentTab === 'units') {
      this.time.delayedCall(50, () => {
        void this.loadShopUnitPngs();
      });
    }
    
    // ✅ Инициализация свайп-навигации
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
    });
    this.swipeManager.enable();
  }

  private async loadShopUnitPngs(): Promise<void> {
    const currentFaction = playerData.getFaction() || FACTION_IDS[0];
    const sortedFactions = [...FACTION_IDS].sort((a, b) =>
      a === currentFaction ? -1 : b === currentFaction ? 1 : 0
    );
    const unitIds = [...new Set([
      ...getPremiumUnits().map((unit) => unit.id),
      ...sortedFactions.flatMap((factionId) =>
        getShopUnitsFromRepository(factionId).map((unit) => unit.id)
      ),
    ])];
    const batchSize = 6;

    try {
      for (let index = 0; index < unitIds.length && this.scene.isActive(); index += batchSize) {
        await AssetPackManager.loadUnitAssets(this, unitIds.slice(index, index + batchSize));
        if (this.scene.isActive() && this.currentTab === 'units') {
          this.renderContent();
        }

        if (index + batchSize < unitIds.length) {
          await new Promise<void>((resolve) => this.time.delayedCall(90, () => resolve()));
        }
      }
    } catch (error) {
      console.warn('[ShopScene] Failed to lazy-load shop unit PNGs:', error);
    }
  }

  private getBestUnitTextureKey(unit: Pick<AnyUnitData, 'id' | 'assetKey'>): string | null {
    const candidates = [
      `${unit.assetKey}_512`,
      unit.assetKey,
      `${unit.id}_512`,
      unit.id,
    ];

    return candidates.find((key) => this.textures.exists(key)) || null;
  }

  shutdown(): void {
    this.swipeManager?.destroy();
    this.chestPreviewModal?.destroy();
    this.chestPreviewModal = undefined;
  }

  update(): void {
    if (!this.isDragging && !this.isOverlayOpen && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.updateCardPositions();
    }
  }

  private handleBack(): void {
    if (this.isOverlayOpen) {
      if (this.boosterAnimationPhase >= 0) {
        this.handleBoosterTapSkip();
      } else if (this.chestAnimationPhase >= 0) {
        this.handleChestTapSkip();
      }
    } else {
      this.scene.start('MainMenuScene');
    }
  }

  private resetState(): void {
    this.cards = [];
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.isOverlayOpen = false;
    this.dragDistance = 0;
    this.boosterOverlay = null;
    this.boosterAnimationPhase = -1;
    this.boosterAnimationTweens = [];
    this.boosterAnimationTimers = [];
    this.boosterPendingCards = [];
    this.boosterPendingFactionId = undefined;
    this.chestOverlay = null;
    this.chestAnimationPhase = -1;
    this.chestAnimationTweens = [];
    this.chestAnimationTimers = [];
    this.chestPendingRewards = [];
    this.chestPendingSummary = null;
    this.chestPendingId = null;
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;

    const bg = this.add.graphics();
    for (let y = 0; y < height; y++) {
      const ratio = y / height;
      const r = Math.floor(8 + ratio * 12);
      const g = Math.floor(8 + ratio * 8);
      const b = Math.floor(25 + ratio * 15);
      bg.fillStyle((r << 16) | (g << 8) | b, 1);
      bg.fillRect(0, y, width, 1);
    }

    for (let i = 0; i < 50; i++) {
      const star = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.5, 1.5),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.6)
      );
      this.tweens.add({
        targets: star,
        alpha: 0.1,
        duration: Phaser.Math.Between(1500, 3000),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const colors = getColors();
    const data = playerData.get();

    const headerHeight = 95 + this.topInset;

    const hdr = this.add.graphics().setDepth(100);
    hdr.fillStyle(0x000000, 0.9);
    hdr.fillRect(0, 0, width, headerHeight);
    hdr.lineStyle(2, colors.uiAccent, 0.4);
    hdr.lineBetween(0, headerHeight, width, headerHeight);

    // Только заголовок — БЕЗ КНОПКИ НАЗАД
    this.add.text(width / 2, 28 + this.topInset, '✦ GALACTIC MARKET ✦', {
      fontSize: '16px', fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);

    this.add.text(width / 2, 48 + this.topInset, 'Premium Equipment', {
      fontSize: '9px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent),
    }).setOrigin(0.5).setDepth(101);

    // Валюта
    const currencyY = 72 + this.topInset;
    const currBg = this.add.graphics().setDepth(100);
    currBg.fillStyle(0x1a1a2e, 0.8);
    currBg.fillRoundedRect(width / 2 - 100, currencyY - 12, 200, 24, 12);

    // Монеты
    const coinsIconX = width / 2 - 85;
    if (this.textures.exists('ui_rewards_coins')) {
      const coinsIcon = this.add.image(coinsIconX, currencyY, 'ui_rewards_coins');
      coinsIcon.setDisplaySize(14, 14);
      coinsIcon.setOrigin(0, 0.5);
      coinsIcon.setDepth(101);
    } else {
      this.add.text(coinsIconX, currencyY, '💰', { fontSize: '14px' })
        .setOrigin(0, 0.5).setDepth(101);
    }
    this.coinsText = this.add.text(width / 2 - 25, currencyY, this.formatNum(data.coins), {
      fontSize: '13px', fontFamily: fonts.tech, color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);

    // Кристаллы
    const crystalsIconX = width / 2 + 15;
    if (this.textures.exists('ui_rewards_crystals')) {
      const crystalsIcon = this.add.image(crystalsIconX, currencyY, 'ui_rewards_crystals');
      crystalsIcon.setDisplaySize(14, 14);
      crystalsIcon.setOrigin(0, 0.5);
      crystalsIcon.setDepth(101);
    } else {
      this.add.text(crystalsIconX, currencyY, '💎', { fontSize: '14px' })
        .setOrigin(0, 0.5).setDepth(101);
    }
    this.crystalsText = this.add.text(width / 2 + 85, currencyY, `${data.crystals}`, {
      fontSize: '13px', fontFamily: fonts.tech, color: '#ff00ff', fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
  }

  private createTabs(): void {
    this.tabsContainer?.destroy();
    this.tabsContainer = this.add.container(0, 0).setDepth(89);

    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const tabs: { id: ShopTab; label: string }[] = [
      { id: 'teams', label: '🛸 КОМАНДА' },
      { id: 'units', label: '👾 ФИШКИ' },
      { id: 'balls', label: '⚡ МЯЧИ' },
      { id: 'avatars', label: '🎭 АВАТАРКИ' },
      { id: 'cards', label: '🎁 ПАКИ' },
      { id: 'keys', label: '🎟️ КЛЮЧИ' },
    ];

    const tabW = (width - 32) / 6; // ✅ Изменено с /5 на /6
    const tabH = 42;
    const y = 105 + this.topInset;

    const tabsBg = this.add.graphics()
      .fillStyle(0x000000, 0.5)
      .fillRoundedRect(10, y - 3, width - 20, tabH + 6, 22);
    this.tabsContainer.add(tabsBg);

    tabs.forEach((tab, i) => {
      const x = 12 + i * (tabW + 2);
      const isActive = this.currentTab === tab.id;

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1);
        bg.fillRoundedRect(x, y, tabW, tabH, 20);
        bg.lineStyle(2, 0xffffff, 0.6);
        bg.strokeRoundedRect(x, y, tabW, tabH, 20);
      } else {
        bg.fillStyle(0x050816, 0.9);
        bg.fillRoundedRect(x, y, tabW, tabH, 20);
        bg.lineStyle(1, 0x1f2937, 0.8);
        bg.strokeRoundedRect(x, y, tabW, tabH, 20);
      }

      const tabText = this.add.text(x + tabW / 2, y + tabH / 2, tab.label, {
        fontSize: isActive ? '10px' : '9px', 
        fontFamily: fonts.tech,
        color: isActive ? '#000000' : '#9ca3af', 
        fontStyle: 'bold',
      }).setOrigin(0.5);
      tabText.setResolution(2);
      this.tabsContainer.add([bg, tabText]);

      const hit = this.add.rectangle(x + tabW / 2, y + tabH / 2, tabW, tabH, 0, 0)
        .setInteractive({ useHandCursor: true });
      this.tabsContainer.add(hit);

      hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        preventNativeEvent(pointer);
        
        if (this.currentTab !== tab.id) {
          AudioManager.getInstance().playUIClick();
          hapticSelection();
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.createTabs();
          this.renderContent();
          if (this.currentTab === 'units') {
            this.time.delayedCall(50, () => {
              void this.loadShopUnitPngs();
            });
          }
        }
      });
    });
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    this.visibleAreaTop = 155 + this.topInset;
    this.visibleAreaBottom = height - 20 - this.bottomInset;

    const mask = this.add.graphics()
      .fillStyle(0xffffff)
      .fillRect(0, this.visibleAreaTop, width, this.visibleAreaBottom - this.visibleAreaTop);
    mask.setVisible(false);

    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setMask(mask.createGeometryMask());
  }

  private renderContent(): void {
    this.contentContainer.removeAll(true);
    this.cards = [];

    switch (this.currentTab) {
      case 'teams': this.renderTeams(); break;
      case 'units': this.renderUnits(); break;
      case 'balls': this.renderBalls(); break;
      case 'avatars': this.renderAvatars(); break;
      case 'cards': this.renderCards(); break;
      case 'keys': this.renderKeys(); break;
    }
    this.updateCardPositions();
  }

  // ==================== TEAMS TAB ====================

  private renderTeams(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    let y = this.visibleAreaTop + 15;

    const ownedFactions = playerData.getOwnedFactions();
    
    const purchasedFactions: FactionId[] = [];
    const availableForPurchase: FactionId[] = [];
    
    FACTION_IDS.forEach(factionId => {
      if (ownedFactions.includes(factionId)) {
        purchasedFactions.push(factionId);
      } else {
        availableForPurchase.push(factionId);
      }
    });

    if (purchasedFactions.length > 0) {
      y = this.addSection(y, '✦ YOUR TEAMS', colors.uiAccent);
      purchasedFactions.forEach(factionId => {
        const cardH = 140;
        const container = this.createFactionCard(12, y, width - 24, cardH, FACTIONS[factionId], true);
        this.contentContainer.add(container);
        this.cards.push({ container, y, height: cardH });
        y += cardH + 12;
      });
    }

    if (availableForPurchase.length > 0) {
      y = this.addSection(y + 10, '🔒 UNLOCK NEW FACTIONS', colors.uiAccentPink);
      availableForPurchase.forEach(factionId => {
        const cardH = 160;
        const container = this.createFactionCard(12, y, width - 24, cardH, FACTIONS[factionId], false);
        this.contentContainer.add(container);
        this.cards.push({ container, y, height: cardH });
        y += cardH + 12;
      });
    }

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 50);
  }

  private createFactionCard(
    x: number, y: number, w: number, h: number,
    faction: FactionConfig, isOwned: boolean
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const isActive = playerData.getFaction() === faction.id;
    const price = getFactionPrice(faction.id);
    
    const uiFactionId = getUIFactionByGameFaction(faction.id);
    const uiConfig = FACTION_UI[uiFactionId];

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a15, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 16);
    container.add(bg);
    
    const topBar = this.add.graphics();
    topBar.fillStyle(faction.color, isOwned ? 0.5 : 0.25);
    topBar.fillRoundedRect(0, 0, w, 50, { tl: 16, tr: 16, bl: 0, br: 0 } as any);
    container.add(topBar);
    
    const border = this.add.graphics();
    border.lineStyle(2, isActive ? 0x00ff00 : (isOwned ? faction.color : 0x444455), isOwned ? 0.9 : 0.5);
    border.strokeRoundedRect(0, 0, w, h, 16);
    container.add(border);

    const iconX = 45;
    const iconY = 50;
    
    const glow = this.add.graphics();
    glow.fillStyle(faction.color, isOwned ? 0.4 : 0.2);
    glow.fillCircle(iconX, iconY, 32);
    container.add(glow);
    
    if (this.textures.exists(faction.assetKey)) {
      const icon = this.add.image(iconX, iconY, faction.assetKey);
      icon.setDisplaySize(50, 50);
      icon.setAlpha(isOwned ? 1 : 0.7);
      container.add(icon);
    } else {
      const circle = this.add.graphics();
      circle.fillStyle(faction.color, 0.8);
      circle.fillCircle(iconX, iconY, 22);
      circle.lineStyle(2, 0xffffff, 0.3);
      circle.strokeCircle(iconX, iconY, 22);
      container.add(circle);
      
      const letter = this.add.text(iconX, iconY, faction.name.charAt(0), {
        fontSize: '20px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(letter);
    }

    const textX = 100;
    
    container.add(this.add.text(textX, 20, faction.name.toUpperCase(), {
      fontSize: '14px', fontFamily: fonts.tech,
      color: hexToString(faction.color), fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    container.add(this.add.text(textX, 42, faction.description, {
      fontSize: '9px', color: '#999999',
      wordWrap: { width: w - textX - 15 },
    }).setOrigin(0, 0));

    const statsY = 75;
    const massPercent = Math.round(faction.stats.mass * 100);
    const speedPercent = Math.round((faction.stats.speed || 1) * 100);
    const controlPercent = faction.stats.control ? Math.round(faction.stats.control * 100) : null;

    let statsText = `⚖️ Mass: ${massPercent}%   💨 Speed: ${speedPercent}%`;
    if (controlPercent) {
      statsText += `   ✨ Control: ${controlPercent}%`;
    }
    
    container.add(this.add.text(textX, statsY, statsText, {
      fontSize: '9px', fontFamily: fonts.tech, color: '#666666',
    }).setOrigin(0, 0.5));

    if (!isOwned) {
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.35);
      overlay.fillRoundedRect(0, 0, w, h, 16);
      container.add(overlay);

      const lockBg = this.add.graphics();
      lockBg.fillStyle(0x000000, 0.7);
      lockBg.fillCircle(w - 25, 25, 16);
      container.add(lockBg);
      
      container.add(this.add.text(w - 25, 25, '🔒', { fontSize: '16px' }).setOrigin(0.5));
    }

    const btnY = h - 30;
    const btnW = 140;
    const btnH = 34;

    if (isActive) {
      const activeBg = this.add.graphics();
      activeBg.fillStyle(0x22c55e, 0.2);
      activeBg.fillRoundedRect(w / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
      activeBg.lineStyle(2, 0x22c55e, 0.8);
      activeBg.strokeRoundedRect(w / 2 - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
      container.add(activeBg);
      
      container.add(this.add.text(w / 2, btnY, '✓ ACTIVE TEAM', {
        fontSize: '11px', fontFamily: fonts.tech, color: '#22c55e', fontStyle: 'bold',
      }).setOrigin(0.5));

    } else if (isOwned) {
      container.add(this.createButton(w / 2, btnY, btnW, btnH, '▶ SELECT', () => {
        AudioManager.getInstance().playUIClick();
        hapticSelection();
        playerData.switchFaction(faction.id);
        this.renderContent();
      }, faction.color));

    } else {
      const canAfford = playerData.get().coins >= (price.coins || 0);
      const priceStr = `🔓 💰 ${this.formatNum(price.coins || 15000)}`;

      container.add(this.createButton(w / 2, btnY, 160, btnH, priceStr, () => {
        if (playerData.buyFaction(faction.id)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          hapticImpact('medium');
          this.updateCurrency();
          this.renderContent();
        }
      }, canAfford ? colors.uiGold : 0x555555));

      container.add(this.add.text(w / 2, btnY + 24, '✦ Includes starter unit', {
        fontSize: '8px', color: '#555555',
      }).setOrigin(0.5));
    }

    return container;
  }

  // ==================== UNITS TAB ====================

  private renderUnits(): void {
    const { width } = this.cameras.main;
    let y = this.visibleAreaTop + 10;

    // ✅ НОВОЕ: Секция премиум юнитов (в начале)
    const premiumUnits = getPremiumUnits();
    if (premiumUnits.length > 0) {
      y = this.addPremiumSectionHeader(y);
      
      premiumUnits.forEach((unit) => {
        const ownedUniqueUnits = playerData.get().ownedUniqueUnits || [];
        const isUnitOwned = ownedUniqueUnits.includes(unit.id);
        const canBuy = !isUnitOwned;
        const premiumPrice = unit.premiumPrice || 1000;
        const canAfford = playerData.get().crystals >= premiumPrice;

        const cardH = unit.specialAbility ? 200 : 175;
        const container = this.createPremiumUnitCard(12, y, width - 24, cardH, unit, isUnitOwned, canBuy, canAfford, premiumPrice);
        this.contentContainer.add(container);
        this.cards.push({ container, y, height: cardH });
        y += cardH + 12;
      });

      y += 20; // Отступ после премиум секции
    }

    const currentFaction = playerData.getFaction();
    const sorted = [...FACTION_IDS].sort((a, b) => (a === currentFaction ? -1 : b === currentFaction ? 1 : 0));

    sorted.forEach((factionId) => {
      const faction = FACTIONS[factionId];
      const isOwned = playerData.ownsFaction(factionId);
      const isCurrent = factionId === currentFaction;

      y = this.addFactionHeader(y, faction, isCurrent, isOwned);

      // ✅ НОВОЕ (2026-01-20): В магазине показываем только юниты с флагом isShopItem из REPOSITORY
      // Базовые юниты из CATALOG больше НЕ продаются!
      const shopUnits = getShopUnitsFromRepository(factionId); // Уже отсортированы по цене
      shopUnits.forEach((unit) => {
        const ownedData = playerData.getOwnedUnit(unit.id);
        const isUnitOwned = !!ownedData;
        const isLocked = !isOwned; // Фракция не куплена
        const canBuy = isOwned && !isUnitOwned; // Фракция есть, юнит не куплен

        const cardH = unit.specialAbility ? 200 : 175;
        const container = this.createUnitCard(12, y, width - 24, cardH, unit, isUnitOwned, canBuy, isLocked, faction);
        this.contentContainer.add(container);
        this.cards.push({ container, y, height: cardH });
        y += cardH + 12;
      });

      y += 15;
    });

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 50);
  }

  private addPremiumSectionHeader(y: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const line = this.add.graphics();
    line.fillStyle(0xf59e0b, 0.8); // Золотой цвет для премиум
    line.fillRect(12, y + 15, width - 24, 2);
    this.contentContainer.add(line);

    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0a0a15, 1);
    labelBg.fillRoundedRect(width / 2 - 120, y, 240, 32, 16);
    labelBg.lineStyle(2, 0xf59e0b, 0.8);
    labelBg.strokeRoundedRect(width / 2 - 120, y, 240, 32, 16);
    this.contentContainer.add(labelBg);

    this.contentContainer.add(this.add.text(width / 2, y + 16, '💎 PREMIUM UNITS', {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    return y + 40;
  }

  private createPremiumUnitCard(
    x: number, y: number, w: number, h: number,
    unit: RepositoryUnitData, isOwned: boolean, canBuy: boolean, canAfford: boolean, price: number
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    // Цвета для legendary редкости
    const rarityColor = 0xf59e0b; // Золотой
    const rarityGlow = 0xfbbf24;
    // ✅ НОВОЕ: Юниты из Repository используют 'role' вместо 'capClass'
    const unitClass = 'capClass' in unit ? unit.capClass : ('role' in unit ? unit.role : 'balanced');
    const classColor = getClassColor(unitClass as any);
    
    // Получаем конфиг фракции
    const faction = FACTIONS[unit.factionId] || FACTIONS.magma;

    // ========== ПРЕМИУМ СВЕЧЕНИЕ (внешнее) ==========
    const outerGlow = this.add.graphics();
    outerGlow.fillStyle(rarityColor, 0.15);
    outerGlow.fillRoundedRect(-6, -6, w + 12, h + 12, 18);
    container.add(outerGlow);
    
    // Анимация пульсации свечения
    this.tweens.add({
      targets: outerGlow,
      alpha: { from: 0.15, to: 0.3 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // ========== ФОН КАРТОЧКИ ==========
    const bg = this.add.graphics();
    
    // Градиентный эффект для премиума
    if (isOwned) {
      bg.fillStyle(rarityColor, 0.12);
      bg.fillRoundedRect(-3, -3, w + 6, h + 6, 16);
    }
    
    // Основной фон
    bg.fillStyle(0x12121f, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 14);
    
    // Цветная боковая полоса фракции (как у обычных)
    bg.fillStyle(faction.color, isOwned ? 0.6 : 0.4);
    bg.fillRoundedRect(0, 0, 8, h, { tl: 14, bl: 14, tr: 0, br: 0 } as any);
    
    // Премиум рамка (золотая, толще чем обычная)
    bg.lineStyle(3, isOwned ? rarityColor : 0x8b7355, isOwned ? 1 : 0.6);
    bg.strokeRoundedRect(0, 0, w, h, 14);
    container.add(bg);

    // ========== ИКОНКА ЮНИТА (слева, как у обычных) ==========
    const iconX = 60, iconY = 70, iconSize = 100;
    const textureKey = this.getBestUnitTextureKey(unit);
    
    if (textureKey) {
      // Glow эффект для owned
      if (isOwned) {
        const glow = this.add.image(iconX, iconY, textureKey)
          .setDisplaySize(iconSize + 24, iconSize + 24)
          .setTint(rarityColor)
          .setAlpha(0.4)
          .setBlendMode(Phaser.BlendModes.ADD);
        container.add(glow);
        
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.4, to: 0.2 },
          scaleX: { from: 1, to: 1.08 },
          scaleY: { from: 1, to: 1.08 },
          duration: 1800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
      
      // Основное изображение
      const unitImg = this.add.image(iconX, iconY, textureKey)
        .setDisplaySize(iconSize, iconSize)
        .setAlpha(isOwned ? 1 : 0.75);
      container.add(unitImg);
    }

    // ========== БЕЙДЖ КЛАССА (под иконкой) ==========
    const classY = iconY + 55;
    const classBg = this.add.graphics();
    classBg.fillStyle(classColor, 0.3);
    classBg.fillRoundedRect(iconX - 42, classY, 84, 24, 12);
    classBg.lineStyle(1, classColor, 0.5);
    classBg.strokeRoundedRect(iconX - 42, classY, 84, 24, 12);
    container.add(classBg);
    
    container.add(this.add.text(iconX, classY + 12, `${getClassIcon(unitClass as any)} ${getClassName(unitClass as any)}`, {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: hexToString(classColor),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // ========== НАЗВАНИЕ И ТИТУЛ (справа) ==========
    const tx = 125;
    const tw = w - tx - 15;
    
    // Название
    container.add(this.add.text(tx, 14, getDisplayName(unit).toUpperCase(), {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }));
    
    // Титул
    container.add(this.add.text(tx, 34, unit.title || 'Premium Unit', {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: hexToString(faction.color),
    }));

    // ========== БЕЙДЖ РЕДКОСТИ + ПРЕМИУМ ==========
    const rarBg = this.add.graphics();
    rarBg.fillStyle(rarityColor, 0.3);
    rarBg.fillRoundedRect(tx + tw - 75, 28, 75, 20, 10);
    rarBg.lineStyle(1, rarityColor, 0.6);
    rarBg.strokeRoundedRect(tx + tw - 75, 28, 75, 20, 10);
    container.add(rarBg);
    
    container.add(this.add.text(tx + tw - 37, 38, '💎 LEGENDARY', {
      fontSize: '8px',
      fontFamily: fonts.tech,
      color: '#fbbf24',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // ========== ОПИСАНИЕ ==========
    const descY = 52;
    const descH = 42;
    const descBg = this.add.graphics();
    descBg.fillStyle(0x000000, 0.25);
    descBg.fillRoundedRect(tx - 3, descY, tw + 6, descH, 6);
    container.add(descBg);
    
    let descText = unit.description || 'An exclusive premium unit with unique abilities.';
    if (descText.length > 80) descText = descText.substring(0, 77) + '...';
    
    container.add(this.add.text(tx, descY + 4, descText, {
      fontSize: '9px',
      fontFamily: fonts.primary,
      color: '#cccccc',
      wordWrap: { width: tw },
      lineSpacing: 1,
    }));

    // ========== СТАТИСТИКА С БАРАМИ ==========
    const statsY = 100;
    const statLabels = ['⚡', '🛡️', '💨', '✨'];
    const statNames = ['POW', 'DEF', 'SPD', 'TEC'];
    const statVals = [
      unit.stats?.power || 3,
      unit.stats?.defense || 3,
      unit.stats?.speed || 3,
      unit.stats?.technique || 3
    ];
    const statW = (tw - 12) / 4;
    
    statLabels.forEach((icon, i) => {
      const sx = tx + i * (statW + 3);
      
      container.add(this.add.text(sx, statsY, icon, { fontSize: '10px' }));
      container.add(this.add.text(sx + 14, statsY + 1, statNames[i], {
        fontSize: '7px',
        fontFamily: fonts.tech,
        color: '#888888',
      }));
      
      // Фон бара
      const barBg = this.add.graphics();
      barBg.fillStyle(0x333344, 1);
      barBg.fillRoundedRect(sx, statsY + 14, statW, 6, 3);
      container.add(barBg);
      
      // Заполнение бара (золотой цвет для премиума)
      const barFill = this.add.graphics();
      barFill.fillStyle(rarityColor, 1);
      barFill.fillRoundedRect(sx, statsY + 14, (statVals[i] / 5) * statW, 6, 3);
      container.add(barFill);
    });

    // ========== СПОСОБНОСТЬ ==========
    if (unit.specialAbility) {
      const abilityY = 130;
      const abBg = this.add.graphics();
      abBg.fillStyle(rarityColor, 0.15);
      abBg.fillRoundedRect(tx - 3, abilityY, tw + 6, 22, 6);
      abBg.lineStyle(1, rarityColor, 0.3);
      abBg.strokeRoundedRect(tx - 3, abilityY, tw + 6, 22, 6);
      container.add(abBg);
      
      container.add(this.add.text(tx + 2, abilityY + 11, `✦ ${unit.specialAbility}`, {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: '#fbbf24',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5));
    }

    // ========== КНОПКА ПОКУПКИ / OWNED ==========
    const btnY = h - 28;
    const btnW = w - 30;
    const btnH = 36;
    
    if (isOwned) {
      // Owned badge
      const ownedBg = this.add.graphics();
      ownedBg.fillStyle(0x10b981, 0.2);
      ownedBg.fillRoundedRect(15, btnY - btnH/2, btnW, btnH, 8);
      ownedBg.lineStyle(2, 0x10b981, 0.6);
      ownedBg.strokeRoundedRect(15, btnY - btnH/2, btnW, btnH, 8);
      container.add(ownedBg);
      
      container.add(this.add.text(w / 2, btnY, '✓ OWNED', {
        fontSize: '14px',
        fontFamily: fonts.tech,
        color: '#10b981',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
    } else if (canBuy) {
      // Buy button
      const btnColor = canAfford ? rarityColor : 0x444444;
      const priceText = `💎 ${price.toLocaleString()}`;
      
      const buyBtn = this.add.container(w / 2, btnY);
      
      const btnBg = this.add.graphics();
      btnBg.fillStyle(btnColor, canAfford ? 0.9 : 0.5);
      btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
      if (canAfford) {
        btnBg.lineStyle(2, 0xfbbf24, 0.8);
        btnBg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
      }
      buyBtn.add(btnBg);
      
      buyBtn.add(this.add.text(0, 0, `🔓 UNLOCK  ${priceText}`, {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: canAfford ? '#000000' : '#888888',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
      if (canAfford) {
        const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        buyBtn.add(hitArea);
        
        hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          preventNativeEvent(pointer);
          this.purchasePremiumUnit(unit, price);
        });
        
        hitArea.on('pointerover', () => {
          btnBg.clear();
          btnBg.fillStyle(0xfbbf24, 1);
          btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
        });
        
        hitArea.on('pointerout', () => {
          btnBg.clear();
          btnBg.fillStyle(btnColor, 0.9);
          btnBg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
          btnBg.lineStyle(2, 0xfbbf24, 0.8);
          btnBg.strokeRoundedRect(-btnW/2, -btnH/2, btnW, btnH, 8);
        });
      }
      
      container.add(buyBtn);
    }

    return container;
  }

  /**
   * Покупка премиум юнита за кристаллы
   */
  private purchasePremiumUnit(unit: RepositoryUnitData, price: number): void {
    const data = playerData.get();
    
    if (data.crystals < price) {
      // Показываем сообщение о недостатке кристаллов через звук и вибрацию
      AudioManager.getInstance().playSFX('sfx_error');
      hapticImpact('medium');
      return;
    }
    
    // Списываем кристаллы
    if (!playerData.spendCrystals(price)) {
      return;
    }
    
    // Разблокируем юнита
    playerData.unlockUnit(unit.id);
    
    // Добавляем в ownedUnits фракции
    const factionId = unit.factionId;
    if (!data.ownedUnits[factionId]) {
      data.ownedUnits[factionId] = [];
    }
    const alreadyInOwned = data.ownedUnits[factionId].some(u => u.id === unit.id);
    if (!alreadyInOwned) {
      data.ownedUnits[factionId].push({
        id: unit.id,
        unlockedAt: Date.now(),
        upgrades: { power: 1, mass: 1, aim: 1, technique: 1 },
      });
      
      // ✅ Автоматически добавляем в команду, если есть пустой слот
      const team = data.factionTeams[factionId] || [];
      const allowedSize = playerData.getAllowedTeamSize(factionId);
      
      // Ищем пустой слот
      let addedToTeam = false;
      for (let i = 0; i < allowedSize; i++) {
        if (!team[i] || team[i] === '') {
          team[i] = unit.id;
          addedToTeam = true;
          break;
        }
      }
      
      // Если нет пустых слотов, но команда меньше разрешенного размера - расширяем
      if (!addedToTeam && team.length < allowedSize) {
        team.push(unit.id);
        addedToTeam = true;
      }
      
      // Обрезаем до разрешенного размера
      data.factionTeams[factionId] = team.slice(0, allowedSize);
      
      if (addedToTeam) {
        console.log(`✅ Premium unit ${unit.id} added to team ${factionId}:`, data.factionTeams[factionId]);
      } else {
        console.log(`ℹ️ Premium unit ${unit.id} added to ownedUnits but team is full`);
      }
    }
    playerData.save();
    
    // Эффект и звук
    AudioManager.getInstance().playSFX('sfx_cash');
    hapticImpact('light');
    
    // Обновляем UI
    this.updateCurrency();
    this.renderContent();
  }

  private addFactionHeader(y: number, faction: FactionConfig, isCurrent: boolean, isOwned: boolean): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const line = this.add.graphics();
    line.fillStyle(faction.color, isCurrent ? 0.6 : 0.25);
    line.fillRect(12, y + 15, width - 24, 2);
    this.contentContainer.add(line);

    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0a0a15, 1);
    labelBg.fillRoundedRect(width / 2 - 85, y, 170, 32, 16);
    labelBg.lineStyle(2, faction.color, isCurrent ? 0.8 : 0.4);
    labelBg.strokeRoundedRect(width / 2 - 85, y, 170, 32, 16);
    this.contentContainer.add(labelBg);

    const icon = isCurrent ? '⭐' : isOwned ? '✓' : '🔒';
    this.contentContainer.add(this.add.text(width / 2, y + 16, `${icon} ${faction.name.toUpperCase()}`, {
      fontSize: '12px', fontFamily: fonts.tech, color: hexToString(faction.color), fontStyle: 'bold',
    }).setOrigin(0.5));

    return y + 45;
  }

  private createUnitCard(
    x: number, y: number, w: number, h: number,
    unit: AnyUnitData, isOwned: boolean, canBuy: boolean, isLocked: boolean, faction: FactionConfig
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const rarityColor = getUnitRarityColor(unit.rarity);
    // ✅ НОВОЕ: Юниты из Repository используют 'role' вместо 'capClass'
    const unitClass = 'capClass' in unit ? unit.capClass : ('role' in unit ? unit.role : 'balanced');
    const classColor = getClassColor(unitClass as any);

    const bg = this.add.graphics();
    if (isOwned && unit.rarity !== 'common') {
      bg.fillStyle(rarityColor, 0.12);
      bg.fillRoundedRect(-3, -3, w + 6, h + 6, 16);
    }
    bg.fillStyle(0x12121f, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 14);
    bg.fillStyle(faction.color, isLocked ? 0.1 : 0.5);
    bg.fillRoundedRect(0, 0, 8, h, { tl: 14, bl: 14, tr: 0, br: 0 } as any);
    bg.lineStyle(2, isOwned ? rarityColor : isLocked ? 0x333344 : faction.color, isLocked ? 0.3 : 0.7);
    bg.strokeRoundedRect(0, 0, w, h, 14);
    container.add(bg);

    if (isLocked) {
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.45);
      overlay.fillRoundedRect(0, 0, w, h, 14);
      container.add(overlay);
      
      const iconX = 60, iconY = 70;
      const textureKey = this.getBestUnitTextureKey(unit);
      if (textureKey) {
        // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
        const img = this.add.image(iconX, iconY, textureKey)
          .setDisplaySize(88, 88)
          .setAlpha(0.35)
          .setTint(0x888888);
        container.add(img);
      }
      
      container.add(this.add.text(130, 25, getDisplayName(unit).toUpperCase(), {
        fontSize: '13px', fontFamily: fonts.tech, color: '#555555', fontStyle: 'bold',
      }));
      
      container.add(this.add.text(w / 2, h / 2, '🔒 UNLOCK FACTION FIRST', {
        fontSize: '13px', fontFamily: fonts.tech, color: '#666666',
      }).setOrigin(0.5));
      
      container.add(this.createButton(w / 2, h - 28, 150, 28, `View ${faction.name.split(' ')[0]}`, () => {
        AudioManager.getInstance().playUIClick();
        this.currentTab = 'teams';
        this.scrollY = 0;
        this.scene.restart();
      }, faction.color, true));
      
      return container;
    }

    // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
    const iconX = 60, iconY = 70, iconSize = 100;
    const textureKey = this.getBestUnitTextureKey(unit);

    if (textureKey) {
      if (isOwned) {
        const glow = this.add.image(iconX, iconY, textureKey)
          .setDisplaySize(iconSize + 20, iconSize + 20)
          .setTint(faction.color).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
        container.add(glow);
        this.tweens.add({ targets: glow, alpha: 0.15, scale: 1.1, duration: 1500, yoyo: true, repeat: -1 });
      }
      container.add(this.add.image(iconX, iconY, textureKey)
        .setDisplaySize(iconSize, iconSize)
        .setAlpha(isOwned ? 1 : 0.8));
    }

    const classY = iconY + 55;
    const classBg = this.add.graphics();
    classBg.fillStyle(classColor, 0.3);
    classBg.fillRoundedRect(iconX - 42, classY, 84, 24, 12);
    classBg.lineStyle(1, classColor, 0.5);
    classBg.strokeRoundedRect(iconX - 42, classY, 84, 24, 12);
    container.add(classBg);
    container.add(this.add.text(iconX, classY + 12, `${getClassIcon(unitClass as any)} ${getClassName(unitClass as any)}`, {
      fontSize: '10px', fontFamily: fonts.tech, color: hexToString(classColor), fontStyle: 'bold',
    }).setOrigin(0.5));

    const tx = 125;
    const tw = w - tx - 15;

    container.add(this.add.text(tx, 14, getDisplayName(unit).toUpperCase(), {
      fontSize: '14px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
    }));

    container.add(this.add.text(tx, 34, unit.title, {
      fontSize: '10px', fontFamily: fonts.tech, color: hexToString(faction.color),
    }));

    const rarBg = this.add.graphics();
    rarBg.fillStyle(rarityColor, 0.25);
    rarBg.fillRoundedRect(tx + tw - 55, 30, 55, 18, 9);
    container.add(rarBg);
    container.add(this.add.text(tx + tw - 27, 39, getUnitRarityName(unit.rarity).toUpperCase(), {
      fontSize: '8px', fontFamily: fonts.tech, color: hexToString(rarityColor),
    }).setOrigin(0.5));

    const descY = 52;
    const descH = 42;
    const descBg = this.add.graphics();
    descBg.fillStyle(0x000000, 0.25);
    descBg.fillRoundedRect(tx - 3, descY, tw + 6, descH, 6);
    container.add(descBg);

    let descText = unit.description;
    if (descText.length > 80) descText = descText.substring(0, 77) + '...';
    container.add(this.add.text(tx, descY + 4, descText, {
      fontSize: '9px', color: '#cccccc', wordWrap: { width: tw }, lineSpacing: 1,
    }));

    const statsY = 100;
    const statLabels = ['⚡', '🛡️', '💨', '✨'];
    const statNames = ['POW', 'DEF', 'SPD', 'TEC'];
    const statVals = [unit.stats.power, unit.stats.defense, unit.stats.speed, unit.stats.technique];
    const statW = (tw - 12) / 4;

    statLabels.forEach((icon, i) => {
      const sx = tx + i * (statW + 3);
      container.add(this.add.text(sx, statsY, icon, { fontSize: '10px' }));
      container.add(this.add.text(sx + 14, statsY + 1, statNames[i], { fontSize: '7px', color: '#888888' }));
      
      const barBg = this.add.graphics();
      barBg.fillStyle(0x333344, 1);
      barBg.fillRoundedRect(sx, statsY + 14, statW, 6, 3);
      container.add(barBg);
      
      const barFill = this.add.graphics();
      barFill.fillStyle(colors.uiAccent, 1);
      barFill.fillRoundedRect(sx, statsY + 14, (statVals[i] / 5) * statW, 6, 3);
      container.add(barFill);
    });

    if (unit.specialAbility) {
      const abilityY = 130;
      const abBg = this.add.graphics();
      abBg.fillStyle(faction.color, 0.12);
      abBg.fillRoundedRect(tx - 3, abilityY, tw + 6, 22, 6);
      abBg.lineStyle(1, faction.color, 0.25);
      abBg.strokeRoundedRect(tx - 3, abilityY, tw + 6, 22, 6);
      container.add(abBg);
      container.add(this.add.text(tx + 2, abilityY + 11, `✦ ${unit.specialAbility}`, {
        fontSize: '9px', color: hexToString(faction.color), fontStyle: 'bold',
      }).setOrigin(0, 0.5));
    }

    const btnAreaY = h - 45;
    const divider = this.add.graphics();
    divider.fillStyle(0xffffff, 0.05);
    divider.fillRect(15, btnAreaY, w - 30, 1);
    container.add(divider);

    const btnX = w / 2;
    const btnY = h - 22;
    const btnW = 130;
    const btnH = 32;

    if (isOwned) {
      // ✅ Показываем статус "OWNED" вместо кнопки улучшения
      const ownedBadge = this.add.graphics();
      ownedBadge.fillStyle(0x10b981, 0.2);
      ownedBadge.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      ownedBadge.lineStyle(2, 0x10b981, 0.8);
      ownedBadge.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      container.add(ownedBadge);
      
      container.add(this.add.text(btnX, btnY, '✓ OWNED', {
        fontSize: '13px',
        fontFamily: getFonts().tech,
        color: '#10b981',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    } else if (canBuy) {
      // ✅ НОВОЕ (2026-01-20): Юниты из репозитория используют shopPrice вместо price
      const price: number = 'shopPrice' in unit 
        ? (unit.shopPrice || 0) 
        : ('price' in unit && unit.price ? unit.price.coins || 0 : 0);
      const canAfford = playerData.get().coins >= price;
      const priceText = price > 0 ? `${price.toLocaleString()} 💰` : 'FREE';
      container.add(this.createButton(btnX, btnY, btnW, btnH, `🔓 UNLOCK ${priceText}`, () => {
        if (playerData.buyUnit(unit.id, price)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          hapticImpact('light');
          this.updateCurrency();
          this.renderContent();
        }
      }, canAfford ? 0x22aa22 : 0x444444));
    } else if (unit.isStarter) {
      const starterBg = this.add.graphics();
      starterBg.fillStyle(0x22aa22, 0.15);
      starterBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
      starterBg.lineStyle(2, 0x22aa22, 0.4);
      starterBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
      container.add(starterBg);
      container.add(this.add.text(btnX, btnY, '✓ FREE STARTER UNIT', {
        fontSize: '11px', fontFamily: fonts.tech, color: '#44dd44', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    return container;
  }

  // ==================== BALLS TAB ====================

  private renderBalls(): void {
    this.renderSkinGrid(BALL_SKINS, 'ball');
  }

  // ==================== AVATARS TAB ====================

  private renderAvatars(): void {
    import('../data/AvatarData').then(({ AVATARS }) => {
      const { width } = this.cameras.main;
      const fonts = getFonts();
      const colors = getColors();
      const cardW = (width - 45) / 2;
      const cardH = 190;
      let y = this.visibleAreaTop + 15;

      const data = playerData.get();
      const currentAvatarId = data.avatarId;
      const ownedAvatars = playerData.getOwnedAvatars();

      AVATARS.forEach((avatar: any, i: number) => {
      const x = i % 2 === 0 ? 20 + cardW / 2 : 20 + cardW + 5 + cardW / 2;
      if (i % 2 === 0 && i > 0) y += cardH + 8;

      const isOwned = ownedAvatars.includes(avatar.id);
      const isSelected = currentAvatarId === avatar.id;

      const container = this.add.container(x, y);
      this.contentContainer.add(container);

      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? colors.uiAccent : 0x14101e, isSelected ? 0.15 : 0.95);
      bg.fillRoundedRect(-cardW / 2, 0, cardW, cardH, 14);
      bg.lineStyle(2, isSelected ? colors.uiAccent : colors.glassBorder, isSelected ? 0.8 : 0.2);
      bg.strokeRoundedRect(-cardW / 2, 0, cardW, cardH, 14);
      container.add(bg);

      // АВАТАРКА (круг)
      const avatarRadius = 45;
      const avatarBg = this.add.graphics();
      avatarBg.fillStyle(0x1a1a2e, 1);
      avatarBg.fillCircle(0, 55, avatarRadius);
      avatarBg.lineStyle(3, isOwned ? colors.uiAccent : 0x3a3a4a, isOwned ? 0.6 : 0.2);
      avatarBg.strokeCircle(0, 55, avatarRadius);
      container.add(avatarBg);

      // ✅ ИСПРАВЛЕНО: Показываем PNG всегда (убрали проверку isOwned)
      if (this.textures.exists(avatar.textureKey)) {
        const avatarImg = this.add.image(0, 55, avatar.textureKey);
        avatarImg.setDisplaySize(avatarRadius * 1.8, avatarRadius * 1.8);
        // Затемняем незакупленные
        if (!isOwned) {
          avatarImg.setAlpha(0.4);
        }
        container.add(avatarImg);
      } else {
        container.add(this.add.text(0, 55, '🎭', { fontSize: '36px' }).setOrigin(0.5));
      }

      // NAME
      container.add(
        this.add
          .text(0, 115, avatar.name, {
            fontSize: '12px',
            fontFamily: fonts.tech,
            color: isOwned ? '#ffffff' : '#555566',
            align: 'center',
            wordWrap: { width: cardW - 10 },
          })
          .setOrigin(0.5)
      );

      // RARITY
      const rarityBadge = this.add.graphics();
      const rarityColor = avatar.rarity === 'premium' ? 0xa855f7 : 0x10b981;
      rarityBadge.fillStyle(rarityColor, 0.15);
      rarityBadge.fillRoundedRect(-35, 135, 70, 18, 9);
      rarityBadge.lineStyle(1, rarityColor, 0.6);
      rarityBadge.strokeRoundedRect(-35, 135, 70, 18, 9);
      container.add(rarityBadge);
      container.add(
        this.add.text(0, 144, avatar.rarity === 'premium' ? '✦ PREMIUM' : '✓ FREE', {
          fontSize: '9px',
          color: hexToString(rarityColor),
        }).setOrigin(0.5)
      );

      // BUTTON
      const btnY = cardH - 22;
      if (isSelected) {
        container.add(
          this.add
            .text(0, btnY, '✓ ВЫБРАНО', {
              fontSize: '11px',
              fontFamily: fonts.tech,
              color: hexToString(colors.uiAccent),
            })
            .setOrigin(0.5)
        );
      } else if (!isOwned) {
        if (avatar.price) {
          const canAfford = data.crystals >= avatar.price.crystals;
          const btnBg = this.createButton(
            0,
            btnY,
            90,
            26,
            `💎 ${avatar.price.crystals}`,
            () => {
              if (playerData.purchaseAvatar(avatar.id, avatar.price.crystals)) {
                AudioManager.getInstance().playSFX('sfx_cash');
                hapticImpact('medium');
                this.updateCurrency();
                this.renderContent();
              } else {
                hapticImpact('light');
              }
            },
            canAfford ? 0xa855f7 : 0x444444
          );
          container.add(btnBg);
        } else {
          container.add(
            this.add
              .text(0, btnY, 'БЕСПЛАТНО', {
                fontSize: '10px',
                fontFamily: fonts.tech,
                color: '#10b981',
              })
              .setOrigin(0.5)
          );
        }
      } else {
        const selectBtn = this.createButton(
          0,
          btnY,
          90,
          26,
          'ВЫБРАТЬ',
          () => {
            if (playerData.setAvatar(avatar.id)) {
              AudioManager.getInstance().playUIClick();
              hapticSelection();
              this.renderContent();
            }
          },
          colors.uiAccent
        );
        container.add(selectBtn);
      }

      this.cards.push({ container, y, height: cardH });
      });

      this.maxScrollY = Math.max(0, y + cardH - this.visibleAreaBottom + 20);
      this.updateCardPositions();
    });
  }

  private renderSkinGrid(items: (BallSkinData | FieldSkinData)[], type: 'ball' | 'field'): void {
    const { width } = this.cameras.main;
    const cardW = (width - 45) / 2;
    const cardH = type === 'ball' ? 170 : 150;
    let y = this.visibleAreaTop + 15;

    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = 15 + col * (cardW + 15);
      const cy = y + row * (cardH + 12);

      const container = this.createAssetCard(cx, cy, cardW, cardH, item, type);
      this.contentContainer.add(container);
      this.cards.push({ container, y: cy, height: cardH });
    });

    const rows = Math.ceil(items.length / 2);
    this.maxScrollY = Math.max(0, y + rows * (cardH + 12) - this.visibleAreaBottom + 50);
  }

  private createAssetCard(
    x: number, y: number, w: number, h: number,
    item: BallSkinData | FieldSkinData, type: 'ball' | 'field'
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const isOwned = type === 'ball' ? playerData.ownsBallSkin(item.id) : playerData.ownsFieldSkin(item.id);
    const isEquipped = type === 'ball'
      ? playerData.get().equippedBallSkin === item.id
      : playerData.get().equippedFieldSkin === item.id;
    const rarityColor = getSkinRarityColor(item.rarity);

    const bg = this.add.graphics();
    if (isOwned && item.rarity !== 'basic') {
      bg.fillStyle(rarityColor, 0.15);
      bg.fillRoundedRect(-3, -3, w + 6, h + 6, 14);
    }
    bg.fillStyle(0x12121f, 0.95);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(2, isEquipped ? 0x00ff00 : isOwned ? rarityColor : 0x444444, 0.7);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    const previewY = type === 'ball' ? 55 : 45;
    if (type === 'ball') {
      const ball = item as BallSkinData;
      if (ball.textureKey && this.textures.exists(ball.textureKey)) {
        const glow = this.add.image(w / 2, previewY, ball.textureKey)
          .setDisplaySize(65, 65).setTint(ball.glowColor).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
        container.add(glow);
        const img = this.add.image(w / 2, previewY, ball.textureKey).setDisplaySize(50, 50);
        container.add(img);
        if (isEquipped) this.tweens.add({ targets: [img, glow], angle: 360, duration: 6000, repeat: -1 });
      }
    } else {
      const field = item as FieldSkinData;
      this.drawMiniField(container, w / 2, previewY, 80, 50, field);
    }

    const nameY = type === 'ball' ? 100 : 85;
    container.add(this.add.text(w / 2, nameY, item.name, {
      fontSize: '11px', fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    container.add(this.add.text(w / 2, nameY + 16, getRarityName(item.rarity).toUpperCase(), {
      fontSize: '9px', fontFamily: fonts.tech, color: hexToString(rarityColor),
    }).setOrigin(0.5));

    const btnY = h - 22;
    if (isEquipped) {
      container.add(this.add.text(w / 2, btnY, '✓ НАДЕТО', {
        fontSize: '10px', fontFamily: fonts.tech, color: '#00ff00',
      }).setOrigin(0.5));
    } else if (isOwned) {
      container.add(this.createButton(w / 2, btnY, 70, 24, 'НАДЕТЬ', () => {
        AudioManager.getInstance().playUIClick();
        if (type === 'ball') playerData.equipBallSkin(item.id);
        else playerData.equipFieldSkin(item.id);
        this.renderContent();
      }, colors.uiAccent));
    } else {
      const canAfford = !item.price.coins || playerData.get().coins >= item.price.coins;
      container.add(this.createButton(w / 2, btnY, 80, 24, formatPrice(item.price), () => {
        const success = type === 'ball'
          ? playerData.buyBallSkin(item.id, item.price)
          : playerData.buyFieldSkin(item.id, item.price);
        if (success) {
          AudioManager.getInstance().playSFX('sfx_cash');
          this.updateCurrency();
          this.renderContent();
        }
      }, canAfford ? colors.uiGold : 0x444444));
    }

    return container;
  }

  private drawMiniField(c: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, f: FieldSkinData): void {
    const g = this.add.graphics();
    g.fillStyle(f.fieldColor, 1);
    g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 5);
    g.lineStyle(1, f.lineColor, 0.6);
    g.strokeRoundedRect(x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 4);
    g.lineBetween(x, y - h / 2 + 2, x, y + h / 2 - 2);
    g.strokeCircle(x, y, 8);
    c.add(g);
  }

  // ==================== CARDS TAB ====================

  private renderCards(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    let y = this.visibleAreaTop + 15;

    // --- Секция бустеров ---
    y = this.addSection(y, '🎁 БУСТЕРЫ КАРТ', colors.uiAccentPink);

    const boosterCardHeight = 140;
    const currentFaction = playerData.getFaction();
    const ownedFactions = playerData.getOwnedFactions();

    // Tactical booster
    const tacticalContainer = this.createBoosterCard(12, y, width - 24, boosterCardHeight, {
      name: 'Тактический бустер',
      description: `${BOOSTER_CARD_COUNT} случайных карт всех фракций`,
      price: BOOSTER_PRICES.TACTICAL_BOOSTER,
      icon: '🎲',
      color: 0x10b981,
      type: 'tactical',
      featured: ownedFactions.length <= 1,
    });
    this.contentContainer.add(tacticalContainer);
    this.cards.push({ container: tacticalContainer, y, height: boosterCardHeight });
    y += boosterCardHeight + 12;

    // Фракционные бустеры
    const sortedFactions = [...FACTION_IDS].sort((a, b) =>
      a === currentFaction ? -1 : b === currentFaction ? 1 : 0
    );

    sortedFactions.forEach(factionId => {
      const faction = FACTIONS[factionId];
      const progress = this.getFactionCardProgress(factionId);

      const boosterContainer = this.createBoosterCard(12, y, width - 24, boosterCardHeight, {
        name: `${faction.name} Booster`,
        description: `${BOOSTER_CARD_COUNT} карт фракции ${faction.name}`,
        price: BOOSTER_PRICES.FACTION_BOOSTER,
        icon: '🛸',
        color: faction.color,
        type: 'faction',
        factionId,
        featured: factionId === currentFaction,
        collectionOwned: progress.owned,
        collectionTotal: progress.total,
      });
      this.contentContainer.add(boosterContainer);
      this.cards.push({ container: boosterContainer, y, height: boosterCardHeight });
      y += boosterCardHeight + 12;
    });

    // --- Секция мистических сундуков ---
    y = this.addSection(y + 10, '✨ МИСТИЧЕСКИЕ СУНДУКИ', colors.uiAccentPink);
    
    const chests = getAllChests();
    chests.forEach(chest => {
      const chestContainer = this.createChestCard(12, y, width - 24, boosterCardHeight, chest);
      this.contentContainer.add(chestContainer);
      this.cards.push({ container: chestContainer, y, height: boosterCardHeight });
      y += boosterCardHeight + 12;
    });

    // ⚠️ REMOVED: Секция коллекции (Your Collection) перенесена в TeamScene
    // Теперь игроки смотрят свою коллекцию карточек в разделе команды

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 50);
  }

  // ==================== KEYS TAB ====================

  private renderKeys(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    let y = this.visibleAreaTop + 15;

    y = this.addSection(y, '🎟️ TOURNAMENT ACCESS', colors.uiGold);

    const data = playerData.get();
    const currentFragments = data.tournamentState?.keyFragments || 0;
    const hasTicket = data.tournamentState?.hasTicket || false;

    // Info card
    const infoCard = this.add.container(12, y);
    const infoW = width - 24;
    const infoH = 100;

    const infoBg = this.add.graphics();
    infoBg.fillStyle(0x1a1a2e, 0.95);
    infoBg.fillRoundedRect(0, 0, infoW, infoH, 12);
    infoBg.lineStyle(2, colors.uiGold, 0.5);
    infoBg.strokeRoundedRect(0, 0, infoW, infoH, 12);
    infoCard.add(infoBg);

    infoCard.add(this.add.text(infoW / 2, 20, 'WEEKEND TOURNAMENTS', {
      fontSize: '16px', fontFamily: fonts.tech, color: hexToString(colors.uiGold), fontStyle: 'bold',
    }).setOrigin(0.5));

    infoCard.add(this.add.text(infoW / 2, 45, 'Use Keys or Tickets to enter tournaments', {
      fontSize: '11px', fontFamily: fonts.tech, color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    infoCard.add(this.add.text(infoW / 2, 70, `You have: ${currentFragments}/3 Key Fragments${hasTicket ? ' • 1 Ticket' : ''}`, {
      fontSize: '12px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent), fontStyle: 'bold',
    }).setOrigin(0.5));

    this.contentContainer.add(infoCard);
    this.cards.push({ container: infoCard, y, height: infoH });
    y += infoH + 20;

    y = this.addSection(y, '🛒 PURCHASE', colors.uiGold);

    // Tournament Ticket
    const ticketCard = this.createKeyCard(12, y, width - 24, 140, {
      name: 'Tournament Ticket', description: 'Direct access to any tournament\nSingle use',
      iconKey: TOURNAMENT_KEY_KEYS.TICKET, price: { crystals: 50 }, type: 'ticket', color: 0xffd700,
    });
    this.contentContainer.add(ticketCard);
    this.cards.push({ container: ticketCard, y, height: 140 });
    y += 152;

    // Key Fragment Pack
    const fragmentCard = this.createKeyCard(12, y, width - 24, 140, {
      name: 'Key Fragment Pack', description: '3 Key Fragments\nComplete set for tournament entry',
      iconKey: TOURNAMENT_KEY_KEYS.FULL, price: { crystals: 100 }, type: 'fragments', color: 0x00d4ff,
    });
    this.contentContainer.add(fragmentCard);
    this.cards.push({ container: fragmentCard, y, height: 140 });
    y += 152;

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 50);
  }

  private createKeyCard(
    x: number, y: number, w: number, h: number,
    config: { name: string; description: string; iconKey: string; price: { coins?: number; crystals?: number }; type: 'ticket' | 'fragments'; color: number; }
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);
    const data = playerData.get();

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(0, 0, w, h, 15);
    bg.lineStyle(2, config.color, 0.8);
    bg.strokeRoundedRect(0, 0, w, h, 15);
    container.add(bg);

    const iconBg = this.add.graphics();
    iconBg.fillStyle(config.color, 0.2);
    iconBg.fillCircle(60, h / 2, 40);
    container.add(iconBg);

    // Use PNG image instead of emoji
    if (this.textures.exists(config.iconKey)) {
      const icon = this.add.image(60, h / 2, config.iconKey);
      icon.setDisplaySize(60, 60);
      icon.setOrigin(0.5);
      container.add(icon);
    } else {
      // Fallback to emoji if texture not found
      container.add(this.add.text(60, h / 2, '🎟️', { fontSize: '48px' }).setOrigin(0.5));
    }
    container.add(this.add.text(120, h / 2 - 25, config.name, {
      fontSize: '16px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0, 0.5));
    container.add(this.add.text(120, h / 2 + 5, config.description, {
      fontSize: '11px', fontFamily: fonts.tech, color: hexToString(colors.uiTextSecondary), lineSpacing: 3,
    }).setOrigin(0, 0.5));

    const canAfford = config.price.crystals ? data.crystals >= config.price.crystals : true;
    const btnW = 100;
    const btnH = 35;
    const btnX = w - btnW / 2 - 15;
    const btnY = h / 2;

    const buyBtn = this.createButton(btnX, btnY, btnW, btnH,
      config.price.crystals ? `${config.price.crystals} 💎` : `${config.price.coins} 💰`,
      () => {
        if (canAfford) {
          if (config.price.crystals) data.crystals -= config.price.crystals;
          if (!data.tournamentState) {
            data.tournamentState = { keyFragments: 0, hasTicket: false, history: [] };
          }
          if (config.type === 'ticket') data.tournamentState.hasTicket = true;
          else data.tournamentState.keyFragments = Math.min(3, data.tournamentState.keyFragments + 3);
          playerData.save();
          AudioManager.getInstance().playSFX('sfx_cash');
          this.updateCurrency();
          this.renderContent();
        }
      },
      canAfford ? config.color : 0x444444
    );
    container.add(buyBtn);
    return container;
  }

  private getFactionCardProgress(factionId: FactionId): { owned: number; total: number } {
    const all = getCardsByFaction(factionId);
    const inv = playerData.getCardInventory();

    let owned = 0;
    all.forEach(card => {
      if ((inv[card.id] || 0) > 0) owned++;
    });

    return { owned, total: all.length };
  }

  private createBoosterCard(
    x: number, y: number, w: number, h: number,
    config: {
      name: string;
      description: string;
      price: number;
      icon: string;
      color: number;
      type: 'tactical' | 'faction';
      factionId?: FactionId;
      featured?: boolean;
      collectionOwned?: number;
      collectionTotal?: number;
    }
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const padding = 12;
    const artCenterX = padding + 44;
    const artCenterY = h / 2;
    const textX = artCenterX + 52;

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 14);
    container.add(bg);

    const topBar = this.add.graphics();
    topBar.fillStyle(config.color, 0.2);
    topBar.fillRoundedRect(0, 0, w, 46, { tl: 14, tr: 14, bl: 0, br: 0 } as any);
    container.add(topBar);

    const border = this.add.graphics();
    border.lineStyle(2, config.color, 0.9);
    border.strokeRoundedRect(0, 0, w, h, 14);
    container.add(border);

    // Бейдж "BEST FOR YOU"
    if (config.featured) {
      const badgeW = 92;
      const badgeH = 20;
      const bx = w - padding - badgeW;
      const by = 8;

      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(0x0f172a, 0.95);
      badgeBg.fillRoundedRect(bx, by, badgeW, badgeH, badgeH / 2);
      badgeBg.lineStyle(1, config.color, 0.8);
      badgeBg.strokeRoundedRect(bx, by, badgeW, badgeH, badgeH / 2);
      container.add(badgeBg);

      const badgeText = this.add.text(bx + badgeW / 2, by + badgeH / 2, 'ТОП ВЫБОР', {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: hexToString(config.color),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      badgeText.setResolution(2);
      container.add(badgeText);
    }

    // Арт бустера
    const glow = this.add.graphics();
    glow.fillStyle(config.color, 0.35);
    glow.fillCircle(artCenterX, artCenterY, 38);
    container.add(glow);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 0.15 },
      scaleX: { from: 1, to: 1.15 },
      scaleY: { from: 1, to: 1.15 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });

    const boosterKey = this.getBoosterTextureKey(config);
    if (boosterKey) {
      const boosterImg = this.add.image(artCenterX, artCenterY, boosterKey)
        .setDisplaySize(70, 90);
      container.add(boosterImg);
    } else {
      const boosterShape = this.add.graphics();
      boosterShape.fillStyle(config.color, 0.9);
      boosterShape.fillRoundedRect(artCenterX - 26, artCenterY - 38, 52, 76, 10);
      boosterShape.fillStyle(0xffffff, 0.3);
      boosterShape.fillRoundedRect(artCenterX - 20, artCenterY - 26, 40, 26, 6);
      container.add(boosterShape);
    }

    container.add(this.add.text(artCenterX + 26, artCenterY + 30, config.icon, {
      fontSize: '16px',
    }).setOrigin(0.5));

    // Заголовок бустера
    const title = this.add.text(textX, 16, config.name.toUpperCase(), {
      fontSize: '15px',
      fontFamily: fonts.tech,
      color: hexToString(config.color),
      fontStyle: 'bold',
    });
    title.setResolution(2);
    container.add(title);

    // Описание
    const desc = this.add.text(textX, 38, config.description, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: '#d1d5db',
      wordWrap: { width: w - textX - 110 },
    });
    desc.setResolution(2);
    container.add(desc);

    // DROP: 70/25/5
    const dropY = desc.y + desc.height + 6;
    
    const dropLabel = this.add.text(textX, dropY, 'DROP', {
      fontSize: '9px',
      fontFamily: fonts.tech,
      color: '#6b7280',
    }).setOrigin(0, 0.5);
    dropLabel.setResolution(2);
    container.add(dropLabel);

    const colWidth = (w - textX - 16) / 3;
    const dropDefs = [
      { chance: '70%', tag: 'C', color: 0x9ca3af },
      { chance: '25%', tag: 'R', color: 0x3b82f6 },
      { chance: '5%',  tag: 'E', color: 0xa855f7 },
    ];

    dropDefs.forEach((d, i) => {
      const dx = textX + i * colWidth;
      const dropText = this.add.text(dx, dropY + 14, `${d.chance} ${d.tag}`, {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: hexToString(d.color),
      }).setOrigin(0, 0.5);
      dropText.setResolution(2);
      container.add(dropText);
    });

    // Прогресс коллекции
    if (config.type === 'faction' && config.collectionTotal && config.collectionTotal > 0) {
      const owned = config.collectionOwned || 0;
      const total = config.collectionTotal;
      const ratio = Phaser.Math.Clamp(owned / total, 0, 1);

      const progressY = h - 20;
      const barX = textX;
      const barW = w - textX - 120;

      const barBg = this.add.graphics();
      barBg.fillStyle(0x111827, 1);
      barBg.fillRoundedRect(barX, progressY - 4, barW, 8, 4);
      container.add(barBg);

      const fillColor = ratio >= 1 ? colors.uiGold : config.color;
      const barFill = this.add.graphics();
      barFill.fillStyle(fillColor, 1);
      barFill.fillRoundedRect(barX, progressY - 4, barW * ratio, 8, 4);
      container.add(barFill);

      const progressText = this.add.text(barX + barW + 6, progressY, `${owned}/${total}`, {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: ratio >= 1 ? hexToString(colors.uiGold) : '#9ca3af',
      }).setOrigin(0, 0.5);
      progressText.setResolution(2);
      container.add(progressText);
    }

    // Кнопка покупки
    const canAfford = playerData.get().coins >= config.price;
    const btnX = w - padding - 55;
    const btnY = h / 2;

    container.add(this.createButton(
      btnX,
      btnY,
      110,
      40,
      `💰 ${config.price}`,
      () => {
        if (canAfford) {
          this.purchaseBooster(config.type, config.factionId);
        }
      },
      canAfford ? config.color : 0x444444,
    ));

    return container;
  }

  private purchaseBooster(type: 'tactical' | 'faction', factionId?: FactionId): void {
    const price = type === 'faction' ? BOOSTER_PRICES.FACTION_BOOSTER : BOOSTER_PRICES.TACTICAL_BOOSTER;
    
    if (!playerData.spendCoins(price)) {
      return;
    }

    AudioManager.getInstance().playSFX('sfx_cash');
    hapticImpact('medium');

    const cards = openCardPack(BOOSTER_CARD_COUNT, factionId);

    cards.forEach(card => {
      playerData.addCards(card.id, 1);
    });

    console.log('🎁 Booster opened:', cards.map(c => `${c.name} (${c.rarity})`));

    this.showBoosterOpenAnimation(cards, factionId);

    this.updateCurrency();
  }

  // ==================== CHEST CARDS ====================

  private createChestCard(
    x: number, y: number, w: number, h: number,
    chest: ChestData
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const padding = 12;
    const artCenterX = padding + 44;
    const artCenterY = h / 2;
    const textX = artCenterX + 52;

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 14);
    container.add(bg);

    // Цвет редкости сундука (обновлено для новых ID)
    const chestColor = 
      chest.id === 'chest_cosmic' ? 0xa855f7 :
      chest.id === 'chest_nova' ? 0x3b82f6 :
      chest.id === 'chest_nebula' ? 0x10b981 : 0xffd700;
    
    const topBar = this.add.graphics();
    topBar.fillStyle(chestColor, 0.2);
    topBar.fillRoundedRect(0, 0, w, 46, { tl: 14, tr: 14, bl: 0, br: 0 } as any);
    container.add(topBar);

    const border = this.add.graphics();
    border.lineStyle(2, chestColor, 0.9);
    border.strokeRoundedRect(0, 0, w, h, 14);
    container.add(border);

    // Арт сундука
    const glow = this.add.graphics();
    glow.fillStyle(chestColor, 0.35);
    glow.fillCircle(artCenterX, artCenterY, 38);
    container.add(glow);

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.35, to: 0.15 },
      scaleX: { from: 1, to: 1.15 },
      scaleY: { from: 1, to: 1.15 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });

    // Проверяем несколько вариантов ключей для обратной совместимости
    const possibleKeys = [
      chest.assetKey512,
      `${chest.id}_512`,
      // Старые ключи
      chest.id === 'chest_stellar' ? 'chest_small_512' : null,
      chest.id === 'chest_nebula' ? 'chest_medium_512' : null,
      chest.id === 'chest_nova' ? 'chest_large_512' : null,
      chest.id === 'chest_cosmic' ? 'chest_mystic_512' : null,
    ].filter(Boolean) as string[];

    const chestKey = possibleKeys.find(key => this.textures.exists(key));

    if (chestKey) {
      const chestImg = this.add.image(artCenterX, artCenterY, chestKey)
        .setDisplaySize(70, 70);
      container.add(chestImg);
    } else {
      const chestShape = this.add.graphics();
      chestShape.fillStyle(chestColor, 0.9);
      chestShape.fillRoundedRect(artCenterX - 26, artCenterY - 26, 52, 52, 10);
      container.add(chestShape);
    }

    // Заголовок
    const title = this.add.text(textX, 16, chest.nameRu.toUpperCase(), {
      fontSize: '15px',
      fontFamily: fonts.tech,
      color: hexToString(chestColor),
      fontStyle: 'bold',
    });
    title.setResolution(2);
    container.add(title);

    // Описание (сокращённое)
    const shortDesc = chest.descriptionRu.length > 50 
      ? chest.descriptionRu.substring(0, 50) + '...'
      : chest.descriptionRu;
    const desc = this.add.text(textX, 38, shortDesc, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: '#d1d5db',
      wordWrap: { width: w - textX - 110 },
    });
    desc.setResolution(2);
    container.add(desc);

    // Подсказка "Нажмите для подробностей"
    const previewHint = this.add.text(textX, desc.y + desc.height + 4, '👁 Подробнее', {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: hexToString(chestColor),
    }).setOrigin(0, 0);
    previewHint.setResolution(2);
    container.add(previewHint);

    // Цена
    const priceText = chest.price.coins 
      ? `💰 ${chest.price.coins}`
      : `💎 ${chest.price.crystals}`;
    
    const priceY = previewHint.y + previewHint.height + 4;
    container.add(this.add.text(textX, priceY, priceText, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: chest.price.crystals ? '#ff00ff' : '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0, 0));

    // Кнопка покупки (меньше, справа)
    const canAfford = chest.price.coins 
      ? playerData.get().coins >= chest.price.coins
      : chest.price.crystals 
        ? playerData.get().crystals >= chest.price.crystals
        : false;
    
    const btnX = w - padding - 55;
    const btnY = h / 2;

    const buyButton = this.createButton(
      btnX,
      btnY,
      50,
      36,
      '🛒',
      () => {
        if (canAfford && !this.isOverlayOpen) {
          this.purchaseChest(chest.id);
        }
      },
      canAfford ? chestColor : 0x444444,
    );
    container.add(buyButton);

    // ===== ИНТЕРАКТИВНАЯ ЗОНА ДЛЯ ОТКРЫТИЯ ПРЕВЬЮ =====
    // Покрывает всю карточку кроме кнопки покупки
    const previewHitArea = this.add.rectangle(
      (w - 60) / 2, // Центр области без кнопки
      h / 2,
      w - 70,       // Ширина без кнопки
      h,
      0x000000, 0
    );
    previewHitArea.setInteractive({ useHandCursor: true });
    container.add(previewHitArea);

    // Открытие превью при клике на карточку
    previewHitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
    });

    previewHitArea.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      // Проверяем что это не drag
      if (this.dragDistance < 10 && !this.isOverlayOpen) {
        this.openChestPreview(chest.id);
      }
    });

    // Hover эффект
    previewHitArea.on('pointerover', () => {
      border.clear();
      border.lineStyle(3, chestColor, 1);
      border.strokeRoundedRect(0, 0, w, h, 14);
    });

    previewHitArea.on('pointerout', () => {
      border.clear();
      border.lineStyle(2, chestColor, 0.9);
      border.strokeRoundedRect(0, 0, w, h, 14);
    });

    return container;
  }

  /**
   * Открыть модальное окно превью сундука
   */
  private openChestPreview(chestId: string): void {
    if (this.isOverlayOpen) return;
    
    this.isOverlayOpen = true;
    
    // Звук открытия
    try {
      AudioManager.getInstance().playSFX('sfx_click');
    } catch (e) {}

    this.chestPreviewModal = new ChestPreviewModal(
      this,
      chestId,
      // onClose
      () => {
        this.isOverlayOpen = false;
        this.chestPreviewModal = undefined;
      },
      // onPurchase
      () => {
        this.isOverlayOpen = false;
        this.chestPreviewModal = undefined;
        // Небольшая задержка перед покупкой для плавности
        this.time.delayedCall(100, () => {
          this.purchaseChest(chestId);
        });
      }
    );
  }

  private purchaseChest(chestId: string): void {
    const chest = getChestByIdCompat(chestId);
    if (!chest) {
      console.warn(`[ShopScene] Chest not found: ${chestId}`);
      return;
    }

    // Проверка и трата валюты
    if (chest.price.coins) {
      if (!playerData.spendCoins(chest.price.coins)) {
        return;
      }
    } else if (chest.price.crystals) {
      if (!playerData.spendCrystals(chest.price.crystals)) {
        return;
      }
    }

    AudioManager.getInstance().playSFX('sfx_cash');
    hapticImpact('medium');

    // Открываем сундук
    const rewards = openChest(chestId);
    const summary = summarizeRewards(rewards);
    
    // Применяем награды
    applyRewardsToPlayer(rewards);

    console.log('🎁 Chest opened:', summary);

    // Показываем анимацию открытия
    this.showChestOpenAnimation(rewards, summary, chestId);

    this.updateCurrency();
  }

  // ==================== CINEMATIC BOOSTER OPENING ====================

  /**
   * Главная точка входа — запуск кинематографической анимации открытия пака
   */
  private showBoosterOpenAnimation(cards: CardDefinition[], factionId?: FactionId): void {
    const { width, height } = this.cameras.main;
    this.isOverlayOpen = true;
    this.boosterAnimationPhase = 0;
    this.boosterAnimationTweens = [];
    this.boosterAnimationTimers = [];
    this.boosterPendingCards = cards;
    this.boosterPendingFactionId = factionId;

    // Создаём оверлей
    const overlay = this.add.container(0, 0).setDepth(200);
    this.boosterOverlay = overlay;

    // Затемнение фона (Phase 0)
    const darkBg = this.add.graphics();
    darkBg.fillStyle(0x000000, 0);
    darkBg.fillRect(0, 0, width, height);
    overlay.add(darkBg);

    // Анимация затемнения
    const dimTween = this.tweens.add({
      targets: { alpha: 0 },
      alpha: 0.85,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        darkBg.clear();
        darkBg.fillStyle(0x000000, tween.getValue());
        darkBg.fillRect(0, 0, width, height);
      },
    });
    this.boosterAnimationTweens.push(dimTween);

    // Интерактивная зона для tap-skip
    const hitArea = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive()
      .setDepth(250);
    overlay.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.handleBoosterTapSkip();
    });

    // Запускаем Phase 0: Вход пакета
    this.startBoosterPhase0(overlay, factionId);
  }

  /**
   * Phase 0: Вход пакета (0.0 - 0.5s)
   */
  private startBoosterPhase0(overlay: Phaser.GameObjects.Container, factionId?: FactionId): void {
    const { width, height } = this.cameras.main;
    this.boosterAnimationPhase = 0;

    const boosterKey = this.getBoosterTextureKey({ type: factionId ? 'faction' : 'tactical', factionId });
    const factionColor = factionId ? FACTIONS[factionId].color : 0x10b981;

    // Звук входа
    AudioManager.getInstance().playSFX('sfx_whoosh', { volume: 0.7 });

    // Создаём пакет
    let packContainer: Phaser.GameObjects.Container;
    const packCenterY = height / 2 - 40;

    if (boosterKey && this.textures.exists(boosterKey)) {
      const packImage = this.add.image(0, 0, boosterKey).setDisplaySize(180, 230);
      packContainer = this.add.container(width / 2, -150, [packImage]);
    } else {
      // Fallback: процедурный пакет
      const packShape = this.add.graphics();
      packShape.fillStyle(factionColor, 0.9);
      packShape.fillRoundedRect(-65, -95, 130, 190, 15);
      packShape.fillStyle(0xffffff, 0.3);
      packShape.fillRoundedRect(-50, -70, 100, 60, 10);
      
      const packIcon = this.add.text(0, 20, factionId ? '🛸' : '🎲', { fontSize: '48px' }).setOrigin(0.5);
      packContainer = this.add.container(width / 2, -150, [packShape, packIcon]);
    }

    packContainer.setDepth(210);
    overlay.add(packContainer);

    // Свечение вокруг пакета
    const glow = this.add.graphics();
    glow.setPosition(width / 2, packCenterY);
    glow.setAlpha(0);
    glow.setDepth(209);
    overlay.add(glow);

    // Анимация входа с overshoot
    const entryTween = this.tweens.add({
      targets: packContainer,
      y: packCenterY,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.startBoosterPhase1(overlay, packContainer, glow, factionId, factionColor);
      },
    });
    this.boosterAnimationTweens.push(entryTween);

    // Fade in свечения
    const glowTween = this.tweens.add({
      targets: glow,
      alpha: 1,
      duration: 400,
      delay: 200,
      onUpdate: () => {
        glow.clear();
        glow.fillStyle(factionColor, 0.25 * glow.alpha);
        glow.fillCircle(0, 0, 120);
      },
    });
    this.boosterAnimationTweens.push(glowTween);
  }

  /**
   * Phase 1: Зарядка (0.5 - 1.5s)
   */
  private startBoosterPhase1(
    overlay: Phaser.GameObjects.Container,
    packContainer: Phaser.GameObjects.Container,
    glow: Phaser.GameObjects.Graphics,
    factionId?: FactionId,
    factionColor: number = 0x10b981
  ): void {
    this.boosterAnimationPhase = 1;

    // Начинаем играть pack_reveal (тихо, как build-up)
    AudioManager.getInstance().playPackReveal(0.4);

    // Пульсация пакета
    const pulseTween = this.tweens.add({
      targets: packContainer,
      scaleX: { from: 1, to: 1.05 },
      scaleY: { from: 1, to: 1.05 },
      angle: { from: -2, to: 2 },
      duration: 200,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });
    this.boosterAnimationTweens.push(pulseTween);

    // Усиление свечения
    const glowIntensifyTween = this.tweens.add({
      targets: glow,
      alpha: 1,
      duration: 800,
      onUpdate: () => {
        const alpha = glow.alpha;
        glow.clear();
        glow.fillStyle(factionColor, 0.15 + alpha * 0.25);
        glow.fillCircle(0, 0, 100 + alpha * 40);
      },
    });
    this.boosterAnimationTweens.push(glowIntensifyTween);

    // Частицы энергии вокруг пакета
    const { width } = this.cameras.main;
    const packY = packContainer.y;
    
    const particleTimer = this.time.addEvent({
      delay: 80,
      repeat: 12,
      callback: () => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 80 + Math.random() * 40;
        const particle = this.add.circle(
          width / 2 + Math.cos(angle) * radius,
          packY + Math.sin(angle) * radius,
          4 + Math.random() * 4,
          factionColor,
          0.8
        );
        particle.setBlendMode(Phaser.BlendModes.ADD);
        particle.setDepth(211);
        overlay.add(particle);

        this.tweens.add({
          targets: particle,
          x: width / 2,
          y: packY,
          alpha: 0,
          scale: 0.2,
          duration: 300 + Math.random() * 200,
          onComplete: () => particle.destroy(),
        });
      },
    });
    this.boosterAnimationTimers.push(particleTimer);

    // Таймер перехода к Phase 2
    const phase2Timer = this.time.delayedCall(1000, () => {
      this.startBoosterPhase2(overlay, packContainer, glow, factionId, factionColor);
    });
    this.boosterAnimationTimers.push(phase2Timer);
  }

  /**
   * Phase 2: Разрыв фольги (1.5 - 2.2s)
   */
  private startBoosterPhase2(
    overlay: Phaser.GameObjects.Container,
    packContainer: Phaser.GameObjects.Container,
    glow: Phaser.GameObjects.Graphics,
    factionId?: FactionId,
    factionColor: number = 0x10b981
  ): void {
    this.boosterAnimationPhase = 2;
    const { width, height } = this.cameras.main;

    // Резкий рывок пакета
    const ripTween = this.tweens.add({
      targets: packContainer,
      scaleX: 1.15,
      scaleY: 0.9,
      angle: 5,
      duration: 100,
      ease: 'Power2',
      onComplete: () => {
        // Звук разрыва фольги
        AudioManager.getInstance().playPackOpen(0.9);
        
        // Хаптик
        hapticImpact('medium');

        // Яркая вспышка
        const flash = this.add.circle(width / 2, packContainer.y, 150, 0xffffff, 1);
        flash.setBlendMode(Phaser.BlendModes.ADD);
        flash.setDepth(220);
        overlay.add(flash);

        this.tweens.add({
          targets: flash,
          alpha: 0,
          scale: 2.5,
          duration: 300,
          ease: 'Cubic.easeOut',
          onComplete: () => flash.destroy(),
        });

        // Разлёт частиц пакета
        for (let i = 0; i < 15; i++) {
          const angle = (i / 15) * Math.PI * 2;
          const piece = this.add.rectangle(
            width / 2,
            packContainer.y,
            20 + Math.random() * 20,
            10 + Math.random() * 15,
            factionColor,
            0.9
          );
          piece.setDepth(215);
          piece.setRotation(Math.random() * Math.PI);
          overlay.add(piece);

          this.tweens.add({
            targets: piece,
            x: width / 2 + Math.cos(angle) * (150 + Math.random() * 100),
            y: packContainer.y + Math.sin(angle) * (100 + Math.random() * 80) + 50,
            rotation: piece.rotation + Math.PI * 2,
            alpha: 0,
            scale: 0.3,
            duration: 500 + Math.random() * 300,
            ease: 'Cubic.easeOut',
            onComplete: () => piece.destroy(),
          });
        }

        // Исчезновение пакета
        this.tweens.add({
          targets: packContainer,
          alpha: 0,
          scale: 0.5,
          duration: 150,
          onComplete: () => packContainer.destroy(),
        });

        // Исчезновение свечения
        this.tweens.add({
          targets: glow,
          alpha: 0,
          duration: 200,
          onComplete: () => glow.destroy(),
        });

        // Переходим к Phase 3
        const phase3Timer = this.time.delayedCall(250, () => {
          this.startBoosterPhase3(overlay, factionColor);
        });
        this.boosterAnimationTimers.push(phase3Timer);
      },
    });
    this.boosterAnimationTweens.push(ripTween);
  }

  /**
   * Phase 3: Рулетка / подсветка (2.2 - 3.5s)
   */
  private startBoosterPhase3(
    overlay: Phaser.GameObjects.Container,
    factionColor: number
  ): void {
    this.boosterAnimationPhase = 3;
    const { width, height } = this.cameras.main;
    const cards = this.boosterPendingCards;

    const cardWidth = 90;
    const cardHeight = 130;
    const spacing = 15;
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * spacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height / 2;

    // Определяем максимальную редкость
    const hasEpic = cards.some(c => c.rarity === 'epic');
    const hasRare = cards.some(c => c.rarity === 'rare');

    // Создаём рубашки карт
    const cardBacks: Phaser.GameObjects.Container[] = [];

    cards.forEach((card, index) => {
      const cardX = startX + index * (cardWidth + spacing);
      
      // Контейнер рубашки
      const backContainer = this.add.container(cardX, cardY - 100);
      backContainer.setAlpha(0);
      backContainer.setScale(0.5);
      backContainer.setDepth(215);
      overlay.add(backContainer);

      // Фон рубашки
      const backBg = this.add.graphics();
      backBg.fillStyle(0x1a1a2e, 1);
      backBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
      backBg.lineStyle(3, factionColor, 0.8);
      backBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10);
      backContainer.add(backBg);

      // Паттерн на рубашке
      const pattern = this.add.graphics();
      pattern.lineStyle(1, factionColor, 0.3);
      for (let i = -3; i <= 3; i++) {
        pattern.lineBetween(-cardWidth / 2 + 10, i * 15, cardWidth / 2 - 10, i * 15);
      }
      backContainer.add(pattern);

      // Символ на рубашке
      const symbol = this.add.text(0, 0, '✦', {
        fontSize: '32px',
        color: '#' + factionColor.toString(16).padStart(6, '0'),
      }).setOrigin(0.5);
      backContainer.add(symbol);

      cardBacks.push(backContainer);

      // Анимация появления рубашки
      const appearTween = this.tweens.add({
        targets: backContainer,
        y: cardY,
        alpha: 1,
        scale: 1,
        duration: 350,
        delay: index * 120,
        ease: 'Back.easeOut',
      });
      this.boosterAnimationTweens.push(appearTween);
    });

    // Мигание рубашек (имитация рулетки)
    const flickerTimer = this.time.addEvent({
      delay: 100,
      repeat: 12,
      callback: () => {
        const randomIndex = Math.floor(Math.random() * cardBacks.length);
        const card = cardBacks[randomIndex];
        
        // Кратковременная подсветка
        const highlight = this.add.graphics();
        highlight.setPosition(card.x, card.y);
        highlight.fillStyle(factionColor, 0.4);
        highlight.fillRoundedRect(-cardWidth / 2 - 5, -cardHeight / 2 - 5, cardWidth + 10, cardHeight + 10, 12);
        highlight.setBlendMode(Phaser.BlendModes.ADD);
        highlight.setDepth(214);
        overlay.add(highlight);

        this.tweens.add({
          targets: highlight,
          alpha: 0,
          duration: 150,
          onComplete: () => highlight.destroy(),
        });
      },
    });
    this.boosterAnimationTimers.push(flickerTimer);

    // Если есть редкие карты — дольше ждём
    const phase4Delay = hasEpic ? 1500 : hasRare ? 1300 : 1000;

    const phase4Timer = this.time.delayedCall(phase4Delay, () => {
      this.startBoosterPhase4(overlay, cardBacks, cardWidth, cardHeight);
    });
    this.boosterAnimationTimers.push(phase4Timer);
  }

  /**
   * Phase 4: Открытие карт (3.5 - 5.0s)
   */
  private startBoosterPhase4(
    overlay: Phaser.GameObjects.Container,
    cardBacks: Phaser.GameObjects.Container[],
    cardWidth: number,
    cardHeight: number
  ): void {
    this.boosterAnimationPhase = 4;
    const cards = this.boosterPendingCards;

    // Сортируем: epic в конце для драматизма
    const sortedIndices = cards
      .map((card, index) => ({ card, index }))
      .sort((a, b) => {
              const rarityOrder = { common: 0, rare: 1, epic: 2 };
        return rarityOrder[a.card.rarity] - rarityOrder[b.card.rarity];
      })
      .map(item => item.index);

    // Открываем карты последовательно
    sortedIndices.forEach((originalIndex, revealOrder) => {
      const card = cards[originalIndex];
      const backContainer = cardBacks[originalIndex];
      const delay = revealOrder * 450;

      const revealTimer = this.time.delayedCall(delay, () => {
        this.revealSingleCard(overlay, backContainer, card, cardWidth, cardHeight, revealOrder === sortedIndices.length - 1);
      });
      this.boosterAnimationTimers.push(revealTimer);
    });

    // Переход к Phase 5 после всех карт
    const phase5Timer = this.time.delayedCall(sortedIndices.length * 450 + 500, () => {
      this.startBoosterPhase5(overlay);
    });
    this.boosterAnimationTimers.push(phase5Timer);
  }

  /**
   * Переворот одной карты
   */
  private revealSingleCard(
    overlay: Phaser.GameObjects.Container,
    backContainer: Phaser.GameObjects.Container,
    card: CardDefinition,
    cardWidth: number,
    cardHeight: number,
    isLast: boolean
  ): void {
    const x = backContainer.x;
    const y = backContainer.y;

    // Звук карты
    AudioManager.getInstance().playCardPop();

    // Хаптик и дополнительные звуки по редкости
    if (card.rarity === 'epic') {
      hapticImpact('medium');
      AudioManager.getInstance().playEpicCardAccent(0.6);
    } else if (card.rarity === 'rare') {
      hapticImpact('light');
      AudioManager.getInstance().playRareCardAccent(0.5);
    } else {
      hapticImpact('light');
    }

    // Анимация флипа рубашки
    this.tweens.add({
      targets: backContainer,
      scaleX: 0,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        backContainer.setVisible(false);

        // Создаём открытую карту
        const revealedCard = this.createRevealedCard(x, y, cardWidth, cardHeight, card);
        revealedCard.scaleX = 0;
        revealedCard.setDepth(216);
        overlay.add(revealedCard);

        // Анимация появления карты
        this.tweens.add({
          targets: revealedCard,
          scaleX: 1,
          duration: 150,
          ease: 'Cubic.easeOut',
          onComplete: () => {
            // Эффект для epic/rare
            if (card.rarity === 'epic') {
              this.playCardRarityBurst(x, y, 0xa855f7, overlay);
              
              // Дополнительное увеличение для epic
              this.tweens.add({
                targets: revealedCard,
                scale: 1.1,
                duration: 150,
                yoyo: true,
                ease: 'Back.easeOut',
              });
            } else if (card.rarity === 'rare') {
              this.playCardRarityBurst(x, y, 0x3b82f6, overlay);
            }
          },
        });
      },
    });
  }

  /**
   * Burst эффект для редких карт
   */
  private playCardRarityBurst(x: number, y: number, color: number, overlay: Phaser.GameObjects.Container): void {
    // Кольцо
    const ring = this.add.graphics();
    ring.setPosition(x, y);
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(0, 0, 20);
    ring.setBlendMode(Phaser.BlendModes.ADD);
    ring.setDepth(217);
    overlay.add(ring);

    this.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 400,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });

    // Частицы
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.circle(x, y, 5, color, 1);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      particle.setDepth(217);
      overlay.add(particle);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 80,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * Phase 5: Финальное состояние
   */
  private startBoosterPhase5(overlay: Phaser.GameObjects.Container): void {
    this.boosterAnimationPhase = 5;
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const factionId = this.boosterPendingFactionId;

    // Останавливаем длинный reveal звук (если ещё играет)
    AudioManager.getInstance().stopPackReveal();

    // Заголовок
    const title = factionId
      ? `✨ ${FACTIONS[factionId].name.toUpperCase()} BOOSTER ✨`
      : '✨ TACTICAL BOOSTER ✨';

    const titleText = this.add.text(width / 2, 70 + this.topInset, title, {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    titleText.setResolution(2);
    titleText.setDepth(230);
    overlay.add(titleText);

    const subtitleText = this.add.text(width / 2, 100 + this.topInset, 'You received:', {
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setAlpha(0);
    subtitleText.setResolution(2);
    subtitleText.setDepth(230);
    overlay.add(subtitleText);

    this.tweens.add({
      targets: [titleText, subtitleText],
      alpha: 1,
      duration: 300,
    });

    // Кнопка COLLECT
    const collectBtn = this.createButton(
      width / 2,
      height - 70 - this.bottomInset,
      140,
      44,
      '✓ COLLECT',
      () => this.closeBoosterOverlay(),
      0x22c55e
    );
    collectBtn.setAlpha(0);
    collectBtn.setDepth(230);
    overlay.add(collectBtn);

    this.tweens.add({
      targets: collectBtn,
      alpha: 1,
      duration: 300,
      delay: 200,
    });
  }

  /**
   * Обработка tap-skip
   */
  private handleBoosterTapSkip(): void {
    // Если уже в финальном состоянии — закрываем
    if (this.boosterAnimationPhase >= 5) {
      this.closeBoosterOverlay();
      return;
    }

    // Если анимация ещё идёт — скипаем к финалу
    if (this.boosterAnimationPhase >= 0 && this.boosterAnimationPhase < 5) {
      this.skipToBoosterFinal();
    }
  }

  /**
   * Мгновенный переход к финальному состоянию (skip)
   */
  private skipToBoosterFinal(): void {
    // Останавливаем все текущие твины
    this.boosterAnimationTweens.forEach(tween => {
      if (tween && tween.isPlaying()) {
        tween.stop();
      }
    });
    this.boosterAnimationTweens = [];

    // Останавливаем все таймеры
    this.boosterAnimationTimers.forEach(timer => {
      if (timer) {
        timer.destroy();
      }
    });
    this.boosterAnimationTimers = [];

    // Останавливаем все звуки бустера
    AudioManager.getInstance().stopBoosterSFX();

    // Хаптик
    hapticImpact('light');

    // Уничтожаем текущий оверлей
    if (this.boosterOverlay) {
      this.boosterOverlay.destroy();
    }

    // Создаём новый оверлей с финальным состоянием
    this.showBoosterFinalState();
  }

  /**
   * Показать финальное состояние (после skip)
   */
  private showBoosterFinalState(): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const cards = this.boosterPendingCards;
    const factionId = this.boosterPendingFactionId;

    // Новый оверлей
    const overlay = this.add.container(0, 0).setDepth(200);
    this.boosterOverlay = overlay;

    // Затемнение
    const darkBg = this.add.graphics();
    darkBg.fillStyle(0x000000, 0.85);
    darkBg.fillRect(0, 0, width, height);
    overlay.add(darkBg);

    // Заголовок
    const title = factionId
      ? `✨ ${FACTIONS[factionId].name.toUpperCase()} BOOSTER ✨`
      : '✨ TACTICAL BOOSTER ✨';

    const titleText = this.add.text(width / 2, 70 + this.topInset, title, {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    titleText.setResolution(2);
    overlay.add(titleText);

    const subtitleText = this.add.text(width / 2, 100 + this.topInset, 'You received:', {
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    subtitleText.setResolution(2);
    overlay.add(subtitleText);

    // Показываем все карты сразу
    const cardWidth = 100;
    const cardHeight = 140;
    const spacing = 15;
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * spacing;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height / 2;

    cards.forEach((card, index) => {
      const cardX = startX + index * (cardWidth + spacing);
      const cardContainer = this.createRevealedCard(cardX, cardY, cardWidth, cardHeight, card);
      overlay.add(cardContainer);
    });

    // Кнопка COLLECT
    const collectBtn = this.createButton(
      width / 2,
      height - 70 - this.bottomInset,
      140,
      44,
      '✓ COLLECT',
      () => this.closeBoosterOverlay(),
      0x22c55e
    );
    overlay.add(collectBtn);

    // Интерактивная зона для закрытия тапом
    const hitArea = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive()
      .setDepth(250);
    overlay.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.closeBoosterOverlay();
    });

    this.boosterAnimationPhase = 5;
  }

  /**
   * Закрытие оверлея бустера
   */
  private closeBoosterOverlay(): void {
    if (this.boosterOverlay) {
      AudioManager.getInstance().playUIClick();
      AudioManager.getInstance().stopBoosterSFX();

      this.tweens.add({
        targets: this.boosterOverlay,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.boosterOverlay?.destroy();
          this.boosterOverlay = null;
          this.isOverlayOpen = false;
          this.boosterAnimationPhase = -1;
          this.boosterPendingCards = [];
          this.boosterPendingFactionId = undefined;
          this.boosterAnimationTweens = [];
          this.boosterAnimationTimers = [];
          this.renderContent();
        },
      });
    }
  }

  // ==================== END CINEMATIC BOOSTER ====================

  // ==================== CINEMATIC CHEST OPENING ====================

  /**
   * Показать анимацию открытия сундука
   */
  private showChestOpenAnimation(rewards: RewardItem[], summary: RewardSummary, chestId: string): void {
    const { width, height } = this.cameras.main;
    this.isOverlayOpen = true;
    this.chestAnimationPhase = 0;
    this.chestAnimationTweens = [];
    this.chestAnimationTimers = [];
    this.chestPendingRewards = rewards;
    this.chestPendingSummary = summary;
    this.chestPendingId = chestId;

    // Создаём оверлей
    const overlay = this.add.container(0, 0).setDepth(200);
    this.chestOverlay = overlay;

    // Затемнение фона
    const darkBg = this.add.graphics();
    darkBg.fillStyle(0x000000, 0);
    darkBg.fillRect(0, 0, width, height);
    overlay.add(darkBg);

    const dimTween = this.tweens.add({
      targets: { alpha: 0 },
      alpha: 0.85,
      duration: 400,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        darkBg.clear();
        darkBg.fillStyle(0x000000, tween.getValue());
        darkBg.fillRect(0, 0, width, height);
      },
    });
    this.chestAnimationTweens.push(dimTween);

    // Интерактивная зона для tap-skip
    const hitArea = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive()
      .setDepth(250);
    overlay.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.handleChestTapSkip();
    });

    // Запускаем Phase 0: Вход сундука
    this.startChestPhase0(overlay);
  }

  /**
   * Phase 0: Вход сундука
   */
  private startChestPhase0(overlay: Phaser.GameObjects.Container): void {
    const { width, height } = this.cameras.main;
    this.chestAnimationPhase = 0;

    AudioManager.getInstance().playSFX('sfx_whoosh', { volume: 0.7 });

    // Определяем какой сундук открываем
    const chestId = this.chestPendingId || 'chest_stellar';
    const chest = getChestByIdCompat(chestId);
    const chestColor = chest?.id === 'chest_cosmic' ? 0xa855f7 : 
                       chest?.id === 'chest_nova' ? 0x3b82f6 : 
                       chest?.id === 'chest_nebula' ? 0x10b981 : 0xffd700;

    // Создаём сундук
    let chestContainer: Phaser.GameObjects.Container;
    const chestCenterY = height / 2 - 40;
    // Используем правильный ключ текстуры (старые сундуки используют те же PNG)
    const chestKey = chestId.includes('stellar') ? 'chest_small_512' :
                     chestId.includes('nebula') ? 'chest_medium_512' :
                     chestId.includes('nova') ? 'chest_large_512' :
                     chestId.includes('cosmic') ? 'chest_mystic_512' :
                     `${chestId}_512`;

    if (this.textures.exists(chestKey)) {
      const chestImg = this.add.image(0, 0, chestKey).setDisplaySize(180, 180);
      chestContainer = this.add.container(width / 2, -150, [chestImg]);
    } else {
      const chestShape = this.add.graphics();
      chestShape.fillStyle(chestColor, 0.9);
      chestShape.fillRoundedRect(-65, -65, 130, 130, 15);
      chestContainer = this.add.container(width / 2, -150, [chestShape]);
    }

    chestContainer.setDepth(210);
    overlay.add(chestContainer);

    // Свечение
    const glow = this.add.graphics();
    glow.setPosition(width / 2, chestCenterY);
    glow.setAlpha(0);
    glow.setDepth(209);
    overlay.add(glow);

    // Анимация входа
    const entryTween = this.tweens.add({
      targets: chestContainer,
      y: chestCenterY,
      duration: 450,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.startChestPhase1(overlay, chestContainer, glow, chestColor);
      },
    });
    this.chestAnimationTweens.push(entryTween);

    const glowTween = this.tweens.add({
      targets: glow,
      alpha: 1,
      duration: 400,
      delay: 200,
      onUpdate: () => {
        glow.clear();
        glow.fillStyle(chestColor, 0.25 * glow.alpha);
        glow.fillCircle(0, 0, 120);
      },
    });
    this.chestAnimationTweens.push(glowTween);
  }

  /**
   * Phase 1: Зарядка и тряска
   */
  private startChestPhase1(
    overlay: Phaser.GameObjects.Container,
    chestContainer: Phaser.GameObjects.Container,
    glow: Phaser.GameObjects.Graphics,
    chestColor: number
  ): void {
    this.chestAnimationPhase = 1;

    AudioManager.getInstance().playPackReveal(0.4);

    // Тряска сундука
    const shakeTween = this.tweens.add({
      targets: chestContainer,
      x: { from: chestContainer.x - 5, to: chestContainer.x + 5 },
      angle: { from: -3, to: 3 },
      duration: 100,
      yoyo: true,
      repeat: 5,
      ease: 'Sine.easeInOut',
    });
    this.chestAnimationTweens.push(shakeTween);

    // Усиление свечения
    const glowIntensifyTween = this.tweens.add({
      targets: glow,
      alpha: 1,
      duration: 800,
      onUpdate: () => {
        const alpha = glow.alpha;
        glow.clear();
        glow.fillStyle(chestColor, 0.15 + alpha * 0.25);
        glow.fillCircle(0, 0, 100 + alpha * 40);
      },
    });
    this.chestAnimationTweens.push(glowIntensifyTween);

    // Переход к Phase 2
    const phase2Timer = this.time.delayedCall(1000, () => {
      this.startChestPhase2(overlay, chestContainer, glow, chestColor);
    });
    this.chestAnimationTimers.push(phase2Timer);
  }

  /**
   * Phase 2: Открытие и показ наград
   */
  private startChestPhase2(
    overlay: Phaser.GameObjects.Container,
    chestContainer: Phaser.GameObjects.Container,
    glow: Phaser.GameObjects.Graphics,
    chestColor: number
  ): void {
    this.chestAnimationPhase = 2;
    const { width, height } = this.cameras.main;

    // Звук открытия
    AudioManager.getInstance().playPackOpen(0.9);
    hapticImpact('medium');

    // Вспышка
    const flash = this.add.circle(width / 2, chestContainer.y, 150, 0xffffff, 1);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    flash.setDepth(220);
    overlay.add(flash);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: 2.5,
      duration: 300,
      ease: 'Cubic.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Исчезновение сундука
    this.tweens.add({
      targets: chestContainer,
      alpha: 0,
      scale: 0.5,
      duration: 150,
      onComplete: () => chestContainer.destroy(),
    });

    this.tweens.add({
      targets: glow,
      alpha: 0,
      duration: 200,
      onComplete: () => glow.destroy(),
    });

    // Показываем награды
    const rewardsTimer = this.time.delayedCall(300, () => {
      this.showChestRewards(overlay);
    });
    this.chestAnimationTimers.push(rewardsTimer);
  }

  /**
   * Показать награды из сундука
   */
  private showChestRewards(overlay: Phaser.GameObjects.Container): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const summary = this.chestPendingSummary;

    // Заголовок
    const titleText = this.add.text(width / 2, 70 + this.topInset, '✨ CHEST OPENED ✨', {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);
    titleText.setResolution(2);
    titleText.setDepth(230);
    overlay.add(titleText);

    const subtitleText = this.add.text(width / 2, 100 + this.topInset, 'You received:', {
      fontSize: '14px',
      color: '#d1d5db',
    }).setOrigin(0.5).setAlpha(0);
    subtitleText.setResolution(2);
    subtitleText.setDepth(230);
    overlay.add(subtitleText);

    this.tweens.add({
      targets: [titleText, subtitleText],
      alpha: 1,
      duration: 300,
    });

    // Комфортный фон-панель под награды
    const panelWidth = width - 40;
    const panelHeight = Math.min(430, height - this.topInset - this.bottomInset - 120);
    const panelY = height / 2 + 10;
    const panel = this.add.graphics();
    panel.fillStyle(0x0b0b15, 0.92);
    panel.fillRoundedRect((width - panelWidth) / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 18);
    panel.lineStyle(2, 0x6b21a8, 0.5);
    panel.strokeRoundedRect((width - panelWidth) / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 18);
    panel.setDepth(205);
    overlay.add(panel);

    // Слабое свечение панели
    const panelGlow = this.add.graphics();
    panelGlow.setDepth(204);
    panelGlow.setAlpha(0.35);
    panelGlow.fillStyle(0x8b5cf6, 0.3);
    panelGlow.fillRoundedRect((width - panelWidth) / 2 + 4, panelY - panelHeight / 2 + 4, panelWidth - 8, panelHeight - 8, 16);
    overlay.add(panelGlow);

    // Список наград
    const rewardItems: Phaser.GameObjects.Container[] = [];
    let hasEpicOrLegendary = false;

    // Монеты
    if (summary.coins > 0) {
      const coinTile = this.createRewardTile(0, 0, 'coins', summary.coins);
      overlay.add(coinTile);
      rewardItems.push(coinTile);
      if (summary.coins >= 5000) hasEpicOrLegendary = true;
    }

    // Кристаллы
    if (summary.crystals > 0) {
      const crystalTile = this.createRewardTile(0, 0, 'crystals', summary.crystals);
      overlay.add(crystalTile);
      rewardItems.push(crystalTile);
      if (summary.crystals >= 3) hasEpicOrLegendary = true;
    }

    // Карты — показываем каждую способность отдельно
    if (summary.cards && Object.keys(summary.cards).length > 0) {
      Object.entries(summary.cards).forEach(([cardId, count]) => {
        const cardTile = this.createCardTile(0, 0, cardId, count as number);
      overlay.add(cardTile);
      rewardItems.push(cardTile);
        const cardDef = getCard(cardId);
        if (cardDef && cardDef.rarity === 'epic') {
          hasEpicOrLegendary = true;
        }
      });
    }

    // Фрагменты — показываем каждый юнит отдельно
    if (summary.fragments && Object.keys(summary.fragments).length > 0) {
      Object.entries(summary.fragments).forEach(([unitId, count]) => {
        const fragmentTile = this.createUnitFragmentTile(0, 0, unitId, count as number);
      overlay.add(fragmentTile);
      rewardItems.push(fragmentTile);
        const unitData = UNITS_REPOSITORY.find(u => u.id === unitId);
        if (unitData && (unitData.rarity === 'epic' || unitData.rarity === 'legendary')) {
          hasEpicOrLegendary = true;
        }
      });
    }

    // Фрагменты ключа турнира
    if (summary.keyFragments > 0) {
      const keyFragmentTile = this.createTournamentKeyFragmentTile(0, 0, summary.keyFragments);
      overlay.add(keyFragmentTile);
      rewardItems.push(keyFragmentTile);
    }

    // Билеты на турнир
    if (summary.tickets > 0) {
      const ticketTile = this.createTournamentTicketTile(0, 0, summary.tickets);
      overlay.add(ticketTile);
      rewardItems.push(ticketTile);
    }

    // Полные разблокировки
    if (summary.capUnlocks.length > 0) {
      summary.capUnlocks.forEach((capId: string) => {
        const unlockTile = this.createRewardTile(0, 0, 'cap_unlock', 0, capId);
        overlay.add(unlockTile);
        rewardItems.push(unlockTile);
        const unitData = UNITS_REPOSITORY.find(u => u.id === capId);
        if (unitData && (unitData.rarity === 'epic' || unitData.rarity === 'legendary')) {
          hasEpicOrLegendary = true;
        }
      });
    }

    // Сетка расположения наград внутри панели
    const tileWidth = 130;
    const tileHeight = 150;
    const spacing = 16;
    const cols = Math.max(1, Math.floor((panelWidth - 40) / (tileWidth + spacing)));
    rewardItems.forEach((item, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const totalCols = Math.min(rewardItems.length, cols);
      const rowCount = Math.ceil(rewardItems.length / cols);
      const baseX = width / 2 - ((totalCols - 1) * (tileWidth + spacing)) / 2;
      const baseY = panelY - Math.min(1, rowCount - 1) * 0 - (rowCount > 1 ? (tileHeight * (rowCount - 1) + spacing * (rowCount - 1)) / 2 : 0);
      item.setPosition(baseX + col * (tileWidth + spacing), baseY + row * (tileHeight + spacing) - 10);
    });

    // Анимация появления наград
    rewardItems.forEach((item, index) => {
      item.setAlpha(0);
      item.setScale(0.5);
      this.tweens.add({
        targets: item,
        alpha: 1,
        scale: 1,
        duration: 320,
        delay: index * 120,
        ease: 'Back.easeOut',
      });
    });

    // Juicy-эффект для жирных наград
    if (hasEpicOrLegendary) {
      this.spawnJuicyBurst(overlay, width / 2, panelY - 40, 0xffc700);
    }

    // Кнопка COLLECT
    const collectBtn = this.createButton(
      width / 2,
      panelY + panelHeight / 2 - 36,
      160,
      48,
      '✓ COLLECT',
      () => this.closeChestOverlay(),
      0x22c55e
    );
    collectBtn.setAlpha(0);
    collectBtn.setDepth(230);
    overlay.add(collectBtn);

    this.tweens.add({
      targets: collectBtn,
      alpha: 1,
      duration: 300,
      delay: rewardItems.length * 120 + 200,
    });

    this.chestAnimationPhase = 3; // Final state
  }

  /**
   * Создать тайл карты (способности фракции)
   */
  private createCardTile(x: number, y: number, cardId: string, amount: number): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const tileWidth = 140;
    const tileHeight = 150;

    const cardDef = getCard(cardId);
    if (!cardDef) {
      return this.createRewardTile(x, y, 'cards', amount);
    }

    const rarityColors: Record<string, number> = {
      common: 0x9ca3af,
      rare: 0x3b82f6,
      epic: 0xa855f7,
      legendary: 0xf59e0b,
    };
    const borderColor = rarityColors[cardDef.rarity] || 0x3b82f6;

    // Фон
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.55);
    shadow.fillRoundedRect(-tileWidth / 2 + 2, -tileHeight / 2 + 2, tileWidth, tileHeight, 14);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x11111b, 0.95);
    bg.fillRoundedRect(-tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight, 14);
    bg.lineStyle(3, borderColor, 0.9);
    bg.strokeRoundedRect(-tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight, 14);
    container.add(bg);

    // Карта способности (используем новые PNG 600x900)
    const textureKey = `card_${cardId}`;
    if (this.textures.exists(textureKey)) {
      const cardImage = this.add.image(0, -20, textureKey);
      // Масштабируем 600x900 до 100x150 (сохраняя пропорции 2:3)
      cardImage.setDisplaySize(100, 150);
      container.add(cardImage);
    } else {
      // Placeholder
      const placeholder = this.add.rectangle(0, -20, 100, 150, 0x333366);
      placeholder.setStrokeStyle(1, 0x666666);
      container.add(placeholder);
      
      const placeholderText = this.add.text(0, -20, '?', {
        fontSize: '24px',
        color: '#666666',
      }).setOrigin(0.5);
      container.add(placeholderText);
    }

    // Название
    const name = this.add.text(0, 28, cardDef.name, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: tileWidth - 24 },
      align: 'center',
    }).setOrigin(0.5);
    name.setResolution(2);
    container.add(name);

    // Фракция + редкость
    const factionName = cardDef.factionId.toUpperCase();
    const rarityName = cardDef.rarity.toUpperCase();
    const meta = this.add.text(0, tileHeight / 2 - 44, `${factionName} • ${rarityName}`, {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#cbd5e1',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    meta.setResolution(2);
    container.add(meta);

    // Количество
    const amountText = this.add.text(0, tileHeight / 2 - 20, `+${amount}`, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    amountText.setResolution(2);
    container.add(amountText);

    return container;
  }

  /**
   * Эффект для жирных наград
   */
  private spawnJuicyBurst(overlay: Phaser.GameObjects.Container, x: number, y: number, color: number): void {
    const rays = this.add.graphics({ x, y });
    rays.setDepth(240);
    overlay.add(rays);

    // Простая радиальная вспышка
    for (let i = 0; i < 18; i++) {
      const angle = (Math.PI * 2 * i) / 18;
      const len = 160 + Math.random() * 30;
      const alpha = 0.18 + Math.random() * 0.1;
      rays.lineStyle(2, color, alpha);
      rays.beginPath();
      rays.moveTo(0, 0);
      rays.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
      rays.strokePath();
    }

    // Парочка искр (эмодзи)
    for (let i = 0; i < 10; i++) {
      const star = this.add.text(x, y, '✦', {
        fontSize: '18px',
        color: '#ffd966',
      }).setOrigin(0.5);
      star.setDepth(241);
      overlay.add(star);

      this.tweens.add({
        targets: star,
        x: x + Phaser.Math.Between(-120, 120),
        y: y + Phaser.Math.Between(-60, 40),
        alpha: 0,
        scale: 0.4,
        duration: 600,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }

    // Затухание лучей
    this.tweens.add({
      targets: rays,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => rays.destroy(),
    });
  }

  /**
   * Создать тайл награды
   */
  private createRewardTile(x: number, y: number, type: string, amount: number, capId?: string): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const tileSize = 100; // Было 70, увеличиваем

    // Фон (с тенью)
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-tileSize / 2 + 2, -tileSize / 2 + 2, tileSize, tileSize, 12);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    bg.lineStyle(3, 0x3b82f6, 0.9);
    bg.strokeRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    container.add(bg);

    // Иконка (крупнее)
    let iconAdded = false;
    if (type === 'cap_unlock' && capId) {
      // Для полной разблокировки юнита используем текстуру юнита
      const unitData = UNITS_REPOSITORY.find(u => u.id === capId);
      if (unitData) {
        const hdKey = `${unitData.assetKey}_512`;
        const baseKey = unitData.assetKey;
        
        // Проверяем сначала HD ключ, потом базовый
        const textureKey = this.textures.exists(hdKey) ? hdKey :
                           this.textures.exists(baseKey) ? baseKey : null;
        
        if (textureKey) {
          const icon = this.add.image(0, -8, textureKey).setDisplaySize(64, 64);
          container.add(icon);
          iconAdded = true;
        }
      }
    }
    
    if (!iconAdded) {
      // Для остальных типов наград используем стандартные иконки
      const iconKey = `reward_${type}_256`;
      
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(0, -8, iconKey).setDisplaySize(64, 64);
        container.add(icon);
        iconAdded = true;
      }
    }
    
    if (!iconAdded) {
      // Fallback emoji
      const fallbackIcon = type === 'coins' ? '💰' : 
                           type === 'crystals' ? '💎' : 
                           type === 'cards' ? '🃏' : 
                           type === 'fragments' ? '🧩' : 
                           type === 'cap_unlock' ? '⭐' : '✨';
      container.add(this.add.text(0, -8, fallbackIcon, { fontSize: '52px' }).setOrigin(0.5));
    }

    // Подпись типа награды (для ясности)
    const typeLabel = this.add.text(0, tileSize / 2 - 44, this.formatRewardType(type), {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#cbd5e1',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    typeLabel.setResolution(2);
    container.add(typeLabel);

    // Количество (чётче, крупнее)
    if (amount > 0) {
      const amountText = this.add.text(0, tileSize / 2 - 18, `+${amount}`, {
        fontSize: '16px', // Было 12px
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      amountText.setResolution(2);
      container.add(amountText);
    } else if (type === 'cap_unlock') {
      const newText = this.add.text(0, tileSize / 2 - 18, 'NEW!', {
        fontSize: '14px', // Было 11px
        fontFamily: fonts.tech,
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      newText.setResolution(2);
      container.add(newText);
    }

    return container;
  }

  private formatRewardType(type: string): string {
    switch (type) {
      case 'coins': return 'Coins';
      case 'crystals': return 'Crystals';
      case 'cards': return 'Cards';
      case 'fragments': return 'Fragments';
      case 'cap_unlock': return 'Unit';
      case 'tournament_key_fragment': return 'Key Fragment';
      case 'tournament_ticket': return 'Ticket';
      default: return 'Reward';
    }
  }

  /**
   * Создать тайл фрагмента ключа турнира
   */
  private createTournamentKeyFragmentTile(x: number, y: number, amount: number): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const tileSize = 120;

    // Фон с золотым оттенком
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-tileSize / 2 + 2, -tileSize / 2 + 2, tileSize, tileSize, 12);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    bg.lineStyle(3, 0xffaa00, 0.9);
    bg.strokeRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    container.add(bg);

    // Иконка фрагмента ключа
    const iconKey = 'tournament_key_fragment';
    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(0, -8, iconKey).setDisplaySize(70, 70);
      container.add(icon);
    } else {
      // Placeholder
      const placeholder = this.add.text(0, -8, '🔑', { fontSize: '56px' }).setOrigin(0.5);
      container.add(placeholder);
    }

    // Подпись
    const typeLabel = this.add.text(0, tileSize / 2 - 44, 'Key Fragment', {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#ffaa00',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    typeLabel.setResolution(2);
    container.add(typeLabel);

    // Количество
    const amountText = this.add.text(0, tileSize / 2 - 18, `+${amount}`, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    amountText.setResolution(2);
    container.add(amountText);

    return container;
  }

  /**
   * Создать тайл билета на турнир
   */
  private createTournamentTicketTile(x: number, y: number, amount: number): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const tileSize = 120;

    // Фон с зелёным оттенком
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-tileSize / 2 + 2, -tileSize / 2 + 2, tileSize, tileSize, 12);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    bg.lineStyle(3, 0x00ff88, 0.9);
    bg.strokeRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    container.add(bg);

    // Иконка билета
    const iconKey = 'tournament_ticket';
    if (this.textures.exists(iconKey)) {
      const icon = this.add.image(0, -8, iconKey).setDisplaySize(70, 70);
      container.add(icon);
    } else {
      // Placeholder
      const placeholder = this.add.text(0, -8, '🎫', { fontSize: '56px' }).setOrigin(0.5);
      container.add(placeholder);
    }

    // Подпись
    const typeLabel = this.add.text(0, tileSize / 2 - 44, 'Tournament Ticket', {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#00ff88',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    typeLabel.setResolution(2);
    container.add(typeLabel);

    // Количество
    const amountText = this.add.text(0, tileSize / 2 - 18, `+${amount}`, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    amountText.setResolution(2);
    container.add(amountText);

    return container;
  }

  /**
   * Создать тайл фрагментов конкретного юнита
   */
  private createUnitFragmentTile(x: number, y: number, unitId: string, amount: number): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const tileSize = 120; // Чуть шире для юнита

    // Получаем данные юнита из репозитория
    const unitData = UNITS_REPOSITORY.find(u => u.id === unitId);
    if (!unitData) {
      // Fallback на generic fragments
      return this.createRewardTile(x, y, 'fragments', amount);
    }

    // Фон (с тенью и цветом редкости)
    const rarityColors: Record<string, number> = {
      common: 0x9ca3af,
      rare: 0x3b82f6,
      epic: 0xa855f7,
      legendary: 0xf59e0b,
    };
    const borderColor = rarityColors[unitData.rarity] || 0x3b82f6;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-tileSize / 2 + 2, -tileSize / 2 + 2, tileSize, tileSize, 12);
    container.add(shadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    bg.lineStyle(3, borderColor, 0.9);
    bg.strokeRoundedRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, 12);
    container.add(bg);

    // Иконка юнита
    // ✅ FIX: Проверяем сначала HD ключ (текстуры загружаются под этим ключом), потом базовый
    const hdKey = `${unitData.assetKey}_512`;
    const baseKey = unitData.assetKey;
    
    // Проверяем сначала HD ключ, потом базовый
    const textureKey = this.textures.exists(hdKey) ? hdKey :
                       this.textures.exists(baseKey) ? baseKey : null;
    
    if (textureKey) {
      const icon = this.add.image(0, -12, textureKey).setDisplaySize(70, 70);
      container.add(icon);
    } else {
      // Fallback emoji
      const fallbackIcon = this.add.text(0, -12, '🧩', { fontSize: '54px' }).setOrigin(0.5);
      container.add(fallbackIcon);
      
      if (import.meta.env.DEV) {
        console.warn(`[ShopScene] ⚠️ Texture not found: "${baseKey}" (tried ${hdKey} and ${baseKey}, unitId="${unitId}")`);
      }
    }

    // Название юнита (укороченное)
    const displayName = getDisplayName(unitData);
    const shortName = displayName.length > 12 ? displayName.substring(0, 12) + '...' : displayName;
    const nameText = this.add.text(0, tileSize / 2 - 40, shortName, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: '#cbd5e1',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    nameText.setResolution(2);
    container.add(nameText);

    // Бейдж "Fragments"
    const fragmentBadge = this.add.text(0, tileSize / 2 - 26, 'Fragments', {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: '#94a3b8',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    fragmentBadge.setResolution(2);
    container.add(fragmentBadge);

    // Количество
    const amountText = this.add.text(0, tileSize / 2 - 10, `+${amount}`, {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    amountText.setResolution(2);
    container.add(amountText);

    return container;
  }

  /**
   * Обработка tap-skip для сундука
   */
  private handleChestTapSkip(): void {
    if (this.chestAnimationPhase >= 3) {
      this.closeChestOverlay();
      return;
    }

    if (this.chestAnimationPhase >= 0 && this.chestAnimationPhase < 3) {
      this.skipToChestFinal();
    }
  }

  /**
   * Мгновенный переход к финальному состоянию
   */
  private skipToChestFinal(): void {
    this.chestAnimationTweens.forEach(tween => {
      if (tween && tween.isPlaying()) {
        tween.stop();
      }
    });
    this.chestAnimationTweens = [];

    this.chestAnimationTimers.forEach(timer => {
      if (timer) {
        timer.destroy();
      }
    });
    this.chestAnimationTimers = [];

    hapticImpact('light');

    if (this.chestOverlay) {
      this.chestOverlay.destroy();
    }

    this.showChestFinalState();
  }

  /**
   * Показать финальное состояние (после skip)
   */
  private showChestFinalState(): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const summary = this.chestPendingSummary;

    const overlay = this.add.container(0, 0).setDepth(200);
    this.chestOverlay = overlay;

    const darkBg = this.add.graphics();
    darkBg.fillStyle(0x000000, 0.85);
    darkBg.fillRect(0, 0, width, height);
    overlay.add(darkBg);

    const titleText = this.add.text(width / 2, 70 + this.topInset, '✨ CHEST OPENED ✨', {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    titleText.setResolution(2);
    overlay.add(titleText);

    const subtitleText = this.add.text(width / 2, 100 + this.topInset, 'You received:', {
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    subtitleText.setResolution(2);
    overlay.add(subtitleText);

    // Показываем все награды сразу
    const rewardY = height / 2;
    let rewardX = width / 2 - 120;

    if (summary.coins > 0) {
      overlay.add(this.createRewardTile(rewardX, rewardY, 'coins', summary.coins));
      rewardX += 80;
    }
    if (summary.crystals > 0) {
      overlay.add(this.createRewardTile(rewardX, rewardY, 'crystals', summary.crystals));
      rewardX += 80;
    }
    const cardCount = Object.values(summary.cards).reduce((sum: number, count: any) => sum + (count as number), 0) as number;
    if (cardCount > 0) {
      overlay.add(this.createRewardTile(rewardX, rewardY, 'cards', cardCount));
      rewardX += 80;
    }
    const fragmentCount = Object.values(summary.fragments).reduce((sum: number, count: any) => sum + (count as number), 0) as number;
    if (fragmentCount > 0) {
      overlay.add(this.createRewardTile(rewardX, rewardY, 'fragments', fragmentCount));
      rewardX += 80;
    }
    if (summary.capUnlocks.length > 0) {
      summary.capUnlocks.forEach((capId: string) => {
        overlay.add(this.createRewardTile(rewardX, rewardY, 'cap_unlock', 0, capId));
        rewardX += 100;
      });
    }

    const collectBtn = this.createButton(
      width / 2,
      height - 70 - this.bottomInset,
      140,
      44,
      '✓ COLLECT',
      () => this.closeChestOverlay(),
      0x22c55e
    );
    overlay.add(collectBtn);

    const hitArea = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setInteractive()
      .setDepth(250);
    overlay.add(hitArea);

    hitArea.on('pointerdown', () => {
      this.closeChestOverlay();
    });

    this.chestAnimationPhase = 3;
  }

  /**
   * Закрытие оверлея сундука
   */
  private closeChestOverlay(): void {
    if (this.chestOverlay) {
      AudioManager.getInstance().playUIClick();

      this.tweens.add({
        targets: this.chestOverlay,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.chestOverlay?.destroy();
          this.chestOverlay = null;
          this.isOverlayOpen = false;
          this.chestAnimationPhase = -1;
          this.chestPendingRewards = [];
          this.chestPendingSummary = null;
          this.chestAnimationTweens = [];
          this.chestAnimationTimers = [];
          this.renderContent();
        },
      });
    }
  }

  // ==================== END CINEMATIC CHEST ====================

  private createRevealedCard(
    x: number, y: number, w: number, h: number,
    card: CardDefinition
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const rarityColors: Record<CardRarity, { bg: number; border: number; glow: number }> = {
      common: { bg: 0x4a5568, border: 0x718096, glow: 0x718096 },
      rare: { bg: 0x2563eb, border: 0x3b82f6, glow: 0x60a5fa },
      epic: { bg: 0x7c3aed, border: 0x8b5cf6, glow: 0xa78bfa },
    };

    const colors = rarityColors[card.rarity];
    const factionColor = FACTIONS[card.factionId].color;

    if (card.rarity !== 'common') {
      const glow = this.add.graphics();
      glow.fillStyle(colors.glow, 0.4);
      glow.fillCircle(0, 0, w * 0.8);
      container.add(glow);

      this.tweens.add({
        targets: glow,
        alpha: 0.2,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });
    }

    const bg = this.add.graphics();
    bg.fillStyle(colors.bg, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(3, colors.border, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    container.add(bg);

    const factionBar = this.add.graphics();
    factionBar.fillStyle(factionColor, 0.8);
    factionBar.fillRoundedRect(-w / 2, -h / 2, w, 25, { tl: 10, tr: 10, bl: 0, br: 0 } as any);
    container.add(factionBar);

    const factionText = this.add.text(0, -h / 2 + 12, FACTIONS[card.factionId].name.toUpperCase(), {
      fontSize: '8px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    factionText.setResolution(2);
    container.add(factionText);

    const iconKey = `card_${card.id}`;
    if (this.textures.exists(iconKey)) {
      container.add(this.add.image(0, -10, iconKey).setDisplaySize(60, 60));
    } else {
      const iconCircle = this.add.graphics();
      iconCircle.fillStyle(0xffffff, 0.2);
      iconCircle.fillCircle(0, -10, 25);
      container.add(iconCircle);
      
      container.add(this.add.text(0, -10, '✦', {
        fontSize: '24px', color: '#ffffff',
      }).setOrigin(0.5));
    }

    const nameText = this.add.text(0, h / 2 - 45, card.name, {
      fontSize: '9px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    nameText.setResolution(2);
    container.add(nameText);

    const rarityText = card.rarity.toUpperCase();
    const rarityBg = this.add.graphics();
    rarityBg.fillStyle(colors.glow, 0.5);
    rarityBg.fillRoundedRect(-30, h / 2 - 28, 60, 18, 9);
    container.add(rarityBg);

    const rarityLabel = this.add.text(0, h / 2 - 19, rarityText, {
      fontSize: '8px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    rarityLabel.setResolution(2);
    container.add(rarityLabel);

    return container;
  }

  private addFactionCardHeader(y: number, faction: FactionConfig): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const line = this.add.graphics();
    line.fillStyle(faction.color, 0.4);
    line.fillRect(12, y + 12, width - 24, 1);
    this.contentContainer.add(line);

    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0a0a15, 1);
    labelBg.fillRoundedRect(width / 2 - 70, y, 140, 26, 13);
    labelBg.lineStyle(2, faction.color, 0.6);
    labelBg.strokeRoundedRect(width / 2 - 70, y, 140, 26, 13);
    this.contentContainer.add(labelBg);

    this.contentContainer.add(this.add.text(width / 2, y + 13, faction.name.toUpperCase(), {
      fontSize: '11px', fontFamily: fonts.tech, color: hexToString(faction.color), fontStyle: 'bold',
    }).setOrigin(0.5));

    return y + 38;
  }

  private createInventoryCardItem(
    x: number, y: number, w: number, h: number,
    card: CardDefinition, count: number
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);

    const rarityColors: Record<CardRarity, number> = {
      common: 0x6b7280,
      rare: 0x3b82f6,
      epic: 0x8b5cf6,
    };

    const rarityColor = rarityColors[card.rarity];
    const hasCards = count > 0;

    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.95);
    bg.fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(2, hasCards ? rarityColor : 0x333344, hasCards ? 0.7 : 0.3);
    bg.strokeRoundedRect(0, 0, w, h, 10);
    container.add(bg);

    const leftBar = this.add.graphics();
    leftBar.fillStyle(rarityColor, hasCards ? 0.8 : 0.3);
    leftBar.fillRoundedRect(0, 0, 6, h, { tl: 10, bl: 10, tr: 0, br: 0 } as any);
    container.add(leftBar);

    const iconX = 45;
    const iconY = h / 2;
    const iconKey = `card_${card.id}`;

    if (hasCards && card.rarity !== 'common') {
      const glow = this.add.circle(iconX, iconY, 30, rarityColor, 0.22);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.addAt(glow, 0);
    }

    if (this.textures.exists(iconKey)) {
      const img = this.add.image(iconX, iconY, iconKey)
        .setDisplaySize(50, 50)
        .setAlpha(hasCards ? 1 : 0.4);
      container.add(img);
    } else {
      const iconBg = this.add.graphics();
      iconBg.fillStyle(rarityColor, hasCards ? 0.4 : 0.15);
      iconBg.fillCircle(iconX, iconY, 22);
      container.add(iconBg);
      
      container.add(this.add.text(iconX, iconY, '✦', {
        fontSize: '18px', color: hasCards ? '#ffffff' : '#555555',
      }).setOrigin(0.5).setAlpha(hasCards ? 1 : 0.5));
    }

    const textX = 85;

    const nameText = this.add.text(textX, 15, card.name.toUpperCase(), {
      fontSize: '12px', fontFamily: fonts.tech, 
      color: hasCards ? '#ffffff' : '#555555', fontStyle: 'bold',
    });
    nameText.setResolution(2);
    container.add(nameText);

    const descText = this.add.text(textX, 35, card.description, {
      fontSize: '9px', color: hasCards ? '#aaaaaa' : '#444444',
      wordWrap: { width: w - textX - 70 },
    });
    descText.setResolution(2);
    container.add(descText);

    const rarityText = card.rarity.toUpperCase();
    container.add(this.add.text(textX, h - 18, rarityText, {
      fontSize: '9px', fontFamily: fonts.tech, color: hexToString(rarityColor),
    }));

    const targetIcons: Record<string, string> = {
      point: '📍',
      unit_self: '🎯',
      unit_enemy: '👹',
      unit_ally_pair: '🔄',
      none: '⚡',
    };
    container.add(this.add.text(textX + 60, h - 18, targetIcons[card.targetType] || '❓', {
      fontSize: '10px',
    }));

    const countX = w - 35;
    const countBg = this.add.graphics();
    countBg.fillStyle(hasCards ? 0x22c55e : 0x333344, hasCards ? 0.3 : 0.5);
    countBg.fillRoundedRect(countX - 20, h / 2 - 15, 40, 30, 8);
    container.add(countBg);

    const countText = this.add.text(countX, h / 2, `×${count}`, {
      fontSize: '14px', fontFamily: fonts.tech, 
      color: hasCards ? '#22c55e' : '#555555', fontStyle: 'bold',
    }).setOrigin(0.5);
    countText.setResolution(2);
    container.add(countText);

    if (!hasCards) {
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.3);
      overlay.fillRoundedRect(0, 0, w, h, 10);
      container.add(overlay);
    }

    return container;
  }

  // ==================== HELPERS ====================

  private addSection(y: number, text: string, color: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const line = this.add.graphics();
    line.fillStyle(color, 0.4);
    line.fillRect(15, y + 10, width - 30, 1);
    this.contentContainer.add(line);

    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x0a0a15, 1);
    labelBg.fillRect(width / 2 - 95, y, 190, 22);
    this.contentContainer.add(labelBg);

    this.contentContainer.add(this.add.text(width / 2, y + 11, text, {
      fontSize: '11px', fontFamily: fonts.tech, color: hexToString(color), fontStyle: 'bold',
    }).setOrigin(0.5));

    return y + 32;
  }

  private getBoosterTextureKey(config: {
    type: 'tactical' | 'faction';
    factionId?: FactionId;
  }): string | null {
    if (config.type === 'tactical') {
      return this.textures.exists('booster_tactical') ? 'booster_tactical' : null;
    }

    if (!config.factionId) {
      return this.textures.exists('booster_faction') ? 'booster_faction' : null;
    }

    const map: Record<FactionId, string> = {
      magma: 'booster_magma',
      cyborg: 'booster_cyborg',
      void:   'booster_void',
      insect: 'booster_insect',
    };

    const key = map[config.factionId];
    if (key && this.textures.exists(key)) return key;

    return this.textures.exists('booster_faction') ? 'booster_faction' : null;
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    text: string, onClick: () => void, color: number = 0x444444, outline = false
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    if (outline) {
      bg.fillStyle(0x050816, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
      bg.lineStyle(2, color, 0.8);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    } else {
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    }
    container.add(bg);

    const textColor = outline ? hexToString(color) : (color === 0x444444 || color === 0x555555 ? '#888888' : '#000000');
    const btnText = this.add.text(0, 0, text, {
      fontSize: '12px', fontFamily: fonts.tech, color: textColor, fontStyle: 'bold',
    }).setOrigin(0.5);
    btnText.setResolution(2);
    container.add(btnText);

    if (color !== 0x444444 && color !== 0x555555) {
      const hit = this.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.dragDistance < 10) {
          this.tweens.add({
            targets: container,
            scale: 0.96,
            duration: 60,
            yoyo: true,
            ease: 'Power2',
          });
          onClick();
        }
      });
      container.add(hit);
    }

    return container;
  }

  private formatNum(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  }

  private updateCurrency(): void {
    const data = playerData.get();
    this.coinsText?.setText(this.formatNum(data.coins));
    this.crystalsText?.setText(`${data.crystals}`);
  }

  private updateCardPositions(): void {
    this.contentContainer.y = -this.scrollY;
    const viewTop = this.scrollY;
    const viewBottom = this.scrollY + (this.visibleAreaBottom - this.visibleAreaTop);
    this.cards.forEach((c) => {
      c.container.setVisible(c.y + c.height + 50 > viewTop && c.y - 50 < viewBottom);
    });
  }

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, dy: number) => {
      if (!this.isOverlayOpen) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScrollY);
        this.scrollVelocity = 0;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Блокируем только на pointerdown
      if (p.event) {
        p.event.preventDefault();
      }
      
      if (p.y > this.visibleAreaTop && !this.isOverlayOpen) {
        this.isDragging = true;
        this.lastPointerY = p.y;
        this.pointerStartY = p.y;
        this.scrollVelocity = 0;
        this.dragDistance = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      // ✅ Блокируем нативное поведение (pull-to-refresh / скролл страницы)
      if (p.event && (p.event as any).cancelable) {
        p.event.preventDefault();
      }

      if (this.isDragging && !this.isOverlayOpen) {
        const delta = this.lastPointerY - p.y;
        this.dragDistance = Math.abs(p.y - this.pointerStartY);
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.scrollVelocity = delta * 0.5;
        this.lastPointerY = p.y;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.isDragging = false;
    });
  }
}