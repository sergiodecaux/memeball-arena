// src/scenes/PvPMatchmakingScene.ts
// Сцена поиска PVP матчей

import Phaser from 'phaser';
import { PvPManager } from '../managers/PvPManager';
import { EventBus } from '../core/EventBus';
import { DEFAULT_PVP_CONFIG } from '../types/pvp';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { safeSceneStart } from '../utils/SceneHelpers';

type MatchmakingMode = 'casual' | 'ranked';

export class PvPMatchmakingScene extends Phaser.Scene {
  private pvpManager: PvPManager | null = null;
  private mode: MatchmakingMode = 'ranked';
  private isSearching = false;
  private searchStartTime = 0;
  
  // UI элементы
  private background?: Phaser.GameObjects.Image;
  private container?: Phaser.GameObjects.Container;
  private statusText?: Phaser.GameObjects.Text;
  private timerText?: Phaser.GameObjects.Text;
  private cancelButton?: Phaser.GameObjects.Container;
  private searchAnimation?: Phaser.GameObjects.Container;
  
  private timerEvent?: Phaser.Time.TimerEvent;
  private s = 1; // UI scale
  
  constructor() {
    super({ key: 'PvPMatchmakingScene' });
  }
  
  init(data?: { mode?: MatchmakingMode }): void {
    this.mode = data?.mode || 'ranked';
  }
  
