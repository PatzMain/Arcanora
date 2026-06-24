import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type InteractionReplyOptions
} from 'discord.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { eq, and } from 'drizzle-orm';
import { findOrCreatePlayer, getPlayerWithClampedStats } from '../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import { checkCooldown, setCooldown } from '../../utils/cooldown.js';
import { getZoneById, generateEncounter, getZoneCooldownMs } from '../../systems/exploration/zones.js';
import { scaleEnemyStats, getEnemyById } from '../../systems/combat/enemy.js';
import { createCombatState } from '../../systems/combat/engine.js';
import { computeStats } from '../../systems/progression/stats.js';
import { generateTreasureLoot, getItemData } from '../../systems/exploration/loot.js';
import { db } from '../../database/client.js';
import { combatSessions, playerSkills, inventory } from '../../database/schema.js';
import { SKILLS } from '../../systems/combat/skills.js';
import { awardGold } from '../../economy/currency.js';
import { getNavButtons } from '../../utils/navigation.js';
import { advanceQuestProgress } from '../../systems/progression/questSystem.js';
import {
  successEmbed,
  errorEmbed,
  cooldownEmbed,
  combatEmbed,
  lootEmbed
} from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('combat')
  .setDescription('Combat commands: explore locations or resume a fight.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('explore')
      .setDescription('Explore your current location to fight monsters or find treasure.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('fight')
      .setDescription('Resume your active combat session.')
  );

// Helper to reply or update interaction depending on type
async function replyOrUpdate(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  options: any
) {
  if (interaction.isButton() || interaction.isStringSelectMenu()) {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.update(options);
    }
  } else {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(options);
    } else {
      return await interaction.reply(options);
    }
  }
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'explore') {
    await runExplore(interaction);
  } else if (subcommand === 'fight') {
    await runFight(interaction);
  }
}

