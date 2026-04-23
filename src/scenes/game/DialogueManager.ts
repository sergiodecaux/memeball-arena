// ✅ СОЗДАНО: Менеджер диалогов для кампании — показ реплик персонажей

// src/scenes/game/DialogueManager.ts

import Phaser from 'phaser';
import { 
  DialogueEntry, 
  DialogueLine, 
  CharacterId, 
  CharacterEmotion 
} from '../../types/CampaignTypes';
import { CAMPAIGN_DIALOGUES, getDialogue } from '../../data/CampaignData';

// Конфигурация персонажей
interface CharacterConfig {
  name: string;
  color: number;
  defaultEmotion: CharacterEmotion;
  portraitPrefix: string;
}

const CHARACTER_CONFIGS: Record<CharacterId, CharacterConfig> = {
  nova: {
    name: 'Командор Нова',
    color: 0x00f2ff,
    defaultEmotion: 'neutral',
    portraitPrefix: 'portrait_nova',
  },
  krag: {
    name: 'Краг',
    color: 0xff4500,
    defaultEmotion: 'angry',
    portraitPrefix: 'portrait_krag',
  },
  unit_734: {
    name: 'Юнит 734',
    color: 0x00f2ff,
    defaultEmotion: 'neutral',
    portraitPrefix: 'portrait_unit734',
  },
  zra: {
    name: "З'ра",
    color: 0x9d00ff,
    defaultEmotion: 'neutral',
    portraitPrefix: 'portrait_zra',
  },
  oracle: {
    name: 'Оракул',
    color: 0x39ff14,
    defaultEmotion: 'neutral',
    portraitPrefix: 'portrait_oracle',
  },
  announcer: {
    name: 'Комментатор',
    color: 0xffd700,
    defaultEmotion: 'neutral',
    portraitPrefix: 'portrait_announcer',
  },
};

export class DialogueManager {
  private scene: Phaser.Scene;
  
  // UI элементы
  private container?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private dialogueBox?: Phaser.GameObjects.Graphics;
  private portraitContainer?: Phaser.GameObjects.Container;
  private portraitRing?: Phaser.GameObjects.Graphics;
  private portraitGlow?: Phaser.GameObjects.Graphics;
  private portraitMaskGfx?: Phaser.GameObjects.Graphics;
  private portraitImage?: Phaser.GameObjects.Image;
  private nameText?: Phaser.GameObjects.Text;
  private dialogueText?: Phaser.GameObjects.Text;
  private continueHint?: Phaser.GameObjects.Text;
  private skipButton?: Phaser.GameObjects.Text;
  
  // Состояние
  private currentDialogue?: DialogueEntry;
  private currentLineIndex: number = 0;
  private isAnimating: boolean = false;
  private isPaused: boolean = false;
  private autoHideTimer?: Phaser.Time.TimerEvent;
  
  // Callbacks
  private onCompleteCallback?: () => void;
  private onSkipCallback?: () => void;
  
  // Размеры
  private screenWidth: number;
  private screenHeight: number;
  
