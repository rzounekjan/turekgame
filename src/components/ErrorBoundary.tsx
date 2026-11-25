import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('TUREK application error:', error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-dvh w-screen flex-col items-center justify-center bg-[#070912] px-6 text-center text-slate-100">
          <div className="w-full max-w-sm rounded-xl border border-cyan-400/25 bg-[#0b1120] p-6 shadow-2xl">
            <h1 className="font-display text-xl font-extrabold tracking-wider text-cyan-300">
              TUREK
            </h1>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              Došlo k neočekávané chybě při načítání hry nebo globálního žebříčku.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-11 w-full rounded-xl bg-cyan-400 px-4 font-display text-sm font-bold text-slate-950 transition-colors hover:bg-cyan-300 cursor-pointer"
            >
              Znovu načíst hru
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
