import Phaser from 'phaser';
import { getFonts } from '../../config/themes';
import { AudioManager } from '../../managers/AudioManager';
import {
  luckyWheelManager,
  LUCKY_WHEEL_REWARDS,
  LuckyWheelReward,
} from '../../data/LuckyWheelManager';
import { hapticImpact } from '../../utils/Haptics';

function formatCooldown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h <= 0) return `${m} мин`;
  return `${h} ч ${m} мин`;
}

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
    frame.fillStyle(0x0b1220, 0.96);
    frame.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 18 * s);
    frame.lineStyle(3, 0xfbbf24, 0.85);
    frame.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 18 * s);
    frame.lineStyle(1, 0x22d3ee, 0.35);
    frame.strokeRoundedRect(cx - panelW / 2 + 3, cy - panelH / 2 + 3, panelW - 6, panelH - 6, 15 * s);
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
      .text(cx, cy - panelH / 2 + 48 * s, 'Бесплатная крутка раз в 12 часов', {
        fontFamily: fonts.primary,
        fontSize: `${11 * s}px`,
        color: '#94a3b8',
      })
      .setOrigin(0.5);
    this.add(this.hintText);

    const radius = Math.min(118 * s, (panelW - 56) / 2 - 8);
    this.wheelRoot = scene.add.container(cx, cy - 8 * s);

    const colors = [
      0x1e293b, 0x312e81, 0x134e4a, 0x713f12, 0x4c1d95, 0x831843, 0x164e63, 0x422006,
    ];

    const g = scene.add.graphics();
    const n = LUCKY_WHEEL_REWARDS.length;
    const slice = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const a0 = -Math.PI / 2 + i * slice;
      const a1 = a0 + slice;
      g.fillStyle(colors[i % colors.length], 1);
      g.slice(0, 0, radius, a0, a1, true);
      g.fillPath();
      g.lineStyle(2, 0xfbbf24, 0.35);
      g.slice(0, 0, radius, a0, a1, true);
      g.strokePath();
    }

    g.lineStyle(3, 0xfef08a, 0.95);
    g.strokeCircle(0, 0, radius);
    this.wheelRoot.add(g);

    for (let i = 0; i < n; i++) {
      const mid = -Math.PI / 2 + (i + 0.5) * slice;
      const tx = Math.cos(mid) * (radius * 0.62);
      const ty = Math.sin(mid) * (radius * 0.62);
      const short =
        LUCKY_WHEEL_REWARDS[i].label.length > 14
          ? LUCKY_WHEEL_REWARDS[i].label.slice(0, 12) + '…'
          : LUCKY_WHEEL_REWARDS[i].label;
      const label = scene.add
        .text(tx, ty, short, {
          fontFamily: fonts.tech,
          fontSize: `${9 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setRotation(mid + Math.PI / 2);
      this.wheelRoot.add(label);
    }

    const hub = scene.add.circle(0, 0, 14 * s, 0xfbbf24, 1);
    hub.setStrokeStyle(2, 0xfffbeb, 0.9);
    this.wheelRoot.add(hub);

    this.add(this.wheelRoot);

    const pointer = scene.add.triangle(cx, cy - 8 * s - radius - 14 * s, 0, 18 * s, -12 * s, 0, 12 * s, 0, 0xfbbf24, 1);
    pointer.setStrokeStyle(2, 0xfffbeb, 0.95);
    this.add(pointer);

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
      this.hintText.setText('Бесплатная крутка раз в 12 часов');
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

    const modal = this.scene.add.container(width / 2, height * 0.42).setDepth(12001);
    const dim = this.scene.add.rectangle(0, 0, width + 20, height + 20, 0x020617, 0.55);
    dim.setInteractive();
    modal.add(dim);

    const w = Math.min(width - 48, 320);
    const h = 132 * s;
    const panel = this.scene.add.graphics();
    panel.fillStyle(0x0f172a, 0.98);
    panel.fillRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    panel.lineStyle(2, 0x22c55e, 0.9);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    modal.add(panel);

    modal.add(
      this.scene.add
        .text(0, -36 * s, 'ВЫ ВЫИГРАЛИ', {
          fontFamily: fonts.tech,
          fontSize: `${12 * s}px`,
          color: '#bbf7d0',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    const lines: string[] = [];
    if (reward.coins) lines.push(`${reward.coins} монет`);
    if (reward.crystals) lines.push(`${reward.crystals} кристаллов`);
    if (reward.bpXp) lines.push(`${reward.bpXp} XP Battle Pass`);

    modal.add(
      this.scene.add
        .text(0, 8 * s, lines.join('\n') || reward.label, {
          fontFamily: fonts.primary,
          fontSize: `${16 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    modal.add(
      this.scene.add
        .text(0, 44 * s, 'Нажми в любое место', {
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
    this.scene.time.delayedCall(4200, close);

    this.scene.add.existing(modal);
  }

  close(): void {
    if (this.spinning) return;
    this.destroy(true);
    this.onClosed?.();
  }
}
