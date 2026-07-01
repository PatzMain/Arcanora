import { zonesCatalog, enemiesCatalog } from '../../utils/catalog.js';

export interface DungeonNode {
  id: string; // "x_y" format
  name: string;
  type: 'campsite' | 'treasure' | 'merchant' | 'event' | 'elite' | 'boss' | 'room' | 'wall' | 'stairs';
  status: 'hidden' | 'revealed' | 'visited' | 'cleared';
  connections: string[];
  encounterData?: any;
  layer: number; // Keep field for compatibility
  x: number;
  y: number;
}

export interface DungeonMap {
  zoneId: string;
  name: string;
  layersCount: number; // Total floors
  nodes: Record<string, DungeonNode>;
  startNodeId: string;
  bossNodeId: string;
  width: number;
  height: number;
  playerX: number;
  playerY: number;
  floor: number;
}

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

// Helper to determine depth layers count for each zone (number of floors)
export function getDungeonDepth(zoneId: string): number {
  switch (zoneId) {
    case 'forgotten_ironmine': return 5;
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
  
  const candidates = enemiesCatalog.filter(e => {
    return zoneEnemies.includes(e.id) && e.rarity === rarity;
  });
  
  if (candidates.length > 0) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx].id;
  }
  
  if (zoneEnemies.length > 0) {
    const fallbackId = zoneEnemies[Math.floor(Math.random() * zoneEnemies.length)];
    return fallbackId;
  }
  
  switch (rarity) {
    case 'boss': return 'crystal_colossus';
    case 'rare': return 'gem_serpent';
    default: return 'crystal_golem';
  }
}

/**
 * Generate a procedural, grid-based dungeon map.
 */
