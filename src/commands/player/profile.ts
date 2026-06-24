import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { getPlayerGuild } from '../../database/queries/guild.js';
import { computeStats } from '../../systems/progression/stats.js';
import { getXpForLevel } from '../../systems/progression/leveling.js';
import { profileEmbed, errorEmbed } from '../../utils/embeds.js';
import { loadItems } from '../../systems/exploration/loot.js';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your character profile card.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load or create player
    const player = await findOrCreatePlayer(discordId, username);

    // Fetch equipped items
    const equippedDbItems = await getEquippedItems(player.id);
    const catalog = loadItems(); // Load full item catalog

    // Map DB items to catalog definitions
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return {
        slot: def?.type || 'accessory',
        name: def ? `${def.name} ${dbItem.enhancement > 0 ? `+${dbItem.enhancement}` : ''}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        stats: def?.stats || {}
      };
    });

    // Compute effective stats
    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null, // Pet stats placeholder (we can expand this later)
      [] // Buffs placeholder
    );

    // Get guild membership
    const guildMemberInfo = await getPlayerGuild(player.id);
    const guildName = guildMemberInfo?.guildName || undefined;

    const expToNext = getXpForLevel(player.level + 1);

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
        exp: player.exp,
        expToNext
      },
      stats,
      equippedItemsList,
      guildName
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Profile Error', 'Failed to retrieve profile data. Please try again.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
