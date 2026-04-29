// src/scenes/MatchVSScene.ts
// Сцена VS экрана перед матчем — загрузочный экран с музыкой

import Phaser from 'phaser';
import { FactionId, FACTIONS } from '../constants/gameConstants';
import { AudioManager } from '../managers/AudioManager';
import { playerData } from '../data/PlayerData';
import { loadImagesBoot } from '../assets/loading/ImageLoader';
import { loadAudioVS } from '../assets/loading/AudioLoader';

export interface MatchVSSceneData {
  matchContext: 'league' | 'tournament' | 'casual' | 'campaign' | 'freeplay';
  playerFaction: FactionId;
  opponentFaction: FactionId;
  opponentName: string;
  opponentAvatarId?: string;
  isAI: boolean;
  aiDifficulty?: number;
  gameSceneData: any;
}

export class MatchVSScene extends Phaser.Scene {
  private sceneData!: MatchVSSceneData;
  private startButton!: Phaser.GameObjects.Container;
  private playerCard!: Phaser.GameObjects.Container;
  private opponentCard!: Phaser.GameObjects.Container;
  private vsContainer!: Phaser.GameObjects.Container;
  private isTransitioning = false;

  constructor() {
    super({ key: 'MatchVSScene' });
  }

  preload(): void {
    loadImagesBoot(this);
    loadAudioVS(this);
  }

  init(data?: MatchVSSceneData): void {
    console.log('[MatchVSScene] init() called with data:', data);
    
    this.sceneData = {
      matchContext: data?.matchContext || 'freeplay',
      playerFaction: data?.playerFaction || 'cyborg',
      opponentFaction: data?.opponentFaction || 'magma',
      opponentName: data?.opponentName || 'Opponent',
      opponentAvatarId: data?.opponentAvatarId || 'avatar_recruit',
      isAI: data?.isAI ?? true,
      aiDifficulty: data?.aiDifficulty || 1,
      gameSceneData: data?.gameSceneData || {},
    };
    this.isTransitioning = false;
  }

  create(): void {
    console.log('[MatchVSScene] create() started');
    
    const { width, height } = this.scale;
    
    try {
      this.createBackground();
      this.createDarkOverlay();
      this.createModeLabel();
      this.createPlayerCards();
      this.createStartButton();
      this.startMusic();
      this.playEntranceAnimations();
      
      console.log('[MatchVSScene] create() completed successfully');
    } catch (error) {
      console.error('[MatchVSScene] Error in create():', error);
      // Fallback — переходим в игру напрямую
      this.goToGame();
    }
  }

  private createBackground(): void {
    const { width, height } = this.scale;
    const arenaFaction = this.sceneData.opponentFaction;
    const bgKey = `vs_bg_${arenaFaction}`;
    
    if (this.textures.exists(bgKey)) {
      const background = this.add.image(width / 2, height / 2, bgKey);
      const scaleX = width / background.width;
      const scaleY = height / background.height;
      background.setScale(Math.max(scaleX, scaleY)).setDepth(0);
    } else {
      // Fallback — цвет фракции
      const factionColor = FACTIONS[arenaFaction]?.color || 0x333333;
      this.add.rectangle(width / 2, height / 2, width, height, factionColor).setDepth(0);
    }
  }

