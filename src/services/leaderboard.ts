import type { LeaderboardEntry } from '../types/game';

const LOCAL_FALLBACK_KEY = 'turek_global_leaderboard_cache_v1';
const PLAYER_NAME_KEY = 'turek_player_name_v1';
const BEST_SCORE_KEY = 'turek_best_local_score_v1';
const MUTED_KEY = 'turek_audio_muted_v1';

const FALLBACK_ENTRIES: LeaderboardEntry[] = [
  { id: 'f1', playerName: 'MAREK_GT', score: 168, level: 5, ambulancesHit: 9, createdAt: '2026-11-20T18:40:00.000Z' },
  { id: 'f2', playerName: 'TERKA_CZ', score: 134, level: 5, ambulancesHit: 7, createdAt: '2026-11-21T14:15:00.000Z' },
  { id: 'f3', playerName: 'KUBA_99', score: 102, level: 4, ambulancesHit: 6, createdAt: '2026-11-22T20:05:00.000Z' },
  { id: 'f4', playerName: 'DOMINIK', score: 84, level: 4, ambulancesHit: 4, createdAt: '2026-11-23T09:50:00.000Z' },
  { id: 'f5', playerName: 'ELISKA_V8', score: 63, level: 3, ambulancesHit: 3, createdAt: '2026-11-23T19:10:00.000Z' },
  { id: 'f6', playerName: 'PETR_X', score: 48, level: 3, ambulancesHit: 2, createdAt: '2026-11-24T11:22:00.000Z' },
  { id: 'f7', playerName: 'FILIP_PRO', score: 31, level: 2, ambulancesHit: 2, createdAt: '2026-11-24T16:45:00.000Z' },
  { id: 'f8', playerName: 'LUKAS', score: 19, level: 1, ambulancesHit: 1, createdAt: '2026-11-25T08:12:00.000Z' },
];

export function getSavedPlayerName(): string {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, 16));
  } catch {
    // Ignore storage quota errors
  }
}

export function getLocalBestScore(): number {
  try {
    const raw = Number(localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}

export function saveLocalBestScore(score: number): number {
  const prev = getLocalBestScore();
  const best = Math.max(prev, Math.floor(score));
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(best));
  } catch {
    // Ignore
  }
  return best;
}

export function getSavedMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTED_KEY, muted ? 'true' : 'false');
  } catch {
    // Ignore
  }
}

function readLocalCache(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_FALLBACK_KEY);
    if (!raw) return [...FALLBACK_ENTRIES];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...FALLBACK_ENTRIES];
  } catch {
    return [...FALLBACK_ENTRIES];
  }
}

function writeLocalCache(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LOCAL_FALLBACK_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch {
    // Ignore
  }
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch('/api/leaderboard', { cache: 'no-store' });
    if (!res.ok) throw new Error('API unavailable');
    const data = await res.json();
    if (Array.isArray(data.entries)) {
      writeLocalCache(data.entries);
      return data.entries as LeaderboardEntry[];
    }
    return readLocalCache();
  } catch {
    return readLocalCache();
  }
}

export async function submitGlobalScore(payload: {
  playerName: string;
  score: number;
  level: number;
  ambulancesHit: number;
}): Promise<{ entries: LeaderboardEntry[]; entry: LeaderboardEntry; rank: number }> {
  savePlayerName(payload.playerName);
  try {
    const res = await fetch('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Nepodařilo se uložit skóre.');
    }
    const data = await res.json();
    if (Array.isArray(data.entries)) {
      writeLocalCache(data.entries);
    }
    return {
      entries: data.entries as LeaderboardEntry[],
      entry: data.entry as LeaderboardEntry,
      rank: Number(data.rank ?? 1),
    };
  } catch {
    // Graceful local persistence fallback if offline
    const fallbackEntry: LeaderboardEntry = {
      id: `local-${Date.now()}`,
      playerName: payload.playerName.trim().slice(0, 16),
      score: Math.floor(payload.score),
      level: payload.level,
      ambulancesHit: payload.ambulancesHit,
      createdAt: new Date().toISOString(),
    };
    const merged = [...readLocalCache(), fallbackEntry]
      .sort((a, b) => b.score - a.score || b.ambulancesHit - a.ambulancesHit)
      .slice(0, 20);
    writeLocalCache(merged);
    const rank = merged.findIndex((e) => e.id === fallbackEntry.id) + 1;
    return { entries: merged, entry: fallbackEntry, rank: rank || 20 };
  }
}
