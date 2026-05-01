// Колесо выбора второй фракции за завершение Пути новичка (награда без рулетки — игрок сам выбирает сектор)

import Phaser from 'phaser';
import { FACTIONS, FactionId } from '../constants/gameConstants';
import { getFonts } from '../config/themes';
import { AudioManager } from '../managers/AudioManager';
import { hapticImpact, hapticSelection } from '../utils/Haptics';

const FACTION_NAMES_RU: Record<FactionId, string> = {
  magma: 'Магма Бруты',
  cyborg: 'Терранские Киборги',
  void: 'Воиды',
  insect: 'Ксенос Рой',
};

const FACTION_ICONS: Record<FactionId, string> = {
  magma: '🔥',
  cyborg: '🤖',
  void: '🌌',
  insect: '🐛',
};

export class RookieFactionWheelOverlay extends Phaser.GameObjects.Container {
  private readonly wheelRadius: number;
  private readonly factionIds: FactionId[];
  private readonly slicesG: Phaser.GameObjects.Graphics;
  private readonly highlightG: Phaser.GameObjects.Graphics;
  private readonly wheelRoot: Phaser.GameObjects.Container;
  private selectedIndex: number | null = null;
  private idleTween?: Phaser.Tweens.Tween;
  private confirmBtn?: Phaser.GameObjects.Container;
  private confirmBg?: Phaser.GameObjects.Graphics;
  private confirmTxt?: Phaser.GameObjects.Text;

  constructor(
    scene: Phaser.Scene,
    factionIds: FactionId[],
    private readonly onSelect: (factionId: FactionId) => void
  ) {
    super(scene, 0, 0);

    const { width, height } = scene.cameras.main;
    const s = Math.min(width / 390, height / 844);
    const fonts = getFonts();

    this.factionIds = [...factionIds];
    const n = Math.max(1, this.factionIds.length);
    this.wheelRadius = Math.min(148 * s, width * 0.34);

    const dim = scene.add.rectangle(width / 2, height / 2, width + 40, height + 40, 0x030712, 0.78);
    dim.setInteractive();
    this.add(dim);

    const cx = width / 2;
    const cy = height * 0.44;

    const panel = scene.add.graphics();
    panel.fillStyle(0x0c1224, 0.92);
    panel.fillRoundedRect(cx - width * 0.46, cy - this.wheelRadius - 115 * s, width * 0.92, this.wheelRadius * 2 + 200 * s, 22 * s);
    panel.lineStyle(2, 0xfbbf24, 0.85);
    panel.strokeRoundedRect(cx - width * 0.46, cy - this.wheelRadius - 115 * s, width * 0.92, this.wheelRadius * 2 + 200 * s, 22 * s);
    panel.lineStyle(1, 0x38bdf8, 0.35);
    panel.strokeRoundedRect(cx - width * 0.46 + 3, cy - this.wheelRadius - 112 * s, width * 0.92 - 6, this.wheelRadius * 2 + 194 * s, 19 * s);
    this.add(panel);

    this.add(
      scene.add
        .text(cx, cy - this.wheelRadius - 88 * s, 'ВТОРАЯ ФРАКЦИЯ', {
          fontFamily: fonts.tech,
          fontSize: `${18 * s}px`,
          color: '#fef3c7',
          fontStyle: 'bold',
          letterSpacing: 2,
        })
        .setOrigin(0.5)
    );

    this.add(
      scene.add
        .text(cx, cy - this.wheelRadius - 62 * s, 'Нажми сектор колеса, затем подтверди выбор', {
          fontFamily: fonts.primary,
          fontSize: `${11 * s}px`,
          color: '#94a3b8',
          align: 'center',
          wordWrap: { width: width - 56 },
        })
        .setOrigin(0.5)
    );

    this.wheelRoot = scene.add.container(cx, cy);
    this.add(this.wheelRoot);

    this.slicesG = scene.add.graphics();
    this.wheelRoot.add(this.slicesG);

    this.highlightG = scene.add.graphics();
    this.wheelRoot.add(this.highlightG);

    const slice = (Math.PI * 2) / n;

    for (let i = 0; i < n; i++) {
      const fid = this.factionIds[i];
      const fc = FACTIONS[fid];
      const a0 = -Math.PI / 2 + i * slice;
      const a1 = a0 + slice;
      const dark = Phaser.Display.Color.IntegerToRGB(fc.color);
      const fill = Phaser.Display.Color.GetColor(
        Math.round(dark.r * 0.35),
        Math.round(dark.g * 0.35),
        Math.round(dark.b * 0.35)
      );

      this.slicesG.fillStyle(fill, 1);
      this.slicesG.slice(0, 0, this.wheelRadius - 4, a0 + 0.02, a1 - 0.02, true);
      this.slicesG.fillPath();
      this.slicesG.lineStyle(2, fc.color, 0.85);
      this.slicesG.slice(0, 0, this.wheelRadius - 4, a0, a1, true);
      this.slicesG.strokePath();

      const mid = a0 + slice / 2;
      const lx = Math.cos(mid) * (this.wheelRadius * 0.58);
      const ly = Math.sin(mid) * (this.wheelRadius * 0.58);
      const label = scene.add
        .text(lx, ly, `${FACTION_ICONS[fid]}\n${FACTION_NAMES_RU[fid]}`, {
          fontFamily: fonts.tech,
          fontSize: `${10 * s}px`,
          color: '#f8fafc',
          align: 'center',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setRotation(mid + Math.PI / 2);
      this.wheelRoot.add(label);
    }

    this.wheelRoot.add(
      scene.add.circle(0, 0, 22 * s, 0x0f172a, 1).setStrokeStyle(3, 0xfbbf24, 1)
    );
    this.wheelRoot.add(
      scene.add
        .text(0, 0, '★', {
          fontSize: `${14 * s}px`,
          color: '#fde68a',
        })
        .setOrigin(0.5)
    );

    const pointer = scene.add.triangle(cx, cy - this.wheelRadius - 10 * s, 0, 16 * s, -11 * s, 0, 11 * s, 0, 0xfbbf24, 1);
    pointer.setStrokeStyle(2, 0xfffbeb, 1);
    this.add(pointer);

    const hit = scene.add.circle(0, 0, this.wheelRadius + 8 * s, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    const lp = new Phaser.Math.Vector2();
    hit.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.wheelRoot.getLocalPoint(p.worldX, p.worldY, lp);
      const dist = Math.hypot(lp.x, lp.y);
      if (dist < 28 * s || dist > this.wheelRadius + 6 * s) return;

      let ang = Math.atan2(lp.y, lp.x);
      ang += Math.PI / 2;
      if (ang < 0) ang += Math.PI * 2;
      const idx = Math.min(n - 1, Math.floor(ang / slice));
      this.setSelected(scene, idx, s);
    });
    this.wheelRoot.add(hit);

    this.confirmBtn = this.buildConfirmButton(scene, cx, cy + this.wheelRadius + 78 * s, s);
    this.add(this.confirmBtn);

    const closeY = cy - this.wheelRadius - 108 * s;
    const closeBtn = scene.add.container(cx + width * 0.42 - 36 * s, closeY);
    closeBtn.add(scene.add.circle(0, 0, 16 * s, 0x1f2937, 0.95));
    closeBtn.add(scene.add.text(0, 0, '✕', { fontSize: `${15 * s}px`, color: '#e2e8f0' }).setOrigin(0.5));
    closeBtn.setSize(34 * s, 34 * s);
    closeBtn.setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.destroyWithFade());
    this.add(closeBtn);

    this.idleTween = scene.tweens.add({
      targets: this.wheelRoot,
      rotation: Math.PI * 2,
      duration: 52000,
      repeat: -1,
      ease: 'Linear',
    });

    this.setDepth(12500);
    scene.add.existing(this);
  }

