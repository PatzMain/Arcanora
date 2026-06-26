import { EmbedBuilder } from 'discord.js';

export const COLORS = {
  PRIMARY: 0x7C3AED,    // Purple
  SUCCESS: 0x10B981,    // Green
  DANGER: 0xEF4444,     // Red
  WARNING: 0xF59E0B,    // Amber
  INFO: 0x06B6D4,       // Neon Cyan/Teal
  GOLD: 0xFBBF24,       // Gold
  MYTHIC: 0xF43F5E,     // Cosmic Rose/Pink-Red
  COMMON: 0x9CA3AF,
  UNCOMMON: 0x10B981,
  RARE: 0x3B82F6,
  EPIC: 0x8B5CF6,
  PET: 0xA78BFA,        // Pet companion light purple
} as const;

export const RARITY_COLORS: Record<string, number> = {
  common: COLORS.COMMON,
  uncommon: COLORS.UNCOMMON,
  rare: COLORS.RARE,
  epic: COLORS.EPIC,
  mythic: COLORS.MYTHIC,
};

export const RARITY_EMOJIS: Record<string, string> = {
  common: '🪨',
  uncommon: '🌿',
  rare: '🔷',
  epic: '🔮',
  mythic: '👑',
};

export const CLASS_EMOJIS: Record<string, string> = {
  warrior: '⚔️',
  mage: '🔮',
  rogue: '🗡️',
  ranger: '🏹',
  healer: '❇️',
  paladin: '🛡️',
  necromancer: '💀',
  berserker: '🪓',
};

export const FOOTER_TEXT = 'Arcanora — Discord MMORPG';
export const DIVIDER = '❖ ────────── ✦ ────────── ❖';
export const DIVIDER_SHORT = '✦ ────── ✦';

export function makeProgressBar(current: number, max: number, filledEmoji: string, emptyEmoji: string, length = 10): string {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return filledEmoji.repeat(filled) + emptyEmoji.repeat(empty);
}

export function hpBar(current: number, max: number, length = 10): string {
  return makeProgressBar(current, max, '🟥', '⬛', length);
}

export function manaBar(current: number, max: number, length = 10): string {
  return makeProgressBar(current, max, '🟦', '⬛', length);
}

export function staminaBar(current: number, max: number, length = 10): string {
  return makeProgressBar(current, max, '🟪', '⬛', length);
}

export function progressBar(current: number, total: number, length = 10): string {
  return makeProgressBar(current, total, '🟨', '⬛', length);
}

export function petBar(current: number, total: number, length = 10): string {
  return makeProgressBar(current, total, '🟩', '⬛', length);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function classEmoji(className: string | null): string {
  if (!className) return '🌀';
  return CLASS_EMOJIS[className.toLowerCase()] || '🌀';
}

export function prestigeStars(prestige: number): string {
  if (prestige <= 0) return '';
  const stars = Math.min(prestige, 10);
  return ' ' + '⭐'.repeat(stars) + (prestige > 10 ? ` +${prestige - 10}` : '');
}

export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}
