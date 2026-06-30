import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getCodexEntries, getCodexEntry } from '../../database/queries/codex.js';
import { enemiesCatalog, itemsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { baseEmbed, COLORS, DIVIDER, DIVIDER_SHORT, capitalize } from '../../utils/embeds/base.js';
import { getItemEmoji, getCurrencyEmoji } from '../../utils/emojis.js';
import { buildNavId } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('codex')
  .setDescription('Browse your discovered enemies, items, and locations.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('enemies')
      .setDescription('Browse the bestiary of enemies you have encountered.')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view.')
          .setMinValue(1)
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('inspect')
          .setDescription('ID or name of an enemy to inspect.')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('items')
      .setDescription('Browse the database of items you have acquired.')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view.')
          .setMinValue(1)
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('inspect')
          .setDescription('ID or name of an item to inspect.')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('locations')
      .setDescription('Browse the world map locations you have discovered.')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view.')
          .setMinValue(1)
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName('inspect')
          .setDescription('ID or name of a location to inspect.')
          .setRequired(false)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  const page = interaction.options.getInteger('page') || 1;
  const inspect = interaction.options.getString('inspect');

  const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

  if (inspect) {
    await renderInspect(interaction, player.id, player.discordId, subcommand as any, inspect);
  } else {
    await renderList(interaction, player.id, player.discordId, subcommand as any, page);
  }
}

async function renderInspect(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  playerId: string,
  discordId: string,
  type: 'enemies' | 'items' | 'locations',
  inspectValue: string
) {
  const embed = baseEmbed();

  if (type === 'enemies') {
    const enemy = enemiesCatalog.find(
      (e) => e.id === inspectValue || e.name.toLowerCase() === inspectValue.toLowerCase()
    );

    if (!enemy) {
      embed.setColor(COLORS.DANGER).setTitle('❌ Enemy Not Found').setDescription(`Could not find an enemy matching "${inspectValue}".`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const codexEntry = await getCodexEntry(playerId, 'enemy', enemy.id);
    if (!codexEntry) {
      embed.setColor(COLORS.WARNING)
        .setTitle(`🔒 Bestiary: ???`)
        .setDescription(
          `You have not discovered this enemy yet!\n\n` +
          `*Defeat Lv.${enemy.level} **${enemy.name}** in combat to unlock its bestiary entry.*`
        );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const rarityBadge = enemy.rarity === 'boss' ? '🔴 Boss' : (enemy.rarity === 'rare' ? '🟡 Elite' : '⚪ Normal');
    const abilitiesStr = enemy.abilities.length > 0
      ? enemy.abilities.map((a: any) => `• **${a.name}** (${a.chance}% chance)`).join('\n')
      : '• Basic Attack only';

    const dropsStr = enemy.lootTable.length > 0
      ? enemy.lootTable
          .map((l: any) => {
            const item = itemsCatalog.find((i) => i.id === l.itemId);
            return `• **${item ? item.name : capitalize(l.itemId)}** (${l.dropRate}% chance)`;
          })
          .join('\n')
      : '• No drops';

    embed
      .setColor(enemy.rarity === 'boss' ? COLORS.DANGER : (enemy.rarity === 'rare' ? COLORS.WARNING : COLORS.PRIMARY))
      .setTitle(`📖 Bestiary: ${enemy.name}`)
      .setDescription(
        `${DIVIDER}\n` +
        `*"${enemy.description}"*\n\n` +
        `**Rarity:** ${rarityBadge}\n` +
        `**Base Level:** ${enemy.level}\n` +
        `**Defeated Count:** ${codexEntry.killCount} times\n\n` +
        `─── 📊 **Base Stats** ───\n` +
        `❤️ **HP:** ${enemy.stats.hp}  |  ⚔️ **ATK:** ${enemy.stats.attack}  |  🛡️ **DEF:** ${enemy.stats.defense}  |  ⚡ **SPD:** ${enemy.stats.speed}\n\n` +
        `─── ✨ **Abilities** ───\n` +
        `${abilitiesStr}\n\n` +
        `─── 🎁 **Possible Drops** ───\n` +
        `${dropsStr}`
      );

  } else if (type === 'items') {
    const item = itemsCatalog.find(
      (i) => i.id === inspectValue || i.name.toLowerCase() === inspectValue.toLowerCase()
    );

    if (!item) {
      embed.setColor(COLORS.DANGER).setTitle('❌ Item Not Found').setDescription(`Could not find an item matching "${inspectValue}".`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const codexEntry = await getCodexEntry(playerId, 'item', item.id);
    if (!codexEntry) {
      embed.setColor(COLORS.WARNING)
        .setTitle(`🔒 Codex: ???`)
        .setDescription(
          `You have not discovered this item yet!\n\n` +
          `*Acquire **${item.name}** through combat, crafting, or buying it from shops to unlock its entry.*`
        );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const emoji = getItemEmoji(item.id, item.rarity);
    let statsStr = '';
    if (item.stats) {
      statsStr = Object.entries(item.stats)
        .map(([k, v]) => `• **${capitalize(k)}**: +${v}`)
        .join('\n');
    }

    embed
      .setColor(COLORS.GOLD)
      .setTitle(`${emoji} Item Codex: ${item.name}`)
      .setDescription(
        `${DIVIDER}\n` +
        `*"${item.description || 'No description available.'}"*\n\n` +
        `**Type:** ${capitalize(item.type)}  |  **Rarity:** ${capitalize(item.rarity)}\n` +
        `**Required Level:** ${item.levelReq || 1}\n` +
        `**Times Acquired:** ${codexEntry.foundCount}\n\n` +
        `─── 📈 **Item Bonuses** ───\n` +
        `${statsStr || '• None'}\n\n` +
        `─── 🪙 **NPC Shop Value** ───\n` +
        `• **Buy Price:** ${getCurrencyEmoji('gold')} ${item.buyPrice?.toLocaleString() || 'N/A'}\n` +
        `• **Sell Price:** ${getCurrencyEmoji('gold')} ${item.sellPrice?.toLocaleString() || 'N/A'}\n\n` +
        `─── ⚙️ **Durability** ───\n` +
        `• **Max Durability:** ${item.maxDurability || 'N/A'}`
      );

  } else if (type === 'locations') {
    const loc = zonesCatalog.find(
      (z) => z.id === inspectValue || z.name.toLowerCase() === inspectValue.toLowerCase()
    );

    if (!loc) {
      embed.setColor(COLORS.DANGER).setTitle('❌ Location Not Found').setDescription(`Could not find a location matching "${inspectValue}".`);
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const codexEntry = await getCodexEntry(playerId, 'location', loc.id);
    if (!codexEntry) {
      embed.setColor(COLORS.WARNING)
        .setTitle(`🔒 Location Codex: ???`)
        .setDescription(
          `You have not discovered this location yet!\n\n` +
          `*Travel to or discover **${loc.name}** via the world map to unlock.*`
        );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const npcStr = loc.social?.npcs && loc.social.npcs.length > 0
      ? loc.social.npcs.map((n: any) => `• **${capitalize(n.replace(/_/g, ' '))}**`).join('\n')
      : '• None';

    const creaturesStr = loc.enemies && loc.enemies.length > 0
      ? loc.enemies.map((e: any) => `• **${capitalize(e.replace(/_/g, ' '))}**`).join('\n')
      : '• None';

    const resourcesStr = loc.ecosystem?.resources && loc.ecosystem.resources.length > 0
      ? loc.ecosystem.resources.map((r: any) => `• **${capitalize(r.replace(/_/g, ' '))}**`).join('\n')
      : '• None';

    embed
      .setColor(COLORS.INFO)
      .setTitle(`🗺️ Location Codex: ${loc.name}`)
      .setDescription(
        `${DIVIDER}\n` +
        `📍 **Region:** ${loc.region || 'Kingdom of Eldoria'}  |  **Area:** ${loc.area || 'Eldoria Foothills'}\n` +
        `**Type:** ${capitalize(loc.type || (loc.isDungeon ? 'dungeon' : 'zone'))}\n` +
        `**Min Level:** ${loc.minLevel}  |  **Travel Cooldown:** ${loc.explorationCooldown}s\n\n` +
        `*"${loc.description || ''}"*\n\n` +
        `─── 🏘️ **Settlement Details** ───\n` +
        `• **Rest House:** ${loc.hasRestBed ? '✅ Yes (Free Recovery)' : '❌ No'}\n` +
        `• **Local NPCs:**\n${npcStr}\n\n` +
        `─── 🐉 **Creatures Spotted** ───\n` +
        `${creaturesStr}\n\n` +
        `─── 🪵 **Gatherable Resources** ───\n` +
        `${resourcesStr}`
      );
  }

  const backBtn = new ButtonBuilder()
    .setCustomId(`codex_back_${discordId}_${type}_1`)
    .setLabel('Back to List')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🔙');

  const mapBtn = new ButtonBuilder()
    .setCustomId(buildNavId('player_map', discordId))
    .setLabel('Open Map')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗺️');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backBtn, mapBtn);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function renderList(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
  playerId: string,
  discordId: string,
  type: 'enemies' | 'items' | 'locations',
  page: number
) {
  const pageSize = 10;
  const embed = baseEmbed();
  const components: any[] = [];

  if (type === 'enemies') {
    const catalog = enemiesCatalog;
    const entries = await getCodexEntries(playerId, 'enemy');
    const discoveredIds = new Set(entries.map((e) => e.entityId));
    const entriesMap = new Map(entries.map((e) => [e.entityId, e]));

    const totalCount = catalog.length;
    const discoveredCount = entries.length;
    const pct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.max(1, Math.min(totalPages, page));

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = catalog.slice(startIdx, startIdx + pageSize);

    const listLines = pageItems.map((e, idx) => {
      const isDiscovered = discoveredIds.has(e.id);
      const indexStr = `\`${(startIdx + idx + 1).toString().padStart(2, '0')}\``;
      
      if (isDiscovered) {
        const entry = entriesMap.get(e.id)!;
        const rarityBadge = e.rarity === 'boss' ? '🔴' : (e.rarity === 'rare' ? '🟡' : '⚪');
        return `${indexStr} ${rarityBadge} **${e.name}** (Lv.${e.level}) — Slain: **${entry.killCount}**`;
      } else {
        return `${indexStr} 🔒 **???** (Base Lv. ${e.level})`;
      }
    });

    embed
      .setColor(COLORS.PRIMARY)
      .setTitle('📖 Codex: Bestiary')
      .setDescription(
        `${DIVIDER}\n` +
        `🧬 **Completion:** **${discoveredCount}** / **${totalCount}** (${pct}%)\n` +
        `${DIVIDER_SHORT}\n` +
        (listLines.length > 0 ? listLines.join('\n') : '*No enemies in registry.*')
      )
      .setFooter({ text: `Arcanora — Bestiary • Page ${currentPage}/${totalPages}` });

    // Build select menu of discovered enemies on the page
    const discoveredOnPage = pageItems.filter((e) => discoveredIds.has(e.id));
    if (discoveredOnPage.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`codex_inspect_select_${discordId}_enemies`)
        .setPlaceholder('🔍 Inspect a discovered enemy...')
        .addOptions(
          discoveredOnPage.map((e) => {
            const entry = entriesMap.get(e.id)!;
            return {
              label: e.name,
              description: `Lv.${e.level} • Slain: ${entry.killCount} times`,
              value: e.id,
              emoji: e.rarity === 'boss' ? '🔴' : (e.rarity === 'rare' ? '🟡' : '⚪')
            };
          })
        );
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    // Pagination row
    const pageButtons = buildPaginationButtons(discordId, 'enemies', currentPage, totalPages);
    if (pageButtons) components.push(pageButtons);

  } else if (type === 'items') {
    const catalog = itemsCatalog;
    const entries = await getCodexEntries(playerId, 'item');
    const discoveredIds = new Set(entries.map((e) => e.entityId));
    const entriesMap = new Map(entries.map((e) => [e.entityId, e]));

    const totalCount = catalog.length;
    const discoveredCount = entries.length;
    const pct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.max(1, Math.min(totalPages, page));

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = catalog.slice(startIdx, startIdx + pageSize);

    const listLines = pageItems.map((item, idx) => {
      const isDiscovered = discoveredIds.has(item.id);
      const indexStr = `\`${(startIdx + idx + 1).toString().padStart(2, '0')}\``;
      const emoji = getItemEmoji(item.id, item.rarity);

      if (isDiscovered) {
        const entry = entriesMap.get(item.id)!;
        return `${indexStr} ${emoji} **${item.name}** (${capitalize(item.rarity)}) — Found: **${entry.foundCount}**`;
      } else {
        return `${indexStr} 🔒 **???** (${capitalize(item.rarity)})`;
      }
    });

    embed
      .setColor(COLORS.GOLD)
      .setTitle('🎒 Codex: Items')
      .setDescription(
        `${DIVIDER}\n` +
        `📦 **Completion:** **${discoveredCount}** / **${totalCount}** (${pct}%)\n` +
        `${DIVIDER_SHORT}\n` +
        (listLines.length > 0 ? listLines.join('\n') : '*No items in registry.*')
      )
      .setFooter({ text: `Arcanora — Item Codex • Page ${currentPage}/${totalPages}` });

    // Build select menu of discovered items on the page
    const discoveredOnPage = pageItems.filter((i) => discoveredIds.has(i.id));
    if (discoveredOnPage.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`codex_inspect_select_${discordId}_items`)
        .setPlaceholder('🔍 Inspect a discovered item...')
        .addOptions(
          discoveredOnPage.map((i) => {
            const entry = entriesMap.get(i.id)!;
            const emoji = getItemEmoji(i.id, i.rarity);
            return {
              label: i.name,
              description: `${capitalize(i.rarity)} • Found: ${entry.foundCount} times`,
              value: i.id,
              emoji: emoji
            };
          })
        );
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    // Pagination row
    const pageButtons = buildPaginationButtons(discordId, 'items', currentPage, totalPages);
    if (pageButtons) components.push(pageButtons);

  } else if (type === 'locations') {
    const catalog = zonesCatalog;
    const entries = await getCodexEntries(playerId, 'location');
    const discoveredIds = new Set(entries.map((e) => e.entityId));

    const totalCount = catalog.length;
    const discoveredCount = entries.length;
    const pct = totalCount > 0 ? Math.round((discoveredCount / totalCount) * 100) : 0;

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.max(1, Math.min(totalPages, page));

    const startIdx = (currentPage - 1) * pageSize;
    const pageItems = catalog.slice(startIdx, startIdx + pageSize);

    const listLines = pageItems.map((loc, idx) => {
      const isDiscovered = discoveredIds.has(loc.id);
      const indexStr = `\`${(startIdx + idx + 1).toString().padStart(2, '0')}\``;
      
      if (isDiscovered) {
        return `${indexStr} 🗺️ **${loc.name}** (Min Lv. ${loc.minLevel}) — *Discovered*`;
      } else {
        return `${indexStr} 🔒 **???** (Min Lv. ${loc.minLevel})`;
      }
    });

    embed
      .setColor(COLORS.INFO)
      .setTitle('🗺️ Codex: Locations')
      .setDescription(
        `${DIVIDER}\n` +
        `📍 **Completion:** **${discoveredCount}** / **${totalCount}** (${pct}%)\n` +
        `${DIVIDER_SHORT}\n` +
        (listLines.length > 0 ? listLines.join('\n') : '*No locations in registry.*')
      )
      .setFooter({ text: `Arcanora — Location Codex • Page ${currentPage}/${totalPages}` });

    // Build select menu of discovered locations on the page
    const discoveredOnPage = pageItems.filter((z) => discoveredIds.has(z.id));
    if (discoveredOnPage.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`codex_inspect_select_${discordId}_locations`)
        .setPlaceholder('🔍 Inspect a discovered location...')
        .addOptions(
          discoveredOnPage.map((z) => {
            return {
              label: z.name,
              description: `${capitalize(z.type || 'Zone')} • Min Level: ${z.minLevel}`,
              value: z.id,
              emoji: '🗺️'
            };
          })
        );
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu));
    }

    // Pagination row
    const pageButtons = buildPaginationButtons(discordId, 'locations', currentPage, totalPages);
    if (pageButtons) components.push(pageButtons);
  }

  // Add map button always
  const mapBtn = new ButtonBuilder()
    .setCustomId(buildNavId('player_map', discordId))
    .setLabel('Open Map')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🗺️');

  if (components.length > 0 && components[components.length - 1] instanceof ActionRowBuilder) {
    const lastRow = components[components.length - 1] as ActionRowBuilder<any>;
    if (lastRow.components.length < 5 && lastRow.components[0] instanceof ButtonBuilder) {
      lastRow.addComponents(mapBtn);
    } else {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(mapBtn));
    }
  } else {
    components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(mapBtn));
  }

  await interaction.editReply({ embeds: [embed], components });
}

function buildPaginationButtons(
  discordId: string,
  type: 'enemies' | 'items' | 'locations',
  currentPage: number,
  totalPages: number
): ActionRowBuilder<ButtonBuilder> | null {
  if (totalPages <= 1) return null;

  const prevBtn = new ButtonBuilder()
    .setCustomId(`codex_page_${discordId}_${type}_${currentPage - 1}`)
    .setLabel('◀️ Previous')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage <= 1);

  const nextBtn = new ButtonBuilder()
    .setCustomId(`codex_page_${discordId}_${type}_${currentPage + 1}`)
    .setLabel('Next ▶️')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(currentPage >= totalPages);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
}

export async function handleCodexInteraction(
  interaction: ButtonInteraction | StringSelectMenuInteraction
) {
  const parts = interaction.customId.split('_'); // codex_page_{userId}_{type}_{page} or codex_back_{userId}_{type}_{page} or codex_inspect_select_{userId}_{type}
  const action = parts[1];
  const discordId = parts[2];
  const type = parts[3] as 'enemies' | 'items' | 'locations';

  if (interaction.user.id !== discordId) {
    return;
  }

  await interaction.deferUpdate();
  const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

  if (action === 'page' || action === 'back') {
    const targetPage = parseInt(parts[4] || '1', 10);
    await renderList(interaction, player.id, player.discordId, type, targetPage);
  } else if (action === 'inspect' && interaction.isStringSelectMenu()) {
    const selectedId = interaction.values[0]!;
    await renderInspect(interaction, player.id, player.discordId, type, selectedId);
  }
}
