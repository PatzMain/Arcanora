import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, addItem, removeItem } from '../../database/queries/inventory.js';
import { computeStats } from '../../systems/progression/stats.js';
import { loadRecipes, canCraft, executeCraft } from '../../systems/crafting.js';
import { checkLevelUp } from '../../systems/progression/leveling.js';
import { updatePlayerLevel } from '../../database/queries/player.js';
import { db } from '../../database/client.js';
import { inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const data = new SlashCommandBuilder()
  .setName('craft')
  .setDescription('View crafting recipes or craft an item.')
  .addStringOption((option) =>
    option
      .setName('recipe')
      .setDescription('ID of the recipe to craft (e.g. recipe_iron_helmet).')
      .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    const recipeId = interaction.options.getString('recipe');
    const recipes = loadRecipes();

    // 1. If no recipe specified, list available recipes
    if (!recipeId) {
      // Get player inventory to show how many materials they have
      const dbInventory = await db
        .select()
        .from(inventory)
        .where(and(eq(inventory.playerId, player.id), eq(inventory.equipped, false)));

      const catalog = loadItemsCatalog();

      const available = recipes.filter((r) => player.level >= r.levelReq);

      let description = '';
      if (available.length > 0) {
        description = available
          .map((r) => {
            const resultItem = catalog.find((i) => i.id === r.resultItemId);
            const resultName = resultItem ? resultItem.name : r.resultItemId;

            const materialLines = r.materials.map((m) => {
              const itemDef = catalog.find((i) => i.id === m.itemId);
              const name = itemDef ? itemDef.name : m.itemId;
              const owned = dbInventory.filter((inv) => inv.itemId === m.itemId).reduce((sum, inv) => sum + inv.quantity, 0);
              const checkIcon = owned >= m.quantity ? '✅' : '❌';
              return `   ${checkIcon} ${name}: **${owned}/${m.quantity}**`;
            }).join('\n');

            return (
              `🛠️ **${r.name}** \`(ID: ${r.id})\`\n` +
              `   Creates: **${resultName}** x${r.resultQuantity}\n` +
              `   Success Rate: **${r.successRate}%** | Exp: +**${r.craftingExpReward}**\n` +
              `   **Required Materials:**\n${materialLines}`
            );
          })
          .join('\n\n');
      } else {
        description = '*You do not have any recipes unlocked yet. Reach a higher level!*';
      }

      const embed = successEmbed('Crafting Catalog', description);
      embed.setColor(0x7C3AED); // Purple primary
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 2. Recipe specified: Execute crafting
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) {
      const embed = errorEmbed('Recipe Not Found', `No recipe matching ID **"${recipeId}"** was found.`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Fetch player inventory
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    // Check if player can craft
    const craftCheck = canCraft(recipe, player.level, dbInventory);

    if (!craftCheck.canCraft) {
      if (player.level < recipe.levelReq) {
        const embed = errorEmbed('Recipe Locked', `You must be Level **${recipe.levelReq}** to craft this.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const catalog = loadItemsCatalog();
      const missingLines = craftCheck.missingMaterials.map((m) => {
        const itemDef = catalog.find((i) => i.id === m.itemId);
        const name = itemDef ? itemDef.name : m.itemId;
        return `• **${name}**: Need ${m.need}, Have ${m.have} (Missing **${m.need - m.have}**)`;
      }).join('\n');

      const embed = errorEmbed('Missing Materials', `You do not have enough materials to craft **${recipe.name}**:\n\n${missingLines}`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Load player stats to use luck for quality roll
    const equippedDbItems = dbInventory.filter((i) => i.equipped);
    const catalog = loadItemsCatalog();
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    // Deduct materials (atomic loops)
    for (const material of recipe.materials) {
      let needed = material.quantity;
      const stacks = dbInventory.filter((i) => i.itemId === material.itemId && !i.equipped);

      for (const stack of stacks) {
        if (needed <= 0) break;
        const toRemove = Math.min(stack.quantity, needed);
        await removeItem(player.id, stack.id, toRemove);
        needed -= toRemove;
      }
    }

    // Execute craft
    const result = executeCraft(recipe, stats.luck);

    if (!result.success) {
      // Award 20% pity experience
      const expReward = Math.max(1, Math.round(recipe.craftingExpReward * 0.2));
      const check = checkLevelUp(player.level, player.exp + expReward);
      await updatePlayerLevel(player.id, check.newLevel, check.remainingExp);

      let failDesc = `You failed to craft **${recipe.name}** and lost the materials.\n\n` +
        `✨ Gained **+${expReward}** pity EXP.`;
      if (check.levelsGained > 0) {
        failDesc += `\n🎉 **LEVEL UP!** You reached **Level ${check.newLevel}**!`;
      }

      const embed = errorEmbed('Crafting Failed', failDesc);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Success: add item & award full experience
    const resultItemDef = catalog.find((i) => i.id === result.resultItemId);
    const resultName = resultItemDef ? resultItemDef.name : result.resultItemId;

    await addItem(player.id, result.resultItemId, result.resultQuantity);

    const check = checkLevelUp(player.level, player.exp + recipe.craftingExpReward);
    await updatePlayerLevel(player.id, check.newLevel, check.remainingExp);

    let successDesc = `🎉 Successfully crafted **x${result.resultQuantity}** **${resultName}**!\n` +
      `🏅 Quality Roll: **${result.quality.toUpperCase()}**\n\n` +
      `✨ Gained **+${recipe.craftingExpReward}** EXP.`;

    if (result.quality === 'perfect') {
      successDesc += `\n*Perfect craft! Double yield bonus applied.*`;
    }

    if (check.levelsGained > 0) {
      successDesc += `\n\n🎉 **LEVEL UP!** You reached **Level ${check.newLevel}**!`;
    }

    const embed = successEmbed('Crafting Success', successDesc);
    embed.setColor(0x10B981); // Green success
    await interaction.editReply({ embeds: [embed] });

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Crafting Error', 'An unexpected error occurred during crafting.');
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
