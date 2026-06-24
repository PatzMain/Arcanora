import { ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { getSkillById, SKILLS } from './skills.js';

export interface PresetSlot {
  name: string;
  actions: string[]; // List of action IDs (e.g. ['attack', 'warrior_power_strike'])
}

export type PlayerPresets = [PresetSlot, PresetSlot, PresetSlot];

/**
 * Converts legacy presets (flat string array) or invalid values to the new PlayerPresets format.
 */
export function migrateOldPresets(raw: any): PlayerPresets {
  const defaultPresets: PlayerPresets = [
    { name: 'Preset 1', actions: ['attack'] },
    { name: 'Preset 2', actions: [] },
    { name: 'Preset 3', actions: [] }
  ];

  if (!raw) {
    return defaultPresets;
  }

  // If it's the old format: e.g. ["attack", null, "mage_fireball"]
  if (Array.isArray(raw) && raw.length === 3 && (typeof raw[0] === 'string' || raw[0] === null)) {
    const migrated: PlayerPresets = [
      { name: 'Preset 1', actions: raw[0] ? [raw[0]] : [] },
      { name: 'Preset 2', actions: raw[1] ? [raw[1]] : [] },
      { name: 'Preset 3', actions: raw[2] ? [raw[2]] : [] }
    ];
    return migrated;
  }

  // If it is already a structured array, sanitize it
  if (Array.isArray(raw) && raw.length === 3) {
    const sanitized = raw.map((slot: any, idx: number) => {
      if (typeof slot !== 'object' || slot === null) {
        return { name: `Preset ${idx + 1}`, actions: [] };
      }
      return {
        name: typeof slot.name === 'string' && slot.name.trim() ? slot.name.trim().slice(0, 20) : `Preset ${idx + 1}`,
        actions: Array.isArray(slot.actions)
          ? slot.actions.filter((a: any) => typeof a === 'string' && a !== '').slice(0, 3)
          : []
      };
    });
    return sanitized as PlayerPresets;
  }

  return defaultPresets;
}

/**
 * Safely parses the presets from DB column.
 */
export function parsePresets(raw: any): PlayerPresets {
  return migrateOldPresets(raw);
}

/**
 * Returns a short label for the preset button.
 */
export function getPresetLabel(slot: PresetSlot): string {
  if (!slot || !slot.actions || slot.actions.length === 0) {
    return 'Empty';
  }
  return slot.name;
}

/**
 * Returns a human-readable list of actions in a combo.
 */
export function getPresetActionSummary(slot: PresetSlot): string {
  if (!slot || !slot.actions || slot.actions.length === 0) {
    return '🔴 *Empty*';
  }

  return slot.actions
    .map((action) => {
      if (action === 'attack') return '⚔️ Attack';
      const skill = getSkillById(action);
      return skill ? `🌀 ${skill.name}` : '❓ Unknown';
    })
    .join(' ➔ ');
}

/**
 * Builds the ActionRow containing 3 preset buttons for standard combat or boss fights.
 */
export function buildPresetButtons(presets: PlayerPresets, prefix: string): ActionRowBuilder<ButtonBuilder> {
  const buttons = [];

  for (let i = 0; i < 3; i++) {
    const slot = presets[i];
    const button = new ButtonBuilder()
      .setCustomId(`${prefix}_preset_${i + 1}`)
      .setStyle(ButtonStyle.Success);

    if (!slot || !slot.actions || slot.actions.length === 0) {
      button.setLabel(`${slot?.name || `Preset ${i + 1}`}: Empty`).setDisabled(true);
    } else {
      const firstAction = slot.actions[0];
      const emoji = firstAction === 'attack' ? '⚔️' : '🌀';
      button.setLabel(`${slot.name} (${slot.actions.length})`).setEmoji(emoji);
    }
    buttons.push(button);
  }

  return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Validates whether the combo can be cast by checking skills learning and mana cost.
 */
export function validateCombo(
  slot: PresetSlot,
  playerMana: number,
  learnedSkillIds: string[]
): { valid: boolean; totalManaCost: number; error?: string } {
  if (!slot || !slot.actions || slot.actions.length === 0) {
    return { valid: false, totalManaCost: 0, error: 'Preset has no actions.' };
  }

  let totalManaCost = 0;
  for (const action of slot.actions) {
    if (action === 'attack') {
      continue;
    }

    const skillDef = getSkillById(action);
    if (!skillDef) {
      return { valid: false, totalManaCost: 0, error: `Skill "${action}" not found.` };
    }

    if (!learnedSkillIds.includes(action)) {
      return { valid: false, totalManaCost: 0, error: `You have not learned "${skillDef.name}".` };
    }

    totalManaCost += skillDef.manaCost;
  }

  if (playerMana < totalManaCost) {
    return {
      valid: false,
      totalManaCost,
      error: `Not enough Mana! Combo cost: ${totalManaCost}, Current: ${playerMana}`
    };
  }

  return { valid: true, totalManaCost };
}
