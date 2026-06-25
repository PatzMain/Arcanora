import { zonesCatalog, enemiesCatalog } from '../../utils/catalog.js';

export interface DungeonNode {
  id: string;
  name: string;
  type: 'campsite' | 'treasure' | 'merchant' | 'puzzle' | 'event' | 'elite' | 'boss' | 'room';
  status: 'hidden' | 'revealed' | 'visited' | 'cleared';
  connections: string[];
  encounterData?: any;
  layer: number;
}

export interface DungeonMap {
  zoneId: string;
  name: string;
  layersCount: number;
  nodes: Record<string, DungeonNode>;
  startNodeId: string;
  bossNodeId: string;
}

// Predefined riddles for Puzzle nodes
export const RIDDLES = [
  {
    question: "What has keys but can't open locks?",
    options: ["Piano", "Map", "Chest", "Clock"],
    correctIndex: 0,
    rewardGold: 150,
    rewardExp: 100,
    damageOnWrong: 15,
  },
  {
    question: "The more of them you take, the more you leave behind. What are they?",
    options: ["Breaths", "Coins", "Footsteps", "Secrets"],
    correctIndex: 2,
    rewardGold: 150,
    rewardExp: 100,
    damageOnWrong: 15,
  },
  {
    question: "I am tall when I am young, and I am short when I am old. What am I?",
    options: ["Tree", "Candle", "Human", "Mountain"],
    correctIndex: 1,
    rewardGold: 150,
    rewardExp: 100,
    damageOnWrong: 15,
  },
  {
    question: "What has to be broken before you can use it?",
    options: ["Promise", "Glass", "Egg", "Heart"],
    correctIndex: 2,
    rewardGold: 150,
    rewardExp: 100,
    damageOnWrong: 15,
  },
  {
    question: "What is full of holes but still holds water?",
    options: ["Net", "Sponge", "Bucket", "Sieve"],
    correctIndex: 1,
    rewardGold: 150,
    rewardExp: 100,
    damageOnWrong: 15,
  }
];

// Predefined random events
export const EVENTS = [
  {
    id: "ancient_shrine",
    title: "✨ Ancient Shrine",
    description: "You discover a moss-covered shrine with a pulsing, cracked crystal embedded in its altar.",
    choices: [
      {
        label: "Touch the Crystal",
        outcomeId: "shrine_touch",
        text: "You touch the crystal. It cracks completely, discharging energy!"
      },
      {
        label: "Pray Quietly",
        outcomeId: "shrine_pray",
        text: "You offer a silent prayer. The crystal glows softly, restoring your inner focus."
      },
      {
        label: "Walk Away",
        outcomeId: "shrine_leave",
        text: "You decide it's safer not to meddle with unknown magic."
      }
    ]
  },
  {
    id: "mysterious_fountain",
    title: "✨ Shimmering Fountain",
    description: "A natural spring of crystal-clear water wells up in a stone basin, smelling of fresh rain.",
    choices: [
      {
        label: "Drink Deeply",
        outcomeId: "fountain_drink",
        text: "The cool, refreshing water rejuvenates your body and mind."
      },
      {
        label: "Toss a Gold Coin",
        outcomeId: "fountain_coin",
        text: "You throw a gold coin into the water. A blessing washes over you, boosting your confidence."
      },
      {
        label: "Move On",
        outcomeId: "fountain_leave",
        text: "You ignore the fountain and keep walking."
      }
    ]
  },
  {
    id: "suspicious_bones",
    title: "✨ Rusted Remains",
    description: "A heap of skeletal remains and decayed armor lies in the corner of a damp chamber.",
    choices: [
      {
        label: "Search the Remains",
        outcomeId: "bones_search",
        text: "You carefully sift through the dusty armor..."
      },
      {
        label: "Leave Them in Peace",
        outcomeId: "bones_leave",
        text: "You pay respects to the fallen warrior and proceed."
      }
    ]
  }
];

