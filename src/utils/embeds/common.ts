import { EmbedBuilder } from 'discord.js';
import { baseEmbed, COLORS, capitalize } from './base.js';

export function errorEmbed(title: string, description: string, errorObj?: any): EmbedBuilder {
  let finalDesc = description;
  if (errorObj) {
    const errorMsg = errorObj.stack || errorObj.message || String(errorObj);
    finalDesc += `\n\n**Copyable Error Details:**\n\`\`\`\n${errorMsg}\n\`\`\``;
  }
  return baseEmbed()
    .setColor(COLORS.DANGER)
    .setTitle(`❌ ${title}`)
    .setDescription(finalDesc);
}

export function successEmbed(title: string, description: string): EmbedBuilder {
  return baseEmbed()
    .setColor(COLORS.SUCCESS)
    .setTitle(`✅ ${title}`)
    .setDescription(description);
}

export function cooldownEmbed(action: string, remainingSeconds: number): EmbedBuilder {
  const rounded = Math.ceil(remainingSeconds);
  return baseEmbed()
    .setColor(COLORS.WARNING)
    .setTitle('⏳ Cooldown Active')
    .setDescription(
      `**${capitalize(action)}** is on cooldown.\n` +
      `Please wait **${rounded}s** before trying again.`,
    );
}
