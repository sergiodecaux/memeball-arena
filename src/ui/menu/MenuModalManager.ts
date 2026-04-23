// src/ui/menu/MenuModalManager.ts
// Управление модальными окнами главного меню

import Phaser from 'phaser';
import { getColors, hexToString, getFonts } from '../../config/themes';
import { playerData } from '../../data/PlayerData';
import { i18n, Language } from '../../localization/i18n';
import { FACTIONS, FactionConfig } from '../../constants/gameConstants';
import { AIDifficulty } from '../../types';
import { AudioManager } from '../../managers/AudioManager';
import { tgApp } from '../../utils/TelegramWebApp';
import { isWeekend } from '../../utils/WeekUtils';

export interface MenuModalCallbacks {
  onModeSelected: (mode: 'ai' | 'pvp' | 'campaign' | 'league' | 'tournament') => void;
  onDifficultySelected: (difficulty: AIDifficulty) => void;
  onLanguageSelected: (lang: Language) => void;
  onFactionSwitched: () => void;
  onModalClosed: () => void;
}

export class MenuModalManager {
  private scene: Phaser.Scene;
  private s: number;
  private callbacks: MenuModalCallbacks;

  private modalContainer?: Phaser.GameObjects.Container;
  private overlay?: Phaser.GameObjects.Rectangle;
  private isTransitioning = false;

  constructor(scene: Phaser.Scene, callbacks: MenuModalCallbacks) {
    this.scene = scene;
    this.s = tgApp.getUIScale();
    this.callbacks = callbacks;
  }

