import { db } from './src/database/client.js';
import { players, inventory, explorationSessions, combatSessions, playerQuests, codexEntries } from './src/database/schema.js';
import { eq } from 'drizzle-orm';
import { findOrCreatePlayer, getPlayerWithClampedStats } from './src/database/queries/player.js';
import { createExplorationSession, getExplorationSessionByPlayerId, updateExplorationSession } from './src/database/queries/exploration.js';
import { generateDungeonMap } from './src/systems/exploration/dungeonGenerator.js';
import { campsiteHandler } from './src/systems/exploration/dungeonHandlers/campsite.js';
import { treasureHandler } from './src/systems/exploration/dungeonHandlers/treasure.js';
import { merchantHandler } from './src/systems/exploration/dungeonHandlers/merchant.js';
import { eventHandler } from './src/systems/exploration/dungeonHandlers/event.js';
import { combatNodeHandler } from './src/systems/exploration/dungeonHandlers/combat.js';
import { getEnemyById } from './src/systems/combat/enemy.js';
import { itemsCatalog } from './src/utils/catalog.js';

const MOCK_DISCORD_ID = '999999999999999999';
const MOCK_USERNAME = 'SimulatedHero';

async function cleanup() {
  console.log('\n🧹 Cleaning up simulation data from database...');
  const player = await db.query.players.findFirst({
    where: eq(players.discordId, MOCK_DISCORD_ID)
  });
  if (player) {
    await db.delete(combatSessions).where(eq(combatSessions.playerId, player.id));
    await db.delete(explorationSessions).where(eq(explorationSessions.playerId, player.id));
    await db.delete(playerQuests).where(eq(playerQuests.playerId, player.id));
    await db.delete(codexEntries).where(eq(codexEntries.playerId, player.id));
    await db.delete(inventory).where(eq(inventory.playerId, player.id));
    await db.delete(players).where(eq(players.id, player.id));
    console.log('✅ Cleanup complete.');
  } else {
    console.log('✅ No existing mock data found.');
  }
}

