// src/ui/game/InGameSettings.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { playerData } from '../../data/PlayerData';

export interface InGameSettingsCallbacks {
  onClose: () => void;
}

/**
 * Настройки во время игры
 */
export class InGameSettings {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: InGameSettingsCallbacks;

  constructor(scene: Phaser.Scene, callbacks: InGameSettingsCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
    const { width, height } = scene.cameras.main;
    
    // Overlay
    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    this.overlay.setOrigin(0, 0).setDepth(200);
    this.overlay.setInteractive();
    
    // Container
    this.container = scene.add.container(width / 2, height / 2);
    this.container.setDepth(201);
    
    this.create();
    this.animateIn();
  }

  private create(): void {
    const colors = getColors();
    const data = playerData.get();
    
    const panelWidth = 300;
    const panelHeight = 280;
    
    // Panel background
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f0f1a, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    panel.lineStyle(2, colors.uiPrimary, 0.5);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    this.container.add(panel);
    
    // Title
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 30, i18n.t('settings').toUpperCase(), {
      fontSize: '20px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5));
    
    // Settings toggles
    const itemWidth = panelWidth - 40;
    let y = -panelHeight / 2 + 80;
    
    // Sound
    this.createToggle(0, y, itemWidth, i18n.t('sound'), data.settings.soundEnabled, (val) => {
      data.settings.soundEnabled = val;
      playerData.save();
    });
    y += 55;
    
    // Music
    this.createToggle(0, y, itemWidth, i18n.t('music'), data.settings.musicEnabled, (val) => {
      data.settings.musicEnabled = val;
      playerData.save();
    });
    y += 55;
    
    // Vibration
    this.createToggle(0, y, itemWidth, i18n.t('vibration'), data.settings.vibrationEnabled, (val) => {
      data.settings.vibrationEnabled = val;
      playerData.save();
    });
    
    // Close button
    this.createCloseButton(0, panelHeight / 2 - 40, 120, 36);
  }

  private createToggle(x: number, y: number, w: number, label: string, value: boolean, onChange: (val: boolean) => void): void {
    const colors = getColors();
    const row = this.scene.add.container(x, y);
    
    // Background
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.6);
    bg.fillRoundedRect(-w / 2, -22, w, 44, 8);
    row.add(bg);
    
    // Label
    row.add(this.scene.add.text(-w / 2 + 15, 0, label, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5));
    
    // Toggle
    const toggleX = w / 2 - 40;
    const toggleW = 48;
    const toggleH = 26;
    
    const toggle = this.scene.add.graphics();
    let currentValue = value;
    
    const drawToggle = (on: boolean) => {
      toggle.clear();
      toggle.fillStyle(on ? colors.uiAccent : 0x3a3a4a, 1);
      toggle.fillRoundedRect(toggleX - toggleW / 2, -toggleH / 2, toggleW, toggleH, 13);
      
      const circleX = on ? toggleX + toggleW / 2 - 14 : toggleX - toggleW / 2 + 14;
      toggle.fillStyle(0xffffff, 1);
      toggle.fillCircle(circleX, 0, 9);
    };
    drawToggle(currentValue);
    row.add(toggle);
    
    // Hit area
    const hitArea = this.scene.add.rectangle(toggleX, 0, toggleW + 20, toggleH + 10, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    row.add(hitArea);
    
    hitArea.on('pointerdown', () => {
      currentValue = !currentValue;
      drawToggle(currentValue);
      onChange(currentValue);
    });
    
    this.container.add(row);
  }

  private createCloseButton(x: number, y: number, w: number, h: number): void {
    const colors = getColors();
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(colors.uiPrimary, hover ? 0.3 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(2, colors.uiPrimary, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(0, 0, i18n.t('back'), {
      fontSize: '14px',
      color: hexToString(colors.uiPrimary),
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', () => {
      this.hide(() => this.callbacks.onClose());
    });
    
    this.container.add(btn);
  }

  private animateIn(): void {
    this.container.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  hide(onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.9,
      alpha: 0,
      duration: 150,
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