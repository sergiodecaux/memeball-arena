// src/ui/game/CampaignDialogueOverlay.ts
// ✅ ЗАДАЧА 2: Портреты снаружи диалогового окна

import Phaser from 'phaser';
import { DialogueLine, CharacterId, CharacterEmotion } from '../../types/CampaignTypes';

interface CharacterConfig {
  name: string;
  color: number;
  defaultEmotion: CharacterEmotion;
}

const CHARACTER_CONFIGS: Record<CharacterId, CharacterConfig> = {
  nova: {
    name: 'Командор Нова',
    color: 0x00f2ff,
    defaultEmotion: 'neutral',
  },
  krag: {
    name: 'Краг',
    color: 0xff4500,
    defaultEmotion: 'angry',
  },
  unit_734: {
    name: 'Юнит 734',
    color: 0x00f2ff,
    defaultEmotion: 'neutral',
  },
  zra: {
    name: "З'ра",
    color: 0x9d00ff,
    defaultEmotion: 'neutral',
  },
  oracle: {
    name: 'Оракул',
    color: 0x39ff14,
    defaultEmotion: 'neutral',
  },
  announcer: {
    name: 'Комментатор',
    color: 0xffd700,
    defaultEmotion: 'neutral',
  },
};

export class CampaignDialogueOverlay {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  private panelBg?: Phaser.GameObjects.Graphics;
  private portraitContainer?: Phaser.GameObjects.Container;
  private portraitImage?: Phaser.GameObjects.Image;
  private portraitFrame?: Phaser.GameObjects.Graphics;
  private portraitFallback?: Phaser.GameObjects.Container;
  private nameText?: Phaser.GameObjects.Text;
  private bodyText?: Phaser.GameObjects.Text;
  private skipButton?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;

  // ✅ ЗАДАЧА 2: Новые константы для портретов снаружи
  private readonly BOX_HEIGHT = 170;
  private readonly BOX_RADIUS = 18;
  private readonly PORTRAIT_SIZE = 180; // Увеличено для полноразмерного портрета (bust)
  private readonly PADDING = 18;
  private readonly SAFE_BOTTOM = 24;
  private readonly PORTRAIT_X_OFFSET = 75; // Левый портрет: 75px от края
  private readonly PORTRAIT_Y_OFFSET = 210; // Портреты выше диалогового окна

