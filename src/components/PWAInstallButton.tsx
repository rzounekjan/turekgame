import React, { useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Automatically suppress when running inside an already-installed standalone PWA
  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="flex h-10 w-10 sm:h-11 sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-cyan-400/50 bg-cyan-400/15 sm:px-3.5 font-display text-xs font-bold tracking-wider text-cyan-200 transition-colors hover:bg-cyan-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap shrink-0 cursor-pointer"
        aria-label="Nainstalovat aplikaci TUREK"
        title="Nainstalovat aplikaci TUREK (PWA)"
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Instalovat</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040710]/85 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Instalace aplikace TUREK"
        >
          <div className="w-full max-w-sm rounded-xl border border-cyan-400/30 bg-[#0b1120] p-6 text-left shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-cyan-300 shrink-0" />
                <h3 className="font-display text-base font-bold tracking-wide text-white">
                  Instalovat TUREK jako aplikaci
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/12 bg-white/5 text-slate-200 hover:text-white cursor-pointer"
                aria-label="Zavřít návod"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">1.</span>
                  <span>
                    Klepněte na ikonu <strong className="text-white inline-flex items-center gap-1">Sdílet <Share className="h-3.5 w-3.5 inline text-cyan-300" /></strong> ve spodní liště Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">2.</span>
                  <span>
                    Sjeďte dolů a zvolte <strong className="text-white">Přidat na plochu</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">3.</span>
                  <span>
                    Potvrďte klepnutím na <strong className="text-white">Přidat</strong>. Hra se spustí na celou obrazovku i offline.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">1.</span>
                  <span>
                    Otevřete hru přímo v samostatném okně prohlížeče Chrome, Edge nebo Samsung Internet.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">2.</span>
                  <span>
                    V horní adresní liště nebo v menu prohlížeče (<strong className="text-white">⋮</strong>) zvolte <strong className="text-white">Nainstalovat aplikaci</strong> nebo <strong className="text-white">Přidat na plochu</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono-num font-bold text-cyan-300">3.</span>
                  <span>
                    TUREK pak poběží jako samostatná mobilní aplikace i bez připojení k internetu.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 h-11 w-full rounded-xl bg-cyan-400 font-display text-sm font-extrabold tracking-wide text-slate-950 transition-colors hover:bg-cyan-300 cursor-pointer"
            >
              Rozumím
            </button>
          </div>
        </div>
      )}
    </>
  );
};
