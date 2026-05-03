// src/scenes/MatchModeSelectScene.ts
// Сцена выбора режима матча (Campaign, League, Tournament, Custom, PvP)
// По структуре и стилю аналогична FactionSelectScene

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AudioManager } from '../managers/AudioManager';
import { hapticSelection, hapticImpact } from '../utils/Haptics';
import { tgApp } from '../utils/TelegramWebApp';
import { SwipeNavigationManager } from '../ui/SwipeNavigationManager';
import { isWeekend } from '../utils/WeekUtils';
import { LeagueTier, getLeagueTierOrder } from '../types/league';
import { safeSceneStart } from '../utils/SceneHelpers';
import { loadImagesBoot } from '../assets/loading/ImageLoader';
import { loadAudioMenu } from '../assets/loading/AudioLoader';

// ========== ТИПЫ ==========

type MatchModeId = 'campaign' | 'league' | 'tournament' | 'custom' | 'pvp';

interface MatchModeConfig {
  id: MatchModeId;
  name: string;
  shortLabel: string;
  description: string;
  accentColor: number;
  bgTextureKey: string;
  getStatusText?: () => string;
  isLocked?: () => boolean;
}

// ========== КОНФИГУРАЦИЯ РЕЖИМОВ ==========

const MATCH_MODES: MatchModeConfig[] = [
  {
    id: 'campaign',
    name: 'КАМПАНИЯ',
    shortLabel: 'Кампания',
    description: 'Проходи сюжетные главы.\nСражайся с боссами, открывай юнитов и зарабатывай награды.\nИдеально для обучения и заработка опыта.',
    accentColor: 0x00f2ff, // cyan
    bgTextureKey: 'match_bg_campaign',
    getStatusText: () => {
      const progress = playerData.getCampaignProgress();
      const totalStars = progress.totalStars;
      return `★ Звёзд: ${totalStars}`;
    },
  },
  {
    id: 'league',
    name: 'ГАЛАКТИЧЕСКАЯ ЛИГА',
    shortLabel: 'Лига',
    description: 'Рейтинговые матчи.\nПоднимайся через 6 лиг и 3 дивизиона.\nЗарабатывай сезонные награды и доказывай своё мастерство.',
    accentColor: 0x9d00ff, // purple
    bgTextureKey: 'match_bg_league',
    getStatusText: () => {
      const progress = playerData.get().leagueProgress;
      if (!progress) return 'Без ранга';
      const tierNames: Record<string, string> = {
        'meteorite': 'Метеорит',
        'comet': 'Комета',
        'planet': 'Планета',
        'star': 'Звезда',
        'nebula': 'Туманность',
        'core': 'Ядро',
      };
      const tierName = tierNames[progress.currentTier] || progress.currentTier.toUpperCase();
      return `${tierName} • Дивизион ${progress.division}`;
    },
  },
  {
    id: 'tournament',
    name: 'ТУРНИР',
    shortLabel: 'Турнир',
    description: 'Турнирная сетка на выбывание.\nМатчи Best of 3 с 8 игроками.\nПовышенные награды. Доступно только в выходные.',
    accentColor: 0xfbbf24, // gold
    bgTextureKey: 'match_bg_tournament',
    getStatusText: () => {
      const weekend = isWeekend();
      return weekend ? '🎯 Открыто' : '🔒 Только по выходным';
    },
    isLocked: () => !isWeekend(),
  },
  {
    id: 'custom',
    name: 'AI',
    shortLabel: 'AI',
    description: 'Тренируйся против ИИ.\nНастраивай сложность и экспериментируй с составами.\nОтлично подходит для отработки стратегий.',
    accentColor: 0x39ff14, // green
    bgTextureKey: 'match_bg_custom',
    getStatusText: () => 'Тренировка',
  },
  {
    id: 'pvp',
    name: 'ОНЛАЙН PVP',
    shortLabel: 'PvP',
    description: 'Реальные битвы с другими игроками.\nСражайся с противниками со всего мира.\nНастоящая проверка мастерства и стратегии.',
    accentColor: 0xff4500, // red/orange
    bgTextureKey: 'match_bg_pvp',
    getStatusText: () => {
      const pvpStats = playerData.get().pvpStats;
      if (!pvpStats) return '🎮 Доступно';
      const rating = pvpStats.ranked.rating;
      return `MMR: ${rating}`;
    },
    isLocked: () => false, // ✅ PvP разблокирован!
  },
];

