// src/scenes/MainMenuScene.ts

import Phaser from 'phaser';
import { getColors, hexToString } from '../config/themes';
import { playerData, getRankByLevel } from '../data/PlayerData';
import { i18n } from '../localization/i18n';
import { Icons } from '../ui/Icons';
import { AIDifficulty } from '../types';
import { AudioManager } from '../managers/AudioManager'; // [AUDIO]

interface ButtonStyle {
  bgTop: number;
  bgBottom: number;
  border: number;
  glow: number;
}

interface MenuButtonConfig {
  text: string;
  fontSize: number;
  style: ButtonStyle;
  iconDraw: (scene: Phaser.Scene, x: number, y: number, size: number, color: number) => Phaser.GameObjects.Graphics;
  onClick: () => void;
}

export class MainMenuScene extends Phaser.Scene {
  private modalContainer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private isTransitioning = false;
  private particles: Phaser.GameObjects.Graphics[] = [];

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    // [AUDIO] Инициализация звука
    const audio = AudioManager.getInstance();
    audio.init(this);
    
    // ФИКС: Останавливаем только шум стадиона, если вернулись из матча.
    // Музыка меню не прервется, если она уже играет (логика внутри playMusic).
    audio.stopAmbience(); 
    audio.playMusic('bgm_menu'); 

