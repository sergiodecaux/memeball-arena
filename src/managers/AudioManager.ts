// src/managers/AudioManager.ts

import Phaser from 'phaser';
import { UIFactionId } from '../constants/factionUiConfig';
import { globalCleanup } from '../utils/GlobalCleanup';

export class AudioManager {
  private static instance: AudioManager;
  private scene!: Phaser.Scene;
  
  public isSoundEnabled: boolean = true;
  public isMusicEnabled: boolean = true;

  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private currentMusicKey: string | null = null;  // ✅ ДОБАВЛЕНО: Отслеживание ключа текущей музыки
  private ambience: Phaser.Sound.BaseSound | null = null;

  // ✅ NEW: Длинные "музыкальные" SFX результата матча (win/lose/draw), чтобы можно было остановить отдельно
  private resultMusic: Phaser.Sound.BaseSound | null = null;

  // Длинный звук раскрытия пака (sfx_pack_reveal), чтобы можно было его глушить при tap-skip
  private packRevealSound: Phaser.Sound.BaseSound | null = null;

  // ✅ FIX: Не создаём AudioContext до первого взаимодействия
  private audioContextReady = false;

  // ✅ NEW: Музыка, которую нужно запустить после разблокировки AudioContext
  private pendingMusicKey: string | null = null;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(scene: Phaser.Scene) {
    this.scene = scene;
    this.initAudioOnInteraction();
  }

  /**
   * Инициализирует AudioContext только после первого взаимодействия пользователя
   * Это необходимо для соблюдения политики автовоспроизведения браузеров
   */
  private initAudioOnInteraction(): void {
    if (this.audioContextReady) return;
    
    const events = ['touchstart', 'touchend', 'mousedown', 'keydown'] as const;
    
    // Проверяем поддержку { once } (iOS 12-13 в WKWebView не поддерживает)
    const supportsOnce = (() => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return false;
      let supported = false;
      try {
        const opts = Object.defineProperty({}, 'once', {
          get: () => { supported = true; return true; }
        });
        document.addEventListener('test', () => {}, opts);
        document.removeEventListener('test', () => {}, opts);
      } catch (e) {
        // Не поддерживается
      }
      return supported;
    })();