  private setSelected(scene: Phaser.Scene, index: number, s: number): void {
    if (index < 0 || index >= this.factionIds.length) return;
    this.selectedIndex = index;
    AudioManager.getInstance().playUIClick();
    hapticSelection();

    const n = this.factionIds.length;
    const slice = (Math.PI * 2) / n;
    const a0 = -Math.PI / 2 + index * slice;
    const a1 = a0 + slice;
    const fid = this.factionIds[index];
    const fc = FACTIONS[fid];

    this.highlightG.clear();
    this.highlightG.lineStyle(5, 0xfef08a, 1);
    this.highlightG.slice(0, 0, this.wheelRadius + 2, a0 + 0.01, a1 - 0.01, true);
    this.highlightG.strokePath();
    this.highlightG.lineStyle(3, fc.color, 0.95);
    this.highlightG.slice(0, 0, this.wheelRadius - 6, a0 + 0.04, a1 - 0.04, true);
    this.highlightG.strokePath();

    if (this.confirmTxt && this.confirmBg) {
      const bw = Math.min(scene.cameras.main.width - 72 * s, 300 * s);
      const bh = 46 * s;
      this.confirmTxt.setText(`ЗАБРАТЬ: ${FACTION_NAMES_RU[fid]}`);
      this.confirmTxt.setStyle({ color: '#1c1917' });
      this.confirmBg.clear();
      this.confirmBg.fillGradientStyle(0xfef08a, 0xfbbf24, 0xf59e0b, 0xd97706, 1);
      this.confirmBg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
      this.confirmBg.lineStyle(2, 0xfffbeb, 0.95);
      this.confirmBg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    }
  }

  private buildConfirmButton(scene: Phaser.Scene, x: number, y: number, s: number): Phaser.GameObjects.Container {
    const c = scene.add.container(x, y);
    const bw = Math.min(scene.cameras.main.width - 72 * s, 300 * s);
    const bh = 46 * s;
    const fonts = getFonts();

    this.confirmBg = scene.add.graphics();
    this.confirmBg.fillStyle(0x334155, 0.55);
    this.confirmBg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    this.confirmBg.lineStyle(2, 0x64748b, 0.75);
    this.confirmBg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
    c.add(this.confirmBg);

    this.confirmTxt = scene.add
      .text(0, 0, 'Сначала выбери сектор на колесе', {
        fontFamily: fonts.tech,
        fontSize: `${11 * s}px`,
        color: '#94a3b8',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: bw - 16 },
      })
      .setOrigin(0.5);
    c.add(this.confirmTxt);

    const hit = scene.add.rectangle(0, 0, bw, bh, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    c.add(hit);

    hit.on('pointerdown', () => {
      if (this.selectedIndex === null) {
        AudioManager.getInstance().playUIClick();
        return;
      }
      const factionId = this.factionIds[this.selectedIndex];
      AudioManager.getInstance().playSFX('sfx_cash', { volume: 0.75 });
      hapticImpact('heavy');
      this.idleTween?.stop();
      this.onSelect(factionId);
      this.destroyWithFade();
    });

    return c;
  }

  private destroyWithFade(): void {
    this.idleTween?.stop();
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 180,
      onComplete: () => this.destroy(true),
    });
  }
}
