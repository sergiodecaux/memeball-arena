// src/scenes/AIDifficultySelectScene.ts
// Экран выбора сложности AI для режима тренировки

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { hapticSelection, hapticImpact } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { FACTIONS } from '../constants/gameConstants';
import { safeSceneStart } from '../utils/SceneHelpers';
import type { AIDifficulty } from '../types/league';

interface DifficultyConfig {
  id: AIDifficulty;
  name: string;
  description: string;
  color: number;
  icon: string;
}

const DIFFICULTIES: DifficultyConfig[] = [
  {
    id: 'easy',
    name: 'ЛЕГКИЙ',
    description: 'Базовая AI логика.\nОтлично для новичков и тестирования.',
    color: 0x10b981, // green
    icon: '😊',
  },
  {
    id: 'medium',
    name: 'СРЕДНИЙ',
    description: 'Сбалансированная игра.\nХороший вызов для опытных игроков.',
    color: 0xfbbf24, // yellow
    icon: '😐',
  },
  {
    id: 'hard',
    name: 'СЛОЖНЫЙ',
    description: 'Умная AI с активной тактикой.\nТребует хорошей стратегии.',
    color: 0xef4444, // red
    icon: '😠',
  },
  {
    id: 'expert',
    name: 'ЭКСПЕРТ',
    description: 'Максимальная сложность.\nДля профи и экспериментов.',
    color: 0xa855f7, // purple
    icon: '😈',
  },
];

export class AIDifficultySelectScene extends Phaser.Scene {
  private selectedDifficulty: AIDifficulty = 'medium';
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;

  constructor() {
    super({ key: 'AIDifficultySelectScene' });
  }

  create(): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;

    AudioManager.getInstance().init(this);

