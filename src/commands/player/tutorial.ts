import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { findOrCreatePlayer, getPlayerByDiscordId } from '../../database/queries/player.js';
import { errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('tutorial')
  .setDescription('Learn how to play Arcanora and create your character profile.');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Check if player already exists
    const existingPlayer = await getPlayerByDiscordId(discordId);

    if (existingPlayer) {
      const embed = errorEmbed(
        'Tutorial Already Completed',
        'You have already completed the onboarding tutorial! Use `/profile` to view your character or `/explore` to begin your adventure.'
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    // Initialize player profile
    await findOrCreatePlayer(discordId, username);

    const embed = new EmbedBuilder()
      .setColor(0x7C3AED) // Premium purple color
      .setTitle('🌌 Welcome to Arcanora!')
      .setDescription(
        `Welcome, **${username}**! Your character profile has been successfully initialized.\n\n` +
        `Arcanora is a text-based Discord MMORPG where you can battle monsters, collect gear, craft items, level up classes, join guilds, and raise pets.`
      )
      .addFields(
        {
          name: '⚔️ Basic Commands',
          value:
            '• `/explore` — Venture into zones, fight monsters, and gather loot.\n' +
            '• `/profile` — View your character stats, level, class, and equipment.\n' +
            '• `/bag` — Inspect the items, gear, and materials in your bag.\n' +
            '• `/shop` — Buy items from the merchant or sell excess loot.\n' +
            '• `/quests` — View and complete quests to earn gold and gems.'
        },
        {
          name: '🛡️ Starting Equipment & Assets',
          value:
            'You have been equipped with a basic **Novice Weapon** and **Novice Armor** to start your journey.\n' +
            'You also received **500 Gold** to spend in the `/shop`!'
        },
        {
          name: '🚀 What Next?',
          value: 'Run the `/explore` command to start your first adventure!'
        }
      )
      .setFooter({ text: 'Arcanora — Discord MMORPG' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (error: any) {
    console.error('Tutorial command error:', error);
    const embed = errorEmbed('Tutorial Error', 'Failed to initialize your player profile. Please try again.');
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ embeds: [embed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
}
