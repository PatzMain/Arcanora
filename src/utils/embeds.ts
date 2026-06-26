import { EmbedBuilder } from 'discord.js';
import {
  getItemEmoji,
  getClassEmoji,
  getPetEmoji,
  getAchievementEmoji,
  getCurrencyEmoji
} from './emojis.js';

// ─── Color Palette ───────────────────────────────────────────────────────────

const COLORS = {
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

const RARITY_COLORS: Record<string, number> = {
  common: COLORS.COMMON,
  uncommon: COLORS.UNCOMMON,
  rare: COLORS.RARE,
  epic: COLORS.EPIC,
  mythic: COLORS.MYTHIC,
};

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
  paladin: '🛡️',
  necromancer: '💀',
  berserker: '🪓',
};

const FOOTER_TEXT = 'Arcanora — Discord MMORPG';
const DIVIDER = '❖ ────────── ✦ ────────── ❖';
const DIVIDER_SHORT = '✦ ────── ✦';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function classEmoji(className: string | null): string {
  if (!className) return '🌀';
  return CLASS_EMOJIS[className.toLowerCase()] || '🌀';
}

function prestigeStars(prestige: number): string {
  if (prestige <= 0) return '';
  const stars = Math.min(prestige, 10);
  return ' ' + '⭐'.repeat(stars) + (prestige > 10 ? ` +${prestige - 10}` : '');
}

function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

// ─── Embed Factories ─────────────────────────────────────────────────────────

/**
 * Player profile card showing level, class, currency, stats, equipment, and guild.
 */
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

  const statsLine1 = `⚔️ ${stats.attack} ATK  ·  🛡️ ${stats.defense} DEF  ·  💨 ${stats.speed} SPD`;
  const statsLine2 = `⚡ ${stats.critChance}% Crit  ·  💥 ${stats.critDmg}% CritDmg  ·  🍀 ${stats.luck} LUK`;

  const embedDescription =
    `${DIVIDER}\n` +
    `Level **${player.level}** ${classDisplay} ${player.prestige > 0 ? `· Prestige ${player.prestige}` : ''}\n` +
    `📍 Location: **${player.currentZoneName}**\n` +
    `📜 Story: **${player.storyQuestName}**\n\n` +
    `❤️ ${hpBarString} \`${player.currentHp}/${stats.hpMax} HP\`\n` +
    `💧 ${manaBarString} \`${player.currentMana}/${stats.manaMax} MP\`\n` +
    `🔋 ${staminaBarString} \`${player.stamina}/${player.staminaMax} Stamina\`\n\n` +
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

/**
 * Full stat breakdown view.
 */
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

/**
 * Combat view with HP/Mana bars, enemy status, round counter, and combat log.
 */
export function combatEmbed(
  playerName: string,
  playerHp: number,
  playerMaxHp: number,
  playerMana: number,
  playerMaxMana: number,
  enemy: { name: string; level: number },
  enemyHp: number,
  enemyMaxHp: number,
  round: number,
  log: string[],
): EmbedBuilder {
  const recentLog = log.slice(-5).join('\n') || '*Combat started!*';

  return baseEmbed()
    .setColor(COLORS.DANGER)
    .setTitle(`⚔️ Combat — 🔄 Round ${round}`)
    .setDescription(DIVIDER)
    .addFields(
      {
        name: `🧙 ${playerName}`,
        value:
          `❤️ ${hpBar(playerHp, playerMaxHp)} \`${playerHp}/${playerMaxHp}\`\n` +
          `💧 ${manaBar(playerMana, playerMaxMana)} \`${playerMana}/${playerMaxMana}\``,
        inline: true,
      },
      { name: '⚡ VS ⚡', value: '\u200b', inline: true },
      {
        name: `👹 ${enemy.name} (Lv.${enemy.level})`,
        value: `❤️ ${hpBar(enemyHp, enemyMaxHp)} \`${enemyHp}/${enemyMaxHp}\``,
        inline: true,
      },
      {
        name: `─── 📜 **Combat Activity** ───`,
        value: `\`\`\`\n${recentLog}\n\`\`\``,
        inline: false,
      },
    );
}

/**
 * Loot summary displayed after combat victory.
 */
export function lootEmbed(
  items: { name: string; quantity: number; rarity: string; id?: string; emoji?: string | null }[],
  gold: number,
  exp: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items.map((i) => `${i.emoji || (i.id ? getItemEmoji(i.id, i.rarity) : (RARITY_EMOJIS[i.rarity] || '🪨'))} **${i.name}** ×${i.quantity}`).join('\n')
    : '*No items dropped*';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle('🏆 Victory!')
    .setDescription(`${DIVIDER}\n✨ *The dust settles and spoils await…*`)
    .addFields(
      { name: '─── 🎁 **Items Acquired** ───', value: itemLines, inline: false },
      { name: `${getCurrencyEmoji('gold')} Gold`, value: `+**${gold.toLocaleString()}**`, inline: true },
      { name: '✨ EXP', value: `+**${exp.toLocaleString()}**`, inline: true },
    );
}

