import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, unequipItem, removeItem } from '../../database/queries/inventory.js';
import { db } from '../../database/client.js';
import { playerEquipment, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { loadPets, getPetPassiveStats } from '../../systems/pets.js';
import { deductGold } from '../../economy/currency.js';
import { successEmbed, errorEmbed, petEmbed } from '../../utils/embeds.js';

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

      const embed = petEmbed(
        {
          name: petDef.name,
          description: petDef.description,
          level: currentPetLevel,
          maxLevel: petDef.maxLevel,
          rarity: petDef.rarity,
          ability: petDef.ability,
        },
        passive,
      );
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
      const confirmEmbed = errorEmbed(
        'Confirm Companion Release',
        `Are you sure you want to release **${petDef.name}** (Lv.${currentPetLevel}) back into the wild?\n\n` +
        `⚠️ **This action is permanent and cannot be undone!** You will lose this pet forever.`
      );
      confirmEmbed.setColor(0xF59E0B); // Amber warning color

      const confirmBtn = new ButtonBuilder()
        .setCustomId('pet_release_confirm')
        .setLabel('Yes, Release Pet')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🐾');

      const cancelBtn = new ButtonBuilder()
        .setCustomId('pet_release_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

      const response = await interaction.editReply({
        embeds: [confirmEmbed],
        components: [row]
      });

      try {
        const confirmation = await response.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          time: 60_000,
          componentType: ComponentType.Button
        });

        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmBtn.setDisabled(true),
          cancelBtn.setDisabled(true)
        );

        if (confirmation.customId === 'pet_release_confirm') {
          // Double check that the player still has the pet equipped (concurrency safety)
          const currentEquip = await db.query.playerEquipment.findFirst({
            where: eq(playerEquipment.playerId, player.id),
          });
          if (!currentEquip || currentEquip.pet !== equip.pet) {
            const embed = errorEmbed('Release Denied', 'Your pet status has changed.');
            await confirmation.update({ embeds: [embed], components: [disabledRow] });
            return;
          }

          // Unequip first
          await unequipItem(player.id, 'pet');
          // Delete item from inventory
          await removeItem(player.id, petInventoryRow.id, 1);

          const successEm = successEmbed(
            'Companion Released',
            `You released **${petDef.name}** back into the wild. You watched them disappear into the trees.`
          );
          await confirmation.update({ embeds: [successEm], components: [disabledRow] });
        } else {
          const cancelEmbed = errorEmbed('Release Cancelled', `You chose to keep **${petDef.name}**.`);
          cancelEmbed.setColor(0x9CA3AF); // Neutral grey
          await confirmation.update({ embeds: [cancelEmbed], components: [disabledRow] });
        }
      } catch (e) {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          confirmBtn.setDisabled(true),
          cancelBtn.setDisabled(true)
        );
        const timeoutEmbed = errorEmbed('Release Timed Out', 'No response received within 60 seconds. Pet release cancelled.');
        timeoutEmbed.setColor(0x9CA3AF);
        await interaction.editReply({
          embeds: [timeoutEmbed],
          components: [disabledRow]
        });
      }
      return;
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
  }
}
