import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { successEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('invite')
  .setDescription('Get the invite link to add Arcanora to other servers.');

export async function execute(interaction: ChatInputCommandInteraction) {
  const clientId = process.env.DISCORD_CLIENT_ID || interaction.client.user?.id;
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands`;

  const embed = successEmbed(
    'Invite Arcanora',
    'Thank you for playing **Arcanora**! You can invite the companion to your own server using the button below.'
  );
  embed.setColor(0x7C3AED); // Premium purple color theme

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('Add to Server')
      .setStyle(ButtonStyle.Link)
      .setURL(inviteUrl)
  );

  await interaction.reply({ embeds: [embed], components: [row] });
}