    const initAudio = () => {
      if (this.audioContextReady) return; // защита от повторного вызова
      this.audioContextReady = true;
      // AudioContext будет создан автоматически при первом вызове play()
      if (import.meta.env.DEV) {
        console.log('[AudioManager] AudioContext unlocked via user interaction');
      }
      
      // Удаляем listeners если once не сработал
      if (!supportsOnce) {
        events.forEach(eventName => {
          document.removeEventListener(eventName, initAudio);
        });
      }

      // ✅ NEW: Если есть отложенная музыка — запускаем её
      if (this.pendingMusicKey) {
        const key = this.pendingMusicKey;
        this.pendingMusicKey = null;
        // ✅ FIX: Используем requestAnimationFrame вместо setTimeout для безопасности
        if (typeof requestAnimationFrame !== 'undefined') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              this.playMusic(key);
            });
          });
        }
      }
    };
    
    // Подписываемся на ВСЕ возможные события взаимодействия
    events.forEach(eventName => {
      if (supportsOnce) {
        document.addEventListener(eventName, initAudio, { once: true });
      } else {
        // Fallback: регистрируем через globalCleanup для гарантированной очистки
        globalCleanup.addListener(document, eventName, initAudio);
      }
    });
  }

  /**
   * ✅ NEW: Принудительно разблокировать AudioContext (например, по первому pointerdown в сцене)
   */
  public unlockAudioContext(): void {
    if (this.audioContextReady) return;
    this.audioContextReady = true;
    console.log('[AudioManager] AudioContext manually unlocked');
    
    // Запускаем отложенную музыку
    if (this.pendingMusicKey) {
      const key = this.pendingMusicKey;
      this.pendingMusicKey = null;
      this.playMusic(key);
    }
  }

  public loadSettings(settings: { soundEnabled: boolean; musicEnabled: boolean }) {
    this.isSoundEnabled = settings.soundEnabled;
    this.isMusicEnabled = settings.musicEnabled;
    
    if (!this.isMusicEnabled) {
      this.stopMusic();
      this.stopAmbience();
    }
  }

  // --- УПРАВЛЕНИЕ ПОТОКАМИ ---

  public stopAll() {
    this.stopMusic();
    this.stopAmbience();
    this.stopPackReveal(); // глушим длинный звук пака, если играет

    if (this.scene && this.scene.sound) {
      this.scene.sound.stopAll();
    }
  }

  /**
   * ✅ NEW: Полная остановка всех звуков (music/ambience/sfx tails) в текущем контексте сцены
   */
  public stopAllSounds(): void {
    this.stopMusic();
    this.stopAmbience();
    this.stopPackReveal();
    this.stopFactionSelectSounds();
    this.stopResultMusic(); // ✅ ДОБАВЛЕНО
    
    // Останавливаем ВСЕ звуки в текущей сцене
    if (this.scene?.sound) {
      try {
        this.scene.sound.stopAll();
      } catch (e) {
        console.warn('[AudioManager] Error stopping all sounds:', e);
      }
    }
  }

  /**
   * ✅ NEW: Воспроизводит музыку результата матча (длинные треки: win/lose/draw)
   */
  public playResultMusic(key: 'sfx_win' | 'sfx_lose' | 'sfx_draw'): void {
    if (!this.isSoundEnabled) return;

    // Останавливаем предыдущую музыку результата
    this.stopResultMusic();

    try {
      if (this.scene?.sound && (this.scene.cache as any).audio?.exists?.(key) ? (this.scene.cache as any).audio.exists(key) : this.scene.cache.audio.has(key)) {
        this.resultMusic = this.scene.sound.add(key, {
          loop: false,
          volume: 0.7,
        });
        this.resultMusic.play();
        console.log(`[AudioManager] Playing result music: ${key}`);
      }
    } catch (e) {
      console.warn('[AudioManager] Could not play result music:', key, e);
    }
  }

  /**
   * ✅ NEW: Останавливает музыку результата матча
   */
  public stopResultMusic(): void {
    if (this.resultMusic) {
      try {
        this.resultMusic.stop();
        this.resultMusic.destroy();
      } catch (e) {
        console.warn('[AudioManager] Error stopping result music:', e);
      }
      this.resultMusic = null;
    }

    // Также останавливаем по ключам на случай если были запущены через playSFX
    if (this.scene?.sound) {
      try {
        this.scene.sound.stopByKey('sfx_win');
        this.scene.sound.stopByKey('sfx_lose');
        this.scene.sound.stopByKey('sfx_draw');
      } catch {
        // игнорируем
      }
    }
  }

  /**
   * ✅ NEW: Проверяет, играет ли музыка с указанным ключом
   */
  public isPlaying(key: string): boolean {
    if (!this.currentMusic) return false;
    try {
      return this.currentMusicKey === key && this.currentMusic.isPlaying;
    } catch {
      return false;
    }
  }

  // --- МУЗЫКА ---

  public playMusic(key: string) {
    if (!this.isMusicEnabled) return;
    
    if (!this.audioContextReady) {
      console.log('[AudioManager] Music playback deferred until user interaction');
      this.pendingMusicKey = key;
      return;
    }
    
    // ✅ ИСПРАВЛЕНО: Проверяем по сохранённому ключу
    if (this.currentMusicKey === key) {
      // Тот же трек — проверяем играет ли
      try {
        if (this.currentMusic?.isPlaying) {
          console.log(`[AudioManager] Music "${key}" already playing, skipping`);
          return;
        }
      } catch (e) {
        // Звук мог быть уничтожен при смене сцены — продолжаем
      }
    }
    
    // Другой трек или текущий не играет — останавливаем старый
    this.stopMusic();
    
    try {
      if (this.scene?.sound && !this.scene.sound.locked) {
        this.currentMusic = this.scene.sound.add(key, { loop: true, volume: 0.4 });
        this.currentMusic.play();
        this.currentMusicKey = key;
        console.log(`[AudioManager] Started playing: ${key}`);
      }
    } catch (e) {
      console.warn('AudioManager: Could not play music', key, e);
    }
  }

  public stopMusic() {
    if (this.currentMusic) {
      try {
        this.currentMusic.stop();
        this.currentMusic.destroy();
      } catch (e) {
        console.warn('AudioManager: Error stopping music', e);
      }
      this.currentMusic = null;
    }
    this.currentMusicKey = null;  // ✅ ДОБАВЛЕНО: Сбрасываем ключ
  }

  // --- АТМОСФЕРА ---

  public playAmbience(key: string) {
    if (!this.isMusicEnabled) return;

    // ✅ FIX: Не воспроизводим атмосферу до первого взаимодействия
    if (!this.audioContextReady) {
      return;
    }

    if (this.ambience && this.ambience.isPlaying) return;

    try {
      if (this.scene && this.scene.sound) {
        this.ambience = this.scene.sound.add(key, { loop: true, volume: 0.2 });
        this.ambience.play();
      }
    } catch (e) { 
      console.warn('AudioManager: Could not play ambience', key, e); 
    }
  }

  public setAmbienceVolume(volume: number) {
    if (this.ambience && this.ambience.isPlaying && (this.ambience as any).setVolume) {
      const targetVol = Phaser.Math.Clamp(volume, 0, 0.8);
      (this.ambience as any).setVolume(targetVol);
    }
  }

  public stopAmbience() {
    if (this.ambience) {
      try {
        this.ambience.stop();
        this.ambience.destroy();
      } catch (e) {
        console.warn('AudioManager: Error stopping ambience', e);
      }
      this.ambience = null;
    }
  }

  // --- SFX (generic) ---

  public playSFX(
    key: string,
    config: { volume?: number; rate?: number; detune?: number; delay?: number } = {}
  ) {
    if (!this.isSoundEnabled) return;

    // ✅ FIX: SFX можно воспроизводить только после первого взаимодействия
    // Но если пользователь уже взаимодействовал, инициализируем AudioContext
    if (!this.audioContextReady) {
      this.audioContextReady = true; // Разрешаем для SFX (они короткие и по действию пользователя)
    }

    try {
      if (this.scene && this.scene.sound) {
        this.scene.sound.play(key, {
          volume: config.volume ?? 1.0,
          detune: config.detune ?? Phaser.Math.Between(-100, 100),
          rate: config.rate ?? 1.0,
          delay: config.delay ?? 0,
        });
      }
    } catch {
      // Игнорируем ошибки SFX
    }
  }

  /**
   * Воспроизвести все звуки гола одновременно
   * 
   * Порядок звуков:
   * 1. goal.mp3 - основной короткий звук гола (сразу)
   * 2. flame_burst.mp3 - звук пламени, 4.7 сек (сразу, синхронно с VFX)
   * 3. goal_crowd.mp3 - крики болельщиков, 13.3 сек (фоном, поверх всего)
   * 
   * @param isMyGoal - мой гол (громче) или соперника
   */
  public playGoalSounds(isMyGoal: boolean): void {
    if (!this.isSoundEnabled) return;

    const baseVolume = isMyGoal ? 1.0 : 0.7;

    // 1. Основной звук гола (короткий, сразу)
    this.playSFX('sfx_goal', { 
      volume: baseVolume 
    });

    // 2. Звук пламени (4.7 сек, синхронно с визуальным эффектом)
    this.playSFX('sfx_flame_burst', { 
      volume: baseVolume * 0.5,
      delay: 0.05
    });

    // 3. Крики болельщиков (13.3 сек, фоном поверх всего)
    this.playSFX('sfx_goal_crowd', { 
      volume: baseVolume * 0.7,
      delay: 0.1
    });
  }

  // --- UI one-shot helpers ---

  public playUIClick() {
    if (!this.isSoundEnabled || !this.scene?.sound) return;
    try {
      this.scene.sound.play('ui_click', { volume: 0.8, loop: false });
    } catch {
      try {
        this.scene.sound.play('sfx_click', { volume: 0.8, loop: false });
      } catch {}
    }
  }

  public playUISwoosh() {
    if (!this.isSoundEnabled || !this.scene?.sound) return;
    try {
      this.scene.sound.play('ui_swoosh', { volume: 0.8, loop: false });
    } catch {
      try {
        this.scene.sound.play('sfx_swish', { volume: 0.8, loop: false });
      } catch {}
    }
  }

  // --- Faction select sounds ---

  /** Останавливаем все фракционные звуки (если ещё играют) */
  public stopFactionSelectSounds() {
    if (!this.scene?.sound) return;
    try {
      this.scene.sound.stopByKey('fx_magma_select');
      this.scene.sound.stopByKey('fx_cyber_select');
      this.scene.sound.stopByKey('fx_void_select');
      this.scene.sound.stopByKey('fx_terran_select');
      // если fallback – тоже глушим
      this.scene.sound.stopByKey('sfx_swish');
    } catch (e) {
      console.warn('AudioManager: stopFactionSelectSounds error', e);
    }
  }

  /**
   * Звук выбора фракции: fx_magma_select / fx_cyber_select / fx_void_select / fx_terran_select.
   * Перед проигрыванием глушим все предыдущие фракционные звуки,
   * чтобы не было наложения.
   */
  public playFactionSelect(factionId: UIFactionId) {
    if (!this.isSoundEnabled || !this.scene?.sound) return;

    const key = `fx_${factionId}_select`;

    // Сначала глушим любые хвосты прошлых фракционных звуков
    this.stopFactionSelectSounds();

    const hasKey =
      (this.scene.cache as any).audio?.exists?.(key) ??
      this.scene.cache.audio.has(key);

    console.log('[AudioManager] playFactionSelect', factionId, 'exists=', hasKey);

    try {
      if (hasKey) {
        this.scene.sound.play(key, { volume: 0.9, loop: false });
      } else {
        // fallback — мягкий swoosh
        this.scene.sound.play('sfx_swish', { volume: 0.8, loop: false });
      }
    } catch (e) {
      console.warn('AudioManager: playFactionSelect error', e);
    }
  }

  // --- BOOSTER PACK SFX ---

  /**
   * sfx_pack_open — старт разрыва фольги.
   * Короткий резкий звук, без рандомного детьюна.
   */
  public playPackOpen(volume: number = 0.8) {
    this.playSFX('sfx_pack_open', {
      volume,
      detune: 0,
      rate: 1.0,
    });
  }

  /**
   * sfx_pack_reveal — "профессиональный" звук открытия кейса.
   * Длинный хвост, который может продолжаться через несколько фаз анимации.
   * Держим ссылку, чтобы можно было остановить на tap-skip.
   */
  public playPackReveal(volume: number = 0.75) {
    if (!this.isSoundEnabled || !this.scene?.sound) return;

    // Если уже что-то играло — глушим и чистим
    this.stopPackReveal();

    try {
      this.packRevealSound = this.scene.sound.add('sfx_pack_reveal', {
        volume,
        loop: false,
        rate: 1.0,
        detune: 0,
      });
      this.packRevealSound.play();
    } catch {
      this.packRevealSound = null;
    }
  }

  /**
   * Остановить (и уничтожить) текущий pack_reveal, если есть.
   * Используется для tap-skip анимации пака.
   */
  public stopPackReveal() {
    if (this.packRevealSound) {
      try {
        this.packRevealSound.stop();
        this.packRevealSound.destroy();
      } catch {
        // игнорируем
      }
      this.packRevealSound = null;
    }

    // На всякий случай глушим любые инстансы по ключу
    try {
      this.scene?.sound?.stopByKey?.('sfx_pack_reveal');
    } catch {
      // игнорируем
    }
  }

  /**
   * sfx_card_pop — звук появления одной карты.
   * Короткий щелчок без рандомного детьюна.
   */
  public playCardPop(volume: number = 0.9) {
    this.playSFX('sfx_card_pop', {
      volume,
      detune: 0,
      rate: 1.0,
    });
  }

  /**
   * Акцент для rare-карт — лёгкий swish, пониженная громкость.
   */
  public playRareCardAccent(volume: number = 0.55) {
    this.playSFX('sfx_swish', {
      volume,
      detune: 0,
      rate: 1.0,
    });
  }

  /**
   * Акцент для epic-карт — глухой тяжёлый удар.
   */
  public playEpicCardAccent(volume: number = 0.75) {
    this.playSFX('sfx_impact_heavy', {
      volume,
      detune: 0,
      rate: 1.0,
    });
  }

  /**
   * Общий метод для "глушения" всех звуков, связанных с открытием пака.
   * Сейчас — только pack_reveal, но можно расширить в будущем.
   */
  public stopBoosterSFX() {
    this.stopPackReveal();
  }

  // --- SETTERS ---

  public setSoundEnabled(enabled: boolean) {
    this.isSoundEnabled = enabled;
  }

  public setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
      this.stopAmbience();
    } else {
      if (this.scene && this.scene.scene.key === 'MainMenuScene') {
        this.playMusic('bgm_menu');
      }
    }
  }

  public toggleMusic(enabled: boolean) {
    this.setMusicEnabled(enabled);
  }

  public toggleSound(enabled: boolean) {
    this.setSoundEnabled(enabled);
  }
}