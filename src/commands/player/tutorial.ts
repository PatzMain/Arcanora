import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction
} from 'discord.js';
import { findOrCreatePlayer, getPlayerByDiscordId } from '../../database/queries/player.js';
import { addItem, equipItem } from '../../database/queries/inventory.js';
import { db } from '../../database/client.js';
import { players } from '../../database/schema.js';
import { eq } from 'drizzle-orm';
import { errorEmbed } from '../../utils/embeds.js';
import { getNavButtons } from '../../utils/navigation.js';

export const data = new SlashCommandBuilder()
  .setName('tutorial')
  .setDescription('Learn how to play Arcanora and create your character profile.');

// Shared function to generate the educational tutorial embed
function getTutorialEmbed(username: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x7C3AED) // Premium purple color
    .setTitle('🌌 Arcanora Adventure Guide')
    .setDescription(
      `Welcome, **${username}**! Arcanora is an immersive text-based Discord MMORPG.\n\n` +
      `Your goal is to explore mysterious zones, defeat monsters, collect rare equipment, level up your class, and conquer dungeons.`
    )
    .addFields(
      {
        name: '⚔️ Core Gameplay Commands',
        value:
          '• `/combat explore` — Choose a zone, start an encounter, and battle enemies.\n' +
          '• `/player profile` — Check your level, class, gold, gems, and equipped gear.\n' +
          '• `/player stats` — Break down your effective stats (HP, Mana, Attack, Defense, Crit).\n' +
          '• `/inventory bag` — Browse your collected weapons, armor, accessories, and materials.'
      },
      {
        name: '🏪 Economy & Progression',
        value:
          '• `/economy shop` — Browse items currently sold by the merchant.\n' +
          '• `/economy buy` — Purchase consumables, materials, or basic gear.\n' +
          '• `/inventory sell` — Sell items in your bag to earn gold.\n' +
          '• `/quest` — View your daily and main quests. Quests are great sources of XP and Gems!'
      },
      {
        name: '🛠️ Dungeons & Crafting',
        value:
          '• `/craft` — Smelt ores, spin silk, and forge powerful weapons and armor.\n' +
          '• `/pet` — View or release your companion pets which grant passive bonuses.\n' +
          '• `/guild` — Form a guild, donate gold, cooperate with others, or view leaderboards.'
      }
    )
    .setFooter({ text: 'Arcanora — Discord MMORPG' })
    .setTimestamp();
}

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const discordId = interaction.user.id;
    const username = interaction.user.username;

    // Check if player already exists
    const existingPlayer = await getPlayerByDiscordId(discordId);

    if (existingPlayer) {
      // Replay mode: just show the guide
      const embed = getTutorialEmbed(username);
      embed.setTitle('🌌 Arcanora Adventure Guide (Replay)');
      const navButtons = getNavButtons('tutorial_complete', existingPlayer.discordId);
      await interaction.reply({ embeds: [embed], components: navButtons ? [navButtons] : [] });
      return;
    }

    // Onboarding mode: pick starting class
    const embed = new EmbedBuilder()
      .setColor(0x7C3AED)
      .setTitle('🌌 Welcome to Arcanora!')
      .setDescription(
        `Welcome to your adventure! Before you begin, you must choose your starting class.\n\n` +
        `Selecting a class creates your profile, grants you **500 Gold**, and auto-equips your starting weapon and armor.\n\n` +
        `**Choose your starting class below:**`
      );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('tutorial_select_class')
      .setPlaceholder('Select your character class...')
      .addOptions([
        {
          label: 'Warrior',
          value: 'warrior',
          description: 'High HP/Defense. Starts with a Wooden Training Sword.',
          emoji: '⚔️'
        },
        {
          label: 'Mage',
          value: 'mage',
          description: 'High Mana/Magic power. Starts with a Novice Oak Staff.',
          emoji: '🔮'
        },
        {
          label: 'Rogue',
          value: 'rogue',
          description: 'High Speed/Crit. Starts with a Rusty Iron Dagger.',
          emoji: '🗡️'
        },
        {
          label: 'Ranger',
          value: 'ranger',
          description: 'High Speed/Crit. Starts with a Short Hunting Bow.',
          emoji: '🏹'
        },
        {
          label: 'Healer',
          value: 'healer',
          description: 'Deep Mana/Resilience. Starts with a Novice Oak Staff.',
          emoji: '❇️'
        }
      ]);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: [MessageFlags.Ephemeral]
    });
  } catch (error: any) {
    console.error('Tutorial command error:', error);
    const embed = errorEmbed('Tutorial Error', 'Failed to initialize onboarding.');
    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  }
}

