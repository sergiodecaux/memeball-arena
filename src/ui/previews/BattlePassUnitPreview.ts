// src/ui/previews/BattlePassUnitPreview.ts
// Превью для Battle Pass юнитов в коллекции

import Phaser from 'phaser';
import { getFonts } from '../../config/themes';
import { getDisplayName } from '../../data/UnitsRepository';
import { getRealUnitTextureKey } from '../../utils/TextureHelpers';

const RARITY_COLORS: Record<string, number> = {
  common: 0x9ca3af, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf59e0b,
};

export class BattlePassUnitPreview {
  private scene: Phaser.Scene;
  private unit: any;
  private onGoToBattlePass: () => void;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, unit: any, onGoToBattlePass: () => void) {
    this.scene = scene;
    this.unit = unit;
    this.onGoToBattlePass = onGoToBattlePass;
  }

  show(): void {
    const { width, height } = this.scene.scale;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();
    const rarityColor = RARITY_COLORS[this.unit.rarity] || 0x9ca3af;
    
    // Затемнение
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', () => this.hide());
    
    // Контейнер
    this.container = this.scene.add.container(width / 2, height / 2);
    this.container.setDepth(1000);
    
    const cardW = Math.min(width - 40, 320) * s;
    const cardH = 480 * s;
    
    // Фон
    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0x1e1b4b, 0x1e1b4b, 0x0f172a, 0x0f172a, 1);
    bg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
    bg.lineStyle(3, rarityColor, 1);
    bg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
    this.container.add(bg);
    
    // BP бейдж
    const bpBg = this.scene.add.graphics();
    bpBg.fillStyle(0xa855f7, 1);
    bpBg.fillRoundedRect(-70 * s, -cardH / 2 - 15 * s, 140 * s, 30 * s, 15 * s);
    this.container.add(bpBg);
    
    this.container.add(this.scene.add.text(0, -cardH / 2, '🎫 BATTLE PASS', {
      fontSize: `${14 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    // === ИЗОБРАЖЕНИЕ ЮНИТА ===
    const imageY = -cardH / 2 + 110 * s;
    const imageSize = 140 * s;
    
    // Свечение
    const glow = this.scene.add.graphics();
    glow.fillStyle(rarityColor, 0.25);
    glow.fillCircle(0, imageY, imageSize / 2 + 15 * s);
    this.container.add(glow);
    
    this.scene.tweens.add({
      targets: glow, 
      alpha: { from: 0.2, to: 0.45 }, 
      scale: { from: 1, to: 1.1 },
      duration: 1200, 
      yoyo: true, 
      repeat: -1,
    });
    
    // PNG юнита (только реальное изображение, как в магазине)
    const textureKey =
      this.unit?.id && this.unit?.assetKey
        ? getRealUnitTextureKey(this.scene, { id: this.unit.id, assetKey: this.unit.assetKey })
        : null;
    
    if (textureKey) {
      const unitImage = this.scene.add.image(0, imageY, textureKey);
      unitImage.setDisplaySize(imageSize, imageSize);
      this.container.add(unitImage);
      
      // Лёгкое покачивание
      this.scene.tweens.add({
        targets: unitImage,
        y: imageY - 6,
        duration: 2000,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    } else {
      // Fallback
      console.warn(`[Preview] Texture not found: ${this.unit.assetKey}`);
      const placeholder = this.scene.add.graphics();
      placeholder.fillStyle(rarityColor, 0.4);
      placeholder.fillCircle(0, imageY, imageSize / 2);
      this.container.add(placeholder);
      
      this.container.add(this.scene.add.text(0, imageY, '?', { 
        fontSize: `${56 * s}px`, 
        color: '#ffffff' 
      }).setOrigin(0.5));
    }
    
    // Имя
    const nameY = imageY + imageSize / 2 + 30 * s;
    this.container.add(this.scene.add.text(0, nameY, getDisplayName(this.unit).toUpperCase(), {
      fontSize: `${22 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    this.container.add(this.scene.add.text(0, nameY + 28 * s, this.unit.title, {
      fontSize: `${14 * s}px`, fontFamily: fonts.primary, color: '#94a3b8',
    }).setOrigin(0.5));
    
    // Инфо о получении
    const infoY = cardH / 2 - 100 * s;
    const infoBg = this.scene.add.graphics();
    infoBg.fillStyle(0x1e293b, 1);
    infoBg.fillRoundedRect(-cardW / 2 + 20, infoY - 20, cardW - 40, 50, 12);
    infoBg.lineStyle(2, 0xa855f7, 0.5);
    infoBg.strokeRoundedRect(-cardW / 2 + 20, infoY - 20, cardW - 40, 50, 12);
    this.container.add(infoBg);
    
    this.container.add(this.scene.add.text(0, infoY + 5, `Получите на Tier ${this.unit.battlePassTier}`, {
      fontSize: `${13 * s}px`, fontFamily: fonts.primary, color: '#c4b5fd',
    }).setOrigin(0.5));
    
    const isPremium = this.unit.battlePassTier !== 5;
    this.container.add(this.scene.add.text(0, infoY + 25, isPremium ? '👑 Premium награда' : '🆓 Бесплатная награда', {
      fontSize: `${11 * s}px`, fontFamily: fonts.primary, color: isPremium ? '#ffd700' : '#38bdf8',
    }).setOrigin(0.5));
    
    // Кнопка
    const btnY = cardH / 2 - 35 * s;
    const btnW = cardW - 60;
    const btnH = 44 * s;
    
    const btnContainer = this.scene.add.container(0, btnY);
    
    const btnBg = this.scene.add.graphics();
    btnBg.fillGradientStyle(0xa855f7, 0xa855f7, 0x7c3aed, 0x7c3aed, 1);
    btnBg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 22);
    btnContainer.add(btnBg);
    
    btnContainer.add(this.scene.add.text(0, 0, '🎫 ПЕРЕЙТИ В BATTLE PASS →', {
      fontSize: `${14 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    btnContainer.setSize(btnW, btnH);
    btnContainer.setInteractive({ useHandCursor: true });
    btnContainer.on('pointerdown', () => { this.hide(); this.onGoToBattlePass(); });
    
    this.container.add(btnContainer);
    
    // Закрыть
    const closeBtn = this.scene.add.text(cardW / 2 - 15, -cardH / 2 + 15, '✕', {
      fontSize: `${24 * s}px`, color: '#64748b',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);
    
    // Анимация
    this.container.setScale(0).setAlpha(0);
    this.overlay.setAlpha(0);
    
    this.scene.tweens.add({ targets: this.overlay, alpha: 1, duration: 200 });
    this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 400, ease: 'Back.easeOut' });
  }

  hide(): void {
    this.scene.tweens.add({
      targets: [this.container, this.overlay], alpha: 0, scale: 0.8, duration: 200,
      onComplete: () => { this.container?.destroy(); this.overlay?.destroy(); },
    });
  }
}
