// src/utils/SceneHelpers.ts
// Хелперы для работы со сценами

import Phaser from 'phaser';
import { SceneLoader } from '../managers/SceneLoader';

/**
 * Безопасный запуск сцены с динамической загрузкой
 * Использовать вместо this.scene.start()
 */
export async function safeSceneStart(
  currentScene: Phaser.Scene,
  sceneKey: string,
  data?: object
): Promise<void> {
  // Core сцены (всегда загружены)
  const coreScenes = ['BootScene', 'MainMenuScene', 'GameScene'];
  
  if (import.meta.env.DEV) {
    console.debug('[SceneHelpers] safeSceneStart called:', sceneKey);
  }

  if (coreScenes.includes(sceneKey)) {
    // Core сцена - запускаем сразу
    currentScene.scene.start(sceneKey, data);
  } else {
    // Динамическая сцена - загружаем и запускаем
    await SceneLoader.loadAndStart(currentScene, sceneKey, data);
  }
}

/**
 * Предзагрузить сцену в фоне (для оптимизации)
 * Например, предзагрузить ShopScene пока игрок в MainMenu
 */
export function preloadScene(
  currentScene: Phaser.Scene,
  sceneKey: string
): void {
  SceneLoader.preload(currentScene, sceneKey);
}
