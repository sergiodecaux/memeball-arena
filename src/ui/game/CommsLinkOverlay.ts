// src/ui/game/CommsLinkOverlay.ts
// Система диалогов во время матча — всплывающее окно с персонажем

import Phaser from 'phaser';
import { DialogueLine, CharacterId, CharacterEmotion } from '../../types/CampaignTypes';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { AudioManager } from '../../managers/AudioManager';

export interface CommsLinkConfig {
  /** Ставить ли игру на паузу во время диалога */
  pauseOnShow?: boolean;
  /** Callback когда диалог завершён */
  onComplete?: () => void;
  /** Callback когда диалог пропущен */
  onSkip?: () => void;
}

interface CharacterConfig {
  name: string;
  color: number;
  assetKey: string;
  fallbackEmoji: string;
}

const CHARACTER_CONFIGS: Record<CharacterId, CharacterConfig> = {
  nova: {
    name: 'Командор Нова',
    color: 0x00f2ff,
    assetKey: 'commander_nova',
    fallbackEmoji: '👩‍✈️',
  },
  krag: {
    name: 'Краг',
    color: 0xff4500,
    assetKey: 'portrait_krag',
    fallbackEmoji: '🔥',
  },
  unit_734: {
    name: 'Юнит 734',
    color: 0x00f2ff,
    assetKey: 'portrait_unit734',
    fallbackEmoji: '🤖',
  },
  zra: {
    name: "З'ра",
    color: 0x9d00ff,
    assetKey: 'portrait_zra',
    fallbackEmoji: '👁',
  },
  oracle: {
    name: 'Оракул',
    color: 0x39ff14,
    assetKey: 'portrait_oracle',
    fallbackEmoji: '🦗',
  },
  announcer: {
    name: 'Комментатор',
    color: 0xffd700,
    assetKey: 'portrait_announcer',
    fallbackEmoji: '📢',
  },
};

export class CommsLinkOverlay {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private isVisible: boolean = false;
  private isAnimating: boolean = false;
  private currentLine: DialogueLine | null = null;
  private config: CommsLinkConfig;
  
  // UI Elements
  private panelBg!: Phaser.GameObjects.Graphics;
  private avatarContainer!: Phaser.GameObjects.Container;
  private avatarMask!: Phaser.GameObjects.Graphics;
  private avatarImage?: Phaser.GameObjects.Image;
  private avatarFallback?: Phaser.GameObjects.Text;
  private avatarFallbackGraphics?: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private dialogueText!: Phaser.GameObjects.Text;
  private continueHint!: Phaser.GameObjects.Text;
  private skipButton?: Phaser.GameObjects.Container;
  
  // Typewriter effect
  private typewriterEvent?: Phaser.Time.TimerEvent;
  private fullText: string = '';
  private currentCharIndex: number = 0;
  private typewriterSpeed: number = 30; // ms per character
  
  // Auto-hide timer
  private autoHideEvent?: Phaser.Time.TimerEvent;
  
  // Callbacks
  private onCompleteCallback?: () => void;

  constructor(scene: Phaser.Scene, config: CommsLinkConfig = {}) {
    this.scene = scene;
    this.config = config;
    
    const { width, height } = scene.cameras.main;
    
    // Создаём контейнер внизу экрана
    this.container = scene.add.container(0, height);
    this.container.setDepth(20000); // ✅ Ensure above most UI
    this.container.setAlpha(0);
    
    this.createPanel();
    this.createAvatar();
    this.createTextElements();
    this.setupInteraction();
  }

  private createPanel(): void {
    const { width } = this.scene.cameras.main;
    const panelHeight = 140;
    const panelWidth = width;
    
    this.panelBg = this.scene.add.graphics();
    this.drawPanel(0x0a0a15, 0x00f2ff, 0.95);
    this.container.add(this.panelBg);
  }

