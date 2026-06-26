import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { runExplore } from './explore.js';
import { runFight } from './fight.js';

export { runExplore } from './explore.js';
export { runFight } from './fight.js';

export const data = new SlashCommandBuilder()
  .setName('combat')
  .setDescription('Combat commands: explore locations or resume a fight.')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('explore')
      .setDescription('Explore your current location to fight monsters or find treasure.')
      .addStringOption((option) =>
        option
          .setName('location')
          .setDescription('Verify the location you are exploring. Must match your current location.')
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('fight')
      .setDescription('Resume your active combat session.')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const subcommand = interaction.options.getSubcommand();
  if (subcommand === 'explore') {
    await runExplore(interaction);
  } else if (subcommand === 'fight') {
    await runFight(interaction);
  }
}
