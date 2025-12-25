// src/scenes/ShopScene.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../config/themes';
import { playerData } from '../data/PlayerData';
import {
  BALL_SKINS,
  FIELD_SKINS,
  BallSkinData,
  FieldSkinData,
  formatPrice,
  getRarityName,
  SkinPrice,
  getRarityColor as getSkinRarityColor,
} from '../data/SkinsCatalog';
import {
  getUnit,
  getUnitsByFaction,
  getStarterUnits,
  UnitData,
  getRarityColor as getUnitRarityColor,
  getClassColor,
  getClassIcon,
  getClassName,
  formatPrice as formatUnitPrice,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  getRarityName as getUnitRarityName,
} from '../data/UnitsCatalog';
import { CapUpgrades, getCapTotalLevel } from '../data/PlayerData';
import { FACTIONS, FactionId, FACTION_IDS, FactionConfig, getFactionPrice } from '../constants/gameConstants';
import { AudioManager } from '../managers/AudioManager';

type ShopTab = 'units' | 'balls' | 'fields' | 'factions';
type SkinData = BallSkinData | FieldSkinData;

interface Card {
  container: Phaser.GameObjects.Container;
  y: number;
  height: number;
}

export class ShopScene extends Phaser.Scene {
  private currentTab: ShopTab = 'units';
  private scrollY = 0;
  private maxScrollY = 0;
  private contentContainer!: Phaser.GameObjects.Container;
  private coinsText!: Phaser.GameObjects.Text;
  private crystalsText!: Phaser.GameObjects.Text;

  private cards: Card[] = [];
  private visibleAreaTop = 0;
  private visibleAreaBottom = 0;
  private isDragging = false;
  private lastPointerY = 0;
  private scrollVelocity = 0;
  
  // Состояние
  private selectedUnitId: string | null = null; // Для панели прокачки
  private expandedFactionId: string | null = null; // Для развернутой фракции
  private isOverlayOpen = false; // Для View mode
  private dragDistance = 0;

  constructor() {
    super({ key: 'ShopScene' });
  }

  create(): void {
    this.cards = [];
    this.scrollY = 0;
    this.scrollVelocity = 0;
    this.isOverlayOpen = false;
    this.selectedUnitId = null;
    this.expandedFactionId = null;

    this.createBackground();
    this.createHeader();
    this.createTabs();
    this.createContentArea();
    this.renderContent();
    this.setupScrolling();
  }

