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

const devAbilityBtnLog = (...args: unknown[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

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
    const isCaptain = Boolean(this.currentUnit && this.isCaptainUnit(this.currentUnit));
    const captainUltReady = isCaptain && this.isCaptainUltUiReady();

    const cooldown = this.abilityManager.getCooldownRemaining();

    if (cooldown > 0 && !captainUltReady) {
      this.isReady = false;
      this.stopPulseAnimation();

      this.cooldownOverlay.clear();
      this.cooldownOverlay.fillStyle(0x000000, 0.7);
      this.cooldownOverlay.fillRoundedRect(-this.WIDTH / 2, -this.HEIGHT / 2, this.WIDTH, this.HEIGHT, 12);
      this.cooldownOverlay.setVisible(true);

      this.cooldownText.setText(cooldown.toString());
      this.cooldownText.setVisible(true);

      this.statusText.setText(isCaptain ? 'CHARGING' : 'COOLDOWN');
      this.statusText.setColor('#888888');

      this.chargeBar.clear();
      this.chargeText.setVisible(false);
      this.iconText.setAlpha(0.3);
      this.drawBackground(0x333333, false);

      return;
    }

    this.cooldownOverlay.setVisible(false);
    this.cooldownText.setVisible(false);
    this.chargeText.setVisible(true);
    this.iconText.setAlpha(1);

    if (captainUltReady) {
      this.chargeBar.clear();
      this.chargeText.setText('⚡100%');

      this.statusText.setText('ULTIMATE READY');
      this.statusText.setColor('#ffd700');

      const color = FACTIONS[this.factionId].color;
      this.drawBackground(color, false);
      this.isReady = true;

      this.cardBadge.setVisible(false);
      this.startPulseAnimation();
      return;
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

  private canInteractAbility(): boolean {
    return this.isReady || this.isActivating || this.isCaptainUltUiReady();
  }

  private onHover(): void {
    if (!this.canInteractAbility()) return;
    
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
    if (!this.canInteractAbility() && !this.isActivating) return;
    
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 50,
    });
  }

  private onClick(): void {
    devAbilityBtnLog('[AbilityButton] onClick', {
      isActivating: this.isActivating,
      isReady: this.isReady,
      currentUnit: this.currentUnit?.id,
    });

    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1,
      scaleY: 1,
      duration: 100,
    });

    if (this.isActivating) {
      devAbilityBtnLog('[AbilityButton] Cancel activation');
      this.abilityManager.cancelActivation();
      return;
    }

    const captainMeta = this.currentUnit ? getUnitById(this.currentUnit.getUnitId()) : undefined;
    const ultReady = this.isCaptainUltUiReady();
    const isCaptainUlt = captainMeta?.isCaptain === true && ultReady;

    devAbilityBtnLog('[AbilityButton] Captain check', {
      isCaptain: captainMeta?.isCaptain,
      ultReady,
      isCaptainUlt,
    });

    if (!isCaptainUlt) {
      const cooldown = this.abilityManager.getCooldownRemaining();
      if (cooldown > 0) {
        devAbilityBtnLog(`[AbilityButton] Cooldown active: ${cooldown}s`);
        this.playNoChargeFeedback();
        return;
      }
    }

    if (!this.isReady && !isCaptainUlt) {
      devAbilityBtnLog('[AbilityButton] Not ready and not captain ult');
      this.playNoChargeFeedback();
      return;
    }

    devAbilityBtnLog('[AbilityButton] Attempting activation...');
    const success = this.tryStartActivation();
    devAbilityBtnLog(`[AbilityButton] Activation result: ${success ? 'SUCCESS' : 'FAILED'}`);

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

    const mgr = this.abilityManager;
    if (typeof mgr.canActivateCaptainUlt !== 'function') {
      if (import.meta.env.DEV) {
        console.warn('[AbilityButton] canActivateCaptainUlt missing on AbilityManager');
      }
      return false;
    }

    const ok = mgr.canActivateCaptainUlt();
    devAbilityBtnLog('[AbilityButton] isCaptainUltUiReady:', ok);
    return ok;
  }

  private tryStartActivation(): boolean {
    const captainMeta = this.currentUnit ? getUnitById(this.currentUnit.getUnitId()) : undefined;
    const isCaptain = captainMeta?.isCaptain === true;

    devAbilityBtnLog('[AbilityButton] tryStartActivation', {
      isCaptain,
      currentUnitId: this.currentUnit?.id,
      captainMetaId: captainMeta?.id,
      ultReady: this.isCaptainUltUiReady(),
    });

    if (isCaptain) {
      if (!this.isCaptainUltUiReady()) {
        if (import.meta.env.DEV) {
          console.warn('[AbilityButton] Captain ultimate not ready (no energy)');
        }
        return false;
      }
      return this.activateCaptainAbility();
    }

    if (typeof this.abilityManager.startCardActivation === 'function') {
      const deck = this.abilityManager.getDeck();
      const availableSlot = deck.findIndex((s) => s.cardId && !s.used);
      if (availableSlot !== -1) {
        devAbilityBtnLog(`[AbilityButton] Starting card activation slot ${availableSlot}`);
        return this.abilityManager.startCardActivation(availableSlot);
      }
      if (import.meta.env.DEV) {
        console.warn('[AbilityButton] No available card slots');
      }
    }

    return false;
  }

  /**
   * Ульта капитана: applyCard + явный runtime id в unitIds (lastActiveUnit до выстрела часто другой).
   */
  private activateCaptainAbility(): boolean {
    if (!this.currentUnit) {
      console.error('[AbilityButton] Cannot activate captain ability — no current unit');
      return false;
    }

    const meta = getUnitById(this.currentUnit.getUnitId());
    if (!meta?.id || !meta.isCaptain) {
      console.error('[AbilityButton] Cannot activate — not a captain unit', {
        unitId: this.currentUnit.getUnitId(),
        metaId: meta?.id,
        isCaptain: meta?.isCaptain,
      });
      return false;
    }

    devAbilityBtnLog('[AbilityButton] Activating captain ability', {
      catalogId: meta.id,
      runtimeId: this.currentUnit.id,
      name: meta.name,
    });

    if (meta.id === 'captain_chronos') {
      devAbilityBtnLog('[AbilityButton] Chronos — targeting mode');
      const ok = this.abilityManager.beginCaptainUltTargeting();
      devAbilityBtnLog('[AbilityButton] Chronos targeting:', ok);
      return ok;
    }

    const success = this.abilityManager.applyCard(meta.id, {
      position: null,
      unitIds: [this.currentUnit.id],
    });
    devAbilityBtnLog('[AbilityButton] Captain ability result:', success);
    return success;
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