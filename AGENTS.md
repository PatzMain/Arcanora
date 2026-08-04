# Arcanora — AI Agent Instructions

Instructions and guidelines for AI coding agents working on the Arcanora TypeScript/Node.js Discord RPG project.

---

## 1. Operating Notes

- **Agent Skills**: Consult `.agents/skills/` before complex tasks (e.g. `add-command`, `add-combat-skill`, `database-changes`, `embed-ui-patterns`).
- **Runtime & Build**: Target **Node.js 20+** ESM.
  - Dev: `npm run dev` (`tsx watch src/index.ts`)
  - Build: `npm run build` (`tsup src/index.ts --format esm`)
  - Check: `npm test` (`npm run lint && tsc --noEmit && vitest run`)
- **Database**: Drizzle ORM. Run `npm run generate` after schema updates, then `npm run migrate`.

---

## 2. Architecture & File Layout

- `src/commands/`: Discord slash commands grouped by feature (`admin`, `combat`, `economy`, `inventory`, etc.).
  - Commands export `data` (SlashCommandBuilder) and execution handlers.
  - Subcommands are modularized into dedicated handler files (e.g., `admin/give.ts`).
- `src/systems/`: Core game logic engines (e.g., `combat/bossEngine.ts`, `exploration/dungeonController.ts`).
- `src/database/`: Drizzle ORM `schema.ts`, database client, and query helpers in `queries/`.
- `data/` & `src/utils/catalog.ts`: Static game JSON definitions (items, enemies, classes, quests).
- `src/utils/embeds/` & `src/utils/emojis.ts`: UI formatters, embed builders, and emoji resolution.

---

## 3. Coding Conventions

### TypeScript & ESM Imports
- **Explicit Extensions**: Always include `.js` extensions on relative local imports:
  ```ts
  import { db } from '../../database/client.js';
  import { successEmbed } from '../../utils/embeds.js';
  ```
- **Strict Typing**: Use explicit type imports from `discord.js` (`type ChatInputCommandInteraction`, `type ButtonInteraction`).

### Discord Interactions & UI
- **Interaction Flow**: Always check if an interaction is replied or deferred (`interaction.deferred || interaction.replied`) before sending messages (`editReply` vs `followUp` vs `reply`).
- **Embed Helpers**: Use standardized UI helpers (`successEmbed`, `errorEmbed`, `bossInfoEmbed`) rather than constructing raw `EmbedBuilder` for common responses.
- **Support Multi-modal Interactions**: Helper methods handling subcommands should support both `ChatInputCommandInteraction` and `ButtonInteraction` where applicable.

---

## 4. Do / Don't

### DO
- **DO** keep heavy game logic (damage formulas, loot generation, state calculations) inside `src/systems/`, keeping command handlers thin.
- **DO** validate string IDs against static catalog definitions (`itemsCatalog`, `getEnemyById`) to prevent bad data.
- **DO** use `logger` (`src/utils/logger.js`) instead of `console.log`.
- **DO** handle interaction timeouts by deferring early (`await interaction.deferReply()`) if processing takes >2 seconds.

### DON'T
- **DON'T** omit `.js` extensions in local file import statements.
- **DON'T** put direct database schema modifications in code without generating a Drizzle migration.
- **DON'T** duplicate static game content in code; define it in `data/` or catalog utilities.
- **DON'T** ignore `tsc --noEmit` errors or bypass TypeScript types with `any` unless absolutely necessary for Discord component typing hacks.

---

## 5. Testing & Verification

Before completing tasks, verify changes using the test suite:

1. **Static Checks & Unit Tests**:
   ```bash
   npm test
   ```
   Ensures ESLint, TypeScript compilation (`tsc --noEmit`), and Vitest unit tests pass.
2. **Schema Integrity**: If `src/database/schema.ts` changed, verify schema generation:
   ```bash
   npm run generate
   ```

---

## 6. Security & Permissions

- **Admin Commands**: Always set `.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` on administrative slash commands.
- **Input Sanitization**: Trim user string input and validate regex (e.g., custom Discord emojis `<a?:name:id>`).
- **Secrets & Token Safety**: Never hardcode Discord bot tokens, database URIs, or credentials. Rely on environment variables.