import {
  pgTable, uuid, varchar, integer, bigint, boolean, numeric,
  timestamp, jsonb, text, index, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ─── PLAYERS ───
export const players = pgTable('players', {
  id: uuid('id').primaryKey().defaultRandom(),
  discordId: varchar('discord_id', { length: 20 }).unique().notNull(),
  username: varchar('username', { length: 32 }).notNull(),
  level: integer('level').default(1).notNull(),
  exp: bigint('exp', { mode: 'number' }).default(0).notNull(),
  gold: bigint('gold', { mode: 'number' }).default(500).notNull(),
  gems: integer('gems').default(0).notNull(),
  prestige: integer('prestige').default(0).notNull(),
  playerClass: varchar('class', { length: 20 }).default('novice').notNull(),
  hpCurrent: integer('hp_current').default(100).notNull(),
  manaCurrent: integer('mana_current').default(50).notNull(),
  currentZoneId: varchar('current_zone_id', { length: 32 }).default('cozy_tavern').notNull(),
  totalKills: integer('total_kills').default(0).notNull(),
  totalQuestsCompleted: integer('total_quests_completed').default(0).notNull(),
  presets: jsonb('presets').default([
    { name: 'Preset 1', actions: ['attack'] },
    { name: 'Preset 2', actions: [] },
    { name: 'Preset 3', actions: [] }
  ]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  stamina: integer('stamina').default(100).notNull(),
  staminaMax: integer('stamina_max').default(100).notNull(),
  lastStaminaRegen: timestamp('last_stamina_regen', { withTimezone: true }).defaultNow().notNull(),
  housingTier: integer('housing_tier').default(0).notNull(),
  lastRestAt: timestamp('last_rest_at', { withTimezone: true }),
  restType: varchar('rest_type', { length: 32 }).default('none').notNull(),
}, (table) => ({
  discordIdIdx: uniqueIndex('players_discord_id_idx').on(table.discordId),
  levelExpIdx: index('players_level_exp_idx').on(table.level, table.exp),
}));

// ─── PLAYER_STATS ───
export const playerStats = pgTable('player_stats', {
  playerId: uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  hpMax: integer('hp_max').default(100).notNull(),
  manaMax: integer('mana_max').default(50).notNull(),
  attack: integer('attack').default(10).notNull(),
  defense: integer('defense').default(5).notNull(),
  critChance: numeric('crit_chance', { precision: 5, scale: 2 }).default('5.00').notNull(),
  critDmg: numeric('crit_dmg', { precision: 5, scale: 2 }).default('150.00').notNull(),
  speed: integer('speed').default(10).notNull(),
  luck: integer('luck').default(5).notNull(),
});

// ─── INVENTORY ───
export const inventory = pgTable('inventory', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  itemId: varchar('item_id', { length: 64 }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  durability: integer('durability'),
  enhancement: integer('enhancement').default(0).notNull(),
  equipped: boolean('equipped').default(false).notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  playerItemIdx: index('inventory_player_item_idx').on(table.playerId, table.itemId),
}));

// ─── PLAYER_EQUIPMENT ───
export const playerEquipment = pgTable('player_equipment', {
  playerId: uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  weapon: uuid('weapon').references(() => inventory.id),
  helmet: uuid('helmet').references(() => inventory.id),
  chest: uuid('chest').references(() => inventory.id),
  gloves: uuid('gloves').references(() => inventory.id),
  boots: uuid('boots').references(() => inventory.id),
  accessory: uuid('accessory').references(() => inventory.id),
  pet: uuid('pet').references(() => inventory.id),
});

// ─── COOLDOWNS ───
export const cooldowns = pgTable('cooldowns', {
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 32 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (table) => ({
  pk: uniqueIndex('cooldowns_pk').on(table.playerId, table.action),
}));

// ─── COMBAT_SESSIONS ───
export const combatSessions = pgTable('combat_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').unique().references(() => players.id, { onDelete: 'cascade' }).notNull(),
  enemyId: varchar('enemy_id', { length: 64 }).notNull(),
  zoneId: varchar('zone_id', { length: 32 }).notNull(),
  state: jsonb('state').notNull(),
  messageId: varchar('message_id', { length: 20 }),
  channelId: varchar('channel_id', { length: 20 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// ─── PLAYER_QUESTS ───
export const playerQuests = pgTable('player_quests', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  questId: varchar('quest_id', { length: 64 }).notNull(),
  progress: jsonb('progress').default({}).notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
}, (table) => ({
  playerQuestIdx: index('player_quests_player_quest_idx').on(table.playerId, table.questId),
}));

// ─── GUILDS ───
export const guilds = pgTable('guilds', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 32 }).unique().notNull(),
  level: integer('level').default(1).notNull(),
  exp: bigint('exp', { mode: 'number' }).default(0).notNull(),
  treasury: bigint('treasury', { mode: 'number' }).default(0).notNull(),
  leaderId: uuid('leader_id').references(() => players.id).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── GUILD_MEMBERS ───
export const guildMembers = pgTable('guild_members', {
  guildId: uuid('guild_id').references(() => guilds.id, { onDelete: 'cascade' }).notNull(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  rank: varchar('rank', { length: 16 }).default('member').notNull(),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: uniqueIndex('guild_members_pk').on(table.guildId, table.playerId),
}));

// ─── TRANSACTIONS ───
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  type: varchar('type', { length: 32 }).notNull(),
  amount: bigint('amount', { mode: 'number' }).notNull(),
  currency: varchar('currency', { length: 8 }).default('gold').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  playerDateIdx: index('transactions_player_date_idx').on(table.playerId, table.createdAt),
}));

