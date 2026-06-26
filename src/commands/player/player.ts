import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { getPlayerGuild } from '../../database/queries/guild.js';
import { getActiveQuests } from '../../database/queries/quest.js';
import { computeStats } from '../../systems/progression/stats.js';
import { questsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { profileEmbed, statsEmbed, errorEmbed } from '../../utils/embeds.js';
import { loadItems } from '../../systems/exploration/loot.js';
import { getNavButtons } from '../../utils/navigation.js';
import { runPrestige } from './prestige.js';
import { runPreset } from './presets.js';

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
  interaction: any
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
        name: def ? `${def.name} ${dbItem.enhancement > 0 ? `+${dbItem.enhancement}` : ''}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        id: dbItem.itemId,
        stats: def?.stats || {}
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

    const embed = profileEmbed(
      {
        username: player.username,
        level: player.level,
        className: player.playerClass === 'novice' ? null : player.playerClass,
        gold: player.gold,
        gems: player.gems,
        prestige: player.prestige,
        currentHp: player.hpCurrent,
        maxHp: stats.hpMax,
        currentMana: player.manaCurrent,
        maxMana: stats.manaMax,
        storyQuestName,
        stamina: player.stamina,
        staminaMax: player.staminaMax,
        currentZoneName
      },
      stats,
      equippedItemsList,
      guildName
    );

    // Add navigation buttons
    const navButtons = getNavButtons('player_prestige_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    console.error('Error running profile:', error);
    const embed = errorEmbed('Profile Error', 'Failed to retrieve profile data.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runStats(
  interaction: any
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
        name: def ? `${def.name} ${dbItem.enhancement > 0 ? `+${dbItem.enhancement}` : ''}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        stats: def?.stats || {}
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

    const embed = statsEmbed(
      {
        username: player.username,
        level: player.level,
        className: player.playerClass === 'novice' ? null : player.playerClass
      },
      stats
    );

    // Add profile navigation button
    const navButtons = getNavButtons('player_prestige_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    console.error('Error running stats:', error);
    const embed = errorEmbed('Stats Error', 'Failed to retrieve your detailed stats.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}