// Helper to determine depth layers count for each zone
export function getDungeonDepth(zoneId: string): number {
  switch (zoneId) {
    case 'verdant_meadows': return 5;
    case 'shadow_forest': return 6;
    case 'crystal_caverns': return 7;
    case 'volcanic_wastes': return 8;
    case 'abyssal_depths': return 9;
    default: return 5;
  }
}

// Helper to get random enemy of a specific rarity from zone catalog
function getRandomEnemyForZone(zoneId: string, rarity: 'normal' | 'rare' | 'boss'): string {
  const zone = zonesCatalog.find(z => z.id === zoneId);
  const zoneEnemies = zone?.enemies || [];
  
  // Find matching enemies in the catalog
  const candidates = enemiesCatalog.filter(e => {
    return zoneEnemies.includes(e.id) && e.rarity === rarity;
  });
  
  if (candidates.length > 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx].id;
  }
  
  // Fallback to any zone enemy if no match by rarity
  if (zoneEnemies.length > 0) {
    // Pick standard fallback
    const fallbackId = zoneEnemies[Math.floor(Math.random() * zoneEnemies.length)];
    return fallbackId;
  }
  
  // Hard fallbacks
  switch (rarity) {
    case 'boss': return 'crystal_colossus';
    case 'rare': return 'gem_serpent';
    default: return 'crystal_golem';
  }
}

/**
 * Generate a procedural, stateless DAG dungeon map.
 */
