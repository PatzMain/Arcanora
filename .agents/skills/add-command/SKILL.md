---
name: add-command
description: Instructions for creating and registering new Discord slash commands in the Arcanora codebase.
---

# Adding a New Discord Slash Command in Arcanora

Follow these steps to create, register, and handle a new slash command:

## 1. Create the Command File
Place the new command file inside the appropriate subdirectory under `src/commands/` (e.g., `src/commands/player/`, `src/commands/inventory/`, `src/commands/economy/`, or `src/commands/quests/`).
Use the following structure for ESM compatibility:

```typescript
import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';

export const data = new SlashCommandBuilder()
  .setName('my-command')
  .setDescription('Description of what my command does')
  .addStringOption(option =>
    option.setName('input')
      .setDescription('An optional string input')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
  
  // Implement command logic here...
  
  await interaction.reply({
    content: `Hello, ${player.username}! You ran /my-command.`,
    ephemeral: true
  });
}
```

> [!IMPORTANT]
> Make sure all imports use the `.js` extension (e.g. `../queries/player.js`), as Arcanora is configured with `"type": "module"`.

## 2. Register the Command
Open [ready.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/events/ready.ts) and:
1. Import the command definition.
2. Add it to the `commandsList` array.

```typescript
import * as myCommand from '../commands/player/myCommand.js';

export const commandsList = [
  // existing commands...
  myCommand,
];
```

The startup routine in `ready.ts` will automatically register the command with Discord globally.

## 3. Handle Component Interactions
If your command utilizes buttons, select menus, or modals:
1. Ensure button custom IDs match the format rule: `[prefix]_[action]_[userId]_[params...]`.
2. Map the interaction handler in [interactionCreate.ts](file:///c:/Users/Patz/Desktop/My%20Projects/Arcanora/src/events/interactionCreate.ts).

## 4. Verification
Run the compiler and tests to verify syntax and logic:
```bash
cmd /c npm test
```
