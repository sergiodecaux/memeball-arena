/**
 * ChestPreviewModal - Модальное окно детального превью сундука
 * 
 * Вдохновлено мистическими сундуками World of Tanks:
 * - Анимированный фон с частицами
 * - 3D эффект вращающегося сундука
 * - Карусель возможных наград с PNG
 * - Визуальная шкала шансов выпадения
 * - Breakdown лута по категориям
 */

import Phaser from 'phaser';
import { ChestData, getChestByIdCompat } from '../../data/ChestsCatalog';
import { getNonBattlePassUnits, UnitData, RARITY_COLORS, getDisplayName } from '../../data/UnitsRepository';
import { getAllCards, CardDefinition } from '../../data/CardsCatalog';
import { getColors, getFonts, hexToString } from '../../config/themes';
import { AudioManager } from '../../managers/AudioManager';
import { getRealUnitTextureKey } from '../../utils/TextureHelpers';

/**
 * Предотвращает нативные события браузера на pointer событии
 */
function preventNativeEvent(pointer: Phaser.Input.Pointer): void {
  if (pointer.event) {
    pointer.event.preventDefault();
    pointer.event.stopPropagation();
  }
}

// ============================================================
// ТИПЫ
// ============================================================

interface LootCategory {
  id: string;
  nameRu: string;
  nameEn: string;
  icon: string;
  color: number;
  chance: number;  // Процент шанса
  examples: LootExample[];
}

interface LootExample {
  type: 'unit' | 'card' | 'currency' | 'item';
  id: string;
  name: string;
  rarity?: string;
  assetKey: string;
  amount?: string;  // Например "150-300" или "x1"
}

interface ParticleConfig {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: number;
  life: number;
  maxLife: number;
}

// ============================================================
// КЛАСС МОДАЛЬНОГО ОКНА
// ============================================================

export class ChestPreviewModal {
  private scene: Phaser.Scene;
  private chest: ChestData;
  private onClose: () => void;
  private onPurchase: () => void;
  
  // Контейнеры
  private overlay!: Phaser.GameObjects.Container;
  private contentContainer!: Phaser.GameObjects.Container;
  private particlesContainer!: Phaser.GameObjects.Container;
  private carouselContainer!: Phaser.GameObjects.Container;
  
  // Состояние
  private isClosing: boolean = false;
  private particles: ParticleConfig[] = [];
  private particleGraphics!: Phaser.GameObjects.Graphics;
  private updateEvent?: Phaser.Time.TimerEvent;
  
  // Карусель
  private carouselItems: Phaser.GameObjects.Container[] = [];
  private carouselIndex: number = 0;
  private carouselTween?: Phaser.Tweens.Tween;
  private autoScrollTimer?: Phaser.Time.TimerEvent;
  private carouselMaskGraphics?: Phaser.GameObjects.Graphics;
  
  // Размеры
  private modalWidth: number;
  private modalHeight: number;
  private chestColor: number;

  constructor(
    scene: Phaser.Scene,
    chestId: string,
    onClose: () => void,
    onPurchase: () => void
  ) {
    this.scene = scene;
    const chest = getChestByIdCompat(chestId);
    if (!chest) {
      console.error(`[ChestPreviewModal] Chest not found: ${chestId}`);
      throw new Error(`Chest not found: ${chestId}`);
    }
    this.chest = chest;
    this.onClose = onClose;
    this.onPurchase = onPurchase;
    
    const { width, height } = scene.cameras.main;
    this.modalWidth = Math.min(width - 40, 400);
    this.modalHeight = Math.min(height - 80, 700);
    
    // Цвет сундука по типу
    this.chestColor = this.getChestColor();
    
    this.create();
  }

  // ============================================================
  // СОЗДАНИЕ МОДАЛЬНОГО ОКНА
  // ============================================================

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Главный контейнер
    this.overlay = this.scene.add.container(0, 0);
    this.overlay.setDepth(2000);
    
