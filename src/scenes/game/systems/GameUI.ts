// src/scenes/game/systems/GameUI.ts
// Система UI для карточек способностей

import Phaser from 'phaser';
import { AbilityManager } from '../AbilityManager';
import { AudioManager } from '../../../managers/AudioManager';
import { HapticManager } from '../HapticManager';
import { CARD_TEXT_RU, UI_RU, getTargetHintRU } from '../../../localization/cardTexts';
import { getCard, CardTargetType } from '../../../data/CardsCatalog';

export interface GameUIConfig {
  scene: Phaser.Scene;
  abilityManager: AbilityManager;
  onCardTooltipStateChange?: (isOpen: boolean) => void;
}

/**
 * Система UI для карточек способностей
 * Отвечает за отображение панели карточек, тултипов, кулдаунов
 */
export class GameUI {
  private scene: Phaser.Scene;
  private abilityManager: AbilityManager;
  private config: GameUIConfig;
  
  // UI элементы
  private cardPanel?: Phaser.GameObjects.Container;
  private cooldownText?: Phaser.GameObjects.Text;
  private cooldownTimer?: Phaser.Time.TimerEvent;
  private cardInfoPopup?: Phaser.GameObjects.Container;
  
  // Состояние
  private selectedCardSlotIndex: number | null = null;
  private isCardTooltipOpen: boolean = false;
  
  constructor(config: GameUIConfig) {
    this.scene = config.scene;
    this.abilityManager = config.abilityManager;
    this.config = config;
  }
  
  /**
   * Создание панели карточек
   */
  createCardPanel(): void {
    const { width, height } = this.scene.cameras.main;
    this.cardPanel = this.scene.add.container(width / 2, height - 80);
    this.cardPanel.setDepth(150);
    this.updateCardPanelUI();
  }
  
  /**
   * Обновление UI панели карточек
   */
  updateCardPanelUI(): void {
    if (!this.cardPanel) return;
    
    // Сохраняем выбор перед перестроением
    const savedSelection = this.selectedCardSlotIndex;
    const savedCardId = savedSelection !== null && savedSelection >= 0 
      ? this.abilityManager.getDeck()[savedSelection]?.cardId 
      : null;
    
    this.cardPanel.removeAll(true);

    const availableCards = this.abilityManager.getAvailableCards();
    const deck = this.abilityManager.getDeck();
    const cooldownRemaining = this.abilityManager.getCooldownRemaining();
    
    const cardWidth = 60;
    const cardHeight = 80;
    const spacing = 10;
    const totalWidth = deck.length * (cardWidth + spacing) - spacing;
    const startX = -totalWidth / 2 + cardWidth / 2;

    deck.forEach((slot, index) => {
      const x = startX + index * (cardWidth + spacing);
      const cardContainer = this.createCardSlotUI(x, 0, slot, index, cooldownRemaining);
      cardContainer.setName(`card_slot_${index}`);
      this.cardPanel!.add(cardContainer);
    });

    // Отображение глобального кулдауна
    if (cooldownRemaining > 0) {
      this.cooldownText = this.scene.add.text(0, -50, `⏱ ${cooldownRemaining}s`, {
        fontSize: '16px',
        color: '#ff6b6b',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.cardPanel.add(this.cooldownText);
    }

    const hasCards = availableCards.length > 0;
    this.cardPanel.setVisible(hasCards || cooldownRemaining > 0);
    
    // Восстанавливаем выбор после перестроения
    if (savedSelection !== null && savedSelection >= 0 && savedSelection < deck.length) {
      const slot = deck[savedSelection];
      if (slot?.cardId === savedCardId) {
        this.selectedCardSlotIndex = savedSelection;
        const card = getCard(slot.cardId);
        if (card) {
          const panelWorldX = this.cardPanel.x + startX + savedSelection * (cardWidth + spacing);
          const panelWorldY = this.cardPanel.y;
          this.applyCardSlotSelectionVisuals();
          
          if (cooldownRemaining === 0) {
            this.showCardInfo(savedSelection, card.id, panelWorldX, panelWorldY);
          }
        }
      } else {
        this.selectedCardSlotIndex = null;
      }
    }
  }
  
  /**
   * Создание UI слота карточки
   */
  private createCardSlotUI(
    x: number, 
    y: number, 
    slot: { cardId: string | null; used: boolean }, 
    slotIndex: number,
    cooldownRemaining: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    container.setName(`card_slot_${slotIndex}`);
    const cardWidth = 60;
    const cardHeight = 80;
    
    const isOnCooldown = cooldownRemaining > 0;
    const isActivating = this.abilityManager.isActivating();
    const pendingCardId = (this.abilityManager as any).pendingCardId;

    if (!slot.cardId || slot.used) {
      // Пустой слот
      const emptyBg = this.scene.add.graphics();
      emptyBg.fillStyle(0x333333, 0.5);
      emptyBg.fillRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 8);
      emptyBg.lineStyle(2, 0x555555, 0.5);
      emptyBg.strokeRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 8);
      container.add(emptyBg);
      
      if (slot.used) {
        const usedText = this.scene.add.text(0, 0, '✓', { 
          fontSize: '24px', 
          color: '#666666' 
        }).setOrigin(0.5);
        container.add(usedText);
      }
    } else {
      const card = getCard(slot.cardId);
      if (!card) return container;

      const rarityColors: Record<string, number> = {
        common: 0x6b7280,
        rare: 0x3b82f6,
        epic: 0x8b5cf6,
      };
      const color = rarityColors[card.rarity] || 0x6b7280;

      // Фон карты
      const bg = this.scene.add.graphics();
      const bgAlpha = isOnCooldown ? 0.5 : 0.95;
      bg.fillStyle(0x1a1a2e, bgAlpha);
      bg.fillRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 8);
      
      // Рамка - жёлтая если эта карта активируется
      if (isActivating && pendingCardId === card.id) {
        bg.lineStyle(4, 0xffff00, 1);
      } else if (isOnCooldown) {
        bg.lineStyle(2, 0x666666, 0.5);
      } else {
        bg.lineStyle(2, color, 0.8);
      }
      bg.strokeRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 8);
      container.add(bg);

