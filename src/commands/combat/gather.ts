import { logger } from '../../utils/logger.js';
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { eq } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { getAndUpdatePlayerStamina, deductPlayerStamina } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { zonesCatalog, itemsCatalog } from '../../utils/catalog.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { advanceQuestProgress } from '../../systems/progression/questSystem.js';

export const data = new SlashCommandBuilder()
  .setName('gather')
  .setDescription('Harvest resources in your current wilderness location.');

export async function executeGather(playerId: string, interaction?: any): Promise<{ success: boolean; message: string }> {
  const player = await getAndUpdatePlayerStamina(playerId);
  if (!player) {
    throw new Error('Player profile not found. Please complete the /tutorial first.');
  }

  const currentLoc = zonesCatalog.find((z: any) => z.id === player.currentZoneId);
  if (!currentLoc) {
    throw new Error('Your current location is unknown.');
  }

  const resources = currentLoc.ecosystem?.resources || [];
  if (resources.length === 0) {
    throw new Error(
      `There are no resources to gather in **${currentLoc.name}**.\n\nTravel to a wilderness zone to find harvestable nodes.`
    );
  }

  // Stamina check
  if (player.stamina < 2) {
    throw new Error(
      `You need at least **2 Stamina** to gather. Current: **${player.stamina}/${player.staminaMax}**.\n\nUse \`/rest\` at a tavern or wait for passive regen.`
    );
  }

  // Determine target resource to gather
  const selectedResId = resources[Math.floor(Math.random() * resources.length)]!;
  const itemDef = itemsCatalog.find((i: any) => i.id === selectedResId);
  if (!itemDef) {
    throw new Error('Resource definition not found in catalog.');
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

  // Advance quest progress
  if (interaction) {
    await advanceQuestProgress(player.id, 'gather', selectedResId, quantity, interaction);
  }

  return {
    success: true,
    message: `You spent **2 Stamina** and gathered **${quantity}x ${itemDef.name}** (${itemDef.rarity}) in **${currentLoc.name}**.${toolBonusText}\n\n` +
      `⚡ Stamina: **${player.stamina - 2} / ${player.staminaMax}**`
  };
}

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  try {
    const result = await executeGather(interaction.user.id, interaction);
    const embed = successEmbed('🌲 Resource Harvested!', result.message);
    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    logger.error({ err: error }, 'Error running gather command:');
    const embed = errorEmbed('Gathering Error', error.message || 'An unexpected error occurred while gathering.');
    await interaction.editReply({ embeds: [embed] });
  }
}
