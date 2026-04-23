// src/ui/menu/MenuHeader.ts

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { playerData, getRankByLevel } from '../../data/PlayerData';
import { i18n } from '../../localization/i18n';
import { FACTIONS } from '../../constants/gameConstants';
import { AudioManager } from '../../managers/AudioManager';
import { hapticSelection } from '../../utils/Haptics';
import { tgApp } from '../../utils/TelegramWebApp';

export interface MenuHeaderCallbacks {
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onFactionSwitchClick: () => void;
  onAddCurrencyClick: () => void;
  onAddCrystalsClick?: () => void; // 🧪 DEV TEST: убрать в релизе
  onDevPromoteLeague?: () => void; // 🧪 DEV TEST: убрать в релизе
  onDevToggleWeekend?: () => void; // 🧪 DEV TEST: убрать в релизе
}

export class MenuHeader {
  private scene: Phaser.Scene;
  private s: number;
  private callbacks: MenuHeaderCallbacks;

  constructor(scene: Phaser.Scene, callbacks: MenuHeaderCallbacks) {
    this.scene = scene;
    this.s = tgApp.getUIScale();
    this.callbacks = callbacks;
  }

  create(): void {
    const { width, height } = this.scene.cameras.main;
    const colors = getColors();
    const s = this.s;
    
    // Переносим хедер в верхнюю зону, учитывая safe area
    const topInset = tgApp.getTopInset();
    const headerY = topInset + 70 * s;

    this.createCurrencyPanel(width, headerY, colors);
    this.createSettingsButton(30 * s, headerY); 
    this.createPlayerBadge(headerY);
    
    // =====================================================
    // 🧪 DEV TEST: Панель для тестирования - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
    // =====================================================
    this.createDevPanel(width);
    // =====================================================
  }

  private createCurrencyPanel(width: number, headerY: number, colors: ReturnType<typeof getColors>): void {
    const s = this.s;
    
    // Валюта справа
    const currencyContainer = this.scene.add.container(width - 15 * s, headerY).setDepth(50);

    const currencyBg = this.scene.add.graphics();
    currencyBg.fillStyle(0x000000, 0.8);
    currencyBg.fillRoundedRect(-110 * s, -15 * s, 110 * s, 42 * s, 10 * s);
    currencyBg.lineStyle(1, 0x444444, 0.5);
    currencyBg.strokeRoundedRect(-110 * s, -15 * s, 110 * s, 42 * s, 10 * s);
    currencyContainer.add(currencyBg);

    const data = playerData.get();

    // Монеты
    const coinsIconX = -95 * s;
    const coinsTextX = -78 * s;
    if (this.scene.textures.exists('ui_rewards_coins')) {
      const coinsIcon = this.scene.add.image(coinsIconX, -4 * s, 'ui_rewards_coins');
      coinsIcon.setDisplaySize(16 * s, 16 * s);
      coinsIcon.setOrigin(0, 0.5);
      currencyContainer.add(coinsIcon);
    } else {
      currencyContainer.add(
        this.scene.add.text(coinsIconX, -4 * s, '💰', { fontSize: `${12 * s}px` }).setOrigin(0, 0.5)
      );
    }
    currencyContainer.add(
      this.scene.add.text(coinsTextX, -4 * s, this.formatNumber(data.coins), {
        fontSize: `${11 * s}px`,
        fontFamily: getFonts().tech,
        color: hexToString(colors.uiGold),
      }).setOrigin(0, 0.5)
    );

    // Кристаллы
    const crystalsIconX = -95 * s;
    const crystalsTextX = -78 * s;
    if (this.scene.textures.exists('ui_rewards_crystals')) {
      const crystalsIcon = this.scene.add.image(crystalsIconX, 14 * s, 'ui_rewards_crystals');
      crystalsIcon.setDisplaySize(16 * s, 16 * s);
      crystalsIcon.setOrigin(0, 0.5);
      currencyContainer.add(crystalsIcon);
    } else {
      currencyContainer.add(
        this.scene.add.text(crystalsIconX, 14 * s, '💎', { fontSize: `${12 * s}px` }).setOrigin(0, 0.5)
      );
    }
    currencyContainer.add(
      this.scene.add.text(crystalsTextX, 14 * s, this.formatNumber(data.crystals), {
        fontSize: `${11 * s}px`,
        fontFamily: getFonts().tech,
        color: hexToString(colors.uiAccentPink),
      }).setOrigin(0, 0.5)
    );

    // =====================================================
    // 🧪 DEV TEST: Кнопки "+" для монет и кристаллов - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
    // =====================================================
    const plusBtnCoins = this.createPlusButton(-12 * s, -4 * s, colors.uiGold, 'coins');
    currencyContainer.add(plusBtnCoins);
    
    if (this.callbacks.onAddCrystalsClick) {
      const plusBtnCrystals = this.createPlusButton(-12 * s, 14 * s, colors.uiAccentPink, 'crystals');
      currencyContainer.add(plusBtnCrystals);
    }
    // =====================================================
  }

