// src/utils/ImageUtils.ts
// Утилиты для работы с изображениями

/**
 * Добавляет полноэкранный фон без искажения пропорций
 * 
 * Масштабирует изображение так, чтобы оно полностью покрывало экран,
 * сохраняя при этом оригинальное соотношение сторон (aspect ratio).
 * Изображение будет обрезано по краям, если его пропорции не совпадают с экраном.
 * 
 * @param scene - сцена Phaser
 * @param textureKey - ключ текстуры
 * @param depth - глубина отрисовки (по умолчанию 0)
 * @returns созданное изображение
 */
export function addFullScreenBackground(
  scene: Phaser.Scene,
  textureKey: string,
  depth: number = 0
): Phaser.GameObjects.Image {
  const { width, height } = scene.scale;
  
  // Создаем изображение в центре экрана
  const bg = scene.add.image(width / 2, height / 2, textureKey);
  bg.setOrigin(0.5, 0.5);
  
  // Вычисляем масштаб для покрытия всего экрана
  const scaleX = width / bg.width;
  const scaleY = height / bg.height;
  
  // Используем максимальный масштаб, чтобы покрыть весь экран
  // Это сохраняет пропорции, но может обрезать края изображения
  const scale = Math.max(scaleX, scaleY);
  
  bg.setScale(scale);
  bg.setScrollFactor(0);
  bg.setDepth(depth);
  
  return bg;
}

/**
 * Масштабирует изображение чтобы вместиться в заданные размеры (fit inside)
 * 
 * Изображение будет полностью видимо, но могут остаться пустые области.
 * 
 * @param image - изображение Phaser
 * @param maxWidth - максимальная ширина
 * @param maxHeight - максимальная высота
 */
export function scaleToFit(
  image: Phaser.GameObjects.Image,
  maxWidth: number,
  maxHeight: number
): void {
  const scaleX = maxWidth / image.width;
  const scaleY = maxHeight / image.height;
  
  // Используем минимальный масштаб, чтобы вместиться
  const scale = Math.min(scaleX, scaleY);
  
  image.setScale(scale);
}

/**
 * Масштабирует изображение чтобы заполнить заданные размеры (cover)
 * 
 * Изображение заполнит всю область, но может быть обрезано.
 * 
 * @param image - изображение Phaser
 * @param targetWidth - целевая ширина
 * @param targetHeight - целевая высота
 */
export function scaleToCover(
  image: Phaser.GameObjects.Image,
  targetWidth: number,
  targetHeight: number
): void {
  const scaleX = targetWidth / image.width;
  const scaleY = targetHeight / image.height;
  
  // Используем максимальный масштаб, чтобы покрыть всю область
  const scale = Math.max(scaleX, scaleY);
  
  image.setScale(scale);
}


