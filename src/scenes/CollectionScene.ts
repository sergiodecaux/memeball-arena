// 🎨 PROFESSIONAL Collection Scene - Telegram UI Style
// Perfect text readability, no overlaps, clean hierarchy

import Phaser from 'phaser';
import { FactionId, FACTIONS, FACTION_IDS, CapClass } from '../constants/gameConstants';
import {
  getFactionUnitsForCollection,
  UnitData as RepoUnitData,
  UnitRarity,
  getUnitById,
  getDisplayName,
} from '../data/UnitsRepository';
import { mergeUnitDisplay } from '../data/unitDisplayOverrides';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { hapticImpact } from '../utils/Haptics';
import { COLLECTION_RU } from '../i18n/collection_ru';
import { getFonts } from '../config/themes';
import { getUIFactionByGameFaction } from '../constants/factionUiConfig';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { BattlePassUnitPreview } from '../ui/previews/BattlePassUnitPreview';
import { safeSceneStart } from '../utils/SceneHelpers';
import { createText } from '../utils/TextFactory';
import { loadImagesRepository } from '../assets/loading/ImageLoader';
import { AssetPackManager } from '../assets/AssetPackManager';
import { getRealUnitTextureKey } from '../utils/TextureHelpers';
import { addAssetLoadingBackdrop, destroyAssetLoadingBackdrop } from '../ui/AssetsLoadingBackdrop';

/**
 * Предотвращает нативные события браузера на pointer событии
 */
function preventNativeEvent(pointer: Phaser.Input.Pointer): void {
  if (pointer.event) {
    pointer.event.preventDefault();
    pointer.event.stopPropagation();
  }
}

// Цвета рамок по редкости
const RARITY_COLORS = {
  common: { border: 0x9ca3af, glow: 0xd1d5db, text: '#9ca3af', shadow: '#4b5563' },
  rare: { border: 0x3b82f6, glow: 0x60a5fa, text: '#3b82f6', shadow: '#1e40af' },
  epic: { border: 0xa855f7, glow: 0xc084fc, text: '#a855f7', shadow: '#7e22ce' },
  legendary: { border: 0xf59e0b, glow: 0xfbbf24, text: '#f59e0b', shadow: '#b45309' },
};

export class CollectionScene extends Phaser.Scene {
  // UI состояние
  private selectedFaction?: FactionId;
  private selectedUnit?: RepoUnitData;
  private highlightedCard?: string; // ID выделенной карточки
  
  // Контейнеры
  private mainContainer!: Phaser.GameObjects.Container;
  private headerContainer!: Phaser.GameObjects.Container;
  private tabsContainer!: Phaser.GameObjects.Container;
  private filtersContainer!: Phaser.GameObjects.Container;
  private contentContainer!: Phaser.GameObjects.Container;
  private modalContainer?: Phaser.GameObjects.Container;
  private factionBg?: Phaser.GameObjects.Image;
  private unitPngLoadToken = 0;
  private loadedFactionPngs = new Set<FactionId>();
  /** Инкремент при каждом renderUnitsGrid — отменяет отложенные createBatch от предыдущего прохода */
  private unitsGridRenderGen = 0;
  
  // Навигация
  private swipeManager?: SwipeNavigationManager;
  
  // Скролл
  private scrollY = 0;
  private maxScrollY = 0;
  private isDragging = false;
  private dragStartY = 0;
  private scrollStartY = 0;
  private scrollVelocity = 0;
  private toastContainer?: Phaser.GameObjects.Container;
  
