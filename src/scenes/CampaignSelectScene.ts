// ✅ ИЗМЕНЕНО: Удалена кнопка "Назад", добавлен SwipeNavigationManager, улучшена типографика

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { 
  CAMPAIGN_CHAPTERS, 
  CAMPAIGN_LEVELS, 
  getChapter, 
  getLevel,
  getAllChaptersOrdered,
  getChapterLevels,
} from '../data/CampaignData';
import { ChapterConfig, LevelConfig } from '../types/CampaignTypes';
import { FACTIONS, FactionId, SWIPE_NAVIGATION } from '../constants/gameConstants';
import { tgApp } from '../utils/TelegramWebApp';
import { getColors, hexToString, getFonts, TYPOGRAPHY, applyTextShadow } from '../config/themes';
import { AudioManager } from '../managers/AudioManager';
import { hapticSelection, hapticImpact } from '../utils/Haptics';
import MissionPreviewOverlay from '../ui/game/MissionPreviewOverlay';

interface LevelNode {
  levelId: string;
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  config: LevelConfig;
  isUnlocked: boolean;
  isCompleted: boolean;
  stars: number;
}

interface ChapterSection {
  chapterId: string;
  config: ChapterConfig;
  startY: number;
  endY: number;
  background?: Phaser.GameObjects.Image;
}

export class CampaignSelectScene extends Phaser.Scene {
  private screenWidth!: number;
  private screenHeight!: number;
  
  private scrollContainer!: Phaser.GameObjects.Container;
  private totalHeight: number = 0;
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScrollY: number = 0;
  private velocity: number = 0;
  
  private levelNodes: LevelNode[] = [];
  private chapterSections: ChapterSection[] = [];
  private currentChapterId: string = 'chapter_1';
  
  private headerContainer!: Phaser.GameObjects.Container;
  private chapterTitle!: Phaser.GameObjects.Text;
  private starsText!: Phaser.GameObjects.Text;
  private popup?: Phaser.GameObjects.Container;
  private currentPreview?: MissionPreviewOverlay;
  
  private readonly NODE_SPACING_Y = 180;
  private readonly CHAPTER_PADDING = 100;
  private readonly SNAKE_AMPLITUDE = 120;
  
  private topInset = 0;
  private bottomInset = 0;
  private headerHeight = 100;
  private visibleAreaBottom = 0;

