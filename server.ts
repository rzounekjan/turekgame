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

function ensureStore(): StoredScore[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LEADERBOARD_FILE)) {
      fs.writeFileSync(LEADERBOARD_FILE, '[]', 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as StoredScore[];
  } catch {
    return [];
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

  app.delete('/api/leaderboard', (_req, res) => {
    saveStore([]);
    res.json({ entries: [] });
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
