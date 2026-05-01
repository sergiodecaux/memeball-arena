// src/data/OffersManager.ts
import { FactionId, FACTION_IDS, getFactionPrice } from '../constants/gameConstants';
import { getUnitsByFaction, getStarterUnits, UnitData } from './UnitsCatalog';
import { getStarterUnitsFromRepository, getPremiumUnits, getPremiumUnitById, UnitData as RepoUnitData, getDisplayName } from './UnitsRepository'; // ✅ НОВОЕ: Стартовые из репозитория
import { mergeUnitDisplay } from './unitDisplayOverrides';
import { playerData } from './PlayerData';

export type OfferType = 
  | 'faction' 
  | 'faction_pack'        // Пакет фракции (юниты из UnitsRepository)
  | 'unit_pack' 
  | 'starter_bundle' 
  | 'daily_deal' 
  | 'unit'
  | 'galaxy_starter'      // Стартовый набор для новичков
  | 'elite_squad'         // Элитный отряд
  | 'faction_mastery'     // Мастерство фракции
  | 'weekend_special'     // Выходной спецпредложение
  | 'legendary_drop'      // Легендарный дроп
  | 'season_pass_bonus';  // Бонус сезонного пропуска

export interface SpecialOffer {
  id: string;
  type: OfferType;
  title: string;
  subtitle: string;
  description: string;
  
  factionId?: FactionId;
  unitIds?: string[];
  
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  
  createdAt: number;
  expiresAt: number;
  
  accentColor: number;
  heroKey?: string;
  bgKey?: string;
  
  priority: number;
  minimized: boolean;
}

const STORAGE_KEY = 'memeball_offers';
const OFFER_DURATION = 24 * 60 * 60 * 1000;
const AUTO_POPUP_COOLDOWN = 6 * 60 * 60 * 1000; // 6 hours

// Стартовые юниты - исключаются из магазина
const STARTER_UNIT_IDS = new Set([
  'magma_grunt', 'magma_titan', 'magma_scout', 'magma_inferno',
  'cyborg_soldier', 'cyborg_mech', 'cyborg_drone', 'cyborg_glitch',
  'void_initiate', 'void_guardian', 'void_sniper', 'void_bender',
  'insect_drone', 'insect_brood', 'insect_spitter', 'insect_mimic',
]);