    this.createBackground();
    this.createHeader();
    this.createDifficultyCards();
    this.createBottomButtons();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);

    this.drawRadialGradient(bg, width / 2, 0, height * 0.6, colors.backgroundGradientTop, 0.5);
    this.drawRadialGradient(bg, width / 2, height, height * 0.3, 0x39ff14, 0.08); // green accent

    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x <= width; x += 50) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 50) bg.lineBetween(0, y, width, y);

    this.createParticles(12);
  }

  private drawRadialGradient(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    maxR: number,
    color: number,
    maxAlpha: number
  ): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      g.fillStyle(color, maxAlpha * Math.pow(1 - ratio, 2));
      g.fillCircle(cx, cy, maxR * ratio);
    }
  }

  private createParticles(count: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const particleColors = [0x39ff14, colors.uiAccent, colors.uiPrimary];

    for (let i = 0; i < count; i++) {
      const p = this.add.circle(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(100, height - 100),
        Phaser.Math.FloatBetween(1, 2.5),
        Phaser.Math.RND.pick(particleColors),
        Phaser.Math.FloatBetween(0.2, 0.4)
      );

      this.tweens.add({
        targets: p,
        y: p.y - Phaser.Math.Between(30, 60),
        alpha: { from: p.alpha, to: 0.1 },
        duration: Phaser.Math.Between(4000, 7000),
        yoyo: true,
        repeat: -1,
        delay: i * 150,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.lineStyle(2, 0x39ff14, 0.3);
    headerBg.lineBetween(0, this.headerHeight, width, this.headerHeight);
    headerBg.setDepth(100);

    const titleGlow = this.add.graphics();
    titleGlow.fillStyle(0x39ff14, 0.1);
    titleGlow.fillEllipse(width / 2, 40 + this.topInset, 200, 40);
    titleGlow.setDepth(100);

    const title = this.add
      .text(width / 2, 40 + this.topInset, 'ВЫБОР СЛОЖНОСТИ', {
        fontSize: `${TYPOGRAPHY.sizes.xl}px`,
        fontFamily: fonts.tech,
        color: '#ffffff',
        letterSpacing: 3,
      })
      .setOrigin(0.5)
      .setDepth(101);
    
    applyTextShadow(title, 'medium');
  }

  private createDifficultyCards(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    const startY = this.headerHeight + 40;
    const cardSpacing = 10;
    const cardHeight = 90;

    DIFFICULTIES.forEach((difficulty, index) => {
      const isSelected = this.selectedDifficulty === difficulty.id;
      const cardY = startY + index * (cardHeight + cardSpacing);
      const cardWidth = width - 40;

      const container = this.add.container(width / 2, cardY + cardHeight / 2);
      container.setDepth(50);

      // Фон карточки
      const bg = this.add.graphics();
      
      if (isSelected) {
        bg.fillStyle(0x000000, 0.15);
        bg.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth, cardHeight, 12);
      }
      
      bg.fillStyle(isSelected ? difficulty.color : 0x14101e, isSelected ? 0.1 : 0.95);
      bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
      
      if (isSelected) {
        bg.fillStyle(0xffffff, 0.05);
        bg.fillRoundedRect(-cardWidth / 2 + 2, -cardHeight / 2 + 2, cardWidth - 4, cardHeight * 0.4, { tl: 10, tr: 10, bl: 0, br: 0 } as any);
      }
      
      bg.lineStyle(2, isSelected ? difficulty.color : colors.glassBorder, isSelected ? 0.8 : 0.2);
      bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
      container.add(bg);

      // Иконка сложности
      const iconBg = this.add.graphics();
      iconBg.fillStyle(difficulty.color, isSelected ? 0.2 : 0.1);
      iconBg.fillCircle(-cardWidth / 2 + 50, 0, 28);
      iconBg.lineStyle(2, difficulty.color, isSelected ? 0.8 : 0.3);
      iconBg.strokeCircle(-cardWidth / 2 + 50, 0, 28);
      container.add(iconBg);

      container.add(
        this.add.text(-cardWidth / 2 + 50, 0, difficulty.icon, { 
          fontSize: `${TYPOGRAPHY.sizes.xxl}px` 
        }).setOrigin(0.5)
      );

      // Название сложности
      container.add(
        this.add
          .text(-cardWidth / 2 + 95, -18, difficulty.name, {
            fontSize: `${TYPOGRAPHY.sizes.md}px`,
            fontFamily: fonts.tech,
            color: isSelected ? hexToString(difficulty.color) : '#ffffff',
          })
          .setOrigin(0, 0.5)
      );

      // Описание
      container.add(
        this.add
          .text(-cardWidth / 2 + 95, 10, difficulty.description.split('\n')[0], {
            fontSize: `${TYPOGRAPHY.sizes.xs}px`,
            fontFamily: fonts.primary,
            color: isSelected ? '#dddddd' : '#999999',
          })
          .setOrigin(0, 0.5)
      );

      // Индикатор выбора
      if (isSelected) {
        const checkBg = this.add.graphics();
        checkBg.fillStyle(difficulty.color, 0.2);
        checkBg.fillCircle(cardWidth / 2 - 35, 0, 18);
        checkBg.lineStyle(2, difficulty.color, 0.8);
        checkBg.strokeCircle(cardWidth / 2 - 35, 0, 18);
        container.add(checkBg);

        container.add(
          this.add
            .text(cardWidth / 2 - 35, 0, '✓', {
              fontSize: `${TYPOGRAPHY.sizes.lg}px`,
              color: hexToString(difficulty.color),
            })
            .setOrigin(0.5)
        );
      }

      // Интерактивность
      const hitArea = this.add
        .rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerover', () => {
        if (!isSelected) {
          this.tweens.add({ targets: container, scale: 1.02, duration: 100 });
        }
      });

      hitArea.on('pointerout', () => {
        if (!isSelected) {
          this.tweens.add({ targets: container, scale: 1, duration: 100 });
        }
      });

      hitArea.on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        hapticSelection();
        this.selectedDifficulty = difficulty.id;
        this.scene.restart();
      });
    });
  }

  private createBottomButtons(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const bottomY = height - 80 - this.bottomInset;

    // Кнопка "Назад"
    const backBtnWidth = (width - 60) / 2;
    const backBtnHeight = 54;
    const backBtnX = 20 + backBtnWidth / 2;

    const backBtnContainer = this.add.container(backBtnX, bottomY);
    backBtnContainer.setDepth(100);

    const backBg = this.add.graphics();
    backBg.fillStyle(0x14101e, 0.95);
    backBg.fillRoundedRect(-backBtnWidth / 2, -backBtnHeight / 2, backBtnWidth, backBtnHeight, 12);
    backBg.lineStyle(2, colors.glassBorder, 0.3);
    backBg.strokeRoundedRect(-backBtnWidth / 2, -backBtnHeight / 2, backBtnWidth, backBtnHeight, 12);
    backBtnContainer.add(backBg);

    backBtnContainer.add(
      this.add
        .text(0, 0, 'НАЗАД', {
          fontSize: `${TYPOGRAPHY.sizes.md}px`,
          fontFamily: fonts.tech,
          color: '#ffffff',
        })
        .setOrigin(0.5)
    );

    const backHitArea = this.add
      .rectangle(0, 0, backBtnWidth, backBtnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    backBtnContainer.add(backHitArea);

    backHitArea.on('pointerover', () => {
      this.tweens.add({ targets: backBtnContainer, scale: 1.05, duration: 100 });
    });

    backHitArea.on('pointerout', () => {
      this.tweens.add({ targets: backBtnContainer, scale: 1, duration: 100 });
    });

    backHitArea.on('pointerdown', async () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('light');
      this.scene.stop('AIDifficultySelectScene');
      await safeSceneStart(this, 'MatchModeSelectScene');
    });

    // Кнопка "Играть"
    const playBtnWidth = (width - 60) / 2;
    const playBtnHeight = 54;
    const playBtnX = width - 20 - playBtnWidth / 2;

    const playBtnContainer = this.add.container(playBtnX, bottomY);
    playBtnContainer.setDepth(100);

    const selectedConfig = DIFFICULTIES.find(d => d.id === this.selectedDifficulty);
    const btnColor = selectedConfig?.color || 0x39ff14;

    const playBg = this.add.graphics();
    playBg.fillStyle(btnColor, 0.2);
    playBg.fillRoundedRect(-playBtnWidth / 2, -playBtnHeight / 2, playBtnWidth, playBtnHeight, 12);
    playBg.lineStyle(2, btnColor, 0.8);
    playBg.strokeRoundedRect(-playBtnWidth / 2, -playBtnHeight / 2, playBtnWidth, playBtnHeight, 12);
    playBtnContainer.add(playBg);

    playBtnContainer.add(
      this.add
        .text(0, 0, 'ИГРАТЬ', {
          fontSize: `${TYPOGRAPHY.sizes.md}px`,
          fontFamily: fonts.tech,
          color: hexToString(btnColor),
        })
        .setOrigin(0.5)
    );

    const playHitArea = this.add
      .rectangle(0, 0, playBtnWidth, playBtnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    playBtnContainer.add(playHitArea);

    playHitArea.on('pointerover', () => {
      this.tweens.add({ targets: playBtnContainer, scale: 1.05, duration: 100 });
    });

    playHitArea.on('pointerout', () => {
      this.tweens.add({ targets: playBtnContainer, scale: 1, duration: 100 });
    });

    playHitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.startAIMatch();
    });
  }

  private async startAIMatch(): Promise<void> {
    console.log(`[AIDifficultySelect] Starting AI match with difficulty: ${this.selectedDifficulty}`);
    
    // Мапим сложность из строки в число (0-1)
    const difficultyMap: Record<AIDifficulty, number> = {
      easy: 0.25,
      medium: 0.5,
      hard: 0.75,
      expert: 1.0,
    };
    
    // ✅ ИСПРАВЛЕНО: Получаем реальное количество доступных слотов у игрока
    const selectedFaction = playerData.getFaction();
    if (!selectedFaction) {
      console.error('[AIDifficultySelect] No faction selected! Cannot start match.');
      this.showToast('Сначала выберите фракцию в профиле!');
      return;
    }
    
    const allowedTeamSize = playerData.getAllowedTeamSize(selectedFaction);
    console.log(`[AIDifficultySelect] Player faction: ${selectedFaction}, allowed teamSize: ${allowedTeamSize}`);
    
    // Запоминаем режим для определения в GameScene
    const data = playerData.get();
    data.currentMatchMode = 'custom';
    playerData.save();
    
    this.scene.stop('AIDifficultySelectScene');
    await safeSceneStart(this, 'MatchPreparationScene', {
      matchContext: 'casual', // используем casual контекст для custom режима
      isAI: true,
      aiDifficulty: difficultyMap[this.selectedDifficulty],
      teamSize: allowedTeamSize, // ✅ ИСПРАВЛЕНО: Используем реальное количество открытых слотов
    });
  }
  
  private showToast(message: string): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    const toast = this.add.text(width / 2, height - 200 * s, message, {
      fontSize: `${16 * s}px`,
      fontFamily: getFonts().tech,
      color: '#ff0066',
      backgroundColor: '#000000',
      padding: { x: 20 * s, y: 10 * s },
    })
    .setOrigin(0.5)
    .setDepth(1000);
    
    this.tweens.add({
      targets: toast,
      alpha: { from: 1, to: 0 },
      y: toast.y - 50 * s,
      duration: 2000,
      ease: 'Cubic.easeOut',
      onComplete: () => toast.destroy(),
    });
  }
}
