import Phaser from 'phaser';
import { getColors, getFonts, hexToString, TYPOGRAPHY } from '../config/themes';
import { hapticImpact } from '../utils/Haptics';

/**
 * Красивый оверлей разблокировки достижения
 * Появляется с анимацией, конфетти, сиянием
 */
export class AchievementUnlockOverlay extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private cardContainer: Phaser.GameObjects.Container;
  private onClose?: () => void;

  constructor(
    scene: Phaser.Scene,
    achievement: {
      iconKey: string;
      icon: string;
      name: string;
      desc: string;
      color: number;
    },
    onClose?: () => void
  ) {
    super(scene, 0, 0);
    this.onClose = onClose;
    this.setDepth(20000); // Выше всего остального
    this.createOverlay(achievement);
    scene.add.existing(this);
  }

  private createOverlay(achievement: any): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // ========== ЗАТЕМНЕННЫЙ ФОН (полупрозрачный) ==========
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.7);
    this.bg.fillRect(0, 0, width, height);
    this.bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.bg.on('pointerdown', () => this.close());
    this.add(this.bg);

    // ========== КАРТОЧКА ДОСТИЖЕНИЯ ==========
    this.cardContainer = this.scene.add.container(width / 2, height / 2);
    this.add(this.cardContainer);

    const cardWidth = Math.min(width - 60, 360);
    const cardHeight = 240;

    // ========== СИЯНИЕ (GOLDEN RAYS) ==========
    const raysCount = 16;
    for (let i = 0; i < raysCount; i++) {
      const angle = (i / raysCount) * Math.PI * 2;
      const ray = this.scene.add.graphics();
      ray.fillStyle(achievement.color, 0.15);
      ray.fillTriangle(0, 0, 200, -15, 200, 15);
      ray.setRotation(angle);
      this.cardContainer.add(ray);

      // Анимация вращения лучей
      this.scene.tweens.add({
        targets: ray,
        rotation: angle + Math.PI * 2,
        duration: 8000,
        repeat: -1,
        ease: 'Linear',
      });
    }

    // ========== ПУЛЬСИРУЮЩЕЕ СИЯНИЕ ==========
    const glow = this.scene.add.graphics();
    glow.fillStyle(achievement.color, 0.2);
    glow.fillCircle(0, 0, 120);
    this.cardContainer.add(glow);

    this.scene.tweens.add({
      targets: glow,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.2, to: 0.05 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ========== КАРТОЧКА ==========
    const cardBg = this.scene.add.graphics();
    cardBg.fillStyle(0x0f111d, 0.98);
    cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);

    // Градиент сверху
    for (let i = 0; i < 60; i++) {
      cardBg.fillStyle(achievement.color, 0.08 * (1 - i / 60));
      cardBg.fillRect(-cardWidth / 2, -cardHeight / 2 + i, cardWidth, 1);
    }

    // Glass effect
    cardBg.fillStyle(0xffffff, 0.05);
    cardBg.fillRoundedRect(
      -cardWidth / 2 + 4,
      -cardHeight / 2 + 4,
      cardWidth - 8,
      60,
      { tl: 18, tr: 18, bl: 0, br: 0 } as any
    );

    // Обводка
    cardBg.lineStyle(3, achievement.color, 0.8);
    cardBg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 20);
    this.cardContainer.add(cardBg);

    // ========== ТЕКСТ "ACHIEVEMENT UNLOCKED" ==========
    const titleText = this.scene.add.text(0, -cardHeight / 2 + 30, 'ДОСТИЖЕНИЕ РАЗБЛОКИРОВАНО!', {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: hexToString(achievement.color),
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.cardContainer.add(titleText);

    // Мерцание заголовка
    this.scene.tweens.add({
      targets: titleText,
      alpha: { from: 0.7, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ========== ИКОНКА ДОСТИЖЕНИЯ ==========
    const iconRadius = 50;
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(0x1a1a2e, 1);
    iconBg.fillCircle(0, -10, iconRadius);
    iconBg.lineStyle(4, achievement.color, 1);
    iconBg.strokeCircle(0, -10, iconRadius);
    this.cardContainer.add(iconBg);

    // Пульсация иконки
    this.scene.tweens.add({
      targets: iconBg,
      scale: { from: 0.95, to: 1.05 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    if (this.scene.textures.exists(achievement.iconKey)) {
      const iconImg = this.scene.add.image(0, -10, achievement.iconKey);
      iconImg.setDisplaySize(iconRadius * 1.6, iconRadius * 1.6);
      this.cardContainer.add(iconImg);

      // Вращение иконки
      this.scene.tweens.add({
        targets: iconImg,
        scale: { from: 0.9, to: 1.1 },
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const iconEmoji = this.scene.add.text(0, -10, achievement.icon, {
        fontSize: `${TYPOGRAPHY.sizes.hero}px`,
      }).setOrigin(0.5);
      this.cardContainer.add(iconEmoji);
    }

    // ========== НАЗВАНИЕ ДОСТИЖЕНИЯ ==========
    const nameText = this.scene.add.text(0, 60, achievement.name, {
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: cardWidth - 40 },
    }).setOrigin(0.5);
    this.cardContainer.add(nameText);

    // ========== ОПИСАНИЕ ==========
    const descText = this.scene.add.text(0, 90, achievement.desc, {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: '#aaaaaa',
      align: 'center',
      wordWrap: { width: cardWidth - 40 },
    }).setOrigin(0.5);
    this.cardContainer.add(descText);

    // ========== ПОДСКАЗКА "TAP TO CLOSE" ==========
    const tapHint = this.scene.add.text(0, cardHeight / 2 - 20, 'Тап чтобы закрыть', {
      fontSize: `${TYPOGRAPHY.sizes.xs}px`,
      color: '#666666',
    }).setOrigin(0.5);
    this.cardContainer.add(tapHint);

    // Мигание подсказки
    this.scene.tweens.add({
      targets: tapHint,
      alpha: { from: 0.3, to: 0.8 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ========== ЗВЁЗДЫ / КОНФЕТТИ ==========
    this.createParticles(achievement.color);

    // ========== АНИМАЦИЯ ПОЯВЛЕНИЯ ==========
    this.cardContainer.setScale(0);
    this.cardContainer.setAlpha(0);

    this.scene.tweens.add({
      targets: this.cardContainer,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        hapticImpact('heavy');
      },
    });

    // ========== ЗВУК (если есть) ==========
    if (this.scene.sound && this.scene.sound.get('sfx_achievement_unlock')) {
      this.scene.sound.play('sfx_achievement_unlock');
    }

    // ========== ВИБРАЦИЯ ==========
    hapticImpact('medium');
  }

  private createParticles(color: number): void {
    const { width, height } = this.scene.cameras.main;
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const distance = 80 + Math.random() * 60;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;

      // Звёзды (рисуем вручную как 5-лучевую звезду)
      const star = this.scene.add.graphics();
      star.fillStyle(color, 0.8);
      
      // Рисуем 5-лучевую звезду
      const points: { x: number; y: number }[] = [];
      const outerRadius = 6;
      const innerRadius = 3;
      for (let j = 0; j < 10; j++) {
        const starAngle = (j * Math.PI) / 5 - Math.PI / 2;
        const radius = j % 2 === 0 ? outerRadius : innerRadius;
        points.push({
          x: Math.cos(starAngle) * radius,
          y: Math.sin(starAngle) * radius,
        });
      }
      
      star.fillPoints(points, true);
      star.setPosition(width / 2, height / 2);
      this.add(star);

      // Анимация разлёта звёзд
      this.scene.tweens.add({
        targets: star,
        x: width / 2 + x * 2,
        y: height / 2 + y * 2,
        alpha: 0,
        rotation: Math.PI * 2,
        duration: 1500 + Math.random() * 500,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy(),
      });
    }

    // Конфетти (квадратики)
    for (let i = 0; i < 20; i++) {
      const colors = [0xfbbf24, 0xef4444, 0x3b82f6, 0x10b981, 0xa855f7];
      const confetti = this.scene.add.rectangle(
        width / 2 + (Math.random() - 0.5) * 100,
        height / 2 - 100,
        8,
        8,
        colors[Math.floor(Math.random() * colors.length)]
      );
      this.add(confetti);

      this.scene.tweens.add({
        targets: confetti,
        y: height / 2 + 200 + Math.random() * 100,
        x: confetti.x + (Math.random() - 0.5) * 200,
        rotation: Math.PI * 4,
        alpha: 0,
        duration: 2000 + Math.random() * 1000,
        ease: 'Cubic.easeIn',
        onComplete: () => confetti.destroy(),
      });
    }
  }

  private close(): void {
    hapticImpact('light');

    // Анимация исчезновения
    this.scene.tweens.add({
      targets: this.cardContainer,
      scale: 0.8,
      alpha: 0,
      duration: 300,
      ease: 'Back.easeIn',
    });

    this.scene.tweens.add({
      targets: this.bg,
      alpha: 0,
      duration: 300,
      ease: 'Linear',
      onComplete: () => {
        this.destroy();
        if (this.onClose) {
          this.onClose();
        }
      },
    });
  }
}
