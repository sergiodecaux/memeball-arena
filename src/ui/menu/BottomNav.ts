// ✅ ИЗМЕНЕНО: Team теперь ведёт в FactionSelectScene (как было раньше)

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { AudioManager } from '../../managers/AudioManager';
import { tgApp } from '../../utils/TelegramWebApp';

// ============================================================================
// НАВИГАЦИОННАЯ ПАНЕЛЬ (для MainMenuScene)
// ============================================================================

export type NavItemKey = 'team' | 'home' | 'shop' | 'profile';

export interface BottomNavCallbacks {
  onNavigate: (scene: string | null) => void;
}

interface NavItem {
  key: NavItemKey;
  icon: string;
  labelKey: string;
  scene: string | null;
}

/**
 * Нижняя навигационная панель для главного меню
 * Содержит 4 кнопки: Team, Home, Shop, Profile
 */
export class BottomNav {
  private scene: Phaser.Scene;
  private s: number;
  private activeKey: NavItemKey;
  private callbacks: BottomNavCallbacks;
  private container?: Phaser.GameObjects.Container;
  // ✅ NEW: Store references to nav button containers and hits for highlighting
  private itemContainers: Partial<Record<NavItemKey, Phaser.GameObjects.Container>> = {};
  private itemHits: Partial<Record<NavItemKey, Phaser.GameObjects.Rectangle>> = {};

  private static readonly NAV_ITEMS: NavItem[] = [
    // ✅ ИЗМЕНЕНО: Team ведёт в FactionSelectScene (выбор фракции → команда)
    { key: 'team', icon: '🛡️', labelKey: 'team', scene: 'FactionSelectScene' },
    { key: 'home', icon: '🏠', labelKey: 'home', scene: null },
    { key: 'shop', icon: '🛒', labelKey: 'shop', scene: 'ShopScene' },
    { key: 'profile', icon: '👤', labelKey: 'profile', scene: 'ProfileScene' },
  ];

  constructor(scene: Phaser.Scene, activeKey: NavItemKey, callbacks: BottomNavCallbacks) {
    this.scene = scene;
    this.s = tgApp.getUIScale();
    this.activeKey = activeKey;
    this.callbacks = callbacks;
  }

  create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;
    const bottomInset = tgApp.getSafeAreaInset().bottom;
    const navH = 72 * s + bottomInset;
    const navContentY = height - navH + (36 * s);

    this.container = this.scene.add.container(0, 0).setDepth(100);

    // Фон навигации с градиентом
    const bg = this.scene.add.graphics();
    
    // Многослойный фон для глубины
    bg.fillStyle(0x000000, 0.3);
    bg.fillRect(0, height - navH - 4, width, navH + 4);
    
    bg.fillStyle(0x0a0a0c, 0.98);
    bg.fillRect(0, height - navH, width, navH);
    
    // Верхняя линия-разделитель
    bg.fillStyle(colors.uiAccent, 0.15);
    bg.fillRect(0, height - navH, width, 1);
    
    this.container.add(bg);

    const itemW = width / BottomNav.NAV_ITEMS.length;