  private screenWidth: number;
  private screenHeight: number;
  private onAdvanceCallback?: () => void;
  private isSkippable: boolean = false;
  private currentActivePosition?: 'left' | 'right';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.screenWidth = scene.cameras.main.width;
    this.screenHeight = scene.cameras.main.height;
  }

  /**
   * Show a dialogue line
   */
  showLine(line: DialogueLine, skippable: boolean = false, onAdvance?: () => void): void {
    this.isSkippable = skippable;
    this.onAdvanceCallback = onAdvance;

    // Clean up previous UI
    this.destroy();

    // Create UI
    this.createUI();
    this.updateContent(line);

    console.log('[CampaignDialogueOverlay] showLine:', {
      characterId: line.characterId,
      emotion: line.emotion,
      textLength: (line.text ?? '').length,
      textPreview: (line.text ?? '').substring(0, 50),
    });
  }

  /**
   * Hide the overlay
   */
  hide(): void {
    if (this.container) {
      this.container.setVisible(false);
      this.container.setAlpha(0);
    }
    
    if (this.onAdvanceCallback) {
      console.log('[CampaignDialogueOverlay] hide() - calling onAdvanceCallback');
      this.onAdvanceCallback();
      this.onAdvanceCallback = undefined;
    }
    
    console.log('[CampaignDialogueOverlay] hide() called');
  }
  
  /**
   * Handle skip action
   */
  private onSkip(): void {
    console.log('[CampaignDialogueOverlay] onSkip() called');
    this.hide();
  }

  /**
   * Check if overlay is visible
   */
  isVisible(): boolean {
    return this.container !== undefined && this.container.visible && this.container.alpha > 0;
  }

  /**
   * Destroy the overlay
   */
  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }

    this.panelBg = undefined;
    this.portraitContainer = undefined;
    this.portraitImage = undefined;
    this.portraitFrame = undefined;
    this.portraitFallback = undefined;
    this.nameText = undefined;
    this.bodyText = undefined;
    this.skipButton = undefined;
    this.overlay = undefined;
    this.onAdvanceCallback = undefined;
    this.currentActivePosition = undefined;
  }

  // ========== PRIVATE: UI CREATION ==========

  private createUI(): void {
    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(50000);
    this.container.setVisible(true);
    this.container.setAlpha(1);

    // Overlay background
    this.overlay = this.scene.add.rectangle(
      this.screenWidth / 2,
      this.screenHeight / 2,
      this.screenWidth,
      this.screenHeight,
      0x000000,
      0.32
    );
    this.overlay.setInteractive();
    this.overlay.on('pointerdown', () => this.onTap());
    this.container.add(this.overlay);
    
    // ✅ ЗАДАЧА 2: Диалоговое окно ниже (y ≈ height - 80-100)
    const boxY = Math.round(this.screenHeight - this.BOX_HEIGHT - 90);
    
    // Hit area for dialogue panel
    const hitArea = this.scene.add.rectangle(
      this.screenWidth / 2,
      boxY + this.BOX_HEIGHT / 2,
      this.screenWidth,
      this.BOX_HEIGHT,
      0x000000,
      0
    );
    hitArea.setInteractive({ useHandCursor: true });
    hitArea.on('pointerdown', () => {
      console.log('[CampaignDialogueOverlay] panel tapped');
      this.onTap();
    });
    hitArea.setDepth(50004);
    this.container.add(hitArea);

    // Dialogue panel background
    this.panelBg = this.scene.add.graphics();
    this.drawPanel(boxY, 0x00f2ff);
    this.container.add(this.panelBg);

    // ✅ ЗАДАЧА 2: Портреты создаются в updateContent (позиционируются снаружи)
    // Но нужно создать контейнер заранее
    this.portraitContainer = this.scene.add.container(0, 0);
    this.portraitContainer.setDepth(50002);
    this.container.add(this.portraitContainer);

    // Text elements - текст начинается от PADDING (не от портрета)
    const textStartX = Math.round(this.PADDING);
    const textWidth = Math.round(this.screenWidth - this.PADDING * 2);

    // Name text
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
    this.nameText.setDepth(50001);
    this.container.add(this.nameText);

    // Body text (dialogue content)
    this.bodyText = this.scene.add.text(
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
    this.bodyText.setDepth(50001);
    this.container.add(this.bodyText);

    // Skip button (if skippable)
    if (this.isSkippable) {
      const skipButtonContainer = this.scene.add.container(
        this.screenWidth - this.PADDING - 80,
        Math.round(boxY + 15)
      );
      
      const skipBg = this.scene.add.rectangle(0, 0, 120, 32, 0x000000, 0.001);
      skipBg.setInteractive({ useHandCursor: true });
      skipBg.on('pointerdown', () => {
        console.log('[CampaignDialogueOverlay] skip pressed');
        this.onSkip();
      });
      
      const skipLabel = this.scene.add.text(0, 0, 'Пропустить ➤', {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#aaaaaa',
      });
      skipLabel.setOrigin(0.5);
      
      skipLabel.on('pointerover', () => skipLabel.setColor('#ffffff'));
      skipLabel.on('pointerout', () => skipLabel.setColor('#aaaaaa'));
      
      skipButtonContainer.add([skipBg, skipLabel]);
      skipButtonContainer.setDepth(50003);
      this.container.add(skipButtonContainer);
      
      this.skipButton = skipButtonContainer;
    }

    // Continue hint
    const hint = this.scene.add.text(
      this.screenWidth - this.PADDING - 20,
      Math.round(boxY + this.BOX_HEIGHT - 25),
      '▶ Тапни',
      {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#888888',
      }
    );
    hint.setOrigin(1, 0.5);
    hint.setDepth(50001);
    this.container.add(hint);

    // Blink animation for hint
    this.scene.tweens.add({
      targets: hint,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1,
    });
  }

  /**
   * ✅ ЗАДАЧА 2: Создание портрета снаружи диалогового окна
   */
  private createPortrait(isRight: boolean, characterId: CharacterId, emotion: CharacterEmotion): void {
    if (!this.container || !this.portraitContainer) return;

    // ✅ ЗАДАЧА 2: Позиционирование портретов снаружи
    const portraitX = isRight 
      ? Math.round(this.screenWidth - this.PORTRAIT_X_OFFSET)
      : Math.round(this.PORTRAIT_X_OFFSET);
    const portraitY = Math.round(this.screenHeight - this.PORTRAIT_Y_OFFSET);

    this.portraitContainer.setPosition(portraitX, portraitY);
    this.currentActivePosition = isRight ? 'right' : 'left';

    const config = CHARACTER_CONFIGS[characterId];
    if (!config) return;

    // Очищаем предыдущий портрет
    this.portraitContainer.removeAll(true);
    if (this.portraitFallback) {
      this.portraitFallback.destroy();
      this.portraitFallback = undefined;
    }

    // ✅ FIX: Убираем рамку - она создает эффект "синей рамки"
    // Портрет должен быть полноразмерным спрайтом без рамки

    // Портрет (изображение)
    const portraitKey = this.getPortraitKey(characterId, emotion);
    let textureLoaded = false;

    if (this.scene.textures.exists(portraitKey)) {
      this.portraitImage = this.scene.add.image(0, 0, portraitKey);
      textureLoaded = true;
    } else {
      const neutralKey = this.getPortraitKey(characterId, 'neutral');
      if (this.scene.textures.exists(neutralKey)) {
        this.portraitImage = this.scene.add.image(0, 0, neutralKey);
        textureLoaded = true;
      }
    }

    if (textureLoaded && this.portraitImage) {
      // ✅ FIX: Устанавливаем origin (0.5, 1) для привязки к низу, чтобы портрет выступал за верхнюю границу
      this.portraitImage.setOrigin(0.5, 1);
      
      // ✅ Используем fitPortraitCover() для правильного масштабирования (как в TutorialOverlay)
      this.fitPortraitCover(this.portraitImage, this.PORTRAIT_SIZE);
      
      // ✅ FIX: Убираем маску - она обрезает портрет
      // Портрет должен отображаться полностью
      
      // ✅ Убеждаемся что портрет видимый
      this.portraitImage.setVisible(true);
      this.portraitImage.setAlpha(1);
      
      this.portraitContainer.add(this.portraitImage);
    } else {
      // ✅ ЗАДАЧА 2: Fallback - круг с первой буквой имени
      this.portraitFallback = this.scene.add.container(0, 0);
      
      const fallbackGfx = this.scene.add.graphics();
      fallbackGfx.fillStyle(config.color, 1);
      fallbackGfx.fillCircle(0, 0, this.PORTRAIT_SIZE / 2 - 5);
      fallbackGfx.lineStyle(3, 0xffffff, 1);
      fallbackGfx.strokeCircle(0, 0, this.PORTRAIT_SIZE / 2 - 5);
      
      const initial = config.name.charAt(0).toUpperCase();
      const initialText = this.scene.add.text(0, 0, initial, {
        fontFamily: 'Arial Black',
        fontSize: '48px',
        color: '#ffffff',
      });
      initialText.setOrigin(0.5);
      
      this.portraitFallback.add([fallbackGfx, initialText]);
      this.portraitContainer.add(this.portraitFallback);
    }

    // ✅ ЗАДАЧА 2: Активный портрет - alpha: 1, scale: 1, visible: true
    this.portraitContainer.setAlpha(1);
    this.portraitContainer.setScale(1);
    this.portraitContainer.setVisible(true);
  }

  private drawPanel(boxY: number, accentColor: number): void {
    if (!this.panelBg) return;

    const width = Math.round(this.screenWidth - this.PADDING * 2);
    const x = Math.round(this.PADDING);

    this.panelBg.clear();

    // Drop shadow
    this.panelBg.fillStyle(0x000000, 0.28);
    this.panelBg.fillRoundedRect(x + 3, boxY + 3, width, this.BOX_HEIGHT, this.BOX_RADIUS);

    // Main background
    this.panelBg.fillStyle(0x0e1022, 0.98);
    this.panelBg.fillRoundedRect(x, boxY, width, this.BOX_HEIGHT, this.BOX_RADIUS);

    // Top accent line (character color)
    this.panelBg.fillStyle(accentColor, 0.65);
    this.panelBg.fillRoundedRect(x, boxY, width, 4, {
      tl: this.BOX_RADIUS,
      tr: this.BOX_RADIUS,
      bl: 0,
      br: 0,
    });

    // Border
    this.panelBg.lineStyle(2, 0x2a2f55, 1);
    this.panelBg.strokeRoundedRect(x, boxY, width, this.BOX_HEIGHT, this.BOX_RADIUS);
  }

  private updateContent(line: DialogueLine): void {
    const config = CHARACTER_CONFIGS[line.characterId];
    if (!config) {
      console.warn(`[CampaignDialogueOverlay] Unknown character: ${line.characterId}`);
      return;
    }

    // ✅ ЗАДАЧА 2: Позиционирование портрета (снаружи диалогового окна)
    const isRight = line.position === 'right';
    const emotion = line.emotion || config.defaultEmotion;
    
    this.createPortrait(isRight, line.characterId, emotion);

    // ✅ ЗАДАЧА 2: Анимация смены портрета (tweens с duration 250-300ms)
    if (this.portraitContainer) {
      // Если портрет уже был, делаем анимацию смены
      if (this.currentActivePosition !== undefined) {
        this.portraitContainer.setAlpha(0);
        this.portraitContainer.setScale(0.9);
        
        this.scene.tweens.add({
          targets: this.portraitContainer,
          alpha: 1,
          scale: 1,
          duration: 280,
          ease: 'Back.easeOut',
        });
      }
    }

    // Обновление текста
    const boxY = Math.round(this.screenHeight - this.BOX_HEIGHT - 90);
    const textStartX = Math.round(this.PADDING);
    const textWidth = Math.round(this.screenWidth - this.PADDING * 2);

    if (this.nameText) {
      this.nameText.setText(config.name);
      this.nameText.setColor('#' + config.color.toString(16).padStart(6, '0'));
      this.nameText.setX(textStartX);
    }

    if (this.bodyText) {
      const safeText = (line.text && line.text.trim().length > 0)
        ? line.text
        : `⚠️ MISSING TEXT (${line.characterId})`;
      
      this.bodyText.setText(safeText);
      this.bodyText.setX(textStartX);
      this.bodyText.setWordWrapWidth(textWidth, true);
      this.bodyText.setAlpha(1);
      this.bodyText.setVisible(true);
    }

    // Redraw panel with character color
    if (this.panelBg) {
      this.drawPanel(boxY, config.color);
    }
  }

  private getPortraitKey(characterId: CharacterId, emotion: CharacterEmotion): string {
    const normalizedId = characterId === 'unit_734' ? 'unit_734' : characterId;
    return `portrait_${normalizedId}_${emotion}`;
  }

  /**
   * ✅ Используем тот же подход что и TutorialOverlay для правильного масштабирования портрета
   * Использует cover-fit подход для заполнения круга портретом без искажений
   */
  private fitPortraitCover(img: Phaser.GameObjects.Image, targetSize: number): void {
    // Force texture update to get dimensions
    const tex = this.scene.textures.get(img.texture.key);
    const src = tex.getSourceImage() as any;
    
    // Safety check
    const width = src?.width || img.width || 100;
    const height = src?.height || img.height || 100;

    // ✅ FIX: Если текстура меньше 600px, используем фиксированный масштаб для 512x512
    // Реальный размер PNG: 512x512, целевой размер: 180px (увеличен для полноразмерного портрета)
    let scale: number;
    if (width < 600 && height < 600) {
      // Для текстур 512x512 используем фиксированный масштаб
      // targetSize = 180, исходник = 512, scale = 180/512 ≈ 0.352
      // Но лучше немного больше для cover: * 1.2 для заполнения области
      scale = targetSize / 512 * 1.2;
      console.log(`[CampaignDialogueOverlay] Using fixed scale for small texture ${img.texture.key}: ${width}x${height} -> scale ${scale.toFixed(3)}`);
    } else {
      // Для больших текстур используем обычный расчет
      const scaleX = targetSize / width;
      const scaleY = targetSize / height;
      scale = Math.max(scaleX, scaleY);
      console.log(`[CampaignDialogueOverlay] Scaling portrait ${img.texture.key}: ${width}x${height} -> scale ${scale.toFixed(3)}`);
    }
    
    // Apply scale
    img.setScale(scale);
  }

  private onTap(): void {
    console.log('[CampaignDialogueOverlay] onTap() called');
    this.hide();
  }
}
