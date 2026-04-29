import Phaser from 'phaser';
import { ParticleTextures } from '../assets/textures/ParticleTextures';
import { CapTextures } from '../assets/textures/CapTextures';
import { BallTextures } from '../assets/textures/BallTextures';
import { FieldTextures } from '../assets/textures/FieldTextures';
import { AvatarTextures } from '../assets/textures/AvatarTextures';
import { playerData } from '../data/PlayerData';
import { loadAudio } from '../assets/loading/AudioLoader';
import { loadImages } from '../assets/loading/ImageLoader';

export class BootScene extends Phaser.Scene {
  private static readonly LOADING_TIMEOUT_MS = 120_000;
  private static readonly CRITICAL_FAILURE_THRESHOLD = 0.5;
  private static readonly REQUIRED_TEXTURE_KEYS = ['logo', 'ui_home_bg', 'ball_plasma', 'ui_scoreboard'];

  private navigationStarted = false;
  private criticalErrorShown = false;
  private criticalErrorCount = 0;
  private loadErrorCount = 0;
  private queuedAssetCount = 0;
  private loadTimeoutEvent?: Phaser.Time.TimerEvent;
  private loadingBar?: Phaser.GameObjects.Graphics;
  private loadingText?: Phaser.GameObjects.Text;
  private progressText?: Phaser.GameObjects.Text;
  private readonly canSendAgentLogs = Boolean(window.DEV_MODE);

  constructor() {
    super({ key: 'BootScene' });
  }

  init(): void {
    this.navigationStarted = false;
    this.criticalErrorShown = false;
    this.criticalErrorCount = 0;
    this.loadErrorCount = 0;
    this.queuedAssetCount = 0;
    this.loadTimeoutEvent = undefined;
  }