// ─── WORLD_BOSSES ───
export const worldBosses = pgTable('world_bosses', {
  id: uuid('id').primaryKey().defaultRandom(),
  bossId: varchar('boss_id', { length: 64 }).notNull(),
  hpCurrent: bigint('hp_current', { mode: 'number' }).notNull(),
  hpMax: bigint('hp_max', { mode: 'number' }).notNull(),
  spawnedAt: timestamp('spawned_at', { withTimezone: true }).defaultNow().notNull(),
  defeatedAt: timestamp('defeated_at', { withTimezone: true }),
  channelId: varchar('channel_id', { length: 20 }),
  messageId: varchar('message_id', { length: 20 }),
});

// ─── BOSS_PARTICIPANTS ───
export const bossParticipants = pgTable('boss_participants', {
  bossInstanceId: uuid('boss_id').references(() => worldBosses.id, { onDelete: 'cascade' }).notNull(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  damageDealt: bigint('damage_dealt', { mode: 'number' }).default(0).notNull(),
}, (table) => ({
  pk: uniqueIndex('boss_participants_pk').on(table.bossInstanceId, table.playerId),
}));

// ─── PLAYER_ACHIEVEMENTS ───
export const playerAchievements = pgTable('player_achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  achievementId: varchar('achievement_id', { length: 64 }).notNull(),
  unlockedAt: timestamp('unlocked_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  playerAchievementIdx: uniqueIndex('player_achievements_idx').on(table.playerId, table.achievementId),
}));

// ─── DAILY_LOGINS ───
export const dailyLogins = pgTable('daily_logins', {
  playerId: uuid('player_id').primaryKey().references(() => players.id, { onDelete: 'cascade' }),
  streak: integer('streak').default(0).notNull(),
  lastClaim: timestamp('last_claim', { withTimezone: true }),
});

// ─── PLAYER_SKILLS ───
export const playerSkills = pgTable('player_skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  skillId: varchar('skill_id', { length: 64 }).notNull(),
  level: integer('level').default(1).notNull(),
}, (table) => ({
  playerSkillIdx: uniqueIndex('player_skills_idx').on(table.playerId, table.skillId),
}));

// ─── EXPLORATION_SESSIONS ───
export const explorationSessions = pgTable('exploration_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  channelId: varchar('channel_id', { length: 20 }).notNull(),
  zoneId: varchar('zone_id', { length: 32 }).notNull(),
  currentNodeId: varchar('current_node_id', { length: 32 }).notNull(),
  previousNodeId: varchar('previous_node_id', { length: 32 }),
  party: jsonb('party').default({ leaderId: '', members: [] }).notNull(),
  mapState: jsonb('map_state').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});


// ─── PLAYER_WORLD_DISCOVERIES ───
export const playerWorldDiscoveries = pgTable('player_world_discoveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  locationId: varchar('location_id', { length: 32 }).notNull(),
  discoveredAt: timestamp('discovered_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  playerLocIdx: uniqueIndex('player_world_discoveries_idx').on(table.playerId, table.locationId),
}));

// ═══════════════════════════════════════════════════════════════
// ─── RELATIONS ───
// ═══════════════════════════════════════════════════════════════

export const playersRelations = relations(players, ({ one, many }) => ({
  stats: one(playerStats, {
    fields: [players.id],
    references: [playerStats.playerId],
  }),
  equipment: one(playerEquipment, {
    fields: [players.id],
    references: [playerEquipment.playerId],
  }),
  dailyLogin: one(dailyLogins, {
    fields: [players.id],
    references: [dailyLogins.playerId],
  }),
  combatSession: one(combatSessions, {
    fields: [players.id],
    references: [combatSessions.playerId],
  }),
  inventoryItems: many(inventory),
  quests: many(playerQuests),
  skills: many(playerSkills),
  achievements: many(playerAchievements),
  transactions: many(transactions),
  cooldowns: many(cooldowns),
  guildMemberships: many(guildMembers),
  bossParticipations: many(bossParticipants),
  explorationSession: one(explorationSessions, {
    fields: [players.id],
    references: [explorationSessions.playerId],
  }),
  worldDiscoveries: many(playerWorldDiscoveries),
  feedbacks: many(feedbacks),
  farms: many(playerFarms),
}));

export const playerWorldDiscoveriesRelations = relations(playerWorldDiscoveries, ({ one }) => ({
  player: one(players, {
    fields: [playerWorldDiscoveries.playerId],
    references: [players.id],
  }),
}));

