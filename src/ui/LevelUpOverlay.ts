// Праздничное окно Level Up в стиле Mobile Legends

import Phaser from 'phaser';
import { getFonts, getColors, hexToString } from '../config/themes';
import { AudioManager } from '../managers/AudioManager';
import { hapticImpact } from '../utils/Haptics';
import { LevelReward, generateUnitChoices } from '../data/LevelRewards';
import { UNITS_REPOSITORY } from '../data/UnitsRepository';
import { playerData } from '../data/PlayerData';
import { FACTIONS, FactionId } from '../constants/gameConstants';
import { getRealUnitTextureKey } from '../utils/TextureHelpers';

export type LevelUpType = 'player' | 'faction';

export interface LevelUpConfig {
  type: LevelUpType;
  level: number;
  factionId?: FactionId;
  rewards: LevelReward;
  onComplete: () => void;
}

/**
 * Модальное окно Level Up с эффектами как в Mobile Legends
 */
export class LevelUpOverlay {
  private scene: Phaser.Scene;
  private config: LevelUpConfig;
  private container!: Phaser.GameObjects.Container;
  private particleEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene, config: LevelUpConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    
    // Главный контейнер
    this.container = this.scene.add.container(0, 0).setDepth(2000);
    
    // Затемнение
    const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.85);
    overlay.setOrigin(0);
    overlay.setInteractive();
    this.container.add(overlay);
    
    // Анимация затемнения
    overlay.setAlpha(0);
    this.scene.tweens.add({
      targets: overlay,
      alpha: 0.85,
      duration: 300,
      ease: 'Power2',
    });
    
    // Создаём контент по центру
    this.createContent(width, height);
    
    // Частицы и эффекты
    this.createParticles(width, height);
    
    // Звук
    AudioManager.getInstance().playSFX('sfx_level_up');
    hapticImpact('heavy');
  }

  private createContent(width: number, height: number): void {
    const centerX = width / 2;
    const centerY = height / 2;
    const fonts = getFonts();
    
    // Контейнер контента
    const content = this.scene.add.container(centerX, centerY);
    content.setAlpha(0);
    this.container.add(content);
    
    // ========== ЭФФЕКТНЫЕ ЛУЧИ ==========
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const ray = this.scene.add.graphics();
      ray.fillGradientStyle(0xffd700, 0xffd700, 0xffd700, 0xffd700, 1, 0.5, 0, 0);
      ray.fillTriangle(0, 0, 8, -200, -8, -200);
      ray.setRotation(angle);
      ray.setBlendMode(Phaser.BlendModes.ADD);
      content.add(ray);
      
      // Вращение лучей
      this.scene.tweens.add({
        targets: ray,
        angle: 360 + Phaser.Math.RadToDeg(angle),
        duration: 20000,
        repeat: -1,
        ease: 'Linear',
      });
    }
    
    // ========== MAIN GLOW ==========
    const mainGlow = this.scene.add.circle(0, 0, 180, 0xffd700, 0.3);
    mainGlow.setBlendMode(Phaser.BlendModes.ADD);
    content.add(mainGlow);
    
    this.scene.tweens.add({
      targets: mainGlow,
      scale: { from: 0.8, to: 1.2 },
      alpha: { from: 0.2, to: 0.4 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // ========== ЦЕНТРАЛЬНАЯ ИКОНКА ==========
    const iconBg = this.scene.add.graphics();
    iconBg.fillStyle(0x1a1a2e, 1);
    iconBg.fillCircle(0, 0, 100);
    iconBg.lineStyle(5, 0xffd700, 1);
    iconBg.strokeCircle(0, 0, 100);
    iconBg.lineStyle(3, 0xffed4e, 0.6);
    iconBg.strokeCircle(0, 0, 110);
    content.add(iconBg);
    
    // Иконка в зависимости от типа
    let icon: Phaser.GameObjects.Text | Phaser.GameObjects.Image;
    if (this.config.type === 'player') {
      icon = this.scene.add.text(0, 0, '⭐', { fontSize: '80px' }).setOrigin(0.5);
    } else if (this.config.factionId) {
      const faction = FACTIONS[this.config.factionId];
      // Используем эмодзи для фракций (icon поле отсутствует)
      const factionEmojis: Record<string, string> = {
        magma: '🔥',
        cyborg: '🤖',
        void: '🌀',
        insect: '🦗',
      };
      const iconText = this.scene.add.text(0, 0, factionEmojis[this.config.factionId] || '⚡', { fontSize: '70px' }).setOrigin(0.5);
      icon = iconText;
    } else {
      icon = this.scene.add.text(0, 0, '🎉', { fontSize: '80px' }).setOrigin(0.5);
    }
    content.add(icon);
    
    // Вращение иконки
    this.scene.tweens.add({
      targets: icon,
      angle: { from: -10, to: 10 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // ========== LEVEL UP TEXT ==========
    const levelUpText = this.scene.add.text(0, -200, 'LEVEL UP!', {
      fontFamily: fonts.tech,
      fontSize: '48px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5);
    content.add(levelUpText);
    
    this.scene.tweens.add({
      targets: levelUpText,
      scale: { from: 1, to: 1.1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // ========== LEVEL NUMBER ==========
    const levelText = this.scene.add.text(0, 140, `${this.config.level}`, {
      fontFamily: fonts.tech,
      fontSize: '60px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#ffd700',
      strokeThickness: 6,
    }).setOrigin(0.5);
    content.add(levelText);
    
    // ========== SUBTITLE ==========
    const subtitle = this.config.type === 'player' 
      ? 'Уровень игрока' 
      : `Мастерство фракции ${this.config.factionId ? FACTIONS[this.config.factionId].name : ''}`;
    
    const subtitleText = this.scene.add.text(0, 190, subtitle, {
      fontFamily: fonts.tech,
      fontSize: '16px',
      color: '#cbd5e1',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    content.add(subtitleText);

    // ========== PREVIEW REWARDS ==========
    this.renderRewardPreview(content);
    
    // ========== TAP TO CONTINUE ==========
    const tapText = this.scene.add.text(0, height / 2 - 80, '👆 Нажми, чтобы забрать награды', {
      fontFamily: fonts.primary,
      fontSize: '14px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.container.add(tapText);
    
    this.scene.tweens.add({
      targets: tapText,
      alpha: { from: 0.5, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // ========== АНИМАЦИЯ ПОЯВЛЕНИЯ КОНТЕНТА ==========
    this.scene.tweens.add({
      targets: content,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 600,
      ease: 'Back.easeOut',
    });
    
    // ========== ИНТЕРАКТИВНОСТЬ ==========
    const tapArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.01);
    tapArea.setOrigin(0);
    tapArea.setInteractive();
    this.container.add(tapArea);
    
    tapArea.on('pointerdown', () => {
      this.close();
    });

    // Явная CTA кнопка
    const cta = this.createCTAButton(centerX, height / 2 + 140, 'ЗАБРАТЬ НАГРАДЫ');
    this.container.add(cta);
  }

  private createParticles(width: number, height: number): void {
    // Золотые звёзды
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const star = this.scene.add.text(x, y, '✨', {
        fontSize: `${Phaser.Math.Between(16, 32)}px`,
      }).setOrigin(0.5);
      star.setAlpha(0);
      this.container.add(star);
      
      this.scene.tweens.add({
        targets: star,
        alpha: { from: 0, to: 1 },
        y: y - Phaser.Math.Between(100, 300),
        scale: { from: 0.5, to: 1.5 },
        duration: Phaser.Math.Between(1000, 2000),
        delay: Phaser.Math.Between(0, 500),
        ease: 'Sine.easeOut',
        onComplete: () => star.destroy(),
      });
    }
    
    // Конфетти
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(width * 0.3, width * 0.7);
      const confetti = this.scene.add.graphics();
      const color = Phaser.Math.RND.pick([0xffd700, 0xff6b6b, 0x4ade80, 0x3b82f6, 0xa855f7]);
      confetti.fillStyle(color, 1);
      confetti.fillRect(-3, -6, 6, 12);
      confetti.setPosition(x, -20);
      this.container.add(confetti);
      
      this.scene.tweens.add({
        targets: confetti,
        y: height + 50,
        x: x + Phaser.Math.Between(-100, 100),
        angle: Phaser.Math.Between(0, 720),
        duration: Phaser.Math.Between(2000, 3000),
        delay: Phaser.Math.Between(0, 300),
        ease: 'Cubic.easeIn',
        onComplete: () => confetti.destroy(),
      });
    }
  }

  // CTA кнопка
  private createCTAButton(x: number, y: number, label: string): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const s = 1;
    const w = 220;
    const h = 54;

    const container = this.scene.add.container(x, y);

    const glow = this.scene.add.graphics();
    glow.fillStyle(0xffd700, 0.18);
    glow.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 14);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    container.add(glow);

    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0xffd700, 0xffd700, 0xffae00, 0xffae00, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    bg.lineStyle(2, 0xffffff, 0.7);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    container.add(bg);

    const text = this.scene.add.text(0, 0, label, {
      fontFamily: fonts.tech,
      fontSize: '18px',
      color: '#000000',
      fontStyle: 'bold',
      stroke: '#ffffff',
      strokeThickness: 2,
    }).setOrigin(0.5);
    container.add(text);

    container.setSize(w, h);
    container.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);

    container.on('pointerover', () => {
      this.scene.tweens.add({ targets: container, scale: 1.03, duration: 120 });
    });
    container.on('pointerout', () => {
      this.scene.tweens.add({ targets: container, scale: 1, duration: 120 });
    });
    container.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      this.close();
    });

    return container;
  }

  // Превью наград
  private renderRewardPreview(parent: Phaser.GameObjects.Container): void {
    const rewards = this.config.rewards.rewards;
    if (!rewards || rewards.length === 0) return;

    const group = this.scene.add.container(0, 240);
    parent.add(group);

    const total = rewards.length;
    const gap = 120;
    const startX = -((total - 1) * gap) / 2;

    rewards.forEach((reward, idx) => {
      const tile = this.createRewardTile(reward);
      tile.setPosition(startX + idx * gap, 0);
      group.add(tile);
    });
  }

  private createRewardTile(reward: LevelReward['rewards'][number]): Phaser.GameObjects.Container {
    const fonts = getFonts();
    const container = this.scene.add.container(0, 0);
    const size = 110;

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x12121c, 0.95);
    bg.fillRoundedRect(-size / 2, -size / 2, size, size, 14);
    bg.lineStyle(2, 0xffd700, 0.6);
    bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 14);
    container.add(bg);

    let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
    let label = '';
    let amountText = '';

    switch (reward.type) {
      case 'coins':
        label = 'Coins';
        amountText = reward.amount ? `+${reward.amount}` : '';
        if (this.scene.textures.exists('ui_rewards_coins')) {
          icon = this.scene.add.image(0, -8, 'ui_rewards_coins').setDisplaySize(52, 52);
        } else {
          icon = this.scene.add.text(0, -8, '💰', { fontSize: '52px' }).setOrigin(0.5);
        }
        break;
      case 'crystals':
        label = 'Crystals';
        amountText = reward.amount ? `+${reward.amount}` : '';
        if (this.scene.textures.exists('ui_rewards_crystals')) {
          icon = this.scene.add.image(0, -8, 'ui_rewards_crystals').setDisplaySize(52, 52);
        } else {
          icon = this.scene.add.text(0, -8, '💎', { fontSize: '52px' }).setOrigin(0.5);
        }
        break;
      case 'fragments': {
        label = 'Fragments';
        amountText = reward.amount ? `+${reward.amount}` : '';
        const factionColor = this.config.factionId ? FACTIONS[this.config.factionId].color : 0x4ade80;
        icon = this.scene.add.text(0, -6, '🧩', { fontSize: '52px' }).setOrigin(0.5);
        bg.lineStyle(2, factionColor, 0.9);
        bg.strokeRoundedRect(-size / 2, -size / 2, size, size, 14);
        break;
      }
      case 'unit_choice': {
        label = 'Выбор юнита';
        amountText = 'Выбери 1';
        // Показать мини-стек из 3
        const stack = this.scene.add.container(0, -4);
        const choices = reward.choices || [];
        choices.slice(0, 3).forEach((id, i) => {
          const unit = UNITS_REPOSITORY.find(u => u.id === id);
          const offset = (i - 1) * 18;
          const textureKey = unit ? getRealUnitTextureKey(this.scene, unit) : null;
          if (textureKey) {
            const img = this.scene.add.image(offset, 0, textureKey).setDisplaySize(42, 42);
            stack.add(img);
          } else {
            const txt = this.scene.add.text(offset, 0, '?', { fontSize: '28px', color: '#fff' }).setOrigin(0.5);
            stack.add(txt);
          }
        });
        container.add(stack);
        break;
      }
      case 'card_pack':
        label = reward.message || 'Card Pack';
        amountText = reward.amount ? `x${reward.amount}` : '';
        icon = this.scene.add.text(0, -6, '🃏', { fontSize: '48px' }).setOrigin(0.5);
        break;
      case 'chest':
      default:
        label = reward.message || 'Chest';
        amountText = reward.amount ? `x${reward.amount}` : '';
        icon = this.scene.add.text(0, -6, '🎁', { fontSize: '48px' }).setOrigin(0.5);
        break;
    }

    if (icon) {
      container.add(icon);
    }

    const labelText = this.scene.add.text(0, size / 2 - 30, label, {
      fontFamily: fonts.tech,
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    labelText.setResolution(2);
    container.add(labelText);

    if (amountText) {
      const amt = this.scene.add.text(0, size / 2 - 12, amountText, {
        fontFamily: fonts.tech,
        fontSize: '14px',
        color: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      }).setOrigin(0.5);
      amt.setResolution(2);
      container.add(amt);
    }

    return container;
  }

  private close(): void {
    AudioManager.getInstance().playUIClick();
    hapticImpact('light');
    
    // Анимация закрытия
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        this.container.destroy();
        this.showRewardsOverlay();
      },
    });
  }

  private showRewardsOverlay(): void {
    // Показываем награды
    const hasUnitChoice = this.config.rewards.rewards.some(r => r.type === 'unit_choice');
    
    if (hasUnitChoice && this.config.factionId) {
      // Показываем выбор юнита используя UnitSelectionOverlay
      const reward = this.config.rewards.rewards.find(r => r.type === 'unit_choice');
      if (reward && reward.choices && reward.choices.length > 0) {
        import('./UnitSelectionOverlay').then(({ UnitSelectionOverlay }) => {
          new UnitSelectionOverlay(
            this.scene,
            reward.choices || [],
            true, // ✅ При повышении уровня награда всегда доступна
            (unitId) => {
              // Выдаём юнит наградой (с автодобавлением в резерв/команду)
              playerData.grantUnitReward(unitId);
              this.showGenericRewards();
            },
            () => {
              console.log('[LevelUpOverlay] Unit selection cancelled');
            }
          );
        });
      } else {
        console.warn('[LevelUpOverlay] Unit choice reward has no choices!');
        this.showGenericRewards();
      }
    } else {
      this.showGenericRewards();
    }
  }

  private showGenericRewards(): void {
    // Применяем остальные награды
    this.config.rewards.rewards.forEach(reward => {
      if (reward.type === 'coins' && reward.amount) {
        playerData.addCoins(reward.amount);
      } else if (reward.type === 'crystals' && reward.amount) {
        playerData.addCrystals(reward.amount);
      } else if (reward.type === 'fragments' && reward.amount) {
        this.grantFactionFragments(reward.amount);
      }
      // TODO: другие типы наград
    });
    
    // Завершаем
    this.config.onComplete();
  }

  private grantFactionFragments(amount: number): void {
    const factionId = this.config.factionId;
    if (!factionId || amount <= 0) {
      console.warn('[LevelUpOverlay] Cannot grant fragments without factionId');
      return;
    }

    // Раздаём по 3м юнитам фракции
    const targets = generateUnitChoices(factionId, this.config.level);
    if (!targets.length) return;

    const perUnit = Math.max(1, Math.floor(amount / targets.length));
    let remaining = amount;
    targets.forEach((unitId, idx) => {
      const give = idx === targets.length - 1 ? remaining : perUnit;
      playerData.addUnitFragments(unitId, give);
      remaining -= give;
    });
  }
}

// ========== ОКНО ВЫБОРА ЮНИТА ==========

interface UnitChoiceConfig {
  factionId: FactionId;
  choices: string[]; // 3 ID юнитов
  onSelect: (unitId: string) => void;
}

class UnitChoiceOverlay {
  private scene: Phaser.Scene;
  private config: UnitChoiceConfig;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene, config: UnitChoiceConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  private create(): void {
    const { width, height } = this.scene.cameras.main;
    const fonts = getFonts();
    
    this.container = this.scene.add.container(0, 0).setDepth(2001);
    
    // Затемнение
    const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.9);
    overlay.setOrigin(0);
    overlay.setInteractive();
    this.container.add(overlay);
    
    // Заголовок
    const title = this.scene.add.text(width / 2, 100, '🎁 ВЫБЕРИ ЮНИТА!', {
      fontFamily: fonts.tech,
      fontSize: '36px',
      color: '#ffd700',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.container.add(title);
    
    this.scene.tweens.add({
      targets: title,
      scale: { from: 1, to: 1.05 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    
    // 3 карточки юнитов
    const cardWidth = 180;
    const cardSpacing = 20;
    const totalWidth = cardWidth * 3 + cardSpacing * 2;
    const startX = (width - totalWidth) / 2 + cardWidth / 2;
    const cardY = height / 2;
    
    this.config.choices.forEach((unitId, index) => {
      const unit = UNITS_REPOSITORY.find(u => u.id === unitId);
      if (!unit) return;
      
      const cardX = startX + index * (cardWidth + cardSpacing);
      const card = this.createUnitCard(cardX, cardY, unit, cardWidth);
      this.container.add(card);
      
      // Анимация появления
      card.setAlpha(0);
      card.setScale(0.5);
      this.scene.tweens.add({
        targets: card,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: index * 150,
        ease: 'Back.easeOut',
      });
    });
  }

  private createUnitCard(x: number, y: number, unit: any, width: number): Phaser.GameObjects.Container {
    const card = this.scene.add.container(x, y);
    const height = 280;
    
    // Фон карточки
    const rarityColors: Record<string, number> = {
      common: 0x9ca3af,
      rare: 0x3b82f6,
      epic: 0xa855f7,
      legendary: 0xffd700,
    };
    const borderColor = rarityColors[unit.rarity] || 0x3b82f6;
    
    const bg = this.scene.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0f0f1a, 0x0f0f1a, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    bg.lineStyle(4, borderColor, 1);
    bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
    card.add(bg);
    
    // Изображение юнита
    const textureKey = unit.id;
    if (this.scene.textures.exists(textureKey)) {
      const unitImage = this.scene.add.image(0, -40, textureKey);
      unitImage.setDisplaySize(120, 120);
      card.add(unitImage);
    }
    
    // Название
    const name = this.scene.add.text(0, 60, unit.name, {
      fontFamily: getFonts().tech,
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      wordWrap: { width: width - 20 },
      align: 'center',
    }).setOrigin(0.5);
    card.add(name);
    
    // Редкость
    const rarityText = this.scene.add.text(0, 90, unit.rarity.toUpperCase(), {
      fontFamily: getFonts().tech,
      fontSize: '12px',
      color: `#${borderColor.toString(16)}`,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    card.add(rarityText);
    
    // Интерактивность
    const hitArea = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0).setInteractive({ useHandCursor: true });
    card.add(hitArea);
    
    hitArea.on('pointerover', () => {
      this.scene.tweens.add({
        targets: card,
        scale: 1.05,
        duration: 150,
        ease: 'Power2',
      });
    });
    
    hitArea.on('pointerout', () => {
      this.scene.tweens.add({
        targets: card,
        scale: 1,
        duration: 150,
      });
    });
    
    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticImpact('medium');
      
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.container.destroy();
          this.config.onSelect(unit.id);
        },
      });
    });
    
    return card;
  }
}
