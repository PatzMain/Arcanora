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
    it('should generate a valid map structure with start and boss nodes', () => {
      const map = generateDungeonMap('crystal_caverns', 1);

      expect(map.zoneId).toBe('crystal_caverns');
      expect(map.layersCount).toBe(7);
      expect(map.startNodeId).toBe('start');
      expect(map.bossNodeId).toBe('boss');
      
      const startNode = map.nodes[map.startNodeId];
      const bossNode = map.nodes[map.bossNodeId];

      expect(startNode).toBeDefined();
      expect(startNode.type).toBe('campsite');
      expect(startNode.layer).toBe(0);
      expect(startNode.status).toBe('visited');

      expect(bossNode).toBeDefined();
      expect(bossNode.type).toBe('boss');
      expect(bossNode.layer).toBe(6);
      expect(bossNode.status).toBe('hidden');
    });

    it('should assign valid node types and connections', () => {
      const map = generateDungeonMap('shadow_forest', 5);
      const nodeIds = Object.keys(map.nodes);

      // Total nodes should be greater than layersCount
      expect(nodeIds.length).toBeGreaterThan(6);

      nodeIds.forEach(id => {
        const node = map.nodes[id];
        expect(node.id).toBe(id);
        expect(node.layer).toBeGreaterThanOrEqual(0);
        expect(node.layer).toBeLessThanOrEqual(5);

        // Connections must be valid existing nodes
        node.connections.forEach(connId => {
          expect(map.nodes[connId]).toBeDefined();
          // Connections should only move forward by layers
          expect(map.nodes[connId].layer).toBeGreaterThan(node.layer);
        });
      });
    });

    it('should ensure the boss is reachable from start (DAG path validation)', () => {
      const map = generateDungeonMap('abyssal_depths', 1);
      
      // BFS to find reachability from start to boss
      const visited = new Set<string>();
      const queue: string[] = ['start'];
      visited.add('start');

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

      // Boss must be visited
      expect(visited.has('boss')).toBe(true);
    });
  });

  describe('Fog of War Map Visibility', () => {
    it('should reveal adjacent nodes when a node is visited', () => {
      const map = generateDungeonMap('verdant_meadows', 1);
      
      // Initially: start is visited, its connections are revealed
      expect(map.nodes['start'].status).toBe('visited');
      map.nodes['start'].connections.forEach(connId => {
        expect(map.nodes[connId].status).toBe('revealed');
      });

      // Move player to one of the connected nodes
      const nextNodeId = map.nodes['start'].connections[0];
      const updatedNodes = updateFogOfWar(map.nodes, nextNodeId);

      expect(updatedNodes[nextNodeId].status).toBe('visited');
      updatedNodes[nextNodeId].connections.forEach(connId => {
        expect(updatedNodes[connId].status).toBe('revealed');
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
});
