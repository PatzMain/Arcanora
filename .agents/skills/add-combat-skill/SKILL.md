---
name: add-combat-skill
description: Code patterns and registration instructions for adding new player combat skills to Arcanora.
---

# Adding a New Combat Skill in Arcanora

Follow this guide to create and implement combat skills for player classes:

## 1. Define the Skill Data
Open [skillsData.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/systems/combat/skillsData.ts) and add your skill configuration to the `INITIAL_SKILLS` array:

```typescript
{
  id: 'warrior_shield_slam',
  name: 'Shield Slam',
  description: 'Smash your shield into the enemy, dealing damage and reducing their attack.',
  class: 'warrior',
  manaCost: 20,
  cooldown: 3,
  levelReq: 5,
  effects: [
    {
      type: 'damage',
      target: 'enemy',
      scaling: 1.2
    },
    {
      type: 'debuff',
      target: 'enemy',
      stat: 'attack',
      value: 10,
      duration: 3
    }
  ]
}
```

### Effect Types
- `damage`: Deals direct damage to the target. Supports `scaling` (multiplier of caster's attack).
- `heal`: Restores HP to the caster. Supports `scaling` (multiplier of caster's magic/healing power).
- `buff`: Increases one of the caster's stats (`attack`, `defense`, `speed`). Requires `stat`, `value`, and `duration`.
- `debuff`: Decreases one of the enemy's stats. Requires `stat`, `value`, and `duration`.
- `dot` / `hot`: Deals damage or restores health over time.

## 2. Register Custom Behaviors (Optional)
If a skill requires special mechanics (e.g. Cleansing debuffs, complex scaling formulas, status manipulation), register a custom executor inside [skills.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/systems/combat/skills.ts):

```typescript
skillBehaviorRegistry.register('warrior_shield_slam', {
  execute(skill, casterStats, targetStats) {
    // Custom logic...
    return {
      damage: 50,
      healing: 0,
      effects: [],
      description: `💥 ${skill.name} hits hard, bypassing 20% defense!`
    };
  }
});
```

## 3. Verification
Verify compile and combat tests pass:
```bash
cmd /c npm test
```
Verify the skill displays correctly in `/player profile` and combat menus.