  update(): void {
    if (!this.isDragging && !this.isOverlayOpen && Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + this.scrollVelocity, 0, this.maxScrollY);
      this.scrollVelocity *= 0.92;
      this.updateCardPositions();
    }
  }

  // ==================== UI SETUP ====================

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    // Dark Tech Background
    const bg = this.add.graphics();
    bg.fillStyle(0x050508, 1);
    bg.fillRect(0, 0, width, height);

    // Hexagon Grid Pattern
    const hexSize = 60;
    bg.lineStyle(1, 0x1a1a2e, 0.5);
    for(let y=0; y<height + hexSize; y+=hexSize*0.86) {
      for(let x=0; x<width + hexSize; x+=hexSize*1.5) {
        const off = (Math.floor(y/(hexSize*0.86)) % 2) * (hexSize * 0.75);
        this.drawHexagon(bg, x + off, y, hexSize/2);
      }
    }
  }

  private drawHexagon(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
    const points = [];
    for(let i=0; i<6; i++) {
      const angle = Phaser.Math.DegToRad(60 * i);
      points.push({ x: x + r * Math.cos(angle), y: y + r * Math.sin(angle) });
    }
    g.strokePoints(points, true);
  }

  private createHeader(): void {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const data = playerData.get();

    // Top Bar
    const headerH = 80;
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(0, 0, width, headerH);
    bg.lineStyle(1, 0x333333);
    bg.lineBetween(0, headerH, width, headerH);
    bg.setDepth(100);

    // Back Button
    const backBtn = this.add.container(40, 40).setDepth(101);
    const bBg = this.add.graphics();
    bBg.fillStyle(0x222222, 1);
    bBg.fillRoundedRect(0, -15, 80, 30, 6);
    bBg.lineStyle(1, 0x555555);
    bBg.strokeRoundedRect(0, -15, 80, 30, 6);
    const bTxt = this.add.text(40, 0, '◀ MENU', { fontSize: '12px', fontFamily: fonts.tech }).setOrigin(0.5);
    backBtn.add([bBg, bTxt]);
    
    bBg.setInteractive(new Phaser.Geom.Rectangle(0, -15, 80, 30), Phaser.Geom.Rectangle.Contains)
       .on('pointerdown', () => {
         AudioManager.getInstance().playSFX('sfx_click');
         this.scene.start('MainMenuScene');
       });

    // Title
    this.add.text(width / 2, 40, 'GALACTIC MARKET', {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
      shadow: { blur: 10, color: '#00ccff', fill: true }
    }).setOrigin(0.5).setDepth(101);

    // Wallet
    this.createCurrencyPanel(width - 20, 40, data);
  }

  private createCurrencyPanel(x: number, y: number, data: ReturnType<typeof playerData.get>): void {
    const fonts = getFonts();
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.6);
    bg.fillRoundedRect(x - 130, y - 25, 120, 50, 8);
    bg.lineStyle(1, 0x444444);
    bg.strokeRoundedRect(x - 130, y - 25, 120, 50, 8);
    bg.setDepth(100);

    // Coins
    this.add.text(x - 110, y - 10, '💰', { fontSize: '14px' }).setDepth(101).setOrigin(0, 0.5);
    this.coinsText = this.add.text(x - 15, y - 10, `${data.coins}`, { 
      fontSize: '14px', fontFamily: fonts.tech, color: '#ffd700' 
    }).setOrigin(1, 0.5).setDepth(101);

    // Crystals
    this.add.text(x - 110, y + 10, '💎', { fontSize: '14px' }).setDepth(101).setOrigin(0, 0.5);
    this.crystalsText = this.add.text(x - 15, y + 10, `${data.crystals}`, { 
      fontSize: '14px', fontFamily: fonts.tech, color: '#ff00ff' 
    }).setOrigin(1, 0.5).setDepth(101);
  }

  private createTabs(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    
    const tabs: { id: ShopTab; label: string; icon: string }[] = [
      { id: 'units', label: 'UNITS', icon: '🤖' },
      { id: 'balls', label: 'BALLS', icon: '⚽' },
      { id: 'fields', label: 'ARENAS', icon: '🏟️' },
      { id: 'factions', label: 'TEAMS', icon: '🚩' },
    ];

    const tabW = (width - 20) / 4;
    const tabH = 45;
    const startY = 95;
    const startX = 10;

    tabs.forEach((tab, i) => {
      const isActive = this.currentTab === tab.id;
      const x = startX + i * tabW;
      
      const container = this.add.container(x, startY).setDepth(90);

      const bg = this.add.graphics();
      if (isActive) {
        bg.fillStyle(colors.uiAccent, 1); // Active highlight
        bg.fillRoundedRect(2, 0, tabW - 4, tabH, { tl:8, tr:8, bl:0, br:0 });
      } else {
        bg.fillStyle(0x1a1a1a, 1);
        bg.lineStyle(1, 0x444444);
        bg.strokeRoundedRect(2, 0, tabW - 4, tabH, { tl:8, tr:8, bl:0, br:0 });
      }
      container.add(bg);

      // Icon + Text
      const contentColor = isActive ? '#000000' : '#888888';
      
      const txt = this.add.text(tabW/2, tabH/2, tab.label, {
        fontSize: '10px',
        fontFamily: fonts.tech,
        color: contentColor,
        fontStyle: 'bold'
      }).setOrigin(0.5, 0.5);
      
      // Active Indicator line
      if (isActive) {
        const line = this.add.rectangle(tabW/2, tabH - 2, tabW * 0.6, 2, 0xffffff);
        container.add(line);
      }

      container.add(txt);

      const hit = this.add.rectangle(tabW/2, tabH/2, tabW, tabH).setInteractive({ useHandCursor: true });
      container.add(hit);

      hit.on('pointerdown', () => {
        if (this.currentTab !== tab.id) {
          AudioManager.getInstance().playSFX('sfx_click');
          this.currentTab = tab.id;
          this.scrollY = 0;
          this.selectedUnitId = null;
          this.expandedFactionId = null;
          this.renderContent();
        }
      });
    });
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main;
    this.visibleAreaTop = 155; // Below tabs
    this.visibleAreaBottom = height;

    const maskShape = this.add.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(0, this.visibleAreaTop, width, height - this.visibleAreaTop);
    const mask = maskShape.createGeometryMask();
    maskShape.setVisible(false);

    this.contentContainer = this.add.container(0, 0);
    this.contentContainer.setMask(mask);
  }

  // ==================== RENDER CONTENT ====================

  private renderContent(): void {
    this.contentContainer.removeAll(true);
    this.cards = [];
    this.isOverlayOpen = false;

    if (this.selectedUnitId) {
      this.renderUnitUpgradePanel();
      return;
    }

    switch (this.currentTab) {
      case 'units': this.renderUnitsTab(); break;
      case 'balls': this.renderBallsTab(); break;
      case 'fields': this.renderFieldsTab(); break;
      case 'factions': this.renderFactionsTab(); break;
    }

    this.updateCardPositions();
  }

  // ---------------- FACTIONS (RICH BANNERS) ----------------

  private renderFactionsTab(): void {
    const { width } = this.cameras.main;
    let currentY = this.visibleAreaTop + 15;
    const gap = 15;

    FACTION_IDS.forEach((factionId) => {
      const isExpanded = this.expandedFactionId === factionId;
      const cardH = isExpanded ? 280 : 110; // Expand for details
      
      const faction = FACTIONS[factionId];
      const isOwned = playerData.ownsFaction(factionId);
      const isActive = playerData.getFaction() === factionId;
      const price = getFactionPrice(factionId);

      const container = this.createFactionBanner(20, currentY, width - 40, cardH, faction, isOwned, isActive, price, isExpanded);
      this.contentContainer.add(container);
      this.cards.push({ container, y: currentY, height: cardH });

      currentY += cardH + gap;
    });

    this.updateMaxScroll(currentY);
  }

  private createFactionBanner(x: number, y: number, w: number, h: number, faction: FactionConfig, isOwned: boolean, isActive: boolean, price: { coins?: number; crystals?: number }, isExpanded: boolean) {
    const fonts = getFonts();
    const container = this.add.container(x, y);
    const color = faction.color;

    // --- BACKGROUND ---
    const bg = this.add.graphics();
    bg.fillStyle(0x111111, 1);
    bg.fillRoundedRect(0, 0, w, h, 12);
    
    // Colored accent border
    bg.lineStyle(2, isActive ? 0x00ff00 : (isOwned ? color : 0x444444), 1);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    
    // Gradient fill simulation (Left accent)
    bg.fillStyle(color, 0.15);
    bg.fillRoundedRect(0, 0, 80, h, { tl: 12, bl: 12, tr: 0, br: 0 });
    
    container.add(bg);

    // --- MAIN ROW (Always visible) ---
    
    // Token / Icon
    if (this.textures.exists(faction.assetKey)) {
      const icon = this.add.image(40, 55, faction.assetKey).setDisplaySize(60, 60);
      if (!isOwned) icon.setTint(0x555555);
      container.add(icon);
    } else {
      container.add(this.add.circle(40, 55, 30, color));
    }

    // Texts
    container.add(this.add.text(90, 25, faction.name.toUpperCase(), { 
      fontSize: '20px', fontFamily: fonts.tech, color: hexToString(color), fontStyle: 'bold' 
    }));

    // Stats Summary
    const statsTxt = `Mass: ${(faction.stats.mass * 100).toFixed(0)}%  |  Bounce: ${(faction.stats.bounce * 100).toFixed(0)}%`;
    container.add(this.add.text(90, 50, statsTxt, { fontSize: '10px', color: '#aaaaaa' }));

    // --- BUTTONS (Right Side) ---
    
    // INFO Toggle
    const infoBtn = this.add.text(w - 20, 20, isExpanded ? '▲' : '▼ INFO', { 
      fontSize: '12px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 5, y: 3 }
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    
    infoBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.expandedFactionId = isExpanded ? null : faction.id;
      this.renderContent();
    });
    container.add(infoBtn);

    // Action Button
    let btnText = '';
    let btnColor = 0x444444;
    let btnTextColor = '#ffffff';

    if (isActive) {
      btnText = '✓ ACTIVE';
      btnColor = 0x004400; // Dark Green
      btnTextColor = '#00ff00';
    } else if (isOwned) {
      btnText = 'SELECT';
      btnColor = color;
      btnTextColor = '#000000';
    } else {
      btnText = formatPrice(price);
      btnColor = 0xffffff;
      btnTextColor = '#000000';
    }

    const actionContainer = this.add.container(w - 70, 75);
    const actionBg = this.add.rectangle(0, 0, 100, 32, btnColor, isActive ? 0 : 1).setStrokeStyle(isActive ? 1 : 0, 0x00ff00);
    if (!isActive) actionBg.setInteractive({ useHandCursor: true });
    
    const actionTxt = this.add.text(0, 0, btnText, { 
      fontSize: '12px', fontFamily: fonts.tech, color: btnTextColor, fontStyle: 'bold' 
    }).setOrigin(0.5);

    actionContainer.add([actionBg, actionTxt]);
    container.add(actionContainer);

    actionBg.on('pointerdown', () => {
      if (this.dragDistance > 5) return;
      if (isActive) return;

      if (isOwned) {
        AudioManager.getInstance().playSFX('sfx_click');
        playerData.switchFaction(faction.id);
        this.renderContent();
      } else {
        if (playerData.buyFaction(faction.id)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          this.updateCurrencyDisplay();
          this.renderContent();
        }
      }
    });

    // --- EXPANDED DETAILS (Starter Units Preview) ---
    if (isExpanded) {
      const sep = this.add.rectangle(w/2, 110, w - 20, 1, 0x333333);
      container.add(sep);

      container.add(this.add.text(w/2, 125, 'INCLUDES STARTER SQUAD:', { 
        fontSize: '12px', color: '#888888', fontFamily: fonts.tech 
      }).setOrigin(0.5));

      const starters = getStarterUnits(faction.id);
      const startX = (w - (starters.length * 90)) / 2 + 45;

      starters.forEach((unit, i) => {
        const uX = startX + i * 90;
        const uY = 190;

        // Unit Slot
        const uBg = this.add.rectangle(uX, uY, 80, 100, 0x222222).setStrokeStyle(1, 0x444444);
        container.add(uBg);

        // Icon
        if (this.textures.exists(unit.assetKey)) {
          const uIcon = this.add.image(uX, uY - 15, unit.assetKey).setDisplaySize(50, 50);
          container.add(uIcon);
        }

        // Role
        const roleColor = getClassColor(unit.capClass);
        const roleTxt = this.add.text(uX, uY + 25, unit.capClass.toUpperCase(), { 
          fontSize: '9px', color: hexToString(roleColor) 
        }).setOrigin(0.5);
        container.add(roleTxt);
      });
    }

    return container;
  }

  // ---------------- UNITS (TASTY CARDS) ----------------

  private renderUnitsTab(): void {
    const { width } = this.cameras.main;
    let currentY = this.visibleAreaTop + 15;
    const fonts = getFonts();

    // Loop Factions
    FACTION_IDS.forEach(factionId => {
      const faction = FACTIONS[factionId];
      const isFactionOwned = playerData.ownsFaction(factionId);
      const factionColor = faction.color;

      // Section Header (Neon Line)
      const header = this.add.container(0, currentY);
      const line = this.add.rectangle(width/2, 15, width - 40, 2, factionColor, 0.5);
      const titleBg = this.add.rectangle(width/2, 15, 160, 24, 0x000000).setStrokeStyle(1, factionColor);
      const title = this.add.text(width/2, 15, faction.name.toUpperCase(), {
        fontSize: '12px', fontFamily: fonts.tech, color: hexToString(factionColor), letterSpacing: 1
      }).setOrigin(0.5);

      header.add([line, titleBg, title]);
      this.contentContainer.add(header);
      currentY += 40;

      // Units
      const units = getUnitsByFaction(factionId);
      
      units.forEach((unit) => {
        const ownedData = playerData.getOwnedUnit(unit.id);
        const isActuallyOwned = !!ownedData || (isFactionOwned && unit.isStarter);
        const isLocked = !isActuallyOwned && !isFactionOwned; 
        const canBuy = isFactionOwned && !isActuallyOwned;

        const cardH = 100;
        const container = this.createTastyUnitCard(20, currentY, width - 40, cardH, unit, isActuallyOwned, canBuy, isLocked, factionColor);
        this.contentContainer.add(container);
        this.cards.push({ container, y: currentY, height: cardH });
        
        currentY += cardH + 12;
      });

      currentY += 20;
    });

    this.updateMaxScroll(currentY);
  }

  private createTastyUnitCard(x: number, y: number, w: number, h: number, unit: UnitData, isOwned: boolean, canBuy: boolean, isLocked: boolean, factionColor: number) {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const rarityColor = getUnitRarityColor(unit.rarity);
    
    // --- BACKGROUND ---
    const bg = this.add.graphics();
    bg.fillStyle(0x151515, 1); // Dark base
    bg.fillRoundedRect(0, 0, w, h, 10);
    
    // Gradient Tint based on faction (Subtle)
    bg.fillStyle(factionColor, 0.08);
    bg.fillRoundedRect(0, 0, w, h, 10);

    // Border
    const borderAlpha = isOwned ? 0.8 : (canBuy ? 0.4 : 0.1);
    bg.lineStyle(1, isOwned ? rarityColor : factionColor, borderAlpha);
    bg.strokeRoundedRect(0, 0, w, h, 10);
    container.add(bg);

    // --- SPRITE & GLOW ---
    const cx = 60;
    const cy = h / 2;
    
    if (this.textures.exists(unit.assetKey)) {
      // Glow behind unit
      const glow = this.add.image(cx, cy, unit.assetKey).setDisplaySize(80, 80).setTint(factionColor).setAlpha(0.4).setBlendMode(Phaser.BlendModes.ADD);
      container.add(glow);

      const sprite = this.add.image(cx, cy, unit.assetKey).setDisplaySize(65, 65);
      if (isLocked) {
        sprite.setTint(0x000000).setAlpha(0.6);
      }
      container.add(sprite);
    } else {
      container.add(this.add.circle(cx, cy, 30, 0x333333));
    }

    // --- TEXT INFO ---
    const textX = 110;
    
    // Name
    container.add(this.add.text(textX, 20, unit.name.toUpperCase(), {
      fontSize: '16px', fontFamily: fonts.tech, color: isLocked ? '#666666' : '#ffffff', fontStyle: 'bold'
    }));

    // Role & Description
    const classColor = getClassColor(unit.capClass);
    const roleName = getClassName(unit.capClass);
    
    // Create a pill badge for role
    const pillBg = this.add.graphics();
    pillBg.fillStyle(classColor, 0.2);
    pillBg.fillRoundedRect(textX, 42, 80, 16, 4);
    container.add(pillBg);

    const icon = getClassIcon(unit.capClass);
    container.add(this.add.text(textX + 40, 50, `${icon} ${roleName}`, {
      fontSize: '10px', color: hexToString(classColor), fontFamily: fonts.tech
    }).setOrigin(0.5));

    // Description text (Flavor)
    const flavor = this.getUnitFlavor(unit.capClass);
    container.add(this.add.text(textX, 70, flavor, {
      fontSize: '10px', color: '#888888', fontStyle: 'italic'
    }));

    // --- RIGHT SIDE ACTION ---
    const btnX = w - 60;
    const btnY = h / 2;
    const btnW = 90;
    const btnH = 34;

    if (isOwned) {
      // UPGRADE BUTTON
      const unitOwnedData = playerData.getOwnedUnit(unit.id);
      const level = unitOwnedData ? getCapTotalLevel(unitOwnedData.upgrades) : 4;
      
      const btnBg = this.add.graphics();
      // Metallic gradient look
      btnBg.fillStyle(0x333333, 1);
      btnBg.fillRoundedRect(btnX - btnW/2, btnY - btnH/2, btnW, btnH, 6);
      btnBg.lineStyle(1, 0x666666);
      btnBg.strokeRoundedRect(btnX - btnW/2, btnY - btnH/2, btnW, btnH, 6);
      
      const btnTxt = this.add.text(btnX, btnY, `LVL ${level} ⚡`, { 
        fontSize: '14px', fontFamily: fonts.tech, color: '#ffcc00', fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(btnX, btnY, btnW, btnH).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.dragDistance > 5) return;
        this.selectedUnitId = unit.id;
        this.scrollY = 0;
        this.renderContent();
      });
      container.add([btnBg, btnTxt, hit]);

    } else if (canBuy) {
      // BUY BUTTON
      const priceTxt = formatUnitPrice(unit.price);
      const canAfford = (playerData.get().coins >= (unit.price.coins || 0));
      const buyColor = canAfford ? 0x228b22 : 0x555555;

      const btnBg = this.add.graphics();
      btnBg.fillStyle(buyColor, 1);
      btnBg.fillRoundedRect(btnX - btnW/2, btnY - btnH/2, btnW, btnH, 6);
      
      // Bevel effect
      btnBg.fillStyle(0xffffff, 0.1);
      btnBg.fillRect(btnX - btnW/2, btnY - btnH/2, btnW, btnH/2);

      const btnTxt = this.add.text(btnX, btnY, priceTxt, { 
        fontSize: '12px', fontFamily: fonts.tech, color: '#ffffff', fontStyle: 'bold'
      }).setOrigin(0.5);

      const hit = this.add.rectangle(btnX, btnY, btnW, btnH).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (this.dragDistance > 5) return;
        if (playerData.buyUnit(unit.id)) {
          AudioManager.getInstance().playSFX('sfx_cash');
          this.updateCurrencyDisplay();
          this.renderContent();
        }
      });
      container.add([btnBg, btnTxt, hit]);

    } else {
      // LOCKED
      const lock = this.add.text(btnX, btnY, '🔒 LOCKED', { fontSize: '10px', color: '#555555' }).setOrigin(0.5);
      container.add(lock);
    }

    return container;
  }

  // ---------------- FIELDS (PERSPECTIVE) ----------------

  private renderFieldsTab(): void {
    // Only use the 3 real fields
    this.renderGrid(FIELD_SKINS, 'field');
  }

  private renderBallsTab(): void {
    this.renderGrid(BALL_SKINS, 'ball');
  }

  private renderGrid(items: (BallSkinData | FieldSkinData)[], type: 'ball' | 'field'): void {
    const { width } = this.cameras.main;
    const cardW = (width - 45) / 2;
    const cardH = 160;
    const colCount = 2;
    
    items.forEach((item, i) => {
      const col = i % colCount;
      const row = Math.floor(i / colCount);
      const x = 15 + col * (cardW + 15) + cardW/2;
      const y = this.visibleAreaTop + 20 + row * (cardH + 15) + cardH/2;

      const container = this.createAssetCard(x, y, cardW, cardH, item, type);
      this.contentContainer.add(container);
      this.cards.push({ container, y, height: cardH });
    });

    const rows = Math.ceil(items.length / colCount);
    const contentH = rows * (cardH + 15) + 50;
    this.updateMaxScroll(this.visibleAreaTop + contentH);
  }

  private createAssetCard(x: number, y: number, w: number, h: number, item: SkinData, type: 'ball' | 'field'): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.add.container(x, y);

    const isOwned = type === 'ball' ? playerData.ownsBallSkin(item.id) : playerData.ownsFieldSkin(item.id);
    const isEquipped = type === 'ball' ? playerData.get().equippedBallSkin === item.id : playerData.get().equippedFieldSkin === item.id;
    const rarityColor = getSkinRarityColor(item.rarity);

    // Card BG
    const bg = this.add.graphics();
    bg.fillStyle(0x1a1a1a, 1);
    bg.fillRoundedRect(-w/2, -h/2, w, h, 8);
    // Rarity Border
    bg.lineStyle(2, isEquipped ? 0x00ff00 : (isOwned ? rarityColor : 0x333333));
    bg.strokeRoundedRect(-w/2, -h/2, w, h, 8);
    container.add(bg);

    // PREVIEW AREA
    if (type === 'field') {
      // PERSPECTIVE FIELD (Trapezoid)
      const fData = item as FieldSkinData;
      this.drawPerspectiveField(container, 0, -20, 100, 60, fData.fieldColor, fData.lineColor);
    } else {
      // BALL
      const bData = item as BallSkinData;
      if (bData.textureKey && this.textures.exists(bData.textureKey)) {
        const img = this.add.image(0, -20, bData.textureKey).setDisplaySize(60, 60);
        container.add(img);
      } else {
        container.add(this.add.circle(0, -20, 30, bData.primaryColor));
      }
    }

    // Name
    container.add(this.add.text(0, 20, item.name, { 
      fontSize: '12px', fontFamily: fonts.tech, color: '#ffffff'
    }).setOrigin(0.5));

    // Action Button
    let btnText = '';
    let btnColor = 0x444444;
    
    if (isEquipped) { btnText = 'EQUIPPED'; btnColor = 0x004400; }
    else if (isOwned) { btnText = 'EQUIP'; btnColor = 0x0000aa; }
    else { btnText = formatPrice(item.price); btnColor = 0xffffff; }

    const btn = this.add.container(0, 55);
    const btnBg = this.add.rectangle(0, 0, w - 20, 28, isOwned ? btnColor : 0x333333).setInteractive({ useHandCursor: true });
    if (!isOwned) btnBg.setStrokeStyle(1, 0xffffff);
    
    const btnTxt = this.add.text(0, 0, btnText, { 
      fontSize: '10px', fontFamily: fonts.tech, color: !isOwned ? '#ffffff' : '#ffffff' 
    }).setOrigin(0.5);

    btn.add([btnBg, btnTxt]);
    container.add(btn);

    // Eye Icon
    const eye = this.add.text(w/2 - 20, -h/2 + 5, '👁️', { fontSize: '14px' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    container.add(eye);

    // Logic
    btnBg.on('pointerdown', () => {
      if (this.dragDistance > 5) return;
      AudioManager.getInstance().playSFX('sfx_click');
      
      if (isOwned) {
        if (type === 'ball') playerData.equipBallSkin(item.id);
        else playerData.equipFieldSkin(item.id);
        this.renderContent();
      } else {
        const success = type === 'ball' 
           ? playerData.buyBallSkin(item.id, item.price) 
           : playerData.buyFieldSkin(item.id, item.price);
        if (success) {
           AudioManager.getInstance().playSFX('sfx_cash');
           this.updateCurrencyDisplay();
           this.renderContent();
        }
      }
    });

    eye.on('pointerdown', () => this.openPreviewOverlay(item, type));

    return container;
  }

  private drawPerspectiveField(container: Phaser.GameObjects.Container, x: number, y: number, w: number, h: number, color: number, lines: number) {
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    
    // Trapezoid points
    const inset = 15;
    const p1 = { x: x - w/2 + inset, y: y - h/2 }; // TL
    const p2 = { x: x + w/2 - inset, y: y - h/2 }; // TR
    const p3 = { x: x + w/2, y: y + h/2 }; // BR
    const p4 = { x: x - w/2, y: y + h/2 }; // BL

    g.fillPoints([p1, p2, p3, p4], true);
    
    // Grid effect
    g.lineStyle(1, lines, 0.3);
    g.strokePoints([p1, p2, p3, p4], true);
    g.lineBetween((p1.x+p2.x)/2, p1.y, (p3.x+p4.x)/2, p3.y); // Center line
    
    // Goal Posts (Lines)
    g.lineStyle(2, 0xffffff, 0.8);
    g.lineBetween(p1.x - 2, p1.y - 10, p1.x - 2, p1.y);
    g.lineBetween(p2.x + 2, p2.y - 10, p2.x + 2, p2.y);

    container.add(g);
  }

  // ==================== UPGRADE PANEL ====================

  private renderUnitUpgradePanel(): void {
    const { width } = this.cameras.main;
    const fonts = getFonts();
    const unit = getUnit(this.selectedUnitId!);
    const owned = playerData.getOwnedUnit(this.selectedUnitId!) || { upgrades: { power:1, mass:1, aim:1, technique:1 } };
    
    if (!unit) return;

    const container = this.add.container(0, this.visibleAreaTop + 20);
    this.contentContainer.add(container);

    // Header Back
    const backBtn = this.add.text(20, 0, '◀ BACK', { fontSize: '16px', fontFamily: fonts.tech, color: '#ffff00' })
      .setInteractive({ useHandCursor: true });
    backBtn.on('pointerdown', () => {
      this.selectedUnitId = null;
      this.renderContent();
    });
    container.add(backBtn);

    // Unit Large
    if (this.textures.exists(unit.assetKey)) {
      const img = this.add.image(width/2, 80, unit.assetKey).setDisplaySize(120, 120);
      container.add(img);
    }

    container.add(this.add.text(width/2, 150, unit.name.toUpperCase(), { 
      fontSize: '24px', fontFamily: fonts.tech, fontStyle: 'bold'
    }).setOrigin(0.5));

    // Stats Rows
    const stats: (keyof CapUpgrades)[] = ['power', 'mass', 'aim', 'technique'];
    const icons = { power: '💥', mass: '🛡️', aim: '🎯', technique: '✨' };
    
    let y = 200;
    
    stats.forEach(stat => {
      const level = owned.upgrades[stat] as number;
      const cost = getUpgradeCost(level);
      const isMax = level >= MAX_UPGRADE_LEVEL;

      // Label
      container.add(this.add.text(30, y, `${icons[stat]} ${stat.toUpperCase()}`, { fontSize: '14px', fontFamily: fonts.tech }));
      
      // Bar Background
      const barBg = this.add.rectangle(140, y + 8, 120, 10, 0x333333).setOrigin(0, 0.5);
      // Bar Fill
      const fillW = (level / MAX_UPGRADE_LEVEL) * 120;
      const barFill = this.add.rectangle(140, y + 8, fillW, 10, 0x00ff00).setOrigin(0, 0.5);
      
      container.add([barBg, barFill]);

      // Button
      if (!isMax) {
        const btnBg = this.add.rectangle(width - 50, y + 8, 70, 30, 0x222222).setStrokeStyle(1, 0x00ff00).setInteractive({ useHandCursor: true });
        const btnTxt = this.add.text(width - 50, y + 8, `${cost}💰`, { fontSize: '12px', color: '#00ff00' }).setOrigin(0.5);
        
        btnBg.on('pointerdown', () => {
          if (playerData.upgradeUnit(unit.id, stat)) {
            AudioManager.getInstance().playSFX('sfx_cash');
            this.updateCurrencyDisplay();
            this.renderContent(); 
          }
        });
        container.add([btnBg, btnTxt]);
      } else {
        container.add(this.add.text(width - 50, y+8, 'MAX', { fontSize: '12px', color: '#ffff00', fontStyle:'bold' }).setOrigin(0.5));
      }

      y += 60;
    });

    this.maxScrollY = 0; 
  }

  // ==================== VIEW OVERLAY ====================

  private openPreviewOverlay(item: SkinData, type: 'ball' | 'field'): void {
    this.isOverlayOpen = true;
    const { width, height } = this.cameras.main;
    const fonts = getFonts();

    const overlay = this.add.container(0, 0).setDepth(200);
    const dim = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.95).setInteractive();
    overlay.add(dim);

    const closeBtn = this.add.text(width - 40, 40, '✕', { fontSize: '30px' }).setInteractive().setOrigin(0.5);
    closeBtn.on('pointerdown', () => {
      overlay.destroy();
      this.isOverlayOpen = false;
    });
    overlay.add(closeBtn);

    overlay.add(this.add.text(width/2, 100, item.name.toUpperCase(), { fontSize: '24px', fontFamily: fonts.tech }).setOrigin(0.5));

    const cx = width/2;
    const cy = height/2;

    if (type === 'ball') {
      const bData = item as BallSkinData;
      if (bData.textureKey && this.textures.exists(bData.textureKey)) {
        const img = this.add.image(cx, cy, bData.textureKey).setDisplaySize(200, 200);
        this.tweens.add({ targets: img, angle: 360, duration: 10000, repeat: -1, ease: 'Linear' });
        overlay.add(img);
      }
    } else {
      const fData = item as FieldSkinData;
      // Large Field Preview (Rect)
      const rect = this.add.rectangle(cx, cy, 300, 180, fData.fieldColor).setStrokeStyle(4, fData.lineColor);
      const center = this.add.circle(cx, cy, 30).setStrokeStyle(2, fData.lineColor);
      const line = this.add.rectangle(cx, cy, 2, 180, fData.lineColor);
      overlay.add([rect, center, line]);
    }
  }

  // ==================== UTILS ====================

  private getUnitFlavor(role: string): string {
    const flavors: Record<string, string> = {
      balanced: 'Versatile unit good at offense and defense.',
      tank: 'Heavy defender with high mass and push power.',
      sniper: 'Precise shooter with high aim stats.',
      trickster: 'Master of spin and unpredictable shots.',
    };
    return flavors[role] || 'Unique unit.';
  }

  private updateMaxScroll(contentBottom: number): void {
    const viewportH = this.visibleAreaBottom - this.visibleAreaTop;
    this.maxScrollY = Math.max(0, contentBottom - this.visibleAreaTop - viewportH + 50);
  }

  private updateCardPositions(): void {
    this.contentContainer.y = -this.scrollY;
    const viewTop = this.scrollY;
    const viewBottom = this.scrollY + (this.visibleAreaBottom - this.visibleAreaTop);

    this.cards.forEach(c => {
       const top = c.y - 50;
       const bottom = c.y + c.height + 50;
       c.container.setVisible(bottom > viewTop && top < viewBottom);
    });
  }

  private updateCurrencyDisplay(): void {
    const data = playerData.get();
    if (this.coinsText) this.coinsText.setText(`${data.coins}`);
    if (this.crystalsText) this.crystalsText.setText(`${data.crystals}`);
  }

  private setupScrolling(): void {
    this.input.on('wheel', (_: any, __: any, ___: number, deltaY: number) => {
      if (!this.isOverlayOpen) {
        this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
        this.scrollVelocity = 0;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > this.visibleAreaTop && !this.isOverlayOpen) {
        this.isDragging = true;
        this.lastPointerY = p.y;
        this.scrollVelocity = 0;
        this.dragDistance = 0;
      }
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.isDragging && !this.isOverlayOpen) {
        const delta = this.lastPointerY - p.y;
        this.dragDistance += Math.abs(delta);
        this.scrollY = Phaser.Math.Clamp(this.scrollY + delta, 0, this.maxScrollY);
        this.lastPointerY = p.y;
        this.updateCardPositions();
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });
  }
}