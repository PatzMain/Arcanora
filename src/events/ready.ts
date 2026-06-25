import { type Client, REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';

// Static command imports for absolute compilation safety in CJS/ESM
import * as playerCmd from '../commands/player/player.js';
import * as inviteCmd from '../commands/player/invite.js';
import * as tutorialCmd from '../commands/player/tutorial.js';
import * as helpCmd from '../commands/player/help.js';
import * as combatCmd from '../commands/combat/combat.js';
import * as bossCmd from '../commands/combat/boss.js';
import * as inventoryCmd from '../commands/inventory/inventory.js';
import * as economyCmd from '../commands/economy/economy.js';
import * as questCmd from '../commands/quests/quest.js';
import * as craftCmd from '../commands/crafting/craft.js';
import * as guildCmd from '../commands/guilds/guild.js';
import * as petCmd from '../commands/pets/pet.js';
import * as adminCmd from '../commands/admin/admin.js';
import * as mapCmd from '../commands/player/map.js';
import * as resetCmd from '../commands/player/reset.js';

export const data = {}; // keep index metadata or dummy placeholder if index references it

export const commandsList = [
  playerCmd,
  inviteCmd,
  tutorialCmd,
  helpCmd,
  combatCmd,
  bossCmd,
  inventoryCmd,
  economyCmd,
  questCmd,
  craftCmd,
  guildCmd,
  petCmd,
  adminCmd,
  mapCmd,
  resetCmd
];

export async function execute(client: Client) {
  logger.info(`🤖 Arcanora Discord Bot logged in as ${client.user?.tag}!`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    const clientId = client.user?.id || process.env.DISCORD_CLIENT_ID;

    if (!clientId) {
      logger.error('Client ID is missing. Cannot register slash commands.');
      return;
    }

    // Clear stale guild-level commands to ensure global commands are visible
    for (const guild of client.guilds.cache.values()) {
      try {
        const guildCommands = await guild.commands.fetch();
        if (guildCommands.size > 0) {
          logger.info(`Clearing ${guildCommands.size} stale guild-level commands for guild: ${guild.name} (${guild.id})`);
          await guild.commands.set([]);
        }
      } catch (err) {
        logger.warn(`Could not fetch/clear guild commands for guild ${guild.name}: ${err}`);
      }
    }

    logger.info('Registering slash commands...');

    const body = commandsList.map((cmd) => cmd.data.toJSON());

    await rest.put(Routes.applicationCommands(clientId), { body });

    logger.info('Successfully registered global slash commands!');
  } catch (error) {
    logger.error({ error }, 'Failed to register slash commands.');
  }
}
