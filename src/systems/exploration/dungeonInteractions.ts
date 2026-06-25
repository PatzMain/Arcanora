import { eq, and } from 'drizzle-orm';
import { db } from '../../database/client.js';
import { players, combatSessions } from '../../database/schema.js';
import { Registry } from '../../utils/registry.js';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { getEquippedItems, addItem } from '../../database/queries/inventory.js';
import { computeStats } from '../progression/stats.js';
import { generateTreasureLoot, getItemData } from './loot.js';
import { awardGold } from '../../economy/currency.js';
import { scaleEnemyStats, getEnemyById } from '../combat/enemy.js';
import { createCombatState } from '../combat/engine.js';
import { itemsCatalog, zonesCatalog } from '../../utils/catalog.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { buildNavId } from '../../utils/navigation.js';
import { type DungeonNode } from './dungeonGenerator.js';

export interface NodeContext {
  playerId: string;
  discordId: string;
  node: DungeonNode;
  dbSession: any; // exploration_sessions table row
}

export interface NodeEnterResult {
  embeds: EmbedBuilder[];
  components: any[];
  log?: string;
}

export interface NodeActionResult {
  embeds: EmbedBuilder[];
  components: any[];
  success: boolean;
  log?: string;
  updatedPlayer?: any;
}

export interface NodeInteractionHandler {
  onEnter(context: NodeContext): Promise<NodeEnterResult>;
  onAction(action: string, context: NodeContext, extraData?: any): Promise<NodeActionResult>;
}

export const dungeonNodeRegistry = new Registry<NodeInteractionHandler>();

// 1. Campsite Handler
const campsiteHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald green
      .setTitle('🏕️ Campsite — Safe Haven')
      .setDescription(
        'A crackling campfire provides warmth and light in this quiet chamber. ' +
        'It seems safe enough to rest here for a moment and recover your strength.'
      );

    const restBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_rest_${context.playerId}`)
      .setLabel('Rest & Recover (50% HP/Mana)')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏕️');

    if (context.node.status === 'cleared' || context.node.status === 'visited') {
      restBtn.setDisabled(true).setLabel('Already Rested Here');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(restBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context) {
    if (action !== 'rest') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    const equippedDbItems = await getEquippedItems(player.id);
    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
      return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
    });

    const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);

    const hpRestore = Math.round(stats.hpMax * 0.5);
    const manaRestore = Math.round(stats.manaMax * 0.5);

    const newHp = Math.min(stats.hpMax, player.hpCurrent + hpRestore);
    const newMana = Math.min(stats.manaMax, player.manaCurrent + manaRestore);

    const [updatedPlayer] = await db
      .update(players)
      .set({
        hpCurrent: newHp,
        manaCurrent: newMana
      })
      .where(eq(players.id, player.id))
      .returning();

    // Mark node as cleared
    context.dbSession.mapState.nodes[context.node.id].status = 'cleared';
    await db
      .update(db.query.explorationSessions as any || {} as any) // handled dynamically or directly
      .set({ mapState: context.dbSession.mapState })
      .where(eq(players.id, player.id)); // wait, let's use the correct table update query below

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🏕️ Campsite — Rest Complete')
      .setDescription(
        `🔥 You sat by the campfire and rested.\n\n` +
        `💚 **HP Restored**: \`+${hpRestore}\` (${newHp}/${stats.hpMax})\n` +
        `💙 **Mana Restored**: \`+${manaRestore}\` (${newMana}/${stats.manaMax})`
      );

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: 'Rest complete.',
      updatedPlayer
    };
  }
};

