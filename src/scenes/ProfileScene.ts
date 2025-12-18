// src/scenes/ProfileScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor } from '../config/themes';
import { playerData, getRankByLevel, getXPForLevel } from '../data/PlayerData';
import { getCapSkin, getBallSkin, getFieldSkin, getRarityName, CapSkinData, BallSkinData, FieldSkinData } from '../data/SkinsCatalog';
import { i18n } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { drawClassIcon } from '../ui/ClassIcons';

type ProfileTab = 'stats' | 'collection' | 'achievements';

export class ProfileScene extends Phaser.Scene {
  private currentTab: ProfileTab = 'stats';
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;

  constructor() {
    super({ key: 'ProfileScene' });
  }

  create(): void {
    this.scrollY = 0;
    this.isDragging = false;
    
    this.createBackground();
    this.createHeader();
    this.createPlayerCard();
    this.createTabs();
    this.createContentArea();
    this.renderContent();
    this.setupScrolling();
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    // Тот же фон как в SettingsScene
    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 1);
    bg.fillRect(0, 0, width, height);

    // Верхний градиент
    for (let i = 0; i < 200; i++) {
      const alpha = 0.1 * Math.pow(1 - i / 200, 2);
      bg.fillStyle(colors.uiPrimary, alpha);
      bg.fillRect(0, i, width, 1);
    }

    // Сетка
    const grid = this.add.graphics();
    grid.lineStyle(1, colors.uiPrimary, 0.02);
    for (let x = 0; x <= width; x += 50) {
      grid.moveTo(x, 0);
      grid.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 50) {
      grid.moveTo(0, y);
      grid.lineTo(width, y);
    }
    grid.strokePath();
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();

