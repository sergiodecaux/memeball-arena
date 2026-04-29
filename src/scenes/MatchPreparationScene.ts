// src/scenes/MatchPreparationScene.ts
// 🎮 ПРЕМИУМ экран подготовки к матчу (как в League of Legends/Valorant/Dota 2)

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact, hapticSelection } from '../utils/Haptics';
import { FACTIONS, FactionId, FACTION_IDS, FactionConfig } from '../constants/gameConstants';
import { PremiumButton } from '../ui/PremiumButton';
import { FACTION_UI, getUIFactionByGameFaction } from '../constants/factionUiConfig';
import { logInfo, logWarn, logError } from '../utils/ProductionLogger';
import { AssetPackManager } from '../assets/AssetPackManager';
import { getUnitsByFaction } from '../data/UnitsRepository';
import { loadImagesBoot, loadImagesTactics } from '../assets/loading/ImageLoader';

interface MatchPreparationData {
  matchContext: 'league' | 'tournament' | 'casual';
  opponentName: string;
  opponentFaction?: FactionId;
  isAI?: boolean;
  aiDifficulty?: number;
  
  // 🎮 Размер команды (количество фишек)
  teamSize?: number;
  
  // 💰 Вступительный взнос (для лиг)
  entryFee?: number;
  
  // Для турнира
  tournamentId?: string;
  seriesId?: string;
  round?: string;
  majorAbilityBonus?: boolean;
  aimAssistDisabled?: boolean;
  
  // ✅ НОВОЕ: Аватар противника (для консистентности)
  opponentAvatarId?: string;
}

export class MatchPreparationScene extends Phaser.Scene {
  private matchData!: MatchPreparationData;
  private topInset = 0;
  private bottomInset = 0;
  
  // Состояние выбора
  private playerSelectedFaction?: FactionId;
  private opponentSelectedFaction?: FactionId;
  private playerReady = false;
  private opponentReady = false;
  
  // UI элементы
  private factionCards = new Map<FactionId, Phaser.GameObjects.Container>();
  private factionScrollContainer?: Phaser.GameObjects.Container;
  private readyButton?: PremiumButton;
  private botThinkingTimer?: Phaser.Time.TimerEvent;
  
  // ⏱️ Таймер подготовки (5 минут = 300 секунд)
  private prepTimeRemaining = 300;
  private prepTimerText?: Phaser.GameObjects.Text;
  private prepTimerEvent?: Phaser.Time.TimerEvent;
  
  // Статусы игроков
  private playerStatusText?: Phaser.GameObjects.Text;
  private opponentStatusText?: Phaser.GameObjects.Text;
  
