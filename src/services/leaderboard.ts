import type { LeaderboardEntry } from '../types/game';

const LOCAL_FALLBACK_KEY = 'turek_global_leaderboard_cache_v3';
const LEGACY_CACHE_KEYS = [
  'turek_global_leaderboard_cache_v1',
  'turek_global_leaderboard_cache_v2',
];
const PLAYER_NAME_KEY = 'turek_player_name_v1';
const BEST_SCORE_KEY = 'turek_best_local_score_v1';
const MUTED_KEY = 'turek_audio_muted_v1';

// Clean up any pre-reset cached leaderboard entries in browser storage
try {
  if (typeof localStorage !== 'undefined') {
    for (const key of LEGACY_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
  }
} catch {
  // Ignore storage errors
}

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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      throw new Error('API unavailable');
    }
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
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Static host');
    }
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
    // Graceful local persistence fallback on static hosts (GitHub Pages) or offline mode
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

export async function resetGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  writeLocalCache([]);
  try {
    await fetch('/api/leaderboard', { method: 'DELETE' });
  } catch {
    // Offline or static host — local cache already cleared
  }
  return [];
}
