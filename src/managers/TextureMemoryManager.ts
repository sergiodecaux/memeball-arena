// src/managers/TextureMemoryManager.ts
// ✅ FIX 2026-01-22: Агрессивная выгрузка текстур для предотвращения вылетов в Telegram

import Phaser from 'phaser';

/**
 * Менеджер памяти текстур
 * 
 * Проблема: 80 текстур юнитов (1024×1024) потребляют ~700 MB памяти в WebGL
 * Telegram WebView имеет лимит 200-500 MB → вылеты
 * 
 * Решение: Агрессивно выгружаем неиспользуемые текстуры
 * Результат: ↓500 MB памяти, только нужные текстуры в памяти
 */
export class TextureMemoryManager {
  private static loadedUnitTextures = new Set<string>();
  private static loadedFactionTextures = new Map<string, Set<string>>();
  
  /**
   * Зарегистрировать загруженную текстуру юнита
   */
  static registerUnitTexture(key: string, faction?: string): void {
    this.loadedUnitTextures.add(key);
    
    if (faction) {
      if (!this.loadedFactionTextures.has(faction)) {
        this.loadedFactionTextures.set(faction, new Set());
      }
      this.loadedFactionTextures.get(faction)!.add(key);
    }
  }
  
  /**
   * Выгрузить ВСЕ текстуры юнитов (кроме указанных)
   * Используется в GameScene.shutdown() для полной очистки памяти
   */
  static unloadAllUnitsExcept(scene: Phaser.Scene, keepKeys: string[] = []): void {
    const keepSet = new Set(keepKeys);
    let unloadedCount = 0;
    
    this.loadedUnitTextures.forEach(key => {
      if (!keepSet.has(key) && scene.textures.exists(key)) {
        scene.textures.remove(key);
        unloadedCount++;
      }
    });
    
    // Очищаем список
    this.loadedUnitTextures.clear();
    this.loadedFactionTextures.clear();
    
    // Восстанавливаем только те, что нужно оставить
    keepKeys.forEach(k => this.loadedUnitTextures.add(k));
    
    if (unloadedCount > 0) {
      console.log(`[TextureMemory] Unloaded ${unloadedCount} unit textures (~${unloadedCount} MB freed)`);
    }
  }
  
  /**
   * Выгрузить текстуры конкретной фракции
   * Используется в CollectionScene при переключении фракций
   */
  static unloadFactionTextures(scene: Phaser.Scene, faction: string): void {
    const factionTextures = this.loadedFactionTextures.get(faction);
    if (!factionTextures) {
      return;
    }
    
    let unloadedCount = 0;
    
    factionTextures.forEach(key => {
      if (scene.textures.exists(key)) {
        scene.textures.remove(key);
        this.loadedUnitTextures.delete(key);
        unloadedCount++;
      }
    });
    
    this.loadedFactionTextures.delete(faction);
    
    if (unloadedCount > 0) {
      console.log(`[TextureMemory] Unloaded ${unloadedCount} ${faction} textures (~${unloadedCount} MB freed)`);
    }
  }
  
  /**
   * Выгрузить все текстуры кроме указанных фракций
   * Полезно для освобождения памяти при переходе между сценами
   */
  static unloadAllFactionsExcept(scene: Phaser.Scene, keepFactions: string[] = []): void {
    const keepSet = new Set(keepFactions);
    let totalUnloaded = 0;
    
    this.loadedFactionTextures.forEach((textures, faction) => {
      if (!keepSet.has(faction)) {
        textures.forEach(key => {
          if (scene.textures.exists(key)) {
            scene.textures.remove(key);
            this.loadedUnitTextures.delete(key);
            totalUnloaded++;
          }
        });
        this.loadedFactionTextures.delete(faction);
      }
    });
    
    if (totalUnloaded > 0) {
      console.log(`[TextureMemory] Unloaded ${totalUnloaded} textures from unused factions (~${totalUnloaded} MB freed)`);
    }
  }
  
  /**
   * Получить статистику памяти
   */
  static getStats(): { 
    totalTextures: number; 
    factions: number;
    estimatedMB: number;
    details: Map<string, number>;
  } {
    const details = new Map<string, number>();
    
    this.loadedFactionTextures.forEach((textures, faction) => {
      details.set(faction, textures.size);
    });
    
    const totalTextures = this.loadedUnitTextures.size;
    // Средняя текстура 1024×1024×4 (RGBA) = 4 MB в памяти
    // С мипмапами: 4 MB × 1.33 = ~5.3 MB
    const estimatedMB = Math.round(totalTextures * 5.3);
    
    return { 
      totalTextures,
      factions: this.loadedFactionTextures.size,
      estimatedMB,
      details
    };
  }
  
  /**
   * Вывести статистику в консоль (для отладки)
   */
  static logStats(): void {
    const stats = this.getStats();
    console.log(`[TextureMemory] Stats:`, {
      totalTextures: stats.totalTextures,
      factions: stats.factions,
      estimatedMemory: `~${stats.estimatedMB} MB`,
      perFaction: Object.fromEntries(stats.details)
    });
  }
  
  /**
   * Полная очистка (для экстренных случаев)
   */
  static clearAll(scene: Phaser.Scene): void {
    this.unloadAllUnitsExcept(scene, []);
    console.log('[TextureMemory] All unit textures cleared');
  }
}
