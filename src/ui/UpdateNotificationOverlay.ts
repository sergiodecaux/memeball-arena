import Phaser from 'phaser';
import { VersionInfo, versionChecker, CURRENT_VERSION } from '../utils/VersionChecker';

/**
 * Оверлей уведомления о доступном обновлении
 */
export class UpdateNotificationOverlay extends Phaser.GameObjects.Container {
  private background: Phaser.GameObjects.Rectangle;
  private modal: Phaser.GameObjects.Container;
  private isForceUpdate: boolean = false;

  constructor(scene: Phaser.Scene, versionInfo: VersionInfo) {
    super(scene, 0, 0);
    
    this.isForceUpdate = versionInfo.forceUpdate;
    
    const { width, height } = scene.cameras.main;
    
    // Затемнение фона
    this.background = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setInteractive(); // Блокируем клики под оверлеем
    this.add(this.background);
    
    // Модальное окно
    this.modal = scene.add.container(width / 2, height / 2);
    this.add(this.modal);
    
    this.createModalContent(versionInfo);
    
    // Анимация появления
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });
    
    this.setDepth(10000); // Поверх всего
    scene.add.existing(this);
  }

  private createModalContent(info: VersionInfo): void {
    const scene = this.scene;
    const s = 1; // scale factor если нужен
    
    // Фон модального окна
    const modalBg = scene.add.graphics();
    modalBg.fillStyle(0x1a1a2e, 1);
    modalBg.fillRoundedRect(-160, -150, 320, 300, 16);
    modalBg.lineStyle(2, 0x4ade80, 1);
    modalBg.strokeRoundedRect(-160, -150, 320, 300, 16);
    this.modal.add(modalBg);
    
    // Иконка обновления
    const icon = scene.add.text(0, -115, '🚀', {
      fontSize: '40px',
    }).setOrigin(0.5);
    this.modal.add(icon);
    
    // Заголовок
    const title = scene.add.text(0, -70, 'Доступно обновление!', {
      fontSize: '20px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
    }).setOrigin(0.5);
    this.modal.add(title);
    
    // Версии
    const versionText = scene.add.text(0, -40, `${CURRENT_VERSION} → ${info.version}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#4ade80',
    }).setOrigin(0.5);
    this.modal.add(versionText);
    
    // Changelog
    const changelogTitle = scene.add.text(0, -10, 'Что нового:', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#888888',
    }).setOrigin(0.5);
    this.modal.add(changelogTitle);
    
    const changelogText = info.changelog.slice(0, 4).map(line => `• ${line}`).join('\n');
    const changelog = scene.add.text(0, 40, changelogText, {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#cccccc',
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: 280 },
    }).setOrigin(0.5);
    this.modal.add(changelog);
    
    // Кнопка обновления
    const btnY = 110;
    const btnWidth = 200;
    const btnHeight = 45;
    
    const btnBg = scene.add.graphics();
    btnBg.fillStyle(0x4ade80, 1);
    btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 8);
    this.modal.add(btnBg);
    
    const btnText = scene.add.text(0, btnY, 'ОБНОВИТЬ', {
      fontSize: '16px',
      fontFamily: 'Arial Black, Arial',
      color: '#000000',
    }).setOrigin(0.5);
    this.modal.add(btnText);
    
    const btnHit = scene.add.rectangle(0, btnY, btnWidth, btnHeight, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.modal.add(btnHit);
    
    btnHit.on('pointerover', () => {
      btnBg.clear();
      btnBg.fillStyle(0x22c55e, 1);
      btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 8);
    });
    
    btnHit.on('pointerout', () => {
      btnBg.clear();
      btnBg.fillStyle(0x4ade80, 1);
      btnBg.fillRoundedRect(-btnWidth / 2, btnY - btnHeight / 2, btnWidth, btnHeight, 8);
    });
    
    btnHit.on('pointerdown', () => {
      btnText.setText('Обновление...');
      versionChecker.forceUpdate();
    });
    
    // Кнопка "Позже" (только если не принудительное обновление)
    if (!this.isForceUpdate) {
      const laterBtn = scene.add.text(0, 145, 'Позже', {
        fontSize: '14px',
        fontFamily: 'Arial',
        color: '#666666',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      laterBtn.on('pointerover', () => laterBtn.setColor('#999999'));
      laterBtn.on('pointerout', () => laterBtn.setColor('#666666'));
      laterBtn.on('pointerdown', () => this.hide());
      
      this.modal.add(laterBtn);
    } else {
      // Предупреждение о принудительном обновлении
      const warning = scene.add.text(0, 145, '⚠️ Требуется обязательное обновление', {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#f87171',
      }).setOrigin(0.5);
      this.modal.add(warning);
    }
  }

  private hide(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        this.destroy();
      },
    });
  }
}
