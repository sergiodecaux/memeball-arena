// src/tutorial/TutorialVisuals.ts

import Phaser from 'phaser';

/**
 * Менеджер визуальных эффектов для обучения
 * Управляет подсветками, стрелками, зонами и анимациями
 */
export class TutorialVisuals {
  private scene: Phaser.Scene;
  
  // === Графические объекты ===
  private highlightGraphics: Phaser.GameObjects.Graphics | null = null;
  private arrowContainer: Phaser.GameObjects.Container | null = null;
  private targetZoneGraphics: Phaser.GameObjects.Graphics | null = null;
  private dimOverlay: Phaser.GameObjects.Graphics | null = null;
  private pulseCircle: Phaser.GameObjects.Graphics | null = null;
  private directionArrow: Phaser.GameObjects.Graphics | null = null;
  private hintContainer: Phaser.GameObjects.Container | null = null;
  
  // === Анимации ===
  private activeTweens: Phaser.Tweens.Tween[] = [];
  private pulseTimer: Phaser.Time.TimerEvent | null = null;
  
  // === Состояние ===
  private highlightedUnit: any = null;
  
  // === Константы ===
  private readonly HIGHLIGHT_COLOR = 0x00ff00;      // Зелёный
  private readonly TARGET_ZONE_COLOR = 0x00ff00;    // Зелёный
  private readonly ARROW_COLOR = 0xffff00;          // Жёлтый
  private readonly WARNING_COLOR = 0xff6600;        // Оранжевый
  private readonly DIM_ALPHA = 0.5;
  private readonly DEPTH_DIM = 90;
  private readonly DEPTH_HIGHLIGHT = 95;
  private readonly DEPTH_ARROW = 96;
  private readonly DEPTH_HINT = 100;
  
  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ПОДСВЕТКА ЮНИТА
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Подсветить юнита пульсирующим кругом
   */
  public highlightUnit(unit: any, color: number = this.HIGHLIGHT_COLOR): void {
    this.clearHighlight();
    
    if (!unit || !unit.sprite) {
      console.warn('[TutorialVisuals] Cannot highlight: invalid unit');
      return;
    }
    
    this.highlightedUnit = unit;
    
    // Создаём графику для подсветки
    this.highlightGraphics = this.scene.add.graphics();
    this.highlightGraphics.setDepth(this.DEPTH_HIGHLIGHT);
    
    // Создаём пульсирующий круг
    this.pulseCircle = this.scene.add.graphics();
    this.pulseCircle.setDepth(this.DEPTH_HIGHLIGHT - 1);
    
    const radius = unit.getRadius ? unit.getRadius() : 40;
    const x = unit.sprite.x;
    const y = unit.sprite.y;
    
    // Основной круг
    this.highlightGraphics.lineStyle(4, color, 1);
    this.highlightGraphics.strokeCircle(x, y, radius + 15);
    
    // Внутреннее свечение
    this.highlightGraphics.lineStyle(2, color, 0.5);
    this.highlightGraphics.strokeCircle(x, y, radius + 8);
    
    // Пульсирующий внешний круг
    this.pulseCircle.lineStyle(3, color, 0.8);
    this.pulseCircle.strokeCircle(x, y, radius + 20);
    
    // Анимация пульсации
    const pulseTween = this.scene.tweens.add({
      targets: this.pulseCircle,
      scaleX: 1.3,
      scaleY: 1.3,
      alpha: 0.2,
      duration: 800,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    this.activeTweens.push(pulseTween);
    
    // Обновление позиции при движении юнита
    this.pulseTimer = this.scene.time.addEvent({
      delay: 16,
      callback: () => this.updateHighlightPosition(),
      loop: true
    });
    
    console.log(`[TutorialVisuals] Highlighted unit at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  
  /**
   * Обновить позицию подсветки (следует за юнитом)
   */
  private updateHighlightPosition(): void {
    if (!this.highlightedUnit || !this.highlightedUnit.sprite) return;
    if (!this.highlightGraphics || !this.pulseCircle) return;
    
    const x = this.highlightedUnit.sprite.x;
    const y = this.highlightedUnit.sprite.y;
    const radius = this.highlightedUnit.getRadius ? this.highlightedUnit.getRadius() : 40;
    
    // Перерисовываем
    this.highlightGraphics.clear();
    this.highlightGraphics.lineStyle(4, this.HIGHLIGHT_COLOR, 1);
    this.highlightGraphics.strokeCircle(x, y, radius + 15);
    this.highlightGraphics.lineStyle(2, this.HIGHLIGHT_COLOR, 0.5);
    this.highlightGraphics.strokeCircle(x, y, radius + 8);
    
    // Пульсирующий круг следует с учётом scale
    this.pulseCircle.clear();
    this.pulseCircle.lineStyle(3, this.HIGHLIGHT_COLOR, 0.8);
    this.pulseCircle.strokeCircle(x, y, radius + 20);
  }
  
  /**
   * Очистить подсветку юнита
   */
  public clearHighlight(): void {
    if (this.highlightGraphics) {
      this.highlightGraphics.destroy();
      this.highlightGraphics = null;
    }
    if (this.pulseCircle) {
      this.pulseCircle.destroy();
      this.pulseCircle = null;
    }
    if (this.pulseTimer) {
      this.pulseTimer.remove();
      this.pulseTimer = null;
    }
    this.highlightedUnit = null;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // СТРЕЛКА К ЮНИТУ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Показать стрелку, указывающую на юнита с текстом
   */
  public showArrowToUnit(unit: any, text: string): void {
    this.clearArrow();
    
    if (!unit || !unit.sprite) {
      console.warn('[TutorialVisuals] Cannot show arrow: invalid unit');
      return;
    }
    
    const x = unit.sprite.x;
    const y = unit.sprite.y;
    const radius = unit.getRadius ? unit.getRadius() : 40;
    
    // Контейнер для стрелки и текста
    this.arrowContainer = this.scene.add.container(x, y - radius - 60);
    this.arrowContainer.setDepth(this.DEPTH_ARROW);
    
    // Текст
    const label = this.scene.add.text(0, -30, text, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center'
    }).setOrigin(0.5);
    
    // Стрелка вниз (треугольник)
    const arrow = this.scene.add.graphics();
    arrow.fillStyle(this.ARROW_COLOR, 1);
    arrow.beginPath();
    arrow.moveTo(0, 10);
    arrow.lineTo(-12, -10);
    arrow.lineTo(12, -10);
    arrow.closePath();
    arrow.fillPath();
    
    // Контур стрелки
    arrow.lineStyle(2, 0xffffff, 0.8);
    arrow.strokePath();
    
    this.arrowContainer.add([label, arrow]);
    
    // Анимация покачивания
    const bounceTween = this.scene.tweens.add({
      targets: this.arrowContainer,
      y: y - radius - 50,
      duration: 500,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    this.activeTweens.push(bounceTween);
    
    console.log(`[TutorialVisuals] Arrow shown: "${text}" at (${x.toFixed(0)}, ${y.toFixed(0)})`);
  }
  
  /**
   * Очистить стрелку
   */
  public clearArrow(): void {
    if (this.arrowContainer) {
      this.arrowContainer.destroy();
      this.arrowContainer = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ЦЕЛЕВАЯ ЗОНА
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Показать целевую зону для удара
   */
  public showTargetZone(x: number, y: number, radius: number, label?: string): void {
    this.clearTargetZone();
    
    this.targetZoneGraphics = this.scene.add.graphics();
    this.targetZoneGraphics.setDepth(this.DEPTH_HIGHLIGHT);
    
    // Начальная отрисовка
    this.drawTargetZone(x, y, radius);
    
    // Анимация пульсации
    let phase = 0;
    const pulseTimer = this.scene.time.addEvent({
      delay: 30,
      callback: () => {
        phase += 0.1;
        this.drawTargetZone(x, y, radius, phase);
      },
      loop: true
    });
    
    // Сохраняем таймер для очистки
    (this.targetZoneGraphics as any)._pulseTimer = pulseTimer;
    
    // Метка (опционально)
    if (label) {
      const text = this.scene.add.text(x, y - radius - 25, label, {
        fontFamily: 'Orbitron, sans-serif',
        fontSize: '16px',
        color: '#00ff00',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center'
      }).setOrigin(0.5).setDepth(this.DEPTH_ARROW);
      
      (this.targetZoneGraphics as any)._label = text;
    }
    
    console.log(`[TutorialVisuals] Target zone shown at (${x.toFixed(0)}, ${y.toFixed(0)}) r=${radius}`);
  }
  
  /**
   * Отрисовать целевую зону с анимацией
   */
  private drawTargetZone(x: number, y: number, radius: number, phase: number = 0): void {
    if (!this.targetZoneGraphics) return;
    
    this.targetZoneGraphics.clear();
    
    const pulse = 0.7 + Math.sin(phase) * 0.3;
    const pulseRadius = radius * (0.95 + Math.sin(phase * 0.7) * 0.05);
    
    // Заливка
    this.targetZoneGraphics.fillStyle(this.TARGET_ZONE_COLOR, 0.1 * pulse);
    this.targetZoneGraphics.fillCircle(x, y, pulseRadius);
    
    // Внешний круг
    this.targetZoneGraphics.lineStyle(3, this.TARGET_ZONE_COLOR, pulse * 0.9);
    this.targetZoneGraphics.strokeCircle(x, y, pulseRadius);
    
    // Средний круг
    this.targetZoneGraphics.lineStyle(2, this.TARGET_ZONE_COLOR, 0.5);
    this.targetZoneGraphics.strokeCircle(x, y, radius * 0.6);
    
    // Внутренний круг
    this.targetZoneGraphics.lineStyle(2, this.TARGET_ZONE_COLOR, 0.7);
    this.targetZoneGraphics.strokeCircle(x, y, radius * 0.25);
    
    // Перекрестие
    const crossSize = radius * 0.35;
    this.targetZoneGraphics.lineStyle(2, this.TARGET_ZONE_COLOR, 0.6);
    this.targetZoneGraphics.beginPath();
    this.targetZoneGraphics.moveTo(x - crossSize, y);
    this.targetZoneGraphics.lineTo(x + crossSize, y);
    this.targetZoneGraphics.moveTo(x, y - crossSize);
    this.targetZoneGraphics.lineTo(x, y + crossSize);
    this.targetZoneGraphics.strokePath();
  }
  
  /**
   * Очистить целевую зону
   */
  public clearTargetZone(): void {
    if (this.targetZoneGraphics) {
      const timer = (this.targetZoneGraphics as any)._pulseTimer;
      if (timer) timer.remove();
      
      const label = (this.targetZoneGraphics as any)._label;
      if (label) label.destroy();
      
      this.targetZoneGraphics.destroy();
      this.targetZoneGraphics = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // СТРЕЛКА НАПРАВЛЕНИЯ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Показать стрелку направления от юнита к цели
   */
  public showDirectionArrow(fromX: number, fromY: number, toX: number, toY: number): void {
    this.clearDirectionArrow();
    
    this.directionArrow = this.scene.add.graphics();
    this.directionArrow.setDepth(this.DEPTH_ARROW);
    
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const distance = Phaser.Math.Distance.Between(fromX, fromY, toX, toY);
    
    // Пунктирная линия
    const dashLength = 15;
    const gapLength = 10;
    const totalLength = dashLength + gapLength;
    const numDashes = Math.floor(distance / totalLength);
    
    this.directionArrow.lineStyle(3, this.ARROW_COLOR, 0.8);
    
    for (let i = 0; i < numDashes; i++) {
      const startDist = i * totalLength;
      const endDist = startDist + dashLength;
      
      const startX = fromX + Math.cos(angle) * startDist;
      const startY = fromY + Math.sin(angle) * startDist;
      const endX = fromX + Math.cos(angle) * Math.min(endDist, distance);
      const endY = fromY + Math.sin(angle) * Math.min(endDist, distance);
      
      this.directionArrow.beginPath();
      this.directionArrow.moveTo(startX, startY);
      this.directionArrow.lineTo(endX, endY);
      this.directionArrow.strokePath();
    }
    
    // Наконечник стрелки
    const arrowSize = 18;
    const arrowAngle = Math.PI / 6;
    
    this.directionArrow.fillStyle(this.ARROW_COLOR, 1);
    this.directionArrow.beginPath();
    this.directionArrow.moveTo(toX, toY);
    this.directionArrow.lineTo(
      toX - arrowSize * Math.cos(angle - arrowAngle),
      toY - arrowSize * Math.sin(angle - arrowAngle)
    );
    this.directionArrow.lineTo(
      toX - arrowSize * Math.cos(angle + arrowAngle),
      toY - arrowSize * Math.sin(angle + arrowAngle)
    );
    this.directionArrow.closePath();
    this.directionArrow.fillPath();
    
    // Анимация пульсации
    const pulseTween = this.scene.tweens.add({
      targets: this.directionArrow,
      alpha: { from: 0.5, to: 1 },
      duration: 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });
    this.activeTweens.push(pulseTween);
    
    console.log(`[TutorialVisuals] Direction arrow: (${fromX.toFixed(0)}, ${fromY.toFixed(0)}) → (${toX.toFixed(0)}, ${toY.toFixed(0)})`);
  }
  
  /**
   * Очистить стрелку направления
   */
  public clearDirectionArrow(): void {
    if (this.directionArrow) {
      this.directionArrow.destroy();
      this.directionArrow = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ЗАТЕМНЕНИЕ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Затемнить всё кроме указанной области
   */
  public dimExcept(x: number, y: number, radius: number): void {
    this.clearDim();
    
    const { width, height } = this.scene.scale;
    
    this.dimOverlay = this.scene.add.graphics();
    this.dimOverlay.setDepth(this.DEPTH_DIM);
    
    // Затемнение всего экрана
    this.dimOverlay.fillStyle(0x000000, this.DIM_ALPHA);
    this.dimOverlay.fillRect(0, 0, width, height);
    
    // Вырезаем круг (прозрачная область)
    this.dimOverlay.fillStyle(0x000000, 0);
    this.dimOverlay.beginPath();
    this.dimOverlay.arc(x, y, radius + 20, 0, Math.PI * 2);
    this.dimOverlay.closePath();
    
    // Используем blend mode для "вырезания"
    // Это сложнее, поэтому используем альтернативный подход
    
    // Альтернатива: рисуем 4 прямоугольника вокруг круга
    this.dimOverlay.clear();
    this.dimOverlay.fillStyle(0x000000, this.DIM_ALPHA);
    
    // Верхняя часть
    this.dimOverlay.fillRect(0, 0, width, Math.max(0, y - radius - 30));
    // Нижняя часть  
    this.dimOverlay.fillRect(0, y + radius + 30, width, height - y - radius - 30);
    // Левая часть
    this.dimOverlay.fillRect(0, y - radius - 30, Math.max(0, x - radius - 30), radius * 2 + 60);
    // Правая часть
    this.dimOverlay.fillRect(x + radius + 30, y - radius - 30, width - x - radius - 30, radius * 2 + 60);
  }
  
  /**
   * Очистить затемнение
   */
  public clearDim(): void {
    if (this.dimOverlay) {
      this.dimOverlay.destroy();
      this.dimOverlay = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ПОДСКАЗКИ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Показать подсказку внизу экрана
   */
  public showHint(text: string, icon?: string): void {
    this.clearHint();
    
    const { width, height } = this.scene.scale;
    
    this.hintContainer = this.scene.add.container(width / 2, height - 100);
    this.hintContainer.setDepth(this.DEPTH_HINT);
    
    // Фон подсказки
    const padding = 20;
    const bg = this.scene.add.graphics();
    
    // Текст
    const hintText = this.scene.add.text(0, 0, text, {
      fontFamily: 'Orbitron, sans-serif',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
      align: 'center',
      wordWrap: { width: width * 0.8 }
    }).setOrigin(0.5);
    
    // Размеры фона
    const bgWidth = hintText.width + padding * 2;
    const bgHeight = hintText.height + padding * 2;
    
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 12);
    bg.lineStyle(2, this.HIGHLIGHT_COLOR, 0.8);
    bg.strokeRoundedRect(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight, 12);
    
    this.hintContainer.add([bg, hintText]);
    
    // Анимация появления
    this.hintContainer.setAlpha(0);
    this.hintContainer.setY(height - 80);
    
    this.scene.tweens.add({
      targets: this.hintContainer,
      alpha: 1,
      y: height - 100,
      duration: 300,
      ease: 'Back.out'
    });
    
    console.log(`[TutorialVisuals] Hint shown: "${text}"`);
  }
  
  /**
   * Показать подсказку жеста (потяни и отпусти)
   */
  public showDragHint(): void {
    this.showHint('👆 Потяни НАЗАД и отпусти, чтобы ударить!');
  }
  
  /**
   * Очистить подсказку
   */
  public clearHint(): void {
    if (this.hintContainer) {
      this.hintContainer.destroy();
      this.hintContainer = null;
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // ОБЩИЕ МЕТОДЫ
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Очистить все визуальные элементы
   */
  public clearAll(): void {
    // Останавливаем все анимации
    this.activeTweens.forEach(tween => {
      if (tween && tween.isPlaying()) {
        tween.stop();
      }
    });
    this.activeTweens = [];
    
    // Очищаем все элементы
    this.clearHighlight();
    this.clearArrow();
    this.clearTargetZone();
    this.clearDirectionArrow();
    this.clearDim();
    this.clearHint();
    
    console.log('[TutorialVisuals] All visuals cleared');
  }
  
  /**
   * Уничтожить менеджер
   */
  public destroy(): void {
    this.clearAll();
    console.log('[TutorialVisuals] Destroyed');
  }
}
