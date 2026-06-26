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
import { getCodexEntry } from '../../../database/queries/codex.js';
import { type NodeInteractionHandler } from '../dungeonInteractions.js';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const combatNodeHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const enemyId = context.node.encounterData?.enemyId;
    const enemyDef = enemyId ? getEnemyById(enemyId) : null;
    if (!enemyDef) {
      return {
        embeds: [new EmbedBuilder().setTitle('Unknown Room').setDescription('No enemy found here.')],
        components: []
      };
    }

    const name = enemyDef.name;
    const floor = (context.dbSession.mapState as any)?.floor || 1;
    const adjustedEnemyLevel = enemyDef.level + (floor - 1) * 2;

    const color = context.node.type === 'boss' ? 0xEF4444 : (context.node.type === 'elite' ? 0xF59E0B : 0x9CA3AF);
    const title = context.node.type === 'boss' 
      ? `☠️ Boss Chamber — Lv.${adjustedEnemyLevel} ${name}` 
      : (context.node.type === 'elite' ? `⚔️ Elite Encounter — Lv.${adjustedEnemyLevel} ${name}` : `🚪 Monster Room — Lv.${adjustedEnemyLevel} ${name}`);

    // Check codex discovery
    const codexEntry = await getCodexEntry(context.playerId, 'enemy', enemyDef.id);
    const isDiscovered = !!codexEntry;

    // Scale stats
    const baseScaled = scaleEnemyStats(enemyDef, adjustedEnemyLevel);
    const floorBonus = (floor - 1) * 0.15;
    const scaledHp = Math.round(baseScaled.hp * (1 + floorBonus));
    const scaledAttack = Math.round(baseScaled.attack * (1 + floorBonus));
    const scaledDefense = Math.round(baseScaled.defense * (1 + floorBonus));
    const scaledSpeed = Math.round(baseScaled.speed * (1 + floorBonus));

    const rarityBadge = enemyDef.rarity === 'boss' ? '🔴 Boss' : (enemyDef.rarity === 'rare' ? '🟡 Elite' : '⚪ Normal');

    const statsStr = isDiscovered
      ? `❤️ **HP:** ${scaledHp}  |  ⚔️ **Attack:** ${scaledAttack}  |  🛡️ **Defense:** ${scaledDefense}  |  ⚡ **Speed:** ${scaledSpeed}`
      : `❤️ **HP:** ???  |  ⚔️ **Attack:** ???  |  🛡️ **Defense:** ???  |  ⚡ **Speed:** ???\n*(Defeat this enemy to unlock bestiary stats)*`;

    // Abilities
    const abilitiesStr = enemyDef.abilities.length > 0
      ? enemyDef.abilities.map(a => `• **${a.name}** (${a.chance}% chance)`).join('\n')
      : '• Basic Attack only';

    // Possible Drops
    const dropsStr = enemyDef.lootTable.length > 0
      ? enemyDef.lootTable.map(l => {
          const item = itemsCatalog.find(i => i.id === l.itemId);
          return `• **${item ? item.name : capitalize(l.itemId)}** (${l.dropRate}% chance)`;
        }).join('\n')
      : '• No drops';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(
        `A hostile **${name}** blocks the exit to this room!\n` +
        `You must defeat it in combat to pass through.\n\n` +
        `**Rarity:** ${rarityBadge}\n` +
        `**Stats:**\n${statsStr}\n\n` +
        `✨ **Abilities:**\n${abilitiesStr}\n\n` +
        `🎁 **Possible Drops:**\n${dropsStr}`
      );

    const engageBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_combat_engage_${context.playerId}`)
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
    const floor = (context.dbSession.mapState as any)?.floor || 1;
    const adjustedEnemyLevel = enemyDef.level + (floor - 1) * 2;
    const baseScaled = scaleEnemyStats(enemyDef, player.level + (floor - 1) * 2);
    const floorBonus = (floor - 1) * 0.15;
    const scaledEnemyStats = {
      hp: Math.round(baseScaled.hp * (1 + floorBonus)),
      attack: Math.round(baseScaled.attack * (1 + floorBonus)),
      defense: Math.round(baseScaled.defense * (1 + floorBonus)),
      speed: Math.round(baseScaled.speed * (1 + floorBonus))
    };

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

    const initialCombatState = createCombatState(combatStatsInput, scaledEnemyStats) as any;
    initialCombatState.floor = floor;
    initialCombatState.explorationSessionId = context.dbSession.id;
    initialCombatState.explorationNodeId = context.node.id;
    initialCombatState.combatLog = [
      `⚔️ Dungeon Combat: You engaged a Lv.${adjustedEnemyLevel} **${enemyDef.name}**!`,
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

    return {
      success: true,
      embeds: [],
      components: [],
      log: 'Combat initiated.'
    };
  }
};