  private createDarkOverlay(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.5).setDepth(1);
  }

  private createModeLabel(): void {
    const { width } = this.scale;
    
    const modeNames: Record<string, string> = {
      league: '⚔️ GALACTIC LEAGUE',
      tournament: '🏆 TOURNAMENT',
      casual: '🎮 QUICK MATCH',
      campaign: '📖 CAMPAIGN',
      freeplay: '🎯 FREE PLAY',
    };
    
    const modeName = modeNames[this.sceneData.matchContext] || '⚽ MATCH';
    
    const labelBg = this.add.graphics();
    labelBg.fillStyle(0x000000, 0.7);
    labelBg.fillRoundedRect(width / 2 - 150, 40, 300, 50, 10);
    labelBg.setDepth(10);
    
    this.add.text(width / 2, 65, modeName, {
      fontSize: '28px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(11);
  }

  private createPlayerCards(): void {
    const { width, height } = this.scale;
    const centerY = height / 2 - 30;
    const cardWidth = 140;
    const cardHeight = 200;
    const cardSpacing = 60;
    
    // Карточка игрока
    this.playerCard = this.createPlayerCard(
      width / 2 - cardWidth / 2 - cardSpacing,
      centerY,
      cardWidth,
      cardHeight,
      playerData.getNickname() || 'You',
      playerData.getAvatarId() || 'avatar_recruit',
      this.sceneData.playerFaction
    );
    this.playerCard.setDepth(20).setAlpha(0);
    this.playerCard.x -= 100;
    
    // VS
    this.vsContainer = this.createVSElement(width / 2, centerY);
    this.vsContainer.setDepth(25).setAlpha(0).setScale(0);
    
    // Карточка противника
    const opponentName = this.sceneData.isAI 
      ? `AI ${this.getAIDifficultyName()}` 
      : this.sceneData.opponentName;
    
    this.opponentCard = this.createPlayerCard(
      width / 2 + cardWidth / 2 + cardSpacing,
      centerY,
      cardWidth,
      cardHeight,
      opponentName,
      this.sceneData.opponentAvatarId || 'avatar_recruit',
      this.sceneData.opponentFaction
    );
    this.opponentCard.setDepth(20).setAlpha(0);
    this.opponentCard.x += 100;
  }

  private createPlayerCard(
    x: number, y: number, w: number, h: number,
    name: string, avatarId: string, factionId: FactionId
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const faction = FACTIONS[factionId];
    
    // Фон
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.8);
    cardBg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    cardBg.lineStyle(3, faction.color, 1);
    cardBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    container.add(cardBg);
    
    // Свечение
    const glow = this.add.graphics();
    glow.fillStyle(faction.color, 0.3);
    glow.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
    container.add(glow);
    
    // Аватар
    const avatarSize = 70;
    const avatarY = -h / 2 + 55;
    
    if (this.textures.exists(avatarId)) {
      const avatar = this.add.image(0, avatarY, avatarId);
      avatar.setDisplaySize(avatarSize, avatarSize);
      container.add(avatar);
    } else {
      const placeholder = this.add.circle(0, avatarY, avatarSize / 2, faction.color, 0.5);
      container.add(placeholder);
    }
    
    // Рамка аватара
    const border = this.add.graphics();
    border.lineStyle(4, faction.color, 1);
    border.strokeCircle(0, avatarY, avatarSize / 2 + 2);
    container.add(border);
    
    // Имя
    const nameText = this.add.text(0, avatarY + 55, name, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 3,
      wordWrap: { width: w - 10 },
    }).setOrigin(0.5);
    container.add(nameText);
    
    // Эмблема фракции
    const emblemY = avatarY + 95;
    const emblemKey = `ui_faction_${factionId}_icon`;
    
    if (this.textures.exists(emblemKey)) {
      const emblem = this.add.image(0, emblemY, emblemKey);
      emblem.setDisplaySize(36, 36);
      container.add(emblem);
    } else {
      const emblemPlaceholder = this.add.rectangle(0, emblemY, 30, 30, faction.color);
      container.add(emblemPlaceholder);
    }
    
    // Название фракции
    const factionColorHex = '#' + faction.color.toString(16).padStart(6, '0');
    const factionText = this.add.text(0, emblemY + 30, faction.name, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: factionColorHex,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(factionText);
    
    return container;
  }

  private createVSElement(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const glow = this.add.graphics();
    glow.fillStyle(0xFFD700, 0.3);
    glow.fillCircle(0, 0, 50);
    container.add(glow);
    
    const vsText = this.add.text(0, 0, 'VS', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    container.add(vsText);
    
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.3, to: 0.6 },
      scale: { from: 1, to: 1.2 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    return container;
  }

  private getAIDifficultyName(): string {
    const difficulty = this.sceneData.aiDifficulty || 1;
    const names = ['Rookie', 'Easy', 'Medium', 'Hard', 'Expert', 'Master'];
    return names[Math.min(Math.floor(difficulty * 5), names.length - 1)];
  }

  private createStartButton(): void {
    const { width, height } = this.scale;
    const buttonY = height - 120;
    
    this.startButton = this.add.container(width / 2, buttonY + 50);
    this.startButton.setDepth(30).setAlpha(0);
    
    const buttonBg = this.add.graphics();
    buttonBg.fillStyle(0x228B22, 1);
    buttonBg.fillRoundedRect(-120, -30, 240, 60, 15);
    buttonBg.lineStyle(3, 0x32CD32, 1);
    buttonBg.strokeRoundedRect(-120, -30, 240, 60, 15);
    
    const buttonText = this.add.text(0, 0, '⚔️ START MATCH', {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    
    this.startButton.add([buttonBg, buttonText]);
    
    const hitArea = this.add.rectangle(0, 0, 240, 60, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.startButton.add(hitArea);
    
    hitArea.on('pointerdown', () => this.onStartMatch());
    
    // Пульсация
    this.tweens.add({
      targets: this.startButton,
      scale: { from: 1, to: 1.03 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 1500,
    });
  }

  private startMusic(): void {
    try {
      AudioManager.getInstance().playMusic('bgm_vs_theme');
    } catch (e) {
      console.warn('[MatchVSScene] Could not play music:', e);
    }
  }

  private stopMusic(): void {
    try {
      AudioManager.getInstance().stopMusic();
    } catch (e) {
      console.warn('[MatchVSScene] Could not stop music:', e);
    }
  }

  private playEntranceAnimations(): void {
    const { width, height } = this.scale;
    const cardTargetX1 = width / 2 - 140 / 2 - 60;
    const cardTargetX2 = width / 2 + 140 / 2 + 60;
    
    this.tweens.add({
      targets: this.playerCard,
      x: cardTargetX1,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
      delay: 300,
    });
    
    this.tweens.add({
      targets: this.opponentCard,
      x: cardTargetX2,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
      delay: 500,
    });
    
    this.tweens.add({
      targets: this.vsContainer,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      delay: 900,
    });
    
    this.tweens.add({
      targets: this.startButton,
      y: height - 120,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 1200,
    });
  }

  private onStartMatch(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    console.log('[MatchVSScene] START MATCH clicked');
    
    try {
      AudioManager.getInstance().playSFX('sfx_click');
    } catch (e) {}
    
    this.tweens.add({
      targets: this.startButton,
      scale: 0.9,
      duration: 100,
      yoyo: true,
      onComplete: () => this.goToGame(),
    });
  }

  private goToGame(): void {
    console.log('[MatchVSScene] Transitioning to GameScene');
    
    this.stopMusic();
    this.tweens.killAll();
    
    const { width, height } = this.scale;
    const fade = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    fade.setDepth(100);
    
    this.tweens.add({
      targets: fade,
      alpha: 1,
      duration: 400,
      onComplete: () => {
        console.log('[MatchVSScene] Starting GameScene with skipIntro=true');
        this.scene.start('GameScene', {
          ...this.sceneData.gameSceneData,
          skipIntro: true,
        });
      },
    });
  }

  shutdown(): void {
    this.stopMusic();
  }
}
