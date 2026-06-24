import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, equipItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
  .setName('equip')
  .setDescription('Equip an item from your bag.')
  .addStringOption((option) =>
    option
      .setName('item')
      .setDescription('Name or ID of the item to equip.')
      .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const inputName = interaction.options.getString('item', true).toLowerCase();

    // Fetch player inventory
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    const catalog = loadItemsCatalog();

    // Find the item
    const targetItem = dbInventory.find((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      if (!def) return false;
      return (
        def.id.toLowerCase() === inputName ||
        def.name.toLowerCase().includes(inputName)
      );
    });

    if (!targetItem) {
      const embed = errorEmbed('Item Not Found', `No item matching **"${inputName}"** was found in your bag.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const itemDef = catalog.find((i) => i.id === targetItem.itemId);
    if (!itemDef) {
      const embed = errorEmbed('Equip Error', 'Item catalog definition is missing.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const equipmentSlots = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory'];
    if (!equipmentSlots.includes(itemDef.type)) {
      const embed = errorEmbed('Invalid Item Type', `**${itemDef.name}** is a **${itemDef.type}** and cannot be equipped.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (player.level < itemDef.levelReq) {
      const embed = errorEmbed(
        'Level Required',
        `You must be Level **${itemDef.levelReq}** to equip **${itemDef.name}**. Current level: **Lv.${player.level}**.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (targetItem.equipped) {
      const embed = errorEmbed('Already Equipped', `**${itemDef.name}** is already equipped!`);
      await interaction.editReply({ embeds: [embed] });
      return;
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
    await interaction.editReply({ embeds: [embed] });

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

function loadItemsCatalog(): any[] {
  const filePath = join(process.cwd(), 'data', 'items.json');
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}
