import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Pause,
  Play,
  Send,
  Trophy,
  Volume2,
  VolumeX,
  WifiOff,
} from 'lucide-react';
import { LeaderboardModal } from './components/LeaderboardModal';
import { NeonLogoT, NeonTitleTurek } from './components/NeonLogo';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { TurekAudioEngine } from './game/audio';
import { AMBULANCE_HIT_POINTS, LEVELS } from './game/constants';
import { TurekGameEngine } from './game/engine';
import {
  fetchGlobalLeaderboard,
  getLocalBestScore,
  getSavedMuted,
  getSavedPlayerName,
  saveLocalBestScore,
  saveMuted,
  submitGlobalScore,
  subscribeGlobalLeaderboard,
} from './services/leaderboard';
import type { HudSnapshot, LeaderboardEntry, ScorePopupEvent } from './types/game';

interface BannerToast {
  id: number;
  title: string;
  subtitle: string;
  accent: string;
}

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  bestLocalScore: 0,
  level: 1,
  levelName: LEVELS[0].name,
  levelAccent: LEVELS[0].accentHex,
  speedKmh: 110,
  speedStep: 0,
  dodgedCars: 0,
  ambulancesHit: 0,
  nextLevelScore: LEVELS[1].minScore,
  levelProgress: 0,
  ambulanceNearby: false,
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TurekGameEngine | null>(null);
  const audioRef = useRef<TurekAudioEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    ...INITIAL_HUD,
    bestLocalScore: getLocalBestScore(),
  }));
  const [muted, setMuted] = useState<boolean>(() => getSavedMuted());
  const [popups, setPopups] = useState<ScorePopupEvent[]>([]);
  const [banner, setBanner] = useState<BannerToast | null>(null);
  const [activeSide, setActiveSide] = useState<'left' | 'right' | null>(null);
  const isOnline = useOnlineStatus();

  // Leaderboard state
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // Game Over score submission state
  const [playerName, setPlayerName] = useState<string>(() => getSavedPlayerName());
  const [submittingScore, setSubmittingScore] = useState(false);
  const [submittedRank, setSubmittedRank] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const entries = await fetchGlobalLeaderboard();
      setLeaderboardEntries(entries);
    } catch {
      // Structured Firestore error is already logged by handleFirestoreError
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // Subscribe to real-time global Firestore leaderboard updates on mount
  useEffect(() => {
    setLeaderboardLoading(true);
    const unsubscribe = subscribeGlobalLeaderboard(
      (entries) => {
        setLeaderboardEntries(entries);
        setLeaderboardLoading(false);
      },
      () => {
        setLeaderboardLoading(false);
      },
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Mount isolated Three.js engine once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const initialMuted = getSavedMuted();
    const audio = new TurekAudioEngine(initialMuted);
    audioRef.current = audio;

    let toastId = 1;
    const engine = new TurekGameEngine(
      mountEl,
      audio,
      {
        onHudUpdate: (snapshot) => {
          setHud(snapshot);
        },
        onScorePopup: (popup) => {
          setPopups((prev) => [...prev.slice(-5), popup]);
          window.setTimeout(() => {
            setPopups((prev) => prev.filter((item) => item.id !== popup.id));
          }, 820);
        },
        onLevelUp: (level, name, subtitle, accentHex) => {
          const id = toastId++;
          setBanner({
            id,
            title: `ÚROVEŇ ${level} · ${name.toUpperCase()}`,
            subtitle: `${subtitle} · Vyšší rychlost a tempo hudby`,
            accent: accentHex,
          });
          window.setTimeout(() => {
            setBanner((curr) => (curr && curr.id === id ? null : curr));
          }, 2150);
        },
        onSpeedUp: (speedKmh) => {
          const id = toastId++;
          setBanner({
            id,
            title: `ZRYCHLENÍ · ${speedKmh} KM/H`,
            subtitle: '+10 bodů dosaženo',
            accent: '#00f0ff',
          });
          window.setTimeout(() => {
            setBanner((curr) => (curr && curr.id === id ? null : curr));
          }, 1500);
        },
        onGameOver: (finalSnap) => {
          const best = saveLocalBestScore(finalSnap.score);
          setHud((prev) => ({ ...prev, ...finalSnap, bestLocalScore: best }));
          setSubmittedRank(null);
          setSubmitError(null);
          setActiveSide(null);
        },
      },
      getLocalBestScore(),
    );

    engineRef.current = engine;

    return () => {
      engine.dispose();
      audio.dispose();
      engineRef.current = null;
      audioRef.current = null;
    };
  }, []);

  const handleStart = useCallback(() => {
    setSubmittedRank(null);
    setSubmitError(null);
    setHighlightedId(null);
    setLeaderboardOpen(false);
    engineRef.current?.startGame();
  }, []);

  const handleReturnToTitle = useCallback(() => {
    setSubmittedRank(null);
    setSubmitError(null);
    setHighlightedId(null);
    setLeaderboardOpen(false);
    setBanner(null);
    setPopups([]);
    setActiveSide(null);
    engineRef.current?.returnToTitle();
  }, []);

  const handleToggleSound = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      saveMuted(next);
      audioRef.current?.unlock();
      audioRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  // Keyboard controls (ArrowLeft / ArrowRight / A / D / Enter / Space / Esc / R / M)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Do not hijack typing in the leaderboard nickname input
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const phase = engineRef.current?.getPhase();

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleSound();
        return;
      }

      if (e.key === 'Escape' && leaderboardOpen) {
        e.preventDefault();
        setLeaderboardOpen(false);
        return;
      }

      if ((e.key === 'Enter' || e.key === ' ') && !leaderboardOpen) {
        if (phase === 'title' || phase === 'gameover') {
          e.preventDefault();
          handleStart();
          return;
        }
        if (phase === 'paused') {
          e.preventDefault();
          handleTogglePause();
          return;
        }
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (phase === 'playing' || phase === 'paused') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (phase === 'playing' && !e.repeat) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          setActiveSide('left');
          engineRef.current?.setSteerPress(-1);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          setActiveSide('right');
          engineRef.current?.setSteerPress(1);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        engineRef.current?.releaseSteer(-1);
        setActiveSide((curr) => (curr === 'left' ? null : curr));
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        engineRef.current?.releaseSteer(1);
        setActiveSide((curr) => (curr === 'right' ? null : curr));
      }
    };

    const onBlur = () => {
      engineRef.current?.releaseSteer();
      setActiveSide(null);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [handleStart, handleTogglePause, handleToggleSound, leaderboardOpen]);

  // Left / Right side screen pointer/touch steering handlers
  const handleSidePointerDown = (dir: -1 | 1) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (hud.phase !== 'playing') return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setActiveSide(dir < 0 ? 'left' : 'right');
    engineRef.current?.setSteerPress(dir);
  };

  const handleSidePointerUp = (dir: -1 | 1) => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    engineRef.current?.releaseSteer(dir);
    setActiveSide((curr) => (curr === (dir < 0 ? 'left' : 'right') ? null : curr));
  };

  const handleSubmitLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (trimmed.length < 2) {
      setSubmitError('Zadejte prosím přezdívku (min. 2 znaky).');
      return;
    }
    setSubmitError(null);
    setSubmittingScore(true);
    try {
      const result = await submitGlobalScore({
        playerName: trimmed,
        score: hud.score,
        level: hud.level,
        ambulancesHit: hud.ambulancesHit,
      });
      setLeaderboardEntries(result.entries);
      setHighlightedId(result.entry.id);
      setSubmittedRank(result.rank);
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : '';
      if (rawMsg.includes('Quota exceeded')) {
        setSubmitError('Denní limit databáze byl vyčerpán. Zkuste to prosím zítra.');
      } else if (rawMsg.startsWith('{') && rawMsg.includes('"operationType"')) {
        setSubmitError('Nepodařilo se uložit skóre do globálního žebříčku.');
      } else {
        setSubmitError(rawMsg || 'Chyba při ukládání.');
      }
    } finally {
      setSubmittingScore(false);
    }
  };

  return (
    <div className="relative h-dvh w-screen overflow-hidden bg-[#070912] select-none">
      {/* Isolated WebGL 3D Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 h-full w-full"
        aria-label="3D dálniční herní plocha TUREK"
      />

      {/* Interactive Left / Right Screen Touch Steering Zones during Active Gameplay */}
      {hud.phase === 'playing' && (
        <div className="absolute inset-0 z-10 grid grid-cols-2 touch-none">
          <div
            onPointerDown={handleSidePointerDown(-1)}
            onPointerUp={handleSidePointerUp(-1)}
            onPointerCancel={handleSidePointerUp(-1)}
            className="relative h-full w-full cursor-pointer"
            aria-label="Uhýbat doleva"
          >
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 flex w-14 items-center justify-start pl-2 transition-opacity duration-150 ${
                activeSide === 'left' ? 'opacity-90' : 'opacity-15'
              }`}
            >
              <ChevronLeft className="h-8 w-8 text-cyan-300" />
            </div>
          </div>
          <div
            onPointerDown={handleSidePointerDown(1)}
            onPointerUp={handleSidePointerUp(1)}
            onPointerCancel={handleSidePointerUp(1)}
            className="relative h-full w-full cursor-pointer"
            aria-label="Uhýbat doprava"
          >
            <div
              className={`pointer-events-none absolute inset-y-0 right-0 flex w-14 items-center justify-end pr-2 transition-opacity duration-150 ${
                activeSide === 'right' ? 'opacity-90' : 'opacity-15'
              }`}
            >
              <ChevronRight className="h-8 w-8 text-cyan-300" />
            </div>
          </div>
        </div>
      )}

      {/* World-Projected Floating Score Popups (pointer-events-none) */}
      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
        {popups.map((pop) => (
          <div
            key={pop.id}
            style={{ left: `${pop.xPercent}%`, top: `${pop.yPercent}%` }}
            className="animate-score-pop absolute flex max-w-[46vw] flex-col items-center text-center"
          >
            <span
              className={`font-display font-extrabold tracking-wider whitespace-nowrap ${
                pop.kind === 'ambulance'
                  ? 'text-xl sm:text-3xl neon-text-amber'
                  : 'text-base sm:text-lg text-cyan-200'
              }`}
            >
              {pop.text}
            </span>
            {pop.subtext && (
              <span className="font-display text-[10px] sm:text-[11px] font-bold tracking-[0.12em] sm:tracking-[0.18em] text-amber-300 whitespace-nowrap">
                {pop.subtext}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Level-Up & Speed-Up Non-Blocking Toast Banner */}
      {banner && hud.phase === 'playing' && (
        <div
          key={banner.id}
          className="pointer-events-none animate-level-toast absolute left-1/2 top-[4.5rem] sm:top-20 z-30 flex w-max max-w-[calc(100vw-1.5rem)] flex-col items-center rounded-lg border border-white/15 bg-[#080d1a]/92 px-3.5 py-2 sm:px-5 sm:py-2.5 text-center shadow-lg"
        >
          <span
            className="font-display text-xs sm:text-base font-extrabold tracking-[0.1em] sm:tracking-[0.14em]"
            style={{ color: banner.accent }}
          >
            {banner.title}
          </span>
          <span className="text-[11px] sm:text-xs text-slate-300 leading-snug">{banner.subtitle}</span>
        </div>
      )}

      {/* Low-Occlusion Top Perimeter HUD Bar (pointer-events-none wrapper, no backdrop-filter) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-1.5 sm:gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
        {/* Left: Neon T Logo + Active Level Readout */}
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5 rounded-xl border border-white/10 bg-[#070c18]/88 px-2 py-1.5 sm:px-3 sm:py-2">
          <NeonLogoT size={28} className="sm:h-[34px] sm:w-[34px]" />
          <div className="flex min-w-0 flex-col">
            <div className="flex items-baseline gap-1.5 sm:gap-2">
              <span
                className={`font-display text-xs sm:text-base font-bold tracking-[0.1em] sm:tracking-[0.12em] neon-text-cyan whitespace-nowrap ${
                  hud.phase !== 'title' ? 'hidden sm:inline' : ''
                }`}
              >
                TUREK
              </span>
              {hud.phase !== 'title' && (
                <span className="font-mono-num text-[11px] sm:text-xs font-semibold text-slate-200 whitespace-nowrap">
                  <span className="sm:hidden">Úr. {hud.level}/5</span>
                  <span className="hidden sm:inline">Úroveň {hud.level}/5</span>
                </span>
              )}
            </div>
            {hud.phase !== 'title' ? (
              <div className="mt-1 h-1 w-12 sm:w-28 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0.06, hud.levelProgress)})`,
                    backgroundColor: hud.levelAccent,
                  }}
                />
              </div>
            ) : (
              <span className="text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
                6 pruhů · 5 úrovní
              </span>
            )}
          </div>
        </div>

        {/* Center: Live Score & Speed during Gameplay */}
        {hud.phase !== 'title' && (
          <div className="flex min-w-0 flex-col items-center rounded-xl border border-white/10 bg-[#070c18]/88 px-2.5 py-1 sm:px-6 sm:py-1.5">
            <span className="font-mono-num text-xl sm:text-3xl font-bold leading-none text-white">
              {hud.score}
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-[11px] text-slate-400 whitespace-nowrap">
              <span className="font-mono-num text-cyan-300">{hud.speedKmh} km/h</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num text-amber-300">
                <span className="sm:hidden">San.: {hud.ambulancesHit}</span>
                <span className="hidden sm:inline">Sanitky: {hud.ambulancesHit}</span>
              </span>
            </div>
          </div>
        )}

        {/* Right: Sound On/Off, Pause/Leaderboard, and PWA Install Controls */}
        <div className="pointer-events-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleToggleSound}
            className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/12 bg-[#070c18]/90 text-slate-100 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
            aria-label={muted ? 'Zapnout zvuk' : 'Vypnout zvuk'}
            title={muted ? 'Zapnout zvuk (M)' : 'Vypnout zvuk (M)'}
          >
            {muted ? (
              <VolumeX className="h-4 w-4 sm:h-5 sm:w-5 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-300" />
            )}
          </button>

          {hud.phase === 'playing' || hud.phase === 'paused' ? (
            <button
              type="button"
              onClick={handleTogglePause}
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/12 bg-[#070c18]/90 text-slate-100 transition-colors hover:border-cyan-400/50 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer"
              aria-label={hud.phase === 'paused' ? 'Pokračovat' : 'Pozastavit'}
              title={hud.phase === 'paused' ? 'Pokračovat (Esc)' : 'Pauza (Esc)'}
            >
              {hud.phase === 'paused' ? (
                <Play className="h-4 w-4 sm:h-5 sm:w-5 text-cyan-300" />
              ) : (
                <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLeaderboardOpen(true);
                loadLeaderboard();
              }}
              className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border border-white/12 bg-[#070c18]/90 text-amber-300 transition-colors hover:border-amber-400/50 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
              aria-label="Globální žebříček"
              title="Globální žebříček"
            >
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}

          <PWAInstallButton />
        </div>
      </header>

      {/* Non-intrusive Offline Connectivity Notice */}
      {!isOnline && (
        <div className="pointer-events-none fixed bottom-4 left-3 z-40 flex items-center gap-2 rounded-lg border border-amber-400/35 bg-[#0a0f1e]/92 px-3 py-1.5 text-xs font-medium text-amber-200 shadow-lg">
          <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>Offline režim</span>
        </div>
      )}

      {/* Responsive Ambulance Target Cue near bottom edge (never overflows narrow phones) */}
      {hud.phase === 'playing' && hud.ambulanceNearby && (
        <div className="pointer-events-none absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 rounded-lg border border-amber-400/35 bg-[#090e1c]/92 px-3 py-1.5 text-center font-display text-[11px] sm:text-xs font-bold tracking-wide sm:tracking-wider text-amber-300 leading-snug">
          <span className="sm:hidden">SANITKA · SRAZ JI (+{AMBULANCE_HIT_POINTS} BODŮ)</span>
          <span className="hidden sm:inline">
            SANITKA NA DÁLNICI · SRAZ JI PRO +{AMBULANCE_HIT_POINTS} BODŮ
          </span>
        </div>
      )}

      {/* TITLE SCREEN OVERLAY */}
      {hud.phase === 'title' && (
        <main className="absolute inset-0 z-20 flex flex-col items-center justify-between overflow-y-auto bg-gradient-to-b from-[#050814]/80 via-[#050814]/45 to-[#050814]/88 px-4 pt-20 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          <div className="my-auto flex w-full flex-col items-center py-4">
            <NeonTitleTurek className="mb-5" />

            <p className="max-w-md text-sm sm:text-base text-slate-200 leading-relaxed mb-7">
              Řiď černé SUV v šesti dálničních pruzích. Vyhýbej se protijedoucím autům za bod a srážej sanitky pro bonusových +{AMBULANCE_HIT_POINTS} bodů.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm justify-center">
              <button
                type="button"
                onClick={handleStart}
                className="flex h-12 w-full sm:w-auto sm:min-w-[200px] items-center justify-center gap-2 rounded-xl bg-cyan-400 px-6 font-display text-base font-extrabold tracking-wider text-slate-950 shadow-[0_0_24px_rgba(0,240,255,0.45)] transition-transform duration-150 hover:bg-cyan-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="h-5 w-5 fill-slate-950" />
                Spustit jízdu
              </button>

              <button
                type="button"
                onClick={() => {
                  setLeaderboardOpen(true);
                  loadLeaderboard();
                }}
                className="flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-white/18 bg-[#0b1224]/92 px-5 font-display text-sm font-bold tracking-wide text-slate-100 transition-colors hover:border-amber-400/50 hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="h-4 w-4 text-amber-400" />
                Žebříček
              </button>
            </div>

            {hud.bestLocalScore > 0 && (
              <div className="mt-5 text-xs text-slate-300">
                Tvůj osobní rekord:{' '}
                <span className="font-mono-num font-bold text-cyan-300">
                  {hud.bestLocalScore} bodů
                </span>
              </div>
            )}

            {/* Single flat control hint line */}
            <div className="mt-7 text-xs text-slate-400">
              Levá / pravá strana displeje nebo šipky · Auta +1 · Sanitka +{AMBULANCE_HIT_POINTS} · Zrychlení každých 10 bodů
            </div>
          </div>

          <footer className="mt-4 shrink-0 px-2 pt-2 text-center">
            <p className="font-display text-xs sm:text-sm font-semibold tracking-[0.12em]">
              <span className="neon-broken-label">Vytvořil: </span>
              <a
                href="https://www.ekonomickykompas.cz"
                target="_blank"
                rel="noopener noreferrer"
                className="neon-broken-link underline decoration-pink-400/40 underline-offset-4 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 rounded-sm"
              >
                www.ekonomickykompas.cz
              </a>
            </p>
          </footer>
        </main>
      )}

      {/* PAUSE MODAL */}
      {hud.phase === 'paused' && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#040710]/78 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Hra pozastavena"
        >
          <div className="w-full max-w-xs rounded-xl border border-cyan-400/25 bg-[#0b1120] p-6 text-center shadow-2xl">
            <h2 className="font-display text-xl font-extrabold tracking-wider text-white">
              Pauza
            </h2>
            <p className="mt-1.5 text-xs text-slate-400">
              Úroveň {hud.level}/5 · {hud.levelName}
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 font-display text-sm font-bold text-slate-950 hover:bg-cyan-300 cursor-pointer"
              >
                <Play className="h-4 w-4 fill-slate-950" />
                Pokračovat
              </button>
              <button
                type="button"
                onClick={handleReturnToTitle}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 font-display text-sm font-semibold text-slate-100 hover:border-cyan-400/50 hover:text-cyan-200 cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Zpět na úvod
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL WITH GLOBAL LEADERBOARD SUBMISSION */}
      {hud.phase === 'gameover' && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-[#040710]/82 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Konec jízdy"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl border border-cyan-400/25 bg-[#0b1120] p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-rose-400">Konec jízdy</p>
                <h2 className="font-display text-2xl font-extrabold tracking-wide text-white">
                  Skóre <span className="font-mono-num text-cyan-300">{hud.score}</span>
                </h2>
              </div>
              <NeonLogoT size={44} />
            </div>

            {/* Clean unboxed summary metrics */}
            <div className="mt-4 grid grid-cols-3 gap-3 border-y border-white/10 py-3.5 text-center">
              <div>
                <div className="text-[11px] text-slate-400">Úroveň</div>
                <div className="mt-0.5 font-mono-num text-base font-bold text-white">
                  {hud.level}/5
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Vyhnutá auta</div>
                <div className="mt-0.5 font-mono-num text-base font-bold text-cyan-300">
                  {hud.dodgedCars}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Sanitky (+{AMBULANCE_HIT_POINTS})</div>
                <div className="mt-0.5 font-mono-num text-base font-bold text-amber-300">
                  {hud.ambulancesHit}
                </div>
              </div>
            </div>

            {/* Submit to Global Leaderboard */}
            {submittedRank === null ? (
              <form onSubmit={handleSubmitLeaderboard} className="mt-4">
                <label
                  htmlFor="turek-player-name"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Uložit do globálního žebříčku
                </label>
                <div className="flex gap-2">
                  <input
                    id="turek-player-name"
                    type="text"
                    maxLength={16}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Tvoje přezdívka"
                    className="h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#060a14] px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={submittingScore}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-4 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {submittingScore ? 'Ukládám…' : 'Uložit'}
                  </button>
                </div>
                {submitError && (
                  <p className="mt-1.5 text-xs text-rose-400">{submitError}</p>
                )}
              </form>
            ) : (
              <div className="mt-4 flex items-center justify-between rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-2.5 text-xs text-cyan-200">
                <span>
                  Uloženo! Globální pořadí:{' '}
                  <strong className="font-mono-num text-white">{submittedRank}. místo</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setLeaderboardOpen(true)}
                  className="font-semibold text-amber-300 hover:underline whitespace-nowrap cursor-pointer"
                >
                  Zobrazit tabulku
                </button>
              </div>
            )}

            {/* Primary Actions */}
            <div className="mt-5 flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 font-display text-sm font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-cyan-300 whitespace-nowrap cursor-pointer"
                >
                  <Play className="h-4 w-4 fill-slate-950" />
                  Hrát znovu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLeaderboardOpen(true);
                    loadLeaderboard();
                  }}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-4 font-display text-sm font-semibold text-slate-100 transition-colors hover:border-amber-400/50 hover:text-amber-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trophy className="h-4 w-4 text-amber-400" />
                  Žebříček
                </button>
              </div>
              <button
                type="button"
                onClick={handleReturnToTitle}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 font-display text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-400/50 hover:text-cyan-200 whitespace-nowrap cursor-pointer"
              >
                <Home className="h-4 w-4" />
                Zpět na úvodní obrazovku
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Leaderboard Modal */}
      <LeaderboardModal
        open={leaderboardOpen}
        entries={leaderboardEntries}
        loading={leaderboardLoading}
        highlightId={highlightedId}
        onClose={() => setLeaderboardOpen(false)}
        onRefresh={loadLeaderboard}
      />
    </div>
  );
}
