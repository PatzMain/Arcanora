import React from 'react';

interface VitalBarProps {
  label: string;
  current: number;
  max: number;
  color: 'hp' | 'mana' | 'stamina' | 'exp';
  icon: React.ReactNode;
  showNumbers?: boolean;
}

export const VitalBar: React.FC<VitalBarProps> = ({
  label,
  current,
  max,
  color,
  icon,
  showNumbers = true
}) => {
  const percent = Math.min(100, Math.max(0, (current / (max || 1)) * 100));

  const colorStyles = {
    hp: {
      bar: 'from-red-600 via-rose-500 to-red-400',
      glow: 'shadow-[0_0_12px_rgba(239,68,68,0.5)]',
      border: 'border-red-900/60'
    },
    mana: {
      bar: 'from-blue-600 via-cyan-500 to-sky-400',
      glow: 'shadow-[0_0_12px_rgba(6,182,212,0.5)]',
      border: 'border-cyan-900/60'
    },
    stamina: {
      bar: 'from-amber-600 via-yellow-500 to-amber-300',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.5)]',
      border: 'border-amber-900/60'
    },
    exp: {
      bar: 'from-emerald-600 via-green-500 to-teal-400',
      glow: 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
      border: 'border-emerald-900/60'
    }
  }[color];

  return (
    <div className="flex flex-col gap-1 w-full min-w-[130px]">
      <div className="flex items-center justify-between text-xs px-0.5">
        <div className="flex items-center gap-1.5 font-medium tracking-wide">
          <span className="shrink-0">{icon}</span>
          <span className="font-fantasy font-semibold uppercase tracking-wider text-[11px] text-slate-300">
            {label}
          </span>
        </div>
        {showNumbers && (
          <span className="font-mono text-[11px] text-slate-400 font-semibold">
            {current} <span className="text-slate-600">/</span> {max}
          </span>
        )}
      </div>

      {/* Progress Track */}
      <div className={`relative h-3.5 bg-obsidian-950 rounded-full border ${colorStyles.border} overflow-hidden p-0.5 shadow-inner`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${colorStyles.bar} ${colorStyles.glow} transition-all duration-300 ease-out`}
          style={{ width: `${percent}%` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none rounded-full" />
      </div>
    </div>
  );
};
