import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { db } from '../../database/client.js';
import { dailyLogins } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { awardGold, awardGems } from '../../economy/currency.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily login rewards and build your streak.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply();

    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Load player
    const player = await findOrCreatePlayer(discordId, username);

    // Fetch daily login row
    let row = await db.query.dailyLogins.findFirst({
      where: eq(dailyLogins.playerId, player.id),
    });

    if (!row) {
      // Fallback insertion (though findOrCreatePlayer should have inserted it)
      [row] = await db
        .insert(dailyLogins)
        .values({ playerId: player.id })
        .returning();
    }

    const now = new Date();

    if (row!.lastClaim) {
      const lastClaim = new Date(row!.lastClaim);
      const isSameDay =
        now.getFullYear() === lastClaim.getFullYear() &&
        now.getMonth() === lastClaim.getMonth() &&
        now.getDate() === lastClaim.getDate();

      if (isSameDay) {
        const embed = errorEmbed(
          'Daily Reward Claimed',
          'You have already claimed your daily reward today. Come back tomorrow!'
        );
        return interaction.editReply({ embeds: [embed] });
      }
    }

    // Determine streak
    let streak = 1;
    if (row!.lastClaim) {
      const lastClaim = new Date(row!.lastClaim);
      const msDiff = now.getTime() - lastClaim.getTime();
      const fortyEightHoursMs = 48 * 60 * 60 * 1000;

      // If claimed within the last 48 hours, increment streak
      if (msDiff < fortyEightHoursMs) {
        streak = row!.streak + 1;
      }
    }

    // Calculate rewards
    const goldReward = Math.min(100 * streak, 1000); // Caps at 1000 gold
    const isWeeklyMilestone = streak % 7 === 0;
    const gemsReward = isWeeklyMilestone ? 15 : 0;

    // Save in DB
    await db
      .update(dailyLogins)
      .set({
        streak,
        lastClaim: now
      })
      .where(eq(dailyLogins.playerId, player.id));

    // Award currencies
    await awardGold(player.id, goldReward, `Daily login reward (Streak Day ${streak})`);
    if (gemsReward > 0) {
      await awardGems(player.id, gemsReward, `Daily login streak milestone (Day ${streak})`);
    }

    let description =
      `🎁 You claimed your daily login reward!\n\n` +
      `🔥 Current Streak: **${streak} Days**\n` +
      `🪙 Gold: +**${goldReward.toLocaleString()}**`;

    if (gemsReward > 0) {
      description += `\n💎 Gems: +**${gemsReward}** (7-day Milestone Bonus!)`;
    }

    description += `\n\n*Make sure to claim again tomorrow to keep your streak going!*`;

    const embed = successEmbed('Daily Reward Claimed', description);
    embed.setColor(0x10B981); // Green success color
    await interaction.editReply({ embeds: [embed] });
    return;
  } catch (error: any) {
    console.error(error);
    const embed = errorEmbed('Daily Error', 'Failed to claim your daily reward.');
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
    return;
  }
}
