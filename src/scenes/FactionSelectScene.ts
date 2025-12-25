// src/scenes/FactionSelectScene.ts
// Адаптивный экран выбора фракции для Telegram Mini App

import Phaser from 'phaser';
import { FACTIONS, FACTION_IDS, FactionId } from '../constants/gameConstants';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { getFonts } from '../config/themes';
import { tgApp } from '../utils/TelegramWebApp';

export class FactionSelectScene extends Phaser.Scene {
  private selectedFaction: FactionId = 'cyborg';
  private factionCards: Map<FactionId, Phaser.GameObjects.Container> = new Map();
  private confirmButton?: Phaser.GameObjects.Container;
  
  private s: number = 1; // UI scale
  
  constructor() {
    super({ key: 'FactionSelectScene' });
  }

  create(): void {
    // Вычисляем масштаб UI
    this.s = tgApp.getUIScale();
    
    const { width, height } = this.scale;
    const viewport = tgApp.getViewport();
    
    console.log(`[FactionSelect] Screen: ${width}x${height}, Scale: ${this.s.toFixed(2)}, Platform: ${viewport.platform}`);
    
    AudioManager.getInstance().init(this);
    AudioManager.getInstance().playMusic('bgm_menu');
    
    this.createBackground();
    this.createTitle();
    this.createFactionCards();
    this.createConfirmButton();
    this.selectFaction('cyborg');
  }

