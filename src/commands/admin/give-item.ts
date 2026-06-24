import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
  .setName('give-item')
  .setDescription('Admin: Give an item to a player.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) =>
    option
      .setName('user')
      .setDescription('The player receiving the item.')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('item')
      .setDescription('Item ID or name.')
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('quantity')
      .setDescription('Quantity to give (default: 1).')
      .setMinValue(1)
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Double check admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const embed = errorEmbed('Unauthorized', 'Only server administrators can use this command.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const inputName = interaction.options.getString('item', true).toLowerCase();
    const quantity = interaction.options.getInteger('quantity') || 1;

    // Load or register the target player
    const targetPlayer = await findOrCreatePlayer(targetUser.id, targetUser.username);

    const catalog = loadItemsCatalog();
    const itemDef = catalog.find(
      (i) =>
        i.id.toLowerCase() === inputName ||
        i.name.toLowerCase().includes(inputName)
    );

    if (!itemDef) {
      const embed = errorEmbed('Item Not Found', `No item matching **"${inputName}"** was found in the catalog.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Add item to target player's inventory
    await addItem(targetPlayer.id, itemDef.id, quantity);

    const embed = successEmbed(
      'Admin Grant Success',
      `You successfully gave **x${quantity}** **${itemDef.name}** \`(${itemDef.id})\` to **${targetUser.username}**.`
    );
    await interaction.editReply({ embeds: [embed] });

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Admin Error', 'Failed to execute item grant.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}

function loadItemsCatalog(): any[] {
  const filePath = join(process.cwd(), 'data', 'items.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}
