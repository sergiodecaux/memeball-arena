// src/scenes/TournamentScene.ts
// Сцена Tournament Hub (выбор турнира)

import Phaser from 'phaser';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { tgApp } from '../utils/TelegramWebApp';
import { hapticImpact } from '../utils/Haptics';
import { SWIPE_NAVIGATION } from '../constants/gameConstants';
import { TournamentTier, TOURNAMENT_TEAM_SIZE } from '../types/tournament';
import { TournamentManager } from '../managers/TournamentManager';
import { FACTION_IDS } from '../constants/gameConstants';
import { LeagueTier } from '../types/league';
import { 
  TOURNAMENT_HUB_BG,
  TOURNAMENT_CUP_KEYS,
  TOURNAMENT_KEY_KEYS,
} from '../config/assetKeys';
import { Button } from '../ui/Button';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { safeSceneStart } from '../utils/SceneHelpers';

export class TournamentScene extends Phaser.Scene {
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 90;
  
  // Scroll
  private scrollY = 0;
  private scrollVelocity = 0;
  private isDragging = false;
  private dragStartY = 0;
  private lastPointerY = 0;
  
  private contentContainer?: Phaser.GameObjects.Container;
  private maxScrollY = 0;
  
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
    super({ key: 'TournamentScene' });
  }

  create(): void {
    this.topInset = Math.max(tgApp.getTopInset(), 60);
    this.bottomInset = Math.max(tgApp.getBottomInset(), 40);
    this.headerHeight = 120 + this.topInset;

    AudioManager.getInstance().init(this);

    this.createBackground();
    this.createHeader();
    this.createTournamentCups();
    this.setupScrolling();
    
    // ✅ Правильная навигация назад
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
    });
    this.swipeManager.enable();
  }
  
  shutdown(): void {
    // ✅ FIX: Полная очистка ресурсов
    if (this.swipeManager) {
      this.swipeManager.disable();
      this.swipeManager.destroy();
      this.swipeManager = undefined;
    }
    
    // Останавливаем все tweens и таймеры
    this.tweens.killAll();
    this.time.removeAllEvents();
    
    // Очищаем input
    this.input.removeAllListeners();
    
    console.log('[TournamentScene] shutdown complete');
  }
  
  update(): void {
    // ✅ Улучшенная инерция с плавным затуханием
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.05) {
      this.scrollY += this.scrollVelocity;
      this.scrollVelocity *= 0.92; // Плавное затухание
      this.updateScrollPosition();
    } else if (!this.isDragging) {
      this.scrollVelocity = 0; // Полная остановка
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Фон турниров
    if (this.textures.exists(TOURNAMENT_HUB_BG)) {
      const bg = this.add.image(width / 2, height / 2, TOURNAMENT_HUB_BG);
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

    // ✅ Увеличиваем высоту хедера под кнопки Telegram
    const safeHeaderHeight = this.topInset + 90 * s;

    // Header background
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.9);
    headerBg.fillRect(0, 0, width, safeHeaderHeight);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, safeHeaderHeight, width, safeHeaderHeight);
    headerBg.setDepth(100);

    // Кнопка назад (ниже кнопок Telegram)
    const backBtn = this.add.text(20 * s, this.topInset + 50 * s, '✕', {
      fontSize: `${40 * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiText),
    }).setOrigin(0, 0.5).setDepth(102).setInteractive({ useHandCursor: true });
    
    backBtn.on('pointerdown', () => this.handleBack());

    // Title (на русском)
    const titleY = this.topInset + 50 * s;
    const title = this.add.text(width / 2, titleY, 'ТУРНИРЫ ВЫХОДНОГО ДНЯ', {
      fontSize: `${TYPOGRAPHY.sizes.xl * s}px`,
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);
    applyTextShadow(title, 'medium');
  }

  private createTournamentCups(): void {
    const { width, height } = this.cameras.main;
    const data = playerData.get();
    const leagueProgress = data.leagueProgress;
    const tournamentState = data.tournamentState;
    
    if (!leagueProgress || !tournamentState) {
      console.error('[TournamentScene] Missing league or tournament data');
      return;
    }
    
    // Создаём контейнер для скроллируемого контента
    this.contentContainer = this.add.container(0, this.headerHeight);
    this.contentContainer.setDepth(10);

    const cupTiers: TournamentTier[] = ['rookie', 'minor', 'major', 'apex'];
    const startY = 30;
    const cupSpacing = 200;
    const cupSize = 120;

    cupTiers.forEach((tier, index) => {
      const cupY = startY + index * cupSpacing;
      this.createCupCard(width / 2, cupY, tier, cupSize, leagueProgress.currentTier, tournamentState);
    });
    
    // Вычисляем максимальную прокрутку
    this.maxScrollY = Math.max(0, (startY + cupTiers.length * cupSpacing + 100) - (height - this.headerHeight - this.bottomInset));
  }
  
  private setupScrolling(): void {
    const { width, height } = this.cameras.main;
    
    const scrollZone = this.add.rectangle(
      width / 2,
      this.headerHeight + (height - this.headerHeight - this.bottomInset) / 2,
      width,
      height - this.headerHeight - this.bottomInset,
      0x000000,
      0
    ).setDepth(5).setInteractive();
    
    let lastTime = 0;
    
    scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.lastPointerY = pointer.y;
      lastTime = Date.now();
      this.scrollVelocity = 0;
    });
    
    scrollZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const currentTime = Date.now();
        const deltaTime = Math.max(currentTime - lastTime, 1);
        const delta = pointer.y - this.lastPointerY;
        
        // ✅ Плавное обновление позиции
        this.scrollY += delta;
        
        // ✅ Вычисляем скорость с учётом времени
        this.scrollVelocity = delta / deltaTime * 16; // Нормализуем к 60 FPS
        
        this.lastPointerY = pointer.y;
        lastTime = currentTime;
        this.updateScrollPosition();
      }
    });
    
    scrollZone.on('pointerup', () => {
      this.isDragging = false;
    });
    
    scrollZone.on('pointerout', () => {
      this.isDragging = false;
    });
  }
  
  private updateScrollPosition(): void {
    // ✅ Ограничиваем скролл с небольшим "резиновым" эффектом на краях
    const overscroll = 50; // Пикселей для резинового эффекта
    
    if (this.scrollY > overscroll) {
      this.scrollY = overscroll;
      this.scrollVelocity *= 0.5; // Замедляем на краю
    } else if (this.scrollY < -this.maxScrollY - overscroll) {
      this.scrollY = -this.maxScrollY - overscroll;
      this.scrollVelocity *= 0.5;
    }
    
    // ✅ Возвращаем к границам если отпустили
    if (!this.isDragging) {
      if (this.scrollY > 0) {
        this.scrollY = Phaser.Math.Linear(this.scrollY, 0, 0.2);
      } else if (this.scrollY < -this.maxScrollY) {
        this.scrollY = Phaser.Math.Linear(this.scrollY, -this.maxScrollY, 0.2);
      }
    }
    
    if (this.contentContainer) {
      this.contentContainer.setY(this.headerHeight + this.scrollY);
    }
  }

  private createCupCard(
    x: number, 
    y: number, 
    tier: TournamentTier, 
    size: number,
    playerLeague: LeagueTier,
    tournamentState: any
  ): void {
    const fonts = getFonts();
    const colors = getColors();
    const container = this.add.container(x, y);
    
    // Добавляем в контейнер для скролла
    if (this.contentContainer) {
      this.contentContainer.add(container);
    }

    // Проверяем доступность
    const isAccessible = TournamentManager.isTournamentAccessible(tier, playerLeague);
    const hasAccess = tournamentState.keyFragments >= 3 || tournamentState.hasTicket;

    // Фон карточки
    const cardBg = this.add.graphics();
    cardBg.fillStyle(0x000000, 0.6);
    cardBg.fillRoundedRect(-200, -size / 2 - 20, 400, size + 60, 15);
    cardBg.lineStyle(2, isAccessible ? colors.uiAccent : 0x666666, 0.8);
    cardBg.strokeRoundedRect(-200, -size / 2 - 20, 400, size + 60, 15);
    container.add(cardBg);

    // Кубок
    const cupKey = TOURNAMENT_CUP_KEYS[tier.toUpperCase() as keyof typeof TOURNAMENT_CUP_KEYS];
    if (this.textures.exists(cupKey)) {
      const cup = this.add.image(0, -10, cupKey);
      cup.setDisplaySize(size, size);
      cup.setOrigin(0.5);
      cup.setAlpha(isAccessible ? 1 : 0.5);
      container.add(cup);
    }

    // Название турнира
    const tierNames: Record<TournamentTier, string> = {
      rookie: 'Rookie Draft',
      minor: 'Minor Cup',
      major: 'Major Cup',
      apex: 'Galactic Apex',
    };

    const title = this.add.text(0, size / 2 + 10, tierNames[tier].toUpperCase(), {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: isAccessible ? '#ffffff' : '#666666',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(title);

    // Статус доступа
    let statusText = '';
    if (!isAccessible) {
      statusText = 'LOCKED';
    } else if (hasAccess) {
      statusText = 'ENTER';
    } else {
      statusText = `${tournamentState.keyFragments}/3 Keys`;
    }

    const status = this.add.text(0, size / 2 + 35, statusText, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: isAccessible && hasAccess ? '#00ff00' : '#aaaaaa',
    }).setOrigin(0.5);
    container.add(status);

    // Кнопка входа (если доступно)
    if (isAccessible && hasAccess) {
      const enterButton = new Button(this, {
        x: x,
        y: y + size / 2 + 70,
        width: 180,
        height: 50,
        text: 'ENTER',
        fontSize: 16,
        onClick: () => {
          AudioManager.getInstance().playUIClick();
          hapticImpact('medium');
          this.enterTournament(tier);
        },
      });
    }
  }

  private async enterTournament(tier: TournamentTier): Promise<void> {
    const data = playerData.get();
    const tournamentState = data.tournamentState;
    
    if (!tournamentState) return;

    // 🔒 Проверяем требования к участию
    const requiredTeamSize = TOURNAMENT_TEAM_SIZE[tier];
    const requirementCheck = this.checkTournamentRequirements(requiredTeamSize);
    if (!requirementCheck.canPlay) {
      this.showRequirementModal(requirementCheck.reason);
      return;
    }

    // Проверяем доступ
    if (tournamentState.keyFragments >= 3) {
      tournamentState.keyFragments = Math.max(0, tournamentState.keyFragments - 3);
    } else if (tournamentState.hasTicket) {
      tournamentState.hasTicket = false;
    } else {
      console.warn('[TournamentScene] No access to tournament');
      return;
    }

    // Создаём турнир
    const tournament = TournamentManager.createTournament(tier, data);
    
    // Сохраняем состояние
    tournamentState.activeTournamentId = tournament.id;
    tournamentState.activeTier = tier;
    data.activeTournament = tournament; // Сохраняем полное состояние турнира
    playerData.save();

    // Переходим в сетку турнира
    await safeSceneStart(this, 'TournamentBracketScene', { tournament });
  }
  
  /**
   * 🔒 Проверяет требования к участию в турнире
   */
  private checkTournamentRequirements(requiredTeamSize: number): { canPlay: boolean; reason?: string } {
    const data = playerData.get();
    
    // Подсчитываем сколько фракций прокачаны до нужного размера
    const qualifiedFactions = FACTION_IDS.filter(factionId => {
      const units = data.ownedUnits[factionId];
      if (!units || units.length === 0) return false;
      
      // Проверяем сколько юнитов доступно для этой фракции
      const allowedSize = playerData.getAllowedTeamSize(factionId);
      return allowedSize >= requiredTeamSize;
    });
    
    const minFactionsRequired = 2; // Минимум 2 прокачанные фракции
    
    if (qualifiedFactions.length < minFactionsRequired) {
      let reason = '';
      if (requiredTeamSize === 3) {
        reason = `Для участия в этом турнире нужно открыть минимум ${minFactionsRequired} фракции.\n\nУ вас открыто: ${qualifiedFactions.length}`;
      } else if (requiredTeamSize === 4) {
        reason = `Для участия в этом турнире нужно прокачать минимум ${minFactionsRequired} фракции до 4 юнитов.\n\nУ вас прокачано: ${qualifiedFactions.length}`;
      } else if (requiredTeamSize === 5) {
        reason = `Для участия в этом турнире нужно прокачать минимум ${minFactionsRequired} фракции до 5 юнитов.\n\nУ вас прокачано: ${qualifiedFactions.length}`;
      }
      
      return { canPlay: false, reason };
    }
    
    return { canPlay: true };
  }
  
  /**
   * 🚫 Показывает модальное окно с требованиями
   */
  private showRequirementModal(reason: string): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = tgApp.getUIScale();
    
    // Overlay
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, width, height);
    overlay.setDepth(200);
    overlay.setInteractive();
    
    // Modal container
    const modal = this.add.container(width / 2, height / 2).setDepth(201);
    
    // Background
    const modalWidth = 340 * s;
    const modalHeight = 280 * s;
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 1);
    bg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    bg.lineStyle(3 * s, colors.uiAccent, 1);
    bg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 20 * s);
    modal.add(bg);
    
    // Icon
    const icon = this.add.text(0, -modalHeight / 2 + 50 * s, '🔒', {
      fontSize: `${50 * s}px`,
    }).setOrigin(0.5);
    modal.add(icon);
    
    // Title
    const title = this.add.text(0, -modalHeight / 2 + 110 * s, 'НЕДОСТАТОЧНО ФРАКЦИЙ', {
      fontSize: `${TYPOGRAPHY.sizes.lg * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    applyTextShadow(title, 'medium');
    modal.add(title);
    
    // Reason text
    const reasonText = this.add.text(0, -20 * s, reason, {
      fontSize: `${TYPOGRAPHY.sizes.sm * s}px`,
      fontFamily: fonts.primary,
      color: hexToString(colors.uiText),
      align: 'center',
      wordWrap: { width: modalWidth - 40 * s },
    }).setOrigin(0.5);
    modal.add(reasonText);
    
    // OK Button
    const btnWidth = 180 * s;
    const btnHeight = 50 * s;
    const btnY = modalHeight / 2 - 60 * s;
    
    const btnBg = this.add.graphics();
    btnBg.fillStyle(colors.uiAccent, 1);
    btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 10 * s);
    modal.add(btnBg);
    
    const btnText = this.add.text(0, btnY, 'ПОНЯТНО', {
      fontSize: `${TYPOGRAPHY.sizes.md * s}px`,
      fontFamily: fonts.primary,
      color: '#000000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    modal.add(btnText);
    
    // Button interaction
    const btnZone = this.add.rectangle(0, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    modal.add(btnZone);
    
    btnZone.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_ui_click');
      hapticImpact('light');
      
      overlay.destroy();
      modal.destroy();
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
    AudioManager.getInstance().playSFX('sfx_ui_click');
    hapticImpact('light');
    
    if (this.swipeManager) {
      this.swipeManager.destroy();
      this.swipeManager = undefined;
    }
    
    this.scene.start('MainMenuScene');
  }
}

