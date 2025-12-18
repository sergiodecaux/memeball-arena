// src/ui/game/PauseMenu.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { i18n } from '../../localization/i18n';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onChangeFormation: () => void;
  onSettings: () => void;
  onSurrender: () => void;
}

/**
 * Меню паузы
 */
export class PauseMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private surrenderModal: Phaser.GameObjects.Container | null = null;
  private callbacks: PauseMenuCallbacks;

  constructor(scene: Phaser.Scene, callbacks: PauseMenuCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    
    const { width, height } = scene.cameras.main;
    
    // Overlay
    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.7);
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
    
    const panelWidth = 280;
    const panelHeight = 320;
    
    // Panel background
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f0f1a, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    panel.lineStyle(2, colors.uiPrimary, 0.5);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    this.container.add(panel);
    
    // Glow
    for (let i = 3; i >= 1; i--) {
      const glow = this.scene.add.graphics();
      glow.lineStyle(6 / i, colors.uiPrimary, 0.1 * i);
      glow.strokeRoundedRect(-panelWidth / 2 - 2, -panelHeight / 2 - 2, panelWidth + 4, panelHeight + 4, 18);
      this.container.add(glow);
    }
    
    // Title
    const title = this.scene.add.text(0, -panelHeight / 2 + 35, i18n.t('pause').toUpperCase(), {
      fontSize: '24px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, colors.uiPrimary, 0.3);
    sep.lineBetween(-panelWidth / 2 + 20, -panelHeight / 2 + 65, panelWidth / 2 - 20, -panelHeight / 2 + 65);
    this.container.add(sep);
    
    // Buttons
    const btnWidth = panelWidth - 40;
    const btnHeight = 50;
    let btnY = -panelHeight / 2 + 100;
    
    // Resume
    this.createButton(0, btnY, btnWidth, btnHeight, i18n.t('resume'), colors.uiAccent, () => {
      this.hide(() => this.callbacks.onResume());
    });
    btnY += btnHeight + 15;
    
    // Change Formation
    this.createButton(0, btnY, btnWidth, btnHeight, i18n.t('changeFormation'), colors.uiPrimary, () => {
      this.hide(() => this.callbacks.onChangeFormation());
    });
    btnY += btnHeight + 15;
    
    // Settings
    this.createButton(0, btnY, btnWidth, btnHeight, i18n.t('settings'), 0x6b7280, () => {
      this.hide(() => this.callbacks.onSettings());
    });
    btnY += btnHeight + 15;
    
    // Surrender
    this.createButton(0, btnY, btnWidth, btnHeight, i18n.t('surrender'), 0xef4444, () => {
      this.showSurrenderConfirmation();
    });
  }

  private createButton(x: number, y: number, w: number, h: number, text: string, color: number, onClick: () => void): void {
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean, pressed: boolean) => {
      bg.clear();
      bg.fillStyle(color, pressed ? 0.4 : (hover ? 0.25 : 0.15));
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false, false);
    btn.add(bg);
    
    const label = this.scene.add.text(0, 0, text, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.add(label);
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => draw(true, false));
    hitArea.on('pointerout', () => draw(false, false));
    hitArea.on('pointerdown', () => draw(true, true));
    hitArea.on('pointerup', () => {
      draw(true, false);
      onClick();
    });
    
    this.container.add(btn);
  }

  private showSurrenderConfirmation(): void {
    if (this.surrenderModal) return;
    
    this.surrenderModal = this.scene.add.container(0, 0);
    this.surrenderModal.setDepth(10);
    
    // Semi-overlay
    const overlay = this.scene.add.rectangle(0, 0, 300, 340, 0x000000, 0.5);
    this.surrenderModal.add(overlay);
    
    // Modal
    const modalW = 250;
    const modalH = 160;
    
    const modal = this.scene.add.graphics();
    modal.fillStyle(0x1a1a2e, 1);
    modal.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 12);
    modal.lineStyle(2, 0xef4444, 0.8);
    modal.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 12);
    this.surrenderModal.add(modal);
    
    // Text
    const text = this.scene.add.text(0, -30, i18n.t('confirmSurrender'), {
      fontSize: '14px',
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: modalW - 30 },
    }).setOrigin(0.5);
    this.surrenderModal.add(text);
    
    // Buttons
    const btnW = 90;
    const btnH = 36;
    
    // No
    this.createModalButton(-55, 40, btnW, btnH, i18n.t('no'), 0x6b7280, () => {
      this.surrenderModal?.destroy();
      this.surrenderModal = null;
    });
    
    // Yes
    this.createModalButton(55, 40, btnW, btnH, i18n.t('yes'), 0xef4444, () => {
      this.surrenderModal?.destroy();
      this.surrenderModal = null;
      this.hide(() => this.callbacks.onSurrender());
    });
    
    this.container.add(this.surrenderModal);
    
    // Animation
    this.surrenderModal.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({
      targets: this.surrenderModal,
      scale: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
    });
  }

  private createModalButton(x: number, y: number, w: number, h: number, text: string, color: number, onClick: () => void): void {
    if (!this.surrenderModal) return;
    
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.4 : 0.2);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '14px',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', onClick);
    
    this.surrenderModal.add(btn);
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