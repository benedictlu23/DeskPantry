import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message) as { error?: string; path?: string };
      if (parsed && parsed.error) {
        readable = parsed.path
          ? `Permission or data error on "${parsed.path}": ${parsed.error}`
          : parsed.error;
      }
    } catch {
      // Plain error message
    }
    return { hasError: true, message: readable };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('DeskPantry ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F7F5] dark:bg-[#0B1211] text-stone-900 dark:text-stone-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-6 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Something went wrong</h1>
              <p className="mt-1.5 text-xs text-stone-600 dark:text-stone-400 break-words">
                {this.state.message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[42px] inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-xs font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload DeskPantry</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
