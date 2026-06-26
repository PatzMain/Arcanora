import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, inventory } from '../../database/schema.js';
import { getAndUpdatePlayerStamina, deductPlayerStamina } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { advanceQuestProgress } from '../../systems/progression/questSystem.js';

export const data = new SlashCommandBuilder()
  .setName('gather')
  .setDescription('Harvest resources in your current wilderness location.');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const player = await getAndUpdatePlayerStamina(interaction.user.id);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const currentLoc = zonesCatalog.find((z: any) => z.id === player.currentZoneId);
    if (!currentLoc) {
      const err = errorEmbed('Location Error', 'Your current location is unknown.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const resources = currentLoc.ecosystem?.resources || [];
    if (resources.length === 0) {
      const err = errorEmbed(
        'No Resources Here',
        `There are no resources to gather in **${currentLoc.name}**.\n\nTravel to a wilderness zone to find harvestable nodes.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Stamina check
    if (player.stamina < 2) {
      const err = errorEmbed(
        'Out of Stamina',
        `You need at least **2 Stamina** to gather. Current: **${player.stamina}/${player.staminaMax}**.\n\nUse \`/rest\` at a tavern or wait for passive regen.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Determine target resource to gather
    const selectedResId = resources[Math.floor(Math.random() * resources.length)]!;
    const itemDef = itemsCatalog.find((i: any) => i.id === selectedResId);
    if (!itemDef) {
      const err = errorEmbed('Error', 'Resource definition not found in catalog.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Query player inventory to check for tool bonuses
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    let quantity = 1;
    let toolBonusText = '';

    // Apply tool bonus logic
    if (selectedResId.includes('ore') || selectedResId === 'mat_coal') {
      const hasPickaxe = dbInventory.some(item => item.itemId === 'tool_copper_pickaxe');
      if (hasPickaxe) {
        quantity = 2;
        toolBonusText = '\n⛏️ *+1 extra resource from Copper Pickaxe!*';
      }
    } else if (selectedResId.includes('logs') || selectedResId === 'mat_wood') {
      const hasAxe = dbInventory.some(item => item.itemId === 'tool_copper_axe');
      if (hasAxe) {
        quantity = 2;
        toolBonusText = '\n🪓 *+1 extra resource from Copper Axe!*';
      }
    } else if (selectedResId.includes('fiber') || selectedResId === 'mat_herbs' || selectedResId.includes('fungi')) {
      const hasSickle = dbInventory.some(item => item.itemId === 'tool_copper_sickle');
      if (hasSickle) {
        quantity = 2;
        toolBonusText = '\n🌾 *+1 extra resource from Copper Sickle!*';
      }
    }

    // Deduct stamina & add item
    await deductPlayerStamina(player.id, 2);
    await addItem(player.id, selectedResId, quantity);

    const embed = successEmbed(
      '🌲 Resource Harvested!',
      `You spent **2 Stamina** and gathered **${quantity}x ${itemDef.name}** (${itemDef.rarity}) in **${currentLoc.name}**.${toolBonusText}\n\n` +
      `⚡ Stamina: **${player.stamina - 2} / ${player.staminaMax}**`
    );

    await interaction.editReply({ embeds: [embed] });

    // Advance quest progress
    await advanceQuestProgress(player.id, 'gather', selectedResId, quantity, interaction);

  } catch (error) {
    console.error('Error running gather command:', error);
    const embed = errorEmbed('Gathering Error', 'An unexpected error occurred while gathering.');
    await interaction.editReply({ embeds: [embed] });
  }
}
