// src/scenes/TacticsScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor } from '../config/themes';
import { playerData, DEFAULT_FORMATIONS } from '../data/PlayerData';
import { getCapSkin, getRarityName, getUpgradeCost, MAX_CAP_LEVEL, getTotalBonusAtLevel, CapSkinData, CAP_SKINS } from '../data/SkinsCatalog';
import { i18n } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { drawClassIcon, getClassColor } from '../ui/ClassIcons';
import { Formation, FormationSlot } from '../types';
import { CapClass } from '../constants/gameConstants';

type TacticsTab = 'upgrade' | 'formation';

const CLASS_CONFIG: Record<CapClass, { icon: string; color: number; short: string }> = {
  balanced: { icon: '⭐', color: 0x22c55e, short: 'BAL' },
  tank: { icon: '🛡️', color: 0x3b82f6, short: 'TNK' },
  sniper: { icon: '🎯', color: 0xef4444, short: 'SNP' },
  trickster: { icon: '🌀', color: 0xa855f7, short: 'TRK' },
};

interface UpgradeCard {
  container: Phaser.GameObjects.Container;
  baseY: number;
}

export class TacticsScene extends Phaser.Scene {
  private currentTab: TacticsTab = 'upgrade';
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private scrollVelocity: number = 0;
  
  // Оптимизация - храним карточки
  private upgradeCards: UpgradeCard[] = [];
  private visibleAreaTop: number = 0;
  private visibleAreaBottom: number = 0;
  
  // Редактор формаций
  private isEditingFormation: boolean = false;
  private editingFormationId: string | null = null;
  private formationEditorContainer: Phaser.GameObjects.Container | null = null;
  private capMarkers: Phaser.GameObjects.Container[] = [];
  private tempSlots: FormationSlot[] = [];

  constructor() {
    super({ key: 'TacticsScene' });
  }

  create(): void {
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.isDragging = false;
    this.isEditingFormation = false;
    this.upgradeCards = [];
    
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createContentArea();
    this.createContent();
    this.setupScrolling();
    this.updateCardPositions();
  }

