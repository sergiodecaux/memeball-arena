import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AVATARS, getAvatar } from '../data/AvatarData';
import { getColors, getFonts, hexToString, TYPOGRAPHY } from '../config/themes';
import { hapticImpact } from '../utils/Haptics';

/**
 * Оверлей выбора аватарки
 */
export class AvatarSelectionOverlay extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private panel: Phaser.GameObjects.Container;
  private onClose?: () => void;

  constructor(scene: Phaser.Scene, onClose?: () => void) {
    super(scene, 0, 0);
    this.onClose = onClose;
    this.setDepth(10000);
    this.createOverlay();
    scene.add.existing(this);
  }

  private createOverlay(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    // ========== ЗАТЕМНЕННЫЙ ФОН ==========
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x000000, 0.8);
    this.bg.fillRect(0, 0, width, height);
    this.bg.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    this.bg.on('pointerdown', () => this.close());
    this.add(this.bg);

    // ========== ПАНЕЛЬ ==========
    this.panel = this.scene.add.container(width / 2, height / 2);
    this.add(this.panel);

    const panelWidth = Math.min(width - 40, 600);
    const panelHeight = Math.min(height - 80, 700);

    const panelBg = this.scene.add.graphics();
    panelBg.fillStyle(0x0f111d, 0.98);
    panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panelBg.lineStyle(2, colors.uiAccent, 0.6);
    panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);

    // Glass effect
    panelBg.fillStyle(0xffffff, 0.05);
    panelBg.fillRoundedRect(
      -panelWidth / 2 + 4,
      -panelHeight / 2 + 4,
      panelWidth - 8,
      80,
      { tl: 18, tr: 18, bl: 0, br: 0 } as any
    );
    this.panel.add(panelBg);

    // ========== ЗАГОЛОВОК ==========
    this.panel.add(
      this.scene.add
        .text(0, -panelHeight / 2 + 40, 'ВЫБОР АВАТАРКИ', {
          fontSize: `${TYPOGRAPHY.sizes.xl}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
        })
        .setOrigin(0.5)
    );

    // ========== КНОПКА ЗАКРЫТИЯ ==========
    const closeBtn = this.scene.add.graphics();
    closeBtn.fillStyle(colors.uiAccent, 0.15);
    closeBtn.fillCircle(panelWidth / 2 - 40, -panelHeight / 2 + 40, 22);
    closeBtn.lineStyle(2, colors.uiAccent, 0.5);
    closeBtn.strokeCircle(panelWidth / 2 - 40, -panelHeight / 2 + 40, 22);
    closeBtn.setInteractive(
      new Phaser.Geom.Circle(panelWidth / 2 - 40, -panelHeight / 2 + 40, 22),
      Phaser.Geom.Circle.Contains
    );
    closeBtn.on('pointerdown', () => {
      hapticImpact('light');
      this.close();
    });
    this.panel.add(closeBtn);

    const closeX = this.scene.add
      .text(panelWidth / 2 - 40, -panelHeight / 2 + 40, '✕', {
        fontSize: `${TYPOGRAPHY.sizes.xl}px`,
        color: hexToString(colors.uiAccent),
      })
      .setOrigin(0.5);
    this.panel.add(closeX);

    // ========== СПИСОК АВАТАРОК ==========
    const contentY = -panelHeight / 2 + 90;
    const scrollHeight = panelHeight - 150;
    const cardWidth = 120;
    const cardHeight = 150;
    const padding = 15;
    const cols = Math.floor((panelWidth - 40) / (cardWidth + padding));

    let currentX = -panelWidth / 2 + 20 + cardWidth / 2;
    let currentY = contentY;
    let col = 0;

    const currentAvatarId = playerData.getAvatarId();
    const ownedAvatars = playerData.getOwnedAvatars();

    AVATARS.forEach((avatar) => {
      const isOwned = ownedAvatars.includes(avatar.id);
      const isSelected = currentAvatarId === avatar.id;

      this.createAvatarCard(currentX, currentY, avatar, isOwned, isSelected, cardWidth, cardHeight);

      col++;
      if (col >= cols) {
        col = 0;
        currentX = -panelWidth / 2 + 20 + cardWidth / 2;
        currentY += cardHeight + padding;
      } else {
        currentX += cardWidth + padding;
      }
    });
  }

  private createAvatarCard(
    x: number,
    y: number,
    avatar: any,
    isOwned: boolean,
    isSelected: boolean,
    cardWidth: number,
    cardHeight: number
  ): void {
    const colors = getColors();
    const fonts = getFonts();

    const card = this.scene.add.container(x, y);
    this.panel.add(card);

    // BG
    const bg = this.scene.add.graphics();
    bg.fillStyle(isSelected ? colors.uiAccent : 0x14101e, isSelected ? 0.15 : 0.95);
    bg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
    bg.lineStyle(2, isSelected ? colors.uiAccent : colors.glassBorder, isSelected ? 0.8 : 0.2);
    bg.strokeRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 12);
    card.add(bg);

    // АВАТАРКА (круг)
    const avatarRadius = 35;
    const avatarBg = this.scene.add.graphics();
    avatarBg.fillStyle(0x1a1a2e, 1);
    avatarBg.fillCircle(0, -20, avatarRadius);
    avatarBg.lineStyle(2, isOwned ? colors.uiAccent : 0x3a3a4a, isOwned ? 0.6 : 0.2);
    avatarBg.strokeCircle(0, -20, avatarRadius);
    card.add(avatarBg);

    // ✅ ИСПРАВЛЕНО: Показываем PNG всегда (убрали проверку isOwned)
    if (this.scene.textures.exists(avatar.textureKey)) {
      const avatarImg = this.scene.add.image(0, -20, avatar.textureKey);
      avatarImg.setDisplaySize(avatarRadius * 1.8, avatarRadius * 1.8);
      // Затемняем незакупленные
      if (!isOwned) {
        avatarImg.setAlpha(0.4);
      }
      card.add(avatarImg);
    } else {
      card.add(this.scene.add.text(0, -20, '🎭', { fontSize: `${TYPOGRAPHY.sizes.xxl}px` }).setOrigin(0.5));
    }

    // КНОПКИ БЕЗ ТЕКСТА
    if (isSelected) {
      // Выбранная аватарка - без текста, просто показываем визуально через рамку
    } else if (!isOwned) {
      if (avatar.price) {
        // КНОПКА ПОКУПКИ
        bg.setInteractive(
          new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
          Phaser.Geom.Rectangle.Contains
        );
        bg.on('pointerdown', () => {
          hapticImpact('medium');
          this.purchaseAvatar(avatar);
        });
      }
    } else {
      // КНОПКА ВЫБОРА
      bg.setInteractive(
        new Phaser.Geom.Rectangle(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight),
        Phaser.Geom.Rectangle.Contains
      );
      bg.on('pointerdown', () => {
        hapticImpact('light');
        this.selectAvatar(avatar.id);
      });
    }
  }

  private selectAvatar(avatarId: string): void {
    if (playerData.setAvatar(avatarId)) {
      hapticImpact('medium');
      this.close();
      console.log(`✅ Avatar changed to ${avatarId}`);
    }
  }

  private purchaseAvatar(avatar: any): void {
    if (!avatar.price) return;
    if (playerData.purchaseAvatar(avatar.id, avatar.price.crystals)) {
      hapticImpact('medium');
      // Перерисовываем overlay
      this.panel.removeAll(true);
      this.createOverlay();
      console.log(`✅ Avatar ${avatar.id} purchased and unlocked`);
    } else {
      hapticImpact('light');
      console.warn(`❌ Failed to purchase ${avatar.id}`);
    }
  }

  private close(): void {
    this.destroy();
    if (this.onClose) {
      this.onClose();
    }
  }
}
