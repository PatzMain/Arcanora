import { EmbedBuilder } from 'discord.js';
import { Registry } from '../../utils/registry.js';
import { type DungeonNode } from './dungeonGenerator.js';
import { campsiteHandler } from './dungeonHandlers/campsite.js';
import { treasureHandler } from './dungeonHandlers/treasure.js';
import { merchantHandler } from './dungeonHandlers/merchant.js';
import { eventHandler } from './dungeonHandlers/event.js';
import { combatNodeHandler } from './dungeonHandlers/combat.js';

export interface NodeContext {
  playerId: string;
  discordId: string;
  node: DungeonNode;
  dbSession: any; // exploration_sessions table row
}

export interface NodeEnterResult {
  embeds: EmbedBuilder[];
  components: any[];
  log?: string;
}

export interface NodeActionResult {
  embeds: EmbedBuilder[];
  components: any[];
  success: boolean;
  log?: string;
  updatedPlayer?: any;
}

export interface NodeInteractionHandler {
  onEnter(context: NodeContext): Promise<NodeEnterResult>;
  onAction(action: string, context: NodeContext, extraData?: any): Promise<NodeActionResult>;
}

export const dungeonNodeRegistry = new Registry<NodeInteractionHandler>();

// Register handlers
dungeonNodeRegistry.register('campsite', campsiteHandler);
dungeonNodeRegistry.register('treasure', treasureHandler);
dungeonNodeRegistry.register('merchant', merchantHandler);
dungeonNodeRegistry.register('event', eventHandler);
dungeonNodeRegistry.register('room', combatNodeHandler);
dungeonNodeRegistry.register('elite', combatNodeHandler);
dungeonNodeRegistry.register('boss', combatNodeHandler);
