import Phaser from 'phaser';

/**
 * Если PNG бейджа лиги отсутствует в билде, создаём читаемую текстуру на лету (LeagueScene, профиль и т.д.).
 */
export function ensureLeagueBadgeTexture(
  scene: Phaser.Scene,
  key: string,
  accentColor: number,
  label: string,
): void {
  if (!key || scene.textures.exists(key)) return;

  const size = 256;
  const cx = size / 2;

  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x020617, 1);
  g.fillCircle(cx, cx, cx - 2);
  g.fillStyle(0x0f172a, 1);
  g.fillCircle(cx, cx, cx - 18);
  g.lineStyle(8, accentColor, 1);
  g.strokeCircle(cx, cx, cx - 22);
  g.fillStyle(accentColor, 0.45);
  g.fillCircle(cx, cx - 10, cx * 0.38);

  const rt = scene.add.renderTexture(-4096, -4096, size, size);
  rt.fill(0x020617, 1);
  rt.draw(g, 0, 0);

  const short = (label || '?').replace(/league/gi, '').slice(0, 4).toUpperCase() || 'LG';
  const lbl = scene.add
    .text(cx, cx + 28, short, {
      fontFamily: 'Arial Black',
      fontSize: '38px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    })
    .setOrigin(0.5);
  rt.draw(lbl, 0, 0);
  lbl.destroy();

  g.destroy();
  rt.saveTexture(key);
  rt.destroy();
}
