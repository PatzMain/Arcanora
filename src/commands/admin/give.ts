import { type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export async function runGiveItem(interaction: ChatInputCommandInteraction) {
  const targetUser = interaction.options.getUser('user', true);
  const inputName = interaction.options.getString('item', true).toLowerCase();
  const quantity = interaction.options.getInteger('quantity') || 1;

  const targetPlayer = await findOrCreatePlayer(targetUser.id, targetUser.username);

  const catalog = itemsCatalog;
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

  await addItem(targetPlayer.id, itemDef.id, quantity);

  const embed = successEmbed(
    'Admin Grant Success',
    `You successfully gave **x${quantity}** **${itemDef.name}** \`(${itemDef.id})\` to **${targetUser.username}**.`
  );
  await interaction.editReply({ embeds: [embed] });
}
