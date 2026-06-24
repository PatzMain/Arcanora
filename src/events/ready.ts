import { type Client, REST, Routes } from 'discord.js';
import { logger } from '../utils/logger.js';

// Static command imports for absolute compilation safety in CJS/ESM
import * as profileCmd from '../commands/player/profile.js';
import * as statsCmd from '../commands/player/stats.js';
import * as prestigeCmd from '../commands/player/prestige.js';
import * as inviteCmd from '../commands/player/invite.js';
import * as tutorialCmd from '../commands/player/tutorial.js';
import * as helpCmd from '../commands/player/help.js';
import * as exploreCmd from '../commands/combat/explore.js';
import * as fightCmd from '../commands/combat/fight.js';
import * as bagCmd from '../commands/inventory/bag.js';
import * as equipCmd from '../commands/inventory/equip.js';
import * as sellCmd from '../commands/inventory/sell.js';
import * as shopCmd from '../commands/economy/shop.js';
import * as balanceCmd from '../commands/economy/balance.js';
import * as questsCmd from '../commands/quests/quests.js';
import * as dailyCmd from '../commands/quests/daily.js';
import * as craftCmd from '../commands/crafting/craft.js';
import * as guildCmd from '../commands/guilds/guild.js';
import * as leaderboardCmd from '../commands/guilds/leaderboard.js';
import * as petCmd from '../commands/pets/pet.js';
import * as giveItemCmd from '../commands/admin/give-item.js';
import * as spawnBossCmd from '../commands/admin/spawn-boss.js';

export const commandsList = [
  profileCmd,
  statsCmd,
  prestigeCmd,
  inviteCmd,
  tutorialCmd,
  helpCmd,
  exploreCmd,
  fightCmd,
  bagCmd,
  equipCmd,
  sellCmd,
  shopCmd,
  balanceCmd,
  questsCmd,
  dailyCmd,
  craftCmd,
  guildCmd,
  leaderboardCmd,
  petCmd,
  giveItemCmd,
  spawnBossCmd
];

export async function execute(client: Client) {
  logger.info(`🤖 Arcanora Discord Bot logged in as ${client.user?.tag}!`);

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    const clientId = process.env.DISCORD_CLIENT_ID || client.user?.id;

    if (!clientId) {
      logger.error('Client ID is missing. Cannot register slash commands.');
      return;
    }

    logger.info('Registering slash commands...');

    const body = commandsList.map((cmd) => cmd.data.toJSON());

    await rest.put(Routes.applicationCommands(clientId), { body });

    logger.info('Successfully registered global slash commands!');
  } catch (error) {
    logger.error({ error }, 'Failed to register slash commands.');
  }
}