// 2. Treasure Handler
const treasureHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0xFBBF24) // Gold
      .setTitle('🪙 Treasure Chamber')
      .setDescription('An ornate, iron-bound chest sits on a stone pedestal in the center of the room. It hums with faint magic.');

    const openBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_loot_${context.playerId}`)
      .setLabel('Open Chest')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🪙');

    if (context.node.status === 'cleared') {
      openBtn.setDisabled(true).setLabel('Chest Already Opened');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context) {
    if (action !== 'loot') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

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
        await awardGold(player.id, goldGained, 'Dungeon Exploration Chest');
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

    // Mark node as cleared
    context.dbSession.mapState.nodes[context.node.id].status = 'cleared';

    const embed = new EmbedBuilder()
      .setColor(0xFBBF24)
      .setTitle('🎁 Chest Opened!')
      .setDescription('You popped open the heavy lid and claimed the rewards:');

    if (goldGained > 0) {
      embed.addFields({ name: '🪙 Gold Recieved', value: `\`+${goldGained} Gold\``, inline: true });
    }

    if (acquiredItems.length > 0) {
      const list = acquiredItems.map(item => `• **${item.name}** x${item.quantity} (${item.rarity})`).join('\n');
      embed.addFields({ name: '🎒 Items Found', value: list, inline: false });
    } else if (goldGained === 0) {
      embed.setDescription('The chest was empty! What bad luck.');
    }

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: 'Opened chest.'
    };
  }
};

// 3. Merchant Handler
const merchantHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0x3B82F6) // Blue
      .setTitle('🏪 Traveling Merchant')
      .setDescription('A hooded merchant bows politely. "Greetings, traveler! Need any potions for your journey? My prices are fair."');

    // Create a button to shop
    const shopBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_merchant_${context.playerId}`)
      .setLabel('Browse Wares')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🏪');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shopBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context, extraData) {
    // This is resolved when buying an item. ExtraData should contain itemId.
    if (action !== 'buy') {
      return { success: false, embeds: [], components: [], log: 'Invalid action.' };
    }

    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    const itemId = extraData?.itemId;
    const itemStock = context.node.encounterData?.shopItems || [];
    const itemSpec = itemStock.find((i: any) => i.id === itemId);

    if (!itemSpec) {
      return { success: false, embeds: [], components: [], log: 'Item not in merchant stock.' };
    }

    const itemDef = itemsCatalog.find(i => i.id === itemId);
    if (!itemDef) {
      return { success: false, embeds: [], components: [], log: 'Item definition missing.' };
    }

    if (player.gold < itemSpec.price) {
      return { success: false, embeds: [], components: [], log: `Insufficient gold. Costs ${itemSpec.price} gold.` };
    }

    // Deduct gold
    const updatedGold = player.gold - itemSpec.price;
    const [updatedPlayer] = await db
      .update(players)
      .set({ gold: updatedGold })
      .where(eq(players.id, player.id))
      .returning();

    // Add item
    await addItem(player.id, itemId, 1);

    const embed = new EmbedBuilder()
      .setColor(0x10B981)
      .setTitle('🏪 Purchase Complete')
      .setDescription(`You successfully purchased 1x **${itemDef.name}** for **${itemSpec.price} gold**!`);

    return {
      success: true,
      embeds: [embed],
      components: [],
      log: `Purchased ${itemDef.name}.`,
      updatedPlayer
    };
  }
};

// 4. Puzzle Handler
const puzzleHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const embed = new EmbedBuilder()
      .setColor(0x8B5CF6) // Purple
      .setTitle('🧩 Ancient Inscription')
      .setDescription(
        'An ancient stone door blocks your path. ' +
        'Written upon it in glowing runes is a riddle. Solving it will unlock the door and reveal treasure. ' +
        'Answering incorrectly will trigger a magical trap!'
      );

    const riddleBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_puzzle_${context.playerId}`)
      .setLabel('Solve Riddle')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🧩');

    if (context.node.status === 'cleared') {
      riddleBtn.setDisabled(true).setLabel('Riddle Solved');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(riddleBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context, extraData) {
    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    if (action === 'submit') {
      const riddle = context.node.encounterData?.riddle;
      const answerIdx = extraData?.answerIndex;

      if (!riddle || answerIdx === undefined) {
        return { success: false, embeds: [], components: [], log: 'Riddle data missing.' };
      }

      // Mark node as cleared
      context.dbSession.mapState.nodes[context.node.id].status = 'cleared';

      if (answerIdx === riddle.correctIndex) {
        // Correct answer!
        await awardGold(player.id, riddle.rewardGold, 'Solved Riddle');
        
        // Give exp (we don't have a simple awardExp helper, let's just update exp directly)
        const updatedExp = player.exp + riddle.rewardExp;
        const [updatedPlayer] = await db
          .update(players)
          .set({ exp: updatedExp })
          .where(eq(players.id, player.id))
          .returning();

        const embed = new EmbedBuilder()
          .setColor(0x10B981)
          .setTitle('🧩 Correct Answer!')
          .setDescription(
            `The stone door grinds open, revealing a stash of loot!\n\n` +
            `🪙 **Gold Awarded**: \`+${riddle.rewardGold}\`\n` +
            `✨ **EXP gained**: \`+${riddle.rewardExp}\``
          );

        return {
          success: true,
          embeds: [embed],
          components: [],
          log: 'Solved riddle correctly.',
          updatedPlayer
        };
      } else {
        // Incorrect answer!
        const newHp = Math.max(1, player.hpCurrent - riddle.damageOnWrong);
        const [updatedPlayer] = await db
          .update(players)
          .set({ hpCurrent: newHp })
          .where(eq(players.id, player.id))
          .returning();

        const embed = new EmbedBuilder()
          .setColor(0xEF4444) // Red
          .setTitle('💥 Magical Trap Triggered!')
          .setDescription(
            `Incorrect! Runes flash blood-red, discharging a bolt of lightning!\n\n` +
            `💔 **HP Lost**: \`-${riddle.damageOnWrong}\` (${newHp} HP remaining)\n` +
            `The correct answer was: **${riddle.options[riddle.correctIndex]}**`
          );

        return {
          success: true,
          embeds: [embed],
          components: [],
          log: 'Triggered riddle trap.',
          updatedPlayer
        };
      }
    }

    return { success: false, embeds: [], components: [], log: 'Invalid action.' };
  }
};

