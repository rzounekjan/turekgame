import React from 'react';
import { RefreshCw, Trophy, X } from 'lucide-react';
import type { LeaderboardEntry } from '../types/game';

interface LeaderboardModalProps {
  open: boolean;
  entries: LeaderboardEntry[];
  loading: boolean;
  highlightId?: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

const MIN_VISIBLE_SLOTS = 10;

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  open,
  entries,
  loading,
  highlightId,
  onClose,
  onRefresh,
}) => {
  if (!open) return null;

  const slotCount = Math.max(MIN_VISIBLE_SLOTS, entries.length);
  const slots: Array<LeaderboardEntry | null> = Array.from(
    { length: slotCount },
    (_, i) => entries[i] ?? null,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#040710]/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Globální žebříček nejlepších skóre"
    >
      <div className="w-full max-w-lg rounded-xl border border-cyan-400/25 bg-[#0b1120] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Trophy className="h-5 w-5 text-amber-400 shrink-0" />
            <h2 className="font-display text-lg font-bold tracking-wide text-white truncate">
              Globální žebříček TUREK
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition-colors hover:border-cyan-400/45 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer disabled:opacity-50"
              aria-label="Obnovit žebříček"
              title="Obnovit"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 transition-colors hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
              aria-label="Zavřít žebříček"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-400">
                <th className="py-2.5 pr-2 font-medium w-12">#</th>
                <th className="py-2.5 px-2 font-medium">Hráč</th>
                <th className="py-2.5 px-2 font-medium text-center">Úroveň</th>
                <th className="py-2.5 px-2 font-medium text-center">Sanitky</th>
                <th className="py-2.5 pl-2 font-medium text-right">Skóre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {slots.map((item, idx) => {
                const rank = idx + 1;
                const rankColor =
                  rank === 1
                    ? 'text-amber-300 font-bold'
                    : rank === 2
                      ? 'text-slate-200 font-bold'
                      : rank === 3
                        ? 'text-orange-300 font-bold'
                        : 'text-slate-400';

                if (!item) {
                  return (
                    <tr key={`empty-${rank}`} className="text-slate-500">
                      <td className={`py-2.5 pr-2 font-mono-num ${rankColor}`}>
                        {rank}.
                      </td>
                      <td className="py-2.5 px-2 font-mono-num tracking-widest">...</td>
                      <td className="py-2.5 px-2 text-center font-mono-num">...</td>
                      <td className="py-2.5 px-2 text-center font-mono-num">...</td>
                      <td className="py-2.5 pl-2 text-right font-mono-num">...</td>
                    </tr>
                  );
                }

                const isHighlighted = highlightId != null && item.id === highlightId;

                return (
                  <tr
                    key={item.id}
                    className={
                      isHighlighted
                        ? 'bg-cyan-500/15 text-white'
                        : 'text-slate-200 hover:bg-white/[0.03]'
                    }
                  >
                    <td className={`py-2.5 pr-2 font-mono-num ${rankColor}`}>
                      {rank}.
                    </td>
                    <td className="py-2.5 px-2 font-medium truncate max-w-[150px]">
                      {item.playerName}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono-num text-slate-300">
                      {item.level}/5
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono-num text-amber-300">
                      {item.ambulancesHit}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-mono-num font-bold text-cyan-300">
                      {item.score}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs text-slate-400">
          <span>Globální živý žebříček · Top 20</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