  showModeSelection(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;
    AudioManager.getInstance().playUISwoosh();

    this.createOverlay();

    const s = this.s;
    const modalW = Math.min(280 * s, this.scene.cameras.main.width - 30);
    const modalH = 420 * s; // ✅ Увеличена высота для 5 кнопок

    this.modalContainer = this.createModalContainer(modalW, modalH);

    const factionId = playerData.getFaction();
    const factionColor = factionId ? FACTIONS[factionId].color : getColors().uiAccent;

    // Заголовок
    this.modalContainer.add(
      this.scene.add.text(0, -modalH / 2 + 25 * s, i18n.t('selectMode').toUpperCase(), {
        fontSize: `${16 * s}px`,
        fontFamily: getFonts().tech,
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    const btnW = modalW - 30 * s;
    const btnH = 50 * s;
    const btnSpacing = 58 * s;
    let currentY = -modalH / 2 + 60 * s;

    // Кнопка vs AI (Casual)
    this.createModeButton(
      0,
      currentY,
      btnW,
      btnH,
      'ai',
      i18n.t('vsAI') || 'VS AI',
      i18n.t('vsAIDesc') || 'Quick match',
      factionColor,
      () => this.closeModal(() => this.callbacks.onModeSelected('ai'))
    );
    currentY += btnSpacing;

    // Кнопка PvP
    this.createModeButton(
      0,
      currentY,
      btnW,
      btnH,
      'pvp',
      i18n.t('pvpOnline') || 'PvP',
      i18n.t('pvpOnlineDesc') || 'Online match',
      getColors().uiAccentPink,
      () => this.closeModal(() => this.callbacks.onModeSelected('pvp'))
    );
    currentY += btnSpacing;

    // ✅ Кнопка League
    const leagueProgress = playerData.get().leagueProgress;
    const leagueTier = leagueProgress?.currentTier || 'meteorite';
    const leagueDivision = leagueProgress?.division || 3;
    const leagueStars = leagueProgress?.stars || 0;
    const leagueMaxStars = leagueProgress?.maxStars || 5;
    const leagueColor = 0x00f2ff; // Cyan
    
    const divisionRoman = ['I', 'II', 'III'][leagueDivision - 1] || 'III';
    const leagueName = leagueTier.charAt(0).toUpperCase() + leagueTier.slice(1);
    
    this.createModeButton(
      0,
      currentY,
      btnW,
      btnH,
      'league',
      'GALAXY LEAGUE',
      `${leagueName} ${divisionRoman} • ${leagueStars}/${leagueMaxStars} ★`,
      leagueColor,
      () => this.closeModal(() => this.callbacks.onModeSelected('league'))
    );
    currentY += btnSpacing;

    // ✅ Кнопка Tournament (только в выходные)
    if (isWeekend()) {
      const tournamentState = playerData.get().tournamentState;
      const hasAccess = (tournamentState?.keyFragments || 0) >= 3 || tournamentState?.hasTicket;
      const tournamentColor = 0xffd700;
      
      this.createModeButton(
        0,
        currentY,
        btnW,
        btnH,
        hasAccess ? 'tournament' : 'locked',
        'WEEKEND TOURNAMENT',
        hasAccess ? 'Enter tournament' : 'Need 3 key fragments',
        tournamentColor,
        hasAccess ? () => this.closeModal(() => this.callbacks.onModeSelected('tournament')) : () => {}
      );
      currentY += btnSpacing;
    }

    // ✅ Кнопка Campaign
    const progress = playerData.getCampaignProgress();
    const totalStars = progress.totalStars;
    const isTutorialDone = playerData.hasCompletedFirstMatchTutorial();
    const campaignColor = 0xffd700;
    const isLocked = !isTutorialDone;

    let campaignTitle = i18n.t('campaign') || 'CAMPAIGN';
    let campaignDesc = '';
    if (isLocked) {
      campaignDesc = i18n.t('completeTutorialFirst') || 'Complete tutorial';
    } else if (totalStars > 0) {
      campaignDesc = `⭐ ${totalStars} ${i18n.t('stars')}`;
    } else {
      campaignDesc = i18n.t('startAdventure') || 'Start adventure!';
    }

    this.createModeButton(
      0,
      currentY,
      btnW,
      btnH,
      isLocked ? 'locked' : 'campaign',
      campaignTitle,
      campaignDesc,
      campaignColor,
      isLocked ? () => {} : () => this.closeModal(() => this.callbacks.onModeSelected('campaign'))
    );

    this.animateModalIn();
  }

  showDifficultySelection(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;

    this.createOverlay();

    const s = this.s;
    const modalW = Math.min(280 * s, this.scene.cameras.main.width - 30);
    const modalH = 280 * s;

    this.modalContainer = this.createModalContainer(modalW, modalH);

    // Заголовок
    this.modalContainer.add(
      this.scene.add.text(0, -modalH / 2 + 25 * s, i18n.t('selectDifficulty'), {
        fontSize: `${16 * s}px`,
        fontFamily: getFonts().tech,
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    const difficulties: { id: AIDifficulty; name: string; desc: string; color: number; icon: string }[] = [
      { id: 'easy', name: i18n.t('easy'), desc: i18n.t('easyDesc'), color: 0x4ade80, icon: '⭐' },
      { id: 'medium', name: i18n.t('medium'), desc: i18n.t('mediumDesc'), color: 0xfbbf24, icon: '🔥' },
      { id: 'hard', name: i18n.t('hard'), desc: i18n.t('hardDesc'), color: 0xef4444, icon: '💀' },
    ];

    const btnW = modalW - 30 * s;
    const btnH = 52 * s;

    difficulties.forEach((diff, i) => {
      this.createDifficultyButton(0, -50 * s + i * (btnH + 8 * s), btnW, btnH, diff);
    });

    this.animateModalIn();
  }

  showLanguageSelection(isFirstLaunch: boolean = false): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;

    this.createOverlay();
    if (isFirstLaunch && this.overlay) {
      this.overlay.removeAllListeners();
    }

    const s = this.s;
    const modalW = Math.min(260 * s, this.scene.cameras.main.width - 30);
    const modalH = 220 * s;

    this.modalContainer = this.createModalContainer(modalW, modalH);

    // Иконка
    this.modalContainer.add(
      this.scene.add.text(0, -modalH / 2 + 25 * s, '🌍', { fontSize: `${28 * s}px` }).setOrigin(0.5)
    );

    // Заголовок
    this.modalContainer.add(
      this.scene.add.text(0, -modalH / 2 + 55 * s, i18n.t('selectLanguage'), {
        fontSize: `${16 * s}px`,
        fontFamily: getFonts().tech,
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    const languages = i18n.getAvailableLanguages();
    const currentLang = i18n.getLanguage();
    const btnW = modalW - 30 * s;
    const btnH = 48 * s;

    languages.forEach((lang, i) => {
      this.createLanguageButton(0, -10 * s + i * (btnH + 8 * s), btnW, btnH, lang, lang === currentLang, isFirstLaunch);
    });

    this.animateModalIn();
  }

  showFactionSwitchModal(): void {
    if (this.modalContainer || this.isTransitioning) return;
    this.isTransitioning = true;

    this.createOverlay();

    const s = this.s;
    const ownedFactions = playerData.getOwnedFactions();
    const activeFaction = playerData.getFaction()!;
    const modalW = Math.min(280 * s, this.scene.cameras.main.width - 30);
    const modalH = Math.min(90 + ownedFactions.length * 68, 400) * s;

    this.modalContainer = this.createModalContainer(modalW, modalH);

    // Заголовок
    this.modalContainer.add(
      this.scene.add.text(0, -modalH / 2 + 25 * s, `🛸 ${i18n.t('switchFaction').toUpperCase()}`, {
        fontSize: `${16 * s}px`,
        fontFamily: getFonts().tech,
        color: '#ffffff',
      }).setOrigin(0.5)
    );

    const btnW = modalW - 30 * s;
    const btnH = 58 * s;
    const startY = -modalH / 2 + 60 * s;

    ownedFactions.forEach((factionId, i) => {
      const faction = FACTIONS[factionId];
      const isActive = factionId === activeFaction;
      this.createFactionSwitchButton(0, startY + i * (btnH + 10 * s), btnW, btnH, faction, isActive);
    });

    this.animateModalIn();
  }

  private createModeButton(
    x: number,
    y: number,
    w: number,
    h: number,
    iconKey: string,
    title: string,
    subtitle: string,
    color: number,
    onClick: () => void
  ): void {
    const fonts = getFonts();
    const s = this.s;
    const btn = this.scene.add.container(x, y);
    this.modalContainer!.add(btn);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(color, 0.15);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    bg.lineStyle(2, color, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    btn.add(bg);

    // Иконка (PNG)
    const iconX = -w / 2 + 28 * s;
    const iconTextureKey = iconKey === 'locked' ? null : `ui_mode_${iconKey}`;
    
    if (iconTextureKey && this.scene.textures.exists(iconTextureKey)) {
      const iconSprite = this.scene.add.image(iconX, 0, iconTextureKey);
      iconSprite.setDisplaySize(24 * s, 24 * s);
      iconSprite.setOrigin(0.5, 0.5);
      btn.add(iconSprite);
    } else {
      // Fallback к emoji
      const fallbackIcon = iconKey === 'ai' ? '🤖' : iconKey === 'pvp' ? '⚔️' : iconKey === 'campaign' ? '🚀' : '🔒';
      btn.add(
        this.scene.add.text(iconX, 0, fallbackIcon, { fontSize: `${22 * s}px` }).setOrigin(0.5)
      );
    }

    // Заголовок
    btn.add(
      this.scene.add.text(-w / 2 + 55 * s, -7 * s, title, {
        fontSize: `${13 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(color),
      }).setOrigin(0, 0.5)
    );

    // Подзаголовок
    btn.add(
      this.scene.add.text(-w / 2 + 55 * s, 9 * s, subtitle, {
        fontSize: `${9 * s}px`,
        color: '#888888',
      }).setOrigin(0, 0.5)
    );

    // Область нажатия
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      onClick();
    });
  }

  private createDifficultyButton(
    x: number,
    y: number,
    w: number,
    h: number,
    diff: { id: AIDifficulty; name: string; desc: string; color: number; icon: string }
  ): void {
    const fonts = getFonts();
    const s = this.s;
    const btn = this.scene.add.container(x, y);
    this.modalContainer!.add(btn);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(diff.color, 0.1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    bg.lineStyle(1.5, diff.color, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    btn.add(bg);

    // Иконка
    btn.add(
      this.scene.add.text(-w / 2 + 28 * s, 0, diff.icon, { fontSize: `${20 * s}px` }).setOrigin(0.5)
    );

    // Название
    btn.add(
      this.scene.add.text(-w / 2 + 52 * s, -6 * s, diff.name, {
        fontSize: `${13 * s}px`,
        fontFamily: fonts.tech,
        color: hexToString(diff.color),
      }).setOrigin(0, 0.5)
    );

    // Описание
    btn.add(
      this.scene.add.text(-w / 2 + 52 * s, 9 * s, diff.desc, {
        fontSize: `${8 * s}px`,
        color: '#777788',
      }).setOrigin(0, 0.5)
    );

    // Область нажатия
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    btn.add(hitArea);
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      this.closeModal(() => this.callbacks.onDifficultySelected(diff.id));
    });
  }

  private createLanguageButton(
    x: number,
    y: number,
    w: number,
    h: number,
    lang: Language,
    isSelected: boolean,
    isFirstLaunch: boolean
  ): void {
    const colors = getColors();
    const fonts = getFonts();
    const s = this.s;
    const container = this.scene.add.container(x, y);
    this.modalContainer!.add(container);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(isSelected ? colors.uiAccent : 0x2a2a3a, isSelected ? 0.25 : 0.15);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    bg.lineStyle(2, isSelected ? colors.uiAccent : 0x3a3a4a, 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    container.add(bg);

    // Флаг
    container.add(
      this.scene.add.text(-w / 2 + 28 * s, 0, i18n.getLanguageFlag(lang), {
        fontSize: `${22 * s}px`,
      }).setOrigin(0.5)
    );

    // Название языка
    container.add(
      this.scene.add.text(-w / 2 + 55 * s, 0, i18n.getLanguageName(lang), {
        fontSize: `${14 * s}px`,
        fontFamily: fonts.tech,
        color: isSelected ? hexToString(colors.uiAccent) : '#ffffff',
      }).setOrigin(0, 0.5)
    );

    // Галочка
    if (isSelected) {
      container.add(
        this.scene.add.text(w / 2 - 22 * s, 0, '✓', {
          fontSize: `${16 * s}px`,
          color: hexToString(colors.uiAccent),
        }).setOrigin(0.5)
      );
    }

    // Область нажатия
    const hitArea = this.scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
    container.add(hitArea);
    hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
      p.event.stopPropagation();
      i18n.setLanguage(lang);
      playerData.get().settings.language = lang;
      playerData.save();
      if (isFirstLaunch) i18n.setFirstLaunchComplete();
      this.closeModal(() => this.callbacks.onLanguageSelected(lang));
    });
  }

  private createFactionSwitchButton(
    x: number,
    y: number,
    w: number,
    h: number,
    faction: FactionConfig,
    isActive: boolean
  ): void {
    const fonts = getFonts();
    const s = this.s;
    const btn = this.scene.add.container(x, y);
    this.modalContainer!.add(btn);

    // Фон
    const bg = this.scene.add.graphics();
    bg.fillStyle(isActive ? 0x22c55e : faction.color, isActive ? 0.2 : 0.1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    bg.lineStyle(2, isActive ? 0x22c55e : faction.color, isActive ? 0.8 : 0.5);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10 * s);
    btn.add(bg);

    // Иконка фракции
    const iconX = -w / 2 + 35 * s;
    if (this.scene.textures.exists(faction.assetKey)) {
      btn.add(
        this.scene.add.image(iconX, 0, faction.assetKey).setDisplaySize(40 * s, 40 * s)
      );
    }

    // Название фракции
    const factionName = i18n.t(faction.id) || faction.name;
    btn.add(
      this.scene.add.text(-w / 2 + 65 * s, -8 * s, factionName, {
        fontSize: `${13 * s}px`,
        fontFamily: fonts.tech,
        color: isActive ? '#22c55e' : hexToString(faction.color),
      }).setOrigin(0, 0.5)
    );

    // Описание фракции
    const factionDesc = i18n.t(faction.id + 'Desc') || faction.description;
    btn.add(
      this.scene.add.text(-w / 2 + 65 * s, 10 * s, factionDesc.split('.')[0], {
        fontSize: `${8 * s}px`,
        color: '#888888',
      }).setOrigin(0, 0.5)
    );

    // Индикатор
    btn.add(
      this.scene.add.text(w / 2 - 20 * s, 0, isActive ? '✓' : '›', {
        fontSize: `${18 * s}px`,
        color: isActive ? '#22c55e' : hexToString(faction.color),
      }).setOrigin(0.5)
    );

    // Интерактивность только для неактивных
    if (!isActive) {
      const hitArea = this.scene.add.rectangle(0, 0, w, h, 0, 0).setInteractive({ useHandCursor: true });
      btn.add(hitArea);
      hitArea.on('pointerdown', (p: Phaser.Input.Pointer) => {
        p.event.stopPropagation();
        if (playerData.switchFaction(faction.id)) {
          this.closeModal(() => this.callbacks.onFactionSwitched());
        }
      });
    }
  }

  private createOverlay(): void {
    const { width, height } = this.scene.cameras.main;
    this.overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(199)
      .setInteractive();
    this.overlay.on('pointerdown', () => this.closeModal());
    this.scene.tweens.add({ targets: this.overlay, alpha: 0.85, duration: 200 });
  }

  private createModalContainer(w: number, h: number): Phaser.GameObjects.Container {
    const { width, height } = this.scene.cameras.main;
    const s = this.s;
    const factionId = playerData.getFaction();
    const accentColor = factionId ? FACTIONS[factionId].color : getColors().uiAccentPink;

    const container = this.scene.add.container(width / 2, height / 2).setDepth(200);

    // Фон с акцентом
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.4);
    bg.fillRoundedRect(-w / 2 + 4, -h / 2 + 5, w, h, 16 * s);
    bg.fillStyle(0x14101e, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    bg.fillStyle(accentColor, 0.7);
    bg.fillRoundedRect(-40 * s, -h / 2 + 1, 80 * s, 3, 2);
    bg.lineStyle(2, accentColor, 0.4);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16 * s);
    container.add(bg);

    return container;
  }

  private animateModalIn(): void {
    this.modalContainer?.setScale(0.85).setAlpha(0);
    this.scene.tweens.add({
      targets: this.modalContainer,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.isTransitioning = false;
      },
    });
  }

  closeModal(callback?: () => void): void {
    if (this.isTransitioning && !callback) return;
    this.isTransitioning = true;

    const cleanup = () => {
      if (this.modalContainer) {
        this.scene.tweens.killTweensOf(this.modalContainer);
        this.modalContainer.removeAll(true);
        this.modalContainer.destroy();
        this.modalContainer = undefined;
      }

      if (this.overlay) {
        this.scene.tweens.killTweensOf(this.overlay);
        this.overlay.destroy();
        this.overlay = undefined;
      }

      this.isTransitioning = false;
      callback?.();
    };

    if (this.modalContainer) {
      this.scene.tweens.add({
        targets: this.modalContainer,
        scale: 0.9,
        alpha: 0,
        duration: 150,
      });
    }

    if (this.overlay) {
      this.scene.tweens.add({
        targets: this.overlay,
        alpha: 0,
        duration: 150,
        onComplete: cleanup,
      });
    } else {
      cleanup();
    }
  }

  isModalOpen(): boolean {
    return !!this.modalContainer;
  }

  isInTransition(): boolean {
    return this.isTransitioning;
  }

  destroy(): void {
    this.closeModal();
  }
}