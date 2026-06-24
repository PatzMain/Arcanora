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
  PET: 0x8B5CF6,        // Pet companion purple
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
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━━';
const DIVIDER_SHORT = '━━━━━━━━━━━━';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function hpBar(current: number, max: number, length = 10): string {
  const ratio = max <= 0 ? 0 : Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function progressBar(current: number, total: number, length = 10): string {
  const ratio = total <= 0 ? 0 : Math.max(0, Math.min(1, current / total));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  return '▓'.repeat(filled) + '░'.repeat(empty);
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
  const classIcon = classEmoji(player.className);
  const classDisplay = player.className ? capitalize(player.className) : 'None (unlock at Lv.5)';
  const stars = prestigeStars(player.prestige);
  const expBar = progressBar(player.exp, player.expToNext, 12);

  const equipLines = equipment.length > 0
    ? equipment.map((e) => `${RARITY_EMOJIS[e.rarity] || '⚪'} **${e.slot}**: ${e.name}`).join('\n')
    : '*No equipment*';

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle(`${classIcon} ${player.username}${stars}`)
    .setDescription(
      `${DIVIDER}\n` +
      `**Level ${player.level}** ${classDisplay}\n` +
      `${expBar} \`${player.exp}/${player.expToNext} EXP\`\n` +
      (player.prestige > 0 ? `🏅 Prestige: **${player.prestige}**\n` : '') +
      `${DIVIDER_SHORT}`,
    )
    .addFields(
      {
        name: '❤️ ── Health ──',
        value: `${hpBar(player.currentHp, stats.hpMax)} \`${player.currentHp}/${stats.hpMax}\``,
        inline: true,
      },
      {
        name: '💧 ── Mana ──',
        value: `${hpBar(player.currentMana, stats.manaMax)} \`${player.currentMana}/${stats.manaMax}\``,
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      {
        name: '💰 Currency',
        value: `🪙 Gold: **${player.gold.toLocaleString()}**\n💎 Gems: **${player.gems.toLocaleString()}**`,
        inline: true,
      },
      {
        name: `${classIcon} ── Combat Stats ──`,
        value:
          `⚔️ ATK: \`${stats.attack}\` ┃ 🛡️ DEF: \`${stats.defense}\`\n` +
          `💨 SPD: \`${stats.speed}\` ┃ 🍀 LUK: \`${stats.luck}\`\n` +
          `⚡ CRIT: \`${stats.critChance}%\` (×\`${stats.critDmg}%\`)`,
        inline: true,
      },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: `🎒 ── Equipment ──`, value: equipLines, inline: false },
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
          `💧 ${hpBar(playerMana, playerMaxMana)} \`${playerMana}/${playerMaxMana}\``,
        inline: true,
      },
      { name: '⚡ VS ⚡', value: '\u200b', inline: true },
      {
        name: `👹 ${enemy.name} (Lv.${enemy.level})`,
        value: `❤️ ${hpBar(enemyHp, enemyMaxHp)} \`${enemyHp}/${enemyMaxHp}\``,
        inline: true,
      },
      {
        name: `📜 ── Combat Log ──`,
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
    ? items.map((i) => `${RARITY_EMOJIS[i.rarity] || '⚪'} **${i.name}** ×${i.quantity}`).join('\n')
    : '*No items dropped*';

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle('🎉 ── Victory! ── 🎉')
    .setDescription(`${DIVIDER}\n✨ *The dust settles and spoils await…*`)
    .addFields(
      { name: '🎁 ── Items ──', value: itemLines, inline: false },
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
            `${RARITY_EMOJIS[i.rarity] || '⚪'} **${i.name}** ×${i.quantity}` +
            (i.slot ? ` *(${i.slot})*` : ''),
        )
        .join('\n')
    : '*Your inventory is empty.*';

  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle('🎒 ── Inventory ──')
    .setDescription(`${DIVIDER}\n${itemLines}`)
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
    .setTitle('🏪 ── Shop ──')
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
    .setTitle('📋 ── Active Quests ──')
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
    .setTitle(`🏆 ── Leaderboard: ${capitalize(category)} ──`)
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
      { name: `📋 ── Member Roster ──`, value: memberLines || '*No members.*', inline: false },
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
    ability: { name: string; description: string; cooldown: number };
  },
  passiveStats: {
    attack: number;
    defense: number;
    hpMax: number;
    luck: number;
  },
): EmbedBuilder {
  const rarityEmoji = RARITY_EMOJIS[pet.rarity] || '⚪';
  const levelBar = progressBar(pet.level, pet.maxLevel, 10);

  return baseEmbed()
    .setColor(COLORS.PET)
    .setTitle(`🐾 ── ${pet.name} ──`)
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
    .setTitle(`${categoryEmoji} ── ${capitalize(category)} Commands ──`)
    .setDescription(`${DIVIDER}\n${commandLines}\n${DIVIDER_SHORT}`)
    .setFooter({ text: `${FOOTER_TEXT} • Use the menu below to browse categories` });
}

/**
 * Help overview (welcome page) with category list.
 */
export function helpOverviewEmbed(): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.PRIMARY)
    .setTitle('📖 ── Arcanora Help Guide ──')
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
  boss: { name: string; level: number; description: string },
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

  return baseEmbed()
    .setColor(COLORS.MYTHIC)
    .setTitle(`🚨 World Boss: ${boss.name} (Lv.${boss.level})`)
    .setDescription(
      `*${boss.description}*\n\n` +
      `**Health Pool:**\n` +
      `${hpBar(hpCurrent, hpMax, 15)} \`${hpPercent}% (${hpCurrent.toLocaleString()} / ${hpMax.toLocaleString()})\`\n\n` +
      `**Top Contributors:**\n` +
      `${contributorsList}\n\n` +
      `${DIVIDER_SHORT}\n` +
      `*⚔️ Use \`/boss fight\` in this channel to join the raid!*`
    );
}