/**
 * Paginated inventory display with rarity indicators.
 */
export function inventoryEmbed(
  items: { name: string; quantity: number; rarity: string; slot?: string; id?: string; emoji?: string | null }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items
        .map(
          (i, idx) =>
            `\`${((page - 1) * items.length + idx + 1).toString().padStart(2, '0')}\` ` +
            `${i.emoji || (i.id ? getItemEmoji(i.id, i.rarity) : (RARITY_EMOJIS[i.rarity] || '🪨'))} **${i.name}** ×${i.quantity}` +
            (i.slot ? ` *(${i.slot})*` : ''),
        )
        .join('\n')
    : '*Your inventory is empty.*';

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎒 Inventory')
    .setDescription(`${DIVIDER}\n${itemLines}`)
    .setFooter({ text: `${FOOTER_TEXT} • Page ${page}/${totalPages}` });
}

/**
 * Shop display with items available for purchase.
 */
export function shopEmbed(
  items: { name: string; price: number; rarity: string; description?: string; id?: string; emoji?: string | null }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items
        .map(
          (i, idx) =>
            `\`${((page - 1) * items.length + idx + 1).toString().padStart(2, '0')}\` ` +
            `${i.emoji || (i.id ? getItemEmoji(i.id, i.rarity) : (RARITY_EMOJIS[i.rarity] || '🪨'))} **${i.name}** — ${getCurrencyEmoji('gold')} ${i.price.toLocaleString()}` +
            (i.description ? `\n   *${i.description}*` : ''),
        )
        .join('\n')
    : '*Shop is empty.*';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle('🏪 Shop')
    .setDescription(`${DIVIDER}\n${itemLines}`)
    .setFooter({ text: `${FOOTER_TEXT} • Page ${page}/${totalPages}` });
}

/**
 * Quest list with progress bars and reward previews.
 */
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
          const pct = Math.min(q.current / q.target, 1);
          const bar = progressBar(q.current, q.target, 8);
          const status = q.current >= q.target ? '✅' : '⏳';
          const rewards: string[] = [];
          if (q.rewardGold) rewards.push(`🪙 ${q.rewardGold}`);
          if (q.rewardExp) rewards.push(`✨ ${q.rewardExp}`);
          const rewardStr = rewards.length > 0 ? ` ┃ ${rewards.join(' ')}` : '';
          return (
            `${typeEmoji} **${q.name}** ${status}\n` +
            `  *${q.description}*\n` +
            `  ${bar} \`${q.current}/${q.target}\` (${Math.round(pct * 100)}%)${rewardStr}`
          );
        })
        .join('\n\n')
    : '*No active quests. Visit the quest board!*';

  return baseEmbed()
    .setColor(COLORS.INFO)
    .setTitle('📋 Active Quests')
    .setDescription(`${DIVIDER}\n${questLines}`);
}

/**
 * Leaderboard with rank numbers, medals for top 3, and pagination.
 */
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
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 Leaderboard: ${capitalize(category)}`)
    .setDescription(`${DIVIDER}\n${lines}`)
    .setFooter({ text: `${FOOTER_TEXT} • Page ${page}` });
}

/**
 * Guild information card with member list and player's rank.
 */
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

/**
 * Pet companion info card with stats, abilities, and bond level.
 */
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

/**
 * Help command embed showing a category of commands.
 */
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
    .setFooter({ text: `${FOOTER_TEXT} • Use the menu below to browse categories` });
}

/**
 * Help overview (welcome page) with category list.
 */
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

/**
 * World Boss status and info card.
 */
export function bossInfoEmbed(
  boss: { name: string; level: number; description: string; isGlobal?: boolean },
  hpCurrent: number,
  hpMax: number,
  topContributors: { username: string; damageDealt: number }[],
): EmbedBuilder {
  const hpPercent = Math.max(0, Math.round((hpCurrent / hpMax) * 100));
  const contributorsList = topContributors.length > 0
    ? topContributors.map((c, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '⚔️';
        return `${medal} **${c.username}** — \`${c.damageDealt.toLocaleString()} DMG\``;
      }).join('\n')
    : '*No damage dealt yet. Be the first to strike!*';

  const bossTitle = boss.isGlobal ? 'Global World Boss' : 'World Boss';

  return baseEmbed()
    .setColor(COLORS.MYTHIC)
    .setTitle(`🚨 ${bossTitle}: ${boss.name} (Lv.${boss.level})`)
    .setDescription(
      `*${boss.description}*\n\n` +
      `**Health Pool:**\n` +
      `${hpBar(hpCurrent, hpMax, 15)} \`${hpPercent}% (${hpCurrent.toLocaleString()} / ${hpMax.toLocaleString()})\`\n\n` +
      `─── 🏆 **Top Contributors** ───\n` +
      `${contributorsList}\n\n` +
      `${DIVIDER_SHORT}\n` +
      `*⚔️ Use \`/boss fight\` in this channel to join the raid!*`
    );
}

