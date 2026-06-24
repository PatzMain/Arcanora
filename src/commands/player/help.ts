import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  type ChatInputCommandInteraction,
  type ButtonInteraction
} from 'discord.js';
import { helpOverviewEmbed, helpEmbed, errorEmbed } from '../../utils/embeds.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Browse the commands and tutorial guides for Arcanora.');

interface HelpCommandDef {
  name: string;
  description: string;
  usage?: string;
}

interface HelpCategory {
  emoji: string;
  title: string;
  description: string;
  commands: HelpCommandDef[];
}

const HELP_CATEGORIES: Record<string, HelpCategory> = {
  combat: {
    emoji: '⚔️',
    title: 'Combat',
    description: 'Fight monsters and explore locations',
    commands: [
      { name: 'combat explore', description: 'Explore a location to fight enemies and find loot.', usage: '/combat explore' },
      { name: 'combat fight', description: 'Fight a monster or continue an active combat encounter.', usage: '/combat fight' },
      { name: 'boss info', description: 'View current active World Boss status and contribution leaderboard.', usage: '/boss info' },
      { name: 'boss fight', description: 'Join the raid and fight the active World Boss.', usage: '/boss fight' }
    ]
  },
  inventory: {
    emoji: '🎒',
    title: 'Inventory',
    description: 'Manage your items and gear',
    commands: [
      { name: 'inventory bag', description: 'View items in your bag.', usage: '/inventory bag page: [page]' },
      { name: 'inventory equip', description: 'Equip an item from your bag.', usage: '/inventory equip item: [item]' },
      { name: 'inventory sell', description: 'Sell items from your inventory for gold.', usage: '/inventory sell item: [item] quantity: [qty]' }
    ]
  },
  economy: {
    emoji: '🏪',
    title: 'Economy',
    description: 'Gold, NPC shop, and balances',
    commands: [
      { name: 'economy balance', description: 'Check your current gold and gems.', usage: '/economy balance' },
      { name: 'economy shop', description: 'Browse the NPC shop to buy items.', usage: '/economy shop page: [page]' },
      { name: 'economy buy', description: 'Buy an item from the NPC shop with custom quantity.', usage: '/economy buy item: [item] quantity: [qty]' }
    ]
  },
  crafting: {
    emoji: '🔨',
    title: 'Crafting',
    description: 'Forge powerful equipment',
    commands: [
      { name: 'craft', description: 'Forge equipment using materials in your inventory.', usage: '/craft recipe: [recipe]' }
    ]
  },
  quests: {
    emoji: '📜',
    title: 'Quests',
    description: 'Take on challenges for rewards',
    commands: [
      { name: 'quest active', description: 'View your currently active quests and progress.', usage: '/quest active' },
      { name: 'quest board', description: 'Browse quests available to accept.', usage: '/quest board' },
      { name: 'quest accept', description: 'Accept a quest from the board.', usage: '/quest accept quest_id: [quest_id]' },
      { name: 'quest daily', description: 'Claim your daily rewards of gold and gems.', usage: '/quest daily' }
    ]
  },
  pets: {
    emoji: '🐾',
    title: 'Pets',
    description: 'Companion management',
    commands: [
      { name: 'pet info', description: 'View stats and abilities of your equipped pet.', usage: '/pet info' },
      { name: 'pet level', description: 'Train your pet to level it up.', usage: '/pet level' },
      { name: 'pet release', description: 'Release your equipped pet back into the wild.', usage: '/pet release' }
    ]
  },
  guilds: {
    emoji: '🏰',
    title: 'Guilds',
    description: 'Join, create, or view leaderboards',
    commands: [
      { name: 'guild info', description: 'View information about a guild.', usage: '/guild info name: [name]' },
      { name: 'guild create', description: 'Create a new guild.', usage: '/guild create name: [guild_name]' },
      { name: 'guild join', description: 'Join an existing guild.', usage: '/guild join name: [guild_name]' },
      { name: 'guild leave', description: 'Leave your current guild.', usage: '/guild leave' },
      { name: 'guild kick', description: 'Kick a member from your guild (Leader only).', usage: '/guild kick user: [user]' },
      { name: 'guild leaderboard', description: 'View the top players and guilds.', usage: '/guild leaderboard category: [category]' }
    ]
  },
  player: {
    emoji: '👤',
    title: 'Player',
    description: 'Profile, stats, and progression',
    commands: [
      { name: 'player profile', description: 'View your player character card, level, and stats.', usage: '/player profile' },
      { name: 'player stats', description: 'View your detailed attribute sheet.', usage: '/player stats' },
      { name: 'player prestige', description: 'Reset your level for permanent stat bonuses.', usage: '/player prestige' },
      { name: 'tutorial', description: 'Start your adventure and learn the basics of Arcanora.', usage: '/tutorial' },
      { name: 'invite', description: 'Get the invite link to add Arcanora to other servers.', usage: '/invite' }
    ]
  }
};

