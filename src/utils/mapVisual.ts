import { capitalize } from './embeds/base.js';

export function renderWorldMap(playerZoneId: string, discoveredIds: string[]): string {
  const isDiscovered = (id: string) => discoveredIds.includes(id);

  const getLabel = (id: string, defaultName: string, emoji: string) => {
    if (!isDiscovered(id)) {
      return '⬛ ???';
    }
    const isPlayerHere = playerZoneId === id;
    const nameStr = `${emoji} ${defaultName}`;
    return isPlayerHere ? `**${nameStr}** 📍` : nameStr;
  };

  // Main Oakhaven hub
  const tavern = getLabel('cozy_tavern', 'Cozy Tavern', '🍻');
  const square = getLabel('oakhaven_square', 'Oakhaven Square', '🏘️');
  const docks = getLabel('river_docks', 'River Docks', '⛵');
  const forge = getLabel('oakhaven_forge', 'Oakhaven Forge', '🔨');
  const apothecary = getLabel('apothecary', 'Apothecary', '🧪');
  const sewers = getLabel('oakhaven_sewers', 'Oakhaven Sewers', '💀');

  // Wilderness & Dungeons
  const meadows = getLabel('glittering_meadows', 'Glittering Meadows', '🌿');
  const thicket = getLabel('birch_thicket', 'Birch Thicket', '🌲');
  const river = getLabel('silverbrook_river', 'Silverbrook River', '🌊');
  const cave = getLabel('shimmering_cave', 'Shimmering Cave', '🔷');
  const outpost = getLabel('goblin_outpost', 'Goblin Outpost', '⚔️');
  const ironmine = getLabel('forgotten_ironmine', 'Forgotten Ironmine', '⛏️');
  const ancientMine = getLabel('ancient_mine', 'Ancient Mine', '🏰');
  const forest = getLabel('shadow_forest', 'Shadow Forest', '🌑');
  const watchtower = getLabel('goblin_sanctuary', 'Fallen Watchtower', '🏰');
  const caverns = getLabel('crystal_caverns', 'Crystal Caverns', '🔮');
  const wastes = getLabel('volcanic_wastes', 'Volcanic Wastes', '🔥');
  const keep = getLabel('lava_keep', 'Lava Keep', '🏰');
  const depths = getLabel('abyssal_depths', 'Abyssal Depths', '🌊');
  const temple = getLabel('sunken_temple', 'Sunken Temple', '🏰');

  return [
    `**🏘️ Oakhaven Region**`,
    `  ├─ ${square}`,
    `  ├─ ${tavern}`,
    `  ├─ ${forge}  ·  ${apothecary}`,
    `  ├─ ${docks}  ·  ${sewers}`,
    `  │`,
    `  └─ ${meadows}`,
    `       ├─ ${thicket} ── ${outpost} ──┐`,
    `       └─ ${river} ── ${cave} ──┼─ ${ironmine}`,
    `                                        ├─ ${ancientMine}`,
    `                                        └─ ${forest}`,
    `                                             ├─ ${watchtower}`,
    `                                             └─ ${caverns}`,
    `                                                  └─ ${wastes} ── ${keep}`,
    `                                                       └─ ${depths} ── ${temple}`
  ].join('\n');
}