/**
 * Live skirmish card for a player battling the boss.
 */
export function bossSkirmishEmbed(
  boss: { name: string; level: number; isGlobal?: boolean },
  bossHpCurrent: number,
  bossHpMax: number,
  player: { username: string; hpCurrent: number; hpMax: number; manaCurrent: number; manaMax: number },
  combatLog: string[],
): EmbedBuilder {
  const logLines = combatLog.slice(-4).map((line) => `▸ ${line}`).join('\n') || '*Raid skirmish starting...*';

  const titlePrefix = boss.isGlobal ? 'Global Skirmish' : 'Raid Skirmish';

  return baseEmbed()
    .setColor(COLORS.MYTHIC)
    .setTitle(`⚔️ ${titlePrefix} — Lv.${boss.level} ${boss.name}`)
    .setDescription(
      `**Boss Health:**\n` +
      `${hpBar(bossHpCurrent, bossHpMax, 15)} \`${bossHpCurrent.toLocaleString()} / ${bossHpMax.toLocaleString()} HP\`\n\n` +
      `**Your Status:**\n` +
      `❤️ HP:   ${hpBar(player.hpCurrent, player.hpMax, 10)} \`${player.hpCurrent}/${player.hpMax}\`\n` +
      `💧 Mana: ${manaBar(player.manaCurrent, player.manaMax, 10)} \`${player.manaCurrent}/${player.manaMax}\`\n\n` +
      `─── 📜 **skirmish Log** ───\n` +
      `${logLines}`
    );
}

/**
 * Victory embed shown when a boss is defeated.
 */
export function bossVictoryEmbed(
  boss: { name: string; level: number; isGlobal?: boolean },
  mvpUsername: string,
  rankings: { username: string; damageDealt: number; rank: number; percent: number }[],
  rewardsList: { username: string; gold: number; exp: number; bonusLoot: boolean }[],
): EmbedBuilder {
  const rankingLines = rankings.map((r) => {
    const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : '⚔️';
    return `${medal} **Rank ${r.rank}**: **${r.username}** — \`${r.damageDealt.toLocaleString()} DMG\` (${r.percent}%)`;
  }).join('\n') || '*No participants recorded.*';

  const rewardLines = rewardsList.map((w) => {
    let line = `▸ **${w.username}**: \`+${w.gold.toLocaleString()} Gold\`, \`+${w.exp.toLocaleString()} EXP\``;
    if (w.bonusLoot) {
      line += ` ✨ *(Bonus Item!)*`;
    }
    return line;
  }).join('\n') || '*No rewards distributed.*';

  const titlePrefix = boss.isGlobal ? 'Global World Boss Slain' : 'World Boss Slain';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 ${titlePrefix}: ${boss.name}! 🏆`)
    .setDescription(
      `🎉 **${boss.name} (Lv.${boss.level})** has been defeated!\n\n` +
      `👑 **MVP**: **${mvpUsername}**\n\n` +
      `─── 📊 **Final Damage Contribution** ───\n` +
      `${rankingLines}\n\n` +
      `─── 🎁 **Rewards Distributed** ───\n` +
      `${rewardLines}\n\n` +
      `${DIVIDER_SHORT}\n` +
      `*Congratulations to all adventurers!*`
    );
}

export function errorEmbed(title: string, description: string, errorObj?: any): EmbedBuilder {
  let finalDesc = description;
  if (errorObj) {
    const errorMsg = errorObj.stack || errorObj.message || String(errorObj);
    finalDesc += `\n\n**Copyable Error Details:**\n\`\`\`\n${errorMsg}\n\`\`\``;
  }
  return baseEmbed()
    .setColor(COLORS.DANGER)
    .setTitle(`❌ ${title}`)
    .setDescription(finalDesc);
}

/**
 * Success message embed with green styling.
 */
export function successEmbed(title: string, description: string): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setDescription(description);
}

/**
 * Cooldown warning embed showing remaining wait time.
 */
export function cooldownEmbed(action: string, remainingSeconds: number): EmbedBuilder {
  const rounded = Math.ceil(remainingSeconds);
  return baseEmbed()
    .setColor(COLORS.WARNING)
    .setTitle('⏳ Cooldown Active')
    .setDescription(
      `**${capitalize(action)}** is on cooldown.\n` +
      `Please wait **${rounded}s** before trying again.`,
    );
}

export { COLORS, RARITY_COLORS, RARITY_EMOJIS, CLASS_EMOJIS, DIVIDER, DIVIDER_SHORT };