  update(): void {
    // Инерционный скролл
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.updateCardPositions();
    }
  }

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 1);
    bg.fillRect(0, 0, width, height);

    // Простой градиент
    for (let i = 0; i < 150; i++) {
      bg.fillStyle(colors.uiPrimary, 0.08 * (1 - i / 150));
      bg.fillRect(0, i, width, 1);
    }

    // Сетка (реже)
    bg.lineStyle(1, colors.uiPrimary, 0.02);
    for (let x = 0; x <= width; x += 60) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 60) bg.lineBetween(0, y, width, y);
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.6);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(1, colors.uiPrimary, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    // Кнопка назад
    const backBtn = this.add.container(45, 35).setDepth(101);
    const backBg = this.add.graphics();
    backBg.fillStyle(0x000000, 0.5);
    backBg.fillCircle(0, 0, 20);
    backBg.lineStyle(2, colors.uiAccent, 0.5);
    backBg.strokeCircle(0, 0, 20);
    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, '←', { fontSize: '18px', color: hexToString(colors.uiAccent) }).setOrigin(0.5));
    backBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
    backBtn.on('pointerdown', () => this.scene.start('MainMenuScene'));

    // Заголовок
    this.add.text(width / 2, 35, i18n.t('tactics').toUpperCase(), {
      fontSize: '22px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);

    // Монеты
    const coinBg = this.add.graphics();
    coinBg.fillStyle(0x000000, 0.5);
    coinBg.fillRoundedRect(width - 100, 18, 85, 34, 17);
    coinBg.setDepth(101);

    this.add.text(width - 85, 35, '💰', { fontSize: '14px' }).setOrigin(0, 0.5).setDepth(101);
    this.add.text(width - 65, 35, `${data.coins}`, {
      fontSize: '14px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const tabY = 100;
    const tabW = (width - 30) / 2;
    const tabH = 40;

    const tabs: { id: TacticsTab; label: string; icon: string }[] = [
      { id: 'upgrade', label: i18n.t('upgrades'), icon: '⬆️' },
      { id: 'formation', label: i18n.t('formation'), icon: '📐' },
    ];

    tabs.forEach((tab, i) => {
      const x = 15 + i * tabW + tabW / 2;
      const isActive = tab.id === this.currentTab;

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiPrimary, 0.25);
        bg.fillRoundedRect(x - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 10);
        bg.lineStyle(2, colors.uiAccent, 0.8);
        bg.strokeRoundedRect(x - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 10);
      } else {
        bg.fillStyle(0x000000, 0.4);
        bg.fillRoundedRect(x - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 10);
        bg.lineStyle(1, colors.uiPrimary, 0.3);
        bg.strokeRoundedRect(x - tabW / 2 + 2, tabY - tabH / 2, tabW - 4, tabH, 10);
      }
      bg.setDepth(50);

      const label = this.add.text(x, tabY, `${tab.icon} ${tab.label}`, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: isActive ? '#ffffff' : '#666677',
      }).setOrigin(0.5).setDepth(50);

      if (!isActive) {
        const hit = this.add.rectangle(x, tabY, tabW - 4, tabH, 0, 0).setInteractive({ useHandCursor: true }).setDepth(50);
        hit.on('pointerdown', () => {
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.scene.restart();
        });
      }
    });
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    this.visibleAreaTop = 130;
    this.visibleAreaBottom = height;

    const mask = this.add.graphics();
    mask.fillStyle(0xffffff);
    mask.fillRect(0, this.visibleAreaTop, width, height - this.visibleAreaTop);

    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setMask(mask.createGeometryMask());
  }

  private createContent(): void {
    switch (this.currentTab) {
      case 'upgrade':
        this.createUpgradeCards();
        break;
      case 'formation':
        this.createFormationCards();
        break;
    }
  }

  private updateCardPositions(): void {
    this.contentContainer.y = -this.scrollY;

    // Скрываем карточки вне видимости
    const viewTop = this.scrollY - 50;
    const viewBottom = this.scrollY + (this.visibleAreaBottom - this.visibleAreaTop) + 50;

    this.upgradeCards.forEach(card => {
      const cardTop = card.baseY - this.visibleAreaTop;
      const cardBottom = cardTop + 160;
      card.container.setVisible(cardBottom > viewTop && cardTop < viewBottom);
    });
  }

  // ==================== УЛУЧШЕНИЯ ====================

  private createUpgradeCards(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    const cardHeight = 150;
    const gap = 12;

    let y = this.visibleAreaTop + 15;

    // Заголовок
    const header = this.add.container(0, y);
    header.add(this.add.text(20, 0, i18n.t('yourCaps').toUpperCase(), {
      fontSize: '12px',
      color: hexToString(colors.uiPrimary),
      fontStyle: 'bold',
    }));
    const line = this.add.graphics();
    line.lineStyle(1, colors.uiPrimary, 0.2);
    line.lineBetween(20, 20, width - 20, 20);
    header.add(line);
    this.contentContainer.add(header);

    y += 35;

    // Карточки
    data.ownedCapSkins.forEach((owned) => {
      const skinData = getCapSkin(owned.id);
      if (!skinData) return;

      const card = this.createUpgradeCard(y, owned, skinData, width, cardHeight);
      this.contentContainer.add(card);
      this.upgradeCards.push({ container: card, baseY: y });

      y += cardHeight + gap;
    });

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 20);
  }

  private createUpgradeCard(
    y: number,
    owned: { id: string; level: number },
    skin: CapSkinData,
    width: number,
    h: number
  ): Phaser.GameObjects.Container {
    const colors = getColors();
    const container = this.add.container(0, y);
    const rarityColor = getRarityColor(skin.rarity);
    const isMaxLevel = owned.level >= MAX_CAP_LEVEL;
    const upgradeCost = getUpgradeCost(owned.id, owned.level);
    const canAfford = playerData.get().coins >= upgradeCost;
    const bonuses = getTotalBonusAtLevel(skin, owned.level);
    const nextBonuses = !isMaxLevel ? getTotalBonusAtLevel(skin, owned.level + 1) : bonuses;
    const isEquipped = playerData.get().equippedCapSkin === owned.id;

    // Фон
    const bg = this.add.graphics();
    if (isEquipped) {
      bg.lineStyle(3, rarityColor, 0.3);
      bg.strokeRoundedRect(18, -2, width - 36, h + 4, 14);
    }
    bg.fillStyle(0x0a0a15, 0.95);
    bg.fillRoundedRect(20, 0, width - 40, h, 12);
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(24, 4, 75, h - 8, { tl: 10, tr: 0, bl: 10, br: 0 });
    bg.lineStyle(1.5, rarityColor, isEquipped ? 0.7 : 0.3);
    bg.strokeRoundedRect(20, 0, width - 40, h, 12);
    container.add(bg);

    // Бейдж редкости
    const badge = this.add.graphics();
    badge.fillStyle(rarityColor, 0.2);
    badge.fillRoundedRect(28, 8, 50, 16, 4);
    container.add(badge);
    container.add(this.add.text(53, 16, getRarityName(skin.rarity).toUpperCase(), {
      fontSize: '7px',
      color: hexToString(rarityColor),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Превью
    this.addCapPreview(container, 62, 70, skin, 26);

    // Equipped бейдж
    if (isEquipped) {
      const eqBg = this.add.graphics();
      eqBg.fillStyle(colors.uiAccent, 0.2);
      eqBg.fillRoundedRect(35, 105, 54, 16, 8);
      container.add(eqBg);
      container.add(this.add.text(62, 113, '✓ EQUIPPED', {
        fontSize: '7px',
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    // Название
    container.add(this.add.text(110, 12, skin.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }));

    // Уровень
    const lvlBg = this.add.graphics();
    lvlBg.fillStyle(rarityColor, 0.15);
    lvlBg.fillRoundedRect(110, 32, 55, 18, 5);
    container.add(lvlBg);
    container.add(this.add.text(137, 41, `Lv.${owned.level}`, {
      fontSize: '10px',
      color: hexToString(rarityColor),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Статы
    const stats = [
      { icon: '⚡', val: bonuses.power, next: nextBonuses.power, col: 0xef4444 },
      { icon: '💨', val: bonuses.speed, next: nextBonuses.speed, col: 0x22c55e },
      { icon: '🎯', val: bonuses.control, next: nextBonuses.control, col: 0x3b82f6 },
      { icon: '⚖️', val: bonuses.weight, next: nextBonuses.weight, col: 0xfbbf24 },
    ];

    stats.forEach((s, i) => {
      const sx = 110 + (i % 2) * 65;
      const sy = 58 + Math.floor(i / 2) * 20;
      container.add(this.add.text(sx, sy, s.icon, { fontSize: '10px' }));
      container.add(this.add.text(sx + 16, sy, `+${s.val}%`, {
        fontSize: '10px',
        color: hexToString(s.col),
        fontStyle: 'bold',
      }));
      if (!isMaxLevel && s.next > s.val) {
        container.add(this.add.text(sx + 48, sy, `→${s.next}`, {
          fontSize: '8px',
          color: '#4ade80',
        }));
      }
    });

    // Прогресс-бар
    const progX = 110;
    const progY = h - 18;
    const progW = width - 190;
    const prog = owned.level / MAX_CAP_LEVEL;

    const progBg = this.add.graphics();
    progBg.fillStyle(0x1a1a2e, 1);
    progBg.fillRoundedRect(progX, progY, progW, 8, 4);
    progBg.fillStyle(rarityColor, 1);
    progBg.fillRoundedRect(progX, progY, Math.max(progW * prog, 8), 8, 4);
    container.add(progBg);

    container.add(this.add.text(progX + progW + 6, progY + 4, `${owned.level}/${MAX_CAP_LEVEL}`, {
      fontSize: '8px',
      color: '#666666',
    }).setOrigin(0, 0.5));

    // Кнопка
    const btnX = width - 65;
    const btnY = h / 2;
    const btnW = 60;
    const btnH = 55;

    if (isMaxLevel) {
      const maxBg = this.add.graphics();
      maxBg.fillStyle(0xfbbf24, 0.15);
      maxBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      maxBg.lineStyle(1.5, 0xfbbf24, 0.5);
      maxBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      container.add(maxBg);
      container.add(this.add.text(btnX, btnY - 6, '👑', { fontSize: '16px' }).setOrigin(0.5));
      container.add(this.add.text(btnX, btnY + 12, 'MAX', {
        fontSize: '11px',
        color: '#fbbf24',
        fontStyle: 'bold',
      }).setOrigin(0.5));
    } else {
      const btnCol = canAfford ? colors.uiAccent : 0x555555;
      const btnBg = this.add.graphics();
      btnBg.fillStyle(btnCol, 0.15);
      btnBg.fillRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      btnBg.lineStyle(1.5, btnCol, 0.5);
      btnBg.strokeRoundedRect(btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 8);
      container.add(btnBg);

      container.add(this.add.text(btnX, btnY - 10, '⬆️', { fontSize: '14px' }).setOrigin(0.5));
      container.add(this.add.text(btnX, btnY + 6, `💰${upgradeCost}`, {
        fontSize: '9px',
        color: canAfford ? '#ffd700' : '#555555',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      if (canAfford) {
        const hit = this.add.rectangle(btnX, btnY, btnW, btnH, 0, 0).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          if (playerData.upgradeCapSkin(owned.id)) {
            this.scene.restart();
          }
        });
        container.add(hit);
      }
    }

    return container;
  }

  private addCapPreview(container: Phaser.GameObjects.Container, x: number, y: number, skin: CapSkinData, radius: number): void {
    // Свечение
    if (skin.hasGlow) {
      container.add(this.add.circle(x, y, radius + 6, skin.glowColor || skin.primaryColor, 0.2));
    }

    // Тень
    container.add(this.add.ellipse(x + 2, y + 2, radius * 1.7, radius * 1.3, 0x000000, 0.25));

    // Текстура или fallback
    const texKey = skin.visual?.textureKey;
    if (texKey && this.textures.exists(texKey)) {
      container.add(this.add.sprite(x, y, texKey).setScale((radius * 2) / 128));
    } else {
      const g = this.add.graphics();
      g.fillStyle(skin.primaryColor);
      g.fillCircle(x, y, radius);
      g.lineStyle(2, skin.secondaryColor);
      g.strokeCircle(x, y, radius);
      g.fillStyle(0xffffff, 0.2);
      g.fillEllipse(x - radius * 0.3, y - radius * 0.3, radius * 0.4, radius * 0.3);
      container.add(g);
    }
  }

  // ==================== ФОРМАЦИИ ====================

  private createFormationCards(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const formations = playerData.getAllFormations();
    const selectedId = playerData.get().selectedFormation;
    const cardW = (width - 50) / 2;
    const cardH = 150;
    const gap = 10;

    let y = this.visibleAreaTop + 15;

    // Заголовок
    const header = this.add.container(0, y);
    header.add(this.add.text(20, 0, i18n.t('selectFormation').toUpperCase(), {
      fontSize: '12px',
      color: hexToString(colors.uiPrimary),
      fontStyle: 'bold',
    }));
    const line = this.add.graphics();
    line.lineStyle(1, colors.uiPrimary, 0.2);
    line.lineBetween(20, 18, width - 20, 18);
    header.add(line);
    header.add(this.add.text(width / 2, 32, '👆 Tap caps to change class', {
      fontSize: '10px',
      color: '#555566',
    }).setOrigin(0.5, 0));
    this.contentContainer.add(header);

    y += 55;

    // Сетка формаций
    formations.forEach((formation, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * (cardW + gap);
      const cardY = y + row * (cardH + gap);

      const card = this.createFormationCard(x, cardY, cardW, cardH, formation, formation.id === selectedId);
      this.contentContainer.add(card);
    });

    const rows = Math.ceil(formations.length / 2);
    y += rows * (cardH + gap) + 20;

    // Кнопка создания
    if (playerData.get().customFormations.length < 3) {
      const createBtn = this.createAddFormationButton(y, width);
      this.contentContainer.add(createBtn);
      y += 60;
    }

    this.maxScrollY = Math.max(0, y - this.visibleAreaBottom + 20);
  }

  private createFormationCard(x: number, y: number, w: number, h: number, formation: Formation, isSelected: boolean): Phaser.GameObjects.Container {
    const colors = getColors();
    const container = this.add.container(x, y);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(isSelected ? 0x1a2a3a : 0x0a0a15, 0.95);
    bg.fillRoundedRect(0, 0, w, h, 10);
    bg.lineStyle(isSelected ? 2 : 1, isSelected ? colors.uiAccent : colors.uiPrimary, isSelected ? 0.7 : 0.25);
    bg.strokeRoundedRect(0, 0, w, h, 10);
    container.add(bg);

    // Мини-поле
    const fieldW = w - 24;
    const fieldH = 70;
    const fieldX = w / 2;
    const fieldY = 50;

    const field = this.add.graphics();
    field.fillStyle(0x0a1a0a, 1);
    field.fillRoundedRect(fieldX - fieldW / 2, fieldY - fieldH / 2, fieldW, fieldH, 5);
    field.lineStyle(1, 0x2a4a2a, 0.5);
    field.lineBetween(fieldX - fieldW / 2, fieldY, fieldX + fieldW / 2, fieldY);
    field.strokeCircle(fieldX, fieldY, 6);
    field.lineStyle(1.5, 0xef4444, 0.7);
    field.strokeRect(fieldX - 12, fieldY - fieldH / 2 - 2, 24, 4);
    field.lineStyle(1.5, 0x22c55e, 0.7);
    field.strokeRect(fieldX - 12, fieldY + fieldH / 2 - 2, 24, 4);
    field.lineStyle(1, 0x3a5a3a, 0.6);
    field.strokeRoundedRect(fieldX - fieldW / 2, fieldY - fieldH / 2, fieldW, fieldH, 5);
    container.add(field);

    // Фишки
    formation.slots.forEach((slot) => {
      const capX = fieldX - fieldW / 2 + slot.x * fieldW;
      const capY = fieldY + (slot.y - 0.5) * fieldH;
      const cfg = CLASS_CONFIG[slot.capClass];

      const cap = this.add.graphics();
      cap.fillStyle(cfg.color, 0.8);
      cap.fillCircle(capX, capY, 8);
      cap.lineStyle(1, 0xffffff, 0.8);
      cap.strokeCircle(capX, capY, 8);
      container.add(cap);

      container.add(this.add.text(capX, capY, cfg.icon, { fontSize: '8px' }).setOrigin(0.5));
      container.add(this.add.text(capX, capY + 12, cfg.short, {
        fontSize: '6px',
        color: hexToString(cfg.color),
        fontStyle: 'bold',
      }).setOrigin(0.5));

      // Смена класса
      const hit = this.add.circle(capX, capY, 12, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (p: any, lx: number, ly: number, e: any) => {
        e.stopPropagation();
        this.cycleSlotClass(formation, slot);
      });
      container.add(hit);
    });

    // Название
    container.add(this.add.text(w / 2, h - 20, formation.name, {
      fontSize: '12px',
      color: isSelected ? '#ffffff' : '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Бейдж Selected
    if (isSelected) {
      const badge = this.add.graphics();
      badge.fillStyle(colors.uiAccent, 0.2);
      badge.fillRoundedRect(w - 42, 6, 36, 14, 7);
      container.add(badge);
      container.add(this.add.text(w - 24, 13, '✓', {
        fontSize: '9px',
        color: hexToString(colors.uiAccent),
      }).setOrigin(0.5));
    }

    // Кнопки кастомных формаций
    if (formation.isCustom) {
      const editBtn = this.add.circle(20, 12, 10, colors.uiPrimary, 0.2).setInteractive({ useHandCursor: true });
      editBtn.on('pointerdown', () => this.openFormationEditor(formation));
      container.add(editBtn);
      container.add(this.add.text(20, 12, '✏️', { fontSize: '9px' }).setOrigin(0.5));

      const delBtn = this.add.circle(42, 12, 10, 0xef4444, 0.2).setInteractive({ useHandCursor: true });
      delBtn.on('pointerdown', () => {
        playerData.deleteCustomFormation(formation.id);
        this.scene.restart();
      });
      container.add(delBtn);
      container.add(this.add.text(42, 12, '🗑️', { fontSize: '9px' }).setOrigin(0.5));
    }

    // Выбор формации
    if (!isSelected) {
      const hit = this.add.rectangle(w / 2, h / 2, w, h, 0, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        playerData.selectFormation(formation.id);
        this.scene.restart();
      });
      container.add(hit);
    }

    return container;
  }

  private cycleSlotClass(formation: Formation, slot: FormationSlot): void {
    const classes: CapClass[] = ['balanced', 'tank', 'sniper', 'trickster'];
    const idx = classes.indexOf(slot.capClass);
    const next = classes[(idx + 1) % classes.length];
    playerData.setSlotClass(formation.id, slot.id, next);
    this.scene.restart();
  }

  private createAddFormationButton(y: number, width: number): Phaser.GameObjects.Container {
    const colors = getColors();
    const container = this.add.container(0, y);
    const w = width - 40;
    const h = 45;

    const bg = this.add.graphics();
    bg.fillStyle(colors.uiPrimary, 0.1);
    bg.fillRoundedRect(20, 0, w, h, 10);
    bg.lineStyle(1.5, colors.uiPrimary, 0.3);
    bg.strokeRoundedRect(20, 0, w, h, 10);
    container.add(bg);

    container.add(this.add.text(20 + w / 2, h / 2, `➕ ${i18n.t('createFormation')}`, {
      fontSize: '13px',
      color: hexToString(colors.uiPrimary),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const hit = this.add.rectangle(20 + w / 2, h / 2, w, h, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => this.openFormationEditor(null));
    container.add(hit);

    return container;
  }

  // ==================== РЕДАКТОР ФОРМАЦИЙ ====================

  private openFormationEditor(formation: Formation | null): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    this.isEditingFormation = true;
    this.editingFormationId = formation?.id || null;
    this.tempSlots = formation
      ? formation.slots.map(s => ({ ...s }))
      : [
          { id: 'slot_0', x: 0.5, y: 0.70, capClass: 'sniper' as CapClass },
          { id: 'slot_1', x: 0.30, y: 0.85, capClass: 'balanced' as CapClass },
          { id: 'slot_2', x: 0.70, y: 0.85, capClass: 'tank' as CapClass },
        ];

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9).setOrigin(0).setDepth(200);
    this.formationEditorContainer = this.add.container(0, 0).setDepth(201);

    this.formationEditorContainer.add(this.add.text(width / 2, 35, formation ? 'Edit Formation' : 'Create Formation', {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5));

    const fieldW = width - 50;
    const fieldH = height - 180;
    const fieldX = width / 2;
    const fieldY = height / 2 - 10;

    this.renderEditableField(fieldX, fieldY, fieldW, fieldH);

    const btnY = height - 55;
    this.createEditorButton(width / 2 - 65, btnY, 110, 'Cancel', 0x666666, () => this.closeFormationEditor());
    this.createEditorButton(width / 2 + 65, btnY, 110, 'Save', colors.uiAccent, () => {
      if (formation) {
        playerData.updateCustomFormation(formation.id, this.tempSlots);
      } else {
        const name = `Custom ${playerData.get().customFormations.length + 1}`;
        playerData.createCustomFormation(name, this.tempSlots);
      }
      this.closeFormationEditor();
    });
  }

  private renderEditableField(cx: number, cy: number, w: number, h: number): void {
    const colors = getColors();
    const field = this.add.graphics();

    field.fillStyle(0x0a1a0a, 1);
    field.fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    field.lineStyle(1, 0x2a4a2a, 0.5);
    field.lineBetween(cx - w / 2, cy, cx + w / 2, cy);
    field.strokeCircle(cx, cy, w * 0.08);
    field.lineStyle(3, 0xef4444, 0.7);
    field.strokeRect(cx - w * 0.12, cy - h / 2 - 4, w * 0.24, 8);
    field.lineStyle(3, 0x22c55e, 0.7);
    field.strokeRect(cx - w * 0.12, cy + h / 2 - 4, w * 0.24, 8);
    field.lineStyle(2, 0x3a5a3a, 0.7);
    field.strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 12);
    this.formationEditorContainer!.add(field);

    this.formationEditorContainer!.add(this.add.text(cx, cy - h / 2 - 20, '👆 Drag caps | Double-tap to change class', {
      fontSize: '10px',
      color: '#666666',
    }).setOrigin(0.5));

    const zone = this.add.graphics();
    zone.fillStyle(colors.uiAccent, 0.03);
    zone.fillRect(cx - w / 2 + 5, cy + 5, w - 10, h / 2 - 10);
    this.formationEditorContainer!.add(zone);

    this.capMarkers = [];
    this.tempSlots.forEach((slot, i) => {
      const marker = this.createDraggableMarker(cx, cy, w, h, slot, i);
      this.capMarkers.push(marker);
      this.formationEditorContainer!.add(marker);
    });
  }

  private createDraggableMarker(fcx: number, fcy: number, fw: number, fh: number, slot: FormationSlot, idx: number): Phaser.GameObjects.Container {
    const cfg = CLASS_CONFIG[slot.capClass];
    const container = this.add.container(fcx - fw / 2 + slot.x * fw, fcy - fh / 2 + slot.y * fh);

    const glow = this.add.circle(0, 0, 32, cfg.color, 0.2);
    const cap = this.add.circle(0, 0, 24, cfg.color, 0.9);
    cap.setStrokeStyle(2, 0xffffff, 1);
    const icon = this.add.text(0, -4, cfg.icon, { fontSize: '16px' }).setOrigin(0.5);
    const label = this.add.text(0, 14, cfg.short, { fontSize: '9px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);

    container.add([glow, cap, icon, label]);
    container.setData({ idx, glow, cap, icon, label });

    container.setInteractive(new Phaser.Geom.Circle(0, 0, 32), Phaser.Geom.Circle.Contains);
    this.input.setDraggable(container);

    let lastTap = 0;
    container.on('pointerdown', () => {
      const now = Date.now();
      if (now - lastTap < 300) this.cycleEditorSlotClass(container, idx);
      lastTap = now;
    });

    container.on('drag', (_: any, dx: number, dy: number) => {
      const minX = fcx - fw / 2 + 30, maxX = fcx + fw / 2 - 30;
      const minY = fcy + 30, maxY = fcy + fh / 2 - 30;
      const nx = Phaser.Math.Clamp(dx, minX, maxX);
      const ny = Phaser.Math.Clamp(dy, minY, maxY);
      container.setPosition(nx, ny);
      this.tempSlots[idx].x = (nx - (fcx - fw / 2)) / fw;
      this.tempSlots[idx].y = (ny - (fcy - fh / 2)) / fh;
    });

    return container;
  }

  private cycleEditorSlotClass(container: Phaser.GameObjects.Container, idx: number): void {
    const classes: CapClass[] = ['balanced', 'tank', 'sniper', 'trickster'];
    const cur = this.tempSlots[idx].capClass;
    const next = classes[(classes.indexOf(cur) + 1) % classes.length];
    this.tempSlots[idx].capClass = next;

    const cfg = CLASS_CONFIG[next];
    (container.getData('glow') as Phaser.GameObjects.Arc).setFillStyle(cfg.color, 0.2);
    (container.getData('cap') as Phaser.GameObjects.Arc).setFillStyle(cfg.color, 0.9);
    (container.getData('icon') as Phaser.GameObjects.Text).setText(cfg.icon);
    (container.getData('label') as Phaser.GameObjects.Text).setText(cfg.short);

    this.tweens.add({ targets: container, scale: { from: 1.15, to: 1 }, duration: 120, ease: 'Back.easeOut' });
  }

  private createEditorButton(x: number, y: number, w: number, text: string, color: number, onClick: () => void): void {
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillRoundedRect(x - w / 2, y - 18, w, 36, 8);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeRoundedRect(x - w / 2, y - 18, w, 36, 8);
    this.formationEditorContainer!.add(bg);

    this.formationEditorContainer!.add(this.add.text(x, y, text, {
      fontSize: '13px',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const hit = this.add.rectangle(x, y, w, 36, 0, 0).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', onClick);
    this.formationEditorContainer!.add(hit);
  }

  private closeFormationEditor(): void {
    this.isEditingFormation = false;
    this.editingFormationId = null;
    this.capMarkers = [];
    this.tempSlots = [];
    this.scene.restart();
  }

  // ==================== СКРОЛЛИНГ ====================

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, dy: number) => {
      if (this.isEditingFormation) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + dy * 0.5, 0, this.maxScrollY);
      this.scrollVelocity = 0;
      this.updateCardPositions();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isEditingFormation) return;
      if (p.y > this.visibleAreaTop) {
        this.dragStartY = p.y;
        this.isDragging = true;
        this.scrollVelocity = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging && !this.isEditingFormation) {
        const delta = this.dragStartY - p.y;
        this.scrollVelocity = delta;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.dragStartY = p.y;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
}