export function generateDungeonMap(zoneId: string, playerLevel: number, floor: number = 1): DungeonMap {
  const zone = zonesCatalog.find(z => z.id === zoneId);
  const zoneName = zone ? zone.name : 'Unknown Dungeon';
  const depth = getDungeonDepth(zoneId);
  
  const width = 6;
  const height = 6;
  const nodes: Record<string, DungeonNode> = {};
  
  // 1. Initialize all cells as walls
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = `${x}_${y}`;
      nodes[id] = {
        id,
        name: '🪨 Wall',
        type: 'wall',
        status: 'hidden',
        connections: [],
        layer: 0,
        x,
        y
      };
    }
  }
  
  // 2. Select starting position on the left edge (x = 0)
  const startX = 0;
  const startY = Math.floor(Math.random() * height);
  const startId = `${startX}_${startY}`;
  
  // 3. Select exit position on the right edge (x = 5)
  const exitX = width - 1;
  const exitY = Math.floor(Math.random() * height);
  const exitId = `${exitX}_${exitY}`;
  
  // 4. Generate main path from start to exit using random walk
  let curX = startX;
  let curY = startY;
  const pathCells = new Set<string>();
  pathCells.add(startId);
  
  while (curX !== exitX || curY !== exitY) {
    const candidates: [number, number][] = [];
    
    // Prioritize moving right, but allow vertical steps
    if (curX < exitX) candidates.push([curX + 1, curY]);
    if (curY < exitY) candidates.push([curX, curY + 1]);
    if (curY > exitY) candidates.push([curX, curY - 1]);
    
    // Add some random variation occasionally
    if (candidates.length === 0 || Math.random() < 0.25) {
      if (curX > 0) candidates.push([curX - 1, curY]);
      if (curY < height - 1) candidates.push([curX, curY + 1]);
      if (curY > 0) candidates.push([curX, curY - 1]);
    }
    
    const valid = candidates.filter(([nx, ny]) => nx >= 0 && nx < width && ny >= 0 && ny < height);
    if (valid.length === 0) break;
    
    const chosen = valid[Math.floor(Math.random() * valid.length)];
    if (!chosen) break;
    const [nextX, nextY] = chosen;
    const nextId = `${nextX}_${nextY}`;
    pathCells.add(nextId);
    curX = nextX;
    curY = nextY;
  }
  
  // 5. Generate branch paths/dead ends
  const mainCells = Array.from(pathCells);
  const numBranches = 4;
  for (let b = 0; b < numBranches; b++) {
    const randomSourceId = mainCells[Math.floor(Math.random() * mainCells.length)];
    if (!randomSourceId) continue;
    const sourceNode = nodes[randomSourceId];
    if (!sourceNode) continue;
    
    let bx = sourceNode.x;
    let by = sourceNode.y;
    const steps = Math.floor(Math.random() * 2) + 1; // 1-2 steps
    
    for (let s = 0; s < steps; s++) {
      const dirs: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      if (!dir) continue;
      const [dx, dy] = dir;
      const nx = bx + dx;
      const ny = by + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const branchId = `${nx}_${ny}`;
        pathCells.add(branchId);
        bx = nx;
        by = ny;
      }
    }
  }
  
  // 6. Populate cells with room types
  const isLastFloor = floor >= depth;
  const exitType = isLastFloor ? 'boss' : 'stairs';
  const exitName = isLastFloor ? '☠️ Boss Chamber' : '🪜 Stairs Down';
  
  for (const cellId of pathCells) {
    const node = nodes[cellId]!;
    
    if (cellId === startId) {
      node.name = '🏕️ Dungeon Entrance';
      node.type = 'campsite';
      node.status = 'visited';
      continue;
    }
    
    if (cellId === exitId) {
      node.name = exitName;
      node.type = exitType;
      node.status = 'hidden';
      if (exitType === 'boss') {
        node.encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'boss') };
      }
      continue;
    }
    
    // Choose room content with weights
    const roll = Math.random() * 100;
    if (roll < 45) {
      node.type = 'room';
      node.name = '🚪 Regular Room';
      node.encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'normal') };
    } else if (roll < 55) {
      node.type = 'room';
      node.name = '💨 Empty Chamber';
      node.status = 'cleared';
    } else if (roll < 70) {
      node.type = 'treasure';
      node.name = '🎁 Treasure Chamber';
    } else if (roll < 80) {
      node.type = 'event';
      node.name = '✨ Random Event';
      const eventIdx = Math.floor(Math.random() * EVENTS.length);
      node.encounterData = { event: EVENTS[eventIdx] };
    } else if (roll < 88) {
      node.type = 'merchant';
      node.name = '🏪 Dungeon Merchant';
      node.encounterData = {
        shopItems: [
          { id: 'potion_health_small', price: 20 },
          { id: 'potion_health_medium', price: 50 },
          { id: 'potion_mana_small', price: 20 },
          { id: 'potion_mana_medium', price: 50 },
          { id: 'potion_stamina_small', price: 100 },
          { id: 'potion_stamina_medium', price: 180 }
        ]
      };
    } else if (roll < 94) {
      node.type = 'campsite';
      node.name = '🏕️ Campsite';
    } else {
      node.type = 'elite';
      node.name = '⚔️ Elite Encounter';
      node.encounterData = { enemyId: getRandomEnemyForZone(zoneId, 'rare') };
    }
  }
  
  // 7. Establish connections (adjacent coordinate IDs)
  for (const cellId of pathCells) {
    const node = nodes[cellId]!;
    const adjacents = [
      { x: node.x, y: node.y - 1 }, // Up
      { x: node.x, y: node.y + 1 }, // Down
      { x: node.x - 1, y: node.y }, // Left
      { x: node.x + 1, y: node.y }  // Right
    ];
    
    for (const adj of adjacents) {
      const adjId = `${adj.x}_${adj.y}`;
      if (nodes[adjId] && nodes[adjId].type !== 'wall') {
        node.connections.push(adjId);
      }
    }
  }
  
  // 8. Initial Fog of War Reveal
  nodes[startId]!.status = 'visited';
  for (const connId of nodes[startId]!.connections) {
    if (nodes[connId]) {
      nodes[connId]!.status = 'revealed';
    }
  }
  
  return {
    zoneId,
    name: zoneName,
    layersCount: depth,
    nodes,
    startNodeId: startId,
    bossNodeId: exitId,
    width,
    height,
    playerX: startX,
    playerY: startY,
    floor
  };
}

/**
 * Recomputes node statuses based on visited nodes.
 */
export function updateFogOfWar(nodes: Record<string, DungeonNode>, currentNodeId: string): Record<string, DungeonNode> {
  if (nodes[currentNodeId] && nodes[currentNodeId]!.status !== 'cleared') {
    nodes[currentNodeId]!.status = 'visited';
  }
  
  const visitedIds = Object.keys(nodes).filter(id => nodes[id]?.status === 'visited' || nodes[id]?.status === 'cleared');
  
  for (const id of Object.keys(nodes)) {
    const node = nodes[id]!;
    if (node.status !== 'visited' && node.status !== 'cleared') {
      const hasVisitedPredecessor = visitedIds.some(vId => nodes[vId]?.connections.includes(id));
      if (hasVisitedPredecessor) {
        node.status = 'revealed';
      } else {
        node.status = 'hidden';
      }
    }
  }
  
  return nodes;
}
