// src/ui/game/PauseMenu.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, getGlassStyle } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { AudioManager } from '../../managers/AudioManager';

export interface PauseMenuCallbacks {
  onResume: () => void;
  onChangeFormation: () => void;
  onSettings: () => void;
  onSurrender: () => void;
}

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
    
    // Overlay with blur effect simulation
    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85);
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
    const fonts = getFonts();
    
    const panelWidth = 300;
    const panelHeight = 360;
    
    // Panel background with glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(10, colors.uiAccentPink, 0.1);
    glow.strokeRoundedRect(-panelWidth / 2 - 5, -panelHeight / 2 - 5, panelWidth + 10, panelHeight + 10, 22);
    this.container.add(glow);
    
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x14101e, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top accent line
    panel.fillStyle(colors.uiAccentPink, 0.7);
    panel.fillRoundedRect(-40, -panelHeight / 2 + 1, 80, 3, 2);
    
    panel.lineStyle(2, colors.uiAccentPink, 0.4);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);
    
    // Title
    const title = this.scene.add.text(0, -panelHeight / 2 + 40, i18n.t('pause').toUpperCase(), {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Separator
    const sep = this.scene.add.graphics();
    sep.lineStyle(1, colors.uiAccentPink, 0.2);
    sep.lineBetween(-panelWidth / 2 + 30, -panelHeight / 2 + 70, panelWidth / 2 - 30, -panelHeight / 2 + 70);
    this.container.add(sep);
    
    // Buttons
    const btnWidth = panelWidth - 50;
    const btnHeight = 52;
    let btnY = -panelHeight / 2 + 105;
    const btnGap = btnHeight + 12;
    
    // Resume
    this.createButton(0, btnY, btnWidth, btnHeight, '▶️', i18n.t('resume'), colors.uiAccent, () => {
      this.hide(() => this.callbacks.onResume());
    });
    btnY += btnGap;
    
    // Change Formation
    this.createButton(0, btnY, btnWidth, btnHeight, '📐', i18n.t('changeFormation'), colors.uiPrimary, () => {
      this.hide(() => this.callbacks.onChangeFormation());
    });
    btnY += btnGap;
    
    // Settings
    this.createButton(0, btnY, btnWidth, btnHeight, '⚙️', i18n.t('settings'), 0x6b7280, () => {
      this.hide(() => this.callbacks.onSettings());
    });
    btnY += btnGap;
    
    // Surrender
    this.createButton(0, btnY, btnWidth, btnHeight, '🏳️', i18n.t('surrender'), 0xef4444, () => {
      this.showSurrenderConfirmation();
    });
  }

  private createButton(
    x: number, y: number, w: number, h: number, 
    icon: string, text: string, color: number, 
    onClick: () => void
  ): void {
    const fonts = getFonts();
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean, pressed: boolean) => {
      bg.clear();
      bg.fillStyle(color, pressed ? 0.3 : (hover ? 0.2 : 0.1));
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(2, color, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    draw(false, false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(-w / 2 + 30, 0, icon, { fontSize: '20px' }).setOrigin(0.5));
    
    const label = this.scene.add.text(-w / 2 + 60, 0, text, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: hexToString(color),
    }).setOrigin(0, 0.5);
    btn.add(label);
    
    btn.add(this.scene.add.text(w / 2 - 20, 0, '›', {
      fontSize: '20px',
      color: hexToString(color),
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => { draw(true, false); btn.setScale(1.02); });
    hitArea.on('pointerout', () => { draw(false, false); btn.setScale(1); });
    hitArea.on('pointerdown', () => draw(true, true));
    hitArea.on('pointerup', () => {
      draw(true, false);
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });
    
    this.container.add(btn);
  }

  private showSurrenderConfirmation(): void {
    if (this.surrenderModal) return;
    
    const colors = getColors();
    const fonts = getFonts();
    
    this.surrenderModal = this.scene.add.container(0, 0);
    this.surrenderModal.setDepth(10);
    
    // Semi-overlay
    const overlay = this.scene.add.rectangle(0, 0, 320, 380, 0x000000, 0.6);
    this.surrenderModal.add(overlay);
    
    // Modal
    const modalW = 260;
    const modalH = 170;
    
    const modal = this.scene.add.graphics();
    modal.fillStyle(0x1a1a2e, 1);
    modal.fillRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    modal.lineStyle(2, 0xef4444, 0.8);
    modal.strokeRoundedRect(-modalW / 2, -modalH / 2, modalW, modalH, 16);
    this.surrenderModal.add(modal);
    
    // Warning icon
    this.surrenderModal.add(this.scene.add.text(0, -modalH / 2 + 30, '⚠️', { fontSize: '28px' }).setOrigin(0.5));
    
    // Text
    const text = this.scene.add.text(0, -10, i18n.t('confirmSurrender'), {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: modalW - 40 },
    }).setOrigin(0.5);
    this.surrenderModal.add(text);
    
    // Buttons
    const btnW = 100;
    const btnH = 40;
    
    this.createModalButton(-60, 55, btnW, btnH, i18n.t('no'), 0x6b7280, () => {
      this.surrenderModal?.destroy();
      this.surrenderModal = null;
    });
    
    this.createModalButton(60, 55, btnW, btnH, i18n.t('yes'), 0xef4444, () => {
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
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private createModalButton(
    x: number, y: number, w: number, h: number, 
    text: string, color: number, onClick: () => void
  ): void {
    if (!this.surrenderModal) return;
    
    const fonts = getFonts();
    const btn = this.scene.add.container(x, y);
    
    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.4 : 0.2);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(2, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);
    btn.add(bg);
    
    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(color),
    }).setOrigin(0.5));
    
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    
    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });
    
    this.surrenderModal.add(btn);
  }

  private animateIn(): void {
    this.container.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 250,
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