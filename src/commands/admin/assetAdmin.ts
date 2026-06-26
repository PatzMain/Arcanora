import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { setCustomAsset, removeCustomAsset, emojiCache } from '../../utils/emojis.js';
import { itemsCatalog, classesCatalog, petsCatalog, achievementsCatalog } from '../../utils/catalog.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export async function runAssetSet(interaction: ChatInputCommandInteraction) {
  const type = interaction.options.getString('type', true);
  const id = interaction.options.getString('id', true).trim();
  const emojiInput = interaction.options.getString('emoji', true).trim();

  // Validate emoji format (custom Discord emoji format or standard Unicode emoji)
  const emojiRegex = /^(?:<a?:[a-zA-Z0-9_]+:[0-9]+>|[\p{Emoji}\u200d]+)$/u;
  if (!emojiRegex.test(emojiInput)) {
    const embed = errorEmbed(
      'Invalid Emoji Format',
      'Please provide a valid custom Discord emoji in the format `<:name:id>` or `<a:name:id>`, or a standard Unicode emoji.'
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Check if entity exists in catalogs to prevent typos
  let exists = false;
  if (type === 'item') {
    exists = itemsCatalog.some((i) => i.id === id);
  } else if (type === 'class') {
    exists = id === 'novice' || classesCatalog.some((c) => c.id === id);
  } else if (type === 'pet') {
    exists = petsCatalog.some((p) => p.id === id);
  } else if (type === 'achievement') {
    exists = achievementsCatalog.some((a) => a.id === id);
  } else if (type === 'currency') {
    exists = id === 'gold' || id === 'gems';
  }

  if (!exists) {
    const embed = errorEmbed(
      'Entity Not Found',
      `No **${type}** found with the ID **"${id}"** in the static catalog. Please check your spelling.`
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await setCustomAsset(id, type, emojiInput);

  const embed = successEmbed(
    'Asset Configuration Saved',
    `Successfully associated **${type}** ID \`${id}\` with custom asset ${emojiInput}.`
  );
  await interaction.editReply({ embeds: [embed] });
}

export async function runAssetRemove(interaction: ChatInputCommandInteraction) {
  const id = interaction.options.getString('id', true).trim();

  const cached = emojiCache.get(id);
  if (!cached) {
    const embed = errorEmbed('Asset Not Found', `No custom asset is configured for ID \`${id}\`.`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  await removeCustomAsset(id);

  const embed = successEmbed(
    'Asset Removed',
    `Successfully removed custom asset for ID \`${id}\` (was set to \`${cached.emoji}\`).`
  );
  await interaction.editReply({ embeds: [embed] });
}

export async function runAssetList(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  type: string,
  filter: string,
  page: number
) {
  const userId = interaction.user.id;
  const pageSize = 15;

  let allEntities: { id: string; name: string }[] = [];

  if (type === 'item') {
    allEntities = itemsCatalog.map((i) => ({ id: i.id, name: i.name }));
  } else if (type === 'class') {
    allEntities = [
      { id: 'novice', name: 'Novice' },
      ...classesCatalog.map((c) => ({ id: c.id, name: c.name }))
    ];
  } else if (type === 'pet') {
    allEntities = petsCatalog.map((p) => ({ id: p.id, name: p.name }));
  } else if (type === 'achievement') {
    allEntities = achievementsCatalog.map((a) => ({ id: a.id, name: a.name }));
  } else if (type === 'currency') {
    allEntities = [
      { id: 'gold', name: 'Gold' },
      { id: 'gems', name: 'Gems' }
    ];
  }

  const filteredEntities = allEntities.filter((entity) => {
    const hasAsset = emojiCache.has(entity.id);
    if (filter === 'configured') return hasAsset;
    if (filter === 'unconfigured') return !hasAsset;
    return true;
  });

  const totalItems = filteredEntities.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const activePage = Math.min(page, totalPages);
  const startIndex = (activePage - 1) * pageSize;
  const paginatedEntities = filteredEntities.slice(startIndex, startIndex + pageSize);

  const listLines = paginatedEntities.map((entity, idx) => {
    const num = (startIndex + idx + 1).toString().padStart(2, '0');
    const asset = emojiCache.get(entity.id);
    const assetDisplay = asset ? asset.emoji : '*(No custom asset)*';
    return `\`${num}\` **${entity.name}** \`(${entity.id})\` — ${assetDisplay}`;
  }).join('\n');

  const filterTitle = filter === 'configured' ? 'Configured' : filter === 'unconfigured' ? 'Unconfigured' : 'All';
  const description = `### Listing: ${filterTitle} ${type.toUpperCase()} Assets (${totalItems} total)\n\n` +
    (listLines || '*No entities found matching these criteria.*');

  const embed = new EmbedBuilder()
    .setTitle(`${type.toUpperCase()} Asset List`)
    .setDescription(description)
    .setColor(0x7C3AED)
    .setFooter({ text: `Arcanora Assets • Page ${activePage}/${totalPages}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`admin_assetlist_prev_${userId}_${type}_${filter}_${activePage - 1}`)
      .setLabel('Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage <= 1),
    new ButtonBuilder()
      .setCustomId(`admin_assetlist_next_${userId}_${type}_${filter}_${activePage + 1}`)
      .setLabel('Next')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(activePage >= totalPages)
  );

  await interaction.editReply({
    embeds: [embed],
    components: totalPages > 1 ? [row] : []
  });
}
