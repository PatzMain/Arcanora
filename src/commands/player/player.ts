import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
import { SKILLS, getSkillById } from '../../systems/combat/skills.js';
import { parsePresets, getPresetActionSummary } from '../../systems/combat/presets.js';

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
  interaction: ChatInputCommandInteraction | ButtonInteraction | any,
  feedbackMsg?: string
) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const player = await findOrCreatePlayer(interaction.user.id, interaction.user.username);
    const presets = parsePresets(player.presets);

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('⚙️ Combat Quick Presets')
      .setDescription(
        (feedbackMsg ? `✅ **${feedbackMsg}**\n\n` : '') +
        'Configure up to 3 quick-cast presets to use in combat or boss raids.\n' +
        'Each preset can hold a combo of up to 3 actions. Click a button below to configure.'
      )
      .addFields(
        { name: `🎯 ${presets[0].name}`, value: `**Combo:** ${getPresetActionSummary(presets[0])}` },
        { name: `🎯 ${presets[1].name}`, value: `**Combo:** ${getPresetActionSummary(presets[1])}` },
        { name: `🎯 ${presets[2].name}`, value: `**Combo:** ${getPresetActionSummary(presets[2])}` }
      )
      .setFooter({ text: 'Arcanora — Quick Presets' })
      .setTimestamp();

    // Row 1: Edit buttons
    const rowEdit = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_edit_1_${player.discordId}`)
        .setLabel('Edit P1')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚙️'),
      new ButtonBuilder()
        .setCustomId(`player_preset_edit_2_${player.discordId}`)
        .setLabel('Edit P2')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚙️'),
      new ButtonBuilder()
        .setCustomId(`player_preset_edit_3_${player.discordId}`)
        .setLabel('Edit P3')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('⚙️')
    );

    // Row 2: Rename buttons
    const rowRename = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_rename_1_${player.discordId}`)
        .setLabel('Rename P1')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`player_preset_rename_2_${player.discordId}`)
        .setLabel('Rename P2')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId(`player_preset_rename_3_${player.discordId}`)
        .setLabel('Rename P3')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️')
    );

    // Row 3: Navigation buttons
    const navButtons = getNavButtons('player_prestige_result', player.discordId);

    const components = [rowEdit, rowRename];
    if (navButtons) {
      components.push(navButtons);
    }

    await interaction.editReply({
      embeds: [embed],
      components
    });
  } catch (err) {
    console.error('Error running preset command:', err);
    const embed = errorEmbed('Preset Error', 'An error occurred while loading presets.');
    await interaction.editReply({ embeds: [embed], components: [] });
  }
}

