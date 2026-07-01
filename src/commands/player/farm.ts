import { logger } from '../../utils/logger.js';
import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, inventory, playerFarms } from '../../database/schema.js';
import { getAndUpdatePlayerStamina, deductPlayerStamina } from '../../database/queries/player.js';
import { removeItem, addItem } from '../../database/queries/inventory.js';
import { itemsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { errorEmbed, successEmbed } from '../../utils/embeds.js';
import { advanceQuestProgress } from '../../systems/progression/questSystem.js';

export const data = new SlashCommandBuilder()
  .setName('farm')
  .setDescription('Manage your private farm plots and grow crops.');

const MAX_PLOTS_BY_TIER: Record<number, number> = {
  0: 0,
  1: 2,
  2: 4,
  3: 8
};

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
        `You cannot manage your farm plots from **${zonesCatalog.find(z => z.id === player.currentZoneId)?.name || player.currentZoneId}**.\n\nTravel back to **Oakhaven Hamlet** to view your farm.`
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    if (player.housingTier === 0) {
      const err = errorEmbed(
        'Farm Locked',
        'You do not own a farm yet! Complete the tutorial quests to unlock your **Private cottage and farm plots**.'
      );
      await interaction.editReply({ embeds: [err] });
      return;
    }

    const maxPlots = MAX_PLOTS_BY_TIER[player.housingTier] || 0;

    // Fetch existing plots
    let dbPlots = await db
      .select()
      .from(playerFarms)
      .where(eq(playerFarms.playerId, player.id))
      .orderBy(playerFarms.plotIndex);

    // Sync plot rows if missing
    if (dbPlots.length < maxPlots) {
      for (let i = 0; i < maxPlots; i++) {
        const hasPlot = dbPlots.some(p => p.plotIndex === i);
        if (!hasPlot) {
          await db.insert(playerFarms).values({ playerId: player.id, plotIndex: i });
        }
      }
      // Re-fetch
      dbPlots = await db
        .select()
        .from(playerFarms)
        .where(eq(playerFarms.playerId, player.id))
        .orderBy(playerFarms.plotIndex);
    }

    const embed = new EmbedBuilder()
      .setColor(0x22C55E)
      .setTitle(`🌱 Private Farm Plots (Tier ${player.housingTier})`)
      .setDescription(
        `Grow crops to cook food, craft materials, or trade. Action operations cost Stamina.\n\n` +
        `⚡ Stamina: **${player.stamina} / ${player.staminaMax}**`
      );

    const now = new Date();
    const rows: ActionRowBuilder<any>[] = [];

    // Query inventory to list available seeds
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(eq(inventory.playerId, player.id));
    const seeds = dbInventory.filter(item => {
      const def = itemsCatalog.find(i => i.id === item.itemId);
      return def && def.type === 'seed' && item.quantity > 0;
    });

    for (const plot of dbPlots) {
      let statusText = '🟢 **Empty**';
      let actionsRow: ActionRowBuilder<any> | null = null;

      if (plot.cropId) {
        const cropDef = itemsCatalog.find(i => i.id === plot.cropId);
        const cropName = cropDef?.name || plot.cropId;

        if (!plot.wateredAt) {
          statusText = `🌱 **Dry ${cropName}** (Needs water to start growing)`;
          actionsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`farm_water_${plot.plotIndex}_${player.id}`)
              .setLabel('💧 Water')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`farm_harvest_${plot.plotIndex}_${player.id}`)
              .setLabel('🌾 Harvest')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          );
        } else if (plot.harvestableAt && now >= plot.harvestableAt) {
          statusText = `🌾 **Ready to Harvest ${cropName}!**`;
          actionsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`farm_water_${plot.plotIndex}_${player.id}`)
              .setLabel('💧 Watered')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`farm_harvest_${plot.plotIndex}_${player.id}`)
              .setLabel('🌾 Harvest')
              .setStyle(ButtonStyle.Success)
          );
        } else {
          const timeLeftSec = Math.ceil((plot.harvestableAt!.getTime() - now.getTime()) / 1000);
          const minutes = Math.floor(timeLeftSec / 60);
          const seconds = timeLeftSec % 60;
          const timeStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          statusText = `⏱️ **Growing ${cropName}** (${timeStr} left)`;
          actionsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`farm_water_${plot.plotIndex}_${player.id}`)
              .setLabel('💧 Watered')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
            new ButtonBuilder()
              .setCustomId(`farm_harvest_${plot.plotIndex}_${player.id}`)
              .setLabel('🌾 Harvest')
              .setStyle(ButtonStyle.Success)
              .setDisabled(true)
          );
        }
      } else {
        // Plot is empty, allow planting seeds if they have any
        if (seeds.length > 0) {
          const selectOptions = seeds.map(s => {
            const def = itemsCatalog.find(i => i.id === s.itemId)!;
            return {
              label: `${def.name} (x${s.quantity})`,
              description: `Takes ${Math.ceil(def.growthTimeSec / 60)} minutes to grow`,
              value: s.itemId
            };
          });

          const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`farm_plant_${plot.plotIndex}_${player.id}`)
            .setPlaceholder('🌱 Select seed to plant')
            .addOptions(selectOptions);

          actionsRow = new ActionRowBuilder().addComponents(selectMenu);
        } else {
          statusText = '🟢 **Empty** (Purchase seeds at Oakhaven Docks or Town Square)';
        }
      }

      embed.addFields({
        name: `Plot #${plot.plotIndex + 1}`,
        value: statusText,
        inline: false
      });

      if (actionsRow) {
        rows.push(actionsRow);
      }
    }

    // Discord allows up to 5 action rows. If plot count is 8, we can group select menus or show them compactly.
    // For plots 1-4, we can render buttons. Let's make sure we only render up to the Discord row limit.
    const slicedRows = rows.slice(0, 5);

    await interaction.editReply({ embeds: [embed], components: slicedRows });

  } catch (error) {
    logger.error({ err: error }, 'Error in farm command:');
    const err = errorEmbed('Farming Error', 'Failed to retrieve your farm plots.');
    await interaction.editReply({ embeds: [err] });
  }
}

