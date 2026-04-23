// src/scenes/shop/tabs/CardsTab.ts
// Вкладка с бустерами и сундуками (упрощённая версия)

import Phaser from 'phaser';
import { ShopTabRenderer, CardData } from './ShopTabRenderer';
import { getColors } from '../../../config/themes';
import { playerData } from '../../../data/PlayerData';

/**
 * Рендерер вкладки карточек (бустеры и сундуки)
 */
export class CardsTab extends ShopTabRenderer {
  render(): void {
    this.clear();
    
    const colors = getColors();
    const data = playerData.get();
    
    // Заголовок
    const title = this.scene.add.text(0, -200, 'Cards & Boosters', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Заглушка
    const comingSoon = this.scene.add.text(0, 0, 'Coming Soon', {
      fontSize: '18px',
      color: colors.uiTextSecondary.toString(16),
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(comingSoon);
  }
}
