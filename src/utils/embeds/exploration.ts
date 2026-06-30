import { EmbedBuilder } from 'discord.js';
import {
  baseEmbed,
  COLORS,
  DIVIDER,
  DIVIDER_SHORT,
  hpBar,
  manaBar,
  staminaBar,
  progressBar,
  petBar,
  capitalize,
  classEmoji,
  prestigeStars
} from './base.js';
import {
  getItemEmoji,
  getClassEmoji,
  getPetEmoji,
  getCurrencyEmoji
} from '../emojis.js';

const RARITY_EMOJIS: Record<string, string> = {
  common: '🪨',
  uncommon: '🌿',
  rare: '🔷',
  epic: '🔮',
  mythic: '👑',
};

const CLASS_EMOJIS: Record<string, string> = {
  warrior: '⚔️',
  mage: '🔮',
  rogue: '🗡️',
  ranger: '🏹',
  healer: '❇️',
};

export function profileEmbed(
  player: {
    username: string;
    level: number;
    className: string | null;
    gold: number;
    gems: number;
    prestige: number;
    currentHp: number;
    maxHp: number;
    currentMana: number;
    maxMana: number;
    storyQuestName: string;
    stamina: number;
    staminaMax: number;
    currentZoneName: string;
    exp?: number;
    nextLevelXp?: number;
  },
  stats: {
    hpMax: number;
    manaMax: number;
    attack: number;
    defense: number;
    critChance: number;
    critDmg: number;
    speed: number;
    luck: number;
  },
  equipment: { slot: string; name: string; rarity: string; id?: string; emoji?: string | null }[],
  guildName?: string,
): EmbedBuilder {
  const classIcon = getClassEmoji(player.className);
  const classDisplay = player.className ? capitalize(player.className) : 'Novice (unlock at Lv.5)';
  const stars = prestigeStars(player.prestige);
 
  const equipLines = equipment.length > 0
    ? equipment.map((e) => `${e.emoji || (e.id ? getItemEmoji(e.id, e.rarity) : (RARITY_EMOJIS[e.rarity] || '🪨'))} **${capitalize(e.slot)}**: ${e.name}`).join('\n')
    : '*No equipment*';
 
  const hpBarString = hpBar(player.currentHp, stats.hpMax, 10);
  const manaBarString = manaBar(player.currentMana, stats.manaMax, 10);
  const staminaBarString = staminaBar(player.stamina, player.staminaMax, 10);
  const xpBarString = progressBar(player.exp || 0, player.nextLevelXp || 100, 10);
 
  const statsLine1 = `⚔️ ${stats.attack} ATK  ·  🛡️ ${stats.defense} DEF  ·  💨 ${stats.speed} SPD`;
  const statsLine2 = `⚡ ${stats.critChance}% Crit  ·  💥 ${stats.critDmg}% CritDmg  ·  🍀 ${stats.luck} LUK`;
 
  const embedDescription =
    `${DIVIDER}\n` +
    `Level **${player.level}** ${classDisplay} ${player.prestige > 0 ? `· Prestige ${player.prestige}` : ''}\n` +
    `📍 Location: **${player.currentZoneName}**\n` +
    `📜 Story: **${player.storyQuestName}**\n\n` +
    `❤️ ${hpBarString} \`${player.currentHp}/${stats.hpMax} HP\`\n` +
    `💧 ${manaBarString} \`${player.currentMana}/${stats.manaMax} MP\`\n` +
    `🔋 ${staminaBarString} \`${player.stamina}/${player.staminaMax} Stamina\`\n` +
    `🌟 ${xpBarString} \`${player.exp || 0}/${player.nextLevelXp || 0} XP\`\n\n` +
    `─── 📊 **Combat Stats** ───\n` +
    `${statsLine1}\n` +
    `${statsLine2}\n\n` +
    `─── 🛡️ **Equipment** ───\n` +
    `${equipLines}\n\n` +
    `─── 💰 **Wealth** ───\n` +
    `${getCurrencyEmoji('gold')} **${player.gold.toLocaleString()}** Gold  ·  ${getCurrencyEmoji('gems')} **${player.gems.toLocaleString()}** Gems\n` +
    (guildName ? `\n🏰 **Guild**: ${guildName}` : '');

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${classIcon} ${player.username}${stars}`)
    .setDescription(embedDescription);
}

export function statsEmbed(
  player: { username: string; level: number; className: string | null },
  stats: {
    hpMax: number;
    manaMax: number;
    attack: number;
    defense: number;
    critChance: number;
    critDmg: number;
    speed: number;
    luck: number;
  },
): EmbedBuilder {
  const classIcon = classEmoji(player.className);
  const classDisplay = player.className ? capitalize(player.className) : 'None';

  return baseEmbed()
    .setColor(COLORS.INFO)
    .setTitle(`📊 ${player.username}'s Stats`)
    .setDescription(
      `${DIVIDER}\n` +
      `**Level ${player.level}** — ${classIcon} ${classDisplay}\n` +
      `${DIVIDER_SHORT}`
    )
    .addFields(
      { name: '❤️ Max HP', value: `\`${stats.hpMax}\``, inline: true },
      { name: '💧 Max Mana', value: `\`${stats.manaMax}\``, inline: true },
      { name: '⚔️ Attack', value: `\`${stats.attack}\``, inline: true },
      { name: '🛡️ Defense', value: `\`${stats.defense}\``, inline: true },
      { name: '⚡ Crit Chance', value: `\`${stats.critChance}%\``, inline: true },
      { name: '💥 Crit Damage', value: `\`${stats.critDmg}%\``, inline: true },
      { name: '💨 Speed', value: `\`${stats.speed}\``, inline: true },
      { name: '🍀 Luck', value: `\`${stats.luck}\``, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
    );
}

import { buildCompactItemCard } from './itemCard.js';

export function inventoryEmbed(
  items: {
    name: string;
    quantity: number;
    rarity: string;
    slot?: string;
    id?: string;
    emoji?: string | null;
    type?: string;
    stats?: any;
    levelReq?: number;
    equipped?: boolean;
  }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const categories: Record<string, string[]> = {
    '⚔️ Weapons': [],
    '🛡️ Armor': [],
    '🧪 Consumables': [],
    '📦 Materials & Others': [],
  };

  const armorTypes = ['chest', 'helmet', 'gloves', 'boots', 'accessory'];

  if (items.length > 0) {
    items.forEach((item) => {
      const type = (item.type || 'item').toLowerCase();
      const card = buildCompactItemCard(item, { quantity: item.quantity, equipped: item.equipped });
      if (type === 'weapon') {
        categories['⚔️ Weapons']?.push(card);
      } else if (armorTypes.includes(type)) {
        categories['🛡️ Armor']?.push(card);
      } else if (type === 'consumable') {
        categories['🧪 Consumables']?.push(card);
      } else {
        categories['📦 Materials & Others']?.push(card);
      }
    });
  }

  const descLines: string[] = [];
  for (const [title, list] of Object.entries(categories)) {
    if (list.length > 0) {
      descLines.push(`**${title}**`);
      descLines.push(...list.map(line => ` ${line}`));
      descLines.push('');
    }
  }

  const description = descLines.length > 0 ? descLines.join('\n').trim() : '*Your inventory is empty.*';

  return baseEmbed()
    .setColor(COLORS.INVENTORY)
    .setTitle('🎒 Inventory')
    .setDescription(`${DIVIDER}\n${description}`)
    .setFooter({ text: `Arcanora — Discord MMORPG • Page ${page}/${totalPages}` });
}

export function shopEmbed(
  items: { name: string; buyPrice: number; rarity: string; description?: string; id?: string; emoji?: string | null; type?: string; stats?: any; levelReq?: number }[],
  page: number,
  totalPages: number,
  playerGold: number,
  statusMsg?: string | null,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items
        .map((i, idx) => {
          const num = ((page - 1) * items.length + idx + 1).toString().padStart(2, '0');
          const card = buildCompactItemCard(i, { buyMode: true });
          const affordable = playerGold >= (i.buyPrice || 0);
          return `\`${num}\` ${affordable ? card : `~~${card}~~`}`;
        })
        .join('\n')
    : '*Shop is empty.*';

  return baseEmbed()
    .setColor(COLORS.SHOP)
    .setTitle('🏪 NPC Merchant Shop')
    .setDescription(
      `### 💰 Balance: ${getCurrencyEmoji('gold')} **${playerGold.toLocaleString()}** Gold\n` +
      (statusMsg ? `🔔 **Status**: ${statusMsg}\n\n` : '') +
      `${DIVIDER}\n` +
      itemLines
    )
    .setFooter({ text: `Arcanora — Discord MMORPG • Page ${page}/${totalPages}` });
}

export function questEmbed(
  quests: {
    name: string;
    description: string;
    current: number;
    target: number;
    rewardGold?: number;
    rewardExp?: number;
    type?: string;
  }[],
): EmbedBuilder {
  const questLines = quests.length > 0
    ? quests
        .map((q) => {
          const typeEmoji = q.type === 'daily' ? '📅' : q.type === 'weekly' ? '📆' : '📜';
          const bar = progressBar(q.current, q.target, 6);
          const status = q.current >= q.target ? '✅' : '⏳';
          const rewards: string[] = [];
          if (q.rewardGold) rewards.push(`🪙 ${q.rewardGold}`);
          if (q.rewardExp) rewards.push(`✨ ${q.rewardExp}`);
          const rewardStr = rewards.length > 0 ? ` ┃ ${rewards.join(' ')}` : '';
          return (
            `${typeEmoji} **${q.name}** ${status}\n` +
            `  *${q.description}*\n` +
            `  ${bar} \`${q.current}/${q.target}\`${rewardStr}`
          );
        })
        .join('\n\n')
    : '*No active quests. Visit the quest board!*';

  return baseEmbed()
    .setColor(COLORS.QUEST)
    .setTitle('📋 Active Quests')
    .setDescription(`${DIVIDER}\n${questLines}`);
}

export function leaderboardEmbed(
  entries: { rank: number; username: string; value: number | string }[],
  category: string,
  page: number,
): EmbedBuilder {
  const medals: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  const lines = entries.length > 0
    ? entries
        .map((e) => {
          const medal = medals[e.rank] || `\`#${e.rank.toString().padStart(2, '0')}\``;
          return `${medal} **${e.username}** — ${e.value.toLocaleString()}`;
        })
        .join('\n')
    : '*No entries yet.*';

  return baseEmbed()
    .setColor(COLORS.PROFILE)
    .setTitle(`🏆 Leaderboard: ${capitalize(category)}`)
    .setDescription(`${DIVIDER}\n${lines}`)
    .setFooter({ text: `Arcanora — Discord MMORPG • Page ${page}` });
}

export function guildEmbed(
  guild: { name: string; level: number; description?: string; memberCount: number; maxMembers: number },
  members: { username: string; role: string; level: number }[],
  playerRank: string,
): EmbedBuilder {
  const roleEmojis: Record<string, string> = {
    leader: '👑',
    officer: '⭐',
    member: '🔹',
  };

  const memberLines = members
    .map((m) => `${roleEmojis[m.role] || '🔹'} **${m.username}** — Lv.${m.level} (${capitalize(m.role)})`)
    .join('\n');

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle(`🏰 ${guild.name}`)
    .setDescription(`${DIVIDER}\n${guild.description || '*No description set.*'}`)
    .addFields(
      { name: '📈 Guild Level', value: `\`${guild.level}\``, inline: true },
      {
        name: '👥 Members',
        value: `\`${guild.memberCount}/${guild.maxMembers}\``,
        inline: true,
      },
      { name: '🎖️ Your Rank', value: capitalize(playerRank), inline: true },
      { name: `─── 👥 **Member Roster** ───`, value: memberLines || '*No members.*', inline: false },
    );
}

export function petEmbed(
  pet: {
    name: string;
    description: string;
    level: number;
    maxLevel: number;
    rarity: string;
    id?: string;
    emoji?: string | null;
    ability: { name: string; description: string; cooldown: number };
  },
  passiveStats: {
    attack: number;
    defense: number;
    hpMax: number;
    luck: number;
  },
): EmbedBuilder {
  const rarityEmoji = pet.emoji || (pet.id ? getPetEmoji(pet.id, pet.rarity) : (RARITY_EMOJIS[pet.rarity] || '🪨'));
  const levelBar = petBar(pet.level, pet.maxLevel, 10);

  return baseEmbed()
    .setColor(COLORS.PET)
    .setTitle(`🐾 ${pet.name}`)
    .setDescription(
      `${DIVIDER}\n` +
      `*${pet.description}*\n\n` +
      `${rarityEmoji} **${capitalize(pet.rarity)}** Companion\n` +
      `${levelBar} \`Lv.${pet.level}/${pet.maxLevel}\`\n` +
      `${DIVIDER_SHORT}`
    )
    .addFields(
      {
        name: '📊 ── Passive Bonuses ──',
        value:
          `⚔️ Attack: \`+${passiveStats.attack}\`\n` +
          `🛡️ Defense: \`+${passiveStats.defense}\`\n` +
          `❤️ Max HP: \`+${passiveStats.hpMax}\`\n` +
          `🍀 Luck: \`+${passiveStats.luck}\``,
        inline: true,
      },
      {
        name: '🌀 ── Ability ──',
        value:
          `**${pet.ability.name}**\n` +
          `*${pet.ability.description}*\n` +
          `⏱️ Cooldown: \`${pet.ability.cooldown} turns\``,
        inline: true,
      },
    );
}

export function helpEmbed(
  category: string,
  categoryEmoji: string,
  commands: { name: string; description: string; usage?: string }[],
): EmbedBuilder {
  const commandLines = commands
    .map((c) => {
      let line = `▸ **/${c.name}** — ${c.description}`;
      if (c.usage) line += `\n  *Usage:* \`${c.usage}\``;
      return line;
    })
    .join('\n\n');

  return baseEmbed()
    .setColor(COLORS.INFO)
    .setTitle(`${categoryEmoji} ${capitalize(category)} Commands`)
    .setDescription(`${DIVIDER}\n${commandLines}\n${DIVIDER_SHORT}`)
    .setFooter({ text: `Arcanora — Discord MMORPG • Use the menu below to browse categories` });
}

export function helpOverviewEmbed(): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle('📖 Arcanora Help Guide')
    .setDescription(
      `${DIVIDER}\n` +
      `Welcome to **Arcanora**, a Discord MMORPG adventure!\n` +
      `Select a category below to explore available commands.\n\n` +
      `⚔️ **Combat** — Fight monsters and explore zones\n` +
      `🎒 **Inventory** — Manage your items and gear\n` +
      `🏪 **Economy** — Gold, shops, and daily rewards\n` +
      `🔨 **Crafting** — Forge powerful equipment\n` +
      `📜 **Quests** — Take on challenges for rewards\n` +
      `🐾 **Pets** — Companion management\n` +
      `🏰 **Guilds** — Join or create a guild\n` +
      `👤 **Player** — Profile, stats, and progression\n` +
      `${DIVIDER_SHORT}`
    );
}