export async function execute(interaction: ChatInputCommandInteraction) {
  await runHelp(interaction);
}

export async function runHelp(interaction: ChatInputCommandInteraction | ButtonInteraction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      if (interaction.isButton() || interaction.isStringSelectMenu()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply();
      }
    }

    const embed = helpOverviewEmbed();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`help_select_${interaction.user.id}`)
      .setPlaceholder('📖 Choose a help category')
      .addOptions([
        {
          label: 'Help Overview',
          value: 'overview',
          description: 'Return to the main page.',
          emoji: '📖'
        },
        {
          label: 'Combat',
          value: 'combat',
          description: HELP_CATEGORIES.combat.description,
          emoji: HELP_CATEGORIES.combat.emoji
        },
        {
          label: 'Inventory',
          value: 'inventory',
          description: HELP_CATEGORIES.inventory.description,
          emoji: HELP_CATEGORIES.inventory.emoji
        },
        {
          label: 'Economy',
          value: 'economy',
          description: HELP_CATEGORIES.economy.description,
          emoji: HELP_CATEGORIES.economy.emoji
        },
        {
          label: 'Crafting',
          value: 'crafting',
          description: HELP_CATEGORIES.crafting.description,
          emoji: HELP_CATEGORIES.crafting.emoji
        },
        {
          label: 'Quests',
          value: 'quests',
          description: HELP_CATEGORIES.quests.description,
          emoji: HELP_CATEGORIES.quests.emoji
        },
        {
          label: 'Pets',
          value: 'pets',
          description: HELP_CATEGORIES.pets.description,
          emoji: HELP_CATEGORIES.pets.emoji
        },
        {
          label: 'Guilds',
          value: 'guilds',
          description: HELP_CATEGORIES.guilds.description,
          emoji: HELP_CATEGORIES.guilds.emoji
        },
        {
          label: 'Player',
          value: 'player',
          description: HELP_CATEGORIES.player.description,
          emoji: HELP_CATEGORIES.player.emoji
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    const response = await interaction.editReply({
      embeds: [embed],
      components: [row]
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 120_000,
      componentType: ComponentType.StringSelect
    });

    collector.on('collect', async (selectInteraction) => {
      if (selectInteraction.customId !== `help_select_${interaction.user.id}`) return;
      const selectedValue = selectInteraction.values[0]!;
      let nextEmbed;

      if (selectedValue === 'overview') {
        nextEmbed = helpOverviewEmbed();
      } else {
        const category = HELP_CATEGORIES[selectedValue]!;
        nextEmbed = helpEmbed(category.title, category.emoji, category.commands);
      }

      await selectInteraction.update({
        embeds: [nextEmbed],
        components: [row]
      });
    });

    collector.on('end', async () => {
      const disabledMenu = new StringSelectMenuBuilder()
        .setCustomId('help_select_disabled')
        .setPlaceholder('Help menu timed out')
        .setDisabled(true)
        .addOptions({ label: 'Timed out', value: 'timeout' });
      const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
      try {
        await interaction.editReply({ components: [disabledRow] });
      } catch {}
    });

  } catch (error) {
    console.error('Help command error:', error);
    const errEmbed = errorEmbed('Help Error', 'An unexpected error occurred while showing the help menu.');
    await interaction.editReply({ embeds: [errEmbed], components: [] });
  }
}
