import Phaser from 'phaser';
import { getColors, getFonts, hexToString } from '../../config/themes';
import { AudioManager } from '../../managers/AudioManager';
import {
  luckyWheelManager,
  LUCKY_WHEEL_REWARDS,
  LuckyWheelReward,
  type LuckyWheelRewardTier,
} from '../../data/LuckyWheelManager';
import { hapticImpact } from '../../utils/Haptics';
import { tgApp } from '../../utils/TelegramWebApp';

function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

const TIER_SLICE_PAIR: Record<LuckyWheelRewardTier, readonly [number, number]> = {
  common: [0x243548, 0x1a2332],
  rare: [0x4f46e5, 0x3730a3],
  epic: [0xb02686, 0x701a75],
  legendary: [0x9333ea, 0x581c87],
};

const TIER_EDGE: Record<LuckyWheelRewardTier, number> = {
  common: 0x64748b,
  rare: 0xa5b4fc,
  epic: 0xf0abfc,
  legendary: 0xfef08a,
};

const TIER_TITLE: Record<LuckyWheelRewardTier, string> = {
  common: 'НАГРАДА',
  rare: 'РЕДКИЙ ПРИЗ',
  epic: 'ЭПИЧЕСКИЙ ПРИЗ',
  legendary: 'МЕГА-ПРИЗ!',
};

const TIER_LABEL_HEX: Record<LuckyWheelRewardTier, string> = {
  common: '#f1f5f9',
  rare: '#eef2ff',
  epic: '#fdf4ff',
  legendary: '#fef9c3',
};

const TIER_TITLE_HEX: Record<LuckyWheelRewardTier, string> = {
  common: '#94a3b8',
  rare: '#a5b4fc',
  epic: '#f0abfc',
  legendary: '#fef08a',
};

function getSliceRewardVisual(row: LuckyWheelReward): { icon: string; amount: string } {
  if (row.coins != null && row.coins > 0) {
    return { icon: '🪙', amount: String(row.coins) };
  }
  if (row.crystals != null && row.crystals > 0) {
    return { icon: '💎', amount: String(row.crystals) };
  }
  if (row.bpXp != null && row.bpXp > 0) {
    return { icon: '⚡', amount: String(row.bpXp) };
  }
  if (row.fragments != null && row.fragments > 0) {
    return { icon: '🧩', amount: String(row.fragments) };
  }
  return { icon: '✦', amount: row.label.slice(0, 8) };
}

/**
 * Колесо удачи — крупное колесо по центру экрана, минимум «коробки», акцент как в магазине.
 */
export class LuckyWheelOverlay extends Phaser.GameObjects.Container {
  private readonly wheelRoot: Phaser.GameObjects.Container;
  private readonly spinBtnLabel: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private spinning = false;

