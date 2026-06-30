---
name: add-game-content
description: Rules, schemas, and instructions for adding new items, enemies, locations, quests, recipes, pets, or achievements as static JSON files in Arcanora.
---

# Adding Static Game Content in Arcanora

All static game entities live under the `data/` folder as independent JSON files. They are automatically loaded at boot by the catalog system.

## 1. Directory Structure

- `data/items/` - Equipment, materials, potions, foods, seeds, tools.
- `data/enemies/` - Standard enemies, rare mobs, dungeon bosses, world bosses.
- `data/locations/` - Towns, combat zones, dungeons.
- `data/quests/` - Story quests, dailies, weeklies.
- `data/recipes/` - Crafting blueprints.
- `data/pets/` - Pet companions.
- `data/achievements/` - Player accomplishments.
- `data/classes/` - Specialized classes (e.g., Warrior, Mage).

## 2. Key Rules & Constraints

1. **Unique IDs**: Every JSON file must define a unique `"id"` matching its filename (without the extension).
2. **Stat Alignment**: Stat values (such as `hp`, `attack`, `defense`, `speed` in enemies, items, and classes) must be multiples of 10.
3. **No Duplicate References**: When listing enemies in locations, ensure they exist both in `"enemies"` and `"ecosystem.creatures"` arrays.
4. **Quest Integration**: Story quests must be added to the chronological progression array `STORY_QUEST_ORDER` in [questSystem.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/systems/progression/questSystem.ts) and receive a sequential `"displayOrder"` field.

## 3. Schemas

### Items (`data/items/`)
```json
{
  "id": "weapon_iron_sword",
  "name": "Iron Sword",
  "description": "A sturdy blade forged from Ironmine ore.",
  "type": "weapon",
  "rarity": "rare",
  "levelReq": 5,
  "stats": {
    "attack": 25,
    "defense": 10,
    "speed": 5
  },
  "buyPrice": 250,
  "sellPrice": 85
}
```

### Enemies (`data/enemies/`)
```json
{
  "id": "cave_bat",
  "name": "Cave Bat",
  "description": "A large, winged mammal swoop-attacking in the dark.",
  "zone": "shimmering_cave",
  "rarity": "normal",
  "level": 5,
  "stats": {
    "hp": 90,
    "attack": 20,
    "defense": 10,
    "speed": 30
  },
  "abilities": [
    {
      "id": "screech",
      "name": "Screech",
      "damage": 15,
      "chance": 30
    }
  ],
  "lootTable": [
    {
      "itemId": "mat_leather",
      "dropRate": 40,
      "minQty": 1,
      "maxQty": 2
    }
  ],
  "expReward": 30,
  "goldReward": 15
}
```

## 4. Verification
Run the bot and catalog validation:
```bash
cmd /c npm test
```
Check startup logs to verify that the item or enemy is loaded successfully without JSON parse errors.
