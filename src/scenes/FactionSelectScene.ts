// ✅ ИЗМЕНЕНО: Добавлен SwipeNavigationManager для возврата в MainMenu

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import {
  UIFactionId,
  FACTION_UI,
  STARTER_FACTIONS,
  getGameFactionByUIFaction,
  getUIFactionByGameFaction,
} from '../constants/factionUiConfig';
import { FactionId, DEFAULT_FACTION } from '../constants/gameConstants';
import { hapticSelection } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { safeSceneStart } from '../utils/SceneHelpers';
import { loadImagesMenu } from '../assets/loading/ImageLoader';

export class FactionSelectScene extends Phaser.Scene {
  private currentUIFaction: UIFactionId = 'magma';
  private currentGameFaction?: FactionId;
  private isInitialChoice: boolean = false;

  private currentArt?: Phaser.GameObjects.Image;
  private vignette?: Phaser.GameObjects.Graphics;
  private particleEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;

  private factionIcons: Map<UIFactionId, Phaser.GameObjects.Container> = new Map();

  private nameText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;

  private panelContainer!: Phaser.GameObjects.Container;
  private manageButtonContainer!: Phaser.GameObjects.Container;
  private manageButtonBg!: Phaser.GameObjects.Graphics;
  private manageButtonLabel!: Phaser.GameObjects.Text;
  private manageButtonHit!: Phaser.GameObjects.Rectangle;
  private diffLabel!: Phaser.GameObjects.Text;
  private diffValue!: Phaser.GameObjects.Text;
  private strengthsTitle!: Phaser.GameObjects.Text;
  private weaknessesTitle!: Phaser.GameObjects.Text;
  private strengthsList!: Phaser.GameObjects.Container;
  private weaknessesList!: Phaser.GameObjects.Container;
  private panelGlow!: Phaser.GameObjects.Graphics;

  private s = 1;
  private panelBottomY = 0;
  private iconsBaseY = 0;
  
  // ✅ ДОБАВЛЕНО: SwipeNavigationManager
  private swipeManager?: SwipeNavigationManager;

  constructor() {
    super({ key: 'FactionSelectScene' });
  }

  preload(): void {
    loadImagesMenu(this);
  }

  shutdown(): void {
    AudioManager.getInstance().stopFactionSelectSounds();
    this.swipeManager?.destroy();
    this.cleanupAllObjects();
  }

  private cleanupAllObjects(): void {
    this.tweens.killAll();
    
    // Уничтожаем панель со всем содержимым
    if (this.panelContainer) {
      this.panelContainer.destroy(true);
      this.panelContainer = undefined!;
    }
    
    // Очищаем иконки
    this.factionIcons.forEach(container => {
      if (container?.active) {
        container.destroy(true);
      }
    });
    this.factionIcons.clear();
    
    // Очищаем остальные элементы
    if (this.currentArt?.active) {
      this.currentArt.destroy();
      this.currentArt = undefined;
    }
    
    if (this.vignette?.active) {
      this.vignette.destroy();
      this.vignette = undefined;
    }
    
    if (this.particleEmitter?.active) {
      this.particleEmitter.destroy();
      this.particleEmitter = undefined;
    }
  }

  create(): void {
    this.cleanupAllObjects();
    
    this.s = tgApp.getUIScale();
    this.isInitialChoice = !playerData.hasCompletedInitialFactionChoice();

    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.stopAllSounds();
    audio.stopMusic();

    this.factionIcons = new Map();

    const { width, height } = this.cameras.main;
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000).setDepth(0);

    this.createVignette();
    this.createFactionPanel();
    this.createFactionIcons();

    const savedFaction = playerData.getFaction();
    let initialGameFaction: FactionId;

    if (this.isInitialChoice) {
      initialGameFaction = 'magma';
    } else {
      initialGameFaction = (savedFaction as FactionId) ?? DEFAULT_FACTION;
    }

    const initialUiId = getUIFactionByGameFaction(initialGameFaction);
    this.setFaction(initialUiId, false);
    
