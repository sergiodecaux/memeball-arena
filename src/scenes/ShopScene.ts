// src/scenes/ShopScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor } from '../config/themes';
import { playerData } from '../data/PlayerData';
import { 
  CAP_SKINS, BALL_SKINS, FIELD_SKINS, 
  CapSkinData, BallSkinData, FieldSkinData, 
  formatPrice, getRarityName, SkinPrice 
} from '../data/SkinsCatalog';
import { SkinDetailModal } from '../ui/modals/SkinDetailModal';

type ShopTab = 'caps' | 'balls' | 'fields';
type SkinData = CapSkinData | BallSkinData | FieldSkinData;
type SkinType = 'cap' | 'ball' | 'field';

interface SkinCard {
  container: Phaser.GameObjects.Container;
  index: number;
  y: number;
}

export class ShopScene extends Phaser.Scene {
  private currentTab: ShopTab = 'caps';
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private starsText!: Phaser.GameObjects.Text;
  
  // === ОПТИМИЗАЦИЯ ===
  private skinCards: SkinCard[] = [];
  private cardHeight = 220;
  private cardGap = 12;
  private visibleAreaTop = 0;
  private visibleAreaBottom = 0;
  private isDragging = false;
  private lastPointerY = 0;
  private scrollVelocity = 0;
  private activeTweens: Phaser.Tweens.Tween[] = [];
  
  // === МОДАЛЬНОЕ ОКНО ===
  private activeModal: SkinDetailModal | null = null;
  private dragDistance = 0;

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(): void {
    this.skinCards = [];
    this.activeTweens = [];
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.activeModal = null;
    this.dragDistance = 0;
    
    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createContentArea();
    this.createAllCards();
    this.setupScrolling();
    this.updateCardPositions();
  }

  shutdown(): void {
    this.activeTweens.forEach(tween => tween.destroy());
    this.activeTweens = [];
  }

  update(): void {
    if (!this.isDragging && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.updateCardPositions();
    }
  }

