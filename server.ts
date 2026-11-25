import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

interface StoredScore {
  id: string;
  playerName: string;
  score: number;
  level: number;
  ambulancesHit: number;
  createdAt: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

const SEED_SCORES: StoredScore[] = [
  {
    id: 'seed-1',
    playerName: 'MAREK_GT',
    score: 168,
    level: 5,
    ambulancesHit: 9,
    createdAt: '2026-11-20T18:40:00.000Z',
  },
  {
    id: 'seed-2',
    playerName: 'TERKA_CZ',
    score: 134,
    level: 5,
    ambulancesHit: 7,
    createdAt: '2026-11-21T14:15:00.000Z',
  },
  {
    id: 'seed-3',
    playerName: 'KUBA_99',
    score: 102,
    level: 4,
    ambulancesHit: 6,
    createdAt: '2026-11-22T20:05:00.000Z',
  },
  {
    id: 'seed-4',
    playerName: 'DOMINIK',
    score: 84,
    level: 4,
    ambulancesHit: 4,
    createdAt: '2026-11-23T09:50:00.000Z',
  },
  {
    id: 'seed-5',
    playerName: 'ELISKA_V8',
    score: 63,
    level: 3,
    ambulancesHit: 3,
    createdAt: '2026-11-23T19:10:00.000Z',
  },
  {
    id: 'seed-6',
    playerName: 'PETR_X',
    score: 48,
    level: 3,
    ambulancesHit: 2,
    createdAt: '2026-11-24T11:22:00.000Z',
  },
  {
    id: 'seed-7',
    playerName: 'FILIP_PRO',
    score: 31,
    level: 2,
    ambulancesHit: 2,
    createdAt: '2026-11-24T16:45:00.000Z',
  },
  {
    id: 'seed-8',
    playerName: 'LUKAS',
    score: 19,
    level: 1,
    ambulancesHit: 1,
    createdAt: '2026-11-25T08:12:00.000Z',
  },
];

function ensureStore(): StoredScore[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(SEED_SCORES, null, 2), 'utf-8');
      return [...SEED_SCORES];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...SEED_SCORES];
    }
    return parsed as StoredScore[];
  } catch {
    return [...SEED_SCORES];
  }
}

function saveStore(entries: StoredScore[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(entries, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist leaderboard:', err);
  }
}

function sanitizePlayerName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .trim()
    .replace(/[^\p{L}\p{N}_\-\s.]/gu, '')
    .replace(/\s+/g, ' ')
    .slice(0, 16);
  return cleaned;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '16kb' }));

  app.get('/api/leaderboard', (_req, res) => {
    const entries = ensureStore()
      .sort((a, b) => b.score - a.score || b.ambulancesHit - a.ambulancesHit)
      .slice(0, 20);
    res.json({ entries });
  });

  app.post('/api/leaderboard', (req, res) => {
    const body = req.body ?? {};
    const playerName = sanitizePlayerName(body.playerName);
    const score = Number(body.score);
    const level = Number(body.level);
    const ambulancesHit = Number(body.ambulancesHit ?? 0);

    if (playerName.length < 2) {
      res.status(400).json({ error: 'Jméno musí mít alespoň 2 znaky.' });
      return;
    }
    if (!Number.isFinite(score) || score < 0 || score > 100000) {
      res.status(400).json({ error: 'Neplatné skóre.' });
      return;
    }
    if (!Number.isFinite(level) || level < 1 || level > 5) {
      res.status(400).json({ error: 'Neplatná úroveň.' });
      return;
    }
    if (!Number.isFinite(ambulancesHit) || ambulancesHit < 0 || ambulancesHit > 10000) {
      res.status(400).json({ error: 'Neplatný počet sanitek.' });
      return;
    }

    const newEntry: StoredScore = {
      id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      playerName,
      score: Math.floor(score),
      level: Math.floor(level),
      ambulancesHit: Math.floor(ambulancesHit),
      createdAt: new Date().toISOString(),
    };

    const entries = ensureStore();
    entries.push(newEntry);
    const sorted = entries
      .sort((a, b) => b.score - a.score || b.ambulancesHit - a.ambulancesHit)
      .slice(0, 100);
    saveStore(sorted);

    const rank = sorted.findIndex((e) => e.id === newEntry.id) + 1;
    res.status(201).json({
      entry: newEntry,
      rank,
      entries: sorted.slice(0, 20),
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TUREK server running on http://localhost:${PORT}`);
  });
}

startServer();
