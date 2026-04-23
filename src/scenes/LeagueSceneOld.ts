// src/scenes/LeagueScene.ts
// Сцена Galaxy League Hub

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact } from '../utils/Haptics';
import { SWIPE_NAVIGATION } from '../constants/gameConstants';
import { LeagueTier, getLeagueTierOrder, LEAGUE_AI_DIFFICULTY, AIDifficulty } from '../types/league';
import { LeagueManager, ORBIT_STABILIZATION_COSTS } from '../managers/LeagueManager';
import { 
  LEAGUE_BADGE_KEYS, 
  LEAGUE_DIVISION_KEYS, 
  LEAGUE_STAR_KEYS, 
  LEAGUE_ORBIT_KEYS,
  LEAGUE_HUB_BG 
} from '../config/assetKeys';
import { Button } from '../ui/Button';
import { addFullScreenBackground } from '../utils/ImageUtils';
import { SeasonManager } from '../managers/SeasonManager';

export class LeagueScene extends Phaser.Scene {
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  private orbitDecayModal?: Phaser.GameObjects.Container;
  
  // Swipe Navigation
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isSwipeActive: boolean = false;
  private swipeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private swipeArrow?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'LeagueScene' });
  }

  create(data?: { showOrbitDecay?: boolean }): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;

    AudioManager.getInstance().init(this);

    this.createBackground();
    this.createHeader();
    this.createLeagueDisplay();
    this.createPlayButton();
    this.createSwipeIndicator();
    this.setupSwipeNavigation();
    
    // ✅ Показываем Orbit Decay модал, если нужно
    if (data?.showOrbitDecay) {
      this.time.delayedCall(500, () => {
        const gameData = playerData.get();
        const leagueProgress = gameData.leagueProgress;
        
        if (!leagueProgress) {
          console.error('[LeagueScene] Cannot show Orbit Decay - no league progress');
          return;
        }
        
        this.showOrbitDecayModal(
          () => this.handleOrbitStabilization(leagueProgress),
          () => this.handleOrbitDemotion(leagueProgress)
        );
      });
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Фон лиги с правильным масштабированием
    if (this.textures.exists(LEAGUE_HUB_BG)) {
      addFullScreenBackground(this, LEAGUE_HUB_BG, 0);
    } else {
      // Fallback - градиентный фон
      const bg = this.add.graphics();
      bg.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x1a1225, 0x1a1225, 1);
      bg.fillRect(0, 0, width, height);
      bg.setDepth(0);
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // Header background
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, this.headerHeight, width, this.headerHeight);
    headerBg.setDepth(100);

    // Title
    const titleY = 35 + this.topInset;
    const title = this.add.text(width / 2, titleY, 'GALAXY LEAGUE', {
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101);
    applyTextShadow(title, 'medium');
  }

  private createLeagueDisplay(): void {
    const { width, height } = this.cameras.main;
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;
    const seasonState = data.seasonState;
    
    if (!leagueProgress) {
      console.error('[LeagueScene] No league progress found');
      return;
    }

    const colors = getColors();
    const fonts = getFonts();
    
    // Главная панель (центральное окно)
    const panelWidth = Math.min(width * 0.84, 500);
    const panelHeight = Math.min(height * 0.7, 900);
    const panelX = width / 2;
    const panelY = this.headerHeight + (height - this.headerHeight - this.bottomInset) / 2;
    
    const panelContainer = this.add.container(panelX, panelY).setDepth(10);
    
    // Фон панели - тёмная полупрозрачная с неоновой обводкой
    const panel = this.add.graphics();
    panel.fillStyle(0x14101e, 0.95);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    
    // Неоновая обводка (циан/фуксия)
    panel.lineStyle(3, colors.uiAccent, 0.8);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    
    // Внутренний glow эффект
    panel.lineStyle(1, colors.uiAccent, 0.3);
    panel.strokeRoundedRect(-panelWidth / 2 + 3, -panelHeight / 2 + 3, panelWidth - 6, panelHeight - 6, 14);
    
    panelContainer.add(panel);
    
    let yOffset = -panelHeight / 2 + 30;
    
    // (а) Заголовок
    const title = this.add.text(0, yOffset, 'GALAXY LEAGUE', {
      fontSize: `${TYPOGRAPHY.sizes.xxl}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiText),
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5);
    applyTextShadow(title, 'strong');
    panelContainer.add(title);
    
    yOffset += 30;
    
    const subtitle = this.add.text(0, yOffset, 'Ranked 1v1 • Esports Mode', {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);
    panelContainer.add(subtitle);
    
    yOffset += 60;
    
    // (б) Текущий ранг - значок лиги
    const tierName = leagueProgress.currentTier.toUpperCase() as keyof typeof LEAGUE_BADGE_KEYS;
    const badgeKey = LEAGUE_BADGE_KEYS[tierName];
    if (this.textures.exists(badgeKey)) {
      const badgeSize = Math.min(panelWidth * 0.35, 180);
      const badge = this.add.image(0, yOffset, badgeKey);
      badge.setDisplaySize(badgeSize, badgeSize);
      badge.setOrigin(0.5);
      panelContainer.add(badge);
      
      yOffset += badgeSize / 2 + 15;
    }
    
    // Иконка дивизиона
    const divisionNames: Record<1 | 2 | 3, 'I' | 'II' | 'III'> = { 1: 'I', 2: 'II', 3: 'III' };
    const divisionName = divisionNames[leagueProgress.division];
    const divisionKey = LEAGUE_DIVISION_KEYS[divisionName];
    if (this.textures.exists(divisionKey)) {
      const division = this.add.image(0, yOffset, divisionKey);
      division.setDisplaySize(64, 64);
      division.setOrigin(0.5);
      panelContainer.add(division);
      
      yOffset += 40;
    }
    
    // Название лиги и дивизиона
    const leagueName = leagueProgress.currentTier.toUpperCase();
    const rankText = this.add.text(0, yOffset, `${leagueName} • DIVISION ${divisionName}`, {
      fontSize: `${TYPOGRAPHY.sizes.lg}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(rankText, 'medium');
    panelContainer.add(rankText);
    
    yOffset += 50;
    
    // (в) Прогресс звёзд
    const starsY = yOffset;
    this.createStarsRow(panelContainer, 0, starsY, leagueProgress.stars, leagueProgress.maxStars);
    
    yOffset += 40;
    
    const starsText = this.add.text(0, yOffset, `${leagueProgress.stars} / ${leagueProgress.maxStars} ★ to next division`, {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5);
    panelContainer.add(starsText);
    
    yOffset += 50;
    
    // (г) Информация о правилах
    const rulesText = [
      'WIN: +1 ★',
      'STREAK (3+ wins): +2 ★',
      leagueProgress.currentTier === LeagueTier.METEORITE ? 'LOSS: 0 ★ (safe zone)' : 'LOSS: -1 ★',
      'DRAW: 0 ★',
    ].join('\n');
    
    const rules = this.add.text(0, yOffset, rulesText, {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    panelContainer.add(rules);
    
    yOffset += 70;
    
    // Orbit Stabilization подсказка
    if (leagueProgress.currentTier !== LeagueTier.METEORITE) {
      const orbitText = this.add.text(0, yOffset, 'At 0 ★ after a loss, pay coins to\nstabilize orbit or drop to previous League', {
        fontSize: `${TYPOGRAPHY.sizes.xs}px`,
        fontFamily: fonts.tech,
        color: '#ff9900',
        align: 'center',
        lineSpacing: 2,
      }).setOrigin(0.5);
      panelContainer.add(orbitText);
      
      yOffset += 40;
    }
    
    // (е) Доп. инфо по сезону
    if (seasonState) {
      const timeLeft = SeasonManager.getTimeUntilSeasonEnd(seasonState);
      const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
      const seasonInfo = this.add.text(0, yOffset, `Season ends in ${daysLeft} days`, {
        fontSize: `${TYPOGRAPHY.sizes.xs}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiTextSecondary),
      }).setOrigin(0.5);
      panelContainer.add(seasonInfo);
      
      yOffset += 20;
      
      const bestTier = leagueProgress.seasonBestTier.charAt(0).toUpperCase() + leagueProgress.seasonBestTier.slice(1);
      const bestText = this.add.text(0, yOffset, `Best this season: ${bestTier}`, {
        fontSize: `${TYPOGRAPHY.sizes.xs}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiAccent),
      }).setOrigin(0.5);
      panelContainer.add(bestText);
    }
  }
  
  private createStarsRow(container: Phaser.GameObjects.Container, x: number, y: number, current: number, max: number): void {
    const starSpacing = 52;
    const startX = x - (max - 1) * starSpacing / 2;

    for (let i = 0; i < max; i++) {
      const starX = startX + i * starSpacing;
      const isFilled = i < current;
      const starKey = isFilled ? LEAGUE_STAR_KEYS.FULL : LEAGUE_STAR_KEYS.EMPTY;
      
      if (this.textures.exists(starKey)) {
        const star = this.add.image(starX, y, starKey);
        star.setDisplaySize(48, 48);
        star.setOrigin(0.5);
        container.add(star);
        
        // Лёгкое свечение для заполненных звёзд
        if (isFilled) {
          this.tweens.add({
            targets: star,
            alpha: { from: 0.8, to: 1.0 },
            duration: 800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }
  }


  private createPlayButton(): void {
    const { width, height } = this.cameras.main;
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;
    
    if (!leagueProgress) return;

    const buttonY = height - this.bottomInset - 100;
    const buttonW = Math.min(width * 0.7, 340);
    const buttonH = 72;

    // Определяем сложность AI по лиге
    const aiDifficulty = LEAGUE_AI_DIFFICULTY[leagueProgress.currentTier];

    const playButton = new Button(this, {
      x: width / 2,
      y: buttonY,
      width: buttonW,
      height: buttonH,
      text: 'PLAY RANKED MATCH',
      fontSize: 20,
      onClick: () => {
        AudioManager.getInstance().playUIClick();
        hapticImpact('medium');
        // ✅ NEW: Запускаем MatchVSScene вместо GameScene
        const playerFaction = playerData.getFaction() || 'cyborg';
        const opponentFaction = this.getRandomOpponentFaction(playerFaction);
        const opponentName = `AI ${this.getDifficultyName(aiDifficulty)}`;
        
        const gameSceneData = {
          matchContext: 'league',
          vsAI: true,
          difficulty: aiDifficulty,
          aiDifficulty: aiDifficulty,
          isAI: true,
          playerFaction: playerFaction,
          opponentFaction: opponentFaction,
          opponentName: opponentName,
        };
        
        this.scene.start('MatchVSScene', {
          matchContext: 'league',
          playerFaction: playerFaction,
          opponentFaction: opponentFaction,
          opponentName: opponentName,
          isAI: true,
          aiDifficulty: aiDifficulty,
          gameSceneData: gameSceneData,
        });
      },
    });
  }

  private createSwipeIndicator(): void {
    const { height } = this.cameras.main;
    const colors = getColors();

    this.swipeIndicator = this.add.graphics();
    this.swipeIndicator.setDepth(50);

    this.swipeIndicator.fillStyle(
      SWIPE_NAVIGATION.INDICATOR_COLOR,
      SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
    );
    this.swipeIndicator.fillRoundedRect(
      0,
      this.headerHeight + 20,
      SWIPE_NAVIGATION.INDICATOR_WIDTH,
      height - this.headerHeight - 60 - this.bottomInset,
      2
    );

    this.tweens.add({
      targets: this.swipeIndicator,
      alpha: { from: 0.3, to: 0.6 },
      duration: SWIPE_NAVIGATION.PULSE_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.swipeOverlay = this.add.graphics();
    this.swipeOverlay.setDepth(200);
    this.swipeOverlay.setVisible(false);

    this.swipeArrow = this.add.container(40, height / 2);
    this.swipeArrow.setDepth(201);
    this.swipeArrow.setVisible(false);
    this.swipeArrow.setAlpha(0);

    const arrowBg = this.add.graphics();
    arrowBg.fillStyle(0x000000, 0.7);
    arrowBg.fillCircle(0, 0, 28);
    arrowBg.lineStyle(2, colors.uiAccent, 0.8);
    arrowBg.strokeCircle(0, 0, 28);
    this.swipeArrow.add(arrowBg);

    const arrowText = this.add.text(0, 0, '◀', {
      fontSize: `${SWIPE_NAVIGATION.ARROW_SIZE}px`,
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5);
    this.swipeArrow.add(arrowText);
  }

  private setupSwipeNavigation(): void {
    const { width } = this.cameras.main;
    const hitArea = this.add.rectangle(0, 0, width, this.cameras.main.height, 0, 0)
      .setOrigin(0)
      .setInteractive()
      .setDepth(1);

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
      this.swipeStartTime = Date.now();
      this.isSwipeActive = false;
    });

    hitArea.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) {
        const dx = pointer.x - this.swipeStartX;
        const dy = Math.abs(pointer.y - this.swipeStartY);
        const time = Date.now() - this.swipeStartTime;

        if (dx > 20 && dy < 50 && time < 300 && !this.isSwipeActive) {
          this.isSwipeActive = true;
          this.showSwipeFeedback();
        }
      }
    });

    hitArea.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isSwipeActive) {
        const dx = pointer.x - this.swipeStartX;
        if (dx > 100) {
          this.handleBack();
        }
      }
      this.hideSwipeFeedback();
      this.isSwipeActive = false;
    });
  }

  private showSwipeFeedback(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    if (this.swipeOverlay) {
      this.swipeOverlay.clear();
      this.swipeOverlay.fillStyle(0x000000, 0.3);
      this.swipeOverlay.fillRect(0, 0, width, height);
      this.swipeOverlay.setVisible(true);
    }

    if (this.swipeArrow) {
      this.swipeArrow.setVisible(true);
      this.tweens.add({
        targets: this.swipeArrow,
        alpha: 1,
        duration: 150,
      });
    }
  }

  private hideSwipeFeedback(): void {
    if (this.swipeOverlay) {
      this.swipeOverlay.setVisible(false);
    }
    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          if (this.swipeArrow) this.swipeArrow.setVisible(false);
        },
      });
    }
  }

  private handleBack(): void {
    AudioManager.getInstance().playUIClick();
    hapticImpact('light');
    this.scene.start('MainMenuScene');
  }

  /**
   * Показывает модал Orbit Decay
   */
  showOrbitDecayModal(onStabilize: () => void, onDemote: () => void): void {
    if (this.orbitDecayModal) {
      console.warn('[LeagueScene] Orbit Decay modal already shown');
      return;
    }

    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;

    if (!leagueProgress) {
      console.error('[LeagueScene] Cannot show Orbit Decay modal - no league progress');
      return;
    }

    // Overlay
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0)
      .setDepth(1000)
      .setInteractive();

    // Модал контейнер
    this.orbitDecayModal = this.add.container(width / 2, height / 2).setDepth(1001);

    const modalWidth = Math.min(width * 0.88, 480);
    const modalHeight = Math.min(height * 0.7, 560);

    // Панель фона - используем правильное масштабирование или fallback
    if (this.textures.exists(LEAGUE_ORBIT_KEYS.DECAY_PANEL)) {
      const panel = this.add.image(0, 0, LEAGUE_ORBIT_KEYS.DECAY_PANEL);
      const panelTexture = this.textures.get(LEAGUE_ORBIT_KEYS.DECAY_PANEL);
      const frame = panelTexture.get();
      
      // Масштабируем с сохранением пропорций (fit inside)
      const scaleX = modalWidth / frame.width;
      const scaleY = modalHeight / frame.height;
      const scale = Math.min(scaleX, scaleY);
      
      panel.setScale(scale);
      panel.setOrigin(0.5);
      this.orbitDecayModal.add(panel);
    } else {
      // Fallback - киберспортивная панель
      const bg = this.add.graphics();
      bg.fillStyle(0x14101e, 0.98);
      bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
      
      // Красная предупреждающая обводка
      bg.lineStyle(4, 0xff0044, 0.9);
      bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20);
      
      // Внутренний glow
      bg.lineStyle(2, 0xff0044, 0.4);
      bg.strokeRoundedRect(-modalWidth / 2 + 4, -modalHeight / 2 + 4, modalWidth - 8, modalHeight - 8, 18);
      
      this.orbitDecayModal.add(bg);
    }

    let yOffset = -modalHeight / 2 + 60;

    // Иконка предупреждения
    if (this.textures.exists(LEAGUE_ORBIT_KEYS.WARNING_ICON)) {
      const warning = this.add.image(0, yOffset, LEAGUE_ORBIT_KEYS.WARNING_ICON);
      warning.setDisplaySize(96, 96);
      warning.setOrigin(0.5);
      this.orbitDecayModal.add(warning);
      
      // Пульсация иконки
      this.tweens.add({
        targets: warning,
        scale: { from: 1.0, to: 1.15 },
        alpha: { from: 0.9, to: 1.0 },
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      
      yOffset += 70;
    }

    // Заголовок
    const title = this.add.text(0, yOffset, 'CRITICAL ORBIT DECAY', {
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      fontFamily: fonts.tech,
      color: '#ff0044',
      fontStyle: 'bold',
      letterSpacing: 1,
    }).setOrigin(0.5);
    applyTextShadow(title, 'strong');
    this.orbitDecayModal.add(title);

    yOffset += 50;

    // Описание
    const desc = this.add.text(0, yOffset, 'Orbit unstable. Pay coins to stay\nin this League, or fall to previous League.', {
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    this.orbitDecayModal.add(desc);

    yOffset += 60;

    // Стоимость стабилизации
    const cost = ORBIT_STABILIZATION_COSTS[leagueProgress.currentTier];
    const hasCurrency = cost.crystals 
      ? data.crystals >= cost.crystals
      : data.coins >= cost.coins;
    
    const costText = cost.crystals 
      ? `${cost.crystals} 💎 Crystals`
      : `${cost.coins} 🪙 Coins`;
    
    const costLabel = this.add.text(0, yOffset, `Stabilization Cost: ${costText}`, {
      fontSize: `${TYPOGRAPHY.sizes.lg}px`,
      fontFamily: fonts.tech,
      color: hasCurrency ? '#ffd700' : '#ff4444',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(costLabel, 'medium');
    this.orbitDecayModal.add(costLabel);

    yOffset += 70;

    // Кнопки
    const buttonW = Math.min(modalWidth * 0.4, 160);
    const buttonH = 60;
    const buttonGap = 30;

    // Кнопка "УПАСТЬ"
    const demoteButton = new Button(this, {
      x: width / 2 - buttonW / 2 - buttonGap / 2,
      y: height / 2 + yOffset,
      width: buttonW,
      height: buttonH,
      text: 'FALL',
      fontSize: 18,
      onClick: () => {
        AudioManager.getInstance().playUIClick();
        hapticImpact('medium');
        this.closeOrbitDecayModal();
        onDemote();
      },
    });
    const demoteContainer = (demoteButton as any).container as Phaser.GameObjects.Container;
    this.children.remove(demoteContainer);
    demoteContainer.setPosition(-buttonW / 2 - buttonGap / 2, yOffset);
    this.orbitDecayModal.add(demoteContainer);

    // Кнопка "СТАБИЛИЗИРОВАТЬ"
    const stabilizeButton = new Button(this, {
      x: width / 2 + buttonW / 2 + buttonGap / 2,
      y: height / 2 + yOffset,
      width: buttonW,
      height: buttonH,
      text: 'STABILIZE',
      fontSize: 16,
      icon: this.textures.exists(LEAGUE_ORBIT_KEYS.STABILIZE_ICON) ? undefined : '🛡️',
      onClick: () => {
        if (!hasCurrency) {
          // Недостаточно валюты
          AudioManager.getInstance().playUIClick();
          hapticImpact('light');
          this.showErrorToast('Not enough currency');
          return;
        }
        
        AudioManager.getInstance().playUIClick();
        hapticImpact('medium');
        this.closeOrbitDecayModal();
        onStabilize();
      },
    });
    const stabilizeContainer = (stabilizeButton as any).container as Phaser.GameObjects.Container;
    this.children.remove(stabilizeContainer);
    stabilizeContainer.setPosition(buttonW / 2 + buttonGap / 2, yOffset);
    this.orbitDecayModal.add(stabilizeContainer);

    // Анимация появления
    this.orbitDecayModal.setScale(0.8).setAlpha(0);
    this.tweens.add({
      targets: this.orbitDecayModal,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });

    overlay.on('pointerdown', () => {
      // Не закрываем по клику на overlay для этого модала
    });
  }

  private closeOrbitDecayModal(): void {
    if (!this.orbitDecayModal) return;

    this.tweens.add({
      targets: this.orbitDecayModal,
      scale: 0.8,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.orbitDecayModal?.destroy();
        this.orbitDecayModal = undefined;
        // Удаляем overlay
        this.children.list.forEach(child => {
          if (child instanceof Phaser.GameObjects.Rectangle && child.fillColor === 0x000000) {
            child.destroy();
          }
        });
      },
    });
  }
  
  /**
   * Обрабатывает стабилизацию орбиты
   */
  private handleOrbitStabilization(leagueProgress: any): void {
    const currentData = playerData.get();
    const currency = { coins: currentData.coins, crystals: currentData.crystals };
    
    try {
      const result = LeagueManager.applyOrbitStabilization(leagueProgress, currency);
      
      // Успешно - обновляем данные
      currentData.leagueProgress = result.progress;
      currentData.coins = result.currency.coins;
      currentData.crystals = result.currency.crystals;
      playerData.save();
      
      console.log('[LeagueScene] Orbit stabilized successfully');
      
      // Показываем feedback
      AudioManager.getInstance().playSFX('sfx_success');
      hapticImpact('medium');
      
      // Перезагружаем сцену
      this.time.delayedCall(100, () => {
        this.scene.restart();
      });
    } catch (error) {
      console.error('[LeagueScene] Stabilization failed:', error);
      
      // Показываем ошибку
      AudioManager.getInstance().playSFX('sfx_error');
      hapticImpact('heavy');
      
      // Можно показать toast: "Not enough coins/crystals"
      this.showErrorToast(error instanceof Error ? error.message : 'Stabilization failed');
      
      // Закрываем модал без изменений
      this.closeOrbitDecayModal();
    }
  }
  
  /**
   * Обрабатывает понижение лиги
   */
  private handleOrbitDemotion(leagueProgress: any): void {
    const currentData = playerData.get();
    
    try {
      const newProgress = LeagueManager.applyDemotion(leagueProgress);
      
      // Обновляем данные
      currentData.leagueProgress = newProgress;
      playerData.save();
      
      console.log('[LeagueScene] Demoted to:', newProgress.currentTier, newProgress.division);
      
      // Показываем feedback
      AudioManager.getInstance().playSFX('sfx_lose');
      hapticImpact('medium');
      
      // Перезагружаем сцену
      this.time.delayedCall(100, () => {
        this.scene.restart();
      });
    } catch (error) {
      console.error('[LeagueScene] Demotion failed:', error);
      this.closeOrbitDecayModal();
    }
  }
  
  /**
   * Показывает toast с ошибкой
   */
  private showErrorToast(message: string): void {
    const { width, height } = this.cameras.main;
    const fonts = getFonts();
    
    const toast = this.add.container(width / 2, height * 0.85).setDepth(2000);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.9);
    bg.fillRoundedRect(-150, -25, 300, 50, 8);
    bg.lineStyle(2, 0xff4444, 0.8);
    bg.strokeRoundedRect(-150, -25, 300, 50, 8);
    toast.add(bg);
    
    const text = this.add.text(0, 0, message, {
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      fontFamily: fonts.tech,
      color: '#ff4444',
      align: 'center',
    }).setOrigin(0.5);
    toast.add(text);
    
    // Анимация появления
    toast.setAlpha(0);
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      onComplete: () => {
        // Автоматически скрываем через 2 секунды
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            duration: 200,
            onComplete: () => toast.destroy(),
          });
        });
      },
    });
  }
  
  /**
   * Получает случайную фракцию противника (отличную от фракции игрока)
   */
  private getRandomOpponentFaction(playerFaction: string): string {
    const factions = ['magma', 'cyborg', 'void', 'insect'];
    const otherFactions = factions.filter(f => f !== playerFaction);
    return otherFactions[Math.floor(Math.random() * otherFactions.length)] || 'magma';
  }
  
  /**
   * Получает название сложности AI
   */
  private getDifficultyName(difficulty: AIDifficulty | number): string {
    // Если это строка (AIDifficulty), конвертируем в название
    if (typeof difficulty === 'string') {
      const nameMap: Record<string, string> = {
        'easy': 'Easy',
        'medium': 'Medium',
        'hard': 'Hard',
        'expert': 'Expert',
      };
      return nameMap[difficulty] || 'Medium';
    }
    
    // Если это число, используем старую логику
    const names = ['Rookie', 'Easy', 'Medium', 'Hard', 'Expert', 'Master'];
    return names[Math.min(difficulty, names.length - 1)] || 'Medium';
  }
}

