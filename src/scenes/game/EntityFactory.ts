// src/scenes/game/EntityFactory.ts
// ✅ ИЗМЕНЕНО: Добавлена поддержка динамического размера команды (Faction Mastery v9)

import Phaser from 'phaser';
import { Ball } from '../../entities/Ball';
import { Cap } from '../../entities/Cap';
import { Unit } from '../../entities/Unit';
import { GameUnit, StartPositions } from './types';
import { PlayerNumber, FieldBounds } from '../../types';
import { 
  STARTING_POSITIONS, 
  BALL, 
  CapClass, 
  FactionId 
} from '../../constants/gameConstants';
import { Formation, playerData, DEFAULT_FORMATIONS, CapUpgrades, STARTER_UNITS_BY_FACTION } from '../../data/PlayerData';
import { AIDifficulty } from '../../types';
import { getAIFormationsForTeamSize, getDefaultAIFormation } from '../../ai/AIFormations';
import { GameStartData, MultiplayerManager, PvPPlayer } from '../../managers/MultiplayerManager';
import { getUnit, getStarterUnits, UnitData, TUTORIAL_LEGENDARY_UNITS } from '../../data/UnitsCatalog';
import { UNITS_REPOSITORY, UnitRarity, getUnitById as getRepositoryUnit, getUnitsByFactionAndRole } from '../../data/UnitsRepository';

// === AI UPGRADE PRESETS BY DIFFICULTY ===

// ⚠️ REMOVED: AI_UPGRADES_BY_DIFFICULTY - старая система прокачки убрана
// ⚠️ REMOVED: getAIUpgradesForDifficulty - теперь крутость ботов зависит от выбора юнитов

export interface EntityFactoryConfig {
  scene: Phaser.Scene;
  fieldBounds: FieldBounds;
  fieldScale: number;
  isPvPMode: boolean;
  pvpData?: GameStartData;
  isHost: boolean;
  useFactions: boolean;
  playerFaction: FactionId;
  opponentFaction: FactionId;
  formation: Formation;
  // ✅ ДОБАВЛЕНО: Размеры команд
  playerTeamSize?: number;
  aiTeamSize?: number;
  // ✅ NEW: AI difficulty for upgrade scaling
  aiDifficulty?: AIDifficulty;
  // ✅ ADDED: Boss level flags
  isBossLevel?: boolean;
  bossUnitId?: string;
  // ✅ NEW: Tutorial match flag
  isTutorialMatch?: boolean;  // Флаг обучающего матча
}

export class EntityFactory {
  private config: EntityFactoryConfig;

  constructor(config: EntityFactoryConfig) {
    this.config = config;
  }

  createBall(): { ball: Ball; startPosition: { x: number; y: number } } {
    const pos = this.relativeToAbsolute(
      STARTING_POSITIONS.BALL.x,
      STARTING_POSITIONS.BALL.y
    );
    
    const ballSkinId = this.config.isPvPMode
      ? this.config.pvpData?.ballSkin
      : playerData.get().equippedBallSkin;

    const ball = new Ball(
      this.config.scene,
      pos.x,
      pos.y,
      BALL.RADIUS * this.config.fieldScale,
      ballSkinId
    );

    return { ball, startPosition: pos };
  }

  createCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    Cap.resetCounters();
    Unit.resetCounters();

