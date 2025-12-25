import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../config/themes';
import { playerData, FormationSlot } from '../data/PlayerData';
import { getUnit, getClassIcon, getClassColor, getClassName, UnitData } from '../data/UnitsCatalog';
import { getBallSkin, getFieldSkin } from '../data/SkinsCatalog';
import { AudioManager } from '../managers/AudioManager';

type TeamTab = 'units' | 'formation' | 'ball' | 'field';

interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

export class TeamScene extends Phaser.Scene {
  // Состояние вкладок
  private currentTab: TeamTab = 'units';
  
  // Скроллинг
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private cards: Card[] = [];
  private scrollZone!: Phaser.GameObjects.Zone;
  
  // Размеры UI
  private headerHeight = 160; 
  private visibleAreaHeight = 0;
  
  // Переменные для скролла/драга
  private isDraggingScroll = false;
  private isDraggingPuck = false; // Блокировка скролла, когда двигаем фишку тактики
  private lastPointerY = 0;
  private scrollVelocity = 0;

  // Логика выбора юнитов
  private selectedUnitSlot: number | null = null; // 0, 1, 2

  constructor() {
    super({ key: 'TeamScene' });
  }

  create(): void {
    const { height } = this.cameras.main;
    this.visibleAreaHeight = height - this.headerHeight;

    // Сброс состояния при старте
    this.cards = [];
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.selectedUnitSlot = null;
    this.isDraggingPuck = false;

    // 1. Фон
    this.createBackground();

    // 2. Контейнер контента (создаем до UI, чтобы маска работала корректно)
    this.createContentArea();

    // 3. UI (Шапка и Табы)
    this.createHeader();
    this.createTabs();
    
    // 4. Рендер текущей вкладки
    this.renderContent();

    // 5. Настройка ввода (скролл)
    this.setupInteractions();
  }

  update(): void {
    // Инерция скролла (только если не держим палец и не двигаем фишку)
    if (!this.isDraggingScroll && !this.isDraggingPuck && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.95; // Затухание
      this.updateCardPositions();
    }
  }