    // ✅ ДОБАВЛЕНО: Инициализация свайп-навигации (только если не первый выбор фракции)
    if (!this.isInitialChoice) {
      this.swipeManager = new SwipeNavigationManager(this, {
        onBack: () => this.handleBack(),
      });
      this.swipeManager.enable();
    }
  }
  
  // ✅ ДОБАВЛЕНО: Обработчик возврата
  private handleBack(): void {
    AudioManager.getInstance().stopAllSounds();
    this.cleanupAllObjects();
    this.scene.stop('FactionSelectScene');
    this.scene.start('MainMenuScene');
  }

  private createVignette(): void {
    const { width, height } = this.cameras.main;
    
    this.vignette = this.add.graphics().setDepth(5);
    
    // === Верхнее затемнение (для статус-бара) ===
    this.vignette.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0.6, 0.6, 0, 0
    );
    this.vignette.fillRect(0, 0, width, height * 0.1);
    
    // === Плавный градиент от арта к панели (главный переход) ===
    // Начинается примерно с 30% высоты, заканчивается на 50%
    const gradientStartY = height * 0.28;
    const gradientHeight = height * 0.25;
    
    this.vignette.fillGradientStyle(
      0x0a0c10, 0x0a0c10, 0x0a0c10, 0x0a0c10,
      0, 0, 0.95, 0.95
    );
    this.vignette.fillRect(0, gradientStartY, width, gradientHeight);
    
    // === Нижняя часть — сплошной тёмный фон под панелью ===
    this.vignette.fillStyle(0x0a0c10, 0.95);
    this.vignette.fillRect(0, gradientStartY + gradientHeight, width, height);
    
    // === Боковые виньетки для глубины ===
    const sideGradientWidth = width * 0.15;
    
    // Левая виньетка
    this.vignette.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0.4, 0, 0, 0.4
    );
    this.vignette.fillRect(0, 0, sideGradientWidth, height);
    
    // Правая виньетка
    this.vignette.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0, 0.4, 0.4, 0
    );
    this.vignette.fillRect(width - sideGradientWidth, 0, sideGradientWidth, height);
  }

  private fitImageToScreen(image: Phaser.GameObjects.Image): void {
    if (!image || !image.active) return;
    const { width, height } = this.cameras.main;
    
    const scaleX = width / image.width;
    const scaleY = height / image.height;
    const scale = Math.max(scaleX, scaleY);
    
    image.setScale(scale);
  }

  private setFaction(uiId: UIFactionId, save: boolean): void {
    const config = FACTION_UI[uiId];
    this.currentUIFaction = uiId;
    const gameFactionId = getGameFactionByUIFaction(uiId);
    this.currentGameFaction = gameFactionId;

    if (save && !this.isInitialChoice) {
      playerData.setSelectedFaction(gameFactionId);
    }

    this.transitionBackground(`faction_preview_${uiId}`);
    this.createAtmosphericParticles(uiId);
    this.updatePanelUI(config);
    this.updateIcons(uiId);
  }

  private transitionBackground(textureKey: string): void {
    const { width, height } = this.cameras.main;

    if (!this.textures.exists(textureKey)) {
        console.warn(`[FactionSelect] Texture missing: ${textureKey}`);
        return;
    }

    // Создаем новый арт с целочисленными координатами для четкости
    const newArt = this.add.image(Math.round(width / 2), Math.round(height / 2), textureKey)
        .setDepth(1)
        .setAlpha(0);
    this.fitImageToScreen(newArt);

    // Плавное появление
    this.tweens.add({
        targets: newArt,
        alpha: 1,
        duration: 400,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            if (this.currentArt && this.currentArt.active) {
                this.currentArt.destroy();
            }
            this.currentArt = newArt;
        }
    });
  }

  private createAtmosphericParticles(uiId: UIFactionId): void {
    const { width, height } = this.cameras.main;

    if (this.particleEmitter) {
        this.particleEmitter.destroy();
    }

    let texture = '__WHITE'; 
    let config: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig = {};

    switch (uiId) {
        case 'magma':
            if (this.textures.exists('p_spark')) texture = 'p_spark';
            config = {
                x: { min: 0, max: width },
                y: height,
                speedY: { min: -100, max: -200 },
                scale: { start: 0.5, end: 0 },
                lifespan: 2000,
                quantity: 1,
                frequency: 100,
                blendMode: 'ADD',
                tint: 0xffaa00
            };
            break;
        case 'cyber':
            if (this.textures.exists('p_glitch')) texture = 'p_glitch';
            config = {
                x: { min: 0, max: width },
                y: { min: 0, max: height },
                speedX: { min: -50, max: 50 },
                alpha: { start: 1, end: 0 },
                scale: { start: 0.5, end: 0.1 },
                lifespan: 800,
                quantity: 1,
                frequency: 150,
                blendMode: 'ADD',
                tint: 0x00f2ff
            };
            break;
        case 'void':
            if (this.textures.exists('p_smoke')) texture = 'p_smoke';
            config = {
                x: { min: 0, max: width },
                y: { min: height/2, max: height },
                speedY: { min: -20, max: -50 },
                scale: { start: 0.8, end: 1.5 },
                alpha: { start: 0.2, end: 0 },
                lifespan: 3000,
                quantity: 1,
                frequency: 200,
                blendMode: 'NORMAL',
                tint: 0x9d00ff
            };
            break;
        case 'terran':
            if (this.textures.exists('p_drip')) texture = 'p_drip'; 
            config = {
                x: { min: 0, max: width },
                y: { min: 0, max: height },
                speedX: { min: -20, max: 20 },
                speedY: { min: -20, max: 20 },
                scale: { start: 0.3, end: 0 },
                lifespan: 1500,
                quantity: 1,
                frequency: 100,
                blendMode: 'ADD',
                tint: 0x39ff14
            };
            break;
    }

    this.particleEmitter = this.add.particles(0, 0, texture, config);
    this.particleEmitter.setDepth(3); 
  }

  private createFactionPanel(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    
    // === РАСЧЁТ РАЗМЕРОВ С УЧЁТОМ SAFE AREA ===
    const bottomInset = tgApp.getBottomInset();
    const panelWidth = Math.min(width * 0.94, 380 * s);
    const panelTopY = height * 0.40; // Начало панели (под артом)
    const iconsAreaHeight = 80 * s; // Пространство для иконок внизу
    const bottomPadding = Math.max(20 * s, bottomInset + 10 * s); // Safe area
    const availableHeight = height - panelTopY - iconsAreaHeight - bottomPadding;
    const panelHeight = Math.min(availableHeight, 360 * s);
    
    const panelCenterY = panelTopY + panelHeight / 2;
    
    const container = this.add.container(width / 2, panelCenterY).setDepth(10);
    this.panelContainer = container;

    // === ФОН ПАНЕЛИ (Glassmorphism) ===
    const bg = this.add.graphics();
    
    // Внешнее свечение (glow) цветом фракции - будет обновляться в updatePanelUI
    // Пока создаём placeholder
    this.panelGlow = this.add.graphics();
    container.add(this.panelGlow);
    
    // Основной полупрозрачный фон
    bg.fillStyle(0x0d1117, 0.85);
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Тонкая светлая обводка сверху (имитация стекла)
    bg.lineStyle(1, 0xffffff, 0.1);
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Внутренняя обводка с градиентом (более яркая сверху)
    bg.lineStyle(1, 0xffffff, 0.05);
    bg.strokeRoundedRect(
      -panelWidth / 2 + 1, 
      -panelHeight / 2 + 1, 
      panelWidth - 2, 
      panelHeight - 2, 
      19
    );
    
    // Glass reflection сверху (блик)
    bg.fillStyle(0xffffff, 0.03);
    bg.fillRoundedRect(
      -panelWidth / 2 + 3,
      -panelHeight / 2 + 3,
      panelWidth - 6,
      panelHeight * 0.08,
      { tl: 17, tr: 17, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
    );
    
    // Subtle inner shadow (тень внутри для глубины)
    bg.fillStyle(0x000000, 0.15);
    bg.fillRoundedRect(
      -panelWidth / 2 + 2,
      panelHeight / 2 - 40 * s,
      panelWidth - 4,
      38 * s,
      { tl: 0, tr: 0, bl: 18, br: 18 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
    );
    
    container.add(bg);

    // === ЗАГОЛОВОК (название фракции) ===
    const contentStartY = -panelHeight / 2 + 24 * s;
    
    this.nameText = this.add
      .text(0, contentStartY, 'MAGMA', {
        fontSize: `${22 * s}px`,
        fontFamily: 'Orbitron, Arial',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 2, '#000000', 8, true, true);
    container.add(this.nameText);

    // === ОПИСАНИЕ (полное) ===
    const descY = contentStartY + 36 * s;
    const descWidth = panelWidth - 48 * s;
    
    this.descText = this.add
      .text(0, descY, '', {
        fontSize: `${12 * s}px`,
        fontFamily: 'Rajdhani, Arial',
        color: '#b8c0cc',
        align: 'center',
        wordWrap: { width: descWidth },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 1, '#000000', 3, true, true);
    container.add(this.descText);

    // === РАЗДЕЛИТЕЛЬ ===
    const dividerY = descY + 62 * s;
    const divider = this.add.graphics();
    divider.fillStyle(0xffffff, 0.1);
    divider.fillRoundedRect(-panelWidth * 0.3, dividerY, panelWidth * 0.6, 1, 1);
    container.add(divider);

    // === СЛОЖНОСТЬ ===
    const diffY = dividerY + 12 * s;
    
    this.diffLabel = this.add.text(0, diffY, 'СЛОЖНОСТЬ', {
      fontSize: `${9 * s}px`,
      fontFamily: 'Arial',
      color: '#6b7280',
      letterSpacing: 2,
    }).setOrigin(0.5);
    container.add(this.diffLabel);
    
    this.diffValue = this.add.text(0, diffY + 16 * s, 'Легко', {
      fontSize: `${14 * s}px`,
      fontFamily: 'Orbitron, Arial',
      fontStyle: 'bold',
      color: '#4ade80',
    }).setOrigin(0.5)
      .setShadow(0, 0, '#4ade80', 6, true, true); // Glow эффект
    container.add(this.diffValue);

    // === СИЛЬНЫЕ / СЛАБЫЕ СТОРОНЫ ===
    const columnsY = diffY + 42 * s;
    const columnWidth = (panelWidth - 50 * s) / 2;
    const leftX = -columnWidth / 2 - 10 * s;
    const rightX = columnWidth / 2 + 10 * s;
    
    // Заголовки колонок
    this.strengthsTitle = this.add.text(leftX, columnsY, '✓ Сильные', {
      fontSize: `${10 * s}px`,
      fontFamily: 'Arial',
      color: '#4ade80',
    }).setOrigin(0.5, 0);
    container.add(this.strengthsTitle);
    
    this.weaknessesTitle = this.add.text(rightX, columnsY, '✗ Слабые', {
      fontSize: `${10 * s}px`,
      fontFamily: 'Arial',
      color: '#f87171',
    }).setOrigin(0.5, 0);
    container.add(this.weaknessesTitle);
    
    // Контейнеры для списков (будут заполняться в updatePanelUI)
    this.strengthsList = this.add.container(leftX, columnsY + 16 * s);
    container.add(this.strengthsList);
    
    this.weaknessesList = this.add.container(rightX, columnsY + 16 * s);
    container.add(this.weaknessesList);

    // === КНОПКА (фиксируется к низу панели) ===
    const btnWidth = panelWidth - 40 * s;
    const btnHeight = 38 * s;
    const btnY = panelHeight / 2 - btnHeight / 2 - 15 * s;

    this.manageButtonContainer = this.add.container(0, btnY).setDepth(11);
    container.add(this.manageButtonContainer);

    this.manageButtonBg = this.add.graphics();
    this.manageButtonContainer.add(this.manageButtonBg);

    this.manageButtonLabel = this.add
      .text(0, 0, 'ВЫБРАТЬ', {
        fontSize: `${13 * s}px`,
        fontFamily: 'Orbitron, Arial',
        color: '#000000',
        fontStyle: 'bold'
      })
      .setOrigin(0.5);
    this.manageButtonContainer.add(this.manageButtonLabel);

    const hit = this.add
      .rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.manageButtonHit = hit;
    this.manageButtonContainer.add(hit);

    hit.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticSelection();
      this.handleSelectFaction();
    });

    // Сохраняем позицию низа панели для иконок
    this.panelBottomY = panelCenterY + panelHeight / 2;
  }

  private createFactionIcons(): void {
    const { width } = this.cameras.main;
    const gap = 16 * this.s;
    const iconSize = 60 * this.s;

    let availableFactions: UIFactionId[];

    // ✅ При начальном выборе показываем только стартовые фракции (Magma, Cyborg)
    if (this.isInitialChoice) {
      availableFactions = STARTER_FACTIONS;
    } else {
      const ownedGameFactions = playerData.getOwnedFactions();
      availableFactions = ownedGameFactions.map(gf => getUIFactionByGameFaction(gf));
    }

    const totalWidth = availableFactions.length * iconSize + (availableFactions.length - 1) * gap;
    const startX = width / 2 - totalWidth / 2 + iconSize / 2;

    this.iconsBaseY = this.panelBottomY + 30 * this.s;

    availableFactions.forEach((id, index) => {
      const x = startX + index * (iconSize + gap);
      const config = FACTION_UI[id];

      const container = this.add.container(x, this.iconsBaseY).setDepth(20);

      const bg = this.add.graphics();
      container.add(bg);

      const iconKey = `icon_faction_${id}`;
      if (this.textures.exists(iconKey)) {
        const icon = this.add.image(0, 0, iconKey).setDisplaySize(iconSize * 0.65, iconSize * 0.65);
        container.add(icon);
      } else {
        const c = this.add.circle(0, 0, iconSize * 0.3, config.color, 1);
        container.add(c);
      }

      const glow = this.add.graphics();
      container.add(glow);

      const hit = this.add
        .rectangle(0, 0, iconSize, iconSize, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hit);

      hit.on('pointerdown', () => {
        const audio = AudioManager.getInstance();
        audio.playUIClick();
        audio.playFactionSelect(id);
        hapticSelection();
        this.setFaction(id, false);
      });

      (container as any).__bg = bg;
      (container as any).__glow = glow;

      this.factionIcons.set(id, container);
    });
  }

  private updatePanelUI(config: (typeof FACTION_UI)[UIFactionId]): void {
    // Проверка что все элементы созданы
    if (!this.nameText?.active || !this.diffLabel?.active) return;

    const s = this.s;
    const colorHex = '#' + config.color.toString(16).padStart(6, '0');

    // === Обновляем свечение панели цветом фракции ===
    if (this.panelGlow?.active) {
      this.panelGlow.clear();
      
      const { width, height } = this.cameras.main;
      const bottomInset = tgApp.getBottomInset();
      const panelWidth = Math.min(width * 0.94, 380 * s);
      const panelTopY = height * 0.40;
      const iconsAreaHeight = 80 * s;
      const bottomPadding = Math.max(20 * s, bottomInset + 10 * s);
      const availableHeight = height - panelTopY - iconsAreaHeight - bottomPadding;
      const panelHeight = Math.min(availableHeight, 360 * s);
      const glowColor = config.color;
      
      // Мягкое свечение под панелью
      this.panelGlow.fillStyle(glowColor, 0.08);
      this.panelGlow.fillEllipse(0, 0, panelWidth * 0.8, 60 * s);
      
      // Линия акцента сверху панели
      this.panelGlow.fillStyle(glowColor, 0.3);
      this.panelGlow.fillRoundedRect(
        -panelWidth / 4, 
        -panelHeight / 2 - 2, 
        panelWidth / 2, 
        3, 
        2
      );
    }

    // Название
    this.nameText.setText(config.name.toUpperCase());
    this.nameText.setColor(colorHex);
    this.nameText.setShadow(0, 2, '#000000', 4, true, true);

    // Описание (полное)
    const description = config.fullDescription || config.desc;
    this.descText.setText(description);
    this.descText.setVisible(true);

    // Сложность
    const difficultyColors: Record<string, string> = {
      easy: '#4ade80',
      medium: '#fbbf24',
      hard: '#ef4444',
    };
    const diffColor = difficultyColors[config.difficulty || 'medium'];
    this.diffValue.setText(config.difficultyText || 'Средне');
    this.diffValue.setColor(diffColor);

    // Очистка и заполнение сильных сторон
    this.strengthsList.removeAll(true);
    (config.strengths || []).forEach((str, i) => {
      const text = this.add.text(0, i * 15 * s, `• ${str}`, {
        fontSize: `${10 * s}px`,
        fontFamily: 'Rajdhani, Arial',
        color: '#6ee7b7',
      }).setOrigin(0.5, 0)
        .setShadow(0, 1, '#000000', 2, true, true);
      this.strengthsList.add(text);
    });

    // Очистка и заполнение слабых сторон
    this.weaknessesList.removeAll(true);
    (config.weaknesses || []).forEach((weak, i) => {
      const text = this.add.text(0, i * 15 * s, `• ${weak}`, {
        fontSize: `${10 * s}px`,
        fontFamily: 'Rajdhani, Arial',
        color: '#fca5a5',
      }).setOrigin(0.5, 0)
        .setShadow(0, 1, '#000000', 2, true, true);
      this.weaknessesList.add(text);
    });

    // Кнопка
    const buttonText = this.isInitialChoice
      ? `ВЫБРАТЬ ${config.name.toUpperCase()}`
      : 'УПРАВЛЕНИЕ КОМАНДОЙ';

    this.manageButtonLabel.setText(buttonText);
    this.manageButtonLabel.setColor('#ffffff');
    this.manageButtonLabel.setShadow(0, 1, '#000000', 4, true, true);

    const minBtnWidth = 220 * s;
    const btnWidth = Math.max(this.manageButtonLabel.width + 50 * s, minBtnWidth);
    const btnHeight = 42 * s;

    this.manageButtonBg.clear();
    
    // Тень под кнопкой
    this.manageButtonBg.fillStyle(0x000000, 0.3);
    this.manageButtonBg.fillRoundedRect(-btnWidth / 2 + 2, -btnHeight / 2 + 3, btnWidth, btnHeight, 12);
    
    // Основной градиентный фон кнопки
    this.manageButtonBg.fillStyle(config.color, 1);
    this.manageButtonBg.fillRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);
    
    // Highlight сверху (3D эффект)
    this.manageButtonBg.fillStyle(0xffffff, 0.25);
    this.manageButtonBg.fillRoundedRect(
      -btnWidth / 2 + 2, 
      -btnHeight / 2 + 2, 
      btnWidth - 4, 
      btnHeight * 0.4, 
      { tl: 10, tr: 10, bl: 0, br: 0 } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius
    );
    
    // Тонкая светлая обводка
    this.manageButtonBg.lineStyle(1, 0xffffff, 0.3);
    this.manageButtonBg.strokeRoundedRect(-btnWidth / 2, -btnHeight / 2, btnWidth, btnHeight, 12);

    // ВАЖНО: обновляем hitArea
    this.manageButtonHit.setSize(btnWidth, btnHeight);
    this.manageButtonHit.setDisplaySize(btnWidth, btnHeight);
  }

  private updateIcons(activeId: UIFactionId): void {
    const baseY = this.iconsBaseY || this.panelBottomY + 30 * this.s;
    const size = 60 * this.s;

    this.factionIcons.forEach((container, id) => {
      if (!container?.active) return;

      const isActive = id === activeId;
      const bg = (container as any).__bg as Phaser.GameObjects.Graphics;
      const glow = (container as any).__glow as Phaser.GameObjects.Graphics;
      const cfg = FACTION_UI[id];

      if (!bg?.active || !glow?.active) return;

      this.tweens.killTweensOf(container);

      this.tweens.add({
        targets: container,
        y: isActive ? baseY - 10 * this.s : baseY,
        scale: isActive ? 1.15 : 1.0,
        duration: 200,
        ease: 'Back.easeOut',
      });

      bg.clear();
      if (isActive) {
        bg.fillStyle(0x1a1a1a, 0.95);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14 * this.s);
        bg.lineStyle(2, cfg.color, 1);
        bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 14 * this.s);
      } else {
        bg.fillStyle(0x000000, 0.6);
        bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14 * this.s);
        bg.lineStyle(1, 0xffffff, 0.2);
        bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 14 * this.s);
      }

      glow.clear();
      if (isActive) {
        glow.fillStyle(cfg.color, 0.4);
        glow.fillEllipse(0, size * 0.5, size * 0.8, size * 0.25);
      }
    });
  }

  private handleSelectFaction(): void {
    if (!this.currentGameFaction) {
      this.currentGameFaction = getGameFactionByUIFaction(this.currentUIFaction);
    }

    const { width, height } = this.cameras.main;
    const cfg = FACTION_UI[this.currentUIFaction];

    if (this.isInitialChoice) {
      playerData.setInitialFaction(this.currentGameFaction);
    } else {
      playerData.setSelectedFaction(this.currentGameFaction);
    }

    const flash = this.add
      .rectangle(width / 2, height / 2, width, height, cfg.color, 0)
      .setDepth(50);

    this.tweens.add({
      targets: flash,
      alpha: { from: 0, to: 0.5 },
      duration: 100,
      yoyo: true,
      onComplete: async () => {
        flash.destroy();
        AudioManager.getInstance().playUISwoosh();
        
        this.swipeManager?.destroy();
        this.cleanupAllObjects();
        this.scene.stop('FactionSelectScene');

        // ========== ВОЛШЕБНАЯ ЛОГИКА ==========
        if (this.isInitialChoice && !playerData.hasCompletedFirstMatchTutorial()) {
          // Первый запуск → запускаем туториал
          console.log('[FactionSelect] 🎓 Launching TUTORIAL MODE');
          
          this.scene.start('GameScene', {
            isTutorialMode: true,
            tutorialStep: 'tank_defense',
            playerFaction: this.currentGameFaction,
            vsAI: true,
            difficulty: 'easy',
            matchDuration: 300, // Не используется в туториале, но для совместимости
          });
        } else {
          // Обычный выбор фракции — в TeamScene
          await safeSceneStart(this, 'TeamScene', { factionId: this.currentGameFaction });
        }
      },
    });
  }
}