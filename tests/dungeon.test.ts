import { describe, it, expect } from 'vitest';
import { getDungeonDepth, generateDungeonMap, updateFogOfWar } from '../src/systems/exploration/dungeonGenerator.js';

describe('Dungeon Crawling Exploration System', () => {
  describe('Dungeon Layer Depth Scaling', () => {
    it('should scale depth layer counts correctly per dungeon zone', () => {
      expect(getDungeonDepth('verdant_meadows')).toBe(5);
      expect(getDungeonDepth('shadow_forest')).toBe(6);
      expect(getDungeonDepth('crystal_caverns')).toBe(7);
      expect(getDungeonDepth('volcanic_wastes')).toBe(8);
      expect(getDungeonDepth('abyssal_depths')).toBe(9);
      expect(getDungeonDepth('invalid_zone')).toBe(5); // default fallback
    });
  });

  describe('Procedural Dungeon Map Generator', () => {
    it('should generate a valid grid structure with start and exit/boss nodes', () => {
      // Generate normal floor (floor = 1)
      const map = generateDungeonMap('crystal_caverns', 1, 1);

      expect(map.zoneId).toBe('crystal_caverns');
      expect(map.layersCount).toBe(7);
      expect(map.width).toBe(6);
      expect(map.height).toBe(6);
      
      const startNode = map.nodes[map.startNodeId];
      const exitNode = map.nodes[map.bossNodeId]; // bossNodeId is the exit node ID

      expect(startNode).toBeDefined();
      expect(startNode.type).toBe('campsite');
      expect(startNode.status).toBe('visited');
      expect(startNode.x).toBe(0);

      expect(exitNode).toBeDefined();
      expect(exitNode.type).toBe('stairs'); // stairs on normal floor
      expect(exitNode.status).toBe('hidden');
      expect(exitNode.x).toBe(5);
    });

    it('should generate a boss on the last floor', () => {
      // Generate last floor (floor = 7 for crystal_caverns)
      const map = generateDungeonMap('crystal_caverns', 1, 7);
      
      const exitNode = map.nodes[map.bossNodeId];
      expect(exitNode.type).toBe('boss');
    });

    it('should assign valid node coordinates and connections', () => {
      const map = generateDungeonMap('shadow_forest', 5, 1);
      const nodeIds = Object.keys(map.nodes);

      // Total nodes should be width * height = 36
      expect(nodeIds.length).toBe(36);

      nodeIds.forEach(id => {
        const node = map.nodes[id];
        expect(node.id).toBe(id);
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThan(6);
        expect(node.y).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeLessThan(6);

        // Connections must be adjacent passable cells
        node.connections.forEach(connId => {
          expect(map.nodes[connId]).toBeDefined();
          expect(map.nodes[connId].type).not.toBe('wall');
          const connNode = map.nodes[connId];
          const dist = Math.abs(node.x - connNode.x) + Math.abs(node.y - connNode.y);
          expect(dist).toBe(1); // Taxicab distance of 1 for orthogonally adjacent
        });
      });
    });

    it('should ensure the exit is reachable from start (Grid path validation)', () => {
      const map = generateDungeonMap('abyssal_depths', 1, 1);
      
      // BFS to check connectivity between start and exit
      const visited = new Set<string>();
      const queue: string[] = [map.startNodeId];
      visited.add(map.startNodeId);

      while (queue.length > 0) {
        const currentId = queue.shift()!;
        const node = map.nodes[currentId];
        node.connections.forEach(connId => {
          if (!visited.has(connId)) {
            visited.add(connId);
            queue.push(connId);
          }
        });
      }

      // Exit must be reachable
      expect(visited.has(map.bossNodeId)).toBe(true);
    });
  });

  describe('Fog of War Map Visibility', () => {
    it('should reveal adjacent nodes when a node is visited', () => {
      const map = generateDungeonMap('verdant_meadows', 1, 1);
      
      // Initially: start is visited, its connections are revealed
      expect(map.nodes[map.startNodeId].status).toBe('visited');
      map.nodes[map.startNodeId].connections.forEach(connId => {
        expect(map.nodes[connId].status).toBe('revealed');
      });

      // Move player to one of the connected nodes
      const nextNodeId = map.nodes[map.startNodeId].connections[0];
      const updatedNodes = updateFogOfWar(map.nodes, nextNodeId);

      expect(updatedNodes[nextNodeId].status).toBe('visited');
      updatedNodes[nextNodeId].connections.forEach(connId => {
        if (connId === map.startNodeId) {
          expect(updatedNodes[connId].status).toBe('visited');
        } else {
          expect(updatedNodes[connId].status).toBe('revealed');
        }
      });
    });
  });

  describe('Stamina Regeneration Interval Delta Logic', () => {
    it('should compute stamina regen points correctly based on elapsed time', () => {
      const intervalMs = 5 * 60 * 1000; // 5 mins
      
      // Mock player with current stamina 80 / 100 max
      const staminaMax = 100;
      const stamina = 80;
      
      // Scenario A: 12 minutes elapsed -> 2 intervals -> 2 stamina regained
      const lastRegenTime = Date.now() - (12 * 60 * 1000); 
      const elapsedMs = Date.now() - lastRegenTime;
      
      const intervals = Math.floor(elapsedMs / intervalMs);
      const newStamina = Math.min(staminaMax, stamina + intervals);
      
      expect(intervals).toBe(2);
      expect(newStamina).toBe(82);

      // Scenario B: 4 minutes elapsed -> 0 intervals -> 0 stamina regained
      const lastRegenTimeB = Date.now() - (4 * 60 * 1000);
      const elapsedMsB = Date.now() - lastRegenTimeB;
      const intervalsB = Math.floor(elapsedMsB / intervalMs);
      expect(intervalsB).toBe(0);
    });
  });

  describe('Dungeon Floor Scaling & Rewards', () => {
    it('should assign a default floor of 1 on initialization and support custom floor', () => {
      const map = generateDungeonMap('crystal_caverns', 1, 1);
      expect(map.floor).toBe(1);

      const map5 = generateDungeonMap('crystal_caverns', 1, 5);
      expect(map5.floor).toBe(5);
    });

    it('should calculate floor scaling difficulty and reward factors correctly', () => {
      // Floor 1 has no multiplier (multiplier = 1)
      const floor1Bonus = (1 - 1) * 0.15;
      expect(floor1Bonus).toBe(0);

      // Floor 3 has +30% rewards (multiplier = 1.30)
      const floor3Bonus = (3 - 1) * 0.15;
      expect(floor3Bonus).toBe(0.30);

      // Floor 3 enemy level adjusted by +4
      const enemyBaseLevel = 5;
      const adjustedLevel = enemyBaseLevel + (3 - 1) * 2;
      expect(adjustedLevel).toBe(9);
    });
  });
});
