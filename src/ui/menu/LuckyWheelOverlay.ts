import Phaser from 'phaser';
import { getFonts } from '../../config/themes';
import { AudioManager } from '../../managers/AudioManager';
import {
  luckyWheelManager,
  LUCKY_WHEEL_REWARDS,
  LuckyWheelReward,
  type LuckyWheelRewardTier,
} from '../../data/LuckyWheelManager';
import { hapticImpact } from '../../utils/Haptics';

function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

const TIER_SLICE_PAIR: Record<LuckyWheelRewardTier, readonly [number, number]> = {
  common: [0x1e293b, 0x334155],
  rare: [0x3730a3, 0x4338ca],
  epic: [0x86198f, 0xa21caf],
  legendary: [0xb45309, 0xd97706],
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
  common: '#e2e8f0',
  rare: '#c7d2fe',
  epic: '#fae8ff',
  legendary: '#fef9c3',
};

const TIER_TITLE_HEX: Record<LuckyWheelRewardTier, string> = {
  common: '#94a3b8',
  rare: '#a5b4fc',
  epic: '#f0abfc',
  legendary: '#fef08a',
};

/**
 * Оверлей колеса удачи: рулетка, анимация, показ приза.
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

    const dim = scene.add.rectangle(width / 2, height / 2, width + 40, height + 40, 0x020617, 0.72);
    dim.setInteractive();
    dim.once('pointerdown', () => {});
    this.add(dim);

    const panelW = Math.min(width - 28, 380);
    const panelH = Math.min(height * 0.82, 620 * s);
    const cx = width / 2;
    const cy = height * 0.48;

    const frame = scene.add.graphics();
    frame.fillGradientStyle(0x0c1428, 0x0b1220, 0x080f1f, 0x0a162e, 1, 1, 1, 1);
    frame.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 20 * s);
    frame.lineStyle(3, 0xfbbf24, 0.88);
    frame.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 20 * s);
    frame.lineStyle(1.5, 0xc084fc, 0.28);
    frame.strokeRoundedRect(cx - panelW / 2 + 4, cy - panelH / 2 + 4, panelW - 8, panelH - 8, 17 * s);
    this.add(frame);

    this.add(
      scene.add
        .text(cx, cy - panelH / 2 + 26 * s, 'КОЛЕСО УДАЧИ', {
          fontFamily: fonts.tech,
          fontSize: `${17 * s}px`,
          color: '#fef3c7',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    this.hintText = scene.add
      .text(cx, cy - panelH / 2 + 48 * s, 'Бесплатная крутка раз в 12 часов • цвет сектора = редкость', {
        fontFamily: fonts.primary,
        fontSize: `${10 * s}px`,
        color: '#94a3b8',
        align: 'center',
        wordWrap: { width: panelW - 36 },
      })
      .setOrigin(0.5);
    this.add(this.hintText);

    const radius = Math.min(122 * s, (panelW - 56) / 2 - 8);
    this.wheelRoot = scene.add.container(cx, cy - 8 * s);

    const aura = scene.add.graphics();
    aura.fillStyle(0xfbbf24, 0.07);
    aura.fillCircle(0, 0, radius * 1.22);
    aura.lineStyle(10 * s, 0xa855f7, 0.06);
    aura.strokeCircle(0, 0, radius * 1.12);
    aura.lineStyle(4 * s, 0xfbbf24, 0.09);
    aura.strokeCircle(0, 0, radius * 1.04);
    this.wheelRoot.add(aura);

    const rimKey = 'ui_lucky_wheel_rim';
    if (scene.textures.exists(rimKey)) {
      const rim = scene.add.image(0, 0, rimKey).setDisplaySize((radius + 20 * s) * 2, (radius + 20 * s) * 2);
      this.wheelRoot.add(rim);
    }

    const g = scene.add.graphics();
    const n = LUCKY_WHEEL_REWARDS.length;
    const slice = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const tier = LUCKY_WHEEL_REWARDS[i].tier;
      const [cA, cB] = TIER_SLICE_PAIR[tier];
      const a0 = -Math.PI / 2 + i * slice;
      const a1 = a0 + slice;
      g.fillStyle(i % 2 === 0 ? cA : cB, 1);
      g.slice(0, 0, radius * 0.92, a0, a1, true);
      g.fillPath();
      g.lineStyle(2.2, TIER_EDGE[tier], tier === 'legendary' ? 1 : 0.82);
      g.slice(0, 0, radius * 0.92, a0, a1, true);
      g.strokePath();
    }

    g.lineStyle(3, 0xfef08a, 0.95);
    g.strokeCircle(0, 0, radius * 0.92);
    this.wheelRoot.add(g);

    for (let i = 0; i < n; i++) {
      const mid = -Math.PI / 2 + (i + 0.5) * slice;
      const tx = Math.cos(mid) * (radius * 0.56);
      const ty = Math.sin(mid) * (radius * 0.56);
      const row = LUCKY_WHEEL_REWARDS[i];
      const tierTag =
        row.tier === 'legendary' ? '★ ' : row.tier === 'epic' ? '⚡ ' : row.tier === 'rare' ? '✦ ' : '';
      const raw = row.label;
      const short = raw.length > 13 ? raw.slice(0, 11) + '…' : raw;
      const label = scene.add
        .text(tx, ty, `${tierTag}${short}`, {
          fontFamily: fonts.tech,
          fontSize: `${Math.round(8.6 * s)}px`,
          color: TIER_LABEL_HEX[row.tier],
          align: 'center',
          fontStyle: 'bold',
          stroke: '#0f172a',
          strokeThickness: Math.max(2, Math.round(2.4 * s)),
        })
        .setOrigin(0.5)
        .setRotation(mid + Math.PI / 2);
      this.wheelRoot.add(label);
    }

    const centerKey = 'ui_lucky_wheel_center';
    if (scene.textures.exists(centerKey)) {
      this.wheelRoot.add(scene.add.image(0, 0, centerKey).setDisplaySize(40 * s, 40 * s));
    } else {
      const hub = scene.add.circle(0, 0, 16 * s, 0xfbbf24, 1);
      hub.setStrokeStyle(3, 0xfffbeb, 0.95);
      this.wheelRoot.add(hub);
    }

    this.add(this.wheelRoot);

    const ptrKey = 'ui_lucky_wheel_pointer';
    const ptrY = cy - 8 * s - radius - 16 * s;
    if (scene.textures.exists(ptrKey)) {
      this.add(scene.add.image(cx, ptrY, ptrKey).setDisplaySize(34 * s, 42 * s));
    } else {
      const pointer = scene.add.triangle(cx, ptrY, 0, 18 * s, -12 * s, 0, 12 * s, 0, 0xfbbf24, 1);
      pointer.setStrokeStyle(2, 0xfffbeb, 0.95);
      this.add(pointer);
    }

    const closeBtn = scene.add.container(cx + panelW / 2 - 28 * s, cy - panelH / 2 + 26 * s);
    const closeBg = scene.add.circle(0, 0, 16 * s, 0x1f2937, 0.95);
    closeBtn.add(closeBg);
    closeBtn.add(
      scene.add
        .text(0, 0, '✕', {
          fontSize: `${16 * s}px`,
          color: '#e2e8f0',
        })
        .setOrigin(0.5)
    );
    closeBtn.setSize(36 * s, 36 * s);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.add(closeBtn);

    const btnY = cy + panelH / 2 - 52 * s;
    const spinBg = scene.add.graphics();
    spinBg.fillGradientStyle(0xfbbf24, 0xf59e0b, 0xd97706, 0xb45309, 1);
    spinBg.fillRoundedRect(cx - 115 * s, btnY - 22 * s, 230 * s, 44 * s, 22 * s);
    spinBg.lineStyle(2, 0xfffbeb, 0.9);
    spinBg.strokeRoundedRect(cx - 115 * s, btnY - 22 * s, 230 * s, 44 * s, 22 * s);
    this.add(spinBg);

    this.spinBtnLabel = scene.add
      .text(cx, btnY, 'КРУТИТЬ', {
        fontFamily: fonts.tech,
        fontSize: `${14 * s}px`,
        color: '#1c1917',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(this.spinBtnLabel);

    const spinHit = scene.add.rectangle(cx, btnY, 230 * s, 44 * s, 0x000000, 0);
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
      this.hintText.setText('Бесплатная крутка раз в 12 часов • цвет сектора = редкость');
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

    this.scene.tweens.add({
      targets: this.wheelRoot,
      rotation: targetRotation,
      duration: 3400,
      ease: 'Cubic.out',
      onComplete: () => {
        this.spinning = false;
        const twopi = Math.PI * 2;
        this.wheelRoot.rotation = ((this.wheelRoot.rotation % twopi) + twopi) % twopi;
        this.showResult(result.reward);
        this.refreshButtonState();
      },
    });
  }

  private showResult(reward: LuckyWheelReward): void {
    AudioManager.getInstance().playSFX('sfx_card_pop', { volume: 0.55 });
    AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.65 });

    const { width, height } = this.scene.cameras.main;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();
    const tier = reward.tier;
    const accent = TIER_EDGE[tier];

    const modal = this.scene.add.container(width / 2, height * 0.42).setDepth(12001);
    const dim = this.scene.add.rectangle(0, 0, width + 20, height + 20, 0x020617, 0.62);
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
    const w = Math.min(width - 44, 340);
    const h = Math.min(220 * s, 96 * s + lineCount * 22 * s);

    const panel = this.scene.add.graphics();
    panel.fillGradientStyle(0x111827, 0x0f172a, 0x0c1428, 0x0f172a, 1, 1, 1, 1);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 18 * s);
    panel.lineStyle(tier === 'legendary' ? 4 : 3, accent, tier === 'legendary' ? 1 : 0.92);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 18 * s);
    panel.lineStyle(1, 0x22d3ee, tier === 'epic' || tier === 'legendary' ? 0.35 : 0.18);
    panel.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, 15 * s);
    modal.add(panel);

    modal.add(
      this.scene.add
        .text(0, -h / 2 + 22 * s, TIER_TITLE[tier], {
          fontFamily: fonts.tech,
          fontSize: `${11 * s}px`,
          color: TIER_TITLE_HEX[tier],
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, -h / 2 + 40 * s, 'ПОЗДРАВЛЯЕМ!', {
          fontFamily: fonts.tech,
          fontSize: `${13 * s}px`,
          color: '#fef3c7',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, -4 * s, body, {
          fontFamily: fonts.primary,
          fontSize: `${15 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
          lineSpacing: 4,
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, h / 2 - 26 * s, 'Нажми в любое место', {
          fontFamily: fonts.primary,
          fontSize: `${11 * s}px`,
          color: '#64748b',
        })
        .setOrigin(0.5)
    );

    const close = () => {
      modal.destroy(true);
      this.onClosed?.();
    };

    dim.once('pointerdown', close);
    this.scene.time.delayedCall(tier === 'legendary' ? 5200 : 4200, close);

    this.scene.add.existing(modal);

    if (tier === 'legendary' || tier === 'epic') {
      this.scene.tweens.add({
        targets: panel,
        alpha: { from: 0.88, to: 1 },
        duration: 520,
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