// ========== ОСНОВНАЯ СЦЕНА ==========

export class MatchModeSelectScene extends Phaser.Scene {
  private currentMode: MatchModeId = 'league';
  
  private currentArt?: Phaser.GameObjects.Image;
  private vignette?: Phaser.GameObjects.Graphics;
  
  private panelContainer!: Phaser.GameObjects.Container;
  private titleText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private playButton!: Phaser.GameObjects.Container;
  private playButtonBg!: Phaser.GameObjects.Graphics;
  private playButtonLabel!: Phaser.GameObjects.Text;
  
  private modesTabsContainer!: Phaser.GameObjects.Container;
  private modeTabs: Map<MatchModeId, Phaser.GameObjects.Container> = new Map();
  
  private swipeManager?: SwipeNavigationManager;
  private s = 1;
  
  constructor() {
    super({ key: 'MatchModeSelectScene' });
  }

  preload(): void {
    loadImagesBoot(this);
    loadAudioMenu(this);
  }
  
  shutdown(): void {
    this.swipeManager?.destroy();
    this.cleanupAllObjects();
  }
  
  private cleanupAllObjects(): void {
    if (this.tweens) this.tweens.killAll();
    if (this.time) this.time.removeAllEvents();
    if (this.input) this.input.removeAllListeners();
    
    this.currentArt?.destroy();
    this.vignette?.destroy();
    this.panelContainer?.destroy();
    this.modesTabsContainer?.destroy();
    
    this.modeTabs.forEach(container => container?.destroy());
    this.modeTabs.clear();
  }
  
  create(): void {
    this.cleanupAllObjects();
    
    this.s = tgApp.getUIScale();
    
    const audio = AudioManager.getInstance();
    audio.init(this);
    audio.playMusic('bgm_menu');
    
    const { width, height } = this.cameras.main;

    // Если PNG splash нет в билде — градиентные фоны режимов (лига и др.)
    this.ensureProceduralMatchSplashTextures();

    // Черная подложка
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000).setDepth(0);
    
    // Создание UI
    this.createVignette();
    this.createModePanel();
    this.createModeTabs();
    
    // Начальный режим - league (самый популярный)
    this.selectMode('league', false);
    
    // Свайп-навигация
    this.swipeManager = new SwipeNavigationManager(this, {
      onBack: () => this.handleBack(),
    });
    this.swipeManager.enable();
    
