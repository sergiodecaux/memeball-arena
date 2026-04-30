// src/scenes/TournamentBracketScene.ts
// Сцена сетки турнира (Bracket)

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact } from '../utils/Haptics';
import { SWIPE_NAVIGATION } from '../constants/gameConstants';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { TournamentRuntimeState, MatchSeriesState, ParticipantId, BracketStage, TOURNAMENT_TEAM_SIZE, TOURNAMENT_MATCH_DURATION } from '../types/tournament';
import { TournamentManager } from '../managers/TournamentManager';
import { 
  TOURNAMENT_BACKGROUND_KEYS,
  TOURNAMENT_BRACKET_KEYS,
  TOURNAMENT_CUP_KEYS,
} from '../config/assetKeys';
import { Button } from '../ui/Button';
import { safeSceneStart } from '../utils/SceneHelpers';

export class TournamentBracketScene extends Phaser.Scene {
  private tournament?: TournamentRuntimeState;
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  
  // ✅ Horizontal Scroll support
  private scrollX = 0;
  private scrollVelocity = 0;
  private maxScrollX = 0;
  private isDragging = false;
  private lastPointerX = 0;
  
  private contentContainer?: Phaser.GameObjects.Container;
  
  // Swipe Navigation
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isSwipeActive: boolean = false;
  private swipeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private swipeArrow?: Phaser.GameObjects.Container;
  private swipeManager?: SwipeNavigationManager;

  constructor() {
    super({ key: 'TournamentBracketScene' });
  }

  async create(data?: { tournament: TournamentRuntimeState }): Promise<void> {
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 90 + this.topInset;

    // Пытаемся загрузить турнир из данных или из сохранения
    if (data?.tournament) {
      this.tournament = data.tournament;
    } else {
      const savedTournament = playerData.get().activeTournament;
      if (savedTournament) {
        this.tournament = savedTournament;
      } else {
        console.error('[TournamentBracketScene] No tournament data found');
        await safeSceneStart(this, 'TournamentScene');
        return;
      }
    }

    AudioManager.getInstance().init(this);

    this.createBackground();
    this.createHeader();
    this.createFullBracket();
    this.setupScrolling();
    this.createSwipeIndicator();
    this.setupSwipeNavigation();
  }
  
