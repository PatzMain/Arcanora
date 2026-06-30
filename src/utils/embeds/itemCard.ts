import { EmbedBuilder } from 'discord.js';
import { RARITY_COLORS, RARITY_EMOJIS, capitalize, baseEmbed, priceLine } from './base.js';

export interface ItemCardOptions {
  quantity?: number;
  durability?: number;
  enhancement?: number;
  equipped?: boolean;
  showMoreDetails?: boolean;
  foundCount?: number;
}

export function getItemEmoji(rarity: string): string {
  return RARITY_EMOJIS[rarity.toLowerCase()] || '🪨';
}

export function buildItemDetailEmbed(item: any, options: ItemCardOptions = {}): EmbedBuilder {
  const rarity = item.rarity || 'common';
  const color = (RARITY_COLORS[rarity.toLowerCase()] ?? RARITY_COLORS.common) as number;
  const emoji = getItemEmoji(rarity);

  const embed = baseEmbed()
    .setColor(color);

  // Title: Emoji + Name (+ enhancement)
  let nameStr = `${emoji} ${item.name}`;
  if (options.enhancement && options.enhancement > 0) {
    nameStr += ` +${options.enhancement}`;
  }
  if (options.equipped) {
    nameStr += ' 🛡️ [Equipped]';
  }
  embed.setTitle(nameStr);

  const lines: string[] = [];

  // Rarity • Item Type Badge
  const rarityText = rarity.toLowerCase() === 'mythic' ? '✦ Mythic' : capitalize(rarity);
  lines.push(`「${rarityText} • ${capitalize(item.type || 'item')}」`);
  lines.push('');

  // Short description (1 line max)
  const shortDesc = item.description ? item.description.split('\n')[0].substring(0, 100) : '';
  if (shortDesc) {
    lines.push(`*${shortDesc}*`);
    lines.push('');
  }

  // Combined level and stats line
  const reqLvl = item.levelReq || 0;
  const lvlPrefix = reqLvl > 0 ? `Lv. ${reqLvl}` : '';
  
  const statParts: string[] = [];
  if (item.stats) {
    const statMapping: Record<string, { icon: string }> = {
      attack: { icon: '⚔️' },
      defense: { icon: '🛡️' },
      hpMax: { icon: '❤️' },
      manaMax: { icon: '💧' },
      critChance: { icon: '⚡' },
      critDmg: { icon: '💥' },
      speed: { icon: '💨' },
      luck: { icon: '🍀' },
    };

    for (const [key, val] of Object.entries(item.stats)) {
      if (val && typeof val === 'number') {
        const mapping = statMapping[key];
        if (mapping) {
          const suffix = (key === 'critChance' || key === 'critDmg') ? '%' : '';
          statParts.push(`${mapping.icon} +${val}${suffix}`);
        }
      }
    }
  }

  if (statParts.length > 0) {
    const statsStr = statParts.join('  ');
    if (lvlPrefix) {
      lines.push(`${lvlPrefix}  •  ${statsStr}`);
    } else {
      lines.push(statsStr);
    }
    lines.push('');
  } else if (lvlPrefix) {
    lines.push(lvlPrefix);
    lines.push('');
  }

  // Buy & Sell prices
  const priceStr = priceLine(item.buyPrice || null, item.sellPrice || null);
  if (priceStr) {
    lines.push(priceStr);
    lines.push('');
  }

  // More Details toggle
  if (options.showMoreDetails) {
    lines.push('▸ **More Details**');
    if (options.durability !== undefined || item.maxDurability) {
      const durCur = options.durability !== undefined ? options.durability : item.maxDurability;
      const durMax = item.maxDurability || durCur;
      lines.push(`  Durability: ${durCur}/${durMax}`);
    }
    if (options.quantity !== undefined) {
      lines.push(`  Quantity: x${options.quantity}`);
    }
    if (options.foundCount !== undefined) {
      lines.push(`  Times Found: ${options.foundCount}`);
    }
    lines.push(`  Internal ID: \`${item.id}\``);
  }

  embed.setDescription(lines.join('\n').trim());
  return embed;
}

export function buildCompactItemCard(item: any, options: { quantity?: number; equipped?: boolean; buyMode?: boolean; sellMode?: boolean; enhancement?: number } = {}): string {
  const rarity = item.rarity || 'common';
  const emoji = getItemEmoji(rarity);
  const capRarity = capitalize(rarity);

  const enhancement = options.enhancement ?? item.enhancement;
  let nameText = item.name;
  if (enhancement && enhancement > 0) {
    nameText += ` +${enhancement}`;
  }

  let title = `${emoji} **${nameText}**`;
  if (options.quantity && options.quantity > 1) {
    title += ` (x${options.quantity})`;
  }
  if (options.equipped) {
    title += ' 🛡️';
  }

  const badgeStr = `「${capRarity}」`;

  // Stats text
  const statParts: string[] = [];
  if (item.stats) {
    const statMapping: Record<string, string> = {
      attack: '⚔️',
      defense: '🛡️',
      hpMax: '❤️',
      manaMax: '💧',
      critChance: '⚡',
      critDmg: '💥',
      speed: '💨',
      luck: '🍀',
    };
    for (const [key, val] of Object.entries(item.stats)) {
      if (val && typeof val === 'number') {
        const icon = statMapping[key] || '';
        const suffix = (key === 'critChance' || key === 'critDmg') ? '%' : '';
        statParts.push(`${icon} +${val}${suffix}`);
      }
    }
  }
  const statsText = statParts.length > 0 ? `  •  ${statParts.join(' ')}` : '';
  const lvlText = item.levelReq && item.levelReq > 0 ? `  •  Lv. ${item.levelReq}` : '';

  let priceText = '';
  if (options.buyMode && item.buyPrice && item.buyPrice > 0) {
    priceText = `  •  💰 ${item.buyPrice}`;
  } else if (options.sellMode && item.sellPrice && item.sellPrice > 0) {
    priceText = `  •  💰 Sell ${item.sellPrice}`;
  }

  return `${title} ${badgeStr}${statsText}${lvlText}${priceText}`;
}
