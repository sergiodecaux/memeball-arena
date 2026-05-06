// 🧬 Ability Button with Charges Display + Cooldown Support
// ✅ ИСПРАВЛЕНО: Сохранен оригинальный дизайн, добавлен таймер (60s), убраны лишние вкладки

import Phaser from 'phaser';
import { 
  FactionId, 
  FACTIONS, 
  ABILITY_DEFINITIONS,
} from '../../constants/gameConstants';
import { Unit } from '../../entities/Unit';
import { AbilityManager } from '../../scenes/game/AbilityManager';
import { getUnitById } from '../../data/UnitsRepository';

export interface AbilityButtonConfig {
  abilityManager: AbilityManager;
  factionId: FactionId;
  onActivate?: (unit?: Unit) => void;
}

export class AbilityButton {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private config: AbilityButtonConfig;
  private abilityManager: AbilityManager;
  private factionId: FactionId;

  // Визуальные элементы (Оригинальные)
  private background: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private chargeBar: Phaser.GameObjects.Graphics;
  private chargeText: Phaser.GameObjects.Text;
  private cardBadge: Phaser.GameObjects.Container;
  private cardCountText: Phaser.GameObjects.Text;
  private statusText: Phaser.GameObjects.Text;
  private glowEffect: Phaser.GameObjects.Arc;
  private pulseEffect?: Phaser.Tweens.Tween;
  
  // Новые элементы для таймера
  private cooldownOverlay: Phaser.GameObjects.Graphics;
  private cooldownText: Phaser.GameObjects.Text;

  private currentUnit: Unit | null = null;
  private isVisible: boolean = false;
  private isReady: boolean = false;
  private isActivating: boolean = false;

  private readonly WIDTH = 80;
  private readonly HEIGHT = 100;

  constructor(scene: Phaser.Scene, config: AbilityButtonConfig) {
    this.scene = scene;
    this.config = config;
    this.abilityManager = config.abilityManager;
    this.factionId = config.factionId;

    this.container = scene.add.container(0, 0);
    this.container.setDepth(200);
    this.container.setVisible(false);
    this.container.setAlpha(0);
    this.container.setScrollFactor(0);

    this.createVisuals();
    this.setupInteraction();
    this.setupEventListeners();
  }

