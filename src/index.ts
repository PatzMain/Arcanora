import { Client, GatewayIntentBits } from 'discord.js';
import { logger } from './utils/logger.js';
import { pool } from './database/client.js';
import * as readyEvent from './events/ready.js';
import * as interactionCreateEvent from './events/interactionCreate.js';
import * as errorEvent from './events/error.js';
import 'dotenv/config';

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
});

// Bind Event Handlers
client.once('ready', () => readyEvent.execute(client));
client.on('interactionCreate', (interaction) => interactionCreateEvent.execute(interaction));
errorEvent.execute(client);

// Graceful Shutdown Handler
function shutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  client.destroy();
  pool.end(() => {
    logger.info('Database connections closed. Exit complete.');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection at Promise');
});

process.on('uncaughtException', (error) => {
  logger.error({ error }, 'Uncaught Exception thrown');
});

// Start application
async function start() {
  try {
    if (!process.env.DISCORD_TOKEN) {
      throw new Error('DISCORD_TOKEN environment variable is missing.');
    }
    await client.login(process.env.DISCORD_TOKEN);
  } catch (error) {
    logger.error({ error }, 'Fatal error during client startup');
    process.exit(1);
  }
}

start();
