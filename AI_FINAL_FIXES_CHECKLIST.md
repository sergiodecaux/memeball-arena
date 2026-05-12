# AI Final Fixes — Testing Checklist

## 1. Faction randomization (casual / freeplay)

- [ ] Run several matches without fixed opponent from campaign.
- [ ] Opponent faction should vary when `GameSceneSetup` / match prep picks random (not tied to one campaign `enemyFaction`).

## 2. Unit randomization (medium+)

- [ ] Console: `[TeamBuilder]` lines with different unit IDs across matches for same archetype + faction.
- [ ] Same faction + archetype should not always pick identical `unitIds`.

## 3. Formation positioning (AI)

- [ ] At kick-off and after goals: defenders / low `slot.y` near **top** goal (AI); attackers with higher `slot.y` toward **bottom** (player).
- [ ] After sync, no whole team stuck on the player’s half due to role blend (blend was reduced for GK/defender).

## 4. Formation change after conceding

- [ ] Score as player → log `Formation (concede): … → …` when a different preset is chosen.
- [ ] `resetPositions` / `syncAIFormationPositions('goal-reset')` runs so chips actually move.

## 5. Maestro / playmaker passes

- [ ] AI roster with Maestro: multiple pass candidates per turn (forced passes + optional random pass branch for others).
- [ ] In DEV console: `MAESTRO/PLAYMAKER PASS` lines when `import.meta.env.DEV`.

## 6. Trickster / playmaker finisher

- [ ] Ball within ~350px of player goal, unit close enough → curve or open-goal candidate with `🌀` description.

## 7. Comeback aggression

- [ ] After conceding: `concedeReactionTurnsLeft` pulse, higher aggression floor when losing by 1–2+ goals.

## 8. Overall feel

- [ ] Medium+: passes, cards, goals feel active; Easy: still toned down but formations adapt and rare passes possible.

## Expected log snippets

- `[TeamBuilder] + … (role, rarity)` / `✅ Roster …`
- `[AI] 📐 Formation (concede): …`
- `[AI] 🎼 MAESTRO/PLAYMAKER PASS: …` (DEV)
- `[AI] ⚠️ GOAL CONCEDED — ULTRA ATTACK tilt` (when deficit ≤ -2)
