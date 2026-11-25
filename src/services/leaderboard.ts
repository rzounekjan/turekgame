import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { LeaderboardEntry } from '../types/game';

const LEADERBOARD_COLLECTION = 'leaderboard';
const LEADERBOARD_LIMIT = 20;

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
const PLAYER_NAME_MIN_LEN = 2;
const PLAYER_NAME_MAX_LEN = 16;
const PLAYER_NAME_REGEX = /^[\p{L}\p{N}_\-.][\p{L}\p{N}_\-. ]{0,14}[\p{L}\p{N}_\-.]$/u;

const LOCAL_CACHE_KEY = 'turek_global_leaderboard_cache_v4';
const LEGACY_CACHE_KEYS = [
  'turek_global_leaderboard_cache_v1',
  'turek_global_leaderboard_cache_v2',
  'turek_global_leaderboard_cache_v3',
];
const PLAYER_NAME_KEY = 'turek_player_name_v1';
const BEST_SCORE_KEY = 'turek_best_local_score_v1';
const MUTED_KEY = 'turek_audio_muted_v1';

// Clean up any legacy pre-Firestore cached entries in browser storage
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
    localStorage.setItem(PLAYER_NAME_KEY, name.trim().slice(0, PLAYER_NAME_MAX_LEN));
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
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(entries: LeaderboardEntry[]): void {
  try {
    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(entries.slice(0, LEADERBOARD_LIMIT)));
  } catch {
    // Ignore
  }
}

function sanitizePlayerName(raw: string): string {
  return raw
    .trim()
    .replace(/[^\p{L}\p{N}_\-. ]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX_LEN);
}

function generateEntryId(): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `sc-${Date.now()}-${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function mapDocToEntry(snap: QueryDocumentSnapshot): LeaderboardEntry {
  const data = snap.data();
  const rawCreatedAt = data.createdAt;
  let createdAtIso = new Date().toISOString();
  if (rawCreatedAt instanceof Timestamp) {
    createdAtIso = rawCreatedAt.toDate().toISOString();
  } else if (typeof rawCreatedAt === 'string') {
    createdAtIso = rawCreatedAt;
  }

  return {
    id: snap.id,
    playerName: typeof data.playerName === 'string' ? data.playerName : 'Jezdec',
    score: typeof data.score === 'number' ? Math.floor(data.score) : 0,
    level: typeof data.level === 'number' ? Math.floor(data.level) : 1,
    ambulancesHit: typeof data.ambulancesHit === 'number' ? Math.floor(data.ambulancesHit) : 0,
    createdAt: createdAtIso,
  };
}

function sortLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => b.score - a.score || b.ambulancesHit - a.ambulancesHit)
    .slice(0, LEADERBOARD_LIMIT);
}

function buildTopLeaderboardQuery() {
  // Single-field where + orderBy on `score` satisfies firestore.rules without requiring a composite index
  return query(
    collection(db, LEADERBOARD_COLLECTION),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(LEADERBOARD_LIMIT),
  );
}

export function subscribeGlobalLeaderboard(
  onUpdate: (entries: LeaderboardEntry[]) => void,
  onError?: (err: unknown) => void,
): () => void {
  const q = buildTopLeaderboardQuery();
  return onSnapshot(
    q,
    (snapshot) => {
      const entries = sortLeaderboard(snapshot.docs.map(mapDocToEntry));
      writeLocalCache(entries);
      onUpdate(entries);
    },
    (error) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        onUpdate(readLocalCache());
        return;
      }
      try {
        handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
      } catch (wrapped) {
        onError?.(wrapped);
      }
    },
  );
}

export async function fetchGlobalLeaderboard(): Promise<LeaderboardEntry[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return readLocalCache();
  }
  try {
    const snapshot = await getDocs(buildTopLeaderboardQuery());
    const entries = sortLeaderboard(snapshot.docs.map(mapDocToEntry));
    writeLocalCache(entries);
    return entries;
  } catch (error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return readLocalCache();
    }
    handleFirestoreError(error, OperationType.LIST, LEADERBOARD_COLLECTION);
  }
}

export async function submitGlobalScore(payload: {
  playerName: string;
  score: number;
  level: number;
  ambulancesHit: number;
}): Promise<{ entries: LeaderboardEntry[]; entry: LeaderboardEntry; rank: number }> {
  const playerName = sanitizePlayerName(payload.playerName);
  if (
    playerName.length < PLAYER_NAME_MIN_LEN ||
    playerName.length > PLAYER_NAME_MAX_LEN ||
    !PLAYER_NAME_REGEX.test(playerName)
  ) {
    throw new Error('Zadejte platnou přezdívku (2 až 16 znaků, písmena nebo čísla).');
  }

  savePlayerName(playerName);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Jste offline. Pro uložení do globálního žebříčku se připojte k internetu.');
  }

  // Strictly enforce blueprint & security rule invariants before writing
  const score = Math.max(0, Math.min(100000, Math.floor(payload.score)));
  const level = Math.max(1, Math.min(5, Math.floor(payload.level)));
  const maxPossibleAmbulances = Math.min(10000, Math.floor(score / 5));
  const ambulancesHit = Math.max(
    0,
    Math.min(maxPossibleAmbulances, Math.floor(payload.ambulancesHit)),
  );

  const entryId = generateEntryId();
  const docPath = `${LEADERBOARD_COLLECTION}/${entryId}`;

  try {
    await setDoc(doc(db, LEADERBOARD_COLLECTION, entryId), {
      playerName,
      score,
      level,
      ambulancesHit,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  const createdEntry: LeaderboardEntry = {
    id: entryId,
    playerName,
    score,
    level,
    ambulancesHit,
    createdAt: new Date().toISOString(),
  };

  const entries = await fetchGlobalLeaderboard();
  const foundIndex = entries.findIndex((e) => e.id === entryId);
  const rank = foundIndex >= 0 ? foundIndex + 1 : entries.length + 1;

  return {
    entries,
    entry: createdEntry,
    rank,
  };
}