    // ===== ЗАТЕМНЁННЫЙ ФОН =====
    const dimBg = this.scene.add.rectangle(centerX, centerY, width, height, 0x000000, 0);
    dimBg.setInteractive();
    dimBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      this.close();
    });
    this.overlay.add(dimBg);
    
    // Анимация затемнения
    this.scene.tweens.add({
      targets: dimBg,
      fillAlpha: 0.85,
      duration: 300,
    });
    
    // ===== КОНТЕЙНЕР ЧАСТИЦ (под контентом) =====
    this.particlesContainer = this.scene.add.container(centerX, centerY);
    this.overlay.add(this.particlesContainer);
    
    this.particleGraphics = this.scene.add.graphics();
    this.particlesContainer.add(this.particleGraphics);
    
    // Инициализация частиц
    this.initParticles();
    
    // ===== ОСНОВНОЙ КОНТЕЙНЕР КОНТЕНТА =====
    this.contentContainer = this.scene.add.container(centerX, centerY);
    this.overlay.add(this.contentContainer);
    
    // Начальное состояние для анимации
    this.contentContainer.setScale(0.8);
    this.contentContainer.setAlpha(0);
    
    // ===== ФОН МОДАЛЬНОГО ОКНА =====
    this.createModalBackground();
    
    // ===== ЗАГОЛОВОК =====
    this.createHeader();
    
    // ===== СУНДУК С ЭФФЕКТАМИ =====
    this.createChestDisplay();
    
    // ===== КАРУСЕЛЬ НАГРАД =====
    this.createRewardsCarousel();
    
    // ===== BREAKDOWN ШАНСОВ =====
    this.createLootBreakdown();
    
    // ===== КНОПКИ =====
    this.createButtons();
    
    // ===== КНОПКА ЗАКРЫТИЯ =====
    this.createCloseButton();
    
    // ===== АНИМАЦИЯ ПОЯВЛЕНИЯ =====
    this.scene.tweens.add({
      targets: this.contentContainer,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
    
    // ===== ЗАПУСК ОБНОВЛЕНИЯ ЧАСТИЦ =====
    this.updateEvent = this.scene.time.addEvent({
      delay: 16, // ~60 FPS
      callback: () => this.updateParticles(),
      loop: true,
    });
    
    // ===== АВТОПРОКРУТКА КАРУСЕЛИ =====
    this.autoScrollTimer = this.scene.time.addEvent({
      delay: 3000,
      callback: () => this.nextCarouselItem(),
      loop: true,
    });
    
    // Звук открытия
    try {
      AudioManager.getInstance().playSFX('sfx_whoosh');
    } catch (e) {}
  }

  // ============================================================
  // ФОН МОДАЛЬНОГО ОКНА
  // ============================================================

  private createModalBackground(): void {
    const w = this.modalWidth;
    const h = this.modalHeight;
    
    // Основной фон с градиентом
    const bg = this.scene.add.graphics();
    
    // Внешнее свечение
    bg.fillStyle(this.chestColor, 0.15);
    bg.fillRoundedRect(-w/2 - 10, -h/2 - 10, w + 20, h + 20, 24);
    
    // Основной фон
    bg.fillStyle(0x0a0a18, 0.98);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 20);
    
    // Внутренняя рамка
    bg.lineStyle(2, this.chestColor, 0.8);
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 20);
    
    // Декоративные углы
    this.drawCornerDecorations(bg, w, h);
    
    this.contentContainer.add(bg);
  }

  private drawCornerDecorations(graphics: Phaser.GameObjects.Graphics, w: number, h: number): void {
    const cornerSize = 30;
    const offset = 8;
    
    graphics.lineStyle(2, this.chestColor, 0.6);
    
    // Верхний левый
    graphics.beginPath();
    graphics.moveTo(-w/2 + offset, -h/2 + offset + cornerSize);
    graphics.lineTo(-w/2 + offset, -h/2 + offset);
    graphics.lineTo(-w/2 + offset + cornerSize, -h/2 + offset);
    graphics.strokePath();
    
    // Верхний правый
    graphics.beginPath();
    graphics.moveTo(w/2 - offset - cornerSize, -h/2 + offset);
    graphics.lineTo(w/2 - offset, -h/2 + offset);
    graphics.lineTo(w/2 - offset, -h/2 + offset + cornerSize);
    graphics.strokePath();
    
    // Нижний левый
    graphics.beginPath();
    graphics.moveTo(-w/2 + offset, h/2 - offset - cornerSize);
    graphics.lineTo(-w/2 + offset, h/2 - offset);
    graphics.lineTo(-w/2 + offset + cornerSize, h/2 - offset);
    graphics.strokePath();
    
    // Нижний правый
    graphics.beginPath();
    graphics.moveTo(w/2 - offset - cornerSize, h/2 - offset);
    graphics.lineTo(w/2 - offset, h/2 - offset);
    graphics.lineTo(w/2 - offset, h/2 - offset - cornerSize);
    graphics.strokePath();
  }

  // ============================================================
  // ЗАГОЛОВОК
  // ============================================================

  private createHeader(): void {
    const fonts = getFonts();
    const y = -this.modalHeight / 2 + 40;
    
    // Название сундука
    const title = this.scene.add.text(0, y, this.chest.nameRu, {
      fontSize: '24px',
      fontFamily: fonts.tech,
      color: hexToString(this.chestColor),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    
    // Тень для названия
    title.setShadow(0, 0, hexToString(this.chestColor), 10, true, true);
    
    this.contentContainer.add(title);
    
    // Подзаголовок с количеством роллов
    const subtitle = this.scene.add.text(0, y + 28, `${this.chest.rolls} наград в сундуке`, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#888888',
    }).setOrigin(0.5);
    
    this.contentContainer.add(subtitle);
  }

  // ============================================================
  // ОТОБРАЖЕНИЕ СУНДУКА
  // ============================================================

  private createChestDisplay(): void {
    const y = -this.modalHeight / 2 + 140;
    
    // Контейнер для сундука и эффектов
    const chestContainer = this.scene.add.container(0, y);
    this.contentContainer.add(chestContainer);
    
    // Свечение под сундуком
    const glow = this.scene.add.ellipse(0, 50, 140, 30, this.chestColor, 0.3);
    chestContainer.add(glow);
    
    // Анимация пульсации свечения
    this.scene.tweens.add({
      targets: glow,
      scaleX: 1.2,
      scaleY: 1.3,
      alpha: 0.15,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // Изображение сундука
    // Проверяем несколько вариантов ключей
    const possibleKeys = [
      this.chest.assetKey512,
      `${this.chest.id}_512`,
      // Старые ключи для обратной совместимости
      this.chest.id === 'chest_stellar' ? 'chest_small_512' : null,
      this.chest.id === 'chest_nebula' ? 'chest_medium_512' : null,
      this.chest.id === 'chest_nova' ? 'chest_large_512' : null,
      this.chest.id === 'chest_cosmic' ? 'chest_mystic_512' : null,
    ].filter(Boolean) as string[];

    let chestKey = possibleKeys.find(key => this.scene.textures.exists(key));

    if (import.meta.env.DEV) {
      console.log(`[ChestPreviewModal] Checking chest textures:`, possibleKeys, `-> Found: ${chestKey}`);
    }

    if (chestKey && this.scene.textures.exists(chestKey)) {
      const chestImg = this.scene.add.image(0, 0, chestKey);
      chestImg.setDisplaySize(120, 120);
      chestContainer.add(chestImg);
      
      // Лёгкое покачивание сундука
      this.scene.tweens.add({
        targets: chestImg,
        y: -5,
        angle: 2,
        duration: 2000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      
      // Блики на сундуке
      this.createChestGlints(chestContainer);
    } else {
      // Placeholder
      const placeholder = this.scene.add.rectangle(0, 0, 100, 100, this.chestColor, 0.3);
      placeholder.setStrokeStyle(2, this.chestColor);
      chestContainer.add(placeholder);
    }
    
    // Декоративные искры вокруг сундука
    this.createSparkles(chestContainer);
  }

  private createChestGlints(container: Phaser.GameObjects.Container): void {
    // Создаём несколько бликов
    for (let i = 0; i < 3; i++) {
      const glint = this.scene.add.star(
        Phaser.Math.Between(-40, 40),
        Phaser.Math.Between(-40, 40),
        4, 2, 8, 0xffffff, 0
      );
      container.add(glint);
      
      // Анимация мерцания
      this.scene.tweens.add({
        targets: glint,
        alpha: 0.8,
        scaleX: 1.5,
        scaleY: 1.5,
        duration: Phaser.Math.Between(500, 1000),
        delay: Phaser.Math.Between(0, 2000),
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private createSparkles(container: Phaser.GameObjects.Container): void {
    // Кольцо искр вокруг сундука
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const radius = 70;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.5; // Эллипс
      
      const sparkle = this.scene.add.circle(x, y + 20, 3, this.chestColor, 0);
      container.add(sparkle);
      
      // Анимация появления и исчезновения
      this.scene.tweens.add({
        targets: sparkle,
        alpha: 0.8,
        scale: 1.5,
        duration: 800,
        delay: i * 200,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ============================================================
  // КАРУСЕЛЬ НАГРАД
  // ============================================================

  private createRewardsCarousel(): void {
    const y = -this.modalHeight / 2 + 280;
    
    // Заголовок секции
    const sectionTitle = this.scene.add.text(0, y - 30, '✨ ВОЗМОЖНЫЕ НАГРАДЫ', {
      fontSize: '12px',
      fontFamily: getFonts().tech,
      color: '#666666',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.contentContainer.add(sectionTitle);
    
    // Контейнер карусели
    this.carouselContainer = this.scene.add.container(0, y + 30);
    this.contentContainer.add(this.carouselContainer);
    
    // ===== FIX MASK: Маска должна совпадать с мировыми координатами контента =====
    const maskWidth = this.modalWidth - 60;
    
    // Создаём graphics для маски
    const maskGraphics = this.scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    // Рассчитываем мировые координаты центра карусели
    const worldX = this.contentContainer.x + this.carouselContainer.x;
    const worldY = this.contentContainer.y + this.carouselContainer.y;
    
    // Рисуем прямоугольник маски в мировых координатах
    maskGraphics.fillRect(worldX - maskWidth / 2, worldY - 60, maskWidth, 120);
    
    // Создаём маску из graphics
    const mask = maskGraphics.createGeometryMask();
    this.carouselContainer.setMask(mask);
    
    // Скрываем graphics, так как он нужен только для создания маски
    maskGraphics.setVisible(false);
    this.carouselMaskGraphics = maskGraphics;
    
    // Создание элементов карусели
    this.createCarouselItems();
    
    // Индикаторы
    this.createCarouselIndicators(y + 100);
    
    // Стрелки навигации
    this.createCarouselArrows(y + 30);
  }

  private createCarouselItems(): void {
    const items = this.getCarouselData();
    const itemWidth = 100;
    const spacing = 20;
    
    items.forEach((item, index) => {
      const x = index * (itemWidth + spacing);
      const itemContainer = this.createCarouselItem(x, 0, item);
      this.carouselItems.push(itemContainer);
      this.carouselContainer.add(itemContainer);
    });
    
    // Центрируем первый элемент
    this.updateCarouselPosition(false);
  }

  private createCarouselItem(x: number, y: number, data: LootExample): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const size = 90;
    
    // Диагностика в dev режиме
    if (import.meta.env.DEV) {
      console.log(`[ChestPreviewModal] Creating carousel item:`, {
        type: data.type,
        id: data.id,
        assetKey: data.assetKey,
        rarity: data.rarity,
      });
    }
    
    // Фон с цветом редкости
    const rarityColor = this.getRarityColor(data.rarity);
    const bg = this.scene.add.rectangle(0, 0, size, size, rarityColor, 0.2);
    bg.setStrokeStyle(2, rarityColor, 0.8);
    container.add(bg);
    
    // Изображение
    if (data.type === 'card') {
      // Карты способностей (600x900 -> 60x90)
      const textureKey = `card_${data.id}`;
      
      if (import.meta.env.DEV) {
        console.log(`[ChestPreviewModal] Card texture check: ${textureKey} exists: ${this.scene.textures.exists(textureKey)}`);
      }
      
      if (this.scene.textures.exists(textureKey)) {
        const img = this.scene.add.image(0, -5, textureKey);
        img.setDisplaySize(60, 90);
        container.add(img);
      } else {
        // Fallback: показываем placeholder карты
        const placeholder = this.scene.add.rectangle(0, -5, 60, 90, 0x2a2a4a, 0.8);
        placeholder.setStrokeStyle(2, this.getRarityColor(data.rarity));
        container.add(placeholder);
        
        // Иконка карты
        const icon = this.scene.add.text(0, -10, '🃏', {
          fontSize: '24px',
          fontFamily: 'Arial', // Важно для отображения эмодзи
        }).setOrigin(0.5);
        container.add(icon);
        
        // Название
        const cardName = this.scene.add.text(0, 10, data.name.substring(0, 8), {
          fontSize: '8px',
          color: '#ffffff',
        }).setOrigin(0.5);
        container.add(cardName);
      }
    } else if (data.type === 'unit') {
      const textureKey = getRealUnitTextureKey(this.scene, { id: data.id, assetKey: data.assetKey });
      
      if (textureKey) {
        const img = this.scene.add.image(0, -5, textureKey);
        img.setDisplaySize(70, 70);
        container.add(img);
      } else {
        // Fallback: показываем placeholder юнита
        const placeholder = this.scene.add.circle(0, -5, 30, this.getRarityColor(data.rarity), 0.3);
        placeholder.setStrokeStyle(2, this.getRarityColor(data.rarity));
        container.add(placeholder);
        
        // Иконка юнита
        const icon = this.scene.add.text(0, -5, '👤', {
          fontSize: '24px',
          fontFamily: 'Arial', // Важно для отображения эмодзи
        }).setOrigin(0.5);
        container.add(icon);
        
        if (import.meta.env.DEV) {
          console.warn(`[ChestPreviewModal] Real unit texture not found: ${data.assetKey} (id=${data.id})`);
        }
      }
    } else {
      // Валюта и прочее
      if (this.scene.textures.exists(data.assetKey)) {
        const img = this.scene.add.image(0, -5, data.assetKey);
        img.setDisplaySize(50, 50);
        container.add(img);
      } else {
        // ✅ ДОБАВЛЕН ФОН для fallback
        const fallbackBg = this.scene.add.circle(0, -5, 30, 0x2a2a4a, 0.8);
        fallbackBg.setStrokeStyle(2, rarityColor);
        container.add(fallbackBg);
        
        const emoji = data.id === 'coins' ? '🪙' : 
                      data.id === 'crystals' ? '💎' : 
                      data.id === 'key_fragment' ? '🔑' : 
                      data.id === 'ticket' ? '🎫' : '❓';
        const emojiText = this.scene.add.text(0, -5, emoji, {
          fontSize: '36px',
          fontFamily: 'Arial', // Важно для отображения эмодзи
        }).setOrigin(0.5);
        container.add(emojiText);
      }
    }
    
    // Название
    const nameText = this.scene.add.text(0, size / 2 - 8, data.name, {
      fontSize: '9px',
      fontFamily: getFonts().tech,
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);
    container.add(nameText);
    
    // Количество (если есть)
    if (data.amount) {
      const amountText = this.scene.add.text(0, size / 2 + 6, data.amount, {
        fontSize: '10px',
        fontFamily: getFonts().tech,
        color: hexToString(rarityColor),
        fontStyle: 'bold',
      }).setOrigin(0.5);
      container.add(amountText);
    }
    
    return container;
  }

  private getCarouselData(): LootExample[] {
    const items: LootExample[] = [];
    const lp = this.chest.lootProfile;
    
    // Монеты
    if (lp.weights.coins > 0) {
      items.push({
        type: 'currency',
        id: 'coins',
        name: 'Монеты',
        assetKey: 'reward_coins_256',
        amount: `${lp.coinRange.min}-${lp.coinRange.max}`,
      });
    }
    
    // Кристаллы
    if (lp.weights.crystals && lp.weights.crystals > 0) {
      const range = lp.crystalRange || { min: 1, max: 3 };
      items.push({
        type: 'currency',
        id: 'crystals',
        name: 'Кристаллы',
        assetKey: 'reward_crystals_256',
        amount: `${range.min}-${range.max}`,
      });
    }
    
    // Фрагменты ключа
    if (lp.weights.tournament_key_fragment && lp.weights.tournament_key_fragment > 0) {
      items.push({
        type: 'item',
        id: 'key_fragment',
        name: 'Фрагмент ключа',
        rarity: 'rare',
        assetKey: 'tournament_key_full_256',  // ✅ ПРАВИЛЬНЫЙ КЛЮЧ
        amount: 'x1',
      });
    }
    
    // Билеты
    if (lp.weights.tournament_ticket && lp.weights.tournament_ticket > 0) {
      items.push({
        type: 'item',
        id: 'ticket',
        name: 'Билет',
        rarity: 'epic',
        assetKey: 'tournament_ticket_256x128',  // ✅ ПРАВИЛЬНЫЙ КЛЮЧ
        amount: 'x1',
      });
    }
    
    // Карты способностей (по 1 каждой редкости)
    const cards = getAllCards();
    const cardsByRarity = {
      common: cards.filter(c => c.rarity === 'common')[0],
      rare: cards.filter(c => c.rarity === 'rare')[0],
      epic: cards.filter(c => c.rarity === 'epic')[0],
    };
    
    if (lp.weights.cards > 0) {
      Object.entries(cardsByRarity).forEach(([rarity, card]) => {
        if (card) {
          items.push({
            type: 'card',
            id: card.id,
            name: card.name,
            rarity: rarity,
            assetKey: `card_${card.id}`,
            amount: `x${lp.cardPackSize || 1}`,
          });
        }
      });
    }
    
    // Юниты (примеры каждой редкости)
    if (lp.weights.fragments > 0 || lp.weights.cap_unlock) {
      const units = getNonBattlePassUnits();
      const unitsByRarity = {
        common: units.filter(u => u.rarity === 'common')[0],
        rare: units.filter(u => u.rarity === 'rare')[0],
        epic: units.filter(u => u.rarity === 'epic')[0],
        legendary: units.filter(u => u.rarity === 'legendary')[0],
      };
      
      Object.entries(unitsByRarity).forEach(([rarity, unit]) => {
        if (unit) {
          items.push({
            type: 'unit',
            id: unit.id,
            name: getDisplayName(unit),
            rarity: rarity,
            assetKey: unit.assetKey,
            amount: `${lp.fragmentRange.min}-${lp.fragmentRange.max} фраг.`,
          });
        }
      });
    }
    
    return items;
  }

  private createCarouselIndicators(y: number): void {
    const count = Math.min(this.carouselItems.length, 7); // Максимум 7 точек
    const spacing = 12;
    const startX = -((count - 1) * spacing) / 2;
    
    for (let i = 0; i < count; i++) {
      const dot = this.scene.add.circle(
        startX + i * spacing, 
        y, 
        4, 
        i === 0 ? this.chestColor : 0x444444
      );
      dot.setName(`indicator_${i}`);
      this.contentContainer.add(dot);
    }
  }

  private createCarouselArrows(y: number): void {
    const arrowOffset = this.modalWidth / 2 - 25;
    
    // Левая стрелка
    const leftArrow = this.scene.add.text(-arrowOffset, y, '◀', {
      fontSize: '20px',
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    leftArrow.on('pointerdown', () => this.prevCarouselItem());
    leftArrow.on('pointerover', () => leftArrow.setColor('#ffffff'));
    leftArrow.on('pointerout', () => leftArrow.setColor('#666666'));
    
    this.contentContainer.add(leftArrow);
    
    // Правая стрелка
    const rightArrow = this.scene.add.text(arrowOffset, y, '▶', {
      fontSize: '20px',
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    rightArrow.on('pointerdown', () => this.nextCarouselItem());
    rightArrow.on('pointerover', () => rightArrow.setColor('#ffffff'));
    rightArrow.on('pointerout', () => rightArrow.setColor('#666666'));
    
    this.contentContainer.add(rightArrow);
  }

  private nextCarouselItem(): void {
    if (this.carouselItems.length <= 1) return;
    this.carouselIndex = (this.carouselIndex + 1) % this.carouselItems.length;
    this.updateCarouselPosition(true);
    this.updateCarouselIndicators();
  }

  private prevCarouselItem(): void {
    if (this.carouselItems.length <= 1) return;
    this.carouselIndex = (this.carouselIndex - 1 + this.carouselItems.length) % this.carouselItems.length;
    this.updateCarouselPosition(true);
    this.updateCarouselIndicators();
  }

  private updateCarouselPosition(animate: boolean): void {
    const itemWidth = 100;
    const spacing = 20;
    const targetX = -this.carouselIndex * (itemWidth + spacing);
    
    if (this.carouselTween) {
      this.carouselTween.stop();
    }
    
    if (animate) {
      this.carouselTween = this.scene.tweens.add({
        targets: this.carouselContainer,
        x: targetX,
        duration: 300,
        ease: 'Power2',
      });
    } else {
      this.carouselContainer.x = targetX;
    }
  }

  private updateCarouselIndicators(): void {
    const count = Math.min(this.carouselItems.length, 7);
    for (let i = 0; i < count; i++) {
      const dot = this.contentContainer.getByName(`indicator_${i}`) as Phaser.GameObjects.Arc;
      if (dot) {
        dot.setFillStyle(i === this.carouselIndex % count ? this.chestColor : 0x444444);
      }
    }
  }

  // ============================================================
  // BREAKDOWN ШАНСОВ
  // ============================================================

  private createLootBreakdown(): void {
    // Увеличиваем отступ чтобы не конфликтовать с каруселью
    const y = -this.modalHeight / 2 + 440;
    const fonts = getFonts();
    
    // Заголовок секции
    const sectionTitle = this.scene.add.text(0, y - 20, '📊 ШАНСЫ ВЫПАДЕНИЯ', {
      fontSize: '12px',
      fontFamily: fonts.tech,
      color: '#666666',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.contentContainer.add(sectionTitle);
    
    // Категории лута с шансами
    const categories = this.getLootCategories();
    const barWidth = this.modalWidth - 80;
    const barHeight = 20;
    const spacing = 28;
    let currentY = y + 10;
    
    categories.forEach((category) => {
      this.createChanceBar(0, currentY, barWidth, barHeight, category);
      currentY += spacing;
    });
  }

  private getLootCategories(): LootCategory[] {
    const lp = this.chest.lootProfile;
    const totalWeight = Object.values(lp.weights).reduce((a, b) => a + (b || 0), 0);
    
    const categories: LootCategory[] = [];
    
    if (lp.weights.coins > 0) {
      categories.push({
        id: 'coins',
        nameRu: 'Монеты',
        nameEn: 'Coins',
        icon: '🪙',
        color: 0xffd700,
        chance: Math.round((lp.weights.coins / totalWeight) * 100),
        examples: [],
      });
    }
    
    if (lp.weights.crystals && lp.weights.crystals > 0) {
      categories.push({
        id: 'crystals',
        nameRu: 'Кристаллы',
        nameEn: 'Crystals',
        icon: '💎',
        color: 0xaa66ff,
        chance: Math.round((lp.weights.crystals / totalWeight) * 100),
        examples: [],
      });
    }
    
    if (lp.weights.cards > 0) {
      categories.push({
        id: 'cards',
        nameRu: 'Карты',
        nameEn: 'Cards',
        icon: '🃏',
        color: 0x3b82f6,
        chance: Math.round((lp.weights.cards / totalWeight) * 100),
        examples: [],
      });
    }
    
    if (lp.weights.fragments > 0) {
      categories.push({
        id: 'fragments',
        nameRu: 'Фрагменты',
        nameEn: 'Fragments',
        icon: '🧩',
        color: 0x10b981,
        chance: Math.round((lp.weights.fragments / totalWeight) * 100),
        examples: [],
      });
    }
    
    if (lp.weights.tournament_key_fragment && lp.weights.tournament_key_fragment > 0) {
      categories.push({
        id: 'key',
        nameRu: 'Ключи',
        nameEn: 'Keys',
        icon: '🔑',
        color: 0xffaa00,
        chance: Math.round((lp.weights.tournament_key_fragment / totalWeight) * 100),
        examples: [],
      });
    }
    
    if (lp.weights.tournament_ticket && lp.weights.tournament_ticket > 0) {
      categories.push({
        id: 'ticket',
        nameRu: 'Билеты',
        nameEn: 'Tickets',
        icon: '🎫',
        color: 0x00ff88,
        chance: Math.round((lp.weights.tournament_ticket / totalWeight) * 100),
        examples: [],
      });
    }
    
    return categories;
  }

  private createChanceBar(
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    category: LootCategory
  ): void {
    const container = this.scene.add.container(x, y);
    this.contentContainer.add(container);
    
    // Фон бара (тёмный)
    const bgBar = this.scene.add.rectangle(0, 0, width, height, 0x1a1a2e, 0.8);
    bgBar.setOrigin(0.5, 0.5); // Центрируем
    container.add(bgBar);
    
    // Заполненная часть (слева направо)
    const fillWidth = Math.max(1, (category.chance / 100) * width); // Минимум 1px
    const fillBar = this.scene.add.rectangle(
      -width / 2 + 2,  // Начинаем слева с небольшим отступом
      0, 
      0,               // Начальная ширина для анимации
      height - 4, 
      category.color, 
      0.7
    );
    fillBar.setOrigin(0, 0.5); // Якорь слева
    container.add(fillBar);
    
    // Анимация заполнения
    this.scene.tweens.add({
      targets: fillBar,
      width: fillWidth - 4, // Небольшой отступ справа
      duration: 800,
      delay: 300,
      ease: 'Power2',
    });
    
    // Иконка и название (слева)
    const label = this.scene.add.text(-width / 2 + 10, 0, `${category.icon} ${category.nameRu}`, {
      fontSize: '11px',
      fontFamily: getFonts().tech,
      color: '#ffffff',
    }).setOrigin(0, 0.5);
    container.add(label);
    
    // Процент (справа)
    const percent = this.scene.add.text(width / 2 - 10, 0, `${category.chance}%`, {
      fontSize: '11px',
      fontFamily: getFonts().tech,
      color: hexToString(category.color),
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    container.add(percent);
  }

  // ============================================================
  // КНОПКИ
  // ============================================================

  private createButtons(): void {
    const y = this.modalHeight / 2 - 50;
    const fonts = getFonts();
    
    // Цена
    const priceText = this.chest.price.crystals 
      ? `💎 ${this.chest.price.crystals}`
      : `🪙 ${this.chest.price.coins}`;
    
    // Кнопка покупки
    const buyBtn = this.scene.add.container(0, y);
    
    const btnWidth = 180;
    const btnHeight = 44;
    
    const btnBg = this.scene.add.graphics();
    btnBg.fillStyle(this.chestColor, 1);
    btnBg.fillRoundedRect(-btnWidth/2, -btnHeight/2, btnWidth, btnHeight, 10);
    buyBtn.add(btnBg);
    
    // Свечение кнопки
    const btnGlow = this.scene.add.graphics();
    btnGlow.fillStyle(this.chestColor, 0.3);
    btnGlow.fillRoundedRect(-btnWidth/2 - 4, -btnHeight/2 - 4, btnWidth + 8, btnHeight + 8, 12);
    buyBtn.addAt(btnGlow, 0);
    
    // Анимация пульсации
    this.scene.tweens.add({
      targets: btnGlow,
      alpha: 0.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });
    
    // Текст кнопки
    const btnText = this.scene.add.text(0, 0, `ОТКРЫТЬ  ${priceText}`, {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    buyBtn.add(btnText);
    
    // Интерактивность
    const hitArea = this.scene.add.rectangle(0, 0, btnWidth, btnHeight, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    buyBtn.add(hitArea);
    
    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      
      this.scene.tweens.add({
        targets: buyBtn,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 100,
        yoyo: true,
      });
    });
    
    hitArea.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      this.close();
      this.onPurchase();
    });
    
    hitArea.on('pointerover', () => {
      this.scene.tweens.add({
        targets: buyBtn,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 200,
      });
    });
    
    hitArea.on('pointerout', () => {
      this.scene.tweens.add({
        targets: buyBtn,
        scaleX: 1,
        scaleY: 1,
        duration: 200,
      });
    });
    
    this.contentContainer.add(buyBtn);
  }

  private createCloseButton(): void {
    const x = this.modalWidth / 2 - 20;
    const y = -this.modalHeight / 2 + 20;
    
    const closeBtn = this.scene.add.text(x, y, '✕', {
      fontSize: '24px',
      color: '#666666',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      preventNativeEvent(pointer);
      this.close();
    });
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#666666'));
    
    this.contentContainer.add(closeBtn);
  }

  // ============================================================
  // СИСТЕМА ЧАСТИЦ
  // ============================================================

  private initParticles(): void {
    const particleCount = 30;
    
    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle());
    }
  }

  private createParticle(): ParticleConfig {
    const angle = Math.random() * Math.PI * 2;
    const distance = 100 + Math.random() * 150;
    
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      vx: (Math.random() - 0.5) * 0.5,
      vy: -0.5 - Math.random() * 0.5,
      size: 1 + Math.random() * 3,
      alpha: 0.3 + Math.random() * 0.5,
      color: Math.random() > 0.5 ? this.chestColor : 0xffffff,
      life: Math.random() * 100,
      maxLife: 100 + Math.random() * 100,
    };
  }

  private updateParticles(): void {
    if (this.isClosing) return;
    
    this.particleGraphics.clear();
    
    this.particles.forEach((p, index) => {
      // Обновление позиции
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      
      // Плавное угасание
      const lifeRatio = p.life / p.maxLife;
      const alpha = p.alpha * (1 - lifeRatio);
      
      // Рисование частицы
      this.particleGraphics.fillStyle(p.color, alpha);
      this.particleGraphics.fillCircle(p.x, p.y, p.size * (1 - lifeRatio * 0.5));
      
      // Респавн частицы
      if (p.life >= p.maxLife) {
        this.particles[index] = this.createParticle();
      }
    });
  }

  // ============================================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
  // ============================================================

  private getChestColor(): number {
    switch (this.chest.id) {
      case 'chest_cosmic': return 0xa855f7;  // Фиолетовый
      case 'chest_nova': return 0x3b82f6;    // Синий
      case 'chest_nebula': return 0x10b981;  // Зелёный
      case 'chest_stellar': 
      default: return 0xffd700;              // Золотой
    }
  }

  private getRarityColor(rarity?: string): number {
    switch (rarity) {
      case 'legendary': return 0xf59e0b;
      case 'epic': return 0xa855f7;
      case 'rare': return 0x3b82f6;
      case 'common':
      default: return 0x9ca3af;
    }
  }

  // ============================================================
  // ЗАКРЫТИЕ
  // ============================================================

  public close(): void {
    if (this.isClosing) return;
    this.isClosing = true;
    
    // Остановка таймеров
    this.updateEvent?.remove();
    this.autoScrollTimer?.remove();
    this.carouselTween?.stop();
    
    // Анимация закрытия
    this.scene.tweens.add({
      targets: this.contentContainer,
      scaleX: 0.8,
      scaleY: 0.8,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
    });
    
    this.scene.tweens.add({
      targets: this.overlay.list[0], // dimBg
      fillAlpha: 0,
      duration: 300,
      onComplete: () => {
        this.destroy();
        this.onClose();
      },
    });
    
    try {
      AudioManager.getInstance().playSFX('sfx_click');
    } catch (e) {}
  }

  public destroy(): void {
    this.updateEvent?.remove();
    this.autoScrollTimer?.remove();
    this.carouselTween?.stop();
    
    // Очищаем маску карусели
    if (this.carouselContainer) {
      const mask = this.carouselContainer.mask;
      if (mask) {
        this.carouselContainer.clearMask(true); // true = destroy mask
      }
    }
    
    // Уничтожаем graphics маски
    if (this.carouselMaskGraphics) {
      this.carouselMaskGraphics.destroy();
      this.carouselMaskGraphics = undefined;
    }
    
    this.overlay?.destroy();
  }
}
