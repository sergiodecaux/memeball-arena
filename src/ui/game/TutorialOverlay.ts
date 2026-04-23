// ✅ ИЗМЕНЕНО: Добавлен параметр enableTutorial и флаг активности

import Phaser from 'phaser';

// ✅ ЗАДАЧА 1: Тексты туториала на русском языке
export const TUTORIAL_TEXTS = {
  // Приветствие
  step1: 'Добро пожаловать в Galaxy League!',
  step1Msg: 'Это космический футбол будущего. Управляй фишками и забивай голы!',
  
  // О легендарных юнитах
  step2: 'Легендарные герои',
  step2Msg: 'В этом матче ты играешь тремя легендарными героями своей фракции. Почувствуй их невероятную мощь!',
  
  // Выбор юнита
  step3: 'Выбор юнита',
  step3Msg: 'Нажми на свою фишку, чтобы выбрать её для удара.',
  
  // Прицеливание
  step4: 'Прицеливание',
  step4Msg: 'Потяни палец назад — появится линия прицеливания. Чем дальше тянешь, тем сильнее удар!',
  
  // Удар
  step5: 'Удар!',
  step5Msg: 'Отпусти палец, чтобы ударить. Постарайся попасть по мячу!',
  
  // Физика
  step6: 'Физика мяча',
  step6Msg: 'Мяч отскакивает от стен и фишек. Используй это для хитрых комбинаций!',
  
  // Цель
  step7: 'Забей гол!',
  step7Msg: 'Направь мяч в ворота противника. Первый до 3 голов — победитель!',
  
  // Ходы
  step8: 'Пошаговая игра',
  step8Msg: 'После твоего удара ходит противник. Планируй на несколько ходов вперёд!',
  
  // Способности
  step9: 'Способности фракции',
  step9Msg: 'У каждой фракции уникальная способность. Накапливай заряды за голы и попадания!',
  
  // После туториала
  step10: 'Твоя команда',
  step10Msg: 'После обучения ты получишь стартовых бойцов. Собирай новых героев и усиливай команду!',
  
  // Финал
  step11: 'В бой!',
  step11Msg: 'Теперь ты готов к битвам. Покажи всем, кто здесь настоящий чемпион!',
  
  // Кнопки
  skip: 'Пропустить',
  next: 'Далее',
} as const;