export async function handlePresetInteraction(interaction: ButtonInteraction | any) {
  const customId = interaction.customId;
  const parts = customId.split('_');

  // Format:
  // player_preset_menu_[userId]
  // player_preset_edit_[slot]_[userId]
  // player_preset_rename_[slot]_[userId]
  // player_preset_select_[slot]_[step]_[action1]_[action2]_[userId]
  // player_preset_modal_[slot]_[userId]

  const actionType = parts[2]; // 'menu', 'edit', 'rename', 'select', 'modal'

  let slotNum = 1;
  let userId = '';

  if (actionType === 'menu') {
    userId = parts[3] || '';
  } else {
    slotNum = parseInt(parts[3] || '1', 10);
  }

  if (actionType === 'select') {
    userId = parts[7] || '';
  } else if (actionType === 'modal') {
    userId = parts[4] || '';
  } else if (actionType === 'edit' || actionType === 'rename') {
    userId = parts[4] || '';
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This preset menu is not yours!',
      ephemeral: true
    });
    return;
  }

  if (actionType === 'menu') {
    await runPreset(interaction);
    return;
  }

  if (actionType === 'rename') {
    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const presets = parsePresets(player.presets);
    const currentPresetName = presets[slotNum - 1]?.name || `Preset ${slotNum}`;

    const modal = new ModalBuilder()
      .setCustomId(`player_preset_modal_${slotNum}_${userId}`)
      .setTitle(`Rename Preset ${slotNum}`);

    const nameInput = new TextInputBuilder()
      .setCustomId('preset_name_input')
      .setLabel('Preset Name')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter custom preset name...')
      .setMaxLength(20)
      .setValue(currentPresetName)
      .setRequired(true);

    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput);
    modal.addComponents(firstActionRow);

    await interaction.showModal(modal);
    return;
  }

  if (actionType === 'modal') {
    await interaction.deferUpdate();
    const newName = interaction.fields.getTextInputValue('preset_name_input').trim().slice(0, 20) || `Preset ${slotNum}`;

    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];
    if (slot) {
      slot.name = newName;
    }

    await db
      .update(players)
      .set({ presets })
      .where(eq(players.id, player.id));

    await runPreset(interaction, `Preset ${slotNum} renamed to "${newName}"!`);
    return;
  }

  if (actionType === 'edit') {
    await interaction.deferUpdate();
    await showEditStep(interaction, slotNum, 1, [], userId);
    return;
  }

  if (actionType === 'select') {
    await interaction.deferUpdate();
    const step = parseInt(parts[4] || '1', 10);
    const action1 = parts[5] || 'none';
    const action2 = parts[6] || 'none';
    const selectedValue = interaction.values[0];

    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];

    if (slot) {
      if (step === 1) {
        await showEditStep(interaction, slotNum, 2, [selectedValue], userId);
      } else if (step === 2) {
        if (selectedValue === 'none') {
          slot.actions = [action1];
          await savePreset(player.id, presets);
          await runPreset(interaction, `Preset ${slotNum} combo saved: ${getPresetActionSummary(slot)}`);
        } else {
          await showEditStep(interaction, slotNum, 3, [action1, selectedValue], userId);
        }
      } else if (step === 3) {
        if (selectedValue === 'none') {
          slot.actions = [action1, action2];
        } else {
          slot.actions = [action1, action2, selectedValue];
        }
        await savePreset(player.id, presets);
        await runPreset(interaction, `Preset ${slotNum} combo saved: ${getPresetActionSummary(slot)}`);
      }
    }
  }
}

async function savePreset(playerId: string, presets: any) {
  await db
    .update(players)
    .set({ presets })
    .where(eq(players.id, playerId));
}

async function showEditStep(
  interaction: any,
  slotNum: number,
  step: number,
  currentCombo: string[],
  userId: string
) {
  const player = await findOrCreatePlayer(userId, interaction.user.username);
  const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));

  const options = [];

  if (step > 1) {
    options.push({
      label: '🏁 Save / End Combo Here',
      value: 'none',
      description: 'End the sequence and save current combo.'
    });
  }

  options.push({
    label: 'Basic Attack',
    value: 'attack',
    description: 'Perform a normal physical strike.',
    emoji: '⚔️'
  });

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

  const action1 = currentCombo[0] || 'none';
  const action2 = currentCombo[1] || 'none';
  const customId = `player_preset_select_${slotNum}_${step}_${action1}_${action2}_${userId}`;

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(`Select action for Step ${step} in combo...`)
    .addOptions(options);

  const rowMenu = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const rowCancel = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`player_preset_menu_${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Danger)
  );

  const currentComboDesc = currentCombo.length > 0
    ? currentCombo.map(a => a === 'attack' ? '⚔️ Basic Attack' : `🌀 ${SKILLS.find(s => s.id === a)?.name || a}`).join(' ➔ ')
    : '*None*';

  const embed = new EmbedBuilder()
    .setColor(0x7C3AED)
    .setTitle(`⚙️ Set Preset ${slotNum} — Step ${step} of 3`)
    .setDescription(
      `Select the action for step ${step} in your combo.\n\n` +
      `**Current Sequence:** ${currentComboDesc}`
    );

  await interaction.editReply({
    embeds: [embed],
    components: [rowMenu, rowCancel]
  });
}