  create(): void {
    this.s = tgApp.getUIScale();
    const { width, height } = this.cameras.main;
    
    // Background
    this.createBackground();
    
    // Container
    this.container = this.add.container(width / 2, height / 2).setDepth(10);
    
    // Title
    const title = this.add.text(0, -height * 0.3, 
      this.mode === 'ranked' ? 'RANKED MATCH' : 'CASUAL MATCH',
      {
        fontFamily: 'Orbitron',
        fontSize: `${28 * this.s}px`,
        color: this.mode === 'ranked' ? '#9d00ff' : '#39ff14',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      }
    );
    title.setOrigin(0.5);
    title.setShadow(4 * this.s, 4 * this.s, '#000000', 10, true, true);
    this.container.add(title);
    
    // Status text
    this.statusText = this.add.text(0, -height * 0.1, 'Connecting...', {
      fontFamily: 'Rajdhani',
      fontSize: `${20 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.8 },
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.statusText.setOrigin(0.5);
    this.container.add(this.statusText);
    
    // Timer text
    this.timerText = this.add.text(0, -height * 0.05, '00:00', {
      fontFamily: 'Rajdhani',
      fontSize: `${48 * this.s}px`,
      color: '#00f2ff',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 6,
    });
    this.timerText.setOrigin(0.5);
    this.container.add(this.timerText);
    
    // Search animation
    this.createSearchAnimation();
    
    // Cancel button
    this.createCancelButton();
    
    // Initialize PVP
    this.initializePvP();
    
    // Start matchmaking
    this.startMatchmaking();
  }
  
  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Gradient background
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a3a, 0x1a1a3a, 1);
    graphics.fillRect(0, 0, width, height);
    
    // Particles
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(1, 3);
      const alpha = Phaser.Math.FloatBetween(0.2, 0.6);
      
      const star = this.add.circle(x, y, size, 0xffffff, alpha);
      
      this.tweens.add({
        targets: star,
        alpha: alpha * 0.3,
        duration: Phaser.Math.Between(2000, 4000),
        yoyo: true,
        repeat: -1,
      });
    }
  }
  
  private createSearchAnimation(): void {
    if (!this.container) return;
    
    const { height } = this.cameras.main;
    
    this.searchAnimation = this.add.container(0, height * 0.15);
    
    // Rotating circle
    const circle = this.add.circle(0, 0, 60, 0x00f2ff, 0);
    circle.setStrokeStyle(4, 0x00f2ff);
    this.searchAnimation.add(circle);
    
    this.tweens.add({
      targets: circle,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0,
      duration: 1500,
      repeat: -1,
      ease: 'Cubic.easeOut',
    });
    
    // Inner circle
    const innerCircle = this.add.circle(0, 0, 40, 0x00f2ff, 0.3);
    this.searchAnimation.add(innerCircle);
    
    this.tweens.add({
      targets: innerCircle,
      angle: 360,
      duration: 2000,
      repeat: -1,
      ease: 'Linear',
    });
    
    // Dots
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = Math.cos(angle) * 70;
      const y = Math.sin(angle) * 70;
      
      const dot = this.add.circle(x, y, 4, 0x00f2ff, 0.8);
      this.searchAnimation.add(dot);
      
      this.tweens.add({
        targets: dot,
        scale: 1.5,
        alpha: 0.3,
        duration: 800,
        delay: i * 100,
        yoyo: true,
        repeat: -1,
      });
    }
    
    this.container.add(this.searchAnimation);
  }
  
  private createCancelButton(): void {
    if (!this.container) return;
    
    const { height } = this.cameras.main;
    
    this.cancelButton = this.add.container(0, height * 0.35);
    
    // Background
    const bg = this.add.rectangle(0, 0, 200 * this.s, 60 * this.s, 0xff4444);
    bg.setStrokeStyle(3, 0xffffff);
    this.cancelButton.add(bg);
    
    // Text
    const text = this.add.text(0, 0, 'CANCEL', {
      fontFamily: 'Orbitron',
      fontSize: `${20 * this.s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);
    this.cancelButton.add(text);
    
    // Interactive
    const hitArea = this.add.rectangle(0, 0, 200 * this.s, 60 * this.s, 0, 0);
    hitArea.setInteractive({ useHandCursor: true });
    
    hitArea.on('pointerdown', () => {
      hapticSelection();
      this.cancelSearch();
    });
    
    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: this.cancelButton,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 150,
      });
    });
    
    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: this.cancelButton,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
      });
    });
    
    this.cancelButton.add(hitArea);
    this.container.add(this.cancelButton);
  }
  
  private initializePvP(): void {
    // Получаем или создаём PvPManager
    this.pvpManager = PvPManager.getInstance({
      serverUrl: DEFAULT_PVP_CONFIG.serverUrl,
      autoReconnect: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    
    // Подписываемся на события
    this.pvpManager.on('match_found', (data: any) => {
      this.onMatchFound(data);
    });
    
    this.pvpManager.on('disconnected', () => {
      this.onDisconnected();
    });
    
    this.pvpManager.on('error', (data: any) => {
      this.onError(data);
    });
  }
  
  private async startMatchmaking(): Promise<void> {
    if (!this.pvpManager) {
      this.updateStatus('PVP Manager not initialized', '#ff4500');
      this.time.delayedCall(2000, () => this.handleBack());
      return;
    }
    
    try {
      this.updateStatus('Connecting to server...', '#ffffff');
      
      // Подключаемся к серверу
      const connected = await this.pvpManager.connect();
      
      if (!connected) {
        this.updateStatus('Failed to connect to server', '#ff4500');
        this.time.delayedCall(2000, () => this.handleBack());
        return;
      }
      
      this.updateStatus('Searching for opponent...', '#00f2ff');
      this.isSearching = true;
      this.searchStartTime = Date.now();
      
      // Start timer
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: this.updateTimer,
        callbackScope: this,
      });
      
      // Начинаем поиск матча
      this.pvpManager.findGame(this.mode);
      
    } catch (error) {
      console.error('[PvPMatchmakingScene] Connection failed:', error);
      this.updateStatus('Connection failed', '#ff4500');
      this.time.delayedCall(2000, () => this.handleBack());
    }
  }
  
  private cancelSearch(): void {
    if (this.isSearching && this.pvpManager) {
      this.pvpManager.cancelSearch();
      this.isSearching = false;
    }
    this.handleBack();
  }
  
  private updateStatus(text: string, color: string): void {
    this.statusText?.setText(text);
    this.statusText?.setColor(color);
    
    // Pulse effect
    this.tweens.add({
      targets: this.statusText,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 200,
      yoyo: true,
      ease: 'Back.easeOut',
    });
  }
  
  private updateTimer(): void {
    if (!this.isSearching) return;
    
    const elapsed = Math.floor((Date.now() - this.searchStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    this.timerText?.setText(
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    );
  }
  
  private onMatchFound(data: any): void {
    console.log('[PvPMatchmakingScene] 🎮 Match found!', data);
    
    this.isSearching = false;
    this.updateStatus('Match found!', '#39ff14');
    hapticImpact('heavy');
    
    // Show VS
    this.time.delayedCall(500, () => {
      this.updateStatus(`VS OPPONENT`, '#fbbf24');
    });
    
    // Start match after 2 seconds
    this.time.delayedCall(2000, () => {
      this.startMatch(data);
    });
  }
  
  private onDisconnected(): void {
    console.log('[PvPMatchmakingScene] Disconnected from server');
    this.updateStatus('Connection lost', '#ff4500');
    this.time.delayedCall(2000, () => this.handleBack());
  }
  
  private onError(data: any): void {
    console.error('[PvPMatchmakingScene] Error:', data);
    this.updateStatus(`Error: ${data.message || 'Unknown'}`, '#ff4500');
    this.time.delayedCall(2000, () => this.handleBack());
  }
  
  private startMatch(matchData: any): void {
    console.log('[PvPMatchmakingScene] Starting match:', matchData);
    
    // Cleanup
    this.cleanup();
    
    // Start GameScene with PVP mode
    this.scene.stop('PvPMatchmakingScene');
    safeSceneStart(this, 'GameScene', {
      mode: 'pvp',
      roomId: matchData.roomId,
      yourTeam: matchData.yourTeam,
      opponentId: matchData.opponentId,
      matchContext: this.mode,
      useFactions: true,
    });
  }
  
  private async handleBack(): Promise<void> {
    this.cleanup();
    this.scene.stop('PvPMatchmakingScene');
    await safeSceneStart(this, 'MainMenuScene');
  }
  
  private cleanup(): void {
    // Cancel search if active
    if (this.isSearching && this.pvpManager) {
      this.pvpManager.cancelSearch();
      this.isSearching = false;
    }
    
    // Stop timer
    if (this.timerEvent) {
      this.timerEvent.destroy();
      this.timerEvent = undefined;
    }
    
    // Stop tweens
    if (this.tweens) {
      this.tweens.killAll();
    }
  }
  
  shutdown(): void {
    this.cleanup();
  }
}
