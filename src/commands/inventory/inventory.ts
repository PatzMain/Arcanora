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
import { getPlayerInventory, equipItem } from '../../database/queries/inventory.js';
import { sellItem } from '../../economy/shop.js';
import { computeStats } from '../../systems/progression/stats.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getNavButtons } from '../../utils/navigation.js';
import { successEmbed, errorEmbed, inventoryEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Manage your equipment, bag, and sell items.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('bag')
      .setDescription('View items in your bag.')
      .addIntegerOption((option) =>
        option
          .setName('page')
          .setDescription('Page number to view.')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('equip')
      .setDescription('Equip an item from your bag.')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Name or ID of the item to equip.')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('sell')
      .setDescription('Sell an item from your bag back to the NPC shop.')
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Name or ID of the item to sell.')
          .setRequired(false)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to sell (default: 1).')
          .setMinValue(1)
          .setRequired(false)
      )
  );

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'bag') {
    const page = interaction.options.getInteger('page') || 1;
    await runBag(interaction, page);
  } else if (subcommand === 'equip') {
    const item = interaction.options.getString('item') || undefined;
    await runEquip(interaction, item);
  } else if (subcommand === 'sell') {
    const item = interaction.options.getString('item') || undefined;
    const quantity = interaction.options.getInteger('quantity') || 1;
    await runSell(interaction, item, quantity);
  }
}

// ----------------------------------------------------
// RUNNERS (exposures for slash commands and buttons)
// ----------------------------------------------------

