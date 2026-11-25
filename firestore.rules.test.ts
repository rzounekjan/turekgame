/**
 * Security Rules Verification Suite — "Dirty Dozen" Payloads for TUREK Global Leaderboard.
 * Designed for execution against the Firebase Firestore Emulator (`@firebase/rules-unit-testing`)
 * or as a deterministic invariant checklist synchronized with `firestore.rules`.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'delete' | 'list';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
  enforcedBy: string;
}

export const VALID_LEADERBOARD_PAYLOAD = {
  playerName: 'Mistr Turek',
  score: 125,
  level: 4,
  ambulancesHit: 6,
  createdAt: '__SERVER_TIMESTAMP__',
} as const;

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Shadow/Ghost field injection (isAdmin)',
    operation: 'create',
    path: '/leaderboard/sc-shadow-1',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, isAdmin: true },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.keys().hasOnly([playerName, score, level, ambulancesHit, createdAt])',
  },
  {
    id: 2,
    name: 'PII injection (email field)',
    operation: 'create',
    path: '/leaderboard/sc-pii-2',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, email: 'leak@example.com' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.keys().hasOnly([...])',
  },
  {
    id: 3,
    name: 'Oversized playerName (Denial of Wallet)',
    operation: 'create',
    path: '/leaderboard/sc-longname-3',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, playerName: 'A'.repeat(200) },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.playerName.size() >= 2 && data.playerName.size() <= 16',
  },
  {
    id: 4,
    name: 'Too-short playerName (< 2 chars)',
    operation: 'create',
    path: '/leaderboard/sc-short-4',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, playerName: 'X' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.playerName.size() >= 2',
  },
  {
    id: 5,
    name: 'Script/HTML injection in playerName',
    operation: 'create',
    path: '/leaderboard/sc-xss-5',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, playerName: '<script>x</script>' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: "data.playerName.matches('^[\\\\p{L}\\\\p{N}_\\\\-\\\\. ]{2,16}$')",
  },
  {
    id: 6,
    name: 'Negative score poisoning',
    operation: 'create',
    path: '/leaderboard/sc-neg-6',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, score: -10, ambulancesHit: 0 },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.score >= 0 && data.score <= 100000',
  },
  {
    id: 7,
    name: 'Unbounded score overflow (> 100000)',
    operation: 'create',
    path: '/leaderboard/sc-overflow-7',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, score: 999999999 },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.score >= 0 && data.score <= 100000',
  },
  {
    id: 8,
    name: 'Float type poisoning on score',
    operation: 'create',
    path: '/leaderboard/sc-float-8',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, score: 42.5 },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.score is int',
  },
  {
    id: 9,
    name: 'Out-of-range level (> 5)',
    operation: 'create',
    path: '/leaderboard/sc-level-9',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, level: 99 },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.level is int && data.level >= 1 && data.level <= 5',
  },
  {
    id: 10,
    name: 'Impossible ambulance bonus ratio (ambulancesHit * 5 > score)',
    operation: 'create',
    path: '/leaderboard/sc-ratio-10',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, score: 10, ambulancesHit: 5 },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.ambulancesHit * 5 <= data.score',
  },
  {
    id: 11,
    name: 'Client-forged createdAt timestamp (!= request.time)',
    operation: 'create',
    path: '/leaderboard/sc-time-11',
    payload: { ...VALID_LEADERBOARD_PAYLOAD, createdAt: '2020-01-01T00:00:00.000Z' },
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'data.createdAt is timestamp && data.createdAt == request.time',
  },
  {
    id: 12,
    name: 'Update/Delete/Undeclared path tampering',
    operation: 'delete',
    path: '/leaderboard/sc-existing-12',
    expected: 'PERMISSION_DENIED',
    enforcedBy: 'allow update, delete: if false; and global catch-all deny',
  },
];