export async function handleTutorialInteraction(interaction: StringSelectMenuInteraction) {
  try {
    const discordId = interaction.user.id;
    const username = interaction.user.username;
    const selectedClass = interaction.values[0];

    if (!selectedClass) {
      throw new Error('No class selected');
    }

    // Check if player profile already exists (double-click guard)
    const existingPlayer = await getPlayerByDiscordId(discordId);
    if (existingPlayer) {
      const embed = errorEmbed(
        'Profile Already Initialized',
        'You have already initialized your profile! Please use `/player profile` to view your character.'
      );
      await interaction.update({ embeds: [embed], components: [] });
      return;
    }

    // 1. Initialize player profile in a transaction/helper
    const player = await findOrCreatePlayer(discordId, username);

    // 2. Set chosen class
    await db
      .update(players)
      .set({ playerClass: selectedClass })
      .where(eq(players.id, player.id));

    // 3. Determine starter items based on class
    let starterWeaponId = 'weapon_wooden_sword';
    if (selectedClass === 'mage' || selectedClass === 'healer') {
      starterWeaponId = 'weapon_novice_staff';
    } else if (selectedClass === 'rogue') {
      starterWeaponId = 'weapon_rusty_dagger';
    } else if (selectedClass === 'ranger') {
      starterWeaponId = 'weapon_hunting_bow';
    }

    // 4. Grant and Auto-equip starting items
    const weaponRow = await addItem(player.id, starterWeaponId, 1);
    const chestRow = await addItem(player.id, 'chest_leather', 1);

    if (!weaponRow || !chestRow) {
      throw new Error('Failed to create starting equipment');
    }

    await equipItem(player.id, weaponRow.id, 'weapon');
    await equipItem(player.id, chestRow.id, 'chest');

    // 5. Build success embed
    const classNames: Record<string, string> = {
      warrior: '⚔️ Warrior',
      mage: '🔮 Mage',
      rogue: '🗡️ Rogue',
      ranger: '🏹 Ranger',
      healer: '❇️ Healer'
    };

    const weaponNames: Record<string, string> = {
      weapon_wooden_sword: 'Wooden Training Sword',
      weapon_novice_staff: 'Novice Oak Staff',
      weapon_rusty_dagger: 'Rusty Iron Dagger',
      weapon_hunting_bow: 'Short Hunting Bow'
    };

    const successEmbed = new EmbedBuilder()
      .setColor(0x10B981) // Emerald Green
      .setTitle('🌌 Journey Initialized!')
      .setDescription(
        `Your character profile has been successfully created!\n\n` +
        `**Class Selected**: ${classNames[selectedClass] || selectedClass}\n` +
        `**Starting Equipment Equipped**:\n` +
        `• ⚔️ Weapon: *${weaponNames[starterWeaponId]}*\n` +
        `• 🛡️ Armor: *Scout's Leather Vest*\n\n` +
        `You also received **🪙 500 starting gold**!`
      )
      .addFields(
        {
          name: '🚀 What Next?',
          value:
            'Use the **/combat explore** command to choose a zone, start battles, and level up!\n' +
            'You can view your stats anytime with **/player profile**.'
        }
      )
      .setFooter({ text: 'Arcanora — Discord MMORPG' })
      .setTimestamp();

    // 6. Add navigation buttons at the end
    const navButtons = getNavButtons('tutorial_complete', player.discordId);

    // 7. Update the interaction to display the onboarding success message
    await interaction.update({ embeds: [successEmbed], components: navButtons ? [navButtons] : [] });

  } catch (error: any) {
    console.error('Tutorial select interaction error:', error);
    const embed = errorEmbed('Onboarding Error', 'Failed to complete character creation.');
    await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  }
}
