// src/ui/game/MatchIntroOverlay.ts

import Phaser from 'phaser';
import { FactionId, FACTIONS } from '../../constants/gameConstants';
import { AnnouncerManager } from '../../managers/AnnouncerManager';
import { HapticManager } from '../../scenes/game/HapticManager';

/**
 * Конфигурация карточки игрока
 */
interface PlayerCardConfig {
  factionId: FactionId;
  playerName?: string;
  isLeft: boolean;
  avatarId?: string;
}

/**
 * MatchIntroOverlay — Анимированная VS Screen перед началом матча
 * 
 * Карточки переворачиваются синхронно с голосом комментатора:
 * - Карточка игрока 1 открывается когда комментатор называет его фракцию
 * - Карточка игрока 2 открывается когда комментатор называет его фракцию
 */
export class MatchIntroOverlay extends Phaser.GameObjects.Container {
  private overlay: Phaser.GameObjects.Rectangle;
  private player1Card!: Phaser.GameObjects.Container;
  private player2Card!: Phaser.GameObjects.Container;
  private player1CardBack!: Phaser.GameObjects.Container;
  private player2CardBack!: Phaser.GameObjects.Container;
  private vsText!: Phaser.GameObjects.Text;
  private vsGlow!: Phaser.GameObjects.Graphics;
  
  private announcer: AnnouncerManager;
  private onCompleteCallback?: () => void;
  private isAnimating = false;

  // Флаги для отслеживания состояния карточек
  private card1Flipped = false;
  private card2Flipped = false;

  // Адаптивные размеры (рассчитываются в конструкторе)
  private CARD_WIDTH = 120;
  private CARD_HEIGHT = 180;
  private CARD_GAP = 60;
  private VS_SIZE = 50;
  
  constructor(
    scene: Phaser.Scene,
    private faction1: FactionId,
    private faction2: FactionId,
    private player1Name: string = 'Player 1',
    private player2Name: string = 'Player 2',
    private player1AvatarId?: string,
    private player2AvatarId?: string
  ) {
    super(scene, 0, 0);
    
    console.log('[MatchIntroOverlay] Constructor:', {
      faction1,
      faction2,
      player1Name,
      player2Name,
      player1AvatarId,
      player2AvatarId,
      avatar1Exists: player1AvatarId ? scene.textures.exists(player1AvatarId) : false,
      avatar2Exists: player2AvatarId ? scene.textures.exists(player2AvatarId) : false,
    });
    
    this.announcer = AnnouncerManager.getInstance();
    this.announcer.init(scene);
    
    const { width, height } = scene.cameras.main;
    this.setSize(width, height);
    this.setDepth(1000);
    
    this.calculateDimensions();
    
    // Тёмный оверлей
    this.overlay = scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0
    );
    this.add(this.overlay);
    
    this.createPlayerCards();
    this.createVSElement();
    
