'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthService } from '@/utils/authService';
import { getAuthClient } from '@/lib/firebase';
import { userHasEmailPasswordProvider } from '@/utils/firebaseAuthProviders';
import { authLoginErrorMessage } from '@/utils/authLoginErrorMessage';
import toast from 'react-hot-toast';

const DISMISS_KEY = 'lookball_dismiss_email_password_link_banner';

/** Baner po zalogowaniu: konto tylko z Google — umożliwia dodanie hasła (ten sam UID, oba sposoby logowania). */
export default function SetPasswordForGoogleAccountBanner() {
  const { user, isAuthenticated, refreshUserData } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDismissed(localStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const needsPassword = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    return !userHasEmailPasswordProvider(user);
  }, [isAuthenticated, user]);

  if (dismissed || !needsPassword) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (password !== confirm) {
      setErr('Hasła muszą być takie same.');
      return;
    }
    if (password.length < 6) {
      setErr('Minimum 6 znaków.');
      return;
    }
    setBusy(true);
    try {
      await AuthService.getInstance().linkEmailPasswordProviderToCurrentUser(password);
      const u = getAuthClient().currentUser;
      if (u) {
        await u.reload();
      }
      await refreshUserData();
      toast.success('Hasło ustawione. Możesz logować się też e-mailem i hasłem.');
      setPassword('');
      setConfirm('');
      localStorage.removeItem(DISMISS_KEY);
    } catch (e: unknown) {
      setErr(authLoginErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-neutral-900 shadow-sm"
      role="region"
      aria-label="Ustaw hasło do logowania e-mail"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">Logujesz się przez Google?</p>
          <p className="mt-1 text-amber-900/90">
            Ustaw hasło poniżej — ten sam adres e-mail zadziała wtedy także w formularzu logowania obok „Kontynuuj z
            Google”.
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex w-full min-w-[240px] flex-col gap-2 sm:max-w-sm"
        >
          <label className="sr-only" htmlFor="banner-new-password">
            Nowe hasło
          </label>
          <input
            id="banner-new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nowe hasło (min. 6 znaków)"
            disabled={busy}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60"
          />
          <label className="sr-only" htmlFor="banner-confirm-password">
            Powtórz hasło
          </label>
          <input
            id="banner-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Powtórz hasło"
            disabled={busy}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-neutral-900 placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-60"
          />
          {err ? (
            <p className="text-xs text-red-700" role="alert">
              {err}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-amber-800 px-4 py-2 font-medium text-white hover:bg-amber-900 disabled:opacity-50"
            >
              {busy ? 'Zapisywanie…' : 'Zapisz hasło'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              disabled={busy}
              className="rounded-lg border border-amber-400 bg-transparent px-4 py-2 font-medium text-amber-950 hover:bg-amber-100/80 disabled:opacity-50"
            >
              Później
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