  private createVisuals(): void {
    const definition = ABILITY_DEFINITIONS[this.factionId];
    const faction = FACTIONS[this.factionId];

    // 1. Glow (Original)
    this.glowEffect = this.scene.add.circle(0, 0, this.WIDTH * 0.7, faction.color, 0);
    this.glowEffect.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(this.glowEffect);

    // 2. Background (Original logic)
    this.background = this.scene.add.graphics();
    this.drawBackground(faction.color, false);
    this.container.add(this.background);

    // 3. Icon
    this.iconText = this.scene.add.text(0, -20, definition.icon, {
      fontSize: '32px',
    }).setOrigin(0.5);
    this.container.add(this.iconText);

    // 4. Charge Bar & Text
    this.chargeBar = this.scene.add.graphics();
    this.container.add(this.chargeBar);

    this.chargeText = this.scene.add.text(0, 18, '0/3', {
      fontSize: '14px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.container.add(this.chargeText);

    // 5. Card Badge (Исправлено позиционирование "уха")
    this.cardBadge = this.scene.add.container(35, -45); // Смещено чуть правее и выше
    
    const badgeBg = this.scene.add.graphics();
    badgeBg.fillStyle(0x1a1a2e, 0.95);
    // Делаем аккуратный кружок или овал вместо прямоугольника, который выглядел как вкладка
    badgeBg.fillCircle(0, 0, 14); 
    badgeBg.lineStyle(2, 0xffd700, 1);
    badgeBg.strokeCircle(0, 0, 14);
    this.cardBadge.add(badgeBg);
    
    this.cardCountText = this.scene.add.text(0, 0, '+0', {
      fontSize: '12px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.cardBadge.add(this.cardCountText);
    
    this.cardBadge.setVisible(false);
    this.container.add(this.cardBadge);

    // 6. Status Text
    this.statusText = this.scene.add.text(0, 42, '', {
      fontSize: '10px',
      fontFamily: 'Rajdhani, Arial',
      color: '#888888',
      stroke: '#000000',
      strokeThickness: 1,
    }).setOrigin(0.5);
    this.container.add(this.statusText);

    // 7. Cooldown Overlay (НОВОЕ)
    this.cooldownOverlay = this.scene.add.graphics();
    this.container.add(this.cooldownOverlay);

    this.cooldownText = this.scene.add.text(0, 0, '', {
      fontSize: '28px',
      fontFamily: 'Orbitron, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false);
    this.container.add(this.cooldownText);

    this.updateVisuals();
  }

  private drawBackground(accentColor: number, isActivating: boolean): void {
    const w = this.WIDTH;
    const h = this.HEIGHT;
    const radius = 12;

    this.background.clear();
    
    if (isActivating) {
      this.background.lineStyle(3, 0xffcc00, 1);
    } else {
      this.background.lineStyle(2, accentColor, 0.8);
    }
    // Основной контур
    this.background.strokeRoundedRect(-w/2, -h/2, w, h, radius);
    
    const fillColor = isActivating ? 0x332200 : 0x1a1a2e;
    this.background.fillStyle(fillColor, 0.95);
    this.background.fillRoundedRect(-w/2, -h/2, w, h, radius);
    
    // Внутренняя обводка (деталь дизайна)
    this.background.lineStyle(1, 0xffffff, 0.15);
    this.background.strokeRoundedRect(-w/2 + 2, -h/2 + 2, w - 4, h - 4, radius - 2);
  }

  private drawChargeBar(): void {
    this.chargeBar.clear();
    
    const charges = this.getChargesCount();
    const maxCharges = this.getMaxChargesCount();
    
    const barWidth = 60;
    const barHeight = 8;
    const x = -barWidth / 2;
    const y = 8;
    const segmentGap = 4;
    const segmentWidth = (barWidth - segmentGap * (maxCharges - 1)) / maxCharges;
    
    for (let i = 0; i < maxCharges; i++) {
      const segX = x + i * (segmentWidth + segmentGap);
      
      this.chargeBar.fillStyle(0x333333, 1);
      this.chargeBar.fillRoundedRect(segX, y, segmentWidth, barHeight, 3);
      
      if (i < charges) {
        const color = FACTIONS[this.factionId].color;
        this.chargeBar.fillStyle(color, 1);
        this.chargeBar.fillRoundedRect(segX + 1, y + 1, segmentWidth - 2, barHeight - 2, 2);
      }
    }
    
    this.chargeText.setText(`${charges}/${maxCharges}`);
  }

  // Обновление состояния кнопки (включая таймер)
  public updateVisuals(): void {
    // 1. Проверяем Кулдаун
    const cooldown = this.abilityManager.getCooldownRemaining();
    const captainUltReady = this.isCaptainUltUiReady();

    if (cooldown > 0 && !captainUltReady) {
      // Режим перезарядки
      this.isReady = false;
      this.stopPulseAnimation();
      
      // Рисуем затемнение
      this.cooldownOverlay.clear();
      this.cooldownOverlay.fillStyle(0x000000, 0.7);
      this.cooldownOverlay.fillRoundedRect(-this.WIDTH/2, -this.HEIGHT/2, this.WIDTH, this.HEIGHT, 12);
      this.cooldownOverlay.setVisible(true);
      
      this.cooldownText.setText(cooldown.toString());
      this.cooldownText.setVisible(true);
      
      this.statusText.setText('COOLDOWN');
      this.statusText.setColor('#888888');
      
      // Скрываем лишнее
      this.chargeText.setVisible(false);
      this.iconText.setAlpha(0.3);
      this.drawBackground(0x333333, false);
      
      return; 
    } else {
      // Сбрасываем режим перезарядки
      this.cooldownOverlay.setVisible(false);
      this.cooldownText.setVisible(false);
      this.chargeText.setVisible(true);
      this.iconText.setAlpha(1);
    }

    // 2. Стандартный режим
    const charges = this.getChargesCount();
    const cards = this.getMatchCardsCount();
    const captainUltForCharge = this.isCaptainUltUiReady();
    const hasCharge = charges >= 1 || captainUltForCharge;
    
    this.isReady = hasCharge;

    this.drawChargeBar();

    // Обновляем бейдж (количество карт в колоде)
    if (cards > 0) {
      this.cardCountText.setText(`+${cards}`);
      this.cardBadge.setVisible(true);
    } else {
      this.cardBadge.setVisible(false);
    }

    const color = FACTIONS[this.factionId].color;
    
    if (this.isActivating) {
      this.statusText.setText('TAP TARGET');
      this.statusText.setColor('#ffcc00');
      this.drawBackground(0xffcc00, true);
      this.glowEffect.setFillStyle(0xffcc00, 0.3);
    } else if (hasCharge) {
      this.statusText.setText('READY');
      this.statusText.setColor('#00ff00');
      this.drawBackground(color, false);
    } else {
      this.statusText.setText('NO CARDS');
      this.statusText.setColor('#666666');
      this.drawBackground(0x333333, false);
    }

    if (this.isReady && !this.isActivating) {
      this.startPulseAnimation();
    } else if (!this.isActivating) {
      this.stopPulseAnimation();
    }
  }

  private setupInteraction(): void {
    const hitArea = this.scene.add.rectangle(0, 0, this.WIDTH, this.HEIGHT, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    this.container.add(hitArea);

    hitArea.on('pointerover', () => this.onHover());
    hitArea.on('pointerout', () => this.onHoverEnd());
    hitArea.on('pointerdown', () => this.onPress());
    hitArea.on('pointerup', () => this.onClick());
  }

  private setupEventListeners(): void {
    // Слушаем обновление каждый кадр для таймера
    this.scene.events.on('update', () => {
      if (this.isVisible) this.updateVisuals();
    });

    this.abilityManager.on('charge_gained', this.updateVisuals, this);
    this.abilityManager.on('charge_spent', this.updateVisuals, this);
    this.abilityManager.on('card_used', this.updateVisuals, this);
    this.abilityManager.on('target_selection_started', this.onActivationStarted, this);
    this.abilityManager.on('target_selection_cancelled', this.onActivationEnded, this);
    this.abilityManager.on('ability_activated', this.onActivationEnded, this);
  }

  private onHover(): void {
    if (!this.isReady) return;
    
    const color = FACTIONS[this.factionId].color;
    
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 100,
      ease: 'Cubic.easeOut',
    });

    this.glowEffect.setFillStyle(color, 0.3);
  }

  private onHoverEnd(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
      ease: 'Cubic.easeOut',
    });

    if (!this.isActivating) {
      this.glowEffect.setFillStyle(FACTIONS[this.factionId].color, 0);
    }
  }

  private onPress(): void {
    if (!this.isReady && !this.isActivating) return;
    
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
    });
  }

  private onClick(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
    });

