// src/ui/game/FormationMenu.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../../config/themes';
import { i18n } from '../../localization/i18n';
import { playerData, DEFAULT_FORMATIONS } from '../../data/PlayerData';
import { Formation, FormationSlot } from '../../types';
import { CapClass, CAP_CLASSES } from '../../constants/gameConstants';
import { getCapSkin, CAP_SKINS } from '../../data/SkinsCatalog';

export interface FormationMenuCallbacks {
  onSelect: (formation: Formation) => void;
  onCancel: () => void;
}

// Цвета и иконки для классов
const CLASS_CONFIG: Record<CapClass, { icon: string; color: number; short: string }> = {
  balanced: { icon: '⭐', color: 0x22c55e, short: 'BAL' },
  tank: { icon: '🛡️', color: 0x3b82f6, short: 'TNK' },
  sniper: { icon: '🎯', color: 0xef4444, short: 'SNP' },
  trickster: { icon: '🌀', color: 0xa855f7, short: 'TRK' },
};

export class FormationMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private overlay: Phaser.GameObjects.Rectangle;
  private callbacks: FormationMenuCallbacks;
  private currentFormationId: string;
  private selectedFormation: Formation;
  private slotContainers: Map<string, Phaser.GameObjects.Container> = new Map();
  private formationPreviewContainer!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, currentFormationId: string, callbacks: FormationMenuCallbacks) {
    this.scene = scene;
    this.callbacks = callbacks;
    this.currentFormationId = currentFormationId;
    this.selectedFormation = playerData.getSelectedFormation();

    const { width, height } = scene.cameras.main;

    this.overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0, 0)
      .setDepth(200)
      .setInteractive();

    this.container = scene.add.container(width / 2, height / 2).setDepth(201);

    this.create();
    this.animateIn();
  }

  private create(): void {
    const colors = getColors();
    const { width, height } = this.scene.cameras.main;

    const panelWidth = Math.min(380, width - 40);
    const panelHeight = Math.min(580, height - 60);

    // Фон панели
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f0f1a, 0.98);
    panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    panel.lineStyle(2, colors.uiAccent, 0.5);
    panel.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    this.container.add(panel);

    // Заголовок
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 25, i18n.t('selectFormation').toUpperCase(), {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: hexToString(colors.uiAccent),
    }).setOrigin(0.5));

    // Подсказка
    this.container.add(this.scene.add.text(0, -panelHeight / 2 + 50, '👆 Tap caps to change class', {
      fontSize: '11px',
      color: '#888888',
    }).setOrigin(0.5));

    // Превью выбранной формации (большое)
    this.createFormationPreview(0, -panelHeight / 2 + 160, panelWidth - 60);

    // Список формаций
    this.createFormationList(-panelWidth / 2 + 20, 40, panelWidth - 40, 150);

    // Кнопки
    this.createButtons(panelHeight / 2 - 45);
  }

  private createFormationPreview(x: number, y: number, maxWidth: number): void {
    this.formationPreviewContainer = this.scene.add.container(x, y);
    this.container.add(this.formationPreviewContainer);

    this.renderFormationPreview();
  }

  private renderFormationPreview(): void {
    this.formationPreviewContainer.removeAll(true);
    this.slotContainers.clear();

    const colors = getColors();
    const formation = this.selectedFormation;

    // Мини-поле
    const fieldW = 180;
    const fieldH = 140;

    const field = this.scene.add.graphics();
    field.fillStyle(0x1a472a, 0.9);
    field.fillRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 8);
    field.lineStyle(2, 0x3da64d, 0.6);
    field.strokeRoundedRect(-fieldW / 2, -fieldH / 2, fieldW, fieldH, 8);

    // Линии поля
    field.lineStyle(1, 0x3da64d, 0.4);
    field.lineBetween(-fieldW / 2, 0, fieldW / 2, 0);
    field.strokeCircle(0, 0, 20);

    // Ворота
    const goalW = 40;
    field.lineStyle(2, 0x3da64d, 0.8);
    field.strokeRect(-goalW / 2, -fieldH / 2 - 5, goalW, 10);
    field.strokeRect(-goalW / 2, fieldH / 2 - 5, goalW, 10);

    this.formationPreviewContainer.add(field);

    // Название формации
    this.formationPreviewContainer.add(this.scene.add.text(0, -fieldH / 2 - 25, formation.name, {
      fontSize: '16px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5));

    // Получаем скин игрока
    const playerSkinId = playerData.get().equippedCapSkin;
    const capSkin = getCapSkin(playerSkinId) || CAP_SKINS[0];

    // Рисуем слоты с фишками
    formation.slots.forEach((slot, index) => {
      const slotX = (slot.x - 0.5) * fieldW;
      const slotY = (slot.y - 0.5) * fieldH;

      const slotContainer = this.createSlotWithCap(slotX, slotY, slot, capSkin);
      this.formationPreviewContainer.add(slotContainer);
      this.slotContainers.set(slot.id, slotContainer);
    });
  }

  private createSlotWithCap(
    x: number, y: number,
    slot: FormationSlot,
    capSkin: any
  ): Phaser.GameObjects.Container {
    const classConfig = CLASS_CONFIG[slot.capClass];
    const container = this.scene.add.container(x, y);
    const radius = 22;

    // Свечение класса
    const glow = this.scene.add.circle(0, 0, radius + 4, classConfig.color, 0.3);
    container.add(glow);

    // Тень
    container.add(this.scene.add.ellipse(2, 2, radius * 1.6, radius * 1.2, 0x000000, 0.3));

    // Основная фишка (используем текстуру если есть)
    const textureKey = capSkin.visual?.textureKey;
    if (textureKey && this.scene.textures.exists(textureKey)) {
      const scale = (radius * 2) / 128;
      const sprite = this.scene.add.sprite(0, 0, textureKey).setScale(scale);
      container.add(sprite);
    } else {
      const capGraphics = this.scene.add.graphics();
      capGraphics.fillStyle(capSkin.primaryColor || 0x06b6d4);
      capGraphics.fillCircle(0, 0, radius);
      capGraphics.lineStyle(2, capSkin.secondaryColor || 0x0891b2);
      capGraphics.strokeCircle(0, 0, radius);
      container.add(capGraphics);
    }

    // Иконка класса в углу
    const iconBg = this.scene.add.circle(radius * 0.6, -radius * 0.6, 10, 0x000000, 0.7);
    container.add(iconBg);

    const iconText = this.scene.add.text(radius * 0.6, -radius * 0.6, classConfig.icon, {
      fontSize: '12px',
    }).setOrigin(0.5);
    container.add(iconText);

    // Подпись класса снизу
    const label = this.scene.add.text(0, radius + 8, classConfig.short, {
      fontSize: '9px',
      fontStyle: 'bold',
      color: hexToString(classConfig.color),
    }).setOrigin(0.5);
    container.add(label);

    // Сохраняем данные для обновления
    container.setData('slotId', slot.id);
    container.setData('capClass', slot.capClass);
    container.setData('glow', glow);
    container.setData('iconText', iconText);
    container.setData('label', label);

    // Интерактивность — смена класса по тапу
    container.setSize(radius * 2 + 10, radius * 2 + 20);
    container.setInteractive(
      new Phaser.Geom.Circle(0, 0, radius + 5),
      Phaser.Geom.Circle.Contains
    );

    container.on('pointerdown', () => this.cycleSlotClass(container));

    // Ховер эффект
    container.on('pointerover', () => {
      this.scene.tweens.add({
        targets: container,
        scale: 1.15,
        duration: 100,
        ease: 'Power2'
      });
    });

    container.on('pointerout', () => {
      this.scene.tweens.add({
        targets: container,
        scale: 1,
        duration: 100,
        ease: 'Power2'
      });
    });

    return container;
  }

  private cycleSlotClass(slotContainer: Phaser.GameObjects.Container): void {
    const currentClass = slotContainer.getData('capClass') as CapClass;
    const slotId = slotContainer.getData('slotId') as string;

    const classes: CapClass[] = ['balanced', 'tank', 'sniper', 'trickster'];
    const idx = classes.indexOf(currentClass);
    const nextClass = classes[(idx + 1) % classes.length];
    const nextConfig = CLASS_CONFIG[nextClass];

    // Обновляем в PlayerData
    playerData.setSlotClass(this.selectedFormation.id, slotId, nextClass);

    // Обновляем локальное состояние
    const slot = this.selectedFormation.slots.find(s => s.id === slotId);
    if (slot) slot.capClass = nextClass;

    // Обновляем визуал
    slotContainer.setData('capClass', nextClass);

    const glow = slotContainer.getData('glow') as Phaser.GameObjects.Arc;
    const iconText = slotContainer.getData('iconText') as Phaser.GameObjects.Text;
    const label = slotContainer.getData('label') as Phaser.GameObjects.Text;

    glow.setFillStyle(nextConfig.color, 0.3);
    iconText.setText(nextConfig.icon);
    label.setText(nextConfig.short);
    label.setColor(hexToString(nextConfig.color));

    // Анимация смены
    this.scene.tweens.add({
      targets: slotContainer,
      scale: { from: 1.2, to: 1 },
      duration: 150,
      ease: 'Back.easeOut'
    });
  }

  private createFormationList(x: number, y: number, width: number, height: number): void {
    const colors = getColors();
    const formations = playerData.getAllFormations();

    const listContainer = this.scene.add.container(x, y);
    this.container.add(listContainer);

    // Заголовок
    listContainer.add(this.scene.add.text(width / 2, -15, 'FORMATIONS', {
      fontSize: '11px',
      color: '#888888',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Список (горизонтальный скролл)
    const itemW = 70;
    const itemH = 55;
    const gap = 8;

    formations.forEach((formation, index) => {
      const itemX = index * (itemW + gap);
      const isSelected = formation.id === this.selectedFormation.id;

      const item = this.scene.add.container(itemX, 20);

      const bg = this.scene.add.graphics();
      if (isSelected) {
        bg.fillStyle(colors.uiAccent, 0.25);
        bg.lineStyle(2, colors.uiAccent, 0.8);
      } else {
        bg.fillStyle(0x1a1a2e, 0.6);
        bg.lineStyle(1, colors.uiPrimary, 0.3);
      }
      bg.fillRoundedRect(0, 0, itemW, itemH, 6);
      bg.strokeRoundedRect(0, 0, itemW, itemH, 6);
      item.add(bg);

      // Мини схема
      this.drawMiniFormation(item, itemW / 2, itemH / 2 - 5, formation, 25, 20);

      // Название
      item.add(this.scene.add.text(itemW / 2, itemH - 8, formation.name, {
        fontSize: '9px',
        color: isSelected ? '#ffffff' : '#aaaaaa',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      if (!isSelected) {
        const hitArea = this.scene.add.rectangle(itemW / 2, itemH / 2, itemW, itemH, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        item.add(hitArea);

        hitArea.on('pointerdown', () => {
          this.selectedFormation = formation;
          playerData.selectFormation(formation.id);
          this.currentFormationId = formation.id;
          this.renderFormationPreview();
          // Перерисовываем список
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
    formation.slots.forEach(slot => {
      const dotX = x + (slot.x - 0.5) * w;
      const dotY = y + (slot.y - 0.5) * h;
      const color = CLASS_CONFIG[slot.capClass].color;

      container.add(this.scene.add.circle(dotX, dotY, 4, color, 1));
    });
  }

  private createButtons(y: number): void {
    const colors = getColors();

    // Кнопка Confirm
    const confirmBtn = this.createButton(60, y, 100, 36, i18n.t('confirm') || 'CONFIRM', colors.uiAccent, () => {
      this.hide(() => this.callbacks.onSelect(this.selectedFormation));
    });
    this.container.add(confirmBtn);

    // Кнопка Cancel
    const cancelBtn = this.createButton(-60, y, 100, 36, i18n.t('cancel'), 0x6b7280, () => {
      this.hide(() => this.callbacks.onCancel());
    });
    this.container.add(cancelBtn);
  }

  private createButton(
    x: number, y: number, w: number, h: number,
    text: string, color: number, onClick: () => void
  ): Phaser.GameObjects.Container {
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(color, hover ? 0.3 : 0.15);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 8);
      bg.lineStyle(hover ? 2 : 1, color, hover ? 1 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 8);
    };
    draw(false);
    btn.add(bg);

    btn.add(this.scene.add.text(0, 0, text, {
      fontSize: '13px',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    btn.add(hitArea);

    hitArea.on('pointerover', () => draw(true));
    hitArea.on('pointerout', () => draw(false));
    hitArea.on('pointerdown', onClick);

    return btn;
  }

  private animateIn(): void {
    this.container.setScale(0.9).setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 200,
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