import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, unequipItem, removeItem } from '../../database/queries/inventory.js';
import { db } from '../../database/client.js';
import { playerEquipment, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { loadPets, getPetPassiveStats } from '../../systems/pets.js';
import { deductGold } from '../../economy/currency.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('pet')
  .setDescription('Manage your companion pet.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('View stats and abilities of your equipped pet.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('level')
      .setDescription('Train your pet to level it up (Costs Gold based on level).')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('release')
      .setDescription('Release your equipped pet back into the wild (Deletes the pet).')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    // Fetch equipped row
    const equip = await db.query.playerEquipment.findFirst({
      where: eq(playerEquipment.playerId, player.id),
    });

    const subcommand = interaction.options.getSubcommand();

    if (!equip || !equip.pet) {
      const embed = errorEmbed('No Pet Equipped', 'You do not have a pet equipped. Equipping a pet can be done via `/equip`.');
      return interaction.editReply({ embeds: [embed] });
    }

    // Fetch the pet inventory row
    const petInventoryRow = await db.query.inventory.findFirst({
      where: eq(inventory.id, equip.pet),
    });

    if (!petInventoryRow) {
      const embed = errorEmbed('Pet Error', 'Equipped pet data is missing.');
      return interaction.editReply({ embeds: [embed] });
    }

    const petsCatalog = loadPets();
    const petDef = petsCatalog.find((p) => p.id === petInventoryRow.itemId);

    if (!petDef) {
      const embed = errorEmbed('Pet Error', 'Pet definition not found in catalog.');
      return interaction.editReply({ embeds: [embed] });
    }

    const currentPetLevel = Math.max(1, petInventoryRow.enhancement); // use enhancement as level

    if (subcommand === 'info') {
      const passive = getPetPassiveStats(petDef, currentPetLevel);

      const embed = successEmbed(
        `🐾 Companion: ${petDef.name}`,
        `*${petDef.description}*\n\n` +
        `⭐ Pet Level: **Lv.${currentPetLevel}** / **${petDef.maxLevel}**\n` +
        `🏅 Rarity: **${petDef.rarity.toUpperCase()}**\n\n` +
        `**Passive Stat Bonuses:**\n` +
        `⚔️ Attack: +**${passive.attack}**\n` +
        `🛡️ Defense: +**${passive.defense}**\n` +
        `❤️ Max HP: +**${passive.hpMax}**\n` +
        `🍀 Luck: +**${passive.luck}**\n\n` +
        `**Combat Ability:**\n` +
        `🌀 **${petDef.ability.name}** (Cooldown: ${petDef.ability.cooldown} turns)\n` +
        `*${petDef.ability.description}*`
      );
      embed.setColor(0x10B981); // Green companion theme
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'level') {
      if (currentPetLevel >= petDef.maxLevel) {
        const embed = errorEmbed('Max Level', `Your pet **${petDef.name}** is already at its maximum level (**Lv.${petDef.maxLevel}**).`);
        return interaction.editReply({ embeds: [embed] });
      }

      // Calculate cost
      const goldCost = 200 * currentPetLevel;

      // Deduct gold
      const goldCheck = await deductGold(player.id, goldCost, `Trained Pet: ${petDef.name}`);
      if (!goldCheck.success) {
        const embed = errorEmbed(
          'Insufficient Funds',
          `Training **${petDef.name}** to Lv.${currentPetLevel + 1} costs 🪙 **${goldCost}** Gold. You do not have enough.`
        );
        return interaction.editReply({ embeds: [embed] });
      }

      const nextLevel = currentPetLevel + 1;

      // Update pet level
      await db
        .update(inventory)
        .set({ enhancement: nextLevel })
        .where(eq(inventory.id, petInventoryRow.id));

      const oldPassive = getPetPassiveStats(petDef, currentPetLevel);
      const newPassive = getPetPassiveStats(petDef, nextLevel);

      const embed = successEmbed(
        'Pet Trained!',
        `You spent 🪙 **${goldCost.toLocaleString()}** Gold training **${petDef.name}**.\n\n` +
        `🐾 Level: **Lv.${currentPetLevel} -> Lv.${nextLevel}**\n` +
        `⚔️ Attack: +${oldPassive.attack} -> +**${newPassive.attack}**\n` +
        `🛡️ Defense: +${oldPassive.defense} -> +**${newPassive.defense}**\n` +
        `❤️ Max HP: +${oldPassive.hpMax} -> +**${newPassive.hpMax}**\n` +
        `🍀 Luck: +${oldPassive.luck} -> +**${newPassive.luck}**`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === 'release') {
      // Unequip first
      await unequipItem(player.id, 'pet');
      // Delete item from inventory
      await removeItem(player.id, petInventoryRow.id, 1);

      const embed = successEmbed(
        'Companion Released',
        `You released **${petDef.name}** back into the wild. You watched them disappear into the trees.`
      );
      return interaction.editReply({ embeds: [embed] });
    }

    return;
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Pet Command Error', 'Failed to manage pet companion.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
}
