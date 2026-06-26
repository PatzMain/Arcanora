import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { equipItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getNavButtons } from '../../utils/navigation.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

export async function runEquip(
  interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction,
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

export async function handleEquipInteraction(interaction: StringSelectMenuInteraction) {
  const parts = interaction.customId.split('_');
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const targetInventoryId = interaction.values[0]!;
  await runEquip(interaction, targetInventoryId);
}