  private createPlusButton(x: number, y: number, color: number, type: 'coins' | 'crystals' = 'coins'): Phaser.GameObjects.Container {
    const s = this.s;
    const btn = this.scene.add.container(x, y);

    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillCircle(0, 0, 11 * s);
    bg.lineStyle(1.5, color, 0.5);
    bg.strokeCircle(0, 0, 11 * s);
    btn.add(bg);

    btn.add(
      this.scene.add.text(0, -1, '+', {
        fontSize: `${14 * s}px`,
        fontFamily: getFonts().tech,
        color: hexToString(color),
      }).setOrigin(0.5)
    );

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 11 * s), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        if (type === 'crystals' && this.callbacks.onAddCrystalsClick) {
          this.callbacks.onAddCrystalsClick();
        } else {
          this.callbacks.onAddCurrencyClick();
        }
      });

    return btn;
  }

  private createSettingsButton(x: number, y: number): void {
    const s = this.s;
    const btn = this.scene.add.container(x, y).setDepth(50);

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.lineStyle(1, 0x444444, 0.5);
    bg.strokeCircle(0, 0, 18 * s);
    bg.fillCircle(0, 0, 18 * s);
    btn.add(bg);

    // Иконка настроек
    if (this.scene.textures.exists('ui_settings_gear')) {
      const settingsIcon = this.scene.add.image(0, 0, 'ui_settings_gear');
      settingsIcon.setDisplaySize(20 * s, 20 * s);
      settingsIcon.setOrigin(0.5, 0.5);
      btn.add(settingsIcon);
    } else {
      btn.add(
        this.scene.add.text(0, 0, '⚙️', { fontSize: `${14 * s}px` }).setOrigin(0.5)
      );
    }

    btn.setInteractive(new Phaser.Geom.Circle(0, 0, 18 * s), Phaser.Geom.Circle.Contains)
      .on('pointerdown', () => {
        AudioManager.getInstance().playUIClick();
        this.callbacks.onSettingsClick();
      });
  }

  private createPlayerBadge(headerY: number): void {
    const colors = getColors();
    const fonts = getFonts();
    const data = playerData.get();
    const nickname = playerData.getNickname();
    const rank = getRankByLevel(data.level);
    const factionId = data.selectedFaction;
    const faction = factionId ? FACTIONS[factionId] : null;
    const ownedFactions = playerData.getOwnedFactions();
    const s = this.s;

    const badgeW = faction ? 165 * s : 120 * s;
    const badgeH = 32 * s;
    
    // Размещаем бейдж слева, после кнопки настроек
    const badgeX = (65 * s) + (badgeW / 2);

    const container = this.scene.add.container(badgeX, headerY).setDepth(50);

    // Фон бейджа
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRoundedRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16 * s);
    
    if (faction) {
      bg.lineStyle(2, faction.color, 0.6);
    } else {
      bg.lineStyle(1, 0x444444, 0.5);
    }
    bg.strokeRoundedRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, 16 * s);
    container.add(bg);

    // Иконка фракции
    const iconX = -badgeW / 2 + 18 * s;
    if (faction && this.scene.textures.exists(faction.assetKey)) {
      const glow = this.scene.add.graphics();
      glow.fillStyle(faction.color, 0.3);
      glow.fillCircle(iconX, 0, 14 * s);
      container.add(glow);

      const factionIcon = this.scene.add.image(iconX, 0, faction.assetKey)
        .setDisplaySize(24 * s, 24 * s);
      container.add(factionIcon);
    }

    // Текст
    const textX = iconX + 18 * s;
    const displayName = nickname.length > 8 ? nickname.substring(0, 8) + '..' : nickname;
    
    container.add(
      this.scene.add.text(textX, -5 * s, displayName, {
        fontSize: `${11 * s}px`,
        fontFamily: fonts.tech,
        color: faction ? hexToString(faction.color) : '#ffffff',
      }).setOrigin(0, 0.5)
    );

    // Уровень с иконкой
    const levelTextX = textX;
    const levelTextY = 8 * s;
    if (this.scene.textures.exists('ui_player_level')) {
      const levelIcon = this.scene.add.image(levelTextX, levelTextY, 'ui_player_level');
      levelIcon.setDisplaySize(14 * s, 14 * s);
      levelIcon.setOrigin(0, 0.5);
      container.add(levelIcon);
      
      const levelText = this.scene.add.text(levelTextX + 18 * s, levelTextY, `${rank.icon} ${i18n.t('level')} ${data.level}`, {
        fontSize: `${9 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(rank.color),
      }).setOrigin(0, 0.5);
      container.add(levelText);
    } else {
      container.add(
        this.scene.add.text(levelTextX, levelTextY, `${rank.icon} ${i18n.t('level')} ${data.level}`, {
          fontSize: `${9 * s}px`,
          fontFamily: fonts.tech,
          color: hexToString(rank.color),
        }).setOrigin(0, 0.5)
      );
    }

    // Индикатор переключения
    if (faction && ownedFactions.length > 1) {
      container.add(
        this.scene.add.text(badgeW / 2 - 6 * s, 0, '▼', {
          fontSize: `${8 * s}px`,
          color: hexToString(faction.color),
        }).setOrigin(0.5).setAlpha(0.6)
      );
    }

    // Интерактивность
    const hitArea = this.scene.add.rectangle(0, 0, badgeW, badgeH, 0, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);

    hitArea.on('pointerdown', () => {
      AudioManager.getInstance().playUIClick();
      hapticSelection();
      if (ownedFactions.length > 1) {
        this.callbacks.onFactionSwitchClick();
      } else {
        this.callbacks.onProfileClick();
      }
    });
  }

  // =====================================================
  // 🧪 DEV TEST: Панель для тестирования - УДАЛИТЬ ПЕРЕД РЕЛИЗОМ!
  // =====================================================
  private createDevPanel(width: number): void {
    const s = this.s;
    const colors = getColors();
    const topInset = tgApp.getTopInset();
    
    const panelY = topInset + 60 * s;
    const panelContainer = this.scene.add.container(width / 2, panelY).setDepth(55); // ✅ Понижен depth чтобы не блокировать модалки
    
    // Фон панели
    const bg = this.scene.add.graphics();
    bg.fillStyle(0xff0000, 0.1);
    bg.lineStyle(2, 0xff0000, 0.5);
    bg.fillRoundedRect(-120 * s, -25 * s, 240 * s, 50 * s, 8 * s);
    bg.strokeRoundedRect(-120 * s, -25 * s, 240 * s, 50 * s, 8 * s);
    panelContainer.add(bg);
    
    // Заголовок
    const title = this.scene.add.text(0, -12 * s, '🧪 DEV TEST', {
      fontSize: `${10 * s}px`,
      fontFamily: getFonts().tech,
      color: '#ff0000',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    panelContainer.add(title);
    
    let btnX = -90 * s;
    
    // Кнопка: Повысить лигу
    if (this.callbacks.onDevPromoteLeague) {
      const promoteBtn = this.createDevButton(btnX, 8 * s, '⬆️ LEAGUE', 0x00ff00);
      const promoteBtnW = 70 * s;
      const promoteBtnH = 16 * s;
      const promoteHitArea = new Phaser.Geom.Rectangle(-promoteBtnW / 2, -promoteBtnH / 2, promoteBtnW, promoteBtnH);
      promoteBtn.setInteractive(promoteHitArea, Phaser.Geom.Rectangle.Contains);
      promoteBtn.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_ui_click');
        hapticSelection();
        this.callbacks.onDevPromoteLeague?.();
      });
      panelContainer.add(promoteBtn);
      btnX += 90 * s;
    }
    
    // Кнопка: Режим выходных
    if (this.callbacks.onDevToggleWeekend) {
      const weekendBtn = this.createDevButton(btnX, 8 * s, '📅 WEEKEND', 0x00ffff);
      const weekendBtnW = 70 * s;
      const weekendBtnH = 16 * s;
      const weekendHitArea = new Phaser.Geom.Rectangle(-weekendBtnW / 2, -weekendBtnH / 2, weekendBtnW, weekendBtnH);
      weekendBtn.setInteractive(weekendHitArea, Phaser.Geom.Rectangle.Contains);
      weekendBtn.on('pointerdown', () => {
        AudioManager.getInstance().playSFX('sfx_ui_click');
        hapticSelection();
        this.callbacks.onDevToggleWeekend?.();
      });
      panelContainer.add(weekendBtn);
    }
  }
  
  private createDevButton(x: number, y: number, text: string, color: number): Phaser.GameObjects.Container {
    const s = this.s;
    const btn = this.scene.add.container(x, y);
    
    const btnW = 70 * s;
    const btnH = 16 * s;
    
    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.2);
    bg.lineStyle(1.5, color, 0.7);
    bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 4 * s);
    bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 4 * s);
    btn.add(bg);
    
    const label = this.scene.add.text(0, 0, text, {
      fontSize: `${8 * s}px`,
      fontFamily: getFonts().tech,
      color: hexToString(color),
      fontStyle: 'bold',
    }).setOrigin(0.5);
    btn.add(label);
    
    // ✅ Добавляем hitArea для корректной работы интерактивности
    const hitArea = this.scene.add.rectangle(0, 0, btnW, btnH, 0, 0);
    btn.add(hitArea);
    
    return btn;
  }
  // =====================================================

  private formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
  }
}