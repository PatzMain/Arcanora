import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { db } from '../../../database/client.js';
import { combatSessions } from '../../../database/schema.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../../database/queries/player.js';
import { getEquippedItems } from '../../../database/queries/inventory.js';
import { computeStats } from '../../progression/stats.js';
import { scaleEnemyStats, getEnemyById } from '../../combat/enemy.js';
import { createCombatState } from '../../combat/engine.js';
import { itemsCatalog } from '../../../utils/catalog.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';

export const combatNodeHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const enemyId = context.node.encounterData?.enemyId;
    const enemyDef = enemyId ? getEnemyById(enemyId) : null;
    const name = enemyDef ? enemyDef.name : 'Unknown Monster';

    const color = context.node.type === 'boss' ? 0xEF4444 : (context.node.type === 'elite' ? 0xF59E0B : 0x9CA3AF);
    const title = context.node.type === 'boss' ? `☠️ Boss Chamber — ${name}` : (context.node.type === 'elite' ? `⚔️ Elite Encounter — ${name}` : `🚪 Monster Room — ${name}`);

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        `A hostile **${name}** blocks the exit to this room! ` +
        'You must defeat it in combat to pass through.'
      );

    const engageBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_engage_${context.playerId}`)
      .setLabel('Engage in Combat')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⚔️');

    if (context.node.status === 'cleared') {
      engageBtn.setDisabled(true).setLabel('Monster Defeated');
      embed.setDescription(`The slain corpse of the **${name}** lies on the cold stone floor. This path is clear.`);
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(engageBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context) {
    if (action !== 'engage') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    // Check if player is already in combat
    const activeCombat = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id)
    });

    if (activeCombat) {
      const embed = new EmbedBuilder()
        .setColor(0xEF4444)
        .setTitle('Already in Combat')
        .setDescription('You are already in an active battle! Use `/combat fight` to resume your fight.');

      return {
        success: false,
        embeds: [embed],
        components: [],
        log: 'Already in combat.'
      };
    }

    const enemyId = context.node.encounterData?.enemyId;
    const enemyDef = enemyId ? getEnemyById(enemyId) : null;

    if (!enemyDef) {
      return { success: false, embeds: [], components: [], log: 'Enemy definition missing.' };
    }

    // Set up combat session
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
      `⚔️ Dungeon Combat: You engaged a Lv.${enemyDef.level} **${enemyDef.name}**!`,
    ];

    // Save session in DB
    const sessionExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await db
      .insert(combatSessions)
      .values({
        playerId: player.id,
        enemyId: enemyDef.id,
        zoneId: context.dbSession.zoneId,
        state: initialCombatState,
        channelId: context.dbSession.channelId || '',
        expiresAt: sessionExpiresAt
      });

    const embed = new EmbedBuilder()
      .setColor(0xEF4444)
      .setTitle(`⚔️ Combat Initiated vs ${enemyDef.name}`)
      .setDescription('Use `/combat fight` to engage in this battle!');

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: 'Combat initiated.'
    };
  }
};
