// src/managers/SceneLoader.ts
// Профессиональная система динамической загрузки сцен

import Phaser from 'phaser';

type SceneClass = new (...args: any[]) => Phaser.Scene;

interface SceneImport {
  [key: string]: SceneClass;
}

/**
 * Менеджер динамической загрузки сцен
 * Загружает сцены только когда они нужны - экономит память
 */
export class SceneLoader {
  private static loadedScenes = new Set<string>();
  private static loadingPromises = new Map<string, Promise<void>>();

  /**
   * Загрузить и запустить сцену динамически
   */
  static async loadAndStart(
    currentScene: Phaser.Scene,
    sceneKey: string,
    data?: object
  ): Promise<void> {
    await this.ensureSceneLoaded(currentScene, sceneKey);
    currentScene.scene.start(sceneKey, data);
  }

  /**
   * Загрузить сцену если еще не загружена
   */
  static async ensureSceneLoaded(
    currentScene: Phaser.Scene,
    sceneKey: string
  ): Promise<void> {
    // Уже загружена
    if (this.loadedScenes.has(sceneKey)) {
      return;
    }

    // Загружается прямо сейчас - ждем
    if (this.loadingPromises.has(sceneKey)) {
      return this.loadingPromises.get(sceneKey);
    }

    // Начинаем загрузку
    const promise = this.loadScene(currentScene, sceneKey);
    this.loadingPromises.set(sceneKey, promise);

    try {
      await promise;
      this.loadedScenes.add(sceneKey);
      console.log(`[SceneLoader] ✅ Loaded: ${sceneKey}`);
    } finally {
      this.loadingPromises.delete(sceneKey);
    }
  }

  /**
   * Загрузить сцену из файла
   */
  private static async loadScene(
    currentScene: Phaser.Scene,
    sceneKey: string
  ): Promise<void> {
    if (import.meta.env.DEV) {
      console.log(`[SceneLoader] 📦 Loading: ${sceneKey}...`);
    }

    let SceneClass: SceneClass;

    // Карта импортов - добавляй сюда новые сцены
    switch (sceneKey) {
      case 'FactionSelectScene':
        SceneClass = (await import('../scenes/FactionSelectScene')).FactionSelectScene;
        break;

      case 'ProfileSetupScene':
        SceneClass = (await import('../scenes/ProfileSetupScene')).ProfileSetupScene;
        break;

      case 'CampaignSelectScene':
        SceneClass = (await import('../scenes/CampaignSelectScene')).CampaignSelectScene;
        break;

      case 'MatchmakingScene':
        SceneClass = (await import('../scenes/MatchmakingScene')).MatchmakingScene;
        break;
      
      case 'PvPMatchmakingScene':
        SceneClass = (await import('../scenes/PvPMatchmakingScene')).PvPMatchmakingScene;
        break;

      case 'MatchPreparationScene':
        SceneClass = (await import('../scenes/MatchPreparationScene')).MatchPreparationScene;
        break;

      case 'ShopScene':
        SceneClass = (await import('../scenes/ShopScene')).ShopScene;
        break;

      case 'ProfileScene':
        SceneClass = (await import('../scenes/ProfileScene')).ProfileScene;
        break;

      case 'SettingsScene':
        SceneClass = (await import('../scenes/SettingsScene')).SettingsScene;
        break;

      case 'TeamScene':
        SceneClass = (await import('../scenes/TeamScene')).TeamScene;
        break;

      case 'LeagueScene':
        SceneClass = (await import('../scenes/LeagueScene')).LeagueScene;
        break;

      case 'TournamentScene':
        SceneClass = (await import('../scenes/TournamentScene')).TournamentScene;
        break;

      case 'TournamentBracketScene':
        SceneClass = (await import('../scenes/TournamentBracketScene')).TournamentBracketScene;
        break;

      case 'CollectionScene':
        SceneClass = (await import('../scenes/CollectionScene')).CollectionScene;
        break;

      case 'QuestsScene':
        SceneClass = (await import('../scenes/QuestsScene')).QuestsScene;
        break;

      case 'MatchModeSelectScene':
        SceneClass = (await import('../scenes/MatchModeSelectScene')).MatchModeSelectScene;
        break;

      case 'AIDifficultySelectScene':
        SceneClass = (await import('../scenes/AIDifficultySelectScene')).AIDifficultySelectScene;
        break;

      case 'BattlePassScene':
        SceneClass = (await import('../scenes/BattlePassScene')).BattlePassScene;
        break;

      default:
        if (import.meta.env.DEV) {
          console.warn(`[SceneLoader] Unknown scene: ${sceneKey}`);
        }
        throw new Error(`[SceneLoader] Unknown scene: ${sceneKey}`);
    }

    // Добавляем сцену в игру
    currentScene.scene.add(sceneKey, SceneClass, false);
  }

  /**
   * Предзагрузить сцену заранее (в фоне)
   */
  static preload(currentScene: Phaser.Scene, sceneKey: string): void {
    this.ensureSceneLoaded(currentScene, sceneKey).catch(err => {
      console.error(`[SceneLoader] Failed to preload ${sceneKey}:`, err);
    });
  }

  /**
   * Выгрузить сцену из памяти (опционально)
   */
  static unload(currentScene: Phaser.Scene, sceneKey: string): void {
    if (this.loadedScenes.has(sceneKey)) {
      currentScene.scene.remove(sceneKey);
      this.loadedScenes.delete(sceneKey);
      console.log(`[SceneLoader] 🗑️ Unloaded: ${sceneKey}`);
    }
  }
}
