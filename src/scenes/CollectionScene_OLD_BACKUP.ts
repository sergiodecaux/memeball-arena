import Phaser from 'phaser';
import { UNITS_REPOSITORY, getUnitsByFaction, UnitData as RepoUnitData, UnitRarity, getUnitById } from '../data/UnitsRepository';
import { FactionId } from '../constants/gameConstants';
import { playerData } from '../data/PlayerData';

/**
 * CollectionScene - репозиторий всех фишек
 * Главное меню с 4 фракциями → детальный просмотр фракции → карточка юнита
 */
export class CollectionScene extends Phaser.Scene {
  private currentView: 'factions' | 'faction-detail' | 'unit-detail' = 'factions';
  private selectedFaction?: FactionId;
  private selectedUnit?: RepoUnitData;
  private background?: Phaser.GameObjects.Image;
  private container?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CollectionScene' });
  }

  create(): void {
    this.createBackground();
    this.showFactionsView();
  }

  /**
   * Создает фон в зависимости от текущего вида
   */
  private createBackground(): void {
    const { width, height } = this.cameras.main;

    // Основной фон
    if (this.background) {
      this.background.destroy();
    }

    // Градиентный фон по умолчанию
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e, 1);
    graphics.fillRect(0, 0, width, height);

    // Добавляем паттерн сетки
    this.createGridPattern(width, height);
  }

  /**
   * Создает паттерн сетки для фона
   */
  private createGridPattern(width: number, height: number): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x2a2a3e, 0.3);

    const gridSize = 50;
    for (let x = 0; x < width; x += gridSize) {
      graphics.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.lineBetween(0, y, width, y);
    }
  }

  /**
   * Главный экран - выбор фракции
   */
  private showFactionsView(): void {
    this.currentView = 'factions';
    this.clearContainer();

    const { width, height } = this.cameras.main;
    this.container = this.add.container(0, 0);

    // Заголовок
    const title = this.add.text(width / 2, 80, '🏛️ UNITS REPOSITORY', {
      fontFamily: 'Arial Black',
      fontSize: '48px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, 140, 'Choose your faction', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.container.add([title, subtitle]);

    // 4 карточки фракций в сетке 2x2
    const factions: Array<{ id: FactionId; name: string; emoji: string; color: number }> = [
      { id: 'magma', name: 'MAGMA BRUTES', emoji: '🔥', color: 0xff4400 },
      { id: 'cyborg', name: 'CYBORG LEGION', emoji: '🤖', color: 0x00aaff },
      { id: 'void', name: 'VOID COLLECTIVE', emoji: '🌌', color: 0x8800ff },
      { id: 'insect', name: 'INSECT SWARM', emoji: '🐜', color: 0x00ff44 },
    ];

    const cardWidth = 320;
    const cardHeight = 200;
    const spacing = 40;
    const startX = width / 2 - cardWidth - spacing / 2;
    const startY = height / 2 - cardHeight / 2;

    factions.forEach((faction, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);
      const x = startX + col * (cardWidth + spacing);
      const y = startY + row * (cardHeight + spacing);

      const card = this.createFactionCard(faction, x, y, cardWidth, cardHeight);
      this.container.add(card);
    });

    // Кнопка "Назад"
    const backButton = this.createButton(80, height - 60, 'BACK', () => {
      this.scene.start('MenuScene');
    }, 0x444444);
    this.container.add(backButton);
  }

  /**
   * Создает карточку фракции
   */
  private createFactionCard(
    faction: { id: FactionId; name: string; emoji: string; color: number },
    x: number,
    y: number,
    width: number,
    height: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // Фон карточки
    const bg = this.add.rectangle(0, 0, width, height, 0x1a1a2e, 0.9);
    bg.setStrokeStyle(3, faction.color, 0.8);

    // Подсветка сверху
    const highlight = this.add.rectangle(0, -height / 2 + 15, width - 6, 30, faction.color, 0.3);

    // Эмодзи фракции
    const emoji = this.add.text(0, -40, faction.emoji, {
      fontSize: '64px',
    }).setOrigin(0.5);

    // Название фракции
    const name = this.add.text(0, 20, faction.name, {
      fontFamily: 'Arial Black',
      fontSize: '20px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // Прогресс коллекции
    const units = getUnitsByFaction(faction.id);
    const owned = this.getOwnedUnitsCount(faction.id);
    const progress = this.add.text(0, 55, `${owned}/${units.length}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    // Прогресс-бар
    const progressBarBg = this.add.rectangle(0, 80, width - 40, 8, 0x333333);
    const progressBarFill = this.add.rectangle(
      -width / 2 + 20,
      80,
      ((width - 40) * owned) / units.length,
      8,
      faction.color
    ).setOrigin(0, 0.5);

    container.add([bg, highlight, emoji, name, progress, progressBarBg, progressBarFill]);

    // Интерактивность
    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setFillStyle(0x2a2a3e, 0.9);
      this.tweens.add({ targets: container, scale: 1.05, duration: 200 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(0x1a1a2e, 0.9);
      this.tweens.add({ targets: container, scale: 1, duration: 200 });
    });
    bg.on('pointerdown', () => {
      this.showFactionDetailView(faction.id);
    });

    return container;
  }

  /**
   * Экран детального просмотра фракции
   */
  private showFactionDetailView(factionId: FactionId): void {
    this.currentView = 'faction-detail';
    this.selectedFaction = factionId;
    this.clearContainer();

    const { width, height } = this.cameras.main;
    this.container = this.add.container(0, 0);

    // Фон фракции
    this.createFactionBackground(factionId);

    const units = getUnitsByFaction(factionId);
    const factionColors = {
      magma: 0xff4400,
      cyborg: 0x00aaff,
      void: 0x8800ff,
      insect: 0x00ff44,
    };
    const factionNames = {
      magma: '🔥 MAGMA BRUTES',
      cyborg: '🤖 CYBORG LEGION',
      void: '🌌 VOID COLLECTIVE',
      insect: '🐜 INSECT SWARM',
    };

    // Заголовок
    const title = this.add.text(width / 2, 60, factionNames[factionId], {
      fontFamily: 'Arial Black',
      fontSize: '40px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    const owned = this.getOwnedUnitsCount(factionId);
    const progress = this.add.text(width - 100, 60, `${owned}/${units.length}`, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#aaaaaa',
    }).setOrigin(0.5);

    this.container.add([title, progress]);

    // Сортируем юнитов по редкости
    const rarityOrder: UnitRarity[] = ['common', 'rare', 'epic', 'legendary'];
    const groupedUnits: Record<UnitRarity, RepoUnitData[]> = {
      common: [],
      rare: [],
      epic: [],
      legendary: [],
    };

    units.forEach((unit) => {
      groupedUnits[unit.rarity].push(unit);
    });

    // Отображаем юнитов по группам редкости
    let currentY = 150;
    const cardSize = 90;
    const cardSpacing = 25;

    rarityOrder.forEach((rarity) => {
      const unitsInRarity = groupedUnits[rarity];
      if (unitsInRarity.length === 0) return;

      // Заголовок редкости
      const rarityColors = {
        common: '#aaaaaa',
        rare: '#4488ff',
        epic: '#aa44ff',
        legendary: '#ffaa00',
      };
      const rarityIcons = {
        common: '⚪',
        rare: '🔵',
        epic: '🟣',
        legendary: '🟠',
      };

      const rarityTitle = this.add.text(
        100,
        currentY,
        `${rarityIcons[rarity]} ${rarity.toUpperCase()} (${unitsInRarity.length})`,
        {
          fontFamily: 'Arial Black',
          fontSize: '22px',
          color: rarityColors[rarity],
          stroke: '#000000',
          strokeThickness: 3,
        }
      );
      this.container.add(rarityTitle);
      currentY += 50;

      // Карточки юнитов в ряд
      const cardsPerRow = Math.floor((width - 200) / (cardSize + cardSpacing));
      const startX = 100;

      unitsInRarity.forEach((unit, index) => {
        const col = index % cardsPerRow;
        const row = Math.floor(index / cardsPerRow);
        const x = startX + col * (cardSize + cardSpacing);
        const y = currentY + row * (cardSize + cardSpacing);

        const card = this.createUnitCard(unit, x, y, cardSize, factionColors[factionId]);
        this.container.add(card);
      });

      const rows = Math.ceil(unitsInRarity.length / cardsPerRow);
      currentY += rows * (cardSize + cardSpacing) + 40;
    });

    // Кнопка "Назад"
    const backButton = this.createButton(80, height - 60, 'BACK', () => {
      this.showFactionsView();
    }, 0x444444);
    this.container.add(backButton);

    // Скроллинг если контент не помещается
    if (currentY > height) {
      this.cameras.main.setBounds(0, 0, width, currentY + 100);
      this.cameras.main.setScroll(0, 0);
    }
  }

  /**
   * Создает фон для экрана фракции
   */
  private createFactionBackground(factionId: FactionId): void {
    const { width, height } = this.cameras.main;

    // Пробуем загрузить фоновое изображение
    const bgKey = `${factionId}_faction_bg`;
    
    if (this.textures.exists(bgKey)) {
      // Используем фоновое изображение
      const bg = this.add.image(width / 2, height / 2, bgKey);
      
      // Масштабируем чтобы покрыть весь экран
      const scaleX = width / bg.width;
      const scaleY = height / bg.height;
      const scale = Math.max(scaleX, scaleY);
      bg.setScale(scale);
      bg.setDepth(-2);
      
      // Добавляем затемнение для лучшей читаемости
      const overlay = this.add.graphics();
      overlay.fillStyle(0x000000, 0.3);
      overlay.fillRect(0, 0, width, height);
      overlay.setDepth(-1);
    } else {
      // Fallback на градиент если изображение не загружено
      const graphics = this.add.graphics();

      const gradients = {
        magma: [0x2a0a0a, 0x1a0000],
        cyborg: [0x0a1a2a, 0x001020],
        void: [0x1a0a2a, 0x0a0020],
        insect: [0x0a2a0a, 0x002000],
      };

      const [color1, color2] = gradients[factionId];
      graphics.fillGradientStyle(color1, color1, color2, color2, 1);
      graphics.fillRect(0, 0, width, height);
      graphics.setDepth(-1);
    }
  }

  /**
   * Создает карточку юнита
   */
  private createUnitCard(
    unit: RepoUnitData,
    x: number,
    y: number,
    size: number,
    color: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const isOwned = this.isUnitOwned(unit.id);

    // Фон карточки
    const bg = this.add.rectangle(size / 2, size / 2, size, size, isOwned ? 0x2a2a3e : 0x1a1a1a, 0.9);
    bg.setStrokeStyle(2, color, isOwned ? 1 : 0.3);

    // Изображение юнита (placeholder)
    const image = this.add.rectangle(size / 2, size / 2, size - 10, size - 10, 0x333333);
    
    // TODO: Загрузить реальное изображение
    // const image = this.add.image(size / 2, size / 2, unit.assetKey);
    // image.setDisplaySize(size - 10, size - 10);

    // Иконка редкости
    const rarityColors = {
      common: 0xaaaaaa,
      rare: 0x4488ff,
      epic: 0xaa44ff,
      legendary: 0xffaa00,
    };
    const rarityCorner = this.add.triangle(
      size - 10,
      10,
      0, 0,
      20, 0,
      0, 20,
      rarityColors[unit.rarity],
      isOwned ? 1 : 0.3
    );

    container.add([bg, image, rarityCorner]);

    // 🌟 ЭФФЕКТЫ ДЛЯ РЕДКИХ ФИШЕК
    if (isOwned) {
      if (unit.rarity === 'legendary') {
        this.addLegendaryEffects(container, size, rarityColors[unit.rarity]);
      } else if (unit.rarity === 'epic') {
        this.addEpicEffects(container, size, rarityColors[unit.rarity]);
      } else if (unit.rarity === 'rare') {
        this.addRareEffects(container, size, rarityColors[unit.rarity]);
      }
    }

    // Если не открыт - затемнение + прогресс фрагментов
    if (!isOwned) {
      const lock = this.add.rectangle(size / 2, size / 2, size, size, 0x000000, 0.7);
      const lockText = this.add.text(size / 2, size / 2 - 10, '🔒', {
        fontSize: '32px',
      }).setOrigin(0.5);
      
      // ⭐ NEW: Отображение прогресса фрагментов
      // playerData уже импортирован
      const currentFragments = playerData.getUnitFragments(unit.id);
      // Получаем fragmentsRequired из UnitsRepository если это новый юнит
      const repoUnit = getUnitById(unit.id);
      const requiredFragments = repoUnit?.fragmentsRequired || 30;
      const fragmentText = this.add.text(
        size / 2,
        size / 2 + 25,
        `${currentFragments}/${requiredFragments}`,
        {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: currentFragments >= requiredFragments ? '#00ff00' : '#ffaa00',
          stroke: '#000000',
          strokeThickness: 3,
        }
      ).setOrigin(0.5);
      
      container.add([lock, lockText, fragmentText]);
    }

    // Интерактивность
    if (isOwned) {
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerover', () => {
        this.tweens.add({ targets: container, scale: 1.1, duration: 200 });
      });
      bg.on('pointerout', () => {
        this.tweens.add({ targets: container, scale: 1, duration: 200 });
      });
      bg.on('pointerdown', () => {
        this.showUnitDetailView(unit);
      });
    }

    return container;
  }

  /**
   * Добавляет эффекты для Rare фишек (синее свечение)
   */
  private addRareEffects(container: Phaser.GameObjects.Container, size: number, color: number): void {
    // Мягкое свечение
    const glow = this.add.graphics();
    glow.fillStyle(color, 0.15);
    glow.fillCircle(size / 2, size / 2, size / 2 + 5);
    container.addAt(glow, 0);

    // Пульсация свечения
    this.tweens.add({
      targets: glow,
      alpha: 0.3,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Добавляет эффекты для Epic фишек (фиолетовое пульсирующее свечение)
   */
  private addEpicEffects(container: Phaser.GameObjects.Container, size: number, color: number): void {
    // Двойное свечение
    const glow1 = this.add.graphics();
    glow1.fillStyle(color, 0.2);
    glow1.fillCircle(size / 2, size / 2, size / 2 + 8);
    container.addAt(glow1, 0);

    const glow2 = this.add.graphics();
    glow2.fillStyle(color, 0.1);
    glow2.fillCircle(size / 2, size / 2, size / 2 + 12);
    container.addAt(glow2, 0);

    // Пульсация
    this.tweens.add({
      targets: [glow1, glow2],
      alpha: 0.4,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Вращающиеся искры по углам
    const sparkPositions = [
      { x: 10, y: 10 },
      { x: size - 10, y: 10 },
      { x: size - 10, y: size - 10 },
      { x: 10, y: size - 10 },
    ];

    sparkPositions.forEach((pos, index) => {
      const spark = this.add.graphics();
      spark.fillStyle(color, 0.8);
      spark.fillCircle(pos.x, pos.y, 3);
      container.add(spark);

      // Мерцание с задержкой
      this.tweens.add({
        targets: spark,
        alpha: 0,
        duration: 800,
        delay: index * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });
  }

  /**
   * Добавляет эффекты для Legendary фишек (золотое сияние и частицы)
   */
  private addLegendaryEffects(container: Phaser.GameObjects.Container, size: number, color: number): void {
    // Тройное сильное свечение
    const glow1 = this.add.graphics();
    glow1.fillStyle(color, 0.25);
    glow1.fillCircle(size / 2, size / 2, size / 2 + 10);
    container.addAt(glow1, 0);

    const glow2 = this.add.graphics();
    glow2.fillStyle(color, 0.15);
    glow2.fillCircle(size / 2, size / 2, size / 2 + 15);
    container.addAt(glow2, 0);

    const glow3 = this.add.graphics();
    glow3.fillStyle(0xffffff, 0.1);
    glow3.fillCircle(size / 2, size / 2, size / 2 + 20);
    container.addAt(glow3, 0);

    // Интенсивная пульсация
    this.tweens.add({
      targets: [glow1, glow2, glow3],
      alpha: 0.6,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Золотые лучи по углам
    const rayLength = 15;
    const rays = [
      { angle: -45 }, // Верхний левый
      { angle: 45 },  // Верхний правый
      { angle: 135 }, // Нижний правый
      { angle: -135 }, // Нижний левый
    ];

    rays.forEach((ray, index) => {
      const rayGraphics = this.add.graphics();
      const centerX = size / 2;
      const centerY = size / 2;
      const angleRad = Phaser.Math.DegToRad(ray.angle);
      const startDist = size / 2;
      const endDist = size / 2 + rayLength;

      rayGraphics.lineStyle(2, color, 0.8);
      rayGraphics.lineBetween(
        centerX + Math.cos(angleRad) * startDist,
        centerY + Math.sin(angleRad) * startDist,
        centerX + Math.cos(angleRad) * endDist,
        centerY + Math.sin(angleRad) * endDist
      );
      container.add(rayGraphics);

      // Пульсация лучей
      this.tweens.add({
        targets: rayGraphics,
        alpha: 0.2,
        duration: 800,
        delay: index * 200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Звёздочки вокруг карточки
    for (let i = 0; i < 8; i++) {
      const angle = (360 / 8) * i;
      const angleRad = Phaser.Math.DegToRad(angle);
      const distance = size / 2 + 10;
      const x = size / 2 + Math.cos(angleRad) * distance;
      const y = size / 2 + Math.sin(angleRad) * distance;

      const star = this.add.text(x, y, '✨', {
        fontSize: '12px',
      }).setOrigin(0.5).setAlpha(0);
      container.add(star);

      // Появление и исчезновение звёздочек
      this.tweens.add({
        targets: star,
        alpha: 1,
        scale: 1.5,
        duration: 1200,
        delay: i * 150,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Вращение золотого кольца
    const ring = this.add.graphics();
    ring.lineStyle(2, color, 0.3);
    ring.strokeCircle(size / 2, size / 2, size / 2 + 5);
    container.addAt(ring, 0);

    this.tweens.add({
      targets: ring,
      angle: 360,
      duration: 4000,
      repeat: -1,
      ease: 'Linear',
    });
  }

  /**
   * Показывает детальную информацию о юните
   */
  private showUnitDetailView(unit: RepoUnitData): void {
    this.currentView = 'unit-detail';
    this.selectedUnit = unit;

    const { width, height } = this.cameras.main;

    // Затемнение фона
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8);
    overlay.setOrigin(0);
    overlay.setInteractive();
    overlay.setDepth(1000);

    // Модальное окно
    const modalWidth = 500;
    const modalHeight = 700;
    const modal = this.add.container(width / 2, height / 2);
    modal.setDepth(1001);

    // Фон модалки с эффектами
    const bg = this.add.rectangle(0, 0, modalWidth, modalHeight, 0x1a1a2e, 1);
    bg.setStrokeStyle(4, this.getRarityColor(unit.rarity), 1);

    // Свечение рамки для редких фишек
    if (unit.rarity === 'legendary' || unit.rarity === 'epic') {
      const modalGlow = this.add.graphics();
      modalGlow.lineStyle(8, this.getRarityColor(unit.rarity), 0.3);
      modalGlow.strokeRoundedRect(-modalWidth / 2 - 4, -modalHeight / 2 - 4, modalWidth + 8, modalHeight + 8, 8);
      modal.add(modalGlow);

      // Пульсация свечения
      this.tweens.add({
        targets: modalGlow,
        alpha: 0.6,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Legendary - частицы вокруг модалки
    if (unit.rarity === 'legendary') {
      for (let i = 0; i < 12; i++) {
        const angle = (360 / 12) * i;
        const angleRad = Phaser.Math.DegToRad(angle);
        const distance = modalWidth / 2 + 20;
        const x = Math.cos(angleRad) * distance;
        const y = Math.sin(angleRad) * distance;

        const particle = this.add.text(x, y, '✨', {
          fontSize: '16px',
        }).setOrigin(0.5).setAlpha(0);
        modal.add(particle);

        this.tweens.add({
          targets: particle,
          alpha: 1,
          scale: 1.2,
          y: y - 10,
          duration: 1500,
          delay: i * 100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    }

    // Изображение юнита
    const imageSize = 300;
    const imageBg = this.add.rectangle(0, -modalHeight / 2 + imageSize / 2 + 40, imageSize, imageSize, 0x2a2a3e);
    const image = this.add.rectangle(0, -modalHeight / 2 + imageSize / 2 + 40, imageSize - 10, imageSize - 10, 0x333333);
    
    // TODO: Загрузить реальное изображение
    // const image = this.add.image(0, -modalHeight / 2 + imageSize / 2 + 40, unit.assetKey);

    // Название и титул с правильным spacing
    const rarityIcons = { common: '⚪', rare: '🔵', epic: '🟣', legendary: '🟠' };
    const rarityText = this.add.text(0, -modalHeight / 2 + imageSize + 70, `${rarityIcons[unit.rarity]} ${unit.rarity.toUpperCase()}`, {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: this.getRarityColorHex(unit.rarity),
    }).setOrigin(0.5);

    const name = this.add.text(0, -modalHeight / 2 + imageSize + 95, unit.name, {
      fontFamily: 'Arial Black',
      fontSize: '24px',
      color: '#ffffff',
      wordWrap: { width: modalWidth - 40 },
      align: 'center',
    }).setOrigin(0.5);

    const title = this.add.text(0, -modalHeight / 2 + imageSize + 130, unit.title, {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#aaaaaa',
      wordWrap: { width: modalWidth - 40 },
      align: 'center',
    }).setOrigin(0.5);

    // Статы с увеличенным spacing
    const statsY = -modalHeight / 2 + imageSize + 170;
    const statsTitle = this.add.text(-modalWidth / 2 + 40, statsY, '📊 STATS:', {
      fontFamily: 'Arial Black',
      fontSize: '20px',
      color: '#ffffff',
    });

    const stats = [
      { icon: '⚔️', name: 'Power', value: unit.stats.power },
      { icon: '🛡️', name: 'Defense', value: unit.stats.defense },
      { icon: '⚡', name: 'Speed', value: unit.stats.speed },
      { icon: '🎯', name: 'Technique', value: unit.stats.technique },
    ];

    const statElements: Phaser.GameObjects.GameObject[] = [];
    stats.forEach((stat, index) => {
      const y = statsY + 35 + index * 45; // Увеличенный spacing
      const label = this.add.text(-modalWidth / 2 + 40, y, `${stat.icon} ${stat.name}:`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      });

      // Прогресс-бар стата
      const barWidth = 180;
      const barBg = this.add.rectangle(modalWidth / 2 - 120, y + 8, barWidth, 10, 0x333333).setOrigin(0.5);
      const barFill = this.add.rectangle(
        modalWidth / 2 - 120 - barWidth / 2,
        y + 8,
        (barWidth * stat.value) / 100,
        10,
        this.getRarityColor(unit.rarity)
      ).setOrigin(0, 0.5);

      const value = this.add.text(modalWidth / 2 - 25, y, `${stat.value}`, {
        fontFamily: 'Arial',
        fontSize: '15px',
        color: '#ffffff',
      });

      statElements.push(label, barBg, barFill, value);
    });

    // Описание с правильным spacing
    const descY = statsY + 220; // Увеличенное расстояние от статов
    const descTitle = this.add.text(-modalWidth / 2 + 40, descY, '📖 DESCRIPTION:', {
      fontFamily: 'Arial Black',
      fontSize: '16px',
      color: '#ffffff',
    });

    const description = this.add.text(-modalWidth / 2 + 40, descY + 30, unit.description, {
      fontFamily: 'Arial',
      fontSize: '13px',
      color: '#cccccc',
      wordWrap: { width: modalWidth - 80 },
      lineSpacing: 4,
    });

    // ⭐ NEW: Прогресс фрагментов (если юнит не открыт)
    const isOwned = this.isUnitOwned(unit.id);
    const fragmentElements: Phaser.GameObjects.GameObject[] = [];
    
    if (!isOwned) {
      const fragmentY = modalHeight / 2 - 130;
      const currentFragments = playerData.getUnitFragments(unit.id);
      // Получаем fragmentsRequired из UnitsRepository если это новый юнит
      const repoUnit = getUnitById(unit.id);
      const requiredFragments = repoUnit?.fragmentsRequired || 30;
      const fragmentProgress = Math.min(currentFragments / requiredFragments, 1);
      
      const fragmentTitle = this.add.text(-modalWidth / 2 + 40, fragmentY, '🧩 FRAGMENTS:', {
        fontFamily: 'Arial Black',
        fontSize: '16px',
        color: '#ffffff',
      });
      
      const fragmentText = this.add.text(0, fragmentY + 30, `${currentFragments} / ${requiredFragments}`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: fragmentProgress >= 1 ? '#00ff00' : '#ffaa00',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5, 0);
      
      // Прогресс-бар фрагментов
      const barWidth = modalWidth - 80;
      const barBg = this.add.rectangle(0, fragmentY + 65, barWidth, 20, 0x333333).setOrigin(0.5);
      const barFill = this.add.rectangle(
        -barWidth / 2,
        fragmentY + 65,
        barWidth * fragmentProgress,
        20,
        fragmentProgress >= 1 ? 0x00ff00 : 0xffaa00
      ).setOrigin(0, 0.5);
      
      fragmentElements.push(fragmentTitle, fragmentText, barBg, barFill);
      
      // Если собрано достаточно фрагментов - показать "Ready to craft!"
      if (fragmentProgress >= 1) {
        const readyText = this.add.text(0, fragmentY + 90, '✅ Ready to craft!', {
          fontFamily: 'Arial',
          fontSize: '16px',
          color: '#00ff00',
        }).setOrigin(0.5, 0);
        fragmentElements.push(readyText);
      }
    }

    // Кнопка закрытия
    const closeButton = this.createButton(0, modalHeight / 2 - 50, 'CLOSE', () => {
      overlay.destroy();
      modal.destroy();
    }, 0x666666);

    modal.add([
      bg,
      imageBg,
      image,
      rarityText,
      name,
      title,
      statsTitle,
      ...statElements,
      descTitle,
      description,
      ...fragmentElements, // ⭐ NEW
      closeButton,
    ]);

    // Закрытие по клику на overlay
    overlay.on('pointerdown', () => {
      overlay.destroy();
      modal.destroy();
    });
  }

  /**
   * Создает кнопку
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    callback: () => void,
    color: number = 0x4488ff
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 140, 50, color, 1);
    bg.setStrokeStyle(2, 0xffffff, 0.5);

    const label = this.add.text(0, 0, text, {
      fontFamily: 'Arial Black',
      fontSize: '18px',
      color: '#ffffff',
    }).setOrigin(0.5);

    container.add([bg, label]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      bg.setFillStyle(color, 0.8);
      this.tweens.add({ targets: container, scale: 1.1, duration: 200 });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(color, 1);
      this.tweens.add({ targets: container, scale: 1, duration: 200 });
    });
    bg.on('pointerdown', callback);

    return container;
  }

  /**
   * Очищает текущий контейнер
   */
  private clearContainer(): void {
    if (this.container) {
      this.container.destroy(true);
    }
  }

  /**
   * Получает количество открытых юнитов фракции
   */
  private getOwnedUnitsCount(factionId: FactionId): number {
    const units = getUnitsByFaction(factionId);
    return units.filter((unit) => playerData.ownsUnit(unit.id)).length;
  }

  /**
   * Проверяет открыт ли юнит
   */
  private isUnitOwned(unitId: string): boolean {
    return playerData.ownsUnit(unitId);
  }

  /**
   * Получает цвет редкости
   */
  private getRarityColor(rarity: UnitRarity): number {
    const colors = {
      common: 0xaaaaaa,
      rare: 0x4488ff,
      epic: 0xaa44ff,
      legendary: 0xffaa00,
    };
    return colors[rarity];
  }

  /**
   * Получает цвет редкости в HEX строке
   */
  private getRarityColorHex(rarity: UnitRarity): string {
    const colors = {
      common: '#aaaaaa',
      rare: '#4488ff',
      epic: '#aa44ff',
      legendary: '#ffaa00',
    };
    return colors[rarity];
  }
}

