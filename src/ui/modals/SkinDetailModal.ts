// src/ui/modals/SkinDetailModal.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor, getFonts } from '../../config/themes';
import {
  CapSkinData,
  BallSkinData,
  FieldSkinData,
  formatPrice,
  getRarityName,
  getRoleIcon,
  getRoleName,
  getRoleColor,
} from '../../data/SkinsCatalog';
import { playerData } from '../../data/PlayerData';
import { AudioManager } from '../../managers/AudioManager';
import { createCapIcon } from '../CapIcon';

type SkinData = CapSkinData | BallSkinData | FieldSkinData;
type SkinType = 'cap' | 'ball' | 'field';

export class SkinDetailModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private holoRing!: Phaser.GameObjects.Graphics;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private skin: SkinData;
  private skinType: SkinType;
  private onClose: () => void;

  constructor(scene: Phaser.Scene, skin: SkinData, skinType: SkinType, onClose: () => void) {
    this.scene = scene;
    this.skin = skin;
    this.skinType = skinType;
    this.onClose = onClose;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const rarityColor = getRarityColor(this.skin.rarity);

    this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0).setOrigin(0).setDepth(1000).setInteractive();
    this.overlay.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const modalBounds = new Phaser.Geom.Rectangle(width / 2 - 180, height / 2 - 300, 360, 600);
      if (!modalBounds.contains(p.x, p.y)) this.close();
    });

    this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.9, duration: 200 });

    this.container = this.scene.add.container(width / 2, height / 2).setDepth(1001);

    const modalW = Math.min(width - 40, 360);
    const modalH = Math.min(height - 60, 600);

    this.createBackground(modalW, modalH, rarityColor);
    this.createCloseButton(modalW, modalH);
    this.createContent(modalW, modalH, rarityColor);

    this.container.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({ targets: this.container, scale: 1, alpha: 1, duration: 250, ease: 'Back.easeOut' });
  }

  private createBackground(w: number, h: number, rarityColor: number): void {
    const bg = this.scene.add.graphics();

    for (let i = 5; i >= 1; i--) {
      bg.lineStyle(14 / i, rarityColor, 0.08 * i);
      bg.strokeRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 22);
    }

    bg.fillStyle(0x14101e, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);

    for (let i = 0; i < 100; i++) {
      bg.fillStyle(rarityColor, 0.15 * (1 - i / 100));
      bg.fillRect(-w / 2, -h / 2 + i, w, 1);
    }

    bg.fillStyle(rarityColor, 0.8);
    bg.fillRoundedRect(-50, -h / 2 + 1, 100, 3, 2);
    bg.lineStyle(2, rarityColor, 0.6);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);

    this.container.add(bg);
  }

  private createCloseButton(modalW: number, modalH: number): void {
    const colors = getColors();
    const x = modalW / 2 - 28;
    const y = -modalH / 2 + 28;

    const bg = this.scene.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0xff4444 : 0x000000, hover ? 0.4 : 0.5);
      bg.fillCircle(x, y, 16);
      bg.lineStyle(1.5, hover ? 0xff4444 : colors.glassBorder, hover ? 0.9 : 0.3);
      bg.strokeCircle(x, y, 16);
    };
    drawBg(false);
    this.container.add(bg);

    this.container.add(this.scene.add.text(x, y, '✕', { fontSize: '16px', color: '#ffffff' }).setOrigin(0.5));

    const hitArea = this.scene.add.circle(x, y, 16, 0x000000, 0).setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => drawBg(true));
    hitArea.on('pointerout', () => drawBg(false));
    hitArea.on('pointerdown', () => this.close());
    this.container.add(hitArea);
  }

  private createContent(modalW: number, modalH: number, rarityColor: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const owned = this.isOwned();
    const equipped = this.isEquipped();

    let yPos = -modalH / 2 + 40;

    this.container.add(this.scene.add.text(0, yPos, this.skin.name.toUpperCase(), { fontSize: '20px', fontFamily: fonts.tech, color: '#ffffff', letterSpacing: 1 }).setOrigin(0.5));
    yPos += 28;

    const badgeW = 100;
    const badge = this.scene.add.graphics();
    badge.fillStyle(rarityColor, 0.2);
    badge.fillRoundedRect(-badgeW / 2, yPos - 10, badgeW, 22, 11);
    badge.lineStyle(1.5, rarityColor, 0.6);
    badge.strokeRoundedRect(-badgeW / 2, yPos - 10, badgeW, 22, 11);
    this.container.add(badge);
    this.container.add(this.scene.add.text(0, yPos + 1, getRarityName(this.skin.rarity).toUpperCase(), { fontSize: '10px', fontFamily: fonts.tech, color: hexToString(rarityColor) }).setOrigin(0.5));
    yPos += 35;

    if (this.skinType === 'cap') {
      const capSkin = this.skin as CapSkinData;
      const roleColor = getRoleColor(capSkin.role);
      const roleBadgeW = 110;
      const roleBadge = this.scene.add.graphics();
      roleBadge.fillStyle(roleColor, 0.15);
      roleBadge.fillRoundedRect(-roleBadgeW / 2, yPos - 12, roleBadgeW, 24, 12);
      roleBadge.lineStyle(1.5, roleColor, 0.5);
      roleBadge.strokeRoundedRect(-roleBadgeW / 2, yPos - 12, roleBadgeW, 24, 12);
      this.container.add(roleBadge);
      this.container.add(this.scene.add.text(0, yPos, `${getRoleIcon(capSkin.role)} ${getRoleName(capSkin.role)}`, { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(roleColor) }).setOrigin(0.5));
      yPos += 35;
    }

    const previewY = yPos + 55;
    // Мировые координаты: container находится в центре экрана
    const { width, height } = this.scene.cameras.main;
    const worldPreviewX = width / 2;
    const worldPreviewY = height / 2 + previewY;
    this.createHoloRingWithPreview(0, previewY, worldPreviewX, worldPreviewY, rarityColor);
    yPos = previewY + 85;

    yPos += 25;
    const desc = this.generateDescription();
    this.container.add(this.scene.add.text(0, yPos, desc, { fontSize: '11px', color: hexToString(colors.uiTextSecondary), align: 'center', wordWrap: { width: modalW - 50 } }).setOrigin(0.5));
    yPos += 45;

    if (this.skinType === 'cap') {
      this.createStats(modalW, yPos, owned, rarityColor);
      yPos += 95;
    }

    const btnY = modalH / 2 - 50;
    this.createActionButton(modalW - 60, btnY, owned, equipped, rarityColor);
  }

  private createHoloRingWithPreview(x: number, y: number, worldX: number, worldY: number, rarityColor: number): void {
    const previewContainer = this.scene.add.container(x, y);
    this.container.add(previewContainer);

    const ringRadius = 70;

    this.holoRing = this.scene.add.graphics();
    this.drawHoloRing(this.holoRing, 0, 0, ringRadius, rarityColor);
    previewContainer.add(this.holoRing);

    const ringTween = this.scene.tweens.add({ targets: this.holoRing, angle: 360, duration: 12000, repeat: -1, ease: 'Linear' });
    this.activeTweens.push(ringTween);

    const innerBg = this.scene.add.graphics();
    innerBg.fillStyle(0x000000, 0.5);
    innerBg.fillCircle(0, 0, ringRadius - 15);
    innerBg.lineStyle(1, rarityColor, 0.2);
    innerBg.strokeCircle(0, 0, ringRadius - 15);
    previewContainer.add(innerBg);

    switch (this.skinType) {
      case 'cap':
        this.createCapPreviewAnimated(previewContainer, 0, 0, worldX, worldY);
        break;
      case 'ball':
        this.createBallPreviewAnimated(previewContainer, 0, 0);
        break;
      case 'field':
        this.createFieldPreviewAnimated(previewContainer, 0, 0);
        break;
    }
  }

  private drawHoloRing(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
    const segments = 32;
    const dashRatio = 0.6;

    g.lineStyle(2, color, 0.7);
    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const startAngle = (i / segments) * Math.PI * 2;
        const endAngle = ((i + dashRatio) / segments) * Math.PI * 2;
        g.beginPath();
        g.arc(x, y, radius, startAngle, endAngle, false);
        g.strokePath();
      }
    }

    g.lineStyle(1, color, 0.3);
    g.strokeCircle(x, y, radius - 10);
    g.lineStyle(4, color, 0.1);
    g.strokeCircle(x, y, radius + 5);
  }

  private createCapPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number, worldX: number, worldY: number): void {
    const skin = this.skin as CapSkinData;
    const radius = 42;

    if (skin.hasGlow) {
      const glowColor = skin.glowColor || skin.primaryColor;
      const glow = this.scene.add.circle(x, y, radius + 14, glowColor, 0.22);
      container.add(glow);

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.5 },
        scale: { from: 1, to: 1.12 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.activeTweens.push(tween);
    }

    const icon = createCapIcon(this.scene, skin, { radius, showRoleBadge: false, showShadow: false, showGlow: false }, worldX, worldY);
    icon.setPosition(x, y);
    container.add(icon);

    const wobble = this.scene.tweens.add({
      targets: icon,
      angle: { from: -3, to: 3 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.activeTweens.push(wobble);

    if (skin.visual.particleEffect) {
      this.createSimpleParticles(container, x, y, radius, skin.visual.particleEffect);
    }
  }

  private createBallPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const skin = this.skin as BallSkinData;
    const radius = 36;

    if (skin.hasGlow) {
      const glow = this.scene.add.circle(x, y, radius + 8, skin.glowColor, 0.2);
      container.add(glow);
      const tween = this.scene.tweens.add({ targets: glow, alpha: { from: 0.15, to: 0.4 }, scale: { from: 1, to: 1.15 }, duration: 1000, yoyo: true, repeat: -1 });
      this.activeTweens.push(tween);
    }

    container.add(this.scene.add.ellipse(x + 2, y + 2, radius * 1.5, radius * 1.2, 0x000000, 0.3));

    const textureKey = skin.textureKey;
    if (textureKey && this.scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 64;
      const sprite = this.scene.add.sprite(x, y, textureKey).setScale(scale);
      container.add(sprite);
      const tween = this.scene.tweens.add({ targets: sprite, angle: 360, duration: 5000, repeat: -1, ease: 'Linear' });
      this.activeTweens.push(tween);
    } else {
      const g = this.scene.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      g.lineStyle(2, skin.glowColor);
      g.strokeCircle(x, y, radius);
      container.add(g);
    }

    if (skin.particleEffect) {
      this.createSimpleParticles(container, x, y, radius, skin.particleEffect);
    }
  }

  private createFieldPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const skin = this.skin as FieldSkinData;
    const fw = 100, fh = 65;

    const g = this.scene.add.graphics();
    g.fillStyle(skin.fieldColor);
    g.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 5);
    g.lineStyle(1, skin.lineColor, 0.7);
    g.strokeRoundedRect(x - fw / 2 + 4, y - fh / 2 + 4, fw - 8, fh - 8, 3);
    g.lineBetween(x - fw / 2 + 4, y, x + fw / 2 - 4, y);
    g.strokeCircle(x, y, 10);

    const goalW = fw * 0.28;
    const goalH = fh * 0.1;
    g.lineStyle(1.5, skin.goalColor, 0.8);
    g.strokeRect(x - goalW / 2, y - fh / 2 - 1, goalW, goalH);
    g.strokeRect(x - goalW / 2, y + fh / 2 - goalH + 1, goalW, goalH);
    g.lineStyle(1.5, skin.borderColor);
    g.strokeRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 5);
    container.add(g);

    if (skin.effects?.length) {
      const glowEffect = skin.effects.find((e) => e.type === 'border' || e.type === 'ambient');
      if (glowEffect) {
        const glowG = this.scene.add.graphics();
        glowG.lineStyle(2, glowEffect.glowColor || skin.goalColor, 0.3);
        glowG.strokeRoundedRect(x - fw / 2 - 2, y - fh / 2 - 2, fw + 4, fh + 4, 7);
        container.add(glowG);
        const tween = this.scene.tweens.add({ targets: glowG, alpha: { from: 0.3, to: 0.7 }, duration: 1500, yoyo: true, repeat: -1 });
        this.activeTweens.push(tween);
      }

      const particleEffect = skin.effects.find((e) => e.type === 'particles');
      if (particleEffect?.particleColors) {
        for (let i = 0; i < 5; i++) {
          const px = x + (Math.random() - 0.5) * (fw - 15);
          const py = y + (Math.random() - 0.5) * (fh - 15);
          const color = particleEffect.particleColors[i % particleEffect.particleColors.length];
          const p = this.scene.add.circle(px, py, 1.5, color, 0.6);
          container.add(p);
          const tween = this.scene.tweens.add({
            targets: p,
            y: py - 12,
            alpha: 0,
            duration: 1800 + Math.random() * 800,
            repeat: -1,
            delay: Math.random() * 600,
            onRepeat: () => {
              p.setPosition(x + (Math.random() - 0.5) * (fw - 15), y + (Math.random() - 0.5) * (fh - 15));
              p.setAlpha(0.6);
            },
          });
          this.activeTweens.push(tween);
        }
      }
    }
  }

  private createSimpleParticles(container: Phaser.GameObjects.Container, x: number, y: number, radius: number, config: any): void {
    if (!config.texture || !this.scene.textures.exists(config.texture)) {
      this.createCircleParticles(container, x, y, radius, config);
      return;
    }

    const count = Math.min(config.quantity || 3, 5);
    const colors = config.color || [0xffffff];

    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const startX = x + (Math.random() - 0.5) * radius * 0.6;
      const startY = y + (Math.random() - 0.5) * radius * 0.6;

      const p = this.scene.add.sprite(startX, startY, config.texture);
      p.setScale(config.scale?.start || 0.25);
      p.setAlpha(0.7);
      p.setTint(color);
      if (config.blendMode === 'ADD') p.setBlendMode(Phaser.BlendModes.ADD);
      container.add(p);

      const targetY = config.gravityY && config.gravityY > 0 ? startY + 25 : startY - 25;

      const tween = this.scene.tweens.add({
        targets: p,
        x: x + (Math.random() - 0.5) * radius * 1.3,
        y: targetY,
        alpha: 0,
        scale: config.scale?.end || 0.08,
        angle: Math.random() * 360,
        duration: config.lifespan || 1400,
        repeat: -1,
        delay: i * 180,
        onRepeat: () => {
          p.setPosition(x + (Math.random() - 0.5) * radius * 0.6, y + (Math.random() - 0.5) * radius * 0.6);
          p.setAlpha(0.7);
          p.setScale(config.scale?.start || 0.25);
          p.setAngle(0);
        },
      });
      this.activeTweens.push(tween);
    }
  }

  private createCircleParticles(container: Phaser.GameObjects.Container, x: number, y: number, radius: number, config: any): void {
    const count = Math.min(config.quantity || 3, 6);
    const colors = config.color || [0xffffff];

    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const startX = x + (Math.random() - 0.5) * radius * 0.5;
      const startY = y + (Math.random() - 0.5) * radius * 0.5;
      const p = this.scene.add.circle(startX, startY, 3, color, 0.6);
      container.add(p);

      const targetY = config.gravityY && config.gravityY > 0 ? startY + 20 : startY - 20;

      const tween = this.scene.tweens.add({
        targets: p,
        x: x + (Math.random() - 0.5) * radius,
        y: targetY,
        alpha: 0,
        scale: 0.3,
        duration: config.lifespan || 1200,
        repeat: -1,
        delay: i * 150,
        onRepeat: () => {
          p.setPosition(x + (Math.random() - 0.5) * radius * 0.5, y + (Math.random() - 0.5) * radius * 0.5);
          p.setAlpha(0.6);
          p.setScale(1);
        },
      });
      this.activeTweens.push(tween);
    }
  }

  private createStats(modalW: number, y: number, owned: boolean, rarityColor: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const skin = this.skin as CapSkinData;

    const upgrades = owned ? playerData.getCapStats(skin.id) : { power: 1, mass: 1, aim: 1, technique: 1 };
    const totalLevel = upgrades.power + upgrades.mass + upgrades.aim + upgrades.technique;

    const statsBg = this.scene.add.graphics();
    statsBg.fillStyle(0xffffff, 0.03);
    statsBg.fillRoundedRect(-modalW / 2 + 25, y - 25, modalW - 50, 85, 10);
    statsBg.lineStyle(1, colors.glassBorder, 0.1);
    statsBg.strokeRoundedRect(-modalW / 2 + 25, y - 25, modalW - 50, 85, 10);
    this.container.add(statsBg);

    this.container.add(this.scene.add.text(0, y - 8, `⚡ POWER: ${totalLevel}`, { fontSize: '13px', fontFamily: fonts.tech, color: hexToString(colors.uiGold) }).setOrigin(0.5));

    const stats = [
      { icon: '💥', value: upgrades.power, color: 0xef4444 },
      { icon: '🛡️', value: upgrades.mass, color: 0x3b82f6 },
      { icon: '🎯', value: upgrades.aim, color: 0x22c55e },
      { icon: '✨', value: upgrades.technique, color: 0xa855f7 },
    ];

    const startX = -modalW / 2 + 45;
    const statW = (modalW - 90) / 4;

    stats.forEach((stat, i) => {
      const sx = startX + i * statW + statW / 2;
      this.container.add(this.scene.add.text(sx, y + 18, stat.icon, { fontSize: '14px' }).setOrigin(0.5));
      this.container.add(this.scene.add.text(sx, y + 38, `${stat.value}`, { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(stat.color) }).setOrigin(0.5));
    });
  }

  private createActionButton(w: number, y: number, owned: boolean, equipped: boolean, rarityColor: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const h = 46;
    const bg = this.scene.add.graphics();

    if (equipped) {
      bg.fillStyle(0x22c55e, 0.15);
      bg.fillRoundedRect(-w / 2, y - h / 2, w, h, 12);
      bg.lineStyle(2, 0x22c55e, 0.7);
      bg.strokeRoundedRect(-w / 2, y - h / 2, w, h, 12);
      this.container.add(bg);
      this.container.add(this.scene.add.text(0, y, '✓ IN TEAM', { fontSize: '14px', fontFamily: fonts.tech, color: '#22c55e' }).setOrigin(0.5));
    } else if (owned) {
      bg.fillStyle(colors.uiAccent, 0.15);
      bg.fillRoundedRect(-w / 2, y - h / 2, w, h, 12);
      bg.lineStyle(2, colors.uiAccent, 0.7);
      bg.strokeRoundedRect(-w / 2, y - h / 2, w, h, 12);
      this.container.add(bg);
      this.container.add(this.scene.add.text(0, y, 'OWNED ✓', { fontSize: '14px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent) }).setOrigin(0.5));
    } else {
      const canAfford = this.canAfford();
      const btnColor = canAfford ? rarityColor : colors.uiTextSecondary;

      bg.fillStyle(btnColor, canAfford ? 0.2 : 0.1);
      bg.fillRoundedRect(-w / 2, y - h / 2, w, h, 12);
      bg.lineStyle(2, btnColor, canAfford ? 0.7 : 0.3);
      bg.strokeRoundedRect(-w / 2, y - h / 2, w, h, 12);
      this.container.add(bg);
      this.container.add(this.scene.add.text(0, y, canAfford ? `BUY ${formatPrice(this.skin.price)}` : formatPrice(this.skin.price), { fontSize: '14px', fontFamily: fonts.tech, color: hexToString(btnColor) }).setOrigin(0.5));

      if (canAfford) {
        const hitArea = this.scene.add.rectangle(0, y, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
        hitArea.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_cash');
          this.buySkin();
        });
        this.container.add(hitArea);
      }
    }
  }

  private generateDescription(): string {
    const rarity = getRarityName(this.skin.rarity).toLowerCase();

    switch (this.skinType) {
      case 'cap': {
        const skin = this.skin as CapSkinData;
        let desc = skin.description || `A ${rarity} cap skin.`;
        if (skin.hasGlow) desc += ' Features neon glow effect.';
        if (skin.visual.particleEffect) desc += ' Emits particles.';
        return desc;
      }
      case 'ball': {
        const skin = this.skin as BallSkinData;
        let desc = `A ${rarity} ball skin.`;
        if (skin.hasGlow) desc += ' Glows in the dark.';
        if (skin.hasTrail) desc += ' Leaves a trail.';
        if (skin.particleEffect) desc += ' With particle effects.';
        return desc;
      }
      case 'field': {
        const skin = this.skin as FieldSkinData;
        let desc = `A ${rarity} arena theme.`;
        if (skin.effects?.length) {
          if (skin.effects.some((e) => e.type === 'particles')) desc += ' With animated particles.';
          if (skin.effects.some((e) => e.type === 'border' || e.type === 'ambient')) desc += ' Glowing effects.';
        }
        return desc;
      }
      default:
        return 'A unique cosmetic item for the arena.';
    }
  }

    private isOwned(): boolean {
    if (this.skinType === 'cap') return playerData.ownsCap(this.skin.id);
    if (this.skinType === 'ball') return playerData.ownsBallSkin(this.skin.id);
    return playerData.ownsFieldSkin(this.skin.id);
  }

  private isEquipped(): boolean {
    if (this.skinType === 'cap') {
      return playerData.getTeamCapIds().includes(this.skin.id);
    }
    const data = playerData.get();
    if (this.skinType === 'ball') return data.equippedBallSkin === this.skin.id;
    return data.equippedFieldSkin === this.skin.id;
  }

  private canAfford(): boolean {
    const data = playerData.get();
    if (this.skin.price.crystals) return data.crystals >= this.skin.price.crystals;
    if (this.skin.price.coins) return data.coins >= this.skin.price.coins;
    return true;
  }

  private buySkin(): void {
    let success = false;

    if (this.skinType === 'cap') {
      success = playerData.buyCap(this.skin.id);
    } else if (this.skinType === 'ball') {
      success = playerData.buyBallSkin(this.skin.id, this.skin.price);
    } else if (this.skinType === 'field') {
      success = playerData.buyFieldSkin(this.skin.id, this.skin.price);
    }

    if (success) {
      this.close();
    }
  }

  close(): void {
    AudioManager.getInstance().playSFX('sfx_click');

    this.activeTweens.forEach((tween) => tween.destroy());
    this.activeTweens = [];

    this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0, duration: 150 });
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.85,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        this.overlay.destroy();
        this.container.destroy();
        this.onClose();
      },
    });
  }
}