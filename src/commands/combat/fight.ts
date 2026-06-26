import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { itemsCatalog } from '../../utils/catalog.js';
import { eq } from 'drizzle-orm';
import { getPlayerWithClampedStats } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { computeStats } from '../../systems/progression/stats.js';
import { db } from '../../database/client.js';
import { combatSessions } from '../../database/schema.js';
import { getNavButtons } from '../../utils/navigation.js';
import { parsePresets, buildPresetButtons } from '../../systems/combat/presets.js';
import { errorEmbed, combatEmbed } from '../../utils/embeds.js';
import { getCombatSkillsRow, getCombatItemsRow } from '../../systems/combat/uiHelpers.js';

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
    const presetsRow = buildPresetButtons(parsePresets(player.presets), 'combat');
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
