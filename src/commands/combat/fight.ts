import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { db } from '../../database/client.js';
import { combatSessions, playerSkills, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { computeStats } from '../../systems/progression/stats.js';
import { combatEmbed, errorEmbed } from '../../utils/embeds.js';
import { SKILLS } from '../../systems/combat/skills.js';
import { itemsCatalog } from '../../utils/catalog.js';



export const data = new SlashCommandBuilder()
  .setName('fight')
  .setDescription('Resume your active combat session.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    // Fetch active session
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id),
    });

    if (!activeSession) {
      const embed = errorEmbed(
        'Not in Combat',
        'You do not have an active combat session. Use `/explore` to find an enemy!'
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const expiresAt = new Date(activeSession.expiresAt).getTime();
    if (expiresAt <= Date.now()) {
      // Expired: cleanup
      await db.delete(combatSessions).where(eq(combatSessions.id, activeSession.id));
      const embed = errorEmbed(
        'Combat Expired',
        'Your previous combat session has expired. Start a new one using `/explore`!'
      );
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const enemyDef = getEnemyById(activeSession.enemyId);
    if (!enemyDef) {
      const embed = errorEmbed('Combat Error', 'Encountered enemy definition is missing.');
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
      .set({
        messageId: message.id,
        channelId: interaction.channelId || ''
      })
      .where(eq(combatSessions.id, activeSession.id));

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Combat Error', 'Failed to resume combat session.');
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
