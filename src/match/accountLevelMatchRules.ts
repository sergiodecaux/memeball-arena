/**
 * Правила для Quick/Ranked/Casual (не лига и не турнир): зависят от уровня аккаунта.
 * Количество фишек матча совпадает с длиной таймера (3 ↔ 3 мин и т.д.).
 *
 * — уровни 1–5 включительно: 3×3, 180 с
 * — уровни 6–9: 4×4, 240 с
 * — уровень 10 и выше: 5×5, 300 с
 */
export function getAccountLevelMatchCaps(level: number): {
  teamSize: 3 | 4 | 5;
  matchDurationSeconds: number;
} {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  if (lv <= 5) {
    return { teamSize: 3, matchDurationSeconds: 180 };
  }
  if (lv < 10) {
    return { teamSize: 4, matchDurationSeconds: 240 };
  }
  return { teamSize: 5, matchDurationSeconds: 300 };
}

/** Длительность матча по фактическому размеру команды (3/4/5 фишек). */
export function getMatchDurationForTeamSize(teamSize: number): number {
  const t = Math.min(5, Math.max(3, Math.floor(Number(teamSize) || 3)));
  if (t <= 3) return 180;
  if (t === 4) return 240;
  return 300;
}