  preload(): void {
    console.log('[BootScene] preload started');
    // #region agent log
    this.sendAgentLog({ sessionId: 'e0960d', runId: 'run-pre', hypothesisId: 'H1', location: 'BootScene.ts:preload:start', message: 'Boot preload started', data: { baseUrl: import.meta.env.BASE_URL, href: window.location.href }, timestamp: Date.now() });
    // #endregion

    this.createLoadingScreen();

    this.load.on('progress', (value: number) => {
      this.updateProgress(value);
    });

    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      this.loadErrorCount += 1;
      console.warn('[BootScene] Failed to load:', file.key);
      // #region agent log
      this.sendAgentLog({ sessionId: 'e0960d', runId: 'run-pre', hypothesisId: 'H1', location: 'BootScene.ts:preload:loaderror', message: 'Loader file failed', data: { key: file.key, type: file.type, url: (file as any).url }, timestamp: Date.now() });
      // #endregion
    });

    this.load.on('complete', () => {
      console.log('[BootScene] Assets loaded');
      this.clearLoadingTimeout();
      this.queuedAssetCount = this.getQueuedAssetCount();
      if (this.hasCriticalLoadingFailure()) {
        this.showCriticalErrorModal('Слишком много файлов не загрузилось. Попробуйте перезапустить игру.');
      }
      // #region agent log
      this.sendAgentLog({ sessionId: 'e0960d', runId: 'run-pre', hypothesisId: 'H2', location: 'BootScene.ts:preload:complete', message: 'Loader complete event', data: { totalComplete: (this.load as any).totalComplete, totalFailed: (this.load as any).totalFailed, totalToLoad: (this.load as any).totalToLoad }, timestamp: Date.now() });
      // #endregion
    });

    try {
      loadImages(this);
    } catch (e) {
      this.criticalErrorCount += 1;
      console.error('[BootScene] Loading error:', e);
    }

    try {
      loadAudio(this);
    } catch (e) {
      this.criticalErrorCount += 1;
      console.error('[BootScene] Loading error:', e);
    }

    this.queuedAssetCount = this.getQueuedAssetCount();
    this.installLoadingTimeout();
    this.loadVersionMeta();
  }

  create(): void {
    console.log('[BootScene] create started');

    this.generateTexturesSafely();
    this.ensureCriticalTextureFallbacks();
    // #region agent log
    this.sendAgentLog({ sessionId: 'e0960d', runId: 'run-pre', hypothesisId: 'H3', location: 'BootScene.ts:create:afterTextureGen', message: 'Boot create reached', data: { hasBallPlasma: this.textures.exists('ball_plasma'), hasMainMenuScene: this.scene.get('MainMenuScene') !== undefined }, timestamp: Date.now() });
    // #endregion

    this.hideLoadingScreen();

    if (this.hasCriticalLoadingFailure()) {
      this.showCriticalErrorModal('Критическая ошибка загрузки. Проверьте интернет и попробуйте снова.');
      return;
    }

    this.time.delayedCall(100, () => {
      this.navigateToNextScene();
    });
  }

  private createLoadingScreen(): void {
    const { centerX, centerY, width, height } = this.cameras.main;

    this.add.rectangle(centerX, centerY, width, height, 0x050505);

    this.add
      .text(centerX, centerY - 100, 'GALAXY LEAGUE', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.loadingText = this.add
      .text(centerX, centerY - 30, 'Загрузка...', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const barWidth = Math.min(300, width * 0.7);
    const barHeight = 20;
    const barBg = this.add.rectangle(centerX, centerY + 20, barWidth, barHeight, 0x222222);
    barBg.setStrokeStyle(2, 0x444444);

    this.loadingBar = this.add.graphics();

    this.progressText = this.add
      .text(centerX, centerY + 60, '0%', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5);
  }

  private updateProgress(value: number): void {
    const { centerX, centerY, width } = this.cameras.main;
    const barWidth = Math.min(300, width * 0.7);
    const percent = Math.round(value * 100);

    try {
      if (this.loadingBar) {
        this.loadingBar.clear();
        this.loadingBar.fillStyle(0x00f2ff, 1);
        this.loadingBar.fillRect(centerX - barWidth / 2, centerY + 10, barWidth * value, 20);
      }

      if (this.progressText) {
        this.progressText.setText(`${percent}%`);
      }
    } catch (error) {
      console.warn('[BootScene] Failed to update loading UI, skipping frame:', error);
    }

    if (typeof (window as any).updateLoadingProgress === 'function') {
      (window as any).updateLoadingProgress(percent, `Загрузка... ${percent}%`);
    }
  }

  private hideLoadingScreen(): void {
    if (this.loadingBar) {
      this.loadingBar.destroy();
    }
    if (this.loadingText) {
      this.loadingText.destroy();
    }
    if (this.progressText) {
      this.progressText.destroy();
    }

    if (typeof (window as any).hideLoadingScreen === 'function') {
      (window as any).hideLoadingScreen();
    }
  }

  private navigateToNextScene(): void {
    if (this.hasCriticalLoadingFailure()) {
      this.showCriticalErrorModal('Критическая ошибка загрузки. Невозможно продолжить.');
      return;
    }

    const missingTextures = BootScene.REQUIRED_TEXTURE_KEYS.filter((key) => !this.textures.exists(key));
    if (missingTextures.length > 0) {
      this.criticalErrorCount += 1;
      console.error('[BootScene] Missing required textures:', missingTextures);
      this.showCriticalErrorModal(`Отсутствуют критические текстуры: ${missingTextures.join(', ')}`);
      return;
    }

    if (this.navigationStarted) {
      return;
    }
    this.navigationStarted = true;

    try {
      const data = playerData.get();
      // #region agent log
      this.sendAgentLog({ sessionId: 'e0960d', runId: 'run-pre', hypothesisId: 'H4', location: 'BootScene.ts:navigateToNextScene', message: 'Navigation decision snapshot', data: { selectedFaction: data.selectedFaction ?? null, isProfileSetupComplete: Boolean(data.isProfileSetupComplete) }, timestamp: Date.now() });
      // #endregion

      if (!data.selectedFaction) {
        console.log('[BootScene] → FactionSelectScene');
        void this.loadSceneDynamic('FactionSelectScene');
        return;
      }

      if (!data.isProfileSetupComplete) {
        console.log('[BootScene] → ProfileSetupScene');
        void this.loadSceneDynamic('ProfileSetupScene');
        return;
      }

      console.log('[BootScene] → MainMenuScene');
      this.scene.start('MainMenuScene');
    } catch (error) {
      console.error('[BootScene] Navigation error:', error);
      this.scene.start('MainMenuScene');
    }
  }

  private loadSceneDynamic(sceneName: string): Promise<void> {
    return import('../managers/SceneLoader')
      .then(({ SceneLoader }) => SceneLoader.loadAndStart(this, sceneName))
      .catch((error) => {
        console.error(`[BootScene] Failed to load ${sceneName}:`, error);
        this.scene.start('MainMenuScene');
      });
  }

  private getQueuedAssetCount(): number {
    const loaderStats = this.load as Phaser.Loader.LoaderPlugin & {
      totalToLoad?: number;
      totalComplete?: number;
      totalFailed?: number;
      list?: { size?: number };
      inflight?: { size?: number };
    };

    const fromTotals = loaderStats.totalToLoad ?? 0;
    const fromList = (loaderStats.list?.size ?? 0) + (loaderStats.inflight?.size ?? 0);
    return Math.max(fromTotals, fromList, this.queuedAssetCount);
  }

  private hasCriticalLoadingFailure(): boolean {
    const loaderStats = this.load as Phaser.Loader.LoaderPlugin & { totalFailed?: number; totalToLoad?: number };
    const totalFailed = Math.max(loaderStats.totalFailed ?? 0, this.loadErrorCount);
    const totalToLoad = Math.max(loaderStats.totalToLoad ?? 0, this.queuedAssetCount);
    const failedRatio = totalToLoad > 0 ? totalFailed / totalToLoad : 0;

    return this.criticalErrorCount > 0 || failedRatio > BootScene.CRITICAL_FAILURE_THRESHOLD;
  }

  private installLoadingTimeout(): void {
    this.clearLoadingTimeout();
    this.loadTimeoutEvent = this.time.delayedCall(BootScene.LOADING_TIMEOUT_MS, () => {
      console.warn('[BootScene] Loading is taking too long; waiting for loader completion');
      if (this.loadingText) {
        try {
          this.loadingText.setText('Загрузка дольше обычного... Пожалуйста, подождите');
        } catch {
          // Ignore UI update errors: loader can still finish successfully.
        }
      }
    });
  }

  private clearLoadingTimeout(): void {
    if (this.loadTimeoutEvent) {
      this.loadTimeoutEvent.remove(false);
      this.loadTimeoutEvent = undefined;
    }
  }

  private showCriticalErrorModal(message: string): void {
    if (this.criticalErrorShown) {
      return;
    }
    this.criticalErrorShown = true;
    this.clearLoadingTimeout();
    this.hideLoadingScreen();

    const { centerX, centerY, width, height } = this.cameras.main;
    const boxWidth = Math.min(520, width * 0.9);
    const boxHeight = Math.min(380, height * 0.6);

    this.add.rectangle(centerX, centerY, width, height, 0x000000, 0.75).setDepth(1000);
    this.add.rectangle(centerX, centerY, boxWidth, boxHeight, 0x101622, 0.98).setDepth(1001).setStrokeStyle(2, 0xff4d4f, 1);

    this.add
      .text(centerX, centerY - 110, 'Ошибка загрузки', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#ff7a7a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(1002);

    this.add
      .text(centerX, centerY - 25, message, {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: boxWidth - 60 },
      })
      .setOrigin(0.5)
      .setDepth(1002);

    const retryButton = this.add
      .text(centerX, centerY + 110, 'Перезапустить', {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#101622',
        backgroundColor: '#6be6ff',
        padding: { x: 22, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });

    retryButton.on('pointerup', () => {
      window.location.reload();
    });
  }

  private loadVersionMeta(): void {
    fetch('version.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          console.warn(`[BootScene] version.json unavailable (${response.status}), continuing without version metadata`);
        }
      })
      .catch((error) => {
        console.warn('[BootScene] version.json fetch failed, continuing without metadata', error);
      });
  }

  private generateTexturesSafely(): void {
    const tasks: Array<{ name: string; run: () => void }> = [
      { name: 'ParticleTextures', run: () => new ParticleTextures(this).generate() },
      { name: 'CapTextures', run: () => new CapTextures(this).generate() },
      { name: 'BallTextures', run: () => new BallTextures(this).generate() },
      { name: 'FieldTextures', run: () => new FieldTextures(this).generate() },
      { name: 'AvatarTextures', run: () => new AvatarTextures(this).generate() },
    ];

    tasks.forEach(({ name, run }) => {
      try {
        run();
      } catch (error) {
        this.criticalErrorCount += 1;
        console.warn(`[BootScene] ${name} generation failed:`, error);
      }
    });

    console.log('[BootScene] Texture generation completed');
  }

  private ensureCriticalTextureFallbacks(): void {
    if (!this.textures.exists('ball_plasma')) {
      const g = this.add.graphics().setVisible(false);
      g.fillStyle(0x4f46e5, 1);
      g.fillCircle(32, 32, 28);
      g.fillStyle(0xffffff, 0.85);
      g.fillCircle(32, 32, 10);
      g.lineStyle(2, 0x93c5fd, 0.9);
      g.strokeCircle(32, 32, 30);
      g.generateTexture('ball_plasma', 64, 64);
      g.destroy();
      console.warn('[BootScene] Generated fallback texture for ball_plasma');
    }
  }

  private sendAgentLog(payload: unknown): void {
    if (!this.canSendAgentLogs) {
      return;
    }

    fetch('http://127.0.0.1:7362/ingest/422d027d-7908-442f-94c4-876b2618395d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e0960d' },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }
}