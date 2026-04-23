// src/ui/CapIcon.ts
import Phaser from 'phaser';
import { CapSkinData, getRoleColor, getRoleIcon } from '../data/SkinsCatalog';

export interface CapIconOptions {
  radius: number;
  showRoleBadge?: boolean;
  showShadow?: boolean;
  showGlow?: boolean;
}

/**
 * Универсальный красивый аватар фишки (мем / процедурная).
 * @param posX - финальная X позиция контейнера (для правильной маски)
 * @param posY - финальная Y позиция контейнера
 */
export function createCapIcon(
  scene: Phaser.Scene,
  skin: CapSkinData,
  opts: CapIconOptions,
  posX: number = 0,
  posY: number = 0
): Phaser.GameObjects.Container {
  const {
    radius,
    showRoleBadge = false,
    showShadow = true,
    showGlow = true,
  } = opts;

  const container = scene.add.container(posX, posY);
  const r = radius;

  const hasImage =
    skin.visual.type === 'image' &&
    !!skin.visual.imageKey &&
    scene.textures.exists(skin.visual.imageKey);

  const roleColor = getRoleColor(skin.role);
  const borderColor = skin.visual.borderColor ?? roleColor;
  const borderWidth = skin.visual.borderWidth ?? 3;

  // ---- GLOW ----
  if (showGlow && skin.hasGlow && skin.glowColor) {
    container.add(scene.add.circle(0, 0, r + 12, skin.glowColor, 0.18));
    container.add(scene.add.circle(0, 0, r + 6, skin.glowColor, 0.32));
  }

  // ---- SHADOW ----
  if (showShadow) {
    container.add(scene.add.ellipse(3, 4, r * 1.9, r * 1.45, 0x000000, 0.3));
  }

  // ---- MAIN DISC ----
  if (hasImage) {
    const imageKey = skin.visual.imageKey!;

    // Мягкий внешний бордер
    container.add(scene.add.circle(0, 0, r + borderWidth + 1, borderColor, 0.22));

    // Основной бордер
    container.add(scene.add.circle(0, 0, r + borderWidth, borderColor));

    // Белый фон
    container.add(scene.add.circle(0, 0, r, 0xffffff));

    // PNG-мем
    const image = scene.add.image(0, 0, imageKey);
    const texture = scene.textures.get(imageKey);
    const frame = texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const imgSize = Math.max(frame.width, frame.height);
    const targetSize = r * 2 * 0.9;
    image.setScale(targetSize / imgSize);
    container.add(image);

    // Круглая маска в мировых координатах
    const maskGraphics = scene.add.graphics();
    maskGraphics.fillStyle(0xffffff);
    maskGraphics.fillCircle(posX, posY, r);
    maskGraphics.setVisible(false);
    image.setMask(maskGraphics.createGeometryMask());

    // Внутреннее светлое кольцо
    const innerRing = scene.add.graphics();
    innerRing.lineStyle(1.2, 0xffffff, 0.35);
    innerRing.strokeCircle(0, 0, r * 0.9);
    container.add(innerRing);

    // Блик
    container.add(
      scene.add.ellipse(-r * 0.28, -r * 0.3, r * 0.55, r * 0.32, 0xffffff, 0.16)
    );

    // Обводка сверху
    const topRing = scene.add.graphics();
    topRing.lineStyle(1.5, borderColor, 0.9);
    topRing.strokeCircle(0, 0, r);
    container.add(topRing);

  } else if (skin.visual.textureKey && scene.textures.exists(skin.visual.textureKey)) {
    // Процедурный скин
    container.add(
      scene.add.sprite(0, 0, skin.visual.textureKey).setScale((r * 2) / 128)
    );
  } else {
    // Fallback
    const g = scene.add.graphics();
    g.fillStyle(skin.primaryColor);
    g.fillCircle(0, 0, r);
    g.lineStyle(3, skin.secondaryColor);
    g.strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.18);
    g.fillEllipse(-r * 0.3, -r * 0.3, r * 0.5, r * 0.32);
    container.add(g);
  }

  // ---- ROLE BADGE ----
  if (showRoleBadge) {
    const badgeR = r * 0.4;
    const bx = r * 0.78;
    const by = -r * 0.78;

    const badgeBg = scene.add.circle(bx, by, badgeR, 0x000000, 0.8);
    badgeBg.setStrokeStyle(1.5, roleColor, 0.9);
    container.add(badgeBg);

    // Use PNG icon with fallback to emoji
    const iconSize = Math.round(badgeR * 1.2);
    const roleIconKey = `role_${skin.role}`;
    
    if (scene.textures.exists(roleIconKey)) {
      const icon = scene.add.image(bx, by, roleIconKey);
      const scale = iconSize / 128;
      icon.setScale(scale);
      icon.setOrigin(0.5);
      container.add(icon);
    } else {
      // Fallback to emoji
      container.add(
        scene.add
          .text(bx, by, getRoleIcon(skin.role), {
            fontSize: `${iconSize}px`,
          })
          .setOrigin(0.5)
      );
    }
  }

  return container;
}