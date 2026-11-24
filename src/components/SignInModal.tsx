import React, { useEffect, useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { upsertUserOnAuth } from '../services/firestoreSync';
import { UserAccount } from '../types';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn?: (account: UserAccount) => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({
  isOpen,
  onClose,
  onSignedIn,
}) => {
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setGoogleLoading(false);
      setError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const account = await upsertUserOnAuth(result.user);
      onSignedIn?.(account);
      onClose();
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string };
      const code = firebaseErr?.code ?? '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google sign-in was cancelled. Click the button below when ready to continue.');
      } else if (code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        setError(
          `Domain "${host}" is not yet authorized in Firebase Authentication. Add "${host}" under Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else {
        setError(
          firebaseErr?.message ||
            'Unable to complete Google sign-in. Please verify popup permissions and try again.'
        );
      }
    } finally {
      setGoogleLoading(false);
    }
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
              Sign in with your Gmail account to sync your profile avatar, pantry ledger, and orders across devices.
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

        <div className="mt-5 space-y-4">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full min-h-[48px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#172523] px-4 py-2.5 text-sm font-semibold text-stone-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-[#1F312E] transition-colors flex items-center justify-center gap-3 shadow-xs disabled:opacity-60 cursor-pointer"
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
            <span>
              {googleLoading ? 'Signing in with Google...' : 'Continue with Gmail (Google)'}
            </span>
          </button>

          {error && (
            <p className="rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:text-red-300 leading-relaxed">
              {error}
            </p>
          )}

          <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-[#172523] p-3.5 flex items-start gap-2.5 text-xs text-stone-600 dark:text-stone-400">
            <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-stone-800 dark:text-stone-200">
                Role &amp; Profile Sync
              </p>
              <p>
                New Gmail accounts default to <span className="font-semibold">Coworker</span> role with your Gmail avatar saved automatically. Admins can assign Delivery Staff, Store Owner, or Admin access in Admin Config.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
