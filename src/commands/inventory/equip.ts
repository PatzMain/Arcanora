import { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, equipItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('equip')
  .setDescription('Equip an item from your bag.')
  .addStringOption((option) =>
    option
      .setName('item')
      .setDescription('Name or ID of the item to equip.')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const inputName = interaction.options.getString('item');
    const catalog = itemsCatalog;

    const runEquip = async (targetInventoryId: string) => {
      // Fetch player inventory
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

      // 1. Calculate Stats Before
      const currentEquippedDb = dbInventory.filter((i) => i.equipped);
      const currentEquipped = currentEquippedDb.map((dbItem) => {
        const def = catalog.find((i) => i.id === dbItem.itemId);
        return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
      });
      const statsBefore = computeStats(player.level, player.prestige, player.playerClass, currentEquipped, null, []);

      // 2. Calculate Stats After (Simulated swap)
      const afterEquipped = currentEquipped.filter((i) => i.slot !== itemDef.type);
      afterEquipped.push({
        slot: itemDef.type,
        rarity: itemDef.rarity,
        stats: itemDef.stats || {}
      });
      const statsAfter = computeStats(player.level, player.prestige, player.playerClass, afterEquipped, null, []);

      // 3. Equip in DB
      await equipItem(player.id, targetItem.id, itemDef.type);

      // Format delta preview
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
      return { embeds: [embed], components: [] };
    };

    if (inputName) {
      // Fetch player inventory
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(eq(inventory.playerId, player.id));

      // Find the item
      const targetItem = dbInventory.find((dbItem) => {
        const def = catalog.find((i) => i.id === dbItem.itemId);
        if (!def) return false;
        return (
          def.id.toLowerCase() === inputName.toLowerCase() ||
          def.name.toLowerCase().includes(inputName.toLowerCase())
        );
      });

      if (!targetItem) {
        const embed = errorEmbed('Item Not Found', `No item matching **"${inputName}"** was found in your bag.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const payload = await runEquip(targetItem.id);
      await interaction.editReply(payload);
      return;
    }

    // No item name provided: show select menu of all equippable items in bag
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
      await interaction.editReply({ embeds: [embed] });
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
        .setCustomId('equip_select')
        .setPlaceholder('🛡️ Choose an item to equip')
        .addOptions(selectMenuOptions)
    );

    const response = await interaction.editReply({
      embeds: [embed],
      components: [selectRow]
    });

    try {
      const selectInteraction = await response.awaitMessageComponent({
        filter: (i) => i.user.id === interaction.user.id,
        time: 60_000,
        componentType: ComponentType.StringSelect
      });

      const selectedInventoryId = selectInteraction.values[0]!;
      const equipResult = await runEquip(selectedInventoryId);
      await selectInteraction.update(equipResult);
    } catch (e) {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('equip_select')
        .setPlaceholder('Equip selection timed out')
        .setDisabled(true)
        .addOptions({ label: 'Timed out', value: 'timeout' });
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
      try {
        await interaction.editReply({ components: [disabledRow] });
      } catch {}
    }

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Equip Error', 'Failed to equip the item.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}


