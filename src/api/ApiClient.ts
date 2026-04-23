// src/api/ApiClient.ts
// =====================================================
// 🌐 GALAXY LEAGUE API CLIENT
// Синхронизация данных с сервером
// =====================================================

import { FactionId } from '../constants/gameConstants';

const API_BASE_URL = 'https://game.galaxyleague.ru/api';

interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  [key: string]: any;
}

interface SyncResult {
  action: 'download' | 'synced' | 'error';
  player?: any;
  syncTimestamp?: number;
  error?: string;
}

class ApiClient {
  private static instance: ApiClient;
  private sessionToken: string | null = null;
  private telegramInitData: string | null = null;
  private isOnline: boolean = true;
  private syncQueue: Array<() => Promise<void>> = [];
  private isSyncing: boolean = false;
  private lastSyncTimestamp: number = 0;

  private constructor() {
    this.initTelegramData();
    this.setupOnlineListener();
    this.restoreSession();
  }

  static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  // =====================================================
  // 🔧 INITIALIZATION
  // =====================================================

  private initTelegramData(): void {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        this.telegramInitData = tg.initData;
        console.log('[API] Telegram initData loaded');
      } else {
        console.warn('[API] No Telegram initData available');
      }
    } catch (e) {
      console.error('[API] Failed to get Telegram data:', e);
    }
  }

  private setupOnlineListener(): void {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('[API] Connection restored, processing sync queue...');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('[API] Connection lost, queuing requests...');
    });
  }

  // =====================================================
  // 🌐 HTTP METHODS
  // =====================================================

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.telegramInitData) {
      headers['X-Telegram-Init-Data'] = this.telegramInitData;
    }

    if (this.sessionToken) {
      headers['Authorization'] = `Bearer ${this.sessionToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error(`[API] Error ${response.status}:`, data);
        return { error: data.error || 'Request failed' };
      }

      return data;
    } catch (error) {
      console.error('[API] Network error:', error);
      return { error: 'Network error' };
    }
  }

  private async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  private async post<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  private async put<T>(endpoint: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  // =====================================================
  // 🔐 AUTHENTICATION
  // =====================================================

  async authenticate(): Promise<{ success: boolean; isNewPlayer: boolean; player?: any }> {
    if (!this.telegramInitData) {
      console.warn('[API] No Telegram data for authentication');
      return { success: false, isNewPlayer: false };
    }

    const result = await this.post<any>('/auth/telegram', {
      initData: this.telegramInitData,
    });

    if (result.error) {
      console.error('[API] Authentication failed:', result.error);
      return { success: false, isNewPlayer: false };
    }

    if (result.sessionToken) {
      this.sessionToken = result.sessionToken;
      localStorage.setItem('gl_session_token', result.sessionToken);
    }

    console.log('[API] Authentication successful:', {
      isNewPlayer: result.isNewPlayer,
      playerId: result.player?.id,
    });

    return {
      success: true,
      isNewPlayer: result.isNewPlayer,
      player: result.player,
    };
  }

  restoreSession(): boolean {
    const token = localStorage.getItem('gl_session_token');
    if (token) {
      this.sessionToken = token;
      return true;
    }
    return false;
  }

  // =====================================================
  // 📊 PLAYER DATA
  // =====================================================

  async getPlayerData(): Promise<any | null> {
    const result = await this.get<any>('/player');
    if (result.error) {
      console.error('[API] Failed to get player data:', result.error);
      return null;
    }
    return result;
  }

  async updatePlayerData(data: any): Promise<boolean> {
    const result = await this.put<any>('/player', {
      display_name: data.nickname,
      avatar_id: data.avatarId,
      selected_faction: data.selectedFaction,
    });

    return !result.error;
  }

  // =====================================================
  // 🔄 SYNC SYSTEM
  // =====================================================

  async syncWithServer(localData: any): Promise<SyncResult> {
    if (!this.isOnline) {
      console.log('[API] Offline, queuing sync...');
      return { action: 'error', error: 'Offline' };
    }

    if (!this.telegramInitData) {
      console.log('[API] No Telegram auth, skipping sync');
      return { action: 'error', error: 'No auth' };
    }

    const result = await this.post<any>('/sync', {
      playerData: this.formatForServer(localData),
      lastSyncTimestamp: this.lastSyncTimestamp,
    });

    if (result.error) {
      return { action: 'error', error: result.error };
    }

    this.lastSyncTimestamp = result.syncTimestamp || Date.now();

    if (result.action === 'download' && result.player) {
      console.log('[API] Server data is newer, downloading...');
      return {
        action: 'download',
        player: result.player,
        syncTimestamp: this.lastSyncTimestamp,
      };
    }

    return {
      action: 'synced',
      syncTimestamp: this.lastSyncTimestamp,
    };
  }

  private formatForServer(data: any): any {
    return {
      displayName: data.nickname,
      avatarId: data.avatarId,
      level: data.level,
      xp: data.xp,
      coins: data.coins,
      crystals: data.crystals,
      selectedFaction: data.selectedFaction,
      totalMatches: data.stats?.gamesPlayed || 0,
      totalWins: data.stats?.wins || 0,
      totalGoalsScored: data.stats?.goalsScored || 0,
      battlePassTier: data.battlePass?.currentTier || 1,
      battlePassXp: data.battlePass?.currentXP || 0,
      units: this.formatUnitsForServer(data),
    };
  }

  private formatUnitsForServer(data: any): any[] {
    const units: any[] = [];

    const factions: FactionId[] = ['magma', 'cyborg', 'void', 'insect'];
    factions.forEach(factionId => {
      const ownedUnits = data.ownedUnits?.[factionId] || [];
      ownedUnits.forEach((unit: any) => {
        units.push({
          unitId: unit.id,
          unlocked: true,
          fragments: 0,
          level: 1,
        });
      });
    });

    (data.ownedUniqueUnits || []).forEach((unitId: string) => {
      if (!units.find(u => u.unitId === unitId)) {
        units.push({
          unitId,
          unlocked: true,
          fragments: data.unitFragments?.[unitId] || 0,
          level: 1,
        });
      }
    });

    return units;
  }

  // =====================================================
  // 🎮 MATCH RESULTS
  // =====================================================

  async saveMatchResult(matchData: {
    matchType: 'pvp' | 'league' | 'tournament' | 'campaign' | 'friendly';
    result: 'win' | 'loss' | 'draw';
    playerScore: number;
    opponentScore: number;
    opponentTelegramId?: number;
    opponentName?: string;
    playerFaction?: string;
    opponentFaction?: string;
    mmrChange?: number;
    coinsEarned?: number;
    xpEarned?: number;
    matchDuration?: number;
  }): Promise<boolean> {
    if (!this.isOnline || !this.telegramInitData) {
      return false;
    }

    const result = await this.post<any>('/match/result', matchData);
    return !result.error;
  }

  async getMatchHistory(limit: number = 20): Promise<any[]> {
    const result = await this.get<any>(`/match/history?limit=${limit}`);
    return result.matches || [];
  }

  // =====================================================
  // 💰 CURRENCY
  // =====================================================

  async updateCurrency(
    currency: 'coins' | 'crystals',
    amount: number,
    reason: string
  ): Promise<boolean> {
    if (!this.isOnline || !this.telegramInitData) {
      return false;
    }

    const result = await this.post<any>('/player/currency', {
      currency,
      amount,
      reason,
    });

    return !result.error;
  }

  // =====================================================
  // 🏆 LEADERBOARD
  // =====================================================

  async getLeaderboard(limit: number = 100): Promise<any[]> {
    const result = await this.get<any>(`/leaderboard?limit=${limit}`);
    return result.leaderboard || [];
  }

  // =====================================================
  // 🔧 QUEUE MANAGEMENT
  // =====================================================

  private queueSync(action: () => Promise<void>): void {
    this.syncQueue.push(action);
  }

  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.length === 0) return;

    this.isSyncing = true;
    console.log(`[API] Processing ${this.syncQueue.length} queued actions...`);

    while (this.syncQueue.length > 0 && this.isOnline) {
      const action = this.syncQueue.shift();
      if (action) {
        try {
          await action();
        } catch (e) {
          console.error('[API] Queue action failed:', e);
        }
      }
    }

    this.isSyncing = false;
  }

  // =====================================================
  // 🔍 UTILITIES
  // =====================================================

  isAuthenticated(): boolean {
    return !!this.sessionToken;
  }

  hasTelegramAuth(): boolean {
    return !!this.telegramInitData;
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  getLastSyncTimestamp(): number {
    return this.lastSyncTimestamp;
  }
}

export const apiClient = ApiClient.getInstance();
