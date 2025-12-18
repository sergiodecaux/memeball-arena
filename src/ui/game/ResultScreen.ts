// src/ui/game/ResultScreen.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { Icons } from '../Icons';
import { MatchResult } from '../../controllers/match/MatchController';

export interface ResultScreenCallbacks {
  onRematch: () => void;
  onMainMenu: () => void;
}

/**
 * Экран результатов матча
 */
export class ResultScreen {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: ResultScreenCallbacks;

  constructor(scene: Phaser.Scene, result: MatchResult, isAIMode: boolean, callbacks: ResultScreenCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
    const { width, height } = scene.cameras.main;
    
    // Overlay
    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    this.overlay.setOrigin(0, 0).setDepth(400);
    
    // Container
    this.container = scene.add.container(width / 2, height / 2);
    this.container.setDepth(401);
    
    this.create(result, isAIMode);
    this.animateIn();
  }

  private create(result: MatchResult, isAIMode: boolean): void {
    const colors = getColors();
    const resultColor = result.isWin ? 0x22c55e : 0xef4444;
    
    const panelWidth = 320;
    const panelHeight = 420;
    
    // Panel background
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f0f1a, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.lineStyle(3, resultColor, 0.8);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    // Glow
    for (let i = 3; i >= 1; i--) {
      const glow = this.scene.add.graphics();
      glow.lineStyle(8 / i, resultColor, 0.15 * i);
      glow.strokeRoundedRect(-panelWidth / 2 - 3, -panelHeight / 2 - 3, panelWidth + 6, panelHeight + 6, 22);
      this.container.add(glow);
    }
    
    // Result icon
    const iconY = -panelHeight / 2 + 60;
    if (result.isWin) {
      const trophy = Icons.drawTrophy(this.scene, 0, iconY, 50, 0xffd700);
      this.container.add(trophy);
    } else {
      const shield = Icons.drawShield(this.scene, 0, iconY, 50, 0xef4444);
      this.container.add(shield);
    }
    
    // Title
    const titleText = result.isWin 
      ? i18n.t('youWon') 
      : (isAIMode ? i18n.t('aiWins') : i18n.t('player2Wins'));
    const title = this.scene.add.text(0, iconY + 55, titleText, {
      fontSize: '28px',
      fontFamily: 'Arial Black',
      color: hexToString(resultColor),
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Score
    const scoreText = this.scene.add.text(0, iconY + 100, `${result.playerGoals} : ${result.opponentGoals}`, {
      fontSize: '48px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(scoreText);
    
    // Perfect game badge
    if (result.isPerfectGame) {
      const perfectBadge = this.scene.add.container(0, iconY + 145);
      
      const badgeBg = this.scene.add.graphics();
      badgeBg.fillStyle(0xffd700, 0.2);
      badgeBg.fillRoundedRect(-60, -12, 120, 24, 12);
      badgeBg.lineStyle(1, 0xffd700, 0.8);
      badgeBg.strokeRoundedRect(-60, -12, 120, 24, 12);
      perfectBadge.add(badgeBg);
      
      perfectBadge.add(this.scene.add.text(0, 0, '⭐ ' + i18n.t('cleanSheet'), {
        fontSize: '12px',
        color: '#ffd700',
        fontStyle: 'bold',
      }).setOrigin(0.5));
      
      this.container.add(perfectBadge);
    }
    
    // Stats
    const statsY = iconY + (result.isPerfectGame ? 185 : 160);
    
    this.createStatRow(-panelWidth / 2 + 30, statsY, i18n.t('xpEarned'), `+${result.xpEarned}`, 0x8b5cf6, panelWidth - 60);
    this.createStatRow(-panelWidth / 2 + 30, statsY + 40, i18n.t('coinsEarned'), `+${result.coinsEarned}`, 0xffd700, panelWidth - 60);
    
    // New achievements
    if (result.newAchievements.length > 0) {
      const achY = statsY + 85;
      const achBg = this.scene.add.graphics();
      achBg.fillStyle(0x22c55e, 0.1);
      achBg.fillRoundedRect(-panelWidth / 2 + 20, achY - 15, panelWidth - 40, 30, 8);
      this.container.add(achBg);
      
      this.container.add(this.scene.add.text(0, achY, `🏆 ${result.newAchievements.length} new achievement(s)!`, {
        fontSize: '12px',
        color: '#22c55e',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }
    
    // Buttons
    const btnY = panelHeight / 2 - 55;
    const btnWidth = 130;
    
    // Rematch
    this.createButton(-75, btnY, btnWidth, i18n.t('rematch'), colors.uiAccent, () => {
      this.hide(() => this.callbacks.onRematch());
    });
    
    // To Menu
    this.createButton(75, btnY, btnWidth, i18n.t('toMenu'), colors.uiPrimary, () => {
      this.hide(() => this.callbacks.onMainMenu());
    });
  }

  private createStatRow(x: number, y: number, label: string, value: string, color: number, width: number): void {
    const row = this.scene.add.container(x, y);
    
    row.add(this.scene.add.text(0, 0, label, {
      fontSize: '14px',
      color: '#888888',
    }));
    
    row.add(this.scene.add.text(width, 0, value, {
      fontSize: '16px',
      fontFamily: 'Arial Black',
      color: hexToString(color),
    }).setOrigin(1, 0));
    
    this.container.add(row);
  }

  private createButton(x: number, y: number, w: number, text: string, color: number, onClick: () => void): void {
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.3 : 0.15);
      bg.fillRoundedRect(-w / 2, -22, w, 44, 10);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -22, w, 44, 10);
    };
    draw(false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, 44, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', onClick);
    
    this.container.add(btn);
  }

  private animateIn(): void {
    this.container.setScale(0.8).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
  }

  hide(onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: [this.container, this.overlay],
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.destroy();
        if (onComplete) onComplete();
      }
    });
  }

  destroy(): void {
    this.overlay.destroy();
    this.container.destroy();
  }
}