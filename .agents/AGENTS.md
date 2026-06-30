# Arcanora Project Rules

## Discord Component Custom IDs
When defining button, select menu, or modal custom IDs and their respective handlers:
1. **Ensure Strict Formatting Alignment**: Always format custom IDs using `_` as a delimiter (e.g., `prefix_action_userId_param1_param2`).
2. **Index Verification**: Double check that the index offsets used in the handler to extract metadata (e.g. `parts[2]` for `userId`) align exactly with the tokens defined in `customId`.
3. **Avoid Redundant Delimiter Tokens**: Do not include extra descriptive words in custom IDs (e.g., using `inspect_select` instead of `inspect`) that would offset the index matching unless the handler is explicitly coded to expect them.

## Project Context Handoff
1. **Always Update CONTEXT_HANDOFF.md**: Whenever you add, remove, or significantly change any files, features, database schema, or gameplay systems, you MUST update [CONTEXT_HANDOFF.md](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/CONTEXT_HANDOFF.md) in the project root.
2. **Log Recent Changes**: Record a summary of your changes under the "Recent Changes Log" section with the current date.

## Git Workflow
1. **Always Commit**: After completing any task that modifies source code or data files, run `git add .` followed by `git commit -m "descriptive message"`.
2. **Always Update CONTEXT_HANDOFF.md**: After committing, update the Recent Changes Log section in CONTEXT_HANDOFF.md with a summary of changes and the current date.
3. **Commit Message Format**: Use conventional commit style — `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` prefixes.

## Embed Design System
1. **Context-Aware Colors**: Use the color constants from `src/utils/embeds/base.ts` — COMBAT (red), EXPLORATION (green), SHOP (gold), INVENTORY (blue), PROFILE (purple), QUEST (amber). Do not default to PRIMARY for everything.
2. **No Wall-of-Text Embeds**: Use Discord embed fields (`.addFields()`) for visual grouping. Avoid putting more than 5 lines in `.setDescription()`.
3. **Item Displays**: Use the unified item card builder from `src/utils/embeds/itemCard.ts` for all item-related displays.

## Item Display Convention
1. **Player-facing views** must only show: item icon, name, rarity badge, type, short description (1 line), required level, buy/sell prices, and primary action buttons.
2. **Technical metadata** (internal IDs, timestamps, durability, times acquired) must be hidden behind a "More Details" toggle or omitted entirely.
3. **Rarity badge format**: Use `「Common」`, `「✦ Mythic」` inline badges, not full-line labels.