    BottomNav.NAV_ITEMS.forEach((item, index) => {
      const isActive = item.key === this.activeKey;
      const ix = itemW * index + itemW / 2;

      const btn = this.scene.add.container(ix, navContentY);
      this.container!.add(btn);
      // ✅ NEW: Store container reference
      this.itemContainers[item.key] = btn;

      // Подсветка активного элемента
      if (isActive) {
        const activeBg = this.scene.add.graphics();
        activeBg.fillStyle(colors.uiAccent, 0.1);
        activeBg.fillRoundedRect(-itemW / 2 + 8, -28 * s, itemW - 16, 56 * s, 12);
        btn.add(activeBg);
        
        // Индикатор сверху
        const indicator = this.scene.add.graphics();
        indicator.fillStyle(colors.uiAccent, 0.8);
        indicator.fillRoundedRect(-15 * s, -32 * s, 30 * s, 3, 1.5);
        btn.add(indicator);
      }

      // Иконка (PNG)
      let iconSprite: Phaser.GameObjects.Image | Phaser.GameObjects.Text | undefined;
      const iconKey = `ui_nav_${item.key}`;
      
      if (this.scene.textures.exists(iconKey)) {
        iconSprite = this.scene.add.image(0, -8 * s, iconKey);
        iconSprite.setDisplaySize(24 * s, 24 * s);
        iconSprite.setOrigin(0.5, 0.5);
        
        // Эффект свечения для активного
        if (isActive) {
          iconSprite.setTint(colors.uiAccent);
        } else {
          iconSprite.setTint(0x666666);
        }
      } else {
        // Fallback к emoji, если иконка не загружена
        iconSprite = this.scene.add.text(0, -8 * s, item.icon, {
          fontSize: `${24 * s}px`,
        }).setOrigin(0.5);
        
        // Эффект свечения для активного
        if (isActive) {
          iconSprite.setShadow(0, 0, hexToString(colors.uiAccent), 12, true, true);
        }
      }

      btn.add(iconSprite);

      // Подпись
      const labelColor = isActive ? hexToString(colors.uiAccent) : '#666666';
      const labelText = this.scene.add.text(0, 16 * s, i18n.t(item.labelKey).toUpperCase(), {
        fontSize: `${10 * s}px`,
        fontFamily: fonts.tech,
        color: labelColor,
        fontStyle: isActive ? 'bold' : 'normal',
      }).setOrigin(0.5);

      btn.add(labelText);

      // Область нажатия
      const hit = this.scene.add.rectangle(0, 0, itemW, 72 * s, 0, 0)
        .setInteractive({ useHandCursor: true });
      btn.add(hit);
      // ✅ NEW: Store hit reference
      this.itemHits[item.key] = hit;

      // Эффекты при наведении (для десктопа) - только изменение цвета, без увеличения
      hit.on('pointerover', () => {
        if (!isActive && iconSprite) {
          if (iconSprite instanceof Phaser.GameObjects.Image) {
            iconSprite.setTint(0x999999);
          }
          labelText.setColor('#999999');
        }
      });

      hit.on('pointerout', () => {
        if (!isActive && iconSprite) {
          if (iconSprite instanceof Phaser.GameObjects.Image) {
            iconSprite.setTint(0x666666);
          }
          labelText.setColor('#666666');
        }
      });

      hit.on('pointerdown', () => {
        if (!isActive) {
          btn.setScale(0.95);
        }
      });

      hit.on('pointerup', () => {
        btn.setScale(1);
        if (!isActive) {
          AudioManager.getInstance().playUIClick();
          this.callbacks.onNavigate(item.scene);
        }
      });
    });
  }

  // ✅ NEW: Expose methods for highlighting nav items
  getNavItemContainer(key: NavItemKey): Phaser.GameObjects.Container | undefined {
    return this.itemContainers[key];
  }

  getNavItemHit(key: NavItemKey): Phaser.GameObjects.Rectangle | undefined {
    return this.itemHits[key];
  }

  getContainer(): Phaser.GameObjects.Container | undefined {
    return this.container;
  }

  destroy(): void {
    this.itemContainers = {};
    this.itemHits = {};
    this.container?.destroy();
    this.container = undefined;
  }
}

// ============================================================================
// ИНДИКАТОР СВАЙПА (для вторичных экранов)
// ============================================================================

export interface SwipeIndicatorConfig {
  /** Показывать ли подсказку при первом показе */
  showHint?: boolean;
  /** Цвет индикатора (по умолчанию uiAccent) */
  color?: number;
  /** Прозрачность в покое */
  idleAlpha?: number;
  /** Высота индикатора в процентах от экрана (0-1) */
  heightPercent?: number;
  /** Отступ сверху в процентах */
  topOffsetPercent?: number;
}

/**
 * Визуальный индикатор свайпа у левого края экрана
 * Показывает пользователю, что можно свайпнуть для возврата
 */
export class SwipeIndicator {
  private scene: Phaser.Scene;
  private config: Required<SwipeIndicatorConfig>;
  
  private container?: Phaser.GameObjects.Container;
  private indicator?: Phaser.GameObjects.Graphics;
  private pulseEffect?: Phaser.Tweens.Tween;
  private hintContainer?: Phaser.GameObjects.Container;
  private hintTween?: Phaser.Tweens.Tween;
  
  private isDestroyed: boolean = false;

  constructor(scene: Phaser.Scene, config: SwipeIndicatorConfig = {}) {
    this.scene = scene;
    
    const colors = getColors();
    
    // Значения по умолчанию
    this.config = {
      showHint: config.showHint ?? false,
      color: config.color ?? colors.uiAccent,
      idleAlpha: config.idleAlpha ?? 0.25,
      heightPercent: config.heightPercent ?? 0.6,
      topOffsetPercent: config.topOffsetPercent ?? 0.2,
    };
    
    this.create();
  }

  private create(): void {
    if (this.isDestroyed) return;
    
    const { height } = this.scene.cameras.main;
    const s = tgApp.getUIScale();
    
    // Контейнер для всех элементов
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(50);
    
    // Расчёт размеров индикатора
    const indicatorHeight = height * this.config.heightPercent;
    const topOffset = height * this.config.topOffsetPercent;
    const indicatorWidth = 3 * s;
    const cornerRadius = indicatorWidth / 2;
    
    // Создаём графику индикатора
    this.indicator = this.scene.add.graphics();
    this.indicator.setAlpha(this.config.idleAlpha);
    
    // Рисуем вертикальную полоску с закруглёнными краями
    this.indicator.fillStyle(this.config.color, 1);
    this.indicator.fillRoundedRect(
      0, 
      topOffset, 
      indicatorWidth, 
      indicatorHeight, 
      cornerRadius
    );
    
    // Добавляем градиентный эффект (затухание к краям)
    this.addGradientOverlay(topOffset, indicatorHeight, indicatorWidth);
    
    this.container.add(this.indicator);
    
    // Пульсирующая анимация
    this.createPulseAnimation();
    
    // Показываем подсказку если нужно
    if (this.config.showHint) {
      this.showHint();
    }
  }

