'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, LoaderCircle, LogOut, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useI18n } from '@/components/LanguageProvider';
import { useBranding } from '@/components/BrandProvider';

type AuthMode = 'login' | 'register' | 'recover' | 'reset';
type AuthUser = { id: string; email: string; createdAt: string };

/**
 * Verifica la sessione, mostra i flussi account e protegge il workspace autenticato.
 * @param props Workspace applicativo da rendere dopo l'autenticazione.
 * @returns Schermata account oppure workspace con controllo di logout.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const branding = useBranding();
  const [recoveryToken, setRecoveryToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryEnabled, setRecoveryEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
        fetch('/api/flyreq/auth/me', { cache: 'no-store', credentials: 'same-origin' }),
        fetch('/api/flyreq/auth/config', { cache: 'no-store' }),
      ])
      .then(async ([sessionResponse, configResponse]) => {
        const token = new URLSearchParams(window.location.search).get('recovery') || '';
        if (token && !cancelled) {
          setRecoveryToken(token);
          setMode('reset');
          setUser(null);
        }
        if (sessionResponse.ok) {
          const session = await sessionResponse.json() as { user: AuthUser | null };
          if (!cancelled && !token) setUser(session.user);
        }
        if (configResponse.ok) {
          const config = await configResponse.json() as { recoveryEnabled?: boolean };
          if (!cancelled) setRecoveryEnabled(Boolean(config.recoveryEnabled));
        }
      })
      .catch(() => {
        if (!cancelled) setError(t('auth.connectionFailed'));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          document.getElementById('app-boot-loader')?.remove();
        }
      });
    return () => { cancelled = true; };
  }, [locale, t]);

  /**
   * Traduce gli errori stabili restituiti dall'API in messaggi localizzati.
   * @param code Codice errore restituito dal backend.
   * @param fallback Messaggio di ripiego per errori non classificati.
   * @returns Messaggio nella lingua attiva.
   */
  function getAuthError(code: string | undefined, fallback: string): string {
    const keys: Record<string, Parameters<typeof t>[0]> = {
      INVALID_CREDENTIALS: 'auth.invalidCredentials',
      EMAIL_EXISTS: 'auth.emailExists',
      INVALID_EMAIL: 'auth.invalidEmail',
      INVALID_PASSWORD: 'auth.invalidPassword',
      AUTH_RATE_LIMITED: 'auth.rateLimited',
      INVALID_RECOVERY_TOKEN: 'auth.invalidRecoveryToken',
    };
    return code && keys[code] ? t(keys[code]) : fallback;
  }

  /**
   * Invia il modulo corrente e applica login, registrazione, richiesta o reset password.
   * @param event Evento di submit del modulo account.
   * @returns {Promise<void>} Aggiorna sessione e feedback dell'utente.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError('');
    setMessage('');
    if ((mode === 'register' || mode === 'reset') && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    const endpoint = {
      login: 'login',
      register: 'register',
      recover: 'recover',
      reset: 'reset',
    }[mode];
    const body = mode === 'reset'
      ? { token: recoveryToken, password }
      : mode === 'recover'
        ? { email, locale }
        : { email, password };
    try {
      const response = await fetch(`/api/flyreq/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body),
      });
      const result = await response.json() as { user?: AuthUser; code?: string; error?: string };
      if (!response.ok) {
        setError(getAuthError(result.code, result.error || t('auth.requestFailed')));
        return;
      }
      if (mode === 'login' || mode === 'register') {
        setUser(result.user || null);
        return;
      }
      if (mode === 'recover') {
        setMessage(t('auth.recoverySent'));
        return;
      }
      window.history.replaceState({}, '', window.location.pathname);
      setPassword('');
      setMode('login');
      setMessage(t('auth.passwordChanged'));
    } catch {
      setError(t('auth.connectionFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Revoca la sessione server-side e torna alla schermata di accesso.
   * @returns {Promise<void>} Cancella la sessione locale dopo la richiesta di logout.
   */
  async function handleLogout(): Promise<void> {
    await fetch('/api/flyreq/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => undefined);
    setUser(null);
    setMode('login');
    setPassword('');
  }

  /**
   * Cambia modalità del modulo e azzera feedback precedenti.
   * @param nextMode Modalità account da mostrare.
   * @returns {void} Aggiorna la vista del modulo.
   */
  function changeMode(nextMode: AuthMode): void {
    setMode(nextMode);
    setError('');
    setMessage('');
    setPassword('');
    setConfirmPassword('');
  }

  if (loading) {
    return <main className="grid min-h-[100svh] place-items-center bg-background text-muted-foreground" aria-label={t('common.loading')}>
      <LoaderCircle className="size-6 animate-spin" aria-hidden="true" />
    </main>;
  }

  if (user) {
    return <div className="min-h-[100svh]">
      <div className="flex min-h-11 items-center justify-end gap-2 border-b border-border bg-background px-3 sm:px-6">
        <span className="mr-auto truncate text-xs text-muted-foreground sm:ml-2">{user.email}</span>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={t('auth.signOut')} title={t('auth.signOut')} onClick={() => void handleLogout()}>
          <LogOut aria-hidden="true" />
        </Button>
        <ThemeToggle iconOnly />
        <LanguageToggle iconOnly />
      </div>
      {children}
    </div>;
  }

  const title = mode === 'login' ? t('auth.loginTitle')
    : mode === 'register' ? t('auth.registerTitle')
      : mode === 'recover' ? t('auth.recoverTitle') : t('auth.resetTitle');
  const submitLabel = mode === 'login' ? t('auth.loginAction')
    : mode === 'register' ? t('auth.registerAction')
      : mode === 'recover' ? t('auth.recoverAction') : t('auth.resetAction');

  return <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background px-4 py-16 text-foreground">
    <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400" />
    <div className="absolute right-3 top-3 flex gap-1 sm:right-6 sm:top-5">
      <ThemeToggle iconOnly />
      <LanguageToggle iconOnly />
    </div>
    <section className="w-full max-w-[400px] border border-border bg-card p-6 shadow-[0_16px_48px_-32px_color-mix(in_srgb,var(--foreground)_35%,transparent)] sm:p-8">
      <header className="mb-8">
        <div className="mb-6 flex items-center gap-3">
          <img src={branding.logoUrl} alt="" className="size-9 rounded-md object-cover" />
          <span className="truncate text-sm font-semibold">{branding.platformName}</span>
        </div>
        <div className="mb-3 flex size-10 items-center justify-center rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
          {mode === 'recover' ? <Mail className="size-5" aria-hidden="true" /> : <LockKeyhole className="size-5" aria-hidden="true" />}
        </div>
        <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{t(mode === 'login' ? 'auth.loginDescription' : mode === 'register' ? 'auth.registerDescription' : mode === 'recover' ? 'auth.recoverDescription' : 'auth.resetDescription')}</p>
      </header>

      <form className="space-y-4" onSubmit={event => void handleSubmit(event)}>
        {mode !== 'reset' && <label className="block space-y-1.5 text-sm font-medium">
          <span>{t('auth.email')}</span>
          <Input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
        </label>}
        {(mode === 'login' || mode === 'register' || mode === 'reset') && <label className="block space-y-1.5 text-sm font-medium">
          <span>{mode === 'reset' ? t('auth.newPassword') : t('auth.password')}</span>
          <Input type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={8} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} />
        </label>}
        {(mode === 'register' || mode === 'reset') && <label className="block space-y-1.5 text-sm font-medium">
          <span>{t('auth.confirmPassword')}</span>
          <Input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
        </label>}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
        {mode === 'recover' && !recoveryEnabled && <p className="text-sm text-muted-foreground">{t('auth.recoveryUnavailable')}</p>}

        <Button className="w-full" type="submit" disabled={submitting || (mode === 'recover' && !recoveryEnabled)}>
          {submitting && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {submitLabel}
        </Button>
      </form>

      <nav className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
        {mode === 'login' && <>
          {recoveryEnabled && <button type="button" className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => changeMode('recover')}>{t('auth.forgotPassword')}</button>}
          <button type="button" className="ml-auto text-primary underline-offset-4 hover:underline" onClick={() => changeMode('register')}>{t('auth.createAccount')}</button>
        </>}
        {mode === 'register' && <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => changeMode('login')}><ArrowLeft className="mr-1 inline size-3.5" aria-hidden="true" />{t('auth.backToLogin')}</button>}
        {mode === 'recover' && <button type="button" className="text-primary underline-offset-4 hover:underline" onClick={() => changeMode('login')}><ArrowLeft className="mr-1 inline size-3.5" aria-hidden="true" />{t('auth.backToLogin')}</button>}
        {mode === 'reset' && <span className="text-xs text-muted-foreground">{t('auth.resetExpiry')}</span>}
      </nav>
    </section>
  </main>;
}