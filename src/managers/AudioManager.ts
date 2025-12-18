// src/managers/AudioManager.ts

import Phaser from 'phaser';

export class AudioManager {
  private static instance: AudioManager;
  private scene: Phaser.Scene;
  
  public isSoundEnabled: boolean = true;
  public isMusicEnabled: boolean = true;

  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private ambience: Phaser.Sound.BaseSound | null = null;

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(scene: Phaser.Scene) {
    this.scene = scene;
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
    if (this.scene) {
      this.scene.sound.stopAll();
    }
  }

  // --- МУЗЫКА ---

  public playMusic(key: string) {
    if (!this.isMusicEnabled) return;
    
    // ФИКС: Если эта музыка УЖЕ играет, не перезапускаем её
    if (this.currentMusic && (this.currentMusic as any).key === key && this.currentMusic.isPlaying) {
      return;
    }

    this.stopMusic();

    try {
      this.currentMusic = this.scene.sound.add(key, { loop: true, volume: 0.4 });
      this.currentMusic.play();
    } catch (e) { console.warn(e); }
  }

  public stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic.destroy();
      this.currentMusic = null;
    }
  }

  // --- АТМОСФЕРА ---

  public playAmbience(key: string) {
    if (!this.isMusicEnabled) return;

    if (this.ambience && this.ambience.isPlaying) return;

    try {
      this.ambience = this.scene.sound.add(key, { loop: true, volume: 0.2 });
      this.ambience.play();
    } catch (e) { console.warn(e); }
  }

  // НОВЫЙ МЕТОД: Изменение громкости толпы
  public setAmbienceVolume(volume: number) {
    if (this.ambience && this.ambience.isPlaying && (this.ambience as any).setVolume) {
      const targetVol = Phaser.Math.Clamp(volume, 0, 0.8);
      (this.ambience as any).setVolume(targetVol);
    }
  }

  public stopAmbience() {
    if (this.ambience) {
      this.ambience.stop();
      this.ambience.destroy();
      this.ambience = null;
    }
  }

  // --- SFX ---

  public playSFX(key: string, config: { volume?: number, rate?: number, detune?: number, delay?: number } = {}) {
    if (!this.isSoundEnabled) return;

    try {
      this.scene.sound.play(key, {
        volume: config.volume ?? 1.0,
        detune: config.detune ?? Phaser.Math.Between(-100, 100), 
        rate: config.rate ?? 1.0,
        delay: config.delay ?? 0 
      });
    } catch (e) { }
  }

  // --- TOGGLES ---

  public toggleMusic(enabled: boolean) {
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

  public toggleSound(enabled: boolean) {
    this.isSoundEnabled = enabled;
  }
}