  // Swipe Navigation
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private swipeStartTime: number = 0;
  private isSwipeActive: boolean = false;
  private swipeIndicator?: Phaser.GameObjects.Graphics;
  private swipeOverlay?: Phaser.GameObjects.Graphics;
  private swipeArrow?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CampaignSelectScene' });
  }

  preload(): void {
    // Assets already loaded in Boot, nothing to do
  }

  create(): void {
    this.screenWidth = this.cameras.main.width;
    this.screenHeight = this.cameras.main.height;
    
    this.topInset = tgApp.getTopInset();
    this.bottomInset = tgApp.getBottomInset();
    this.headerHeight = 100 + this.topInset;
    
    // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
    this.visibleAreaBottom = this.screenHeight - 20 - this.bottomInset;
    
    console.log('[CampaignSelectScene] Insets - Top:', this.topInset, 'Bottom:', this.bottomInset);
    
    this.levelNodes = [];
    this.chapterSections = [];
    this.scrollY = 0;
    this.velocity = 0;
    this.isSwipeActive = false;
    
    this.createBackground();
    this.createScrollContainer();
    this.createHeader();
    // ✅ УДАЛЕНО: this.createBottomBackButton();
    this.createSwipeIndicator();
    this.setupInput();
    this.setupSwipeNavigation();
    
    this.scrollToCurrentLevel();
    
    console.log('[CampaignSelectScene] Created with', this.levelNodes.length, 'level nodes');
  }

  // ========== SWIPE NAVIGATION ==========

  private createSwipeIndicator(): void {
    const colors = getColors();

    // Индикатор у левого края
    this.swipeIndicator = this.add.graphics();
    this.swipeIndicator.setDepth(50);

    // Вертикальная полоска
    this.swipeIndicator.fillStyle(
      SWIPE_NAVIGATION.INDICATOR_COLOR,
      SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
    );
    this.swipeIndicator.fillRoundedRect(
      0,
      this.headerHeight + 20,
      SWIPE_NAVIGATION.INDICATOR_WIDTH,
      this.screenHeight - this.headerHeight - 60 - this.bottomInset,
      2
    );

    // Пульсация
    this.tweens.add({
      targets: this.swipeIndicator,
      alpha: { from: 0.3, to: 0.6 },
      duration: SWIPE_NAVIGATION.PULSE_SPEED,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Overlay для эффекта свайпа (изначально скрыт)
    this.swipeOverlay = this.add.graphics();
    this.swipeOverlay.setDepth(200);
    this.swipeOverlay.setVisible(false);

    // Контейнер для стрелки "назад"
    this.swipeArrow = this.add.container(40, this.screenHeight / 2);
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
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Проверяем, что касание в зоне левого края и нет popup
      if (pointer.x <= SWIPE_NAVIGATION.EDGE_ZONE_WIDTH && !this.popup) {
        this.swipeStartX = pointer.x;
        this.swipeStartY = pointer.y;
        this.swipeStartTime = Date.now();
        this.isSwipeActive = true;

        // Подсветка индикатора
        if (this.swipeIndicator) {
          this.swipeIndicator.clear();
          this.swipeIndicator.fillStyle(
            SWIPE_NAVIGATION.INDICATOR_COLOR,
            SWIPE_NAVIGATION.INDICATOR_ALPHA_ACTIVE
          );
          this.swipeIndicator.fillRoundedRect(
            0,
            this.headerHeight + 20,
            SWIPE_NAVIGATION.INDICATOR_WIDTH + 2,
            this.screenHeight - this.headerHeight - 60 - this.bottomInset,
            2
          );
        }

        hapticSelection();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaY = Math.abs(pointer.y - this.swipeStartY);

      // Проверяем вертикальный дрифт
      if (deltaY > SWIPE_NAVIGATION.MAX_VERTICAL_DRIFT) {
        this.cancelSwipe();
        return;
      }

      if (deltaX > 10) {
        // Блокируем скролл
        this.isDragging = false;

        // Показываем прогресс свайпа
        const progress = Math.min(deltaX / (this.screenWidth * SWIPE_NAVIGATION.THRESHOLD_PERCENT), 1);
        this.showSwipeProgress(progress, deltaX);
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isSwipeActive) return;

      const deltaX = pointer.x - this.swipeStartX;
      const deltaTime = Date.now() - this.swipeStartTime;
      const velocity = deltaX / (deltaTime / 1000);

      const thresholdDistance = this.screenWidth * SWIPE_NAVIGATION.THRESHOLD_PERCENT;

      // Проверяем условия срабатывания
      if (deltaX >= thresholdDistance || velocity >= SWIPE_NAVIGATION.VELOCITY_THRESHOLD) {
        this.completeSwipe();
      } else {
        this.cancelSwipe();
      }
    });
  }

  private showSwipeProgress(progress: number, deltaX: number): void {
    // Overlay с градиентом
    if (this.swipeOverlay) {
      this.swipeOverlay.setVisible(true);
      this.swipeOverlay.clear();

      const alpha = progress * SWIPE_NAVIGATION.DIMMING_MAX;
      
      // Градиентное затемнение слева
      for (let i = 0; i < 20; i++) {
        const segmentAlpha = alpha * (1 - i / 20);
        this.swipeOverlay.fillStyle(0x000000, segmentAlpha);
        this.swipeOverlay.fillRect(
          (deltaX / 20) * i,
          0,
          deltaX / 20 + 1,
          this.screenHeight
        );
      }
    }

    // Стрелка
    if (this.swipeArrow) {
      this.swipeArrow.setVisible(true);
      this.swipeArrow.setAlpha(progress);
      this.swipeArrow.x = 40 + deltaX * 0.3;
    }
  }

  private completeSwipe(): void {
    hapticImpact('medium');
    AudioManager.getInstance().playUISwoosh();

    // Анимация завершения
    this.tweens.add({
      targets: this.swipeOverlay,
      alpha: 1,
      duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
      ease: 'Quad.easeOut',
    });

    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: this.screenWidth / 2,
        alpha: 0,
        duration: SWIPE_NAVIGATION.ANIMATION_DURATION,
        ease: 'Quad.easeOut',
      });
    }

    // Переход в главное меню
    this.time.delayedCall(SWIPE_NAVIGATION.ANIMATION_DURATION, () => {
      this.scene.start('MainMenuScene');
    });
  }

  private cancelSwipe(): void {
    this.isSwipeActive = false;

    // Возврат индикатора
    if (this.swipeIndicator) {
      this.swipeIndicator.clear();
      this.swipeIndicator.fillStyle(
        SWIPE_NAVIGATION.INDICATOR_COLOR,
        SWIPE_NAVIGATION.INDICATOR_ALPHA_IDLE
      );
      this.swipeIndicator.fillRoundedRect(
        0,
        this.headerHeight + 20,
        SWIPE_NAVIGATION.INDICATOR_WIDTH,
        this.screenHeight - this.headerHeight - 60 - this.bottomInset,
        2
      );
    }

    // Скрытие overlay с анимацией
    if (this.swipeOverlay) {
      this.tweens.add({
        targets: this.swipeOverlay,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeOverlay?.setVisible(false);
        },
      });
    }

    // Скрытие стрелки
    if (this.swipeArrow) {
      this.tweens.add({
        targets: this.swipeArrow,
        x: 40,
        alpha: 0,
        duration: 150,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.swipeArrow?.setVisible(false);
        },
      });
    }
  }

  // ========== СОЗДАНИЕ ФОНА ==========

  private createBackground(): void {
    this.add.rectangle(0, 0, this.screenWidth, this.screenHeight, 0x0a0a1a)
      .setOrigin(0, 0);
    
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * this.screenWidth;
      const y = Math.random() * this.screenHeight;
      const alpha = 0.2 + Math.random() * 0.5;
      const size = 1 + Math.random() * 2;
      
      this.add.circle(x, y, size, 0xffffff, alpha);
    }
  }

  // ========== СОЗДАНИЕ СКРОЛЛ-КОНТЕЙНЕРА ==========

  private createScrollContainer(): void {
    this.scrollContainer = this.add.container(0, this.headerHeight);
    
    this.calculateLayout();
    this.createChapterBackgrounds();
    this.createPaths();
    this.createLevelNodes();
    
    // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
    const scrollableHeight = this.screenHeight - this.headerHeight - 20 - this.bottomInset;
    
    const maskShape = this.make.graphics({ x: 0, y: 0 });
    maskShape.fillRect(0, this.headerHeight, this.screenWidth, scrollableHeight);
    const mask = maskShape.createGeometryMask();
    this.scrollContainer.setMask(mask);
    
    this.maxScrollY = Math.max(0, this.totalHeight - scrollableHeight + 100);
  }

  // ========== РАСЧЁТ LAYOUT ==========

  private calculateLayout(): void {
    const chapters = getAllChaptersOrdered();
    let currentY = this.CHAPTER_PADDING;
    
    chapters.forEach((chapter, chapterIndex) => {
      const levels = getChapterLevels(chapter.id);
      const chapterHeight = levels.length * this.NODE_SPACING_Y + this.CHAPTER_PADDING * 2;
      
      this.chapterSections.push({
        chapterId: chapter.id,
        config: chapter,
        startY: currentY,
        endY: currentY + chapterHeight,
      });
      
      currentY += chapterHeight;
    });
    
    this.totalHeight = currentY + this.CHAPTER_PADDING;
  }

  // ========== ФОНЫ ГЛАВ ==========

  private createChapterBackgrounds(): void {
    const fonts = getFonts();
    
    this.chapterSections.forEach((section, index) => {
      const height = section.endY - section.startY;
      
      const bgKey = `bg_chapter_${section.config.factionId}`;
      
      if (this.textures.exists(bgKey)) {
        const bg = this.add.image(this.screenWidth / 2, section.startY + height / 2, bgKey);
        bg.setDisplaySize(this.screenWidth, height);
        bg.setAlpha(0.3);
        this.scrollContainer.add(bg);
        section.background = bg;
      } else {
        const faction = FACTIONS[section.config.factionId];
        const rect = this.add.rectangle(
          this.screenWidth / 2,
          section.startY + height / 2,
          this.screenWidth,
          height,
          faction.color,
          0.15
        );
        this.scrollContainer.add(rect);
      }
      
      // ✅ УЛУЧШЕНО: Типографика
      const chapterLabel = this.add.text(
        this.screenWidth / 2,
        section.startY + 30,
        `${section.config.icon} ГЛАВА ${index + 1}: ${section.config.name.toUpperCase()}`,
        {
          fontFamily: fonts.tech,
          fontSize: `${TYPOGRAPHY.sizes.xl}px`,
          color: '#ffffff',
          stroke: '#000000',
          strokeThickness: 4,
        }
      ).setOrigin(0.5);
      applyTextShadow(chapterLabel, 'strong');
      this.scrollContainer.add(chapterLabel);
      
      if (index > 0) {
        const line = this.add.graphics();
        line.lineStyle(2, section.config.accentColor, 0.5);
        line.lineBetween(50, section.startY, this.screenWidth - 50, section.startY);
        this.scrollContainer.add(line);
      }
    });
  }

  // ========== ПУТИ МЕЖДУ УРОВНЯМИ ==========

  private createPaths(): void {
    const graphics = this.add.graphics();
    this.scrollContainer.add(graphics);
    
    this.chapterSections.forEach((section) => {
      const levels = getChapterLevels(section.chapterId);
      const startY = section.startY + 80;
      
      levels.forEach((level, index) => {
        if (index === 0) return;
        
        const prevLevel = levels[index - 1];
        const prevNode = this.getNodePosition(section, index - 1, levels.length);
        const currNode = this.getNodePosition(section, index, levels.length);
        
        const isPathUnlocked = playerData.isLevelCompleted(prevLevel.id);
        const pathColor = isPathUnlocked ? section.config.accentColor : 0x333333;
        const pathAlpha = isPathUnlocked ? 0.8 : 0.3;
        
        this.drawDottedPath(graphics, prevNode.x, prevNode.y, currNode.x, currNode.y, pathColor, pathAlpha);
      });
    });
  }

  private drawDottedPath(
    graphics: Phaser.GameObjects.Graphics,
    x1: number, y1: number,
    x2: number, y2: number,
    color: number,
    alpha: number
  ): void {
    const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const dotCount = Math.floor(distance / 15);
    
    graphics.fillStyle(color, alpha);
    
    for (let i = 0; i <= dotCount; i++) {
      const t = i / dotCount;
      const x = Phaser.Math.Linear(x1, x2, t);
      const y = Phaser.Math.Linear(y1, y2, t);
      
      graphics.fillCircle(x, y, 3);
    }
  }

  private getNodePosition(section: ChapterSection, levelIndex: number, totalLevels: number): { x: number; y: number } {
    const startY = section.startY + 80;
    const y = startY + levelIndex * this.NODE_SPACING_Y;
    
    const isLeft = levelIndex % 2 === 0;
    const centerX = this.screenWidth / 2;
    const x = isLeft 
      ? centerX - this.SNAKE_AMPLITUDE 
      : centerX + this.SNAKE_AMPLITUDE;
    
    return { x, y };
  }

  // ========== СОЗДАНИЕ НОД УРОВНЕЙ ==========

  private createLevelNodes(): void {
    this.chapterSections.forEach((section) => {
      const levels = getChapterLevels(section.chapterId);
      
      levels.forEach((level, index) => {
        const pos = this.getNodePosition(section, index, levels.length);
        const node = this.createLevelNode(level, pos.x, pos.y, section.config);
        this.levelNodes.push(node);
      });
    });
  }

  private createLevelNode(
    level: LevelConfig,
    x: number,
    y: number,
    chapter: ChapterConfig
  ): LevelNode {
    const isUnlocked = playerData.isLevelUnlocked(level.id);
    const isCompleted = playerData.isLevelCompleted(level.id);
    const stars = playerData.getLevelStars(level.id);
    const fonts = getFonts();
    
    const container = this.add.container(x, y);
    this.scrollContainer.add(container);
    
    const nodeSize = level.isBoss ? 80 : 64;
    
    let nodeTexture = 'node_locked';
    if (isCompleted) {
      if (stars >= 3) nodeTexture = 'node_completed_3stars';
      else if (stars >= 2) nodeTexture = 'node_completed_2stars';
      else nodeTexture = 'node_completed_1star';
    } else if (isUnlocked) {
      nodeTexture = level.isBoss ? 'node_boss' : 'node_active';
    }
    
    if (isUnlocked && !isCompleted) {
      const glow = this.add.circle(0, 0, nodeSize * 0.8, chapter.accentColor, 0.3);
      container.add(glow);
      
      this.tweens.add({
        targets: glow,
        scaleX: 1.3,
        scaleY: 1.3,
        alpha: 0.1,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    
    if (this.textures.exists(nodeTexture)) {
      const nodeSprite = this.add.image(0, 0, nodeTexture);
      nodeSprite.setDisplaySize(nodeSize, nodeSize);
      container.add(nodeSprite);
    } else {
      const circle = this.add.circle(0, 0, nodeSize / 2, isUnlocked ? chapter.accentColor : 0x333333);
      container.add(circle);
      
      if (!isUnlocked) {
        const lockText = this.add.text(0, 0, '🔒', { fontSize: `${TYPOGRAPHY.sizes.xxl}px` }).setOrigin(0.5);
        container.add(lockText);
      }
    }
    
    // ✅ УЛУЧШЕНО: Типографика
    const levelNumber = this.add.text(0, -nodeSize / 2 - 15, level.id, {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: isUnlocked ? '#ffffff' : '#666666',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(levelNumber);
    
    const nameText = this.add.text(0, nodeSize / 2 + 15, level.name, {
      fontFamily: fonts.primary,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: isUnlocked ? '#ffffff' : '#666666',
      stroke: '#000000',
      strokeThickness: 2,
      align: 'center',
      wordWrap: { width: 120 },
    }).setOrigin(0.5, 0);
    container.add(nameText);
    
    if (isCompleted) {
      const starsContainer = this.add.container(0, nodeSize / 2 + 40);
      for (let i = 0; i < 3; i++) {
        const starX = (i - 1) * 18;
        const starTexture = i < stars ? 'star_filled' : 'star_empty';
        
        if (this.textures.exists(starTexture)) {
          const star = this.add.image(starX, 0, starTexture).setDisplaySize(16, 16);
          starsContainer.add(star);
        } else {
          const starText = this.add.text(starX, 0, i < stars ? '★' : '☆', {
            fontSize: `${TYPOGRAPHY.sizes.md}px`,
            color: i < stars ? '#ffd700' : '#333333',
          }).setOrigin(0.5);
          starsContainer.add(starText);
        }
      }
      container.add(starsContainer);
    }
    
    if (level.isBoss) {
      const bossLabel = this.add.text(0, -nodeSize / 2 - 35, '👑 БОСС', {
        fontFamily: fonts.tech,
        fontSize: `${TYPOGRAPHY.sizes.sm}px`,
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      container.add(bossLabel);
    }
    
    if (isUnlocked) {
      const hitArea = this.add.circle(0, 0, nodeSize / 2 + 10, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      container.add(hitArea);
      
      hitArea.on('pointerdown', () => {
        this.onNodeTapped(level);
      });
      
      hitArea.on('pointerover', () => {
        container.setScale(1.1);
      });
      
      hitArea.on('pointerout', () => {
        container.setScale(1.0);
      });
    }
    
    return {
      levelId: level.id,
      x,
      y,
      container,
      config: level,
      isUnlocked,
      isCompleted,
      stars,
    };
  }

  // ========== HEADER ==========

  private createHeader(): void {
    const fonts = getFonts();
    const colors = getColors();
    
    this.headerContainer = this.add.container(0, 0).setDepth(100);
    
    const headerBg = this.add.rectangle(
      this.screenWidth / 2,
      this.headerHeight / 2,
      this.screenWidth,
      this.headerHeight,
      0x1a1a2e,
      0.95
    );
    this.headerContainer.add(headerBg);
    
    const headerLine = this.add.rectangle(
      this.screenWidth / 2,
      this.headerHeight - 2,
      this.screenWidth,
      4,
      colors.uiAccent,
      0.5
    );
    this.headerContainer.add(headerLine);
    
    const contentY = 40 + this.topInset;

    // ✅ УЛУЧШЕНО: Типографика для заголовка
    this.chapterTitle = this.add.text(this.screenWidth / 2, contentY, 'КАМПАНИЯ', {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.xxl}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    applyTextShadow(this.chapterTitle, 'strong');
    this.headerContainer.add(this.chapterTitle);
    
    const totalStars = playerData.getTotalCampaignStars();
    const maxStars = Object.keys(CAMPAIGN_LEVELS).length * 3;
    
    this.starsText = this.add.text(
      this.screenWidth / 2,
      contentY + 30,
      `⭐ ${totalStars} / ${maxStars}`,
      {
        fontFamily: fonts.tech,
        fontSize: `${TYPOGRAPHY.sizes.lg}px`,
        color: '#ffd700',
      }
    ).setOrigin(0.5);
    this.headerContainer.add(this.starsText);
  }

  // ✅ УДАЛЕНО: createBottomBackButton() - полностью удалён

  // ========== POPUP УРОВНЯ ==========

  private onNodeTapped(level: LevelConfig): void {
    console.log('[CampaignSelectScene] Level tapped:', level.id);
    hapticSelection();
    AudioManager.getInstance().playUIClick();
    
    // Destroy previous preview if still visible
    if (this.currentPreview) {
      this.currentPreview.destroy();
      this.currentPreview = undefined;
    }

    // Show Mission Preview Overlay
    this.currentPreview = new MissionPreviewOverlay({
      scene: this,
      level,
      onStart: () => {
        // Start the match in GameScene
        this.currentPreview?.destroy();
        this.currentPreview = undefined;

        const chapter = getChapter(level.chapterId);
        this.scene.start('GameScene', {
          mode: 'campaign',
          isCampaign: true,
          levelConfig: level,
          chapterConfig: chapter,
          playerFaction: playerData.getFaction() || 'cyborg',
          opponentFaction: level.enemyFaction,
          aiDifficulty: level.aiDifficulty,
        });
      },
      onClose: () => {
        this.currentPreview?.destroy();
        this.currentPreview = undefined;
      },
    });
  }

  private showLevelPopup(level: LevelConfig): void {
    if (this.popup) {
      this.popup.destroy();
    }
    
    const chapter = getChapter(level.chapterId);
    if (!chapter) return;
    
    const fonts = getFonts();
    
    const popupWidth = this.screenWidth * 0.85;
    const popupHeight = 400;
    const popupX = this.screenWidth / 2;
    const popupY = this.screenHeight / 2;
    
    this.popup = this.add.container(popupX, popupY).setDepth(500);
    
    const overlay = this.add.rectangle(0, 0, this.screenWidth * 2, this.screenHeight * 2, 0x000000, 0.7);
    overlay.setInteractive();
    overlay.on('pointerdown', () => this.hidePopup());
    this.popup.add(overlay);
    
    // ✅ УЛУЧШЕНО: Многослойные тени для popup
    const shadowBg = this.add.graphics();
    shadowBg.fillStyle(0x000000, 0.4);
    shadowBg.fillRoundedRect(-popupWidth / 2 + 6, -popupHeight / 2 + 6, popupWidth, popupHeight, 20);
    this.popup.add(shadowBg);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a2e, 0.98);
    bg.fillRoundedRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 20);
    
    // Glass effect
    bg.fillStyle(0xffffff, 0.05);
    bg.fillRoundedRect(-popupWidth / 2 + 2, -popupHeight / 2 + 2, popupWidth - 4, popupHeight * 0.3, { tl: 18, tr: 18, bl: 0, br: 0 });
    
    bg.lineStyle(3, chapter.accentColor, 1);
    bg.strokeRoundedRect(-popupWidth / 2, -popupHeight / 2, popupWidth, popupHeight, 20);
    this.popup.add(bg);
    
    // ✅ УЛУЧШЕНО: Типографика
    const title = this.add.text(0, -popupHeight / 2 + 30, `${chapter.icon} ${level.name}`, {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    applyTextShadow(title, 'medium');
    this.popup.add(title);
    
    const levelId = this.add.text(0, -popupHeight / 2 + 60, `Уровень ${level.id}`, {
      fontFamily: fonts.primary,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: '#888888',
    }).setOrigin(0.5);
    this.popup.add(levelId);
    
    const desc = this.add.text(0, -popupHeight / 2 + 100, level.description, {
      fontFamily: fonts.primary,
      fontSize: `${TYPOGRAPHY.sizes.md}px`,
      color: '#cccccc',
      align: 'center',
      wordWrap: { width: popupWidth - 60 },
    }).setOrigin(0.5);
    this.popup.add(desc);
    
    const winConditionText = this.getWinConditionText(level);
    const winCondition = this.add.text(0, -popupHeight / 2 + 150, `🎯 ${winConditionText}`, {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: '#00ff00',
    }).setOrigin(0.5);
    this.popup.add(winCondition);
    
    const enemyFaction = FACTIONS[level.enemyFaction];
    const enemyText = this.add.text(0, -popupHeight / 2 + 180, `⚔️ Противник: ${enemyFaction.name}`, {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: '#ff8800',
    }).setOrigin(0.5);
    this.popup.add(enemyText);
    
    const starsY = -popupHeight / 2 + 220;
    const starCriteria = level.starCriteria;
    
    const starLabels = [
      `⭐ ${starCriteria.oneStar}`,
      `⭐⭐ ${starCriteria.twoStars}`,
      `⭐⭐⭐ ${starCriteria.threeStars}`,
    ];
    
    starLabels.forEach((label, i) => {
      const starText = this.add.text(0, starsY + i * 25, label, {
        fontFamily: fonts.primary,
        fontSize: `${TYPOGRAPHY.sizes.sm}px`,
        color: '#ffd700',
        align: 'center',
      }).setOrigin(0.5);
      this.popup.add(starText);
    });
    
    const reward = level.reward;
    const rewardY = starsY + 90;
    const rewardText = this.add.text(0, rewardY, `💰 ${reward.firstClearCoins} монет  |  ✨ ${reward.firstClearXP} XP`, {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.sm}px`,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.popup.add(rewardText);
    
    const btnY = popupHeight / 2 - 50;
    const btnWidth = 200;
    const btnHeight = 50;
    
    const btnBg = this.add.graphics();
    btnBg.fillStyle(chapter.accentColor, 1);
    btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 12);
    this.popup.add(btnBg);
    
    const btnText = this.add.text(0, btnY, '▶ НАЧАТЬ', {
      fontFamily: fonts.tech,
      fontSize: `${TYPOGRAPHY.sizes.xl}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.popup.add(btnText);
    
    const btnHitArea = this.add.rectangle(0, btnY, btnWidth, btnHeight, 0x000000, 0);
    btnHitArea.setInteractive({ useHandCursor: true });
    btnHitArea.on('pointerdown', () => this.startLevel(level));
    btnHitArea.on('pointerover', () => btnBg.setAlpha(0.8));
    btnHitArea.on('pointerout', () => btnBg.setAlpha(1));
    this.popup.add(btnHitArea);
    
    const closeBtn = this.add.text(popupWidth / 2 - 20, -popupHeight / 2 + 20, '✕', {
      fontFamily: fonts.primary,
      fontSize: `${TYPOGRAPHY.sizes.xxl}px`,
      color: '#ffffff',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hidePopup());
    this.popup.add(closeBtn);
    
    this.popup.setScale(0.8);
    this.popup.setAlpha(0);
    this.tweens.add({
      targets: this.popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  private getWinConditionText(level: LevelConfig): string {
    const wc = level.winCondition;
    
    switch (wc.type) {
      case 'score_limit':
        return `Забей ${wc.scoreLimit} ${this.pluralGoals(wc.scoreLimit || 3)}`;
      case 'time_survival':
        return `Продержись ${wc.timeLimit} секунд`;
      case 'sudden_death':
        return 'Золотой гол — один шанс!';
      case 'no_goals_against':
        return 'Не пропусти ни одного гола';
      case 'score_difference':
        return `Выиграй с разницей в ${wc.scoreDifference} гола`;
      case 'puzzle':
        return `Забей за ${wc.maxAttempts} ${this.pluralShots(wc.maxAttempts || 1)}`;
      default:
        return 'Победи!';
    }
  }

  private pluralGoals(n: number): string {
    if (n === 1) return 'гол';
    if (n >= 2 && n <= 4) return 'гола';
    return 'голов';
  }

  private pluralShots(n: number): string {
    if (n === 1) return 'удар';
    if (n >= 2 && n <= 4) return 'удара';
    return 'ударов';
  }

  private hidePopup(): void {
    if (!this.popup) return;
    
    this.tweens.add({
      targets: this.popup,
      scale: 0.8,
      alpha: 0,
      duration: 150,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.popup?.destroy();
        this.popup = undefined;
      },
    });
  }

  private startLevel(level: LevelConfig): void {
    console.log('[CampaignSelectScene] Starting level:', level.id);
    hapticImpact('medium');
    AudioManager.getInstance().playUIClick();
    this.hidePopup();
    
    const chapter = getChapter(level.chapterId);
    
    this.scene.start('GameScene', {
      mode: 'campaign',
      isCampaign: true,
      levelConfig: level,
      chapterConfig: chapter,
      playerFaction: playerData.getFaction() || 'cyborg',
      opponentFaction: level.enemyFaction,
      aiDifficulty: level.aiDifficulty,
    });
  }

  // ========== ВВОД И СКРОЛЛ ==========

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y < this.headerHeight) return;
      if (pointer.y > this.visibleAreaBottom) return;
      if (this.popup) return;
      // ✅ ИЗМЕНЕНО: Проверяем, что не в зоне свайпа
      if (pointer.x <= SWIPE_NAVIGATION.EDGE_ZONE_WIDTH) return;
      
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.scrollY;
      this.velocity = 0;
    });
    
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.isSwipeActive) return;
      
      const deltaY = this.dragStartY - pointer.y;
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScrollY + deltaY,
        0,
        this.maxScrollY
      );
      
      this.scrollContainer.y = this.headerHeight - this.scrollY;
      this.updateCurrentChapter();
    });
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      
      this.isDragging = false;
      this.velocity = (this.dragStartY - pointer.y) * 0.1;
    });
  }

  update(time: number, delta: number): void {
    if (!this.isDragging && !this.isSwipeActive && Math.abs(this.velocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(
        this.scrollY + this.velocity,
        0,
        this.maxScrollY
      );
      
      this.scrollContainer.y = this.headerHeight - this.scrollY;
      this.velocity *= 0.92;
      
      this.updateCurrentChapter();
    }
  }

  private updateCurrentChapter(): void {
    // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
    const scrollableHeight = this.screenHeight - this.headerHeight - 20 - this.bottomInset;
    const viewCenter = this.scrollY + scrollableHeight / 2;
    
    for (const section of this.chapterSections) {
      if (viewCenter >= section.startY && viewCenter < section.endY) {
        if (this.currentChapterId !== section.chapterId) {
          this.currentChapterId = section.chapterId;
          this.chapterTitle.setText(`${section.config.icon} ${section.config.name.toUpperCase()}`);
        }
        break;
      }
    }
  }

  private scrollToCurrentLevel(): void {
    const currentLevel = playerData.getCurrentCampaignLevel();
    
    if (currentLevel) {
      const node = this.levelNodes.find(n => n.levelId === currentLevel.id);
      if (node) {
        // ✅ ИЗМЕНЕНО: Убран bottomBarHeight
        const scrollableHeight = this.screenHeight - this.headerHeight - 20 - this.bottomInset;
        const targetScrollY = node.y - scrollableHeight / 2;
        this.scrollY = Phaser.Math.Clamp(targetScrollY, 0, this.maxScrollY);
        this.scrollContainer.y = this.headerHeight - this.scrollY;
        this.updateCurrentChapter();
      }
    }
  }

  private goBack(): void {
    this.scene.start('MainMenuScene');
  }
}