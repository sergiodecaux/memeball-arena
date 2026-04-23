// src/ui/game/MissionPreviewOverlay.ts
// Mission Preview Overlay for Campaign Levels

import Phaser from 'phaser';
import { LevelConfig, ChapterConfig } from '../../types/CampaignTypes';
import { getChapter } from '../../data/CampaignData';
import { hapticSelection } from '../../utils/Haptics';
import { AudioManager } from '../../managers/AudioManager';

interface MissionPreviewOverlayConfig {
  scene: Phaser.Scene;
  level: LevelConfig;
  onStart: () => void;
  onClose?: () => void;
}

export class MissionPreviewOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private level: LevelConfig;
  private chapter: ChapterConfig;
  private onStart: () => void;
  private onClose?: () => void;

  constructor(config: MissionPreviewOverlayConfig) {
    this.scene = config.scene;
    this.level = config.level;
    this.chapter = getChapter(config.level.chapterId) || this.getFallbackChapter();
    this.onStart = config.onStart;
    this.onClose = config.onClose;

    const { width, height } = this.scene.cameras.main;
    
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(999);

    this.createOverlay(width, height);
  }

  private getFallbackChapter(): ChapterConfig {
    return {
      id: this.level.chapterId,
      order: 1,
      name: 'Unknown',
      description: '',
      factionId: this.level.enemyFaction,
      levelIds: [],
      accentColor: 0x00f2ff,
      icon: '❓',
    };
  }

  private createOverlay(width: number, height: number): void {
    // 1. Dim background
    const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
    overlay.setOrigin(0, 0);
    overlay.setInteractive();
    this.container.add(overlay);

    // 2. Preview image (full-screen background)
    const previewKey = this.level.previewImageKey;
    let previewImage: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;

    if (previewKey && this.scene.textures.exists(previewKey)) {
      previewImage = this.scene.add.image(width / 2, height / 2, previewKey);
      
      // Scale with "contain" logic
      const tex = this.scene.textures.get(previewKey);
      const source = tex.getSourceImage() as HTMLImageElement;
      const texW = source.width;
      const texH = source.height;
      
      const targetW = width;
      const targetH = height;
      
      const scale = Math.min(targetW / texW, targetH / texH);
      previewImage.setScale(scale);
    } else {
      // Fallback: simple rectangle
      previewImage = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x111111);
    }
    this.container.add(previewImage);

    // 3. Top gradient overlay (for title text readability)
    const topGradient = this.scene.add.graphics();
    const topGradientHeight = height * 0.25;
    topGradient.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.85, 0.85, 0, 0);
    topGradient.fillRect(0, 0, width, topGradientHeight);
    this.container.add(topGradient);

    // 4. Bottom gradient overlay (for mission card & button)
    const bottomGradient = this.scene.add.graphics();
    const bottomGradientHeight = height * 0.4;
    const bottomGradientY = height - bottomGradientHeight;
    bottomGradient.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0, 0.85, 0.85);
    bottomGradient.fillRect(0, bottomGradientY, width, bottomGradientHeight);
    this.container.add(bottomGradient);

    // 5. Mission info panel (card) near the bottom
    const panelY = height * 0.75;
    const panelWidth = width * 0.9;
    const panelHeight = height * 0.26;
    const panelX = width / 2;

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x05070a, 0.85);
    panelBg.fillRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      16
    );
    panelBg.lineStyle(2, this.chapter.accentColor, 1);
    panelBg.strokeRoundedRect(
      panelX - panelWidth / 2,
      panelY - panelHeight / 2,
      panelWidth,
      panelHeight,
      16
    );
    this.container.add(panelBg);

    // 6. Text elements
    // Chapter + level id (top-left over top gradient)
    const chapterLevelText = this.scene.add.text(
      20,
      30,
      `${this.chapter.name} · ${this.level.id}`,
      {
        fontFamily: 'Orbitron, Arial',
        fontSize: '18px',
        color: '#aaaaaa',
      }
    );
    this.container.add(chapterLevelText);

    // Level name (below the line above)
    const levelNameText = this.scene.add.text(
      20,
      60,
      this.level.name,
      {
        fontFamily: 'Orbitron, Arial',
        fontSize: '28px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    this.container.add(levelNameText);

    // BOSS badge (optional)
    if (this.level.isBoss) {
      const bossBadgeBg = this.scene.add.graphics();
      bossBadgeBg.fillStyle(0x330000, 1);
      bossBadgeBg.fillRoundedRect(width - 120, 30, 100, 30, 15);
      this.container.add(bossBadgeBg);

      const bossBadgeText = this.scene.add.text(
        width - 70,
        45,
        'BOSS',
        {
          fontFamily: 'Orbitron, Arial',
          fontSize: '16px',
          color: '#ff5555',
          fontStyle: 'bold',
        }
      ).setOrigin(0.5);
      this.container.add(bossBadgeText);
    }

    // Mission objective (inside panel, top)
    const objectiveTitle = this.scene.add.text(
      panelX,
      panelY - panelHeight / 2 + 20,
      'MISSION OBJECTIVE',
      {
        fontFamily: 'Orbitron, Arial',
        fontSize: '14px',
        color: '#888888',
      }
    ).setOrigin(0.5);
    this.container.add(objectiveTitle);

    const objectiveText = this.level.shortObjective || this.level.description;
    const objective = this.scene.add.text(
      panelX,
      panelY - panelHeight / 2 + 50,
      objectiveText,
      {
        fontFamily: 'Roboto, Arial',
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: panelWidth * 0.85 },
        align: 'center',
      }
    ).setOrigin(0.5);
    this.container.add(objective);

    // Star criteria (inside panel under objective)
    const starsY = panelY - panelHeight / 2 + 100;
    const starCriteria = this.level.starCriteria;
    
    const starLabels = [
      `★ ${starCriteria.oneStar}`,
      `★★ ${starCriteria.twoStars}`,
      `★★★ ${starCriteria.threeStars}`,
    ];

    starLabels.forEach((label, i) => {
      const starText = this.scene.add.text(
        panelX,
        starsY + i * 22,
        label,
        {
          fontFamily: 'Roboto, Arial',
          fontSize: '14px',
          color: '#ffd700',
          align: 'center',
        }
      ).setOrigin(0.5);
      this.container.add(starText);
    });

    // Rewards (inside panel at the bottom)
    const reward = this.level.reward;
    const rewardText = this.scene.add.text(
      panelX,
      panelY + panelHeight / 2 - 25,
      `Reward: ${reward.firstClearCoins} coins, ${reward.firstClearXP} XP`,
      {
        fontFamily: 'Roboto, Arial',
        fontSize: '14px',
        color: '#cccccc',
      }
    ).setOrigin(0.5);
    this.container.add(rewardText);

    // 7. Start Match button (below panel)
    const buttonY = height * 0.92;
    const buttonWidth = width * 0.8;
    const buttonHeight = 56;
    const buttonX = width / 2;

    // Button container
    const buttonContainer = this.scene.add.container(buttonX, buttonY);
    this.container.add(buttonContainer);

    // Button background with accent color
    const buttonBg = this.scene.add.graphics();
    buttonBg.fillStyle(this.chapter.accentColor, 1);
    buttonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    buttonBg.lineStyle(3, 0xffffff, 0.4);
    buttonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    buttonContainer.add(buttonBg);

    // Button glow effect
    const buttonGlow = this.scene.add.graphics();
    buttonGlow.lineStyle(8, this.chapter.accentColor, 0.5);
    buttonGlow.strokeRoundedRect(-buttonWidth / 2 - 2, -buttonHeight / 2 - 2, buttonWidth + 4, buttonHeight + 4, 14);
    buttonContainer.add(buttonGlow);

    // Button text
    const buttonText = this.scene.add.text(0, 0, 'НАЧАТЬ МАТЧ', {
      fontFamily: 'Orbitron, Arial',
      fontSize: '20px',
      color: '#000000',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 2,
    }).setOrigin(0.5);
    buttonContainer.add(buttonText);

    // Button hit area
    const buttonHitArea = this.scene.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x000000, 0);
    buttonHitArea.setInteractive({ useHandCursor: true });
    buttonHitArea.on('pointerdown', () => {
      hapticSelection();
      AudioManager.getInstance().playUIClick();
      buttonContainer.setScale(0.95);
    });
    buttonHitArea.on('pointerup', () => {
      buttonContainer.setScale(1);
      this.destroy();
      this.onStart();
    });
    buttonHitArea.on('pointerover', () => {
      buttonContainer.setScale(1.02);
      buttonGlow.setAlpha(0.8);
    });
    buttonHitArea.on('pointerout', () => {
      buttonContainer.setScale(1);
      buttonGlow.setAlpha(0.5);
    });
    buttonContainer.add(buttonHitArea);

    // 8. Close button (top-right, inside top gradient)
    const closeBtn = this.scene.add.text(
      width - 30,
      30,
      '✕',
      {
        fontFamily: 'Arial',
        fontSize: '32px',
        color: '#ffffff',
      }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      hapticSelection();
      AudioManager.getInstance().playUIClick();
      this.destroy();
      this.onClose?.();
    });

    closeBtn.on('pointerover', () => closeBtn.setColor('#ff5555'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ffffff'));
    this.container.add(closeBtn);

    // 9. Animation - fade in
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });
  }

  destroy(): void {
    this.container.destroy(true);
  }
}

export default MissionPreviewOverlay;

