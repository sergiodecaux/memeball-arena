// src/scenes/LeagueSceneNew.ts
// Полностью переработанная сцена Galaxy League с русским языком

import Phaser from 'phaser';
import { getColors, getFonts, TYPOGRAPHY, hexToString } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact } from '../utils/Haptics';
import { LeagueTier, LeagueProgress, LEAGUE_AI_DIFFICULTY, createDefaultLeagueProgress } from '../types/league';
import { LeagueManager, ORBIT_STABILIZATION_COSTS } from '../managers/LeagueManager';
import { LEAGUE_HUB_BG, LEAGUE_ORBIT_KEYS } from '../config/assetKeys';
import { addFullScreenBackground } from '../utils/ImageUtils';
import { LeagueCarousel } from '../ui/league/LeagueCarousel';
import { LeagueInfoPanel } from '../ui/league/LeagueInfoPanel';
import { LeagueEffectsManager } from '../managers/LeagueEffectsManager';
import { getLeagueTierInfo } from '../types/leagueRewards';
import { SeasonManager } from '../managers/SeasonManager';

/**
 * НОВАЯ сцена Galaxy League с полным русским языком и каруселью лиг
 */
export class LeagueSceneNew extends Phaser.Scene {
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  
  private carousel?: LeagueCarousel;
  private infoPanel?: LeagueInfoPanel;
  private effectsManager?: LeagueEffectsManager;
  
  private currentViewTier: LeagueTier = LeagueTier.METEORITE;
  private playerProgress: LeagueProgress;
  
  private orbitDecayModal?: Phaser.GameObjects.Container;
  
  constructor() {
    super({ key: 'LeagueSceneNew' });
    this.playerProgress = playerData.get().leagueProgress || createDefaultLeagueProgress();
  }
  
  create(data?: { showOrbitDecay?: boolean }): void {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;
    
    AudioManager.getInstance().init(this);
    
    this.currentViewTier = this.playerProgress.currentTier;
    
    this.createBackground();
    this.createHeader();
    this.createMainContent();
    this.createPlayButton();
    this.createBackButton();
    
    // Показать модал Orbit Decay если нужно
    if (data?.showOrbitDecay) {
      this.time.delayedCall(300, () => this.showOrbitDecayModal());
    }
  }
  
