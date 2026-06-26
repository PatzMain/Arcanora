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
  .setName('fish')
  .setDescription('Cast your fishing line into the nearby water.');

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

    // Determine if this location is a valid fishing spot
    const isDocks = currentLoc.id === 'river_docks';
    const isRiver = currentLoc.id === 'silverbrook_river';
    const hasFishResources = (currentLoc.ecosystem?.resources || []).some((r: string) => r.startsWith('fish_'));

    if (!isDocks && !isRiver && !hasFishResources) {
      const err = errorEmbed(
        'No Water Nearby',
        `There is nowhere to fish in **${currentLoc.name}**.\n\nTravel to the **River Docks** or **Silverbrook River** to cast your line.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Stamina check (3 stamina for fishing)
    if (player.stamina < 3) {
      const err = errorEmbed(
        'Out of Stamina',
        `You need at least **3 Stamina** to fish. Current: **${player.stamina}/${player.staminaMax}**.\n\nUse \`/rest\` at a tavern or wait for passive regen.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Define fish catalog for this location
    let fishOptions = ['fish_trout'];
    if (isRiver || hasFishResources) {
      fishOptions = ['fish_trout', 'fish_carp'];
    }
    if (currentLoc.id === 'shimmering_cave') {
      fishOptions = ['fish_cavefish'];
    }

    // Select random fish
    const selectedFishId = fishOptions[Math.floor(Math.random() * fishOptions.length)]!;
    const itemDef = itemsCatalog.find((i: any) => i.id === selectedFishId);
    if (!itemDef) {
      const err = errorEmbed('Error', 'Fish definition not found in catalog.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    // Query inventory to check for fishing rod tool
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    let quantity = 1;
    let rodBonusText = '';
    const hasBambooRod = dbInventory.some(item => item.itemId === 'tool_bamboo_rod');

    if (hasBambooRod) {
      // 25% chance of double catch
      if (Math.random() < 0.25) {
        quantity = 2;
        rodBonusText = '\n🎣 *Double catch! Your Bamboo Fishing Rod pulled in two!*';
      }
    }

    // Deduct stamina and add fish
    await deductPlayerStamina(player.id, 3);
    await addItem(player.id, selectedFishId, quantity);

    const embed = successEmbed(
      '🎣 Fish Caught!',
      `You spent **3 Stamina** and caught **${quantity}x ${itemDef.name}** (${itemDef.rarity}) in **${currentLoc.name}**.${rodBonusText}\n\n` +
      `⚡ Stamina: **${player.stamina - 3} / ${player.staminaMax}**`
    );

    await interaction.editReply({ embeds: [embed] });

    // Advance quest progress
    await advanceQuestProgress(player.id, 'gather', selectedFishId, quantity, interaction);

  } catch (error) {
    console.error('Error running fish command:', error);
    const embed = errorEmbed('Fishing Error', 'An unexpected error occurred while fishing.');
    await interaction.editReply({ embeds: [embed] });
  }
}