      // Иконка карты
      const iconKey = `card_${card.id}`;
      if (this.scene.textures.exists(iconKey)) {
        const icon = this.scene.add.image(0, -5, iconKey).setDisplaySize(40, 40);
        if (isOnCooldown) icon.setAlpha(0.5);
        container.add(icon);
      } else {
        const symbol = this.scene.add.text(0, -5, this.getCardSymbol(card.id), { 
          fontSize: '24px',
          color: isOnCooldown ? '#666666' : '#ffffff',
        }).setOrigin(0.5);
        container.add(symbol);
      }

      // Оверлей кулдауна
      if (isOnCooldown) {
        const cooldownOverlay = this.scene.add.graphics();
        cooldownOverlay.fillStyle(0x000000, 0.6);
        cooldownOverlay.fillRoundedRect(-cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 8);
        container.add(cooldownOverlay);
        
        const cdText = this.scene.add.text(0, 0, `${cooldownRemaining}`, {
          fontSize: '20px',
          color: '#ff6b6b',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        container.add(cdText);
      }

      // Интерактивная зона
      const hitArea = this.scene.add.rectangle(0, 0, cardWidth, cardHeight, 0, 0)
        .setInteractive({ useHandCursor: !isOnCooldown });
      container.add(hitArea);

      // Обработка тапов и long-press
      this.setupCardInteraction(hitArea, container, card, slotIndex, isOnCooldown, cooldownRemaining);
    }
    
    return container;
  }
  