    if (this.config.isPvPMode) {
      return this.createPvPCaps();
    } else if (this.config.useFactions) {
      return this.createFactionCaps();
    } else {
      return this.createOfflineCaps();
    }
  }

  /**
   * 🔥 ИЗМЕНЕНО: Создание юнитов фракций с поддержкой 3-5 юнитов
   */
  private createFactionCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];
    
    // ✅ ИЗМЕНЕНО: Определяем размер команды
    const playerTeamSize = this.config.playerTeamSize || 3;
    const aiTeamSize = this.config.aiTeamSize || playerTeamSize;
    
    // ✅ ИЗМЕНЕНО: Player uses their selected formation
    const playerFormation = this.getFormationForSize(this.config.formation, playerTeamSize);
    
    // ✅ NEW: AI uses its own formations (not mirroring player)
    const aiFormations = getAIFormationsForTeamSize(aiTeamSize);
    const aiFormation = aiFormations.balanced || getDefaultAIFormation(aiTeamSize);

    // Получаем команду игрока (или дефолтную)
    const playerTeam = this.getPlayerTeam(this.config.playerFaction, playerTeamSize);
    console.log(`[EntityFactory] 📋 Player team (${playerTeamSize}):`, playerTeam);

    // Получаем команду оппонента (с учётом сложности AI)
    const opponentTeam = this.getAITeamForDifficulty(
      this.config.opponentFaction, 
      aiTeamSize, 
      this.config.aiDifficulty
    );
    console.log(`[EntityFactory] 🤖 Opponent team (${aiTeamSize}, ${this.config.aiDifficulty}):`, opponentTeam);

    // ===== PLAYER UNITS =====
    for (let i = 0; i < playerTeamSize; i++) {
      const slot = playerFormation.slots[i];
      if (!slot) {
        console.warn(`[EntityFactory] ⚠️ No slot ${i} in formation, using fallback`);
        continue;
      }
      
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      
      const unitId = playerTeam[i];
      // ✅ FIX: Ищем юнит сначала в UNITS_CATALOG, потом в UNITS_REPOSITORY
      let unitData = getUnit(unitId);
      if (!unitData) {
        const repoUnit = getRepositoryUnit(unitId);
        if (repoUnit) {
          // Конвертируем UnitData из Repository в формат Catalog
          unitData = {
            id: repoUnit.id,
            assetKey: repoUnit.assetKey,
            assetPath: repoUnit.assetPath,
            capClass: repoUnit.role as CapClass,
            factionId: repoUnit.factionId,
            name: repoUnit.name,
            title: repoUnit.title,
            rarity: repoUnit.rarity,
            isStarter: repoUnit.isStarter || false,
            description: repoUnit.description,
            stats: repoUnit.stats,
            price: { coins: 0, crystals: 0 },
          };
        } else {
          console.warn(`[EntityFactory] ⚠️ Unit not found: ${unitId}`);
        }
      }

      const unitClass: CapClass = unitData?.capClass || 'balanced';

      console.log(`[EntityFactory] ✅ Player unit ${i}: ${unitId} → ${unitData?.assetKey || 'FALLBACK'} (class: ${unitClass})`);

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        unitId,
        this.config.fieldScale,
        {
          factionId: this.config.playerFaction,
          capClass: unitClass,
          applyFactionStats: true,
          unitId: unitId,
        }
      );

      caps.push(unit as any);
      startPositions.push(absPos);
    }

    // ===== OPPONENT UNITS (AI) =====
    // ⚠️ NEW: Теперь крутость ботов зависит от выбора юнитов, а не от upgrades
    
    // Determine Boss Slot (usually center or tank position)
    const bossSlotIndex = aiTeamSize >= 3 ? 1 : 0;

    for (let i = 0; i < aiTeamSize; i++) {
      const slot = aiFormation.slots[i];
      if (!slot) {
        console.warn(`[EntityFactory] ⚠️ No AI slot ${i} in formation, using fallback`);
        continue;
      }
      
      // ✅ FIX: AI formations are already defined for top half, don't mirror Y
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      
      let unitId = opponentTeam[i];
      let isBossUnit = false;

      // ✅ BOSS INJECTION LOGIC
      if (this.config.isBossLevel && this.config.bossUnitId && i === bossSlotIndex) {
        unitId = this.config.bossUnitId;
        isBossUnit = true;
        console.log(`[EntityFactory] 👹 SPAWNING BOSS: ${unitId} at slot ${i}`);
      }
      
      // ✅ FIX: Ищем юнит сначала в UNITS_CATALOG, потом в UNITS_REPOSITORY
      let unitData = getUnit(unitId);
      if (!unitData) {
        const repoUnit = getRepositoryUnit(unitId);
        if (repoUnit) {
          unitData = {
            id: repoUnit.id,
            assetKey: repoUnit.assetKey,
            assetPath: repoUnit.assetPath,
            capClass: repoUnit.role as CapClass,
            factionId: repoUnit.factionId,
            name: repoUnit.name,
            title: repoUnit.title,
            rarity: repoUnit.rarity,
            isStarter: repoUnit.isStarter || false,
            description: repoUnit.description,
            stats: repoUnit.stats,
            price: { coins: 0, crystals: 0 },
          };
        }
      }
      
      if (!unitData) {
        console.error(`[EntityFactory] ❌ Opponent unit not found: ${unitId}`);
        console.error(`[EntityFactory] ❌ This may cause the match to fail. Using fallback unit.`);
        
        // ✅ FIX: Используем fallback юнит вместо краша
        const fallbackTeam = this.getDefaultTeam(this.config.opponentFaction, 1);
        const fallbackUnitId = fallbackTeam[0];
        const fallbackUnitData = getUnit(fallbackUnitId);
        
        if (!fallbackUnitData) {
          console.error(`[EntityFactory] ❌ CRITICAL: Even fallback unit not found! Skipping opponent unit ${i}`);
          continue;
        }
        
        console.log(`[EntityFactory] ✅ Using fallback unit: ${fallbackUnitId}`);
        
        try {
          const unit = new Unit(
            this.config.scene,
            absPos.x,
            absPos.y,
            2 as PlayerNumber,
            fallbackUnitId,
            this.config.fieldScale,
            {
              factionId: this.config.opponentFaction,
              capClass: fallbackUnitData.capClass,
              applyFactionStats: true,
              unitId: fallbackUnitId,
            }
          );
          
          caps.push(unit as any);
          startPositions.push(absPos);
        } catch (error) {
          console.error(`[EntityFactory] ❌ Error creating fallback unit:`, error);
        }
        continue;
      }

      const unitClass: CapClass = unitData?.capClass || 'balanced';

      console.log(`[EntityFactory] ✅ Opponent unit ${i}: ${unitId} → ${unitData?.assetKey || 'FALLBACK'} (class: ${unitClass}${isBossUnit ? ' [BOSS]' : ''})`);

      try {
        const unit = new Unit(
          this.config.scene,
          absPos.x,
          absPos.y,
          2 as PlayerNumber,
          unitId,
          this.config.fieldScale,
          {
            factionId: this.config.opponentFaction,
            capClass: unitClass,
            applyFactionStats: true,
            unitId: unitId,
            // ⚠️ REMOVED: applyUpgrades, customUpgrades - старая система прокачки убрана
          }
        );

        caps.push(unit as any);
        startPositions.push(absPos);
      } catch (error) {
        console.error(`[EntityFactory] ❌ Error creating opponent unit ${unitId}:`, error);
        console.error(`[EntityFactory] ❌ Skipping this unit to prevent match crash`);
        // Продолжаем без этого юнита, чтобы не крашить весь матч
      }
    }

    console.log(`[EntityFactory] ✅ Created ${caps.length} faction units total (${playerTeamSize} + ${aiTeamSize})`);
    return { caps, startPositions };
  }

  /**
   * ✅ НОВОЕ: Получает формацию подходящего размера
   */
  private getFormationForSize(preferredFormation: Formation, teamSize: number): Formation {
    // Если размер совпадает — используем предпочитаемую
    if (preferredFormation.teamSize === teamSize || 
        (preferredFormation.slots.length === teamSize)) {
      return preferredFormation;
    }
    
    // Ищем дефолтную формацию нужного размера
    const matchingFormation = DEFAULT_FORMATIONS.find(f => f.teamSize === teamSize);
    if (matchingFormation) {
      console.log(`[EntityFactory] 📐 Using default formation for ${teamSize} units: ${matchingFormation.name}`);
      return matchingFormation;
    }
    
    // Fallback: генерируем слоты динамически
    console.log(`[EntityFactory] ⚠️ No formation for ${teamSize} units, generating dynamically`);
    return this.generateDynamicFormation(teamSize);
  }

  /**
   * ✅ НОВОЕ: Генерация формации для произвольного размера команды
   */
  private generateDynamicFormation(teamSize: number): Formation {
    const slots: { id: string; x: number; y: number }[] = [];
    
    // Распределяем юнитов по линиям
    if (teamSize === 3) {
      // Треугольник: 1 защитник, 2 полузащитника
      slots.push({ id: 's0', x: 0.5, y: 0.75 });   // GK
      slots.push({ id: 's1', x: 0.3, y: 0.55 });   // Left
      slots.push({ id: 's2', x: 0.7, y: 0.55 });   // Right
    } else if (teamSize === 4) {
      // Ромб: 1-2-1
      slots.push({ id: 's0', x: 0.5, y: 0.8 });    // GK
      slots.push({ id: 's1', x: 0.3, y: 0.6 });    // Left
      slots.push({ id: 's2', x: 0.7, y: 0.6 });    // Right
      slots.push({ id: 's3', x: 0.5, y: 0.4 });    // Forward
    } else if (teamSize === 5) {
      // Пентагон: 1-2-2
      slots.push({ id: 's0', x: 0.5, y: 0.85 });   // GK
      slots.push({ id: 's1', x: 0.3, y: 0.65 });   // Left Def
      slots.push({ id: 's2', x: 0.7, y: 0.65 });   // Right Def
      slots.push({ id: 's3', x: 0.35, y: 0.4 });   // Left Fwd
      slots.push({ id: 's4', x: 0.65, y: 0.4 });   // Right Fwd
    } else {
      // Fallback для других размеров — равномерное распределение
      for (let i = 0; i < teamSize; i++) {
        const row = Math.floor(i / 3);
        const col = i % 3;
        const x = 0.25 + col * 0.25;
        const y = 0.8 - row * 0.25;
        slots.push({ id: `s${i}`, x, y });
      }
    }
    
    return {
      id: `dynamic_${teamSize}`,
      name: `Dynamic ${teamSize}`,
      teamSize: teamSize,
      slots,
      isCustom: false,
    };
  }

  /**
   * 🔥 ИЗМЕНЕНО: Получает команду игрока с поддержкой 3-5 юнитов
   */
  private getPlayerTeam(factionId: FactionId, teamSize: number): string[] {
    // ✅ TUTORIAL: Используем легендарные юниты для первого матча
    if (this.config.isTutorialMatch) {
      const legendaryUnits = TUTORIAL_LEGENDARY_UNITS[factionId];
      if (legendaryUnits && legendaryUnits.length >= teamSize) {
        // ✅ FIX: Проверяем что ВСЕ легендарные юниты существуют
        const validLegendary = legendaryUnits.slice(0, teamSize).filter(id => {
          const unit = getUnit(id);
          if (!unit) {
            console.warn(`[EntityFactory] ⚠️ Legendary unit not found: ${id}`);
            return false;
          }
          return true;
        });
        
        if (validLegendary.length === teamSize) {
          console.log(`[EntityFactory] 🎓 TUTORIAL MODE: Using legendary units for ${factionId}:`, validLegendary);
          return validLegendary;
        } else {
          console.warn(`[EntityFactory] ⚠️ Not enough valid legendary units for ${factionId}, falling back to starters`);
        }
      } else {
        console.warn(`[EntityFactory] ⚠️ No legendary units defined for ${factionId}, falling back to starters`);
      }
      
      // ✅ FIX: Fallback на стартовые юниты если легендарные недоступны
      const starters = STARTER_UNITS_BY_FACTION[factionId];
      if (starters) {
        const starterTeam = [starters.balanced, starters.tank, starters.sniper].slice(0, teamSize);
        console.log(`[EntityFactory] 🎓 TUTORIAL FALLBACK: Using starter units for ${factionId}:`, starterTeam);
        return starterTeam;
      }
    }
    
    // Обычная логика получения команды
    const savedTeam = playerData.getTeamUnits(factionId);
    
    if (savedTeam && savedTeam.length >= teamSize) {
      const teamSlice = savedTeam.slice(0, teamSize);
      const allValid = teamSlice.every(id => {
        const unit = getUnit(id);
        return unit && unit.factionId === factionId;
      });
      
      if (allValid) {
        console.log(`[EntityFactory] Using saved team for ${factionId}:`, teamSlice);
        return teamSlice;
      } else {
        console.warn(`[EntityFactory] Saved team invalid for ${factionId}, using default`);
      }
    }
    
    // Fallback на стартовые юниты
    const starters = STARTER_UNITS_BY_FACTION[factionId];
    if (!starters) {
      console.error(`[EntityFactory] ❌ No starter units for faction ${factionId}`);
      return [];
    }
    
    return [starters.balanced, starters.tank, starters.sniper].slice(0, teamSize);
  }

  /**
   * Роли по слотам: танк, универсал, снайпер, трикстер — без одинаковых «стартовых» клонов на высоких уровнях.
   */
  private pickAIRoleSlots(teamSize: number): CapClass[] {
    const cycle: CapClass[] = ['tank', 'balanced', 'sniper', 'trickster'];
    const roles: CapClass[] = [];
    for (let i = 0; i < teamSize; i++) {
      roles.push(cycle[i % cycle.length]);
    }
    return roles;
  }

  /**
   * ⭐ NEW: Выбирает команду AI в зависимости от сложности
   * easy: только базовые стартовые юниты
   * medium: может добавить некоторые Common юниты из 80 новых
   * hard: может добавить Rare/Epic юниты
   * impossible: может добавить Epic/Legendary юниты
   */
  private getAITeamForDifficulty(factionId: FactionId, teamSize: number, difficulty: AIDifficulty | undefined): string[] {
    if (!difficulty || difficulty === 'easy') {
      return this.getDefaultTeam(factionId, teamSize);
    }

    const rarityPool = this.getRarityPoolForDifficulty(difficulty);
    const factionUnits = UNITS_REPOSITORY.filter(u => u.factionId === factionId);
    const roles = this.pickAIRoleSlots(teamSize);
    const team: string[] = [];

    for (let i = 0; i < teamSize; i++) {
      const role = roles[i];
      const rarity = this.selectRarityFromPool(rarityPool);

      let candidates = factionUnits.filter(
        u => u.rarity === rarity && u.role === role && !team.includes(u.id)
      );

      if (candidates.length === 0) {
        candidates = factionUnits.filter(u => u.rarity === rarity && !team.includes(u.id));
      }

      if (candidates.length === 0) {
        const byRole = getUnitsByFactionAndRole(factionId, role).filter(u => !team.includes(u.id));
        candidates = byRole.length > 0 ? byRole : factionUnits.filter(u => !team.includes(u.id));
      }

      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        team.push(pick.id);
      } else {
        const fallback = this.getDefaultTeam(factionId, 1);
        team.push(fallback[0]);
      }
    }

    console.log(`[EntityFactory] 🎲 AI Team (${difficulty}, roles):`, team);
    return team;
  }

  /**
   * ⭐ NEW: Возвращает пул рарностей с вероятностями для сложности
   */
  private getRarityPoolForDifficulty(difficulty: AIDifficulty): { rarity: UnitRarity; weight: number }[] {
    switch (difficulty) {
      case 'easy':
        return [{ rarity: 'common', weight: 100 }];
      
      case 'medium':
        return [
          { rarity: 'common', weight: 60 },
          { rarity: 'rare', weight: 40 },
        ];
      
      case 'hard':
        return [
          { rarity: 'common', weight: 10 },
          { rarity: 'rare', weight: 50 },
          { rarity: 'epic', weight: 40 },
        ];
      
      case 'impossible':
        return [
          { rarity: 'rare', weight: 20 },
          { rarity: 'epic', weight: 50 },
          { rarity: 'legendary', weight: 30 },
        ];
      
      default:
        return [{ rarity: 'common', weight: 100 }];
    }
  }

  /**
   * ⭐ NEW: Выбирает рарность по весам
   */
  private selectRarityFromPool(pool: { rarity: UnitRarity; weight: number }[]): UnitRarity {
    const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const item of pool) {
      random -= item.weight;
      if (random <= 0) {
        return item.rarity;
      }
    }
    
    return pool[0].rarity; // Fallback
  }

  /**
   * 🔥 ИЗМЕНЕНО: Возвращает дефолтную команду нужного размера
   */
  private getDefaultTeam(factionId: FactionId, teamSize: number = 3): string[] {
    // Маппинг фракция → имена юнитов (из UnitsCatalog)
    const unitNames: Record<FactionId, { balanced: string; tank: string; sniper: string; trickster?: string; support?: string }> = {
      magma: { balanced: 'grunt', tank: 'titan', sniper: 'scout', trickster: 'grunt', support: 'grunt' },
      cyborg: { balanced: 'soldier', tank: 'mech', sniper: 'drone', trickster: 'soldier', support: 'soldier' },
      void: { balanced: 'initiate', tank: 'guardian', sniper: 'sniper', trickster: 'initiate', support: 'initiate' },
      insect: { balanced: 'drone', tank: 'brood', sniper: 'spitter', trickster: 'drone', support: 'drone' },
    };

    // ✅ ЗАЩИТА: Если factionId невалидный, используем magma по умолчанию
    const validFactionId = unitNames[factionId] ? factionId : 'magma';
    if (factionId !== validFactionId) {
      console.warn(`[EntityFactory] Invalid factionId "${factionId}", using "magma" as fallback`);
    }
    
    const names = unitNames[validFactionId];
    
    // Базовые 3 юнита
    const team: string[] = [
      `${validFactionId}_${names.balanced}`,  // balanced
      `${validFactionId}_${names.tank}`,       // tank
      `${validFactionId}_${names.sniper}`,     // sniper
    ];
    
    // ✅ Добавляем дополнительных юнитов для 4+ команды
    if (teamSize >= 4 && names.trickster) {
      team.push(`${validFactionId}_${names.trickster}`);
    }
    
    if (teamSize >= 5 && names.support) {
      team.push(`${validFactionId}_${names.support}`);
    }
    
    return team.slice(0, teamSize);
  }

  private createPvPCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const players = this.config.pvpData!.players;
    const hostPlayer = players.find((p) => p.playerIndex === 0)!;
    const guestPlayer = players.find((p) => p.playerIndex === 1)!;

    const mp = MultiplayerManager.getInstance();
    const myId = mp.getMyId();
    const isLocalHost = hostPlayer.id === myId;
    const isLocalGuest = guestPlayer.id === myId;

    const hostFormation = this.resolvePvPFormation(hostPlayer, isLocalHost);
    const guestFormation = this.resolvePvPFormation(guestPlayer, isLocalGuest);

    const hostFaction = (hostPlayer as any).factionId as FactionId | undefined;
    const guestFaction = (guestPlayer as any).factionId as FactionId | undefined;
    const pvpUseFactions = !!(hostFaction && guestFaction);

    if (pvpUseFactions) {
      return this.createPvPFactionCaps(
        hostPlayer,
        guestPlayer,
        hostFormation,
        guestFormation,
        hostFaction!,
        guestFaction!
      );
    } else {
      return this.createPvPMemeCaps(
        hostPlayer,
        guestPlayer,
        hostFormation,
        guestFormation
      );
    }
  }

  /**
   * 🔥 ИЗМЕНЕНО: PvP с поддержкой 3-5 юнитов
   */
  private createPvPFactionCaps(
    hostPlayer: PvPPlayer,
    guestPlayer: PvPPlayer,
    hostFormation: Formation,
    guestFormation: Formation,
    hostFaction: FactionId,
    guestFaction: FactionId
  ): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];

    // ✅ ИЗМЕНЕНО: Определяем размеры команд из данных игроков
    const hostTeamSize = (hostPlayer as any).teamSize || 3;
    const guestTeamSize = (guestPlayer as any).teamSize || 3;

    // Получаем команды (из данных игроков или дефолтные)
    const hostTeam: string[] = (hostPlayer as any).teamUnitIds || this.getDefaultTeam(hostFaction, hostTeamSize);
    const guestTeam: string[] = (guestPlayer as any).teamUnitIds || this.getDefaultTeam(guestFaction, guestTeamSize);

    // ✅ Получаем формации нужного размера
    const hostFormationSized = this.getFormationForSize(hostFormation, hostTeamSize);
    const guestFormationSized = this.getFormationForSize(guestFormation, guestTeamSize);

    console.log(`[EntityFactory] PvP Host team (${hostTeamSize}):`, hostTeam);
    console.log(`[EntityFactory] PvP Guest team (${guestTeamSize}):`, guestTeam);

    // Host units
    for (let i = 0; i < hostTeamSize; i++) {
      const slot = hostFormationSized.slots[i] || { x: 0.25 + (i % 3) * 0.25, y: 0.8 - Math.floor(i / 3) * 0.2 };
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      
      const unitId = hostTeam[i];
      // ✅ FIX: Ищем юнит сначала в UNITS_CATALOG, потом в UNITS_REPOSITORY
      let unitData = getUnit(unitId);
      if (!unitData) {
        const repoUnit = getRepositoryUnit(unitId);
        if (repoUnit) {
          unitData = {
            id: repoUnit.id,
            assetKey: repoUnit.assetKey,
            assetPath: repoUnit.assetPath,
            capClass: repoUnit.role as CapClass,
            factionId: repoUnit.factionId,
            name: repoUnit.name,
            title: repoUnit.title,
            rarity: repoUnit.rarity,
            isStarter: repoUnit.isStarter || false,
            description: repoUnit.description,
            stats: repoUnit.stats,
            price: { coins: 0, crystals: 0 },
          };
        }
      }
      const unitClass: CapClass = unitData?.capClass || 'balanced';

      console.log(`[EntityFactory] PvP Host unit ${i}: ${unitId} → ${unitData?.assetKey || 'FALLBACK'}`);

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `host_${i}`,
        this.config.fieldScale,
        {
          factionId: hostFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: this.config.isHost,
          unitId: unitId,
        }
      );
      caps.push(unit as any);
      startPositions.push(absPos);
    }

    // Guest units
    for (let i = 0; i < guestTeamSize; i++) {
      const slot = guestFormationSized.slots[i] || { x: 0.25 + (i % 3) * 0.25, y: 0.8 - Math.floor(i / 3) * 0.2 };
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      
      const unitId = guestTeam[i];
      // ✅ FIX: Ищем юнит сначала в UNITS_CATALOG, потом в UNITS_REPOSITORY
      let unitData = getUnit(unitId);
      if (!unitData) {
        const repoUnit = getRepositoryUnit(unitId);
        if (repoUnit) {
          unitData = {
            id: repoUnit.id,
            assetKey: repoUnit.assetKey,
            assetPath: repoUnit.assetPath,
            capClass: repoUnit.role as CapClass,
            factionId: repoUnit.factionId,
            name: repoUnit.name,
            title: repoUnit.title,
            rarity: repoUnit.rarity,
            isStarter: repoUnit.isStarter || false,
            description: repoUnit.description,
            stats: repoUnit.stats,
            price: { coins: 0, crystals: 0 },
          };
        }
      }
      const unitClass: CapClass = unitData?.capClass || 'balanced';

      console.log(`[EntityFactory] PvP Guest unit ${i}: ${unitId} → ${unitData?.assetKey || 'FALLBACK'}`);

      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `guest_${i}`,
        this.config.fieldScale,
        {
          factionId: guestFaction,
          capClass: unitClass,
          applyFactionStats: true,
          applyUpgrades: !this.config.isHost,
          unitId: unitId,
        }
      );
      caps.push(unit as any);
      startPositions.push(absPos);
    }

    return { caps, startPositions };
  }

  private createPvPMemeCaps(
    hostPlayer: PvPPlayer,
    guestPlayer: PvPPlayer,
    hostFormation: Formation,
    guestFormation: Formation
  ): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];

    const mp = MultiplayerManager.getInstance();
    const myId = mp.getMyId();
    const isLocalHost = hostPlayer.id === myId;
    const isLocalGuest = guestPlayer.id === myId;

    const hostCapIds = this.resolvePvPTeamCapIds(hostPlayer, isLocalHost);
    const guestCapIds = this.resolvePvPTeamCapIds(guestPlayer, isLocalGuest);
    const hostCapUpgrades = (hostPlayer as any).capUpgrades || {};
    const guestCapUpgrades = (guestPlayer as any).capUpgrades || {};

    // Host caps
    const hostSlots = hostFormation?.slots || [];
    for (let i = 0; i < 3; i++) {
      const slot = hostSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const capId = hostCapIds[i] || 'meme_doge';
      const isMyTeam = this.config.isHost;
      const customUpgrades = isMyTeam ? undefined : hostCapUpgrades[capId];

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `host_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: isMyTeam, customUpgrades }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    }

    // Guest caps
    const guestSlots = guestFormation?.slots || hostSlots;
    for (let i = 0; i < 3; i++) {
      const slot = guestSlots[i] || { x: 0.25 + i * 0.25, y: 0.8 };
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const capId = guestCapIds[i] || 'meme_doge';
      const isMyTeam = !this.config.isHost;
      const customUpgrades = isMyTeam ? undefined : guestCapUpgrades[capId];

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `guest_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: isMyTeam, customUpgrades }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    }

    return { caps, startPositions };
  }

  private resolvePvPFormation(player: PvPPlayer, isLocalPlayer: boolean): Formation {
    if (player.formation) {
      return player.formation as Formation;
    }

    if (isLocalPlayer) {
      return playerData.getSelectedFormation();
    }

    return DEFAULT_FORMATIONS[0];
  }

  private resolvePvPTeamCapIds(player: PvPPlayer, isLocalPlayer: boolean): string[] {
    if (isLocalPlayer) {
      const localTeam = playerData.getTeamCapIds();
      if (localTeam?.length) {
        if (player.teamCapIds && player.teamCapIds.join('|') !== localTeam.join('|')) {
          console.log('[EntityFactory] PvP local teamCapIds override:', localTeam);
        }
        return localTeam.slice(0, 3);
      }
    }

    if (player.teamCapIds?.length) {
      return player.teamCapIds.slice(0, 3);
    }

    if (player.capSkin) {
      return [player.capSkin, player.capSkin, player.capSkin];
    }

    return ['meme_doge', 'meme_gigachad', 'meme_doge'];
  }

  private createOfflineCaps(): { caps: GameUnit[]; startPositions: { x: number; y: number }[] } {
    const caps: GameUnit[] = [];
    const startPositions: { x: number; y: number }[] = [];
    const formation = this.config.formation;
    const teamCapIds = playerData.getTeamCapIds();

    console.log('[EntityFactory] Offline caps team:', teamCapIds);

    // Player caps
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, slot.y);
      const capId = teamCapIds[i] || 'meme_doge';

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,
        `p1_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: true }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    });

    // AI caps
    const aiCapIds = ['meme_doge', 'meme_gigachad', 'meme_doge'];
    formation.slots.forEach((slot, i) => {
      const absPos = this.relativeToAbsolute(slot.x, 1 - slot.y);
      const capId = aiCapIds[i] || 'meme_doge';

      const cap = new Cap(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,
        `p2_${i}`,
        capId,
        this.config.fieldScale,
        { applyUpgrades: false }
      );
      caps.push(cap as any);
      startPositions.push(absPos);
    });

    return { caps, startPositions };
  }

  private relativeToAbsolute(relX: number, relY: number): { x: number; y: number } {
    return {
      x: this.config.fieldBounds.left + this.config.fieldBounds.width * relX,
      y: this.config.fieldBounds.top + this.config.fieldBounds.height * relY,
    };
  }

  /**
   * Создать сущности для обучения
   * Создаёт юнитов всех трёх классов для игрока и ИИ
   */
  public createTutorialEntities(
    playerFaction: FactionId,
    opponentFaction: FactionId
  ): { playerUnits: GameUnit[]; aiUnits: GameUnit[]; ball: Ball } {
    console.log('[EntityFactory] Creating tutorial entities');
    
    const playerUnits: GameUnit[] = [];
    const aiUnits: GameUnit[] = [];
    
    // ═══════════════════════════════════════════════════════════════
    // ЮНИТЫ ИГРОКА: tank, sniper, balanced
    // ═══════════════════════════════════════════════════════════════
    
    const playerClasses: Array<'tank' | 'sniper' | 'balanced'> = ['tank', 'sniper', 'balanced'];
    const playerPositions = [
      { x: 0.2, y: 0.3 },   // tank
      { x: 0.2, y: 0.5 },   // sniper
      { x: 0.2, y: 0.7 },   // balanced
    ];
    
    playerClasses.forEach((unitClass, index) => {
      const pos = playerPositions[index];
      const absPos = this.relativeToAbsolute(pos.x, pos.y);
      const unitId = this.getUnitIdByFactionAndClass(playerFaction, unitClass);
      
      console.log(`[EntityFactory] Creating player ${unitClass}: ${unitId} at (${absPos.x.toFixed(0)}, ${absPos.y.toFixed(0)})`);
      
      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        1 as PlayerNumber,  // owner = 1 (player)
        unitId,
        this.config.fieldScale,
        {
          factionId: playerFaction,
          capClass: unitClass,
          applyFactionStats: true,
          unitId: unitId
        }
      );
      
      playerUnits.push(unit as any);
    });
    
    // ═══════════════════════════════════════════════════════════════
    // ЮНИТЫ ИИ: один снайпер для демонстрации атаки
    // ═══════════════════════════════════════════════════════════════
    
    const aiClasses: Array<'tank' | 'sniper' | 'balanced'> = ['sniper'];
    const aiPositions = [
      { x: 0.8, y: 0.5 },   // sniper
    ];
    
    aiClasses.forEach((unitClass, index) => {
      const pos = aiPositions[index];
      const absPos = this.relativeToAbsolute(pos.x, pos.y);
      const unitId = this.getUnitIdByFactionAndClass(opponentFaction, unitClass);
      
      console.log(`[EntityFactory] Creating AI ${unitClass}: ${unitId} at (${absPos.x.toFixed(0)}, ${absPos.y.toFixed(0)})`);
      
      const unit = new Unit(
        this.config.scene,
        absPos.x,
        absPos.y,
        2 as PlayerNumber,  // owner = 2 (AI)
        unitId,
        this.config.fieldScale,
        {
          factionId: opponentFaction,
          capClass: unitClass,
          applyFactionStats: true,
          unitId: unitId
        }
      );
      
      aiUnits.push(unit as any);
    });
    
    // ═══════════════════════════════════════════════════════════════
    // МЯЧ
    // ═══════════════════════════════════════════════════════════════
    
    const ballPos = this.relativeToAbsolute(0.5, 0.5);  // Центр поля
    const ball = new Ball(
      this.config.scene, 
      ballPos.x, 
      ballPos.y, 
      BALL.RADIUS * this.config.fieldScale
    );
    
    console.log(`[EntityFactory] Tutorial entities created: ${playerUnits.length} player, ${aiUnits.length} AI`);
    
    return { playerUnits, aiUnits, ball };
  }

  /**
   * Получить ID юнита по фракции и классу
   */
  private getUnitIdByFactionAndClass(faction: FactionId, unitClass: 'tank' | 'sniper' | 'balanced'): string {
    // Маппинг классов на юнитов для каждой фракции
    const factionUnits: Record<FactionId, Record<string, string>> = {
      magma: {
        tank: 'magma_basalt_guard',
        sniper: 'magma_inferno_shooter', 
        balanced: 'magma_ember_striker'
      },
      cyborg: {
        tank: 'cyborg_heavy_mech',
        sniper: 'cyborg_railgunner',
        balanced: 'cyborg_soldier'
      },
      void: {
        tank: 'void_abyssal_guardian',
        sniper: 'void_shadow_sniper',
        balanced: 'void_phantom'
      },
      insect: {
        tank: 'insect_beetle_tank',
        sniper: 'insect_mantis_striker',
        balanced: 'insect_worker'
      }
    };
    
    const factionMap = factionUnits[faction];
    if (!factionMap) {
      console.warn(`[EntityFactory] Unknown faction: ${faction}, using magma`);
      return factionUnits.magma[unitClass];
    }
    
    const unitId = factionMap[unitClass];
    if (!unitId) {
      console.warn(`[EntityFactory] Unknown class: ${unitClass} for faction ${faction}`);
      return factionMap.balanced;  // Fallback to balanced
    }
    
    // Проверяем что юнит существует
    const unitData = getUnit(unitId);
    if (!unitData) {
      // Fallback на стартовые юниты
      const starters = STARTER_UNITS_BY_FACTION[faction];
      if (starters) {
        switch (unitClass) {
          case 'tank': return starters.tank;
          case 'sniper': return starters.sniper;
          case 'balanced': return starters.balanced;
        }
      }
      console.warn(`[EntityFactory] Unit ${unitId} not found, using fallback`);
      return factionMap.balanced;
    }
    
    return unitId;
  }
}