    if (this.isActivating) {
      this.abilityManager.cancelActivation();
      return;
    }

    // Если кулдаун активен — трясем кнопку
    const cooldown = this.abilityManager.getCooldownRemaining();
    if (cooldown > 0 && !this.isCaptainUltUiReady()) {
      this.playNoChargeFeedback();
      return;
    }

    if (!this.isReady) {
      this.playNoChargeFeedback();
      return;
    }

    const success = this.tryStartActivation();
    
    if (success) {
      this.playActivationEffect();
      try {
        // Vibration API для Game режима
        if (navigator.vibrate) {
          navigator.vibrate(20);
        }
      } catch {}
      
      if (this.config.onActivate) {
        this.config.onActivate(this.currentUnit || undefined);
      }
    }
  }

  private playActivationEffect(): void {
    const color = FACTIONS[this.factionId].color;

    this.glowEffect.setFillStyle(color, 0.8);
    this.scene.tweens.add({
      targets: this.glowEffect,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.glowEffect.setAlpha(1);
      }
    });

    const ripple = this.scene.add.circle(
      this.container.x, 
      this.container.y, 
      this.WIDTH / 2, 
      color, 
      0.5
    );
    ripple.setDepth(199);
    ripple.setBlendMode(Phaser.BlendModes.ADD);
    ripple.setScrollFactor(0);

    this.scene.tweens.add({
      targets: ripple,
      scale: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => ripple.destroy(),
    });
  }

  private playNoChargeFeedback(): void {
    const startX = this.container.x;
    this.scene.tweens.add({
      targets: this.container,
      x: startX - 5,
      duration: 50,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        this.container.setX(startX);
      }
    });

    const color = this.abilityManager.getCooldownRemaining() > 0 ? 0x000000 : 0x660000;
    this.drawBackground(color, false);
    
    this.scene.time.delayedCall(200, () => {
      this.updateVisuals();
    });

    try {
      // Vibration API для Game режима
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30]);
      }
    } catch {}
  }

  private onActivationStarted(): void {
    this.isActivating = true;
    this.updateVisuals();
  }

  private onActivationEnded(): void {
    this.isActivating = false;
    this.updateVisuals();
  }

  public show(): void {
    if (this.isVisible) return;

    this.updateVisuals();

    const x = 60;
    const y = this.scene.scale.height - 100;
    this.container.setPosition(x, y);

    this.container.setVisible(true);
    this.container.setScale(0.5);
    this.container.setAlpha(0);

    this.scene.tweens.add({
      targets: this.container,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });

    this.isVisible = true;
    this.startPulseAnimation();
  }

  public hide(): void {
    if (!this.isVisible) return;

    this.stopPulseAnimation();

    this.scene.tweens.add({
      targets: this.container,
      scale: 0.5,
      alpha: 0,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
      }
    });

    this.isVisible = false;
  }

  public updatePosition(x: number, y: number): void {
    if (!this.isVisible) return;
    this.container.setPosition(x, y);
  }

  public refresh(): void {
    if (this.isVisible) {
      this.updateVisuals();
    }
  }

  public setCurrentUnit(unit: Unit | null): void {
    this.currentUnit = unit;

    if (unit && this.isCaptainUnit(unit)) {
      this.show();
    } else {
      this.hide();
    }

    this.updateVisuals();
  }

  private isCaptainUnit(unit: Unit): boolean {
    return Boolean(getUnitById(unit.getUnitId())?.isCaptain);
  }

  private startPulseAnimation(): void {
    if (this.pulseEffect || !this.isReady || this.isActivating) return;

    const color = FACTIONS[this.factionId].color;

    this.pulseEffect = this.scene.tweens.add({
      targets: this.glowEffect,
      alpha: { from: 0, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        this.glowEffect.setFillStyle(color, this.glowEffect.alpha * 0.4);
      }
    });
  }

  private stopPulseAnimation(): void {
    if (this.pulseEffect) {
      this.pulseEffect.stop();
      this.pulseEffect = undefined;
    }
    this.glowEffect.setFillStyle(FACTIONS[this.factionId].color, 0);
  }

  // ============================================================
  // HELPERS для совместимости
  // ============================================================

  private getChargesCount(): number {
    if (typeof this.abilityManager.getAvailableCards === 'function') {
      return this.abilityManager.getAvailableCards().length;
    }
    return 0;
  }

  private getMaxChargesCount(): number {
    return 3;
  }

  private getMatchCardsCount(): number {
    if (typeof this.abilityManager.getDeck === 'function') {
      const deck = this.abilityManager.getDeck();
      return deck.filter(s => s.cardId && !s.used).length;
    }
    return 0;
  }

  private isCaptainUltUiReady(): boolean {
    const u = this.currentUnit;
    if (!u) return false;
    const meta = getUnitById(u.getUnitId());
    if (!meta?.isCaptain) return false;
    return this.abilityManager.canActivateCaptainUlt();
  }

  private tryStartActivation(): boolean {
    const captainMeta = this.currentUnit ? getUnitById(this.currentUnit.getUnitId()) : undefined;
    if (captainMeta?.isCaptain && this.isCaptainUltUiReady()) {
      return this.activateCaptainAbility();
    }

    if (typeof this.abilityManager.startCardActivation === 'function') {
      // Ищем первую неиспользованную карту
      const deck = this.abilityManager.getDeck();
      const availableSlot = deck.findIndex(s => s.cardId && !s.used);
      if (availableSlot !== -1) {
        return this.abilityManager.startCardActivation(availableSlot);
      }
    }
    return false;
  }

  /**
   * Ульта капитана: applyCard + явный runtime id в unitIds (lastActiveUnit до выстрела часто другой).
   */
  private activateCaptainAbility(): boolean {
    if (!this.currentUnit) return false;

    const meta = getUnitById(this.currentUnit.getUnitId());
    if (!meta?.id || !meta.isCaptain) return false;

    console.log(`[AbilityButton] Activating captain ability for: ${meta.id}`);

    return this.abilityManager.applyCard(meta.id, {
      position: null,
      unitIds: [this.currentUnit.id],
    });
  }

  public destroy(): void {
    this.stopPulseAnimation();
    this.scene.events.off('update');
    this.abilityManager.off('charge_gained', this.updateVisuals, this);
    this.abilityManager.off('charge_spent', this.updateVisuals, this);
    this.abilityManager.off('card_used', this.updateVisuals, this);
    this.abilityManager.off('target_selection_started', this.onActivationStarted, this);
    this.abilityManager.off('target_selection_cancelled', this.onActivationEnded, this);
    this.abilityManager.off('ability_activated', this.onActivationEnded, this);
    this.container.destroy();
  }
}