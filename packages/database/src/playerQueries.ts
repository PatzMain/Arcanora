import { eq } from 'drizzle-orm';
import { getDb } from './client.js';
import { players, playerStats, inventory } from './schema.js';

export interface WebPlayerSyncData {
  id: string;
  username: string;
  playerClass: string;
  level: number;
  exp: number;
  gold: number;
  gems: number;
  hpCurrent: number;
  hpMax: number;
  manaCurrent: number;
  manaMax: number;
  stamina: number;
  staminaMax: number;
  currentZoneId: string;
  attack: number;
  defense: number;
  speed: number;
  critChance: number;
  critDmg: number;
  luck: number;
}

/**
 * Saves or updates player state in the embedded PGlite database.
 */
export async function saveWebPlayer(player: WebPlayerSyncData): Promise<void> {
  const db = getDb();
  const discordId = player.id || 'local_hero_01';

  const existing = await db.query.players.findFirst({
    where: eq(players.discordId, discordId)
  });

  if (existing) {
    await db.update(players).set({
      username: player.username,
      playerClass: player.playerClass,
      level: player.level,
      exp: player.exp,
      gold: player.gold,
      gems: player.gems,
      hpCurrent: player.hpCurrent,
      manaCurrent: player.manaCurrent,
      stamina: player.stamina,
      staminaMax: player.staminaMax,
      currentZoneId: player.currentZoneId,
      lastSeen: new Date()
    }).where(eq(players.id, existing.id));

    await db.update(playerStats).set({
      hpMax: player.hpMax,
      manaMax: player.manaMax,
      attack: player.attack,
      defense: player.defense,
      speed: player.speed,
      critChance: String(player.critChance),
      critDmg: String(player.critDmg),
      luck: player.luck
    }).where(eq(playerStats.playerId, existing.id));
  } else {
    const [newPlayer] = await db.insert(players).values({
      discordId,
      username: player.username,
      playerClass: player.playerClass,
      level: player.level,
      exp: player.exp,
      gold: player.gold,
      gems: player.gems,
      hpCurrent: player.hpCurrent,
      manaCurrent: player.manaCurrent,
      stamina: player.stamina,
      staminaMax: player.staminaMax,
      currentZoneId: player.currentZoneId,
      lastSeen: new Date()
    }).returning();

    if (newPlayer) {
      await db.insert(playerStats).values({
        playerId: newPlayer.id,
        hpMax: player.hpMax,
        manaMax: player.manaMax,
        attack: player.attack,
        defense: player.defense,
        speed: player.speed,
        critChance: String(player.critChance),
        critDmg: String(player.critDmg),
        luck: player.luck
      });
    }
  }
}

/**
 * Loads a player record and stats from the embedded PGlite database.
 */
export async function loadWebPlayer(discordId = 'local_hero_01'): Promise<WebPlayerSyncData | null> {
  const db = getDb();
  const playerRecord = await db.query.players.findFirst({
    where: eq(players.discordId, discordId),
    with: { stats: true }
  });

  if (!playerRecord) return null;

  const stats = playerRecord.stats;

  return {
    id: playerRecord.discordId,
    username: playerRecord.username,
    playerClass: playerRecord.playerClass,
    level: playerRecord.level,
    exp: Number(playerRecord.exp),
    gold: Number(playerRecord.gold),
    gems: playerRecord.gems,
    hpCurrent: playerRecord.hpCurrent,
    hpMax: stats?.hpMax ?? 100,
    manaCurrent: playerRecord.manaCurrent,
    manaMax: stats?.manaMax ?? 50,
    stamina: playerRecord.stamina,
    staminaMax: playerRecord.staminaMax,
    currentZoneId: playerRecord.currentZoneId,
    attack: stats?.attack ?? 10,
    defense: stats?.defense ?? 5,
    speed: stats?.speed ?? 10,
    critChance: stats ? parseFloat(stats.critChance) : 5,
    critDmg: stats ? parseFloat(stats.critDmg) : 150,
    luck: stats?.luck ?? 5
  };
}