  constructor(scene: Phaser.Scene, private readonly onClosed?: () => void) {
    super(scene, 0, 0);

    const { width, height } = scene.cameras.main;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();
    const colors = getColors();

    const vignette = scene.add.graphics();
    vignette.fillGradientStyle(0x030712, 0x020617, 0x020617, 0x010409, 0.94, 0.94, 0.94, 0.97);
    vignette.fillRect(0, 0, width, height);
    this.add(vignette);

    const dim = scene.add.rectangle(width / 2, height / 2, width + 80, height + 80, 0x020617, 0.42);
    this.add(dim);

    const cx = width / 2;
    const topSafe = tgApp.getTopInset();
    const headerRowY = Math.max(28 * s, topSafe + 18 * s);

    const radius = Math.min(width * 0.44, height * 0.32, 200 * s);
    const cy = Phaser.Math.Clamp(headerRowY + 42 * s + radius + 24 * s, height * 0.38, height * 0.55);

    const closeHeader = scene.add
      .text(14 * s, headerRowY, '✕  Закрыть', {
        fontFamily: fonts.tech,
        fontSize: `${Math.round(14 * s)}px`,
        color: hexToString(colors.uiAccent),
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    closeHeader.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      this.close();
    });
    this.add(closeHeader);

    const title = scene.add
      .text(cx, headerRowY, '✦ КОЛЕСО УДАЧИ ✦', {
        fontFamily: fonts.tech,
        fontSize: `${Math.round(18 * s)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0.5);
    this.add(title);

    this.hintText = scene.add
      .text(
        cx,
        headerRowY + 26 * s,
        'Бесплатно раз в 12 ч • цвет сектора = редкость приза',
        {
          fontFamily: fonts.primary,
          fontSize: `${10 * s}px`,
          color: hexToString(colors.uiAccent),
          align: 'center',
          wordWrap: { width: width - 36 },
        }
      )
      .setOrigin(0.5);
    this.add(this.hintText);

    this.wheelRoot = scene.add.container(cx, cy);

    const glow = scene.add.graphics();
    for (let ring = 1; ring >= 0; ring--) {
      const r = radius * (1.05 + ring * 0.055);
      glow.lineStyle(8 - ring * 3, colors.uiAccent, 0.06 + ring * 0.04);
      glow.strokeCircle(0, 0, r);
    }
    this.wheelRoot.add(glow);

    /** Полноразмерный PNG обода часто даёт «плоское оранжевое пятно» — обод рисуем поверх секторов отдельно. */
    const backPlate = scene.add.graphics();
    backPlate.fillStyle(0x020617, 1);
    backPlate.fillCircle(0, 0, radius * 0.985);
    backPlate.lineStyle(5, 0x0f172a, 0.95);
    backPlate.strokeCircle(0, 0, radius * 0.98);
    this.wheelRoot.add(backPlate);

    const sliceGfx = scene.add.graphics();
    const n = LUCKY_WHEEL_REWARDS.length;
    const slice = (Math.PI * 2) / n;
    const outerR = radius * 0.93;

    for (let i = 0; i < n; i++) {
      const tier = LUCKY_WHEEL_REWARDS[i].tier;
      const [cA, cB] = TIER_SLICE_PAIR[tier];
      const a0 = -Math.PI / 2 + i * slice;
      const a1 = a0 + slice;
      sliceGfx.fillStyle(i % 2 === 0 ? cA : cB, 1);
      sliceGfx.slice(0, 0, outerR, a0, a1, true);
      sliceGfx.fillPath();
      sliceGfx.lineStyle(2, TIER_EDGE[tier], tier === 'legendary' ? 1 : 0.78);
      sliceGfx.slice(0, 0, outerR, a0, a1, true);
      sliceGfx.strokePath();
    }

    sliceGfx.lineStyle(4, 0xfbbf24, 0.5);
    sliceGfx.strokeCircle(0, 0, outerR);
    sliceGfx.lineStyle(6, 0x1e293b, 1);
    sliceGfx.strokeCircle(0, 0, radius * 0.985);
    sliceGfx.lineStyle(2, 0xfbbf24, 0.35);
    sliceGfx.strokeCircle(0, 0, radius * 0.965);

    const hubHoleR = radius * 0.2;
    sliceGfx.fillStyle(0x060b14, 1);
    sliceGfx.fillCircle(0, 0, hubHoleR);
    sliceGfx.lineStyle(2, 0x475569, 0.85);
    sliceGfx.strokeCircle(0, 0, hubHoleR);

    this.wheelRoot.add(sliceGfx);

    const hasLegendarySlice = LUCKY_WHEEL_REWARDS.some((r) => r.tier === 'legendary');
    if (hasLegendarySlice) {
      const legGlow = scene.add.graphics();
      legGlow.lineStyle(6, 0xfef08a, 0.5);
      legGlow.strokeCircle(0, 0, outerR * 0.97);
      this.wheelRoot.add(legGlow);
      scene.tweens.add({
        targets: legGlow,
        alpha: { from: 0.3, to: 0.8 },
        duration: 800,
        yoyo: true,
        repeat: -1,
      });
    }

    for (let i = 0; i < n; i++) {
      const mid = -Math.PI / 2 + (i + 0.5) * slice;
      const rewardRadius = outerR * 0.6;
      const rx = Math.cos(mid) * rewardRadius;
      const ry = Math.sin(mid) * rewardRadius;
      const row = LUCKY_WHEEL_REWARDS[i];
      const { icon, amount } = getSliceRewardVisual(row);

      const iconTxt = scene.add
        .text(rx, ry - 12 * s, icon, {
          fontSize: `${Math.round(22 * s)}px`,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      this.wheelRoot.add(iconTxt);

      this.wheelRoot.add(
        scene.add
          .text(rx, ry + 8 * s, amount, {
            fontSize: `${Math.round(16 * s)}px`,
            fontStyle: 'bold',
            color: TIER_LABEL_HEX[row.tier],
            stroke: '#020617',
            strokeThickness: Math.max(2, Math.round(3 * s)),
          })
          .setOrigin(0.5),
      );
    }

    const hubR = Math.round(21 * s);
    const hubGlowGfx = scene.add.graphics();
    hubGlowGfx.fillStyle(colors.uiAccent, 0.42);
    hubGlowGfx.fillCircle(0, 0, hubR + 14 * s);
    hubGlowGfx.lineStyle(8, colors.uiAccent, 0.2);
    hubGlowGfx.strokeCircle(0, 0, hubR + 16 * s);
    this.wheelRoot.add(hubGlowGfx);
    scene.tweens.add({
      targets: hubGlowGfx,
      scaleX: { from: 1, to: 1.1 },
      scaleY: { from: 1, to: 1.1 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const hubMetal = scene.add.graphics();
    hubMetal.lineStyle(5, 0xf8fafc, 0.55);
    hubMetal.strokeCircle(0, 0, hubR + 5 * s);
    hubMetal.lineStyle(3, 0x475569, 0.95);
    hubMetal.strokeCircle(0, 0, hubR + 2 * s);
    hubMetal.lineStyle(2, 0x1e293b, 1);
    hubMetal.strokeCircle(0, 0, hubR - 1 * s);
    this.wheelRoot.add(hubMetal);

    const hubShine = scene.add.graphics();
    hubShine.fillStyle(0xffffff, 0.28);
    hubShine.fillCircle(-hubR * 0.34, -hubR * 0.34, Math.max(6, hubR * 0.42));
    hubShine.setBlendMode(Phaser.BlendModes.ADD);
    this.wheelRoot.add(hubShine);
    scene.tweens.add({
      targets: hubShine,
      alpha: { from: 0.1, to: 0.42 },
      duration: 950,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    scene.tweens.add({
      targets: hubShine,
      angle: 360,
      duration: 9000,
      repeat: -1,
      ease: 'Linear',
    });

    const centerKey = 'ui_lucky_wheel_center';
    if (scene.textures.exists(centerKey)) {
      this.wheelRoot.add(scene.add.image(0, 0, centerKey).setDisplaySize(hubR * 2.2, hubR * 2.2));
    } else {
      const hub = scene.add.circle(0, 0, hubR, 0xfbbf24, 1);
      hub.setStrokeStyle(4, 0xfffbeb, 0.95);
      this.wheelRoot.add(hub);
      this.wheelRoot.add(
        scene.add
          .text(0, 0, '★', {
            fontSize: `${16 * s}px`,
            color: '#1c1917',
            fontStyle: 'bold',
          })
          .setOrigin(0.5),
      );
    }

    this.add(this.wheelRoot);

    const ptrKey = 'ui_lucky_wheel_pointer';
    const ptrY = cy - radius - 22 * s;
    const ptrScale = 1.35 * s;
    if (scene.textures.exists(ptrKey)) {
      const ptr = scene.add.image(cx, ptrY, ptrKey).setDisplaySize(46 * ptrScale, 56 * ptrScale);
      this.add(ptr);
    } else {
      const pointer = scene.add.triangle(cx, ptrY, 0, 22 * s, -14 * s, 0, 14 * s, 0, 0xfbbf24, 1);
      pointer.setStrokeStyle(3, 0xfffbeb, 1);
      this.add(pointer);
    }

    const btnW = Math.min(width - 48 * s, 340 * s);
    const btnH = 50 * s;
    const btnY = Math.min(height - Math.max(56 * s, tgApp.getBottomInset() + 32 * s), cy + radius + 62 * s);
    const spinBg = scene.add.graphics();
    spinBg.fillGradientStyle(colors.uiAccent, colors.uiSecondary, colors.uiSecondary, colors.uiAccent, 1, 1, 1, 1);
    spinBg.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    spinBg.lineStyle(3, 0xffffff, 0.55);
    spinBg.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, btnH / 2);
    this.add(spinBg);

    this.spinBtnLabel = scene.add
      .text(cx, btnY, 'КРУТИТЬ', {
        fontFamily: fonts.tech,
        fontSize: `${16 * s}px`,
        color: '#f8fafc',
        fontStyle: 'bold',
        stroke: '#0f172a',
        strokeThickness: Math.max(3, Math.round(3 * s)),
      })
      .setOrigin(0.5);
    this.add(this.spinBtnLabel);

    const spinHit = scene.add.rectangle(cx, btnY, btnW, btnH, 0x000000, 0);
    spinHit.setInteractive({ useHandCursor: true });
    spinHit.on('pointerdown', () => this.trySpin());
    this.add(spinHit);

    this.setDepth(12000);
    this.refreshButtonState();
    scene.add.existing(this);
  }

  private refreshButtonState(): void {
    if (luckyWheelManager.canSpin()) {
      this.spinBtnLabel.setText('КРУТИТЬ');
      this.spinBtnLabel.setAlpha(1);
      this.hintText.setText('Бесплатно раз в 12 ч • цвет сектора = редкость приза');
    } else {
      const left = luckyWheelManager.getMsUntilNextSpin();
      this.spinBtnLabel.setText(`Через ${formatCooldown(left)}`);
      this.spinBtnLabel.setAlpha(0.55);
      this.hintText.setText(`Следующая крутка через ${formatCooldown(left)}`);
    }
  }

  private trySpin(): void {
    if (this.spinning) return;
    const result = luckyWheelManager.spin();
    if (!result.ok) {
      AudioManager.getInstance().playUIClick();
      this.refreshButtonState();
      return;
    }

    this.spinning = true;
    AudioManager.getInstance().playUIClick();
    hapticImpact('heavy');

    const n = LUCKY_WHEEL_REWARDS.length;
    const slice = (Math.PI * 2) / n;
    const centerAngle = -Math.PI / 2 + (result.index + 0.5) * slice;
    const spins = 6 + Math.floor(Math.random() * 3);
    const targetRotation = spins * Math.PI * 2 + (-Math.PI / 2 - centerAngle);

    const tickEvent = this.scene.time.addEvent({
      delay: 80,
      loop: true,
      callback: () => {
        AudioManager.getInstance().playSFX('sfx_tick', { volume: 0.2 });
      },
    });

    this.scene.tweens.add({
      targets: this.wheelRoot,
      rotation: targetRotation,
      duration: 2600,
      ease: 'Cubic.out',
      onComplete: () => {
        tickEvent.remove(false);

        const twopi = Math.PI * 2;
        this.wheelRoot.rotation = ((this.wheelRoot.rotation % twopi) + twopi) % twopi;

        this.scene.cameras.main.shake(180, 0.004);

        this.wheelRoot.setScale(1.05);
        this.scene.tweens.add({
          targets: this.wheelRoot,
          scale: 1,
          duration: 250,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.spinning = false;
            this.showResult(result.reward);
            this.refreshButtonState();
          },
        });
      },
    });
  }

  private showResult(reward: LuckyWheelReward): void {
    AudioManager.getInstance().playSFX('sfx_card_pop', { volume: 0.55 });
    AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.65 });

    const { width, height } = this.scene.cameras.main;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();
    const colors = getColors();
    const tier = reward.tier;
    const accent = TIER_EDGE[tier];

    const modal = this.scene.add.container(width / 2, height * 0.45).setDepth(12001);
    const dim = this.scene.add.rectangle(0, 0, width + 40, height + 40, 0x020617, 0.68);
    dim.setInteractive();
    modal.add(dim);

    const lines: string[] = [];
    if (reward.coins) lines.push(`${reward.coins} монет`);
    if (reward.crystals) lines.push(`${reward.crystals} кристаллов`);
    if (reward.bpXp) lines.push(`${reward.bpXp} XP Battle Pass`);
    if (reward.fragments && reward.fragments > 0) {
      lines.push(`${reward.fragments} фрагментов (случайная фишка вашей фракции)`);
    }

    const body = lines.length > 0 ? lines.join('\n') : reward.label;
    const lineCount = Math.max(1, body.split('\n').length);
    const w = Math.min(width - 36 * s, 380 * s);
    const h = Math.min(260 * s, 110 * s + lineCount * 24 * s);

    const panel = this.scene.add.graphics();
    panel.fillGradientStyle(0x111827, 0x0b1220, 0x080f18, 0x111827, 1, 1, 1, 1);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 22 * s);
    panel.lineStyle(tier === 'legendary' ? 6 : 5, accent, 1);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 22 * s);
    panel.lineStyle(3, colors.uiAccent, tier === 'epic' || tier === 'legendary' ? 0.45 : 0.22);
    panel.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 18 * s);

    const panelPulseRoot = this.scene.add.container(0, 0);
    panelPulseRoot.add(panel);
    modal.add(panelPulseRoot);

    modal.add(
      this.scene.add
        .text(0, -h / 2 + 26 * s, TIER_TITLE[tier], {
          fontFamily: fonts.tech,
          fontSize: `${12 * s}px`,
          color: TIER_TITLE_HEX[tier],
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, -h / 2 + 48 * s, 'ПОЗДРАВЛЯЕМ!', {
          fontFamily: fonts.tech,
          fontSize: `${15 * s}px`,
          color: '#fef3c7',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, 4 * s, body, {
          fontFamily: fonts.primary,
          fontSize: `${18 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 6,
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, h / 2 - 28 * s, 'Нажми в любое место', {
          fontFamily: fonts.primary,
          fontSize: `${12 * s}px`,
          color: '#64748b',
        })
        .setOrigin(0.5)
    );

    const close = () => {
      modal.destroy(true);
      this.onClosed?.();
    };

    dim.once('pointerdown', close);
    this.scene.time.delayedCall(tier === 'legendary' ? 5400 : 4400, close);

    this.scene.add.existing(modal);

    if (tier === 'legendary') {
      this.scene.tweens.add({
        targets: panelPulseRoot,
        scaleX: { from: 1, to: 1.03 },
        scaleY: { from: 1, to: 1.03 },
        duration: 600,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut',
      });
    }

    if (tier === 'legendary' || tier === 'epic') {
      this.scene.tweens.add({
        targets: panel,
        alpha: { from: 0.85, to: 1 },
        duration: 480,
        yoyo: true,
        repeat: 2,
      });
    }
  }

  close(): void {
    if (this.spinning) return;
    this.destroy(true);
    this.onClosed?.();
  }
}