    scene.add.existing(this);
    this.setVisible(false);
  }

  /**
   * Рассчитывает размеры карточек и элементов под экран
   */
  private calculateDimensions(): void {
    const { width, height } = this.scene.cameras.main;
    
    const horizontalPadding = 20;
    const verticalPadding = 80;
    
    this.CARD_GAP = Math.min(80, width * 0.1);
    this.VS_SIZE = Math.min(60, width * 0.08);
    
    const maxTotalWidth = width - horizontalPadding * 2;
    const availableForCards = maxTotalWidth - this.CARD_GAP;
    this.CARD_WIDTH = Math.floor(availableForCards / 2);
    
    this.CARD_WIDTH = Math.min(this.CARD_WIDTH, 180);
    this.CARD_WIDTH = Math.max(this.CARD_WIDTH, 100);
    
    const maxHeight = height - verticalPadding * 2;
    this.CARD_HEIGHT = Math.min(this.CARD_WIDTH * 1.5, maxHeight);
    
    if (this.CARD_HEIGHT < this.CARD_WIDTH * 1.5) {
      this.CARD_WIDTH = Math.floor(this.CARD_HEIGHT / 1.5);
    }
    
    console.log(`[MatchIntro] Screen: ${width}x${height}, Card: ${this.CARD_WIDTH}x${this.CARD_HEIGHT}, Gap: ${this.CARD_GAP}`);
  }

  /**
   * Создаёт карточки игроков (лицо и рубашка)
   */
  private createPlayerCards(): void {
    const { width, height } = this.scene.cameras.main;
    const centerY = height / 2;

    // === Игрок 1 (слева) ===
    this.player1CardBack = this.createCardBack({
      factionId: this.faction1,
      isLeft: true,
      avatarId: this.player1AvatarId,
      playerName: this.player1Name, // ✅ FIX: Передаем имя игрока
    });
    this.player1CardBack.setPosition(-this.CARD_WIDTH, centerY);
    this.add(this.player1CardBack);

    this.player1Card = this.createCard({
      factionId: this.faction1,
      isLeft: true,
      avatarId: this.player1AvatarId,
      playerName: this.player1Name, // ✅ FIX: Передаем имя игрока
    });
    this.player1Card.setPosition(-this.CARD_WIDTH, centerY);
    this.player1Card.setScale(0, 1);
    this.add(this.player1Card);

    // === Игрок 2 (справа) ===
    this.player2CardBack = this.createCardBack({
      factionId: this.faction2,
      isLeft: false,
      avatarId: this.player2AvatarId,
      playerName: this.player2Name, // ✅ FIX: Передаем имя игрока
    });
    this.player2CardBack.setPosition(width + this.CARD_WIDTH, centerY);
    this.add(this.player2CardBack);

    this.player2Card = this.createCard({
      factionId: this.faction2,
      isLeft: false,
      avatarId: this.player2AvatarId,
      playerName: this.player2Name, // ✅ FIX: Передаем имя игрока
    });
    this.player2Card.setPosition(width + this.CARD_WIDTH, centerY);
    this.player2Card.setScale(0, 1);
    this.add(this.player2Card);
  }

  /**
   * Создаёт рубашку карточки с аватаркой игрока
   */
  private createCardBack(config: { factionId: FactionId; isLeft: boolean; avatarId?: string; playerName?: string }): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const faction = FACTIONS[config.factionId];
    
    const w = this.CARD_WIDTH;
    const h = this.CARD_HEIGHT;

    const bgGraphics = this.scene.add.graphics();
    
    bgGraphics.fillStyle(0x1a1a2e, 0.98);
    bgGraphics.fillRoundedRect(-w/2, -h/2, w, h, 12);
    
    const borderColor = config.isLeft ? 0x3498db : 0xe74c3c;
    bgGraphics.lineStyle(3, borderColor, 1);
    bgGraphics.strokeRoundedRect(-w/2, -h/2, w, h, 12);
    
    bgGraphics.lineStyle(1, faction.color, 0.4);
    bgGraphics.strokeRoundedRect(-w/2 + 8, -h/2 + 8, w - 16, h - 16, 8);
    
    // Декоративный паттерн
    bgGraphics.lineStyle(1, faction.color, 0.1);
    for (let i = -h; i < w + h; i += 15) {
      bgGraphics.beginPath();
      bgGraphics.moveTo(-w/2 + i, -h/2);
      bgGraphics.lineTo(-w/2 + i - h, h/2);
      bgGraphics.strokePath();
    }
    
    container.add(bgGraphics);

    // ✅ АВАТАРКА ИГРОКА (вместо иконки фракции)
    const avatarSize = Math.min(w, h) * 0.5;
    const avatarId = config.avatarId || 'avatar_recruit';
    
    // Круглая рамка для аватарки
    const avatarBorder = this.scene.add.circle(0, 0, avatarSize/2 + 3);
    avatarBorder.setStrokeStyle(4, borderColor, 1);
    container.add(avatarBorder);

    // Фон под аватарку
    const avatarBg = this.scene.add.circle(0, 0, avatarSize/2, 0x000000, 0.9);
    container.add(avatarBg);

    // PNG аватарка
    if (this.scene.textures.exists(avatarId)) {
      const avatarImg = this.scene.add.image(0, 0, avatarId);
      avatarImg.setDisplaySize(avatarSize, avatarSize);
      
      // ✅ FIX: Не используем маски - они блокируют рендеринг всей сцены
      // Круглая форма визуально обеспечивается круглой рамкой и фоном
      
      container.add(avatarImg);
    } else {
      // Fallback эмодзи
      const emoji = this.scene.add.text(0, 0, config.isLeft ? '👤' : '🤖', {
        fontSize: `${avatarSize * 0.7}px`,
      }).setOrigin(0.5);
      container.add(emoji);
    }

    // Вопросительный знак
    const qSize = Math.max(16, Math.min(24, w * 0.15));
    const questionMark = this.scene.add.text(0, -h/2 + qSize + 8, '?', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: `${qSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    questionMark.setAlpha(0.7);
    container.add(questionMark);

    this.addTechCorners(container, w, h, borderColor);

    return container;
  }

  /**
   * Создаёт лицевую сторону карточки
   */
  private createCard(config: PlayerCardConfig): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const faction = FACTIONS[config.factionId];
    
    const w = this.CARD_WIDTH;
    const h = this.CARD_HEIGHT;

    const bgGraphics = this.scene.add.graphics();
    
    bgGraphics.fillStyle(0x111111, 0.95);
    bgGraphics.fillRoundedRect(-w/2, -h/2, w, h, 12);
    
    const borderColor = config.isLeft ? 0x3498db : 0xe74c3c;
    bgGraphics.lineStyle(3, borderColor, 1);
    bgGraphics.strokeRoundedRect(-w/2, -h/2, w, h, 12);
    
    bgGraphics.lineStyle(1, faction.color, 0.6);
    bgGraphics.strokeRoundedRect(-w/2 + 6, -h/2 + 6, w - 12, h - 12, 8);
    
    container.add(bgGraphics);

    const textAreaHeight = Math.min(60, h * 0.25);
    const artAreaHeight = h - textAreaHeight - 20;

    // ✅ АВАТАРКА ИГРОКА (вверху)
    const avatarSize = Math.min(w * 0.35, 60);
    const avatarY = -h/2 + avatarSize/2 + 15;
    
    // Используем переданную аватарку или дефолтную
    const avatarId = config.avatarId || 'avatar_recruit';

    // Круглая рамка для аватарки
    const avatarBorder = this.scene.add.circle(0, avatarY, avatarSize/2);
    avatarBorder.setStrokeStyle(3, borderColor, 1);
    container.add(avatarBorder);

    // Фон под аватарку
    const avatarBg = this.scene.add.circle(0, avatarY, avatarSize/2, 0x000000, 0.7);
    container.add(avatarBg);

    // PNG аватарка
    if (this.scene.textures.exists(avatarId)) {
      const avatarImg = this.scene.add.image(0, avatarY, avatarId);
      avatarImg.setDisplaySize(avatarSize * 0.9, avatarSize * 0.9);
      
      // ✅ FIX: Не используем маски - они могут блокировать рендеринг всей сцены
      // Круглая форма обеспечивается круглой рамкой и фоном
      
      container.add(avatarImg);
    } else {
      const emoji = this.scene.add.text(0, avatarY, config.isLeft ? '👤' : '🤖', {
        fontSize: `${avatarSize * 0.6}px`,
      }).setOrigin(0.5);
      container.add(emoji);
    }

    // Фракционный арт или символ (ниже аватарки)
    const artKey = `art_${config.factionId}`;
    const hasArt = this.scene.textures.exists(artKey);
    const artY = avatarY + avatarSize/2 + 15;
    
    if (hasArt) {
      const art = this.scene.add.image(0, artY, artKey);
      const availableArtHeight = h/2 - textAreaHeight - artY - 10;
      const scale = Math.min((w - 20) / art.width, availableArtHeight / art.height);
      art.setScale(scale);
      art.setOrigin(0.5, 0);
      container.add(art);
    } else {
      const symbol = this.getFactionSymbol(config.factionId);
      const symbolSize = Math.min(w * 0.4, (h/2 - textAreaHeight - artY - 10) * 0.8);
      const symbolText = this.scene.add.text(0, artY + 20, symbol, {
        fontSize: `${symbolSize}px`,
      }).setOrigin(0.5);
      container.add(symbolText);
    }

    const stripeHeight = textAreaHeight;
    const stripe = this.scene.add.graphics();
    stripe.fillStyle(faction.color, 0.9);
    stripe.fillRoundedRect(-w/2 + 3, h/2 - stripeHeight - 3, w - 6, stripeHeight, { bl: 9, br: 9, tl: 0, tr: 0 });
    container.add(stripe);

    const nameFontSize = Math.max(10, Math.min(16, w * 0.1));
    const factionFontSize = Math.max(8, Math.min(12, w * 0.07));

    // ✅ FIX: Защита от undefined playerName
    const playerName = config.playerName || 'Player';
    const displayName = playerName.length > 12 
      ? playerName.substring(0, 11) + '…' 
      : playerName;
    
    const nameText = this.scene.add.text(0, h/2 - stripeHeight/2 - 8, displayName.toUpperCase(), {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: `${nameFontSize}px`,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(nameText);

    const factionText = this.scene.add.text(0, h/2 - stripeHeight/2 + nameFontSize - 4, faction.name.toUpperCase(), {
      fontFamily: 'Arial, sans-serif',
      fontSize: `${factionFontSize}px`,
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
    container.add(factionText);

    this.addTechCorners(container, w, h, borderColor);

    return container;
  }

  /**
   * Добавляет технологичные углы
   */
  private addTechCorners(
    container: Phaser.GameObjects.Container,
    w: number,
    h: number,
    color: number
  ): void {
    const graphics = this.scene.add.graphics();
    const cornerSize = Math.min(15, w * 0.1);
    const offset = 3;
    
    graphics.lineStyle(2, color, 1);
    
    graphics.beginPath();
    graphics.moveTo(-w/2 + offset, -h/2 + offset + cornerSize);
    graphics.lineTo(-w/2 + offset, -h/2 + offset);
    graphics.lineTo(-w/2 + offset + cornerSize, -h/2 + offset);
    graphics.strokePath();
    
    graphics.beginPath();
    graphics.moveTo(w/2 - offset - cornerSize, -h/2 + offset);
    graphics.lineTo(w/2 - offset, -h/2 + offset);
    graphics.lineTo(w/2 - offset, -h/2 + offset + cornerSize);
    graphics.strokePath();
    
    graphics.beginPath();
    graphics.moveTo(-w/2 + offset, h/2 - offset - cornerSize);
    graphics.lineTo(-w/2 + offset, h/2 - offset);
    graphics.lineTo(-w/2 + offset + cornerSize, h/2 - offset);
    graphics.strokePath();
    
    graphics.beginPath();
    graphics.moveTo(w/2 - offset - cornerSize, h/2 - offset);
    graphics.lineTo(w/2 - offset, h/2 - offset);
    graphics.lineTo(w/2 - offset, h/2 - offset - cornerSize);
    graphics.strokePath();
    
    container.add(graphics);
  }

  /**
   * Создаёт элемент VS
   */
  private createVSElement(): void {
    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    this.vsGlow = this.scene.add.graphics();
    this.vsGlow.setPosition(centerX, centerY);
    this.vsGlow.setAlpha(0);
    this.add(this.vsGlow);

    this.vsText = this.scene.add.text(centerX, centerY, 'VS', {
      fontFamily: 'Arial Black, Impact, sans-serif',
      fontSize: `${this.VS_SIZE}px`,
      color: '#ffcc00',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000000',
        blur: 8,
        fill: true,
      },
    }).setOrigin(0.5);
    this.vsText.setScale(0);
    this.vsText.setAlpha(0);
    this.add(this.vsText);
  }

  /**
   * Запускает анимацию интро
   * 
   * Последовательность:
   * 1. Затемнение
   * 2. Карточки влетают РУБАШКОЙ вверх
   * 3. Комментатор: "Welcome to the Arena!"
   * 4. Комментатор называет Faction1 → Карточка 1 ПЕРЕВОРАЧИВАЕТСЯ
   * 5. Комментатор: "VS"
   * 6. Комментатор называет Faction2 → Карточка 2 ПЕРЕВОРАЧИВАЕТСЯ
   * 7. "FIGHT!" + VS появляется
   * 8. Карточки разлетаются
   */
  public async play(onComplete?: () => void): Promise<void> {
    if (this.isAnimating) {
      console.warn('[MatchIntroOverlay] Already animating, ignoring play() call');
      return;
    }
    
    console.log('[MatchIntroOverlay] Starting intro animation');
    this.isAnimating = true;
    this.onCompleteCallback = onComplete;
    this.setVisible(true);
    
    // Сбрасываем флаги
    this.card1Flipped = false;
    this.card2Flipped = false;

    const { width, height } = this.scene.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    const card1X = centerX - this.CARD_GAP/2 - this.CARD_WIDTH/2;
    const card2X = centerX + this.CARD_GAP/2 + this.CARD_WIDTH/2;

    // === ФАЗА 1: Затемнение ===
    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0.85,
      duration: 100,
      ease: 'Power2',
    });

    // === ФАЗА 2: Карточки (РУБАШКИ) влетают ===
    await this.delay(100);
    
    this.playSFXSafe('sfx_whoosh', 0.6);

    // Обе карточки влетают рубашкой вверх
    this.scene.tweens.add({
      targets: this.player1CardBack,
      x: card1X,
      duration: 350,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.player1Card,
      x: card1X,
      duration: 350,
      ease: 'Back.easeOut',
    });

    this.scene.tweens.add({
      targets: this.player2CardBack,
      x: card2X,
      duration: 350,
      ease: 'Back.easeOut',
    });
    this.scene.tweens.add({
      targets: this.player2Card,
      x: card2X,
      duration: 350,
      ease: 'Back.easeOut',
    });

    // Ждём пока карточки прилетят
    await this.delay(400);

    // === ФАЗА 3: Комментатор с синхронными переворотами ===
    // Карточки переворачиваются КОГДА комментатор называет фракцию
    
    await this.announcer.announceMatchStart(
      this.faction1,
      this.faction2,
      {
        onWelcome: () => {
          // Пульсация рубашек при "Welcome!"
          this.pulseCard(this.player1CardBack);
          this.pulseCard(this.player2CardBack);
        },
        
        onFaction1: () => {
          // Комментатор называет Faction 1 → ПЕРЕВОРАЧИВАЕМ карточку 1
          if (!this.card1Flipped) {
            this.card1Flipped = true;
            this.flipCardAnimated(this.player1CardBack, this.player1Card);
          }
        },
        
        onVS: () => {
          // При "VS" показываем текст VS
          this.showVS();
        },
        
        onFaction2: () => {
          // Комментатор называет Faction 2 → ПЕРЕВОРАЧИВАЕМ карточку 2
          if (!this.card2Flipped) {
            this.card2Flipped = true;
            this.flipCardAnimated(this.player2CardBack, this.player2Card);
          }
        },
        
        onFight: () => {
          // "FIGHT!" - финальный эффект
          this.flashScreen(0.4);
          HapticManager.trigger('medium');
          
          // Пульсация обеих открытых карточек
          this.pulseCard(this.player1Card);
          this.pulseCard(this.player2Card);
        },
      }
    );

    // === ФАЗА 4: Карточки разлетаются ===
    await this.delay(300);
    
    this.playSFXSafe('sfx_whoosh', 0.4);

    this.scene.tweens.add({
      targets: [this.player1Card, this.player1CardBack],
      x: -this.CARD_WIDTH * 2,
      duration: 250,
      ease: 'Power3',
    });

    this.scene.tweens.add({
      targets: [this.player2Card, this.player2CardBack],
      x: width + this.CARD_WIDTH * 2,
      duration: 250,
      ease: 'Power3',
    });

    this.scene.tweens.add({
      targets: [this.vsText, this.vsGlow],
      alpha: 0,
      scale: 1.5,
      duration: 250,
      ease: 'Power2',
    });

    this.scene.tweens.add({
      targets: this.overlay,
      fillAlpha: 0,
      duration: 250,
      ease: 'Power2',
      onComplete: () => {
        console.log('[MatchIntroOverlay] Animation complete, calling callback');
        this.isAnimating = false;
        this.setVisible(false);
        
        // ✅ КРИТИЧНО: Вызываем callback в следующем фрейме, чтобы избежать конфликтов
        if (this.onCompleteCallback) {
          this.scene.time.delayedCall(50, () => {
            console.log('[MatchIntroOverlay] Executing onComplete callback');
            this.onCompleteCallback?.();
          });
        } else {
          console.warn('[MatchIntroOverlay] No callback provided!');
        }
      },
    });
  }

  /**
   * Анимация переворота карточки (вызывается при назывании фракции)
   */
  private flipCardAnimated(
    cardBack: Phaser.GameObjects.Container, 
    cardFront: Phaser.GameObjects.Container
  ): void {
    const flipDuration = 250;
    
    this.playSFXSafe('sfx_swish', 0.5);
    HapticManager.trigger('light');
    
    // Фаза 1: Сжимаем рубашку
    this.scene.tweens.add({
      targets: cardBack,
      scaleX: 0,
      duration: flipDuration,
      ease: 'Power2.easeIn',
      onComplete: () => {
        cardBack.setVisible(false);
      },
    });
    
    // Фаза 2: Разжимаем лицо
    this.scene.time.delayedCall(flipDuration * 0.7, () => {
      this.scene.tweens.add({
        targets: cardFront,
        scaleX: 1,
        duration: flipDuration,
        ease: 'Power2.easeOut',
        onComplete: () => {
          // Подсветка карточки после переворота
          this.highlightCard(cardFront);
        },
      });
    });
  }

  /**
   * Показывает VS с анимацией
   */
  private showVS(): void {
    this.playSFXSafe('sfx_impact_heavy', 0.6);
    
    this.scene.cameras.main.shake(100, 0.006);
    HapticManager.trigger('light');

    this.drawVSGlow();
    
    this.scene.tweens.add({
      targets: this.vsGlow,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 200,
    });

    this.scene.tweens.add({
      targets: this.vsText,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Bounce.easeOut',
    });
  }

  /**
   * Пульсация карточки
   */
  private pulseCard(card: Phaser.GameObjects.Container): void {
    this.scene.tweens.add({
      targets: card,
      scaleX: card.scaleX * 1.03,
      scaleY: 1.03,
      duration: 150,
      yoyo: true,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Подсвечивает карточку после переворота
   */
  private highlightCard(card: Phaser.GameObjects.Container): void {
    // Быстрое увеличение
    this.scene.tweens.add({
      targets: card,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 100,
      yoyo: true,
      ease: 'Power2',
    });

    // Вспышка
    const flash = this.scene.add.rectangle(
      card.x,
      card.y,
      this.CARD_WIDTH + 10,
      this.CARD_HEIGHT + 10,
      0xffffff,
      0.3
    );
    flash.setDepth(this.depth + 1);
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Безопасное воспроизведение звука
   */
  private playSFXSafe(key: string, volume: number = 1): void {
    try {
      if (this.scene.cache.audio.exists(key)) {
        this.scene.sound.play(key, { volume });
      }
    } catch (e) {
      // Игнорируем
    }
  }

  /**
   * Рисует свечение под VS
   */
  private drawVSGlow(): void {
    this.vsGlow.clear();
    
    const radius = Math.min(80, this.CARD_GAP * 0.8);
    const steps = 12;
    
    for (let i = steps; i > 0; i--) {
      const alpha = (i / steps) * 0.2;
      const r = radius * (i / steps);
      this.vsGlow.fillStyle(0xffcc00, alpha);
      this.vsGlow.fillCircle(0, 0, r);
    }
  }

  /**
   * Вспышка экрана
   */
  private flashScreen(intensity: number = 0.5): void {
    const { width, height } = this.scene.cameras.main;
    
    const flash = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0xffffff,
      intensity
    );
    flash.setDepth(this.depth + 10);
    
    this.scene.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => flash.destroy(),
    });
  }

  /**
   * Возвращает символ фракции
   */
  private getFactionSymbol(factionId: FactionId): string {
    const symbols: Record<FactionId, string> = {
      magma: '🔥',
      cyborg: '⚡',
      void: '👁',
      insect: '🦠',
    };
    return symbols[factionId] || '?';
  }

  /**
   * Утилита для задержки
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.scene.time.delayedCall(ms, resolve);
    });
  }

  /**
   * Пропустить интро
   */
  public skip(): void {
    if (!this.isAnimating) {
      console.log('[MatchIntroOverlay] skip() called but not animating');
      return;
    }
    
    console.log('[MatchIntroOverlay] Skipping intro animation');
    this.announcer.clear();
    
    this.scene.tweens.killTweensOf([
      this.overlay,
      this.player1Card,
      this.player2Card,
      this.player1CardBack,
      this.player2CardBack,
      this.vsText,
      this.vsGlow,
    ]);
    
    this.setVisible(false);
    this.isAnimating = false;
    
    // ✅ КРИТИЧНО: Вызываем callback в следующем фрейме
    if (this.onCompleteCallback) {
      this.scene.time.delayedCall(50, () => {
        console.log('[MatchIntroOverlay] Executing skip callback');
        this.onCompleteCallback?.();
      });
    }
  }

  /**
   * Очистка
   */
  public destroy(): void {
    console.log('[MatchIntroOverlay] Destroying overlay');
    
    // Останавливаем все анимации
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf([
        this.overlay,
        this.player1Card,
        this.player2Card,
        this.player1CardBack,
        this.player2CardBack,
        this.vsText,
        this.vsGlow,
      ]);
    }
    
    // Очищаем announcer
    this.announcer.clear();
    
    // Убеждаемся что оверлей невидим
    this.setVisible(false);
    this.isAnimating = false;
    
    // Вызываем базовый destroy
    super.destroy();
    
    console.log('[MatchIntroOverlay] Overlay destroyed');
  }
}