---
name: embed-ui-patterns
description: UI/UX layout conventions, context-aware colors, progress bars, and item card design rules for Arcanora's Discord embeds.
---

# Discord Embed UI/UX Design System in Arcanora

Arcanora follows a strict, premium design aesthetic to present information to players cleanly and beautifully.

## 1. Context-Aware Colors
Do not default to a single generic color for every embed. Use the specific themed colors defined in [base.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/utils/embeds/base.ts):

- **Combat / Battle Screen**: `0xDC2626` (COMBAT red)
- **World Map / Explore Actions**: `0x16A34A` (EXPLORATION green)
- **Store / Marketplace / Purchases**: `0xD97706` (SHOP gold)
- **Inventory Bags / Equipment Inspection**: `0x2563EB` (INVENTORY blue)
- **Character Profile / Player Stats**: `0x7C3AED` (PROFILE purple)
- **Quest Board / Narrative Completions**: `0xCA8A04` (QUEST amber)
- **Dungeon Crawling Screen**: `0x6D28D9` (DUNGEON deep purple)
- **Loot Drop / Combat Victory**: `0xEAB308` (LOOT yellow)

## 2. Text Spacing & Dividers
Avoid heavy or ornate markdown dividers. Instead, utilize subtle Unicode lines:

- Short divider: `── ── ── ── ── ── ──`
- List bullet: `▸`

Keep `.setDescription()` under 5 lines. Group large datasets into visual fields using `.addFields()` with `inline: true` where appropriate.

## 3. Unified Item Card System
Always use the card builders in [itemCard.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/utils/embeds/itemCard.ts) to render items.

### Compact Mode (Lists, Bags, Shop)
```
🔷 **Iron Sword** 「Rare」
   ⚔️ +25 ATK  🛡️ +10 DEF  •  Lv. 5
```

### Detail Mode (Inspect, Codex, Previews)
Detail cards hide technical metadata (like internal database IDs, raw epoch timestamps) behind a "More Details" button toggle.
Inline rarity badges should use the format `「Common」` or `「✦ Mythic」` rather than full line labels.

## 4. Progress Bars
Use the custom progress bar helper for player and monster vitals:
- **HP**: Red squares `🟥`
- **Mana**: Blue squares `🟦`
- **Stamina**: Purple squares `🟪`
- **Experience**: Yellow squares `🟨`
- **Pet EXP**: Green squares `🟩`
