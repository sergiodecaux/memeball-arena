// src/scenes/MatchmakingScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { MultiplayerManager, GameStartData, PvPPlayer } from '../managers/MultiplayerManager';
import { AudioManager } from '../managers/AudioManager';
import { playerData } from '../data/PlayerData';

export class MatchmakingScene extends Phaser.Scene {
  private mp!: MultiplayerManager;
  private statusText!: Phaser.GameObjects.Text;
  private dotsText!: Phaser.GameObjects.Text;
  private cancelButton!: Phaser.GameObjects.Container;
  private searchTimer = 0;
  private dotCount = 0;
  private isSearching = false;
  
  // Found opponent display
  private opponentContainer?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MatchmakingScene' });
  }

  create(): void {
    const { centerX, centerY, width, height } = this.cameras.main;
    const colors = getColors();
    
    this.mp = MultiplayerManager.getInstance();
    
    // Background
    this.add.rectangle(centerX, centerY, width, height, colors.background);
    
    // Title
    this.add.text(centerX, 100, '⚔️ PVP ARENA ⚔️', {
      fontFamily: 'Arial Black',
      fontSize: '32px',
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    
    // Status text
    this.statusText = this.add.text(centerX, centerY - 50, 'Connecting to server...', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
    }).setOrigin(0.5);
    
    // Animated dots
    this.dotsText = this.add.text(centerX, centerY, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: hexToString(colors.uiPrimary),
    }).setOrigin(0.5);
    
    // Cancel button
    this.createCancelButton(centerX, centerY + 150);
    
    // Start connection
    this.connectAndSearch();
    
    // Animation timer
    this.time.addEvent({
      delay: 500,
      callback: this.updateDots,
      callbackScope: this,
      loop: true
    });
    
    // Search timer
    this.time.addEvent({
      delay: 1000,
      callback: this.updateSearchTimer,
      callbackScope: this,
      loop: true
    });
  }

  private createCancelButton(x: number, y: number): void {
    const colors = getColors();
    
    this.cancelButton = this.add.container(x, y);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x666666, 1);
    bg.fillRoundedRect(-100, -25, 200, 50, 12);
    bg.lineStyle(2, 0x888888, 1);
    bg.strokeRoundedRect(-100, -25, 200, 50, 12);
    this.cancelButton.add(bg);
    
    const text = this.add.text(0, 0, 'CANCEL', {
      fontFamily: 'Arial Black',
      fontSize: '18px',
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
      this.showOpponentFound(data);
    });
    
    this.mp.on('search_cancelled', () => {
      this.scene.start('MainMenuScene');
    });
    
    this.mp.on('disconnected', () => {
      this.statusText.setText('❌ Disconnected from server');
      this.isSearching = false;
    });
  }

  private showOpponentFound(data: GameStartData): void {
    const { centerX, centerY } = this.cameras.main;
    const colors = getColors();
    
    // Hide search UI
    this.statusText.setVisible(false);
    this.dotsText.setVisible(false);
    this.cancelButton.setVisible(false);
    
    // Find me and opponent
    const myId = this.mp.getMyId();
    const me = data.players.find(p => p.id === myId)!;
    const opponent = data.players.find(p => p.id !== myId)!;
    
    // Create opponent display
    this.opponentContainer = this.add.container(centerX, centerY);
    
    // VS text
    const vsText = this.add.text(0, -100, '⚔️ MATCH FOUND! ⚔️', {
      fontFamily: 'Arial Black',
      fontSize: '28px',
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    
    // Player cards
    const myCard = this.createPlayerCard(-120, 0, me, true);
    const vsMiddle = this.add.text(0, 0, 'VS', {
      fontFamily: 'Arial Black',
      fontSize: '36px',
      color: '#ff0000',
    }).setOrigin(0.5);
    const oppCard = this.createPlayerCard(120, 0, opponent, false);
    
    this.opponentContainer.add([vsText, myCard, vsMiddle, oppCard]);
    
    // Start game after delay
    this.time.delayedCall(2500, () => {
      this.startPvPGame(data);
    });
  }

  private createPlayerCard(x: number, y: number, player: PvPPlayer, isMe: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    
    // Card background
    const bg = this.add.rectangle(0, 0, 180, 120, isMe ? 0x00aa00 : 0xaa0000, 0.3);
    bg.setStrokeStyle(2, isMe ? 0x00ff00 : 0xff0000);
    
    // Avatar circle
    const avatar = this.add.circle(0, -20, 30, isMe ? 0x0088ff : 0xff4400);
    
    // Name
    const name = this.add.text(0, 30, player.name, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5);
    
    // Level
    const level = this.add.text(0, 50, `Lv.${player.level}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5);
    
    container.add([bg, avatar, name, level]);
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
    if (this.isSearching) {
      this.mp.cancelSearch();
    }
    this.mp.off('waiting');
    this.mp.off('game_start');
    this.mp.off('search_cancelled');
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