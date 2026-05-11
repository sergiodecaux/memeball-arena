# AI Testing Checklist v2.0

## Pre-match analysis

- [ ] В консоли есть блок `PRE-MATCH ANALYSIS` (при включённом pre-match у сложности)
- [ ] Видны состав игрока, угрозы, контр-тактика и reasoning

## Meta compositions (архетипы)

- [ ] В логах EntityFactory: строка `AI archetype:` и список id команды
- [ ] Против 3+ trickster — контр-пик вроде sniper_spam / defensive_wall (случайно из доступных)
- [ ] Против 3+ sniper — pressure_swarm / trickster_rush и т.п.
- [ ] Логируется `Meta captain preference on roster` при сборке

## Formation changes

- [ ] Смена тактической схемы AI при **голах** (`recordGoal` → `selectFormation`) работает как раньше
- [ ] Во время матча **нет** смены формации из `MatchAdapter` / `checkAndApplyAdaptation` (только зона защиты / пасы / карты)

## Turn execution

- [ ] За 15–20 ходов подряд AI не «зависает» без импульса
- [ ] При нуле кандидатов срабатывает emergency «в ворота», затем при необходимости last-resort импульс
- [ ] Если physics выключен — ход завершается без зависания `isThinking`

## Aggressive play & pressure

- [ ] На агрессивных архетипах чаще попадают варианты удара по воротам (long/close множители)
- [ ] Прессинг чаще генерируется (увеличенный радиус для playmaker / высокой aggression)

## Trickster finisher

- [ ] У trickster при мяче близко к воротам (< ~200px) в кандидатах появляется строка с `TRICKSTER FINISHER near goal`

## Cards & captain

- [ ] На Hard+ карты по-прежнему достижимы (колбэк AbilityManager)
- [ ] При `aiIncludeCaptain` в ростере AI по-прежнему инжектится фракционный капитан (`applyCaptainSlotToAiUnitIds`)

## Debug

- [ ] `debugAI()` показывает архетип и формацию
