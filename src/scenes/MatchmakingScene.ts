// src/scenes/MatchmakingScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { MultiplayerManager, GameStartData, PvPPlayer } from '../managers/MultiplayerManager';
import { AudioManager } from '../managers/AudioManager';
import { playerData } from '../data/PlayerData';
import { getCapSkin, getFieldSkin, getRarityColor } from '../data/SkinsCatalog';

export class MatchmakingScene extends Phaser.Scene {
  private mp!: MultiplayerManager;
  private statusText!: Phaser.GameObjects.Text;
  private dotsText!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Container;
  private searchTimer = 0;
  private dotCount = 0;
  private isSearching = false;
  
  // Found opponent display
  private matchFoundContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MatchmakingScene' });
  }

  create(): void {
    const { centerX, centerY, width, height } = this.cameras.main;
    const colors = getColors();
    
    this.mp = MultiplayerManager.getInstance();
    
    // Background
    this.add.rectangle(centerX, centerY, width, height, colors.background);
    
    // Animated background particles
    this.createBackgroundParticles();
    
    // Title
    this.add.text(centerX, 80, '⚔️ PVP ARENA ⚔️', {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: hexToString(colors.uiAccent),
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    
    // Status text
    this.statusText = this.add.text(centerX, centerY - 30, 'Connecting to server...', {
      fontFamily: 'Arial',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    
    // Animated dots
    this.dotsText = this.add.text(centerX, centerY + 10, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: hexToString(colors.uiPrimary),
    }).setOrigin(0.5);
    
    // My skin preview
    this.createMySkinPreview();
    
    // Cancel button
    this.createCancelButton(centerX, height - 80);
    
    // Start connection
    this.connectAndSearch();
    
    // Animation timers
    this.time.addEvent({
      delay: 500,
      callback: this.updateDots,
      callbackScope: this,
      loop: true
    });
    
    this.time.addEvent({
      delay: 1000,
      callback: this.updateSearchTimer,
      callbackScope: this,
      loop: true
    });
  }

  private createBackgroundParticles(): void {
    const { width, height } = this.cameras.main;
    
    // Simple floating particles
    for (let i = 0; i < 20; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(2, 5);
      
      const particle = this.add.circle(x, y, size, 0x00ffff, 0.3);
      
      this.tweens.add({
        targets: particle,
        y: y - 100,
        alpha: 0,
        duration: Phaser.Math.Between(3000, 6000),
        repeat: -1,
        onRepeat: () => {
          particle.x = Phaser.Math.Between(0, width);
          particle.y = height + 50;
          particle.alpha = 0.3;
        }
      });
    }
  }

  private createMySkinPreview(): void {
    const { centerX, height } = this.cameras.main;
    const data = playerData.get();
    const capSkin = getCapSkin(data.equippedCapSkin);
    
    if (!capSkin) return;
    
    const container = this.add.container(centerX, height - 180);
    
    // Label
    const label = this.add.text(0, -40, 'YOUR LOADOUT', {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5);
    container.add(label);
    
    // Skin circle preview
    const skinCircle = this.add.circle(0, 0, 25, capSkin.primaryColor);
    skinCircle.setStrokeStyle(2, capSkin.secondaryColor);
    container.add(skinCircle);
    
    // Rarity indicator
    const rarityColor = getRarityColor(capSkin.rarity);
    const rarityRing = this.add.circle(0, 0, 30, rarityColor, 0);
    rarityRing.setStrokeStyle(2, rarityColor);
    container.add(rarityRing);
    
    // Skin name
    const skinName = this.add.text(0, 45, capSkin.name, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: hexToString(rarityColor),
    }).setOrigin(0.5);
    container.add(skinName);
  }

  private createCancelButton(x: number, y: number): void {
    this.cancelButton = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x333333, 1);
    bg.fillRoundedRect(-100, -25, 200, 50, 12);
    bg.lineStyle(2, 0x666666, 1);
    bg.strokeRoundedRect(-100, -25, 200, 50, 12);
    this.cancelButton.add(bg);
    
    const text = this.add.text(0, 0, '✖ CANCEL', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.cancelButton.add(text);
    
    this.cancelButton.setInteractive(
      new Phaser.Geom.Rectangle(-100, -25, 200, 50),
      Phaser.Geom.Rectangle.Contains
    );
    
    this.cancelButton.on('pointerover', () => this.cancelButton.setScale(1.05));
    this.cancelButton.on('pointerout', () => this.cancelButton.setScale(1));
    this.cancelButton.on('pointerdown', () => this.cancelSearch());
  }

  private async connectAndSearch(): Promise<void> {
    this.statusText.setText('Connecting to server...');
    
    const connected = await this.mp.connect();
    
    if (!connected) {
      this.statusText.setText('❌ Connection failed!\nCheck your internet connection.');
      this.dotsText.setText('');
      return;
    }
    
    // Setup event listeners
    this.setupListeners();
    
    // Start searching
    this.isSearching = true;
    this.searchTimer = 0;
    this.statusText.setText('Searching for opponent...');
    this.mp.findGame();
  }

  private setupListeners(): void {
    this.mp.on('waiting', (data: any) => {
      this.statusText.setText('Searching for opponent...');
    });
    
    this.mp.on('game_start', (data: GameStartData) => {
      this.isSearching = false;
      AudioManager.getInstance().playSFX('sfx_click');
      this.showMatchFound(data);
    });
    
    this.mp.on('search_cancelled', () => {
      this.scene.start('MainMenuScene');
    });
    
    this.mp.on('disconnected', () => {
      this.statusText.setText('❌ Disconnected from server');
      this.dotsText.setText('');
      this.isSearching = false;
    });
  }

  private showMatchFound(data: GameStartData): void {
    const { centerX, centerY, width, height } = this.cameras.main;
    const colors = getColors();
    
    // Hide search UI
    this.statusText.setVisible(false);
    this.dotsText.setVisible(false);
    this.cancelButton.setVisible(false);
    
    // Find me and opponent
    const myId = this.mp.getMyId();
    const me = data.players.find(p => p.id === myId)!;
    const opponent = data.players.find(p => p.id !== myId)!;
    const amIFieldOwner = data.fieldOwnerId === myId;
    
    // Create match found container
    this.matchFoundContainer = this.add.container(centerX, centerY);
    
    // Background overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    this.matchFoundContainer.add(overlay);
    
    // Title
    const title = this.add.text(0, -150, '⚔️ MATCH FOUND! ⚔️', {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ff4757',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.matchFoundContainer.add(title);
    
    // Player cards
    const myCard = this.createPlayerCard(-100, -20, me, true, 'YOU');
    const oppCard = this.createPlayerCard(100, -20, opponent, false, opponent.name);
    this.matchFoundContainer.add(myCard);
    this.matchFoundContainer.add(oppCard);
    
    // VS text
    const vsText = this.add.text(0, -20, 'VS', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: '#ffffff',
      stroke: '#ff0000',
      strokeThickness: 6
    }).setOrigin(0.5);
    this.matchFoundContainer.add(vsText);
    
    // Animate VS
    this.tweens.add({
      targets: vsText,
      scale: { from: 0.5, to: 1.2 },
      duration: 500,
      yoyo: true,
      repeat: 2
    });
    
    // Field info
    const fieldOwner = amIFieldOwner ? 'YOUR' : `${opponent.name}'s`;
    const fieldSkin = getFieldSkin(data.fieldSkin);
    const fieldInfo = this.add.text(0, 100, `🏟️ Playing on ${fieldOwner} field`, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: amIFieldOwner ? '#4ade80' : '#f59e0b',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.matchFoundContainer.add(fieldInfo);
    
    // Field skin name
    if (fieldSkin) {
      const fieldName = this.add.text(0, 125, `"${fieldSkin.name}"`, {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: hexToString(getRarityColor(fieldSkin.rarity)),
      }).setOrigin(0.5);
      this.matchFoundContainer.add(fieldName);
    }
    
    // Start game after delay
    this.time.delayedCall(3000, () => {
      this.startPvPGame(data);
    });
  }

  private createPlayerCard(x: number, y: number, player: PvPPlayer, isMe: boolean, displayName: string): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    const capSkin = getCapSkin(player.capSkin);
    const primaryColor = capSkin?.primaryColor || (isMe ? 0x00ff00 : 0xff0000);
    const secondaryColor = capSkin?.secondaryColor || primaryColor;
    const rarityColor = capSkin ? getRarityColor(capSkin.rarity) : 0xffffff;
    
    // Card background
    const bg = this.add.graphics();
    bg.fillStyle(isMe ? 0x003300 : 0x330000, 0.5);
    bg.fillRoundedRect(-70, -80, 140, 160, 10);
    bg.lineStyle(2, isMe ? 0x00ff00 : 0xff0000, 0.8);
    bg.strokeRoundedRect(-70, -80, 140, 160, 10);
    container.add(bg);
    
    // Cap skin preview
    const capCircle = this.add.circle(0, -30, 30, primaryColor);
    capCircle.setStrokeStyle(3, secondaryColor);
    container.add(capCircle);
    
    // Rarity ring
    const rarityRing = this.add.circle(0, -30, 35, rarityColor, 0);
    rarityRing.setStrokeStyle(2, rarityColor);
    container.add(rarityRing);
    
    // Glow effect for legendary/epic
    if (capSkin && (capSkin.rarity === 'legendary' || capSkin.rarity === 'epic')) {
      this.tweens.add({
        targets: rarityRing,
        alpha: { from: 0.5, to: 1 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Name
    const name = this.add.text(0, 25, displayName, {
      fontFamily: 'Arial Black',
      fontSize: '14px',
      color: isMe ? '#4ade80' : '#ff6b6b',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    container.add(name);
    
    // Level
    const level = this.add.text(0, 45, `Lv.${player.level}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    container.add(level);
    
    // Skin name
    if (capSkin) {
      const skinName = this.add.text(0, 62, capSkin.name, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: hexToString(rarityColor),
      }).setOrigin(0.5);
      container.add(skinName);
    }
    
    // Animate entrance
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
      delay: isMe ? 0 : 200
    });
    
    return container;
  }

  private startPvPGame(data: GameStartData): void {
    // Clear listeners
    this.mp.off('waiting');
    this.mp.off('game_start');
    this.mp.off('search_cancelled');
    
    // Start game scene with PvP data
    this.scene.start('GameScene', {
      vsAI: false,
      isPvP: true,
      pvpData: data
    });
  }

  private cancelSearch(): void {
    AudioManager.getInstance().playSFX('sfx_click');
    
    if (this.isSearching) {
      this.mp.cancelSearch();
    }
    
    this.mp.off('waiting');
    this.mp.off('game_start');
    this.mp.off('search_cancelled');
    this.mp.off('disconnected');
    
    this.scene.start('MainMenuScene');
  }

  private updateDots(): void {
    if (!this.isSearching) return;
    this.dotCount = (this.dotCount + 1) % 4;
    this.dotsText.setText('.'.repeat(this.dotCount));
  }

  private updateSearchTimer(): void {
    if (!this.isSearching) return;
    this.searchTimer++;
    
    const minutes = Math.floor(this.searchTimer / 60);
    const seconds = this.searchTimer % 60;
    const timeStr = minutes > 0 
      ? `${minutes}:${seconds.toString().padStart(2, '0')}`
      : `${seconds}s`;
    
    this.statusText.setText(`Searching for opponent... (${timeStr})`);
  }

  shutdown(): void {
    this.mp.off('waiting');
    this.mp.off('game_start');
    this.mp.off('search_cancelled');
    this.mp.off('disconnected');
  }
}