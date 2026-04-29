// src/scenes/TeamScene.ts
// ✅ ИЗМЕНЕНО: Исправлена ошибка TS2554. Теперь createCustomFormation получает teamSize.

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../config/themes';
import { playerData } from '../data/PlayerData';
import {
  getUnit,
  getClassIcon,
  getClassColor,
  getClassName,
  UnitData,
} from '../data/UnitsCatalog';
import { getUnitsByFaction as getRepositoryUnitsByFaction, getDisplayName } from '../data/UnitsRepository';
import {
  getBallSkin,
  getFieldSkin,
  BALL_SKINS,
} from '../data/SkinsCatalog';
import { AudioManager } from '../managers/AudioManager';
import {
  FactionId,
  DEFAULT_FACTION,
  FACTIONS,
  getFactionArena,
  FACTION_ARENAS,
} from '../constants/gameConstants';
import {
  FACTION_UI,
  getUIFactionByGameFaction,
} from '../constants/factionUiConfig';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { safeSceneStart } from '../utils/SceneHelpers';
import {
  TEAM_LAYOUT,
  getSafeArea,
  calculateHeaderHeight,
  calculateTitleY,
  calculateVisibleContentHeight,
  calculateGridPositions,
  fitText,
  fitImage,
} from '../ui/layout/TeamSceneLayout';

/**
 * Предотвращает нативные события браузера на pointer событии
 */
function preventNativeEvent(pointer: Phaser.Input.Pointer): void {
  if (pointer.event) {
    pointer.event.preventDefault();
    pointer.event.stopPropagation();
  }
}
import { FactionMasteryManager } from '../managers/FactionMasteryManager';
import {
  CARDS_CATALOG,
  CardDefinition,
  CardRarity,
} from '../data/CardsCatalog';
import { TOURNAMENT_KEY_KEYS } from '../config/assetKeys';
import { loadImagesTactics } from '../assets/loading/ImageLoader';
import { AssetPackManager } from '../assets/AssetPackManager';
// ⚠️ REMOVED: MYSTIC_CAPS - старая система коллекций убрана

// ✅ ДОБАВЛЕНО: Константа для зоны свайпа
const SWIPE_EDGE_ZONE = 30;

// ✅ ДОБАВЛЕНО: Максимальное количество слотов
const MAX_TEAM_SLOTS = 5;

interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

export class TeamScene extends Phaser.Scene {
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private cards: Card[] = [];

  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 110;
  private contentTop = 0;

  private gameWidth = 0;
  private gameHeight = 0;

  private isPointerScrolling = false;
  private isDraggingPuck = false;
  private pointerScrollStartY = 0;
  private scrollStartY = 0;
  // ✅ ДОБАВЛЕНО: Флаг для отслеживания свайпа
  private isSwipeInProgress = false;

  private selectedUnitSlot: number | null = null;
  private accentColor: number = 0x00f2ff;

  private highlightUnitId: string | null = null;
  private swipeManager?: SwipeNavigationManager;
  private capModalOverlay: Phaser.GameObjects.Container | null = null; // ✅ НОВОЕ: Модальное окно для деталей фишки

  constructor() {
    super({ key: 'TeamScene' });
  }

  init(data?: { highlightUnitId?: string }): void {
    if (data?.highlightUnitId) {
      this.highlightUnitId = data.highlightUnitId;
    } else {
      const fromRegistry = this.registry.get('team_highlight_unit') as string | undefined;
      this.highlightUnitId = fromRegistry || null;
      if (fromRegistry) this.registry.remove('team_highlight_unit');
    }
  }

  preload(): void {
    loadImagesTactics(this);
  }

