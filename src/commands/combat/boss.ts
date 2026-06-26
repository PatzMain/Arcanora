import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { db } from '../../database/client.js';
import { worldBosses, bossParticipants, players } from '../../database/schema.js';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { bossInfoEmbed, errorEmbed } from '../../utils/embeds.js';
import { runBossFight } from '../../systems/combat/bossEngine.js';

export const data = new SlashCommandBuilder()
  .setName('boss')
  .setDescription('Interact with and fight World Bosses.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('info')
      .setDescription('View current active World Boss status and contribution leaderboard.')
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('fight')
      .setDescription('Join the raid and fight the active World Boss.')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'info') {
      await runBossInfo(interaction);
    } else if (subcommand === 'fight') {
      await runBossFight(interaction);
    }
  } catch (error) {
    console.error('Boss command error:', error);
    const errEmbed = errorEmbed('Boss Error', 'An unexpected error occurred while interacting with the boss.');
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    } catch {}
  }
}

/**
 * Standalone boss info display, callable from the navigation system.
 */
export async function runBossInfo(interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<void> {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if ('update' in interaction && typeof (interaction as any).update === 'function') {
        await (interaction as ButtonInteraction).deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const channelId = interaction.channelId || '';

    let activeBoss = await db.query.worldBosses.findFirst({
      where: and(
        eq(worldBosses.channelId, channelId),
        isNull(worldBosses.defeatedAt)
      )
    });

    if (!activeBoss) {
      activeBoss = await db.query.worldBosses.findFirst({
        where: and(
          eq(worldBosses.channelId, 'GLOBAL'),
          isNull(worldBosses.defeatedAt)
        )
      });
    }

    if (!activeBoss) {
      const embed = errorEmbed('No Active Boss', 'There is no active World Boss. Ask an administrator to spawn one!');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const enemyDef = getEnemyById(activeBoss.bossId);
    if (!enemyDef) {
      const embed = errorEmbed('Boss Error', 'The active boss definition is missing.');
      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const contributors = await db
      .select({
        playerId: bossParticipants.playerId,
        damageDealt: bossParticipants.damageDealt,
        username: players.username
      })
      .from(bossParticipants)
      .innerJoin(players, eq(bossParticipants.playerId, players.id))
      .where(eq(bossParticipants.bossInstanceId, activeBoss.id))
      .orderBy(desc(bossParticipants.damageDealt))
      .limit(5);

    const embed = bossInfoEmbed(
      { name: enemyDef.name, level: enemyDef.level, description: enemyDef.description, isGlobal: activeBoss.channelId === 'GLOBAL' },
      activeBoss.hpCurrent,
      activeBoss.hpMax,
      contributors
    );

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('runBossInfo error:', error);
    const errEmbed = errorEmbed('Boss Error', 'Failed to retrieve boss information.');
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    } catch {}
  }
}