  /**
   * Настройка интерактивности карточки
   */
  private setupCardInteraction(
    hitArea: Phaser.GameObjects.Rectangle,
    container: Phaser.GameObjects.Container,
    card: ReturnType<typeof getCard>,
    slotIndex: number,
    isOnCooldown: boolean,
    cooldownRemaining: number
  ): void {
    let downAt = 0;
    let longPressTimer: Phaser.Time.TimerEvent | null = null;
    let longPressed = false;
    const LONG_PRESS_MS = 300;

    const clearLongPress = () => {
      if (longPressTimer) {
        longPressTimer.remove(false);
        longPressTimer = null;
      }
    };

    hitArea.on('pointerdown', () => {
      if (isOnCooldown) {
        HapticManager.trigger('error');
        this.showCooldownFeedback();
        this.showCardTooltip(container, card, slotIndex, cooldownRemaining);
        return;
      }

      downAt = Date.now();
      longPressed = false;
      clearLongPress();

      longPressTimer = this.scene.time.addEvent({
        delay: LONG_PRESS_MS,
        callback: () => {
          longPressed = true;
          this.setCardTooltipOpen(true);
          this.showCardTooltip(container, card, slotIndex);
          
          this.scene.tweens.add({
            targets: container,
            scaleX: 1.12,
            scaleY: 1.12,
            duration: 80,
            ease: 'Cubic.easeOut',
          });
        },
      });
    });

    hitArea.on('pointerup', () => {
      clearLongPress();

      if (longPressed) {
        return;
      }

      if (isOnCooldown) return;

      if (this.abilityManager.isActivating()) {
        this.abilityManager.cancelActivation();
      } else if (this.abilityManager.canActivateCard(slotIndex)) {
        AudioManager.getInstance().playSFX('sfx_click');
        HapticManager.trigger('light');
        this.abilityManager.startCardActivation(slotIndex);
      }
    });

    hitArea.on('pointerout', () => {
      clearLongPress();
      this.hideCardTooltip();
      this.setCardTooltipOpen(false);
      container.setScale(1);
    });

    hitArea.on('pointerupoutside', () => {
      clearLongPress();
      this.hideCardTooltip();
      this.setCardTooltipOpen(false);
      container.setScale(1);
    });
  }
  
  /**
   * Визуальный фидбек при попытке использовать карту на кулдауне
   */
  private showCooldownFeedback(): void {
    if (!this.cardPanel) return;
    
    this.scene.tweens.add({
      targets: this.cardPanel,
      x: this.cardPanel.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
    });
  }
  
  /**
   * Запуск таймера обновления UI кулдауна
   */
  startCooldownTimer(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
    }

