import {
  SlashCommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
  type ChatInputCommandInteraction
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
    description: 'Fight monsters and explore zones',
    commands: [
      { name: 'explore', description: 'Explore a zone to fight enemies and find loot.', usage: '/explore [zone]' },
      { name: 'fight', description: 'Fight a monster or continue an active combat encounter.', usage: '/fight' }
    ]
  },
  inventory: {
    emoji: '🎒',
    title: 'Inventory',
    description: 'Manage your items and gear',
    commands: [
      { name: 'bag', description: 'View items in your bag.', usage: '/bag [page]' },
      { name: 'equip', description: 'Equip an item from your bag.', usage: '/equip [item]' },
      { name: 'sell', description: 'Sell items from your inventory for gold.', usage: '/sell item: [item] quantity: [qty]' }
    ]
  },
  economy: {
    emoji: '🏪',
    title: 'Economy',
    description: 'Gold, shops, and transactions',
    commands: [
      { name: 'balance', description: 'Check your current gold and gems.', usage: '/balance' },
      { name: 'shop', description: 'Browse the shop to buy items or sell loot.', usage: '/shop' }
    ]
  },
  crafting: {
    emoji: '🔨',
    title: 'Crafting',
    description: 'Forge powerful equipment',
    commands: [
      { name: 'craft', description: 'Forge equipment using materials in your inventory.', usage: '/craft [recipe]' }
    ]
  },
  quests: {
    emoji: '📜',
    title: 'Quests',
    description: 'Take on challenges for rewards',
    commands: [
      { name: 'quests active', description: 'View your currently active quests and progress.', usage: '/quests active' },
      { name: 'quests board', description: 'Browse quests available to accept.', usage: '/quests board' },
      { name: 'quests accept', description: 'Accept a quest from the board.', usage: '/quests accept quest_id: [quest_id]' },
      { name: 'daily', description: 'Claim your daily rewards of gold, gems, and items.', usage: '/daily' }
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
    description: 'Join or create a guild',
    commands: [
      { name: 'guild info', description: 'View information about a guild.', usage: '/guild info [name]' },
      { name: 'guild create', description: 'Create a new guild.', usage: '/guild create name: [guild_name]' },
      { name: 'guild join', description: 'Join an existing guild.', usage: '/guild join name: [guild_name]' },
      { name: 'guild leave', description: 'Leave your current guild.', usage: '/guild leave' },
      { name: 'guild kick', description: 'Kick a member from your guild (Leader only).', usage: '/guild kick user: [user]' },
      { name: 'leaderboard', description: 'View the top players and guilds.', usage: '/leaderboard' }
    ]
  },
  player: {
    emoji: '👤',
    title: 'Player',
    description: 'Profile, stats, and progression',
    commands: [
      { name: 'profile', description: 'View your player character card, level, and stats.', usage: '/profile' },
      { name: 'stats', description: 'Allocate attribute points to increase your stats.', usage: '/stats' },
      { name: 'prestige', description: 'Reset your level for permanent stat bonuses.', usage: '/prestige' },
      { name: 'tutorial', description: 'Start your adventure and learn the basics of Arcanora.', usage: '/tutorial' },
      { name: 'invite', description: 'Get the invite link to add Arcanora to other servers.', usage: '/invite' }
    ]
  }
};

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const embed = helpOverviewEmbed();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_select')
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

    const response = await interaction.reply({
      embeds: [embed],
      components: [row],
      fetchReply: true
    });

    while (true) {
      try {
        const selectInteraction = await response.awaitMessageComponent({
          filter: (i) => i.user.id === interaction.user.id,
          time: 60_000,
          componentType: ComponentType.StringSelect
        });

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
      } catch (e) {
        const disabledMenu = new StringSelectMenuBuilder()
          .setCustomId('help_select')
          .setPlaceholder('Help menu timed out')
          .setDisabled(true)
          .addOptions({ label: 'Timed out', value: 'timeout' });
        const disabledRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(disabledMenu);
        try {
          await interaction.editReply({ components: [disabledRow] });
        } catch {}
        break;
      }
    }
  } catch (error) {
    console.error('Help command error:', error);
    const errEmbed = errorEmbed('Help Error', 'An unexpected error occurred while showing the help menu.');
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    } catch {}
  }
}
