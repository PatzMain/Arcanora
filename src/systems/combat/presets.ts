import { ButtonBuilder, ActionRowBuilder, ButtonStyle } from 'discord.js';
import { getSkillById } from './skills.js';

export const SKILL_EMOJIS: Record<string, string> = {
  // Warrior Skills
  warrior_power_strike: '💥',
  warrior_shield_bash: '🛡️',
  warrior_battle_cry: '📢',
  warrior_iron_fortress: '🏰',
  warrior_berserker_rage: '😡',
  // Mage Skills
  mage_fireball: '🔥',
  mage_frost_nova: '❄️',
  mage_arcane_shield: '🔮',
  mage_mana_surge: '⚡',
  mage_meteor_strike: '☄️',
  // Rogue Skills
  rogue_backstab: '🗡️',
  rogue_poison_strike: '🤢',
  rogue_smoke_bomb: '💨',
  rogue_shadow_step: '👤',
  rogue_assassinate: '💀',
  // Ranger Skills
  ranger_quick_shot: '🏹',
  ranger_poison_arrow: '🏹',
  ranger_natures_embrace: '🌿',
  ranger_eagle_eye: '🦅',
  ranger_volley: '🎯',
  // Healer Skills
  healer_holy_light: '✨',
  healer_blessing: '🙏',
  healer_purify: '❇️',
  healer_divine_shield: '🛡️',
  healer_resurrection: '☀️',
};

export function getBasicAttackEmoji(className: string = 'novice'): string {
  const cls = className.toLowerCase();
  if (cls === 'warrior') return '⚔️';
  if (cls === 'mage') return '🪄';
  if (cls === 'rogue') return '🗡️';
  if (cls === 'ranger') return '🏹';
  if (cls === 'healer') return '✨';
  return '👊'; // Novice / fallback
}

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
export function getPresetActionSummary(slot: PresetSlot, playerClass: string = 'novice'): string {
  if (!slot || !slot.actions || slot.actions.length === 0) {
    return '🔴 *Empty*';
  }

  const basicAttackEmoji = getBasicAttackEmoji(playerClass);

  return slot.actions
    .map((action) => {
      if (action === 'attack') return `${basicAttackEmoji} Attack`;
      const skill = getSkillById(action);
      const emoji = skill ? (SKILL_EMOJIS[skill.id] || '🌀') : '🌀';
      return skill ? `${emoji} ${skill.name}` : '❓ Unknown';
    })
    .join(' ➔ ');
}

/**
 * Builds the ActionRow containing 3 preset buttons for standard combat or boss fights.
 */
export function buildPresetButtons(presets: PlayerPresets, prefix: string, playerClass: string = 'novice'): ActionRowBuilder<ButtonBuilder> {
  const buttons = [];

  const basicAttackEmoji = getBasicAttackEmoji(playerClass);

  for (let i = 0; i < 3; i++) {
    const slot = presets[i];
    const button = new ButtonBuilder()
      .setCustomId(`${prefix}_preset_${i + 1}`)
      .setStyle(ButtonStyle.Success);

    if (!slot || !slot.actions || slot.actions.length === 0) {
      button.setLabel(`${slot?.name || `Preset ${i + 1}`}: Empty`).setDisabled(true);
    } else {
      const firstAction = slot.actions[0] as string;
      let emoji = '🌀';
      if (firstAction === 'attack') {
        emoji = basicAttackEmoji;
      } else {
        const skill = getSkillById(firstAction);
        if (skill && SKILL_EMOJIS[skill.id]) {
          emoji = SKILL_EMOJIS[skill.id]!;
        }
      }
      button.setLabel(`${slot.name} (${slot.actions.length})`).setEmoji(emoji);
    }
    buttons.push(button);
  }

  if (prefix === 'combat') {
    const setupButton = new ButtonBuilder()
      .setCustomId('combat_preset_configure')
      .setLabel('⚙️ Setup')
      .setStyle(ButtonStyle.Secondary);
    buttons.push(setupButton);
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