  // ================= UI ПОСТРОЕНИЕ =================

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    
    // Темный градиент
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0f172a, 0x0f172a, 0x1e1b4b, 0x1e1b4b, 1);
    bg.fillRect(0, 0, width, height);

    // Сетка (Tech Grid)
    const grid = this.add.grid(width/2, height/2, width, height, 40, 40, 0x000000, 0, 0xffffff, 0.03);
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const data = playerData.get();

    // Подложка шапки
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x020617, 0.95);
    headerBg.fillRect(0, 0, width, 90);
    headerBg.lineStyle(1, 0x334155);
    headerBg.lineBetween(0, 90, width, 90);

    // Кнопка Назад
    const backBtn = this.add.container(40, 45);
    const backCircle = this.add.circle(0, 0, 20, 0x1e293b).setStrokeStyle(1, 0x475569);
    const backArrow = this.add.text(0, 0, '←', { fontSize: '24px', color: '#fff' }).setOrigin(0.5);
    backBtn.add([backCircle, backArrow]);
    backBtn.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.scene.start('MainMenuScene');
      });

    // Заголовок
    this.add.text(width / 2, 45, 'MY TEAM', {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Валюта
    const currencyX = width - 20;
    
    // Кристаллы
    this.add.text(currencyX - 25, 33, `${data.crystals}`, { 
      fontSize: '14px', fontFamily: fonts.primary, color: '#a78bfa' 
    }).setOrigin(1, 0.5);
    this.add.text(currencyX, 33, '💎', { fontSize: '16px' }).setOrigin(1, 0.5);

    // Монеты
    this.add.text(currencyX - 25, 57, `${data.coins}`, { 
      fontSize: '14px', fontFamily: fonts.primary, color: '#facc15' 
    }).setOrigin(1, 0.5);
    this.add.text(currencyX, 57, '💰', { fontSize: '16px' }).setOrigin(1, 0.5);
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const tabY = 125;
    const tabH = 50;

    const tabs: { id: TeamTab; label: string; icon: string }[] = [
      { id: 'units', label: 'UNITS', icon: '🛡️' },
      { id: 'formation', label: 'TACTICS', icon: '♟️' },
      { id: 'ball', label: 'BALL', icon: '⚽' },
      { id: 'field', label: 'FIELD', icon: '🏟️' },
    ];

    const tabWidth = (width - 20) / 4;

    tabs.forEach((tab, i) => {
      const isActive = this.currentTab === tab.id;
      const x = 10 + i * tabWidth + tabWidth/2;
      
      const container = this.add.container(x, tabY);

      // Фон вкладки
      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1);
        bg.fillRoundedRect(-tabWidth/2 + 2, -tabH/2, tabWidth - 4, tabH, 8);
        // Свечение активной вкладки
        bg.lineStyle(2, 0xffffff, 0.5);
        bg.strokeRoundedRect(-tabWidth/2 + 2, -tabH/2, tabWidth - 4, tabH, 8);
      } else {
        bg.fillStyle(0x1e293b, 1);
        bg.fillRoundedRect(-tabWidth/2 + 2, -tabH/2, tabWidth - 4, tabH, 8);
      }
      container.add(bg);

      // Иконка и Текст
      const color = isActive ? '#ffffff' : '#94a3b8';
      container.add(this.add.text(0, -8, tab.icon, { fontSize: '18px' }).setOrigin(0.5));
      container.add(this.add.text(0, 12, tab.label, { 
        fontSize: '10px', 
        fontFamily: getFonts().tech,
        color: color 
      }).setOrigin(0.5));

      // Интерактивность
      if (!isActive) {
        container.setInteractive(new Phaser.Geom.Rectangle(-tabWidth/2, -tabH/2, tabWidth, tabH), Phaser.Geom.Rectangle.Contains);
        container.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click');
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.selectedUnitSlot = null; // Сброс выбора слота
          this.scene.restart(); // Перезапуск сцены для чистого рендера
        });
      }
    });
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    
    // Маска для скроллинга (чтобы контент не вылезал на шапку)
    const shape = this.make.graphics({});
    shape.fillStyle(0xffffff);
    shape.fillRect(0, this.headerHeight, width, height - this.headerHeight);
    const mask = shape.createGeometryMask();

    this.contentContainer = this.add.container(0, this.headerHeight);
    this.contentContainer.setMask(mask);
  }

  // ================= РЕНДЕР КОНТЕНТА =================

  private renderContent(): void {
    this.contentContainer.removeAll(true);
    this.cards = [];
    
    // Сброс позиции контейнера
    this.contentContainer.y = this.headerHeight - this.scrollY;

    let contentHeight = 0;

    switch (this.currentTab) {
      case 'units': contentHeight = this.renderUnitsTab(); break;
      case 'ball': contentHeight = this.renderSkinTab('ball'); break;
      case 'field': contentHeight = this.renderSkinTab('field'); break;
      case 'formation': contentHeight = this.renderFormationTab(); break;
    }

    // Рассчитываем максимальный скролл
    const visibleHeight = this.cameras.main.height - this.headerHeight;
    this.maxScrollY = Math.max(0, contentHeight - visibleHeight + 100);
    
    // Обновляем видимость карточек
    this.updateCardPositions();
  }

  // ---------- Вклдака: UNITS (Смена состава) ----------
  
  private renderUnitsTab(): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const colors = getColors();
    let yCursor = 20;

    const factionId = playerData.getFaction();
    
    // 1. АКТИВНЫЙ СОСТАВ (3 слота сверху)
    this.contentContainer.add(this.add.text(20, yCursor, 'ACTIVE SQUAD', {
      fontFamily: fonts.tech, fontSize: '14px', color: '#94a3b8'
    }));
    yCursor += 30;

    const currentTeam = playerData.getTeamUnits(); // ['id1', 'id2', 'id3']
    const slotWidth = (width - 40) / 3;
    
    currentTeam.forEach((unitId, index) => {
      const x = 20 + index * slotWidth + slotWidth/2;
      const isSelected = this.selectedUnitSlot === index;
      
      const slotContainer = this.add.container(x, yCursor + 50);
      
      // Фон слота
      const bg = this.add.graphics();
      bg.fillStyle(isSelected ? colors.uiAccent : 0x0f172a, 0.8);
      bg.fillRoundedRect(-slotWidth/2 + 4, -50, slotWidth - 8, 100, 12);
      bg.lineStyle(2, isSelected ? 0xffffff : 0x334155, 1);
      bg.strokeRoundedRect(-slotWidth/2 + 4, -50, slotWidth - 8, 100, 12);
      slotContainer.add(bg);

      // Изображение Юнита
      const unit = getUnit(unitId);
      if (unit) {
        try {
            // Используем assetKey из каталога для загрузки PNG
            const img = this.add.image(0, -10, unit.assetKey).setDisplaySize(50, 50);
            slotContainer.add(img);
            
            // Иконка класса
            slotContainer.add(this.add.text(0, 25, getClassIcon(unit.capClass), { fontSize: '16px' }).setOrigin(0.5));
            
            // Сила
            const power = playerData.getUnitPower(unitId);
            slotContainer.add(this.add.text(0, 42, `⚡${power}`, { 
                fontSize: '12px', color: '#facc15', fontFamily: fonts.tech 
            }).setOrigin(0.5));
        } catch (e) {
            slotContainer.add(this.add.text(0,0,'?').setOrigin(0.5));
        }
      } else {
        slotContainer.add(this.add.text(0, 0, '+', { fontSize: '32px', color: '#475569' }).setOrigin(0.5));
      }

      // Нажатие на слот выбирает его для замены
      slotContainer.setInteractive(new Phaser.Geom.Rectangle(-slotWidth/2, -50, slotWidth, 100), Phaser.Geom.Rectangle.Contains);
      slotContainer.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_click');
        this.selectedUnitSlot = isSelected ? null : index;
        this.renderContent(); // Перерисовываем, чтобы показать выделение
      });

      this.contentContainer.add(slotContainer);
    });

    yCursor += 120;

    // 2. ЗАПАС (Инвентарь юнитов)
    this.contentContainer.add(this.add.text(20, yCursor, 'RESERVES (TAP TO EQUIP)', {
        fontFamily: fonts.tech, fontSize: '14px', color: '#94a3b8'
      }));
    yCursor += 30;

    // Получаем всех юнитов текущей фракции
    const ownedUnits = playerData.getOwnedUnits(factionId);
    
    ownedUnits.forEach((owned) => {
      const unitData = getUnit(owned.id);
      if (!unitData) return;

      const card = this.createUnitListCard(width/2, yCursor + 40, unitData, owned);
      
      // Логика замены:
      // Если слот выбран, нажатие на карту ставит этого юнита в слот
      card.setInteractive(new Phaser.Geom.Rectangle(-160, -35, 320, 70), Phaser.Geom.Rectangle.Contains);
      card.on('pointerdown', () => {
        if (this.selectedUnitSlot !== null) {
            AudioManager.getInstance().playSFX('sfx_equip');
            playerData.setTeamUnit(this.selectedUnitSlot, unitData.id);
            this.selectedUnitSlot = null; // Снимаем выделение
            this.renderContent(); // Обновляем UI
        } else {
            // Если слот не выбран, можно просто проиграть звук или показать инфо
            AudioManager.getInstance().playSFX('sfx_click');
        }
      });

      this.contentContainer.add(card);
      this.cards.push({ container: card, y: yCursor + 40, height: 80 });
      yCursor += 90;
    });

    return yCursor;
  }

  private createUnitListCard(x: number, y: number, unit: UnitData, owned: any): Phaser.GameObjects.Container {
    const colors = getColors();
    const fonts = getFonts();
    const container = this.add.container(x, y);

    // Фон карточки
    const bg = this.add.graphics();
    bg.fillStyle(0x1e293b, 1);
    bg.fillRoundedRect(-160, -35, 320, 70, 12);
    
    // Обводка цветом класса
    const classColor = getClassColor(unit.capClass);
    bg.lineStyle(2, classColor, 1);
    bg.strokeRoundedRect(-160, -35, 320, 70, 12);
    
    container.add(bg);

    // Аватарка юнита
    try {
        const avatar = this.add.image(-120, 0, unit.assetKey).setDisplaySize(50, 50);
        container.add(avatar);
    } catch(e) {
        container.add(this.add.text(-120, 0, '?', {fontSize: '24px'}).setOrigin(0.5));
    }

    // Информация
    container.add(this.add.text(-80, -15, unit.name, {
        fontFamily: fonts.primary, fontSize: '16px', color: '#fff', fontStyle: 'bold'
    }));

    container.add(this.add.text(-80, 8, `${getClassIcon(unit.capClass)} ${getClassName(unit.capClass)}`, {
        fontSize: '12px', color: hexToString(classColor)
    }));

    // Сила
    const power = playerData.getUnitPower(unit.id);
    container.add(this.add.text(140, 0, `⚡${power}`, {
        fontSize: '18px', color: '#facc15', fontFamily: fonts.tech
    }).setOrigin(1, 0.5));

    return container;
  }

  // ---------- Вкладки: BALL & FIELD (Скины) ----------

  private renderSkinTab(type: 'ball' | 'field'): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    let yCursor = 20;

    // Получаем список скинов
    const ownedSkins = type === 'ball' ? playerData.get().ownedBallSkins : playerData.get().ownedFieldSkins;
    const equippedId = type === 'ball' ? playerData.get().equippedBallSkin : playerData.get().equippedFieldSkin;

    ownedSkins.forEach((owned) => {
        const skinData = type === 'ball' ? getBallSkin(owned.id) : getFieldSkin(owned.id);
        
        // ВАЖНО: Если скин удален из каталога, но есть у игрока, пропускаем, чтобы не крашнулось
        if (!skinData) return;

        const x = width / 2;
        const y = yCursor + 60;
        
        const card = this.add.container(x, y);
        const isEquipped = skinData.id === equippedId;

        // Фон
        const bg = this.add.graphics();
        bg.fillStyle(0x1e293b, 1);
        bg.fillRoundedRect(-160, -50, 320, 100, 16);
        
        if (isEquipped) {
            bg.lineStyle(2, 0x22c55e, 1);
            bg.strokeRoundedRect(-160, -50, 320, 100, 16);
        }
        card.add(bg);

        // Превью
        try {
            if (skinData.textureKey) {
                const img = this.add.image(-100, 0, skinData.textureKey);
                // Масштабируем
                if (type === 'ball') img.setDisplaySize(60, 60);
                else img.setDisplaySize(100, 60);
                card.add(img);
            }
        } catch (e) {
            card.add(this.add.text(-100, 0, 'IMG?', { fontSize: '10px' }).setOrigin(0.5));
        }

        // Имя
        card.add(this.add.text(-20, -15, skinData.name, {
            fontFamily: fonts.primary, fontSize: '16px', color: '#fff', fontStyle: 'bold'
        }));

        // Статус
        const statusText = isEquipped ? 'EQUIPPED' : 'TAP TO EQUIP';
        const statusColor = isEquipped ? '#22c55e' : '#64748b';
        card.add(this.add.text(-20, 10, statusText, {
            fontFamily: fonts.tech, fontSize: '12px', color: statusColor
        }));

        // Выбор скина
        card.setInteractive(new Phaser.Geom.Rectangle(-160, -50, 320, 100), Phaser.Geom.Rectangle.Contains);
        card.on('pointerdown', () => {
            AudioManager.getInstance().playSFX('sfx_click');
            if (type === 'ball') playerData.equipBallSkin(skinData.id);
            else playerData.equipFieldSkin(skinData.id);
            this.renderContent(); // Обновляем галочки
        });

        this.contentContainer.add(card);
        this.cards.push({ container: card, y: y, height: 100 });
        yCursor += 110;
    });

    return yCursor;
  }

  // ---------- Вкладка: TACTICS (Редактор расстановки) ----------

  private renderFormationTab(): number {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    let yCursor = 20;

    // Инструкция
    this.contentContainer.add(this.add.text(width/2, yCursor, 'DRAG UNITS TO SET POSITION', {
        fontFamily: fonts.tech, fontSize: '12px', color: '#94a3b8'
    }).setOrigin(0.5));
    yCursor += 30;

    // --- МИНИ-ПОЛЕ ---
    const fieldW = 300;
    const fieldH = 400; 
    const fieldX = width / 2;
    const fieldY = yCursor + fieldH / 2;

    const editorContainer = this.add.container(0, 0); 
    this.contentContainer.add(editorContainer);

    // Графика поля
    const field = this.add.graphics();
    field.fillStyle(0x0f172a, 1);
    field.fillRoundedRect(fieldX - fieldW/2, fieldY - fieldH/2, fieldW, fieldH, 16);
    field.lineStyle(2, 0x334155, 1);
    field.strokeRoundedRect(fieldX - fieldW/2, fieldY - fieldH/2, fieldW, fieldH, 16);
    
    // Центральная линия
    field.lineStyle(1, 0x334155, 0.3);
    field.lineBetween(fieldX - fieldW/2, fieldY, fieldX + fieldW/2, fieldY); 
    field.strokeCircle(fieldX, fieldY, 40);

    editorContainer.add(field);

    // --- ПЕРЕТАСКИВАЕМЫЕ ФИШКИ ---
    const currentFormation = playerData.getSelectedFormation();
    const teamIds = playerData.getTeamUnits();

    currentFormation.slots.forEach((slot, index) => {
        // Конвертируем нормализованные координаты (0-1) в пиксели
        // slot.x (0 слева, 1 справа)
        // slot.y (0 у ворот соперника, 1 у своих ворот)
        
        // В редакторе мы показываем ПОЛОВИНУ поля или ВСЁ поле? 
        // Обычно игрок настраивает свою половину (y: 0.5 - 1.0).
        // Но чтобы было понятнее, отобразим все поле, но ограничим движение нижней половиной.
        
        const px = fieldX - fieldW/2 + slot.x * fieldW;
        const py = fieldY - fieldH/2 + slot.y * fieldH; 
        
        const puck = this.createDraggablePuck(px, py, teamIds[index], index);
        
        // Включаем Drag
        puck.setInteractive({ draggable: true });
        
        puck.on('dragstart', () => {
             this.isDraggingPuck = true; // БЛОКИРУЕМ СКРОЛЛ
             puck.setScale(1.2);
             AudioManager.getInstance().playSFX('sfx_click');
        });

        puck.on('drag', (pointer: any, dragX: number, dragY: number) => {
             // Ограничиваем движение пределами поля (и нижней половиной для реализма)
             const minX = fieldX - fieldW/2 + 20;
             const maxX = fieldX + fieldW/2 - 20;
             const minY = fieldY; // Только своя половина
             const maxY = fieldY + fieldH/2 - 20;

             const clampedX = Phaser.Math.Clamp(dragX, minX, maxX);
             const clampedY = Phaser.Math.Clamp(dragY, minY, maxY);
             
             puck.setPosition(clampedX, clampedY);
        });

        puck.on('dragend', () => {
             this.isDraggingPuck = false; // РАЗБЛОКИРУЕМ СКРОЛЛ
             puck.setScale(1.0);
             AudioManager.getInstance().playSFX('sfx_swish');

             // СОХРАНЯЕМ ПОЗИЦИЮ
             // Переводим пиксели обратно в 0-1
             const normX = (puck.x - (fieldX - fieldW/2)) / fieldW;
             const normY = (puck.y - (fieldY - fieldH/2)) / fieldH;

             this.savePuckPosition(index, normX, normY);
        });

        editorContainer.add(puck);
    });

    yCursor += fieldH + 20;

    // Кнопка сброса
    const resetBtn = this.add.container(width/2, yCursor + 25);
    const btnBg = this.add.graphics();
    btnBg.fillStyle(0x334155, 1);
    btnBg.fillRoundedRect(-80, -20, 160, 40, 8);
    resetBtn.add(btnBg);
    resetBtn.add(this.add.text(0, 0, 'RESET DEFAULT', { fontSize: '12px', fontFamily: fonts.tech }).setOrigin(0.5));
    
    resetBtn.setInteractive(new Phaser.Geom.Rectangle(-80, -20, 160, 40), Phaser.Geom.Rectangle.Contains);
    resetBtn.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_click');
        playerData.selectFormation('formation_2_1'); // Сброс на дефолтную
        this.renderContent();
    });
    this.contentContainer.add(resetBtn);

    return yCursor + 60;
  }

  private createDraggablePuck(x: number, y: number, unitId: string, index: number): Phaser.GameObjects.Container {
      const container = this.add.container(x, y);
      const unit = getUnit(unitId);
      const color = unit ? getClassColor(unit.capClass) : 0xffffff;

      // Свечение
      const glow = this.add.graphics();
      glow.fillStyle(color, 0.4);
      glow.fillCircle(0, 0, 25);
      container.add(glow);

      // Тело фишки
      const circle = this.add.circle(0, 0, 18, 0x000000);
      circle.setStrokeStyle(2, color);
      container.add(circle);

      // Картинка или номер
      if (unit) {
          try {
              const img = this.add.image(0, 0, unit.assetKey).setDisplaySize(24, 24);
              container.add(img);
          } catch {
            container.add(this.add.text(0, 0, (index + 1).toString(), { fontSize: '14px', color: '#fff' }).setOrigin(0.5));
          }
      }

      return container;
  }

  private savePuckPosition(slotIndex: number, x: number, y: number): void {
      const current = playerData.getSelectedFormation();
      
      // Копируем слоты
      const newSlots = current.slots.map(s => ({...s}));
      newSlots[slotIndex].x = x;
      newSlots[slotIndex].y = y;

      if (current.isCustom) {
          // Обновляем существующую кастомную схему
          playerData.updateCustomFormation(current.id, newSlots);
      } else {
          // Создаем новую на основе текущей
          const newForm = playerData.createCustomFormation(`Custom ${Date.now()}`, newSlots);
          playerData.selectFormation(newForm.id);
      }
  }

  // ================= СКРОЛЛИНГ И ВВОД =================

  private updateCardPositions(): void {
    this.contentContainer.y = this.headerHeight - this.scrollY;
    
    // Оптимизация: скрываем элементы, которые ушли за экран
    const viewTop = this.scrollY;
    const viewBottom = this.scrollY + this.visibleAreaHeight;

    this.cards.forEach(c => {
      const top = c.y - 100; // запас
      const bottom = c.y + c.height + 100;
      c.container.setVisible(bottom > viewTop && top < viewBottom);
    });
  }

  private setupInteractions(): void {
    // Зона для захвата скролла (весь экран ниже шапки)
    this.scrollZone = this.add.zone(0, this.headerHeight, this.cameras.main.width, this.visibleAreaHeight)
        .setOrigin(0)
        .setInteractive();

    // Скролл колесиком
    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      if (this.isDraggingPuck) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.updateCardPositions();
    });

    // Начало скролла (пальцем/мышкой)
    this.scrollZone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.isDraggingPuck) return; // Не скроллим, если тянем фишку
      this.isDraggingScroll = true;
      this.lastPointerY = p.y;
      this.scrollVelocity = 0;
    });

    // Движение скролла
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDraggingScroll && !this.isDraggingPuck) {
        const delta = this.lastPointerY - p.y;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.lastPointerY = p.y;
        this.scrollVelocity = delta; // Для инерции
        this.updateCardPositions();
      }
    });

    // Конец скролла
    this.input.on('pointerup', () => {
      this.isDraggingScroll = false;
    });
  }
}