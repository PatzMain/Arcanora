import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { getPlayerGuild } from '../../database/queries/guild.js';
import { getActiveQuests } from '../../database/queries/quest.js';
import { computeStats } from '../../systems/progression/stats.js';
import { questsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { buildProfileEmbed, buildProfileTabButtons, errorEmbed } from '../../utils/embeds.js';
import { loadItems } from '../../systems/exploration/loot.js';
import { runPrestige } from './prestige.js';
import { runPreset } from './presets.js';
import { XP_TABLE } from '../../systems/progression/leveling.js';

export const data = new SlashCommandBuilder()
  .setName('player')
  .setDescription('View profile, stats, or prestige.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('profile')
      .setDescription('View your character profile card.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('stats')
      .setDescription('View your detailed attribute sheet.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('preset')
      .setDescription('Configure your 3 quick-cast attack/skill presets.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('prestige')
      .setDescription('Reset your level to 1 for permanent stat bonuses (+5% per prestige).')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'profile') {
    await runProfile(interaction);
  } else if (subcommand === 'stats') {
    await runStats(interaction);
  } else if (subcommand === 'preset') {
    await runPreset(interaction);
  } else if (subcommand === 'prestige') {
    await runPrestige(interaction);
  }
}

export async function runProfile(
  interaction: any,
  tab: 'identity' | 'equipment' | 'stats' = 'identity'
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    // Fetch equipped items
    const equippedDbItems = await getEquippedItems(player.id);
    const catalog = loadItems();

    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return {
        slot: def?.type || 'accessory',
        name: def ? `${def.name}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        id: dbItem.itemId,
        stats: def?.stats || {},
        enhancement: dbItem.enhancement,
        emoji: def?.emoji || null
      };
    });

    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null,
      []
    );

    const guildMemberInfo = await getPlayerGuild(player.id);
    const guildName = guildMemberInfo?.guildName || undefined;

    // Fetch active story quest name
    const activeQuests = await getActiveQuests(player.id);
    const activeStoryDb = activeQuests.find((q) => {
      const def = questsCatalog.find((qc) => qc.id === q.questId);
      return def?.type === 'story';
    });
    let storyQuestName = 'None';
    if (activeStoryDb) {
      const def = questsCatalog.find((qc) => qc.id === activeStoryDb.questId);
      storyQuestName = def ? def.name : activeStoryDb.questId;
    } else if (player.level === 20) {
      storyQuestName = '🏆 Story Complete (Max Level)';
    }

    const zoneDef = zonesCatalog.find((z) => z.id === player.currentZoneId);
    const currentZoneName = zoneDef ? zoneDef.name : player.currentZoneId;

    const embed = buildProfileEmbed(
      player,
      stats,
      equippedItemsList,
      guildName,
      storyQuestName,
      currentZoneName,
      tab
    );

    const tabButtons = buildProfileTabButtons(player.discordId, tab);

    await interaction.editReply({
      embeds: [embed],
      components: [tabButtons]
    });
  } catch (error) {
    console.error('Error running profile:', error);
    const embed = errorEmbed('Profile Error', 'Failed to retrieve profile data.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runStats(interaction: any) {
  await runProfile(interaction, 'stats');
}

export async function handleProfileInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // player_profile_{userId}_{tabName}
  const userId = parts[2]!;
  const tabName = parts[3] as 'identity' | 'equipment' | 'stats';

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This profile menu is not yours!',
      flags: [MessageFlags.Ephemeral]
    });
    return;
  }

  await runProfile(interaction, tabName);
}