    this.resetState();
    this.createBackground();
    this.createLogo();
    this.createPlayerBadge();
    this.createCurrencyDisplay();
    this.createMainButtons();
    this.createFooter();
    this.startAmbientAnimations();
  }

  private resetState(): void {
    this.modalContainer = undefined;
    this.overlay = undefined;
    this.isTransitioning = false;
    this.particles = [];
  }

  // ==================== BACKGROUND ====================

  private createBackground(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    const bg = this.add.graphics();
    bg.fillStyle(0x08080f, 1);
    bg.fillRect(0, 0, width, height);

    // Радиальное свечение
    this.drawRadialGradient(bg, width / 2, height * 0.35, 400, colors.uiPrimary, 0.12);
    
    // Нижний градиент
    this.drawVerticalGradient(bg, 0, height - 150, width, 150, colors.uiAccent, 0.06, 'up');

    // Сетка
    this.drawGrid(60, 0x1a1a2a, 0.4);
    this.createParticles();
  }

  private drawRadialGradient(g: Phaser.GameObjects.Graphics, cx: number, cy: number, maxR: number, color: number, maxAlpha: number): void {
    for (let r = maxR; r > 0; r -= 2) {
      g.fillStyle(color, maxAlpha * (r / maxR) ** 2);
      g.fillCircle(cx, cy, r);
    }
  }

  private drawVerticalGradient(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number, maxAlpha: number, dir: 'up' | 'down'): void {
    for (let i = 0; i < h; i++) {
      const alpha = maxAlpha * (dir === 'up' ? (1 - i / h) ** 2 : (i / h) ** 2);
      g.fillStyle(color, alpha);
      g.fillRect(x, y + i, w, 1);
    }
  }

  private drawGrid(size: number, color: number, alpha: number): void {
    const { width, height } = this.cameras.main;
    const grid = this.add.graphics();
    grid.lineStyle(1, color, alpha);
    
    for (let x = 0; x <= width; x += size) grid.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += size) grid.lineBetween(0, y, width, y);
  }

  private createParticles(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const particleColors = [colors.uiAccent, colors.uiPrimary, 0x4a4a6a];

    for (let i = 0; i < 15; i++) {
      const particle = this.add.graphics();
      const color = Phaser.Math.RND.pick(particleColors);
      particle.fillStyle(color, Phaser.Math.FloatBetween(0.2, 0.5));
      particle.fillCircle(
        Phaser.Math.Between(30, width - 30),
        Phaser.Math.Between(120, height - 80),
        Phaser.Math.FloatBetween(1, 2.5)
      );
      this.particles.push(particle);
    }
  }

  private startAmbientAnimations(): void {
    this.particles.forEach((particle, i) => {
      this.tweens.add({
        targets: particle,
        alpha: particle.alpha * 0.3,
        y: `-=${Phaser.Math.Between(20, 50)}`,
        duration: Phaser.Math.Between(4000, 7000),
        yoyo: true,
        repeat: -1,
        delay: i * 200,
        ease: 'Sine.easeInOut',
      });
    });
  }

  // ==================== LOGO ====================

  private createLogo(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const logoY = 70;

    // Свечение
    const logoGlow = this.add.graphics();
    logoGlow.fillStyle(colors.uiPrimary, 0.08);
    logoGlow.fillEllipse(width / 2, logoY, 260, 70);
    
    this.tweens.add({
      targets: logoGlow,
      alpha: { from: 0.7, to: 1 },
      scaleX: { from: 0.96, to: 1.04 },
      scaleY: { from: 0.96, to: 1.04 },
      duration: 2500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Тень и текст
    this.createTextWithShadow(width / 2, logoY, 'MEMEBALL', '38px', 'Arial Black, Arial');

    // Подзаголовок
    const subtitleY = logoY + 32;
    this.createSubtitleDecorations(width / 2, subtitleY, colors.uiAccent);
    
    this.add.text(width / 2, subtitleY, 'A R E N A', {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: hexToString(colors.uiAccent),
      letterSpacing: 5,
    }).setOrigin(0.5);
  }

  private createTextWithShadow(x: number, y: number, text: string, fontSize: string, fontFamily: string): void {
    this.add.text(x + 2, y + 2, text, { fontSize, fontFamily, color: '#000000' })
      .setOrigin(0.5).setAlpha(0.4);
    this.add.text(x, y, text, { fontSize, fontFamily, color: '#ffffff' })
      .setOrigin(0.5);
  }

  private createSubtitleDecorations(cx: number, y: number, color: number): void {
    const lineWidth = 45;
    const gap = 75;
    
    const lines = this.add.graphics();
    lines.lineStyle(1.5, color, 0.5);
    lines.lineBetween(cx - gap - lineWidth, y, cx - gap, y);
    lines.lineBetween(cx + gap, y, cx + gap + lineWidth, y);
    
    lines.fillStyle(color, 0.7);
    lines.fillCircle(cx - gap - lineWidth - 4, y, 2);
    lines.fillCircle(cx + gap + lineWidth + 4, y, 2);
  }

  // ==================== PLAYER BADGE ====================

  private createPlayerBadge(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();
    const rank = getRankByLevel(data.level);

    const badgeY = 150;
    const badgeW = 200;
    const badgeH = 55;

    const container = this.add.container(width / 2, badgeY);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.3);
    bg.fillRoundedRect(-badgeW / 2 + 3, 3, badgeW, badgeH, 28);
    bg.fillStyle(0x0f0f18, 0.95);
    bg.fillRoundedRect(-badgeW / 2, 0, badgeW, badgeH, 28);
    bg.lineStyle(2, rank.color, 0.6);
    bg.strokeRoundedRect(-badgeW / 2, 0, badgeW, badgeH, 28);
    container.add(bg);

    // Аватар
    const avatarX = -badgeW / 2 + 32;
    const avatarY = badgeH / 2;
    
    const avatarRing = this.add.graphics();
    avatarRing.lineStyle(2, rank.color, 0.5);
    avatarRing.strokeCircle(avatarX, avatarY, 22);
    container.add(avatarRing);
    
    this.tweens.add({
      targets: avatarRing,
      alpha: { from: 0.5, to: 0.9 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
    });

    const avatarBg = this.add.graphics();
    avatarBg.fillStyle(0x1a1a2e, 1);
    avatarBg.fillCircle(avatarX, avatarY, 18);
    avatarBg.lineStyle(2, rank.color, 1);
    avatarBg.strokeCircle(avatarX, avatarY, 18);
    container.add(avatarBg);

    container.add(Icons.drawProfile(this, avatarX, avatarY, 14, 0xffffff));

    // Информация
    const infoX = avatarX + 35;
    container.add(this.add.text(infoX, avatarY - 8, data.username, {
      fontSize: '14px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
    }).setOrigin(0, 0.5));

    container.add(this.add.text(infoX, avatarY + 10, `Lv.${data.level} • ${rank.name}`, {
      fontSize: '10px',
      color: hexToString(rank.color),
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // Win rate
    const winRate = data.stats.gamesPlayed > 0 
      ? Math.round((data.stats.wins / data.stats.gamesPlayed) * 100) 
      : 0;
    
    container.add(this.add.text(badgeW / 2 - 35, avatarY, `${winRate}%`, {
      fontSize: '16px',
      color: hexToString(colors.uiAccent),
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Интерактивность
    const hitArea = this.add.rectangle(0, badgeH / 2, badgeW, badgeH, 0x000000, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => container.setScale(1.03))
      .on('pointerout', () => container.setScale(1))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
        this.scene.start('ProfileScene');
      });
    container.add(hitArea);
  }

  // ==================== CURRENCY ====================

  private createCurrencyDisplay(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    const data = playerData.get();

    const container = this.add.container(width - 15, 30).setDepth(50);

    const bg = this.add.graphics();
    bg.fillStyle(0x0a0a12, 0.8);
    bg.fillRoundedRect(-125, -22, 125, 50, 12);
    bg.lineStyle(1, colors.uiPrimary, 0.25);
    bg.strokeRoundedRect(-125, -22, 125, 50, 12);
    container.add(bg);

    // Coins
    container.add(Icons.drawCoin(this, -105, -6, 14));
    container.add(this.add.text(-85, -6, this.formatNumber(data.coins), {
      fontSize: '13px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // Stars
    container.add(Icons.drawStar(this, -105, 16, 8, 0xff69b4, true));
    container.add(this.add.text(-85, 16, this.formatNumber(data.stars), {
      fontSize: '13px',
      color: '#ff69b4',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5));

    // Plus button
    const plusBtn = this.createPlusButton(colors.uiAccent);
    plusBtn.setPosition(-15, 3);
    container.add(plusBtn);
  }

  private createPlusButton(color: number): Phaser.GameObjects.Container {
    const btn = this.add.container(0, 0);
    
    const bg = this.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillCircle(0, 0, 12);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeCircle(0, 0, 12);
    btn.add(bg);
    
    btn.add(this.add.text(0, -1, '+', {
      fontSize: '16px',
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5));
    
    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 12), Phaser.Geom.Circle.Contains)
      .on('pointerover', () => btn.setScale(1.15))
      .on('pointerout', () => btn.setScale(1))
      .on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_cash'); // [AUDIO] Звук монет
        playerData.addCoins(100);
        this.scene.restart();
      });
    
    return btn;
  }

  // ==================== MAIN BUTTONS ====================

  private createMainButtons(): void {
    const { width } = this.cameras.main;
    const colors = getColors();
    
    const startY = 235;
    const buttonW = width - 50;
    const gap = 62;

    const styles = {
      play: { bgTop: 0x00b894, bgBottom: 0x007a63, border: colors.uiAccent, glow: colors.uiAccent },
      primary: { bgTop: 0x6c5ce7, bgBottom: 0x4a3f9f, border: colors.uiPrimary, glow: colors.uiPrimary },
      secondary: { bgTop: 0x2d3436, bgBottom: 0x1a1d1e, border: 0x4a4a5a, glow: 0x4a4a5a },
    };

    const buttons: { y: number; h: number; config: MenuButtonConfig }[] = [
      { y: startY, h: 62, config: { text: i18n.t('play'), fontSize: 22, style: styles.play, iconDraw: Icons.drawPlay, onClick: () => this.showModeSelection() }},
      { y: startY + gap, h: 56, config: { text: i18n.t('shop'), fontSize: 17, style: styles.primary, iconDraw: Icons.drawShop, onClick: () => this.scene.start('ShopScene') }},
      { y: startY + gap * 2, h: 56, config: { text: i18n.t('tactics'), fontSize: 17, style: styles.primary, iconDraw: Icons.drawTactics, onClick: () => this.scene.start('TacticsScene') }},
      { y: startY + gap * 3, h: 56, config: { text: i18n.t('settings'), fontSize: 17, style: styles.secondary, iconDraw: Icons.drawSettings, onClick: () => this.scene.start('SettingsScene') }},
    ];

    buttons.forEach(({ y, h, config }) => this.createMenuButton(width / 2, y, buttonW, h, config));
  }

  private createMenuButton(x: number, y: number, w: number, h: number, config: MenuButtonConfig): void {
    const container = this.add.container(x, y).setDepth(100);
    let isHovered = false;
    let isPressed = false;

    const redraw = () => {
      container.removeAll(true);
      const yOff = isPressed ? 2 : 0;

      // Тень
      if (!isPressed) {
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.35);
        shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, 14);
        container.add(shadow);
      }

      // Фон
      const bg = this.add.graphics();
      bg.fillStyle(config.style.bgBottom, 1);
      bg.fillRoundedRect(-w / 2, -h / 2 + yOff, w, h, 14);
      
      if (!isPressed) {
        bg.fillStyle(config.style.bgTop, 1);
        bg.fillRoundedRect(-w / 2, -h / 2 + yOff, w, h * 0.55, { tl: 14, tr: 14, bl: 0, br: 0 });
        bg.fillStyle(0xffffff, 0.12);
        bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 4 + yOff, w - 8, h * 0.3, { tl: 12, tr: 12, bl: 0, br: 0 });
      }
      
      bg.lineStyle(2, config.style.border, isHovered ? 0.9 : 0.6);
      bg.strokeRoundedRect(-w / 2, -h / 2 + yOff, w, h, 14);
      container.add(bg);

      // Glow при hover
      if (isHovered && !isPressed) {
        const glow = this.add.graphics();
        for (let i = 3; i >= 1; i--) {
          glow.lineStyle(6 / i, config.style.glow, 0.08 * i);
          glow.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2 + yOff, w + 4, h + 4, 16);
        }
        container.addAt(glow, 0);
      }

      // Иконка и текст
      container.add(config.iconDraw(this, -w / 2 + 38, yOff, 16, 0xffffff));
      
      const label = this.add.text(5, yOff, config.text, {
        fontSize: `${config.fontSize}px`,
        fontFamily: 'Arial Black, Arial',
        color: '#ffffff',
      }).setOrigin(0.5);
      label.setShadow(1, 2, '#000000', 2, true, true);
      container.add(label);
    };

    redraw();

    container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains)
      .on('pointerover', () => { isHovered = true; redraw(); this.tweens.add({ targets: container, scaleX: 1.02, scaleY: 1.02, duration: 100 }); })
      .on('pointerout', () => { isHovered = false; isPressed = false; redraw(); this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 100 }); })
      .on('pointerdown', () => { isPressed = true; redraw(); container.setScale(0.98); })
      .on('pointerup', () => { 
        AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO] Клик
        isPressed = false; 
        redraw(); 
        container.setScale(1.02); 
        config.onClick(); 
      });
  }

  // ==================== FOOTER ====================

  private createFooter(): void {
    const { width, height } = this.cameras.main;
    const colors = getColors();

    this.add.text(15, height - 18, 'v0.5.0', { fontSize: '10px', color: '#333344' });

    const line = this.add.graphics();
    line.lineStyle(1, colors.uiPrimary, 0.1);
    line.lineBetween(25, height - 40, width - 25, height - 40);
    line.fillStyle(colors.uiPrimary, 0.3);
    line.fillCircle(25, height - 40, 2);
    line.fillCircle(width - 25, height - 40, 2);
  }

  // ==================== MODALS ====================

  private showModeSelection(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish'); // [AUDIO]

    const { width, height } = this.cameras.main;
    const colors = getColors();

    this.createOverlay();
    this.modalContainer = this.createModalContainer(290, 380);

    // Заголовок
    this.modalContainer.add(this.add.text(0, -160, i18n.t('selectMode'), {
      fontSize: '20px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5));

    // Кнопки режимов
    const modes = [
      { title: i18n.t('vsAI'), desc: i18n.t('vsAIDesc'), icon: Icons.drawRobot, color: colors.uiAccent, onClick: () => this.showDifficultySelection() },
      { title: i18n.t('pvp'), desc: i18n.t('pvpDesc'), icon: Icons.drawPlayers, color: colors.uiPrimary, onClick: () => this.closeModal(() => this.scene.start('GameScene', { vsAI: false })) },
      { title: i18n.t('quickPlay'), desc: i18n.t('quickPlayDesc'), icon: Icons.drawLightning, color: 0xf59e0b, onClick: () => this.closeModal(() => this.scene.start('GameScene', { vsAI: true, difficulty: 'medium' })) },
    ];

    modes.forEach((mode, i) => this.createModeButton(0, -55 + i * 82, 250, 72, mode));

    this.animateModalIn();
  }

  private showDifficultySelection(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playSFX('sfx_swish'); // [AUDIO]

    this.tweens.add({
      targets: this.modalContainer,
      scale: 0.9,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.modalContainer?.destroy();
        this.createDifficultyModal();
      },
    });
  }

  private createDifficultyModal(): void {
    const colors = getColors();
    this.modalContainer = this.createModalContainer(290, 340);

    // Кнопка назад
    const backBtn = this.add.container(-115, -140);
    backBtn.add(Icons.drawBack(this, 0, 0, 10, colors.uiAccent));
    const backHit = this.add.circle(0, 0, 18, 0x000000, 0).setInteractive({ useHandCursor: true });
    backHit.on('pointerdown', (p: Phaser.Input.Pointer) => { 
      p.event.stopPropagation(); 
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      this.backToModeSelection(); 
    });
    backBtn.add(backHit);
    this.modalContainer.add(backBtn);

    // Заголовок
    this.modalContainer.add(this.add.text(15, -140, i18n.t('selectDifficulty'), {
      fontSize: '18px',
      fontFamily: 'Arial Black',
      color: '#ffffff',
    }).setOrigin(0.5));

    // Кнопки сложности
    const difficulties: { id: AIDifficulty; name: string; desc: string; color: number; icon: typeof Icons.drawStar }[] = [
      { id: 'easy', name: i18n.t('easy'), desc: i18n.t('easyDesc'), color: 0x4ade80, icon: Icons.drawStar },
      { id: 'medium', name: i18n.t('medium'), desc: i18n.t('mediumDesc'), color: 0xfbbf24, icon: Icons.drawFire },
      { id: 'hard', name: i18n.t('hard'), desc: i18n.t('hardDesc'), color: 0xef4444, icon: Icons.drawLightning },
    ];

    difficulties.forEach((diff, i) => {
      this.createDifficultyButton(0, -40 + i * 80, 250, 68, diff);
    });

    this.animateModalIn();
  }

  private createOverlay(): void {
    const { width, height } = this.cameras.main;
    this.overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0).setDepth(199).setInteractive();
    this.overlay.on('pointerdown', () => this.closeModal());
    this.tweens.add({ targets: this.overlay, alpha: 0.8, duration: 200 });
  }

  private createModalContainer(w: number, h: number): Phaser.GameObjects.Container {
    const { width, height } = this.cameras.main;
    const colors = getColors();
    const container = this.add.container(width / 2, height / 2).setDepth(200);

    // Тень
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.4);
    shadow.fillRoundedRect(-w / 2 + 5, -h / 2 + 7, w, h, 18);
    container.add(shadow);

    // Фон
    const bg = this.add.graphics();
    bg.fillStyle(0x0f0f18, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.fillStyle(0x1a1a28, 0.5);
    bg.fillRoundedRect(-w / 2, -h / 2, w, 50, { tl: 18, tr: 18, bl: 0, br: 0 });
    bg.lineStyle(2, colors.uiAccent, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.fillStyle(colors.uiAccent, 0.7);
    bg.fillRoundedRect(-50, -h / 2 + 1, 100, 3, 2);
    container.add(bg);

    return container;
  }

  private animateModalIn(): void {
    this.modalContainer?.setScale(0.85).setAlpha(0);
    this.tweens.add({
      targets: this.modalContainer,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => { this.isTransitioning = false; },
    });
  }

  private createModeButton(x: number, y: number, w: number, h: number, config: {
    title: string; desc: string; color: number;
    icon: (scene: Phaser.Scene, x: number, y: number, size: number, color: number) => Phaser.GameObjects.Graphics;
    onClick: () => void;
  }): void {
    const container = this.add.container(x, y);
    this.modalContainer!.add(container);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      if (!hover) {
        bg.fillStyle(0x000000, 0.2);
        bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 12);
      }
      bg.fillStyle(config.color, hover ? 0.18 : 0.08);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(1.5, config.color, hover ? 0.8 : 0.4);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawBg(false);
    container.add(bg);

    container.add(config.icon(this, -w / 2 + 38, 0, 20, config.color));
    container.add(this.add.text(-w / 2 + 68, -10, config.title, {
      fontSize: '17px', fontFamily: 'Arial Black', color: hexToString(config.color),
    }).setOrigin(0, 0.5));
    container.add(this.add.text(-w / 2 + 68, 12, config.desc, {
      fontSize: '11px', color: '#777788',
    }).setOrigin(0, 0.5));
    container.add(this.add.text(w / 2 - 22, 0, '›', {
      fontSize: '26px', color: hexToString(config.color),
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => { drawBg(true); container.setScale(1.015); });
    hitArea.on('pointerout', () => { drawBg(false); container.setScale(1); });
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (!this.isTransitioning) {
        AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
        config.onClick();
      }
    });
  }

  private createDifficultyButton(x: number, y: number, w: number, h: number, diff: {
    id: AIDifficulty; name: string; desc: string; color: number;
    icon: (scene: Phaser.Scene, x: number, y: number, size: number, color: number) => Phaser.GameObjects.Graphics;
  }): void {
    const container = this.add.container(x, y);
    this.modalContainer!.add(container);

    const bg = this.add.graphics();
    const drawBg = (hover: boolean) => {
      bg.clear();
      if (!hover) {
        bg.fillStyle(0x000000, 0.2);
        bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, 12);
      }
      bg.fillStyle(diff.color, hover ? 0.2 : 0.1);
      bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
      bg.lineStyle(1.5, diff.color, hover ? 0.9 : 0.5);
      bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    };
    drawBg(false);
    container.add(bg);

    const iconSize = diff.id === 'hard' ? 18 : diff.id === 'medium' ? 16 : 14;
    container.add(diff.icon(this, -w / 2 + 35, 0, iconSize, diff.color));

    container.add(this.add.text(-w / 2 + 62, -8, diff.name, {
      fontSize: '16px', fontFamily: 'Arial Black', color: hexToString(diff.color),
    }).setOrigin(0, 0.5));
    container.add(this.add.text(-w / 2 + 62, 12, diff.desc, {
      fontSize: '10px', color: '#777788',
    }).setOrigin(0, 0.5));
    container.add(this.add.text(w / 2 - 22, 0, '›', {
      fontSize: '24px', color: hexToString(diff.color),
    }).setOrigin(0.5));

    const hitArea = this.add.rectangle(0, 0, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerover', () => { drawBg(true); container.setScale(1.015); });
    hitArea.on('pointerout', () => { drawBg(false); container.setScale(1); });
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      if (!this.isTransitioning) {
        AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
        this.closeModal(() => this.scene.start('GameScene', { vsAI: true, difficulty: diff.id }));
      }
    });
  }

  private backToModeSelection(): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    this.tweens.add({
      targets: this.modalContainer,
      scale: 0.9,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.modalContainer?.destroy();
        this.modalContainer = undefined;
        this.isTransitioning = false;
        this.showModeSelection();
      },
    });
  }

  private closeModal(callback?: () => void): void {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    const cleanup = () => {
      this.modalContainer?.destroy();
      this.modalContainer = undefined;
      this.overlay?.destroy();
      this.overlay = undefined;
      this.isTransitioning = false;
      callback?.();
    };

    if (this.modalContainer) {
      AudioManager.getInstance().playSFX('sfx_click'); // [AUDIO]
      this.tweens.add({ targets: this.modalContainer, scale: 0.9, alpha: 0, duration: 150 });
    }

    if (this.overlay) {
      this.tweens.add({ targets: this.overlay, alpha: 0, duration: 150, onComplete: cleanup });
    } else {
      cleanup();
    }
  }

  private formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  }
}