import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { players, playerSkills, combatSessions } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { errorEmbed } from '../../utils/embeds.js';
import { getNavButtons, buildNavId } from '../../utils/navigation.js';
import { SKILLS } from '../../systems/combat/skills.js';
import { parsePresets, getPresetActionSummary } from '../../systems/combat/presets.js';

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
        { name: `🎯 ${presets[0].name}`, value: `**Combo:** ${getPresetActionSummary(presets[0], player.playerClass)}` },
        { name: `🎯 ${presets[1].name}`, value: `**Combo:** ${getPresetActionSummary(presets[1], player.playerClass)}` },
        { name: `🎯 ${presets[2].name}`, value: `**Combo:** ${getPresetActionSummary(presets[2], player.playerClass)}` }
      )
      .setFooter({ text: 'Arcanora — Quick Presets' })
      .setTimestamp();

    // Row 1: Configure buttons
    const rowConfig = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_config_1_${player.discordId}`)
        .setLabel('⚙️ Configure P1')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`player_preset_config_2_${player.discordId}`)
        .setLabel('⚙️ Configure P2')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`player_preset_config_3_${player.discordId}`)
        .setLabel('⚙️ Configure P3')
        .setStyle(ButtonStyle.Primary)
    );

    // Row 2: Navigation buttons
    const activeSession = await db.query.combatSessions.findFirst({
      where: eq(combatSessions.playerId, player.id)
    });

    let navButtons;
    if (activeSession) {
      navButtons = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(buildNavId('combat_fight', player.discordId))
          .setLabel('⚔️ Back to Fight')
          .setStyle(ButtonStyle.Primary)
      );
    } else {
      navButtons = getNavButtons('player_prestige_result', player.discordId);
    }

    const components = [rowConfig];
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

export async function runConfigurePreset(
  interaction: any,
  slotNum: number,
  selectedStep: number = 1,
  action1: string = 'attack',
  action2: string = 'none',
  action3: string = 'none',
  feedbackMsg?: string
) {
  try {
    const discordId = interaction.user.id;
    const player = await findOrCreatePlayer(discordId, interaction.user.username);
    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];

    if (!slot) {
      throw new Error('Preset slot not found.');
    }

    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
    const filteredLearned = learned.filter(l => l.skillId !== 'skill_basic_attack');
    // Sort learned skills alphabetically to make availableActions deterministic
    filteredLearned.sort((a, b) => a.skillId.localeCompare(b.skillId));
    const availableActions = ['attack', ...filteredLearned.map(l => l.skillId)];

    const getActionName = (act: string) => {
      if (act === 'none') return 'Empty';
      if (act === 'attack') return 'Basic Attack';
      const skillDef = SKILLS.find(s => s.id === act);
      return skillDef ? skillDef.name : act;
    };

    const preview1 = selectedStep === 1 ? `👉 **Step 1: ${getActionName(action1)}**` : `• Step 1: ${getActionName(action1)}`;
    const preview2 = selectedStep === 2 ? `👉 **Step 2: ${getActionName(action2)}**` : `• Step 2: ${getActionName(action2)}`;
    const preview3 = selectedStep === 3 ? `👉 **Step 3: ${getActionName(action3)}**` : `• Step 3: ${getActionName(action3)}`;

    const currentComboDesc = `${preview1}\n${preview2}\n${preview3}`;

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle(`⚙️ Configure Preset ${slotNum}: ${slot.name}`)
      .setDescription(
        (feedbackMsg ? `✅ **${feedbackMsg}**\n\n` : '') +
        `Configure the name and the 3-action combo sequence for this preset.\n\n` +
        `**Combo Steps:**\n${currentComboDesc}\n\n` +
        `1. Click **Step 1**, **Step 2**, or **Step 3** below to choose which step to edit (active step marked with 👉).\n` +
        `2. Click any action option button below to assign it to the active step.\n` +
        `3. When ready, click **Save Combo**.`
      )
      .setFooter({ text: `Preset ${slotNum} Setup` })
      .setTimestamp();

    const mapActionToCode = (action: string) => {
      if (action === 'none' || !action) return 'x';
      const idx = availableActions.indexOf(action);
      return idx >= 0 ? idx.toString() : 'x';
    };

    const code1 = mapActionToCode(action1);
    const code2 = mapActionToCode(action2);
    const code3 = mapActionToCode(action3);

    const components: any[] = [];

    // Row 1: Step Selector Buttons
    const stepRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_step_${slotNum}_1_${code1}_${code2}_${code3}_${discordId}`)
        .setLabel(`Step 1: ${getActionName(action1)}`)
        .setStyle(selectedStep === 1 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`player_preset_step_${slotNum}_2_${code1}_${code2}_${code3}_${discordId}`)
        .setLabel(`Step 2: ${getActionName(action2)}`)
        .setStyle(selectedStep === 2 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`player_preset_step_${slotNum}_3_${code1}_${code2}_${code3}_${discordId}`)
        .setLabel(`Step 3: ${getActionName(action3)}`)
        .setStyle(selectedStep === 3 ? ButtonStyle.Success : ButtonStyle.Secondary)
    );
    components.push(stepRow);

    // Row 2 & 3: Action Option Buttons for the active step
    const { getBasicAttackEmoji, SKILL_EMOJIS } = await import('../../systems/combat/presets.js');
    const choices = [];
    if (selectedStep > 1) {
      choices.push({ id: 'none', name: '🏁 End / Empty', emoji: '🏁' });
    }
    choices.push({ id: 'attack', name: 'Basic Attack', emoji: getBasicAttackEmoji(player.playerClass) });
    filteredLearned.forEach(l => {
      const skillDef = SKILLS.find(s => s.id === l.skillId);
      if (skillDef) {
        choices.push({ id: skillDef.id, name: skillDef.name, emoji: SKILL_EMOJIS[skillDef.id] || '🌀' });
      }
    });

    const activeAction = selectedStep === 1 ? action1 : (selectedStep === 2 ? action2 : action3);
    
    let currentOptionRow = new ActionRowBuilder<ButtonBuilder>();
    choices.forEach((c, idx) => {
      if (idx > 0 && idx % 5 === 0) {
        components.push(currentOptionRow);
        currentOptionRow = new ActionRowBuilder<ButtonBuilder>();
      }
      
      const optCode = mapActionToCode(c.id);
      const isSelected = activeAction === c.id;
      
      currentOptionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`player_preset_act_${slotNum}_${selectedStep}_${optCode}_${code1}_${code2}_${code3}_${discordId}`)
          .setLabel(c.name)
          .setStyle(isSelected ? ButtonStyle.Primary : ButtonStyle.Secondary)
          .setEmoji(c.emoji)
      );
    });
    
    if (currentOptionRow.components.length > 0) {
      components.push(currentOptionRow);
    }

    // Row 4: Save, Rename, Back Actions
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`player_preset_save_${slotNum}_${code1}_${code2}_${code3}_${discordId}`)
        .setLabel('💾 Save Combo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`player_preset_rename_${slotNum}_${selectedStep}_${code1}_${code2}_${code3}_${discordId}`)
        .setLabel('✏️ Rename Preset')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`player_preset_configback_${discordId}`)
        .setLabel('❌ Back')
        .setStyle(ButtonStyle.Secondary)
    );
    components.push(buttonRow);

    await interaction.editReply({
      embeds: [embed],
      components
    });

  } catch (error) {
    console.error('Error displaying configure preset:', error);
    const err = errorEmbed('Preset Config Error', 'Failed to load configuration panel.');
    await interaction.editReply({ embeds: [err], components: [] });
  }
}

