// src/ui/UnitUnlockCelebration.ts
// Праздничное получение нового юнита

import Phaser from 'phaser';
import { getFonts } from '../config/themes';

const RARITY_COLORS: Record<string, number> = {
  common: 0x9ca3af, rare: 0x3b82f6, epic: 0xa855f7, legendary: 0xf59e0b,
};

const RARITY_NAMES: Record<string, string> = {
  common: 'ОБЫЧНЫЙ', rare: 'РЕДКИЙ', epic: 'ЭПИЧЕСКИЙ', legendary: 'ЛЕГЕНДАРНЫЙ',
};

export class UnitUnlockCelebration {
  private scene: Phaser.Scene;
  private unit: any;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private onComplete?: () => void;

  constructor(scene: Phaser.Scene, unit: any, onComplete?: () => void) {
    this.scene = scene;
    this.unit = unit;
    this.onComplete = onComplete;
  }

  /**
   * Получает лучший доступный ключ текстуры (HD или базовый)
   */
  private getBestTextureKey(assetKey: string): string | null {
    const hdKey = `${assetKey}_512`;
    
    if (this.scene.textures.exists(hdKey)) {
      return hdKey;
    }
    
    if (this.scene.textures.exists(assetKey)) {
      return assetKey;
    }
    
    return null;
  }

