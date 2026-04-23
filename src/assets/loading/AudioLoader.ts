// src/assets/loading/AudioLoader.ts

import Phaser from 'phaser';

// Флаг для предотвращения повторной установки обработчика
let errorHandlerSetup = false;

function setupAudioErrorHandler(scene: Phaser.Scene): void {
  if (errorHandlerSetup) return;
  errorHandlerSetup = true;
  
  scene.load.on('loaderror', (fileObj: Phaser.Loader.File) => {
    // Проверяем что это аудио файл
    if (fileObj.type === 'audio') {
      console.warn(`[AudioLoader] ⚠️ Failed to load audio: ${fileObj.key}`, {
        url: fileObj.url,
        type: fileObj.type,
      });
      // Аудио ошибки не критичны - игра продолжит работать без звука
    }
  });
}

/**
 * ✅ FIX: Helper для генерации абсолютных путей к аудиофайлам из public/
 * Файлы в public/ должны загружаться через абсолютные пути для корректной работы в production
 */
function getAudioPath(relativePath: string): string {
  // Для файлов в public/ используем абсолютные пути от корня домена
  return relativePath.startsWith('/') ? relativePath : `/assets/audio/${relativePath}`;
}

/**
 * Loads minimal audio required for boot (only UI click)
 */
export function loadAudioBoot(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading boot audio assets...');
  }

  // ✅ FIX: Используем абсолютные пути для файлов из public/
  // Only minimal UI click sound
  scene.load.audio('sfx_click', getAudioPath('sfx/ui_click.mp3'));
  scene.load.audio('ui_click', [
    getAudioPath('ui_click.ogg'),
    getAudioPath('ui_click.mp3')
  ]);
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Boot audio assets queued');
  }
}

/**
 * Loads audio required for Main Menu (BGM + UI SFX)
 */
export function loadAudioMenu(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading menu audio assets...');
  }

  // ✅ FIX: Используем абсолютные пути для файлов из public/
  // Menu BGM
  scene.load.audio('bgm_menu', getAudioPath('bgm/menu_theme.mp3'));

  // UI SFX
  scene.load.audio('sfx_swish', getAudioPath('sfx/swish.mp3'));
  scene.load.audio('ui_swoosh', [
    getAudioPath('ui_swoosh.ogg'),
    getAudioPath('ui_swoosh.mp3')
  ]);

  // Faction selection sounds
  scene.load.audio('fx_magma_select', [
    getAudioPath('fx_magma_select.ogg'),
    getAudioPath('fx_magma_select.mp3')
  ]);
  // ⚠️ FIX: fx_cyborg_select не существует, используем ui_click как fallback
  scene.load.audio('fx_cyborg_select', [
    getAudioPath('ui_click.ogg'),
    getAudioPath('ui_click.mp3')
  ]);
  scene.load.audio('fx_void_select', [
    getAudioPath('fx_void_select.ogg'),
    getAudioPath('fx_void_select.mp3')
  ]);
  scene.load.audio('fx_terran_select', [
    getAudioPath('fx_terran_select.ogg'),
    getAudioPath('fx_terran_select.mp3')
  ]);
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Menu audio assets queued');
  }
}

/**
 * Loads audio required for VS screen (before match)
 */
export function loadAudioVS(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading VS screen audio assets...');
  }

  // ✅ VS theme music
  scene.load.audio('bgm_vs_theme', getAudioPath('bgm/vs_theme.mp3'));
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] VS screen audio assets queued');
  }
}

/**
 * Loads audio required for gameplay (match BGM + gameplay SFX)
 */
export function loadAudioGameplay(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading gameplay audio assets...');
  }

  // ✅ FIX: Используем абсолютные пути для файлов из public/
  // Match BGM
  scene.load.audio('bgm_match', getAudioPath('bgm/stadium_ambience.mp3'));

  // Gameplay SFX
  scene.load.audio('sfx_kick', getAudioPath('sfx/kick.mp3'));
  scene.load.audio('sfx_clack', getAudioPath('sfx/collision.mp3'));
  scene.load.audio('sfx_bounce', getAudioPath('sfx/wall_hit.mp3'));
  scene.load.audio('sfx_post', getAudioPath('sfx/post.mp3'));
  scene.load.audio('sfx_net', getAudioPath('sfx/net.mp3'));
  scene.load.audio('sfx_goal', getAudioPath('sfx/goal.mp3'));
  scene.load.audio('sfx_whistle', getAudioPath('sfx/whistle.mp3'));
  scene.load.audio('sfx_win', getAudioPath('sfx/win.mp3'));
  scene.load.audio('sfx_lose', getAudioPath('sfx/lose.mp3'));

  // Goal celebration sounds
  scene.load.audio('sfx_goal_crowd', getAudioPath('voice/goal_crowd.mp3'));
  scene.load.audio('sfx_flame_burst', getAudioPath('voice/flame_burst.mp3'));

  // Match Intro SFX
  scene.load.audio('sfx_whoosh', getAudioPath('sfx/whoosh.mp3'));
  scene.load.audio('sfx_impact_heavy', getAudioPath('sfx/impact_heavy.mp3'));
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Gameplay audio assets queued');
  }
}

