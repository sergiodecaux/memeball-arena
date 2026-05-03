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
    vignette.fillStyle(0x000000, 0.35);
    vignette.fillCircle(width / 2, height * 0.42, Math.max(width, height) * 0.85);
    this.add(vignette);

    const dim = scene.add.rectangle(width / 2, height / 2, width + 80, height + 80, 0x020617, 0.35);
    dim.setInteractive();
    dim.once('pointerdown', () => {});
    this.add(dim);

    const cx = width / 2;
    /** Большой радиус: почти до краёв по узкой стороне */
    const radius = Math.min(width * 0.46, height * 0.37, 220 * s);
    const cy = height * 0.42;

    const topSafe = tgApp.getTopInset();

    const title = scene.add
      .text(cx, Math.max(40 * s, topSafe + 28 * s), '✦ КОЛЕСО УДАЧИ ✦', {
        fontFamily: fonts.tech,
        fontSize: `${Math.round(19 * s)}px`,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add(title);

    this.hintText = scene.add
      .text(
        cx,
        title.y + 26 * s,
        'Бесплатно раз в 12 ч • сектор по редкости от серого к золоту',
        {
          fontFamily: fonts.primary,
          fontSize: `${11 * s}px`,
          color: hexToString(colors.uiAccent),
          align: 'center',
          wordWrap: { width: width - 36 },
        }
      )
      .setOrigin(0.5);
    this.add(this.hintText);

    this.wheelRoot = scene.add.container(cx, cy);

    const glow = scene.add.graphics();
    for (let ring = 4; ring >= 0; ring--) {
      const r = radius * (1.06 + ring * 0.045);
      const alpha = 0.035 + ring * 0.022;
      glow.lineStyle(14 - ring * 2, colors.uiAccent, alpha);
      glow.strokeCircle(0, 0, r);
    }
    glow.fillStyle(0xfbbf24, 0.06);
    glow.fillCircle(0, 0, radius * 1.28);
    this.wheelRoot.add(glow);

    const rimKey = 'ui_lucky_wheel_rim';
    if (scene.textures.exists(rimKey)) {
      const rimSize = (radius + 26 * s) * 2;
      this.wheelRoot.add(scene.add.image(0, 0, rimKey).setDisplaySize(rimSize, rimSize));
    }

    const sliceGfx = scene.add.graphics();
    const n = LUCKY_WHEEL_REWARDS.length;
    const slice = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const tier = LUCKY_WHEEL_REWARDS[i].tier;
      const [cA, cB] = TIER_SLICE_PAIR[tier];
      const a0 = -Math.PI / 2 + i * slice;
      const a1 = a0 + slice;
      sliceGfx.fillStyle(i % 2 === 0 ? cA : cB, 1);
      sliceGfx.slice(0, 0, radius * 0.94, a0, a1, true);
      sliceGfx.fillPath();
      sliceGfx.lineStyle(2.5, TIER_EDGE[tier], tier === 'legendary' ? 1 : 0.88);
      sliceGfx.slice(0, 0, radius * 0.94, a0, a1, true);
      sliceGfx.strokePath();
    }

    sliceGfx.lineStyle(4, 0xfef08a, 0.92);
    sliceGfx.strokeCircle(0, 0, radius * 0.94);
    this.wheelRoot.add(sliceGfx);

    const labelR = radius * 0.62;
    const fs = Math.max(10, Math.round(10.5 * s));
    for (let i = 0; i < n; i++) {
      const mid = -Math.PI / 2 + (i + 0.5) * slice;
      const tx = Math.cos(mid) * labelR;
      const ty = Math.sin(mid) * labelR;
      const row = LUCKY_WHEEL_REWARDS[i];
      const tierTag =
        row.tier === 'legendary' ? '★ ' : row.tier === 'epic' ? '⚡ ' : row.tier === 'rare' ? '✦ ' : '';
      const raw = row.label;
      const short = raw.length > 15 ? raw.slice(0, 13) + '…' : raw;
      const label = scene.add
        .text(tx, ty, `${tierTag}${short}`, {
          fontFamily: fonts.tech,
          fontSize: `${fs}px`,
          color: TIER_LABEL_HEX[row.tier],
          align: 'center',
          fontStyle: 'bold',
          stroke: '#030712',
          strokeThickness: Math.max(3, Math.round(3 * s)),
        })
        .setOrigin(0.5)
        .setRotation(mid + Math.PI / 2);
      this.wheelRoot.add(label);
    }

    const hubR = Math.round(22 * s);
    const hubGlow = scene.add.circle(0, 0, hubR + 10 * s, colors.uiAccent, 0.25);
    this.wheelRoot.add(hubGlow);

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
          .setOrigin(0.5)
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

    const closeBtn = scene.add.container(width - 28 * s, 42 * s);
    const closeBg = scene.add.graphics();
    closeBg.fillStyle(0x050816, 0.92);
    closeBg.fillCircle(0, 0, 22 * s);
    closeBg.lineStyle(2, colors.uiAccent, 0.65);
    closeBg.strokeCircle(0, 0, 22 * s);
    closeBtn.add(closeBg);
    closeBtn.add(
      scene.add
        .text(0, 0, '✕', {
          fontSize: `${18 * s}px`,
          fontFamily: fonts.tech,
          color: hexToString(colors.uiAccent),
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );
    closeBtn.setSize(44 * s, 44 * s);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.close());
    this.add(closeBtn);

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
        color: '#000000',
        fontStyle: 'bold',
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
      this.hintText.setText('Бесплатно раз в 12 ч • сектор по редкости от серого к золоту');
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
      duration: 3800,
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
    panel.lineStyle(tier === 'legendary' ? 5 : 4, accent, 1);
    panel.strokeRoundedRect(-w / 2, -h / 2, w, h, 22 * s);
    panel.lineStyle(2, colors.uiAccent, tier === 'epic' || tier === 'legendary' ? 0.45 : 0.22);
    panel.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 18 * s);
    modal.add(panel);

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
          fontSize: `${16 * s}px`,
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