  show(): void {
    const { width, height } = this.scene.scale;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();
    const rarityColor = RARITY_COLORS[this.unit.rarity] || 0x9ca3af;
    
    // Затемнение
    this.overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    this.overlay.setDepth(999);
    this.scene.tweens.add({ targets: this.overlay, fillAlpha: 0.9, duration: 300 });
    
    // Контейнер
    this.container = this.scene.add.container(width / 2, height / 2);
    this.container.setDepth(1000);
    
    // Лучи
    for (let i = 0; i < 12; i++) {
      const ray = this.scene.add.graphics();
      ray.fillStyle(rarityColor, 0.15);
      ray.beginPath();
      ray.moveTo(0, 0);
      ray.lineTo(-30, -400);
      ray.lineTo(30, -400);
      ray.closePath();
      ray.fill();
      ray.setRotation((i / 12) * Math.PI * 2);
      ray.setAlpha(0);
      this.container.add(ray);
      
      this.scene.tweens.add({ targets: ray, alpha: 1, duration: 300, delay: i * 50 });
    }
    
    // Вращение лучей
    this.scene.tweens.add({
      targets: this.container.list.slice(0, 12),
      rotation: '+=6.28', duration: 20000, repeat: -1,
    });
    
    // Свечение
    const glow = this.scene.add.graphics();
    glow.fillStyle(rarityColor, 0.3);
    glow.fillCircle(0, 0, 150);
    this.container.add(glow);
    
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0.3, to: 0.6 }, scale: { from: 1, to: 1.3 },
      duration: 800, yoyo: true, repeat: -1,
    });
    
    // Карточка
    const cardW = 260 * s;
    const cardH = 360 * s;
    
    const cardBg = this.scene.add.graphics();
    cardBg.fillGradientStyle(0x1e1b4b, 0x1e1b4b, 0x0f0a1e, 0x0f0a1e, 1);
    cardBg.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
    cardBg.lineStyle(4, rarityColor, 1);
    cardBg.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
    this.container.add(cardBg);
    
    // Бейдж редкости
    const rarityBg = this.scene.add.graphics();
    rarityBg.fillStyle(rarityColor, 1);
    rarityBg.fillRoundedRect(-60 * s, -cardH / 2 - 12 * s, 120 * s, 24 * s, 12 * s);
    this.container.add(rarityBg);
    
    this.container.add(this.scene.add.text(0, -cardH / 2, RARITY_NAMES[this.unit.rarity] || 'ОБЫЧНЫЙ', {
      fontSize: `${12 * s}px`, fontFamily: fonts.tech,
      color: this.unit.rarity === 'legendary' ? '#000000' : '#ffffff',
    }).setOrigin(0.5));
    
    // === ИЗОБРАЖЕНИЕ ЮНИТА ===
    const imageY = -60 * s;
    const imageSize = 150 * s; // Большой размер для celebration
    
    // Свечение за изображением
    const imageGlow = this.scene.add.graphics();
    imageGlow.fillStyle(rarityColor, 0.35);
    imageGlow.fillCircle(0, imageY, 85 * s);
    this.container.add(imageGlow);
    
    // Пульсация свечения
    this.scene.tweens.add({
      targets: imageGlow,
      alpha: { from: 0.25, to: 0.5 },
      scale: { from: 1, to: 1.2 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    // PNG юнита (HD версия если есть)
    const textureKey = this.getBestTextureKey(this.unit.assetKey);
    
    if (textureKey) {
      const unitImage = this.scene.add.image(0, imageY, textureKey);
      unitImage.setDisplaySize(imageSize, imageSize);
      this.container.add(unitImage);
      
      // Анимация появления
      unitImage.setScale(0);
      unitImage.setAngle(-10);
      const texture = this.scene.textures.get(textureKey);
      const sourceImage = texture.getSourceImage();
      const sourceSize = sourceImage.width || imageSize;
      this.scene.tweens.add({
        targets: unitImage,
        scale: imageSize / sourceSize,
        angle: 0,
        duration: 700,
        ease: 'Back.easeOut',
        delay: 300,
      });
      
      // Легкое покачивание после появления
      this.scene.time.delayedCall(1000, () => {
        this.scene.tweens.add({
          targets: unitImage,
          y: imageY - 8,
          duration: 1500,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      });
    } else {
      // Fallback placeholder
      console.warn(`[Celebration] Texture not found: ${this.unit.assetKey}`);
      const placeholder = this.scene.add.graphics();
      placeholder.fillStyle(rarityColor, 0.4);
      placeholder.fillCircle(0, imageY, imageSize / 2);
      this.container.add(placeholder);
      
      this.container.add(this.scene.add.text(0, imageY, '⭐', {
        fontSize: `${72 * s}px`,
      }).setOrigin(0.5));
    }
    
    // Имя
    this.container.add(this.scene.add.text(0, imageY + 75 * s, this.unit.name.toUpperCase(), {
      fontSize: `${24 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
    
    // Титул
    this.container.add(this.scene.add.text(0, imageY + 105 * s, this.unit.title, {
      fontSize: `${14 * s}px`, fontFamily: fonts.primary, color: '#94a3b8',
    }).setOrigin(0.5));
    
    // Способность
    const abilityBg = this.scene.add.graphics();
    abilityBg.fillStyle(rarityColor, 0.15);
    abilityBg.fillRoundedRect(-100 * s, imageY + 145 * s, 200 * s, 30 * s, 15 * s);
    this.container.add(abilityBg);
    
    this.container.add(this.scene.add.text(0, imageY + 160 * s, `✨ ${this.unit.specialAbility}`, {
      fontSize: `${12 * s}px`, fontFamily: fonts.primary, color: '#ffffff',
    }).setOrigin(0.5));
    
    // Заголовок
    const titleText = this.scene.add.text(0, -cardH / 2 - 60 * s, '🎉 НОВЫЙ ЮНИТ!', {
      fontSize: `${28 * s}px`, fontFamily: fonts.tech, color: '#ffd700',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.container.add(titleText);
    
    this.scene.tweens.add({
      targets: titleText, scale: { from: 0, to: 1.1 }, duration: 500, ease: 'Back.easeOut',
      onComplete: () => this.scene.tweens.add({ targets: titleText, scale: 1, duration: 200 }),
    });
    
    // Конфетти
    const confettiColors = [0xffd700, 0xff6b6b, 0x4ade80, 0x38bdf8, 0xa855f7];
    for (let i = 0; i < 40; i++) {
      const confetti = this.scene.add.graphics();
      confetti.fillStyle(Phaser.Math.RND.pick(confettiColors), 1);
      confetti.fillRect(-4, -8, 8, 16);
      confetti.x = Phaser.Math.Between(-width / 2, width / 2);
      confetti.y = -height / 2 - 50;
      confetti.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
      this.container.add(confetti);
      
      this.scene.tweens.add({
        targets: confetti, y: height / 2 + 50,
        x: confetti.x + Phaser.Math.Between(-100, 100),
        rotation: confetti.rotation + Phaser.Math.FloatBetween(-5, 5),
        duration: Phaser.Math.Between(2000, 4000),
        delay: Phaser.Math.Between(0, 1500), ease: 'Cubic.easeIn',
      });
    }
    
    // Кнопка
    const btnY = cardH / 2 + 50 * s;
    const btnContainer = this.scene.add.container(0, btnY);
    
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(0x22c55e, 1);
    btnBg.fillRoundedRect(-80 * s, -22 * s, 160 * s, 44 * s, 22 * s);
    btnContainer.add(btnBg);
    
    btnContainer.add(this.scene.add.text(0, 0, '✓ ОТЛИЧНО!', {
      fontSize: `${16 * s}px`, fontFamily: fonts.tech, color: '#ffffff',
    }).setOrigin(0.5));
    
    btnContainer.setSize(160 * s, 44 * s);
    btnContainer.setInteractive({ useHandCursor: true });
    btnContainer.setAlpha(0);
    
    this.scene.tweens.add({ targets: btnContainer, alpha: 1, duration: 300, delay: 1500 });
    btnContainer.on('pointerdown', () => this.hide());
    
    this.container.add(btnContainer);
    
    // Анимация появления
    this.container.setScale(0).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container, scale: 1, alpha: 1, duration: 600, delay: 200, ease: 'Back.easeOut',
    });
    
    // Звук
    try { this.scene.sound.play('reward_unlock', { volume: 0.5 }); } catch (e) {}
  }

  hide(): void {
    this.scene.tweens.add({
      targets: this.container, alpha: 0, scale: 0.8, duration: 300,
      onComplete: () => this.container?.destroy(),
    });
    
    this.scene.tweens.add({
      targets: this.overlay, alpha: 0, duration: 300,
      onComplete: () => { this.overlay?.destroy(); this.onComplete?.(); },
    });
  }
}