export function generateDungeonMap(zoneId: string, playerLevel: number): DungeonMap {
  const zone = zonesCatalog.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : 'Unknown Dungeon';
  const depth = getDungeonDepth(zoneId);
  
  const nodes: Record<string, DungeonNode> = {};
  
  // 1. Create Start Node (Layer 0)
  const startNode: DungeonNode = {
    id: 'start',
    name: '🏕️ Dungeon Entrance',
    type: 'campsite',
    status: 'visited',
    connections: [],
    layer: 0
  };
  nodes['start'] = startNode;
  
  // 2. Generate Middle Layers (1 to depth - 2)
  const layers: string[][] = [['start']];
  
  for (let L = 1; L <= depth - 2; L++) {
    // Determine how many nodes in this layer (2 or 3)
    const numNodes = Math.floor(Math.random() * 2) + 2; 
    const layerNodeIds: string[] = [];
    
    for (let i = 0; i < numNodes; i++) {
      const nodeId = `node_${L}_${i}`;
      
      // Select type using weighted weights
      // room: 40%, treasure: 20%, event: 15%, puzzle: 10%, merchant: 10%, campsite: 5%
      // (Elite is placed dynamically or has 5%)
      const rand = Math.random() * 100;
      let type: DungeonNode['type'] = 'room';
      let name = '🚪 Regular Room';
      
      if (rand < 40) {
        type = 'room';
        name = '🚪 Regular Room';
      } else if (rand < 60) {
        type = 'treasure';
        name = '🪙 Treasure Chamber';
      } else if (rand < 75) {
        type = 'event';
        name = '✨ Random Event';
      } else if (rand < 85) {
        type = 'puzzle';
        name = '🧩 Ancient Puzzle';
      } else if (rand < 95) {
        type = 'merchant';
        name = '🏪 Dungeon Merchant';
      } else {
        type = 'campsite';
        name = '🏕️ Campsite';
      }
      
      // Override some to elite if L is deep enough and rolls a check
      if (type === 'room' && L >= Math.floor(depth / 2) && Math.random() < 0.25) {
        type = 'elite';
        name = '⚔️ Elite Encounter';
      }
      
      // Populate encounter data
      let encounterData: any = {};
      if (type === 'room') {
        encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'normal') };
      } else if (type === 'elite') {
        encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'rare') };
      } else if (type === 'boss') {
        encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'boss') };
      } else if (type === 'puzzle') {
        const riddleIdx = Math.floor(Math.random() * RIDDLES.length);
        encounterData = { riddle: RIDDLES[riddleIdx] };
      } else if (type === 'event') {
        const eventIdx = Math.floor(Math.random() * EVENTS.length);
        encounterData = { event: EVENTS[eventIdx] };
      } else if (type === 'merchant') {
        // Preset stock list
        encounterData = {
          shopItems: [
            { id: 'potion_health_small', price: 20 },
            { id: 'potion_health_medium', price: 50 },
            { id: 'potion_mana_small', price: 20 },
            { id: 'potion_mana_medium', price: 50 },
            { id: 'potion_stamina_small', price: 100 },
            { id: 'potion_stamina_medium', price: 180 }
          ]
        };
      }
      
      const node: DungeonNode = {
        id: nodeId,
        name,
        type,
        status: 'hidden',
        connections: [],
        encounterData,
        layer: L
      };
      
      nodes[nodeId] = node;
      layerNodeIds.push(nodeId);
    }
    
    layers.push(layerNodeIds);
  }
  
  // 3. Create Boss Node (Layer depth - 1)
  const bossNodeId = 'boss';
  const bossNode: DungeonNode = {
    id: bossNodeId,
    name: '☠️ Boss Chamber',
    type: 'boss',
    status: 'hidden',
    connections: [],
    encounterData: { enemyId: getRandomEnemyForZone(zoneId, 'boss') },
    layer: depth - 1
  };
  nodes[bossNodeId] = bossNode;
  layers.push([bossNodeId]);
  
  // 4. Connect Layers
  for (let L = 0; L < layers.length - 1; L++) {
    const currentLayer = layers[L];
    const nextLayer = layers[L + 1];
    
    // Connect each node in current layer to at least one node in next layer
    for (const currId of currentLayer) {
      const nextId = nextLayer[Math.floor(Math.random() * nextLayer.length)];
      nodes[currId].connections.push(nextId);
    }
    
    // Ensure every node in next layer has at least one incoming connection
    for (const nextId of nextLayer) {
      const incoming = currentLayer.filter(currId => nodes[currId].connections.includes(nextId));
      if (incoming.length === 0) {
        const randomCurrId = currentLayer[Math.floor(Math.random() * currentLayer.length)];
        nodes[randomCurrId].connections.push(nextId);
      }
    }
    
    // Add some random extra connections for branching paths (30% chance)
    if (nextLayer.length > 1) {
      for (const currId of currentLayer) {
        if (Math.random() < 0.3) {
          const unusedNext = nextLayer.filter(nextId => !nodes[currId].connections.includes(nextId));
          if (unusedNext.length > 0) {
            const extraNextId = unusedNext[Math.floor(Math.random() * unusedNext.length)];
            nodes[currId].connections.push(extraNextId);
          }
        }
      }
    }
  }
  
  // 5. Initial Fog of War Reveal
  // start is visited, reveal all nodes connected from start
  nodes['start'].status = 'visited';
  for (const connId of nodes['start'].connections) {
    if (nodes[connId]) {
      nodes[connId].status = 'revealed';
    }
  }
  
  return {
    zoneId,
    name: zoneName,
    layersCount: depth,
    nodes,
    startNodeId: 'start',
    bossNodeId: 'boss'
  };
}

/**
 * Recomputes node statuses based on visited nodes.
 * Used when players move to a new node.
 */
export function updateFogOfWar(nodes: Record<string, DungeonNode>, currentNodeId: string): Record<string, DungeonNode> {
  // Mark current node as visited
  nodes[currentNodeId].status = 'visited';
  
  // Collect all visited nodes
  const visitedIds = Object.keys(nodes).filter(id => nodes[id].status === 'visited' || nodes[id].status === 'cleared');
  
  // Reveal all nodes connected to visited nodes that are not visited themselves
  for (const id of Object.keys(nodes)) {
    if (nodes[id].status !== 'visited' && nodes[id].status !== 'cleared') {
      const hasVisitedPredecessor = visitedIds.some(vId => nodes[vId].connections.includes(id));
      if (hasVisitedPredecessor) {
        nodes[id].status = 'revealed';
      } else {
        nodes[id].status = 'hidden';
      }
    }
  }
  
  return nodes;
}