  update(): void {
    // ✅ Горизонтальная инерция с плавным затуханием
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.05) {
      this.scrollX = Phaser.Math.Clamp(this.scrollX - this.scrollVelocity, 0, this.maxScrollX);
      this.scrollVelocity *= 0.92; // Плавное затухание
      this.updateContentPosition();
    } else if (!this.isDragging) {
      this.scrollVelocity = 0; // Полная остановка
    }
  }
  
  private setupScrolling(): void {
    const { height } = this.cameras.main;
    let lastTime = 0;
    
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > this.headerHeight && pointer.y < height - this.bottomInset) {
        this.isDragging = true;
        this.lastPointerX = pointer.x; // ✅ Горизонтальный скролл
        lastTime = Date.now();
        this.scrollVelocity = 0;
      }
    });
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && pointer.isDown) {
        const currentTime = Date.now();
        const deltaTime = Math.max(currentTime - lastTime, 1);
        const deltaX = pointer.x - this.lastPointerX; // ✅ Горизонтальный скролл
        
        // ✅ Плавное обновление позиции
        this.scrollX = Phaser.Math.Clamp(this.scrollX - deltaX, 0, this.maxScrollX);
        
        // ✅ Вычисляем скорость с учётом времени
        this.scrollVelocity = deltaX / deltaTime * 16; // Нормализуем к 60 FPS
        
        this.lastPointerX = pointer.x;
        lastTime = currentTime;
        this.updateContentPosition();
      }
    });
    
    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
  
  private updateContentPosition(): void {
    if (this.contentContainer) {
      this.contentContainer.x = -this.scrollX; // ✅ Горизонтальный скролл
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    if (!this.tournament) return;

    // Фон по типу турнира
    const bgKey = TOURNAMENT_BACKGROUND_KEYS[this.tournament.tier.toUpperCase() as keyof typeof TOURNAMENT_BACKGROUND_KEYS];
    if (this.textures.exists(bgKey)) {
      const bg = this.add.image(width / 2, height / 2, bgKey);
      bg.setDisplaySize(width, height);
      bg.setDepth(0);
    } else {
      // Fallback
      this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a12).setDepth(0);
    }
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();

    if (!this.tournament) return;

    // ✅ Увеличиваем высоту хедера под кнопки Telegram
    const safeHeaderHeight = this.topInset + 90 * s;

    // Header background
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.9);
    headerBg.fillRect(0, 0, width, safeHeaderHeight);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, safeHeaderHeight, width, safeHeaderHeight);
    headerBg.setDepth(100);

    // Title (название турнира остаётся на английском)
    const tierNames: Record<string, string> = {
      rookie: 'ROOKIE DRAFT',
      minor: 'MINOR CUP',
      major: 'MAJOR CUP',
      apex: 'GALACTIC APEX',
    };

    const titleY = this.topInset + 40 * s;
    const title = this.add.text(width / 2, titleY, tierNames[this.tournament.tier], {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);
    applyTextShadow(title, 'medium');

    // Текущий раунд (на русском)
    const roundNames: Record<string, string> = {
      '16': 'Раунд 1/8',
      '8': 'Четвертьфинал',
      '4': 'Полуфинал',
      '2': 'Финал',
      '1': 'Победитель',
    };
    
    const roundText = this.add.text(width / 2, titleY + 35 * s, roundNames[this.tournament.currentRound] || `Раунд ${this.tournament.currentRound}`, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5).setDepth(101);
    
    // ✅ Кнопка "Назад" (явная, для надежности)
    const backBtn = this.add.text(30 * s, titleY, '← НАЗАД', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => {
      this.handleBack();
    });
  }

  /**
   * ✅ Создаёт горизонтальную турнирную сетку (как в Лиге Чемпионов)
   */
  private createFullBracket(): void {
    if (!this.tournament) return;

    const { width, height } = this.cameras.main;
    const s = tgApp.getUIScale();
    
    this.contentContainer = this.add.container(0, this.headerHeight).setDepth(10);
    
    // Create a graphics layer for connecting lines (Behinds cards)
    const connectionsLayer = this.add.graphics();
    this.contentContainer.add(connectionsLayer);

    const rounds: BracketStage[] = ['16', '8', '4', '2', '1'];
    const roundNames: Record<BracketStage, string> = {
      '16': 'ROUND OF 16',
      '8': 'QUARTER FINAL',
      '4': 'SEMI FINAL',
      '2': 'FINAL',
      '1': 'CHAMPION',
    };
    
    const roundWidth = 300 * s;
    const roundSpacing = 80 * s; // More space for lines
    const cardHeight = 80 * s;
    const cardSpacing = 20 * s;
    const startX = 40 * s;
    const headerOffset = 40 * s;
    
    let currentX = startX;
    
    // Store match positions to draw lines later
    const matchPositions: Map<string, {x: number, y: number}> = new Map();

    rounds.forEach((round, roundIndex) => {
      const matches = this.tournament!.matches.filter(m => m.round === round);
      if (matches.length === 0) return;
      
      const roundContainer = this.add.container(currentX, 0);
      this.contentContainer!.add(roundContainer);
      
      // ROUND HEADER (Neon Style)
      const headerText = this.add.text(roundWidth / 2, 0, roundNames[round], {
        fontSize: `${12 * s}px`,
        fontFamily: getFonts().tech,
        color: round === this.tournament!.currentRound ? '#00f2ff' : '#64748b',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      roundContainer.add(headerText);
      
      // Calculate Y positions to center the block
      const availableHeight = height - this.headerHeight - this.bottomInset - headerOffset;
      // In brackets, matches are usually centered relative to their parents in previous round
      // But for simple rendering, let's just center the block vertically for now
      const totalMatchesHeight = matches.length * cardHeight + (matches.length - 1) * cardSpacing;
      let matchY = Math.max(headerOffset, (availableHeight - totalMatchesHeight) / 2 + headerOffset);
      
      matches.forEach((match) => {
        // Create Card
        this.createHorizontalMatchCard(roundWidth / 2, matchY, match, roundWidth - 20 * s, cardHeight);
        
        // Store position (absolute relative to contentContainer)
        // match.id is usually composite, make sure it's unique
        matchPositions.set(match.id, { x: currentX + roundWidth / 2, y: matchY });

        // DRAW CONNECTIONS TO PREVIOUS ROUND
        // Logic: Find the two matches in previous round that fed into this one
        // (This logic implies we know parent/child relation. If not easily available, we skip lines for now
        // or just draw simple horizontal connectors).
        // Let's draw a simple horizontal line to the left to indicate flow
        if (roundIndex > 0) {
            // Circuit board style: square angles, not diagonal
            const lineColor = round === this.tournament!.currentRound ? 0x00f2ff : 0x334155;
            const lineAlpha = round === this.tournament!.currentRound ? 0.8 : 0.4;
            
            connectionsLayer.lineStyle(2, lineColor, lineAlpha);
            connectionsLayer.beginPath();
            connectionsLayer.moveTo(currentX, matchY); // Left edge of this column
            connectionsLayer.lineTo(currentX - roundSpacing, matchY); // Left towards previous
            connectionsLayer.strokePath();
            
            // Add glow effect for current round
            if (round === this.tournament!.currentRound) {
                connectionsLayer.lineStyle(4, lineColor, 0.2);
                connectionsLayer.beginPath();
                connectionsLayer.moveTo(currentX, matchY);
                connectionsLayer.lineTo(currentX - roundSpacing, matchY);
                connectionsLayer.strokePath();
            }
        }

        matchY += cardHeight + cardSpacing;
      });
      
      currentX += roundWidth + roundSpacing;
    });
    
    // Trophy
    this.createTrophyAtEnd(currentX, height / 2 - this.headerHeight / 2);
    currentX += 200 * s;
    
    // ========== ПУСТЫЕ СЛОТЫ ДЛЯ БУДУЩИХ МАТЧЕЙ БОТОВ ==========
    currentX = this.createEmptyBracketSlots(currentX, height / 2 - this.headerHeight / 2, roundWidth, cardHeight, cardSpacing, roundSpacing);
    
    // Scroll Setup
    this.maxScrollX = Math.max(0, currentX - width + 150 * s);
    
    // Симулируем бот-матчи
    const playerId = playerData.get().id;
    const playerMatch = this.tournament.matches.find(
      m => m.round === this.tournament!.currentRound && 
           (m.playerA === playerId || m.playerB === playerId)
    );

    if (playerMatch) {
      this.tournament = TournamentManager.simulateBotMatchesInCurrentRound(this.tournament, playerId);
    }
  }
  
  /**
   * ✅ Улучшенная карточка матча для турнирной сетки
   */
  private createHorizontalMatchCard(
    x: number,
    y: number,
    match: MatchSeriesState,
    cardWidth: number,
    cardHeight: number
  ): void {
    if (!this.tournament || !this.contentContainer) return;

    const fonts = getFonts();
    const colors = getColors();
    const s = tgApp.getUIScale();
    const playerId = playerData.get().id;
    const isPlayerMatch = match.playerA === playerId || match.playerB === playerId;
    
    const container = this.add.container(x, y).setDepth(11);
    this.contentContainer.add(container);

    // === HOLOGRAPHIC BG ===
    const bg = this.add.graphics();
    const bgColor = isPlayerMatch ? 0x0c4a6e : 0x0f172a; // Cyan tint for player
    const borderColor = isPlayerMatch ? 0x00f2ff : 0x334155;
    
    bg.fillStyle(bgColor, 0.9);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 4 * s); // Sharp corners for tech look
    
    // Tech Border
    bg.lineStyle(isPlayerMatch ? 2 : 1, borderColor, 1);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 4 * s);
    
    // Glow if Active
    if (isPlayerMatch && !match.finished) {
        bg.setAlpha(1); // Ensure visible
        // Pulse tween on container
        this.tweens.add({
            targets: container,
            scale: { from: 1, to: 1.02 },
            duration: 800,
            yoyo: true,
            repeat: -1
        });
        
        // Add glow sprite
        if (this.textures.exists('flare_white')) {
            const glow = this.add.image(0, 0, 'flare_white');
            glow.setTint(0x00f2ff);
            glow.setAlpha(0.2);
            glow.setDisplaySize(cardWidth, cardHeight);
            container.add(glow);
        }
    }
    
    container.add(bg);

    // === PLAYERS (Simplified Layout) ===
    const pA = TournamentManager.getParticipant(this.tournament, match.playerA);
    const pB = TournamentManager.getParticipant(this.tournament, match.playerB);
    
    if(!pA || !pB) return;

    // Row A
    const yA = -15 * s;
    const yB = 15 * s;
    
    // Names
    const nameStyle = { fontSize: `${12 * s}px`, fontFamily: fonts.tech, color: '#e2e8f0' };
    const winStyle = { ...nameStyle, color: '#00ff00', fontStyle: 'bold' };
    const loseStyle = { ...nameStyle, color: '#64748b' };
    
    const styleA = match.finished ? (match.winnerId === pA.id ? winStyle : loseStyle) : nameStyle;
    const styleB = match.finished ? (match.winnerId === pB.id ? winStyle : loseStyle) : nameStyle;

    container.add(this.add.text(-cardWidth/2 + 10*s, yA, pA.name, styleA).setOrigin(0, 0.5));
    container.add(this.add.text(-cardWidth/2 + 10*s, yB, pB.name, styleB).setOrigin(0, 0.5));

    // Scores
    container.add(this.add.text(cardWidth/2 - 20*s, yA, `${match.winsA}`, styleA).setOrigin(1, 0.5));
    container.add(this.add.text(cardWidth/2 - 20*s, yB, `${match.winsB}`, styleB).setOrigin(1, 0.5));
    
    // Play Button (Overlay)
    if (!match.finished && isPlayerMatch) {
        const btn = this.add.container(cardWidth/2 - 40*s, 0);
        const btnBg = this.add.graphics();
        btnBg.fillStyle(0x00f2ff, 1);
        btnBg.fillRoundedRect(-30*s, -12*s, 60*s, 24*s, 4*s);
        btn.add(btnBg);
        
        btn.add(this.add.text(0, 0, 'PLAY', {
            fontSize: `${10*s}px`, fontFamily: fonts.tech, color: '#000', fontStyle: 'bold'
        }).setOrigin(0.5));
        
        btn.setInteractive({ useHandCursor: true })
           .on('pointerdown', () => {
               AudioManager.getInstance().playSFX('sfx_ui_click');
               hapticImpact('medium');
               this.startMatch(match);
           });
           
        container.add(btn);
    }
  }

  /**
   * ✅ Создаёт кубок в конце горизонтальной сетки
   */
  private createTrophyAtEnd(x: number, y: number): void {
    const s = tgApp.getUIScale();
    const colors = getColors();
    const fonts = getFonts();
    
    if (!this.tournament || !this.contentContainer) return;
    
    const container = this.add.container(x, y);
    this.contentContainer.add(container);
    
    // Кубок (PNG или эмодзи)
    const cupKey = TOURNAMENT_CUP_KEYS[this.tournament.tier.toUpperCase() as keyof typeof TOURNAMENT_CUP_KEYS];
    if (this.textures.exists(cupKey)) {
      const cup = this.add.image(0, 0, cupKey);
      cup.setDisplaySize(120 * s, 120 * s);
      cup.setOrigin(0.5);
      container.add(cup);
    } else {
      const tierEmojis: Record<string, string> = {
        rookie: '🥉',
        minor: '🥈',
        major: '🥇',
        apex: '🏆',
      };
      const trophy = this.add.text(0, 0, tierEmojis[this.tournament.tier] || '🏆', {
        fontSize: `${100 * s}px`,
      }).setOrigin(0.5);
      container.add(trophy);
    }
    
    // Название турнира
    const tierNames: Record<string, string> = {
      rookie: 'ROOKIE DRAFT',
      minor: 'MINOR CUP',
      major: 'MAJOR CUP',
      apex: 'GALACTIC APEX',
    };
    
    const title = this.add.text(0, 80 * s, tierNames[this.tournament.tier], {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'strong');
    container.add(title);
  }

  /**
   * Создаёт заголовок раунда
   */
  private createRoundHeader(x: number, y: number, text: string, isCurrent: boolean): number {
    const s = tgApp.getUIScale();
    const colors = getColors();
    const fonts = getFonts();
    
    if (!this.contentContainer) return 0;
    
    const container = this.add.container(x, y);
    this.contentContainer.add(container);
    
    // Фон заголовка
    const bg = this.add.graphics();
    if (isCurrent) {
      bg.fillStyle(colors.uiAccent, 0.2);
    } else {
      bg.fillStyle(0x1a1a2e, 0.5);
    }
    bg.fillRoundedRect(-150 * s, -15 * s, 300 * s, 30 * s, 8 * s);
    
    if (isCurrent) {
      bg.lineStyle(2 * s, colors.uiAccent, 0.8);
      bg.strokeRoundedRect(-150 * s, -15 * s, 300 * s, 30 * s, 8 * s);
    }
    
    container.add(bg);
    
    // Текст
    const headerText = this.add.text(0, 0, text, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: isCurrent ? hexToString(colors.uiAccent) : '#888888',
      fontStyle: isCurrent ? 'bold' : 'normal',
    }).setOrigin(0.5);
    container.add(headerText);
    
    if (isCurrent) {
      const currentBadge = this.add.text(-160 * s, 0, '▶', {
        fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
        color: hexToString(colors.uiAccent),
      }).setOrigin(0.5);
      container.add(currentBadge);
    }
    
    return 40 * s;
  }

  /**
   * ✅ Создаёт КОМПАКТНУЮ карточку матча для полной сетки
   */
  private createCompactMatchCard(
    x: number,
    y: number,
    match: MatchSeriesState,
    cardWidth: number,
    cardHeight: number
  ): void {
    if (!this.tournament || !this.contentContainer) return;

    const fonts = getFonts();
    const colors = getColors();
    const s = tgApp.getUIScale();
    const playerId = playerData.get().id;
    const isPlayerMatch = match.playerA === playerId || match.playerB === playerId;
    
    const container = this.add.container(x, y).setDepth(11);
    this.contentContainer.add(container);

    // Участники
    const participantA = TournamentManager.getParticipant(this.tournament, match.playerA);
    const participantB = TournamentManager.getParticipant(this.tournament, match.playerB);
    
    if (!participantA || !participantB) return;

    // ========== ФОН ==========
    const bg = this.add.graphics();
    
    if (match.finished) {
      bg.fillStyle(0x1a4d2e, 0.8);
    } else if (isPlayerMatch) {
      bg.fillStyle(0x1a2a4d, 0.8);
    } else {
      bg.fillStyle(0x1a1a2e, 0.8);
    }
    
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10 * s);
    
    const borderColor = match.finished ? 0x4ade80 : (isPlayerMatch ? colors.uiAccent : 0x333344);
    bg.lineStyle(2 * s, borderColor, 0.7);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10 * s);
    
    container.add(bg);

    // ========== ИГРОК A ==========
    const nameAColor = (match.finished && match.winnerId === participantA.id) ? '#4ade80' : '#ffffff';
    const nameA = this.add.text(-cardWidth / 2 + 15 * s, -15 * s, participantA.name, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: nameAColor,
      fontStyle: (match.winnerId === participantA.id) ? 'bold' : 'normal',
    }).setOrigin(0, 0.5);
    container.add(nameA);
    
    const scoreA = this.add.text(cardWidth / 2 - 40 * s, -15 * s, `${match.winsA}`, {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.tech,
      color: (match.winnerId === participantA.id) ? '#ffd700' : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(scoreA);

    // ========== VS ==========
    const vs = this.add.text(0, 0, '-', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: '#666666',
    }).setOrigin(0.5);
    container.add(vs);

    // ========== ИГРОК B ==========
    const nameBColor = (match.finished && match.winnerId === participantB.id) ? '#4ade80' : '#ffffff';
    const nameB = this.add.text(-cardWidth / 2 + 15 * s, 15 * s, participantB.name, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: nameBColor,
      fontStyle: (match.winnerId === participantB.id) ? 'bold' : 'normal',
    }).setOrigin(0, 0.5);
    container.add(nameB);
    
    const scoreB = this.add.text(cardWidth / 2 - 40 * s, 15 * s, `${match.winsB}`, {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.tech,
      color: (match.winnerId === participantB.id) ? '#ffd700' : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(scoreB);

    // ========== КНОПКА PLAY ==========
    if (isPlayerMatch && !match.finished) {
      const playBtn = this.add.text(cardWidth / 2 - 15 * s, 0, '▶', {
        fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
        color: hexToString(colors.uiAccent),
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      playBtn.on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        hapticImpact('medium');
        this.startMatch(match);
      });
      
      container.add(playBtn);
    }
  }
  
  /**
   * @deprecated Используется для больших карточек (старый дизайн)
   */
  private createModernMatchSlot(
    x: number, 
    y: number, 
    match: MatchSeriesState, 
    cardWidth: number, 
    cardHeight: number
  ): void {
    if (!this.tournament || !this.contentContainer) return;

    const fonts = getFonts();
    const colors = getColors();
    const s = tgApp.getUIScale();
    const playerId = playerData.get().id;
    const isPlayerMatch = match.playerA === playerId || match.playerB === playerId;
    
    const container = this.add.container(x, y).setDepth(11);
    this.contentContainer.add(container);

    // Участники
    const participantA = TournamentManager.getParticipant(this.tournament, match.playerA);
    const participantB = TournamentManager.getParticipant(this.tournament, match.playerB);
    
    if (!participantA || !participantB) return;

    // ========== ФОН КАРТОЧКИ ==========
    const bg = this.add.graphics();
    
    // Градиентный фон в зависимости от состояния
    if (match.finished) {
      // Матч завершён - градиент от зеленого
      bg.fillGradientStyle(0x1a4d2e, 0x1a4d2e, 0x0d261f, 0x0d261f, 0.95);
    } else if (isPlayerMatch) {
      // Матч игрока - градиент от синего
      bg.fillGradientStyle(0x1a2a4d, 0x1a2a4d, 0x0d1626, 0x0d1626, 0.95);
    } else {
      // Обычный матч - нейтральный градиент
      bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0d0d16, 0x0d0d16, 0.95);
    }
    
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
    
    // Обводка
    const borderColor = match.finished ? 0x4ade80 : (isPlayerMatch ? colors.uiAccent : 0x444466);
    bg.lineStyle(2 * s, borderColor, match.finished ? 1.0 : 0.6);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12 * s);
    
    container.add(bg);

    // ========== ИГРОК A (СЛЕВА) ==========
    const playerAContainer = this.add.container(-cardWidth / 4, 0);
    container.add(playerAContainer);
    
    // Имя игрока A
    const nameAColor = (match.finished && match.winnerId === participantA.id) ? '#4ade80' : '#ffffff';
    const nameA = this.add.text(0, -25 * s, participantA.name, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: nameAColor,
      fontStyle: (match.winnerId === participantA.id) ? 'bold' : 'normal',
    }).setOrigin(0.5, 0.5);
    applyTextShadow(nameA, 'medium');
    playerAContainer.add(nameA);
    
    // Счёт A
    const scoreA = this.add.text(0, 10 * s, `${match.winsA}`, {
      fontSize: `${TYPOGRAPHY.sizes.xxl * s}px`,
      fontFamily: fonts.tech,
      color: (match.winnerId === participantA.id) ? '#ffd700' : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    applyTextShadow(scoreA, 'strong');
    playerAContainer.add(scoreA);

    // ========== VS DIVIDER ==========
    const divider = this.add.graphics();
    divider.lineStyle(2 * s, 0x444466, 0.5);
    divider.lineBetween(0, -cardHeight / 2 + 15 * s, 0, cardHeight / 2 - 15 * s);
    container.add(divider);
    
    const vsText = this.add.text(0, -35 * s, 'VS', {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccentPink),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    applyTextShadow(vsText, 'medium');
    container.add(vsText);

    // ========== ИГРОК B (СПРАВА) ==========
    const playerBContainer = this.add.container(cardWidth / 4, 0);
    container.add(playerBContainer);
    
    // Имя игрока B
    const nameBColor = (match.finished && match.winnerId === participantB.id) ? '#4ade80' : '#ffffff';
    const nameB = this.add.text(0, -25 * s, participantB.name, {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.tech,
      color: nameBColor,
      fontStyle: (match.winnerId === participantB.id) ? 'bold' : 'normal',
    }).setOrigin(0.5, 0.5);
    applyTextShadow(nameB, 'medium');
    playerBContainer.add(nameB);
    
    // Счёт B
    const scoreB = this.add.text(0, 10 * s, `${match.winsB}`, {
      fontSize: `${TYPOGRAPHY.sizes.xxl * s}px`,
      fontFamily: fonts.tech,
      color: (match.winnerId === participantB.id) ? '#ffd700' : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    applyTextShadow(scoreB, 'strong');
    playerBContainer.add(scoreB);

    // ========== КНОПКА PLAY ==========
    if (isPlayerMatch && !match.finished) {
      // Индикатор серии (BO3)
      const seriesText = this.add.text(0, 35 * s, `Best of 3 • First to 2 wins`, {
        fontSize: `${TYPOGRAPHY.sizes.xs * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiAccentPink),
      }).setOrigin(0.5, 0.5);
      container.add(seriesText);
      
      const playButton = new Button(this, {
        x: x,
        y: y + cardHeight / 2 + 35 * s,
        width: 180 * s,
        height: 50 * s,
        text: 'PLAY MATCH',
        fontSize: TYPOGRAPHY.sizes.md * s,
        onClick: () => {
          AudioManager.getInstance().playUIClick();
          hapticImpact('medium');
          this.startMatch(match);
        },
      });
    } else if (match.finished) {
      // Индикатор завершённого матча
      const finishedText = this.add.text(0, 35 * s, `✓ Match Complete`, {
        fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
        fontFamily: fonts.tech,
        color: '#4ade80',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      applyTextShadow(finishedText, 'medium');
      container.add(finishedText);
    }
  }

  /**
   * @deprecated Используется старый дизайн (оставлен для совместимости)
   */
  private createMatchSlot(
    x: number, 
    y: number, 
    match: MatchSeriesState, 
    width: number, 
    height: number
  ): void {
    // Старый метод удалён, использует createModernMatchSlot
  }

  private async startMatch(match: MatchSeriesState): Promise<void> {
    if (!this.tournament) return;

    const playerId = playerData.get().id;
    const isPlayerA = match.playerA === playerId;
    const opponentId = isPlayerA ? match.playerB : match.playerA;
    const opponent = TournamentManager.getParticipant(this.tournament, opponentId);

    if (!opponent) {
      console.error('[TournamentBracketScene] Opponent not found');
      return;
    }

    // Определяем модификаторы для турнира
    const tier = this.tournament.tier;
    const majorAbilityBonus = tier === 'major';
    const aimAssistDisabled = tier === 'apex';
    const teamSize = TOURNAMENT_TEAM_SIZE[tier]; // 🎮 Размер команды

    // ✅ Запускаем экран подготовки к матчу (выбор фракции)
    await safeSceneStart(this, 'MatchPreparationScene', {
      matchContext: 'tournament',
      isAI: true, // ✅ КРИТИЧНО: Указываем что это матч против ИИ
      opponentName: opponent.name,
      aiDifficulty: opponent.difficulty || 0.5,
      tournamentId: this.tournament.id,
      seriesId: match.id,
      round: match.round,
      majorAbilityBonus,
      aimAssistDisabled,
      teamSize: teamSize, // 🎮 Передаем размер команды
      matchDuration: TOURNAMENT_MATCH_DURATION[tier],
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

        // ✅ Проверяем что не скроллим сетку (горизонтальный скролл)
        const isScrolling = Math.abs(this.scrollVelocity) > 0.5 || this.isDragging;

        if (dx > 20 && dy < 50 && time < 300 && !this.isSwipeActive && !isScrolling) {
          this.isSwipeActive = true;
          this.showSwipeFeedback();
        }
        
        // ✅ Отменяем свайп если начали скроллить
        if (isScrolling && this.isSwipeActive) {
          this.hideSwipeFeedback();
          this.isSwipeActive = false;
        }
      }
    });

    hitArea.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.isSwipeActive) {
        const dx = pointer.x - this.swipeStartX;
        // ✅ Только если НЕ скроллили (scrollX близок к 0)
        if (dx > 100 && Math.abs(this.scrollX) < 20) {
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

  /**
   * ✅ Создаёт ПУСТЫЕ СЛОТЫ для будущих матчей ботов справа от кубка
   * Показывает как турнир будет развиваться дальше
   */
  private createEmptyBracketSlots(
    startX: number,
    centerY: number,
    roundWidth: number,
    cardHeight: number,
    cardSpacing: number,
    roundSpacing: number
  ): number {
    if (!this.tournament || !this.contentContainer) return startX;

    const s = tgApp.getUIScale();
    const colors = getColors();
    const fonts = getFonts();
    const cardWidth = roundWidth - 40 * s;

    // Определяем сколько будущих раундов показать
    const currentRoundIndex = this.getRoundIndex(this.tournament.currentRound);
    const futureRoundsToShow = Math.min(2, currentRoundIndex); // Показываем максимум 2 будущих раунда

    if (futureRoundsToShow === 0) return startX; // Если это уже финал, не показываем пустые слоты

    let currentX = startX;

    // Создаем пустые слоты для будущих раундов
    for (let roundOffset = 1; roundOffset <= futureRoundsToShow; roundOffset++) {
      const futureRoundIndex = currentRoundIndex - roundOffset;
      if (futureRoundIndex < 0) break;

      const futureRound = this.getStageFromIndex(futureRoundIndex);
      const matchCount = parseInt(futureRound) / 2; // Количество матчей в раунде

      const roundContainer = this.add.container(currentX, 0);
      this.contentContainer.add(roundContainer);

      // Заголовок раунда
      const roundNames: Record<BracketStage, string> = {
        '16': 'Раунд 1/8',
        '8': 'Четвертьфинал',
        '4': 'Полуфинал',
        '2': 'Финал',
        '1': 'Победитель',
      };

      const roundHeader = this.add.text(roundWidth / 2, 20 * s, roundNames[futureRound] || `Раунд ${futureRound}`, {
        fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(colors.uiTextSecondary),
        fontStyle: 'normal',
      }).setOrigin(0.5);
      applyTextShadow(roundHeader, 'subtle');
      roundContainer.add(roundHeader);

      // Создаем пустые карточки матчей
      const totalHeight = matchCount * cardHeight + (matchCount - 1) * cardSpacing;
      let matchY = centerY - totalHeight / 2 + cardHeight / 2 + 80 * s;

      for (let i = 0; i < matchCount; i++) {
        const emptyCard = this.add.container(roundWidth / 2, matchY);
        roundContainer.add(emptyCard);

        // Фон карточки (полупрозрачный)
        const bg = this.add.graphics();
        bg.fillStyle(0x0a0a12, 0.3);
        bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 8 * s);
        bg.lineStyle(1 * s, 0x333344, 0.3);
        bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 8 * s);
        emptyCard.add(bg);

        // Текст "WAITING..."
        const waitingText = this.add.text(0, 0, 'WAITING...', {
          fontSize: `${TYPOGRAPHY.sizes.xs * s}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiTextSecondary),
          fontStyle: 'italic',
        }).setOrigin(0.5);
        emptyCard.add(waitingText);

        // Иконка "часы" или "таймер"
        const clockIcon = this.add.text(0, -20 * s, '⏳', {
          fontSize: `${20 * s}px`,
        }).setOrigin(0.5);
        emptyCard.add(clockIcon);

        // Анимация мигания для эффекта "ожидания"
        this.tweens.add({
          targets: [waitingText, clockIcon],
          alpha: { from: 0.3, to: 0.7 },
          duration: 2000,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        matchY += cardHeight + cardSpacing;
      }

      currentX += roundWidth + roundSpacing;
    }

    return currentX;
  }

  /**
   * Возвращает индекс раунда (0 = финал, 1 = полуфинал, и т.д.)
   */
  private getRoundIndex(round: BracketStage): number {
    const rounds: BracketStage[] = ['1', '2', '4', '8', '16'];
    return rounds.indexOf(round);
  }

  /**
   * Возвращает BracketStage по индексу
   */
  private getStageFromIndex(index: number): BracketStage {
    const stages: BracketStage[] = ['1', '2', '4', '8', '16'];
    return stages[index] || '1';
  }

  private async handleBack(): Promise<void> {
    AudioManager.getInstance().playUIClick();
    hapticImpact('light');
    
    // ✅ Проверяем, сыграл ли игрок хотя бы один матч
    if (this.tournament) {
      const playerId = playerData.get().id;
      const playerMatches = this.tournament.matches.filter(
        m => (m.playerA === playerId || m.playerB === playerId) && m.matchesPlayed > 0
      );
      
      // ✅ Если не сыграл ни одного матча - возвращаем ключи/билет
      if (playerMatches.length === 0) {
        console.log('[TournamentBracketScene] Player left without playing - refunding keys/ticket');
        const currentState = playerData.get().tournamentState;
        
        // Возвращаем билет если был потрачен
        if (currentState.hasTicket === false) {
          const newData = playerData.get();
          newData.tournamentState.hasTicket = true;
          playerData.save();
        }
        // ИЛИ возвращаем 3 фрагмента если были потрачены
        else if (currentState.keyFragments < 3) {
          const newData = playerData.get();
          newData.tournamentState.keyFragments = 3;
          playerData.save();
        }
      }
    }
    
    await safeSceneStart(this, 'TournamentScene');
  }

  shutdown(): void {
    // ✅ FIX: Полная очистка ресурсов
    if (this.swipeManager) {
      this.swipeManager.disable();
      this.swipeManager.destroy();
      this.swipeManager = undefined;
    }
    
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.input.removeAllListeners();
    
    console.log('[TournamentBracketScene] shutdown complete');
  }
}