  // Countdown
  private countdown = 3;
  private countdownText?: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MatchPreparationScene' });
  }

  shutdown(): void {
    if (import.meta.env.DEV) {
      console.debug('[MatchPreparationScene] shutdown called');
    }
    // Cleanup is handled by Phaser automatically
  }

  init(data: MatchPreparationData): void {
    this.matchData = data;
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    
    // ✅ НОВОЕ: Генерируем аватар противника ОДИН РАЗ для консистентности
    if (!this.matchData.opponentAvatarId) {
      this.matchData.opponentAvatarId = this.getRandomBotAvatar();
      console.log(`[MatchPreparationScene] Generated opponent avatar: ${this.matchData.opponentAvatarId}`);
    }
    
    // Сброс состояния
    this.playerSelectedFaction = undefined;
    this.opponentSelectedFaction = data.opponentFaction;
    this.playerReady = false;
    this.opponentReady = false;
    this.prepTimeRemaining = 300;
    
    this.factionCards.clear();
  }

  preload(): void {
    loadImagesBoot(this);
    loadImagesTactics(this);
  }

  create(): void {
    logInfo('MatchPrep', 'MatchPreparationScene created', {
      matchContext: this.matchData.matchContext,
      isAI: this.matchData.isAI,
      opponentName: this.matchData.opponentName
    });
    
    AudioManager.getInstance().init(this);
    
    this.createBackground();
    this.createHeader();
    this.createPlayersArea();
    this.createFactionPicker();
    this.createReadyButton();
    
    // ⏱️ Запускаем таймер подготовки
    this.startPrepTimer();
  }

  // ========== ФОНОВАЯ ЧАСТЬ ==========
  
  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Темный градиентный фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a12, 0x0a0a12, 0x1a1a2e, 0x1a1a2e, 1);
    bg.fillRect(0, 0, width, height);
    bg.setDepth(0);
    
    // Сетка (как в киберспортивных играх)
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x00ff9d, 0.05);
    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      grid.lineBetween(0, y, width, y);
    }
    grid.setDepth(1);
  }

  // ========== ШАПКА С ТАЙМЕРОМ ==========
  
  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const headerHeight = 90 * s + this.topInset;
    
    // Фон хедера
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.95);
    headerBg.fillRect(0, 0, width, headerHeight);
    headerBg.lineStyle(3, colors.uiAccent, 0.8);
    headerBg.lineBetween(0, headerHeight, width, headerHeight);
    headerBg.setDepth(100);
    
    // ⏱️ ТАЙМЕР (центр, крупно)
    this.prepTimerText = this.add.text(width / 2, this.topInset + 50 * s, '05:00', {
      fontSize: `${48 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff9d',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);
    applyTextShadow(this.prepTimerText, 'strong');
    
    // Подпись таймера
    const timerLabel = this.add.text(width / 2, this.topInset + 80 * s, 'TIME TO PREPARE', {
      fontSize: `${12 * s}px`,
      fontFamily: fonts.tech,
      color: '#888888',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101);
  }

  // ========== ИГРОКИ (СЛЕВА/СПРАВА) ==========
  
  private createPlayersArea(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    const data = playerData.get();
    const y = this.topInset + 180 * s;
    
    // ========== ИГРОК (СЛЕВА) ==========
    const playerContainer = this.add.container(width * 0.2, y).setDepth(10);
    
    // Панель игрока (стильная)
    const playerPanel = this.add.graphics();
    playerPanel.fillStyle(0x0a0a1e, 0.95);
    playerPanel.fillRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    playerPanel.lineStyle(3 * s, colors.uiAccent, 1);
    playerPanel.strokeRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    // Glow эффект
    playerPanel.lineStyle(8 * s, colors.uiAccent, 0.3);
    playerPanel.strokeRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    playerContainer.add(playerPanel);
    
    // Аватар
    const playerAvatar = this.add.circle(0, -30 * s, 40 * s, colors.uiAccent, 0.3);
    playerContainer.add(playerAvatar);
    
    const playerAvatarBorder = this.add.circle(0, -30 * s, 40 * s);
    playerAvatarBorder.setStrokeStyle(4 * s, colors.uiAccent, 1);
    playerContainer.add(playerAvatarBorder);

    // ✅ АВАТАРКА ИГРОКА (PNG)
    const playerAvatarId = data.avatarId || 'avatar_recruit';
    if (this.textures.exists(playerAvatarId)) {
      const avatarImg = this.add.image(0, -30 * s, playerAvatarId);
      avatarImg.setDisplaySize(70 * s, 70 * s);
      playerContainer.add(avatarImg);
    } else {
      playerContainer.add(this.add.text(0, -30 * s, '👤', { fontSize: `${32 * s}px` }).setOrigin(0.5));
    }
    
    // Имя игрока
    const playerName = this.add.text(0, 20 * s, data.nickname || 'ВЫ', {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(playerName, 'strong');
    playerContainer.add(playerName);
    
    // Статус игрока (PICKING...)
    this.playerStatusText = this.add.text(0, 50 * s, 'PICKING...', {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff9d',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    playerContainer.add(this.playerStatusText);
    
    // ========== VS (ЦЕНТР) ==========
    const vsContainer = this.add.container(width / 2, y).setDepth(20);
    
    const vsBg = this.add.graphics();
    vsBg.fillStyle(0x000000, 0.9);
    vsBg.fillCircle(0, 0, 50 * s);
    vsBg.lineStyle(4 * s, 0xff0066, 1);
    vsBg.strokeCircle(0, 0, 50 * s);
    // Glow
    vsBg.lineStyle(10 * s, 0xff0066, 0.3);
    vsBg.strokeCircle(0, 0, 50 * s);
    vsContainer.add(vsBg);
    
    const vsText = this.add.text(0, 0, 'VS', {
      fontSize: `${36 * s}px`,
      fontFamily: fonts.tech,
      color: '#ff0066',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(vsText, 'strong');
    vsContainer.add(vsText);
    
    // ========== ПРОТИВНИК (СПРАВА) ==========
    const opponentContainer = this.add.container(width * 0.8, y).setDepth(10);
    
    // Панель противника
    const opponentPanel = this.add.graphics();
    opponentPanel.fillStyle(0x1a0a0a, 0.95);
    opponentPanel.fillRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    opponentPanel.lineStyle(3 * s, 0xff6b6b, 1);
    opponentPanel.strokeRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    // Glow
    opponentPanel.lineStyle(8 * s, 0xff6b6b, 0.3);
    opponentPanel.strokeRoundedRect(-80 * s, -90 * s, 160 * s, 180 * s, 16 * s);
    opponentContainer.add(opponentPanel);
    
    // Аватар противника
    const opponentAvatar = this.add.circle(0, -30 * s, 40 * s, 0xff6b6b, 0.3);
    opponentContainer.add(opponentAvatar);
    
    const opponentAvatarBorder = this.add.circle(0, -30 * s, 40 * s);
    opponentAvatarBorder.setStrokeStyle(4 * s, 0xff6b6b, 1);
    opponentContainer.add(opponentAvatarBorder);

    // ✅ ИСПРАВЛЕНО: Используем СОХРАНЁННЫЙ аватар для консистентности
    const opponentAvatarId = this.matchData.opponentAvatarId!;
    if (this.textures.exists(opponentAvatarId)) {
      const avatarImg = this.add.image(0, -30 * s, opponentAvatarId);
      avatarImg.setDisplaySize(70 * s, 70 * s);
      opponentContainer.add(avatarImg);
    } else {
      opponentContainer.add(this.add.text(0, -30 * s, '🤖', { fontSize: `${32 * s}px` }).setOrigin(0.5));
    }
    
    // Имя противника
    const opponentName = this.add.text(0, 20 * s, this.matchData.opponentName, {
      fontSize: `${18 * s}px`,
      fontFamily: fonts.tech,
      color: '#ff6b6b',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(opponentName, 'strong');
    opponentContainer.add(opponentName);
    
    // Статус противника
    this.opponentStatusText = this.add.text(0, 50 * s, 'WAITING...', {
      fontSize: `${14 * s}px`,
      fontFamily: fonts.tech,
      color: '#888888',
    }).setOrigin(0.5);
    opponentContainer.add(this.opponentStatusText);
  }

  // ========== ВЫБОР ФРАКЦИЙ ==========
  
  private createFactionPicker(): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    const data = playerData.get();
    
    // 🔥 ПОКАЗЫВАЕМ ВСЕ фракции (не только открытые)
    const allFactions = FACTION_IDS;
    
    console.log(`[MatchPreparationScene] Displaying all ${allFactions.length} factions`);
    
    // ✅ Компактные размеры карточек для мобильных
    const cardWidth = 75 * s;
    const cardHeight = 100 * s;
    const spacing = 8 * s;
    const totalWidth = allFactions.length * cardWidth + (allFactions.length - 1) * spacing;
    
    // ✅ Позиция по вертикали - между игроками и кнопкой
    const yPosition = this.topInset + 400 * s;
    
    // ✅ Создаем контейнер для прокрутки
    this.factionScrollContainer = this.add.container(0, yPosition).setDepth(20);
    
    // Определяем, нужна ли прокрутка
    const needsScroll = totalWidth > width - 40 * s;
    const startX = needsScroll ? 20 * s + cardWidth / 2 : (width - totalWidth) / 2 + cardWidth / 2;
    
    allFactions.forEach((factionId, index) => {
      const x = startX + index * (cardWidth + spacing);
      
      // Проверяем, открыта ли фракция
      const units = data.ownedUnits[factionId];
      const isOwned = units && units.length > 0;
      
      const card = this.createFactionCard(x, 0, factionId, cardWidth, cardHeight, isOwned);
      this.factionScrollContainer!.add(card);
      this.factionCards.set(factionId, card);
    });
    
    // ✅ Если нужна прокрутка - добавляем интерактивность
    if (needsScroll) {
      this.setupFactionScroll(totalWidth, width);
    }
    
    // ✅ Добавляем индикатор прокрутки
    if (needsScroll) {
      this.createScrollIndicator(yPosition);
    }
  }
  
  private setupFactionScroll(totalWidth: number, screenWidth: number): void {
    const s = tgApp.getUIScale();
    let isDragging = false;
    let dragStartX = 0;
    let scrollStartX = 0;
    
    const maxScroll = 0;
    const minScroll = -(totalWidth - screenWidth + 40 * s);
    
    // Создаем невидимую область для перехвата событий
    const scrollArea = this.add.rectangle(
      screenWidth / 2, 
      this.factionScrollContainer!.y, 
      screenWidth, 
      120 * s, 
      0, 
      0
    ).setInteractive().setDepth(19);
    
    scrollArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      isDragging = true;
      dragStartX = pointer.x;
      scrollStartX = this.factionScrollContainer!.x;
    });
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (isDragging && this.factionScrollContainer) {
        const dx = pointer.x - dragStartX;
        let newX = scrollStartX + dx;
        
        // Ограничиваем прокрутку
        newX = Math.max(minScroll, Math.min(maxScroll, newX));
        this.factionScrollContainer.x = newX;
      }
    });
    
    this.input.on('pointerup', () => {
      isDragging = false;
    });
  }
  
  private createScrollIndicator(yPosition: number): void {
    const { width } = this.cameras.main;
    const s = tgApp.getUIScale();
    const fonts = getFonts();
    
    // Стрелки прокрутки (подсказка)
    const leftArrow = this.add.text(10 * s, yPosition, '◀', {
      fontSize: `${20 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff9d',
    }).setDepth(21).setAlpha(0.6);
    
    const rightArrow = this.add.text(width - 30 * s, yPosition, '▶', {
      fontSize: `${20 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff9d',
    }).setDepth(21).setAlpha(0.6);
    
    // Пульсация стрелок
    this.tweens.add({
      targets: [leftArrow, rightArrow],
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
  }

  private createFactionCard(
    x: number,
    y: number,
    factionId: FactionId,
    width: number,
    height: number,
    isOwned: boolean = true // Новый параметр
  ): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const colors = getColors();
    const s = tgApp.getUIScale();
    const faction = FACTIONS[factionId];
    
    const container = this.add.container(x, y).setDepth(20);
    
    // Фон карточки
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 0.95);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * s); // Уменьшили радиус
    bg.lineStyle(2 * s, faction.color, 0.5); // Тоньше обводка
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 12 * s);
    container.add(bg);
    
    // ✅ Бейдж иконки (без фоновых превью)
    const badgeKeys = [
      `ui_faction_${factionId}`,
      `ui_faction_${factionId}_badge`,
      `ui_faction_${factionId}_icon`,
      `icon_faction_badge_${factionId}`,
    ];

    let iconAdded = false;
    for (const key of badgeKeys) {
      if (this.textures.exists(key)) {
        const icon = this.add.image(0, -15 * s, key); // Подняли выше
        icon.setDisplaySize(45 * s, 45 * s); // Уменьшили иконку (было 50)
        icon.setOrigin(0.5);
        container.add(icon);
        iconAdded = true;
        break;
      }
    }

    if (!iconAdded) {
      console.warn(`[MatchPreparationScene] Missing faction badge for ${factionId}`);
      // Минималистичная заглушка
      const circle = this.add.circle(0, -15 * s, 22 * s, faction.color, 0.9);
      circle.setStrokeStyle(2 * s, 0xffffff, 0.8);
      container.add(circle);

      const letter = this.add.text(0, -15 * s, faction.name[0] || '?', {
        fontSize: `${18 * s}px`, // Уменьшили
        fontFamily: fonts.tech,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(letter);
    }
    
    // Название фракции
    const name = this.add.text(0, 28 * s, faction.name.toUpperCase(), {
      fontSize: `${9 * s}px`, // Еще меньше (было 10)
      fontFamily: fonts.tech,
      color: hexToString(faction.color),
      fontStyle: 'bold',
      letterSpacing: 0.2,
      wordWrap: { width: width - 6 * s },
    }).setOrigin(0.5);
    applyTextShadow(name, 'medium');
    container.add(name);
    
    // 🔒 БЛОКИРОВКА если фракция не открыта
    if (!isOwned) {
      // Затемнение
      const lockOverlay = this.add.graphics();
      lockOverlay.fillStyle(0x000000, 0.75);
      lockOverlay.fillRoundedRect(-width / 2, -height / 2, width, height, 12 * s);
      container.add(lockOverlay);
      
      // Иконка замка
      const lockIcon = this.add.text(0, -5 * s, '🔒', {
        fontSize: `${24 * s}px`, // Уменьшили
      }).setOrigin(0.5);
      container.add(lockIcon);
      
      // Текст "ЗАБЛОКИРОВАНО"
      const lockText = this.add.text(0, 15 * s, 'LOCKED', {
        fontSize: `${8 * s}px`, // Уменьшили
        fontFamily: fonts.tech,
        color: '#ff4444',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      applyTextShadow(lockText, 'strong');
      container.add(lockText);
      
      // Делаем контейнер полупрозрачным
      container.setAlpha(0.6);
    }
    
    // Интерактивность
    const hitArea = this.add.rectangle(0, 0, width, height, 0, 0)
      .setInteractive({ useHandCursor: isOwned }); // Курсор только для открытых
    container.add(hitArea);
    
    hitArea.on('pointerdown', () => {
      if (!this.playerReady && !this.playerSelectedFaction && isOwned) { // Проверка isOwned
        this.selectFaction(factionId);
      } else if (!isOwned) {
        // Звук ошибки при клике на закрытую фракцию
        AudioManager.getInstance().playSFX('sfx_ui_error');
        hapticImpact('light'); // Используем hapticImpact вместо hapticError
      }
    });
    
    // Hover эффект только для открытых
    hitArea.on('pointerover', () => {
      if (!this.playerReady && !this.playerSelectedFaction && this.opponentSelectedFaction !== factionId && isOwned) {
        this.tweens.add({
          targets: container,
          scaleX: 1.08,
          scaleY: 1.08,
          duration: 150,
        });
      }
    });
    
    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: container,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
      });
    });
    
    return container;
  }

  private selectFaction(factionId: FactionId): void {
    // ✅ Проверяем, не выбрал ли уже бот эту фракцию
    if (this.opponentSelectedFaction === factionId) {
      console.warn('[MatchPreparationScene] Cannot select faction already taken by opponent');
      AudioManager.getInstance().playSFX('sfx_ui_error');
      return;
    }
    
    AudioManager.getInstance().playSFX('sfx_ui_click');
    hapticSelection();
    
    this.playerSelectedFaction = factionId;
    
    // ✅ Обновляем статус
    if (this.playerStatusText) {
      this.playerStatusText.setText('LOCKED IN!').setColor('#00ff9d');
    }
    
    this.updateFactionCards();
    
    // ✅ ПОСЛЕ выбора игрока - бот выбирает из оставшихся фракций
    if (this.matchData.isAI && !this.opponentSelectedFaction) {
      if (this.opponentStatusText) {
        this.opponentStatusText.setText('THINKING...').setColor('#ffaa00');
      }
      this.startBotThinking();
    }
  }

  private updateFactionCards(): void {
    const s = tgApp.getUIScale();
    
    // ✅ Используем те же размеры, что и при создании карточек
    const cardWidth = 75 * s;
    const cardHeight = 100 * s;
    
    this.factionCards.forEach((card, factionId) => {
      // Карточка теперь в контейнере, получаем первый элемент (graphics)
      const bg = card.list[0] as Phaser.GameObjects.Graphics;
      const faction = FACTIONS[factionId];
      
      bg.clear();
      
      if (this.playerSelectedFaction === factionId) {
        // ✅ Выбрана игроком: яркая подсветка
        bg.fillStyle(faction.color, 0.4);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
        bg.lineStyle(3 * s, faction.color, 1);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
        // Glow
        bg.lineStyle(8 * s, faction.color, 0.4);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
      } else if (this.opponentSelectedFaction === factionId) {
        // ✅ Выбрана ботом: заблокирована
        bg.fillStyle(0xff6b6b, 0.3);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
        bg.lineStyle(3 * s, 0xff6b6b, 1);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
        
        // 🔒 LOCKED индикатор (внизу карточки)
        const absoluteX = this.factionScrollContainer!.x + card.x;
        const absoluteY = this.factionScrollContainer!.y + card.y;
        const lockIcon = this.add.text(absoluteX, absoluteY + cardHeight / 2 + 12 * s, '🔒', {
          fontSize: `${10 * s}px`,
          fontFamily: getFonts().tech,
          color: '#ff6b6b',
          fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(25);
      } else {
        // Обычная карточка
        bg.fillStyle(0x0a0a12, 0.95);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
        bg.lineStyle(2 * s, faction.color, 0.5);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
      }
    });
  }

  // ========== БОТ ВЫБИРАЕТ ФРАКЦИЮ ==========
  
  private startBotThinking(): void {
    // Бот "думает" 1-2 секунды
    const thinkTime = 1000 + Math.random() * 1000;
    
    this.botThinkingTimer = this.time.delayedCall(thinkTime, () => {
      this.botSelectFaction();
    });
  }

  private botSelectFaction(): void {
    // ✅ ИСПРАВЛЕНО: Для AI режима бот может выбрать любую фракцию, кроме выбранной игроком
    // Бот не ограничен открытыми у игрока фракциями - у AI могут быть все фракции
    const availableFactions = FACTION_IDS.filter(factionId => {
      return factionId !== this.playerSelectedFaction;
    });
    
    if (availableFactions.length === 0) {
      console.error('[MatchPreparationScene] No available factions for bot!');
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * availableFactions.length);
    this.opponentSelectedFaction = availableFactions[randomIndex];
    
    console.log(`[MatchPreparationScene] Bot selected: ${this.opponentSelectedFaction}`);
    
    AudioManager.getInstance().playSFX('sfx_ui_click');
    hapticSelection();
    
    // ✅ Обновляем статус противника
    if (this.opponentStatusText) {
      this.opponentStatusText.setText('LOCKED IN!').setColor('#ff6b6b');
    }
    
    this.updateFactionCards();
    
    // Бот готов через 0.5 сек
    this.time.delayedCall(500, () => {
      this.opponentReady = true;
      if (this.opponentStatusText) {
        this.opponentStatusText.setText('READY!').setColor('#00ff00');
      }
      
      // ✅ ДЛЯ AI РЕЖИМА (casual): Автоматически делаем игрока готовым, если он выбрал фракцию
      if (this.matchData.isAI && this.matchData.matchContext === 'casual' && this.playerSelectedFaction && !this.playerReady) {
        this.playerReady = true;
        if (this.playerStatusText) {
          this.playerStatusText.setText('READY!').setColor('#00ff00');
        }
        // Убираем кнопку READY
        if (this.readyButton) {
          this.readyButton.destroy();
        }
      }
      
      this.checkBothReady();
    });
  }

  // ========== КНОПКА READY ==========
  
  private createReadyButton(): void {
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    // ✅ Размещаем кнопку внизу экрана с комфортным отступом
    this.readyButton = new PremiumButton(this, {
      x: width / 2,
      y: height - this.bottomInset - 80 * s, // Ближе к низу экрана
      width: 260 * s, // Компактнее
      height: 55 * s, // Ниже
      text: 'ГОТОВ',
      fontSize: TYPOGRAPHY.sizes.lg * s,
      onClick: () => this.onReadyClick(),
    });
  }

  private onReadyClick(): void {
    if (!this.playerSelectedFaction) {
      this.showToast('Выберите фракцию!');
      AudioManager.getInstance().playSFX('sfx_ui_error');
      return;
    }
    
    AudioManager.getInstance().playSFX('sfx_ui_click');
    hapticImpact('medium');
    
    this.playerReady = true;
    
    // ✅ Обновляем статус
    if (this.playerStatusText) {
      this.playerStatusText.setText('READY!').setColor('#00ff00');
    }
    
    // Убираем кнопку
    if (this.readyButton) {
      this.readyButton.destroy();
    }
    
    this.checkBothReady();
  }

  private checkBothReady(): void {
    logInfo('MatchPrep', 'checkBothReady', {
      playerReady: this.playerReady,
      opponentReady: this.opponentReady,
      playerFaction: this.playerSelectedFaction,
      opponentFaction: this.opponentSelectedFaction
    });
    
    if (this.playerReady && this.opponentReady) {
      // Останавливаем таймер подготовки
      if (this.prepTimerEvent) {
        this.prepTimerEvent.destroy();
      }
      
      logInfo('MatchPrep', 'Both players ready, starting countdown');
      this.startCountdown();
    }
  }

  // ========== ТАЙМЕР ПОДГОТОВКИ ⏱️ ==========
  
  private startPrepTimer(): void {
    this.prepTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: 299,
      callback: () => {
        this.prepTimeRemaining--;
        this.updateTimerDisplay();
        
        // Если время вышло - автоматически выбираем случайную фракцию
        if (this.prepTimeRemaining <= 0) {
          this.handleTimeOut();
        }
      },
    });
  }

  private updateTimerDisplay(): void {
    if (!this.prepTimerText) return;
    
    const minutes = Math.floor(this.prepTimeRemaining / 60);
    const seconds = this.prepTimeRemaining % 60;
    const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    this.prepTimerText.setText(timeString);
    
    // Меняем цвет при малом времени
    if (this.prepTimeRemaining <= 30) {
      this.prepTimerText.setColor('#ff0066');
      // Мигание
      if (this.prepTimeRemaining % 2 === 0) {
        this.tweens.add({
          targets: this.prepTimerText,
          scale: 1.1,
          duration: 100,
          yoyo: true,
        });
      }
    } else if (this.prepTimeRemaining <= 60) {
      this.prepTimerText.setColor('#ffaa00');
    }
  }

  private handleTimeOut(): void {
    console.log('[MatchPreparationScene] Time out! Auto-selecting faction');
    
    // Автоматически выбираем случайную доступную фракцию
    if (!this.playerSelectedFaction) {
      const data = playerData.get();
      const ownedFactions = FACTION_IDS.filter(factionId => {
        const units = data.ownedUnits[factionId];
        return units && units.length > 0 && factionId !== this.opponentSelectedFaction;
      });
      
      if (ownedFactions.length > 0) {
        const randomFaction = ownedFactions[Math.floor(Math.random() * ownedFactions.length)];
        this.selectFaction(randomFaction);
      }
    }
    
    // Автоматически готовим
    if (!this.playerReady) {
      this.onReadyClick();
    }
  }

  // ========== ОБРАТНЫЙ ОТСЧЁТ ==========
  
  private startCountdown(): void {
    if (import.meta.env.DEV) {
      logInfo('MatchPrep', 'startCountdown called',{playerReady:this.playerReady,opponentReady:this.opponentReady,playerFaction:this.playerSelectedFaction,opponentFaction:this.opponentSelectedFaction});
    }
    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    const fonts = getFonts();
    
    // Затемнение
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setOrigin(0)
      .setDepth(200);
    
    // Текст отсчёта
    this.countdownText = this.add.text(width / 2, height / 2, `${this.countdown}`, {
      fontSize: `${150 * s}px`,
      fontFamily: fonts.tech,
      color: '#00ff9d',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(201);
    applyTextShadow(this.countdownText, 'strong');
    
    let count = 3;
    if (import.meta.env.DEV) {
      console.debug('[MatchPreparationScene] Creating countdown timer',{initialCount:count});
    }
    const timer = this.time.addEvent({
      delay: 1000,
      repeat: 2,
      callback: () => {
        count--;
        if (import.meta.env.DEV) {
          console.debug('[MatchPreparationScene] Countdown timer tick',{count:count});
        }
        if (count > 0) {
          this.countdownText!.setText(count.toString());
          this.tweens.add({
            targets: this.countdownText,
            scale: 1.2,
            duration: 100,
            yoyo: true,
          });
        } else {
          if (import.meta.env.DEV) {
            console.debug('[MatchPreparationScene] Countdown reached zero, scheduling launchMatch');
          }
          this.countdownText!.setText('ВПЕРЁД!').setColor('#ff0066');
          this.tweens.add({
            targets: this.countdownText,
            scale: 1.5,
            alpha: 0,
            duration: 500,
          });
          
          this.time.delayedCall(500, () => {
            if (import.meta.env.DEV) {
              console.debug('[MatchPreparationScene] delayedCall callback executing, calling launchMatch');
            }
            this.launchMatch();
          });
        }
      },
    });
  }

  private async launchMatch(): Promise<void> {
    if (import.meta.env.DEV) {
      logInfo('MatchPrep', 'launchMatch ENTRY',{playerFaction:this.playerSelectedFaction,opponentFaction:this.opponentSelectedFaction,matchContext:this.matchData.matchContext});
    }
    // ✅ ЗАЩИТА: Автоматический выбор фракций, если они не выбраны
    let finalPlayerFaction = this.playerSelectedFaction;
    let finalOpponentFaction = this.opponentSelectedFaction;
    
    // Если фракция игрока не выбрана, выбираем автоматически
    if (!finalPlayerFaction) {
      console.warn('[MatchPreparationScene] Player faction not selected, auto-selecting...');
      
      // Приоритет 1: Основная фракция игрока
      const mainFaction = playerData.getFaction();
      if (mainFaction) {
        finalPlayerFaction = mainFaction;
      } else {
        // Приоритет 2: Первая открытая фракция
        const data = playerData.get();
        const ownedFactions = FACTION_IDS.filter(factionId => {
          const units = data.ownedUnits[factionId];
          return units && units.length > 0;
        });
        
        if (ownedFactions.length > 0) {
          finalPlayerFaction = ownedFactions[0];
        } else {
          // Приоритет 3: Magma по умолчанию (базовая фракция)
          finalPlayerFaction = 'magma';
        }
      }
      
      console.log(`[MatchPreparationScene] Auto-selected player faction: ${finalPlayerFaction}`);
    }
    
    // Если фракция противника не выбрана, выбираем автоматически
    if (!finalOpponentFaction) {
      console.warn('[MatchPreparationScene] Opponent faction not selected, auto-selecting...');
      
      // ✅ ДЛЯ AI РЕЖИМА: Бот может выбрать любую фракцию, кроме выбранной игроком
      if (this.matchData.isAI) {
        const allOtherFactions = FACTION_IDS.filter(f => f !== finalPlayerFaction);
        if (allOtherFactions.length > 0) {
          finalOpponentFaction = allOtherFactions[Math.floor(Math.random() * allOtherFactions.length)];
        }
      } else {
        // Для PvP режима выбираем только из открытых фракций
        const data = playerData.get();
        const availableFactions = FACTION_IDS.filter(factionId => {
          const units = data.ownedUnits[factionId];
          const isOwned = units && units.length > 0;
          return isOwned && factionId !== finalPlayerFaction;
        });
        
        if (availableFactions.length > 0) {
          finalOpponentFaction = availableFactions[Math.floor(Math.random() * availableFactions.length)];
        } else {
          // Fallback: выбираем любую кроме фракции игрока
          const allOtherFactions = FACTION_IDS.filter(f => f !== finalPlayerFaction);
          finalOpponentFaction = allOtherFactions[Math.floor(Math.random() * allOtherFactions.length)];
        }
      }
      
      console.log(`[MatchPreparationScene] Auto-selected opponent faction: ${finalOpponentFaction}`);
    }
    
    // ✅ ОПТИМИЗАЦИЯ: Загружаем текстуры юнитов перед стартом матча
    try {
      // Показываем лоадер
      this.showToast('Подготовка бойцов...');
      
      // Получаем все юниты обеих фракций (репозиторий = карточки в UI),
      // плюс состав и владение — иначе каталожные стартовые фишки вне репозитория остаются без PNG.
      const playerUnits = getUnitsByFaction(finalPlayerFaction);
      const opponentUnits = getUnitsByFaction(finalOpponentFaction);
      
      const allUnitIds = [
        ...new Set([
          ...playerUnits.map(u => u.id),
          ...opponentUnits.map(u => u.id),
          ...playerData.getTeamUnits(finalPlayerFaction).filter(Boolean),
          ...playerData.getTeamUnits(finalOpponentFaction).filter(Boolean),
          ...playerData.getOwnedUnits(finalPlayerFaction).map(o => o.id),
          ...playerData.getOwnedUnits(finalOpponentFaction).map(o => o.id),
        ]),
      ];
      
      // Загружаем текстуры юнитов
      await AssetPackManager.loadUnitAssets(this, allUnitIds);
      
      if (import.meta.env.DEV) {
        console.log(`[MatchPreparationScene] Loaded ${allUnitIds.length} unit assets`);
      }
    } catch (error) {
      console.error('[MatchPreparationScene] Failed to load unit assets:', error);
      // Продолжаем даже если загрузка не удалась - будут использованы fallback текстуры
    }
    
    // ✅ NEW: Запускаем MatchVSScene вместо GameScene
    const gameSceneData = {
      matchContext: this.matchData.matchContext,
      isAI: this.matchData.isAI,
      aiDifficulty: this.matchData.aiDifficulty,
      playerFaction: finalPlayerFaction,
      opponentFaction: finalOpponentFaction,
      opponentName: this.matchData.opponentName,
      opponentAvatarId: this.matchData.opponentAvatarId,
      teamSize: this.matchData.teamSize,
      entryFee: this.matchData.entryFee,
      tournamentId: this.matchData.tournamentId,
      seriesId: this.matchData.seriesId,
      round: this.matchData.round,
      majorAbilityBonus: this.matchData.majorAbilityBonus,
      aimAssistDisabled: this.matchData.aimAssistDisabled,
    };
    
    if (import.meta.env.DEV) {
      logInfo('MatchPrep', 'Calling scene.start MatchVSScene',{finalPlayerFaction:finalPlayerFaction,finalOpponentFaction:finalOpponentFaction,matchContext:this.matchData.matchContext,isAI:this.matchData.isAI,teamSize:this.matchData.teamSize});
    }
    
    this.scene.start('MatchVSScene', {
      matchContext: this.matchData.matchContext,
      playerFaction: finalPlayerFaction,
      opponentFaction: finalOpponentFaction,
      opponentName: this.matchData.opponentName,
      opponentAvatarId: this.matchData.opponentAvatarId,
      isAI: this.matchData.isAI,
      aiDifficulty: this.matchData.aiDifficulty,
      gameSceneData: gameSceneData,
    });
    if (import.meta.env.DEV) {
      console.debug('[MatchPreparationScene] scene.start called successfully');
    }
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
    }).setOrigin(0.5).setDepth(300);
    
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: height - 250 * s,
      duration: 2000,
      onComplete: () => toast.destroy(),
    });
  }

  /**
   * Получить рандомную аватарку для бота
   */
  private getRandomBotAvatar(): string {
    const botAvatars = [
      'avatar_recruit',
      'avatar_explorer',
      'avatar_magma_warrior',
      'avatar_cyborg_elite',
      'avatar_void_mystic',
      'avatar_insect_hive',
    ];
    return botAvatars[Math.floor(Math.random() * botAvatars.length)];
  }
}