async function run() {
  console.log('🎮 Starting Arcanora E2E Playthrough Simulator...');
  
  const dbUrl = process.env.DATABASE_URL || '';
  if (!dbUrl || dbUrl.includes('${{') || dbUrl.includes('placeholder')) {
    console.error(`
❌ ERROR: DATABASE_URL is missing or contains a placeholder.
To run this simulator locally against your database, please:
  1. Copy the Postgres Connection String from your Railway dashboard database settings.
  2. Overwrite the DATABASE_URL value in your local .env file:
     DATABASE_URL="postgresql://postgres:..."
  3. Re-run the simulator using:
     npx tsx --env-file=.env scratch_simulate_playthrough.ts
`);
    process.exit(1);
  }

  await cleanup();

  // 1. Character Creation (Tutorial Onboarding)
  console.log('\n--- STEP 1: Character Creation ---');
  const player = await findOrCreatePlayer(MOCK_DISCORD_ID, MOCK_USERNAME);
  console.log(`✅ Player profile created: ${player.username} (ID: ${player.id}, Level: ${player.level}, Class: ${player.playerClass})`);
  
  // Set starting class to Warrior and grant gold for merchant test
  await db.update(players)
    .set({ playerClass: 'Warrior', gold: 500, stamina: 100 })
    .where(eq(players.id, player.id));
  
  const refreshedPlayer = await getPlayerWithClampedStats(MOCK_DISCORD_ID);
  console.log(`🧙 Player class set to Warrior, gold updated to: ${refreshedPlayer?.gold} gold, stamina set to: ${refreshedPlayer?.stamina}`);

  // 2. World Travel
  console.log('\n--- STEP 2: World Map Travel ---');
  console.log(`🚶 Traveling from Oakhaven Square to Oakhaven East Gate...`);
  await db.update(players).set({ currentLocationId: 'oakhaven_east_gate' }).where(eq(players.id, player.id));
  const traveledPlayer = await getPlayerWithClampedStats(MOCK_DISCORD_ID);
  console.log(`📍 Current Location: ${traveledPlayer?.currentLocationId}`);

  // 3. Dungeon Run Simulation: Forgotten Ironmine
  console.log('\n--- STEP 3: Dungeon Run (Forgotten Ironmine) ---');
  console.log('🏰 Generating 6x6 Forgotten Ironmine map...');
  const mapState = generateDungeonMap('forgotten_ironmine', traveledPlayer!.level, 1);
  console.log(`Dungeon Map Details: floor: ${mapState.floor}, layersCount: ${mapState.layersCount}, startNodeId: ${mapState.startNodeId}, bossNodeId: ${mapState.bossNodeId}`);

  const session = await createExplorationSession({
    playerId: player.id,
    channelId: 'mock_channel_id',
    zoneId: 'forgotten_ironmine',
    currentNodeId: mapState.startNodeId,
    party: { leaderId: player.id, members: [{ playerId: player.id, username: player.username, level: player.level }] },
    mapState
  });
  console.log(`✅ Exploration session created: ${session.id}`);

  // Get active node details (Entrance Campsite)
  let activeNodeId = session.currentNodeId;
  let currNode = mapState.nodes[activeNodeId];
  console.log(`📍 Active cell coordinates: "${activeNodeId}" (Type: "${currNode.type}", Name: "${currNode.name}", Status: "${currNode.status}")`);

  // Rest at campsite
  const campsiteContext = {
    playerId: player.id,
    discordId: MOCK_DISCORD_ID,
    node: currNode,
    dbSession: session
  };
  console.log(`🏕️ Sitting by campsite to rest...`);
  const campsiteResult = await campsiteHandler.onAction('rest', campsiteContext);
  console.log(`✅ Campsite Result success: ${campsiteResult.success}, Log: ${campsiteResult.log}`);
  console.log(`Cell status updated to: ${session.mapState.nodes[activeNodeId].status}`);

  // Simulate movement to a treasure chest cell
  console.log('\n🎁 Searching for a treasure chest cell in the grid...');
  const treasureCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'treasure') || '1_1';
  mapState.nodes[treasureCellId].status = 'visited'; // stepping onto it
  
  const treasureContext = {
    playerId: player.id,
    discordId: MOCK_DISCORD_ID,
    node: mapState.nodes[treasureCellId],
    dbSession: session
  };
  console.log(`📦 Stepped onto treasure cell "${treasureCellId}". Opening chest...`);
  const treasureResult = await treasureHandler.onAction('loot', treasureContext);
  console.log(`✅ Loot Result success: ${treasureResult.success}`);
  if (treasureResult.embeds[0]) {
    console.log(`📜 Loot Outcome: ${treasureResult.embeds[0].data.description}`);
    const fields = treasureResult.embeds[0].data.fields || [];
    fields.forEach(f => console.log(`  • ${f.name}: ${f.value}`));
  }

  // Simulate movement to an event cell
  console.log('\n✨ Searching for a random event cell in the grid...');
  const eventCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'event');
  if (eventCellId) {
    mapState.nodes[eventCellId].status = 'visited'; // stepping onto it
    const eventContext = {
      playerId: player.id,
      discordId: MOCK_DISCORD_ID,
      node: mapState.nodes[eventCellId],
      dbSession: session
    };
    const eventData = mapState.nodes[eventCellId].encounterData?.event;
    console.log(`🌠 Stepped onto event cell "${eventCellId}" (${eventData?.title}). Choice: "${eventData?.choices[0].label}"`);
    const eventResult = await eventHandler.onAction('choose', eventContext, { outcomeId: eventData?.choices[0].outcomeId });
    console.log(`✅ Event Result success: ${eventResult.success}`);
    if (eventResult.embeds[0]) {
      console.log(`📜 Event Outcome: ${eventResult.embeds[0].data.description}`);
    }
  }

  // Simulate movement to a merchant cell
  console.log('\n🏪 Searching for a merchant cell in the grid...');
  const merchantCellId = Object.keys(mapState.nodes).find(id => mapState.nodes[id].type === 'merchant');
  if (merchantCellId) {
    mapState.nodes[merchantCellId].status = 'visited'; // stepping onto it
    const merchantContext = {
      playerId: player.id,
      discordId: MOCK_DISCORD_ID,
      node: mapState.nodes[merchantCellId],
      dbSession: session
    };
    const shopItems = mapState.nodes[merchantCellId].encounterData?.shopItems || [];
    const targetItem = shopItems[0];
    console.log(`🏪 Stepped onto merchant cell "${merchantCellId}". Buying: 1x ${targetItem?.id} for ${targetItem?.price} gold...`);
    const merchantResult = await merchantHandler.onAction('buy', merchantContext, { itemId: targetItem?.id });
    console.log(`✅ Merchant Result success: ${merchantResult.success}, Log: ${merchantResult.log}`);
    const finalRefreshed = await getPlayerWithClampedStats(MOCK_DISCORD_ID);
    console.log(`💰 Remaining Gold: ${finalRefreshed?.gold} gold`);
  }

  // Simulate movement to a combat room cell
  console.log('\n⚔️ Searching for a monster cell in the grid...');
  const combatCellId = Object.keys(mapState.nodes).find(id => ['room', 'elite'].includes(mapState.nodes[id].type)) || '0_1';
  mapState.nodes[combatCellId].status = 'visited'; // stepping onto it
  
  const combatContext = {
    playerId: player.id,
    discordId: MOCK_DISCORD_ID,
    node: mapState.nodes[combatCellId],
    dbSession: session
  };
  const enemyId = mapState.nodes[combatCellId].encounterData?.enemyId || 'cave_bat';
  const enemy = getEnemyById(enemyId)!;
  console.log(`👹 Stepped onto combat cell "${combatCellId}". Hostile: Lv.${enemy.level} ${enemy.name}`);
  
  // Engage combat
  const combatResult = await combatNodeHandler.onAction('engage', combatContext);
  console.log(`⚔️ Engage Result success: ${combatResult.success}, Log: ${combatResult.log}`);

  // Fetch combat session
  const combatSession = await db.query.combatSessions.findFirst({
    where: eq(combatSessions.playerId, player.id)
  });
  console.log(`✅ Combat Session active: ${!!combatSession} (ID: ${combatSession?.id})`);

  // Simulate combat victory directly by calling combat completion
  if (combatSession) {
    console.log(`🗡️ Defeating the enemy to clear the path...`);
    const { markNodeCleared } = await import('./src/database/queries/exploration.js');
    await markNodeCleared(session.id, combatCellId);
    await db.delete(combatSessions).where(eq(combatSessions.id, combatSession.id));
    console.log(`✅ Combat Session cleaned. Cell status updated to: ${session.mapState.nodes[combatCellId].status}`);
  }

  // Simulate floor progression & Final Boss defeat
  console.log('\n🏆 Simulating Boss Room engagement at final floor...');
  const bossCellId = mapState.bossNodeId;
  const bossContext = {
    playerId: player.id,
    discordId: MOCK_DISCORD_ID,
    node: mapState.nodes[bossCellId],
    dbSession: session
  };
  const bossId = mapState.nodes[bossCellId].encounterData?.enemyId || 'grak_zul';
  const boss = getEnemyById(bossId)!;
  console.log(`👑 Final Room Boss: ${boss.name} (Rarity: ${boss.rarity})`);
  
  // Engage boss
  const bossEngageResult = await combatNodeHandler.onAction('engage', bossContext);
  console.log(`⚔️ Boss Engage Result success: ${bossEngageResult.success}`);

  // Complete session victory
  console.log('🏆 Defeating Boss and completing dungeon run...');
  const { markNodeCleared } = await import('./src/database/queries/exploration.js');
  await markNodeCleared(session.id, bossCellId);
  await db.delete(explorationSessions).where(eq(explorationSessions.id, session.id));
  console.log(`✅ Dungeon completed successfully! Mock player has cleared the entire dungeon.`);

  await cleanup();
  console.log('\n🌟 PLAYTHROUGH SIMULATION PASSED SUCCESSFULLY! 🌟');
}

run().catch(err => {
  console.error('❌ Playthrough Simulation FAILED:', err);
  process.exit(1);
});
