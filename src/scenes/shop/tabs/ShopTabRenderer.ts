// src/scenes/shop/tabs/ShopTabRenderer.ts
// Базовый класс для рендеринга вкладок магазина

import Phaser from 'phaser';
import { getColors, hexToString } from '../../../config/themes';
import { playerData } from '../../../data/PlayerData';

export interface CardData {
  id: string;
  name: string;
  description?: string;
  price: { coins?: number; crystals?: number };
  owned: boolean;
  purchaseHandler: () => void;
}

/**
 * Базовый класс для рендеринга вкладок магазина
 */
export abstract class ShopTabRenderer {
  protected scene: Phaser.Scene;
  protected container: Phaser.GameObjects.Container;
  
  constructor(scene: Phaser.Scene, container: Phaser.GameObjects.Container) {
    this.scene = scene;
    this.container = container;
  }
  
  /**
   * Абстрактный метод для рендеринга контента вкладки
   */
  abstract render(): void;
  
  /**
   * Создание карточки товара
   */
  protected createItemCard(
    x: number,
    y: number,
    cardData: CardData,
    cardWidth: number = 180,
    cardHeight: number = 220
  ): Phaser.GameObjects.Container {
    const colors = getColors();
    const card = this.scene.add.container(x, y);
    
    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(colors.uiBackground, 0.8);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
    bg.lineStyle(2, cardData.owned ? 0x4ade80 : colors.uiPrimary, 0.5);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
    card.add(bg);
    
    // Название
    const nameText = this.scene.add.text(0, -cardHeight / 2 + 20, cardData.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: cardWidth - 20 },
    }).setOrigin(0.5);
    card.add(nameText);
    
    // Цена
    const priceY = cardHeight / 2 - 30;
    const priceText = this.scene.add.text(0, priceY, this.formatPrice(cardData.price), {
      fontSize: '16px',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    priceText.setColor(hexToString(colors.uiPrimary));
    card.add(priceText);
    
    // Кнопка покупки / Owned
    const buttonY = cardHeight / 2 - 10;
    
    if (cardData.owned) {
      const ownedText = this.scene.add.text(0, buttonY, '✓ Owned', {
        fontSize: '12px',
        color: '#4ade80',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      card.add(ownedText);
    } else {
      const buyButton = this.createBuyButton(0, buttonY, cardWidth - 40, cardData);
      card.add(buyButton);
    }
    
    return card;
  }
  
  /**
   * Создание кнопки покупки
   */
  protected createBuyButton(
    x: number,
    y: number,
    width: number,
    cardData: CardData
  ): Phaser.GameObjects.Container {
    const colors = getColors();
    const button = this.scene.add.container(x, y);
    
    // Фон кнопки
    const bg = this.scene.add.rectangle(0, 0, width, 30, colors.uiAccent, 0.8)
      .setInteractive({ useHandCursor: true })
      .setStrokeStyle(2, colors.uiSecondary);
    button.add(bg);
    
    // Текст
    const text = this.scene.add.text(0, 0, 'Buy', {
      fontSize: '14px',
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    button.add(text);
    
    // Интерактивность
    bg.on('pointerdown', () => {
      cardData.purchaseHandler();
    });
    
    bg.on('pointerover', () => {
      bg.setFillStyle(0x33f5ff);
    });
    
    bg.on('pointerout', () => {
      bg.setFillStyle(colors.uiAccent, 0.8);
    });
    
    return button;
  }
  
  /**
   * Форматирование цены
   */
  protected formatPrice(price: { coins?: number; crystals?: number }): string {
    if (price.crystals) {
      return `💎 ${price.crystals}`;
    }
    if (price.coins) {
      return `🪙 ${price.coins}`;
    }
    return 'Free';
  }
  
  /**
   * Очистка контейнера
   */
  clear(): void {
    this.container.removeAll(true);
  }
}
