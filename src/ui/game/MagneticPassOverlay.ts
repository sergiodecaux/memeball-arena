import Phaser from 'phaser';
import { Unit } from '../../entities/Unit';
import { getUnitDisplayName } from '../../data/UnitsRepository';

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

    const backdrop = this.scene.add
      .rectangle(w / 2, h / 2, w, h, 0x000000, 0.62)
      .setInteractive()
      .on('pointerdown', () => {
        onCancel?.();
        this.hide();
      });
    this.container.add(backdrop);

    const title = this.scene.add
      .text(w / 2, 72, 'Пас союзнику', {
        fontSize: '22px',
        color: '#ffffff',
        fontFamily: 'Rajdhani, Arial',
      })
      .setOrigin(0.5);
    this.container.add(title);

    const sub = this.scene.add
      .text(w / 2, 104, getUnitDisplayName(passer.getUnitId()), {
        fontSize: '14px',
        color: '#cbd5e1',
        fontFamily: 'Rajdhani, Arial',
      })
      .setOrigin(0.5);
    this.container.add(sub);

    allies.forEach((ally, index) => {
      const y = 150 + index * 62;
      const row = this.scene.add.container(w / 2, y);

      const bg = this.scene.add
        .rectangle(0, 0, Math.min(320, w - 40), 52, 0x14532d, 0.95)
        .setStrokeStyle(2, 0x34d399)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          onPick(ally);
          this.hide();
        });

      const label = this.scene.add
        .text(0, 0, getUnitDisplayName(ally.getUnitId()), {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Orbitron, Arial',
        })
        .setOrigin(0.5);

      row.add([bg, label]);
      this.container.add(row);
    });

    const cancelBtn = this.scene.add
      .text(w / 2, h - 96, 'ОТМЕНА', {
        fontSize: '18px',
        color: '#fecaca',
        fontFamily: 'Rajdhani, Arial',
        backgroundColor: '#7f1d1d',
        padding: { x: 22, y: 10 },
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