    // Горизонтальные свайпы для переключения режимов
    this.setupModeSwipes();
  }
  
  private handleBack(): void {
    AudioManager.getInstance().stopAllSounds();
    AudioManager.getInstance().playUIClick();
    this.cleanupAllObjects();
    this.scene.stop('MatchModeSelectScene');
    this.scene.start('MainMenuScene');
  }
  
  // ========== СОЗДАНИЕ UI ==========
  
  private createVignette(): void {
    const { width, height } = this.cameras.main;
    this.vignette = this.add.graphics().setDepth(5);
    
    // 🔥 УСИЛЕННАЯ виньетка: начинаем затемнение выше и делаем темнее
    // Градиент от прозрачного (30% высоты) до очень темного внизу
    this.vignette.fillGradientStyle(
      0x000000, 0x000000, 0x000000, 0x000000,
      0, 0.2, 0.98, 0.98 // Увеличили прозрачность низа с 0.95 до 0.98
    );
    this.vignette.fillRect(0, height * 0.3, width, height * 0.7); // Начинаем с 30% вместо 50%
  }
  
  private createModePanel(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    
    // 🔥 УВЕЛИЧЕННАЯ высота панели для вмещения всего текста
    const panelWidth = Math.min(width * 0.92, 400 * s);
    const panelHeight = 280 * s; // Увеличили с 240 до 280
    const panelX = width / 2;
    const panelY = height * 0.66;
    
    this.panelContainer = this.add.container(panelX, panelY).setDepth(10);
    
    // === ФОНОВАЯ ГРАФИКА (стеклянная панель) ===
    const panelBg = this.add.graphics();
    
    // Основной фон (темный полупрозрачный)
    panelBg.fillStyle(0x0b0b14, 0.94);
    panelBg.lineStyle(2, 0x00f2ff, 0.3);
    panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 14);
    
    // "Стеклянный" эффект (верхний блик)
    const glassHeight = panelHeight * 0.25; // Уменьшили с 0.3 до 0.25
    panelBg.fillStyle(0xffffff, 0.05);
    panelBg.fillRoundedRect(
      -panelWidth / 2 + 4,
      -panelHeight / 2 + 4,
      panelWidth - 8,
      glassHeight,
      10
    );
    
    // 🔥 МАКСИМАЛЬНО ТЕМНЫЙ слой под текст для идеальной читаемости
    const textDark = this.add.graphics();
    textDark.fillStyle(0x000000, 0.92); // Увеличили с 0.75 до 0.92 для максимального контраста
    textDark.fillRoundedRect(-panelWidth / 2 + 10, -panelHeight / 2 + 10, panelWidth - 20, panelHeight - 20, 10);
    this.panelContainer.add(textDark);

    this.panelContainer.add(panelBg);
    
    // === ЗАГОЛОВОК (название режима) ===
    this.titleText = this.add.text(-panelWidth / 2 + 20 * s, -panelHeight / 2 + 20 * s, '', {
      fontFamily: 'Orbitron',
      fontSize: `${24 * s}px`, // Уменьшили с 26 до 24 для предотвращения переноса
      color: '#ffffff',
      fontStyle: 'bold',
      wordWrap: { width: panelWidth - 40 * s, useAdvancedWrap: true }, // Добавили advancedWrap
      stroke: '#000000',
      strokeThickness: 12, // Увеличили с 10 до 12 для лучшей читаемости
    });
    this.titleText.setShadow(6 * s, 6 * s, '#000000', 20, true, true); // Усилили тень
    this.panelContainer.add(this.titleText);
    
    // === СТАТУС (под заголовком, слева) ===
    this.statusText = this.add.text(-panelWidth / 2 + 20 * s, -panelHeight / 2 + 55 * s, '', { // Подняли с 58 до 55
      fontFamily: 'Rajdhani',
      fontSize: `${14 * s}px`, // Уменьшили с 15 до 14
      color: '#00f2ff', // Яркий cyan для акцента
      fontStyle: 'bold',
      align: 'left',
      wordWrap: { width: panelWidth - 40 * s },
      stroke: '#000000',
      strokeThickness: 7, // Увеличили с 6 до 7
    });
    this.statusText.setOrigin(0, 0);
    this.statusText.setShadow(4 * s, 4 * s, '#000000', 8, true, true); // Усилили тень
    this.panelContainer.add(this.statusText);
    
    // === ОПИСАНИЕ ===
    this.descText = this.add.text(-panelWidth / 2 + 20 * s, -panelHeight / 2 + 80 * s, '', { // Подняли с 85 до 80
      fontFamily: 'Rajdhani',
      fontSize: `${14 * s}px`, // Уменьшили с 15 до 14
      color: '#e5e7eb', // Чуть темнее белого для визуального разделения
      lineSpacing: 5 * s, // Уменьшили с 6 до 5
      wordWrap: { width: panelWidth - 40 * s },
      stroke: '#000000',
      strokeThickness: 7, // Увеличили с 6 до 7
    });
    this.descText.setShadow(4 * s, 4 * s, '#000000', 10, true, true); // Усилили тень
    this.panelContainer.add(this.descText);
    
    // === КНОПКА PLAY ===
    this.createPlayButton(panelWidth, panelHeight);
  }
  
  private createPlayButton(panelWidth: number, panelHeight: number): void {
    const s = this.s;
    const buttonWidth = panelWidth * 0.85;
    const buttonHeight = 50 * s;
    const buttonY = panelHeight / 2 - buttonHeight / 2 - 14 * s;
    
    this.playButton = this.add.container(0, buttonY);
    
    // Фон кнопки
    this.playButtonBg = this.add.graphics();
    this.updatePlayButtonColor(0x00f2ff); // Начальный цвет
    
    this.playButton.add(this.playButtonBg);
    
    // Верхний "глянец"
    const gloss = this.add.graphics();
    gloss.fillStyle(0xffffff, 0.15);
    gloss.fillRoundedRect(-buttonWidth / 2 + 3, -buttonHeight / 2 + 3, buttonWidth - 6, buttonHeight * 0.4, 6);
    this.playButton.add(gloss);
    
    // Текст кнопки
    this.playButtonLabel = this.add.text(0, 0, 'ИГРАТЬ', {
      fontFamily: 'Orbitron',
      fontSize: `${18 * s}px`,
      color: '#0a0a0a',
      fontStyle: 'bold',
    });
    this.playButtonLabel.setOrigin(0.5);
    this.playButtonLabel.setShadow(1 * s, 1 * s, 'rgba(0,0,0,0.3)', 2, true, true);
    this.playButton.add(this.playButtonLabel);
    
    // Hit area
    const hitArea = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    
    hitArea.on('pointerdown', () => {
      // Проверяем блокировку режима
      const config = MATCH_MODES.find(m => m.id === this.currentMode);
      if (config?.isLocked && config.isLocked()) {
        // Заблокирован - только звук и feedback
        AudioManager.getInstance().playUIClick();
        this.tweens.add({
          targets: this.playButton,
          scaleX: 0.96,
          scaleY: 0.96,
          duration: 80,
          yoyo: true,
        });
        return;
      }
      
      // Разблокирован - запускаем
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.tweens.add({
        targets: this.playButton,
        scaleX: 0.96,
        scaleY: 0.96,
        duration: 80,
        yoyo: true,
      });
      
      this.time.delayedCall(100, () => {
        this.handlePlay(this.currentMode);
      });
    });
    
    hitArea.on('pointerover', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: 1.02,
        scaleY: 1.02,
        duration: 150,
        ease: 'Back.easeOut',
      });
    });
    
    hitArea.on('pointerout', () => {
      this.tweens.add({
        targets: this.playButton,
        scaleX: 1,
        scaleY: 1,
        duration: 150,
      });
    });
    
    this.playButton.add(hitArea);
    this.panelContainer.add(this.playButton);
  }
  
  private updatePlayButtonColor(color: number): void {
    const s = this.s;
    const { width, height } = this.cameras.main;
    const panelWidth = Math.min(width * 0.92, 380 * s);
    const buttonWidth = panelWidth * 0.85;
    const buttonHeight = 50 * s;
    
    this.playButtonBg.clear();
    this.playButtonBg.fillStyle(color, 1.0);
    this.playButtonBg.lineStyle(2, 0xffffff, 0.3);
    this.playButtonBg.fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    this.playButtonBg.strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
  }
  
  private createModeTabs(): void {
    const { width, height } = this.cameras.main;
    const s = this.s;
    
    const tabY = height * 0.9;
    const tabWidth = 70 * s;
    const tabHeight = 45 * s;
    const spacing = 8 * s;
    const totalWidth = MATCH_MODES.length * tabWidth + (MATCH_MODES.length - 1) * spacing;
    const startX = width / 2 - totalWidth / 2 + tabWidth / 2;
    
    this.modesTabsContainer = this.add.container(0, 0).setDepth(15);
    
    MATCH_MODES.forEach((config, index) => {
      const tabX = startX + index * (tabWidth + spacing);
      const tabContainer = this.createModeTab(config, tabX, tabY, tabWidth, tabHeight);
      this.modeTabs.set(config.id, tabContainer);
      this.modesTabsContainer.add(tabContainer);
    });
  }
  
  private createModeTab(
    config: MatchModeConfig,
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const s = this.s;
    const container = this.add.container(x, y);
    
    // Фон таба
    const bg = this.add.graphics();
    container.add(bg);
    container.setData('bg', bg);
    
    // Текст таба
    const label = this.add.text(0, 0, config.shortLabel, {
      fontFamily: 'Rajdhani',
      fontSize: `${12 * s}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    });
    label.setOrigin(0.5);
    label.setShadow(1 * s, 1 * s, '#000000', 2, true, true);
    container.add(label);
    
    // Hit area (табы всегда доступны для выбора, блокировка только на кнопке)
    const hitArea = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
    hitArea.setInteractive({ useHandCursor: true });
    
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticSelection();
      this.selectMode(config.id, true);
    });
    
    container.add(hitArea);
    container.setData('width', width);
    container.setData('height', height);
    container.setData('modeId', config.id);
    
    return container;
  }
  
  // ========== ЛОГИКА ПЕРЕКЛЮЧЕНИЯ РЕЖИМОВ ==========
  
  private selectMode(id: MatchModeId, animate: boolean = true): void {
    this.currentMode = id;
    const config = MATCH_MODES.find(m => m.id === id);
    if (!config) return;
    
    this.transitionBackground(config.bgTextureKey, animate);
    this.updatePanelUI(config);
    this.updateTabsUI(id);
  }
  
  private transitionBackground(textureKey: string, animate: boolean = true): void {
    const { width, height } = this.cameras.main;

    if (this.shouldRebuildSplash(textureKey)) {
      const fallback = this.getSplashFallbackColors(textureKey);
      if (fallback) {
        if (this.textures.exists(textureKey)) {
          try {
            this.textures.remove(textureKey);
          } catch {
            /* ignore */
          }
        }
        this.createSplashGradientTexture(textureKey, fallback[0], fallback[1]);
      }
    }

    if (!this.textures.exists(textureKey)) {
      console.warn(`[MatchModeSelect] Texture missing: ${textureKey}`);
      return;
    }
    
    const newArt = this.add.image(Math.round(width / 2), Math.round(height / 2), textureKey)
      .setDepth(1)
      .setAlpha(animate ? 0 : 1);
    
    this.fitImageToScreen(newArt);
    
    if (animate) {
      this.tweens.add({
        targets: newArt,
        alpha: 1,
        duration: 500,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          if (this.currentArt && this.currentArt.active) {
            this.currentArt.destroy();
          }
          this.currentArt = newArt;
        },
      });
    } else {
      if (this.currentArt && this.currentArt.active) {
        this.currentArt.destroy();
      }
      this.currentArt = newArt;
    }
  }
  
  private fitImageToScreen(image: Phaser.GameObjects.Image): void {
    if (!image || !image.active) return;
    const { width, height } = this.cameras.main;
    
    const scaleX = width / image.width;
    const scaleY = height / image.height;
    const scale = Math.max(scaleX, scaleY);
    
    image.setScale(scale);
  }
  
  private updatePanelUI(config: MatchModeConfig): void {
    const isLocked = config.isLocked && config.isLocked();
    
    // Обновить заголовок
    this.titleText.setText(config.name);
    this.titleText.setColor('#' + config.accentColor.toString(16).padStart(6, '0'));
    
    // Обновить статус
    const statusText = config.getStatusText ? config.getStatusText() : '';
    this.statusText.setText(statusText);
    
    // Определить цвет статуса
    let statusColor = '#a0a0a0';
    if (statusText.includes('Открыто')) statusColor = '#39ff14';
    if (statusText.includes('выходным') || statusText.includes('Скоро')) statusColor = '#ff4500';
    this.statusText.setColor(statusColor);
    
    // Обновить описание
    this.descText.setText(config.description);
    
    // Обновить кнопку в зависимости от блокировки
    if (isLocked) {
      // Заблокирован - серая кнопка
      this.updatePlayButtonColor(0x666666); // Серый цвет
      this.playButtonLabel.setText('НЕДОСТУПНО');
      this.playButtonLabel.setColor('#cccccc'); // Светло-серый текст
      this.playButton.setAlpha(0.6);
    } else {
      // Разблокирован - нормальная кнопка
      this.updatePlayButtonColor(config.accentColor);
      this.playButtonLabel.setText('ИГРАТЬ');
      this.playButtonLabel.setColor('#0a0a0a'); // Черный текст
      this.playButton.setAlpha(1.0);
    }
  }
  
  private updateTabsUI(activeId: MatchModeId): void {
    const s = this.s;
    
    MATCH_MODES.forEach(config => {
      const tab = this.modeTabs.get(config.id);
      if (!tab) return;
      
      const bg = tab.getData('bg') as Phaser.GameObjects.Graphics;
      const width = tab.getData('width') as number;
      const height = tab.getData('height') as number;
      const isActive = config.id === activeId;
      const isLocked = config.isLocked && config.isLocked();
      
      bg.clear();
      
      if (isActive) {
        // Активный таб
        bg.fillStyle(0x1a1620, 1.0);
        bg.lineStyle(3, config.accentColor, 1.0);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
        
        // Glow снизу
        bg.lineStyle(6, config.accentColor, 0.3);
        bg.lineBetween(-width / 2 + 8, height / 2, width / 2 - 8, height / 2);
        
        // Анимация масштаба
        this.tweens.add({
          targets: tab,
          scaleX: 1.08,
          scaleY: 1.08,
          y: tab.y - 4 * s,
          duration: 200,
          ease: 'Back.easeOut',
        });
      } else {
        // Неактивный таб
        bg.fillStyle(0x14101e, isLocked ? 0.5 : 0.7);
        bg.lineStyle(1, 0x666666, isLocked ? 0.3 : 0.6);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 8);
        
        // Сброс масштаба
        const originalY = this.cameras.main.height * 0.9;
        this.tweens.add({
          targets: tab,
          scaleX: 1.0,
          scaleY: 1.0,
          y: originalY,
          duration: 200,
        });
      }
    });
  }
  
  // ========== СВАЙПЫ ДЛЯ ПЕРЕКЛЮЧЕНИЯ РЕЖИМОВ ==========
  
  private setupModeSwipes(): void {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      startX = pointer.x;
      startY = pointer.y;
      isDragging = true;
    });
    
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!isDragging) return;
      isDragging = false;
      
      const deltaX = pointer.x - startX;
      const deltaY = pointer.y - startY;
      
      // Проверка: это горизонтальный свайп?
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          // Свайп влево - следующий режим
          this.nextMode();
        } else {
          // Свайп вправо - предыдущий режим
          this.previousMode();
        }
      }
    });
  }
  
  private nextMode(): void {
    const currentIndex = MATCH_MODES.findIndex(m => m.id === this.currentMode);
    if (currentIndex < MATCH_MODES.length - 1) {
      const nextMode = MATCH_MODES[currentIndex + 1];
      hapticSelection();
      this.selectMode(nextMode.id, true);
    }
  }
  
  private previousMode(): void {
    const currentIndex = MATCH_MODES.findIndex(m => m.id === this.currentMode);
    if (currentIndex > 0) {
      const prevMode = MATCH_MODES[currentIndex - 1];
      hapticSelection();
      this.selectMode(prevMode.id, true);
    }
  }
  
  // ========== ОБРАБОТЧИКИ ЗАПУСКА РЕЖИМОВ ==========
  
  private async handlePlay(modeId: MatchModeId): Promise<void> {
    const config = MATCH_MODES.find(m => m.id === modeId);
    if (!config) return;
    
    // Проверка блокировки
    if (config.isLocked && config.isLocked()) {
      console.log(`[MatchModeSelect] Mode ${modeId} is locked`);
      return;
    }
    
    if (import.meta.env.DEV) {
      console.debug('[MatchModeSelectScene] Mode selected:', modeId);
    }
    
    this.scene.stop('MatchModeSelectScene');
    
    switch (modeId) {
      case 'campaign':
        // Перейти в кампанию
        await safeSceneStart(this, 'CampaignSelectScene');
        break;
        
      case 'league':
        // Перейти в Galaxy League
        await safeSceneStart(this, 'LeagueScene');
        break;
        
      case 'tournament':
        // Перейти в турниры
        await safeSceneStart(this, 'TournamentScene');
        break;
        
      case 'custom':
        // Открыть выбор сложности AI
        await safeSceneStart(this, 'AIDifficultySelectScene');
        break;
        
      case 'pvp':
        // Запустить матчмейкинг
        await safeSceneStart(this, 'MatchmakingScene', { mode: 'ranked' });
        break;
    }
  }

  private shouldRebuildSplash(key: string): boolean {
    if (!key || !this.textures.exists(key)) return true;
    try {
      const tex = this.textures.get(key);
      const src = tex.getSourceImage();
      const w =
        src instanceof HTMLImageElement ? src.naturalWidth : ((src as { width?: number }).width ?? 0);
      return !Number.isFinite(w) || w < 512;
    } catch {
      return true;
    }
  }

  private getSplashFallbackColors(textureKey: string): [number, number] | undefined {
    const map: Record<string, [number, number]> = {
      match_bg_campaign: [0x0369a1, 0x020617],
      match_bg_league: [0x6d28d9, 0x0b0820],
      match_bg_tournament: [0xb45309, 0x1c1917],
      match_bg_custom: [0x15803d, 0x052e16],
      match_bg_pvp: [0xc2410c, 0x1f0707],
    };
    return map[textureKey];
  }

  private ensureProceduralMatchSplashTextures(): void {
    (
      [
        ['match_bg_campaign', 0x0369a1, 0x020617],
        ['match_bg_league', 0x6d28d9, 0x0b0820],
        ['match_bg_tournament', 0xb45309, 0x1c1917],
        ['match_bg_custom', 0x15803d, 0x052e16],
        ['match_bg_pvp', 0xc2410c, 0x1f0707],
      ] as const
    ).forEach(([key, top, bot]) => {
      if (this.shouldRebuildSplash(key)) {
        if (this.textures.exists(key)) {
          try {
            this.textures.remove(key);
          } catch {
            /* ignore */
          }
        }
        this.createSplashGradientTexture(key, top, bot);
      }
    });
  }

  private createSplashGradientTexture(key: string, topColor: number, bottomColor: number): void {
    if (!key || this.textures.exists(key)) return;
    const w = 1080;
    const h = 1920;
    const g = this.make.graphics({ x: 0, y: 0 });
    g.fillGradientStyle(topColor, topColor, bottomColor, bottomColor, 1, 1, 1, 1);
    g.fillRect(0, 0, w, h);
    const rt = this.add.renderTexture(-6000, -6000, w, h);
    rt.draw(g, 0, 0);
    g.destroy();
    rt.saveTexture(key);
    rt.destroy();
    if (import.meta.env.DEV) {
      console.log(`[MatchModeSelect] Procedural splash texture: ${key}`);
    }
  }
}