  create(): void {
    this.cleanupBeforeCreate();

    const { width, height } = this.cameras.main;
    this.gameWidth = width;
    this.gameHeight = height;

    // ✅ УЛУЧШЕНИЕ: Отключаем сглаживание для четкости
    this.cameras.main.setRoundPixels(true);

    const safeArea = getSafeArea(this);
    this.topInset = safeArea.top;
    this.bottomInset = safeArea.bottom;
    // ✅ ИСПРАВЛЕНО: Используем helper-функцию для расчета высоты шапки
    this.headerHeight = calculateHeaderHeight(safeArea);

    console.log('[TeamScene] Insets - Top:', this.topInset, 'Bottom:', this.bottomInset);

    AudioManager.getInstance().init(this);

    const gameFaction: FactionId = playerData.getFaction() || DEFAULT_FACTION;
    const uiFactionId = getUIFactionByGameFaction(gameFaction);
    this.accentColor = FACTION_UI[uiFactionId].color;

    this.cards = [];
    this.scrollY = 0;
    this.selectedUnitSlot = null;
    this.isDraggingPuck = false;
    this.isSwipeInProgress = false;

    this.createBackground();
    this.createContentArea();
    this.createHeader();
    this.renderContent();
    
    // ✅ ВАЖНО: Сначала создаём SwipeManager, потом setupInteractions
    // чтобы SwipeManager получал события первым
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
      canSwipe: () => !this.isDraggingPuck && !this.isPointerScrolling && !this.capModalOverlay,
      edgeZoneWidth: SWIPE_EDGE_ZONE,
    });
    this.swipeManager.enable();
    
    // ✅ Теперь настраиваем скролл (после SwipeManager)
    this.setupInteractions();
    this.time.delayedCall(50, () => {
      void this.loadTacticsUnitPngs();
    });
    
    console.log('[TeamScene] SwipeManager initialized and enabled');
  }

  private async loadTacticsUnitPngs(): Promise<void> {
    const faction = playerData.getFaction() || DEFAULT_FACTION;
    const unitIds = [
      ...playerData.getTeamUnits(faction),
      ...getRepositoryUnitsByFaction(faction).map((unit) => unit.id),
    ];

    try {
      await AssetPackManager.loadUnitAssets(this, unitIds);
      if (this.scene.isActive()) {
        this.renderContent();
      }
    } catch (error) {
      console.warn('[TeamScene] Failed to lazy-load tactics unit PNGs:', error);
    }
  }

  private cleanupBeforeCreate(): void {
    this.swipeManager?.destroy();
    this.swipeManager = undefined;
    
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();
    this.cards = [];
    this.scrollY = 0;
    this.maxScrollY = 0;
    this.isPointerScrolling = false;
    this.isDraggingPuck = false;
    this.isSwipeInProgress = false;
    this.selectedUnitSlot = null;
    this.capModalOverlay = null; // ✅ НОВОЕ: Сброс модала
  }

  update(): void {
    // без инерции
  }

  private async handleBack(): Promise<void> {
    console.log('[TeamScene] handleBack called, selectedUnitSlot:', this.selectedUnitSlot);
    
    // ⚠️ REMOVED: closeCapModal - старая система убрана
    // Теперь используется CollectionScene
    if (this.capModalOverlay) {
      // this.closeCapModal();
      return;
    }
    
    if (this.selectedUnitSlot !== null) {
      // Если выбран слот — отменяем выбор
      this.selectedUnitSlot = null;
      this.renderContent();
    } else {
      this.swipeManager?.destroy();
      this.swipeManager = undefined;
      await safeSceneStart(this, 'FactionSelectScene');
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    const solidBg = this.add.rectangle(width / 2, height / 2, width, height, 0x060a18);
    solidBg.setDepth(-100);
    
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x060a18, 0x060a18, 0x0f172a, 0x0f172a, 1);
    bg.fillRect(0, 0, width, height);
    bg.setDepth(-10);

    const overlay = this.add.graphics().setDepth(-9);
    overlay.fillStyle(this.accentColor, 0.08);
    overlay.fillRect(0, 0, width, height);

    const grid = this.add.graphics().setDepth(-8);
    grid.lineStyle(1, 0x1f2937, 0.15);
    for (let x = 0; x <= width; x += 40) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += 40) {
      grid.lineBetween(0, y, width, y);
    }
  }
  
  private createHeader(): void {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const data = playerData.get();
    const safeArea = getSafeArea(this);
    const layout = TEAM_LAYOUT.HEADER;

    const headerContainer = this.add.container(0, 0).setDepth(100);

    // Фон шапки
    const headerBg = this.add.graphics();
    headerBg.fillStyle(TEAM_LAYOUT.COLORS.background.header, TEAM_LAYOUT.COLORS.alpha.high);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.lineStyle(1, TEAM_LAYOUT.COLORS.border.header, 1);
    headerBg.lineBetween(0, this.headerHeight, width, this.headerHeight);
    headerContainer.add(headerBg);

    // ✅ ИЗМЕНЕНО: Добавлен Mastery Info рядом с заголовком
    const currentFaction = playerData.getFaction() || DEFAULT_FACTION;
    const masteryData = playerData.getFactionMastery(currentFaction);
    const rankInfo = playerData.getFactionRankInfo(currentFaction);
    const progress = playerData.getFactionMasteryProgress(currentFaction);
    const nextLevelXP = playerData.getFactionNextLevelXP(currentFaction);

    // ✅ ИСПРАВЛЕНО: Используем helper-функцию для расчета позиции заголовка
    const titleY = calculateTitleY(safeArea);
    const title = this.add.text(width / 2, titleY, 'MY TEAM', {
      fontSize: `${layout.titleFontSize}px`,
      fontFamily: fonts.tech,
      color: hexToString(this.accentColor),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    headerContainer.add(title);

    // ✅ ИЗМЕНЕНО: Mastery badge с использованием констант
    const masteryBadgeY = titleY + layout.masteryBadge.offsetY;
    const masteryBadgeX = width / 2 + layout.masteryBadge.offsetX;
    const masteryBadge = this.add.container(masteryBadgeX, masteryBadgeY);
    
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(0x1e293b, TEAM_LAYOUT.COLORS.alpha.medium);
    badgeBg.fillRoundedRect(
      -layout.masteryBadge.width / 2,
      -layout.masteryBadge.height / 2,
      layout.masteryBadge.width,
      layout.masteryBadge.height,
      layout.masteryBadge.height / 2
    );
    badgeBg.lineStyle(1, this.accentColor, TEAM_LAYOUT.COLORS.alpha.low);
    badgeBg.strokeRoundedRect(
      -layout.masteryBadge.width / 2,
      -layout.masteryBadge.height / 2,
      layout.masteryBadge.width,
      layout.masteryBadge.height,
      layout.masteryBadge.height / 2
    );
    masteryBadge.add(badgeBg);

    const rankIcon = this.add.text(
      -layout.masteryBadge.width / 2 + 8,
      0,
      rankInfo.icon,
      { fontSize: `${layout.masteryBadge.iconFontSize}px` }
    ).setOrigin(0, 0.5);
    masteryBadge.add(rankIcon);

    const levelText = this.add.text(
      -layout.masteryBadge.width / 2 + 26,
      0,
      `Lv.${rankInfo.level}`,
      {
        fontSize: `${layout.masteryBadge.fontSize}px`,
        fontFamily: fonts.tech,
        color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
        fontStyle: 'bold',
      }
    ).setOrigin(0, 0.5);
    masteryBadge.add(levelText);

    // Progress bar
    const barConfig = layout.masteryBadge.progressBar;
    const barX = -layout.masteryBadge.width / 2 + barConfig.offsetX;
    
    const barBg = this.add.graphics();
    barBg.fillStyle(0x0f172a, TEAM_LAYOUT.COLORS.alpha.solid);
    barBg.fillRoundedRect(barX, -barConfig.height / 2, barConfig.width, barConfig.height, 3);
    masteryBadge.add(barBg);

    if (progress > 0) {
      const barFill = this.add.graphics();
      barFill.fillStyle(this.accentColor, TEAM_LAYOUT.COLORS.alpha.solid);
      barFill.fillRoundedRect(barX, -barConfig.height / 2, barConfig.width * progress, barConfig.height, 3);
      masteryBadge.add(barFill);
    }

    // XP text
    const xpText = nextLevelXP 
      ? `${masteryData.xp}/${nextLevelXP}`
      : 'MAX';
    const xpLabel = this.add.text(
      barX + barConfig.width + 4,
      0,
      xpText,
      {
        fontSize: `${layout.masteryBadge.xpFontSize}px`,
        fontFamily: fonts.tech,
        color: hexToString(TEAM_LAYOUT.COLORS.text.secondary),
      }
    ).setOrigin(0, 0.5);
    masteryBadge.add(xpLabel);

    headerContainer.add(masteryBadge);

    // ✅ ИСПРАВЛЕНО: Валюта с использованием констант
    const currencyX = width + layout.currency.offsetX;
    const currencyY1 = titleY + layout.currency.offsetY1;
    const currencyY2 = titleY + layout.currency.offsetY2;
    
    const gemText = this.add.text(currencyX - 25, currencyY1, `${data.crystals}`, {
      fontSize: `${layout.currency.fontSize}px`,
      fontFamily: fonts.primary,
      color: '#a78bfa',
    }).setOrigin(1, 0.5);
    
    // Кристаллы
    if (this.textures.exists('ui_rewards_crystals')) {
      const gemIcon = this.add.image(currencyX, currencyY1, 'ui_rewards_crystals');
      gemIcon.setDisplaySize(layout.currency.iconSize, layout.currency.iconSize);
      gemIcon.setOrigin(1, 0.5);
      headerContainer.add(gemIcon);
    } else {
      const gemIcon = this.add.text(currencyX, currencyY1, '💎', { fontSize: `${layout.currency.iconSize}px` }).setOrigin(1, 0.5);
      headerContainer.add(gemIcon);
    }

    const coinText = this.add.text(currencyX - 25, currencyY2, `${data.coins}`, {
      fontSize: `${layout.currency.fontSize}px`,
      fontFamily: fonts.primary,
      color: '#facc15',
    }).setOrigin(1, 0.5);
    
    // Монеты
    if (this.textures.exists('ui_rewards_coins')) {
      const coinIcon = this.add.image(currencyX, currencyY2, 'ui_rewards_coins');
      coinIcon.setDisplaySize(layout.currency.iconSize, layout.currency.iconSize);
      coinIcon.setOrigin(1, 0.5);
      headerContainer.add(coinIcon);
    } else {
      const coinIcon = this.add.text(currencyX, currencyY2, '💰', { fontSize: `${layout.currency.iconSize}px` }).setOrigin(1, 0.5);
      headerContainer.add(coinIcon);
    }

    headerContainer.add([gemText, coinText]);

    // NEW: add debug mastery button (dev-only)
    this.createDebugMasteryButton(headerContainer);
  }

  /**
   * 🔧 DEBUG: Creates a developer-only button to instantly level up faction mastery
   * Only visible in development builds (import.meta.env.DEV)
   */
  private createDebugMasteryButton(headerContainer: Phaser.GameObjects.Container): void {
    // Only show in development builds
    // (Vite convention: import.meta.env.DEV)
    const isDev = (import.meta as any)?.env?.DEV;
    if (!isDev) {
      return;
    }

    const { width } = this.cameras.main;
    const fonts = getFonts();

    const btnWidth = 60;
    const btnHeight = 22;
    const titleY = Math.max(40 + this.topInset, 50 + TEAM_LAYOUT.HEADER.minTopPadding);
    const y = titleY;

    // Position: near the right side of the header, slightly left of the currency
    const x = width - 90;

    const button = this.add.container(x, y);

    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.95);
    bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 10);
    bg.lineStyle(1, this.accentColor, 0.7);
    bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 10);
    button.add(bg);

    const label = this.add.text(0, 0, '+LVL', {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    button.add(label);

    button.setSize(btnWidth, btnHeight);
    button.setInteractive({ useHandCursor: true });

    button
      .on('pointerover', () => {
        this.tweens.add({ targets: button, scaleX: 1.05, scaleY: 1.05, duration: 100 });
      })
      .on('pointerout', () => {
        this.tweens.add({ targets: button, scaleX: 1.0, scaleY: 1.0, duration: 100 });
      })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        AudioManager.getInstance().playUIClick();
        hapticSelection();

        const currentFaction: FactionId = playerData.getFaction() || DEFAULT_FACTION;
        const mastery = playerData.getFactionMastery(currentFaction);
        const nextLevelXP = playerData.getFactionNextLevelXP(currentFaction);

        if (nextLevelXP == null) {
          console.log('[TeamScene][Debug] Faction mastery already at max, no next level');
          return;
        }

        const currentXP = mastery.xp;
        const delta = Math.max(1, nextLevelXP - currentXP + 1); // ensure we cross the threshold

        console.log(
          `[TeamScene][Debug] Level up faction ${currentFaction}: xp ${currentXP} -> ${currentXP + delta}`
        );

        // This will:
        // - update mastery xp and level
        // - unlock new slots via expandTeamToSize if thresholds crossed
        // - save player data
        playerData.addFactionXP(currentFaction, delta);

        // Easiest way to refresh header & squad UI: restart the scene
        this.scene.restart();
      });

    headerContainer.add(button);
  }

  private createContentArea(): void {
    const { width } = this.cameras.main;
    
    this.contentTop = this.headerHeight;
    // ✅ ИСПРАВЛЕНО: Используем helper-функцию для расчета видимой высоты
    const visibleHeight = calculateVisibleContentHeight(this, this.headerHeight);

    const shape = this.make.graphics({});
    shape.fillStyle(0xffffff);
    shape.fillRect(0, this.headerHeight, width, visibleHeight);
    const mask = shape.createGeometryMask();

    this.contentContainer = this.add.container(0, this.headerHeight);
    this.contentContainer.setMask(mask);
    this.contentContainer.setDepth(0);
  }

  private renderContent(): void {
    this.contentContainer.removeAll(true);
    this.cards = [];
    this.contentContainer.y = this.contentTop - this.scrollY;

    let y = 12;

    y = this.renderTacticsCard(y);
    y = this.renderActiveSquad(y + 24);
    // ⚠️ REMOVED: y = this.renderCollection(y + 28); - старая панель коллекций убрана
    y = this.renderInventory(y + 28);
    y = this.renderBallSelector(y + 28);
    y = this.renderReserves(y + 28);

    const visibleHeight = this.cameras.main.height - this.headerHeight - 20 - this.bottomInset;
    this.maxScrollY = Math.max(0, y - visibleHeight + 60);
    this.updateCardPositions();
  }

  private getTacticsFieldTextureKey(): string | undefined {
    const data = playerData.get();

    if (data.equippedFieldSkin) {
      const skin = getFieldSkin(data.equippedFieldSkin);
      const texKey = (skin as any)?.textureKey as string | undefined;
      if (texKey && this.textures.exists(texKey)) return texKey;
    }

    const faction: FactionId = playerData.getFaction() || DEFAULT_FACTION;
    const mapping: Partial<Record<FactionId, string>> = {
      magma: 'field_magma',
      cyborg: 'field_cyborg',
      void: 'field_void',
      insect: 'field_insect',
    };
    const key = mapping[faction];
    return key && this.textures.exists(key) ? key : undefined;
  }

  /**
   * ✅ НОВОЕ: Создает мини-превью поля фракции как в матче
   * Генерирует домашнее поле текущей фракции в уменьшенном виде
   */
  private createMiniFieldPreview(
    container: Phaser.GameObjects.Container,
    centerX: number,
    centerY: number,
    width: number,
    height: number
  ): void {
    const faction: FactionId = playerData.getFaction() || DEFAULT_FACTION;
    const arena = getFactionArena(faction);

    // Фон поля с цветом фракции
    const bg = this.add.graphics();
    bg.fillStyle(arena.ambientColor, 1);
    bg.fillRoundedRect(centerX - width / 2, centerY - height / 2, width, height, 16);
    container.add(bg);

    // Фоновая текстура арены если есть
    if (this.textures.exists(arena.assetKey)) {
      const arenaBg = this.add.image(centerX, centerY, arena.assetKey);
      const scaleX = width / arenaBg.width;
      const scaleY = height / arenaBg.height;
      arenaBg.setScale(Math.max(scaleX, scaleY));
      arenaBg.setAlpha(0.85);
      container.add(arenaBg);
    }

    // Разметка поля (упрощенная версия как в матче)
    const markings = this.add.graphics();
    markings.setDepth(1);
    
    const lineColor = arena.lineColor;
    const lineAlpha = 0.7;
    const lineWidth = 2;

    // Внешний контур
    markings.lineStyle(lineWidth, lineColor, lineAlpha);
    markings.strokeRoundedRect(centerX - width / 2, centerY - height / 2, width, height, 16);

    // Центральная линия
    markings.lineStyle(lineWidth, lineColor, lineAlpha * 0.8);
    markings.lineBetween(centerX - width / 2, centerY, centerX + width / 2, centerY);

    // Центральный круг
    const circleRadius = width * 0.12;
    markings.lineStyle(lineWidth, lineColor, lineAlpha);
    markings.strokeCircle(centerX, centerY, circleRadius);

    // Центральная точка
    markings.fillStyle(lineColor, 1);
    markings.fillCircle(centerX, centerY, 3);

    // Штрафные площади (упрощенные)
    const penaltyWidth = width * 0.55;
    const penaltyHeight = height * 0.16;
    
    // Верхняя штрафная
    markings.lineStyle(lineWidth, lineColor, lineAlpha);
    markings.strokeRect(
      centerX - penaltyWidth / 2,
      centerY - height / 2,
      penaltyWidth,
      penaltyHeight
    );

    // Нижняя штрафная
    markings.strokeRect(
      centerX - penaltyWidth / 2,
      centerY + height / 2 - penaltyHeight,
      penaltyWidth,
      penaltyHeight
    );

    // Вратарские зоны
    const goalAreaWidth = width * 0.28;
    const goalAreaHeight = height * 0.06;
    
    // Верхняя вратарская
    markings.strokeRect(
      centerX - goalAreaWidth / 2,
      centerY - height / 2,
      goalAreaWidth,
      goalAreaHeight
    );

    // Нижняя вратарская
    markings.strokeRect(
      centerX - goalAreaWidth / 2,
      centerY + height / 2 - goalAreaHeight,
      goalAreaWidth,
      goalAreaHeight
    );

    // Врата (упрощенные)
    const goalWidth = width * 0.32;
    const goalHeight = 6;
    markings.lineStyle(2, arena.goalColor, 0.8);
    markings.strokeRect(
      centerX - goalWidth / 2,
      centerY - height / 2 - 2,
      goalWidth,
      goalHeight
    );
    markings.strokeRect(
      centerX - goalWidth / 2,
      centerY + height / 2 - goalHeight + 2,
      goalWidth,
      goalHeight
    );

    // Для киберов добавляем неоновый эффект
    if (faction === 'cyborg') {
      markings.setBlendMode(Phaser.BlendModes.ADD);
    }

    container.add(markings);

    // Легкий оверлей для глубины
    const overlay = this.add.graphics();
    overlay.fillStyle(0x020617, 0.25);
    overlay.fillRoundedRect(centerX - width / 2, centerY - height / 2, width, height, 16);
    container.add(overlay);
  }

  private renderTacticsCard(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const marginX = 16;
    const cardWidth = width - marginX * 2;
    const innerPadding = 16;

    const innerFieldWidth = cardWidth - innerPadding * 2;
    const innerFieldHeight = innerFieldWidth * 1.5;
    const maxFieldHeight = this.cameras.main.height * 0.55;
    const fieldHeight = Math.min(innerFieldHeight, maxFieldHeight);
    const fieldWidth = innerFieldWidth;

    // ✅ ИЗМЕНЕНО: Увеличена высота верхнего блока чтобы фишки формаций не были под полем
    const topBlockHeight = 90;
    const bottomBlockHeight = 60;

    const cardHeight = innerPadding + topBlockHeight + fieldHeight + bottomBlockHeight;
    const panelTop = yCursor;
    const panelBottom = panelTop + cardHeight;

    // ✅ УЛУЧШЕНО: Более профессиональный вид карточки
    const card = this.add.graphics();
    // Основной фон с градиентом
    card.fillStyle(0x020617, 0.98);
    card.fillRoundedRect(marginX, panelTop, cardWidth, cardHeight, 20);
    // Внешняя обводка
    card.lineStyle(1.5, 0xffffff, 0.08);
    card.strokeRoundedRect(marginX, panelTop, cardWidth, cardHeight, 20);
    // Акцентная полоса сверху
    card.fillStyle(this.accentColor, 0.9);
    card.fillRoundedRect(marginX + 20, panelTop + 8, 96, 3, 2);
    // Внутренняя подсветка
    card.lineStyle(1, this.accentColor, 0.15);
    card.strokeRoundedRect(marginX + 2, panelTop + 2, cardWidth - 4, cardHeight - 4, 18);
    this.contentContainer.add(card);

    const titleY = panelTop + innerPadding + 10;
    // ✅ УЛУЧШЕНО: Более выразительный заголовок
    this.contentContainer.add(
      this.add.text(marginX + 24, titleY, 'TACTICS & FIELD', {
        fontFamily: fonts.tech,
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        letterSpacing: 1.5,
      }).setOrigin(0, 0.5)
    );

    // ✅ ИЗМЕНЕНО: Фильтруем формации по текущему размеру команды
    const currentTeamSize = playerData.getAllowedTeamSize();
    const activeFormation = playerData.getSelectedFormation();
    const formations = playerData.getAllFormations(currentTeamSize).filter((f) => !f.isCustom);

    const presetsLabelY = titleY + 24;
    // ✅ УЛУЧШЕНО: Более читаемый подзаголовок
    this.contentContainer.add(
      this.add.text(marginX + 24, presetsLabelY, `FORMATIONS (${currentTeamSize} UNITS)`, {
        fontFamily: fonts.tech,
        fontSize: '11px',
        color: '#cbd5e1',
        letterSpacing: 0.5,
      }).setOrigin(0, 0.5)
    );

    const chipHeight = 26;
    const gap = 8;
    const availableWidth = cardWidth - innerPadding * 2;
    const maxChipsVisible = Math.min(formations.length, 5);
    const chipWidth = Math.min(
      80,
      Math.floor((availableWidth - (maxChipsVisible - 1) * gap) / maxChipsVisible)
    );
    const chipsY = presetsLabelY + 21;
    const totalWidth = formations.length * chipWidth + (formations.length - 1) * gap;
    const startX = marginX + innerPadding + (availableWidth - totalWidth) / 2 + chipWidth / 2;

    formations.forEach((f, i) => {
      const x = startX + i * (chipWidth + gap);
      const isActive = activeFormation.id === f.id;
      const chip = this.add.container(x, chipsY);
      const bg = this.add.graphics();

      const draw = (hover: boolean) => {
        bg.clear();
        if (isActive) {
          bg.fillStyle(this.accentColor, 0.95);
          bg.fillRoundedRect(-chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight, 10);
          bg.lineStyle(2, 0xffffff, 0.85);
          bg.strokeRoundedRect(-chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight, 10);
        } else {
          // ✅ УЛУЧШЕНО: Более светлый фон для лучшей читаемости
          bg.fillStyle(0x1e293b, hover ? 0.98 : 0.95);
          bg.fillRoundedRect(-chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight, 10);
          bg.lineStyle(1.5, 0x64748b, hover ? 1.0 : 0.8);
          bg.strokeRoundedRect(-chipWidth / 2, -chipHeight / 2, chipWidth, chipHeight, 10);
        }
      };
      draw(false);
      chip.add(bg);

      // ✅ УЛУЧШЕНО: Улучшена читаемость текста в фишках
      chip.add(
        this.add.text(0, 0, f.name, {
          fontFamily: fonts.tech,
          fontSize: '10px',
          fontStyle: 'bold',
          color: isActive ? '#ffffff' : '#e2e8f0', // Более светлый цвет для лучшей читаемости
        }).setOrigin(0.5)
      );

      if (!isActive) {
        chip.setSize(chipWidth, chipHeight);
        chip.setInteractive({ useHandCursor: true });
        chip
          .on('pointerover', () => {
            draw(true);
            this.tweens.add({ targets: chip, scaleX: 1.04, scaleY: 1.04, duration: 100 });
          })
          .on('pointerout', () => {
            draw(false);
            this.tweens.add({ targets: chip, scaleX: 1, scaleY: 1, duration: 100 });
          })
          .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            pointer.event?.stopPropagation?.();
            AudioManager.getInstance().playUIClick();
            hapticSelection();
            playerData.selectFormation(f.id);
            playerData.save();
            this.renderContent();
          });
      }

      this.contentContainer.add(chip);
    });

    const fieldTop = panelTop + innerPadding + topBlockHeight;
    const fieldX = this.gameWidth / 2;
    const fieldY = fieldTop + fieldHeight / 2;

    const fieldContainer = this.add.container(0, 0);
    this.contentContainer.add(fieldContainer);

    // ✅ ИЗМЕНЕНО: Генерируем мини-поле фракции как в матче вместо черной области
    this.createMiniFieldPreview(fieldContainer, fieldX, fieldY, fieldWidth, fieldHeight);

    const labelText = activeFormation.isCustom ? 'CUSTOM FORMATION' : 'DRAG UNITS TO CUSTOMIZE';
    this.contentContainer.add(
      this.add.text(fieldX, fieldTop - 10, labelText, {
        fontFamily: fonts.tech,
        fontSize: '11px',
        color: activeFormation.isCustom ? '#facc15' : '#94a3b8',
      }).setOrigin(0.5)
    );

    const teamIds = playerData.getTeamUnits();
    activeFormation.slots.forEach((slot, idx) => {
      const px = fieldX - fieldWidth / 2 + slot.x * fieldWidth;
      const py = fieldY - fieldHeight / 2 + slot.y * fieldHeight;
      const puck = this.createDraggablePuck(px, py, teamIds[idx], idx, fieldWidth);
      this.input.setDraggable(puck);

      puck.on('dragstart', () => {
        this.isDraggingPuck = true;
        puck.setScale(1.1);
        AudioManager.getInstance().playSFX('sfx_click');
      });

      puck.on('drag', (_p: any, dragX: number, dragY: number) => {
        const minX = fieldX - fieldWidth / 2 + 24;
        const maxX = fieldX + fieldWidth / 2 - 24;
        const minY = fieldY + 20;
        const maxY = fieldY + fieldHeight / 2 - 24;

        const clX = Phaser.Math.Clamp(dragX, minX, maxX);
        const clY = Phaser.Math.Clamp(dragY, minY, maxY);
        puck.setPosition(clX, clY);
      });

      puck.on('dragend', () => {
        this.isDraggingPuck = false;
        puck.setScale(1);
        AudioManager.getInstance().playSFX('sfx_swish');
        hapticImpact('light');

        const nx = (puck.x - (fieldX - fieldWidth / 2)) / fieldWidth;
        const ny = (puck.y - (fieldY - fieldHeight / 2)) / fieldHeight;
        this.savePuckPosition(idx, nx, ny);
      });

      fieldContainer.add(puck);
    });

    // ✅ ИЗМЕНЕНО: Кнопка сброса показывает текущую дефолтную формацию
    const defaultFormation = playerData.getAllFormations(currentTeamSize).find(f => !f.isCustom);
    const resetLabel = defaultFormation ? `↻ RESET TO ${defaultFormation.name}` : '↻ RESET';
    
    const resetY = fieldTop + fieldHeight + 26;
    const resetBtn = this.add.container(this.gameWidth / 2, resetY);
    const btnW = 180;
    const btnH = 32;

    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x0f172a, 0.96);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    btnBg.lineStyle(2, this.accentColor, 0.7);
    btnBg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 10);
    resetBtn.add(btnBg);

    resetBtn.add(
      this.add.text(0, 0, resetLabel, {
        fontSize: '11px',
        fontFamily: fonts.tech,
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    resetBtn.setSize(btnW, btnH);
    resetBtn.setInteractive({ useHandCursor: true });
    resetBtn
      .on('pointerover', () => {
        this.tweens.add({ targets: resetBtn, scaleX: 1.04, scaleY: 1.04, duration: 100 });
      })
      .on('pointerout', () => {
        this.tweens.add({ targets: resetBtn, scaleX: 1, scaleY: 1, duration: 100 });
      })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        AudioManager.getInstance().playUIClick();
        hapticSelection();
        if (defaultFormation) {
          playerData.selectFormation(defaultFormation.id);
          playerData.save();
          this.renderContent();
        }
      });

    this.contentContainer.add(resetBtn);

    return panelBottom + 8;
  }

  private createDraggablePuck(
    x: number,
    y: number,
    unitId: string,
    index: number,
    fieldWidth: number
  ): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const unit = getUnit(unitId);
    const color = unit ? getClassColor(unit.capClass) : 0xffffff;

    const r = Math.min(22, fieldWidth * 0.055);

    const glow = this.add.graphics();
    glow.fillStyle(color, 0.28);
    glow.fillCircle(0, 0, r + 5);
    c.add(glow);

    const circle = this.add.circle(0, 0, r, 0x000000);
    circle.setStrokeStyle(2, color);
    c.add(circle);

    if (unit) {
      try {
        // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
        const img = this.add.image(0, 0, unit.assetKey).setDisplaySize(r * 1.75, r * 1.75);
        c.add(img);
        c.add(this.add.text(0, r + 10, getClassIcon(unit.capClass), { fontSize: '12px' }).setOrigin(0.5));
      } catch {
        c.add(this.add.text(0, 0, (index + 1).toString(), { fontSize: `${r * 0.8}px`, color: '#fff' }).setOrigin(0.5));
      }
    } else {
      c.add(this.add.text(0, 0, (index + 1).toString(), { fontSize: `${r * 0.8}px`, color: '#fff' }).setOrigin(0.5));
    }

    c.setSize(r * 2 + 12, r * 2 + 22);
    c.setInteractive({ useHandCursor: true, draggable: true });
    return c;
  }

  // ✅ ИСПРАВЛЕНИЕ: Добавлен teamSize третьим аргументом
  private savePuckPosition(slotIndex: number, x: number, y: number): void {
    const current = playerData.getSelectedFormation();
    const newSlots = current.slots.map((s) => ({ ...s }));
    newSlots[slotIndex].x = x;
    newSlots[slotIndex].y = y;

    if (current.isCustom) {
      playerData.updateCustomFormation(current.id, newSlots);
    } else {
      // ✅ ИСПРАВЛЕНО: Теперь передаем currentSize
      const currentSize = playerData.getAllowedTeamSize();
      const newForm = playerData.createCustomFormation('Custom', newSlots, currentSize);
      playerData.selectFormation(newForm.id);
    }
    playerData.save();
  }

  // ✅ ПОЛНОСТЬЮ ПЕРЕПИСАНО: Рендер активного отряда с 5 слотами (с использованием TEAM_LAYOUT)
  private renderActiveSquad(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const currentFaction = playerData.getFaction() || DEFAULT_FACTION;
    const layout = TEAM_LAYOUT.ACTIVE_SQUAD;

    // Mastery-based team size
    const currentTeamSize = playerData.getAllowedTeamSize(currentFaction);

    // Title on the left
    const titleText = this.add.text(16, yCursor, 'ACTIVE SQUAD', {
      fontFamily: fonts.tech,
      fontSize: `${layout.titleFontSize}px`,
      color: hexToString(TEAM_LAYOUT.COLORS.text.secondary),
    }).setDepth(1);
    this.contentContainer.add(titleText);
    
    // Slots count on the right
    const slotsText = this.add.text(width - 16, yCursor, `${currentTeamSize}/${MAX_TEAM_SLOTS} SLOTS`, {
      fontFamily: fonts.tech,
      fontSize: `${layout.slotsLabelFontSize}px`,
      color: hexToString(TEAM_LAYOUT.COLORS.text.tertiary),
    }).setOrigin(1, 0).setDepth(1);
    this.contentContainer.add(slotsText);

    // NEW: Debug button to boost faction mastery (always visible)
    this.createFactionBoostButton(yCursor, width);
    
    yCursor += layout.titleOffsetY;

    const team = playerData.getTeamUnits(currentFaction);
    
    // ✅ ИЗМЕНЕНО: Используем calculateGridPositions для расчета позиций слотов
    const positions = calculateGridPositions(
      MAX_TEAM_SLOTS,
      MAX_TEAM_SLOTS, // 5 колонок (1 слот на колонку)
      width,
      1, // aspect ratio = 1 (квадрат не используется, но нужен для функции)
      layout.slotPadding,
      layout.slotGap
    );
    
    // Рассчитываем размер слота
    const availableWidth = width - layout.slotPadding * 2;
    const slotWidth = (availableWidth - layout.slotGap * (MAX_TEAM_SLOTS - 1)) / MAX_TEAM_SLOTS;
    const slotHeight = layout.slotHeight;
    
    // ✅ Уменьшаем масштаб если слоты не влезают
    const scale = slotWidth < layout.slotScaleThreshold ? layout.slotScaleFactor : 1;

    positions.forEach((pos, index) => {
      const isLocked = index >= currentTeamSize;
      const isSelected = this.selectedUnitSlot === index && !isLocked;
      const unitId = team[index] || '';

      const slot = this.add.container(pos.x, yCursor + slotHeight / 2);
      slot.setScale(scale);

      const bg = this.add.graphics();
      
      if (isLocked) {
        // ✅ Заблокированный слот
        bg.fillStyle(TEAM_LAYOUT.COLORS.background.card, TEAM_LAYOUT.COLORS.alpha.high);
        bg.fillRoundedRect(
          -slotWidth / 2 + 2,
          -slotHeight / 2,
          slotWidth - 4,
          slotHeight,
          layout.slotBorderRadius
        );
        bg.lineStyle(layout.slotBorderWidth, TEAM_LAYOUT.COLORS.border.light, TEAM_LAYOUT.COLORS.alpha.low);
        bg.strokeRoundedRect(
          -slotWidth / 2 + 2,
          -slotHeight / 2,
          slotWidth - 4,
          slotHeight,
          layout.slotBorderRadius
        );
        slot.add(bg);

        // Иконка замка
        slot.add(
          this.add.text(0, layout.locked.lockIconOffsetY, '🔒', {
            fontSize: `${layout.locked.lockIconSize}px`
          }).setOrigin(0.5)
        );

        // Текст разблокировки
        const unlockLevel = FactionMasteryManager.getSlotUnlockLevel(index);
        slot.add(
          this.add.text(0, layout.locked.levelOffsetY, `Lvl ${unlockLevel}`, {
            fontSize: `${layout.locked.levelFontSize}px`,
            fontFamily: fonts.tech,
            color: hexToString(TEAM_LAYOUT.COLORS.text.tertiary),
          }).setOrigin(0.5)
        );

        // Интерактивность для показа подсказки
        slot.setSize(slotWidth - 4, slotHeight);
        slot.setInteractive({ useHandCursor: true });
        slot.on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation?.();
          hapticSelection();
          this.showLockedSlotToast(index, unlockLevel || 0);
        });

      } else {
        // ✅ Разблокированный слот
        bg.fillStyle(
          isSelected ? this.accentColor : TEAM_LAYOUT.COLORS.background.card,
          TEAM_LAYOUT.COLORS.alpha.high
        );
        bg.fillRoundedRect(
          -slotWidth / 2 + 2,
          -slotHeight / 2,
          slotWidth - 4,
          slotHeight,
          layout.slotBorderRadius
        );
        bg.lineStyle(
          layout.slotBorderWidth,
          isSelected ? TEAM_LAYOUT.COLORS.border.accent : TEAM_LAYOUT.COLORS.border.default,
          TEAM_LAYOUT.COLORS.alpha.solid
        );
        bg.strokeRoundedRect(
          -slotWidth / 2 + 2,
          -slotHeight / 2,
          slotWidth - 4,
          slotHeight,
          layout.slotBorderRadius
        );
        slot.add(bg);

        // ✅ НОВОЕ: Индикатор замены на выбранном слоте
        if (isSelected) {
          const swapIndicator = this.add.text(
            0,
            -slotHeight / 2 + layout.selected.indicatorOffsetY,
            '🔄 ЗАМЕНА',
            {
              fontSize: `${layout.selected.indicatorFontSize}px`,
              fontFamily: fonts.tech,
              color: hexToString(TEAM_LAYOUT.COLORS.state.selected),
              fontStyle: 'bold',
              backgroundColor: hexToString(TEAM_LAYOUT.COLORS.background.card),
              padding: { left: 4, right: 4, top: 2, bottom: 2 },
            }
          ).setOrigin(0.5);
          slot.add(swapIndicator);
          
          // Пульсация индикатора
          this.tweens.add({
            targets: swapIndicator,
            y: -slotHeight / 2 + layout.selected.indicatorOffsetY - layout.selected.pulseDistance,
            duration: layout.selected.pulseDuration,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }

        const unit = getUnit(unitId);
        if (unit) {
          try {
            const unitIcon = layout.unitIcon;
            const glow = this.add.graphics();
            glow.fillStyle(getClassColor(unit.capClass), 0.35);
            glow.fillCircle(0, unitIcon.offsetY, unitIcon.glowRadius);
            slot.add(glow);

            const circle = this.add.circle(0, unitIcon.offsetY, unitIcon.circleRadius, 0x000000);
            circle.setStrokeStyle(unitIcon.circleStrokeWidth, getClassColor(unit.capClass));
            slot.add(circle);

            // ✅ Используем fitImage для правильного масштабирования
            const img = this.add.image(0, unitIcon.offsetY, unit.assetKey);
            fitImage(img, unitIcon.size);
            slot.add(img);

            slot.add(
              this.add.text(0, layout.classIcon.offsetY, getClassIcon(unit.capClass), {
                fontSize: `${layout.classIcon.fontSize}px`,
                color: hexToString(getClassColor(unit.capClass)),
              }).setOrigin(0.5)
            );

            const power = playerData.getUnitPower(unitId);
            slot.add(
              this.add.text(0, layout.power.offsetY, `⚡${power}`, {
                fontSize: `${layout.power.fontSize}px`,
                color: hexToString(layout.power.color),
                fontFamily: fonts.tech,
              }).setOrigin(0.5)
            );
          } catch {
            slot.add(this.add.text(0, 0, '?', { fontSize: '18px', color: '#666' }).setOrigin(0.5));
          }
        } else {
          slot.add(this.add.text(0, 0, '+', { fontSize: '28px', color: hexToString(TEAM_LAYOUT.COLORS.text.tertiary) }).setOrigin(0.5));
        }

        slot.setSize(slotWidth - 4, slotHeight);
        slot.setInteractive({ useHandCursor: true });
        slot.on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation?.();
          AudioManager.getInstance().playUIClick();
          hapticSelection();
          this.selectedUnitSlot = isSelected ? null : index;
          this.renderContent();
        });
      }

      this.contentContainer.add(slot);
    });

    return yCursor + slotHeight + 8;
  }

  // ✅ НОВОЕ: Показ тоста о заблокированном слоте
  private showLockedSlotToast(slotIndex: number, unlockLevel: number): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();

    const toast = this.add.container(width / 2, height / 2);
    toast.setDepth(1000);
    toast.setAlpha(0);
    toast.setScale(0.8);

    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 0.98);
    bg.fillRoundedRect(-140, -50, 280, 100, 16);
    bg.lineStyle(2, this.accentColor, 0.6);
    bg.strokeRoundedRect(-140, -50, 280, 100, 16);
    toast.add(bg);

    toast.add(
      this.add.text(0, -20, '🔒 SLOT LOCKED', {
        fontSize: '16px',
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
    );

    toast.add(
      this.add.text(0, 10, `Reach Mastery Level ${unlockLevel}`, {
        fontSize: '13px',
        fontFamily: fonts.primary,
        color: '#94a3b8',
      }).setOrigin(0.5)
    );

    toast.add(
      this.add.text(0, 30, `to unlock slot ${slotIndex + 1}`, {
        fontSize: '12px',
        fontFamily: fonts.primary,
        color: '#64748b',
      }).setOrigin(0.5)
    );

    this.tweens.add({
      targets: toast,
      alpha: 1,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: toast,
        alpha: 0,
        scale: 0.8,
        duration: 200,
        onComplete: () => toast.destroy(),
      });
    });
  }

  /**
   * Temporary debug button to boost current faction mastery.
   * Placed near ACTIVE SQUAD, always created (even in production/Telegram).
   */
  private createFactionBoostButton(y: number, screenWidth: number): void {
    const fonts = getFonts();

    // Horizontal placement: near the right side, under the slots label
    const btnWidth = 90;
    const btnHeight = 22;
    const x = screenWidth - 16 - btnWidth / 2;
    const yPos = y + 18; // slightly below "ACTIVE SQUAD" row

    const button = this.add.container(x, yPos);
    const bg = this.add.graphics();

    bg.fillStyle(0x1f2937, 0.96);
    bg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 10);
    bg.lineStyle(1, this.accentColor, 0.8);
    bg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 10);
    button.add(bg);

    const label = this.add.text(0, 0, 'BOOST MASTERY', {
      fontSize: '9px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5);
    button.add(label);

    button.setSize(btnWidth, btnHeight);
    button.setInteractive({ useHandCursor: true });

    button
      .on('pointerover', () => {
        this.tweens.add({ targets: button, scaleX: 1.04, scaleY: 1.04, duration: 80 });
      })
      .on('pointerout', () => {
        this.tweens.add({ targets: button, scaleX: 1.0, scaleY: 1.0, duration: 80 });
      })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        // Prevent scroll handler or other global pointer handlers from kicking in
        p.event?.stopPropagation?.();

        AudioManager.getInstance().playUIClick();
        hapticSelection();

        const currentFaction: FactionId = playerData.getFaction() || DEFAULT_FACTION;
        const mastery = playerData.getFactionMastery(currentFaction);
        const nextLevelXP = playerData.getFactionNextLevelXP(currentFaction);

        if (nextLevelXP == null) {
          console.log('[TeamScene][Debug] Faction mastery is already at max for', currentFaction);
          // Optional: show a small toast or ignore
          return;
        }

        const currentXP = mastery.xp;
        // Add enough XP to cross the next threshold
        const delta = Math.max(1, nextLevelXP - currentXP + 1);

        console.log(
          `[TeamScene][Debug] Boosting mastery for ${currentFaction}: ${currentXP} -> ${currentXP + delta}`
        );

        // This updates mastery XP/level, may unlock new slots and auto-expand team,
        // and handles rewards + saving internally.
        playerData.addFactionXP(currentFaction, delta);

        // Refresh the scene so header + active squad + formations reflect changes
        this.scene.restart();
      });

    this.contentContainer.add(button);
  }

  // ==================== COLLECTION SECTION ====================
  // ⚠️ REMOVED: Старая система коллекций убрана
  // Теперь используется CollectionScene (Repository) для просмотра всех 80 юнитов

  /* УДАЛЕНО - renderCollection больше не используется
  private renderCollection(yCursor: number): number {
    ...
  }
  */

  // ⚠️ REMOVED: createCapTile, showCapModal, closeCapModal, showToast, createButton
  // Старая система мистических фишек полностью удалена
  // Теперь используется CollectionScene для просмотра всех 80 уникальных юнитов
  
  /*
  private createCapTile(x: number, y: number, w: number, h: number, cap: MysticCapData): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const factionColor = FACTIONS[cap.factionId].color;
    const isOwned = playerData.ownsCapSkin(cap.id);
    const fragments = playerData.getCapFragments(cap.id);
    const canCraft = playerData.canCraftCap(cap.id);
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 1);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 12);
    bg.lineStyle(2, canCraft ? 0x22c55e : (isOwned ? factionColor : 0x334155), 1);
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 12);
    container.add(bg);

    if (this.textures.exists(cap.assetKey128)) {
        const img = this.add.image(0, -15, cap.assetKey128).setDisplaySize(60, 60);
        if (!isOwned) img.setAlpha(0.5).setTint(0x888888);
        container.add(img);
    }
    const statusText = isOwned ? 'OWNED' : `${fragments}/${cap.requiredFragments}`;
    const statusColor = isOwned ? '#22c55e' : (canCraft ? '#22c55e' : '#94a3b8');
    container.add(this.add.text(0, 30, statusText, { fontSize: '12px', fontFamily: getFonts().tech, color: statusColor, fontStyle: 'bold' }).setOrigin(0.5));
    if (canCraft && !isOwned) {
        container.add(this.add.text(0, 45, 'READY!', { fontSize: '10px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5));
    }

    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.x > SWIPE_EDGE_ZONE) {
            AudioManager.getInstance().playUIClick();
            this.showCapModal(cap);
        }
    });
    return container;
  }

  // === MODAL FIX: Proper Z-Ordering & Interactivity ===
  private showCapModal(cap: MysticCapData): void {
    if (this.capModalOverlay) this.closeCapModal();
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    const isOwned = playerData.ownsCapSkin(cap.id);
    const canCraft = playerData.canCraftCap(cap.id);
    const currentFaction = playerData.getFaction();
    const isCorrectFaction = currentFaction === cap.factionId;
    const isEquipped = playerData.getEquippedCapSkinForFaction(cap.factionId) === cap.id;

    const overlay = this.add.container(0, 0).setDepth(200);
    this.capModalOverlay = overlay;

    // Dark Background
    const darkBg = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.85);
    darkBg.setInteractive();
    darkBg.on('pointerdown', () => this.closeCapModal());
    overlay.add(darkBg);

    // Modal Container
    const modalWidth = width - 40;
    const modalHeight = height * 0.65;
    const modal = this.add.container(width/2, height/2);
    overlay.add(modal);

    // Modal Graphics
    const modalBg = this.add.graphics();
    modalBg.fillStyle(0x0f172a, 1);
    modalBg.fillRoundedRect(-modalWidth/2, -modalHeight/2, modalWidth, modalHeight, 20);
    modalBg.lineStyle(2, FACTIONS[cap.factionId].color, 1);
    modalBg.strokeRoundedRect(-modalWidth/2, -modalHeight/2, modalWidth, modalHeight, 20);
    modal.add(modalBg);

    // Hit Blocker
    const hitBlocker = this.add.rectangle(0, 0, modalWidth, modalHeight, 0x000000, 0);
    hitBlocker.setInteractive(); 
    modal.add(hitBlocker);

    // Content
    if (this.textures.exists(cap.assetKey512)) {
        modal.add(this.add.image(0, -80, cap.assetKey512).setDisplaySize(160, 160));
    }
    // Localization Update: using .name and .description
    modal.add(this.add.text(0, 20, getDisplayName(cap).toUpperCase(), { 
        fontFamily: fonts.tech, fontSize: '20px', color: '#ffffff', fontStyle: 'bold' 
    }).setOrigin(0.5));
    
    modal.add(this.add.text(0, 50, cap.description, { 
        fontFamily: fonts.primary, fontSize: '12px', color: '#94a3b8', 
        align: 'center', wordWrap: { width: modalWidth - 40 } 
    }).setOrigin(0.5));

    // Close Button
    const closeBtn = this.add.text(modalWidth/2 - 20, -modalHeight/2 + 20, '✕', { 
        fontSize: '24px', color: '#ffffff' 
    }).setOrigin(0.5).setInteractive();
    
    closeBtn.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        this.closeCapModal();
    });
    modal.add(closeBtn);

    // Smart Action Buttons
    const btnY = modalHeight/2 - 40;
    
    if (canCraft && !isOwned) {
        // CASE 1: Craft
        const craftBtn = this.createButton(0, btnY, 200, 44, `CRAFT (${cap.requiredFragments})`, () => {
            if (playerData.craftCap(cap.id)) {
                AudioManager.getInstance().playSFX('sfx_pack_open');
                hapticImpact('medium');
                this.closeCapModal();
                this.renderContent();
            }
        }, 0x22c55e);
        modal.add(craftBtn);

    } else if (isOwned) {
        if (!isCorrectFaction) {
            // CASE 2: Owned, but Wrong Faction -> Auto-Switch
            const factionName = FACTIONS[cap.factionId].name.toUpperCase();
            const switchBtn = this.createButton(0, btnY, 260, 44, `SWITCH TO ${factionName}`, () => {
                if (playerData.switchFaction(cap.factionId)) {
                    // Auto-equip and restart scene
                    playerData.equipCapSkinForFaction(cap.factionId, cap.id);
                    AudioManager.getInstance().playUIClick();
                    hapticImpact('medium');
                    this.closeCapModal();
                    this.scene.restart(); 
                } else {
                    this.showToast(`Unlock ${factionName} first!`);
                }
            }, 0xffa500); // Orange warning color
            modal.add(switchBtn);

        } else if (!isEquipped) {
            // CASE 3: Owned, Correct Faction, Not Equipped -> Equip
            const equipBtn = this.createButton(0, btnY, 200, 44, 'EQUIP SKIN', () => {
                playerData.equipCapSkinForFaction(cap.factionId, cap.id);
                AudioManager.getInstance().playSFX('sfx_equip');
                this.closeCapModal();
                this.renderContent();
            }, 0x3b82f6); // Blue
            modal.add(equipBtn);

        } else {
            // CASE 4: Already Equipped
            modal.add(this.add.text(0, btnY, '✓ EQUIPPED', { 
                fontSize: '14px', color: '#22c55e', fontStyle: 'bold' 
            }).setOrigin(0.5));
        }

    } else {
        // CASE 5: Not enough fragments
        modal.add(this.add.text(0, btnY, `NEED ${cap.requiredFragments} FRAGMENTS`, { 
            fontSize: '12px', color: '#94a3b8' 
        }).setOrigin(0.5));
    }

    // Animation
    modal.setScale(0.8).setAlpha(0);
    this.tweens.add({ targets: modal, scaleX: 1, scaleY: 1, alpha: 1, duration: 200, ease: 'Back.out' });
  }

  private closeCapModal(): void {
    if (!this.capModalOverlay) return;

    AudioManager.getInstance().playUIClick();

    this.tweens.add({
      targets: this.capModalOverlay,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.capModalOverlay?.destroy();
        this.capModalOverlay = null;
      },
    });
  }

  private showToast(message: string): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();

    const toast = this.add.container(width / 2, height - 100 - this.bottomInset);
    toast.setDepth(300);

    const bg = this.add.graphics();
    bg.fillStyle(0x020617, 0.95);
    bg.fillRoundedRect(-120, -20, 240, 40, 20);
    bg.lineStyle(2, 0x22c55e, 0.8);
    bg.strokeRoundedRect(-120, -20, 240, 40, 20);
    toast.add(bg);

    toast.add(
      this.add.text(0, 0, message, {
        fontFamily: fonts.tech,
        fontSize: '12px',
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    toast.setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      y: toast.y - 10,
      duration: 200,
      yoyo: false,
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            y: toast.y + 10,
            duration: 200,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }

  private createButton(x: number, y: number, w: number, h: number, text: string, cb: () => void, color: number): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 10);
    btn.add(bg);
    btn.add(this.add.text(0, 0, text, { fontSize: '14px', fontFamily: getFonts().tech, color: '#000000', fontStyle: 'bold' }).setOrigin(0.5));
    btn.setSize(w, h);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation(); // Stops click from reaching hitBlocker
        AudioManager.getInstance().playUIClick();
        cb();
    });
    return btn;
  }
  */
  
  private renderBallSelector(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    this.contentContainer.add(
      this.add.text(16, yCursor, 'BALLS', {
        fontFamily: fonts.tech,
        fontSize: '13px',
        color: '#94a3b8',
      }).setDepth(1)
    );
    yCursor += 26;

    const ownedBalls = BALL_SKINS.filter((ball) => playerData.ownsBallSkin(ball.id));
    const allData = playerData.get();
    const equippedId = allData.equippedBallSkin;

    if (!ownedBalls.length && equippedId) {
      const skin = getBallSkin(equippedId);
      if (skin) ownedBalls.push(skin);
    }

    if (!ownedBalls.length) {
      this.contentContainer.add(
        this.add.text(width / 2, yCursor + 12, 'No balls owned yet. Visit the shop!', {
          fontFamily: fonts.primary,
          fontSize: '11px',
          color: '#64748b',
        }).setOrigin(0.5)
      );
      return yCursor + 40;
    }

    const scroll = this.add.container(0, 0);
    this.contentContainer.add(scroll);

    const cardH = 76;
    const spacing = 10;
    let xCursor = 16;

    ownedBalls.forEach((skin) => {
      const cardW = 150;
      const cx = xCursor + cardW / 2;
      const cy = yCursor + cardH / 2;
      const isEquipped = skin.id === equippedId;

      const card = this.add.container(cx, cy);

      const bg = this.add.graphics();
      bg.fillStyle(0x020617, 0.96);
      bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      bg.lineStyle(2, isEquipped ? this.accentColor : 0x1f2937, 0.9);
      bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 16);
      card.add(bg);

      if (skin.textureKey && this.textures.exists(skin.textureKey)) {
        const img = this.add.image(-cardW / 2 + 30, 0, skin.textureKey);
        img.setDisplaySize(34, 34);
        card.add(img);
      } else {
        card.add(this.add.text(-cardW / 2 + 30, 0, '⚽', { fontSize: '20px' }).setOrigin(0.5));
      }

      card.add(
        this.add.text(-cardW / 2 + 58, -10, skin.name, {
          fontFamily: fonts.primary,
          fontSize: '11px',
          color: '#ffffff',
        }).setOrigin(0, 0.5)
      );

      const status = isEquipped ? '✓ EQUIPPED' : 'TAP TO EQUIP';
      const statusColor = isEquipped ? '#22c55e' : '#64748b';
      card.add(
        this.add.text(-cardW / 2 + 58, 12, status, {
          fontFamily: fonts.tech,
          fontSize: '9px',
          color: statusColor,
        }).setOrigin(0, 0.5)
      );

      card.setSize(cardW, cardH);
      card.setInteractive({ useHandCursor: true });
      card
        .on('pointerover', () => {
          this.tweens.add({ targets: card, scaleX: 1.03, scaleY: 1.03, duration: 80 });
        })
        .on('pointerout', () => {
          this.tweens.add({ targets: card, scaleX: 1, scaleY: 1, duration: 80 });
        })
        .on('pointerdown', (p: Phaser.Input.Pointer) => {
          p.event?.stopPropagation?.();
          AudioManager.getInstance().playUIClick();
          hapticSelection();
          playerData.equipBallSkin(skin.id);
          playerData.save();
          this.renderContent();
        });

      scroll.add(card);
      xCursor += cardW + spacing;
    });

    return yCursor + cardH + 6;
  }

  private renderReserves(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const layout = TEAM_LAYOUT.RESERVES;

    const currentFaction: FactionId = playerData.getFaction() || DEFAULT_FACTION;

    const isEquipping = this.selectedUnitSlot !== null;
    
    // ✅ УЛУЧШЕНО: Более информативный заголовок с иконкой
    const titleContainer = this.add.container(layout.cardPadding, yCursor);
    
    if (isEquipping) {
      // Анимированная подсказка о замене
      const swapIcon = this.add.text(0, 0, '🔄', {
        fontSize: '16px',
      }).setOrigin(0, 0);
      titleContainer.add(swapIcon);
      
      // Пульсация иконки
      this.tweens.add({
        targets: swapIcon,
        scale: { from: 1, to: 1.2 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      
      titleContainer.add(
        this.add.text(24, 0, 'ВЫБЕРИТЕ ФИШКУ ДЛЯ ЗАМЕНЫ', {
          fontFamily: fonts.tech,
          fontSize: `${layout.titleFontSize}px`,
          color: hexToString(TEAM_LAYOUT.COLORS.state.selected),
          fontStyle: 'bold',
        }).setOrigin(0, 0)
      );
    } else {
      titleContainer.add(
        this.add.text(0, 0, 'РЕЗЕРВЫ', {
          fontFamily: fonts.tech,
          fontSize: `${layout.titleFontSize}px`,
          color: hexToString(TEAM_LAYOUT.COLORS.text.secondary),
        }).setOrigin(0, 0)
      );
    }
    
    this.contentContainer.add(titleContainer);
    yCursor += layout.titleOffsetY;

    const ownedUnits = playerData.getOwnedUnits(currentFaction);
    const teamUnits = playerData.getTeamUnits(currentFaction);

    // ✅ ИСПРАВЛЕНО: Используем calculateGridPositions для сетки резервов
    const positions = calculateGridPositions(
      ownedUnits.length,
      layout.cols,
      width,
      1, // aspect ratio = 1 (квадрат)
      layout.cardPadding,
      layout.cardGap
    );
    
    ownedUnits.forEach((owned, index) => {
      const unit = getUnit(owned.id);
      if (!unit) return;

      // Подсчитываем сколько раз этот юнит используется в команде
      const usageCount = teamUnits.filter(id => id === unit.id).length;

      const pos = positions[index];
      const cardX = pos.x;
      const cardY = yCursor + pos.y;
      
      const card = this.createCompactReserveCard(cardX, cardY, unit, layout.cardSize, usageCount);

      // ✅ Подсветка при режиме замены
      if (isEquipping) {
        const highlightGlow = this.add.graphics();
        highlightGlow.lineStyle(
          layout.highlight.strokeWidth,
          TEAM_LAYOUT.COLORS.state.selected,
          layout.highlight.alpha.max
        );
        highlightGlow.strokeRoundedRect(
          -layout.cardSize / 2,
          -layout.cardSize / 2,
          layout.cardSize,
          layout.cardSize,
          layout.cardBorderRadius
        );
        card.addAt(highlightGlow, 0);
        
        // Пульсация подсветки
        this.tweens.add({
          targets: highlightGlow,
          alpha: { from: layout.highlight.alpha.min, to: layout.highlight.alpha.max },
          duration: layout.highlight.pulseDuration,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }

      card.setSize(layout.cardSize, layout.cardSize);
      card.setInteractive({ useHandCursor: true });

      card.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event?.stopPropagation?.();
        if (this.selectedUnitSlot !== null) {
          // Режим замены - разрешаем дубликаты
          const audio = AudioManager.getInstance();
          audio.playUIClick();
          audio.playSFX('sfx_equip');
          hapticImpact('medium');

          playerData.setTeamUnit(this.selectedUnitSlot!, unit.id);
          playerData.save();
          this.selectedUnitSlot = null;
          this.renderContent();
        } else {
          // Обычный клик - просто звук
          AudioManager.getInstance().playUIClick();
          hapticSelection();
        }
      });

      this.contentContainer.add(card);
      this.cards.push({ container: card, y: cardY, height: layout.cardSize });
    });

    // Вычисляем финальную позицию курсора
    const totalRows = Math.ceil(ownedUnits.length / layout.cols);
    yCursor += totalRows * (layout.cardSize + layout.cardGap);

    return yCursor + 10;
  }

  /**
   * ✅ НОВОЕ: Создает компактную карточку для резервов (как фишки в составе)
   * Использует константы из TEAM_LAYOUT и helper-функции
   */
  private createCompactReserveCard(
    x: number, 
    y: number, 
    unit: UnitData, 
    size: number, 
    usageCount: number
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const layout = TEAM_LAYOUT.RESERVES;
    const c = this.add.container(x, y);
    
    const classColor = getClassColor(unit.capClass);
    
    // Тень
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, TEAM_LAYOUT.COLORS.alpha.veryLow);
    shadow.fillRoundedRect(-size / 2 + 2, -size / 2 + 2, size, size, layout.cardBorderRadius);
    c.add(shadow);
    
    // Основной фон
    const bg = this.add.graphics();
    bg.fillStyle(TEAM_LAYOUT.COLORS.background.card, TEAM_LAYOUT.COLORS.alpha.high);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, layout.cardBorderRadius);
    c.add(bg);
    
    // Градиентная подсветка сверху
    const gradient = this.add.graphics();
    gradient.fillStyle(classColor, 0.15);
    gradient.fillRoundedRect(
      -size / 2,
      -size / 2,
      size,
      size * 0.4,
      { tl: layout.cardBorderRadius, tr: layout.cardBorderRadius, bl: 0, br: 0 } as any
    );
    c.add(gradient);
    
    // Обводка
    const border = this.add.graphics();
    border.lineStyle(layout.cardBorderWidth, classColor, 0.6);
    border.strokeRoundedRect(-size / 2, -size / 2, size, size, layout.cardBorderRadius);
    c.add(border);
    
    // Иконка юнита
    const iconSize = size * layout.unitIcon.sizeRatio;
    try {
      const img = this.add.image(0, layout.unitIcon.offsetY, unit.assetKey);
      // ✅ Используем fitImage для правильного масштабирования
      fitImage(img, iconSize);
      c.add(img);
    } catch {
      c.add(this.add.text(0, layout.unitIcon.offsetY, '?', { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5));
    }
    
    // Название юнита (с автоматической подгонкой размера шрифта)
    const displayName = getDisplayName(unit);
    const nameTextObj = this.add.text(0, size / 2 + layout.unitName.offsetY, displayName, {
      fontSize: `${layout.unitName.fontSize}px`,
      fontFamily: fonts.primary,
      color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // ✅ Используем fitText для автоматической подгонки длинных имен
    const maxNameWidth = size - 8; // Отступы по 4px с каждой стороны
    fitText(nameTextObj, maxNameWidth);
    
    // Если имя все еще не влезло, обрезаем его
    if (nameTextObj.width > maxNameWidth) {
      const truncated = displayName.length > layout.unitName.maxLength
        ? displayName.substring(0, layout.unitName.maxLength) + layout.unitName.ellipsis
        : displayName;
      nameTextObj.setText(truncated);
    }
    
    c.add(nameTextObj);
    
    // Иконка класса
    c.add(
      this.add.text(0, size / 2 + layout.classIcon.offsetY, getClassIcon(unit.capClass), {
        fontSize: `${layout.classIcon.fontSize}px`,
      }).setOrigin(0.5)
    );
    
    // ✅ Счетчик использования (если юнит используется в команде)
    if (usageCount > 0) {
      const badge = layout.usageBadge;
      const badgeX = size / 2 - badge.size / 2 - badge.offsetX;
      const badgeY = -size / 2 + badge.size / 2 + badge.offsetY;
      
      const badgeBg = this.add.graphics();
      badgeBg.fillStyle(this.accentColor, TEAM_LAYOUT.COLORS.alpha.medium);
      badgeBg.fillCircle(badgeX, badgeY, badge.size / 2);
      badgeBg.lineStyle(2, TEAM_LAYOUT.COLORS.border.accent, TEAM_LAYOUT.COLORS.alpha.solid);
      badgeBg.strokeCircle(badgeX, badgeY, badge.size / 2);
      c.add(badgeBg);
      
      c.add(
        this.add.text(badgeX, badgeY, `x${usageCount}`, {
          fontSize: `${badge.fontSize}px`,
          fontFamily: fonts.tech,
          color: hexToString(TEAM_LAYOUT.COLORS.text.primary),
          fontStyle: 'bold',
        }).setOrigin(0.5)
      );
    }
    
    return c;
  }

  /**
   * ✅ НОВОЕ: Отображение инвентаря игрока (карточки, ключи, билеты)
   */
  private renderInventory(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    // Заголовок секции
    this.contentContainer.add(
      this.add.text(16, yCursor, 'ИНВЕНТАРЬ', {
        fontFamily: fonts.tech,
        fontSize: '13px',
        color: '#94a3b8',
      }).setDepth(1)
    );
    yCursor += 26;

    const data = playerData.get();
    const inventory = playerData.getCardInventory();
    const currentFaction = playerData.getFaction() || DEFAULT_FACTION;

    // Получаем все карточки текущей фракции
    const allCardIds = Object.keys(CARDS_CATALOG);
    const factionCards: { card: CardDefinition; count: number }[] = [];
    
    allCardIds.forEach(cardId => {
      const card = CARDS_CATALOG[cardId];
      if (card.factionId === currentFaction) {
        const count = inventory[cardId] || 0;
        factionCards.push({ card, count });
      }
    });

    // Отображаем карточки в сетке 2 колонки
    const padding = 16;
    const gap = 10;
    const cardHeight = 85;
    const cardWidth = (width - padding * 2 - gap) / 2;
    
    let col = 0;
    let row = 0;

    factionCards.forEach(({ card, count }) => {
      const cardX = padding + (cardWidth + gap) * col;
      const cardY = yCursor + (cardHeight + gap) * row;
      
      const cardContainer = this.createInventoryCardItem(cardX, cardY, cardWidth, cardHeight, card, count);
      this.contentContainer.add(cardContainer);
      this.cards.push({ container: cardContainer, y: cardY, height: cardHeight });

      col++;
      if (col >= 2) {
        col = 0;
        row++;
      }
    });

    // Переходим к следующей строке после карточек
    if (col > 0) row++;
    yCursor += row * (cardHeight + gap) + 10;

    // Секция ключей и билетов
    yCursor = this.renderKeysAndTickets(yCursor + 12);

    return yCursor;
  }

  /**
   * ✅ НОВОЕ: Отображение карточки инвентаря (способности)
   */
  private createInventoryCardItem(
    x: number,
    y: number,
    w: number,
    h: number,
    card: CardDefinition,
    count: number
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const rarityColors: Record<CardRarity, number> = {
      common: 0x6b7280,
      rare: 0x3b82f6,
      epic: 0x8b5cf6,
    };

    const rarityColor = rarityColors[card.rarity];
    const hasCards = count > 0;

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f1a, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(2, hasCards ? rarityColor : 0x334155, hasCards ? 0.7 : 0.4);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    // Цветная полоса слева
    const leftBar = this.add.graphics();
    leftBar.fillStyle(rarityColor, hasCards ? 0.9 : 0.4);
    leftBar.fillRoundedRect(0, 0, 4, h, { tl: 12, bl: 12, tr: 0, br: 0 } as any);
    container.add(leftBar);

    // Иконка карточки
    const iconX = 30;
    const iconY = h / 2;
    const iconKey = `card_${card.id}`;

    // Свечение для редких карт
    if (hasCards && card.rarity !== 'common') {
      const glow = this.add.circle(iconX, iconY, 24, rarityColor, 0.25);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
    }

    // PNG иконка карточки
    if (this.textures.exists(iconKey)) {
      const img = this.add.image(iconX, iconY, iconKey)
        .setDisplaySize(42, 42)
        .setAlpha(hasCards ? 1 : 0.5);
      container.add(img);
    } else {
      // Fallback - круг с иконкой
      const iconBg = this.add.graphics();
      iconBg.fillStyle(rarityColor, hasCards ? 0.4 : 0.2);
      iconBg.fillCircle(iconX, iconY, 20);
      container.add(iconBg);
      
      container.add(this.add.text(iconX, iconY, '✦', {
        fontSize: '16px',
        color: hasCards ? '#ffffff' : '#555555',
      }).setOrigin(0.5).setAlpha(hasCards ? 1 : 0.5));
    }

    // Текст справа от иконки
    const textX = 58;

    // Название (на русском)
    const nameText = this.add.text(textX, 12, this.getCardNameRu(card.id), {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: hasCards ? '#ffffff' : '#64748b',
      fontStyle: 'bold',
    });
    nameText.setResolution(2);
    container.add(nameText);

    // Описание (на русском, сокращенное)
    const descText = this.add.text(textX, 28, this.getCardDescriptionRu(card.id), {
      fontSize: '8px',
      color: hasCards ? '#a8b3c1' : '#4a5568',
      wordWrap: { width: w - textX - 45 },
    });
    descText.setResolution(2);
    container.add(descText);

    // Редкость внизу
    const rarityText = this.getRarityNameRu(card.rarity);
    container.add(this.add.text(textX, h - 14, rarityText, {
      fontSize: '8px',
      fontFamily: fonts.tech,
      color: hexToString(rarityColor),
    }));

    // Счетчик количества
    const countX = w - 25;
    const countBg = this.add.graphics();
    countBg.fillStyle(hasCards ? 0x22c55e : 0x1f2937, hasCards ? 0.3 : 0.5);
    countBg.fillRoundedRect(countX - 18, h / 2 - 14, 36, 28, 8);
    container.add(countBg);

    const countText = this.add.text(countX, h / 2, `×${count}`, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hasCards ? '#22c55e' : '#64748b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    countText.setResolution(2);
    container.add(countText);

    // Затемнение если нет карт
    if (!hasCards) {
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.4);
      overlay.fillRoundedRect(0, 0, w, h, 12);
      container.add(overlay);
    }

    return container;
  }

  /**
   * ✅ НОВОЕ: Отображение ключей и билетов
   */
  private renderKeysAndTickets(yCursor: number): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();

    const data = playerData.get();
    const keyFragments = data.tournamentState?.keyFragments || 0;
    const hasTicket = data.tournamentState?.hasTicket || false;

    // Заголовок
    this.contentContainer.add(
      this.add.text(16, yCursor, 'ТУРНИРЫ', {
        fontFamily: fonts.tech,
        fontSize: '13px',
        color: '#94a3b8',
      }).setDepth(1)
    );
    yCursor += 26;

    const padding = 16;
    const cardHeight = 75;
    const cardWidth = width - padding * 2;

    // Карточка с ключами
    const keysCard = this.createKeyFragmentsCard(padding, yCursor, cardWidth, cardHeight, keyFragments);
    this.contentContainer.add(keysCard);
    this.cards.push({ container: keysCard, y: yCursor, height: cardHeight });
    yCursor += cardHeight + 10;

    // Карточка с билетом
    const ticketCard = this.createTournamentTicketCard(padding, yCursor, cardWidth, cardHeight, hasTicket);
    this.contentContainer.add(ticketCard);
    this.cards.push({ container: ticketCard, y: yCursor, height: cardHeight });
    yCursor += cardHeight + 10;

    return yCursor;
  }

  /**
   * ✅ НОВОЕ: Карточка с фрагментами ключей
   */
  private createKeyFragmentsCard(
    x: number,
    y: number,
    w: number,
    h: number,
    count: number
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const hasFragments = count > 0;
    const keyColor = 0x00d4ff;

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f1a, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(2, hasFragments ? keyColor : 0x334155, hasFragments ? 0.7 : 0.4);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    // Цветная полоса слева
    const leftBar = this.add.graphics();
    leftBar.fillStyle(keyColor, hasFragments ? 0.9 : 0.4);
    leftBar.fillRoundedRect(0, 0, 4, h, { tl: 12, bl: 12, tr: 0, br: 0 } as any);
    container.add(leftBar);

    // Иконка
    const iconX = 40;
    const iconY = h / 2;

    if (hasFragments) {
      const glow = this.add.circle(iconX, iconY, 28, keyColor, 0.25);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
    }

    // PNG иконка ключа
    if (this.textures.exists(TOURNAMENT_KEY_KEYS.FULL)) {
      const img = this.add.image(iconX, iconY, TOURNAMENT_KEY_KEYS.FULL)
        .setDisplaySize(48, 48)
        .setAlpha(hasFragments ? 1 : 0.5);
      container.add(img);
    } else {
      // ✅ Fallback с видимым фоном
      const fallbackBg = this.add.circle(iconX, iconY, 24, 0x00d4ff, 0.3);
      fallbackBg.setStrokeStyle(2, 0x00d4ff);
      container.add(fallbackBg);
      container.add(this.add.text(iconX, iconY, '🔑', {
        fontSize: '24px',
      }).setOrigin(0.5).setAlpha(hasFragments ? 1 : 0.5));
    }

    // Текст
    const textX = 80;

    container.add(this.add.text(textX, 18, 'ФРАГМЕНТЫ КЛЮЧА', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hasFragments ? '#ffffff' : '#64748b',
      fontStyle: 'bold',
    }));

    container.add(this.add.text(textX, 38, 'Соберите 3 фрагмента для доступа к турниру', {
      fontSize: '9px',
      color: hasFragments ? '#a8b3c1' : '#4a5568',
      wordWrap: { width: w - textX - 80 },
    }));

    // Прогресс
    const progressX = textX;
    const progressY = h - 18;
    const progressWidth = w - textX - 80;
    const progressHeight = 6;

    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x1f2937, 1);
    progressBg.fillRoundedRect(progressX, progressY - progressHeight / 2, progressWidth, progressHeight, 3);
    container.add(progressBg);

    if (count > 0) {
      const progressFill = this.add.graphics();
      progressFill.fillStyle(keyColor, 1);
      const fillWidth = (progressWidth * Math.min(count, 3)) / 3;
      progressFill.fillRoundedRect(progressX, progressY - progressHeight / 2, fillWidth, progressHeight, 3);
      container.add(progressFill);
    }

    // Счетчик
    const countX = w - 30;
    const countBg = this.add.graphics();
    countBg.fillStyle(hasFragments ? keyColor : 0x1f2937, hasFragments ? 0.3 : 0.5);
    countBg.fillRoundedRect(countX - 22, h / 2 - 16, 44, 32, 8);
    container.add(countBg);

    const countText = this.add.text(countX, h / 2, `${count}/3`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hasFragments ? '#ffffff' : '#64748b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(countText);

    return container;
  }

  /**
   * ✅ НОВОЕ: Карточка с билетом на турнир
   */
  private createTournamentTicketCard(
    x: number,
    y: number,
    w: number,
    h: number,
    hasTicket: boolean
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const ticketColor = 0xffd700;

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f1a, 0.98);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(2, hasTicket ? ticketColor : 0x334155, hasTicket ? 0.7 : 0.4);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    // Цветная полоса слева
    const leftBar = this.add.graphics();
    leftBar.fillStyle(ticketColor, hasTicket ? 0.9 : 0.4);
    leftBar.fillRoundedRect(0, 0, 4, h, { tl: 12, bl: 12, tr: 0, br: 0 } as any);
    container.add(leftBar);

    // Иконка
    const iconX = 40;
    const iconY = h / 2;

    if (hasTicket) {
      const glow = this.add.circle(iconX, iconY, 28, ticketColor, 0.25);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);
    }

    // PNG иконка билета
    if (this.textures.exists(TOURNAMENT_KEY_KEYS.TICKET)) {
      const img = this.add.image(iconX, iconY, TOURNAMENT_KEY_KEYS.TICKET)
        .setDisplaySize(64, 32)  // ✅ Соотношение 2:1 для билета
        .setAlpha(hasTicket ? 1 : 0.5);
      container.add(img);
    } else {
      // ✅ Fallback с видимым фоном
      const fallbackBg = this.add.rectangle(iconX, iconY, 64, 32, 0xffd700, 0.3);
      fallbackBg.setStrokeStyle(2, 0xffd700);
      container.add(fallbackBg);
      container.add(this.add.text(iconX, iconY, '🎫', {
        fontSize: '20px',
      }).setOrigin(0.5).setAlpha(hasTicket ? 1 : 0.5));
    }

    // Текст
    const textX = 80;

    container.add(this.add.text(textX, 20, 'БИЛЕТ НА ТУРНИР', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: hasTicket ? '#ffffff' : '#64748b',
      fontStyle: 'bold',
    }));

    container.add(this.add.text(textX, 40, 'Прямой доступ к любому турниру (одноразовый)', {
      fontSize: '9px',
      color: hasTicket ? '#a8b3c1' : '#4a5568',
      wordWrap: { width: w - textX - 80 },
    }));

    // Статус
    const statusX = w - 30;
    const statusBg = this.add.graphics();
    statusBg.fillStyle(hasTicket ? 0x22c55e : 0x1f2937, hasTicket ? 0.3 : 0.5);
    statusBg.fillRoundedRect(statusX - 22, h / 2 - 16, 44, 32, 8);
    container.add(statusBg);

    const statusText = this.add.text(statusX, h / 2, hasTicket ? '✓' : '✕', {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: hasTicket ? '#22c55e' : '#64748b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(statusText);

    return container;
  }

  /**
   * ✅ НОВОЕ: Русские названия карточек
   */
  private getCardNameRu(cardId: string): string {
    const names: Record<string, string> = {
      'magma_lava': 'Лавовая лужа',
      'magma_molten': 'Расплавленный мяч',
      'magma_meteor': 'Метеоритный удар',
      'cyborg_shield': 'Энергощит',
      'cyborg_tether': 'Магнитная связь',
      'cyborg_barrier': 'Фотонный барьер',
      'void_swap': 'Фазовый обмен',
      'void_ghost': 'Призрак',
      'void_wormhole': 'Червоточина',
      'insect_toxin': 'Токсин',
      'insect_parasite': 'Паразит',
      'insect_mimic': 'Мимикрия',
    };
    return names[cardId] || CARDS_CATALOG[cardId]?.name || 'Неизвестная карта';
  }

  /**
   * ✅ НОВОЕ: Русские описания карточек
   */
  private getCardDescriptionRu(cardId: string): string {
    const descriptions: Record<string, string> = {
      'magma_lava': 'Создает замедляющую зону',
      'magma_molten': 'Мяч оглушает врагов при касании',
      'magma_meteor': 'Взрыв в точке удара',
      'cyborg_shield': 'Защитный барьер отражает мяч',
      'cyborg_tether': 'Магнитная связь с мячом',
      'cyborg_barrier': 'Отражающая стена',
      'void_swap': 'Меняет позиции двух юнитов',
      'void_ghost': 'Юнит проходит сквозь врагов',
      'void_wormhole': 'Телепорт мяча',
      'insect_toxin': 'Отравляет врага',
      'insect_parasite': 'Контролирует вражеского юнита',
      'insect_mimic': 'Копирует способность врага',
    };
    return descriptions[cardId] || CARDS_CATALOG[cardId]?.description || 'Описание недоступно';
  }

  /**
   * ✅ НОВОЕ: Русские названия редкости
   */
  private getRarityNameRu(rarity: CardRarity): string {
    const names: Record<CardRarity, string> = {
      common: 'ОБЫЧНАЯ',
      rare: 'РЕДКАЯ',
      epic: 'ЭПИЧЕСКАЯ',
    };
    return names[rarity] || rarity.toUpperCase();
  }

  /**
   * ✅ НОВОЕ: Вычисляет необходимую высоту карточки на основе текста описания
   */
  private calculateCardHeight(unit: UnitData, cardWidth: number): number {
    const fonts = getFonts();
    const tagline = this.getUnitTagline(unit);
    const textStartX = 50 + 50; // iconX + offset
    const availableWidth = cardWidth - textStartX - (cardWidth / 2 - 20) - 20;
    
    // Создаем временный текст для измерения высоты
    const tempText = this.add.text(0, 0, tagline, {
      fontSize: '11px',
      wordWrap: { width: availableWidth },
      lineSpacing: 3,
    });
    
    const textHeight = tempText.height;
    tempText.destroy();
    
    // Базовая высота: верх (35) + название (18) + бейдж (24) + отступ (20) + описание (textHeight) + статистика (50) + отступы (20)
    const baseHeight = 35 + 18 + 24 + 20 + textHeight + 50 + 20;
    const minHeight = 130;
    
    return Math.max(baseHeight, minHeight);
  }

  private createUnitCard(x: number, y: number, unit: UnitData, owned: any, cardHeight: number): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const cardWidth = this.gameWidth - 32;
    // ✅ ИЗМЕНЕНО: Высота передается как параметр (динамическая)

    const c = this.add.container(x, y);

    const classColor = getClassColor(unit.capClass);
    const classColorHex = hexToString(classColor);

    // ✅ ПЕРЕРАБОТАНО: Многослойный фон для глубины
    const bgShadow = this.add.graphics();
    bgShadow.fillStyle(0x000000, 0.3);
    bgShadow.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth, cardHeight, 20);
    c.add(bgShadow);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0f1a, 0.98);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);
    c.add(bg);

    // Акцентная полоса слева
    const accentBar = this.add.graphics();
    accentBar.fillStyle(classColor, 0.9);
    accentBar.fillRect(-cardWidth / 2, -cardHeight / 2, 4, cardHeight);
    c.add(accentBar);

    // Внешняя обводка
    const border = this.add.graphics();
    border.lineStyle(2, classColor, 0.6);
    border.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);
    c.add(border);

    // Внутренняя подсветка
    const innerGlow = this.add.graphics();
    innerGlow.lineStyle(1, classColor, 0.15);
    innerGlow.strokeRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth - 4, cardHeight - 4, 18);
    c.add(innerGlow);

    // ✅ ПЕРЕРАБОТАНО: Иконка юнита с улучшенным дизайном
    const iconX = -cardWidth / 2 + 50;
    const iconY = 0;

    // Внешнее свечение
    const outerGlow = this.add.graphics();
    outerGlow.fillStyle(classColor, 0.2);
    outerGlow.fillCircle(iconX, iconY, 32);
    c.add(outerGlow);

    // Среднее свечение
    const midGlow = this.add.graphics();
    midGlow.fillStyle(classColor, 0.35);
    midGlow.fillCircle(iconX, iconY, 28);
    c.add(midGlow);

    // Внутренний круг
    const ringBg = this.add.circle(iconX, iconY, 26, 0x020617);
    ringBg.setStrokeStyle(3, classColor, 1);
    c.add(ringBg);

    // Иконка юнита
    try {
      // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
      const img = this.add.image(iconX, iconY, unit.assetKey).setDisplaySize(62, 62);
      c.add(img);
    } catch {
      c.add(this.add.text(iconX, iconY, '?', { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
    }

    // ✅ ПЕРЕРАБОТАНО: Улучшенная типографика и расположение текста
    const textStartX = iconX + 50;
    const textTopY = -35;

    // Название юнита
    c.add(
      this.add.text(textStartX, textTopY, getDisplayName(unit), {
        fontFamily: fonts.primary,
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        letterSpacing: 0.5,
      }).setOrigin(0, 0.5)
    );

    // Бейдж класса
    const classBadgeY = textTopY + 22;
    const classBadge = this.add.graphics();
    classBadge.fillStyle(classColor, 0.2);
    classBadge.fillRoundedRect(textStartX - 4, classBadgeY - 12, 100, 24, 12);
    classBadge.lineStyle(1.5, classColor, 0.8);
    classBadge.strokeRoundedRect(textStartX - 4, classBadgeY - 12, 100, 24, 12);
    c.add(classBadge);

    c.add(
      this.add.text(textStartX + 2, classBadgeY, `${getClassIcon(unit.capClass)} ${getClassName(unit.capClass)}`, {
        fontSize: '12px',
        fontFamily: fonts.tech,
        color: classColorHex,
        fontStyle: 'bold',
      }).setOrigin(0, 0.5)
    );

    // Описание
    const tagline = this.getUnitTagline(unit);
    const descY = classBadgeY + 20;
    const descText = this.add.text(textStartX, descY, tagline, {
      fontSize: '11px',
      color: '#a8b3c1',
      wordWrap: { width: cardWidth - textStartX - (cardWidth / 2 - 20) - 20 },
      lineSpacing: 3,
    }).setOrigin(0, 0.5);
    c.add(descText);

    // ✅ ИСПРАВЛЕНО: Простая статистика БЕЗ УРОВНЕЙ (2026-01-21)
    // Показываем базовые характеристики юнита из каталога
    const stats: Array<{ value: number; label: string; icon: string }> = [
      { value: unit.stats.power || 0, label: 'PWR', icon: '⚡' },
      { value: unit.stats.defense || 0, label: 'DEF', icon: '🛡️' },
      { value: unit.stats.speed || 0, label: 'SPD', icon: '🎯' },
      { value: unit.stats.technique || 0, label: 'TEC', icon: '✨' },
    ];

    // ✅ ИЗМЕНЕНО: Статистика позиционируется относительно реальной высоты описания
    const actualDescHeight = descText.height;
    const statsY = descY + actualDescHeight + 30;
    const statsStartX = -cardWidth / 2 + 50;
    const statItemWidth = (cardWidth - 100) / 4;
    const statGap = 8;

    stats.forEach((s, index) => {
      const statX = statsStartX + index * (statItemWidth + statGap) + statItemWidth / 2;

      // Иконка и метка
      c.add(
        this.add.text(statX, statsY - 12, `${s.icon} ${s.label}`, {
          fontSize: '10px',
          fontFamily: fonts.tech,
          color: '#94a3b8',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5)
      );

      // Прогресс-бар (показывает от 0 до 10)
      const barWidth = statItemWidth - 8;
      const barHeight = 6;
      const barX = statX - barWidth / 2;
      const barY = statsY + 2;

      const barBg = this.add.graphics();
      barBg.fillStyle(0x0f172a, 1);
      barBg.fillRoundedRect(barX, barY - barHeight / 2, barWidth, barHeight, 3);
      c.add(barBg);

      if (s.value > 0) {
        const barFill = this.add.graphics();
        barFill.fillStyle(classColor, 1);
        barFill.fillRoundedRect(barX, barY - barHeight / 2, (barWidth * s.value) / 10, barHeight, 3);
        c.add(barFill);
      }

      // Значение характеристики (БЕЗ /10)
      c.add(
        this.add.text(statX, barY + 10, `${s.value}`, {
          fontSize: '10px',
          fontFamily: fonts.tech,
          color: s.value === 10 ? '#22c55e' : '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5)
      );
    });

    // ✅ ПЕРЕРАБОТАНО: Общая сила справа вверху
    const power = playerData.getUnitPower(unit.id);
    const powerBg = this.add.graphics();
    powerBg.fillStyle(0x1a1a2e, 0.9);
    powerBg.fillRoundedRect(cardWidth / 2 - 70, -cardHeight / 2 + 12, 60, 32, 8);
    powerBg.lineStyle(1.5, 0xfacc15, 0.8);
    powerBg.strokeRoundedRect(cardWidth / 2 - 70, -cardHeight / 2 + 12, 60, 32, 8);
    c.add(powerBg);

    const powerText = this.add.text(cardWidth / 2 - 40, -cardHeight / 2 + 28, `⚡ ${power}`, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    c.add(powerText);

    if (unit.id === this.highlightUnitId) {
      this.playUpgradeHighlight(c, cardWidth, cardHeight);
      this.highlightUnitId = null;
    }

    c.on('pointerover', () => {
      this.tweens.add({ targets: c, scaleX: 1.03, scaleY: 1.03, duration: 80 });
    });
    c.on('pointerout', () => {
      this.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 80 });
    });

    return c;
  }

  private playUpgradeHighlight(card: Phaser.GameObjects.Container, width: number, height: number): void {
    const glow = this.add.graphics();
    glow.fillStyle(this.accentColor, 0.5);
    glow.fillRoundedRect(-width / 2, -height / 2, width, height, 20);
    glow.setAlpha(0);
    card.addAt(glow, 0);

    this.tweens.add({
      targets: card,
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 220,
      ease: 'Back.easeOut',
      yoyo: true,
      repeat: 1,
    });

    this.tweens.add({
      targets: glow,
      alpha: { from: 0, to: 0.9 },
      duration: 120,
      yoyo: true,
      repeat: 2,
      onComplete: () => glow.destroy(),
    });
  }

  private getUnitTagline(unit: UnitData): string {
    const anyUnit = unit as any;
    if (anyUnit.description && typeof anyUnit.description === 'string') {
      return anyUnit.description;
    }

    switch (unit.capClass) {
      case 'tank':
        return 'Тяжёлый стеной, принимает мощные удары на себя.';
      case 'sniper':
        return 'Дальнобойный финшер с точными прямыми выстрелами.';
      case 'trickster':
        return 'Мастер закрученных ударов, обходящих оборону.';
      case 'balanced':
      default:
        return 'Универсал: стабилен в атаке и защите.';
    }
  }

  private updateCardPositions(): void {
    this.contentContainer.y = this.contentTop - this.scrollY;
    this.cards.forEach(c => {
        const globalY = this.contentContainer.y + c.y;
        c.container.setVisible(globalY > -200 && globalY < this.gameHeight + 200);
    });
  }

  private setupInteractions(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      if (this.isDraggingPuck || this.capModalOverlay) return; // ✅ НОВОЕ: Блокируем скролл при открытом модале
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.updateCardPositions();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      preventNativeEvent(p);
      
      // ✅ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Не начинаем скролл если касание в зоне свайпа
      if (p.x <= SWIPE_EDGE_ZONE) {
        console.log('[TeamScene] Pointer in swipe zone, skipping scroll');
        return;
      }
      
      const barTop = this.cameras.main.height - 20 - this.bottomInset;
      if (p.y < this.headerHeight || p.y > barTop) return;
      if (this.isDraggingPuck || this.capModalOverlay) return; // ✅ НОВОЕ: Блокируем скролл при открытом модале

      this.isPointerScrolling = true;
      this.pointerScrollStartY = p.y;
      this.scrollStartY = this.scrollY;
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      preventNativeEvent(p);
      
      if (!this.isPointerScrolling || !p.isDown) return;
      if (this.isDraggingPuck) return;

      const delta = this.pointerScrollStartY - p.y;
      this.scrollY = Phaser.Math.Clamp(this.scrollStartY + delta, 0, this.maxScrollY);
      this.updateCardPositions();
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      preventNativeEvent(p);
      this.isPointerScrolling = false;
    });
  }

  /**
   * ✅ НОВОЕ (2026-01-20): Выгрузка текстур при выходе из сцены
   * Критично для предотвращения вылетов при скриншотах в Telegram
   */
  shutdown(): void {
    console.log('[TeamScene] shutdown - cleaning up');
    
    // ✅ Выгружаем текстуры юнитов текущей фракции
    const currentFaction = playerData.getFaction();
    if (currentFaction) {
      const units = getRepositoryUnitsByFaction(currentFaction);
      let unloadedCount = 0;
      
      units.forEach(unit => {
        if (this.textures.exists(unit.assetKey)) {
          this.textures.remove(unit.assetKey);
          unloadedCount++;
        }
      });
      
      if (import.meta.env.DEV) {
        console.log(`[TeamScene] Unloaded ${unloadedCount} textures to free memory`);
      }
    }
    
    // Cleanup UI
    this.cleanupBeforeCreate();
    this.swipeManager?.destroy();
    this.swipeManager = undefined;
  }
}