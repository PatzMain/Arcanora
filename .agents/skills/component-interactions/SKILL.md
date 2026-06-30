---
name: component-interactions
description: Designing Discord button and select menu component custom IDs and interaction routing handlers in Arcanora.
---

# Discord Component Interactions in Arcanora

When writing Discord button click handlers, select menu selectors, and modals, you must strictly follow these structure rules:

## 1. Custom ID Formatting
Always format custom IDs using `_` as a delimiter:
`[prefix]_[action]_[userId]_[param1]_[param2]`

Example:
- `combat_attack_${userId}`
- `profile_tab_${userId}_stats`
- `bag_prev_${userId}_${currentPage - 1}`

> [!IMPORTANT]
> Do not include extra descriptive words in custom IDs (e.g., using `inspect_select` instead of `inspect`) that would shift the token indices.

## 2. Index Verification
Verify that the token extraction offsets in the handler align precisely with the custom ID structure:

```typescript
// Custom ID: bag_prev_123456789_1
const parts = interaction.customId.split('_');
const action = parts[1];      // 'prev'
const targetUserId = parts[2]; // '123456789' (userId)
const pageNum = parseInt(parts[3] || '1', 10);
```

Double check your code to ensure `parts[2]` corresponds to `userId` if that is where you placed it in the ID.

## 3. Owner Verification
To prevent players from clicking on other players' interactive UI components:
1. Always append the initiator's `discordId` (referred to as `userId`) to the custom ID.
2. In the interaction handler, validate that the user who clicked is the owner:

```typescript
const targetUserId = parts[2];
if (interaction.user.id !== targetUserId) {
  return await interaction.reply({
    content: "❌ You cannot interact with this menu. Run your own command!",
    ephemeral: true
  });
}
```

## 4. Routing in `interactionCreate.ts`
Map the interaction prefix to its handler function inside [interactionCreate.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/events/interactionCreate.ts):

```typescript
if (interaction.isButton()) {
  const customId = interaction.customId;
  if (customId.startsWith('bag_')) {
    await handleBagInteraction(interaction);
  }
}
```