// Router/Handler for button/select interactions inside /farm
export async function handleFarmInteraction(interaction: any, parts: string[]) {
  const action = parts[1]; // water, harvest, plant
  const plotIndex = parseInt(parts[2] || '0', 10);
  const targetPlayerId = parts[3];

  if (interaction.user.id !== interaction.message.interaction?.user.id && interaction.user.id !== interaction.message.mentions.users.first()?.id) {
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
      `You cannot manage your farm from **${zonesCatalog.find(z => z.id === player.currentZoneId)?.name || player.currentZoneId}**.\n\nTravel back to **Oakhaven Hamlet** first.`
    );
    await interaction.followUp({ embeds: [embed], ephemeral: true });
    return;
  }

  if (action === 'water') {
    if (player.stamina < 1) {
      const err = errorEmbed('Out of Stamina', 'Watering a crop costs **1 Stamina**.');
      await interaction.followUp({ embeds: [err], ephemeral: true });
      return;
    }

    // Get plot info
    const plot = await db.query.playerFarms.findFirst({
      where: and(eq(playerFarms.playerId, player.id), eq(playerFarms.plotIndex, plotIndex))
    });

    if (!plot || !plot.cropId) return;

    const seedDef = itemsCatalog.find((i: any) => i.cropId === plot.cropId);
    const growthTimeSec = seedDef?.growthTimeSec || 3600;

    const now = new Date();
    const harvestableAt = new Date(now.getTime() + growthTimeSec * 1000);

    // Deduct stamina and water plot
    await deductPlayerStamina(player.id, 1);
    await db
      .update(playerFarms)
      .set({
        wateredAt: now,
        harvestableAt
      })
      .where(eq(playerFarms.id, plot.id));

    const embed = successEmbed('💧 Plot Watered', `You spent **1 Stamina** and watered Plot #${plotIndex + 1}. Growth has begun!`);
    await interaction.followUp({ embeds: [embed] });
    await execute(interaction);

  } else if (action === 'harvest') {
    // Get plot info
    const plot = await db.query.playerFarms.findFirst({
      where: and(eq(playerFarms.playerId, player.id), eq(playerFarms.plotIndex, plotIndex))
    });

    if (!plot || !plot.cropId || !plot.harvestableAt) return;

    const now = new Date();
    if (now < plot.harvestableAt) {
      const err = errorEmbed('Not Ready', 'This crop is still growing.');
      await interaction.followUp({ embeds: [err], ephemeral: true });
      return;
    }

    const cropDef = itemsCatalog.find(i => i.id === plot.cropId);
    if (!cropDef) return;

    // Roll harvest yield (3-5 crops)
    const yieldQty = Math.floor(Math.random() * 3) + 3; // 3 to 5

    // Add items, clear plot
    await addItem(player.id, plot.cropId, yieldQty);
    await db
      .update(playerFarms)
      .set({
        cropId: null,
        plantedAt: null,
        wateredAt: null,
        harvestableAt: null
      })
      .where(eq(playerFarms.id, plot.id));

    const embed = successEmbed(
      '🌾 Harvest Success!',
      `You successfully harvested Plot #${plotIndex + 1} and gathered **${yieldQty}x ${cropDef.name}**!`
    );
    await interaction.followUp({ embeds: [embed] });
    await execute(interaction);

    // Advance quest progress
    await advanceQuestProgress(player.id, 'gather', plot.cropId, yieldQty, interaction);

  } else if (action === 'plant') {
    // Plant seed selection (StringSelectMenu)
    const seedId = (interaction as StringSelectMenuInteraction).values[0]!;
    
    // Find seed in inventory
    const dbInventory = await db
      .select()
      .from(inventory)
      .where(and(eq(inventory.playerId, player.id), eq(inventory.itemId, seedId), eq(inventory.equipped, false)));

    const targetSeedItem = dbInventory[0];
    if (!targetSeedItem || targetSeedItem.quantity <= 0) {
      const err = errorEmbed('No Seeds', 'You do not have any of this seed remaining.');
      await interaction.followUp({ embeds: [err], ephemeral: true });
      return;
    }

    const seedDef = itemsCatalog.find(i => i.id === seedId);
    if (!seedDef) return;

    // Find plot
    const plot = await db.query.playerFarms.findFirst({
      where: and(eq(playerFarms.playerId, player.id), eq(playerFarms.plotIndex, plotIndex))
    });

    if (!plot || plot.cropId) return;

    // Remove 1 seed, plant on plot
    await removeItem(player.id, targetSeedItem.id, 1);
    await db
      .update(playerFarms)
      .set({
        cropId: seedDef.cropId,
        plantedAt: new Date(),
        wateredAt: null,
        harvestableAt: null
      })
      .where(eq(playerFarms.id, plot.id));

    const embed = successEmbed(
      '🌱 Seeds Planted',
      `You planted **1x ${seedDef.name}** on Plot #${plotIndex + 1}. Remember to **water** it to begin growth!`
    );
    await interaction.followUp({ embeds: [embed] });
    await execute(interaction);
  }
}
