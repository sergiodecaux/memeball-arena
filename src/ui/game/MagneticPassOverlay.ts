import Phaser from 'phaser';
import { Unit } from '../../entities/Unit';
import { getUnitDisplayName } from '../../data/UnitsRepository';
import { getFonts } from '../../config/themes';

/**
 * Выбор союзника для магнитного паса (Playmaker).
 */
export class MagneticPassOverlay {
  private readonly scene: Phaser.Scene;
  private readonly container: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(260).setScrollFactor(0).setVisible(false);
  }

  show(allies: Unit[], passer: Unit, onPick: (target: Unit) => void, onCancel?: () => void): void {
    this.hide();

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const fonts = getFonts();

    const backdrop = this.scene.add
      .rectangle(w / 2, h / 2, w, h, 0x020617, 0.72)
      .setInteractive()
      .on('pointerdown', () => {
        onCancel?.();
        this.hide();
      });
    this.container.add(backdrop);

    const headerH = 120;
    const header = this.scene.add.graphics();
    header.fillGradientStyle(0x064e3b, 0x022c22, 0x0f172a, 0x0f172a, 0.95, 0.95, 0.92, 0.92);
    header.fillRoundedRect(18, 32, w - 36, headerH, 18);
    header.lineStyle(2, 0x34d399, 0.85);
    header.strokeRoundedRect(18, 32, w - 36, headerH, 18);
    this.container.add(header);

    const title = this.scene.add
      .text(w / 2, 66, '⚽ Магнитный пас', {
        fontSize: '24px',
        color: '#ecfdf5',
        fontFamily: fonts.tech,
        stroke: '#022c22',
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    this.container.add(title);

    const sub = this.scene.add
      .text(w / 2, 104, `От: ${getUnitDisplayName(passer.getUnitId())}`, {
        fontSize: '14px',
        color: '#a7f3d0',
        fontFamily: fonts.primary,
      })
      .setOrigin(0.5);
    this.container.add(sub);

    allies.forEach((ally, index) => {
      const y = 168 + index * 64;
      const row = this.scene.add.container(w / 2, y);

      const bg = this.scene.add
        .rectangle(0, 0, Math.min(340, w - 36), 54, 0x14532d, 0.96)
        .setStrokeStyle(2, 0x6ee7b7, 0.9)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          bg.setFillStyle(0x166534, 1);
        })
        .on('pointerout', () => {
          bg.setFillStyle(0x14532d, 0.96);
        })
        .on('pointerdown', () => {
          onPick(ally);
          this.hide();
        });

      const label = this.scene.add
        .text(0, 0, getUnitDisplayName(ally.getUnitId()), {
          fontSize: '18px',
          color: '#f8fafc',
          fontFamily: fonts.tech,
        })
        .setOrigin(0.5);

      row.add([bg, label]);
      this.container.add(row);
    });

    const cancelBtn = this.scene.add
      .text(w / 2, h - 88, 'ОТМЕНА', {
        fontSize: '18px',
        color: '#fee2e2',
        fontFamily: fonts.tech,
        backgroundColor: '#991b1b',
        padding: { x: 26, y: 11 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        onCancel?.();
        this.hide();
      });
    this.container.add(cancelBtn);

    this.container.setVisible(true);
  }

  hide(): void {
    this.container.removeAll(true);
    this.container.setVisible(false);
  }

  destroy(): void {
    this.container.destroy(true);
  }
}
