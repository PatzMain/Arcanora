import { EmbedBuilder } from 'discord.js';
import { baseEmbed, COLORS, DIVIDER, DIVIDER_SHORT, hpBar, manaBar, RARITY_EMOJIS } from './base.js';
import { getCurrencyEmoji, getItemEmoji } from '../emojis.js';

function getEnemyWeaknessHint(enemyId: string): string | null {
  const id = enemyId.toLowerCase();
  if (id.includes('fire') || id.includes('lava') || id.includes('vulcan') || id.includes('magma') || id.includes('blaze')) {
    return '❄️ Weak to Water & Ice';
  }
  if (id.includes('crystal') || id.includes('golem') || id.includes('stone') || id.includes('iron')) {
    return '🔨 Weak to Bludgeoning';
  }
  if (id.includes('specter') || id.includes('ghost') || id.includes('shadow') || id.includes('abyssal') || id.includes('cultist')) {
    return '✨ Weak to Light & Holy';
  }
  if (id.includes('eel') || id.includes('water') || id.includes('fish') || id.includes('kraken') || id.includes('sunken')) {
    return '⚡ Weak to Lightning';
  }
  return null;
}

function formatBuffs(buffs?: any[]): string {
  if (!buffs || buffs.length === 0) return '';
  return '\n' + buffs.map(b => {
    let emoji = b.type === 'buff' ? '✨' : '⚠️';
    const nameLower = b.name.toLowerCase();
    if (nameLower.includes('poison')) emoji = '🧪';
    else if (nameLower.includes('burn') || nameLower.includes('fire')) emoji = '🔥';
    else if (nameLower.includes('shield') || nameLower.includes('defense') || nameLower.includes('defend')) emoji = '🛡️';
    else if (nameLower.includes('attack') || nameLower.includes('rage') || nameLower.includes('damage')) emoji = '⚔️';
    else if (nameLower.includes('speed') || nameLower.includes('haste')) emoji = '⚡';
    else if (nameLower.includes('regen') || nameLower.includes('heal')) emoji = '❇️';
    
    return `\`${emoji} ${b.name} (${b.turnsRemaining}t)\``;
  }).join(' ');
}

export function combatEmbed(
  playerName: string,
  playerHp: number,
  playerMaxHp: number,
  playerMana: number,
  playerMaxMana: number,
  enemy: { id: string; name: string; level: number },
  enemyHp: number,
  enemyMaxHp: number,
  round: number,
  log: string[],
  playerBuffs?: any[],
  enemyBuffs?: any[],
  activePresetSlot?: number,
): EmbedBuilder {
  const recentLog = log.slice(-5).map(line => {
    let emoji = '⚡';
    const lower = line.toLowerCase();
    if (lower.includes('attack') || lower.includes('strike') || lower.includes('hit') || lower.includes('swung')) {
      emoji = '🗡️';
    } else if (lower.includes('dodge') || lower.includes('missed') || lower.includes('evaded')) {
      emoji = '💨';
    } else if (lower.includes('heal') || lower.includes('restore') || lower.includes('regenerate')) {
      emoji = '❇️';
    } else if (lower.includes('poison') || lower.includes('burn') || lower.includes('bleed') || lower.includes('stun')) {
      emoji = '🛡️';
    } else if (lower.includes('flee') || lower.includes('run') || lower.includes('escaped')) {
      emoji = '🏃';
    } else if (lower.includes('defeat') || lower.includes('slain') || lower.includes('died')) {
      emoji = '💀';
    }
    return `${emoji} ${line}`;
  }).join('\n') || '*Combat started!*';

  const weakness = getEnemyWeaknessHint(enemy.id);
  const weaknessLine = weakness ? `\n*${weakness}*` : '';

  const embed = baseEmbed()
    .setColor(COLORS.COMBAT)
    .setTitle(`⚔️ Battle — Round ${round}`)
    .addFields(
      {
        name: `🧑 ${playerName}`,
        value:
          `🟥 ${hpBar(playerHp, playerMaxHp, 8)} \`${playerHp}/${playerMaxHp}\`\n` +
          `🟦 ${manaBar(playerMana, playerMaxMana, 8)} \`${playerMana}/${playerMaxMana}\`${formatBuffs(playerBuffs)}`,
        inline: true,
      },
      {
        name: `👹 ${enemy.name} (Lv.${enemy.level})`,
        value: `🟥 ${hpBar(enemyHp, enemyMaxHp, 8)} \`${enemyHp}/${enemyMaxHp}\`${formatBuffs(enemyBuffs)}${weaknessLine}`,
        inline: true,
      },
      {
        name: '\u200b',
        value: recentLog,
        inline: false,
      }
    );

  if (activePresetSlot !== undefined) {
    embed.setFooter({ text: `⚡ Autoplay Active: Executing Slot ${activePresetSlot} combo step... ⏳` });
  }

  return embed;
}

export function lootEmbed(
  items: { name: string; quantity: number; rarity: string; id?: string; emoji?: string | null }[],
  gold: number,
  exp: number,
): EmbedBuilder {
  const itemLines = items.length > 0
    ? items.map((i) => `${i.emoji || (i.id ? getItemEmoji(i.id, i.rarity) : (RARITY_EMOJIS[i.rarity] || '🪨'))} **${i.name}** ×${i.quantity}`).join('\n')
    : '*No items dropped*';

  return baseEmbed()
    .setColor(COLORS.LOOT)
    .setTitle('🏆 Victory!')
    .setDescription(`${DIVIDER}\n✨ *The dust settles and spoils await…*`)
    .addFields(
      { name: '─── 🎁 **Items Acquired** ───', value: itemLines, inline: false },
      { name: `${getCurrencyEmoji('gold')} Gold`, value: `+**${gold.toLocaleString()}**`, inline: true },
      { name: '✨ EXP', value: `+**${exp.toLocaleString()}**`, inline: true },
    );
}

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
    .setColor(COLORS.LOOT)
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
