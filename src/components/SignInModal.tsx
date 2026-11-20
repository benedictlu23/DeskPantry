import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mail, X } from 'lucide-react';
import { UserAccount, UserRole } from '../types';

interface GoogleUserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
}

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserAccount[];
  onSignInUser: (user: UserAccount) => void;
  onSignInEmail: (name: string, email: string, role: UserRole) => void;
  onGoogleSignIn: (profile: GoogleUserProfile) => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  users,
  onSignInUser,
  onSignInEmail,
  onGoogleSignIn,
}) => {
  const [email, setEmail] = useState('benedictlu23@gmail.com');
  const [name, setName] = useState('Benedict Lu');
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [prefetchedGoogleUrl, setPrefetchedGoogleUrl] = useState<string | null>(null);
  const popupWatchRef = useRef<number | null>(null);

  const clearPopupWatch = () => {
    if (popupWatchRef.current !== null) {
      window.clearInterval(popupWatchRef.current);
      popupWatchRef.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setGoogleLoading(false);
      setError('');
      clearPopupWatch();
      return;
    }

    let cancelled = false;
    const origin = window.location.origin;
    fetch(`/api/auth/google/url?origin=${encodeURIComponent(origin)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { url?: string };
      })
      .then((data) => {
        if (!cancelled && data?.url) {
          setPrefetchedGoogleUrl(data.url);
        }
      })
      .catch(() => {
        // Fallback will fetch on click if needed
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      const isTrustedOrigin =
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin.includes('127.0.0.1');
      if (!isTrustedOrigin) return;

      const data = event.data as
        | { type?: string; user?: GoogleUserProfile; error?: string }
        | undefined;
      if (!data?.type) return;

      if (data.type === 'GOOGLE_OAUTH_SUCCESS' && data.user?.email) {
        clearPopupWatch();
        setGoogleLoading(false);
        setError('');
        onGoogleSignIn(data.user);
        onClose();
      } else if (data.type === 'GOOGLE_OAUTH_ERROR') {
        clearPopupWatch();
        setGoogleLoading(false);
        setError(data.error || 'Google sign-in could not be completed.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearPopupWatch();
    };
  }, [isOpen, onClose, onGoogleSignIn]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);

    const width = 520;
    const height = 640;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const features = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    let authUrl = prefetchedGoogleUrl;
    let popup: Window | null = null;

    if (authUrl) {
      popup = window.open(authUrl, 'google_oauth_popup', features);
    } else {
      popup = window.open('', 'google_oauth_popup', features);
    }

    if (!popup) {
      setGoogleLoading(false);
      setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      return;
    }

    if (!authUrl) {
      try {
        const res = await fetch(
          `/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`
        );
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          popup.close();
          setGoogleLoading(false);
          setError(data.error || 'Unable to start Google sign-in.');
          return;
        }
        authUrl = data.url;
        setPrefetchedGoogleUrl(authUrl);
        popup.location.href = authUrl;
      } catch {
        popup.close();
        setGoogleLoading(false);
        setError('Network error starting Google sign-in. Please try again.');
        return;
      }
    }

    clearPopupWatch();
    popupWatchRef.current = window.setInterval(() => {
      if (popup && popup.closed) {
        clearPopupWatch();
        setGoogleLoading(false);
      }
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Enter a valid Gmail or department email address.');
      return;
    }
    const existing = users.find((u) => u.email.toLowerCase() === trimmedEmail);
    if (existing) {
      onSignInUser(existing);
      onClose();
      return;
    }
    const displayName =
      name.trim() ||
      trimmedEmail
        .split('@')[0]
        .replace(/[._-]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    // Default role for newly registered accounts is Coworker (UserRole.Member)
    onSignInEmail(displayName, trimmedEmail, UserRole.Member);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#121D1B] p-5 sm:p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-stone-900 dark:text-stone-100">
              Sign in to DeskPantry
            </h3>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
              Sign in with your Gmail account to sync your profile avatar, or use a work email.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 cursor-pointer"
            aria-label="Close sign-in modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Real Google OAuth Button */}
        <div className="mt-5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full min-h-[46px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-[#1F312E] transition-colors flex items-center justify-center gap-3 shadow-xs disabled:opacity-60 cursor-pointer"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
            ) : (
              <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.13H1.04v3.14C3.05 21.19 7.21 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.03 14.04A7.18 7.18 0 0 1 4.65 12c0-.71.13-1.4.38-2.04V6.82H1.04A11.97 11.97 0 0 0 0 12c0 1.94.46 3.77 1.04 5.18l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.5-3.5C18.07 1.19 15.3 0 12 0 7.21 0 3.05 2.81 1.04 6.82l3.99 3.14c.98-2.94 3.73-5.21 6.97-5.21Z"
                />
              </svg>
            )}
            <span>{googleLoading ? 'Waiting for Google Sign-In...' : 'Sign in with Gmail (Google)'}</span>
          </button>
        </div>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
          <span className="text-[11px] font-medium text-stone-400 dark:text-stone-500">
            or continue with email
          </span>
          <div className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Gmail / Department Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="you@gmail.com"
                className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] pl-9 pr-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
              Full Name (new profiles default to Coworker role)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Juan Dela Cruz"
              className="w-full min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#172523] px-3 py-2 text-sm text-stone-900 dark:text-stone-100 focus:border-teal-700 focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
          >
            Continue with Work Email
          </button>
        </form>
      </div>
    </div>
  );
};
