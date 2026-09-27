import React from 'react';

export type RarityLevel = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

interface RarityBadgeProps {
  rarity: string;
  size?: 'sm' | 'md';
}

export const RARITY_CONFIG: Record<RarityLevel, { label: string; text: string; bg: string; border: string; glow: string }> = {
  common: {
    label: 'Common',
    text: 'text-slate-400',
    bg: 'bg-slate-800/40',
    border: 'border-slate-600/40',
    glow: 'rarity-glow-common'
  },
  uncommon: {
    label: 'Uncommon',
    text: 'text-emerald-400',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-600/40',
    glow: 'rarity-glow-uncommon'
  },
  rare: {
    label: 'Rare',
    text: 'text-blue-400',
    bg: 'bg-blue-950/40',
    border: 'border-blue-600/40',
    glow: 'rarity-glow-rare'
  },
  epic: {
    label: 'Epic',
    text: 'text-purple-400',
    bg: 'bg-purple-950/40',
    border: 'border-purple-600/40',
    glow: 'rarity-glow-epic'
  },
  legendary: {
    label: 'Legendary',
    text: 'text-amber-400',
    bg: 'bg-amber-950/40',
    border: 'border-amber-600/40',
    glow: 'rarity-glow-legendary'
  },
  mythic: {
    label: '✦ Mythic',
    text: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-600/40',
    glow: 'rarity-glow-mythic'
  }
};

export const RarityBadge: React.FC<RarityBadgeProps> = ({ rarity, size = 'sm' }) => {
  const norm = (rarity?.toLowerCase() || 'common') as RarityLevel;
  const config = RARITY_CONFIG[norm] || RARITY_CONFIG.common;

  return (
    <span
      className={`inline-flex items-center font-fantasy uppercase tracking-wider rounded border font-semibold ${
        size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'
      } ${config.text} ${config.bg} ${config.border}`}
    >
      「{config.label}」
    </span>
  );
};
