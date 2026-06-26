import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  type ButtonInteraction
} from 'discord.js';

// Define the customId prefix for all navigation buttons
export const NAV_PREFIX = 'nav_';

// Build a navigation customId: nav_{action}_{userId}_{extra}
export function buildNavId(action: string, userId: string, extra?: string): string {
  return `${NAV_PREFIX}${action}_${userId}${extra ? `_${extra}` : ''}`;
}

export function getNavButtons(context: string, userId: string, extra?: string): ActionRowBuilder<ButtonBuilder> | null {
  const row = new ActionRowBuilder<ButtonBuilder>();
  let hasButtons = false;

  switch (context) {
    case 'tutorial_complete':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Open Map')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('player_profile', userId))
          .setLabel('View Profile')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId(buildNavId('help', userId))
          .setLabel('Open Help')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📖')
      );
      hasButtons = true;
      break;

    case 'combat_explore_loot':
      // extra is the last explored zone
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('combat_fight', userId))
          .setLabel('Fight')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('combat_explore', userId, extra))
          .setLabel('Explore Again')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒')
      );
      hasButtons = true;
      break;

    case 'combat_fight_victory':
      // extra is the last zone — came from a regular explore/fight
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('combat_explore', userId, extra))
          .setLabel('Explore Again')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔄'),
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Map')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒')
      );
      hasButtons = true;
      break;

    case 'combat_fight_victory_hunt':
      // Came from a /map Hunt button — show Hunt Again + Map + Bag
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('combat_hunt', userId, extra))
          .setLabel('Hunt Again')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('⚔️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Map')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒')
      );
      hasButtons = true;
      break;

    case 'inventory_bag':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Map')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_equip', userId))
          .setLabel('Equip')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚒️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_sell', userId))
          .setLabel('Sell')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('💰'),
        new ButtonBuilder()
          .setCustomId(buildNavId('economy_shop', userId))
          .setLabel('Shop')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏪')
      );
      hasButtons = true;
      break;

    case 'economy_shop':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Map')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('Bag')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎒'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_equip', userId))
          .setLabel('Equip')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚒️')
      );
      hasButtons = true;
      break;

    case 'economy_buy_result':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Map')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('Bag')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎒'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_equip', userId))
          .setLabel('Equip')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚒️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('economy_shop', userId))
          .setLabel('Shop')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🏪')
      );
      hasButtons = true;
      break;

    case 'quest_board':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Open Map')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗺️')
      );
      hasButtons = true;
      break;

    case 'quest_daily_result':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('Open Map')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒'),
        new ButtonBuilder()
          .setCustomId(buildNavId('quest_board', userId))
          .setLabel('View Quests')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📜')
      );
      hasButtons = true;
      break;

    case 'boss_fight_result':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('boss_info', userId))
          .setLabel('Boss Info')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒')
      );
      hasButtons = true;
      break;

    case 'craft_result':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_equip', userId))
          .setLabel('Equip Item')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('⚒️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('inventory_bag', userId))
          .setLabel('View Bag')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🎒')
      );
      hasButtons = true;
      break;

    case 'player_prestige_result':
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('player_map', userId))
          .setLabel('View on Map')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🗺️'),
        new ButtonBuilder()
          .setCustomId(buildNavId('player_profile', userId))
          .setLabel('Profile')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('👤'),
        new ButtonBuilder()
          .setCustomId(buildNavId('player_stats', userId))
          .setLabel('Stats')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊')
      );
      hasButtons = true;
      break;
  }

  return hasButtons ? row : null;
}

export async function handleNavInteraction(interaction: ButtonInteraction) {
  const customId = interaction.customId;
  if (!customId.startsWith(NAV_PREFIX)) return;

  // Format: nav_{action}_{userId}_{extra}
  const parts = customId.substring(NAV_PREFIX.length).split('_');
  const actionCategory = parts[0];
  const actionName = parts[1];
  const targetAction = `${actionCategory}_${actionName}`; // e.g. 'combat_explore' or 'inventory_bag'
  const userId = parts[2];
  const extra = parts.slice(3).join('_'); // Recombine any extra parameters

  // Access Control check
  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This navigation menu is not yours!',
      flags: [MessageFlags.Ephemeral]
    });
    return;
  }

  // Route to the appropriate command runner
  try {
    switch (targetAction) {
      case 'player_map': {
        const { runMap } = await import('../commands/player/map.js');
        await runMap(interaction);
        break;
      }
      case 'tavern_rest': {
        const { runTavernRest } = await import('../commands/player/map.js');
        await runTavernRest(interaction);
        break;
      }
      case 'combat_explore': {
        const { runExplore } = await import('../commands/combat/combat.js');
        // If extra is provided, it's the zoneId. Otherwise, let explore prompt or pick a default/previous one
        await runExplore(interaction, extra || undefined);
        break;
      }
      case 'combat_hunt': {
        // Trigger a hunt from the map system — spawn combat then go to fight screen
        const { huntNode } = await import('../systems/exploration/worldExplorer.js');
        const { runFight } = await import('../commands/combat/combat.js');
        const { getPlayerWithClampedStats } = await import('../database/queries/player.js');
        try {
          if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate();
          }
          const player = await getPlayerWithClampedStats(interaction.user.id);
          if (!player) {
            throw new Error('Player profile not found. Please complete the /tutorial first.');
          }
          await huntNode(player.id, extra || undefined);
          await runFight(interaction);
        } catch (err: any) {
          console.error('Error in combat_hunt navigation:', err);
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: `❌ ${err.message || 'Hunt failed.'}`, flags: [MessageFlags.Ephemeral] });
          } else {
            await interaction.reply({ content: `❌ ${err.message || 'Hunt failed.'}`, flags: [MessageFlags.Ephemeral] });
          }
        }
        break;
      }
      case 'combat_fight': {
        const { runFight } = await import('../commands/combat/combat.js');
        await runFight(interaction);
        break;
      }
      case 'inventory_bag': {
        const { runBag } = await import('../commands/inventory/inventory.js');
        await runBag(interaction);
        break;
      }
      case 'inventory_equip': {
        const { runEquip } = await import('../commands/inventory/inventory.js');
        await runEquip(interaction);
        break;
      }
      case 'inventory_sell': {
        const { runSell } = await import('../commands/inventory/inventory.js');
        await runSell(interaction);
        break;
      }
      case 'economy_shop': {
        const { runShopList } = await import('../commands/economy/economy.js');
        await runShopList(interaction);
        break;
      }
      case 'quest_board': {
        const { runQuestsBoard } = await import('../commands/quests/quest.js');
        await runQuestsBoard(interaction);
        break;
      }
      case 'player_profile': {
        const { runProfile } = await import('../commands/player/player.js');
        await runProfile(interaction);
        break;
      }
      case 'player_stats': {
        const { runStats } = await import('../commands/player/player.js');
        await runStats(interaction);
        break;
      }
      case 'help': {
        const { runHelp } = await import('../commands/player/help.js');
        await runHelp(interaction);
        break;
      }
      case 'boss_info': {
        // Boss is separate because it is a distinct top level command system in boss.ts
        const { runBossInfo } = await import('../commands/combat/boss.js');
        await runBossInfo(interaction);
        break;
      }
      default:
        await interaction.reply({
          content: `❌ Unknown navigation action: ${targetAction}`,
          flags: [MessageFlags.Ephemeral]
        });
    }
  } catch (error) {
    console.error(`Error handling navigation interaction for ${targetAction}:`, error);
    await interaction.reply({
      content: '❌ Failed to process navigation. Please try typing the command manually.',
      flags: [MessageFlags.Ephemeral]
    });
  }
}