export async function handlePresetInteraction(interaction: ButtonInteraction | any) {
  const customId = interaction.customId;
  const parts = customId.split('_');

  // Format:
  // player_preset_menu_[userId]
  // player_preset_config_[slot]_[userId]
  // player_preset_step_[slot]_[selectedStep]_[code1]_[code2]_[code3]_[userId]
  // player_preset_act_[slot]_[selectedStep]_[optCode]_[code1]_[code2]_[code3]_[userId]
  // player_preset_save_[slot]_[code1]_[code2]_[code3]_[userId]
  // player_preset_rename_[slot]_[selectedStep]_[code1]_[code2]_[code3]_[userId]
  // player_preset_modal_[slot]_[selectedStep]_[code1]_[code2]_[code3]_[userId]
  // player_preset_configback_[userId]

  const actionType = parts[2];

  let slotNum = 1;
  let userId = '';

  if (actionType === 'menu' || actionType === 'configback') {
    userId = parts[3] || '';
  } else {
    slotNum = parseInt(parts[3] || '1', 10);
  }

  if (actionType === 'step') {
    userId = parts[8] || '';
  } else if (actionType === 'act') {
    userId = parts[9] || '';
  } else if (actionType === 'save') {
    userId = parts[7] || '';
  } else if (actionType === 'rename' || actionType === 'modal') {
    userId = parts[8] || '';
  } else if (actionType === 'config') {
    userId = parts[4] || '';
  }

  if (interaction.user.id !== userId) {
    await interaction.reply({
      content: '❌ This preset menu is not yours!',
      ephemeral: true
    });
    return;
  }

  if (actionType === 'menu' || actionType === 'configback') {
    await runPreset(interaction);
    return;
  }

  if (actionType === 'config') {
    await interaction.deferUpdate();
    const player = await findOrCreatePlayer(userId, interaction.user.username);
    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];
    const actions = slot?.actions || [];
    
    await runConfigurePreset(
      interaction,
      slotNum,
      1,
      actions[0] || 'attack',
      actions[1] || 'none',
      actions[2] || 'none'
    );
    return;
  }

  const player = await findOrCreatePlayer(userId, interaction.user.username);
  const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, player.id));
  const filteredLearned = learned.filter(l => l.skillId !== 'skill_basic_attack');
  // Sort learned skills alphabetically to make availableActions deterministic
  filteredLearned.sort((a, b) => a.skillId.localeCompare(b.skillId));
  const availableActions = ['attack', ...filteredLearned.map(l => l.skillId)];

  const mapCodeToAction = (code: string) => {
    if (code === 'x') return 'none';
    const idx = parseInt(code, 10);
    return availableActions[idx] || 'none';
  };

  if (actionType === 'step') {
    await interaction.deferUpdate();
    const targetStep = parseInt(parts[4] || '1', 10);
    const action1 = mapCodeToAction(parts[5] || 'x');
    const action2 = mapCodeToAction(parts[6] || 'x');
    const action3 = mapCodeToAction(parts[7] || 'x');

    await runConfigurePreset(interaction, slotNum, targetStep, action1, action2, action3);
    return;
  }

  if (actionType === 'act') {
    await interaction.deferUpdate();
    const selectedStep = parseInt(parts[4] || '1', 10);
    const optCode = parts[5] || 'x';
    let action1 = mapCodeToAction(parts[6] || 'x');
    let action2 = mapCodeToAction(parts[7] || 'x');
    let action3 = mapCodeToAction(parts[8] || 'x');
    const targetAction = mapCodeToAction(optCode);

    if (selectedStep === 1) action1 = targetAction;
    else if (selectedStep === 2) action2 = targetAction;
    else if (selectedStep === 3) action3 = targetAction;

    await runConfigurePreset(interaction, slotNum, selectedStep, action1, action2, action3);
    return;
  }

  if (actionType === 'rename') {
    const selectedStep = parseInt(parts[4] || '1', 10);
    const code1 = parts[5] || 'x';
    const code2 = parts[6] || 'x';
    const code3 = parts[7] || 'x';
    const presets = parsePresets(player.presets);
    const currentPresetName = presets[slotNum - 1]?.name || `Preset ${slotNum}`;

    const modal = new ModalBuilder()
      .setCustomId(`player_preset_modal_${slotNum}_${selectedStep}_${code1}_${code2}_${code3}_${userId}`)
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
    const selectedStep = parseInt(parts[4] || '1', 10);
    const code1 = parts[5] || 'x';
    const code2 = parts[6] || 'x';
    const code3 = parts[7] || 'x';
    const newName = interaction.fields.getTextInputValue('preset_name_input').trim().slice(0, 20) || `Preset ${slotNum}`;

    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];
    if (slot) {
      slot.name = newName;
    }

    await db
      .update(players)
      .set({ presets })
      .where(eq(players.id, player.id));

    await runConfigurePreset(
      interaction,
      slotNum,
      selectedStep,
      mapCodeToAction(code1),
      mapCodeToAction(code2),
      mapCodeToAction(code3),
      `Preset renamed to "${newName}"!`
    );
    return;
  }

  if (actionType === 'save') {
    await interaction.deferUpdate();
    const code1 = parts[4] || 'x';
    const code2 = parts[5] || 'x';
    const code3 = parts[6] || 'x';

    const presets = parsePresets(player.presets);
    const slot = presets[slotNum - 1];

    if (slot) {
      const action1 = mapCodeToAction(code1);
      const action2 = mapCodeToAction(code2);
      const action3 = mapCodeToAction(code3);
      
      const finalActions = [action1, action2, action3].filter(a => a !== 'none');
      slot.actions = finalActions;

      await db
        .update(players)
        .set({ presets })
        .where(eq(players.id, player.id));

      await runPreset(
        interaction,
        `Preset "${slot.name}" combo sequence saved successfully!`
      );
    }
    return;
  }
}
