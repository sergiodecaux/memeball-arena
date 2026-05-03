// src/managers/AnnouncerManager.ts

import Phaser from 'phaser';
import { FactionId, FACTIONS } from '../constants/gameConstants';
import { AudioManager } from './AudioManager';

/**
 * Конфигурация для приглушения музыки (Audio Ducking)
 */
interface DuckingConfig {
  targetVolume: number;
  fadeTime: number;
}

/**
 * Элемент очереди воспроизведения
 */
interface QueueItem {
  key: string;
  priority: 'normal' | 'high';
  onStart?: () => void;
  onComplete?: () => void;
}

/**
 * AnnouncerManager — Singleton для управления голосом комментатора
 */
export class AnnouncerManager {
  private static instance: AnnouncerManager;
  
  private scene!: Phaser.Scene;
  private audioManager: AudioManager;
  
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentSound: Phaser.Sound.BaseSound | null = null;
  
  private duckingConfig: DuckingConfig = {
    targetVolume: 0.2,
    fadeTime: 200,
  };
  private originalMusicVolume = 0.4;
  private isDucked = false;
  private duckingTween: Phaser.Tweens.Tween | null = null;

  private constructor() {
    this.audioManager = AudioManager.getInstance();
  }

  public static getInstance(): AnnouncerManager {
    if (!AnnouncerManager.instance) {
      AnnouncerManager.instance = new AnnouncerManager();
    }
    return AnnouncerManager.instance;
  }

  public init(scene: Phaser.Scene): void {
    this.scene = scene;
    this.queue = [];
    this.isPlaying = false;
    this.currentSound = null;
    this.isDucked = false;
  }

  /**
   * Добавляет голосовую фразу в очередь
   * ВАЖНО: onStart вызывается когда звук НАЧИНАЕТ играть, не при добавлении!
   */
  public announce(
    key: string,
    options: {
      priority?: 'normal' | 'high';
      onStart?: () => void;
      onComplete?: () => void;
    } = {}
  ): void {
    const item: QueueItem = {
      key,
      priority: options.priority || 'normal',
      onStart: options.onStart,
      onComplete: options.onComplete,
    };

    if (item.priority === 'high') {
      this.queue.unshift(item);
    } else {
      this.queue.push(item);
    }

    // Запускаем обработку очереди только если не играем
    if (!this.isPlaying) {
      this.processQueue();
    }
  }

  /**
   * Объявляет начало матча с анимацией
   * Callbacks вызываются СИНХРОННО с воспроизведением каждой фразы
   */
  public async announceMatchStart(
    faction1: FactionId,
    faction2: FactionId,
    callbacks?: {
      onWelcome?: () => void;
      onFaction1?: () => void;
      onVS?: () => void;
      onFaction2?: () => void;
      onFight?: () => void;
      onComplete?: () => void;
    }
  ): Promise<void> {
    return new Promise((resolve) => {
      // Очищаем очередь перед началом
      this.clear();
      
      // Строим последовательность - callbacks будут вызваны при START воспроизведения
      this.announce('voice_welcome', {
        priority: 'high',
        onStart: () => {
          console.log('[Announcer] 🎤 Playing: Welcome');
          callbacks?.onWelcome?.();
        },
      });

      this.announce(`voice_${faction1}`, {
        onStart: () => {
          console.log(`[Announcer] 🎤 Playing: ${faction1} - FLIP CARD 1`);
          callbacks?.onFaction1?.();
        },
      });

      this.announce('voice_vs', {
        onStart: () => {
          console.log('[Announcer] 🎤 Playing: VS');
          callbacks?.onVS?.();
        },
      });

      this.announce(`voice_${faction2}`, {
        onStart: () => {
          console.log(`[Announcer] 🎤 Playing: ${faction2} - FLIP CARD 2`);
          callbacks?.onFaction2?.();
        },
      });

      this.announce('voice_fight', {
        onStart: () => {
          console.log('[Announcer] 🎤 Playing: FIGHT!');
          callbacks?.onFight?.();
        },
        onComplete: () => {
          console.log('[Announcer] ✅ Sequence complete');
          callbacks?.onComplete?.();
          resolve();
        },
      });
    });
  }

  /**
   * Объявляет гол
   */
  public announceGoal(onComplete?: () => void): void {
    const isScream = Math.random() > 0.5;
    const key = isScream ? 'voice_scream' : 'voice_goal';
    
    this.announce(key, {
      priority: 'high',
      onComplete,
    });
  }

  /**
   * Объявляет доминирование
   */
  public announceDominating(): void {
    this.announce('voice_dominating', { priority: 'high' });
  }

  /**
   * Объявляет результат матча
   */
  public announceResult(isWin: boolean, onComplete?: () => void): void {
    const key = isWin ? 'voice_victory' : 'voice_defeat';
    this.announce(key, {
      priority: 'high',
      onComplete,
    });
  }