    this.cooldownTimer = this.scene.time.addEvent({
      delay: 1000,
      callback: () => {
        const remaining = this.abilityManager.getCooldownRemaining();
        
        if (!this.isCardTooltipOpen) {
          if (remaining > 0) {
            this.updateCardPanelUI();
          } else {
            this.cooldownTimer?.destroy();
            this.cooldownTimer = undefined;
            this.updateCardPanelUI();
          }
        }
      },
      loop: true,
    });
  }
  
  /**
   * Получение символа карты
   */
  private getCardSymbol(cardId: string): string {
    const symbols: Record<string, string> = {
      magma_lava: '🌋', magma_molten: '🔥', magma_meteor: '☄️',
      cyborg_shield: '🛡️', cyborg_tether: '⚡', cyborg_barrier: '🧱',
      void_swap: '🔄', void_ghost: '👻', void_wormhole: '🌀',
      insect_toxin: '☣️', insect_mimic: '🎭', insect_parasite: '🧠',
      frost_freeze: '❄️', frost_blizzard: '🌨️', frost_icicle: '🧊',
    };
    return symbols[cardId] || '✦';
  }
  
  /**
   * Показ тултипа карточки
   */
  private showCardTooltip(
    cardContainer: Phaser.GameObjects.Container,
    card: ReturnType<typeof getCard>,
    slotIndex: number,
    cooldownSeconds?: number
  ): void {
    if (!card) return;

    const panelWorldX = this.cardPanel!.x + cardContainer.x;
    const panelWorldY = this.cardPanel!.y + cardContainer.y;
    
    this.showCardInfo(slotIndex, card.id, panelWorldX, panelWorldY, cooldownSeconds);
  }
  
  /**
   * Показ информации о карте
   */
  private showCardInfo(
    slotIndex: number, 
    cardId: string, 
    worldX: number, 
    worldY: number, 
    cooldownSeconds?: number
  ): void {
    this.hideCardInfo();

    const card = getCard(cardId);
    if (!card) return;

    const cardText = CARD_TEXT_RU[cardId];
    const name = cardText?.name || card.name;
    const desc = cardText?.desc || card.description || 'Описание недоступно';
    const targetHint = cardText?.target || getTargetHintRU(card.targetType);

    const { width, height } = this.scene.cameras.main;
    
    const panelY = height - 80;
    const popupY = panelY - 140;
    const popupX = Math.max(150, Math.min(width - 150, worldX));
    
    const popupWidth = Math.min(300, width - 40);
    const popupPadding = 16;

    this.cardInfoPopup = this.scene.add.container(popupX, popupY);
    this.cardInfoPopup.setDepth(200);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.95);
    bg.fillRoundedRect(-popupWidth/2, -60, popupWidth, 120, 12);
    bg.lineStyle(2, 0x3b82f6, 0.8);
    bg.strokeRoundedRect(-popupWidth/2, -60, popupWidth, 120, 12);
    this.cardInfoPopup.add(bg);

    // Название
    const nameText = this.scene.add.text(0, -40, name, {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffffff',
      wordWrap: { width: popupWidth - 2 * popupPadding },
    }).setOrigin(0.5, 0);
    this.cardInfoPopup.add(nameText);

    // Описание
    const descText = this.scene.add.text(0, -15, desc, {
      fontSize: '14px',
      color: '#d1d5db',
      wordWrap: { width: popupWidth - 2 * popupPadding },
    }).setOrigin(0.5, 0);
    this.cardInfoPopup.add(descText);

    // Цель
    if (targetHint) {
      const targetText = this.scene.add.text(0, 20, `🎯 ${targetHint}`, {
        fontSize: '12px',
        color: '#9ca3af',
        wordWrap: { width: popupWidth - 2 * popupPadding },
      }).setOrigin(0.5, 0);
      this.cardInfoPopup.add(targetText);
    }

    // Кулдаун
    if (cooldownSeconds !== undefined && cooldownSeconds > 0) {
      const cdText = this.scene.add.text(0, 45, `⏱ ${UI_RU.cooldown}: ${cooldownSeconds}s`, {
        fontSize: '12px',
        color: '#ff6b6b',
      }).setOrigin(0.5, 0);
      this.cardInfoPopup.add(cdText);
    }
  }
  
  /**
   * Скрытие тултипа карточки
   */
  private hideCardTooltip(): void {
    this.hideCardInfo();
  }
  
  /**
   * Скрытие информации о карте
   */
  private hideCardInfo(): void {
    if (this.cardInfoPopup) {
      this.cardInfoPopup.destroy();
      this.cardInfoPopup = undefined;
    }
  }
  
  /**
   * Применение визуалов выбора слота карты
   */
  private applyCardSlotSelectionVisuals(): void {
    if (!this.cardPanel || this.selectedCardSlotIndex === null) return;
    
    const slotContainer = this.cardPanel.getByName(`card_slot_${this.selectedCardSlotIndex}`) as Phaser.GameObjects.Container;
    if (slotContainer) {
      this.scene.tweens.add({
        targets: slotContainer,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 150,
        ease: 'Back.easeOut',
      });
    }
  }
  
  /**
   * Выбор слота карты
   */
  selectCardSlot(slotIndex: number, cardId: string, x: number, y: number): void {
    this.selectedCardSlotIndex = slotIndex;
    this.applyCardSlotSelectionVisuals();
    this.showCardInfo(slotIndex, cardId, x, y);
  }
  
  /**
   * Установка состояния тултипа
   */
  private setCardTooltipOpen(isOpen: boolean): void {
    this.isCardTooltipOpen = isOpen;
    
    if (this.config.onCardTooltipStateChange) {
      this.config.onCardTooltipStateChange(isOpen);
    }
  }
  
  /**
   * Получение панели карточек
   */
  getCardPanel(): Phaser.GameObjects.Container | undefined {
    return this.cardPanel;
  }
  
  /**
   * Проверка, открыт ли тултип
   */
  isTooltipOpen(): boolean {
    return this.isCardTooltipOpen;
  }
  
  /**
   * Очистка
   */
  cleanup(): void {
    if (this.cooldownTimer) {
      this.cooldownTimer.destroy();
      this.cooldownTimer = undefined;
    }
    
    this.hideCardInfo();
    
    if (this.cardPanel) {
      this.cardPanel.destroy();
      this.cardPanel = undefined;
    }
  }
}
