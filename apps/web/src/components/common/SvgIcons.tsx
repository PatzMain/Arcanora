import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const HpHeartIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-red-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

export const ManaOrbIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-cyan-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" fill="currentColor" fillOpacity="0.25" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const StaminaBoltIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const ExpStarIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-emerald-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const GoldCoinIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-yellow-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <circle cx="12" cy="12" r="10" fill="#EAB308" />
    <circle cx="12" cy="12" r="8" fill="#FACC15" />
    <circle cx="12" cy="12" r="6" fill="#CA8A04" />
    <text x="12" y="16" fontSize="11" fontWeight="bold" textAnchor="middle" fill="#713F12" fontFamily="serif">G</text>
  </svg>
);

export const GemIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-fuchsia-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M6 3h12l4 6-10 12L2 9l4-6z" />
  </svg>
);

// ─── Elements ─────────────────────────────────────────────────────────

export const ElementFireIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-orange-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2c-.5 2.5-3.5 4.5-3.5 8 0 2.5 1.5 4.5 3.5 5 1-2.5 4-4 4-7.5 0-1.5-.5-3.5-1.5-4.5 3 2 4.5 5 4.5 8.5 0 4.7-3.8 8.5-8.5 8.5S2 17.7 2 13c0-4 3-7.5 7.5-9.8.5 1.2 1.3 2.1 2.5 2.8V2z" />
  </svg>
);

export const ElementFrostIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-cyan-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={className}>
    <line x1="12" y1="2" x2="12" y2="22" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
    <line x1="19.07" y1="4.93" x2="4.93" y2="19.07" />
  </svg>
);

export const ElementLightningIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export const ElementHolyIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-yellow-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="5" fill="currentColor" fillOpacity="0.4" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

export const ElementVoidIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-purple-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="9" strokeDasharray="4 2" />
    <path d="M12 3a9 9 0 0 0 0 18v-9z" fill="currentColor" fillOpacity="0.6" />
  </svg>
);

export const ElementPhysicalIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-slate-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" />
    <line x1="19" y1="21" x2="21" y2="19" />
  </svg>
);

// ─── Equipment & Items ────────────────────────────────────────────────

export const WeaponSwordIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-slate-200', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <line x1="16" y1="16" x2="20" y2="20" />
    <line x1="19" y1="21" x2="21" y2="19" />
  </svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-blue-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
  </svg>
);

export const HelmetIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-indigo-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 14V9a8 8 0 0 1 16 0v5M4 14h16M4 14l2 5h12l2-5" />
    <line x1="9" y1="14" x2="9" y2="19" />
    <line x1="15" y1="14" x2="15" y2="19" />
  </svg>
);

export const ArmorPlateIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-slate-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 4h12l2 4-3 12H7L4 8l2-4z" />
    <path d="M9 4v6m6-6v6M9 10h6" />
  </svg>
);

export const BootsIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-600', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 3v11l-3 4v3h15v-3l-2-4V3H6z" />
  </svg>
);

export const AccessoryRingIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="14" r="7" />
    <polygon points="12 2 15 5 12 8 9 5 12 2" fill="currentColor" />
  </svg>
);

export const PotionRedIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-red-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 3h6M10 3v3l-4 7v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6l-4-7V3" />
    <path d="M8 14h8" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

export const PotionBlueIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-cyan-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 3h6M10 3v3l-4 7v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6l-4-7V3" />
    <path d="M8 14h8" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

export const PotionGreenIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-emerald-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M9 3h6M10 3v3l-4 7v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6l-4-7V3" />
    <path d="M8 14h8" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

// ─── Dungeon & World Map ──────────────────────────────────────────────

export const CampsiteFireIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-orange-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 21l16-4M4 17l16 4" stroke="#78350F" strokeWidth="3" />
    <path d="M12 3c-1 3-4 6-4 9a4 4 0 0 0 8 0c0-3-3-6-4-9z" fill="#F97316" />
    <path d="M12 7c-.5 2-2 4-2 6a2 2 0 0 0 4 0c0-2-1.5-4-2-6z" fill="#FDE047" />
  </svg>
);

export const TreasureChestIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="7" width="20" height="14" rx="2" fill="#B45309" fillOpacity="0.3" stroke="#F59E0B" />
    <path d="M2 12h20M12 10v4" stroke="#FBBF24" strokeWidth="2.5" />
    <circle cx="12" cy="13" r="1.5" fill="#FEF08A" />
  </svg>
);

export const StairsDownIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-slate-300', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="20 4 15 4 15 9 10 9 10 14 5 14 5 19 2 19" />
  </svg>
);

export const MerchantIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-emerald-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

export const BossSkullIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-red-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 2a9 9 0 0 0-9 9c0 3.87 2.34 7.18 5.7 8.42V21a1 1 0 0 0 1 1h4.6a1 1 0 0 0 1-1v-1.58C18.66 18.18 21 14.87 21 11a9 9 0 0 0-9-9zm-3.5 11a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm7 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </svg>
);

export const SwordsCrossedIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-rose-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
    <line x1="13" y1="19" x2="19" y2="13" />
    <polyline points="9.5 17.5 21 6 21 3 18 3 6.5 14.5" />
    <line x1="11" y1="19" x2="5" y2="13" />
  </svg>
);

export const CompassIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" fillOpacity="0.4" />
  </svg>
);

export const BackpackIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-amber-500', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="4" y="6" width="16" height="15" rx="3" fill="currentColor" fillOpacity="0.2" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="4" y1="11" x2="20" y2="11" />
  </svg>
);

export const WrenchDevIcon: React.FC<IconProps> = ({ className = 'w-5 h-5 text-cyan-400', size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
