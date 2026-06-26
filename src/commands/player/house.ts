import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, inventory, cooldowns } from '../../database/schema.js';
import { getAndUpdatePlayerStamina } from '../../database/queries/player.js';
import { removeItem, getEquippedItems } from '../../database/queries/inventory.js';
import { itemsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { computeStats } from '../../systems/progression/stats.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { getNavButtons } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('house')
  .setDescription('Enter and manage your private player cottage.');

const REST_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes

// Housing upgrades definitions
const UPGRADES = [
  {
    tier: 1,
    name: 'Rustic Shack',
    costGold: 0,
    materials: [],
    plots: 2,
    bedBonus: 5,
    storageSlots: 10
  },
  {
    tier: 2,
    name: 'Cozy Cottage',
    costGold: 1500,
    materials: [
      { itemId: 'mat_birch_logs', quantity: 20 },
      { itemId: 'mat_copper_ore', quantity: 10 }
    ],
    plots: 4,
    bedBonus: 10,
    storageSlots: 25
  },
  {
    tier: 3,
    name: 'Stone Homestead',
    costGold: 5000,
    materials: [
      { itemId: 'mat_oak_logs', quantity: 50 },
      { itemId: 'mat_iron_ore', quantity: 50 }
    ],
    plots: 8,
    bedBonus: 20,
    storageSlots: 50
  }
];

export async function execute(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply();
  }

  try {
    const player = await getAndUpdatePlayerStamina(interaction.user.id);
    if (!player) {
      const err = errorEmbed('Error', 'Player profile not found. Please complete the /tutorial first.');
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const TOWN_ZONE_IDS = ['cozy_tavern', 'oakhaven_square', 'oakhaven_forge', 'apothecary', 'river_docks'];
    if (!TOWN_ZONE_IDS.includes(player.currentZoneId)) {
      const err = errorEmbed(
        'Too Far Away',
        `You cannot access your private cottage from **${zonesCatalog.find(z => z.id === player.currentZoneId)?.name || player.currentZoneId}**.\n\nTravel back to **Oakhaven Hamlet** to visit your home.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    if (player.housingTier === 0) {
      const err = errorEmbed(
        'Cottage Locked',
        'You do not own a house yet! Complete the tutorial quests with Silas and Captain Vaelen to receive your **House Key**.'
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const currentUpgrade = UPGRADES.find(u => u.tier === player.housingTier) || UPGRADES[0]!;
    const nextUpgrade = UPGRADES.find(u => u.tier === player.housingTier + 1);

    const embed = new EmbedBuilder()
      .setColor(0x8B5A2B)
      .setTitle(`🏡 Your Private Estate: ${currentUpgrade.name}`)
      .setDescription(
        `Welcome back to your private sanctuary, **${player.username}**.\n\n` +
        `ℹ️ **Estate Details:**\n` +
        `▪️ Cottage Tier: **Tier ${player.housingTier}**\n` +
        `▪️ Max Farm Plots: **🌱 ${currentUpgrade.plots} plots**\n` +
        `▪️ Storage Vault: **📦 ${currentUpgrade.storageSlots} slots**\n` +
        `▪️ Rest Bed HP Bonus: **💖 +${currentUpgrade.bedBonus}%**`
      )
      .addFields({
        name: '🛏️ Sleep in Cozy Bed',
        value: 'Resting in your bed will fully restore your HP, Mana, and Stamina, granting you comfort bonuses.'
      });

    if (nextUpgrade) {
      const matLines = nextUpgrade.materials.map(m => {
        const itemDef = itemsCatalog.find(i => i.id === m.itemId);
        return `▫️ ${itemDef?.name || m.itemId}: x${m.quantity}`;
      });
      embed.addFields({
        name: `🔨 Next Upgrade: ${nextUpgrade.name} (Tier ${nextUpgrade.tier})`,
        value: `**Cost:** 🪙 ${nextUpgrade.costGold.toLocaleString()} Gold\n**Materials:**\n${matLines.join('\n') || 'None'}`
      });
    } else {
      embed.addFields({
        name: '🏆 Max Upgrade Reached',
        value: 'Your homestead is at the absolute peak tier! Enjoy your legendary private estate.'
      });
    }

    // Build buttons
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`house_rest_${player.id}`)
        .setLabel('🛏️ Sleep in Bed')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`house_upgrade_${player.id}`)
        .setLabel('🔨 Upgrade Estate')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!nextUpgrade)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

  } catch (error) {
    console.error('Error in house command:', error);
    const err = errorEmbed('Housing Error', 'Failed to retrieve your housing cottage.');
    await interaction.editReply({ embeds: [err] });
  }
}

// Handler for buttons inside /house
export async function handleHouseInteraction(interaction: ButtonInteraction, parts: string[]) {
  const action = parts[1];
  const targetPlayerId = parts[2];

  if (interaction.user.id !== interaction.message.interaction?.user.id && interaction.user.id !== interaction.message.mentions.users.first()?.id) {
    // Check if it's the invoker
    await interaction.reply({ content: '❌ You cannot interact with this menu.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const player = await db.query.players.findFirst({ where: eq(players.id, targetPlayerId!) });
  if (!player) return;

  const TOWN_ZONE_IDS = ['cozy_tavern', 'oakhaven_square', 'oakhaven_forge', 'apothecary', 'river_docks'];
  if (!TOWN_ZONE_IDS.includes(player.currentZoneId)) {
    const embed = errorEmbed(
      'Too Far Away',
      `You cannot manage your cottage from **${zonesCatalog.find(z => z.id === player.currentZoneId)?.name || player.currentZoneId}**.\n\nTravel back to **Oakhaven Hamlet** first.`
    );
    await interaction.followUp({ embeds: [embed], ephemeral: true });
    return;
  }

  if (action === 'rest') {
    // 2-minute rest bed cooldown check
    const now = new Date();
    const existingCooldown = await db.query.cooldowns.findFirst({
      where: eq(cooldowns.playerId, player.id)
    });

    const restCooldown = existingCooldown && existingCooldown.action === 'rest' ? existingCooldown : null;

    if (restCooldown && restCooldown.expiresAt > now) {
      const remainingSec = Math.ceil((restCooldown.expiresAt.getTime() - now.getTime()) / 1000);
      const embed = errorEmbed('Still Resting', `Your bed is still unmade. You can sleep again in **${remainingSec}s**.`);
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    // Get equipped stats
    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem: any) => {
      const def = itemsCatalog.find((i: any) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    // Full restore HP, Mana, and Stamina
    await db
      .update(players)
      .set({
        stamina: player.staminaMax,
        hpCurrent: stats.hpMax,
        manaCurrent: stats.manaMax,
        lastStaminaRegen: now,
        lastRestAt: now,
        restType: 'home'
      })
      .where(eq(players.id, player.id));

    // Upsert cooldown
    const expiresAt = new Date(now.getTime() + REST_COOLDOWN_MS);
    if (restCooldown) {
      await db
        .update(cooldowns)
        .set({ expiresAt })
        .where(and(eq(cooldowns.playerId, player.id), eq(cooldowns.action, 'rest')));
    } else {
      await db
        .insert(cooldowns)
        .values({ playerId: player.id, action: 'rest', expiresAt });
    }

    const currentUpgrade = UPGRADES.find(u => u.tier === player.housingTier) || UPGRADES[0]!;
    const embed = successEmbed(
      '🏡 Cozy Slumber',
      `You tucked yourself into your private bed at the **${currentUpgrade.name}**.\n\n` +
      `❤️ HP: **${stats.hpMax}/${stats.hpMax}** (Restored)\n` +
      `💧 Mana: **${stats.manaMax}/${stats.manaMax}** (Restored)\n` +
      `⚡ Stamina: **${player.staminaMax}/${player.staminaMax}** (Restored)\n\n` +
      `*You wake up feeling comfortable and rested!*`
    );
    await interaction.followUp({ embeds: [embed] });
    await execute(interaction);

  } else if (action === 'upgrade') {
    const nextUpgrade = UPGRADES.find(u => u.tier === player.housingTier + 1);
    if (!nextUpgrade) return;

    // Check gold
    if (player.gold < nextUpgrade.costGold) {
      const embed = errorEmbed('Upgrade Failed', `You need **🪙 ${nextUpgrade.costGold} Gold** but only have **🪙 ${player.gold}**.`);
      await interaction.followUp({ embeds: [embed], ephemeral: true });
      return;
    }

    // Check materials in inventory
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));

    for (const mat of nextUpgrade.materials) {
      const owned = dbInventory.filter(i => i.itemId === mat.itemId && !i.equipped);
      const totalQty = owned.reduce((sum, item) => sum + item.quantity, 0);
      if (totalQty < mat.quantity) {
        const itemDef = itemsCatalog.find(i => i.id === mat.itemId);
        const embed = errorEmbed('Upgrade Failed', `You need **${mat.quantity}x ${itemDef?.name || mat.itemId}** but only have **x${totalQty}**.`);
        await interaction.followUp({ embeds: [embed], ephemeral: true });
        return;
      }
    }

    // Deduct gold
    await db
      .update(players)
      .set({
        gold: player.gold - nextUpgrade.costGold,
        housingTier: nextUpgrade.tier
      })
      .where(eq(players.id, player.id));

    // Deduct materials
    for (const mat of nextUpgrade.materials) {
      const owned = dbInventory.filter(i => i.itemId === mat.itemId && !i.equipped);
      let needed = mat.quantity;
      for (const item of owned) {
        if (needed <= 0) break;
        const removeQty = Math.min(item.quantity, needed);
        await removeItem(player.id, item.id, removeQty);
        needed -= removeQty;
      }
    }

    const embed = successEmbed(
      '🔨 Cottage Upgraded!',
      `Congratulations! You upgraded your private estate to a **Tier ${nextUpgrade.tier} ${nextUpgrade.name}**!\n\n` +
      `🌱 Farm plots increased to: **${nextUpgrade.plots}**\n` +
      `📦 Storage capacity increased to: **${nextUpgrade.storageSlots} slots**`
    );
    await interaction.followUp({ embeds: [embed] });
    await execute(interaction);
  }
}