/**
 * Live skirmish card for a player battling the boss.
 */
export function bossSkirmishEmbed(
  boss: { name: string; level: number },
  bossHpCurrent: number,
  bossHpMax: number,
  player: { username: string; hpCurrent: number; hpMax: number; manaCurrent: number; manaMax: number },
  combatLog: string[],
): EmbedBuilder {
  const logLines = combatLog.slice(-4).map((line) => `▸ ${line}`).join('\n') || '*Raid skirmish starting...*';

  return baseEmbed()
    .setColor(COLORS.MYTHIC)
    .setTitle(`⚔️ Raid Skirmish — Lv.${boss.level} ${boss.name}`)
    .setDescription(
      `**Boss Health:**\n` +
      `${hpBar(bossHpCurrent, bossHpMax, 15)} \`${bossHpCurrent.toLocaleString()} / ${bossHpMax.toLocaleString()} HP\`\n\n` +
      `**Your Status:**\n` +
      `❤️ HP:   ${hpBar(player.hpCurrent, player.hpMax, 10)} \`${player.hpCurrent}/${player.hpMax}\`\n` +
      `💧 Mana: ${hpBar(player.manaCurrent, player.manaMax, 10)} \`${player.manaCurrent}/${player.manaMax}\`\n\n` +
      `**Activity Log:**\n` +
      `${logLines}`
    );
}

/**
 * Victory embed shown when a boss is defeated.
 */
export function bossVictoryEmbed(
  boss: { name: string; level: number },
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

  return baseEmbed()
    .setColor(COLORS.GOLD)
    .setTitle(`🏆 World Boss Slain: ${boss.name}! 🏆`)
    .setDescription(
      `🎉 **${boss.name} (Lv.${boss.level})** has been defeated!\n\n` +
      `👑 **MVP**: **${mvpUsername}**\n\n` +
      `**Final Damage Contribution:**\n` +
      `${rankingLines}\n\n` +
      `**Rewards Distributed:**\n` +
      `${rewardLines}\n\n` +
      `${DIVIDER_SHORT}\n` +
      `*Congratulations to all adventurers!*`
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

export { COLORS, RARITY_COLORS, RARITY_EMOJIS, CLASS_EMOJIS, DIVIDER, DIVIDER_SHORT };