export class TutorialOverlay extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
  private nameText: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text;
  private clickPrompt: Phaser.GameObjects.Text;
  
  private fullText: string = '';
  private isTyping: boolean = false;
  private typeTimer?: Phaser.Time.TimerEvent;
  private glitchTimer?: Phaser.Time.TimerEvent;
  private onCompleteCallback?: () => void;

  // ⭐ НОВОЕ: флаг активности туториала
  private isTutorialActive: boolean = false;

  // Подсветка юнитов
  private highlightGraphics?: Phaser.GameObjects.Graphics;
  private highlightTween?: Phaser.Tweens.Tween;
  private arrowGraphics?: Phaser.GameObjects.Graphics;

  private readonly WINDOW_HEIGHT = 160;
  private readonly PORTRAIT_SIZE = 180;
  private readonly TYPE_SPEED = 30;

  constructor(scene: Phaser.Scene, enableTutorial: boolean = false) {
    super(scene, 0, 0);
    this.setDepth(9999);
    this.setScrollFactor(0);

    this.isTutorialActive = enableTutorial;

    console.log(`[TutorialOverlay] Created: ${enableTutorial ? 'ACTIVE' : 'INACTIVE'}`);
    
    this.createUI();
    this.setVisible(false); // Всегда скрыт по умолчанию
    
    scene.add.existing(this);
  }

  // ⭐ НОВЫЙ МЕТОД: проверка активности
  public isActive(): boolean {
    return this.isTutorialActive;
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const bgY = height - this.WINDOW_HEIGHT - 20;

    // 1. Фон
    this.bg = this.scene.add.graphics();
    this.bg.fillStyle(0x0a0a15, 0.95);
    this.bg.lineStyle(2, 0x00f2ff, 1);
    this.bg.fillRoundedRect(20, bgY, width - 40, this.WINDOW_HEIGHT, 10);
    this.bg.strokeRoundedRect(20, bgY, width - 40, this.WINDOW_HEIGHT, 10);
    this.add(this.bg);

    // 2. Портрет (С ЗАЩИТОЙ ОТ ОШИБКИ)
    // ✅ FIX: Используем те же ключи что и CampaignDialogueOverlay для совместимости
    const portraitKey = this.getPortraitKey('nova', 'happy');
    if (this.scene.textures.exists(portraitKey)) {
      console.log('[TutorialOverlay] Texture found:', portraitKey);
      const img = this.scene.add.image(90, bgY - 40, portraitKey);
      img.setOrigin(0.5);
      // ✅ FIX: Используем тот же подход что в CampaignDialogueOverlay для правильного масштабирования
      this.fitPortraitCover(img, this.PORTRAIT_SIZE);
      this.portrait = img;
    } else {
      // Fallback: try neutral
      const neutralKey = this.getPortraitKey('nova', 'neutral');
      if (this.scene.textures.exists(neutralKey)) {
        console.log('[TutorialOverlay] Using neutral fallback:', neutralKey);
        const img = this.scene.add.image(90, bgY - 40, neutralKey);
        img.setOrigin(0.5);
        this.fitPortraitCover(img, this.PORTRAIT_SIZE);
        this.portrait = img;
      } else {
        console.warn('[TutorialOverlay] ⚠️ Portrait textures MISSING! Using fallback.');
        // Фолбек: Белый квадрат, если картинки нет
        const rect = this.scene.add.rectangle(90, bgY - 40, 150, 150, 0xffffff);
        this.portrait = rect;
      }
    }
    this.add(this.portrait);

    // 3. Текст имени
    this.nameText = this.scene.add.text(170, bgY + 15, 'КОМАНДОР НОВА', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#00f2ff',
      fontStyle: 'bold'
    });
    this.add(this.nameText);

    // 4. Текст сообщения
    this.messageText = this.scene.add.text(170, bgY + 45, '', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      wordWrap: { width: width - 210 }
    });
    this.add(this.messageText);

    // 5. Кнопка
    this.clickPrompt = this.scene.add.text(width - 40, height - 40, '▼', {
      fontSize: '24px',
      color: '#00f2ff'
    }).setOrigin(1, 1);
    this.add(this.clickPrompt);
    
    // Инпут
    const hitArea = new Phaser.Geom.Rectangle(20, bgY, width - 40, this.WINDOW_HEIGHT);
    this.bg.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
    this.bg.on('pointerdown', () => this.handleInput());
  }

  public showMessage(text: string, onComplete?: () => void): void {
    if (!this.isTutorialActive) {
      console.log('[TutorialOverlay] Tutorial disabled, skipping message');
      onComplete?.(); // Сразу вызываем callback если туториал выключен
      return;
    }

    console.log(`[TutorialOverlay] showMessage: "${text}"`);
    
    // ✅ FIX: Обновляем портрет при показе сообщения (на случай если текстура загрузилась позже)
    this.updatePortrait();
    
    this.setVisible(true);
    this.fullText = text;
    this.messageText.setText('');
    this.isTyping = true;
    this.clickPrompt.setVisible(false);
    this.onCompleteCallback = onComplete;
    
    this.y = 50;
    this.alpha = 0;
    this.scene.tweens.add({
      targets: this,
      y: 0,
      alpha: 1,
      duration: 300,
      ease: 'Back.out'
    });

    let charIndex = 0;
    if (this.typeTimer) this.typeTimer.remove();
    
    this.typeTimer = this.scene.time.addEvent({
      delay: this.TYPE_SPEED,
      callback: () => {
        this.messageText.text += this.fullText[charIndex];
        charIndex++;
        if (charIndex >= this.fullText.length) {
          this.finishTyping();
        }
      },
      repeat: this.fullText.length - 1
    });

    if (this.portrait instanceof Phaser.GameObjects.Image) {
      this.startGlitchEffect();
    }
  }

  public hide(): void {
    if (this.typeTimer) this.typeTimer.remove();
    this.stopGlitchEffect();

    this.scene.tweens.add({
      targets: this,
      y: 50,
      alpha: 0,
      duration: 250,
      onComplete: () => {
        this.setVisible(false);
        if (this.onCompleteCallback) {
          this.onCompleteCallback();
          this.onCompleteCallback = undefined;
        }
      }
    });
  }

  private handleInput(): void {
    if (this.isTyping) {
      if (this.typeTimer) this.typeTimer.remove();
      this.messageText.setText(this.fullText);
      this.finishTyping();
    } else {
      this.hide();
    }
  }

  private finishTyping(): void {
    this.isTyping = false;
    this.clickPrompt.setVisible(true);
  }

  private startGlitchEffect(): void {
    this.glitchTimer = this.scene.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => this.triggerGlitch(),
      loop: true
    });
  }

  private stopGlitchEffect(): void {
    if (this.glitchTimer) this.glitchTimer.remove();
    if (this.portrait instanceof Phaser.GameObjects.Image) {
      this.portrait.setTint(0xffffff);
      this.portrait.x = 90;
    }
  }

  private triggerGlitch(): void {
    if (!this.visible || !(this.portrait instanceof Phaser.GameObjects.Image)) return;
    
    this.portrait.setTint(0x00f2ff);
    const originalX = 90;
    this.portrait.x = originalX + Phaser.Math.Between(-5, 5);
    
    this.scene.time.delayedCall(100, () => {
      if (this.portrait instanceof Phaser.GameObjects.Image) {
        this.portrait.setTint(0xffffff);
        this.portrait.x = originalX;
      }
      if (this.glitchTimer) {
        this.glitchTimer.reset({
            delay: Phaser.Math.Between(2000, 5000),
            callback: () => this.triggerGlitch(),
            loop: true
        });
      }
    });
  }

  /**
   * ✅ FIX: Получить ключ портрета (как в CampaignDialogueOverlay)
   */
  private getPortraitKey(characterId: string, emotion: string): string {
    return `portrait_${characterId}_${emotion}`;
  }

  /**
   * ✅ FIX: Обновить портрет (на случай если текстура загрузилась позже)
   */
  private updatePortrait(): void {
    if (!(this.portrait instanceof Phaser.GameObjects.Image)) {
      // Если это fallback, попробуем загрузить портрет снова
      const portraitKey = this.getPortraitKey('nova', 'happy');
      if (this.scene.textures.exists(portraitKey)) {
        console.log('[TutorialOverlay] Portrait texture now available, updating...');
        const bgY = this.scene.scale.height - this.WINDOW_HEIGHT - 20;
        
        // Удаляем старый fallback
        if (this.portrait) {
          this.remove(this.portrait);
          this.portrait.destroy();
        }
        
        // Создаем новый портрет
        const img = this.scene.add.image(90, bgY - 40, portraitKey);
        img.setOrigin(0.5);
        this.fitPortraitCover(img, this.PORTRAIT_SIZE);
        this.portrait = img;
        this.add(this.portrait);
      }
    } else {
      // Если портрет уже Image, проверяем что текстура правильная
      const portraitKey = this.getPortraitKey('nova', 'happy');
      if (this.scene.textures.exists(portraitKey) && this.portrait.texture.key !== portraitKey) {
        console.log('[TutorialOverlay] Updating portrait texture...');
        this.portrait.setTexture(portraitKey);
        this.fitPortraitCover(this.portrait, this.PORTRAIT_SIZE);
      }
    }
  }

  /**
   * ✅ FIX: Правильное масштабирование портрета (как в CampaignDialogueOverlay)
   * Использует cover-fit подход для заполнения круга портретом
   */
  private fitPortraitCover(img: Phaser.GameObjects.Image, targetSize: number): void {
    // Force texture update to get dimensions
    const tex = this.scene.textures.get(img.texture.key);
    const src = tex.getSourceImage() as any;
    
    // Safety check
    const width = src?.width || img.width || 100;
    const height = src?.height || img.height || 100;

    // ✅ FIX: Если текстура меньше 600px, используем фиксированный масштаб для 512x512
    // Реальный размер PNG: 512x512, целевой размер круга: ~180px
    let scale: number;
    if (width < 600 && height < 600) {
      // Для текстур 512x512 используем фиксированный масштаб
      // targetSize = 180, исходник = 512, scale = 180/512 ≈ 0.35
      // Но лучше немного больше для cover: ~0.4-0.45
      scale = targetSize / 512 * 1.2; // 1.2 для cover (чтобы заполнить круг)
      console.log(`[TutorialOverlay] Using fixed scale for small texture ${img.texture.key}: ${width}x${height} -> scale ${scale.toFixed(3)}`);
    } else {
      // Для больших текстур используем обычный расчет
      const scaleX = targetSize / width;
      const scaleY = targetSize / height;
      scale = Math.max(scaleX, scaleY);
      console.log(`[TutorialOverlay] Scaling portrait ${img.texture.key}: ${width}x${height} -> scale ${scale.toFixed(3)}`);
    }
    
    // Apply scale
    img.setScale(scale);
  }

  /**
   * Подсвечивает юнита на поле с сообщением
   */
  public highlightUnit(
    unit: { x: number; y: number; capClass?: string; factionId?: string },
    message: string,
    onComplete?: () => void
  ): void {
    if (!this.isTutorialActive) {
      onComplete?.();
      return;
    }

    // Создаём графику для подсветки
    if (!this.highlightGraphics) {
      this.highlightGraphics = this.scene.add.graphics().setDepth(100);
    }
    this.highlightGraphics.clear();

    // Рисуем пульсирующий круг вокруг юнита
    const radius = 50;
    this.highlightGraphics.lineStyle(4, 0xffff00, 1);
    this.highlightGraphics.strokeCircle(unit.x, unit.y, radius);
    
    // Добавляем стрелку указывающую на юнита
    this.drawArrowToUnit(unit.x, unit.y);

    // Анимация пульсации
    let pulseScale = 1;
    if (this.highlightTween) {
      this.highlightTween.stop();
    }
    
    const redrawHighlight = () => {
      if (!this.highlightGraphics) return;
      this.highlightGraphics.clear();
      this.highlightGraphics.lineStyle(4, 0xffff00, 1.2 - pulseScale * 0.2);
      this.highlightGraphics.strokeCircle(unit.x, unit.y, radius * pulseScale);
      // Перерисовываем стрелку
      this.drawArrowToUnit(unit.x, unit.y);
    };
    
    this.highlightTween = this.scene.tweens.add({
      targets: { scale: 1 },
      scale: 1.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      onUpdate: (tween) => {
        pulseScale = tween.getValue();
        redrawHighlight();
      }
    });
    
    // Начальная отрисовка
    redrawHighlight();

    // Показываем сообщение
    this.showMessage(message, () => {
      this.clearHighlight();
      onComplete?.();
    });
  }

  /**
   * Рисует стрелку к юниту
   */
  private drawArrowToUnit(targetX: number, targetY: number): void {
    if (!this.arrowGraphics) {
      this.arrowGraphics = this.scene.add.graphics().setDepth(101);
    }
    this.arrowGraphics.clear();

    const { width } = this.scene.cameras.main;
    const startX = width / 2;
    const startY = 120; // Под панелью сообщений
    
    // Линия стрелки
    this.arrowGraphics.lineStyle(3, 0xffff00, 0.8);
    this.arrowGraphics.beginPath();
    this.arrowGraphics.moveTo(startX, startY);
    this.arrowGraphics.lineTo(targetX, targetY - 60);
    this.arrowGraphics.strokePath();
    
    // Наконечник стрелки
    const angle = Math.atan2(targetY - 60 - startY, targetX - startX);
    const arrowSize = 15;
    
    this.arrowGraphics.fillStyle(0xffff00, 0.8);
    this.arrowGraphics.beginPath();
    this.arrowGraphics.moveTo(targetX, targetY - 60);
    this.arrowGraphics.lineTo(
      targetX - arrowSize * Math.cos(angle - Math.PI / 6),
      targetY - 60 - arrowSize * Math.sin(angle - Math.PI / 6)
    );
    this.arrowGraphics.lineTo(
      targetX - arrowSize * Math.cos(angle + Math.PI / 6),
      targetY - 60 - arrowSize * Math.sin(angle + Math.PI / 6)
    );
    this.arrowGraphics.closePath();
    this.arrowGraphics.fillPath();
  }

  /**
   * Очищает подсветку
   */
  public clearHighlight(): void {
    if (this.highlightTween) {
      this.highlightTween.stop();
      this.highlightTween = undefined;
    }
    if (this.highlightGraphics) {
      this.highlightGraphics.clear();
    }
    if (this.arrowGraphics) {
      this.arrowGraphics.clear();
    }
  }

  /**
   * Подсвечивает несколько юнитов одновременно
   */
  public highlightMultipleUnits(
    units: Array<{ x: number; y: number }>,
    message: string,
    onComplete?: () => void
  ): void {
    if (!this.isTutorialActive) {
      onComplete?.();
      return;
    }

    if (!this.highlightGraphics) {
      this.highlightGraphics = this.scene.add.graphics().setDepth(100);
    }
    this.highlightGraphics.clear();
    if (this.arrowGraphics) this.arrowGraphics.clear();

    const radius = 50;
    
    // Функция перерисовки всех кругов
    const redraw = (scale: number) => {
      if (!this.highlightGraphics) return;
      this.highlightGraphics.clear();
      this.highlightGraphics.lineStyle(4, 0xffff00, 1.2 - scale * 0.2);
      
      units.forEach(unit => {
        this.highlightGraphics!.strokeCircle(unit.x, unit.y, radius * scale);
      });
    };

    // Анимация
    if (this.highlightTween) this.highlightTween.stop();
    
    let pulseScale = 1;
    const pulseTarget = { scale: 1 };
    this.highlightTween = this.scene.tweens.add({
      targets: pulseTarget,
      scale: 1.3,
      duration: 600,
      yoyo: true,
      repeat: -1,
      onUpdate: () => {
        pulseScale = pulseTarget.scale;
        redraw(pulseScale);
      }
    });

    // Начальная отрисовка
    redraw(1);

    this.showMessage(message, () => {
      this.clearHighlight(); // Важно: очищаем при завершении шага
      onComplete?.();
    });
  }

  /**
   * Последовательно показывает все фишки с описанием ролей
   */
  public async showUnitsIntroduction(
    playerUnits: Array<{ x: number; y: number; capClass: string; unitId: string }>,
    enemyUnits: Array<{ x: number; y: number; capClass: string; unitId: string }>,
    onComplete?: () => void
  ): Promise<void> {
    if (!this.isTutorialActive) {
      onComplete?.();
      return;
    }

    // ШАГ 1: Показываем ВСЕ фишки игрока сразу
    await new Promise<void>((resolve) => {
      this.highlightMultipleUnits(
        playerUnits,
        'В этом матче ты играешь тремя легендарными героями своей фракции. Почувствуй их невероятную мощь!',
        resolve
      );
    });

    // ШАГ 2: Кратко про врага
    await new Promise<void>((resolve) => {
      this.highlightMultipleUnits(
        enemyUnits,
        'А это твои противники. Победи их всех!',
        resolve
      );
    });

    // Финал
    this.showMessage('Отлично! Теперь ты знаешь расстановку сил. Начинаем!', () => {
      this.clearHighlight();
      onComplete?.();
    });
  }

  public destroy(): void {
    // ✅ FIX: Полная очистка всех ресурсов
    
    // Очищаем таймеры
    if (this.typeTimer) {
      this.typeTimer.remove();
      this.typeTimer = undefined;
    }
    
    // Останавливаем glitch эффект
    this.stopGlitchEffect();
    
    // Очищаем highlight
    this.clearHighlight();
    
    // Останавливаем все tweens на этом объекте
    this.scene?.tweens?.killTweensOf(this);
    
    // Уничтожаем графику
    this.highlightGraphics?.destroy();
    this.arrowGraphics?.destroy();
    
    super.destroy();
  }
}