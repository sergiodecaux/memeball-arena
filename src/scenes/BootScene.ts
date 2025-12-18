// src/scenes/BootScene.ts

import Phaser from 'phaser';
import { ParticleTextures } from '../assets/textures/ParticleTextures';
import { CapTextures } from '../assets/textures/CapTextures';
import { BallTextures } from '../assets/textures/BallTextures';
import { FieldTextures } from '../assets/textures/FieldTextures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // --- Загрузка Аудио ---
    this.load.setPath('assets/audio');

    // Музыка и Атмосфера
    this.load.audio('bgm_menu', 'bgm/menu_theme.mp3');
    this.load.audio('bgm_match', 'bgm/stadium_ambience.mp3');

    // Звуки геймплея (SFX)
    this.load.audio('sfx_kick', 'sfx/kick.mp3');
    this.load.audio('sfx_clack', 'sfx/collision.mp3');
    this.load.audio('sfx_bounce', 'sfx/wall_hit.mp3');
    this.load.audio('sfx_post', 'sfx/post.mp3');        // НОВОЕ: Штанга
    this.load.audio('sfx_net', 'sfx/net.mp3');          // НОВОЕ: Сетка
    this.load.audio('sfx_goal', 'sfx/goal.mp3');
    this.load.audio('sfx_whistle', 'sfx/whistle.mp3');
    this.load.audio('sfx_win', 'sfx/win.mp3');
    this.load.audio('sfx_lose', 'sfx/lose.mp3');

    // UI звуки
    this.load.audio('sfx_click', 'sfx/ui_click.mp3');
    this.load.audio('sfx_cash', 'sfx/cash.mp3');
    this.load.audio('sfx_swish', 'sfx/swish.mp3');

    this.load.setPath('');
  }

  create(): void {
    new ParticleTextures(this).generate();
    new CapTextures(this).generate();
    new BallTextures(this).generate();
    new FieldTextures(this).generate();

    this.scene.start('MainMenuScene');
  }
}