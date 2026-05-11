# AI Fixes — critical bugs (PvP-bot / faction vs AI)

## Applied changes

1. **`src/ai/team/TeamBalancer.ts`** — анализ сохранённой команды игрока по `unitId` и подбор состава AI под классы и среднюю «силу» по редкости; сложность easy по-прежнему отдельным путём в фабрике.
2. **`src/scenes/game/EntityFactory.ts`** — для `medium` / `hard` / `impossible` оппонент собирается через `TeamBalancer`, с паддингом через старый `getAITeamForDifficulty`, если не хватает id.
3. **`AIController`** — усилены попытки играть карты (каждый 3-й ход на hard/expert, повторный выбор с нижним порогом для hard, «любая исполнимая» для expert), резервные кандидаты удара к мячу, экстренный ход если список кандидатов пуст.
4. **`AIController`** — `snapFormationSlotsToTeamSize` / `reconcileFormationToTeamSize`: число слотов формации всегда совпадает с числом фишек AI (иначе синхрон позиций в сцене молча не работала).
5. **`GameScene.syncAIFormationPositions`** — перед синхроном вызывается `reconcileFormationToTeamSize()`; при рассинхроне пишется предупреждение в консоль.
6. **`GameScene.registerAIDebugHook`** — в браузере доступно `debugAI()` после настройки AI.

## Quick test checklist

- [ ] Ростер AI визуально и по классам ближе к команде игрока (не только общие на medium+).
- [ ] На hard/expert бот регулярно тянет карты, если колода и `AbilityManager` позволяют.
- [ ] После смены тактики / гола фишки AI встают по слотам схемы (нет «тихого» пропуска из-за `slots.length`).
- [ ] За серию ходов AI не «молчит»: есть хотя бы давление по мячу или экстренный удар.
- [ ] В консоли `debugAI()` печатает руку и формацию.

## Если что-то всё ещё не так

Запустите матч с AI, откройте консоль, выполните `debugAI()` и сохраните вывод плюс любые строки `[AI]` / `[GameScene] AI formation sync skipped`.