  private drawPanel(bgColor: number, accentColor: number, alpha: number): void {
    const { width } = this.scene.cameras.main;
    const panelHeight = 140;
    
    this.panelBg.clear();
    
    // Основной фон
    this.panelBg.fillStyle(bgColor, alpha);
    this.panelBg.fillRect(0, -panelHeight, width, panelHeight);
    
    // Верхняя граница с градиентом
    const borderHeight = 3;
    this.panelBg.fillStyle(accentColor, 0.8);
    this.panelBg.fillRect(0, -panelHeight, width, borderHeight);
    
    // Внутренняя подсветка сверху
    for (let i = 0; i < 20; i++) {
      const lineAlpha = 0.15 * (1 - i / 20);
      this.panelBg.fillStyle(accentColor, lineAlpha);
      this.panelBg.fillRect(0, -panelHeight + borderHeight + i, width, 1);
    }
    
    // Декоративные углы
    this.panelBg.lineStyle(2, accentColor, 0.6);
    
    // Левый верхний угол
    this.panelBg.beginPath();
    this.panelBg.moveTo(10, -panelHeight + 20);
    this.panelBg.lineTo(10, -panelHeight + 8);
    this.panelBg.lineTo(30, -panelHeight + 8);
    this.panelBg.strokePath();
    
    // Правый верхний угол
    this.panelBg.beginPath();
    this.panelBg.moveTo(width - 10, -panelHeight + 20);
    this.panelBg.lineTo(width - 10, -panelHeight + 8);
    this.panelBg.lineTo(width - 30, -panelHeight + 8);
    this.panelBg.strokePath();
  }

  private createAvatar(): void {
    const avatarSize = 80;
    const avatarX = 55;
    const avatarY = -70;
    
    this.avatarContainer = this.scene.add.container(avatarX, avatarY);
    this.avatarContainer.setDepth(20001); // ✅ 1.4 Ensure portrait is not hidden by depth ordering
    this.container.add(this.avatarContainer);
    
    // ✅ 4. Visible debug marker to ensure avatar layer is rendering (remove after verification)
    const marker = this.scene.add.rectangle(0, 0, 4, 4, 0xff00ff, 1);
    this.avatarContainer.add(marker);
    
    // Гексагональная маска (визуальная имитация)
    const hexRadius = avatarSize / 2;
    
    // Фоновый круг с glow
    const glowGraphics = this.scene.add.graphics();
    glowGraphics.fillStyle(0x00f2ff, 0.3);
    glowGraphics.fillCircle(0, 0, hexRadius + 8);
    this.avatarContainer.add(glowGraphics);
    
    // Основная рамка
    const borderGraphics = this.scene.add.graphics();
    borderGraphics.lineStyle(3, 0x00f2ff, 1);
    this.drawHexagon(borderGraphics, 0, 0, hexRadius + 4);
    borderGraphics.strokePath();
    this.avatarContainer.add(borderGraphics);
    
    // Внутренний фон
    const bgGraphics = this.scene.add.graphics();
    bgGraphics.fillStyle(0x0a0a15, 1);
    this.drawHexagon(bgGraphics, 0, 0, hexRadius);
    bgGraphics.fillPath();
    this.avatarContainer.add(bgGraphics);
    
    // ✅ 1.1 Mask for image (must be in avatarContainer local space, centered at 0,0)
    this.avatarMask = this.scene.add.graphics();
    this.avatarMask.clear();
    this.avatarMask.fillStyle(0xffffff, 1);
    
    // ✅ IMPORTANT: mask is drawn in LOCAL coords (0,0), because avatarImage is at (0,0) inside avatarContainer
    this.drawHexagon(this.avatarMask, 0, 0, hexRadius - 2);
    this.avatarMask.fillPath();
    this.avatarMask.setVisible(false); // mask does not need to be visible
  }

