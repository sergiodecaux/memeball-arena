// Фон во время preload сцен и оверлеев загрузки: не голый чёрный экран.
import Phaser from 'phaser';

const SPLASH_TEXTURE_KEY = 'ui_home_bg';
const FALLBACK_CAMERA_COLOR = '#0f172a';

/**
 * Полноэкранный фон до появления бандла текстур или как запас без ассета.
 */
export function addAssetLoadingBackdrop(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const cam = scene.cameras.main;
  const out: Phaser.GameObjects.GameObject[] = [];
  const z = -2000;

  if (scene.textures.exists(SPLASH_TEXTURE_KEY)) {
    const img = scene.add.image(cam.centerX, cam.centerY, SPLASH_TEXTURE_KEY).setOrigin(0.5);
    const scale = Math.max(cam.width / img.width, cam.height / img.height) * 1.02;
    img.setScale(scale).setDepth(z);
    out.push(img);
    out.push(
      scene.add
        .rectangle(cam.centerX, cam.centerY, cam.width + 8, cam.height + 8, 0x000000, 0.48)
        .setDepth(z + 1)
    );
    return out;
  }

  scene.cameras.main.setBackgroundColor(FALLBACK_CAMERA_COLOR);

  const g = scene.add.graphics({ x: 0, y: 0 }).setDepth(z);
  g.fillStyle(0x0f172a, 1);
  g.fillRect(0, 0, cam.width, cam.height);
  g.fillStyle(0x1e3a5f, 0.55);
  g.fillCircle(cam.centerX - cam.width * 0.1, cam.height * 0.18, cam.width * 0.72);
  g.fillStyle(0x312e81, 0.35);
  g.fillCircle(cam.width * 0.92, cam.height * 0.76, cam.width * 0.58);
  out.push(g);

  out.push(scene.add.rectangle(cam.centerX, cam.centerY, cam.width + 8, cam.height + 8, 0x000000, 0.35).setDepth(z + 1));

  return out;
}

export function destroyAssetLoadingBackdrop(nodes?: Phaser.GameObjects.GameObject[]): void {
  if (!nodes?.length) return;
  for (const obj of nodes) {
    try {
      obj.destroy();
    } catch {
      // ignore
    }
  }
}
