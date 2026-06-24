import { type Client } from 'discord.js';
import { logger } from '../utils/logger.js';

export function execute(client: Client) {
  client.on('error', (error) => {
    logger.error({ error }, 'Discord client encountered an error');
  });

  client.on('warn', (info) => {
    logger.warn({ warning: info }, 'Discord client warning');
  });
}
