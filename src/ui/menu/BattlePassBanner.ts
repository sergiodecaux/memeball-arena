// src/ui/menu/BattlePassBanner.ts
// Баннер Battle Pass для главного меню

import Phaser from 'phaser';
import { battlePassManager } from '../../managers/BattlePassManager';
import { getCurrentSeason, getXPProgress, formatTimeRemaining } from '../../data/BattlePassData';
import { getFonts } from '../../config/themes';
import { getUnitById } from '../../data/UnitsRepository';

export class BattlePassBanner {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private s: number;
  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private onTap: () => void;
  private glowGraphics?: Phaser.GameObjects.Graphics;
  private badgeContainer?: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    scale: number,
    onTap: () => void
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.s = scale;
    this.onTap = onTap;
  }

  /**
   * Получает лучший доступный ключ текстуры (HD или базовый)
   */
  private getBestTextureKey(assetKey: string): string | null {
    const hdKey = `${assetKey}_512`;
    
    if (this.scene.textures.exists(hdKey)) {
      return hdKey;
    }
    
    if (this.scene.textures.exists(assetKey)) {
      return assetKey;
    }
    
    return null;
  }

  create(): Phaser.GameObjects.Container {
    const s = this.s;
    const fonts = getFonts();
    
    this.container = this.scene.add.container(this.x, this.y);
    
    const progress = battlePassManager.getProgress();
    const season = getCurrentSeason();
    const timeRemaining = battlePassManager.getTimeRemaining();
    const hasUnclaimed = battlePassManager.getUnclaimedCount() > 0;
    
    // === ФОН ===
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x0a0a1f, 0.95);
    bg.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 12 * s);
    
    // Градиентная полоса сверху
    for (let i = 0; i < 20; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xa855f7),
        Phaser.Display.Color.ValueToColor(0xff00de),
        20, i
      );
      bg.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1);
      bg.fillRect(-this.width / 2 + i * (this.width / 20), -this.height / 2, this.width / 20 + 1, 4 * s);
    }
    
    // Сканлайны
    bg.fillStyle(0xffffff, 0.02);
    for (let i = 0; i < this.height; i += 4) {
      bg.fillRect(-this.width / 2, -this.height / 2 + i, this.width, 1);
    }
    
    // Рамка
    bg.lineStyle(2 * s, progress.isPremium ? 0xffd700 : 0x374151, 1);
    bg.strokeRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, 12 * s);
    this.container.add(bg);
    
    // === СВЕЧЕНИЕ ===
    if (hasUnclaimed || progress.isPremium) {
      const glowColor = progress.isPremium ? 0xffd700 : 0xa855f7;
      this.glowGraphics = this.scene.add.graphics();
      this.glowGraphics.lineStyle(3 * s, glowColor, 0.4);
      this.glowGraphics.strokeRoundedRect(-this.width / 2 - 2, -this.height / 2 - 2, this.width + 4, this.height + 4, 14 * s);
      this.container.add(this.glowGraphics);
      
      this.scene.tweens.add({
        targets: this.glowGraphics,
        alpha: { from: 0.4, to: 0.15 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
      });
    }
    
    // === ЛЕВАЯ ЧАСТЬ ===
    const leftX = -this.width / 2 + 16 * s;
    
    this.container.add(this.scene.add.text(leftX, -this.height / 2 + 22 * s, '🎫', { fontSize: `${22 * s}px` }));
    this.container.add(this.scene.add.text(leftX + 30 * s, -this.height / 2 + 14 * s, 'BATTLE PASS', {
      fontSize: `${13 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }));
    
    if (progress.isPremium) {
      this.container.add(this.scene.add.text(leftX + 30 * s, -this.height / 2 + 30 * s, '👑 PREMIUM', {
        fontSize: `${10 * s}px`, fontFamily: fonts.primary, color: '#ffd700',
      }));
    } else {
      this.container.add(this.scene.add.text(leftX + 30 * s, -this.height / 2 + 30 * s, season.name, {
        fontSize: `${10 * s}px`, fontFamily: fonts.primary, color: '#94a3b8',
      }));
    }
    
    // === ТАЙМЕР ===
    this.container.add(this.scene.add.text(this.width / 2 - 16 * s, -this.height / 2 + 16 * s, 
      `⏱ ${formatTimeRemaining(timeRemaining)}`, {
      fontSize: `${11 * s}px`, fontFamily: fonts.primary, color: '#f87171',
    }).setOrigin(1, 0));
    
    // === ПРОГРЕСС-БАР ===
    const barY = 5 * s;
    const barWidth = this.width - 32 * s;
    const barHeight = 14 * s;
    
    const progressBg = this.scene.add.graphics();
    progressBg.fillStyle(0x1e293b, 1);
    progressBg.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 7 * s);
    this.container.add(progressBg);
    
    const fillWidth = Math.max(barHeight, barWidth * (progress.currentTier / season.maxTier));
    const progressFill = this.scene.add.graphics();
    for (let i = 0; i < 15; i++) {
      const col = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x38bdf8),
        Phaser.Display.Color.ValueToColor(0xa855f7),
        15, i
      );
      progressFill.fillStyle(Phaser.Display.Color.GetColor(col.r, col.g, col.b), 1);
      progressFill.fillRect(-barWidth / 2 + i * (fillWidth / 15), barY - barHeight / 2, fillWidth / 15 + 1, barHeight);
    }
    
    const barMask = this.scene.make.graphics({});
    barMask.fillStyle(0xffffff);
    barMask.fillRoundedRect(-barWidth / 2, barY - barHeight / 2, barWidth, barHeight, 7 * s);
    progressFill.setMask(barMask.createGeometryMask());
    this.container.add(progressFill);
    
    this.container.add(this.scene.add.text(0, barY, `Tier ${progress.currentTier}/${season.maxTier}`, {
      fontSize: `${10 * s}px`, fontFamily: fonts.primary, color: '#ffffff',
    }).setOrigin(0.5));
    
    // === НИЗ: Featured reward и кнопка ===
    const bottomY = this.height / 2 - 18 * s;
    
    // Featured unit с иконкой
    const featuredContainer = this.scene.add.container(leftX, bottomY);
    
    const featuredUnit = getUnitById(season.featuredUnitId);
    const featuredTextureKey = featuredUnit ? this.getBestTextureKey(featuredUnit.assetKey) : null;
    
    if (featuredTextureKey) {
      // PNG юнита
      const unitIcon = this.scene.add.image(12 * s, 0, featuredTextureKey);
      unitIcon.setDisplaySize(28 * s, 28 * s);
      featuredContainer.add(unitIcon);
      
      // Название
      featuredContainer.add(this.scene.add.text(32 * s, 0, season.featuredUnitName, {
        fontSize: `${11 * s}px`, 
        fontFamily: fonts.primary, 
        color: '#f59e0b',
      }));
    } else {
      // Fallback
      featuredContainer.add(this.scene.add.text(0, 0, `🏆 ${season.featuredUnitName}`, {
        fontSize: `${11 * s}px`, 
        fontFamily: fonts.primary, 
        color: '#f59e0b',
      }));
    }
    
    this.container.add(featuredContainer);
    
    // Кнопка
    const btnWidth = 80 * s;
    const btnHeight = 28 * s;
    const btnX = this.width / 2 - btnWidth / 2 - 12 * s;
    
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x00f2ff, 1);
    btnBg.fillRoundedRect(btnX - btnWidth / 2, bottomY - btnHeight / 2, btnWidth, btnHeight, 14 * s);
    this.container.add(btnBg);
    
    this.container.add(this.scene.add.text(btnX, bottomY, 'ОТКРЫТЬ', {
      fontSize: `${10 * s}px`, fontFamily: fonts.tech, color: '#000000',
    }).setOrigin(0.5));
    
    // Бейдж
    if (hasUnclaimed) {
      this.createUnclaimedBadge(btnX + btnWidth / 2 - 5 * s, bottomY - btnHeight / 2 - 5 * s);
    }
    
    // === ИНТЕРАКТИВНОСТЬ ===
    this.container.setSize(this.width, this.height);
    this.container.setInteractive({ useHandCursor: true });
    
    this.container.on('pointerover', () => {
      this.scene.tweens.add({ targets: this.container, scale: 1.02, duration: 100 });
    });
    
    this.container.on('pointerout', () => {
      this.scene.tweens.add({ targets: this.container, scale: 1, duration: 100 });
    });
    
    this.container.on('pointerdown', () => {
      this.scene.tweens.add({
        targets: this.container, scale: 0.98, duration: 50, yoyo: true,
        onComplete: () => this.onTap(),
      });
    });
    
    return this.container;
  }

  private createUnclaimedBadge(x: number, y: number): void {
    const s = this.s;
    const fonts = getFonts();
    const count = battlePassManager.getUnclaimedCount();
    
    this.badgeContainer = this.scene.add.container(x, y);
    
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0xef4444, 1);
    badgeBg.fillCircle(0, 0, 10 * s);
    this.badgeContainer.add(badgeBg);
    
    this.badgeContainer.add(this.scene.add.text(0, 0, `${count}`, {
      fontSize: `${9 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    this.scene.tweens.add({
      targets: this.badgeContainer, scale: { from: 1, to: 1.15 },
      duration: 500, yoyo: true, repeat: -1,
    });
    
    this.container.add(this.badgeContainer);
  }

  setDepth(depth: number): this {
    this.container?.setDepth(depth);
    return this;
  }

  destroy(): void {
    this.container?.destroy();
  }
}
