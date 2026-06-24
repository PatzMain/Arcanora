import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { statsEmbed, errorEmbed } from '../../utils/embeds.js';
import { loadItems } from '../../systems/exploration/loot.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('View your detailed stat sheet.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

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

    // Compute stats
    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null, // Pet stats placeholder
      [] // Buffs placeholder
    );

    const embed = statsEmbed(
      {
        username: player.username,
        level: player.level,
        className: player.playerClass === 'novice' ? null : player.playerClass
      },
      stats
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Stats Error', 'Failed to retrieve your detailed stats.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