  private addGradientOverlay(topOffset: number, indicatorHeight: number, indicatorWidth: number): void {
    if (!this.indicator) return;
    
    // Добавляем затухание к верхнему и нижнему краю
    const fadeHeight = indicatorHeight * 0.15;
    
    // Верхнее затухание
    for (let i = 0; i < 10; i++) {
      const alpha = i / 10;
      this.indicator.fillStyle(0x0a0a0f, 1 - alpha);
      this.indicator.fillRect(0, topOffset + (fadeHeight * i / 10), indicatorWidth, fadeHeight / 10);
    }
    
    // Нижнее затухание
    const bottomStart = topOffset + indicatorHeight - fadeHeight;
    for (let i = 0; i < 10; i++) {
      const alpha = 1 - (i / 10);
      this.indicator.fillStyle(0x0a0a0f, 1 - alpha);
      this.indicator.fillRect(0, bottomStart + (fadeHeight * i / 10), indicatorWidth, fadeHeight / 10);
    }
  }

  private createPulseAnimation(): void {
    if (!this.indicator || this.isDestroyed) return;
    
    this.pulseEffect = this.scene.tweens.add({
      targets: this.indicator,
      alpha: { from: this.config.idleAlpha, to: this.config.idleAlpha + 0.15 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Показать подсказку о свайпе
   */
  showHint(): void {
    if (this.isDestroyed || !this.container) return;
    
    const { height } = this.scene.cameras.main;
    const s = tgApp.getUIScale();
    const colors = getColors();
    
    // Контейнер подсказки
    this.hintContainer = this.scene.add.container(60 * s, height / 2);
    this.hintContainer.setAlpha(0);
    this.container.add(this.hintContainer);
    
    // Фон подсказки
    const hintBg = this.scene.add.graphics();
    hintBg.fillStyle(0x1a1a2e, 0.95);
    hintBg.fillRoundedRect(-50 * s, -25 * s, 140 * s, 50 * s, 12 * s);
    hintBg.lineStyle(1, colors.uiAccent, 0.5);
    hintBg.strokeRoundedRect(-50 * s, -25 * s, 140 * s, 50 * s, 12 * s);
    this.hintContainer.add(hintBg);
    
    // Стрелка
    const arrow = this.scene.add.text(-35 * s, 0, '👈', {
      fontSize: `${20 * s}px`,
    }).setOrigin(0.5);
    this.hintContainer.add(arrow);
    
    // Текст
    const hintText = this.scene.add.text(25 * s, 0, 'Swipe\nto back', {
      fontSize: `${11 * s}px`,
      fontFamily: 'Orbitron, sans-serif',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 2,
    }).setOrigin(0.5);
    this.hintContainer.add(hintText);
    
    // Анимация появления
    this.scene.tweens.add({
      targets: this.hintContainer,
      alpha: 1,
      x: 80 * s,
      duration: 400,
      ease: 'Back.easeOut',
    });
    
    // Анимация стрелки (движение влево-вправо)
    this.hintTween = this.scene.tweens.add({
      targets: arrow,
      x: arrow.x - 8 * s,
      duration: 600,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
    });
    
    // Скрыть через 3 секунды
    this.scene.time.delayedCall(3000, () => {
      this.hideHint();
    });
  }

  /**
   * Скрыть подсказку
   */
  hideHint(): void {
    if (!this.hintContainer || this.isDestroyed) return;
    
    this.hintTween?.destroy();
    
    this.scene.tweens.add({
      targets: this.hintContainer,
      alpha: 0,
      x: 40,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.hintContainer?.destroy();
        this.hintContainer = undefined;
      },
    });
  }

  /**
   * Подсветить индикатор (при начале свайпа)
   */
  highlight(): void {
    if (!this.indicator || this.isDestroyed) return;
    
    this.pulseEffect?.pause();
    
    this.scene.tweens.add({
      targets: this.indicator,
      alpha: 0.8,
      duration: 150,
      ease: 'Power2',
    });
  }

  /**
   * Вернуть в обычное состояние
   */
  unhighlight(): void {
    if (!this.indicator || this.isDestroyed) return;
    
    this.scene.tweens.add({
      targets: this.indicator,
      alpha: this.config.idleAlpha,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.pulseEffect?.resume();
      },
    });
  }

  /**
   * Показать прогресс свайпа (0-1)
   */
  showProgress(progress: number): void {
    if (!this.indicator || this.isDestroyed) return;
    
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const alpha = this.config.idleAlpha + (0.8 - this.config.idleAlpha) * clampedProgress;
    
    this.indicator.setAlpha(alpha);
  }

  /**
   * Установить видимость
   */
  setVisible(visible: boolean): void {
    this.container?.setVisible(visible);
  }

  /**
   * Уничтожить индикатор
   */
  destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;
    
    this.pulseEffect?.destroy();
    this.hintTween?.destroy();
    this.hintContainer?.destroy();
    this.indicator?.destroy();
    this.container?.destroy();
    
    this.pulseEffect = undefined;
    this.hintTween = undefined;
    this.hintContainer = undefined;
    this.indicator = undefined;
    this.container = undefined;
  }
}