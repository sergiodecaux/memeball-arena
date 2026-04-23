// src/ui/game/FormationMenu.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { playerData, DEFAULT_FORMATIONS } from '../../data/PlayerData';
import { FormationSlot } from '../../types';
import { Formation } from '../../data/PlayerData';
import { getCapSkin, CAP_SKINS, getRoleIcon, getRoleColor } from '../../data/SkinsCatalog';
import { AudioManager } from '../../managers/AudioManager';
import { FactionId, FACTIONS } from '../../constants/gameConstants';
import { getUnit, getClassColor, getClassIcon } from '../../data/UnitsCatalog';

export interface FormationMenuCallbacks {
  onSelect: (formation: Formation) => void;
  onCancel: () => void;
}

export class FormationMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: FormationMenuCallbacks;
  private currentFormationId: string;
  private selectedFormation: Formation;
  private formationPreviewContainer!: Phaser.GameObjects.Container;
  private playerFaction: FactionId;
  private isDraggingPuck: boolean = false;
  private draggablePucks: Phaser.GameObjects.Container[] = [];

  constructor(scene: Phaser.Scene, currentFormationId: string, callbacks: FormationMenuCallbacks, playerFaction?: FactionId) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.currentFormationId = currentFormationId;
    this.selectedFormation = playerData.getSelectedFormation();
    // Используем переданную фракцию или получаем из playerData
    this.playerFaction = playerFaction || playerData.getFaction() || 'cyborg';

    const { width, height } = scene.cameras.main;

    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(200)
      .setInteractive();

    scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.9,
      duration: 200,
    });

    this.container = scene.add.container(width / 2, height / 2).setDepth(201);

    this.create();
    this.animateIn();
  }

  private create(): void {
    const colors = getColors();
    const fonts = getFonts();
    const { width, height } = this.scene.cameras.main;

    // ✅ ИСПРАВЛЕНО: Уменьшены размеры панели, чтобы она не выходила за пределы экрана
    const panelWidth = Math.min(360, width - 40);
    const panelHeight = Math.min(600, height - 80);

    // Background with glow
    const glow = this.scene.add.graphics();
    glow.lineStyle(10, colors.uiAccent, 0.1);
    glow.strokeRoundedRect(-panelWidth / 2 - 5, -panelHeight / 2 - 5, panelWidth + 10, panelHeight + 10, 22);
    this.container.add(glow);

    const panel = this.scene.add.graphics();
    panel.fillStyle(0x14101e, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    
    // Top accent
    panel.fillStyle(colors.uiAccent, 0.7);
    panel.fillRoundedRect(-50, -panelHeight / 2 + 1, 100, 3, 2);
    
    panel.lineStyle(2, colors.uiAccent, 0.4);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    this.container.add(panel);

    // Title
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 30, i18n.t('selectFormation').toUpperCase(), {
      fontSize: '18px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5));

    // Hint
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 55, 'Drag units to customize or select preset', {
      fontSize: '11px',
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    // Formation preview with drag & drop
    this.createFormationPreview(0, -panelHeight / 2 + 180, panelWidth - 60);

    // Formation list (scrollable)
    this.createFormationList(-panelWidth / 2 + 20, 60, panelWidth - 40, 140);

    // Buttons
    this.createButtons(panelHeight / 2 - 50);
  }

  private createFormationPreview(x: number, y: number, maxWidth: number): void {
    this.formationPreviewContainer = this.scene.add.container(x, y);
    this.container.add(this.formationPreviewContainer);
    this.renderFormationPreview();
  }

  private renderFormationPreview(): void {
    this.formationPreviewContainer.removeAll(true);
    this.draggablePucks = [];

    const colors = getColors();
    const fonts = getFonts();
    const formation = this.selectedFormation;
    // ✅ ИСПРАВЛЕНО: Используем актуальную команду игрока для текущей фракции
    const teamUnits = playerData.getTeamUnits(this.playerFaction);
    const factionConfig = FACTIONS[this.playerFaction];

    const fieldW = 200;
    const fieldH = 150;
    const fieldX = 0;
    const fieldY = 0;

    // Field background with faction color accent
    const field = this.scene.add.graphics();
    field.fillStyle(0x1a472a, 0.9);
    field.fillRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 10);
    
    // Field lines
    field.lineStyle(1, 0x3da64d, 0.5);
    field.lineBetween(-fieldW / 2, 0, fieldW / 2, 0);
    field.strokeCircle(0, 0, 25);
    
    // Goals
    const goalW = 50;
    field.lineStyle(2, colors.uiAccentPink, 0.7);
    field.strokeRect(-goalW / 2, -fieldH / 2 - 6, goalW, 12);
    field.lineStyle(2, colors.uiAccent, 0.7);
    field.strokeRect(-goalW / 2, fieldH / 2 - 6, goalW, 12);
    
    field.lineStyle(2, 0x3da64d, 0.7);
    field.strokeRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 10);
    this.formationPreviewContainer.add(field);

    // Formation name with faction info
    const formationNameText = this.scene.add.text(0, -fieldH / 2 - 35, formation.name, {
      fontSize: '16px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5);
    this.formationPreviewContainer.add(formationNameText);

    // Faction badge
    const factionNameText = this.scene.add.text(0, -fieldH / 2 - 18, factionConfig.name.toUpperCase(), {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: hexToString(factionConfig.color),
    }).setOrigin(0.5);
    this.formationPreviewContainer.add(factionNameText);

    // ✅ ДОБАВЛЕНО: Drag & drop для редактирования формации
    formation.slots.forEach((slot, index) => {
      const slotX = fieldX - fieldW / 2 + slot.x * fieldW;
      const slotY = fieldY - fieldH / 2 + slot.y * fieldH;
      
      const unitId = teamUnits[index];
      if (unitId) {
        const puck = this.createDraggablePuck(slotX, slotY, unitId, index, fieldW, fieldH, fieldX, fieldY);
        this.scene.input.setDraggable(puck);
        this.draggablePucks.push(puck);
        
        puck.on('dragstart', () => {
          this.isDraggingPuck = true;
          puck.setScale(1.1);
          AudioManager.getInstance().playSFX('sfx_click');
        });

        puck.on('drag', (_p: any, dragX: number, dragY: number) => {
          const minX = fieldX - fieldW / 2 + 24;
          const maxX = fieldX + fieldW / 2 - 24;
          // ✅ ИСПРАВЛЕНО: Ограничиваем редактирование только своей половиной поля (y >= 0.5)
          // Игрок играет в нижней половине, поэтому y должен быть >= 0.5 (центр поля)
          const minY = fieldY; // Центр поля (y = 0.5 в относительных координатах)
          const maxY = fieldY + fieldH / 2 - 24; // Нижняя граница поля

          const clX = Phaser.Math.Clamp(dragX, minX, maxX);
          const clY = Phaser.Math.Clamp(dragY, minY, maxY);
          puck.setPosition(clX, clY);
        });

        puck.on('dragend', () => {
          this.isDraggingPuck = false;
          puck.setScale(1);
          AudioManager.getInstance().playSFX('sfx_swish');

          const nx = (puck.x - (fieldX - fieldW / 2)) / fieldW;
          const ny = (puck.y - (fieldY - fieldH / 2)) / fieldH;
          
          // ✅ ИСПРАВЛЕНО: Гарантируем, что позиция находится в нижней половине поля (y >= 0.5)
          const clampedY = Math.max(0.5, Math.min(1.0, ny));
          this.savePuckPosition(index, nx, clampedY);
        });

        this.formationPreviewContainer.add(puck);
      } else {
        // Fallback для пустого слота
        this.createEmptySlotPreview(slotX, slotY);
      }
    });
  }

  /**
   * Создает перетаскиваемую фишку юнита (как в TeamScene)
   */
  private createDraggablePuck(
    x: number,
    y: number,
    unitId: string,
    index: number,
    fieldWidth: number,
    fieldHeight: number,
    fieldX: number,
    fieldY: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);
    const unit = getUnit(unitId);
    const color = unit ? getClassColor(unit.capClass) : 0xffffff;
    const r = Math.min(22, fieldWidth * 0.055);

    // Glow
    const glow = this.scene.add.graphics();
    glow.fillStyle(color, 0.28);
    glow.fillCircle(0, 0, r + 5);
    container.add(glow);

    // Circle
    const circle = this.scene.add.circle(0, 0, r, 0x000000);
    circle.setStrokeStyle(2, color);
    container.add(circle);

    if (unit) {
      try {
        // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
        const img = this.scene.add.image(0, 0, unit.assetKey).setDisplaySize(r * 1.75, r * 1.75);
        container.add(img);
        container.add(this.scene.add.text(0, r + 10, getClassIcon(unit.capClass), { fontSize: '12px' }).setOrigin(0.5));
      } catch {
        container.add(this.scene.add.text(0, 0, (index + 1).toString(), { fontSize: `${r * 0.8}px`, color: '#fff' }).setOrigin(0.5));
      }
    } else {
      container.add(this.scene.add.text(0, 0, (index + 1).toString(), { fontSize: `${r * 0.8}px`, color: '#fff' }).setOrigin(0.5));
    }

    container.setSize(r * 2 + 12, r * 2 + 22);
    container.setInteractive({ useHandCursor: true, draggable: true });
    return container;
  }

  /**
   * Сохраняет позицию фишки в формацию
   */
  private savePuckPosition(slotIndex: number, x: number, y: number): void {
    const current = this.selectedFormation;
    const newSlots = current.slots.map((s) => ({ ...s }));
    newSlots[slotIndex].x = x;
    newSlots[slotIndex].y = y;

    if (current.isCustom) {
      // Обновляем существующую кастомную формацию
      playerData.updateCustomFormation(current.id, newSlots);
      this.selectedFormation = { ...current, slots: newSlots };
    } else {
      // Создаем новую кастомную формацию
      // ✅ ИСПРАВЛЕНО: Используем teamSize из формации или вычисляем из slots.length как fallback
      // Type assertion to ensure TypeScript recognizes teamSize property
      const formationWithTeamSize = current as Formation;
      const teamSize = formationWithTeamSize.teamSize ?? current.slots.length;
      const customFormation = playerData.createCustomFormation('CUSTOM', newSlots, teamSize);
      this.selectedFormation = customFormation;
      playerData.selectFormation(customFormation.id);
    }
    
    // Перерисовываем превью
    this.renderFormationPreview();
  }

  /**
   * Создает превью слота с актуальным юнитом игрока (стиль как в TeamScene)
   * @deprecated Используйте createDraggablePuck для редактируемых фишек
   */
  private createUnitSlotPreview(x: number, y: number, unitId: string): void {
    const container = this.scene.add.container(x, y);
    const radius = 20;

    const unit = getUnit(unitId);
    if (!unit) {
      this.createEmptySlotPreview(x, y);
      return;
    }

    const classColor = getClassColor(unit.capClass);
    const classIcon = getClassIcon(unit.capClass);

    // Glow эффект (как в TeamScene)
    const glow = this.scene.add.graphics();
    glow.fillStyle(classColor, 0.35);
    glow.fillCircle(0, 0, radius + 4);
    container.add(glow);

    // Shadow
    container.add(this.scene.add.ellipse(2, 2, radius * 1.7, radius * 1.3, 0x000000, 0.3));

    // Кольцо с цветом класса
    const ring = this.scene.add.circle(0, 0, radius + 2, 0x000000);
    ring.setStrokeStyle(2, classColor);
    container.add(ring);

    // Фон для изображения
    container.add(this.scene.add.circle(0, 0, radius, 0x1a1a2e));

    // Изображение юнита
    try {
      if (this.scene.textures.exists(unit.assetKey)) {
        // ✅ Увеличенный размер для pop-out (рога/шлемы выходят за круг)
        const img = this.scene.add.image(0, 0, unit.assetKey).setDisplaySize(radius * 2.0, radius * 2.0);
        container.add(img);
      } else {
        // Fallback: цветной круг
        const fallbackCircle = this.scene.add.circle(0, 0, radius - 2, classColor, 0.6);
        container.add(fallbackCircle);
      }
    } catch (e) {
      // Fallback: цветной круг
      const fallbackCircle = this.scene.add.circle(0, 0, radius - 2, classColor, 0.6);
      container.add(fallbackCircle);
    }

    // Иконка класса (badge внизу)
    const iconBg = this.scene.add.circle(radius * 0.7, radius * 0.7, 8, 0x000000, 0.9);
    container.add(iconBg);
    container.add(this.scene.add.text(radius * 0.7, radius * 0.7, classIcon, {
      fontSize: '9px',
    }).setOrigin(0.5));

    this.formationPreviewContainer.add(container);
  }

  /**
   * Создает превью пустого слота
   */
  private createEmptySlotPreview(x: number, y: number): void {
    const container = this.scene.add.container(x, y);
    const radius = 20;

    const circle = this.scene.add.circle(0, 0, radius, 0x1a1a2e, 0.6);
    circle.setStrokeStyle(1, 0x334155, 0.5);
    container.add(circle);

    container.add(this.scene.add.text(0, 0, '+', {
      fontSize: '16px',
      color: '#64748b',
    }).setOrigin(0.5));

    this.formationPreviewContainer.add(container);
  }

  private createFormationList(x: number, y: number, width: number, height: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const formations = playerData.getAllFormations();

    const listContainer = this.scene.add.container(x, y);
    this.container.add(listContainer);

    // Title
    listContainer.add(this.scene.add.text(width / 2, -15, 'PRESETS', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiTextSecondary),
    }).setOrigin(0.5));

    const itemW = 70;
    const itemH = 55;
    const gap = 8;
    const maxVisible = Math.floor((width - 20) / (itemW + gap));
    const scrollable = formations.length > maxVisible;

    formations.forEach((formation, index) => {
      // ✅ ИСПРАВЛЕНО: Скроллируемый список, чтобы не выходил за пределы
      const itemX = index * (itemW + gap);
      if (itemX + itemW > width && !scrollable) return; // Пропускаем если не помещается
      
      const isSelected = formation.id === this.selectedFormation.id;

      const item = this.scene.add.container(itemX, 25);

      const bg = this.scene.add.graphics();
      if (isSelected) {
        bg.fillStyle(colors.uiAccent, 0.25);
        bg.lineStyle(2, colors.uiAccent, 0.8);
      } else {
        bg.fillStyle(0x1a1a2e, 0.6);
        bg.lineStyle(1, colors.uiPrimary, 0.3);
      }
      bg.fillRoundedRect(0, 0, itemW, itemH, 8);
      bg.strokeRoundedRect(0, 0, itemW, itemH, 8);
      item.add(bg);

      // Mini formation diagram
      this.drawMiniFormation(item, itemW / 2, itemH / 2 - 5, formation, 30, 24);

      // Name
      item.add(this.scene.add.text(itemW / 2, itemH - 8, formation.name, {
        fontSize: '8px',
        fontFamily: fonts.tech,
        color: isSelected ? '#ffffff' : '#888899',
      }).setOrigin(0.5));

      if (!isSelected) {
        const hitArea = this.scene.add.rectangle(itemW / 2, itemH / 2, itemW, itemH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        item.add(hitArea);

        hitArea.on('pointerdown', () => {
          AudioManager.getInstance().playSFX('sfx_click');
          this.selectedFormation = formation;
          playerData.selectFormation(formation.id);
          this.currentFormationId = formation.id;
          this.renderFormationPreview();
          listContainer.destroy();
          this.createFormationList(x, y, width, height);
        });
      }

      listContainer.add(item);
    });
  }

  private drawMiniFormation(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    formation: Formation,
    w: number, h: number
  ): void {
    const colors = getColors();
    // ✅ ИСПРАВЛЕНО: Используем актуальную команду игрока для текущей фракции
    const teamUnits = playerData.getTeamUnits(this.playerFaction);
    
    formation.slots.forEach((slot, index) => {
      const dotX = x + (slot.x - 0.5) * w;
      const dotY = y + (slot.y - 0.5) * h;
      
      // Get color from actual unit's class
      const unitId = teamUnits[index];
      if (unitId) {
        const unit = getUnit(unitId);
        const color = unit ? getClassColor(unit.capClass) : colors.uiAccent;
        container.add(this.scene.add.circle(dotX, dotY, 5, color, 1));
      } else {
        // Пустой слот - серый цвет
        container.add(this.scene.add.circle(dotX, dotY, 4, 0x64748b, 0.5));
      }
    });
  }

  private createButtons(y: number): void {
    const colors = getColors();

    // Confirm
    this.createButton(65, y, 110, 40, i18n.t('confirm') || 'CONFIRM', colors.uiAccent, () => {
      this.hide(() => this.callbacks.onSelect(this.selectedFormation));
    });

    // Cancel
    this.createButton(-65, y, 110, 40, i18n.t('cancel'), 0x6b7280, () => {
      this.hide(() => this.callbacks.onCancel());
    });
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    text: string, color: number, onClick: () => void
  ): void {
    const fonts = getFonts();
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.3 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      bg.lineStyle(hover ? 2 : 1.5, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
    };
    draw(false);
    btn.add(bg);

    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(color),
    }).setOrigin(0.5));

    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(hitArea);

    hitArea.on('pointerover', () => { draw(true); btn.setScale(1.03); });
    hitArea.on('pointerout', () => { draw(false); btn.setScale(1); });
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      onClick();
    });

    this.container.add(btn);
  }

  private animateIn(): void {
    this.container.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 250,
      ease: 'Back.easeOut',
    });
  }

  hide(onComplete?: () => void): void {
    this.scene.tweens.add({
      targets: this.container,
      scale: 0.9,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.destroy();
        if (onComplete) onComplete();
      }
    });
  }

  destroy(): void {
    this.overlay.destroy();
    this.container.destroy();
  }
}