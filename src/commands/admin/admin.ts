import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction
} from 'discord.js';
import { findOrCreatePlayer } from '../../database/queries/player.js';
import { addItem } from '../../database/queries/inventory.js';
import { getEnemyById } from '../../systems/combat/enemy.js';
import { calculateWorldBossHp } from '../../systems/bosses.js';
import { db } from '../../database/client.js';
import { worldBosses } from '../../database/schema.js';
import { successEmbed, errorEmbed } from '../../utils/embeds.js';
import { itemsCatalog } from '../../utils/catalog.js';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin command panel.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((subcommand) =>
    subcommand
      .setName('give-item')
      .setDescription('Admin: Give an item to a player.')
      .addUserOption((option) =>
        option
          .setName('user')
          .setDescription('The player receiving the item.')
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName('item')
          .setDescription('Item ID or name.')
          .setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName('quantity')
          .setDescription('Quantity to give (default: 1).')
          .setMinValue(1)
          .setRequired(false)
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('spawn-boss')
      .setDescription('Admin: Spawn a World Boss.')
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
      )
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName('spawn-global-boss')
      .setDescription('Admin: Spawn a Global World Boss.')
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

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'give-item') {
      const targetUser = interaction.options.getUser('user', true);
      const inputName = interaction.options.getString('item', true).toLowerCase();
      const quantity = interaction.options.getInteger('quantity') || 1;

      const targetPlayer = await findOrCreatePlayer(targetUser.id, targetUser.username);

      const catalog = itemsCatalog;
      const itemDef = catalog.find(
        (i) =>
          i.id.toLowerCase() === inputName ||
          i.name.toLowerCase().includes(inputName)
      );

      if (!itemDef) {
        const embed = errorEmbed('Item Not Found', `No item matching **"${inputName}"** was found in the catalog.`);
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      await addItem(targetPlayer.id, itemDef.id, quantity);

      const embed = successEmbed(
        'Admin Grant Success',
        `You successfully gave **x${quantity}** **${itemDef.name}** \`(${itemDef.id})\` to **${targetUser.username}**.`
      );
      await interaction.editReply({ embeds: [embed] });

    } else if (subcommand === 'spawn-boss') {
      const bossId = interaction.options.getString('boss_id', true);
      const enemyDef = getEnemyById(bossId);

      if (!enemyDef || enemyDef.rarity !== 'boss') {
        const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const memberCount = interaction.guild?.memberCount || 10;
      const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, memberCount);

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
    } else if (subcommand === 'spawn-global-boss') {
      const bossId = interaction.options.getString('boss_id', true);
      const enemyDef = getEnemyById(bossId);

      if (!enemyDef || enemyDef.rarity !== 'boss') {
        const embed = errorEmbed('Invalid Boss ID', 'The specified enemy ID is not a registered boss.');
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const computedMaxHp = calculateWorldBossHp(enemyDef.stats.hp, 10);

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
  } catch (error: any) {
    console.error('Admin command error:', error);
    const embed = errorEmbed('Admin Error', 'Failed to execute admin command.');
    await interaction.editReply({ embeds: [embed] });
  }
}
