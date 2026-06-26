import { type ChatInputCommandInteraction } from 'discord.js';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { calculateWorldBossHp } from '../../systems/bosses.js';
import { db } from '../../database/client.js';
import { worldBosses } from '../../database/schema.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export async function runSpawnBoss(interaction: ChatInputCommandInteraction) {
  const bossId = interaction.options.getString('boss_id', true);
  const enemyDef = getEnemyById(bossId);

  if (!enemyDef || enemyDef.rarity !== 'boss') {
    const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const memberCount = interaction.guild?.memberCount || 10;
  const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, memberCount, false);

  await db
    .insert(worldBosses)
    .values({
      bossId: enemyDef.id,
      hpCurrent: computedMaxHp,
      hpMax: computedMaxHp,
      channelId: interaction.channelId || ''
    })
    .returning();

  const announcement = successEmbed(
    '🚨 WORLD BOSS SPAWNED! 🚨',
    `🛡️ An ancient threat has emerged in the server!\n\n` +
    `👿 **${enemyDef.name}** (Lv.**${enemyDef.level}**)\n` +
    `❤️ Health: **${computedMaxHp.toLocaleString()}** / **${computedMaxHp.toLocaleString()}**\n\n` +
    `*All adventurers are summoned to battle! Fight the boss to earn legendary loot.*`
  );
  announcement.setColor(0xEF4444);

  await (interaction.channel as any)?.send({ embeds: [announcement] });

  const replyEmbed = successEmbed('Boss Spawned', `Spawned boss **${enemyDef.name}** with **${computedMaxHp.toLocaleString()}** HP.`);
  await interaction.editReply({ embeds: [replyEmbed] });
}

export async function runSpawnGlobalBoss(interaction: ChatInputCommandInteraction) {
  const bossId = interaction.options.getString('boss_id', true);
  const enemyDef = getEnemyById(bossId);

  if (!enemyDef || enemyDef.rarity !== 'boss') {
    const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, 10, true);

  await db
    .insert(worldBosses)
    .values({
      bossId: enemyDef.id,
      hpCurrent: computedMaxHp,
      hpMax: computedMaxHp,
      channelId: 'GLOBAL'
    })
    .returning();

  const announcement = successEmbed(
    '🚨 GLOBAL WORLD BOSS SPAWNED! 🚨',
    `🛡️ An ancient global threat has emerged!\n\n` +
    `👿 **${enemyDef.name}** (Lv.**${enemyDef.level}**)\n` +
    `❤️ Health: **${computedMaxHp.toLocaleString()}** / **${computedMaxHp.toLocaleString()}**\n\n` +
    `*All adventurers from all channels are summoned to battle! Type \`/boss fight\` to join the raid.*`
  );
  announcement.setColor(0xEF4444);

  await (interaction.channel as any)?.send({ embeds: [announcement] });

  const replyEmbed = successEmbed('Global Boss Spawned', `Spawned global boss **${enemyDef.name}** with **${computedMaxHp.toLocaleString()}** HP.`);
  await interaction.editReply({ embeds: [replyEmbed] });
}
