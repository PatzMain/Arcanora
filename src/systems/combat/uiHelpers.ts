import { ActionRowBuilder, StringSelectMenuBuilder } from 'discord.js';
import { db } from '../../database/client.js';
import { playerSkills, inventory } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
import { SKILLS } from './skills.js';
import { itemsCatalog } from '../../utils/catalog.js';

export async function getCombatSkillsRow(playerId: string, playerClass: string, discordId: string) {
  try {
    const learned = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId));
    if (learned.length === 0) return null;

    const options = learned.map(l => {
      const skillDef = SKILLS.find(s => s.id === l.skillId);
      if (!skillDef) return null;
      return {
        label: skillDef.name,
        description: `Cost: ${skillDef.manaCost} Mana. ${skillDef.description.slice(0, 50)}`,
        value: skillDef.id
      };
    }).filter(Boolean);

    if (options.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`combat_use_skill_${discordId}`)
      .setPlaceholder('🔮 Select a Skill to cast')
      .addOptions(options as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat skills:', error);
    return null;
  }
}

export async function getCombatItemsRow(playerId: string, discordId: string) {
  try {
    const dbItems = await db.select().from(inventory).where(and(eq(inventory.playerId, playerId), eq(inventory.equipped, false)));
    const catalog = itemsCatalog;

    const consumables = dbItems.map(dbItem => {
      const def = catalog.find(i => i.id === dbItem.itemId);
      if (def && def.type === 'consumable') {
        return {
          label: `${def.name} (x${dbItem.quantity})`,
          description: def.description.slice(0, 50),
          value: dbItem.id
        };
      }
      return null;
    }).filter(Boolean);

    if (consumables.length === 0) return null;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`combat_use_item_${discordId}`)
      .setPlaceholder('🧪 Select a Consumable to use')
      .addOptions(consumables as any[]);

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  } catch (error) {
    console.error('Failed to get combat items:', error);
    return null;
  }
}
