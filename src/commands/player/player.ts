import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { getEquippedItems } from '../../database/queries/inventory.js';
import { getPlayerGuild } from '../../database/queries/guild.js';
import { getActiveQuests } from '../../database/queries/quest.js';
import { computeStats } from '../../systems/progression/stats.js';
import { getXpForLevel } from '../../systems/progression/leveling.js';
import { questsCatalog } from '../../utils/catalog.js';
import { canPrestige, getPrestigeRewards, calculatePrestigeReset } from '../../systems/progression/prestige.js';
import { db } from '../../database/client.js';
import { players, playerSkills } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { profileEmbed, statsEmbed, errorEmbed, successEmbed } from '../../utils/embeds.js';
import { loadItems } from '../../systems/exploration/loot.js';
import { getNavButtons } from '../../utils/navigation.js';
import { SKILLS } from '../../systems/combat/skills.js';

export const data = new SlashCommandBuilder()
  .setName('player')
  .setDescription('View profile, stats, or prestige.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('profile')
      .setDescription('View your character profile card.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('stats')
      .setDescription('View your detailed attribute sheet.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('preset')
      .setDescription('Configure your 3 quick-cast attack/skill presets.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('prestige')
      .setDescription('Reset your level to 1 for permanent stat bonuses (+5% per prestige).')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'profile') {
    await runProfile(interaction);
  } else if (subcommand === 'stats') {
    await runStats(interaction);
  } else if (subcommand === 'preset') {
    await runPreset(interaction);
  } else if (subcommand === 'prestige') {
    await runPrestige(interaction);
  }
}

// ----------------------------------------------------
// RUNNERS (exposures for slash commands and buttons)
// ----------------------------------------------------

export async function runProfile(
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

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    // Fetch equipped items
    const equippedDbItems = await getEquippedItems(player.id);
    const catalog = loadItems();

    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return {
        slot: def?.type || 'accessory',
        name: def ? `${def.name} ${dbItem.enhancement > 0 ? `+${dbItem.enhancement}` : ''}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        stats: def?.stats || {}
      };
    });

    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null,
      []
    );

    const guildMemberInfo = await getPlayerGuild(player.id);
    const guildName = guildMemberInfo?.guildName || undefined;

    // Fetch active story quest name
    const activeQuests = await getActiveQuests(player.id);
    const activeStoryDb = activeQuests.find((q) => {
      const def = questsCatalog.find((qc) => qc.id === q.questId);
      return def?.type === 'story';
    });
    let storyQuestName = 'None';
    if (activeStoryDb) {
      const def = questsCatalog.find((qc) => qc.id === activeStoryDb.questId);
      storyQuestName = def ? def.name : activeStoryDb.questId;
    } else if (player.level === 20) {
      storyQuestName = '🏆 Story Complete (Max Level)';
    }

    const embed = profileEmbed(
      {
        username: player.username,
        level: player.level,
        className: player.playerClass === 'novice' ? null : player.playerClass,
        gold: player.gold,
        gems: player.gems,
        prestige: player.prestige,
        currentHp: player.hpCurrent,
        maxHp: stats.hpMax,
        currentMana: player.manaCurrent,
        maxMana: stats.manaMax,
        storyQuestName
      },
      stats,
      equippedItemsList,
      guildName
    );

    // Add navigation buttons
    const navButtons = getNavButtons('player_prestige_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    console.error('Error running profile:', error);
    const embed = errorEmbed('Profile Error', 'Failed to retrieve profile data.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runStats(
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

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    // Fetch equipped items
    const equippedDbItems = await getEquippedItems(player.id);
    const catalog = loadItems();

    const equippedItemsList = equippedDbItems.map((dbItem) => {
      const def = catalog.find((i) => i.id === dbItem.itemId);
      return {
        slot: def?.type || 'accessory',
        name: def ? `${def.name} ${dbItem.enhancement > 0 ? `+${dbItem.enhancement}` : ''}` : dbItem.itemId,
        rarity: def?.rarity || 'common',
        stats: def?.stats || {}
      };
    });

    const stats = computeStats(
      player.level,
      player.prestige,
      player.playerClass,
      equippedItemsList,
      null,
      []
    );

    const embed = statsEmbed(
      {
        username: player.username,
        level: player.level,
        className: player.playerClass === 'novice' ? null : player.playerClass
      },
      stats
    );

    // Add profile navigation button
    const navButtons = getNavButtons('player_prestige_result', player.discordId);

    await interaction.editReply({
      embeds: [embed],
      components: navButtons ? [navButtons] : []
    });
  } catch (error) {
    console.error('Error running stats:', error);
    const embed = errorEmbed('Stats Error', 'Failed to retrieve your detailed stats.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function runPrestige(
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

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    if (!canPrestige(player.level)) {
      const embed = errorEmbed(
        'Prestige Denied',
        `You must reach Level 20 to prestige. Current level: **${player.level}**.`
      );
      await interaction.editReply({ embeds: [embed], components: [] });
      return;
    }

    const nextPrestige = player.prestige + 1;
    const resetRules = calculatePrestigeReset();
    const rewards = getPrestigeRewards(nextPrestige);

    const baseNewGold = Math.floor(player.gold * resetRules.gold);
    const finalNewGold = baseNewGold + rewards.gold;

    const confirmEmbed = errorEmbed(
      'Ascension Call — Confirm Prestige',
      `You are about to ascend to **Prestige ${nextPrestige}**. This action is **irreversible**!\n\n` +
      `**Resets Applied:**\n` +
      `❌ Level: **${player.level}** ➡️ **1**\n` +
      `❌ EXP: **${player.exp}** ➡️ **0**\n` +
      `❌ Gold: **${player.gold.toLocaleString()}** ➡️ **${finalNewGold.toLocaleString()}** (90% reduction, +${rewards.gold.toLocaleString()} reward)\n\n` +
      `**Rewards Unlocked:**\n` +
      `💎 Gems: +**${rewards.gems}**\n` +
      (rewards.title ? `🏅 Title: **"${rewards.title}"**\n` : '') +
      `⭐ Permanent stat bonus: **+${nextPrestige * 5}%** (up from +${player.prestige * 5}%)\n\n` +
      `Click **Ascend** to proceed, or **Cancel** to keep your character level.`
    );
    confirmEmbed.setColor(0xF59E0B);

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`prestige_confirm_${player.discordId}`)
      .setLabel('Ascend (Prestige)')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('⭐');

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`prestige_cancel_${player.discordId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmBtn, cancelBtn);

    await interaction.editReply({
      embeds: [confirmEmbed],
      components: [row]
    });
  } catch (error) {
    console.error('Error running prestige:', error);
    const embed = errorEmbed('Prestige Error', 'An unexpected error occurred during prestige reset.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

// ----------------------------------------------------
// INTERACTION HANDLERS (routed from interactionCreate)
// ----------------------------------------------------

export async function handlePrestigeInteraction(interaction: ButtonInteraction) {
  const parts = interaction.customId.split('_'); // prestige_confirm_{userId} or prestige_cancel_{userId}
  const action = parts[1];
  const userId = parts[2];

  if (interaction.user.id !== userId) return;

  const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('prestige_confirm_dis').setLabel('Ascend (Prestige)').setStyle(ButtonStyle.Danger).setEmoji('⭐').setDisabled(true),
    new ButtonBuilder().setCustomId('prestige_cancel_dis').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setDisabled(true)
  );

  try {
    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);

    if (action === 'confirm') {
      if (!canPrestige(player.level)) {
        const embed = errorEmbed('Prestige Denied', 'Your character state has changed and you can no longer prestige.');
        await interaction.update({ embeds: [embed], components: [disabledRow] });
        return;
      }

      const nextPrestige = player.prestige + 1;
      const resetRules = calculatePrestigeReset();
      const rewards = getPrestigeRewards(nextPrestige);

      const baseNewGold = Math.floor(player.gold * resetRules.gold);
      const finalNewGold = baseNewGold + rewards.gold;
      const finalNewGems = player.gems + rewards.gems;

      await db
        .update(players)
        .set({
          level: resetRules.level,
          exp: resetRules.exp,
          gold: finalNewGold,
          gems: finalNewGems,
          prestige: nextPrestige,
          hpCurrent: 100,
          manaCurrent: 50
        })
        .where(eq(players.id, player.id));

      let rewardsText = `🪙 Gold: Reset to 10% (**${baseNewGold.toLocaleString()}**), then rewarded +**${rewards.gold.toLocaleString()}** (Total: **${finalNewGold.toLocaleString()}**)\n💎 Gems: +**${rewards.gems}**`;
      if (rewards.title) {
        rewardsText += `\n🏅 Unlocked Title: **"${rewards.title}"**`;
      }

      const successEm = successEmbed(
        'Prestige Successful!',
        `You have ascended to **Prestige ${nextPrestige}**!\n\n` +
        `**Resets Applied:**\n` +
        `⭐ Level: 1\n` +
        `✨ EXP: 0\n\n` +
        `**Ascension Rewards:**\n` +
        rewardsText + `\n\n` +
        `*You now receive a permanent **+${nextPrestige * 5}%** bonus to all combat stats.*`
      );

      const navRow = getNavButtons('player_prestige_result', player.discordId);

      await interaction.update({
        embeds: [successEm],
        components: navRow ? [navRow] : []
      });
    } else {
      const cancelEmbed = errorEmbed('Prestige Cancelled', 'You chose not to prestige. Your progress has been preserved.');
      cancelEmbed.setColor(0x9CA3AF);

      const navRow = getNavButtons('player_prestige_result', player.discordId);

      await interaction.update({
        embeds: [cancelEmbed],
        components: navRow ? [navRow] : []
      });
    }
  } catch (error) {
    console.error('Error handling prestige button:', error);
    await interaction.followUp({ content: '❌ Failed to process prestige action.', ephemeral: true });
  }
}

export async function runPreset(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  feedbackMsg?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const presets = (player.presets || ['attack', null, null]) as (string | null)[];

    const getPresetName = (presetId: string | null) => {
      if (!presetId) return '🔴 *Empty*';
      if (presetId === 'attack') return '⚔️ Basic Attack';
      const skillDef = SKILLS.find((s) => s.id === presetId);
      return skillDef ? `🌀 ${skillDef.name}` : presetId;
    };

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('⚙️ Combat Quick Presets')
      .setDescription(
        (feedbackMsg ? `✅ **${feedbackMsg}**\n\n` : '') +
        'Configure up to 3 quick-cast presets to use in combat or boss raids.\n' +
        'Click a button below to set that preset slot.'
      )
      .addFields(
        { name: 'Button 1 Preset', value: getPresetName(presets[0]), inline: true },
        { name: 'Button 2 Preset', value: getPresetName(presets[1]), inline: true },
        { name: 'Button 3 Preset', value: getPresetName(presets[2]), inline: true }
      )
      .setFooter({ text: 'Arcanora — Quick Presets' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_set_1_${player.discordId}`)
        .setLabel('Set Preset 1')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`player_preset_set_2_${player.discordId}`)
        .setLabel('Set Preset 2')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`player_preset_set_3_${player.discordId}`)
        .setLabel('Set Preset 3')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } catch (err) {
    console.error('Error running preset command:', err);
    const embed = errorEmbed('Preset Error', 'An error occurred while loading presets.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handlePresetInteraction(interaction: ButtonInteraction | any) {
  const parts = interaction.customId.split('_');
  const actionType = parts[2];
  const slotNum = parseInt(parts[3] || '1', 10);
  const userId = parts[4] || '';

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This preset menu is not yours!',
      ephemeral: true
    });
    return;
  }

  if (actionType === 'set') {
    await interaction.deferUpdate();
    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));

    const options = [
      {
        label: 'Basic Attack',
        value: 'attack',
        description: 'Perform a normal strike.',
        emoji: '⚔️'
      }
    ];

    learned.forEach((l) => {
      const skillDef = SKILLS.find((s) => s.id === l.skillId);
      if (skillDef) {
        options.push({
          label: skillDef.name,
          value: skillDef.id,
          description: skillDef.description.slice(0, 50),
          emoji: '🌀'
        });
      }
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`player_preset_select_${slotNum}_${userId}`)
      .setPlaceholder(`Select action for Preset ${slotNum}...`)
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(`⚙️ Set Preset ${slotNum}`)
      .setDescription(`Choose a combat action from your learned skills to map to Preset ${slotNum}.`);

    await interaction.editReply({
      embeds: [embed],
      components: [row]
    });
  } else if (actionType === 'select') {
    await interaction.deferUpdate();
    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const selectedAction = interaction.values[0];

    const presets = [...(player.presets as (string | null)[])];
    presets[slotNum - 1] = selectedAction;

    await db
      .update(players)
      .set({ presets })
      .where(eq(players.id, player.id));

    const getPresetName = (presetId: string | null) => {
      if (!presetId) return 'Empty';
      if (presetId === 'attack') return 'Basic Attack';
      const skillDef = SKILLS.find((s) => s.id === presetId);
      return skillDef ? skillDef.name : presetId;
    };

    await runPreset(interaction, `Preset ${slotNum} successfully mapped to ${getPresetName(selectedAction)}!`);
  }
}
