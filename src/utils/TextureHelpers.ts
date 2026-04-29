/**
 * Утилиты для работы с текстурами Phaser
 * Решают проблему несоответствия ключей загрузки и использования
 */

import Phaser from 'phaser';
import { isRealImageLoaded } from '../assets/loading/ImageLoader';

type UnitTextureRef = string | {
  id?: string;
  assetKey: string;
};

/**
 * Получает ключ текстуры юнита (проверяет HD и базовый ключ)
 * @param scene Сцена Phaser
 * @param assetKey Базовый ключ текстуры (например, 'magma_ember_fang')
 * @returns Ключ текстуры или null если не найдена
 */
export function getUnitTextureKey(scene: Phaser.Scene, assetKey: string): string | null {
  const hdKey = `${assetKey}_512`;
  
  // Сначала проверяем HD ключ (текстуры загружаются под этим ключом)
  if (scene.textures.exists(hdKey)) {
    return hdKey;
  }
  
  // Потом проверяем базовый ключ (может быть создан алиас)
  if (scene.textures.exists(assetKey)) {
    return assetKey;
  }
  
  return null;
}

/**
 * Получает ключ реального PNG юнита, игнорируя процедурные/canvas fallback-текстуры.
 */
export function getRealUnitTextureKey(scene: Phaser.Scene, unit: UnitTextureRef): string | null {
  const assetKey = typeof unit === 'string' ? unit : unit.assetKey;
  const id = typeof unit === 'string' ? undefined : unit.id;
  const candidates = [
    `${assetKey}_512`,
    assetKey,
    ...(id ? [`${id}_512`, id] : []),
  ];

  return candidates.find((key) => scene.textures.exists(key) && isRealImageLoaded(key)) || null;
}

/**
 * Получает ключ текстуры карты способности
 * @param scene Сцена Phaser
 * @param cardId ID карты (например, 'magma_lava')
 * @returns Ключ текстуры или null если не найдена
 */
export function getCardTextureKey(scene: Phaser.Scene, cardId: string): string | null {
  const key = `card_${cardId}`;
  
  if (scene.textures.exists(key)) {
    return key;
  }
  
  return null;
}

/**
 * Создаёт изображение юнита с автоматическим выбором текстуры
 * @param scene Сцена Phaser
 * @param x Позиция X
 * @param y Позиция Y
 * @param assetKey Базовый ключ текстуры
 * @param displaySize Размер отображения (если не указан, используется оригинальный размер)
 * @returns Изображение или null если текстура не найдена
 */
export function createUnitImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  assetKey: string,
  displaySize?: number
): Phaser.GameObjects.Image | null {
  const textureKey = getRealUnitTextureKey(scene, assetKey);
  
  if (!textureKey) {
    if (import.meta.env.DEV) {
      console.warn(`[TextureHelpers] Unit texture not found: ${assetKey} (tried ${assetKey}_512 and ${assetKey})`);
    }
    return null;
  }
  
  const image = scene.add.image(x, y, textureKey);
  
  if (displaySize !== undefined) {
    image.setDisplaySize(displaySize, displaySize);
  }
  
  return image;
}

/**
 * Создаёт изображение карты с автоматическим выбором текстуры
 * @param scene Сцена Phaser
 * @param x Позиция X
 * @param y Позиция Y
 * @param cardId ID карты
 * @param displayWidth Ширина отображения
 * @param displayHeight Высота отображения
 * @returns Изображение или null если текстура не найдена
 */
export function createCardImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  cardId: string,
  displayWidth: number = 60,
  displayHeight: number = 90
): Phaser.GameObjects.Image | null {
  const textureKey = getCardTextureKey(scene, cardId);
  
  if (!textureKey) {
    if (import.meta.env.DEV) {
      console.warn(`[TextureHelpers] Card texture not found: card_${cardId}`);
    }
    return null;
  }
  
  const image = scene.add.image(x, y, textureKey);
  image.setDisplaySize(displayWidth, displayHeight);
  
  return image;
}