export async function runBag(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  pageNum?: number
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const currentPage = pageNum || 1;
    const pageSize = 10;
    const catalog = itemsCatalog;

    const invData = await getPlayerInventory(player.id, currentPage, pageSize);
    const mappedItems = invData.items.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      let name = def ? def.name : dbItem.itemId;
      if (dbItem.enhancement > 0) {
        name += ` +${dbItem.enhancement}`;
      }
      return {
        name,
        quantity: dbItem.quantity,
        rarity: def?.rarity || 'common',
        slot: dbItem.equipped ? (def?.type ? capitalize(def.type) : 'Equipped') : undefined
      };
    });
    const totalPages = Math.max(1, invData.totalPages);
    const embed = inventoryEmbed(mappedItems, currentPage, totalPages);

    // 1. Pagination Buttons
    const prevBtn = new ButtonBuilder()
      .setCustomId(`bag_prev_${player.discordId}_${currentPage - 1}`)
      .setLabel('◀️ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1);

    const nextBtn = new ButtonBuilder()
      .setCustomId(`bag_next_${player.discordId}_${currentPage + 1}`)
      .setLabel('Next ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages);

    const paginationRow = new ActionRowBuilder<ButtonBuilder>().addComponents(prevBtn, nextBtn);
    
    // 2. Navigation Actions Row (Equip, Sell, Shop)
    const navButtons = getNavButtons('inventory_bag', player.discordId);
    
    const components: any[] = [];
    if (totalPages > 1) {
      components.push(paginationRow);
    }
    if (navButtons) {
      components.push(navButtons);
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (error) {
    console.error('Error running bag:', error);
    const embed = errorEmbed('Bag Error', 'Failed to retrieve your bag contents.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runEquip(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  itemInput?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const catalog = itemsCatalog;

    const performEquip = async (targetInventoryId: string) => {
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, player.id));

      const targetItem = dbInventory.find((i) => i.id === targetInventoryId);
      if (!targetItem) {
        return { embeds: [errorEmbed('Item Not Found', `Selected item was not found in your bag.`)], components: [] };
      }

      const itemDef = catalog.find((i) => i.id === targetItem.itemId);
      if (!itemDef) {
        return { embeds: [errorEmbed('Equip Error', 'Item catalog definition is missing.')], components: [] };
      }

      const equipmentSlots = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory'];
      if (!equipmentSlots.includes(itemDef.type)) {
        return { embeds: [errorEmbed('Invalid Item Type', `**${itemDef.name}** is a **${itemDef.type}** and cannot be equipped.`)], components: [] };
      }

      if (player.level < itemDef.levelReq) {
        return { embeds: [errorEmbed(
          'Level Required',
          `You must be Level **${itemDef.levelReq}** to equip **${itemDef.name}**. Current level: **Lv.${player.level}**.`
        )], components: [] };
      }

      if (targetItem.equipped) {
        return { embeds: [errorEmbed('Already Equipped', `**${itemDef.name}** is already equipped!`)], components: [] };
      }

      // Stats Before
      const currentEquippedDb = dbInventory.filter((i) => i.equipped);
      const currentEquipped = currentEquippedDb.map((dbItem) => {
        const def = catalog.find((i) => i.id === dbItem.itemId);
        return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
      });
      const statsBefore = computeStats(player.level, player.prestige, player.playerClass, currentEquipped, null, []);

      // Stats After
      const afterEquipped = currentEquipped.filter((i) => i.slot !== itemDef.type);
      afterEquipped.push({
        slot: itemDef.type,
        rarity: itemDef.rarity,
        stats: itemDef.stats || {}
      });
      const statsAfter = computeStats(player.level, player.prestige, player.playerClass, afterEquipped, null, []);

      // Equip in DB
      await equipItem(player.id, targetItem.id, itemDef.type);

      const formatDelta = (before: number, after: number) => {
        const diff = after - before;
        if (diff === 0) return `\`${after}\``;
        const sign = diff > 0 ? '+' : '';
        return `\`${before} -> ${after} (${sign}${diff})\``;
      };

      const description =
        `You equipped **${itemDef.name}** into your **${itemDef.type}** slot.\n\n` +
        `**Stat Changes:**\n` +
        `⚔️ Attack: ${formatDelta(statsBefore.attack, statsAfter.attack)}\n` +
        `🛡️ Defense: ${formatDelta(statsBefore.defense, statsAfter.defense)}\n` +
        `❤️ Max HP: ${formatDelta(statsBefore.hpMax, statsAfter.hpMax)}\n` +
        `💧 Max Mana: ${formatDelta(statsBefore.manaMax, statsAfter.manaMax)}\n` +
        `💨 Speed: ${formatDelta(statsBefore.speed, statsAfter.speed)}\n` +
        `🍀 Luck: ${formatDelta(statsBefore.luck, statsAfter.luck)}`;

      const embed = successEmbed('Item Equipped', description);
      
      const navButtons = getNavButtons('craft_result', player.discordId);
      return { embeds: [embed], components: navButtons ? [navButtons] : [] };
    };

    if (itemInput) {
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, player.id));

      const targetItem = dbInventory.find((dbItem) => {
        if (dbItem.id === itemInput) return true;
        const def = catalog.find((i) => i.id === dbItem.itemId);
        if (!def) return false;
        return (
          def.id.toLowerCase() === itemInput.toLowerCase() ||
          def.name.toLowerCase().includes(itemInput.toLowerCase())
        );
      });

      if (!targetItem) {
        const embed = errorEmbed('Item Not Found', `No item matching **"${itemInput}"** was found in your bag.`);
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const payload = await performEquip(targetItem.id);
      await interaction.editReply(payload);
      return;
    }

    // No input: show select menu
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.playerId, player.id), eq(inventory.equipped, false)));

    const equipmentSlots = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory'];
    const equippables = dbInventory.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      if (def && equipmentSlots.includes(def.type)) {
        return { dbItem, def };
      }
      return null;
    }).filter(Boolean) as { dbItem: any; def: any }[];

    if (equippables.length === 0) {
      const embed = errorEmbed('No Equippables', 'You do not have any equippable items in your bag.');
      const navButtons = getNavButtons('craft_result', player.discordId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    const embed = successEmbed('Equip Gear', 'Select an item from the dropdown below to equip it.');
    embed.setColor(0x7C3AED);

    const selectMenuOptions = equippables.slice(0, 25).map((e) => {
      let label = e.def.name;
      if (e.dbItem.enhancement > 0) {
        label += ` +${e.dbItem.enhancement}`;
      }
      const statsText = Object.entries(e.def.stats || {})
        .map(([stat, val]) => `${stat.toUpperCase()} +${val}`)
        .join(', ');

      return {
        label,
        description: `[${e.def.type.toUpperCase()}] Req. Lv.${e.def.levelReq} | ${statsText || 'No stats'}`,
        value: e.dbItem.id
      };
    });

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`equip_select_${player.discordId}`)
        .setPlaceholder('🛡️ Choose an item to equip')
        .addOptions(selectMenuOptions)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [selectRow]
    });
  } catch (error) {
    console.error('Error running equip:', error);
    const embed = errorEmbed('Equip Error', 'Failed to equip the item.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runSell(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  itemInput?: string,
  quantityInput?: number
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const quantity = quantityInput || 1;
    const catalog = itemsCatalog;

    const performSell = async (targetInventoryId: string, sellQty: number) => {
      const result = await sellItem(player.id, targetInventoryId, sellQty);
      if (!result.success) {
        return { embeds: [errorEmbed('Sell Failed', result.message)], components: [] };
      }

      const dbItem = await db.query.inventory.findFirst({ where: eq(inventory.id, targetInventoryId) });
      const itemDef = catalog.find((i) => i.id === dbItem?.itemId);

      const embed = successEmbed(
        'Item Sold',
        `You successfully sold **x${sellQty}** **${itemDef?.name || 'Item'}** for 🪙 **${result.earned?.toLocaleString()}** Gold.\n\n` +
        `*NPC purchase rate is standard. Value was added directly to your pouch.*`
      );
      const navButtons = getNavButtons('economy_buy_result', player.discordId);
      return { embeds: [embed], components: navButtons ? [navButtons] : [] };
    };

    if (itemInput) {
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, player.id));

      const targetItem = dbInventory.find((dbItem) => {
        if (dbItem.equipped) return false;
        if (dbItem.id === itemInput) return true;
        const def = catalog.find((i) => i.id === dbItem.itemId);
        if (!def) return false;
        return (
          def.id.toLowerCase() === itemInput.toLowerCase() ||
          def.name.toLowerCase().includes(itemInput.toLowerCase())
        );
      });

      if (!targetItem) {
        const embed = errorEmbed('Item Not Found', `No sellable item matching **"${itemInput}"** was found in your bag.`);
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const itemDef = catalog.find((i) => i.id === targetItem.itemId);
      if (itemDef && itemDef.sellPrice <= 0) {
        const embed = errorEmbed('Not Sellable', `**${itemDef.name}** cannot be sold back to the shop.`);
        await interaction.editReply({ embeds: [embed], components: [] });
        return;
      }

      const payload = await performSell(targetItem.id, quantity);
      await interaction.editReply(payload);
      return;
    }

    // No input: show select menu of sellable items
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.playerId, player.id), eq(inventory.equipped, false)));

    const sellables = dbInventory.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      if (def && def.sellPrice > 0) {
        return { dbItem, def };
      }
      return null;
    }).filter(Boolean) as { dbItem: any; def: any }[];

    if (sellables.length === 0) {
      const embed = errorEmbed('No Sellables', 'You do not have any sellable items in your bag.');
      const navButtons = getNavButtons('economy_shop', player.discordId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    const embed = successEmbed('Sell Gear', 'Select an item from the dropdown below to sell it (1x).');
    embed.setColor(0xFBBF24);

    const selectMenuOptions = sellables.slice(0, 25).map((s) => {
      let label = `${s.def.name} (x${s.dbItem.quantity})`;
      if (s.dbItem.enhancement > 0) {
        label += ` +${s.dbItem.enhancement}`;
      }
      return {
        label,
        description: `Sell price: ${s.def.sellPrice}g each | [${s.def.type.toUpperCase()}]`,
        value: s.dbItem.id
      };
    });

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`sell_select_${player.discordId}`)
        .setPlaceholder('💰 Choose an item to sell')
        .addOptions(selectMenuOptions)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [selectRow]
    });
  } catch (error) {
    console.error('Error running sell:', error);
    const embed = errorEmbed('Sell Error', 'Failed to sell the item.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

// ----------------------------------------------------
// INTERACTION HANDLERS (routed from interactionCreate)
// ----------------------------------------------------

export async function handleBagInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // bag_prev_{userId}_{page} or bag_next_{userId}_{page}
  const userId = parts[2];
  const targetPage = parseInt(parts[3] || '1');

  if (interaction.user.id !== userId) {
    return; // checked at ready/interactionCreate level, but safe fallback
  }

  await runBag(interaction, targetPage);
}

export async function handleEquipInteraction(interaction: StringSelectMenuInteraction) {
  // equip_select_{userId}
  const parts = interaction.customId.split('_');
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const targetInventoryId = interaction.values[0]!;
  
  // Directly execute performEquip inline via runEquip wrapper using the ID
  // Wait, runEquip expects an input name. We can pass a function or performEquip inside runEquip.
  // Actually, let's just make runEquip handle targetInventoryId directly if we can detect it.
  // We can check if it is a UUID (UUID is 36 chars) or simply fetch and equip.
  // To keep it clean, if the itemInput is a UUID (like inventory ID), we can match directly in runEquip:
  await runEquip(interaction, targetInventoryId);
}

export async function handleSellInteraction(interaction: StringSelectMenuInteraction) {
  // sell_select_{userId}
  const parts = interaction.customId.split('_');
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const targetInventoryId = interaction.values[0]!;
  await runSell(interaction, targetInventoryId, 1);
}