    // Фон хедера
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.5);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(1, colors.uiPrimary, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    // Кнопка назад
    const backBtn = this.add.container(45, 35).setDepth(101);
    
    const backBg = this.add.graphics();
    backBg.fillStyle(colors.uiPrimary, 0.1);
    backBg.fillCircle(0, 0, 22);
    backBg.lineStyle(2, colors.uiAccent, 0.5);
    backBg.strokeCircle(0, 0, 22);
    backBtn.add(backBg);
    
    const backIcon = Icons.drawBack(this, 0, 0, 10, colors.uiAccent);
    backBtn.add(backIcon);
    
    backBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 22), Phaser.Geom.Circle.Contains);
    backBtn.on('pointerover', () => {
      backBg.clear();
      backBg.fillStyle(colors.uiAccent, 0.2);
      backBg.fillCircle(0, 0, 22);
      backBg.lineStyle(2, colors.uiAccent, 0.8);
      backBg.strokeCircle(0, 0, 22);
    });
    backBtn.on('pointerout', () => {
      backBg.clear();
      backBg.fillStyle(colors.uiPrimary, 0.1);
      backBg.fillCircle(0, 0, 22);
      backBg.lineStyle(2, colors.uiAccent, 0.5);
      backBg.strokeCircle(0, 0, 22);
    });
    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));

    // Заголовок БЕЗ иконки рядом - только текст по центру
    this.add.text(width / 2, 35, i18n.t('profile').toUpperCase(), {
      fontSize: '24px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
    }).setOrigin(0.5, 0.5).setDepth(101);
  }

  private createPlayerCard(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    const rank = getRankByLevel(data.level);

    const cardY = 130;
    const cardWidth = width - 40;
    const cardHeight = 100;

    const container = this.add.container(width / 2, cardY);

    // Тень карточки
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.3);
    shadow.fillRoundedRect(-cardWidth / 2 + 4, -cardHeight / 2 + 5, cardWidth, cardHeight, 14);
    container.add(shadow);

    // Основной фон
    const bg = this.add.graphics();
    bg.fillStyle(0x12121f, 0.9);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);
    
    // Рамка с цветом ранга
    bg.lineStyle(1, rank.color, 0.5);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14);
    
    // Акцентная линия сверху
    bg.fillStyle(rank.color, 0.8);
    bg.fillRoundedRect(-30, -cardHeight / 2, 60, 3, 2);
    
    container.add(bg);

    // Аватар
    const avatarX = -cardWidth / 2 + 55;
    
    // Анимированное кольцо
    const avatarRing = this.add.graphics();
    avatarRing.lineStyle(2, rank.color, 0.3);
    avatarRing.strokeCircle(avatarX, 0, 38);
    container.add(avatarRing);
    
    this.tweens.add({
      targets: avatarRing,
      alpha: { from: 0.3, to: 0.7 },
      scaleX: { from: 1, to: 1.06 },
      scaleY: { from: 1, to: 1.06 },
      duration: 1800,
      yoyo: true,
      repeat: -1,
    });
    
    // Фон аватара
    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(0x1a1a2e, 1);
    avatarBg.fillCircle(avatarX, 0, 32);
    avatarBg.lineStyle(3, rank.color, 1);
    avatarBg.strokeCircle(avatarX, 0, 32);
    container.add(avatarBg);
    
    // Иконка профиля
    const profileIcon = Icons.drawProfile(this, avatarX, 0, 24, 0xffffff);
    container.add(profileIcon);
    
    // Бейдж уровня
    const levelBadge = this.add.graphics();
    levelBadge.fillStyle(rank.color, 1);
    levelBadge.fillCircle(avatarX + 24, 24, 14);
    levelBadge.lineStyle(2, 0xffffff, 1);
    levelBadge.strokeCircle(avatarX + 24, 24, 14);
    container.add(levelBadge);
    
    container.add(this.add.text(avatarX + 24, 24, `${data.level}`, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    // Информация
    const infoX = avatarX + 60;
    
    container.add(this.add.text(infoX, -22, data.username, {
      fontSize: '18px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5));

    // Бейдж ранга
    const rankBg = this.add.graphics();
    rankBg.fillStyle(rank.color, 0.15);
    rankBg.fillRoundedRect(infoX, -6, 90, 22, 11);
    rankBg.lineStyle(1, rank.color, 0.4);
    rankBg.strokeRoundedRect(infoX, -6, 90, 22, 11);
    container.add(rankBg);
    
    const crownIcon = Icons.drawCrown(this, infoX + 14, 5, 7, rank.color);
    container.add(crownIcon);
    
    container.add(this.add.text(infoX + 58, 5, rank.name, {
      fontSize: '10px',
      color: hexToString(rank.color),
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    // XP бар
    const xpBarWidth = cardWidth - 140;
    const xpBarX = infoX;
    const xpBarY = 26;
    const xpNeeded = getXPForLevel(data.level);
    const xpProgress = Math.min(data.xp / xpNeeded, 1);

    const xpBar = this.add.graphics();
    xpBar.fillStyle(0x1a1a2e, 1);
    xpBar.fillRoundedRect(xpBarX, xpBarY, xpBarWidth, 14, 7);
    
    if (xpProgress > 0) {
      xpBar.fillStyle(rank.color, 1);
      xpBar.fillRoundedRect(xpBarX, xpBarY, Math.max(xpBarWidth * xpProgress, 14), 14, 7);
      
      // Блик
      xpBar.fillStyle(0xffffff, 0.2);
      xpBar.fillRoundedRect(xpBarX + 2, xpBarY + 2, Math.max(xpBarWidth * xpProgress - 4, 10), 5, 3);
    }
    
    xpBar.lineStyle(1, rank.color, 0.3);
    xpBar.strokeRoundedRect(xpBarX, xpBarY, xpBarWidth, 14, 7);
    container.add(xpBar);

    container.add(this.add.text(xpBarX + xpBarWidth / 2, xpBarY + 7, `${data.xp} / ${xpNeeded} XP`, {
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    // Валюта справа
    const currencyX = cardWidth / 2 - 20;
    
    const coinIcon = Icons.drawCoin(this, currencyX - 40, -12, 14);
    container.add(coinIcon);
    container.add(this.add.text(currencyX, -12, `${data.coins}`, {
      fontSize: '13px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
    
    const starIcon = Icons.drawStar(this, currencyX - 40, 12, 8, 0xff69b4, true);
    container.add(starIcon);
    container.add(this.add.text(currencyX, 12, `${data.stars}`, {
      fontSize: '13px',
      color: '#ff69b4',
      fontStyle: 'bold',
    }).setOrigin(1, 0.5));
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const tabY = 210;
    const tabWidth = (width - 40) / 3;
    const tabHeight = 44;

    const tabs: { id: ProfileTab; label: string; icon: string }[] = [
      { id: 'stats', label: i18n.t('stats'), icon: '📊' },
      { id: 'collection', label: i18n.t('collection'), icon: '🎨' },
      { id: 'achievements', label: i18n.t('achievements'), icon: '🏆' },
    ];

    tabs.forEach((tab, index) => {
      const x = 20 + index * tabWidth + tabWidth / 2;
      const isActive = tab.id === this.currentTab;

      const container = this.add.container(x, tabY).setDepth(50);
      const bg = this.add.graphics();

      const drawTab = (hover: boolean) => {
        bg.clear();
        
        if (isActive) {
          bg.fillStyle(colors.uiPrimary, 0.2);
          bg.fillRoundedRect(-tabWidth / 2 + 2, -tabHeight / 2, tabWidth - 4, tabHeight, 12);
          bg.lineStyle(2, colors.uiAccent, 0.8);
          bg.strokeRoundedRect(-tabWidth / 2 + 2, -tabHeight / 2, tabWidth - 4, tabHeight, 12);
          
          // Индикатор снизу
          bg.fillStyle(colors.uiAccent, 1);
          bg.fillRoundedRect(-18, tabHeight / 2 - 3, 36, 3, 2);
        } else {
          bg.fillStyle(0x12121f, hover ? 0.9 : 0.6);
          bg.fillRoundedRect(-tabWidth / 2 + 2, -tabHeight / 2, tabWidth - 4, tabHeight, 12);
          bg.lineStyle(1, colors.uiPrimary, hover ? 0.4 : 0.2);
          bg.strokeRoundedRect(-tabWidth / 2 + 2, -tabHeight / 2, tabWidth - 4, tabHeight, 12);
        }
      };

      drawTab(false);
      container.add(bg);

      // Иконка + текст вместе, центрированы
      const label = this.add.text(0, 0, `${tab.icon} ${tab.label}`, {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: isActive ? '#ffffff' : '#666677',
        fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      container.add(label);

      if (!isActive) {
        container.setInteractive(new Phaser.Geom.Rectangle(-tabWidth / 2 + 2, -tabHeight / 2, tabWidth - 4, tabHeight), Phaser.Geom.Rectangle.Contains);
        
        container.on('pointerover', () => {
          drawTab(true);
          label.setColor('#aaaaaa');
        });
        container.on('pointerout', () => {
          drawTab(false);
          label.setColor('#666677');
        });
        container.on('pointerdown', () => {
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.scene.restart();
        });
      }
    });
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, 240, width, height - 240);
    this.contentContainer = this.add.container(0, 240);
    this.contentContainer.setMask(maskShape.createGeometryMask());
  }

  private renderContent(): void {
    this.contentContainer.removeAll(true);

    switch (this.currentTab) {
      case 'stats':
        this.renderStats();
        break;
      case 'collection':
        this.renderCollection();
        break;
      case 'achievements':
        this.renderAchievements();
        break;
    }
  }

  private renderStats(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const stats = playerData.get().stats;
    const startY = 15 - this.scrollY;

    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
    const goalDiff = stats.goalsScored - stats.goalsConceded;

    const statGroups = [
      {
        title: i18n.t('totalGames'),
        color: colors.uiPrimary,
        items: [
          { label: i18n.t('totalGames'), value: stats.gamesPlayed, color: colors.uiPrimary },
          { label: i18n.t('wins'), value: stats.wins, color: 0x4ade80 },
          { label: i18n.t('losses'), value: stats.losses, color: 0xef4444 },
          { label: i18n.t('draws'), value: stats.draws, color: 0xfbbf24 },
          { label: i18n.t('winRate'), value: `${winRate}%`, color: colors.uiAccent },
        ],
      },
      {
        title: i18n.t('goalsScored'),
        color: 0x4ade80,
        items: [
          { label: i18n.t('goalsScored'), value: stats.goalsScored, color: 0x4ade80 },
          { label: i18n.t('goalsConceded'), value: stats.goalsConceded, color: 0xef4444 },
          { label: i18n.t('goalDifference'), value: goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`, color: goalDiff >= 0 ? 0x4ade80 : 0xef4444 },
        ],
      },
      {
        title: i18n.t('bestStreak'),
        color: 0xfbbf24,
        items: [
          { label: i18n.t('currentStreak'), value: stats.currentWinStreak, color: colors.uiAccent },
          { label: i18n.t('bestStreak'), value: stats.longestWinStreak, color: 0xfbbf24 },
          { label: i18n.t('perfectGames'), value: stats.perfectGames, color: 0xa855f7 },
          { label: i18n.t('playTime'), value: this.formatPlayTime(stats.totalPlayTime), color: colors.uiPrimary },
        ],
      },
    ];

    let currentY = startY;

    statGroups.forEach((group, groupIndex) => {
      // Заголовок группы
      if (groupIndex > 0) {
        currentY += 15;
      }
      
      this.contentContainer.add(this.add.text(20, currentY, group.title.toUpperCase(), {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: hexToString(group.color),
        fontStyle: 'bold',
      }));
      
      // Линия под заголовком
      const line = this.add.graphics();
      line.lineStyle(1, group.color, 0.2);
      line.lineBetween(20, currentY + 20, width - 20, currentY + 20);
      this.contentContainer.add(line);
      
      currentY += 35;

      // Элементы
      group.items.forEach((item, i) => {
        const isLast = i === group.items.length - 1;
        const itemHeight = 50;
        
        const itemBg = this.add.graphics();
        itemBg.fillStyle(0x12121f, 0.9);
        
        if (i === 0 && isLast) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, 12);
        } else if (i === 0) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, { tl: 12, tr: 12, bl: 0, br: 0 });
        } else if (isLast) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, { tl: 0, tr: 0, bl: 12, br: 12 });
        } else {
          itemBg.fillRect(20, currentY, width - 40, itemHeight);
        }
        
        // Левая цветная полоска
        itemBg.fillStyle(item.color, 0.6);
        itemBg.fillRect(20, currentY + 2, 3, itemHeight - 4);
        
        // Разделительная линия
        if (!isLast) {
          itemBg.lineStyle(1, colors.uiPrimary, 0.15);
          itemBg.lineBetween(35, currentY + itemHeight, width - 25, currentY + itemHeight);
        }
        
        this.contentContainer.add(itemBg);

        // Текст
        this.contentContainer.add(this.add.text(40, currentY + itemHeight / 2, item.label, {
          fontSize: '14px',
          color: '#aaaaaa',
        }).setOrigin(0, 0.5));

        this.contentContainer.add(this.add.text(width - 30, currentY + itemHeight / 2, String(item.value), {
          fontSize: '16px',
          color: hexToString(item.color),
          fontStyle: 'bold',
        }).setOrigin(1, 0.5));

        currentY += itemHeight;
      });

      currentY += 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 240) + 20);
  }

  private renderCollection(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    let currentY = 15 - this.scrollY;

    const sections = [
      { title: i18n.t('caps'), items: data.ownedCapSkins, type: 'cap' as const, equipped: data.equippedCapSkin },
      { title: i18n.t('balls'), items: data.ownedBallSkins, type: 'ball' as const, equipped: data.equippedBallSkin },
      { title: i18n.t('fields'), items: data.ownedFieldSkins, type: 'field' as const, equipped: data.equippedFieldSkin },
    ];

    sections.forEach((section) => {
      // Заголовок секции - фиолетовый как в настройках
      this.contentContainer.add(this.add.text(20, currentY, `${section.title.toUpperCase()} (${section.items.length})`, {
        fontSize: '13px',
        fontFamily: 'Arial',
        color: hexToString(colors.uiPrimary), // Фиолетовый вместо бирюзового
        fontStyle: 'bold',
      }));
      
      const line = this.add.graphics();
      line.lineStyle(1, colors.uiPrimary, 0.2);
      line.lineBetween(20, currentY + 22, width - 20, currentY + 22);
      this.contentContainer.add(line);
      
      currentY += 35;

      // Элементы
      section.items.forEach((owned) => {
        const skin = section.type === 'cap' 
          ? getCapSkin(owned.id) 
          : section.type === 'ball' 
            ? getBallSkin(owned.id) 
            : getFieldSkin(owned.id);
        
        if (!skin) return;

        const rarityColor = getRarityColor(skin.rarity);
        const isEquipped = section.equipped === owned.id;

        const cardHeight = 80;
        const cardBg = this.add.graphics();
        
        // Тень
        cardBg.fillStyle(0x000000, 0.2);
        cardBg.fillRoundedRect(22, currentY + 3, width - 44, cardHeight, 12);
        
        // Фон
        cardBg.fillStyle(0x12121f, 0.9);
        cardBg.fillRoundedRect(20, currentY, width - 40, cardHeight, 12);
        
        // Рамка
        if (isEquipped) {
          cardBg.lineStyle(2, colors.uiPrimary, 0.7); // Фиолетовая рамка
        } else {
          cardBg.lineStyle(1, colors.uiPrimary, 0.3);
        }
        cardBg.strokeRoundedRect(20, currentY, width - 40, cardHeight, 12);
        
        this.contentContainer.add(cardBg);

        // Превью как в магазине
        const previewX = 65;
        const previewY = currentY + cardHeight / 2;
        
        if (section.type === 'cap') {
          this.createCapPreview(previewX, previewY, skin as CapSkinData);
        } else if (section.type === 'ball') {
          this.createBallPreview(previewX, previewY, skin as BallSkinData);
        } else {
          this.createFieldPreview(previewX, previewY, skin as FieldSkinData);
        }

        // Информация
        this.contentContainer.add(this.add.text(110, currentY + 25, skin.name, {
          fontSize: '15px',
          color: '#ffffff',
          fontStyle: 'bold',
        }));

        // Бейдж редкости
        const rarityBadge = this.add.graphics();
        rarityBadge.fillStyle(rarityColor, 0.15);
        rarityBadge.fillRoundedRect(110, currentY + 45, 70, 22, 6);
        rarityBadge.lineStyle(1, rarityColor, 0.4);
        rarityBadge.strokeRoundedRect(110, currentY + 45, 70, 22, 6);
        this.contentContainer.add(rarityBadge);

        this.contentContainer.add(this.add.text(145, currentY + 56, getRarityName(skin.rarity), {
          fontSize: '10px',
          color: hexToString(rarityColor),
          fontStyle: 'bold',
        }).setOrigin(0.5, 0.5));

        // Значок экипировки
        if (isEquipped) {
          const checkContainer = this.add.container(width - 50, currentY + cardHeight / 2);
          
          const checkBg = this.add.graphics();
          checkBg.fillStyle(colors.uiPrimary, 0.2); // Фиолетовый
          checkBg.fillCircle(0, 0, 18);
          checkBg.lineStyle(2, colors.uiPrimary, 0.7);
          checkBg.strokeCircle(0, 0, 18);
          checkContainer.add(checkBg);
          
          const check = Icons.drawCheck(this, 0, 0, 10, colors.uiPrimary);
          checkContainer.add(check);
          
          this.contentContainer.add(checkContainer);
        }

        currentY += cardHeight + 10;
      });

      currentY += 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 240) + 20);
  }

  // Превью фишки как в магазине
  private createCapPreview(x: number, y: number, skin: CapSkinData): void {
    const size = 28;

    // Свечение
    if (skin.hasGlow) {
      const glow = this.add.circle(x, y, size + 10, skin.glowColor, 0.2);
      this.contentContainer.add(glow);
    }

    // Тень
    this.contentContainer.add(this.add.ellipse(x + 2, y + 18, size * 1.6, size * 0.5, 0x000000, 0.3));

    // Основной круг
    const main = this.add.circle(x, y, size, skin.primaryColor);
    main.setStrokeStyle(2, 0xffffff, 0.9);
    this.contentContainer.add(main);

    // Внутренний круг
    this.contentContainer.add(this.add.circle(x, y, size * 0.65, skin.secondaryColor, 0.5));

    // Центральный круг
    this.contentContainer.add(this.add.circle(x, y, size * 0.35, skin.primaryColor, 0.6));

    // Блик
    const highlight = this.add.ellipse(x - size * 0.35, y - size * 0.35, size * 0.4, size * 0.2, 0xffffff, 0.4);
    highlight.setAngle(-45);
    this.contentContainer.add(highlight);

    // Иконка класса
    const iconContainer = drawClassIcon(this, x, y, 'balanced', size * 0.45, 0xffffff);
    this.contentContainer.add(iconContainer);
  }

  // Превью мяча как в магазине
  private createBallPreview(x: number, y: number, skin: BallSkinData): void {
    const size = 24;

    // Свечение
    if (skin.hasGlow) {
      const glow = this.add.circle(x, y, size + 8, skin.glowColor, 0.25);
      this.contentContainer.add(glow);
    }

    // Тень
    this.contentContainer.add(this.add.ellipse(x + 2, y + 15, size * 1.4, size * 0.4, 0x000000, 0.3));

    // Основной мяч
    const ball = this.add.circle(x, y, size, skin.primaryColor);
    ball.setStrokeStyle(2, skin.secondaryColor, 0.8);
    this.contentContainer.add(ball);

    // Паттерн футбольного мяча
    const pattern = this.add.graphics();
    pattern.fillStyle(skin.secondaryColor, 0.8);

    // Центральный пятиугольник
    this.drawPentagon(pattern, x, y, size * 0.35);

    // Пятиугольники по краям
    const smallSize = size * 0.18;
    const offset = size * 0.55;
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      const px = x + Math.cos(angle) * offset;
      const py = y + Math.sin(angle) * offset;
      this.drawPentagon(pattern, px, py, smallSize);
    }

    this.contentContainer.add(pattern);

    // Блик
    const highlight = this.add.ellipse(x - size * 0.3, y - size * 0.3, size * 0.35, size * 0.18, 0xffffff, 0.5);
    highlight.setAngle(-45);
    this.contentContainer.add(highlight);
  }

  private drawPentagon(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number): void {
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 72 - 90) * Math.PI / 180;
      points.push({
        x: cx + Math.cos(angle) * size,
        y: cy + Math.sin(angle) * size
      });
    }

    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
  }

  // Превью поля как в магазине
  private createFieldPreview(x: number, y: number, skin: FieldSkinData): void {
    const fw = 70;
    const fh = 45;

    // Тень
    this.contentContainer.add(this.add.ellipse(x + 2, y + 22, fw, fh * 0.35, 0x000000, 0.2));

    const field = this.add.graphics();

    // Основное поле
    field.fillStyle(skin.fieldColor, 1);
    field.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 5);

    // Сетка
    field.lineStyle(1, skin.lineColor, 0.15);
    const gridSize = 10;
    for (let gx = x - fw / 2 + gridSize; gx < x + fw / 2; gx += gridSize) {
      field.moveTo(gx, y - fh / 2);
      field.lineTo(gx, y + fh / 2);
    }
    for (let gy = y - fh / 2 + gridSize; gy < y + fh / 2; gy += gridSize) {
      field.moveTo(x - fw / 2, gy);
      field.lineTo(x + fw / 2, gy);
    }
    field.strokePath();

    // Разметка
    field.lineStyle(1, skin.lineColor, 0.9);

    // Центральная линия
    field.moveTo(x - fw / 2, y);
    field.lineTo(x + fw / 2, y);
    field.strokePath();

    // Центральный круг
    field.strokeCircle(x, y, 10);

    // Центральная точка
    field.fillStyle(skin.lineColor, 1);
    field.fillCircle(x, y, 2);

    // Штрафные
    field.strokeRect(x - 12, y - fh / 2, 24, 8);
    field.strokeRect(x - 12, y + fh / 2 - 8, 24, 8);

    // Рамка
    field.lineStyle(2, skin.borderColor, 0.8);
    field.strokeRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 5);

    // Ворота
    field.lineStyle(2, skin.goalColor, 1);
    field.strokeRect(x - 10, y - fh / 2 - 4, 20, 4);
    field.strokeRect(x - 10, y + fh / 2, 20, 4);

    this.contentContainer.add(field);
  }

  private renderAchievements(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    let currentY = 15 - this.scrollY;

    const achievements = [
      { id: 'first_win', name: i18n.t('firstVictory'), desc: i18n.t('firstVictoryDesc'), iconDraw: Icons.drawTrophy, color: 0xfbbf24, unlocked: data.stats.wins >= 1 },
      { id: 'win_streak_3', name: i18n.t('hotStreak'), desc: i18n.t('hotStreakDesc'), iconDraw: Icons.drawFire, color: 0xf97316, unlocked: data.stats.longestWinStreak >= 3 },
      { id: 'win_streak_5', name: i18n.t('unstoppable'), desc: i18n.t('unstoppableDesc'), iconDraw: Icons.drawLightning, color: 0xeab308, unlocked: data.stats.longestWinStreak >= 5 },
      { id: 'goals_10', name: i18n.t('sharpshooter'), desc: i18n.t('sharpshooterDesc'), iconDraw: Icons.drawTarget, color: 0x3b82f6, unlocked: data.stats.goalsScored >= 10 },
      { id: 'goals_50', name: i18n.t('goalMachine'), desc: i18n.t('goalMachineDesc'), iconDraw: this.drawBallIconForAchievement.bind(this), color: 0x22c55e, unlocked: data.stats.goalsScored >= 50 },
      { id: 'perfect_game', name: i18n.t('cleanSheet'), desc: i18n.t('cleanSheetDesc'), iconDraw: Icons.drawShield, color: 0x6366f1, unlocked: data.stats.perfectGames >= 1 },
      { id: 'games_10', name: i18n.t('regularPlayer'), desc: i18n.t('regularPlayerDesc'), iconDraw: Icons.drawGamepad, color: 0x8b5cf6, unlocked: data.stats.gamesPlayed >= 10 },
      { id: 'games_50', name: i18n.t('dedicated'), desc: i18n.t('dedicatedDesc'), iconDraw: Icons.drawHeart, color: 0xec4899, unlocked: data.stats.gamesPlayed >= 50 },
      { id: 'level_10', name: i18n.t('risingStar'), desc: i18n.t('risingStarDesc'), iconDraw: Icons.drawStar, color: 0x14b8a6, unlocked: data.level >= 10 },
      { id: 'level_25', name: i18n.t('veteran'), desc: i18n.t('veteranDesc'), iconDraw: Icons.drawCrown, color: 0xf59e0b, unlocked: data.level >= 25 },
    ];

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    // Заголовок секции - фиолетовый
    this.contentContainer.add(this.add.text(20, currentY, i18n.t('achievements').toUpperCase(), {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: hexToString(colors.uiPrimary), // Фиолетовый
      fontStyle: 'bold',
    }));
    
    this.contentContainer.add(this.add.text(width - 25, currentY, `${unlockedCount}/${achievements.length}`, {
      fontSize: '13px',
      color: hexToString(colors.uiPrimary), // Фиолетовый
      fontStyle: 'bold',
    }).setOrigin(1, 0));
    
    const line = this.add.graphics();
    line.lineStyle(1, colors.uiPrimary, 0.2);
    line.lineBetween(20, currentY + 22, width - 20, currentY + 22);
    this.contentContainer.add(line);

    currentY += 35;

    // Прогресс бар
    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x12121f, 0.9);
    progressBg.fillRoundedRect(20, currentY, width - 40, 45, 12);
    progressBg.lineStyle(1, colors.uiPrimary, 0.3);
    progressBg.strokeRoundedRect(20, currentY, width - 40, 45, 12);
    this.contentContainer.add(progressBg);

    // Иконка трофея
    const trophyIcon = Icons.drawTrophy(this, 50, currentY + 22, 14, colors.uiPrimary);
    this.contentContainer.add(trophyIcon);

    // Прогресс бар справа
    const barX = 80;
    const barWidth = width - 140;
    const barY = currentY + 22;
    
    const bar = this.add.graphics();
    bar.fillStyle(0x1a1a2e, 1);
    bar.fillRoundedRect(barX, barY - 7, barWidth, 14, 7);
    
    if (unlockedCount > 0) {
      bar.fillStyle(colors.uiPrimary, 1); // Фиолетовый
      bar.fillRoundedRect(barX, barY - 7, Math.max(barWidth * (unlockedCount / achievements.length), 14), 14, 7);
    }
    
    bar.lineStyle(1, colors.uiPrimary, 0.3);
    bar.strokeRoundedRect(barX, barY - 7, barWidth, 14, 7);
    this.contentContainer.add(bar);

    this.contentContainer.add(this.add.text(barX + barWidth / 2, barY, `${Math.round((unlockedCount / achievements.length) * 100)}%`, {
      fontSize: '9px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    currentY += 60;

    // Список достижений
    achievements.forEach((achievement) => {
      const cardHeight = 80;
      const cardBg = this.add.graphics();
      
      // Тень
      cardBg.fillStyle(0x000000, achievement.unlocked ? 0.2 : 0.1);
      cardBg.fillRoundedRect(22, currentY + 3, width - 44, cardHeight, 12);
      
      // Фон
      cardBg.fillStyle(achievement.unlocked ? achievement.color : 0x12121f, achievement.unlocked ? 0.08 : 0.9);
      cardBg.fillRoundedRect(20, currentY, width - 40, cardHeight, 12);
      
      // Рамка
      cardBg.lineStyle(1.5, achievement.unlocked ? achievement.color : colors.uiPrimary, achievement.unlocked ? 0.5 : 0.2);
      cardBg.strokeRoundedRect(20, currentY, width - 40, cardHeight, 12);
      
      this.contentContainer.add(cardBg);

      // Иконка
      const iconX = 58;
      const iconY = currentY + cardHeight / 2;
      
      const iconBg = this.add.graphics();
      iconBg.fillStyle(achievement.unlocked ? achievement.color : 0x1a1a2e, achievement.unlocked ? 0.2 : 0.8);
      iconBg.fillCircle(iconX, iconY, 26);
      iconBg.lineStyle(2, achievement.unlocked ? achievement.color : 0x3a3a4a, achievement.unlocked ? 0.6 : 0.3);
      iconBg.strokeCircle(iconX, iconY, 26);
      this.contentContainer.add(iconBg);
      
      const iconColor = achievement.unlocked ? achievement.color : 0x4a4a5a;
      const icon = achievement.iconDraw(this, iconX, iconY, 14, iconColor);
      icon.setAlpha(achievement.unlocked ? 1 : 0.4);
      this.contentContainer.add(icon);

      // Название и описание
      this.contentContainer.add(this.add.text(100, currentY + 28, achievement.name, {
        fontSize: '15px',
        color: achievement.unlocked ? '#ffffff' : '#555566',
        fontStyle: 'bold',
      }));

      this.contentContainer.add(this.add.text(100, currentY + 52, achievement.desc, {
        fontSize: '12px',
        color: achievement.unlocked ? '#999999' : '#444455',
      }));

      // Статус справа
      if (achievement.unlocked) {
        const checkBg = this.add.graphics();
        checkBg.fillStyle(achievement.color, 0.2);
        checkBg.fillCircle(width - 50, iconY, 20);
        checkBg.lineStyle(2, achievement.color, 0.6);
        checkBg.strokeCircle(width - 50, iconY, 20);
        this.contentContainer.add(checkBg);
        
        const check = Icons.drawCheck(this, width - 50, iconY, 11, achievement.color);
        this.contentContainer.add(check);
      } else {
        const lockIcon = Icons.drawLock(this, width - 50, iconY, 13, 0x4a4a5a);
        lockIcon.setAlpha(0.5);
        this.contentContainer.add(lockIcon);
      }

      currentY += cardHeight + 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 240) + 20);
  }

  private drawBallIconForAchievement(scene: Phaser.Scene, x: number, y: number, size: number, color: number): Phaser.GameObjects.Graphics {
    const g = scene.add.graphics();
    g.fillStyle(color, 1);
    g.fillCircle(x, y, size);
    g.lineStyle(1.5, 0xffffff, 0.4);
    g.strokeCircle(x, y, size);
    return g;
  }

  private formatPlayTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.renderContent();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => { 
      if (p.y > 240) { 
        this.dragStartY = p.y; 
        this.isDragging = true; 
      } 
    });
    
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const delta = this.dragStartY - p.y;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.dragStartY = p.y;
        this.renderContent();
      }
    });
    
    this.input.on('pointerup', () => { 
      this.isDragging = false; 
    });
  }
}