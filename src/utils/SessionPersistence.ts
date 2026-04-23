// src/utils/SessionPersistence.ts
// Сохранение состояния сессии для восстановления после перезагрузки WebView

interface SessionState {
  currentScene: string;
  sceneData?: any;
  timestamp: number;
  matchState?: {
    score: [number, number];
    turn: number;
    playerFaction: string;
    opponentFaction: string;
    mode: string;
  };
}

const SESSION_KEY = 'soccer_caps_session';
const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 минут - сессия актуальна

export class SessionPersistence {
  
  /**
   * Сохранить текущее состояние сцены
   */
  static saveCurrentScene(sceneName: string, data?: any): void {
    const state: SessionState = {
      currentScene: sceneName,
      sceneData: data,
      timestamp: Date.now(),
    };
    
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
      // sessionStorage может быть недоступен
      console.warn('[SessionPersistence] Failed to save:', e);
    }
  }
  
  /**
   * Сохранить состояние матча (для восстановления mid-game)
   */
  static saveMatchState(matchState: SessionState['matchState']): void {
    try {
      const existing = sessionStorage.getItem(SESSION_KEY);
      const state: SessionState = existing 
        ? JSON.parse(existing) 
        : { currentScene: 'GameScene', timestamp: Date.now() };
      
      state.matchState = matchState;
      state.timestamp = Date.now();
      
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[SessionPersistence] Failed to save match state:', e);
    }
  }
  
  /**
   * Получить сохранённое состояние (если актуально)
   */
  static getRestoredState(): SessionState | null {
    try {
      const data = sessionStorage.getItem(SESSION_KEY);
      if (!data) return null;
      
      const state: SessionState = JSON.parse(data);
      
      // Проверяем актуальность (не старше 5 минут)
      if (Date.now() - state.timestamp > SESSION_TIMEOUT) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      
      return state;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Очистить сохранённое состояние
   */
  static clear(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {
      // ignore
    }
  }
  
  /**
   * Проверить, нужно ли восстановление
   */
  static needsRestore(): boolean {
    return this.getRestoredState() !== null;
  }
}
