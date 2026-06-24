import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { eq, and } from 'drizzle-orm';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { getZoneById, getAccessibleZones, generateEncounter, getZoneCooldownMs } from '../../systems/exploration/zones.js';
import { scaleEnemyStats, getEnemyById } from '../../systems/combat/enemy.js';
import { createCombatState } from '../../systems/combat/engine.js';
import { computeStats } from '../../systems/progression/stats.js';
import { generateTreasureLoot, getItemData } from '../../systems/exploration/loot.js';
import { db } from '../../database/client.js';
import { combatSessions, players, playerSkills, inventory } from '../../database/schema.js';
import { SKILLS } from '../../systems/combat/skills.js';
import { awardGold } from '../../economy/currency.js';
import {
  successEmbed,
  errorEmbed,
  cooldownEmbed,
  combatEmbed,
  lootEmbed
} from '../../utils/embeds.js';



export const data = new SlashCommandBuilder()
  .setName('explore')
  .setDescription('Explore a zone to fight monsters or find treasure.')
  .addStringOption((option) =>
    option
      .setName('zone')
      .setDescription('The zone to explore.')
      .setRequired(true)
      .addChoices(
        { name: 'Verdant Meadows (Lv. 1-3)', value: 'verdant_meadows' },
        { name: 'Shadow Forest (Lv. 3-6)', value: 'shadow_forest' },
        { name: 'Crystal Caverns (Lv. 6-10)', value: 'crystal_caverns' },
        { name: 'Volcanic Wastes (Lv. 10-15)', value: 'volcanic_wastes' },
        { name: 'Abyssal Depths (Lv. 15-20)', value: 'abyssal_depths' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    // 1. Check if in active combat
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id),
    });

    if (activeSession) {
      const expiresAt = new Date(activeSession.expiresAt).getTime();
      if (expiresAt > Date.now()) {
        const embed = errorEmbed(
          'Already in Combat',
          'You are currently in an active combat session! Use `/fight` to resume your battle.'
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      } else {
        // Expired session: cleanup
        await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      }
    }

    // 2. Check general explore cooldown
    const cooldownStatus = await checkCooldown(player.id, 'explore');
    if (cooldownStatus.onCooldown) {
      const embed = cooldownEmbed('explore', cooldownStatus.remainingMs / 1000);
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const zoneId = interaction.options.getString('zone', true);
    const zone = getZoneById(zoneId);

    if (!zone) {
      const embed = errorEmbed('Invalid Zone', 'The specified zone does not exist.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 3. Level gate check
    if (player.level < zone.minLevel) {
      const embed = errorEmbed(
        'Zone Locked',
        `Your level (**Lv.${player.level}**) is too low. **${zone.name}** requires Level **${zone.minLevel}**.`
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // 4. Set general explore cooldown based on zone
    const cooldownMs = getZoneCooldownMs(zone);
    await setCooldown(player.id, 'explore', cooldownMs);

    // 5. Generate encounter
    const encounter = generateEncounter(zone);

    if (encounter.type === 'empty') {
      const embed = successEmbed(
        `Exploring ${zone.name}`,
        'You spend some time exploring the area, but it remains quiet. Nothing of note was found.'
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (encounter.type === 'treasure') {
      // Fetch stats to use luck
      const equippedDbItems = await getEquippedItems(player.id);

      const equippedItemsList = equippedDbItems.map((dbItem) => {
        const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
        return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
      });
      const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

      // Generate treasure loot
      const lootDrops = generateTreasureLoot(player.level, stats.luck);

      let goldGained = 0;
      const acquiredItems: { name: string; quantity: number; rarity: string }[] = [];

      for (const drop of lootDrops) {
        if (drop.itemId === 'gold') {
          goldGained = drop.quantity;
          await awardGold(player.id, goldGained, 'Exploration Treasure Chest');
        } else {
          const itemDef = getItemData(drop.itemId);
          if (itemDef) {
            await addItem(player.id, drop.itemId, drop.quantity);
            acquiredItems.push({
              name: itemDef.name,
              quantity: drop.quantity,
              rarity: itemDef.rarity
            });
          }
        }
      }

      const embed = lootEmbed(acquiredItems, goldGained, 0);
      embed.setTitle(`🎁 Treasure Chest Found in ${zone.name}!`);
      embed.setDescription('You stumbled upon a hidden chest left behind by adventurers.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Combat encounters (normal_mob, rare_mob, boss)
    const enemyId = encounter.enemyId;
    if (!enemyId) {
      const embed = errorEmbed('Encounter Error', 'An error occurred during encounter generation.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const enemyDef = getEnemyById(enemyId);
    if (!enemyDef) {
      const embed = errorEmbed('Encounter Error', 'The encountered enemy definition is missing.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Load player stats & equipment
    const equippedDbItems = await getEquippedItems(player.id);

    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    // Create combat state
    const scaledEnemyStats = scaleEnemyStats(enemyDef, player.level);
    const combatStatsInput = {
      hp: player.hpCurrent,
      maxHp: playerStats.hpMax,
      mana: player.manaCurrent,
      maxMana: playerStats.manaMax,
      attack: playerStats.attack,
      defense: playerStats.defense,
      speed: playerStats.speed,
      critChance: playerStats.critChance,
      critDmg: playerStats.critDmg,
      luck: playerStats.luck
    };

    const initialCombatState = createCombatState(combatStatsInput, scaledEnemyStats);
    initialCombatState.combatLog = [
      `⚔️ You encountered a Lv.${enemyDef.level} **${enemyDef.name}**!`,
      `💪 Scale difference applied based on level.`
    ];

    // Save session in DB
    const sessionExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const [savedSession] = await db
      .insert(combatSessions)
      .values({
        playerId: player.id,
        enemyId: enemyDef.id,
        zoneId: zone.id,
        state: initialCombatState,
        channelId: interaction.channelId || '',
        expiresAt: sessionExpiresAt
      })
      .returning();

    // Render combat embed
    const embed = combatEmbed(
      player.username,
      player.hpCurrent,
      playerStats.hpMax,
      player.manaCurrent,
      playerStats.manaMax,
      { name: enemyDef.name, level: enemyDef.level },
      initialCombatState.enemyHp,
      initialCombatState.enemyMaxHp,
      initialCombatState.round,
      initialCombatState.combatLog
    );

    // Build components
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('combat_attack').setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('combat_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('combat_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Danger)
    );

    // Fetch skills for select menu
    const selectMenuRow = await getCombatSkillsRow(player.id, player.playerClass);
    const itemsRow = await getCombatItemsRow(player.id);
    const components: any[] = [row];
    if (selectMenuRow) components.push(selectMenuRow);
    if (itemsRow) components.push(itemsRow);

    const message = await interaction.editReply({
      embeds: [embed],
      components: components as any[]
    });

    // Update message ID in session
    await db
      .update(combatSessions)
      .set({ messageId: message.id })
      .where(eq(combatSessions.id, savedSession!.id));

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Exploration Error', 'Failed to complete exploration.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}



async function getCombatSkillsRow(playerId: string, playerClass: string) {
  try {
    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId));
    if (learned.length === 0) return null;

    const options = learned.map(l => {
      const skillDef = SKILLS.find(s => s.id === l.skillId);
      if (!skillDef) return null;
      return {
        label: skillDef.name,
        description: `Cost: ${skillDef.manaCost} Mana. ${skillDef.description.slice(0, 50)}`,
        value: skillDef.id
      };
    }).filter(Boolean);

    if (options.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('combat_use_skill')
      .setPlaceholder('🔮 Select a Skill to cast')
      .addOptions(options as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat skills:', error);
    return null;
  }
}

async function getCombatItemsRow(playerId: string) {
  try {
    const dbItems = await db.select().from(inventory).where(and(eq(inventory.playerId, playerId), eq(inventory.equipped, false)));
    const catalog = itemsCatalog;

    const consumables = dbItems.map(dbItem => {
      const def = catalog.find(i => i.id === dbItem.itemId);
      if (def && def.type === 'consumable') {
        return {
          label: `${def.name} (x${dbItem.quantity})`,
          description: def.description.slice(0, 50),
          value: dbItem.id // inventoryId
        };
      }
      return null;
    }).filter(Boolean);

    if (consumables.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('combat_use_item')
      .setPlaceholder('🧪 Select a Consumable to use')
      .addOptions(consumables as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat items:', error);
    return null;
  }
}
