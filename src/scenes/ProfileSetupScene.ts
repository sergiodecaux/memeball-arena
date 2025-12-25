// src/scenes/ProfileSetupScene.ts

import Phaser from 'phaser';
import { playerData } from '../data/PlayerData';
import { AVATAR_KEYS } from '../assets/textures/AvatarTextures';

export class ProfileSetupScene extends Phaser.Scene {
  private currentAvatarIndex = 0;
  private avatarImage!: Phaser.GameObjects.Image;
  private nicknameInput?: Phaser.GameObjects.DOMElement;
  private errorText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'ProfileSetupScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    this.cameras.main.setBackgroundColor(0x050816);

    // Полупрозрачный фон (на случай, если ты будешь вызывать сцену поверх меню)
    const bg = this.add
      .rectangle(width / 2, height / 2, width, height, 0x020617, 0.95)
      .setScrollFactor(0);

    // Заголовок
    this.add
      .text(width / 2, height * 0.16, 'Выбери ник и аватар', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    // Аватар
    const savedAvatarId = playerData.getAvatarId();
    const initialIndex = AVATAR_KEYS.indexOf(savedAvatarId);
    this.currentAvatarIndex = initialIndex >= 0 ? initialIndex : 0;

    const avatarY = height * 0.4;
    const avatarSize = Math.min(width, height) * 0.25;

    this.avatarImage = this.add
      .image(width / 2, avatarY, AVATAR_KEYS[this.currentAvatarIndex])
      .setDisplaySize(avatarSize, avatarSize);

    // Стрелки переключения аватара
    const arrowStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: '36px',
      color: '#e5e7eb',
    };

    const leftArrow = this.add
      .text(width / 2 - avatarSize * 0.8, avatarY, '<', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const rightArrow = this.add
      .text(width / 2 + avatarSize * 0.8, avatarY, '>', arrowStyle)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    leftArrow.on('pointerdown', () => this.changeAvatar(-1));
    rightArrow.on('pointerdown', () => this.changeAvatar(1));

    this.add
      .text(width / 2, avatarY + avatarSize * 0.65, 'Аватар', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '16px',
        color: '#9ca3af',
      })
      .setOrigin(0.5);

    // Поле ввода ника (DOM input)
    const defaultNickname = playerData.getNickname();
    const nickY = height * 0.64;

    try {
      this.nicknameInput = this.add.dom(
        width / 2,
        nickY,
        'input',
        `
          width: 260px;
          padding: 10px 14px;
          border-radius: 9999px;
          border: 2px solid #22c55e;
          background: rgba(15, 23, 42, 0.96);
          color: #f9fafb;
          font-size: 16px;
          text-align: center;
          outline: none;
        `,
        defaultNickname
      ) as Phaser.GameObjects.DOMElement;

      const inputNode = this.nicknameInput.node as HTMLInputElement;
      inputNode.placeholder = 'Никнейм';
      inputNode.maxLength = 16;
    } catch (e) {
      console.warn(
        'DOM plugin is not enabled for Phaser. Nickname will use default value only.'
      );
    }

    this.add
      .text(width / 2, nickY - 28, 'Никнейм', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '16px',
        color: '#9ca3af',
      })
      .setOrigin(0.5);

    // Сообщение об ошибке
    this.errorText = this.add
      .text(width / 2, nickY + 32, '', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '14px',
        color: '#f97373',
      })
      .setOrigin(0.5);

    // Кнопка подтверждения
    const buttonY = height * 0.8;
    const buttonWidth = 260;
    const buttonHeight = 48;

    const button = this.add
      .rectangle(
        width / 2,
        buttonY,
        buttonWidth,
        buttonHeight,
        0x22c55e,
        1
      )
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    const buttonText = this.add
      .text(width / 2, buttonY, 'Готово', {
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: '18px',
        color: '#0b1120',
      })
      .setOrigin(0.5);

    const onConfirm = () => this.confirmProfile();

    button.on('pointerdown', onConfirm);
    buttonText.setInteractive({ useHandCursor: true }).on('pointerdown', onConfirm);
  }

  private changeAvatar(delta: number): void {
    const total = AVATAR_KEYS.length;
    this.currentAvatarIndex =
      (this.currentAvatarIndex + delta + total) % total;
    this.avatarImage.setTexture(AVATAR_KEYS[this.currentAvatarIndex]);
  }

  private sanitizeNickname(raw: string): string {
    // Разрешаем буквы/цифры/пробел/подчёркивание/точку/дефис
    const cleaned = raw.replace(/[^a-zA-Z0-9а-яА-ЯёЁ _.\-]/g, '');
    return cleaned.trim();
  }

  private confirmProfile(): void {
    const inputNode = this.nicknameInput
      ? (this.nicknameInput.node as HTMLInputElement)
      : null;

    const raw =
      inputNode?.value?.trim() || playerData.getNickname() || 'Player';
    const nickname = this.sanitizeNickname(raw);

    if (nickname.length < 3 || nickname.length > 16) {
      this.showError('Ник должен быть от 3 до 16 символов');
      return;
    }

    // Сохраняем ник и аватар в PlayerData
    playerData.setNickname(nickname);
    playerData.setAvatarId(AVATAR_KEYS[this.currentAvatarIndex]);
    playerData.markProfileComplete();

    // Переходим в главное меню
    this.scene.start('MainMenuScene');
  }

  private showError(message: string): void {
    this.errorText.setText(message);

    this.tweens.killTweensOf(this.errorText);
    this.errorText.setAlpha(1);
    this.tweens.add({
      targets: this.errorText,
      alpha: 0.4,
      duration: 800,
      yoyo: true,
      repeat: 1,
    });
  }
}