  // Константы
  private readonly BOX_HEIGHT = 170;
  private readonly BOX_RADIUS = 18;
  private readonly PORTRAIT_SIZE = 118;         // badge diameter
  private readonly PORTRAIT_OVERLAP = 34;       // how much portrait sits ABOVE the panel
  private readonly PADDING = 18;
  private readonly SAFE_BOTTOM = 24;
  private readonly TEXT_SPEED = 30; // символов в секунду

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.screenWidth = scene.cameras.main.width;
    this.screenHeight = scene.cameras.main.height;
  }

  // ========== ПУБЛИЧНЫЕ МЕТОДЫ ==========

  /**
   * Показать диалог по ID
   */
  public showDialogue(
    dialogueId: string,
    onComplete?: () => void,
    onSkip?: () => void
  ): boolean {
    const dialogue = getDialogue(dialogueId);
    
    // ✅ 1.1 HARD DIAGNOSTICS: Log dialogue entry and each line text
    console.log('[DialogueManager] showDialogue called:', dialogueId, 'found:', !!dialogue);
    if (dialogue) {
      console.log('[DialogueManager] entry:', {
        id: dialogue.id,
        linesCount: dialogue.lines?.length,
        skippable: dialogue.skippable,
        priority: dialogue.priority,
      });
      console.log('[DialogueManager] lines preview:', dialogue.lines?.map(l => ({
        characterId: l.characterId,
        emotion: l.emotion,
        position: l.position,
        pauseGame: l.pauseGame,
        autoHide: l.autoHide,
        text: l.text,
        textLen: (l.text ?? '').length,
      })));
    }
    
    if (!dialogue || dialogue.lines.length === 0) {
      console.warn(`[DialogueManager] Dialogue not found: ${dialogueId}`);
      onComplete?.();
      return false;
    }
    
    this.currentDialogue = dialogue;
    this.currentLineIndex = 0;
    this.onCompleteCallback = onComplete;
    this.onSkipCallback = onSkip;
    
    this.createUI();
    this.showCurrentLine();
    
    return true;
  }

  /**
   * Показать одну реплику напрямую (без ID диалога)
   */
  public showLine(
    line: DialogueLine,
    onComplete?: () => void
  ): void {
    const tempDialogue: DialogueEntry = {
      id: 'temp_' + Date.now(),
      lines: [line],
      skippable: true,
    };
    
    this.currentDialogue = tempDialogue;
    this.currentLineIndex = 0;
    this.onCompleteCallback = onComplete;
    
    this.createUI();
    this.showCurrentLine();
  }

  /**
   * Проверить, активен ли диалог
   */
  public isActive(): boolean {
    return this.container !== undefined && this.container.visible;
  }

  /**
   * Принудительно закрыть диалог
   */
  public forceClose(): void {
    this.cleanup();
    this.onCompleteCallback?.();
  }

  /**
   * Уничтожить менеджер
   */
  public destroy(): void {
    this.cleanup();
  }

  // ========== СОЗДАНИЕ UI ==========

  private createUI(): void {
    // Очищаем предыдущий UI если есть
    this.cleanup();
    
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(10000); // ✅ MAX DEPTH
    this.container.setVisible(true);
    this.container.setAlpha(1);
    
    // Затемнение фона (опционально) - reduced opacity
    this.overlay = this.scene.add.rectangle(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      0x000000,
      0.32
    );
    this.overlay.setInteractive();
    this.container.add(this.overlay);
    
    // Диалоговое окно внизу экрана
    const boxY = Math.round(this.screenHeight - this.BOX_HEIGHT - this.SAFE_BOTTOM);
    
    this.dialogueBox = this.scene.add.graphics();
    this.drawDialogueBox(boxY);
    this.container.add(this.dialogueBox);
    
    // ✅ Portrait badge (overlapping panel)
    this.createPortraitBadge(boxY);
    
    // ✅ Text start X (accounting for overlapping portrait badge)
    const textStartX = Math.round(this.PADDING + this.PORTRAIT_SIZE + 34);
    const textWidth = Math.round(this.screenWidth - textStartX - this.PADDING - 16);
    
    // Имя персонажа
    this.nameText = this.scene.add.text(
      textStartX,
      Math.round(boxY + 20),
      '',
      {
        fontFamily: 'Arial Black, Arial',
        fontSize: '18px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      }
    );
    this.nameText.setDepth(10000);
    this.nameText.setAlpha(1);
    this.nameText.setVisible(true);
    this.container.add(this.nameText);
    
    // Текст диалога
    this.dialogueText = this.scene.add.text(
      textStartX,
      Math.round(boxY + 50),
      '',
      {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: textWidth },
        lineSpacing: 6,
      }
    );
    this.dialogueText.setDepth(10000);
    this.dialogueText.setAlpha(1);
    this.dialogueText.setVisible(true);
    this.container.add(this.dialogueText);
    
    // ✅ 1.3 ENSURE TEXT OBJECT EXISTS: Log confirmation
    console.log('[DialogueManager] dialogueText created:', {
      exists: !!this.dialogueText,
      parentContainerExists: !!this.container,
      depth: this.dialogueText.depth,
      visible: this.dialogueText.visible,
      alpha: this.dialogueText.alpha,
    });
    
    // ✅ DEBUG: Visual proof that text rendering works
    const debug = this.scene.add.text(
      this.PADDING + this.PORTRAIT_SIZE + 30,
      boxY + this.BOX_HEIGHT - 22,
      'DEBUG: text object alive',
      { fontFamily: 'Arial', fontSize: '12px', color: '#ff4444' }
    );
    debug.setDepth(10001);
    this.container.add(debug);
    
    // Подсказка "Тапни для продолжения"
    this.continueHint = this.scene.add.text(
      this.screenWidth - this.PADDING - 20,
      boxY + this.BOX_HEIGHT - 25,
      '▶ Тапни',
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#888888',
      }
    ).setOrigin(1, 0.5);
    this.container.add(this.continueHint);
    
    // Мигание подсказки
    this.scene.tweens.add({
      targets: this.continueHint,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
    
    // Кнопка пропуска (если разрешено)
    if (this.currentDialogue?.skippable) {
      this.skipButton = this.scene.add.text(
        this.screenWidth - this.PADDING - 20,
        boxY + 15,
        'Пропустить ➤',
        {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#666666',
        }
      ).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
      
      this.skipButton.on('pointerdown', () => this.skipDialogue());
      this.skipButton.on('pointerover', () => this.skipButton?.setColor('#ffffff'));
      this.skipButton.on('pointerout', () => this.skipButton?.setColor('#666666'));
      
      this.container.add(this.skipButton);
    }
    
    // Обработка клика для продолжения
    this.overlay.on('pointerdown', () => this.onTap());
    
    // ✅ Remove fade-in for debugging - ensure immediate visibility
    this.container.setAlpha(1);
    this.container.setVisible(true);
  }

  /**
   * Create portrait badge that overlaps the dialogue panel
   */
  private createPortraitBadge(boxY: number): void {
    if (!this.container) return;

    const cx = Math.round(this.PADDING + this.PORTRAIT_SIZE / 2 + 10);
    const cy = Math.round(boxY + this.PORTRAIT_SIZE / 2 - this.PORTRAIT_OVERLAP);

    // container for glow + ring + image
    this.portraitContainer = this.scene.add.container(cx, cy);
    this.portraitContainer.setDepth(10002);
    this.container.add(this.portraitContainer);

    // glow
    this.portraitGlow = this.scene.add.graphics();
    this.portraitGlow.fillStyle(0x00f2ff, 0.18);
    this.portraitGlow.fillCircle(0, 0, this.PORTRAIT_SIZE * 0.62);
    this.portraitContainer.add(this.portraitGlow);

    // ring
    this.portraitRing = this.scene.add.graphics();
    this.portraitRing.lineStyle(4, 0x00f2ff, 1);
    this.portraitRing.strokeCircle(0, 0, this.PORTRAIT_SIZE / 2 + 3);
    this.portraitContainer.add(this.portraitRing);

    // portrait image (placeholder key must exist)
    this.portraitImage = this.scene.add.image(0, 0, 'portrait_nova_neutral');
    this.portraitImage.setOrigin(0.5);
    this.portraitContainer.add(this.portraitImage);

    // circular mask for portrait
    this.portraitMaskGfx = this.scene.make.graphics({ x: 0, y: 0 });
    this.portraitMaskGfx.fillStyle(0xffffff, 1);
    this.portraitMaskGfx.fillCircle(0, 0, this.PORTRAIT_SIZE / 2 - 2);
    const mask = this.portraitMaskGfx.createGeometryMask();
    this.portraitImage.setMask(mask);

    // scale portrait with "cover fit" (no distortion)
    this.fitPortraitCover(this.portraitImage, this.PORTRAIT_SIZE);

    // subtle pop animation
    this.portraitContainer.setScale(0.92);
    this.portraitContainer.setAlpha(0);
    this.scene.tweens.add({
      targets: this.portraitContainer,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Fit portrait image to cover a circle without distortion
   */
  private fitPortraitCover(img: Phaser.GameObjects.Image, size: number): void {
    const tex = this.scene.textures.get(img.texture.key);
    const src = tex.getSourceImage() as any;
    const srcW = src?.width || img.width;
    const srcH = src?.height || img.height;

    const scale = Math.max(size / srcW, size / srcH);
    img.setScale(scale);
  }

  private drawDialogueBox(y: number): void {
    if (!this.dialogueBox) return;

    const width = Math.round(this.screenWidth - this.PADDING * 2);
    const x = Math.round(this.PADDING);

    this.dialogueBox.clear();

    // Drop shadow
    this.dialogueBox.fillStyle(0x000000, 0.28);
    this.dialogueBox.fillRoundedRect(x + 3, y + 3, width, this.BOX_HEIGHT, this.BOX_RADIUS);

    // Main background (crisper)
    this.dialogueBox.fillStyle(0x0e1022, 0.98);
    this.dialogueBox.fillRoundedRect(x, y, width, this.BOX_HEIGHT, this.BOX_RADIUS);

    // Thin top accent line (default color; will be recolored per speaker in showCurrentLine)
    this.dialogueBox.fillStyle(0x00f2ff, 0.65);
    this.dialogueBox.fillRoundedRect(x, y, width, 4, { tl: this.BOX_RADIUS, tr: this.BOX_RADIUS, bl: 0, br: 0 });

    // Border
    this.dialogueBox.lineStyle(2, 0x2a2f55, 1);
    this.dialogueBox.strokeRoundedRect(x, y, width, this.BOX_HEIGHT, this.BOX_RADIUS);
  }

  // ========== ПОКАЗ РЕПЛИКИ ==========

  private showCurrentLine(): void {
    if (!this.currentDialogue) return;
    
    const line = this.currentDialogue.lines[this.currentLineIndex];
    
    // ✅ 1.2 ENFORCE FALLBACK TEXT: Ensure we always have a non-empty string
    const rawText = (line as any)?.text;
    const safeText = (typeof rawText === 'string' && rawText.trim().length > 0)
      ? rawText
      : `⚠️ MISSING DIALOGUE TEXT (${this.currentDialogue.id} #${this.currentLineIndex})`;
    
    console.log('[DialogueManager] Rendering line:', {
      dialogueId: this.currentDialogue.id,
      index: this.currentLineIndex,
      characterId: line.characterId,
      emotion: line.emotion,
      rawText,
      safeText,
      rawTextLen: (rawText ?? '').length,
      safeTextLen: safeText.length,
    });
    
    if (!line) {
      this.completeDialogue();
      return;
    }
    
    const config = CHARACTER_CONFIGS[line.characterId];
    if (!config) {
      console.warn(`[DialogueManager] Unknown character: ${line.characterId}`);
      this.nextLine();
      return;
    }
    
    // Обновляем портрет
    this.updatePortrait(line.characterId, line.emotion || config.defaultEmotion, line.position);
    
    // Обновляем имя
    if (this.nameText) {
      this.nameText.setText(config.name);
      this.nameText.setColor('#' + config.color.toString(16).padStart(6, '0'));
    }
    
    // ✅ Recolor panel top accent line per character
    if (this.dialogueBox) {
      const boxY = Math.round(this.screenHeight - this.BOX_HEIGHT - this.SAFE_BOTTOM);
      const width = Math.round(this.screenWidth - this.PADDING * 2);
      const x = Math.round(this.PADDING);
      
      // Redraw panel with character-colored top accent line
      this.dialogueBox.clear();
      
      // Drop shadow
      this.dialogueBox.fillStyle(0x000000, 0.28);
      this.dialogueBox.fillRoundedRect(x + 3, boxY + 3, width, this.BOX_HEIGHT, this.BOX_RADIUS);
      
      // Main background
      this.dialogueBox.fillStyle(0x0e1022, 0.98);
      this.dialogueBox.fillRoundedRect(x, boxY, width, this.BOX_HEIGHT, this.BOX_RADIUS);
      
      // Thin top accent line (character color)
      this.dialogueBox.fillStyle(config.color, 0.65);
      this.dialogueBox.fillRoundedRect(x, boxY, width, 4, { tl: this.BOX_RADIUS, tr: this.BOX_RADIUS, bl: 0, br: 0 });
      
      // Border
      this.dialogueBox.lineStyle(2, 0x2a2f55, 1);
      this.dialogueBox.strokeRoundedRect(x, boxY, width, this.BOX_HEIGHT, this.BOX_RADIUS);
    }
    
    // ✅ 1.2 FORCE RENDER TEXT IMMEDIATELY: Use safeText (fallback if needed)
    if (this.dialogueText) {
      // ✅ Force render text immediately (no reliance on timers)
      this.dialogueText.setText(safeText);
      this.dialogueText.setAlpha(1);
      this.dialogueText.setVisible(true);
      
    // ✅ 4. ENFORCE POSITION AND WORDWRAP: Ensure text is positioned correctly
    // (Position is now handled in updatePortrait when it moves the badge)
      
      console.log('[DialogueManager] Text object state:', {
        text: this.dialogueText.text,
        visible: this.dialogueText.visible,
        alpha: this.dialogueText.alpha,
        x: this.dialogueText.x,
        y: this.dialogueText.y,
        wordWrapWidth: this.dialogueText.style.wordWrapWidth,
      });
    }
    if (this.nameText) {
      this.nameText.setAlpha(1);
      this.nameText.setVisible(true);
    }
    if (this.container) {
      this.container.setAlpha(1);
      this.container.setVisible(true);
    }
    
    // Optional: keep typewriter later, but only if safeText is not fallback
    // if (safeText !== `⚠️ MISSING DIALOGUE TEXT (${this.currentDialogue.id} #${this.currentLineIndex})`) {
    //   this.animateText(safeText);
    // }
    
    // ✅ Do NOT pause the Phaser scene here.
    // Pausing the scene freezes scene.time events, breaking typewriter text.
    this.isPaused = false;
    
    // Автоскрытие
    if (line.autoHide && line.autoHide > 0) {
      this.autoHideTimer = this.scene.time.delayedCall(line.autoHide, () => {
        this.nextLine();
      });
    }
  }

  /**
   * Generates a colored circle texture if the image is missing.
   * This ensures we NEVER see a broken asset.
   */
  private generateFallbackTexture(key: string, color: number, label: string): void {
    if (this.scene.textures.exists(key)) return;

    console.log(`[DialogueManager] 🎨 Generating fallback texture for: ${key}`);
    
    // Create graphics for the circle background
    const graphics = this.scene.add.graphics({ x: 0, y: 0 });
    
    // Draw colored circle
    graphics.fillStyle(color, 1);
    graphics.fillCircle(60, 60, 60);
    
    // Draw border
    graphics.lineStyle(4, 0xffffff, 1);
    graphics.strokeCircle(60, 60, 58);
    
    // For text, we'll use a simple geometric shape (triangle/diamond) to represent the initial
    // This avoids text rendering complexity while still being visually distinct
    graphics.fillStyle(0xffffff, 1);
    const size = 20;
    graphics.beginPath();
    graphics.moveTo(60, 60 - size);
    graphics.lineTo(60 + size, 60);
    graphics.lineTo(60, 60 + size);
    graphics.lineTo(60 - size, 60);
    graphics.closePath();
    graphics.fillPath();
    
    // Generate texture from graphics
    graphics.generateTexture(key, 120, 120);
    graphics.destroy();
  }

  private updatePortrait(
    characterId: CharacterId,
    emotion: CharacterEmotion,
    position?: 'left' | 'right'
  ): void {
    if (!this.portraitImage || !this.portraitContainer) return;
    
    const config = CHARACTER_CONFIGS[characterId];
    // Construct the ideal key (e.g., 'portrait_krag_angry')
    const targetKey = `${config.portraitPrefix}_${emotion}`;
    
    // 1. Check if texture exists. If NOT, generate a placeholder immediately.
    if (!this.scene.textures.exists(targetKey)) {
      console.warn(`[DialogueManager] Texture missing: ${targetKey}. Generating fallback.`);
      
      // Generate a texture using the character's color and first letter
      this.generateFallbackTexture(
        targetKey, 
        config.color, 
        config.name.charAt(0).toUpperCase()
      );
    }

    // 2. Apply texture (It definitely exists now, either loaded or generated)
    this.portraitImage.setTexture(targetKey);
    this.portraitImage.setTint(0xffffff); // Ensure full brightness
    this.fitPortraitCover(this.portraitImage, this.PORTRAIT_SIZE);
    
    // 3. ✅ Recolor badge glow + ring per character
    if (this.portraitGlow) {
      this.portraitGlow.clear();
      this.portraitGlow.fillStyle(config.color, 0.16);
      this.portraitGlow.fillCircle(0, 0, this.PORTRAIT_SIZE * 0.62);
    }
    if (this.portraitRing) {
      this.portraitRing.clear();
      this.portraitRing.lineStyle(4, config.color, 1);
      this.portraitRing.strokeCircle(0, 0, this.PORTRAIT_SIZE / 2 + 3);
    }
    
    // 4. Positioning Logic: Move badge container for left/right speaker
    const isRight = position === 'right';
    const boxY = Math.round(this.screenHeight - this.BOX_HEIGHT - this.SAFE_BOTTOM);

    const cxLeft  = Math.round(this.PADDING + this.PORTRAIT_SIZE / 2 + 10);
    const cxRight = Math.round(this.screenWidth - this.PADDING - this.PORTRAIT_SIZE / 2 - 10);
    const cy      = Math.round(boxY + this.PORTRAIT_SIZE / 2 - this.PORTRAIT_OVERLAP);

    this.portraitContainer.setPosition(isRight ? cxRight : cxLeft, cy);
    this.portraitContainer.setScale(1);
    this.portraitContainer.setAlpha(1);
    
    if (this.portraitImage) {
      this.portraitImage.setFlipX(isRight);
    }
    
    // 5. Adjust text position based on portrait side
    const textStartX = isRight
      ? Math.round(this.PADDING + 18)
      : Math.round(this.PADDING + this.PORTRAIT_SIZE + 34);

    const maxTextWidth = isRight
      ? Math.round(this.screenWidth - this.PADDING - this.PORTRAIT_SIZE - 34 - textStartX)
      : Math.round(this.screenWidth - this.PADDING - 16 - textStartX);

    this.nameText?.setX(textStartX);
    this.dialogueText?.setX(textStartX);
    this.dialogueText?.setWordWrapWidth(maxTextWidth, true);
  }

  private animateText(text: string): void {
    if (!this.dialogueText) return;
    
    console.log('[DialogueManager] animateText:', text);
    
    this.isAnimating = true;
    this.dialogueText.setText('');
    
    let charIndex = 0;
    const totalChars = text.length;
    const charDelay = 1000 / this.TEXT_SPEED;
    
    const typeChar = () => {
      if (charIndex < totalChars && this.isAnimating) {
        this.dialogueText?.setText(text.substring(0, charIndex + 1));
        charIndex++;
        
        this.scene.time.delayedCall(charDelay, typeChar);
      } else {
        this.isAnimating = false;
      }
    };
    
    typeChar();
  }

  private completeTextAnimation(): void {
    if (!this.currentDialogue || !this.dialogueText) return;
    
    const line = this.currentDialogue.lines[this.currentLineIndex];
    if (line) {
      this.dialogueText.setText(line.text);
    }
    
    this.isAnimating = false;
  }

  // ========== УПРАВЛЕНИЕ ==========

  private onTap(): void {
    if (this.isAnimating) {
      // Пропустить анимацию — показать весь текст сразу
      this.completeTextAnimation();
    } else {
      // Следующая реплика
      this.nextLine();
    }
  }

  private nextLine(): void {
    // Отменяем автоскрытие
    if (this.autoHideTimer) {
      this.autoHideTimer.destroy();
      this.autoHideTimer = undefined;
    }
    
    this.currentLineIndex++;
    
    if (this.currentDialogue && this.currentLineIndex < this.currentDialogue.lines.length) {
      this.showCurrentLine();
    } else {
      this.completeDialogue();
    }
  }

  private skipDialogue(): void {
    console.log('[DialogueManager] Dialogue skipped');
    
    this.cleanup();
    
    if (this.onSkipCallback) {
      this.onSkipCallback();
    } else {
      this.onCompleteCallback?.();
    }
  }

  private completeDialogue(): void {
    console.log('[DialogueManager] Dialogue completed');
    
    // ✅ No scene resume needed, we no longer pause the scene here.
    this.isPaused = false;
    
    // Анимация исчезновения
    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.cleanup();
          this.onCompleteCallback?.();
        },
      });
    } else {
      this.cleanup();
      this.onCompleteCallback?.();
    }
  }

  private cleanup(): void {
    if (this.autoHideTimer) {
      this.autoHideTimer.destroy();
      this.autoHideTimer = undefined;
    }
    
    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }
    
    this.overlay = undefined;
    this.dialogueBox = undefined;
    this.portraitContainer = undefined;
    this.portraitRing = undefined;
    this.portraitGlow = undefined;
    this.portraitMaskGfx = undefined;
    this.portraitImage = undefined;
    this.nameText = undefined;
    this.dialogueText = undefined;
    this.continueHint = undefined;
    this.skipButton = undefined;
    
    this.currentDialogue = undefined;
    this.currentLineIndex = 0;
    this.isAnimating = false;
    
    // ✅ No scene resume needed, we no longer pause the scene here.
    this.isPaused = false;
  }

  // ========== СТАТИЧЕСКИЕ ХЕЛПЕРЫ ==========

  /**
   * Получить конфиг персонажа
   */
  public static getCharacterConfig(characterId: CharacterId): CharacterConfig | undefined {
    return CHARACTER_CONFIGS[characterId];
  }

  /**
   * Проверить существование диалога
   */
  public static dialogueExists(dialogueId: string): boolean {
    return CAMPAIGN_DIALOGUES[dialogueId] !== undefined;
  }
}