  private drawHexagon(graphics: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number): void {
    graphics.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }
    graphics.closePath();
  }

  private createTextElements(): void {
    const fonts = getFonts();
    const { width } = this.scene.cameras.main;
    const textX = 115;
    const textWidth = width - textX - 20;
    
    // Имя персонажа
    this.nameText = this.scene.add.text(textX, -120, '', {
      fontSize: '14px',
      fontFamily: fonts.tech,
      color: '#00f2ff',
      fontStyle: 'bold',
    });
    this.container.add(this.nameText);
    
    // Текст диалога
    this.dialogueText = this.scene.add.text(textX, -95, '', {
      fontSize: '13px',
      fontFamily: fonts.primary,  // ✅ Исправлено: было fonts.main
      color: '#ffffff',
      wordWrap: { width: textWidth },
      lineSpacing: 4,
    });
    this.dialogueText.setAlpha(1);
    this.dialogueText.setVisible(true);
    this.dialogueText.setDepth(600);
    this.container.add(this.dialogueText);
    
    // Подсказка "Нажмите для продолжения"
    this.continueHint = this.scene.add.text(width - 20, -15, '▼ Тап', {
      fontSize: '10px',
      fontFamily: fonts.tech,
      color: '#888888',
    }).setOrigin(1, 0.5);
    this.container.add(this.continueHint);
    
    // Анимация подсказки
    this.scene.tweens.add({
      targets: this.continueHint,
      alpha: { from: 1, to: 0.4 },
      duration: 600,
      yoyo: true,
      repeat: -1,
    });
  }

  private setupInteraction(): void {
    const { width } = this.scene.cameras.main;
    const panelHeight = 140;
    
    // Зона клика на всю панель
    const hitArea = this.scene.add.rectangle(
      width / 2, 
      -panelHeight / 2, 
      width, 
      panelHeight, 
      0x000000, 
      0
    );
    hitArea.setInteractive({ useHandCursor: true });
    
    // ✅ 2.1 Make tap area always clickable and on top
    hitArea.setDepth(99999);
    
    // ✅ 2.1 Add pointerdown log
    hitArea.on('pointerdown', () => {
      console.log('[CommsLinkOverlay] hitArea pointerdown');
      this.onTap();
    });
    
    // ✅ Ensure hitArea is added LAST so it sits above other objects and catches taps consistently
    this.container.add(hitArea);
  }

  private onTap(): void {
    console.log('[CommsLinkOverlay] onTap called:', {
      isAnimating: this.isAnimating,
      isVisible: this.isVisible,
      hasTypewriter: !!this.typewriterEvent,
      currentCharIndex: this.currentCharIndex,
      fullTextLength: this.fullText.length,
    });
    
    // ✅ 2.2 Ensure onTap() never gets stuck by isAnimating
    // Allow tap even if animation flag got stuck; only block during the first 150ms of show tween if needed
    if (this.isAnimating && this.isVisible) {
      console.log('[CommsLinkOverlay] onTap ignored: isAnimating=true');
      return;
    }
    
    // Если текст ещё печатается — показать весь текст сразу
    if (this.typewriterEvent && this.currentCharIndex < this.fullText.length) {
      this.completeTypewriter();
      return;
    }
    
    // Иначе — закрыть диалог
    this.hide();
  }

  /**
   * Показать диалоговую линию
   */
  show(line: DialogueLine, onComplete?: () => void): void {
    console.log('[CommsLinkOverlay] show called:', {
      characterId: line.characterId,
      emotion: line.emotion,
      textLength: (line.text ?? '').length,
      textPreview: (line.text ?? '').substring(0, 50),
      onCompleteProvided: !!onComplete,
    });
    
    if (this.isAnimating) {
      console.warn('[CommsLinkOverlay] show ignored: already animating');
      return;
    }
    
    this.currentLine = line;
    this.onCompleteCallback = onComplete;
    
    // ✅ 2.2 Safety reset before starting tween
    this.scene.tweens.killTweensOf(this.container);
    this.isAnimating = false;
    
    // Очищаем предыдущие таймеры
    this.clearTimers();
    
    // Настраиваем персонажа
    this.setupCharacter(line.characterId, line.emotion);
    
    // Настраиваем текст
    this.fullText = line.text ?? '';
    // ✅ Force full text immediately for visibility
    this.currentCharIndex = this.fullText.length;
    this.dialogueText.setText(this.fullText);
    this.dialogueText.setAlpha(1);
    this.dialogueText.setVisible(true);
    
    // ✅ Disable typewriter for now to ensure text is visible
    // this.startTypewriter();
    
    // Обновляем цвета панели под персонажа
    const charConfig = CHARACTER_CONFIGS[line.characterId];
    this.drawPanel(0x0a0a15, charConfig.color, 0.95);
    this.nameText.setColor(hexToString(charConfig.color));
    
    // Анимация появления
    const { height } = this.scene.cameras.main;
    this.container.setY(height);
    this.container.setAlpha(1);
    this.isVisible = true;
    
    // ✅ Set isAnimating = true only for the short show tween
    this.isAnimating = true;
    
    this.scene.tweens.add({
      targets: this.container,
      y: height - 10, // Небольшой отступ от низа
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // ✅ Always set false in tween onComplete
        this.isAnimating = false;
        console.log('[CommsLinkOverlay] show tween complete, isAnimating=false');

        // ✅ Force immediate visible text (prevents "empty" state even if timers pause)
        this.currentCharIndex = this.fullText.length;
        this.dialogueText.setText(this.fullText);
        this.dialogueText.setAlpha(1);
        this.dialogueText.setVisible(true);

        // ✅ Disable typewriter for now to ensure text is visible
        // this.startTypewriter();
        
        // ✅ 2.4 Remove scene pause/resume inside overlay (recommended)
        // This is a common cause of "stuck" state depending on Phaser scene pause behavior.
        // Instead, gameplay should be blocked from outside (GameScene disables shooting).
        // The overlay must not control scene pause.
        
        // Авто-скрытие
        if (line.autoHide && line.autoHide > 0) {
          this.autoHideEvent = this.scene.time.delayedCall(line.autoHide, () => {
            this.hide();
          });
        }
      },
    });
    
    // Звук появления
    AudioManager.getInstance().playSFX('sfx_swish', { volume: 0.5 });
  }

  /**
   * Скрыть диалог
   */
  hide(skipCallback: boolean = false): void {
    if (!this.isVisible || this.isAnimating) return;
    
    this.isAnimating = true;
    this.clearTimers();
    
    const { height } = this.scene.cameras.main;
    
    this.scene.tweens.add({
      targets: this.container,
      y: height + 50,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.isVisible = false;
        this.isAnimating = false;
        this.currentLine = null;
        
        // ✅ 2.4 Remove scene pause/resume inside overlay (recommended)
        // This is a common cause of "stuck" state depending on Phaser scene pause behavior.
        // Instead, gameplay should be blocked from outside (GameScene disables shooting).
        // The overlay must not control scene pause.
        
        // ✅ 2.3 Most critical fix: always call completion callback when hiding
        console.log('[CommsLinkOverlay] hide complete:', { skipCallback, hasCallback: !!this.onCompleteCallback });
        
        // Always call completion so flow continues (start match / next line / queue)
        this.onCompleteCallback?.();

        // If it was a skip, also notify onSkip
        if (skipCallback) {
          this.config.onSkip?.();
        }
      },
    });
  }

  private setupCharacter(characterId: CharacterId, emotion?: CharacterEmotion): void {
    const charConfig = CHARACTER_CONFIGS[characterId];
    
    // Удаляем предыдущий аватар
    if (this.avatarImage) {
      this.avatarImage.destroy();
      this.avatarImage = undefined;
    }
    if (this.avatarFallback) {
      this.avatarFallback.destroy();
      this.avatarFallback = undefined;
    }
    if (this.avatarFallbackGraphics) {
      this.avatarFallbackGraphics.destroy();
      this.avatarFallbackGraphics = undefined;
    }
    
    // Имя персонажа
    this.nameText.setText(charConfig.name);
    
    // ✅ 3. Robust texture key resolution (try emotion → neutral → base)
    const keysToTry: string[] = [];
    if (emotion) keysToTry.push(`${charConfig.assetKey}_${emotion}`);
    keysToTry.push(`${charConfig.assetKey}_neutral`);
    keysToTry.push(charConfig.assetKey);
    
    // ✅ 1.5 Add hard logs to confirm texture exists
    console.log('[CommsLinkOverlay] setupCharacter:', {
      characterId,
      emotion,
      keysToTry,
      keysExist: keysToTry.map(k => ({ key: k, exists: this.scene.textures.exists(k) })),
    });
    
    const foundKey = keysToTry.find(k => this.scene.textures.exists(k));
    
    if (foundKey) {
      this.avatarImage = this.scene.add.image(0, 0, foundKey);
      this.avatarImage.setOrigin(0.5);
      
      // ✅ 1.3 Stop stretching - use cover-fit scaling
      const size = 70;
      const scale = Math.max(size / this.avatarImage.width, size / this.avatarImage.height);
      this.avatarImage.setScale(scale);
      
      // ✅ 1.2 Apply hex geometry mask (must be done after image is created)
      const geomMask = this.avatarMask.createGeometryMask();
      this.avatarImage.setMask(geomMask);
      
      this.avatarContainer.add(this.avatarImage);
      
      // ✅ 1.5 Log avatar creation
      console.log('[CommsLinkOverlay] avatarImage created:', {
        texture: this.avatarImage.texture.key,
        width: this.avatarImage.width,
        height: this.avatarImage.height,
        scale: this.avatarImage.scale,
        visible: this.avatarImage.visible,
        alpha: this.avatarImage.alpha,
        hasMask: this.avatarImage.mask !== null,
      });
    } else {
      // ✅ 1.6 Replace emoji-only fallback with deterministic graphics fallback
      console.warn('[CommsLinkOverlay] No texture found for keys:', keysToTry, 'using graphics fallback');
      
      // ✅ Deterministic fallback (always renders)
      this.avatarFallbackGraphics = this.scene.add.graphics();
      this.avatarFallbackGraphics.fillStyle(charConfig.color, 1);
      this.avatarFallbackGraphics.fillCircle(0, 0, 28);
      this.avatarFallbackGraphics.lineStyle(3, 0xffffff, 1);
      this.avatarFallbackGraphics.strokeCircle(0, 0, 28);
      
      // Small icon dot
      this.avatarFallbackGraphics.fillStyle(0xffffff, 0.9);
      this.avatarFallbackGraphics.fillCircle(0, 0, 6);
      
      this.avatarContainer.add(this.avatarFallbackGraphics);
      
      // Also add emoji as text overlay (optional, for character identification)
      this.avatarFallback = this.scene.add.text(0, 0, charConfig.fallbackEmoji, {
        fontSize: '24px',
      }).setOrigin(0.5);
      this.avatarContainer.add(this.avatarFallback);
      
      console.log('[CommsLinkOverlay] Graphics fallback created');
    }
    
    // Обновляем glow под цвет персонажа
    const glowGraphics = this.avatarContainer.getAt(0) as Phaser.GameObjects.Graphics;
    if (glowGraphics) {
      glowGraphics.clear();
      glowGraphics.fillStyle(charConfig.color, 0.3);
      glowGraphics.fillCircle(0, 0, 48);
    }
    
    // Обновляем рамку
    const borderGraphics = this.avatarContainer.getAt(1) as Phaser.GameObjects.Graphics;
    if (borderGraphics) {
      borderGraphics.clear();
      borderGraphics.lineStyle(3, charConfig.color, 1);
      this.drawHexagon(borderGraphics, 0, 0, 44);
      borderGraphics.strokePath();
    }
  }

  private startTypewriter(): void {
    // ✅ Ensure we start from currentCharIndex (already set to 1 in show())
    this.typewriterEvent = this.scene.time.addEvent({
      delay: this.typewriterSpeed,
      callback: () => {
        if (this.currentCharIndex < this.fullText.length) {
          this.currentCharIndex++;
          this.dialogueText.setText(this.fullText.substring(0, this.currentCharIndex));
          
          // Звук печати (каждый 3-й символ)
          if (this.currentCharIndex % 3 === 0) {
            // Можно добавить sfx_type если есть
          }
        } else {
          this.typewriterEvent?.destroy();
          this.typewriterEvent = undefined;
        }
      },
      loop: true,
    });
  }

  private completeTypewriter(): void {
    if (this.typewriterEvent) {
      this.typewriterEvent.destroy();
      this.typewriterEvent = undefined;
    }
    this.currentCharIndex = this.fullText.length;
    this.dialogueText.setText(this.fullText);
  }

  private clearTimers(): void {
    if (this.typewriterEvent) {
      this.typewriterEvent.destroy();
      this.typewriterEvent = undefined;
    }
    if (this.autoHideEvent) {
      this.autoHideEvent.destroy();
      this.autoHideEvent = undefined;
    }
  }

  /**
   * Проверить, виден ли диалог
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Принудительно скрыть без анимации
   */
  forceHide(): void {
    console.log('[CommsLinkOverlay] forceHide called');
    this.clearTimers();
    this.container.setAlpha(0);
    this.isVisible = false;
    this.isAnimating = false;
    this.currentLine = null;
    
    // ✅ 2.4 Remove scene pause/resume inside overlay
    // if (this.scene.scene.isPaused()) {
    //   this.scene.scene.resume();
    // }
    
    // ✅ Always call completion
    console.log('[CommsLinkOverlay] forceHide - calling onCompleteCallback');
    this.onCompleteCallback?.();
  }

  /**
   * Уничтожить overlay
   */
  destroy(): void {
    this.clearTimers();
    this.container.destroy();
  }
}