  private createBackground(): void {
    const { width, height } = this.scale;
    
    // Простой фон
    this.add.rectangle(width/2, height/2, width, height, 0x0a0a15);
    
    // Звёзды
    const starCount = Math.floor(20 * this.s);
    for (let i = 0; i < starCount; i++) {
      this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.FloatBetween(0.5, 1),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.4)
      );
    }
  }

  private createTitle(): void {
    const { width } = this.scale;
    const s = this.s;
    
    const titleY = 18 * s;
    
    this.add.text(width / 2, titleY, 'SELECT FACTION', {
      fontSize: `${16 * s}px`,
      fontFamily: getFonts().tech,
      color: '#ffffff',
    }).setOrigin(0.5);
  }

  private createFactionCards(): void {
    const { width, height } = this.scale;
    const s = this.s;
    
    // Адаптивные размеры
    const padding = 8 * s;
    const gap = 5 * s;
    const availableWidth = width - padding * 2;
    const cardWidth = Math.floor((availableWidth - gap) / 2);
    
    // Высота карточки зависит от доступного пространства
    const titleHeight = 35 * s;
    const buttonHeight = 45 * s;
    const availableHeight = height - titleHeight - buttonHeight - padding * 2;
    const cardHeight = Math.floor((availableHeight - gap) / 2);
    
    const startX = padding + cardWidth / 2;
    const startY = titleHeight + cardHeight / 2;
    
    console.log(`[FactionSelect] Cards: ${cardWidth.toFixed(0)}x${cardHeight.toFixed(0)}`);
    
    FACTION_IDS.forEach((factionId, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + col * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);
      
      const card = this.createCard(factionId, x, y, cardWidth, cardHeight);
      this.factionCards.set(factionId, card);
    });
  }

  private createCard(
    factionId: FactionId, 
    x: number, 
    y: number, 
    w: number, 
    h: number
  ): Phaser.GameObjects.Container {
    const faction = FACTIONS[factionId];
    const s = this.s;
    const container = this.add.container(x, y);
    
    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x15152a, 1);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 6 * s);
    bg.lineStyle(2, faction.color, 0.6);
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 6 * s);
    container.add(bg);
    
    // Иконка - адаптивный размер
    const iconSize = Math.min(w * 0.5, h * 0.45);
    const iconY = -h/2 + iconSize/2 + 6 * s;
    
    if (this.textures.exists(faction.assetKey)) {
      const icon = this.add.image(0, iconY, faction.assetKey);
      icon.setDisplaySize(iconSize, iconSize);
      container.add(icon);
    } else {
      container.add(this.add.circle(0, iconY, iconSize/2, faction.color));
    }
    
    // Название
    const names: Record<FactionId, string> = {
      magma: 'MAGMA',
      cyborg: 'CYBORG', 
      void: 'VOID',
      insect: 'SWARM',
    };
    
    const nameSize = Math.max(7, Math.min(10, w / 9)) * s;
    container.add(this.add.text(0, iconY + iconSize/2 + 6 * s, names[factionId], {
      fontSize: `${nameSize}px`,
      fontFamily: getFonts().tech,
      color: '#ffffff',
    }).setOrigin(0.5));
    
    // Характеристика
    const traits: Record<FactionId, string> = {
      magma: '🛡DEF',
      cyborg: '⚖BAL',
      void: '🌀CTR',
      insect: '⚡SPD',
    };
    
    const traitSize = Math.max(6, Math.min(8, w / 11)) * s;
    container.add(this.add.text(0, h/2 - 8 * s, traits[factionId], {
      fontSize: `${traitSize}px`,
      fontFamily: getFonts().tech,
      color: '#' + faction.color.toString(16).padStart(6, '0'),
    }).setOrigin(0.5));
    
    // Интерактивность
    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    container.add(hitArea);
    
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      tgApp.hapticSelection();
      this.selectFaction(factionId);
    });
    
    (container as any)._w = w;
    (container as any)._h = h;
    
    return container;
  }

  private createConfirmButton(): void {
    const { width, height } = this.scale;
    const s = this.s;
    
    const btnW = Math.min(130 * s, width - 30);
    const btnH = 34 * s;
    const btnY = height - 20 * s;
    
    this.confirmButton = this.add.container(width / 2, btnY);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x00ff88, 1);
    bg.fillRoundedRect(-btnW/2, -btnH/2, btnW, btnH, btnH/2);
    this.confirmButton.add(bg);
    
    this.confirmButton.add(this.add.text(0, 0, '✓ SELECT', {
      fontSize: `${12 * s}px`,
      fontFamily: getFonts().tech,
      color: '#000000',
    }).setOrigin(0.5));
    
    (this.confirmButton as any)._w = btnW;
    (this.confirmButton as any)._h = btnH;
    
    const hitArea = this.add.rectangle(0, 0, btnW, btnH, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.confirmButton.add(hitArea);
    
    hitArea.on('pointerdown', () => this.confirmSelection());
  }

  private selectFaction(factionId: FactionId): void {
    this.selectedFaction = factionId;
    const s = this.s;
    
    this.factionCards.forEach((card, id) => {
      const isSelected = id === factionId;
      const faction = FACTIONS[id];
      const w = (card as any)._w;
      const h = (card as any)._h;
      
      this.tweens.add({
        targets: card,
        scaleX: isSelected ? 1.04 : 1,
        scaleY: isSelected ? 1.04 : 1,
        duration: 100,
      });
      
      const bg = card.getAt(0) as Phaser.GameObjects.Graphics;
      bg.clear();
      bg.fillStyle(isSelected ? 0x202040 : 0x15152a, 1);
      bg.fillRoundedRect(-w/2, -h/2, w, h, 6 * s);
      bg.lineStyle(isSelected ? 3 : 2, faction.color, isSelected ? 1 : 0.6);
      bg.strokeRoundedRect(-w/2, -h/2, w, h, 6 * s);
    });
    
    if (this.confirmButton) {
      const bg = this.confirmButton.getAt(0) as Phaser.GameObjects.Graphics;
      const faction = FACTIONS[factionId];
      const w = (this.confirmButton as any)._w;
      const h = (this.confirmButton as any)._h;
      
      bg.clear();
      bg.fillStyle(faction.color, 1);
      bg.fillRoundedRect(-w/2, -h/2, w, h, h/2);
    }
  }

  private confirmSelection(): void {
    AudioManager.getInstance().playSFX('sfx_cash');
    tgApp.hapticNotification('success');
    
    playerData.setFaction(this.selectedFaction);
    
    const { width, height } = this.scale;
    const faction = FACTIONS[this.selectedFaction];
    
    const flash = this.add.rectangle(width/2, height/2, width, height, faction.color, 0);
    flash.setDepth(1000);
    
    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.3 },
      duration: 100,
      yoyo: true,
      onComplete: () => {
        flash.destroy();
        const data = playerData.get();
        this.scene.start(data.isProfileSetupComplete ? 'MainMenuScene' : 'ProfileSetupScene');
      },
    });
  }
}