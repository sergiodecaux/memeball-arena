// src/scenes/PreloadScene.ts
// Loads core pack then navigates to menu

import Phaser from 'phaser';
import { AssetPackManager } from '../assets/AssetPackManager';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { playerData } from '../data/PlayerData';
import { UIGenerator } from '../assets/generation/UIGenerator';

/** Советы, отображаемые во время загрузки */
const LOADING_TIPS = [
  'Совет: Используйте карты способностей для получения преимущества!',
  'Совет: Танки отлично блокируют удары противника.',
  'Совет: Снайперы наносят мощные удары издалека.',
  'Совет: Трикстеры — мастера обманных манёвров.',
  'Совет: Выбирайте формацию под стиль игры.',
  'Интересный факт: В игре более 80 уникальных юнитов!',
  'Интересный факт: Каждая фракция имеет уникальные способности.',
] as const;

export class PreloadScene extends Phaser.Scene {
  private overlay?: LoadingOverlay;
  private tipsTimer?: Phaser.Time.TimerEvent;
  private currentTipIndex = 0;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    this.overlay = new LoadingOverlay(this);
    this.overlay.setText('Загрузка ядра…');
    this.overlay.setProgress(0);

    this.startTipsRotation();
    this.loadAllAssets();
  }

  /** Запускает ротацию советов каждые 3 секунды */
  private startTipsRotation(): void {
    this.overlay?.setSubtext(LOADING_TIPS[0]);

    this.tipsTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        this.currentTipIndex = (this.currentTipIndex + 1) % LOADING_TIPS.length;
        this.overlay?.setSubtext(LOADING_TIPS[this.currentTipIndex]);
      },
    });
  }

  /** Загружает все ассеты последовательно */
  private async loadAllAssets(): Promise<void> {
    try {
      // 1. Критические портреты командира
      await this.loadCriticalPortraits();

      // 2. Core pack (UI, базовые звуки)
      this.overlay?.setText('Загрузка интерфейса…');
      await AssetPackManager.ensure(this, 'core', this.overlay);

      // 3. InitialLoad pack (юниты, карты, арены)
      this.overlay?.setText('Загрузка коллекции…');
      await AssetPackManager.ensure(this, 'initialLoad', this.overlay);

      // 4. Фоллбэки
      this.generateCriticalFallbacks();

      // 5. Останавливаем таймер советов
      this.tipsTimer?.destroy();
      
      // 6. Переходим дальше
      this.navigateToNextScene();
    } catch (err) {
      console.error('[PreloadScene] Error loading assets:', err);
      this.tipsTimer?.destroy();
      this.generateCriticalFallbacks();
      this.navigateToNextScene();
    }
  }

  /** Загружает критические портреты командира */
  private async loadCriticalPortraits(): Promise<void> {
    const novaPath = 'assets/ui/commander_nova.png';
    this.load.image('source_nova', novaPath);
    this.load.image('portrait_nova_neutral', novaPath);
    this.load.image('portrait_nova_happy', novaPath);

    return new Promise<void>(resolve => {
      this.load.once('complete', () => resolve());
      this.load.start();
    });
  }

  private generateCriticalFallbacks(): void {
    const uiGen = new UIGenerator(this);
    
    // Only generate if missing
    if (!this.textures.exists('ui_home_bg')) {
      // Simple gradient fallback for menu background
      const width = 1080;
      const height = 1920;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0a0a12');
      gradient.addColorStop(0.5, '#1a1a2a');
      gradient.addColorStop(1, '#0a0a12');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      
      this.textures.addCanvas('ui_home_bg', canvas);
    }
  }

  private navigateToNextScene(): void {
    const data = playerData.get();

    if (import.meta.env.DEV) {
      console.log('[PreloadScene] Navigation:', {
        faction: data.selectedFaction,
        profile: data.isProfileSetupComplete,
      });
    }

    if (!data.selectedFaction) {
      if (import.meta.env.DEV) {
        console.log('[PreloadScene] → FactionSelectScene');
      }
      this.scene.start('FactionSelectScene');
      return;
    }

    if (import.meta.env.DEV) {
      console.log('[PreloadScene] → MainMenuScene');
    }
    this.scene.start('MainMenuScene');
  }
}