  /**
   * Создаёт фон
   */
  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Основной фон
    if (this.textures.exists(LEAGUE_HUB_BG)) {
      addFullScreenBackground(this, LEAGUE_HUB_BG, 0);
    } else {
      const bg = this.add.graphics();
      bg.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x1a1225, 0x1a1225, 1);
      bg.fillRect(0, 0, width, height);
      bg.setDepth(0);
    }
    
    // Эффекты лиги
    this.effectsManager = new LeagueEffectsManager(this);
    const container = this.add.container(0, 0).setDepth(1);
    this.effectsManager.createLeagueBackgroundEffect(this.currentViewTier, container);
  }
  
  /**
   * Создаёт заголовок
   */
  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // Фон заголовка
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x0a0a12, 0.85);
    headerBg.fillRect(0, 0, width, this.headerHeight);
    headerBg.setDepth(100);
    
    // Текст заголовка
    const title = this.add.text(width / 2, this.topInset + 30 * s, 'ГАЛАКТИЧЕСКАЯ ЛИГА', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(101);
    
    const subtitle = this.add.text(width / 2, this.topInset + 60 * s, 'Рейтинг 1v1 • Киберспорт режим', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiTextSecondary),
      align: 'center',
    }).setOrigin(0.5).setDepth(101);
    
    // Инфо о сезоне
    const seasonInfo = this.getSeasonInfo();
    const seasonText = this.add.text(width - 20 * s, this.topInset + 30 * s, seasonInfo, {
      fontSize: `${TYPOGRAPHY.sizes.xs * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiTextSecondary),
      align: 'right',
    }).setOrigin(1, 0.5).setDepth(101);
  }
  
  /**
   * Создаёт основной контент (карусель + инфо панель)
   */
  private createMainContent(): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    const contentStartY = this.headerHeight + 20 * s;
    const contentHeight = height - this.headerHeight - this.bottomInset - 100 * s;
    
    // Карусель лиг
    const carouselHeight = contentHeight * 0.4;
    this.carousel = new LeagueCarousel(this, {
      x: width / 2,
      y: contentStartY + carouselHeight / 2,
      width: width * 0.9,
      height: carouselHeight,
      currentTier: this.currentViewTier,
      onTierChanged: (tier) => this.onLeagueTierChanged(tier),
    });
    this.carousel.getContainer().setDepth(10);
    
    // Панель информации
    const infoPanelY = contentStartY + carouselHeight + 20 * s;
    const infoPanelHeight = contentHeight - carouselHeight - 40 * s;
    this.infoPanel = new LeagueInfoPanel(this, {
      x: width / 2,
      y: infoPanelY + infoPanelHeight / 2,
      width: width * 0.9,
      height: infoPanelHeight,
      progress: this.playerProgress,
    });
    this.infoPanel.getContainer().setDepth(10);
  }
  
  /**
   * Создаёт кнопку "Играть"
   */
  private createPlayButton(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const btnWidth = width * 0.8;
    const btnHeight = 60 * s;
    const btnY = height - this.bottomInset - btnHeight / 2 - 20 * s;
    
    const info = getLeagueTierInfo(this.currentViewTier);
    
    // Фон кнопки
    const btnBg = this.add.graphics();
    btnBg.fillStyle(info.color, 1);
    btnBg.fillRoundedRect(width / 2 - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    btnBg.lineStyle(3 * s, 0xffffff, 0.3);
    btnBg.strokeRoundedRect(width / 2 - btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    btnBg.setDepth(50);
    
    // Текст кнопки
    const btnText = this.add.text(width / 2, btnY, '⚔️ ИГРАТЬ В РЕЙТИНГ', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.primary,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setDepth(51);
    
    // Интерактивность
    const btnZone = this.add.rectangle(width / 2, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .setDepth(52);
    
    btnZone.on('pointerdown', () => {
      hapticImpact('medium');
      AudioManager.getInstance().playSFX('sfx_ui_click');
      this.launchLeagueMatch();
    });
    
    // Анимация hover
    btnZone.on('pointerover', () => {
      this.tweens.add({
        targets: [btnBg, btnText],
        scale: 1.05,
        duration: 150,
        ease: 'Power2',
      });
    });
    
    btnZone.on('pointerout', () => {
      this.tweens.add({
        targets: [btnBg, btnText],
        scale: 1,
        duration: 150,
        ease: 'Power2',
      });
    });
  }
  
  /**
   * Создаёт кнопку "Назад"
   */
  private createBackButton(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const backBtn = this.add.text(20 * s, this.topInset + 30 * s, '← Назад', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiAccent),
      align: 'left',
    }).setOrigin(0, 0.5).setDepth(101).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => {
      hapticImpact('light');
      AudioManager.getInstance().playSFX('sfx_ui_click');
      this.scene.start('MainMenuScene');
    });
  }
  
  /**
   * Обработчик смены лиги в карусели
   */
  private onLeagueTierChanged(tier: LeagueTier): void {
    this.currentViewTier = tier;
    
    // Обновить эффекты фона
    if (this.effectsManager) {
      this.effectsManager.destroy();
      this.effectsManager = new LeagueEffectsManager(this);
      const container = this.add.container(0, 0).setDepth(1);
      this.effectsManager.createLeagueBackgroundEffect(tier, container);
    }
    
    // Обновить кнопку "Играть" (цвет)
    // TODO: обновить цвет кнопки в зависимости от лиги
  }
  
  /**
   * Запускает матч в режиме лиги
   */
  private launchLeagueMatch(): void {
    const difficulty = LEAGUE_AI_DIFFICULTY[this.playerProgress.currentTier];
    const playerFaction = playerData.getFaction() || 'cyborg';
    const opponentFaction = this.getRandomOpponentFaction(playerFaction);
    const opponentName = this.generateOpponentName();
    
    const gameSceneData = {
      matchContext: 'league',
      aiDifficulty: difficulty,
      opponentName: opponentName,
      playerFaction: playerFaction,
      opponentFaction: opponentFaction,
      isAI: true,
    };
    
    this.scene.start('MatchVSScene', {
      matchContext: 'league',
      playerFaction: playerFaction,
      opponentFaction: opponentFaction,
      opponentName: opponentName,
      isAI: true,
      aiDifficulty: difficulty,
      gameSceneData: gameSceneData,
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
   * Генерирует случайное имя соперника
   */
  private generateOpponentName(): string {
    const prefixes = ['Neon', 'Cyber', 'Quantum', 'Stellar', 'Cosmic', 'Nova', 'Orbit', 'Galaxy'];
    const suffixes = ['Strike', 'Force', 'Master', 'Legend', 'Hero', 'King', 'Pro', 'Ace'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const number = Math.floor(Math.random() * 900) + 100;
    return `${prefix}${suffix}#${number}`;
  }
  
  /**
   * Получить информацию о сезоне
   */
  private getSeasonInfo(): string {
    const data = playerData.get();
    const seasonState = data.seasonState;

    if (!seasonState) {
      return 'Сезон • данные недоступны';
    }

    const timeLeft = SeasonManager.getTimeUntilSeasonEnd(seasonState);
    const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
    
    return `Сезон активен • ${daysLeft} дн. до конца`;
  }
  
  /**
   * Показать модал Orbit Decay
   */
  private showOrbitDecayModal(): void {
    if (this.orbitDecayModal) return;
    
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    this.orbitDecayModal = this.add.container(0, 0).setDepth(200);
    
    // Затемнение фона
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.orbitDecayModal.add(overlay);
    
    // Панель модала
    const panelWidth = width * 0.85;
    const panelHeight = height * 0.6;
    const panelX = width / 2;
    const panelY = height / 2;
    
    // Проверяем, есть ли текстура панели распада орбиты
    const orbitDecayKey = LEAGUE_ORBIT_KEYS.DECAY_PANEL;
    if (orbitDecayKey && this.textures.exists(orbitDecayKey)) {
      const panelImg = this.add.image(panelX, panelY, orbitDecayKey);
      panelImg.setDisplaySize(panelWidth, panelHeight);
      this.orbitDecayModal.add(panelImg);
    } else {
      // Fallback - векторная панель
      const panelBg = this.add.graphics();
      panelBg.fillStyle(0x0a0a12, 0.95);
      panelBg.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
      panelBg.lineStyle(4 * s, 0xff0000, 0.8);
      panelBg.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 20 * s);
      this.orbitDecayModal.add(panelBg);
    }
    
    // Иконка предупреждения
    const warningKey = LEAGUE_ORBIT_KEYS.WARNING_ICON;
    if (warningKey && this.textures.exists(warningKey)) {
      const icon = this.add.image(panelX, panelY - panelHeight / 3, warningKey);
      icon.setDisplaySize(80 * s, 80 * s);
      this.orbitDecayModal.add(icon);
    } else {
      // Fallback - текстовая иконка
      const icon = this.add.text(panelX, panelY - panelHeight / 3, '⚠️', {
        fontSize: `${80 * s}px`,
      }).setOrigin(0.5);
      this.orbitDecayModal.add(icon);
    }
    
    // Заголовок
    const title = this.add.text(panelX, panelY - panelHeight / 4 + 40 * s, 'КРИТИЧЕСКИЙ РАСПАД ОРБИТЫ', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.primary,
      color: '#ff0000',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.orbitDecayModal.add(title);
    
    // Текст предупреждения
    const warningText = this.add.text(
      panelX,
      panelY - 20 * s,
      'У вас 0 звёзд!\n\nВы можете:\n• Упасть в предыдущий дивизион\n• Стабилизировать орбиту за кристаллы',
      {
        fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
        fontFamily: fonts.primary,
        color: hexToString(colors.uiText),
        align: 'center',
        wordWrap: { width: panelWidth * 0.8 },
      }
    ).setOrigin(0.5);
    this.orbitDecayModal.add(warningText);
    
    // Стоимость стабилизации
    const cost = ORBIT_STABILIZATION_COSTS[this.playerProgress.currentTier];
    const costText = this.add.text(
      panelX,
      panelY + 60 * s,
      `Стабилизация: ${cost} 💎`,
      {
        fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
        fontFamily: fonts.primary,
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
        align: 'center',
      }
    ).setOrigin(0.5);
    this.orbitDecayModal.add(costText);
    
    // Кнопки
    const btnY = panelY + panelHeight / 2 - 50 * s;
    const btnWidth = panelWidth * 0.4;
    const btnHeight = 50 * s;
    
    // Кнопка "Упасть"
    const fallBtn = this.createModalButton(
      panelX - btnWidth / 2 - 10 * s,
      btnY,
      btnWidth,
      btnHeight,
      'УПАСТЬ',
      0x666666,
      () => this.handleOrbitDecayFall()
    );
    this.orbitDecayModal.add(fallBtn);
    
    // Кнопка "Стабилизировать"
    const stabilizeBtn = this.createModalButton(
      panelX + btnWidth / 2 + 10 * s,
      btnY,
      btnWidth,
      btnHeight,
      'СТАБИЛИЗИРОВАТЬ',
      colors.uiAccent,
      () => this.handleOrbitStabilization()
    );
    this.orbitDecayModal.add(stabilizeBtn);
    
    // Анимация появления
    this.orbitDecayModal.setAlpha(0);
    this.orbitDecayModal.setScale(0.8);
    this.tweens.add({
      targets: this.orbitDecayModal,
      alpha: 1,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
    
    hapticImpact('heavy');
    AudioManager.getInstance().playSFX('sfx_ui_error');
  }
  
  /**
   * Создать кнопку для модала
   */
  private createModalButton(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    color: number,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const btn = this.add.container(x, y);
    
    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 10 * s);
    btn.add(bg);
    
    // Текст
    const label = this.add.text(0, 0, text, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    btn.add(label);
    
    // Интерактивность
    const zone = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(zone);
    
    zone.on('pointerdown', () => {
      hapticImpact('medium');
      AudioManager.getInstance().playSFX('sfx_ui_click');
      onClick();
    });
    
    return btn;
  }
  
  /**
   * Обработать падение (демот)
   */
  private handleOrbitDecayFall(): void {
    const newProgress = LeagueManager.applyDemotion(this.playerProgress);
    this.playerProgress = newProgress;
    
    const currentData = playerData.get();
    currentData.leagueProgress = newProgress;
    playerData.save();
    
    this.closeOrbitDecayModal();
    this.scene.restart();
  }
  
  /**
   * Обработать стабилизацию
   */
  private handleOrbitStabilization(): void {
    const currentData = playerData.get();
    const currency = { coins: currentData.coins, crystals: currentData.crystals };
    
    try {
      const result = LeagueManager.applyOrbitStabilization(this.playerProgress, currency);
      currentData.leagueProgress = result.progress;
      currentData.coins = result.currency.coins;
      currentData.crystals = result.currency.crystals;
      playerData.save();
      
      this.closeOrbitDecayModal();
      this.showSuccessToast('Орбита стабилизирована!');
      this.scene.restart();
    } catch (error: any) {
      console.error('[LeagueSceneNew] Stabilization failed:', error.message);
      this.showErrorToast(error.message);
      AudioManager.getInstance().playSFX('sfx_ui_error');
    }
  }
  
  /**
   * Закрыть модал Orbit Decay
   */
  private closeOrbitDecayModal(): void {
    if (!this.orbitDecayModal) return;
    
    this.tweens.add({
      targets: this.orbitDecayModal,
      alpha: 0,
      scale: 0.8,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.orbitDecayModal?.destroy();
        this.orbitDecayModal = undefined;
      },
    });
  }
  
  /**
   * Показать тост об ошибке
   */
  private showErrorToast(message: string): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const toast = this.add.container(width / 2, height / 2);
    toast.setDepth(300);
    
    const bg = this.add.graphics();
    bg.fillStyle(0xff0000, 0.9);
    bg.fillRoundedRect(-150 * s, -30 * s, 300 * s, 60 * s, 10 * s);
    toast.add(bg);
    
    const text = this.add.text(0, 0, message, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 280 * s },
    }).setOrigin(0.5);
    toast.add(text);
    
    this.tweens.add({
      targets: toast,
      alpha: { from: 1, to: 0 },
      y: height / 2 - 50 * s,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => toast.destroy(),
    });
  }
  
  /**
   * Показать тост об успехе
   */
  private showSuccessToast(message: string): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const toast = this.add.container(width / 2, height / 2);
    toast.setDepth(300);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x00ff00, 0.9);
    bg.fillRoundedRect(-150 * s, -30 * s, 300 * s, 60 * s, 10 * s);
    toast.add(bg);
    
    const text = this.add.text(0, 0, message, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 280 * s },
    }).setOrigin(0.5);
    toast.add(text);
    
    this.tweens.add({
      targets: toast,
      alpha: { from: 1, to: 0 },
      y: height / 2 - 50 * s,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => toast.destroy(),
    });
  }
}