export const playerStatsRelations = relations(playerStats, ({ one }) => ({
  player: one(players, {
    fields: [playerStats.playerId],
    references: [players.id],
  }),
}));

export const inventoryRelations = relations(inventory, ({ one }) => ({
  player: one(players, {
    fields: [inventory.playerId],
    references: [players.id],
  }),
}));

export const playerEquipmentRelations = relations(playerEquipment, ({ one }) => ({
  player: one(players, {
    fields: [playerEquipment.playerId],
    references: [players.id],
  }),
  weaponItem: one(inventory, {
    fields: [playerEquipment.weapon],
    references: [inventory.id],
    relationName: 'weaponSlot',
  }),
  helmetItem: one(inventory, {
    fields: [playerEquipment.helmet],
    references: [inventory.id],
    relationName: 'helmetSlot',
  }),
  chestItem: one(inventory, {
    fields: [playerEquipment.chest],
    references: [inventory.id],
    relationName: 'chestSlot',
  }),
  glovesItem: one(inventory, {
    fields: [playerEquipment.gloves],
    references: [inventory.id],
    relationName: 'glovesSlot',
  }),
  bootsItem: one(inventory, {
    fields: [playerEquipment.boots],
    references: [inventory.id],
    relationName: 'bootsSlot',
  }),
  accessoryItem: one(inventory, {
    fields: [playerEquipment.accessory],
    references: [inventory.id],
    relationName: 'accessorySlot',
  }),
  petItem: one(inventory, {
    fields: [playerEquipment.pet],
    references: [inventory.id],
    relationName: 'petSlot',
  }),
}));

export const cooldownsRelations = relations(cooldowns, ({ one }) => ({
  player: one(players, {
    fields: [cooldowns.playerId],
    references: [players.id],
  }),
}));

export const combatSessionsRelations = relations(combatSessions, ({ one }) => ({
  player: one(players, {
    fields: [combatSessions.playerId],
    references: [players.id],
  }),
}));

export const playerQuestsRelations = relations(playerQuests, ({ one }) => ({
  player: one(players, {
    fields: [playerQuests.playerId],
    references: [players.id],
  }),
}));

export const guildsRelations = relations(guilds, ({ one, many }) => ({
  leader: one(players, {
    fields: [guilds.leaderId],
    references: [players.id],
  }),
  members: many(guildMembers),
}));

export const guildMembersRelations = relations(guildMembers, ({ one }) => ({
  guild: one(guilds, {
    fields: [guildMembers.guildId],
    references: [guilds.id],
  }),
  player: one(players, {
    fields: [guildMembers.playerId],
    references: [players.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  player: one(players, {
    fields: [transactions.playerId],
    references: [players.id],
  }),
}));

export const worldBossesRelations = relations(worldBosses, ({ many }) => ({
  participants: many(bossParticipants),
}));

export const bossParticipantsRelations = relations(bossParticipants, ({ one }) => ({
  bossInstance: one(worldBosses, {
    fields: [bossParticipants.bossInstanceId],
    references: [worldBosses.id],
  }),
  player: one(players, {
    fields: [bossParticipants.playerId],
    references: [players.id],
  }),
}));

export const playerAchievementsRelations = relations(playerAchievements, ({ one }) => ({
  player: one(players, {
    fields: [playerAchievements.playerId],
    references: [players.id],
  }),
}));

export const dailyLoginsRelations = relations(dailyLogins, ({ one }) => ({
  player: one(players, {
    fields: [dailyLogins.playerId],
    references: [players.id],
  }),
}));

export const playerSkillsRelations = relations(playerSkills, ({ one }) => ({
  player: one(players, {
    fields: [playerSkills.playerId],
    references: [players.id],
  }),
}));

export const explorationSessionsRelations = relations(explorationSessions, ({ one }) => ({
  player: one(players, {
    fields: [explorationSessions.playerId],
    references: [players.id],
  }),
}));

// ─── CUSTOM_ASSETS ───
export const customAssets = pgTable('custom_assets', {
  id: varchar('id', { length: 128 }).primaryKey(),
  type: varchar('type', { length: 32 }).notNull(),
  emoji: varchar('emoji', { length: 128 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── FEEDBACKS ───
export const feedbacks = pgTable('feedbacks', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  username: varchar('username', { length: 32 }).notNull(),
  category: varchar('category', { length: 32 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('open').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const feedbacksRelations = relations(feedbacks, ({ one }) => ({
  player: one(players, {
    fields: [feedbacks.playerId],
    references: [players.id],
  }),
}));

// ─── PLAYER_FARMS ───
export const playerFarms = pgTable('player_farms', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  plotIndex: integer('plot_index').notNull(),
  cropId: varchar('crop_id', { length: 32 }),
  plantedAt: timestamp('planted_at', { withTimezone: true }),
  wateredAt: timestamp('watered_at', { withTimezone: true }),
  harvestableAt: timestamp('harvestable_at', { withTimezone: true }),
});

export const playerFarmsRelations = relations(playerFarms, ({ one }) => ({
  player: one(players, {
    fields: [playerFarms.playerId],
    references: [players.id],
  }),
}));