export async function runExplore(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  zoneId?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const discordId = interaction.user.id;

    // Load player and clamp stats
    const player = await getPlayerWithClampedStats(discordId);
    if (!player) {
      const embed = errorEmbed(
        'Onboarding Required',
        'Please run the `/tutorial` command to create your character profile first.'
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // 1. Check if in active combat
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id),
    });

    if (activeSession) {
      const expiresAt = new Date(activeSession.expiresAt).getTime();
      if (expiresAt > Date.now()) {
        const embed = errorEmbed(
          'Already in Combat',
          'You are currently in an active combat session! Use `/combat fight` to resume your battle.'
        );
        await interaction.editReply({ embeds: [embed], components: [] });
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
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // Default to player's currentZoneId if not specified
    const selectedZoneId = zoneId || player.currentZoneId || 'verdant_meadows';
    const zone = getZoneById(selectedZoneId);

    if (!zone) {
      const embed = errorEmbed('Invalid Zone', 'The specified zone does not exist.');
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // 3. Level gate check
    if (player.level < zone.minLevel) {
      const embed = errorEmbed(
        'Zone Locked',
        `Your level (**Lv.${player.level}**) is too low. **${zone.name}** requires Level **${zone.minLevel}**.`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // 4. Set general explore cooldown based on zone
    const cooldownMs = getZoneCooldownMs(zone);
    await setCooldown(player.id, 'explore', cooldownMs);

    // Advance quest progress for exploring the zone
    await advanceQuestProgress(player.id, 'explore', selectedZoneId, 1, interaction);

    // 5. Generate encounter
    const encounter = generateEncounter(zone);

    if (encounter.type === 'empty') {
      const embed = successEmbed(
        `Exploring ${zone.name}`,
        'You spend some time exploring the area, but it remains quiet. Nothing of note was found.'
      );
      const navButtons = getNavButtons('combat_fight_victory', player.discordId, selectedZoneId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
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
      
      const navButtons = getNavButtons('combat_explore_loot', player.discordId, selectedZoneId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    // Combat encounters (normal_mob, rare_mob, boss)
    const enemyId = encounter.enemyId;
    if (!enemyId) {
      const embed = errorEmbed('Encounter Error', 'An error occurred during encounter generation.');
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const enemyDef = getEnemyById(enemyId);
    if (!enemyDef) {
      const embed = errorEmbed('Encounter Error', 'The encountered enemy definition is missing.');
      await interaction.editReply({ embeds: [embed], components: [] });
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
    const presetsRow = await getCombatPresetsRow(player.presets);
    const components: any[] = [row, presetsRow];
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
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runFight(
  interaction: ChatInputCommandInteraction | ButtonInteraction
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const discordId = interaction.user.id;

    // Load player and clamp stats
    const player = await getPlayerWithClampedStats(discordId);
    if (!player) {
      const embed = errorEmbed(
        'Onboarding Required',
        'Please run the `/tutorial` command to create your character profile first.'
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // Fetch active session
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id),
    });

    if (!activeSession) {
      const embed = errorEmbed(
        'Not in Combat',
        'You do not have an active combat session. Use `/combat explore` to find an enemy!'
      );
      const navButtons = getNavButtons('combat_fight_victory', player.discordId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    const expiresAt = new Date(activeSession.expiresAt).getTime();
    if (expiresAt <= Date.now()) {
      // Expired: cleanup
      await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      const embed = errorEmbed(
        'Combat Expired',
        'Your previous combat session has expired. Start a new one using `/combat explore`!'
      );
      const navButtons = getNavButtons('combat_fight_victory', player.discordId, activeSession.zoneId);
      await interaction.editReply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    const enemyDef = getEnemyById(activeSession.enemyId);
    if (!enemyDef) {
      const embed = errorEmbed('Combat Error', 'Encountered enemy definition is missing.');
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    // Load player stats & equipment
    const equippedDbItems = await getEquippedItems(player.id);

    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });
    const playerStats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    const combatState = activeSession.state as any;

    const embed = combatEmbed(
      player.username,
      combatState.playerHp,
      playerStats.hpMax,
      combatState.playerMana,
      playerStats.manaMax,
      { name: enemyDef.name, level: enemyDef.level },
      combatState.enemyHp,
      combatState.enemyMaxHp,
      combatState.round,
      combatState.combatLog
    );

    // Build components
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('combat_attack').setLabel('⚔️ Attack').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('combat_defend').setLabel('🛡️ Defend').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('combat_flee').setLabel('🏃 Flee').setStyle(ButtonStyle.Danger)
    );

    const selectMenuRow = await getCombatSkillsRow(player.id, player.playerClass);
    const itemsRow = await getCombatItemsRow(player.id);
    const presetsRow = await getCombatPresetsRow(player.presets);
    const components: any[] = [row, presetsRow];
    if (selectMenuRow) components.push(selectMenuRow);
    if (itemsRow) components.push(itemsRow);

    const message = await interaction.editReply({
      embeds: [embed],
      components: components as any[]
    });

    // Update message ID in session
    await db
      .update(combatSessions)
      .set({
        messageId: message.id,
        channelId: interaction.channelId || ''
      })
      .where(eq(combatSessions.id, activeSession.id));

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Combat Error', 'Failed to resume combat session.');
    await interaction.editReply({ embeds: [embed], components: [] });
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
          value: dbItem.id
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

async function getCombatPresetsRow(playerPresets: any) {
  const presets = (playerPresets || ['attack', null, null]) as (string | null)[];
  const buttons = [];

  for (let i = 0; i < 3; i++) {
    const presetAction = presets[i];
    const button = new ButtonBuilder()
      .setCustomId(`combat_preset_${i + 1}`)
      .setStyle(ButtonStyle.Success);

    if (!presetAction) {
      button.setLabel(`P${i + 1}: Empty`).setDisabled(true);
    } else if (presetAction === 'attack') {
      button.setLabel(`P${i + 1}: Basic Attack`).setEmoji('⚔️');
    } else {
      const skillDef = SKILLS.find((s) => s.id === presetAction);
      if (skillDef) {
        button.setLabel(`P${i + 1}: ${skillDef.name}`).setEmoji('🌀');
      } else {
        button.setLabel(`P${i + 1}: Unknown`).setDisabled(true);
      }
    }
    buttons.push(button);
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}