// Предопределённые интересные офферы (никогда не будут пустыми)
const PREDEFINED_OFFERS: Omit<SpecialOffer, 'id' | 'createdAt' | 'expiresAt'>[] = [
  // ═══════════════════════════════════════════════════════════════
  // СТАРТОВЫЕ ПАКИ (ОТКЛЮЧЕНЫ - стартовые юниты выдаются бесплатно)
  // ═══════════════════════════════════════════════════════════════
  // {
  //   type: 'galaxy_starter',
  //   title: 'GALAXY STARTER PACK',
  //   subtitle: 'Начни своё путешествие',
  //   description: '3 элитных юнита + 500 монет + 50 кристаллов. Идеально для новых командиров!',
  //   unitIds: ['magma_grunt', 'cyborg_soldier', 'void_phantom'],
  //   originalPrice: 999,
  //   discountedPrice: 299,
  //   discountPercent: 70,
  //   accentColor: 0xFFD700,
  //   heroKey: 'starter_pack_hero',
  //   bgKey: 'offer_bg_galaxy',
  //   priority: 100,
  //   minimized: false,
  // },
  // {
  //   type: 'elite_squad',
  //   title: 'ELITE SQUAD BUNDLE',
  //   subtitle: 'Доминируй на арене',
  //   description: '5 редких юнитов из всех фракций + эксклюзивный титул "Commander"',
  //   unitIds: ['magma_titan', 'cyborg_mech', 'void_reaper', 'insect_queen', 'magma_inferno'],
  //   originalPrice: 1999,
  //   discountedPrice: 799,
  //   discountPercent: 60,
  //   accentColor: 0x9400D3,
  //   heroKey: 'elite_squad_hero',
  //   bgKey: 'offer_bg_elite',
  //   priority: 95,
  //   minimized: false,
  // },
  // {
  //   type: 'starter_bundle',
  //   title: 'ROOKIE KICKOFF',
  //   subtitle: 'Первый удар',
  //   description: 'Всё для старта: 2 юнита + 300 монет + обучение пройдено = бонус!',
  //   unitIds: ['magma_grunt', 'cyborg_soldier'],
  //   originalPrice: 499,
  //   discountedPrice: 99,
  //   discountPercent: 80,
  //   accentColor: 0x00FF88,
  //   priority: 98,
  //   minimized: false,
  // },
  
  // ═══════════════════════════════════════════════════════════════
  // ФРАКЦИОННЫЕ ПАКИ
  // ═══════════════════════════════════════════════════════════════
  // {
  //   type: 'faction_mastery',
  //   title: 'MAGMA INFERNO PACK',
  //   subtitle: 'Власть вулкана',
  //   description: 'Полный состав Magma Brutes: 4 юнита + скин "Лавовый мяч" + эффект огненного следа',
  //   factionId: 'magma',
  //   unitIds: ['magma_grunt', 'magma_titan', 'magma_inferno', 'magma_scout'],
  //   originalPrice: 1499,
  //   discountedPrice: 599,
  //   discountPercent: 60,
  //   accentColor: 0xFF4500,
  //   heroKey: 'faction_magma_hero',
  //   bgKey: 'faction_magma_bg_far',
  //   priority: 85,
  //   minimized: false,
  // },
  // {
  //   type: 'faction_mastery',
  //   title: 'CYBER PROTOCOL PACK',
  //   subtitle: 'Технологическое превосходство',
  //   description: 'Полный отряд Terran Cyborgs: 4 юнита + скин "Неоновый мяч" + эффект цепей',
  //   factionId: 'cyborg',
  //   unitIds: ['cyborg_soldier', 'cyborg_mech', 'cyborg_drone', 'cyborg_glitch'],
  //   originalPrice: 1499,
  //   discountedPrice: 599,
  //   discountPercent: 60,
  //   accentColor: 0x00E5FF,
  //   heroKey: 'faction_cyber_hero',
  //   bgKey: 'faction_cyber_bg_far',
  //   priority: 84,
  //   minimized: false,
  // },
  {
    type: 'faction_pack',
    title: 'VOID COLLECTIVE',
    subtitle: 'Mysteries of the Void',
    description: 'Unlock powerful Void units',
    factionId: 'void',
    unitIds: ['void_duskblade', 'void_abyssal', 'void_nightfall', 'void_mindbend'],
    originalPrice: 3000,
    discountedPrice: 2400,
    discountPercent: 20,
    accentColor: 0xbc13fe,
    priority: 5,
    minimized: false,
  },
  {
    type: 'faction_pack',
    title: 'INSECT SWARM',
    subtitle: 'Join the Hive',
    description: 'Unlock powerful Insect units',
    factionId: 'insect',
    unitIds: ['insect_scuttle', 'insect_carapace', 'insect_venom', 'insect_changeling'],
    originalPrice: 3000,
    discountedPrice: 2400,
    discountPercent: 20,
    accentColor: 0x39ff14,
    priority: 5,
    minimized: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // ЕЖЕДНЕВНЫЕ И СПЕЦИАЛЬНЫЕ
  // ═══════════════════════════════════════════════════════════════
  {
    type: 'daily_deal',
    title: 'DAILY POWER BOOST',
    subtitle: 'Только 24 часа!',
    description: '200 монет + 20 кристаллов + случайный редкий юнит',
    originalPrice: 499,
    discountedPrice: 149,
    discountPercent: 70,
    accentColor: 0xFFAA00,
    priority: 75,
    minimized: true,
  },
  {
    type: 'daily_deal',
    title: 'COIN RUSH',
    subtitle: 'Золотая лихорадка',
    description: '1000 монет по цене 500! Удвой свой капитал',
    originalPrice: 500,
    discountedPrice: 250,
    discountPercent: 50,
    accentColor: 0xFFD700,
    priority: 70,
    minimized: true,
  },
  {
    type: 'weekend_special',
    title: 'WEEKEND WARRIOR',
    subtitle: 'Выходной боец',
    description: 'Бустер двойного опыта (48ч) + 1000 монет + 2 премиум сундука',
    originalPrice: 2499,
    discountedPrice: 999,
    discountPercent: 60,
    accentColor: 0xFF6B6B,
    priority: 90,
    minimized: false,
  },
  {
    type: 'legendary_drop',
    title: 'LEGENDARY CHAMPION',
    subtitle: 'Раз в жизни',
    description: 'Гарантированный ЛЕГЕНДАРНЫЙ юнит + 100 кристаллов + эксклюзивная рамка аватара',
    originalPrice: 4999,
    discountedPrice: 1999,
    discountPercent: 60,
    accentColor: 0xFFD700,
    heroKey: 'legendary_hero',
    priority: 99,
    minimized: false,
  },
  {
    type: 'season_pass_bonus',
    title: 'SEASON BOOST PACK',
    subtitle: 'Поднимайся быстрее',
    description: '+50% очков лиги на 7 дней + 3 щита защиты звёзд',
    originalPrice: 799,
    discountedPrice: 399,
    discountPercent: 50,
    accentColor: 0x4ECDC4,
    priority: 80,
    minimized: true,
  },
  // {
  //   type: 'unit_pack',
  //   title: 'MIXED FORCES',
  //   subtitle: 'Разнообразие — ключ к победе',
  //   description: 'По одному юниту из каждой фракции. Собери сбалансированную команду!',
  //   unitIds: ['magma_grunt', 'cyborg_soldier', 'void_phantom', 'insect_drone'],
  //   originalPrice: 1200,
  //   discountedPrice: 449,
  //   discountPercent: 63,
  //   accentColor: 0xFF69B4,
  //   priority: 78,
  //   minimized: false,
  // },
  {
    type: 'starter_bundle',
    title: 'CRYSTAL SURGE',
    subtitle: 'Кристальный поток',
    description: '150 кристаллов + бонус 30 кристаллов бесплатно!',
    originalPrice: 599,
    discountedPrice: 349,
    discountPercent: 42,
    accentColor: 0x00FFFF,
    priority: 65,
    minimized: true,
  },
];

// Локальный хелпер для поиска юнита по ID
function findUnitById(unitId: string): UnitData | undefined {
  for (const factionId of FACTION_IDS) {
    const units = getUnitsByFaction(factionId);
    const found = units.find(u => u.id === unitId);
    if (found) return found;
  }
  return undefined;
}

class OffersManagerClass {
  private offers: SpecialOffer[] = [];
  private lastShownOfferTime: number = 0;
  private lastAutoPopupAt: number = 0;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        this.offers = data.offers || [];
        this.lastShownOfferTime = data.lastShownOfferTime || 0;
        this.lastAutoPopupAt = data.lastAutoPopupAt || 0;
        this.cleanupExpired();
      }
    } catch (e) {
      // silent
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        offers: this.offers,
        lastShownOfferTime: this.lastShownOfferTime,
        lastAutoPopupAt: this.lastAutoPopupAt,
      }));
    } catch (e) {
      // silent
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.offers = this.offers.filter(o => o.expiresAt > now);
    this.save();
  }

  generateOffers(): void {
    this.cleanupExpired();

    const selectedFaction = playerData.getFaction();
    const ownedFactions = playerData.getOwnedFactions();
    const unownedFactions = FACTION_IDS.filter(f => !ownedFactions.includes(f) && f !== selectedFaction);

    // Create 1 faction offer (excluding selected faction)
    if (unownedFactions.length > 0 && !this.hasOfferOfType('faction')) {
      const randomFaction = this.pickRandom(unownedFactions);
      this.createFactionOffer(randomFaction);
    }

    // Create up to 2 unit pack offers for selected faction
    if (selectedFaction) {
      const unownedUnits = this.getUnownedUnits(selectedFaction);
      const existingUnitPacks = this.offers.filter(o => o.type === 'unit_pack' && o.factionId === selectedFaction);
      
      if (unownedUnits.length >= 2 && existingUnitPacks.length === 0) {
        this.createUnitPackOffer(selectedFaction, unownedUnits.slice(0, 2));
      }
      
      if (unownedUnits.length >= 4 && existingUnitPacks.length === 1) {
        const usedUnitIds = new Set(existingUnitPacks.flatMap(o => o.unitIds || []));
        const availableUnits = unownedUnits.filter(u => !usedUnitIds.has(u.id));
        if (availableUnits.length >= 2) {
          this.createUnitPackOffer(selectedFaction, availableUnits.slice(0, 2));
        }
      }
    }

    // Ensure we have at least 3 active offers (use fallback if needed)
    const activeOffers = this.offers.filter(o => !o.minimized);
    if (activeOffers.length < 3) {
      const needed = 3 - activeOffers.length;
      for (let i = 0; i < needed; i++) {
        this.createDailyDealOffer();
      }
    }

    this.save();
  }

  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  private hasOfferOfType(type: OfferType): boolean {
    return this.offers.some(o => o.type === type);
  }

  private getUnownedUnits(factionId: FactionId): UnitData[] {
    const allUnits = getUnitsByFaction(factionId);
    const ownedUnits = playerData.getOwnedUnits(factionId);
    const ownedIds = new Set(ownedUnits.map(u => u.id));
    
    return allUnits.filter(u => 
      !ownedIds.has(u.id) && 
      !u.isStarter &&
      !STARTER_UNIT_IDS.has(u.id)  // Исключить стартовые
    );
  }

  private createFactionOffer(factionId: FactionId): void {
    const now = Date.now();
    const price = getFactionPrice(factionId);
    const originalPrice = price.coins || 15000;
    const discountPercent = 20 + Math.floor(Math.random() * 16);
    const discountedPrice = Math.floor(originalPrice * (1 - discountPercent / 100));

    const factionInfo: Record<FactionId, { name: string; color: number; heroKey: string; bgKey: string }> = {
      magma: { name: 'Magma Brutes', color: 0xff4500, heroKey: 'faction_magma_hero', bgKey: 'faction_magma_bg_full' },
      cyborg: { name: 'Terran Cyborgs', color: 0x00f2ff, heroKey: 'faction_cyber_hero', bgKey: 'faction_cyber_bg_full' },
      void: { name: 'Void Walkers', color: 0x9d00ff, heroKey: 'faction_void_hero', bgKey: 'faction_void_bg_full' },
      insect: { name: 'Xeno Swarm', color: 0x39ff14, heroKey: 'faction_terran_hero', bgKey: 'faction_terran_bg_full' },
    };

    const info = factionInfo[factionId];

    const offer: SpecialOffer = {
      id: `faction_${factionId}_${now}`,
      type: 'faction',
      title: '🛸 NEW FACTION',
      subtitle: info.name.toUpperCase(),
      description: `Unlock ${info.name} faction with starter unit!`,
      factionId,
      originalPrice,
      discountedPrice,
      discountPercent,
      createdAt: now,
      expiresAt: now + OFFER_DURATION,
      accentColor: info.color,
      heroKey: info.heroKey,
      bgKey: info.bgKey,
      priority: 100,
      minimized: false,
    };

    this.offers.push(offer);
  }

  private createUnitPackOffer(factionId: FactionId, units: UnitData[]): void {
    const now = Date.now();
    const originalPrice = units.reduce((sum, u) => sum + (u.price.coins || 0), 0);
    const discountPercent = 25;
    const discountedPrice = Math.floor(originalPrice * (1 - discountPercent / 100));

    const factionColors: Record<FactionId, number> = {
      magma: 0xff4500,
      cyborg: 0x00f2ff,
      void: 0x9d00ff,
      insect: 0x39ff14,
    };

    const offer: SpecialOffer = {
      id: `unit_pack_${factionId}_${now}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'unit_pack',
      title: '⚡ UNIT PACK',
      subtitle: `${units.length} UNITS`,
      description: units.map(u => u.name).join(' + '),
      factionId,
      unitIds: units.map(u => u.id),
      originalPrice,
      discountedPrice,
      discountPercent,
      createdAt: now,
      expiresAt: now + OFFER_DURATION,
      accentColor: factionColors[factionId],
      priority: 50,
      minimized: false,
    };

    this.offers.push(offer);
  }

  private createDailyDealOffer(): void {
    const now = Date.now();
    const originalPrice = 5000 + Math.floor(Math.random() * 5000);
    const discountPercent = 30 + Math.floor(Math.random() * 20);
    const discountedPrice = Math.floor(originalPrice * (1 - discountPercent / 100));

    const offer: SpecialOffer = {
      id: `daily_deal_${now}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'daily_deal',
      title: '💰 DAILY DEAL',
      subtitle: 'COINS BUNDLE',
      description: 'Limited time coins bundle at a special price!',
      originalPrice,
      discountedPrice,
      discountPercent,
      createdAt: now,
      expiresAt: now + OFFER_DURATION,
      accentColor: 0xffd700,
      priority: 25,
      minimized: false,
    };

    this.offers.push(offer);
  }

  getBestOffer(): SpecialOffer | null {
    this.cleanupExpired();
    const validOffers = this.offers
      .filter(o => !o.minimized)
      .sort((a, b) => b.priority - a.priority);
    return validOffers[0] || null;
  }

  getBestAutoPopupOffer(): SpecialOffer | null {
    this.cleanupExpired();
    const validOffers = this.offers
      .filter(o => !o.minimized)
      .sort((a, b) => b.priority - a.priority);
    return validOffers[0] || null;
  }

  isAutoPopupAllowed(): boolean {
    const now = Date.now();
    return (now - this.lastAutoPopupAt) >= AUTO_POPUP_COOLDOWN;
  }

  markAutoPopupShown(): void {
    this.lastAutoPopupAt = Date.now();
    this.save();
  }

  getHubOffers(): SpecialOffer[] {
    this.cleanupExpired();
    const selectedFaction = playerData.getFaction();
    const ownedFactions = playerData.getOwnedFactions();
    const unownedFactions = FACTION_IDS.filter(f => !ownedFactions.includes(f) && f !== selectedFaction);

    const result: SpecialOffer[] = [];

    // Slot 1: Faction offer (unowned, excluding selected)
    const factionOffer = this.offers.find(o => 
      o.type === 'faction' && 
      o.factionId && 
      unownedFactions.includes(o.factionId)
    );
    if (factionOffer) {
      result.push(factionOffer);
    }

    // Slots 2-3: Unit packs for selected faction
    if (selectedFaction) {
      const unitPacks = this.offers
        .filter(o => o.type === 'unit_pack' && o.factionId === selectedFaction)
        .slice(0, 2);
      result.push(...unitPacks);
    }

    // Fill remaining slots with fallback offers
    const activeOffers = this.offers.filter(o => !o.minimized && !result.includes(o));
    const fallbackOffers = activeOffers
      .filter(o => o.type === 'daily_deal' || o.type === 'starter_bundle')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3 - result.length);
    
    result.push(...fallbackOffers);

    // If still not enough, create fallback offers on the fly
    while (result.length < 3) {
      this.createDailyDealOffer();
      const newOffer = this.offers[this.offers.length - 1];
      if (newOffer && !result.includes(newOffer)) {
        result.push(newOffer);
      } else {
        break; // Prevent infinite loop
      }
    }

    return result.slice(0, 3);
  }

  getMinimizedOffers(): SpecialOffer[] {
    this.cleanupExpired();
    return this.offers.filter(o => o.minimized);
  }

  getAllOffers(): SpecialOffer[] {
    this.cleanupExpired();
    return [...this.offers];
  }

  getActiveOffers(): SpecialOffer[] {
    const now = Date.now();
    
    // Фильтруем просроченные
    this.offers = this.offers.filter(o => o.expiresAt > now);
    
    // Если офферов мало — генерируем из предопределённых
    if (this.offers.length < 3) {
      this.generatePredefinedOffers();
    }
    
    // Сортируем по приоритету
    return [...this.offers].sort((a, b) => b.priority - a.priority);
  }

  private generatePredefinedOffers(): void {
    const now = Date.now();
    const playerLevel = (playerData.get().level || 1);
    const data = playerData.get();
    const ownedUnits: string[] = [];
    
    // Собираем все ID юнитов из всех фракций
    Object.values(data.ownedUnits || {}).forEach((factionUnits: any[]) => {
      factionUnits.forEach((unit: any) => {
        if (unit.id && !ownedUnits.includes(unit.id)) {
          ownedUnits.push(unit.id);
        }
      });
    });
    
    // Выбираем подходящие офферы в зависимости от уровня игрока
    const suitableOffers = PREDEFINED_OFFERS.filter(offer => {
      // Стартовые паки только для новичков (уровень < 5)
      if (offer.type === 'galaxy_starter' && playerLevel >= 5) return false;
      if (offer.type === 'starter_bundle' && offer.title === 'ROOKIE KICKOFF' && playerLevel >= 3) return false;
      
      // Легендарные только для опытных (уровень >= 10)
      if (offer.type === 'legendary_drop' && playerLevel < 10) return false;
      
      // Выходные только по выходным
      if (offer.type === 'weekend_special' && !this.isWeekend()) return false;
      
      // Не показываем паки, если все юниты уже есть
      if (offer.unitIds && offer.unitIds.length > 0) {
        const allOwned = offer.unitIds.every(id => ownedUnits.includes(id));
        if (allOwned) return false;
      }
      
      return true;
    });
    
    // Берём 2-4 случайных оффера
    const shuffled = suitableOffers.sort(() => Math.random() - 0.5);
    const count = Math.min(4, Math.max(2, shuffled.length));
    const toAdd = shuffled.slice(0, count);
    
    toAdd.forEach((template, index) => {
      // Определяем длительность в зависимости от типа
      let duration = OFFER_DURATION; // 24 часа по умолчанию
      if (template.type === 'weekend_special') duration = 48 * 60 * 60 * 1000;
      if (template.type === 'legendary_drop') duration = 12 * 60 * 60 * 1000;
      if (template.type === 'daily_deal') duration = 24 * 60 * 60 * 1000;
      
      const offer: SpecialOffer = {
        ...template,
        id: `offer_${now}_${index}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        expiresAt: now + duration,
      };
      
      // Не добавляем дубликаты по названию
      if (!this.offers.find(o => o.title === offer.title)) {
        this.offers.push(offer);
      }
    });
    
    this.save();
  }

  private isWeekend(): boolean {
    const day = new Date().getDay();
    return day === 0 || day === 6; // воскресенье или суббота
  }

  // Метод для принудительного обновления офферов (для тестирования)
  forceRefreshOffers(): void {
    this.offers = [];
    this.generatePredefinedOffers();
  }

  minimizeOffer(offerId: string): void {
    const offer = this.offers.find(o => o.id === offerId);
    if (offer) {
      offer.minimized = true;
      this.save();
    }
  }

  expandOffer(offerId: string): void {
    const offer = this.offers.find(o => o.id === offerId);
    if (offer) {
      offer.minimized = false;
      this.save();
    }
  }

  getOfferUnits(offer: SpecialOffer): UnitData[] {
    if (!offer.unitIds) return [];
    return offer.unitIds
      .map(id => findUnitById(id))
      .filter((u): u is UnitData => u !== undefined);
  }

  claimOffer(offerId: string): boolean {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return false;

    const data = playerData.get();
    
    // ✅ НОВОЕ: Обработка премиум юнитов (кристаллы)
    if (offer.type === 'unit' && offer.unitIds && offer.unitIds.length > 0) {
      const unitId = offer.unitIds[0];
      const premiumUnit = getPremiumUnitById(unitId);
      if (!premiumUnit) return false;
      
      // Проверка кристаллов
      if (data.crystals < offer.discountedPrice) return false;
      if (!playerData.spendCrystals(offer.discountedPrice)) return false;
      
      // Разблокируем премиум юнит
      playerData.unlockUnit(unitId);
      
      // Добавляем в ownedUnits фракции для использования в команде
      const factionId = premiumUnit.factionId;
      if (!data.ownedUnits[factionId]) {
        data.ownedUnits[factionId] = [];
      }
      if (!data.ownedUnits[factionId].some(u => u.id === unitId)) {
        data.ownedUnits[factionId].push({
          id: unitId,
          unlockedAt: Date.now(),
          upgrades: { power: 1, mass: 1, aim: 1, technique: 1 },
        });
      }
      playerData.save();
      
      this.offers = this.offers.filter(o => o.id !== offerId);
      this.lastShownOfferTime = Date.now();
      this.save();
      return true;
    }
    
    // Обычные предложения (монеты)
    if (data.coins < offer.discountedPrice) return false;
    if (!playerData.spendCoins(offer.discountedPrice)) return false;

    if (offer.type === 'faction' && offer.factionId) {
      this.grantFaction(offer.factionId);
    }

    if (offer.type === 'unit_pack' && offer.unitIds) {
      offer.unitIds.forEach(unitId => {
        playerData.buyUnit(unitId);
      });
    }

    if (offer.type === 'daily_deal') {
      // Daily deal: buy coins at discount (receive originalPrice worth of coins)
      playerData.addCoins(offer.originalPrice);
    }

    this.offers = this.offers.filter(o => o.id !== offerId);
    this.lastShownOfferTime = Date.now();
    this.save();

    return true;
  }

  private grantFaction(factionId: FactionId): void {
    // ✅ НОВОЕ (2026-01-20): Выдаем базовый юнит из CATALOG + стартовый из REPOSITORY
    const catalogStarters = getStarterUnits(factionId);
    const repositoryStarters = getStarterUnitsFromRepository(factionId);
    const catalogStarter = catalogStarters.find((u: UnitData) => u.capClass === 'balanced') || catalogStarters[0];
    const repositoryStarter = repositoryStarters[0];

    const data = playerData.get();
    if (!data.ownedUnits[factionId]) {
      data.ownedUnits[factionId] = [];
    }

    const now = Date.now();
    const defaultUpgrades = { power: 1, mass: 1, aim: 1, technique: 1 };

    // 1. Базовый юнит из каталога
    if (catalogStarter && !data.ownedUnits[factionId].some(u => u.id === catalogStarter.id)) {
      data.ownedUnits[factionId].push({
        id: catalogStarter.id,
        unlockedAt: now,
        upgrades: { ...defaultUpgrades },
      });
    }

    // 2. Стартовый юнит из репозитория
    if (repositoryStarter && !data.ownedUnits[factionId].some(u => u.id === repositoryStarter.id)) {
      data.ownedUnits[factionId].push({
        id: repositoryStarter.id,
        unlockedAt: now,
        upgrades: { ...defaultUpgrades },
      });
    }

    // Команда из базового юнита
    const starterId = catalogStarter?.id || repositoryStarter?.id;
    if (starterId) {
      data.factionTeams[factionId] = [starterId, starterId, starterId];
    }

    playerData.save();
  }

  getTimeRemaining(offer: SpecialOffer): string {
    const remaining = offer.expiresAt - Date.now();
    if (remaining <= 0) return '00:00:00';

    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  reset(): void {
    this.offers = [];
    this.lastShownOfferTime = 0;
    this.lastAutoPopupAt = 0;
    this.save();
  }

  forceCreateOffer(): void {
    const ownedFactions = playerData.getOwnedFactions();
    const unownedFactions = FACTION_IDS.filter(f => !ownedFactions.includes(f));
    
    if (unownedFactions.length > 0) {
      this.createFactionOffer(unownedFactions[0]);
      this.save();
    }
  }

  /**
   * ✅ НОВОЕ: Получить все предложения премиум юнитов
   */
  getPremiumUnitOffers(): SpecialOffer[] {
    this.cleanupExpired();
    const premiumUnits = getPremiumUnits();
    const ownedUniqueUnits = playerData.get().ownedUniqueUnits || [];
    const ownedSet = new Set(ownedUniqueUnits);
    
    return premiumUnits
      .filter(unit => !ownedSet.has(unit.id))
      .map(unit => this.createPremiumUnitOffer(unit));
  }

  /**
   * ✅ НОВОЕ: Создать предложение для премиум юнита
   */
  private createPremiumUnitOffer(unit: RepoUnitData): SpecialOffer {
    const price = unit.premiumPrice || 1000;
    
    return {
      id: `premium_unit_${unit.id}`,
      type: 'unit',
      title: '💎 PREMIUM UNIT',
      subtitle: getDisplayName(unit).toUpperCase(),
      description: mergeUnitDisplay(unit).description || `${unit.title} - Exclusive Legendary Unit`,
      unitIds: [unit.id],
      originalPrice: price,
      discountedPrice: price, // Нет скидки для премиум юнитов
      discountPercent: 0,
      createdAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000), // Не истекает (1 год)
      accentColor: unit.primaryColor || 0xf59e0b,
      priority: 200, // Высокий приоритет
      minimized: false,
    };
  }
}

export const OffersManager = new OffersManagerClass();