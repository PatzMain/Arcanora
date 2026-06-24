import { SlashCommandBuilder, PermissionFlagsBits, type ChatInputCommandInteraction } from 'discord.js';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { calculateWorldBossHp } from '../../systems/bosses.js';
import { db } from '../../database/client.js';
import { worldBosses } from '../../database/schema.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('spawn-boss')
  .setDescription('Admin: Spawn a World Boss.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) =>
    option
      .setName('boss_id')
      .setDescription('The ID of the boss to spawn (e.g. mushroom_guardian).')
      .setRequired(true)
      .addChoices(
        { name: 'Mushroom Guardian (Lv.3)', value: 'mushroom_guardian' },
        { name: 'Ancient Hollow (Lv.6)', value: 'ancient_hollow' },
        { name: 'Crystal Colossus (Lv.10)', value: 'crystal_colossus' },
        { name: 'Infernal Titan (Lv.15)', value: 'infernal_titan' },
        { name: 'The Nameless One (Lv.20)', value: 'the_nameless_one' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    // Double check admin permission
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      const embed = errorEmbed('Unauthorized', 'Only server administrators can use this command.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const bossId = interaction.options.getString('boss_id', true);
    const enemyDef = getEnemyById(bossId);

    if (!enemyDef || enemyDef.rarity !== 'boss') {
      const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const memberCount = interaction.guild?.memberCount || 10;
    const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, memberCount);

    // Spawn boss in DB
    const [spawned] = await db
      .insert(worldBosses)
      .values({
        bossId: enemyDef.id,
        hpCurrent: computedMaxHp,
        hpMax: computedMaxHp,
        channelId: interaction.channelId || ''
      })
      .returning();

    // Send global broadcast to the channel
    const announcement = successEmbed(
      '🚨 WORLD BOSS SPAWNED! 🚨',
      `🛡️ An ancient threat has emerged in the server!\n\n` +
      `👿 **${enemyDef.name}** (Lv.**${enemyDef.level}**)\n` +
      `❤️ Health: **${computedMaxHp.toLocaleString()}** / **${computedMaxHp.toLocaleString()}**\n\n` +
      `*All adventurers are summoned to battle! Fight the boss to earn legendary loot.*`
    );
    announcement.setColor(0xEF4444); // Crimson red for boss event

    await (interaction.channel as any)?.send({ embeds: [announcement] });

    const replyEmbed = successEmbed('Boss Spawned', `Spawned boss **${enemyDef.name}** with **${computedMaxHp.toLocaleString()}** HP.`);
    await interaction.editReply({ embeds: [replyEmbed] });

  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Admin Error', 'Failed to spawn the world boss.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