  // ==================== BACKGROUND ====================

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x05050a, 1);
    bg.fillRect(0, 0, width, height);
    bg.fillGradientStyle(colors.uiPrimary, colors.uiPrimary, 0x05050a, 0x05050a, 0.15, 0.15, 0, 0);
    bg.fillRect(0, 0, width, 150);

    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x < width; x += 50) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 50) bg.lineBetween(0, y, width, y);

    this.createParticles(5);
  }

  private createParticles(count: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    for (let i = 0; i < count; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 2),
        Phaser.Math.RND.pick([colors.uiAccent, colors.uiPrimary]),
        0.3
      );

      const tween = this.tweens.add({
        targets: particle,
        y: particle.y - Phaser.Math.Between(80, 150),
        alpha: 0,
        duration: Phaser.Math.Between(5000, 10000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        onRepeat: () => {
          particle.setPosition(Phaser.Math.Between(0, width), height + 20);
          particle.setAlpha(0.3);
        },
      });
      this.activeTweens.push(tween);
    }
  }

  // ==================== HEADER ====================

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();

    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.9);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(2, colors.uiPrimary, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    this.createBackButton();

    this.add.text(width / 2, 35, '🛒 SHOP', {
      fontSize: '24px', 
      fontFamily: 'Arial Black', 
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(101);

    this.createCurrencyPanel(data);
  }

  private createBackButton(): void {
    const colors = getColors();
    const btn = this.add.container(50, 35).setDepth(101);
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(-35, -16, 70, 32, 8);
    bg.lineStyle(1.5, colors.uiAccent, 0.5);
    bg.strokeRoundedRect(-35, -16, 70, 32, 8);
    
    const text = this.add.text(0, 0, '← Back', {
      fontSize: '14px',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    btn.add([bg, text]);
    btn.setInteractive(new Phaser.Geom.Rectangle(-35, -16, 70, 32), Phaser.Geom.Rectangle.Contains)
      .on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  private createCurrencyPanel(data: ReturnType<typeof playerData.get>): void {
    const { width } = this.cameras.main;
    const x = width - 70;

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(x - 55, 10, 110, 50, 8);
    bg.setDepth(101);

    this.add.text(x - 40, 22, '💰', { fontSize: '14px' }).setDepth(101);
    this.coinsText = this.add.text(x - 20, 22, `${data.coins}`, {
      fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);

    this.add.text(x - 40, 42, '⭐', { fontSize: '14px' }).setDepth(101);
    this.starsText = this.add.text(x - 20, 42, `${data.stars}`, {
      fontSize: '14px', color: '#ff69b4', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);
  }

  // ==================== TABS ====================

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const tabY = 100;
    const tabW = (width - 30) / 3;
    const tabH = 40;

    const tabs: { id: ShopTab; label: string; icon: string }[] = [
      { id: 'caps', label: 'CAPS', icon: '🎯' },
      { id: 'balls', label: 'BALLS', icon: '⚽' },
      { id: 'fields', label: 'FIELDS', icon: '🏟️' },
    ];

    tabs.forEach((tab, i) => {
      const x = 15 + i * tabW + tabW / 2;
      const isActive = tab.id === this.currentTab;

      const bg = this.add.graphics();
      
      if (isActive) {
        bg.fillStyle(colors.uiPrimary, 0.3);
        bg.fillRoundedRect(x - tabW / 2 + 3, tabY - tabH / 2, tabW - 6, tabH, 8);
        bg.lineStyle(2, colors.uiAccent, 0.8);
        bg.strokeRoundedRect(x - tabW / 2 + 3, tabY - tabH / 2, tabW - 6, tabH, 8);
      } else {
        bg.fillStyle(0x000000, 0.4);
        bg.fillRoundedRect(x - tabW / 2 + 3, tabY - tabH / 2, tabW - 6, tabH, 8);
        bg.lineStyle(1, colors.uiTextSecondary, 0.3);
        bg.strokeRoundedRect(x - tabW / 2 + 3, tabY - tabH / 2, tabW - 6, tabH, 8);
      }
      bg.setDepth(100);

      const label = this.add.text(x, tabY, `${tab.icon} ${tab.label}`, {
        fontSize: '13px',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        color: isActive ? '#ffffff' : hexToString(colors.uiTextSecondary),
      }).setOrigin(0.5).setDepth(100);

      if (!isActive) {
        const hitArea = this.add.rectangle(x, tabY, tabW - 6, tabH, 0x000000, 0)
          .setInteractive({ useHandCursor: true })
          .setDepth(100);
        
        hitArea.on('pointerdown', () => {
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.scene.restart();
        });
      }
    });
  }

  // ==================== CONTENT ====================

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    
    this.visibleAreaTop = 130;
    this.visibleAreaBottom = height;
    
    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.visibleAreaTop, width, height - this.visibleAreaTop);
    
    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setMask(maskShape.createGeometryMask());
  }

  private createAllCards(): void {
    const { width } = this.cameras.main;
    const cardW = (width - 45) / 2;

    const skinMap: Record<ShopTab, { skins: SkinData[]; type: SkinType }> = {
      caps: { skins: CAP_SKINS, type: 'cap' },
      balls: { skins: BALL_SKINS, type: 'ball' },
      fields: { skins: FIELD_SKINS, type: 'field' },
    };

    const { skins, type } = skinMap[this.currentTab];

    skins.forEach((skin, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 15 + col * (cardW + this.cardGap);
      const baseY = this.visibleAreaTop + 15 + row * (this.cardHeight + this.cardGap);

      const container = this.createSkinCard(x, baseY, cardW, this.cardHeight, skin, type);
      this.contentContainer.add(container);
      
      this.skinCards.push({ container, index: i, y: baseY });
    });

    const rows = Math.ceil(skins.length / 2);
    const contentHeight = rows * (this.cardHeight + this.cardGap) + 30;
    const viewportHeight = this.visibleAreaBottom - this.visibleAreaTop;
    this.maxScrollY = Math.max(0, contentHeight - viewportHeight);
  }

  private updateCardPositions(): void {
    this.contentContainer.y = -this.scrollY;
    
    const viewTop = this.scrollY - 50;
    const viewBottom = this.scrollY + (this.visibleAreaBottom - this.visibleAreaTop) + 50;
    
    this.skinCards.forEach(card => {
      const cardTop = card.y - this.visibleAreaTop;
      const cardBottom = cardTop + this.cardHeight;
      const visible = cardBottom > viewTop && cardTop < viewBottom;
      card.container.setVisible(visible);
    });
  }

  private createSkinCard(
    x: number, y: number, w: number, h: number, 
    skin: SkinData, type: SkinType
  ): Phaser.GameObjects.Container {
    const colors = getColors();
    const owned = playerData.ownsSkin(skin.id, type);
    const equipped = this.isEquipped(skin.id, type);
    const rarityColor = getRarityColor(skin.rarity);

    const container = this.add.container(x, y);

    // Фон
    const bg = this.add.graphics();
    if (owned) {
      bg.lineStyle(4, rarityColor, 0.2);
      bg.strokeRoundedRect(-2, -2, w + 4, h + 4, 16);
    }
    bg.fillStyle(0x0a0a15, 0.95);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(4, 4, w - 8, 95, { tl: 10, tr: 10, bl: 0, br: 0 });
    bg.lineStyle(1.5, owned ? rarityColor : colors.uiTextSecondary, owned ? 0.7 : 0.2);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    container.add(bg);

    // Бейдж редкости
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(rarityColor, 0.2);
    badgeBg.fillRoundedRect(8, 8, 55, 18, 4);
    badgeBg.lineStyle(1, rarityColor, 0.5);
    badgeBg.strokeRoundedRect(8, 8, 55, 18, 4);
    container.add(badgeBg);

    container.add(this.add.text(35, 17, getRarityName(skin.rarity).toUpperCase(), {
      fontSize: '8px',
      color: hexToString(rarityColor),
      fontStyle: 'bold'
    }).setOrigin(0.5));

    // Превью
    this.createSimplePreview(container, w / 2, 55, skin, type);

    // Название
    container.add(this.add.text(w / 2, 115, skin.name, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    container.add(this.add.text(w / 2, 133, getRarityName(skin.rarity), {
      fontSize: '10px',
      color: hexToString(rarityColor),
    }).setOrigin(0.5));

    // Кнопка статуса/цены
    this.createStatusButton(container, w / 2, h - 55, w - 24, 28, skin, type, owned, equipped, rarityColor);

    // Кнопка "View Details"
    this.createViewButton(container, w / 2, h - 22, w - 24, 30, skin, type);

    return container;
  }

  private createSimplePreview(
    container: Phaser.GameObjects.Container,
    x: number, y: number,
    skin: SkinData, type: SkinType
  ): void {
    switch (type) {
      case 'cap': {
        const capSkin = skin as CapSkinData;
        const radius = 28;
        if (capSkin.hasGlow) {
          container.add(this.add.circle(x, y, radius + 6, capSkin.glowColor || capSkin.primaryColor, 0.25));
        }
        container.add(this.add.ellipse(x + 2, y + 2, radius * 1.8, radius * 1.4, 0x000000, 0.25));
        const textureKey = capSkin.visual.textureKey;
        if (textureKey && this.textures.exists(textureKey)) {
          container.add(this.add.sprite(x, y, textureKey).setScale((radius * 2) / 128));
        } else {
          const g = this.add.graphics();
          g.fillStyle(capSkin.primaryColor);
          g.fillCircle(x, y, radius);
          g.lineStyle(2, capSkin.secondaryColor);
          g.strokeCircle(x, y, radius);
          container.add(g);
        }
        break;
      }
      case 'ball': {
        const ballSkin = skin as BallSkinData;
        const radius = 24;
        if (ballSkin.hasGlow) {
          container.add(this.add.circle(x, y, radius + 5, ballSkin.glowColor, 0.2));
        }
        container.add(this.add.ellipse(x + 2, y + 2, radius * 1.6, radius * 1.2, 0x000000, 0.2));
        const textureKey = ballSkin.textureKey;
        if (textureKey && this.textures.exists(textureKey)) {
          container.add(this.add.sprite(x, y, textureKey).setScale((radius * 2) / 64));
        } else {
          const g = this.add.graphics();
          g.fillStyle(ballSkin.primaryColor);
          g.fillCircle(x, y, radius);
          g.lineStyle(2, ballSkin.glowColor);
          g.strokeCircle(x, y, radius);
          container.add(g);
        }
        break;
      }
      case 'field': {
        const fieldSkin = skin as FieldSkinData;
        const fw = 80, fh = 50;
        const g = this.add.graphics();
        g.fillStyle(fieldSkin.fieldColor);
        g.fillRoundedRect(x - fw/2, y - fh/2, fw, fh, 4);
        g.lineStyle(1, fieldSkin.lineColor, 0.7);
        g.strokeRoundedRect(x - fw/2 + 3, y - fh/2 + 3, fw - 6, fh - 6, 3);
        g.lineBetween(x - fw/2 + 3, y, x + fw/2 - 3, y);
        g.strokeCircle(x, y, 8);
        g.lineStyle(1.5, fieldSkin.borderColor);
        g.strokeRoundedRect(x - fw/2, y - fh/2, fw, fh, 4);
        container.add(g);
        break;
      }
    }
  }

  private createStatusButton(
    container: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number,
    skin: SkinData, type: SkinType,
    owned: boolean, equipped: boolean, rarityColor: number
  ): void {
    const colors = getColors();
    const bg = this.add.graphics();

    if (equipped) {
      bg.fillStyle(colors.uiAccent, 0.15);
      bg.fillRoundedRect(x - w/2, y - h/2, w, h, 5);
      container.add(bg);
      container.add(this.add.text(x, y, '✓ EQUIPPED', {
        fontSize: '10px',
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold'
      }).setOrigin(0.5));
    } else if (owned) {
      bg.fillStyle(colors.uiPrimary, 0.1);
      bg.fillRoundedRect(x - w/2, y - h/2, w, h, 5);
      container.add(bg);
      container.add(this.add.text(x, y, '✓ OWNED', {
        fontSize: '10px',
        color: hexToString(colors.uiPrimary),
        fontStyle: 'bold'
      }).setOrigin(0.5));
    } else {
      const canAfford = this.canAfford(skin.price);
      const btnColor = canAfford ? rarityColor : colors.uiTextSecondary;
      bg.fillStyle(btnColor, 0.1);
      bg.fillRoundedRect(x - w/2, y - h/2, w, h, 5);
      container.add(bg);
      container.add(this.add.text(x, y, formatPrice(skin.price), {
        fontSize: '11px',
        color: hexToString(btnColor),
        fontStyle: 'bold'
      }).setOrigin(0.5));
    }
  }

  private createViewButton(
    container: Phaser.GameObjects.Container,
    x: number, y: number, w: number, h: number,
    skin: SkinData, type: SkinType
  ): void {
    const colors = getColors();
    
    const bg = this.add.graphics();
    bg.fillStyle(colors.uiPrimary, 0.15);
    bg.fillRoundedRect(x - w/2, y - h/2, w, h, 6);
    bg.lineStyle(1.5, colors.uiPrimary, 0.5);
    bg.strokeRoundedRect(x - w/2, y - h/2, w, h, 6);
    container.add(bg);

    container.add(this.add.text(x, y, '👁 VIEW', {
      fontSize: '11px',
      color: hexToString(colors.uiPrimary),
      fontStyle: 'bold'
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    
    hitArea.on('pointerdown', () => {
      // Открываем модалку только если не скроллили
      if (this.dragDistance < 10 && !this.activeModal) {
        this.openDetailModal(skin, type);
      }
    });
    
    container.add(hitArea);
  }

  private openDetailModal(skin: SkinData, type: SkinType): void {
    if (this.activeModal) return;

    this.activeModal = new SkinDetailModal(
      this,
      skin,
      type,
      () => {
        this.activeModal = null;
        // Обновляем UI после закрытия
        this.updateCurrencyDisplay();
        this.scene.restart();
      }
    );
  }

  private updateCurrencyDisplay(): void {
    const data = playerData.get();
    this.coinsText?.setText(`${data.coins}`);
    this.starsText?.setText(`${data.stars}`);
  }

  // ==================== SCROLLING ====================

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      if (this.activeModal) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.scrollVelocity = 0;
      this.updateCardPositions();
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.activeModal) return;
      if (p.y > this.visibleAreaTop) {
        this.isDragging = true;
        this.lastPointerY = p.y;
        this.scrollVelocity = 0;
        this.dragDistance = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.activeModal) return;
      if (this.isDragging) {
        const delta = this.lastPointerY - p.y;
        this.dragDistance += Math.abs(delta);
        this.scrollVelocity = delta;
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.lastPointerY = p.y;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }

  // ==================== HELPERS ====================

  private isEquipped(skinId: string, type: SkinType): boolean {
    const data = playerData.get();
    const map: Record<SkinType, string> = {
      cap: data.equippedCapSkin,
      ball: data.equippedBallSkin,
      field: data.equippedFieldSkin,
    };
    return map[type] === skinId;
  }

  private canAfford(price: SkinPrice): boolean {
    const data = playerData.get();
    if (price.stars) return data.stars >= price.stars;
    if (price.coins) return data.coins >= price.coins;
    return true;
  }
}