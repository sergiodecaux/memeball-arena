// src/ui/game/FormationMenu.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { playerData, DEFAULT_FORMATIONS } from '../../data/PlayerData';
import { Formation, FormationSlot } from '../../types';
import { getCapSkin, CAP_SKINS, getRoleIcon, getRoleColor } from '../../data/SkinsCatalog';
import { AudioManager } from '../../managers/AudioManager';

export interface FormationMenuCallbacks {
  onSelect: (formation: Formation) => void;
  onCancel: () => void;
}

export class FormationMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: FormationMenuCallbacks;
  private currentFormationId: string;
  private selectedFormation: Formation;
  private formationPreviewContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, currentFormationId: string, callbacks: FormationMenuCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.currentFormationId = currentFormationId;
    this.selectedFormation = playerData.getSelectedFormation();

    const { width, height } = scene.cameras.main;

    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(200)
      .setInteractive();

    scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.9,
      duration: 200,
    });

    this.container = scene.add.container(width / 2, height / 2).setDepth(201);

    this.create();
    this.animateIn();
  }

  private create(): void {
    const colors = getColors();
    const fonts = getFonts();
    const { width, height } = this.scene.cameras.main;

    const panelWidth = Math.min(400, width - 30);
    const panelHeight = Math.min(520, height - 50);

    // Background with glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(10, colors.uiAccent, 0.1);
    glow.strokeRoundedRect(-panelWidth / 2 - 5, -panelHeight / 2 - 5, panelWidth + 10, panelHeight + 10, 22);
    this.container.add(glow);

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x14101e, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top accent
    panel.fillStyle(colors.uiAccent, 0.7);
    panel.fillRoundedRect(-50, -panelHeight / 2 + 1, 100, 3, 2);
    
    panel.lineStyle(2, colors.uiAccent, 0.4);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 30, i18n.t('selectFormation').toUpperCase(), {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5));

    // Hint
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 55, 'Select position layout for your team', {
      fontSize: '11px',
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    // Formation preview
    this.createFormationPreview(0, -panelHeight / 2 + 175, panelWidth - 60);

    // Formation list
    this.createFormationList(-panelWidth / 2 + 20, 50, panelWidth - 40, 160);

    // Buttons
    this.createButtons(panelHeight / 2 - 50);
  }

  private createFormationPreview(x: number, y: number, maxWidth: number): void {
    this.formationPreviewContainer = this.scene.add.container(x, y);
    this.container.add(this.formationPreviewContainer);
    this.renderFormationPreview();
  }

  private renderFormationPreview(): void {
    this.formationPreviewContainer.removeAll(true);

    const colors = getColors();
    const fonts = getFonts();
    const formation = this.selectedFormation;
    const teamCapIds = playerData.getTeamCapIds();

    const fieldW = 200;
    const fieldH = 150;

    // Field background
    const field = this.scene.add.graphics();
    field.fillStyle(0x1a472a, 0.9);
    field.fillRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 10);
    
    // Field lines
    field.lineStyle(1, 0x3da64d, 0.5);
    field.lineBetween(-fieldW / 2, 0, fieldW / 2, 0);
    field.strokeCircle(0, 0, 25);
    
    // Goals
    const goalW = 50;
    field.lineStyle(2, colors.uiAccentPink, 0.7);
    field.strokeRect(-goalW / 2, -fieldH / 2 - 6, goalW, 12);
    field.lineStyle(2, colors.uiAccent, 0.7);
    field.strokeRect(-goalW / 2, fieldH / 2 - 6, goalW, 12);
    
    field.lineStyle(2, 0x3da64d, 0.7);
    field.strokeRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 10);
    this.formationPreviewContainer.add(field);

    // Formation name
    this.formationPreviewContainer.add(this.scene.add.text(0, -fieldH / 2 - 30, formation.name, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));

    // Draw slots with actual team caps
    formation.slots.forEach((slot, index) => {
      const slotX = (slot.x - 0.5) * fieldW;
      const slotY = (slot.y - 0.5) * fieldH;
      
      const capId = teamCapIds[index] || 'meme_doge';
      const capSkin = getCapSkin(capId);
      
      this.createSlotPreview(slotX, slotY, capSkin);
    });
  }

  private createSlotPreview(x: number, y: number, capSkin: any): void {
    const container = this.scene.add.container(x, y);
    const radius = 22;

    if (!capSkin) {
      // Fallback
      const circle = this.scene.add.circle(0, 0, radius, 0x666666, 0.8);
      container.add(circle);
      this.formationPreviewContainer.add(container);
      return;
    }

    const roleColor = getRoleColor(capSkin.role);

    // Glow
    const glow = this.scene.add.circle(0, 0, radius + 4, roleColor, 0.35);
    container.add(glow);

    // Shadow
    container.add(this.scene.add.ellipse(2, 2, radius * 1.7, radius * 1.3, 0x000000, 0.3));

    // Cap visual
    if (capSkin.visual?.type === 'image' && capSkin.visual.imageKey) {
      const imageKey = capSkin.visual.imageKey;
      if (this.scene.textures.exists(imageKey)) {
        const borderColor = capSkin.visual.borderColor ?? capSkin.primaryColor;
        
        container.add(this.scene.add.circle(0, 0, radius + 2, borderColor));
        container.add(this.scene.add.circle(0, 0, radius, 0xffffff));
        
        const image = this.scene.add.image(0, 0, imageKey);
        const texture = this.scene.textures.get(imageKey);
        const frame = texture.getSourceImage();
        const imgSize = Math.max(frame.width, frame.height);
        const targetSize = radius * 2 * 0.85;
        image.setScale(targetSize / imgSize);
        container.add(image);
        
        // Mask
        const maskGraphics = this.scene.add.graphics();
        maskGraphics.setVisible(false);
        maskGraphics.fillStyle(0xffffff);
        const worldPos = this.formationPreviewContainer.getWorldTransformMatrix();
        maskGraphics.fillCircle(worldPos.tx + x, worldPos.ty + y, radius);
        image.setMask(maskGraphics.createGeometryMask());
        
      } else {
        this.drawFallbackCap(container, radius, capSkin);
      }
    } else if (capSkin.visual?.textureKey && this.scene.textures.exists(capSkin.visual.textureKey)) {
      const scale = (radius * 2) / 128;
      const sprite = this.scene.add.sprite(0, 0, capSkin.visual.textureKey).setScale(scale);
      container.add(sprite);
    } else {
      this.drawFallbackCap(container, radius, capSkin);
    }

    // Role icon badge
    const iconBg = this.scene.add.circle(radius * 0.6, -radius * 0.6, 10, 0x000000, 0.8);
    container.add(iconBg);
    container.add(this.scene.add.text(radius * 0.6, -radius * 0.6, getRoleIcon(capSkin.role), {
      fontSize: '10px',
    }).setOrigin(0.5));

    this.formationPreviewContainer.add(container);
  }

  private drawFallbackCap(container: Phaser.GameObjects.Container, radius: number, capSkin: any): void {
    const capGraphics = this.scene.add.graphics();
    capGraphics.fillStyle(capSkin?.primaryColor || 0x06b6d4);
    capGraphics.fillCircle(0, 0, radius);
    capGraphics.lineStyle(2, capSkin?.secondaryColor || 0x0891b2);
    capGraphics.strokeCircle(0, 0, radius);
    container.add(capGraphics);
  }

  private createFormationList(x: number, y: number, width: number, height: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const formations = playerData.getAllFormations();

    const listContainer = this.scene.add.container(x, y);
    this.container.add(listContainer);

    // Title
    listContainer.add(this.scene.add.text(width / 2, -15, 'FORMATIONS', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    const itemW = 75;
    const itemH = 60;
    const gap = 10;

    formations.forEach((formation, index) => {
      const itemX = index * (itemW + gap);
      const isSelected = formation.id === this.selectedFormation.id;

      const item = this.scene.add.container(itemX, 25);

      const bg = this.scene.add.graphics();
      if (isSelected) {
        bg.fillStyle(colors.uiAccent, 0.25);
        bg.lineStyle(2, colors.uiAccent, 0.8);
      } else {
        bg.fillStyle(0x1a1a2e, 0.6);
        bg.lineStyle(1, colors.uiPrimary, 0.3);
      }
      bg.fillRoundedRect(0, 0, itemW, itemH, 8);
      bg.strokeRoundedRect(0, 0, itemW, itemH, 8);
      item.add(bg);

      // Mini formation diagram
      this.drawMiniFormation(item, itemW / 2, itemH / 2 - 5, formation, 30, 24);

      // Name
      item.add(this.scene.add.text(itemW / 2, itemH - 8, formation.name, {
        fontSize: '8px',
        fontFamily: fonts.tech,
        color: isSelected ? '#ffffff' : '#888899',
      }).setOrigin(0.5));

      if (!isSelected) {
        const hitArea = this.scene.add.rectangle(itemW / 2, itemH / 2, itemW, itemH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        item.add(hitArea);

        hitArea.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click');
          this.selectedFormation = formation;
          playerData.selectFormation(formation.id);
          this.currentFormationId = formation.id;
          this.renderFormationPreview();
          listContainer.destroy();
          this.createFormationList(x, y, width, height);
        });
      }

      listContainer.add(item);
    });
  }

  private drawMiniFormation(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    formation: Formation,
    w: number, h: number
  ): void {
    const colors = getColors();
    const teamCapIds = playerData.getTeamCapIds();
    
    formation.slots.forEach((slot, index) => {
      const dotX = x + (slot.x - 0.5) * w;
      const dotY = y + (slot.y - 0.5) * h;
      
      // Get color from actual cap's role
      const capId = teamCapIds[index] || 'meme_doge';
      const capSkin = getCapSkin(capId);
      const color = capSkin ? getRoleColor(capSkin.role) : colors.uiAccent;
      
      container.add(this.scene.add.circle(dotX, dotY, 5, color, 1));
    });
  }

  private createButtons(y: number): void {
    const colors = getColors();

    // Confirm
    this.createButton(65, y, 110, 40, i18n.t('confirm') || 'CONFIRM', colors.uiAccent, () => {
      this.hide(() => this.callbacks.onSelect(this.selectedFormation));
    });

    // Cancel
    this.createButton(-65, y, 110, 40, i18n.t('cancel'), 0x6b7280, () => {
      this.hide(() => this.callbacks.onCancel());
    });
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    text: string, color: number, onClick: () => void
  ): void {
    const fonts = getFonts();
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.3 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(hover ? 2 : 1.5, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);
    btn.add(bg);

    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(color),
    }).setOrigin(0.5));

    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(hitArea);

    hitArea.on('pointerover', () => { draw(true); btn.setScale(1.03); });
    hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });

    this.container.add(btn);
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