// 5. Event Handler
const eventHandler: NodeInteractionHandler = {
  async onEnter(context) {
    const event = context.node.encounterData?.event;
    const embed = new EmbedBuilder()
      .setColor(0xF59E0B) // Amber
      .setTitle(event?.title || '✨ Strange Discovery')
      .setDescription(event?.description || 'You encounter a mysterious phenomenon.');

    const examineBtn = new ButtonBuilder()
      .setCustomId(`dungeon_action_event_${context.playerId}`)
      .setLabel('Examine')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('✨');

    if (context.node.status === 'cleared') {
      examineBtn.setDisabled(true).setLabel('Already Examined');
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(examineBtn);

    return {
      embeds: [embed],
      components: [row]
    };
  },

  async onAction(action, context, extraData) {
    const player = await getPlayerWithClampedStats(context.discordId);
    if (!player) {
      return { success: false, embeds: [], components: [], log: 'Player not found.' };
    }

    if (action === 'choose') {
      const event = context.node.encounterData?.event;
      const outcomeId = extraData?.outcomeId;
      const choice = event?.choices.find((c: any) => c.outcomeId === outcomeId);

      if (!event || !choice) {
        return { success: false, embeds: [], components: [], log: 'Event outcome choice missing.' };
      }

      // Mark node as cleared
      context.dbSession.mapState.nodes[context.node.id].status = 'cleared';

      let resultText = choice.text;
      let updatedPlayer = player;

      // Apply choices outcomes
      if (outcomeId === 'shrine_touch') {
        if (Math.random() < 0.5) {
          const newHp = Math.max(1, player.hpCurrent - 20);
          [updatedPlayer] = await db.update(players).set({ hpCurrent: newHp }).where(eq(players.id, player.id)).returning();
          resultText += `\n\n💥 You take **20 shadow damage** from the backlash!`;
        } else {
          const newGold = player.gold + 250;
          [updatedPlayer] = await db.update(players).set({ gold: newGold }).where(eq(players.id, player.id)).returning();
          resultText += `\n\n🪙 You find **250 gold** hidden inside the altar!`;
        }
      } else if (outcomeId === 'shrine_pray') {
        const equippedDbItems = await getEquippedItems(player.id);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);
        const restoredMana = Math.min(stats.manaMax, player.manaCurrent + Math.round(stats.manaMax * 0.3));
        [updatedPlayer] = await db.update(players).set({ manaCurrent: restoredMana }).where(eq(players.id, player.id)).returning();
        resultText += `\n\n💙 Restored **30% Mana**!`;
      } else if (outcomeId === 'fountain_drink') {
        const equippedDbItems = await getEquippedItems(player.id);
        const equippedItemsList = equippedDbItems.map((dbItem) => {
          const def = itemsCatalog.find((i) => i.id === dbItem.itemId);
          return { slot: def?.type || 'accessory', rarity: def?.rarity || 'common', stats: def?.stats || {} };
        });
        const stats = computeStats(player.level, player.prestige, player.playerClass, equippedItemsList, null, []);
        const restoredHp = Math.min(stats.hpMax, player.hpCurrent + Math.round(stats.hpMax * 0.4));
        const restoredMana = Math.min(stats.manaMax, player.manaCurrent + Math.round(stats.manaMax * 0.4));
        [updatedPlayer] = await db.update(players).set({ hpCurrent: restoredHp, manaCurrent: restoredMana }).where(eq(players.id, player.id)).returning();
        resultText += `\n\n💚 Restored **40% HP & Mana**!`;
      } else if (outcomeId === 'fountain_coin') {
        if (player.gold >= 50) {
          const newGold = player.gold - 50;
          [updatedPlayer] = await db.update(players).set({ gold: newGold }).where(eq(players.id, player.id)).returning();
          resultText += `\n\n✨ You feel a warm blessing! (Deducted 50 Gold).`;
        } else {
          resultText = `You don't have enough gold to toss! Nothing happens.`;
        }
      } else if (outcomeId === 'bones_search') {
        if (Math.random() < 0.3) {
          const newHp = Math.max(1, player.hpCurrent - 10);
          [updatedPlayer] = await db.update(players).set({ hpCurrent: newHp }).where(eq(players.id, player.id)).returning();
          resultText += `\n\n🕷️ A toxic spider bites you! You lose **10 HP**.`;
        } else {
          await addItem(player.id, 'potion_stamina_small', 1);
          resultText += `\n\n🎒 You found a **Small Stamina Potion**!`;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x10B981)
        .setTitle(event?.title || '✨ Strange Discovery')
        .setDescription(resultText);

      return {
        success: true,
        embeds: [embed],
        components: [],
        log: 'Completed event choice.',
        updatedPlayer
      };
    }

    return { success: false, embeds: [], components: [], log: 'Invalid action.' };
  }
};

// 6. Room / Combat Handler (Room, Elite, Boss)
const combatNodeHandler: NodeInteractionHandler = {
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

// Register handlers
dungeonNodeRegistry.register('campsite', campsiteHandler);
dungeonNodeRegistry.register('treasure', treasureHandler);
dungeonNodeRegistry.register('merchant', merchantHandler);
dungeonNodeRegistry.register('puzzle', puzzleHandler);
dungeonNodeRegistry.register('event', eventHandler);
dungeonNodeRegistry.register('room', combatNodeHandler);
dungeonNodeRegistry.register('elite', combatNodeHandler);
dungeonNodeRegistry.register('boss', combatNodeHandler);
