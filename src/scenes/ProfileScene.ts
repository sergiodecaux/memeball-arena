// src/scenes/ProfileScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor, getFonts } from '../config/themes';
import { playerData, getRankByLevel, getXPForLevel } from '../data/PlayerData';
import {
  getBallSkin,
  getFieldSkin,
  getRarityName,
  BallSkinData,
  FieldSkinData,
} from '../data/SkinsCatalog';
import { getUnit } from '../data/UnitsCatalog';
import { i18n } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { AudioManager } from '../managers/AudioManager';
import { FACTIONS } from '../constants/gameConstants';

type ProfileTab = 'stats' | 'collection' | 'achievements';

export class ProfileScene extends Phaser.Scene {
  private currentTab: ProfileTab = 'stats';
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private scrollVelocity: number = 0;
  private holoRing?: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'ProfileScene' });
  }

  create(): void {
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.isDragging = false;

    this.createBackground();
    this.createHeader();
    this.createPlayerCard();
    this.createTabs();
    this.createContentArea();
    this.renderContent();
    this.setupScrolling();
  }

  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.renderContent();
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);

    this.drawRadialGradient(bg, width / 2, 0, height * 0.6, colors.backgroundGradientTop, 0.5);
    this.drawRadialGradient(bg, width / 2, height, height * 0.3, colors.uiAccentPink, 0.08);

    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x <= width; x += 50) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 50) bg.lineBetween(0, y, width, y);

    this.createParticles(12);
  }

  private drawRadialGradient(g: Phaser.GameObjects.Graphics, cx: number, cy: number, maxR: number, color: number, maxAlpha: number): void {
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
    const particleColors = [colors.uiAccent, colors.uiAccentPink, colors.uiPrimary];

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
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(2, colors.uiAccentPink, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    const backBtn = this.add.container(50, 35).setDepth(101);
    const backBg = this.add.graphics();
    const drawBackBg = (hover: boolean) => {
      backBg.clear();
      backBg.fillStyle(hover ? colors.uiAccent : 0x000000, hover ? 0.2 : 0.5);
      backBg.fillRoundedRect(-35, -16, 70, 32, 16);
      backBg.lineStyle(1, colors.glassBorder, hover ? 0.5 : 0.2);
      backBg.strokeRoundedRect(-35, -16, 70, 32, 16);
    };
    drawBackBg(false);
    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, '← MENU', { fontSize: '11px', fontFamily: fonts.tech, color: '#ffffff' }).setOrigin(0.5));

    backBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -16, 70, 32), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerover', () => { drawBackBg(true); backBtn.setScale(1.05); });
    backBtn.on('pointerout', () => { drawBackBg(false); backBtn.setScale(1); });
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.scene.start('MainMenuScene');
    });

    const titleGlow = this.add.graphics();
    titleGlow.fillStyle(colors.uiAccentPink, 0.1);
    titleGlow.fillEllipse(width / 2, 35, 140, 40);
    titleGlow.setDepth(100);

    this.add.text(width / 2, 35, i18n.t('profile').toUpperCase(), {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(101);
  }

  private createPlayerCard(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const rank = getRankByLevel(data.level);
    const nickname = playerData.getNickname ? playerData.getNickname() : data.username;
    const avatarId = playerData.getAvatarId ? playerData.getAvatarId() : undefined;

    const cardY = 135;
    const cardWidth = width - 40;
    const cardHeight = 140; // Увеличили высоту для фракции

    const container = this.add.container(width / 2, cardY);

    const glow = this.add.graphics();
    glow.lineStyle(8, rank.color, 0.1);
    glow.strokeRoundedRect(-cardWidth / 2 - 4, -cardHeight / 2 - 4, cardWidth + 8, cardHeight + 8, 18);
    container.add(glow);

    const bg = this.add.graphics();
    bg.fillStyle(0x14101e, 0.95);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);

    for (let i = 0; i < 50; i++) {
      bg.fillStyle(rank.color, 0.1 * (1 - i / 50));
      bg.fillRect(-cardWidth / 2, -cardHeight / 2 + i, cardWidth, 1);
    }

    bg.fillStyle(rank.color, 0.8);
    bg.fillRoundedRect(-40, -cardHeight / 2 + 1, 80, 3, 2);
    bg.lineStyle(2, rank.color, 0.5);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 16);
    container.add(bg);

    const avatarX = -cardWidth / 2 + 60;
    this.createAvatarWithHoloRing(container, avatarX, -10, rank, data.level, avatarId);

    const infoX = avatarX + 65;
    container.add(this.add.text(infoX, -35, nickname, { fontSize: '18px', fontFamily: fonts.tech, color: '#ffffff' }).setOrigin(0, 0.5));

    const rankBg = this.add.graphics();
    rankBg.fillStyle(rank.color, 0.15);
    rankBg.fillRoundedRect(infoX, -18, 95, 24, 12);
    rankBg.lineStyle(1, rank.color, 0.5);
    rankBg.strokeRoundedRect(infoX, -18, 95, 24, 12);
    container.add(rankBg);

    container.add(this.add.text(infoX + 16, -6, '👑', { fontSize: '10px' }).setOrigin(0.5));
    container.add(this.add.text(infoX + 60, -6, rank.name, { fontSize: '10px', fontFamily: fonts.tech, color: hexToString(rank.color) }).setOrigin(0.5));

    // === ФРАКЦИЯ ===
    const faction = playerData.getFaction();
    if (faction) {
      const factionColor = this.getFactionColor(faction);
      const factionName = this.getFactionName(faction);

      const factionBg = this.add.graphics();
      factionBg.fillStyle(factionColor, 0.15);
      factionBg.fillRoundedRect(infoX, 8, 120, 24, 12);
      factionBg.lineStyle(1, factionColor, 0.5);
      factionBg.strokeRoundedRect(infoX, 8, 120, 24, 12);
      container.add(factionBg);

      container.add(this.add.text(infoX + 16, 20, '🛸', { fontSize: '10px' }).setOrigin(0.5));
      container.add(this.add.text(infoX + 75, 20, factionName, { fontSize: '10px', fontFamily: fonts.tech, color: hexToString(factionColor) }).setOrigin(0.5));
    }

    const xpBarWidth = cardWidth - 150;
    const xpBarX = infoX;
    const xpBarY = 42;
    const xpNeeded = getXPForLevel(data.level);
    const xpProgress = Math.min(data.xp / xpNeeded, 1);

    const xpBar = this.add.graphics();
    xpBar.fillStyle(0x1a1a2e, 1);
    xpBar.fillRoundedRect(xpBarX, xpBarY, xpBarWidth, 16, 8);

    if (xpProgress > 0) {
      xpBar.fillStyle(rank.color, 1);
      xpBar.fillRoundedRect(xpBarX, xpBarY, Math.max(xpBarWidth * xpProgress, 16), 16, 8);
      xpBar.fillStyle(0xffffff, 0.15);
      xpBar.fillRoundedRect(xpBarX + 2, xpBarY + 2, Math.max(xpBarWidth * xpProgress - 4, 12), 6, 4);
    }

    xpBar.lineStyle(1, rank.color, 0.3);
    xpBar.strokeRoundedRect(xpBarX, xpBarY, xpBarWidth, 16, 8);
    container.add(xpBar);

    container.add(this.add.text(xpBarX + xpBarWidth / 2, xpBarY + 8, `${data.xp} / ${xpNeeded} XP`, { fontSize: '9px', fontFamily: fonts.tech, color: '#ffffff' }).setOrigin(0.5));

    const currencyX = cardWidth / 2 - 25;
    container.add(this.add.text(currencyX - 45, 2, '💰', { fontSize: '14px' }).setOrigin(0.5));
    container.add(this.add.text(currencyX, 2, `${data.coins}`, { fontSize: '13px', fontFamily: fonts.tech, color: hexToString(colors.uiGold) }).setOrigin(1, 0.5));
    container.add(this.add.text(currencyX - 45, 22, '💎', { fontSize: '14px' }).setOrigin(0.5));
    container.add(this.add.text(currencyX, 22, `${data.crystals}`, { fontSize: '13px', fontFamily: fonts.tech, color: '#60a5fa' }).setOrigin(1, 0.5));
  }

  private createAvatarWithHoloRing(container: Phaser.GameObjects.Container, x: number, y: number, rank: { color: number; name: string }, level: number, avatarTextureKey?: string): void {
    this.holoRing = this.add.graphics();
    this.drawHoloRing(this.holoRing, x, y, 42, rank.color);
    container.add(this.holoRing);

    this.tweens.add({ targets: this.holoRing, angle: 360, duration: 15000, repeat: -1, ease: 'Linear' });

    const avatarRadius = 32;
    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(0x1a1a2e, 1);
    avatarBg.fillCircle(x, y, avatarRadius);
    avatarBg.lineStyle(3, rank.color, 0.8);
    avatarBg.strokeCircle(x, y, avatarRadius);
    container.add(avatarBg);

    if (avatarTextureKey && this.textures.exists(avatarTextureKey)) {
      const avatarImage = this.add.image(x, y, avatarTextureKey);
      avatarImage.setDisplaySize(avatarRadius * 1.8, avatarRadius * 1.8);
      container.add(avatarImage);
    } else {
      const profileIcon = Icons.drawProfile(this, x, y, 22, 0xffffff);
      container.add(profileIcon);
    }

    const levelBadge = this.add.graphics();
    levelBadge.fillStyle(rank.color, 1);
    levelBadge.fillCircle(x + 22, y + 22, 14);
    levelBadge.lineStyle(2, 0xffffff, 1);
    levelBadge.strokeCircle(x + 22, y + 22, 14);
    container.add(levelBadge);

    container.add(this.add.text(x + 22, y + 22, `${level}`, { fontSize: '11px', fontFamily: getFonts().tech, color: '#ffffff' }).setOrigin(0.5));
  }

  private drawHoloRing(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, color: number): void {
    const segments = 24;
    g.lineStyle(2, color, 0.5);

    for (let i = 0; i < segments; i++) {
      if (i % 2 === 0) {
        const startAngle = (i / segments) * Math.PI * 2;
        const endAngle = ((i + 0.7) / segments) * Math.PI * 2;
        g.beginPath();
        g.arc(x, y, radius, startAngle, endAngle, false);
        g.strokePath();
      }
    }

    g.lineStyle(1, color, 0.2);
    g.strokeCircle(x, y, radius - 8);
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const tabY = 250;
    const tabW = (width - 50) / 3;
    const tabH = 40;
    const skewAngle = -12;

    const tabs: { id: ProfileTab; label: string; icon: string }[] = [
      { id: 'stats', label: i18n.t('stats'), icon: '📊' },
      { id: 'collection', label: i18n.t('collection'), icon: '🎨' },
      { id: 'achievements', label: i18n.t('achievements'), icon: '🏆' },
    ];

    tabs.forEach((tab, index) => {
      const x = 25 + index * (tabW + 5);
      const isActive = tab.id === this.currentTab;
      const container = this.add.container(x + tabW / 2, tabY).setDepth(50);

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, true);
        bg.lineStyle(2, colors.uiAccent, 0.8);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, false);
      } else {
        bg.lineStyle(1.5, colors.uiAccent, 0.6);
        this.drawSkewedRect(bg, -tabW / 2, -tabH / 2, tabW, tabH, skewAngle, false);
      }
      container.add(bg);

      container.add(this.add.text(0, 0, `${tab.icon} ${tab.label.toUpperCase()}`, {
        fontSize: '11px',
        fontFamily: fonts.tech,
        color: isActive ? '#000000' : hexToString(colors.uiAccent),
        fontStyle: 'bold',
      }).setOrigin(0.5));

      if (!isActive) {
        const hit = this.add.rectangle(0, 0, tabW, tabH, 0x000000, 0).setInteractive({ useHandCursor: true });
        container.add(hit);
        hit.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.05, duration: 80 }));
        hit.on('pointerout', () => this.tweens.add({ targets: container, scale: 1, duration: 80 }));
        hit.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click');
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.scene.restart();
        });
      }
    });
  }

  private drawSkewedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, skewDeg: number, fill: boolean): void {
    const skewRad = Phaser.Math.DegToRad(skewDeg);
    const skewOffset = Math.tan(skewRad) * h;
    const pts = [
      { x: x - skewOffset / 2, y },
      { x: x + w - skewOffset / 2, y },
      { x: x + w + skewOffset / 2, y: y + h },
      { x: x + skewOffset / 2, y: y + h },
    ];
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    pts.forEach((p) => g.lineTo(p.x, p.y));
    g.closePath();
    if (fill) g.fillPath();
    else g.strokePath();
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, 280, width, height - 280);
    const mask = maskShape.createGeometryMask();
    maskShape.setVisible(false);

    this.contentContainer = this.add.container(0, 280);
    this.contentContainer.setMask(mask);
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
    const fonts = getFonts();
    const stats = playerData.get().stats;
    const startY = 15 - this.scrollY;

    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
    const goalDiff = stats.goalsScored - stats.goalsConceded;

    const statGroups = [
      {
        title: '🎮 ' + i18n.t('totalGames'),
        color: colors.uiAccent,
        items: [
          { label: i18n.t('totalGames'), value: stats.gamesPlayed, color: colors.uiAccent },
          { label: i18n.t('wins'), value: stats.wins, color: 0x4ade80 },
          { label: i18n.t('losses'), value: stats.losses, color: 0xef4444 },
          { label: i18n.t('draws'), value: stats.draws, color: colors.uiGold },
          { label: i18n.t('winRate'), value: `${winRate}%`, color: colors.uiAccentPink },
        ],
      },
      {
        title: '⚽ ' + i18n.t('goalsScored'),
        color: 0x4ade80,
        items: [
          { label: i18n.t('goalsScored'), value: stats.goalsScored, color: 0x4ade80 },
          { label: i18n.t('goalsConceded'), value: stats.goalsConceded, color: 0xef4444 },
          { label: i18n.t('goalDifference'), value: goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`, color: goalDiff >= 0 ? 0x4ade80 : 0xef4444 },
        ],
      },
      {
        title: '🔥 ' + i18n.t('bestStreak'),
        color: colors.uiGold,
        items: [
          { label: i18n.t('currentStreak'), value: stats.currentWinStreak, color: colors.uiAccent },
          { label: i18n.t('bestStreak'), value: stats.longestWinStreak, color: colors.uiGold },
          { label: i18n.t('perfectGames'), value: stats.perfectGames, color: colors.uiAccentPink },
          { label: i18n.t('playTime'), value: this.formatPlayTime(stats.totalPlayTime), color: colors.uiPrimary },
        ],
      },
    ];

    let currentY = startY;

    statGroups.forEach((group, groupIndex) => {
      if (groupIndex > 0) currentY += 15;

      this.contentContainer.add(this.add.text(25, currentY, group.title.toUpperCase(), { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(group.color), letterSpacing: 1 }));

      const line = this.add.graphics();
      line.lineStyle(1, group.color, 0.2);
      line.lineBetween(25, currentY + 20, width - 25, currentY + 20);
      this.contentContainer.add(line);

      currentY += 35;

      group.items.forEach((item, i) => {
        const isLast = i === group.items.length - 1;
        const itemHeight = 52;

        const itemBg = this.add.graphics();
        itemBg.fillStyle(0x14101e, 0.9);

        if (i === 0 && isLast) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, 12);
        } else if (i === 0) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, { tl: 12, tr: 12, bl: 0, br: 0 } as any);
        } else if (isLast) {
          itemBg.fillRoundedRect(20, currentY, width - 40, itemHeight, { tl: 0, tr: 0, bl: 12, br: 12 } as any);
        } else {
          itemBg.fillRect(20, currentY, width - 40, itemHeight);
        }

        itemBg.fillStyle(item.color, 0.6);
        itemBg.fillRect(20, currentY + 2, 3, itemHeight - 4);

        if (!isLast) {
          itemBg.lineStyle(1, colors.glassBorder, 0.1);
          itemBg.lineBetween(35, currentY + itemHeight, width - 25, currentY + itemHeight);
        }

        this.contentContainer.add(itemBg);
        this.contentContainer.add(this.add.text(40, currentY + itemHeight / 2, item.label, { fontSize: '13px', fontFamily: fonts.tech, color: '#aaaaaa' }).setOrigin(0, 0.5));
        this.contentContainer.add(this.add.text(width - 35, currentY + itemHeight / 2, String(item.value), { fontSize: '16px', fontFamily: fonts.tech, color: hexToString(item.color) }).setOrigin(1, 0.5));

        currentY += itemHeight;
      });

      currentY += 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 280) + 20);
  }

  private renderCollection(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    let currentY = 15 - this.scrollY;

    const faction = playerData.getFaction();

    const sections: any[] = [];

    // Если есть фракция — показываем юнитов
    if (faction) {
      const ownedUnits = playerData.getOwnedUnits(faction);
      sections.push({ title: `🛸 UNITS (${this.getFactionName(faction)})`, items: ownedUnits, type: 'unit' as const, equipped: undefined });
    }

    // Мячи и поля
    sections.push({ title: '⚽ ' + i18n.t('balls'), items: data.ownedBallSkins, type: 'ball' as const, equipped: data.equippedBallSkin });
    sections.push({ title: '🏟️ ' + i18n.t('fields'), items: data.ownedFieldSkins, type: 'field' as const, equipped: data.equippedFieldSkin });

    sections.forEach((section) => {
      this.contentContainer.add(this.add.text(25, currentY, `${section.title.toUpperCase()} (${section.items.length})`, { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent), letterSpacing: 1 }));

      const line = this.add.graphics();
      line.lineStyle(1, colors.uiAccent, 0.2);
      line.lineBetween(25, currentY + 20, width - 25, currentY + 20);
      this.contentContainer.add(line);

      currentY += 35;

      section.items.forEach((owned: any) => {
        let skin: any;
        let rarityColor: number;
        let isEquipped = false;
        let cardHeight = 85;

        if (section.type === 'unit') {
          skin = getUnit(owned.id);
          if (!skin) return;
          rarityColor = this.getFactionColor(skin.factionId);
        } else if (section.type === 'ball') {
          skin = getBallSkin(owned.id);
          if (!skin) return;
          rarityColor = getRarityColor(skin.rarity);
          isEquipped = section.equipped === owned.id;
        } else {
          skin = getFieldSkin(owned.id);
          if (!skin) return;
          rarityColor = getRarityColor(skin.rarity);
          isEquipped = section.equipped === owned.id;
        }

        const cardBg = this.add.graphics();
        if (isEquipped) {
          cardBg.lineStyle(4, colors.uiAccent, 0.15);
          cardBg.strokeRoundedRect(18, currentY - 2, width - 36, cardHeight + 4, 14);
        }
        cardBg.fillStyle(0x14101e, 0.95);
        cardBg.fillRoundedRect(20, currentY, width - 40, cardHeight, 12);
        cardBg.fillStyle(0x000000, 0.3);
        cardBg.fillRoundedRect(24, currentY + 4, 75, cardHeight - 8, { tl: 10, tr: 0, bl: 10, br: 0 } as any);
        cardBg.lineStyle(1.5, isEquipped ? colors.uiAccent : colors.glassBorder, isEquipped ? 0.6 : 0.15);
        cardBg.strokeRoundedRect(20, currentY, width - 40, cardHeight, 12);
        this.contentContainer.add(cardBg);

        const previewX = 62;
        const previewY = currentY + cardHeight / 2;

        if (section.type === 'unit') {
          this.createUnitPreview(previewX, previewY, skin);
        } else if (section.type === 'ball') {
          this.createBallPreview(previewX, previewY, skin);
        } else {
          this.createFieldPreview(previewX, previewY, skin);
        }

        this.contentContainer.add(this.add.text(115, currentY + 25, skin.name, { fontSize: '14px', fontFamily: fonts.tech, color: '#ffffff' }));

        const rarityBadge = this.add.graphics();
        rarityBadge.fillStyle(rarityColor, 0.15);
        rarityBadge.fillRoundedRect(115, currentY + 45, 70, 22, 6);
        rarityBadge.lineStyle(1, rarityColor, 0.4);
        rarityBadge.strokeRoundedRect(115, currentY + 45, 70, 22, 6);
        this.contentContainer.add(rarityBadge);

        if (section.type === 'unit') {
          this.contentContainer.add(this.add.text(150, currentY + 56, skin.capClass.toUpperCase(), { fontSize: '9px', fontFamily: fonts.tech, color: hexToString(rarityColor) }).setOrigin(0.5));
        } else {
          this.contentContainer.add(this.add.text(150, currentY + 56, getRarityName(skin.rarity).toUpperCase(), { fontSize: '9px', fontFamily: fonts.tech, color: hexToString(rarityColor) }).setOrigin(0.5));
        }

        if (isEquipped) {
          const checkContainer = this.add.container(width - 55, currentY + cardHeight / 2);
          const checkBg = this.add.graphics();
          checkBg.fillStyle(colors.uiAccent, 0.15);
          checkBg.fillCircle(0, 0, 18);
          checkBg.lineStyle(2, colors.uiAccent, 0.6);
          checkBg.strokeCircle(0, 0, 18);
          checkContainer.add(checkBg);
          checkContainer.add(this.add.text(0, 0, '✓', { fontSize: '14px', color: hexToString(colors.uiAccent) }).setOrigin(0.5));
          this.contentContainer.add(checkContainer);
        }

        currentY += cardHeight + 10;
      });

      currentY += 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 280) + 20);
  }

  private createUnitPreview(x: number, y: number, unit: any): void {
    const factionColor = this.getFactionColor(unit.factionId);
    const g = this.add.graphics();
    g.fillStyle(factionColor, 0.3);
    g.fillCircle(x, y, 26);
    g.lineStyle(2, factionColor, 0.7);
    g.strokeCircle(x, y, 26);
    this.contentContainer.add(g);
  }

  private createBallPreview(x: number, y: number, skin: BallSkinData): void {
    const size = 22;
    if (skin.hasGlow) {
      this.contentContainer.add(this.add.circle(x, y, size + 6, skin.glowColor, 0.2));
    }
    this.contentContainer.add(this.add.ellipse(x + 2, y + 2, size * 1.4, size * 1, 0x000000, 0.25));

    const texKey = skin.textureKey;
    if (texKey && this.textures.exists(texKey)) {
      this.contentContainer.add(this.add.sprite(x, y, texKey).setScale((size * 2) / 64));
    } else {
      const ball = this.add.circle(x, y, size, skin.primaryColor);
      ball.setStrokeStyle(2, skin.secondaryColor || skin.glowColor);
      this.contentContainer.add(ball);
    }
  }

  private createFieldPreview(x: number, y: number, skin: FieldSkinData): void {
    const fw = 65, fh = 42;
    const field = this.add.graphics();
    field.fillStyle(skin.fieldColor, 1);
    field.fillRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 4);
    field.lineStyle(1, skin.lineColor, 0.6);
    field.lineBetween(x - fw / 2, y, x + fw / 2, y);
    field.strokeCircle(x, y, 8);
    field.lineStyle(1.5, skin.borderColor);
    field.strokeRoundedRect(x - fw / 2, y - fh / 2, fw, fh, 4);
    field.lineStyle(1.5, skin.goalColor);
    field.strokeRect(x - 12, y - fh / 2 - 2, 24, 3);
    field.strokeRect(x - 12, y + fh / 2 - 1, 24, 3);
    this.contentContainer.add(field);
  }

  private renderAchievements(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    let currentY = 15 - this.scrollY;

    const achievements = [
      { id: 'first_win', name: i18n.t('firstVictory'), desc: i18n.t('firstVictoryDesc'), icon: '🏆', color: colors.uiGold, unlocked: data.stats.wins >= 1 },
      { id: 'win_streak_3', name: i18n.t('hotStreak'), desc: i18n.t('hotStreakDesc'), icon: '🔥', color: 0xf97316, unlocked: data.stats.longestWinStreak >= 3 },
      { id: 'win_streak_5', name: i18n.t('unstoppable'), desc: i18n.t('unstoppableDesc'), icon: '⚡', color: colors.uiGold, unlocked: data.stats.longestWinStreak >= 5 },
      { id: 'goals_10', name: i18n.t('sharpshooter'), desc: i18n.t('sharpshooterDesc'), icon: '🎯', color: 0x3b82f6, unlocked: data.stats.goalsScored >= 10 },
      { id: 'goals_50', name: i18n.t('goalMachine'), desc: i18n.t('goalMachineDesc'), icon: '⚽', color: 0x22c55e, unlocked: data.stats.goalsScored >= 50 },
      { id: 'perfect_game', name: i18n.t('cleanSheet'), desc: i18n.t('cleanSheetDesc'), icon: '🛡️', color: colors.uiAccent, unlocked: data.stats.perfectGames >= 1 },
      { id: 'games_10', name: i18n.t('regularPlayer'), desc: i18n.t('regularPlayerDesc'), icon: '🎮', color: colors.uiPrimary, unlocked: data.stats.gamesPlayed >= 10 },
      { id: 'games_50', name: i18n.t('dedicated'), desc: i18n.t('dedicatedDesc'), icon: '❤️', color: colors.uiAccentPink, unlocked: data.stats.gamesPlayed >= 50 },
      { id: 'level_10', name: i18n.t('risingStar'), desc: i18n.t('risingStarDesc'), icon: '⭐', color: colors.uiAccent, unlocked: data.level >= 10 },
      { id: 'level_25', name: i18n.t('veteran'), desc: i18n.t('veteranDesc'), icon: '👑', color: colors.uiGold, unlocked: data.level >= 25 },
    ];

    const unlockedCount = achievements.filter((a) => a.unlocked).length;

    this.contentContainer.add(this.add.text(25, currentY, ('🏆 ' + i18n.t('achievements')).toUpperCase(), { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent), letterSpacing: 1 }));
    this.contentContainer.add(this.add.text(width - 30, currentY, `${unlockedCount}/${achievements.length}`, { fontSize: '12px', fontFamily: fonts.tech, color: hexToString(colors.uiAccent) }).setOrigin(1, 0));

    const line = this.add.graphics();
    line.lineStyle(1, colors.uiAccent, 0.2);
    line.lineBetween(25, currentY + 20, width - 25, currentY + 20);
    this.contentContainer.add(line);

    currentY += 35;

    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x14101e, 0.95);
    progressBg.fillRoundedRect(20, currentY, width - 40, 50, 12);
    progressBg.lineStyle(1, colors.glassBorder, 0.15);
    progressBg.strokeRoundedRect(20, currentY, width - 40, 50, 12);
    this.contentContainer.add(progressBg);

    this.contentContainer.add(this.add.text(50, currentY + 25, '🏆', { fontSize: '18px' }).setOrigin(0.5));

    const barX = 85;
    const barWidth = width - 155;
    const barY = currentY + 25;
    const progress = unlockedCount / achievements.length;

    const bar = this.add.graphics();
    bar.fillStyle(0x1a1a2e, 1);
    bar.fillRoundedRect(barX, barY - 8, barWidth, 16, 8);

    if (progress > 0) {
      bar.fillStyle(colors.uiAccent, 1);
      bar.fillRoundedRect(barX, barY - 8, Math.max(barWidth * progress, 16), 16, 8);
      bar.fillStyle(0xffffff, 0.15);
      bar.fillRoundedRect(barX + 2, barY - 6, Math.max(barWidth * progress - 4, 12), 6, 4);
    }

    bar.lineStyle(1, colors.uiAccent, 0.3);
    bar.strokeRoundedRect(barX, barY - 8, barWidth, 16, 8);
    this.contentContainer.add(bar);

    this.contentContainer.add(this.add.text(barX + barWidth / 2, barY, `${Math.round(progress * 100)}%`, { fontSize: '10px', fontFamily: fonts.tech, color: '#ffffff' }).setOrigin(0.5));

    currentY += 65;

    achievements.forEach((achievement) => {
      const cardHeight = 80;
      const cardBg = this.add.graphics();

      cardBg.fillStyle(achievement.unlocked ? achievement.color : 0x14101e, achievement.unlocked ? 0.08 : 0.95);
      cardBg.fillRoundedRect(20, currentY, width - 40, cardHeight, 12);
      cardBg.lineStyle(1.5, achievement.unlocked ? achievement.color : colors.glassBorder, achievement.unlocked ? 0.5 : 0.15);
      cardBg.strokeRoundedRect(20, currentY, width - 40, cardHeight, 12);
      this.contentContainer.add(cardBg);

      const iconX = 58;
      const iconY = currentY + cardHeight / 2;

      const iconBg = this.add.graphics();
      iconBg.fillStyle(achievement.unlocked ? achievement.color : 0x1a1a2e, achievement.unlocked ? 0.2 : 0.8);
      iconBg.fillCircle(iconX, iconY, 24);
      iconBg.lineStyle(2, achievement.unlocked ? achievement.color : 0x3a3a4a, achievement.unlocked ? 0.6 : 0.2);
      iconBg.strokeCircle(iconX, iconY, 24);
      this.contentContainer.add(iconBg);

      const iconText = this.add.text(iconX, iconY, achievement.icon, { fontSize: '20px' }).setOrigin(0.5);
      iconText.setAlpha(achievement.unlocked ? 1 : 0.3);
      this.contentContainer.add(iconText);

      this.contentContainer.add(this.add.text(100, currentY + 26, achievement.name, { fontSize: '14px', fontFamily: fonts.tech, color: achievement.unlocked ? '#ffffff' : '#555566' }));
      this.contentContainer.add(this.add.text(100, currentY + 48, achievement.desc, { fontSize: '11px', color: achievement.unlocked ? '#999999' : '#444455' }));

      if (achievement.unlocked) {
        const checkBg = this.add.graphics();
        checkBg.fillStyle(achievement.color, 0.15);
        checkBg.fillCircle(width - 55, iconY, 18);
        checkBg.lineStyle(2, achievement.color, 0.6);
        checkBg.strokeCircle(width - 55, iconY, 18);
        this.contentContainer.add(checkBg);
        this.contentContainer.add(this.add.text(width - 55, iconY, '✓', { fontSize: '14px', color: hexToString(achievement.color) }).setOrigin(0.5));
      } else {
        this.contentContainer.add(this.add.text(width - 55, iconY, '🔒', { fontSize: '16px' }).setOrigin(0.5).setAlpha(0.3));
      }

      currentY += cardHeight + 10;
    });

    this.maxScrollY = Math.max(0, currentY + this.scrollY - (this.cameras.main.height - 280) + 20);
  }

  private formatPlayTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private getFactionColor(faction: string): number {
    switch (faction) {
      case 'magma': return 0xff4500;
      case 'cyborg': return 0x00f2ff;
      case 'void': return 0x9d00ff;
      case 'insect': return 0x39ff14;
      default: return 0x00f2ff;
    }
  }

  private getFactionName(faction: string): string {
    switch (faction) {
      case 'magma': return 'Magma Brutes';
      case 'cyborg': return 'Terran Cyborgs';
      case 'void': return 'Void Walkers';
      case 'insect': return 'Xeno Swarm';
      default: return 'Unknown';
    }
  }

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.scrollVelocity = 0;
      this.renderContent();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 280) {
        this.dragStartY = p.y;
        this.isDragging = true;
        this.scrollVelocity = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const delta = this.dragStartY - p.y;
        this.scrollVelocity = delta;
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