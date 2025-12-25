import Phaser from 'phaser';
import { getColors, hexToString, getRarityColor, getFonts } from '../config/themes';
import { playerData, CapUpgrades } from '../data/PlayerData';
import {
  getCapSkin,
  getRarityName,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  getRoleName,
  CapSkinData,
  getRoleIcon
} from '../data/SkinsCatalog';
import { AudioManager } from '../managers/AudioManager';

export class UpgradeScene extends Phaser.Scene {
  private selectedCapId: string | null = null;
  private coinsText!: Phaser.GameObjects.Text;
  private crystalsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UpgradeScene' });
  }

  init(data: { capId?: string }): void {
    if (data?.capId) {
      this.selectedCapId = data.capId;
    } else {
      // По умолчанию выбираем первую купленную фишку
      const owned = playerData.getOwnedCaps();
      if (owned.length > 0) this.selectedCapId = owned[0].id;
    }
  }

  create(): void {
    this.createBackground();
    this.createHeader();
    
    // Если есть фишки, рисуем интерфейс
    if (this.selectedCapId) {
      this.createSkinSelector();
      this.createUpgradePanel();
    } else {
      this.add.text(this.scale.width/2, this.scale.height/2, 'No Caps Collected', { 
        fontSize: '18px', 
        fontFamily: getFonts().tech,
        color: '#ffffff' 
      }).setOrigin(0.5);
    }
  }

  // ==================== BACKGROUND & EFFECTS ====================

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    
    // Base
    bg.fillStyle(colors.background, 1);
    bg.fillRect(0, 0, width, height);
    
    // Purple radial glow at top
    this.drawRadialGradient(bg, width / 2, 0, height * 0.6, colors.backgroundGradientTop, 0.5);
    
    // Accent glow at bottom
    this.drawRadialGradient(bg, width / 2, height, height * 0.3, colors.uiAccent, 0.08);

    // Grid
    bg.lineStyle(1, colors.uiPrimary, 0.03);
    for (let x = 0; x < width; x += 40) bg.lineBetween(x, 0, x, height);
    for (let y = 0; y < height; y += 40) bg.lineBetween(0, y, width, y);

    // Floating particles
    this.createParticles(12);
  }

  private drawRadialGradient(g: Phaser.GameObjects.Graphics, cx: number, cy: number, maxR: number, color: number, maxAlpha: number): void {
    const steps = 40;
    for (let i = steps; i > 0; i--) {
      const ratio = i / steps;
      g.fillStyle(color, maxAlpha * Math.pow(1 - ratio, 2));
      g.fillCircle(cx, cy, maxR * ratio);
    }
  }

  private createParticles(count: number): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const particleColors = [colors.uiAccent, colors.uiAccentPink, colors.uiPrimary];

    for (let i = 0; i < count; i++) {
      const particle = this.add.circle(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(100, height - 100),
        Phaser.Math.FloatBetween(1, 2.5),
        Phaser.Math.RND.pick(particleColors),
        Phaser.Math.FloatBetween(0.2, 0.4)
      );

      this.tweens.add({
        targets: particle,
        y: particle.y - Phaser.Math.Between(30, 60),
        alpha: { from: particle.alpha, to: 0.1 },
        duration: Phaser.Math.Between(4000, 7000),
        yoyo: true,
        repeat: -1,
        delay: i * 150,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // ==================== HEADER ====================

  private createHeader(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();

    // Header background
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x000000, 0.8);
    headerBg.fillRect(0, 0, width, 70);
    headerBg.lineStyle(2, colors.uiAccent, 0.3);
    headerBg.lineBetween(0, 70, width, 70);
    headerBg.setDepth(100);

    // Back button
    const backBtn = this.add.container(50, 35).setDepth(101);
    const backBg = this.add.graphics();
    
    const drawBackBg = (hover: boolean) => {
      backBg.clear();
      backBg.fillStyle(hover ? colors.uiAccent : 0x000000, hover ? 0.2 : 0.5);
      backBg.fillRoundedRect(-35, -16, 70, 32, 16);
      backBg.lineStyle(1, colors.glassBorder, hover ? 0.5 : 0.2);
      backBg.strokeRoundedRect(-35, -16, 70, 32, 16);
    };
    drawBackBg(false);

    backBtn.add(backBg);
    backBtn.add(this.add.text(0, 0, '← BACK', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: '#ffffff',
    }).setOrigin(0.5));
    
    backBtn.setInteractive(new Phaser.Geom.Rectangle(-35, -16, 70, 32), Phaser.Geom.Rectangle.Contains);
    backBtn.on('pointerover', () => { drawBackBg(true); backBtn.setScale(1.05); });
    backBtn.on('pointerout', () => { drawBackBg(false); backBtn.setScale(1); });
    backBtn.on('pointerdown', () => {
      AudioManager.getInstance().playSFX('sfx_click');
      this.scene.start('TacticsScene');
    });

    // Title with glow
    const titleGlow = this.add.graphics();
    titleGlow.fillStyle(colors.uiAccent, 0.1);
    titleGlow.fillEllipse(width / 2, 35, 160, 40);
    titleGlow.setDepth(100);

    this.add.text(width / 2, 35, 'TRAINING CENTER', {
      fontSize: '22px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101);

    // Coins display
    const coinsX = width - 120;
    
    // Coins Row
    const coinBg = this.add.graphics();
    coinBg.fillStyle(0x000000, 0.5);
    coinBg.fillRoundedRect(coinsX - 25, 10, 130, 50, 10);
    coinBg.setDepth(101);

    this.add.text(coinsX, 25, '💰', { fontSize: '12px' }).setOrigin(1, 0.5).setDepth(101);
    this.coinsText = this.add.text(coinsX + 5, 25, `${data.coins}`, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiGold),
    }).setOrigin(0, 0.5).setDepth(101);

    // Crystals Row
    this.add.text(coinsX, 45, '💎', { fontSize: '12px' }).setOrigin(1, 0.5).setDepth(101);
    this.crystalsText = this.add.text(coinsX + 5, 45, `${data.crystals}`, {
      fontSize: '13px',
      fontFamily: fonts.tech,
      color: '#60a5fa',
    }).setOrigin(0, 0.5).setDepth(101);
  }

  // ==================== SKIN SELECTOR ====================

  private createSkinSelector(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();
    const ownedCaps = playerData.getOwnedCaps();

    const selectorY = 110;
    const itemSize = 72;
    const gap = 12;
    // Simple scrolling logic simulation: center selected or start from left
    const startX = 50; 

    this.add.text(25, 80, 'SELECT MEME TO UPGRADE', {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: hexToString(colors.uiAccent),
      letterSpacing: 1,
    });

    // Container for horizontal scroll
    const scrollContainer = this.add.container(0, 0);

    ownedCaps.forEach((owned, index) => {
      const skin = getCapSkin(owned.id);
      if (!skin) return;

      const x = startX + index * (itemSize + gap) + itemSize / 2;
      // В реальном проекте тут нужен ScrollView, пока ограничим вывод по ширине
      if (x > width + 200) return;

      const isSelected = this.selectedCapId === owned.id;
      const rarityColor = getRarityColor(skin.rarity);

      const container = this.add.container(x, selectorY);

      // Background with glow for selected
      const bg = this.add.graphics();
      if (isSelected) {
        bg.lineStyle(4, colors.uiAccent, 0.3);
        bg.strokeRoundedRect(-itemSize / 2 - 3, -itemSize / 2 - 3, itemSize + 6, itemSize + 6, 14);
      }
      bg.fillStyle(0x14101e, 0.95);
      bg.fillRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 12);
      bg.lineStyle(isSelected ? 2 : 1, isSelected ? colors.uiAccent : rarityColor, isSelected ? 0.8 : 0.4);
      bg.strokeRoundedRect(-itemSize / 2, -itemSize / 2, itemSize, itemSize, 12);
      container.add(bg);

      // Preview Logic (Meme Image)
      if (skin.visual?.type === 'image' && skin.visual.imageKey && this.textures.exists(skin.visual.imageKey)) {
          const image = this.add.image(0, -6, skin.visual.imageKey);
          const texture = this.textures.get(skin.visual.imageKey);
          const frame = texture.getSourceImage();
          const imgSize = Math.max(frame.width, frame.height);
          image.setScale(40 / imgSize);
          container.add(image);
      } 
      // Fallback Sprite
      else if (skin.visual?.textureKey && this.textures.exists(skin.visual.textureKey)) {
          const sprite = this.add.sprite(0, -6, skin.visual.textureKey);
          sprite.setScale(40 / 128);
          container.add(sprite);
      }
      // Fallback Circle
      else {
          container.add(this.add.circle(0, -6, 20, skin.primaryColor));
          container.add(this.add.text(0, -6, '?', { fontSize: '20px' }).setOrigin(0.5));
      }

      // Total Level Badge
      const totalLevel = owned.upgrades.power + owned.upgrades.mass + owned.upgrades.aim + owned.upgrades.technique;
      const levelBg = this.add.graphics();
      levelBg.fillStyle(rarityColor, 0.2);
      levelBg.fillRoundedRect(-22, 18, 44, 14, 7);
      container.add(levelBg);

      container.add(this.add.text(0, 25, `PWR ${totalLevel}`, {
        fontSize: '9px',
        fontFamily: fonts.tech,
        color: hexToString(rarityColor),
      }).setOrigin(0.5));

      // Interactivity
      const hitArea = this.add.rectangle(0, 0, itemSize, itemSize, 0x000000, 0);
      hitArea.setInteractive({ useHandCursor: true });
      container.add(hitArea);

      hitArea.on('pointerover', () => {
        if (!isSelected) container.setScale(1.05);
      });
      hitArea.on('pointerout', () => {
        container.setScale(1);
      });
      hitArea.on('pointerdown', () => {
        if (this.selectedCapId !== owned.id) {
          AudioManager.getInstance().playSFX('sfx_click');
          this.scene.restart({ capId: owned.id });
        }
      });
      
      scrollContainer.add(container);
    });
  }

  // ==================== UPGRADE PANEL ====================

  private createUpgradePanel(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const fonts = getFonts();

    if (!this.selectedCapId) return;
    const ownedCap = playerData.getOwnedCap(this.selectedCapId);
    const skin = getCapSkin(this.selectedCapId);
    if (!ownedCap || !skin) return;

    const rarityColor = getRarityColor(skin.rarity);
    const panelY = 165;
    const panelHeight = height - panelY - 15;

    // --- Panel Background with Glow ---
    const panelGlow = this.add.graphics();
    panelGlow.lineStyle(8, rarityColor, 0.1);
    panelGlow.strokeRoundedRect(13, panelY - 2, width - 26, panelHeight + 4, 18);

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x14101e, 0.98);
    panelBg.fillRoundedRect(15, panelY, width - 30, panelHeight, 16);
    
    // Top gradient inside panel
    for (let i = 0; i < 60; i++) {
      panelBg.fillStyle(rarityColor, 0.1 * (1 - i / 60));
      panelBg.fillRect(15, panelY + i, width - 30, 1);
    }
    
    // Top accent pill
    panelBg.fillStyle(rarityColor, 0.7);
    panelBg.fillRoundedRect(width / 2 - 40, panelY + 1, 80, 3, 2);
    
    panelBg.lineStyle(2, rarityColor, 0.4);
    panelBg.strokeRoundedRect(15, panelY, width - 30, panelHeight, 16);

    // --- Cap Name and Info ---
    this.add.text(width / 2, panelY + 28, skin.name.toUpperCase(), {
      fontSize: '20px',
      fontFamily: fonts.tech,
      color: '#ffffff',
      letterSpacing: 1,
    }).setOrigin(0.5);

    // Badge: Role + Rarity
    const badgeBg = this.add.graphics();
    badgeBg.fillStyle(rarityColor, 0.15);
    badgeBg.fillRoundedRect(width / 2 - 80, panelY + 48, 160, 24, 12);
    badgeBg.lineStyle(1, rarityColor, 0.5);
    badgeBg.strokeRoundedRect(width / 2 - 80, panelY + 48, 160, 24, 12);

    this.add.text(width / 2, panelY + 60, `${getRoleIcon(skin.role)} ${getRoleName(skin.role)} • ${getRarityName(skin.rarity)}`, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: hexToString(rarityColor),
    }).setOrigin(0.5);

    // --- 4 Stats Upgrade Rows ---
    const stats: { key: keyof CapUpgrades; name: string; icon: string; color: number }[] = [
      { key: 'power', name: 'POWER', icon: '💥', color: 0xef4444 },
      { key: 'mass', name: 'MASS', icon: '🛡️', color: 0x3b82f6 },
      { key: 'aim', name: 'AIM', icon: '🎯', color: 0x10b981 },
      { key: 'technique', name: 'TECH', icon: '✨', color: 0xa855f7 },
    ];

    const startY = panelY + 90;
    const statHeight = 65; // Высота одной строки стата

    stats.forEach((stat, index) => {
      const y = startY + index * statHeight;
      const currentLevel = ownedCap.upgrades[stat.key];
      
      this.createStatRow(y, width, stat, currentLevel, rarityColor);
    });
  }

  private createStatRow(y: number, width: number, stat: any, level: number, rarityColor: number): void {
    const fonts = getFonts();
    const colors = getColors();

    // 1. Stat Card Background
    const statBg = this.add.graphics();
    statBg.fillStyle(stat.color, 0.05);
    statBg.fillRoundedRect(25, y, width - 50, 55, 10);
    statBg.lineStyle(1, stat.color, 0.2);
    statBg.strokeRoundedRect(25, y, width - 50, 55, 10);

    // Left accent strip
    statBg.fillStyle(stat.color, 0.6);
    statBg.fillRect(25, y + 10, 3, 35);

    // 2. Icon and Name
    this.add.text(40, y + 27, stat.icon, { fontSize: '20px' }).setOrigin(0, 0.5);
    this.add.text(68, y + 16, stat.name, {
      fontSize: '11px',
      fontFamily: fonts.tech,
      color: '#aaaaaa',
    }).setOrigin(0, 0.5);

    // 3. Progress Bar (Visual representation of level 1-10)
    const barX = 68;
    const barY = y + 36;
    const barW = width - 165; // width minus margins and button space
    const barH = 8;

    const barBg = this.add.graphics();
    // Track
    barBg.fillStyle(0x000000, 0.6);
    barBg.fillRoundedRect(barX, barY, barW, barH, 4);
    
    // Fill
    const progress = level / MAX_UPGRADE_LEVEL;
    if (progress > 0) {
      barBg.fillStyle(stat.color, 0.8);
      barBg.fillRoundedRect(barX, barY, Math.max(barW * progress, 8), barH, 4);
      
      // Shine on bar
      barBg.fillStyle(0xffffff, 0.2);
      barBg.fillRoundedRect(barX, barY, Math.max(barW * progress, 8), barH/2, 4);
    }
    
    // Level Text (e.g. 5/10)
    this.add.text(barX + barW + 8, barY + 4, `${level}/${MAX_UPGRADE_LEVEL}`, {
      fontSize: '9px',
      fontFamily: fonts.tech,
      color: '#888',
    }).setOrigin(0, 0.5);

    // 4. Upgrade Button (The [+] button)
    const btnX = width - 55;
    const btnY = y + 27;
    
    const isMax = level >= MAX_UPGRADE_LEVEL;
    const cost = getUpgradeCost(level);
    const canAfford = playerData.get().coins >= cost;

    if (isMax) {
      // Max Level Label
      const maxBg = this.add.graphics();
      maxBg.lineStyle(1, colors.uiGold, 0.5);
      maxBg.strokeRoundedRect(btnX - 25, btnY - 15, 50, 30, 6);
      this.add.text(btnX, btnY, 'MAX', { 
        fontSize: '10px', 
        fontFamily: fonts.tech, 
        color: hexToString(colors.uiGold) 
      }).setOrigin(0.5);
    } else {
      // Upgrade Button Container
      const btnContainer = this.add.container(btnX, btnY);
      
      const btnBg = this.add.graphics();
      const btnColor = canAfford ? colors.uiAccent : 0x444444;
      
      const drawBtn = (hover: boolean, pressed: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(btnColor, pressed ? 0.3 : (hover ? 0.2 : 0.1));
        btnBg.lineStyle(1.5, btnColor, hover ? 1 : 0.6);
        btnBg.strokeRoundedRect(-22, -20, 44, 40, 8);
        
        if (canAfford && hover) {
           btnBg.lineStyle(4, btnColor, 0.2);
           btnBg.strokeRoundedRect(-24, -22, 48, 44, 10);
        }
      };
      
      drawBtn(false, false);
      btnContainer.add(btnBg);

      // Plus Icon
      btnContainer.add(this.add.text(0, -8, '+', { 
        fontSize: '18px', 
        fontFamily: fonts.tech, 
        color: '#ffffff' 
      }).setOrigin(0.5));

      // Cost
      btnContainer.add(this.add.text(0, 8, `${cost}`, { 
        fontSize: '10px', 
        fontFamily: fonts.tech, 
        color: canAfford ? '#ffffff' : '#999999' 
      }).setOrigin(0.5));

      // Interactive Logic
      const hitArea = this.add.rectangle(0, 0, 44, 40, 0x000000, 0).setInteractive({ useHandCursor: true });
      btnContainer.add(hitArea);

      hitArea.on('pointerover', () => { drawBtn(true, false); btnContainer.setScale(1.05); });
      hitArea.on('pointerout', () => { drawBtn(false, false); btnContainer.setScale(1); });
      hitArea.on('pointerdown', () => { drawBtn(true, true); btnContainer.setScale(0.95); });
      
      hitArea.on('pointerup', () => {
        if (canAfford) {
            if (playerData.upgradeCap(this.selectedCapId!, stat.key)) {
                this.showUpgradeEffect(btnX, btnY, stat.color);
                // Refresh UI after short delay
                this.time.delayedCall(300, () => {
                   this.scene.restart({ capId: this.selectedCapId });
                });
            }
        } else {
            AudioManager.getInstance().playSFX('sfx_error');
            // Shake effect for no money
            this.tweens.add({
                targets: btnContainer,
                x: btnX + 5,
                duration: 50,
                yoyo: true,
                repeat: 3
            });
        }
      });
    }
  }

  // ==================== EFFECTS ====================

  private showUpgradeEffect(x: number, y: number, color: number): void {
    AudioManager.getInstance().playSFX('sfx_cash');
    
    // Burst particles
    for (let i = 0; i < 12; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.Between(30, 80);
      const p = this.add.circle(x, y, Phaser.Math.Between(3, 6), color, 1);
      
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Quad.out',
        onComplete: () => p.destroy()
      });
    }

    // Floating text
    const txt = this.add.text(x, y - 20, 'UPGRADED!', {
        fontSize: '14px',
        fontFamily: getFonts().tech,
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: hexToString(color),
        strokeThickness: 2
    }).setOrigin(0.5);

    this.tweens.add({
        targets: txt,
        y: y - 50,
        alpha: 0,
        duration: 800,
        ease: 'Back.out',
        onComplete: () => txt.destroy()
    });
  }
}