  // Размеры
  private width = 0;
  private height = 0;
  private headerHeight = 60; // Простая шапка только с заголовком
  private tabsHeight = 60;
  /** Панель фильтров редкость / роль под табами фракций */
  private filtersBarHeight = 74;
  private filterRarity: UnitRarity | 'all' = 'all';
  private filterRole: CapClass | 'all' = 'all';
  private readonly roleSortOrder: CapClass[] = ['tank', 'sniper', 'balanced', 'trickster'];
  private topOffset = 0;
  /** Во время preload — чтобы не было чёрного экрана под спиннером */
  private preloadBackdropObjs: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'CollectionScene' });
  }

  preload(): void {
    destroyAssetLoadingBackdrop(this.preloadBackdropObjs);
    this.preloadBackdropObjs = addAssetLoadingBackdrop(this);
    loadImagesRepository(this);
  }

  create(): void {
    try {
      destroyAssetLoadingBackdrop(this.preloadBackdropObjs);
      this.preloadBackdropObjs = [];

      this.width = this.cameras.main.width;
      this.height = this.cameras.main.height;
      this.topOffset = this.headerHeight + this.tabsHeight + this.filtersBarHeight;

      // Фон
      this.createBackground();
      
      // Главный контейнер
      this.mainContainer = this.add.container(0, 0).setDepth(1);
      
      // Telegram-style шапка (слева кнопка, по центру текст)
      this.createTelegramHeader();

      // Выбираем фракцию до отрисовки табов, чтобы активный таб был виден сразу.
      this.selectedFaction = FACTION_IDS[0];
      
      // Табы фракций под шапкой
      this.createFactionTabs();

      // Фильтры редкости и роли
      this.createFiltersBar();

      // Контент (карточки юнитов)
      this.contentContainer = this.add.container(0, this.topOffset).setDepth(2);
      this.mainContainer.add(this.contentContainer);

      // Маска, чтобы карточки не заезжали под шапку/табы
      const contentMaskShape = this.add.rectangle(
        0,
        this.topOffset,
        this.width,
        this.height - this.topOffset,
        0x000000,
        0
      ).setOrigin(0, 0);
      this.contentContainer.setMask(contentMaskShape.createGeometryMask());
      
      // Показываем первую фракцию
      this.updateFactionBackground();
      this.renderUnitsGrid();
      this.time.delayedCall(50, () => {
        void this.loadVisibleUnitPngs();
      });
      
      // Скролл
      this.setupScroll();
      
      // Свайп навигация (как в магазине) - УВЕЛИЧЕННАЯ ЗОНА
      try {
        this.swipeManager = new SwipeNavigationManager(this, {
          onBack: () => this.handleBack(),
          canSwipe: () => !this.modalContainer && !this.isDragging,
          edgeZoneWidth: 80, // Было 25 (по умолчанию), увеличили до 80px для удобства
        });
        this.swipeManager.enable();
      } catch (error) {
        console.error('[CollectionScene] Error initializing swipe manager:', error);
        // Продолжаем работу без свайп-навигации
      }
    } catch (error) {
      console.error('[CollectionScene] Critical error in create():', error);
      // Пытаемся вернуться в главное меню вместо вылета
      try {
        this.scene.start('MainMenuScene');
      } catch (fallbackError) {
        console.error('[CollectionScene] Failed to return to MainMenuScene:', fallbackError);
      }
    }
  }

  private async loadVisibleUnitPngs(): Promise<void> {
    if (!this.selectedFaction || !this.scene.isActive()) {
      return;
    }

    const selectedFaction = this.selectedFaction;
    const loadToken = ++this.unitPngLoadToken;
    const units = getFactionUnitsForCollection(selectedFaction);
    const unitIds = units.map((unit) => unit.id);

    if (this.loadedFactionPngs.has(selectedFaction)) {
      this.renderUnitsGrid();
      return;
    }

    const batchSize = 6;
    try {
      for (let index = 0; index < unitIds.length && this.scene.isActive(); index += batchSize) {
        if (this.selectedFaction !== selectedFaction || this.unitPngLoadToken !== loadToken) {
          return;
        }

        await AssetPackManager.loadUnitAssets(this, unitIds.slice(index, index + batchSize));
        if (this.scene.isActive() && this.selectedFaction === selectedFaction && this.unitPngLoadToken === loadToken) {
          this.renderUnitsGrid();
        }

        if (index + batchSize < unitIds.length) {
          await new Promise<void>((resolve) => this.time.delayedCall(60, () => resolve()));
        }
      }

      this.loadedFactionPngs.add(selectedFaction);
    } catch (error) {
      console.warn('[CollectionScene] Failed to lazy-load unit PNGs:', error);
      if (this.scene.isActive() && this.selectedFaction === selectedFaction && this.unitPngLoadToken === loadToken) {
        this.renderUnitsGrid();
      }
    }
  }

  /**
   * Красивый плейсхолдер, если текстура не загрузилась
   */
  private addUnitPlaceholder(
    container: Phaser.GameObjects.Container,
    size: number,
    borderColor: number,
    unit: RepoUnitData
  ): void {
    try {
      const placeholder = this.add.graphics();
      placeholder.fillStyle(0x131320, 1);
      placeholder.fillRoundedRect(-size / 2, -size / 2, size, size, 10);
      placeholder.lineStyle(2, borderColor, 0.7);
      placeholder.strokeRoundedRect(-size / 2, -size / 2, size, size, 10);
      container.add(placeholder);

      // Роль/первая буква, чтобы не было пустого квадрата
      // Используем PNG иконку роли с fallback на первую букву
      if (unit?.role) {
        const roleIconKey = `role_${unit.role}`;
        if (this.textures.exists(roleIconKey)) {
          const icon = this.add.image(0, -4, roleIconKey);
          const scale = 48 / 128; // Размер примерно 48px
          icon.setScale(scale);
          icon.setOrigin(0.5);
          container.add(icon);
        } else {
          // Fallback на эмодзи
          const roleIcons: Record<RepoUnitData['role'], string> = {
            balanced: '⚖️',
            tank: '🛡️',
            sniper: '🎯',
            trickster: '✨',
          };
          const roleIcon = roleIcons[unit.role];
          const label = createText(this, Math.round(0), Math.round(-4), roleIcon, {
            size: 'xxl',
          }).setOrigin(0.5);
          container.add(label);
        }
      } else {
        // Fallback на первую букву
        const initial = unit?.name?.charAt(0) || unit?.id?.charAt(0) || '?';
        const label = createText(this, Math.round(0), Math.round(-4), initial.toUpperCase(), {
          size: 'xxl',
          font: 'tech',
          color: '#ffffff',
          stroke: true,
        }).setOrigin(0.5);
        container.add(label);
      }
    } catch (error) {
      console.error('[CollectionScene] Error in addUnitPlaceholder:', error);
    }
  }

  /**
   * Обработчик возврата назад
   */
  private handleBack(): void {
    AudioManager.getInstance().playUIClick();
    hapticImpact('light');
      this.scene.start('MainMenuScene');
  }
  
  /**
   * Закрывает модалку
   */
  private closeModal(overlay?: Phaser.GameObjects.Rectangle): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = undefined;
    }
    if (overlay) {
      overlay.destroy();
    }
    this.highlightedCard = undefined; // Сбрасываем подсветку
  }

  /**
   * Создает базовый фон
   */
  private createBackground(): void {
    const bg = this.add.rectangle(0, 0, this.width, this.height, 0x0a0a12, 1);
    bg.setOrigin(0);
    bg.setDepth(0);
  }
  
  /**
   * Обновляет фон фракции
   */
  private updateFactionBackground(): void {
    if (this.factionBg) {
      this.factionBg.destroy();
    }
    
    if (!this.selectedFaction) return;
    
    const bgKey = `bg_faction_${this.selectedFaction}`;
    
    if (this.textures.exists(bgKey)) {
      this.factionBg = this.add.image(this.width / 2, this.height / 2, bgKey);
      this.factionBg.setOrigin(0.5);
      this.factionBg.setDisplaySize(this.width, this.height);
      this.factionBg.setAlpha(0.25);
      this.factionBg.setDepth(0.5);
    }
  }

  /**
   * Создает простую шапку (только заголовок, как в магазине — БЕЗ кнопки)
   */
  private createTelegramHeader(): void {
    this.headerContainer = this.add.container(0, 0);
    this.headerContainer.setDepth(100);

    // Фон шапки
    const headerBg = this.add.graphics();
    const g = headerBg;
    g.fillGradientStyle(0x0f172a, 0x0b1220, 0x0f172a, 0x0b1220, 1, 1, 1, 1);
    g.fillRect(0, 0, this.width, this.headerHeight);
    
    // Нижняя линия-разделитель
    headerBg.lineStyle(1, 0x2a2a3e, 0.5);
    headerBg.lineBetween(0, this.headerHeight, this.width, this.headerHeight);
    
    this.headerContainer.add(headerBg);

    // ✅ ТОЛЬКО ЗАГОЛОВОК — как в магазине, без кнопок
    // Выход работает через SwipeNavigationManager (свайп с левого края)
    // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
    const title = createText(this, Math.round(this.width / 2), Math.round(this.headerHeight / 2), COLLECTION_RU.title, {
      size: 'lg',
      font: 'tech',
      color: '#ffffff',
      stroke: true,
    }).setOrigin(0.5);
    this.headerContainer.add(title);

    this.mainContainer.add(this.headerContainer);
  }

  /**
   * Создает табы фракций (под шапкой)
   */
  private createFactionTabs(): void {
    // Удаляем старые табы перед созданием новых, чтобы не наслаивались
    if (this.tabsContainer) {
      this.tabsContainer.destroy(true);
    }
    this.tabsContainer = this.add.container(0, this.headerHeight);
    this.tabsContainer.setDepth(99);

    // Фон табов
    const tabsBg = this.add.graphics();
    tabsBg.fillStyle(0x16161f, 0.98);
    tabsBg.fillRect(0, 0, this.width, this.tabsHeight);
    
    // Нижняя линия
    tabsBg.lineStyle(1, 0x2a2a3e, 0.5);
    tabsBg.lineBetween(0, this.tabsHeight, this.width, this.tabsHeight);
    
    this.tabsContainer.add(tabsBg);

    // Иконки фракций (4 штуки)
    const iconSize = 48;
    const gap = 12;
    const totalWidth = FACTION_IDS.length * iconSize + (FACTION_IDS.length - 1) * gap;
    const startX = this.width / 2 - totalWidth / 2 + iconSize / 2;
    const y = this.tabsHeight / 2;

    FACTION_IDS.forEach((factionId, index) => {
      const x = startX + index * (iconSize + gap);
      const tab = this.createFactionTab(factionId, x, y, iconSize);
      this.tabsContainer.add(tab);
    });

    this.mainContainer.add(this.tabsContainer);
  }

  /**
   * Чипы фильтрации по редкости и роли (сетка после выбора фракции)
   */
  private createFiltersBar(): void {
    if (this.filtersContainer) {
      this.filtersContainer.destroy(true);
    }
    const fy = this.headerHeight + this.tabsHeight;
    this.filtersContainer = this.add.container(0, fy).setDepth(98);

    const s = Math.min(this.width / 390, 1.35);
    const fonts = getFonts();
    const h = this.filtersBarHeight;

    const panel = this.add.graphics();
    panel.fillGradientStyle(0x12121c, 0x0b0e17, 0x0b0e17, 0x12121c, 1, 1, 1, 1);
    panel.fillRect(0, 0, this.width, h);
    panel.lineStyle(1, 0xfbbf24, 0.18);
    panel.lineBetween(0, h - 1, this.width, h - 1);
    this.filtersContainer.add(panel);

    const chipH = Math.max(22, Math.round(24 * s));
    const gap = Math.max(5, Math.round(6 * s));
    const padX = Math.max(8, Math.round(10 * s));

    const rarityDefs: ReadonlyArray<{ id: UnitRarity | 'all'; text: string }> = [
      { id: 'all', text: COLLECTION_RU.filters.all },
      { id: 'common', text: COLLECTION_RU.filters.rarityShort.common },
      { id: 'rare', text: COLLECTION_RU.filters.rarityShort.rare },
      { id: 'epic', text: COLLECTION_RU.filters.rarityShort.epic },
      { id: 'legendary', text: COLLECTION_RU.filters.rarityShort.legendary },
    ];

    const roleDefs: ReadonlyArray<{ id: CapClass | 'all'; text: string }> = [
      { id: 'all', text: COLLECTION_RU.filters.all },
      { id: 'tank', text: COLLECTION_RU.roles.tank },
      { id: 'sniper', text: COLLECTION_RU.roles.sniper },
      { id: 'balanced', text: COLLECTION_RU.roles.balanced },
      { id: 'trickster', text: COLLECTION_RU.roles.trickster },
    ];

    const row1Y = Math.round(10 + chipH / 2);
    const row2Y = Math.round(10 + chipH + gap + 6 + chipH / 2);
    const rowUsableW = this.width - padX * 2;

    const addChipRow = (
      defs: ReadonlyArray<{ id: string; text: string }>,
      rowCenterY: number,
      selectedId: string,
      apply: (id: string) => void,
    ) => {
      const n = defs.length;
      const innerGap = gap;
      const chipW = (rowUsableW - (n - 1) * innerGap) / n;
      for (let i = 0; i < n; i++) {
        const d = defs[i]!;
        const cx = padX + chipW / 2 + i * (chipW + innerGap);
        const selected = d.id === selectedId;
        const c = this.add.container(cx, rowCenterY);
        const hw = chipW / 2 - 1;
        const hh = chipH / 2 - 1;
        const bg = this.add.graphics();
        bg.fillStyle(selected ? 0x1f2533 : 0x141820, 1);
        bg.fillRoundedRect(-hw, -hh, chipW - 2, chipH, 6 * s);
        if (selected) {
          bg.lineStyle(2, 0xffc857, 0.95);
          bg.strokeRoundedRect(-hw, -hh, chipW - 2, chipH, 6 * s);
          bg.lineStyle(1, 0x38bdf8, 0.35);
          bg.strokeRoundedRect(-hw + 1, -hh + 1, chipW - 4, chipH - 2, 5 * s);
        } else {
          bg.lineStyle(1, 0x363d4d, 0.85);
          bg.strokeRoundedRect(-hw, -hh, chipW - 2, chipH, 6 * s);
        }
        c.add(bg);
        c.add(
          this.add
            .text(0, 0, d.text, {
              fontSize: `${Math.max(8, Math.round(9 * s))}px`,
              fontFamily: fonts.tech,
              color: selected ? '#fffbeb' : '#94a3b8',
            })
            .setOrigin(0.5)
        );
        const hit = this.add
          .rectangle(0, 0, chipW - 2, chipH + 4, 0, 0)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          preventNativeEvent(pointer);
          if (selected) return;
          AudioManager.getInstance().playUIClick();
          hapticImpact('light');
          apply(d.id);
        });
        c.add(hit);
        this.filtersContainer.add(c);
      }
    };

    addChipRow(
      rarityDefs,
      row1Y,
      this.filterRarity,
      (id: string) => {
        this.filterRarity = id as UnitRarity | 'all';
        this.createFiltersBar();
        this.renderUnitsGrid();
        this.time.delayedCall(40, () => void this.loadVisibleUnitPngs());
      },
    );

    addChipRow(
      roleDefs,
      row2Y,
      this.filterRole,
      (id: string) => {
        this.filterRole = id as CapClass | 'all';
        this.createFiltersBar();
        this.renderUnitsGrid();
        this.time.delayedCall(40, () => void this.loadVisibleUnitPngs());
      },
    );

    this.mainContainer.add(this.filtersContainer);
  }

  /**
   * Создает таб одной фракции
   */
  private createFactionTab(factionId: FactionId, x: number, y: number, size: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const faction = FACTIONS[factionId];
    const isSelected = this.selectedFaction === factionId;

    // Фон
    const bg = this.add.graphics();
    
    if (isSelected) {
      // Выбранная фракция - яркая рамка и подсветка
      bg.fillStyle(faction.color, 0.15);
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
      bg.lineStyle(2, faction.color, 1);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 8);
      
      // Светящийся эффект
      const glow = this.add.graphics();
      glow.lineStyle(4, faction.color, 0.3);
      glow.strokeRoundedRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 10);
      container.add(glow);
    } else {
      // Не выбранная - приглушённая
      bg.fillStyle(0x2a2a3e, 0.6);
      bg.fillRoundedRect(-size / 2, -size / 2, size, size, 8);
      bg.lineStyle(1, 0x444444, 0.5);
      bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 8);
    }
    
    container.add(bg);

    const uiFactionId = getUIFactionByGameFaction(factionId);
    const emblemKeys = [`icon_faction_${uiFactionId}`, `ui_faction_${factionId}`];

    let emblemAdded = false;
    for (const emblemKey of emblemKeys) {
      if (!this.textures.exists(emblemKey)) {
        continue;
      }
      const icon = this.add.image(0, 0, emblemKey);
      icon.setDisplaySize(size * 0.7, size * 0.7);
      icon.setAlpha(isSelected ? 1 : 0.6);
      container.add(icon);
      emblemAdded = true;
      break;
    }
    if (!emblemAdded) {
      const dot = this.add.circle(0, 0, size * 0.22, faction.color, 0.85);
      container.add(dot);
    }

    // Интерактивность
    const hitArea = this.add.rectangle(0, 0, size, size, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      
      if (this.selectedFaction !== factionId) {
        AudioManager.getInstance().playUIClick();
        hapticImpact('light');
        
        // ✅ FIX 2026-01-23: НЕ удаляем текстуры при переключении фракций
        // Причина: TextureMemoryManager не работает (не регистрирует текстуры)
        // GameScene сам управляет памятью через cleanupUnusedUnitTextures()
        
        this.selectedFaction = factionId;
        this.updateFactionBackground();
        this.renderUnitsGrid();
        this.createFactionTabs(); // Перерисовываем табы
        void this.loadVisibleUnitPngs();
      }
    });

    return container;
  }

  /**
   * Рендерит сетку карточек юнитов (3xN)
   */
  private renderUnitsGrid(): void {
    // Очищаем старые карточки
    this.contentContainer.removeAll(true);
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.contentContainer.y = this.topOffset;

    if (!this.selectedFaction) return;

    // ✅ ИСПРАВЛЕНО: Показываем ВСЕ юниты включая Battle Pass
    // BP юниты отмечаются специальным бейджем в createUnitCard()
    const allUnits = getFactionUnitsForCollection(this.selectedFaction);
    let units = [...allUnits];
    units = units.filter((u) => this.filterRarity === 'all' || u.rarity === this.filterRarity);
    units = units.filter((u) => this.filterRole === 'all' || u.role === this.filterRole);

    if (import.meta.env.DEV) {
      const bpCount = allUnits.filter((u) => u.isBattlePass).length;
      console.log(
        `[CollectionScene] Rendering ${units.length}/${allUnits.length} units (${bpCount} BP) faction=${this.selectedFaction} rarity=${this.filterRarity} role=${this.filterRole}`,
      );
    }

    if (allUnits.length === 0) {
      this.contentContainer.add(
        createText(this, Math.round(this.width / 2), Math.round(100), 'Нет доступных юнитов', {
          size: 'md',
          font: 'primary',
          color: '#6b7280',
        }).setOrigin(0.5),
      );
      return;
    }

    if (units.length === 0) {
      this.contentContainer.add(
        createText(this, Math.round(this.width / 2), Math.round(100), COLLECTION_RU.filters.emptyFiltered, {
          size: 'md',
          font: 'primary',
          color: '#6b7280',
          align: 'center',
          maxWidth: this.width - 48,
        }).setOrigin(0.5),
      );
      return;
    }

    const rarityOrder: UnitRarity[] = ['legendary', 'epic', 'rare', 'common'];
    const sortedUnits = [...units].sort((a, b) => {
      const capA = a.isCaptain ? 1 : 0;
      const capB = b.isCaptain ? 1 : 0;
      if (capB !== capA) return capB - capA;
      const byRarity = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity);
      if (byRarity !== 0) return byRarity;
      return this.roleSortOrder.indexOf(a.role) - this.roleSortOrder.indexOf(b.role);
    });

    // Сетка 3xN с увеличенными размерами
    const cardSize = 110;
    const gap = 14;
    const cols = 3;
    // ✅ Правильные отступы: карточки начинаются с запасом от topOffset
    const padding = 16; // Отступы слева и справа
    const topPadding = 35; // ✅ ИСПРАВЛЕНО: Увеличен отступ сверху, чтобы первые карточки не обрезались (было 20)
    const bottomPadding = 40; // Отступ снизу для удобства прокрутки
    const availableWidth = this.width - padding * 2;
    const totalCardsWidth = cols * cardSize + (cols - 1) * gap;
    const startX = padding + (availableWidth - totalCardsWidth) / 2 + cardSize / 2;
    const startY = topPadding;

    // PNGs are preloaded before the normal render path; small batches keep the menu responsive.
    const batchSize = 9;
    let currentIndex = 0;
    const gridGen = ++this.unitsGridRenderGen;
    let successCount = 0;
    let errorCount = 0;

    const rows = Math.ceil(sortedUnits.length / cols);
    const totalHeight = rows * (cardSize + gap + 35) + startY + bottomPadding;
    const visibleHeight = this.height - this.topOffset;
    this.maxScrollY = Math.max(0, totalHeight - visibleHeight);

    const createBatch = () => {
      if (gridGen !== this.unitsGridRenderGen || !this.scene.isActive()) {
        return;
      }
      const batchEnd = Math.min(currentIndex + batchSize, sortedUnits.length);
      
      for (let i = currentIndex; i < batchEnd; i++) {
        const unit = sortedUnits[i];
        
        // ✅ FIX: Защита от null/undefined юнитов
        if (!unit) {
          console.warn(`[CollectionScene] Skipping null/undefined unit at index ${i}`);
          errorCount++;
          continue;
        }
        
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardSize + gap);
        const y = startY + row * (cardSize + gap + 35);

        try {
          const card = this.createUnitCard(unit, x, y, cardSize);
          if (card) {
            this.contentContainer.add(card);
            successCount++;
          } else {
            console.warn(`[CollectionScene] Card creation returned null for unit: ${unit?.id}`);
            errorCount++;
          }
        } catch (cardError) {
          console.error(`[CollectionScene] Error creating card for ${unit?.id}:`, cardError);
          errorCount++;
        }
      }

      currentIndex = batchEnd;

      // Продолжаем создание батчами с небольшой задержкой для предотвращения лагов
      if (currentIndex < sortedUnits.length) {
        this.time.delayedCall(16, createBatch); // ~1 кадр при 60fps
      } else {
        if (import.meta.env.DEV) {
          console.log(`[CollectionScene] ✅ Rendered ${successCount} cards, ${errorCount} errors (maxScrollY: ${this.maxScrollY})`);
        }
      }
    };

    // Начинаем создание первой партии
    createBatch();
  }

  /**
   * Создает карточку юнита (оптимизированная версия)
   */
  private createUnitCard(unit: RepoUnitData, x: number, y: number, size: number, allUnits?: RepoUnitData[]): Phaser.GameObjects.Container | null {
    // ✅ ЗАЩИТА: Валидация входных данных
    if (!unit) {
      console.error('[CollectionScene] createUnitCard: unit is null/undefined');
      return null;
    }

    if (!unit.id) {
      console.error('[CollectionScene] createUnitCard: unit.id is missing', unit);
      return null;
    }

    try {
      const container = this.add.container(x, y);
      
      // ✅ ЗАЩИТА: Безопасный доступ к playerData
      let isOwned = false;
      try {
        isOwned = playerData.ownsUnit(unit.id);
      } catch (e) {
        console.warn(`[CollectionScene] Error checking ownership for ${unit.id}:`, e);
      }

      // ✅ ЗАЩИТА: Безопасный доступ к цветам редкости
      const rarityColor = RARITY_COLORS[unit.rarity] || RARITY_COLORS.common;

    // ✅ ОПТИМИЗАЦИЯ: Используем один Graphics объект для всех визуальных элементов карточки
    const cardGraphics = this.add.graphics();
    
    // Тень под карточкой
    cardGraphics.fillStyle(0x000000, 0.45);
    cardGraphics.fillRoundedRect(-size / 2 + 2, -size / 2 + 2, size, size, 12);
    
    // Фон карточки (легкий градиент/подсветка)
    const bgColor = isOwned ? 0x111827 : 0x0b1120;
    cardGraphics.fillStyle(bgColor, isOwned ? 0.95 : 0.75);
    cardGraphics.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
    
    // Рамка
    cardGraphics.lineStyle(3, rarityColor.border, isOwned ? 1 : 0.6);
    cardGraphics.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
    
    container.add(cardGraphics);

    // Изображение юнита (всегда показываем, но затемняем если не открыт)
    const bestTextureKey = getRealUnitTextureKey(this, unit);
    
    const addUnitImage = (keyToUse: string) => {
      try {
        if (!this.textures.exists(keyToUse)) {
          return false;
        }
        const unitImage = this.add.image(0, -5, keyToUse);
        // ✅ ИСПРАВЛЕНО: Уменьшен размер чтобы изображение не вылезало за границы карточки
        const imageSize = size * 0.85; // Для BP юнитов можно использовать 0.85
        unitImage.setDisplaySize(imageSize, imageSize);
        unitImage.setAlpha(isOwned ? 1 : 0.55); // Более читаемо в залоченном состоянии
        container.add(unitImage);
        return true;
      } catch (error) {
        console.error(`[CollectionScene] Error creating unit image for "${keyToUse}":`, error);
        return false;
      }
    };

    // ✅ FIX: Пытаемся использовать текстуру с обработкой ошибок
    let imageAdded = false;
    if (bestTextureKey) {
      imageAdded = addUnitImage(bestTextureKey);
    }
    
    if (!imageAdded) {
      if (!imageAdded) {
        this.addUnitPlaceholder(container, size, rarityColor.border, unit);
      }
    }

    // Затемнение для неоткрытых (отдельный Graphics, чтобы быть поверх изображения)
    if (!isOwned) {
      const darkOverlay = this.add.graphics();
      darkOverlay.fillStyle(0x000000, 0.35);
      darkOverlay.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
      container.add(darkOverlay);

      // ✅ НОВОЕ: Обработка премиум юнитов
      if (unit.isPremium) {
        // Премиум юнит - показываем значок и цену в кристаллах
        const premiumBadge = this.add.graphics();
        premiumBadge.fillStyle(0x0e1423, 0.95);
        premiumBadge.fillRoundedRect(-38, size / 2 - 18, 76, 20, 9);
        premiumBadge.lineStyle(2, 0xf59e0b, 1); // Золотая рамка
        premiumBadge.strokeRoundedRect(-38, size / 2 - 18, 76, 20, 9);
        container.add(premiumBadge);

        const premiumPrice = unit.premiumPrice || 1000;
        // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
        const premiumText = createText(this, Math.round(0), Math.round(size / 2 - 7), `💎 ${premiumPrice}`, {
          size: 'sm',
          font: 'primary',
          color: '#fbbf24',
          stroke: true,
        }).setOrigin(0.5);
        container.add(premiumText);
      } else if (unit.isBattlePass) {
        // Battle Pass юнит - показываем тир или "ПОЛУЧЕНО"
        if (!isOwned) {
          const tierBadge = this.add.graphics();
          tierBadge.fillStyle(0x1e1b4b, 0.95);
          tierBadge.fillRoundedRect(-38, size / 2 - 20, 76, 22, 9);
          tierBadge.lineStyle(2, 0xa855f7, 1);
          tierBadge.strokeRoundedRect(-38, size / 2 - 20, 76, 22, 9);
          container.add(tierBadge);
          
          // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
          const tierText = createText(this, Math.round(0), Math.round(size / 2 - 9), `🎫 Tier ${unit.battlePassTier}`, {
            size: 'xs',
            font: 'primary',
            color: '#c4b5fd',
            stroke: true,
          }).setOrigin(0.5);
          container.add(tierText);
        } else {
          const ownedBadge = this.add.graphics();
          ownedBadge.fillStyle(0x0e1423, 0.95);
          ownedBadge.fillRoundedRect(-38, size / 2 - 18, 76, 20, 9);
          ownedBadge.lineStyle(2, 0xffd700, 1);
          ownedBadge.strokeRoundedRect(-38, size / 2 - 18, 76, 20, 9);
          container.add(ownedBadge);
          
          // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
          const ownedText = createText(this, Math.round(0), Math.round(size / 2 - 7), '⭐ ПОЛУЧЕНО', {
            size: 'xs',
            font: 'primary',
            color: '#ffd700',
            stroke: true,
          }).setOrigin(0.5);
          container.add(ownedText);
        }
      } else {
        // Обычный юнит - показываем прогресс фрагментов
        const currentFragments = playerData.getUnitFragments(unit.id);
        const requiredFragments = unit.fragmentsRequired;

        const badge = this.add.graphics();
        badge.fillStyle(0x0e1423, 0.95);
        badge.fillRoundedRect(-38, size / 2 - 18, 76, 20, 9);
        badge.lineStyle(2, currentFragments >= requiredFragments ? 0x22c55e : 0xf97316, 1);
        badge.strokeRoundedRect(-38, size / 2 - 18, 76, 20, 9);
        container.add(badge);

        // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
        const fragmentText = createText(this, Math.round(0), Math.round(size / 2 - 7), `${currentFragments}/${requiredFragments}`, {
          size: 'sm',
          font: 'primary',
          color: currentFragments >= requiredFragments ? '#22c55e' : '#fbbf24',
          stroke: true,
        }).setOrigin(0.5);
        container.add(fragmentText);
      }
    }

    // ✅ BATTLE PASS EXCLUSIVE - специальная рамка и бейдж
    if (unit.isBattlePass) {
      // Специальная рамка для BP юнитов
      const bpBorder = this.add.graphics();
      
      if (isOwned) {
        // Золотая рамка для полученных
        bpBorder.lineStyle(3, 0xffd700, 1);
      } else {
        // Фиолетовая рамка для недоступных
        bpBorder.lineStyle(3, 0xa855f7, 0.8);
      }
      bpBorder.strokeRoundedRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 14);
      container.add(bpBorder);
      
      // Бейдж "BP" в углу
      const bpBadgeBg = this.add.graphics();
      bpBadgeBg.fillStyle(isOwned ? 0xffd700 : 0xa855f7, 1);
      bpBadgeBg.fillRoundedRect(size / 2 - 28, -size / 2 - 2, 30, 18, { tl: 0, tr: 12, bl: 8, br: 0 } as any);
      container.add(bpBadgeBg);
      
      // ✅ ИСПРАВЛЕНО: Используем TextFactory для чётких шрифтов
      const bpBadgeText = createText(this, Math.round(size / 2 - 13), Math.round(-size / 2 + 7), 'BP', {
        size: 'xs',
        font: 'primary',
        color: isOwned ? '#000000' : '#ffffff',
        stroke: true,
      }).setOrigin(0.5);
      container.add(bpBadgeText);
    } else if (unit.isCaptain) {
      const capBg = this.add.graphics();
      capBg.fillStyle(0x0e7490, 0.95);
      capBg.fillRoundedRect(-size / 2 + 4, -size / 2 + 4, 58, 17, 5);
      capBg.lineStyle(1, 0x22d3ee, 0.85);
      capBg.strokeRoundedRect(-size / 2 + 4, -size / 2 + 4, 58, 17, 5);
      container.add(capBg);
      const capLabel = createText(this, Math.round(-size / 2 + 33), Math.round(-size / 2 + 12), 'КАПИТАН', {
        size: 'xs',
        font: 'primary',
        color: '#ecfeff',
        stroke: true,
      }).setOrigin(0.5);
      container.add(capLabel);
    }

    // Индикатор редкости (треугольник в углу) - добавляем в cardGraphics
    cardGraphics.fillStyle(rarityColor.border, isOwned ? 1 : 0.4);
    cardGraphics.fillTriangle(
      size / 2 - 18, -size / 2,
      size / 2, -size / 2,
      size / 2, -size / 2 + 18
    );

    // Название юнита под карточкой (с чёткой тенью)
    const nameText = this.add.text(0, size / 2 + 18, getDisplayName(unit), {
      fontSize: '11px',
      color: isOwned ? '#ffffff' : '#888888',
      fontStyle: 'bold',
      fontFamily: getFonts().tech,
      wordWrap: { width: size + 10 },
      align: 'center',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // Интерактивность (два тапа: первый - подсветка, второй - открыть)
    const hitArea = this.add.rectangle(0, 0, size, size, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    const isHighlighted = this.highlightedCard === unit.id;

    // Подсветка цветом фракции если выделена (создаем отдельно, так как она динамическая)
    const highlightGlow = this.add.graphics();
    if (isHighlighted) {
      const faction = FACTIONS[unit.factionId];
      highlightGlow.lineStyle(4, faction.color, 0.8);
      highlightGlow.strokeRoundedRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 12);
    }
    container.add(highlightGlow);
    (container as any).__highlightGlow = highlightGlow;
    (container as any).__cardGraphics = cardGraphics; // Сохраняем ссылку для возможных обновлений

    hitArea.on('pointerover', () => {
      this.tweens.add({ 
        targets: container, 
        scale: 1.05, 
        duration: 120,
        ease: 'Back.easeOut'
      });
    });

    hitArea.on('pointerout', () => {
      if (this.highlightedCard !== unit.id) {
        this.tweens.add({ 
          targets: container, 
          scale: 1, 
          duration: 120 
        });
      }
    });

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      
      AudioManager.getInstance().playUIClick();
      hapticImpact('light');
      
      // Первый тап - подсветка
      if (this.highlightedCard !== unit.id) {
        // Убираем подсветку с предыдущей карточки
        if (this.highlightedCard) {
          const prevCard = this.contentContainer.list.find((c: any) => c.__unitId === this.highlightedCard) as any;
          if (prevCard && prevCard.__highlightGlow) {
            prevCard.__highlightGlow.clear();
            this.tweens.add({ targets: prevCard, scale: 1, duration: 120 });
          }
        }
        
        // Подсвечиваем новую
        this.highlightedCard = unit.id;
        const faction = FACTIONS[unit.factionId];
        highlightGlow.clear();
        highlightGlow.lineStyle(4, faction.color, 0.8);
        highlightGlow.strokeRoundedRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 12);
      } else {
        // Второй тап - открыть модалку
        hapticImpact('medium');
        // ✅ Battle Pass юниты открывают специальное превью
        if (unit.isBattlePass && !isOwned) {
          this.showBattlePassUnitPreview(unit);
        } else {
          // Стандартное превью
          this.showUnitModal(unit);
        }
      }
    });

      // Сохраняем unitId для поиска
      (container as any).__unitId = unit.id;

      return container;

    } catch (error) {
      console.error(`[CollectionScene] ❌ Error creating card for unit ${unit?.id}:`, error);
      
      // ✅ Возвращаем fallback контейнер вместо вылета
      try {
        const fallbackContainer = this.add.container(x, y);
        const fallbackBg = this.add.graphics();
        fallbackBg.fillStyle(0x333333, 0.8);
        fallbackBg.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
        fallbackContainer.add(fallbackBg);
        fallbackContainer.add(
          this.add.text(0, 0, '⚠️', { fontSize: '24px' }).setOrigin(0.5)
        );
        return fallbackContainer;
      } catch (fallbackError) {
        console.error('[CollectionScene] Failed to create fallback container:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Показывает детальную модалку юнита (с читаемым текстом)
   */
  private showUnitModal(unit: RepoUnitData): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
    }

    const u = mergeUnitDisplay(unit);

    const isOwned = playerData.ownsUnit(unit.id);
    const isPremium = unit.isPremium === true;
    const premiumPrice = unit.premiumPrice || 1000;
    const canAffordPremium = !isPremium || playerData.get().crystals >= premiumPrice;
    
    // Цвета редкости - для премиума используем legendary
    const rarity = isPremium ? 'legendary' : (unit.rarity || 'common');
    const rarityColor = RARITY_COLORS[rarity];

    // Затемнение фона
    const overlay = this.add.rectangle(0, 0, this.width, this.height, 0x000000, 0.9);
    overlay.setOrigin(0);
    overlay.setInteractive();
    overlay.setDepth(1000);

    // Модальное окно
    const modalWidth = Math.min(this.width - 32, 400);
    const modalHeight = Math.min(this.height - 60, 760);
    
    this.modalContainer = this.add.container(this.width / 2, this.height / 2);
    this.modalContainer.setDepth(1001);

    // Тень модалки
    const modalShadow = this.add.graphics();
    modalShadow.fillStyle(0x000000, 0.6);
    modalShadow.fillRoundedRect(-modalWidth / 2 + 4, -modalHeight / 2 + 4, modalWidth, modalHeight, 20);
    modalShadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.modalContainer.add(modalShadow);

    // Фон модалки
    const modalBg = this.add.graphics();
    modalBg.fillStyle(0x16161f, 1);
    modalBg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
    modalBg.lineStyle(3, rarityColor.border, 1);
    modalBg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
    this.modalContainer.add(modalBg);

    // Свечение вокруг модалки
    const glow = this.add.graphics();
    glow.lineStyle(8, rarityColor.glow, 0.3);
    glow.strokeRoundedRect(-modalWidth / 2 - 4, -modalHeight / 2 - 4, modalWidth + 8, modalHeight + 8, 22);
    this.modalContainer.add(glow);

    let yOffset = -modalHeight / 2 + 25;

    // Изображение юнита (большое, всегда в полном цвете в модалке)
    const imageSize = 200;
    
    const textureKey = unit.assetKey;
    const hdKey = `${textureKey}_512`;
    const bestTextureKey = getRealUnitTextureKey(this, unit);

    // Пытаемся использовать текстуру (assetKey/id, включая возможные HD-алиасы)
    let imageAdded = false;
    if (bestTextureKey) {
      const unitImage = this.add.image(0, yOffset + imageSize / 2, bestTextureKey);
      unitImage.setDisplaySize(imageSize, imageSize);
      unitImage.setAlpha(1); // Всегда полный цвет в модалке
      this.modalContainer.add(unitImage);
      imageAdded = true;
    }
    
    if (!imageAdded) {
      // Fallback - показываем пустой прямоугольник
      const imageBg = this.add.rectangle(0, yOffset + imageSize / 2, imageSize, imageSize, 0x2a2a3e, 1);
      imageBg.setStrokeStyle(3, rarityColor.border, 1);
      this.modalContainer.add(imageBg);
      
      if (import.meta.env.DEV) {
        console.warn(`[CollectionScene] ⚠️ Texture not found in modal: "${textureKey}" (hdKey: "${hdKey}", unit.id="${unit.id}")`);
      }
    }

    yOffset += imageSize + 20;

    // Редкость (с фоном)
    const rarityBg = this.add.graphics();
    rarityBg.fillStyle(rarityColor.border, 0.2);
    rarityBg.fillRoundedRect(-modalWidth / 2 + 20, yOffset - 10, modalWidth - 40, 32, 8);
    this.modalContainer.add(rarityBg);

    const rarityText = this.add.text(0, yOffset + 6, `⭐ ${COLLECTION_RU.rarity[rarity].toUpperCase()}`, {
      fontSize: '16px',
      color: rarityColor.text,
      fontStyle: 'bold',
      fontFamily: getFonts().tech,
      stroke: rarityColor.shadow,
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.modalContainer.add(rarityText);

    // Премиум бейдж
    if (isPremium) {
      const premiumBadge = this.add.text(0, yOffset + 6, '💎 PREMIUM', {
        fontSize: '10px',
        fontFamily: getFonts().tech,
        color: '#fbbf24',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5);
      premiumBadge.setX(modalWidth / 2 - 60);
      this.modalContainer.add(premiumBadge);
    }

    yOffset += 38;

    // Название (с тенью)
    const titleText = this.add.text(0, yOffset, getDisplayName(unit), {
      fontFamily: getFonts().tech,
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: modalWidth - 50 },
      align: 'center',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.modalContainer.add(titleText);

    yOffset += 35;

    // Разделительная линия
    const separator1 = this.add.graphics();
    separator1.lineStyle(2, rarityColor.border, 0.3);
    separator1.lineBetween(-modalWidth / 2 + 30, yOffset, modalWidth / 2 - 30, yOffset);
    this.modalContainer.add(separator1);

    yOffset += 15;

    // Характеристики (компактно)
    const statsTitle = this.add.text(0, yOffset, COLLECTION_RU.stats.title, {
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: getFonts().tech,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.modalContainer.add(statsTitle);

    yOffset += 23;

    const stats = [
      { icon: '⚔️', name: COLLECTION_RU.stats.power, value: unit.stats.power },
      { icon: '🛡️', name: COLLECTION_RU.stats.defense, value: unit.stats.defense },
      { icon: '⚡', name: COLLECTION_RU.stats.speed, value: unit.stats.speed },
      { icon: '🎯', name: COLLECTION_RU.stats.technique, value: unit.stats.technique },
    ];

    stats.forEach(stat => {
      const statContainer = this.add.container(0, yOffset);
      
      const label = this.add.text(-modalWidth / 2 + 35, 0, `${stat.icon} ${stat.name}`, {
        fontSize: '13px',
        color: '#dddddd',
        fontFamily: getFonts().tech,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0, 0.5);
      statContainer.add(label);

      // Прогресс-бар (более широкий)
      const barWidth = 110;
      const barBg = this.add.graphics();
      barBg.fillStyle(0x2a2a3e, 1);
      barBg.fillRoundedRect(modalWidth / 2 - 130, -6, barWidth, 12, 6);
      statContainer.add(barBg);

      const barFill = this.add.graphics();
      barFill.fillStyle(rarityColor.border, 1);
      barFill.fillRoundedRect(modalWidth / 2 - 130, -6, (barWidth * stat.value) / 100, 12, 6);
      statContainer.add(barFill);

      const value = this.add.text(modalWidth / 2 - 15, 0, `${stat.value}`, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      statContainer.add(value);

      this.modalContainer!.add(statContainer);
      yOffset += 22;
    });

    yOffset += 8;

    // Пассивная способность (читаемое описание эффекта)
    if (u.passive?.description && u.passive.name) {
      const sepPassive = this.add.graphics();
      sepPassive.lineStyle(2, rarityColor.border, 0.3);
      sepPassive.lineBetween(-modalWidth / 2 + 30, yOffset, modalWidth / 2 - 30, yOffset);
      this.modalContainer.add(sepPassive);
      yOffset += 14;

      const passiveTitle = this.add.text(0, yOffset, `⚙ ${COLLECTION_RU.ui.passive}`, {
        fontSize: '14px',
        color: '#a78bfa',
        fontStyle: 'bold',
        fontFamily: getFonts().tech,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      this.modalContainer.add(passiveTitle);
      yOffset += 20;

      const passiveName = this.add.text(0, yOffset, u.passive.name, {
        fontSize: '13px',
        color: '#fbbf24',
        fontStyle: 'bold',
        fontFamily: getFonts().tech,
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: modalWidth - 60 },
        align: 'center',
      }).setOrigin(0.5, 0);
      this.modalContainer.add(passiveName);
      yOffset += passiveName.height + 6;

      const passiveDesc = this.add.text(0, yOffset, u.passive.description, {
        fontSize: '11px',
        color: '#d4d4d8',
        wordWrap: { width: modalWidth - 56 },
        align: 'center',
        lineSpacing: 4,
        stroke: '#000000',
        strokeThickness: 2,
        fontFamily: getFonts().tech,
      }).setOrigin(0.5, 0);
      this.modalContainer.add(passiveDesc);
      yOffset += passiveDesc.height + 14;
    }

    // Фирменный приём (короткая подпись)
    if (u.specialAbility) {
      const separator2 = this.add.graphics();
      separator2.lineStyle(2, rarityColor.border, 0.3);
      separator2.lineBetween(-modalWidth / 2 + 30, yOffset, modalWidth / 2 - 30, yOffset);
      this.modalContainer.add(separator2);

      yOffset += 15;

      const abilityTitle = this.add.text(0, yOffset, `✨ ${COLLECTION_RU.ui.signature}`, {
        fontSize: '14px',
        color: '#ffaa00',
        fontStyle: 'bold',
        fontFamily: getFonts().tech,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      this.modalContainer.add(abilityTitle);

      yOffset += 22;

      const abilityText = this.add.text(0, yOffset, u.specialAbility, {
        fontSize: '12px',
        color: '#cccccc',
        wordWrap: { width: modalWidth - 70 },
        align: 'center',
        lineSpacing: 3,
        stroke: '#000000',
        strokeThickness: 2,
      }).setOrigin(0.5, 0);
      this.modalContainer.add(abilityText);

      yOffset += abilityText.height + 15;
    }

    // Описание
    const separator3 = this.add.graphics();
    separator3.lineStyle(2, rarityColor.border, 0.3);
    separator3.lineBetween(-modalWidth / 2 + 30, yOffset, modalWidth / 2 - 30, yOffset);
    this.modalContainer.add(separator3);

    yOffset += 15;

    const descTitle = this.add.text(0, yOffset, `📖 ${COLLECTION_RU.ui.description}`, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: getFonts().tech,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.modalContainer.add(descTitle);

    yOffset += 20;

    const descText = this.add.text(0, yOffset, u.description, {
      fontSize: '11px',
      color: '#aaaaaa',
      wordWrap: { width: modalWidth - 70 },
      align: 'center',
      lineSpacing: 3,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5, 0);
    this.modalContainer.add(descText);

    yOffset += descText.height + 18;

    // Прогресс фрагментов (если не открыт) - вычисляем для обычных юнитов
    let progress = 0;
    if (!isOwned && !isPremium) {
      const currentFragments = playerData.getUnitFragments(unit.id);
      const requiredFragments = unit.fragmentsRequired;
      progress = currentFragments / requiredFragments;
    }

    // Прогресс фрагментов (если не открыт)
    if (!isOwned && !isPremium) {
      const separator4 = this.add.graphics();
      separator4.lineStyle(2, rarityColor.border, 0.3);
      separator4.lineBetween(-modalWidth / 2 + 30, yOffset, modalWidth / 2 - 30, yOffset);
      this.modalContainer.add(separator4);

      yOffset += 15;

      const currentFragments = playerData.getUnitFragments(unit.id);
      const requiredFragments = unit.fragmentsRequired;

      const fragTitle = this.add.text(0, yOffset, `🧩 ${COLLECTION_RU.ui.fragments}`, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        fontFamily: getFonts().tech,
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      this.modalContainer.add(fragTitle);

      yOffset += 25;

      const fragText = this.add.text(0, yOffset, `${currentFragments} / ${requiredFragments}`, {
        fontSize: '20px',
        color: progress >= 1 ? '#00ff00' : '#ffaa00',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      }).setOrigin(0.5);
      this.modalContainer.add(fragText);

      yOffset += 28;

      // Прогресс-бар фрагментов
      const progBarWidth = modalWidth - 80;
      const progBarBg = this.add.graphics();
      progBarBg.fillStyle(0x2a2a3e, 1);
      progBarBg.fillRoundedRect(-progBarWidth / 2, yOffset - 10, progBarWidth, 20, 10);
      progBarBg.lineStyle(2, 0x444444);
      progBarBg.strokeRoundedRect(-progBarWidth / 2, yOffset - 10, progBarWidth, 20, 10);
      this.modalContainer.add(progBarBg);

      const progBarFill = this.add.graphics();
      const fillColor = progress >= 1 ? 0x00ff00 : 0xffaa00;
      progBarFill.fillStyle(fillColor, 1);
      progBarFill.fillRoundedRect(
        -progBarWidth / 2 + 2,
        yOffset - 8,
        (progBarWidth - 4) * Math.min(progress, 1),
        16,
        8
      );
      this.modalContainer.add(progBarFill);

      yOffset += 18;
    }

    // ========== КНОПКА ДЕЙСТВИЯ ==========
    const btnY = modalHeight / 2 - 50;
    const btnW = modalWidth - 60;
    const btnH = 50;

    if (isOwned) {
      // ✅ OWNED - уже есть в коллекции
      const ownedBg = this.add.graphics();
      ownedBg.fillStyle(0x10b981, 0.2);
      ownedBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
      ownedBg.lineStyle(2, 0x10b981, 0.6);
      ownedBg.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
      this.modalContainer.add(ownedBg);
      
      this.modalContainer.add(this.add.text(0, btnY, '✓ IN COLLECTION', {
        fontSize: '16px',
        fontFamily: getFonts().tech,
        color: '#10b981',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
    } else if (isPremium) {
      // 💎 PREMIUM - покупка за кристаллы
      const btnColor = canAffordPremium ? 0xf59e0b : 0x444444;
      
      const buyBtnBg = this.add.graphics();
      buyBtnBg.fillStyle(btnColor, canAffordPremium ? 0.9 : 0.5);
      buyBtnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
      if (canAffordPremium) {
        buyBtnBg.lineStyle(2, 0xfbbf24, 0.6);
        buyBtnBg.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
      }
      this.modalContainer.add(buyBtnBg);
      
      this.modalContainer.add(this.add.text(0, btnY, `🔓 UNLOCK  💎 ${premiumPrice.toLocaleString()}`, {
        fontSize: '15px',
        fontFamily: getFonts().tech,
        color: canAffordPremium ? '#000000' : '#888888',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
      if (canAffordPremium) {
        const hitArea = this.add.rectangle(0, btnY, btnW, btnH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        this.modalContainer.add(hitArea);
        
        hitArea.on('pointerdown', () => {
          this.purchasePremiumUnit(unit, premiumPrice, this.modalContainer!, overlay);
        });
        
        hitArea.on('pointerover', () => {
          buyBtnBg.clear();
          buyBtnBg.fillStyle(0xfbbf24, 1);
          buyBtnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
        });
        
        hitArea.on('pointerout', () => {
          buyBtnBg.clear();
          buyBtnBg.fillStyle(btnColor, 0.9);
          buyBtnBg.fillRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
          buyBtnBg.lineStyle(2, 0xfbbf24, 0.6);
          buyBtnBg.strokeRoundedRect(-btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
        });
      } else {
        // Показываем сколько не хватает
        const crystals = playerData.get().crystals;
        const needed = premiumPrice - crystals;
        this.modalContainer.add(this.add.text(0, btnY + btnH / 2 + 15, `Need ${needed.toLocaleString()} more crystals`, {
          fontSize: '11px',
          color: '#ff6b6b',
        }).setOrigin(0.5));
      }
      
    } else if (!isOwned) {
      // Обычный юнит - показываем прогресс фрагментов и кнопку крафта
      // Статус и кнопка крафта
      if (progress >= 1) {
        // Кнопка СОБРАТЬ
        const craftButton = this.createButton(0, yOffset + 25, COLLECTION_RU.ui.craft, () => {
          if (playerData.craftUnit(unit.id, unit.fragmentsRequired)) {
            AudioManager.getInstance().playSFX('sfx_pack_open');
            hapticImpact('medium');
            this.showToast(COLLECTION_RU.ui.crafted || 'Собрано!');
            this.playCraftEffect();
            this.closeModal(overlay);
            this.renderUnitsGrid(); // Обновить сетку после крафта
            this.createFactionTabs(); // Обновить табы для прогресса
          } else {
            AudioManager.getInstance().playUIClick();
            hapticImpact('light');
          }
        }, '#22c55e');
        this.modalContainer.add(craftButton);
      } else {
        const needMoreText = this.add.text(0, yOffset, COLLECTION_RU.ui.needFragments, {
          fontSize: '13px',
          color: '#ffaa00',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        }).setOrigin(0.5);
        this.modalContainer.add(needMoreText);
      }
    }

    // Кнопка ЗАКРЫТЬ
    const closeBtn = this.createModalCloseButton(modalHeight, () => {
      if (this.modalContainer) {
        this.modalContainer.destroy();
        this.modalContainer = undefined;
      }
      overlay.destroy();
    });
    this.modalContainer.add(closeBtn);

    // Клик на overlay закрывает
    overlay.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      this.closeModal(overlay);
    });
    
    // Закрытие модалки также сбрасывает подсветку
    this.highlightedCard = undefined;

    this.add.existing(overlay);
  }

  /**
   * Покупка премиумного юнита за кристаллы
   */
  private purchasePremiumUnit(
    unit: RepoUnitData, 
    price: number, 
    modalContainer: Phaser.GameObjects.Container,
    overlay: Phaser.GameObjects.Rectangle
  ): void {
    const crystals = playerData.get().crystals;
    
    if (crystals < price) {
      this.showToast('Not enough crystals!', 0xff4444);
      return;
    }
    
    // Списываем кристаллы
    if (!playerData.spendCrystals(price)) {
      return;
    }
    
    // Разблокируем юнита
    playerData.unlockUnit(unit.id);
    
    // Звук и уведомление
    AudioManager.getInstance().playSFX('sfx_purchase');
    hapticImpact('medium');
    this.showToast(`${getDisplayName(unit)} разблокирован!`, 0x10b981);
    
    // Закрываем модалку
    this.tweens.add({
      targets: modalContainer,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        modalContainer.destroy();
        overlay.destroy();
        this.modalContainer = undefined;
        // Перерисовываем коллекцию
        this.time.delayedCall(250, () => {
          this.renderUnitsGrid();
          this.createFactionTabs();
        });
      }
    });
  }

  /**
   * Показывает превью Battle Pass юнита
   */
  private showBattlePassUnitPreview(unit: RepoUnitData): void {
    const preview = new BattlePassUnitPreview(
      this,
      unit,
      () => {
        // Callback для перехода в Battle Pass
        safeSceneStart(this, 'BattlePassScene');
      }
    );
    preview.show();
  }

  /**
   * Создает кнопку (для крафта и других действий)
   */
  private createButton(x: number, y: number, text: string, callback: () => void, color: string | number): Phaser.GameObjects.Container {
    const buttonWidth = 180;
    const buttonHeight = 44;
    const container = this.add.container(x, y);

    const bg = this.add.graphics();
    const colorNum = typeof color === 'string' ? Phaser.Display.Color.HexStringToColor(color).color : color;
    bg.fillStyle(colorNum, 1);
    bg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    bg.lineStyle(2, 0xffffff, 0.3);
    bg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    container.add(bg);

    const label = this.add.text(0, 0, text, {
      fontFamily: getFonts().tech,
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(label);

    const hitArea = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown()) {
        AudioManager.getInstance().playUIClick();
        hapticImpact('medium');
        callback();
      }
    });

    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 120,
        ease: 'Back.easeOut',
      });
    });

    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 120,
      });
    });

    return container;
  }

  /**
   * Создает кнопку ЗАКРЫТЬ (внизу модалки)
   */
  private createModalCloseButton(modalHeight: number, callback: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(0, modalHeight / 2 - 25); // Внизу модалки

    const bg = this.add.graphics();
    bg.fillStyle(0x4a9eff, 1);
    bg.fillRoundedRect(-70, -22, 140, 44, 22);
    
    // Тень кнопки
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.5);
    shadow.fillRoundedRect(-70 + 2, -22 + 2, 140, 44, 22);
    shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
    container.add(shadow);
    
    container.add(bg);

    const text = this.add.text(0, 0, COLLECTION_RU.ui.close, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      fontFamily: getFonts().tech,
      stroke: '#1e3a5f',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(text);

    const hitArea = this.add.rectangle(0, 0, 140, 44, 0, 0)
      .setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      this.highlightedCard = undefined; // Сбрасываем подсветку при закрытии
      callback();
    });

    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x66b3ff, 1);
      bg.fillRoundedRect(-70, -22, 140, 44, 22);
    });

    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x4a9eff, 1);
      bg.fillRoundedRect(-70, -22, 140, 44, 22);
    });

    return container;
  }

  /**
   * Настройка плавного скролла (как в магазине)
   */
  private setupScroll(): void {
    let lastPointerY = 0;

    // Поддержка колёсика мыши (для десктопа)
    this.input.on('wheel', (_: any, __: any, ___: number, dy: number) => {
      if (!this.modalContainer) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScrollY);
        this.scrollVelocity = 0;
        this.contentContainer.y = this.topOffset - this.scrollY;
      }
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.event) {
        pointer.event.preventDefault();
      }
      
      if (this.modalContainer) return;
      // ✅ ИСПРАВЛЕНО: Разрешаем старт перетаскивания ниже табов, но НЕ в зоне свайпа
      // Это позволяет свайпу работать по всей левой стороне, а не только в header
      if (pointer.y > this.topOffset && pointer.x > 80) {
        this.isDragging = true;
        this.dragStartY = pointer.y;
        this.scrollStartY = this.scrollY;
        lastPointerY = pointer.y;
        this.scrollVelocity = 0;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      // ✅ Блокируем нативный скролл / pull-to-refresh, скролл считаем в Phaser
      if (pointer.event && (pointer.event as any).cancelable) {
        pointer.event.preventDefault();
      }

      if (!this.isDragging || this.modalContainer) return;

      // Простой, стабильный скролл как в ShopScene
      const delta = lastPointerY - pointer.y;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
      this.scrollVelocity = delta * 0.5; // Небольшая инерция
      lastPointerY = pointer.y;
      this.contentContainer.y = this.topOffset - this.scrollY;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  /**
   * Обновление скролла с инерцией
   */
  /**
   * Обновление скролла с инерцией (стабильная версия как в ShopScene)
   */
  update(): void {
    if (this.modalContainer) return;

    // Инерция - применяется только когда не перетаскиваем
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.1) {
      this.scrollY += this.scrollVelocity;
      this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);
      this.scrollVelocity *= 0.9; // Трение
      this.contentContainer.y = this.topOffset - this.scrollY;
    } else if (!this.isDragging) {
      // Останавливаем, если скорость слишком мала
      this.scrollVelocity = 0;
    }
  }

  /**
   * Лёгкий тост в центре экрана
   */
  private showToast(text: string, color: number = 0x22c55e): void {
    if (this.toastContainer) {
      this.toastContainer.destroy();
    }
    const w = 260;
    const h = 46;
    const c = this.add.container(this.width / 2, this.height * 0.24);
    c.setDepth(2000);
    const bg = this.add.graphics();
    bg.fillStyle(0x0f172a, 0.92);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
    bg.lineStyle(2, color, 0.7);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    c.add(bg);

    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    const label = this.add.text(0, 0, text, {
      fontFamily: getFonts().tech,
      fontSize: '16px',
      color: colorHex,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    c.add(label);

    this.add.tween({
      targets: c,
      alpha: { from: 0, to: 1 },
      y: this.height * 0.22,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.add.tween({
          targets: c,
          alpha: 0,
          duration: 500,
          ease: 'Quad.easeIn',
          delay: 1400,
          onComplete: () => c.destroy(),
        });
      },
    });

    this.toastContainer = c;
  }

  /**
   * Небольшой эффект при успешном крафте (вспышка + конфетти)
   */
  private playCraftEffect(): void {
    const cx = this.width / 2;
    const cy = this.height / 2;

    // Более яркая вспышка
    const flash = this.add.rectangle(cx, cy, this.width, this.height, 0xffffff, 0.15)
      .setDepth(1500)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.add.tween({
      targets: flash,
      alpha: { from: 0.15, to: 0 },
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    // Улучшенный "конфетти" эффект
    const confetti = this.add.graphics();
    confetti.setDepth(1501);
    const colors = [0x22c55e, 0x38bdf8, 0xa855f7, 0xf59e0b, 0xfbbf24];
    
    for (let i = 0; i < 35; i++) {
      const angle = (i / 35) * Math.PI * 2;
      const distance = Phaser.Math.Between(40, 160);
      const x = cx + Math.cos(angle) * distance;
      const y = cy + Math.sin(angle) * distance;
      const size = Phaser.Math.Between(5, 10);
      confetti.fillStyle(colors[i % colors.length], 1);
      confetti.fillCircle(x, y, size);
    }
    
    // Анимация разлета конфетти
    this.add.tween({
      targets: confetti,
      y: cy + 80,
      alpha: { from: 1, to: 0 },
      duration: 800,
      ease: 'Cubic.easeOut',
      onComplete: () => confetti.destroy(),
    });
  }

  /**
   * ✅ ИЗМЕНЕНО (2026-01-23): Выгрузка текстур при выходе из сцены
   * 
   * ⚠️ ВАЖНО: НЕ удаляем текстуры!
   * Причина: TextureMemoryManager не работает (не регистрирует текстуры)
   * GameScene сам управляет памятью - в браузере удаляет ненужные, в Telegram оставляет все
   */
  shutdown(): void {
    console.log('[CollectionScene] shutdown - cleaning up');
    this.unitPngLoadToken++;
    
    // ✅ FIX 2026-01-23: НЕ удаляем текстуры - GameScene управляет памятью
    // В Telegram: текстуры нужны для AI (случайный выбор юнитов)
    // В браузере: GameScene удалит ненужные автоматически
    
    // Cleanup UI
    this.swipeManager?.destroy();
    this.swipeManager = undefined;
    this.contentContainer.removeAll(true);
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();

    destroyAssetLoadingBackdrop(this.preloadBackdropObjs);
    this.preloadBackdropObjs = [];
  }
}