/**
 * Loads audio required for shop (pack open/reveal, card pop, cash)
 */
export function loadAudioShop(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading shop audio assets...');
  }

  // ✅ FIX: Используем абсолютные пути для файлов из public/
  // Shop / Booster SFX
  scene.load.audio('sfx_pack_open', [
    getAudioPath('ui/sfx_pack_open.ogg'),
    getAudioPath('ui/sfx_pack_open.mp3'),
  ]);

  scene.load.audio('sfx_pack_reveal', [
    getAudioPath('ui/sfx_pack_reveal.ogg'),
    getAudioPath('ui/sfx_pack_reveal.mp3'),
  ]);

  scene.load.audio('sfx_card_pop', [
    getAudioPath('ui/sfx_card_pop.ogg'),
    getAudioPath('ui/sfx_card_pop.mp3'),
  ]);

  scene.load.audio('sfx_cash', getAudioPath('sfx/cash.mp3'));
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Shop audio assets queued');
  }
}

/**
 * Loads all announcer voices
 */
export function loadAudioVoices(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading voice audio assets...');
  }

  // ✅ FIX: Используем абсолютные пути для файлов из public/
  // Announcer voices
  scene.load.audio('voice_welcome', getAudioPath('voice/voice_welcome.mp3'));
  scene.load.audio('voice_vs', getAudioPath('voice/voice_vs.mp3'));
  scene.load.audio('voice_fight', getAudioPath('voice/voice_fight.mp3'));
  scene.load.audio('voice_goal', getAudioPath('voice/voice_goal.mp3'));
  scene.load.audio('voice_scream', getAudioPath('voice/voice_scream.mp3'));
  scene.load.audio('voice_dominating', getAudioPath('voice/voice_dominating.mp3'));
  scene.load.audio('voice_victory', getAudioPath('voice/voice_win.mp3'));
  scene.load.audio('voice_defeat', getAudioPath('voice/voice_lose.mp3'));

  scene.load.audio('voice_magma', getAudioPath('voice/voice_magma.mp3'));
  scene.load.audio('voice_cyborg', getAudioPath('voice/voice_cyborg.mp3'));
  scene.load.audio('voice_void', getAudioPath('voice/voice_void.mp3'));
  scene.load.audio('voice_insect', getAudioPath('voice/voice_insect.mp3'));
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Voice audio assets queued');
  }
}

/**
 * Loads all audio (main entry point - loads everything)
 * Split functions (loadAudioBoot, etc.) are available for future lazy loading
 */
export function loadAudio(scene: Phaser.Scene): void {
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] Loading all audio assets...');
  }

  // Установить обработчик ошибок
  setupAudioErrorHandler(scene);
  
  // Загружаем все аудио через модульные функции
  loadAudioBoot(scene);
  loadAudioMenu(scene);
  loadAudioVS(scene);
  loadAudioGameplay(scene);
  loadAudioShop(scene);
  
  if (import.meta.env.DEV) {
    console.log('[AudioLoader] All audio assets queued');
  }
}

/**
 * Верифицирует загрузку аудио Match Intro (DEV-only)
 */
export function verifyMatchIntroAudio(scene: Phaser.Scene): void {
  if (!import.meta.env.DEV) return;
  
  console.log('[AudioLoader] Verifying Match Intro audio...');

  const voiceKeys = [
    'voice_welcome', 'voice_vs', 'voice_fight', 'voice_goal',
    'voice_scream', 'voice_dominating', 'voice_victory', 'voice_defeat',
    'voice_magma', 'voice_cyborg', 'voice_void', 'voice_insect'
  ];

  voiceKeys.forEach(key => {
    const exists = scene.cache.audio.exists(key);
    if (exists) {
      console.log(`✅ [AudioLoader] Voice loaded: ${key}`);
    } else {
      console.warn(`⚠️ [AudioLoader] Voice MISSING: ${key}`);
    }
  });

  const sfxKeys = ['sfx_whoosh', 'sfx_impact_heavy'];
  sfxKeys.forEach(key => {
    const exists = scene.cache.audio.exists(key);
    if (exists) {
      console.log(`✅ [AudioLoader] SFX loaded: ${key}`);
    } else {
      console.warn(`⚠️ [AudioLoader] SFX MISSING: ${key}`);
    }
  });
}