  /**
   * Итог матча: победа / поражение / ничья (ничья не озвучивается как поражение).
   */
  public announceMatchOutcome(
    outcome: 'win' | 'loss' | 'draw',
    onComplete?: () => void
  ): void {
    if (outcome === 'draw') {
      if (this.scene?.cache.audio.exists('voice_draw')) {
        this.announce('voice_draw', { priority: 'high', onComplete });
      } else if (onComplete) {
        this.scene.time.delayedCall(120, onComplete);
      }
      return;
    }
    this.announceResult(outcome === 'win', onComplete);
  }

  /**
   * Немедленно воспроизводит звук без очереди (для SFX)
   */
  public playSFX(key: string, volume = 1.0): void {
    if (!this.scene?.sound) return;
    
    try {
      if (this.scene.cache.audio.exists(key)) {
        this.scene.sound.play(key, { volume });
      }
    } catch (e) {
      console.warn(`[Announcer] Failed to play SFX: ${key}`, e);
    }
  }

  /**
   * Очищает очередь и останавливает текущее воспроизведение
   */
  public clear(): void {
    this.queue = [];
    
    if (this.currentSound) {
      try {
        this.currentSound.stop();
        this.currentSound.destroy();
      } catch (e) {
        // Игнорируем
      }
      this.currentSound = null;
    }
    
    this.isPlaying = false;
    this.restoreMusic();
  }

  // === PRIVATE METHODS ===

  /**
   * Обрабатывает очередь воспроизведения
   * onStart вызывается ЗДЕСЬ - когда звук реально начинает играть
   */
  private processQueue(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.restoreMusic();
      return;
    }

    this.isPlaying = true;
    const item = this.queue.shift()!;

    // Приглушаем музыку
    this.duckMusic();

    // Проверяем наличие звука
    const hasSound = this.scene?.cache?.audio?.exists(item.key);
    
    if (!hasSound) {
      console.warn(`[Announcer] ⚠️ Sound not found: ${item.key}`);
      
      // Даже если звука нет - вызываем onStart! (для анимаций)
      item.onStart?.();
      
      // Имитируем задержку и продолжаем
      this.scene.time.delayedCall(600, () => {
        item.onComplete?.();
        this.processQueue();
      });
      return;
    }

    try {
      // Создаём звук
      this.currentSound = this.scene.sound.add(item.key, { volume: 1.0 });
      
      // === КРИТИЧЕСКИ ВАЖНО: onStart вызывается ЗДЕСЬ ===
      // Звук сейчас начнёт играть, поэтому вызываем callback
      console.log(`[Announcer] ▶️ Starting: ${item.key}`);
      item.onStart?.();

      // Подписываемся на завершение
      this.currentSound.once('complete', () => {
        console.log(`[Announcer] ⏹️ Completed: ${item.key}`);
        this.currentSound = null;
        item.onComplete?.();
        this.processQueue();
      });

      // Запускаем воспроизведение
      this.currentSound.play();

    } catch (e) {
      console.warn(`[Announcer] Error playing: ${item.key}`, e);
      
      // При ошибке тоже вызываем onStart
      item.onStart?.();
      
      this.scene.time.delayedCall(400, () => {
        item.onComplete?.();
        this.processQueue();
      });
    }
  }

  /**
   * Приглушает фоновую музыку (Audio Ducking)
   */
  private duckMusic(): void {
    if (this.isDucked) return;
    this.isDucked = true;

    const ambience = (this.audioManager as any).ambience as Phaser.Sound.BaseSound | null;
    if (!ambience || !ambience.isPlaying) return;

    this.originalMusicVolume = (ambience as any).volume || 0.2;

    if (this.duckingTween) {
      this.duckingTween.stop();
    }

    this.duckingTween = this.scene.tweens.add({
      targets: ambience,
      volume: this.originalMusicVolume * this.duckingConfig.targetVolume,
      duration: this.duckingConfig.fadeTime,
      ease: 'Power2',
    });
  }

  /**
   * Восстанавливает громкость музыки
   */
  private restoreMusic(): void {
    if (!this.isDucked) return;
    this.isDucked = false;

    const ambience = (this.audioManager as any).ambience as Phaser.Sound.BaseSound | null;
    if (!ambience || !ambience.isPlaying) return;

    if (this.duckingTween) {
      this.duckingTween.stop();
    }

    this.duckingTween = this.scene.tweens.add({
      targets: ambience,
      volume: this.originalMusicVolume,
      duration: this.duckingConfig.fadeTime,
      ease: 'Power2',
    });
  }

  public get isSpeaking(): boolean {
    return this.isPlaying;
  }

  public get queueLength(): number {
    return this.queue.length;
  }
}