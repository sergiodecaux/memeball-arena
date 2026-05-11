# AI Role-Based Behavior Testing

Manual checks for the role system (`UnitRoles`, `RoleBasedScoring`, `AIController` integration). Open DevTools console during a match.

## Test 1: Tank as Goalkeeper

**Setup:** AI team includes at least one Tank.

**Expected:**

- Console (on AI init): Tank assigned as `goalkeeper` (see `[AI]` role table if enabled).
- After formation sync: Tank sits deeper than average (blend toward role anchor).
- Defensive shot candidates for that unit score higher than raw opportunist roles.

## Test 2: Trickster Opportunist

**Setup:** AI has Trickster(s); pull your units forward so the goal is open.

**Expected:**

- Role `opportunist` for Tricksters.
- Logs may include opportunist / open-goal evaluation when openness is high.
- More aggressive shots toward your goal when the lane is clear.

## Test 3: Enforcer Disruptor

**Setup:** AI has Enforcer; keep a Sniper or Trickster near the ball in AI’s defensive third.

**Expected:**

- First Enforcer not used as GK is `disruptor`.
- Disrupt / pressure style candidates toward the dangerous cap (see candidate descriptions in verbose AI logs if present).

## Test 4: Maestro Playmaker (maestro_control)

**Setup:** Force archetype `maestro_control` (composition: 3 Maestro, 1 Sniper, 1 Tank for team size 5).

**Expected:**

- Three Maestros when roster allows five slots.
- Elevated pass frequency (`passFrequency: 0.95`).
- Playmaker-oriented pass scoring (more passes than pure shoot-only bots).

## Test 5: Sniper Finisher

**Setup:** AI Sniper; ball roughly 300+ px from opponent goal along Y.

**Expected:**

- Role `finisher`.
- Long-range goal attempts get a scoring bump vs short-range.

## Test 6: Immediate Comeback (no setTimeout)

**Setup:** Score a goal as the player (AI concedes).

**Expected:**

- Console: comeback / concede reaction messaging (implementation uses `concedeReactionTurnsLeft` and aggression bump, not timers).
- For the next few **completed** AI moves: higher effective aggression and boosted card-use tendency.
- After the pulse expires, behavior returns toward baseline.

## Test 7: Role Assignments (5 caps)

**Setup:** Mixed AI team (e.g. Tank, Enforcer, Maestro, Trickster, Sniper).

**Expected (example mapping):**

- Tank → `goalkeeper` (first tank).
- Extra tanks → `defender`.
- Enforcer not GK → `disruptor`.
- Maestro → `playmaker`.
- Trickster / cap-class playmaker → `opportunist`.
- Sniper → `finisher`.
- In browser: `debugAI()` prints `P2 <id>: role=<role>` for each AI cap.

## Test 8: Goalkeeper Attacks Only When Allowed

**Setup:** GK assigned; normal play for several AI turns.

**Expected:**

- Goal shots for GK are heavily down-weighted.
- During concede pulse / high desperation, `allowGoalkeeperAttack` in scoring context may lift the floor so a desperate shot is still possible.

## Test 9: Disruptor Threat Priority

**Setup:** AI Enforcer (disruptor); place Sniper closer to ball / own goal threat than other caps.

**Expected:**

- Disrupt logic prefers higher “danger” score (ball proximity, goal proximity, class weights).
- Physical pressure shots biased toward that target.
