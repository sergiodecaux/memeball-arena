// src/scenes/UpgradeScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { 
  getCapSkin, 
  getRarityName, 
  getRarityColor,
  getSkinBaseBonus,
  getUpgradeCost,
  MAX_CAP_LEVEL,
  CapSkinData 
} from '../data/SkinsCatalog';

// Максимальный бонус от прокачки для каждой редкости
const MAX_UPGRADE_BONUS: Record<string, number> = {
  basic: 10,
  common: 15,
  rare: 20,
  epic: 25,
  legendary: 30,
};

export class UpgradeScene extends Phaser.Scene {
  private selectedSkinId: string | null = null;
  private coinsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UpgradeScene' });
  }

  create(): void {
    const data = playerData.get();
    this.selectedSkinId = data.equippedCapSkin;

    this.createBackground();
    this.createHeader();
    this.createSkinSelector();
    this.createUpgradePanel();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x05050a, 1);
    bg.fillRect(0, 0, width, height);

    for (let i = 0; i < 150; i++) {
      const alpha = 0.1 * (1 - i / 150);
      bg.fillStyle(colors.uiAccent, alpha);
      bg.fillRect(0, i, width, 1);
    }

    const grid = this.add.graphics();
    grid.lineStyle(1, colors.uiAccent, 0.03);
    for (let x = 0; x < width; x += 30) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y < height; y += 30) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, 60);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, 60, width, 60);
    headerBg.setDepth(100);

    // Кнопка назад
    const backBtn = this.add.container(50, 30).setDepth(101);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x000000, 0.5);
    backBg.fillRoundedRect(-35, -15, 70, 30, 8);
    backBg.lineStyle(1.5, colors.uiAccent, 0.5);
    backBg.strokeRoundedRect(-35, -15, 70, 30, 8);
    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, '← Back', {
      fontSize: '14px',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));
    backBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -15, 70, 30), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));

    // Заголовок
    this.add.text(width / 2, 30, '⬆️ UPGRADES', {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(101);

    // Монеты
    this.coinsText = this.add.text(width - 20, 30, `💰 ${data.coins}`, {
      fontSize: '18px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5).setDepth(101);
  }

  private createSkinSelector(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();

    const selectorY = 100;
    const itemSize = 70;
    const gap = 10;
    const startX = 20;

    this.add.text(20, 75, 'Select Cap to Upgrade:', {
      fontSize: '14px',
      color: '#aaaaaa',
    });

    data.ownedCapSkins.forEach((owned, index) => {
      const skin = getCapSkin(owned.id);
      if (!skin) return;

      const x = startX + index * (itemSize + gap) + itemSize / 2;
      const isSelected = this.selectedSkinId === owned.id;
      const rarityColor = getRarityColor(skin.rarity);

      const container = this.add.container(x, selectorY);

      const bg = this.add.graphics();
      bg.fillStyle(0x0a0a15, 0.9);
      bg.fillRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 12);
      if (isSelected) {
        bg.lineStyle(3, colors.uiAccent, 1);
      } else {
        bg.lineStyle(1, rarityColor, 0.5);
      }
      bg.strokeRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 12);
      container.add(bg);

      // Превью
      if (skin.hasGlow && skin.glowColor) {
        container.add(this.add.circle(0, -5, 22, skin.glowColor, 0.2));
      }
      const main = this.add.circle(0, -5, 18, skin.primaryColor);
      main.setStrokeStyle(2, 0xffffff, 0.8);
      container.add(main);
      container.add(this.add.circle(0, -5, 11, skin.secondaryColor, 0.5));

      // Уровень
      container.add(this.add.text(0, 25, `Lv.${owned.level}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));

      // Интерактивность
      const hitArea = this.add.rectangle(0, 0, itemSize, itemSize, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerdown', () => {
        this.selectedSkinId = owned.id;
        this.scene.restart();
      });
    });
  }

  private createUpgradePanel(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    if (!this.selectedSkinId) return;

    const skin = getCapSkin(this.selectedSkinId);
    if (!skin) return;

    const data = playerData.get();
    const ownedSkin = data.ownedCapSkins.find(s => s.id === this.selectedSkinId);
    const currentLevel = ownedSkin?.level || 1;
    const rarityColor = getRarityColor(skin.rarity);
    const maxBonus = MAX_UPGRADE_BONUS[skin.rarity] || 10;
    const totalBonus = playerData.getCapTotalBonus(this.selectedSkinId);

    const panelY = 180;
    const panelHeight = height - panelY - 20;

    // Фон панели
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a0a15, 0.95);
    panelBg.fillRoundedRect(15, panelY, width - 30, panelHeight, 16);
    panelBg.lineStyle(2, rarityColor, 0.5);
    panelBg.strokeRoundedRect(15, panelY, width - 30, panelHeight, 16);

    // Заголовок скина
    this.add.text(width / 2, panelY + 25, skin.name, {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5);

    this.add.text(width / 2, panelY + 50, `${getRarityName(skin.rarity)} • Level ${currentLevel}/${MAX_CAP_LEVEL}`, {
      fontSize: '14px',
      color: hexToString(rarityColor),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    // Статы
    const stats: { key: 'power' | 'speed' | 'control' | 'weight'; name: string; icon: string; color: number }[] = [
      { key: 'power', name: 'POWER', icon: '💪', color: 0xef4444 },
      { key: 'speed', name: 'SPEED', icon: '⚡', color: 0xfbbf24 },
      { key: 'control', name: 'CONTROL', icon: '🎯', color: 0x3b82f6 },
      { key: 'weight', name: 'WEIGHT', icon: '🛡️', color: 0x4ade80 },
    ];

    const startY = panelY + 90;
    const statHeight = 90;

    stats.forEach((stat, index) => {
      const y = startY + index * statHeight;
      const currentValue = totalBonus[stat.key];
      const baseBonus = getSkinBaseBonus(skin);
      const upgradeValue = currentValue - baseBonus[stat.key];
      const canUpgrade = currentLevel < MAX_CAP_LEVEL;
      const cost = canUpgrade ? getUpgradeCost(this.selectedSkinId!, currentLevel) : 0;
      const canAfford = data.coins >= cost;

      // Фон стата
      const statBg = this.add.graphics();
      statBg.fillStyle(stat.color, 0.1);
      statBg.fillRoundedRect(25, y, width - 50, statHeight - 10, 12);
      statBg.lineStyle(1, stat.color, 0.3);
      statBg.strokeRoundedRect(25, y, width - 50, statHeight - 10, 12);

      // Иконка и название
      this.add.text(40, y + 20, stat.icon, { fontSize: '24px' });
      this.add.text(75, y + 20, stat.name, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      // Текущее значение
      this.add.text(width - 140, y + 20, `+${currentValue}%`, {
        fontSize: '18px',
        color: hexToString(stat.color),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);

      // Прогресс бар
      const barWidth = width - 180;
      const barHeight = 14;
      const barX = 40;
      const barY = y + 45;
      const progress = Math.min(upgradeValue / maxBonus, 1);

      const barBgGraphics = this.add.graphics();
      barBgGraphics.fillStyle(0x1a1a2e, 1);
      barBgGraphics.fillRoundedRect(barX, barY, barWidth, barHeight, 7);
      if (progress > 0) {
        barBgGraphics.fillStyle(stat.color, 1);
        barBgGraphics.fillRoundedRect(barX, barY, barWidth * progress, barHeight, 7);
      }
      barBgGraphics.lineStyle(1, stat.color, 0.3);
      barBgGraphics.strokeRoundedRect(barX, barY, barWidth, barHeight, 7);

      // Текст прогресса
      this.add.text(barX + barWidth / 2, barY + barHeight / 2, `+${upgradeValue}% / +${maxBonus}%`, {
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
    });

    // Кнопка улучшения (общая для всех статов)
    const btnY = startY + stats.length * statHeight + 20;
    const canUpgrade = currentLevel < MAX_CAP_LEVEL;
    const cost = canUpgrade ? getUpgradeCost(this.selectedSkinId!, currentLevel) : 0;
    const canAfford = data.coins >= cost;

    if (canUpgrade) {
      const btnContainer = this.add.container(width / 2, btnY);
      const btnWidth = 200;
      const btnHeight = 50;

      const btnBg = this.add.graphics();
      const btnColor = canAfford ? 0x22c55e : 0x666666;

      const drawBtn = (hover: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(btnColor, hover ? 0.4 : 0.2);
        btnBg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);
        btnBg.lineStyle(2, btnColor, hover ? 1 : 0.6);
        btnBg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);
      };

      drawBtn(false);
      btnContainer.add(btnBg);

      const btnText = this.add.text(0, -5, `⬆️ UPGRADE TO LV.${currentLevel + 1}`, {
        fontSize: '14px',
        color: canAfford ? '#ffffff' : '#666666',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      btnContainer.add(btnText);

      const costText = this.add.text(0, 15, `💰 ${cost}`, {
        fontSize: '12px',
        color: canAfford ? '#ffd700' : '#666666',
      }).setOrigin(0.5, 0.5);
      btnContainer.add(costText);

      if (canAfford) {
        const hitArea = this.add.rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0);
        hitArea.setInteractive({ useHandCursor: true });
        btnContainer.add(hitArea);

        hitArea.on('pointerover', () => {
          drawBtn(true);
          btnContainer.setScale(1.05);
        });

        hitArea.on('pointerout', () => {
          drawBtn(false);
          btnContainer.setScale(1);
        });

        hitArea.on('pointerdown', () => {
          if (playerData.upgradeCapSkin(this.selectedSkinId!)) {
            this.showUpgradeEffect(width / 2, btnY, 0x22c55e);
            this.scene.restart();
          }
        });
      }
    } else {
      // Максимальный уровень
      this.add.text(width / 2, btnY, '🏆 MAX LEVEL REACHED', {
        fontSize: '18px',
        color: hexToString(rarityColor),
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
    }

    // Информация о редкости
    const infoY = btnY + 60;
    const infoContainer = this.add.container(width / 2, infoY);

    const infoBg = this.add.graphics();
    infoBg.fillStyle(rarityColor, 0.1);
    infoBg.fillRoundedRect(-160, -30, 320, 60, 10);
    infoBg.lineStyle(1, rarityColor, 0.3);
    infoBg.strokeRoundedRect(-160, -30, 320, 60, 10);
    infoContainer.add(infoBg);

    const baseBonus = getSkinBaseBonus(skin);
    infoContainer.add(this.add.text(0, -10, `${getRarityName(skin.rarity)} Base Bonus`, {
      fontSize: '12px',
      color: hexToString(rarityColor),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    infoContainer.add(this.add.text(0, 10, `💪+${baseBonus.power}% ⚡+${baseBonus.speed}% 🎯+${baseBonus.control}% 🛡️+${baseBonus.weight}%`, {
      fontSize: '11px',
      color: '#aaaaaa',
    }).setOrigin(0.5, 0.5));
  }

  private showUpgradeEffect(x: number, y: number, color: number): void {
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.circle(x, y, 6, color, 1);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 80,
        y: y + Math.sin(angle) * 80,
        alpha: 0,
        scale: 0.3,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }

    const text = this.add.text(x, y - 40, '⬆️ LEVEL UP!', {
      fontSize: '24px',
      color: '#22c55e',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: text,
      y: y - 80,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }
}