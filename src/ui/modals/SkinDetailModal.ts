// src/ui/modals/SkinDetailModal.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor } from '../../config/themes';
import { 
  CapSkinData, BallSkinData, FieldSkinData,
  formatPrice, getRarityName, SkinPrice,
  getSkinBaseBonus, getTotalBonusAtLevel
} from '../../data/SkinsCatalog';
import { playerData } from '../../data/PlayerData';

type SkinData = CapSkinData | BallSkinData | FieldSkinData;
type SkinType = 'cap' | 'ball' | 'field';

export class SkinDetailModal {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private skin: SkinData;
  private skinType: SkinType;
  private onClose: () => void;

  constructor(
    scene: Phaser.Scene,
    skin: SkinData,
    skinType: SkinType,
    onClose: () => void
  ) {
    this.scene = scene;
    this.skin = skin;
    this.skinType = skinType;
    this.onClose = onClose;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    const rarityColor = getRarityColor(this.skin.rarity);

    // === Затемнение фона ===
    this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(1000)
      .setInteractive();

    // Клик на overlay закрывает модалку
    this.overlay.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // Проверяем, что клик не на модальном окне
      const modalBounds = new Phaser.Geom.Rectangle(
        width / 2 - 180,
        height / 2 - 280,
        360,
        560
      );
      if (!modalBounds.contains(p.x, p.y)) {
        this.close();
      }
    });

    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.85,
      duration: 200
    });

    // === Контейнер модального окна ===
    this.container = this.scene.add.container(width / 2, height / 2).setDepth(1001);

    const modalW = Math.min(width - 40, 360);
    const modalH = Math.min(height - 60, 560);

    // === Фон ===
    this.createBackground(modalW, modalH, rarityColor);

    // === Кнопка закрытия ===
    this.createCloseButton(modalW, modalH);

    // === Контент ===
    this.createContent(modalW, modalH, rarityColor);

    // Анимация появления
    this.container.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut'
    });
  }

  private createBackground(w: number, h: number, rarityColor: number): void {
    const bg = this.scene.add.graphics();

    // Внешнее свечение
    for (let i = 4; i >= 1; i--) {
      bg.lineStyle(12 / i, rarityColor, 0.1 * i);
      bg.strokeRoundedRect(-w/2 - 4, -h/2 - 4, w + 8, h + 8, 20);
    }

    // Основной фон
    bg.fillStyle(0x080810, 0.98);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 16);

    // Градиент сверху
    for (let i = 0; i < 80; i++) {
      bg.fillStyle(rarityColor, 0.12 * (1 - i / 80));
      bg.fillRect(-w/2, -h/2 + i, w, 1);
    }

    // Рамка
    bg.lineStyle(2, rarityColor, 0.7);
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 16);

    this.container.add(bg);
  }

  private createCloseButton(modalW: number, modalH: number): void {
    const colors = getColors();
    const x = modalW / 2 - 25;
    const y = -modalH / 2 + 25;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillCircle(x, y, 18);
    bg.lineStyle(2, colors.uiTextSecondary, 0.5);
    bg.strokeCircle(x, y, 18);
    this.container.add(bg);

    const icon = this.scene.add.text(x, y, '✕', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(icon);

    const hitArea = this.scene.add.circle(x, y, 18, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    hitArea.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0xff0000, 0.3);
      bg.fillCircle(x, y, 18);
      bg.lineStyle(2, 0xff0000, 0.8);
      bg.strokeCircle(x, y, 18);
    });
    hitArea.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x000000, 0.5);
      bg.fillCircle(x, y, 18);
      bg.lineStyle(2, colors.uiTextSecondary, 0.5);
      bg.strokeCircle(x, y, 18);
    });
    hitArea.on('pointerdown', () => this.close());
    this.container.add(hitArea);
  }

  private createContent(modalW: number, modalH: number, rarityColor: number): void {
    const colors = getColors();
    const owned = playerData.ownsSkin(this.skin.id, this.skinType);
    const equipped = this.isEquipped();

    let yPos = -modalH / 2 + 35;

    // === Название ===
    this.container.add(this.scene.add.text(0, yPos, this.skin.name, {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#ffffff'
    }).setOrigin(0.5));
    yPos += 30;

    // === Бейдж редкости ===
    const badgeW = 110;
    const badge = this.scene.add.graphics();
    badge.fillStyle(rarityColor, 0.25);
    badge.fillRoundedRect(-badgeW/2, yPos - 10, badgeW, 22, 6);
    badge.lineStyle(1.5, rarityColor, 0.7);
    badge.strokeRoundedRect(-badgeW/2, yPos - 10, badgeW, 22, 6);
    this.container.add(badge);

    this.container.add(this.scene.add.text(0, yPos + 1, getRarityName(this.skin.rarity).toUpperCase(), {
      fontSize: '11px',
      color: hexToString(rarityColor),
      fontStyle: 'bold'
    }).setOrigin(0.5));
    yPos += 40;

    // === Превью (анимированный) ===
    this.createAnimatedPreview(0, yPos + 60);
    yPos += 140;

    // === Описание ===
    yPos += 20;
    const desc = this.generateDescription();
    this.container.add(this.scene.add.text(0, yPos, desc, {
      fontSize: '12px',
      color: hexToString(colors.uiTextSecondary),
      align: 'center',
      wordWrap: { width: modalW - 50 }
    }).setOrigin(0.5));
    yPos += 50;

    // === Статистика (для фишек) ===
    if (this.skinType === 'cap') {
      this.createStats(modalW, yPos, owned);
      yPos += 75;
    }

    // === Кнопка действия ===
    const btnY = modalH / 2 - 45;
    this.createActionButton(modalW - 50, btnY, owned, equipped, rarityColor);
  }

  private createAnimatedPreview(x: number, y: number): void {
    const previewContainer = this.scene.add.container(x, y);
    this.container.add(previewContainer);

    // Фон превью
    const rarityColor = getRarityColor(this.skin.rarity);
    const previewBg = this.scene.add.graphics();
    previewBg.fillStyle(0x000000, 0.4);
    previewBg.fillRoundedRect(-70, -70, 140, 140, 12);
    previewBg.lineStyle(1, rarityColor, 0.3);
    previewBg.strokeRoundedRect(-70, -70, 140, 140, 12);
    previewContainer.add(previewBg);

    switch (this.skinType) {
      case 'cap':
        this.createCapPreviewAnimated(previewContainer, 0, 0);
        break;
      case 'ball':
        this.createBallPreviewAnimated(previewContainer, 0, 0);
        break;
      case 'field':
        this.createFieldPreviewAnimated(previewContainer, 0, 0);
        break;
    }
  }

  private createCapPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const skin = this.skin as CapSkinData;
    const radius = 45;

    // Свечение анимированное
    if (skin.hasGlow) {
      const glowColor = skin.glowColor || skin.primaryColor;
      const glow = this.scene.add.circle(x, y, radius + 12, glowColor, 0.25);
      container.add(glow);

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.2, to: 0.5 },
        scale: { from: 1, to: 1.15 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.activeTweens.push(tween);
    }

    // Тень
    container.add(this.scene.add.ellipse(x + 3, y + 3, radius * 1.8, radius * 1.4, 0x000000, 0.35));

    // Спрайт или fallback
    const textureKey = skin.visual.textureKey;
    if (textureKey && this.scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 128;
      const sprite = this.scene.add.sprite(x, y, textureKey).setScale(scale);
      container.add(sprite);

      // Лёгкое покачивание
      const tween = this.scene.tweens.add({
        targets: sprite,
        angle: { from: -3, to: 3 },
        duration: 2500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
      this.activeTweens.push(tween);
    } else {
      const g = this.scene.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      g.lineStyle(4, skin.secondaryColor);
      g.strokeCircle(x, y, radius);
      g.fillStyle(0xffffff, 0.25);
      g.fillEllipse(x - radius * 0.3, y - radius * 0.3, radius * 0.5, radius * 0.35);
      container.add(g);
    }

    // Частицы (если есть эффект)
    if (skin.visual.particleEffect) {
      this.createSimpleParticles(container, x, y, radius, skin.visual.particleEffect);
    }
  }

  private createBallPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const skin = this.skin as BallSkinData;
    const radius = 40;

    // Свечение
    if (skin.hasGlow) {
      const glow = this.scene.add.circle(x, y, radius + 10, skin.glowColor, 0.2);
      container.add(glow);

      const tween = this.scene.tweens.add({
        targets: glow,
        alpha: { from: 0.15, to: 0.4 },
        scale: { from: 1, to: 1.2 },
        duration: 1000,
        yoyo: true,
        repeat: -1
      });
      this.activeTweens.push(tween);
    }

    // Тень
    container.add(this.scene.add.ellipse(x + 3, y + 3, radius * 1.6, radius * 1.2, 0x000000, 0.3));

    // Спрайт
    const textureKey = skin.textureKey;
    if (textureKey && this.scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 64;
      const sprite = this.scene.add.sprite(x, y, textureKey).setScale(scale);
      container.add(sprite);

      // Вращение
      const tween = this.scene.tweens.add({
        targets: sprite,
        angle: 360,
        duration: 6000,
        repeat: -1,
        ease: 'Linear'
      });
      this.activeTweens.push(tween);
    } else {
      const g = this.scene.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      g.lineStyle(3, skin.glowColor);
      g.strokeCircle(x, y, radius);
      container.add(g);
    }

    // Частицы
    if (skin.particleEffect) {
      this.createSimpleParticles(container, x, y, radius, skin.particleEffect);
    }
  }

  private createFieldPreviewAnimated(container: Phaser.GameObjects.Container, x: number, y: number): void {
    const skin = this.skin as FieldSkinData;
    const fw = 120, fh = 80;

    const g = this.scene.add.graphics();

    // Фон поля
    g.fillStyle(skin.fieldColor);
    g.fillRoundedRect(x - fw/2, y - fh/2, fw, fh, 6);

    // Разметка
    g.lineStyle(1.5, skin.lineColor, 0.8);
    g.strokeRoundedRect(x - fw/2 + 5, y - fh/2 + 5, fw - 10, fh - 10, 4);
    g.lineBetween(x - fw/2 + 5, y, x + fw/2 - 5, y);
    g.strokeCircle(x, y, 12);

    // Ворота
    const goalW = fw * 0.3;
    const goalH = fh * 0.12;
    g.fillStyle(skin.goalColor, 0.3);
    g.fillRect(x - goalW/2, y - fh/2, goalW, goalH);
    g.fillRect(x - goalW/2, y + fh/2 - goalH, goalW, goalH);
    g.lineStyle(2, skin.goalColor, 0.8);
    g.strokeRect(x - goalW/2, y - fh/2, goalW, goalH);
    g.strokeRect(x - goalW/2, y + fh/2 - goalH, goalW, goalH);

    // Рамка
    g.lineStyle(2, skin.borderColor);
    g.strokeRoundedRect(x - fw/2, y - fh/2, fw, fh, 6);

    container.add(g);

    // Анимированные эффекты
    if (skin.effects?.length) {
      const glowEffect = skin.effects.find(e => e.type === 'border' || e.type === 'ambient');
      if (glowEffect) {
        const glowG = this.scene.add.graphics();
        glowG.lineStyle(3, glowEffect.glowColor || skin.goalColor, 0.3);
        glowG.strokeRoundedRect(x - fw/2 - 3, y - fh/2 - 3, fw + 6, fh + 6, 8);
        container.add(glowG);

        const tween = this.scene.tweens.add({
          targets: glowG,
          alpha: { from: 0.3, to: 0.8 },
          duration: 1500,
          yoyo: true,
          repeat: -1
        });
        this.activeTweens.push(tween);
      }

      // Мини-частицы
      const particleEffect = skin.effects.find(e => e.type === 'particles');
      if (particleEffect?.particleColors) {
        for (let i = 0; i < 6; i++) {
          const px = x + (Math.random() - 0.5) * (fw - 20);
          const py = y + (Math.random() - 0.5) * (fh - 20);
          const color = particleEffect.particleColors[i % particleEffect.particleColors.length];

          const p = this.scene.add.circle(px, py, 2, color, 0.6);
          container.add(p);

          const tween = this.scene.tweens.add({
            targets: p,
            y: py - 15,
            alpha: 0,
            duration: 2000 + Math.random() * 1000,
            repeat: -1,
            delay: Math.random() * 800,
            onRepeat: () => {
              p.setPosition(
                x + (Math.random() - 0.5) * (fw - 20),
                y + (Math.random() - 0.5) * (fh - 20)
              );
              p.setAlpha(0.6);
            }
          });
          this.activeTweens.push(tween);
        }
      }
    }
  }

  private createSimpleParticles(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    radius: number,
    config: any
  ): void {
    const count = Math.min(config.quantity || 3, 6);
    const colors = config.color || [0xffffff];

    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const startX = x + (Math.random() - 0.5) * radius;
      const startY = y + (Math.random() - 0.5) * radius;

      const p = this.scene.add.circle(startX, startY, 3, color, 0.7);
      container.add(p);

      const tween = this.scene.tweens.add({
        targets: p,
        x: x + (Math.random() - 0.5) * radius * 2,
        y: y + (Math.random() - 0.5) * radius * 2 - (config.gravityY ? 25 : 0),
        alpha: 0,
        scale: 0.2,
        duration: config.lifespan || 1000,
        repeat: -1,
        delay: i * 150,
        onRepeat: () => {
          p.setPosition(
            x + (Math.random() - 0.5) * radius,
            y + (Math.random() - 0.5) * radius
          );
          p.setAlpha(0.7);
          p.setScale(1);
        }
      });
      this.activeTweens.push(tween);
    }
  }

  private createStats(modalW: number, y: number, owned: boolean): void {
    const colors = getColors();
    const skin = this.skin as CapSkinData;
    const level = owned ? playerData.getCapLevel(skin.id) : 1;
    const bonus = getTotalBonusAtLevel(skin, level);

    // Фон
    const statsBg = this.scene.add.graphics();
    statsBg.fillStyle(0x000000, 0.3);
    statsBg.fillRoundedRect(-modalW/2 + 20, y - 25, modalW - 40, 65, 8);
    statsBg.lineStyle(1, colors.uiPrimary, 0.2);
    statsBg.strokeRoundedRect(-modalW/2 + 20, y - 25, modalW - 40, 65, 8);
    this.container.add(statsBg);

    // Уровень
    const levelText = owned ? `LEVEL ${level}` : 'BASE STATS';
    this.container.add(this.scene.add.text(0, y - 10, levelText, {
      fontSize: '12px',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Характеристики
    const stats = [
      { icon: '⚡', value: `+${bonus.power}%` },
      { icon: '💨', value: `+${bonus.speed}%` },
      { icon: '🎯', value: `+${bonus.control}%` },
      { icon: '⚖️', value: `+${bonus.weight}%` }
    ];

    const startX = -modalW / 2 + 50;
    const statW = (modalW - 100) / 4;

    stats.forEach((stat, i) => {
      const sx = startX + i * statW;
      this.container.add(this.scene.add.text(sx, y + 8, stat.icon, { fontSize: '14px' }).setOrigin(0.5));
      this.container.add(this.scene.add.text(sx, y + 26, stat.value, {
        fontSize: '11px',
        color: hexToString(colors.uiPrimary),
        fontStyle: 'bold'
      }).setOrigin(0.5));
    });
  }

  private createActionButton(w: number, y: number, owned: boolean, equipped: boolean, rarityColor: number): void {
    const colors = getColors();
    const h = 42;

    const bg = this.scene.add.graphics();

    if (equipped) {
      bg.fillStyle(colors.uiAccent, 0.2);
      bg.fillRoundedRect(-w/2, y - h/2, w, h, 10);
      bg.lineStyle(2, colors.uiAccent, 0.6);
      bg.strokeRoundedRect(-w/2, y - h/2, w, h, 10);
      this.container.add(bg);

      this.container.add(this.scene.add.text(0, y, '✓ EQUIPPED', {
        fontSize: '15px',
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold'
      }).setOrigin(0.5));

    } else if (owned) {
      bg.fillStyle(colors.uiPrimary, 0.2);
      bg.fillRoundedRect(-w/2, y - h/2, w, h, 10);
      bg.lineStyle(2, colors.uiPrimary, 0.7);
      bg.strokeRoundedRect(-w/2, y - h/2, w, h, 10);
      this.container.add(bg);

      const label = this.scene.add.text(0, y, 'EQUIP THIS SKIN', {
        fontSize: '15px',
        color: hexToString(colors.uiPrimary),
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.container.add(label);

      const hitArea = this.scene.add.rectangle(0, y, w, h, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hitArea.on('pointerdown', () => {
        playerData.equipSkin(this.skin.id, this.skinType);
        this.close();
      });
      this.container.add(hitArea);

    } else {
      const canAfford = this.canAfford();
      const btnColor = canAfford ? rarityColor : colors.uiTextSecondary;

      bg.fillStyle(btnColor, 0.2);
      bg.fillRoundedRect(-w/2, y - h/2, w, h, 10);
      bg.lineStyle(2, btnColor, canAfford ? 0.7 : 0.3);
      bg.strokeRoundedRect(-w/2, y - h/2, w, h, 10);
      this.container.add(bg);

      const label = this.scene.add.text(0, y, `BUY FOR ${formatPrice(this.skin.price)}`, {
        fontSize: '15px',
        color: hexToString(btnColor),
        fontStyle: 'bold'
      }).setOrigin(0.5);
      this.container.add(label);

      if (canAfford) {
        const hitArea = this.scene.add.rectangle(0, y, w, h, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        hitArea.on('pointerdown', () => this.buySkin());
        this.container.add(hitArea);
      }
    }
  }

  private generateDescription(): string {
    const rarity = getRarityName(this.skin.rarity).toLowerCase();

    switch (this.skinType) {
      case 'cap': {
        const skin = this.skin as CapSkinData;
        const bonus = getSkinBaseBonus(skin);
        let desc = `A ${rarity} cap skin`;
        const bonuses: string[] = [];
        if (bonus.power > 0) bonuses.push(`+${bonus.power}% power`);
        if (bonus.speed > 0) bonuses.push(`+${bonus.speed}% speed`);
        if (bonus.control > 0) bonuses.push(`+${bonus.control}% control`);
        if (bonuses.length > 0) desc += ` with ${bonuses.join(', ')}`;
        desc += '.';
        if (skin.hasGlow) desc += ' Features neon glow.';
        if (skin.visual.particleEffect) desc += ' Emits particles.';
        return desc;
      }
      case 'ball': {
        const skin = this.skin as BallSkinData;
        let desc = `A ${rarity} ball skin.`;
        if (skin.hasGlow) desc += ' Glows in the dark.';
        if (skin.hasTrail) desc += ' Leaves a trail.';
        if (skin.particleEffect) desc += ' Particle effects.';
        return desc;
      }
      case 'field': {
        const skin = this.skin as FieldSkinData;
        let desc = `A ${rarity} arena theme.`;
        if (skin.effects?.length) {
          const hasParticles = skin.effects.some(e => e.type === 'particles');
          const hasGlow = skin.effects.some(e => e.type === 'border' || e.type === 'ambient');
          if (hasParticles) desc += ' Animated particles.';
          if (hasGlow) desc += ' Glowing effects.';
        }
        return desc;
      }
      default:
        return 'A unique cosmetic item.';
    }
  }

  private isEquipped(): boolean {
    const data = playerData.get();
    const map: Record<SkinType, string> = {
      cap: data.equippedCapSkin,
      ball: data.equippedBallSkin,
      field: data.equippedFieldSkin,
    };
    return map[this.skinType] === this.skin.id;
  }

  private canAfford(): boolean {
    const data = playerData.get();
    if (this.skin.price.stars) return data.stars >= this.skin.price.stars;
    if (this.skin.price.coins) return data.coins >= this.skin.price.coins;
    return true;
  }

  private buySkin(): void {
    const success = this.skin.price.stars
      ? playerData.spendStars(this.skin.price.stars)
      : this.skin.price.coins
        ? playerData.spendCoins(this.skin.price.coins)
        : true;

    if (success) {
      playerData.buySkin(this.skin.id, this.skinType);
      this.close();
    }
  }

  close(): void {
    // Очищаем все tweens
    this.activeTweens.forEach(tween => tween.destroy());
    this.activeTweens = [];

    // Анимация закрытия
    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0,
      duration: 150
    });

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
      }
    });
  }
}