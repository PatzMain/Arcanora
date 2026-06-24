import { EmbedBuilder } from 'discord.js';

// ─── Color Palette ───────────────────────────────────────────────────────────

const COLORS = {
  PRIMARY: 0x7C3AED,    // Purple
  SUCCESS: 0x10B981,    // Green
  DANGER: 0xEF4444,     // Red
  WARNING: 0xF59E0B,    // Amber
  INFO: 0x3B82F6,       // Blue
  GOLD: 0xFFD700,       // Gold
  MYTHIC: 0xFF6B6B,     // Mythic red-pink
  COMMON: 0x9CA3AF,
  UNCOMMON: 0x34D399,
  RARE: 0x60A5FA,
  EPIC: 0xA78BFA,
} as const;

const RARITY_COLORS: Record<string, number> = {
  common: COLORS.COMMON,
  uncommon: COLORS.UNCOMMON,
  rare: COLORS.RARE,
  epic: COLORS.EPIC,
  mythic: COLORS.MYTHIC,
};

const RARITY_EMOJIS: Record<string, string> = {
  common: '⚪',
  uncommon: '🟢',
  rare: '🔵',
  epic: '🟣',
  mythic: '🔴',
};

const FOOTER_TEXT = 'Arcanora — Discord MMORPG';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hpBar(current: number, max: number, length = 10): string {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function progressBar(current: number, total: number, length = 10): string {
  const filled = Math.round((current / total) * length);
  const empty = length - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
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
    exp: number;
    expToNext: number;
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
  equipment: { slot: string; name: string; rarity: string }[],
  guildName?: string,
): EmbedBuilder {
  const classDisplay = player.className ? capitalize(player.className) : 'None (unlock at Lv.5)';
  const equipLines = equipment.length > 0
    ? equipment.map((e) => `${RARITY_EMOJIS[e.rarity] || '⚪'} **${e.slot}**: ${e.name}`).join('\n')
    : '*No equipment*';

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle(`⚔️ ${player.username}'s Profile`)
    .setDescription(
      `**Level ${player.level}** ${classDisplay}\n` +
      `✨ EXP: ${player.exp} / ${player.expToNext}\n` +
      `🏅 Prestige: ${player.prestige}`,
    )
    .addFields(
      {
        name: '❤️ HP',
        value: `${hpBar(player.currentHp, stats.hpMax)} ${player.currentHp}/${stats.hpMax}`,
        inline: true,
      },
      {
        name: '💧 Mana',
        value: `${hpBar(player.currentMana, stats.manaMax)} ${player.currentMana}/${stats.manaMax}`,
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: '💰 Currency',
        value: `🪙 Gold: **${player.gold.toLocaleString()}**\n💎 Gems: **${player.gems.toLocaleString()}**`,
        inline: true,
      },
      {
        name: '📊 Combat Stats',
        value:
          `⚔️ ATK: **${stats.attack}** | 🛡️ DEF: **${stats.defense}**\n` +
          `💨 SPD: **${stats.speed}** | 🍀 LUK: **${stats.luck}**\n` +
          `⚡ CRIT: **${stats.critChance}%** (${stats.critDmg}%)`,
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '🎒 Equipment', value: equipLines, inline: false },
      ...(guildName ? [{ name: '🏰 Guild', value: guildName, inline: true }] : []),
    );
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
  const classDisplay = player.className ? capitalize(player.className) : 'None';

  return baseEmbed()
    .setColor(COLORS.INFO)
    .setTitle(`📊 ${player.username}'s Stats`)
    .setDescription(`**Level ${player.level}** — ${classDisplay}`)
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
    .setTitle(`⚔️ Combat — Round ${round}`)
    .addFields(
      {
        name: `🧙 ${playerName}`,
        value:
          `❤️ ${hpBar(playerHp, playerMaxHp)} ${playerHp}/${playerMaxHp}\n` +
          `💧 ${hpBar(playerMana, playerMaxMana)} ${playerMana}/${playerMaxMana}`,
        inline: true,
      },
      { name: 'ᐯᐯ VS ᐯᐯ', value: '\u200b', inline: true },
      {
        name: `👹 ${enemy.name} (Lv.${enemy.level})`,
        value: `❤️ ${hpBar(enemyHp, enemyMaxHp)} ${enemyHp}/${enemyMaxHp}`,
        inline: true,
      },
      {
        name: '📜 Combat Log',
        value: `\`\`\`\n${recentLog}\n\`\`\``,
        inline: false,
      },
    );
}

/**
 * Loot summary displayed after combat victory.
 */
export function lootEmbed(
  items: { name: string; quantity: number; rarity: string }[],
  gold: number,
  exp: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items.map((i) => `${RARITY_EMOJIS[i.rarity] || '⚪'} **${i.name}** x${i.quantity}`).join('\n')
    : '*No items dropped*';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle('🎉 Victory! — Loot Received')
    .addFields(
      { name: '🎁 Items', value: itemLines, inline: false },
      { name: '🪙 Gold', value: `+**${gold.toLocaleString()}**`, inline: true },
      { name: '✨ EXP', value: `+**${exp.toLocaleString()}**`, inline: true },
    );
}

/**
 * Paginated inventory display with rarity indicators.
 */
export function inventoryEmbed(
  items: { name: string; quantity: number; rarity: string; slot?: string }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items
        .map(
          (i, idx) =>
            `\`${((page - 1) * items.length + idx + 1).toString().padStart(2, '0')}\` ` +
            `${RARITY_EMOJIS[i.rarity] || '⚪'} **${i.name}** x${i.quantity}` +
            (i.slot ? ` *(${i.slot})*` : ''),
        )
        .join('\n')
    : '*Your inventory is empty.*';

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎒 Inventory')
    .setDescription(itemLines)
    .setFooter({ text: `${FOOTER_TEXT} • Page ${page}/${totalPages}` });
}

/**
 * Shop display with items available for purchase.
 */
export function shopEmbed(
  items: { name: string; price: number; rarity: string; description?: string }[],
  page: number,
  totalPages: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items
        .map(
          (i, idx) =>
            `\`${((page - 1) * items.length + idx + 1).toString().padStart(2, '0')}\` ` +
            `${RARITY_EMOJIS[i.rarity] || '⚪'} **${i.name}** — 🪙 ${i.price.toLocaleString()}` +
            (i.description ? `\n   *${i.description}*` : ''),
        )
        .join('\n')
    : '*Shop is empty.*';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle('🏪 Shop')
    .setDescription(itemLines)
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
          const rewardStr = rewards.length > 0 ? ` | ${rewards.join(' ')}` : '';
          return (
            `${typeEmoji} **${q.name}** ${status}\n` +
            `  *${q.description}*\n` +
            `  ${bar} ${q.current}/${q.target} (${Math.round(pct * 100)}%)${rewardStr}`
          );
        })
        .join('\n\n')
    : '*No active quests. Visit the quest board!*';

  return baseEmbed()
    .setColor(COLORS.INFO)
    .setTitle('📋 Active Quests')
    .setDescription(questLines);
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
    .setTitle(`🏆 Leaderboard — ${capitalize(category)}`)
    .setDescription(lines)
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
    .setDescription(guild.description || '*No description set.*')
    .addFields(
      { name: '📈 Guild Level', value: `${guild.level}`, inline: true },
      {
        name: '👥 Members',
        value: `${guild.memberCount}/${guild.maxMembers}`,
        inline: true,
      },
      { name: '🎖️ Your Rank', value: capitalize(playerRank), inline: true },
      { name: '📋 Member Roster', value: memberLines || '*No members.*', inline: false },
    );
}

/**
 * Error message embed with danger styling.
 */
export function errorEmbed(title: string, description: string): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.DANGER)
    .setTitle(`❌ ${title}`)
    .setDescription(description);
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

export { COLORS, RARITY_COLORS, RARITY_EMOJIS };
