'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FirebaseError } from 'firebase/app';
import { fetchSignInMethodsForEmail } from 'firebase/auth';
import { AuthService } from '@/utils/authService';
import { getAuthClient, getDB } from '@/lib/firebase';
import { doc, setDoc } from '@/lib/firestoreWithMetrics';
import { handleFirestoreError } from '@/utils/firestoreErrorHandler';
import { useAuth } from '@/hooks/useAuth';
import { authLoginErrorMessage } from '@/utils/authLoginErrorMessage';
import { passwordLoginBlockedByGoogleOnlyProvider } from '@/utils/passwordLoginHintFromSignInMethods';
import { readGoogleLinkDataFromAccountExistsError } from '@/utils/googleAccountLinkFromError';
import { normalizeAuthEmail } from '@/utils/normalizeAuthEmail';
import styles from './LoginForm.module.css';
import type { AuthCredential } from 'firebase/auth';
import toast from 'react-hot-toast';

/** Tymczasowo wyłączone — / to logowanie; pełny marketingowy landing włączysz tu później. */
const LANDING_VISIBLE = false;

export default function LoginForm() {
  const { isAuthenticated, isLoading: authLoading, userRole, userStatus, refreshUserData } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingGoogleLink, setPendingGoogleLink] = useState<{
    credential: AuthCredential;
    email: string;
  } | null>(null);
  const [linkPassword, setLinkPassword] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const authService = AuthService.getInstance();
  const isClassicLoginView = searchParams.get('view') === 'login';
  const showClassicLogin = LANDING_VISIBLE ? isClassicLoginView : true;

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }
    if (userRole === 'player' && userStatus !== 'approved') {
      if (process.env.NODE_ENV === 'development') {
        window.location.assign('/oczekuje');
        return;
      }
      router.push('/oczekuje');
      return;
    }
    /* W dev pełny load — inaczej często 404 na /_next/static (?v=) po restarcie serwera / długiej sesji karty. */
    if (process.env.NODE_ENV === 'development') {
      window.location.assign('/analyzer');
      return;
    }
    router.push("/analyzer");
  }, [isAuthenticated, authLoading, userRole, userStatus, router]);

  useEffect(() => {
    if (isRegistering) {
      setPendingGoogleLink(null);
      setLinkPassword('');
    }
  }, [isRegistering]);

  const cancelPendingGoogleLink = () => {
    setPendingGoogleLink(null);
    setLinkPassword('');
    setError(null);
  };

  const handleCompleteGoogleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingGoogleLink) {
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await authService.linkGoogleCredentialAfterEmailPassword(
        pendingGoogleLink.email,
        linkPassword,
        pendingGoogleLink.credential,
      );
      setPendingGoogleLink(null);
      setLinkPassword('');
      await refreshUserData();
    } catch (err: unknown) {
      console.error('Błąd powiązania Google:', err);
      setError(authLoginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        const trimmedFirstName = firstName.trim();
        const trimmedLastName = lastName.trim();
        const parsedBirthYear = Number.parseInt(birthYear, 10);
        const currentYear = new Date().getFullYear();

        if (!trimmedFirstName || !trimmedLastName || !birthYear) {
          throw new Error('Wprowadź imię, nazwisko oraz rok urodzenia');
        }

        if (!Number.isFinite(parsedBirthYear) || parsedBirthYear < 1900 || parsedBirthYear > currentYear) {
          throw new Error('Podaj poprawny rok urodzenia');
        }

        if (!email || !password) {
          throw new Error('Wprowadź email i hasło');
        }

        const regEmail = normalizeAuthEmail(email);
        const registeredUser = await authService.registerWithEmail(regEmail, password);
        const db = getDB();
        const userRef = doc(db, "users", registeredUser.uid);

        await setDoc(userRef, {
          email: regEmail,
          role: 'player',
          status: 'pending',
          linkedPlayerId: null,
          allowedTeams: [],
          registrationData: {
            firstName: trimmedFirstName,
            lastName: trimmedLastName,
            birthYear: parsedBirthYear
          },
          createdAt: new Date(),
          lastLogin: new Date()
        }, { merge: true }).catch(error => {
          handleFirestoreError(error, db);
          throw error;
        });

        await refreshUserData();
      } else {
        if (!email || !password) {
          throw new Error('Wprowadź email i hasło');
        }
        await authService.signInWithEmail(email, password);
      }
    } catch (err: unknown) {
      console.error("Błąd logowania:", err);

      const code = err instanceof FirebaseError ? err.code : null;
      const trimmedEmail = normalizeAuthEmail(email);
      const trySignInMethodsHint =
        !isRegistering &&
        trimmedEmail.length > 0 &&
        (code === "auth/invalid-login-credentials" ||
          code === "auth/invalid-credential" ||
          code === "auth/wrong-password" ||
          code === "auth/user-not-found");

      if (trySignInMethodsHint) {
        try {
          const methods = await fetchSignInMethodsForEmail(getAuthClient(), trimmedEmail);
          const googleOnly = passwordLoginBlockedByGoogleOnlyProvider(methods);
          if (googleOnly) {
            setError(googleOnly);
            return;
          }
        } catch {
          /* ochrona przed enumeracją / sieć — standardowy komunikat */
        }
      }

      setError(authLoginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
      await authService.signInWithGoogle();
    } catch (err: unknown) {
      console.error("Błąd logowania Google:", err);
      const linkData = readGoogleLinkDataFromAccountExistsError(err);
      if (linkData) {
        setPendingGoogleLink({
          credential: linkData.credential,
          email: linkData.email,
        });
        setEmail(linkData.email);
        setLinkPassword('');
        setError(null);
      } else {
        setError(authLoginErrorMessage(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordResetRequest = async () => {
    const normalized = normalizeAuthEmail(email);
    if (!normalized) {
      setError('Podaj adres e-mail w polu powyżej — wyślemy link do ustawienia hasła.');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      await authService.sendPasswordResetEmail(normalized);
      toast.success(
        'Jeśli konto z tym adresem istnieje, Firebase wysłał wiadomość z linkiem do resetu hasła. Sprawdź skrzynkę i folder spam.',
        { duration: 6000 },
      );
    } catch (err: unknown) {
      console.error('Reset hasła:', err);
      setError(authLoginErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="top" className={styles.page}>
      {LANDING_VISIBLE && !isClassicLoginView && (
        <aside className={styles.loginCorner} aria-label="Przejście do logowania">
          <p className={styles.cornerTitle}>Masz konto?</p>
          <button
            type="button"
            className={styles.cornerLoginButton}
            onClick={() => router.push('/login?view=login')}
          >
            Zaloguj
          </button>
        </aside>
      )}

      {showClassicLogin ? (
        <main
          className={styles.classicLoginMain}
          aria-labelledby="login-page-title"
        >
          <div className={styles.classicLoginBackdrop} aria-hidden="true" />
          <div className={styles.classicLoginContainer}>
            <div className={styles.classicLoginCard}>
              <header className={styles.classicHeader}>
                <div className={styles.classicBrand}>
                  <Image
                    src="/logo.png"
                    alt=""
                    width={88}
                    height={88}
                    className={styles.classicLogo}
                    priority
                    unoptimized
                  />
                  <span className={styles.classicWordmark}>LOOKBALL</span>
                </div>
                <h1 id="login-page-title" className={styles.classicHeadline}>
                  {isRegistering ? 'Utwórz konto' : 'Zaloguj się'}
                </h1>
                <p className={styles.classicSubtitle}>
                  {isRegistering
                    ? 'Po rejestracji konto wymaga akceptacji przez administratora.'
                    : 'Zaloguj się przez Google lub e-mail, aby przejść do aplikacji.'}
                </p>
              </header>

              {!isRegistering && pendingGoogleLink ? (
                <div className={styles.classicLinkPanel}>
                  <p className={styles.classicLinkHint} id="google-link-desc">
                    To konto ma już logowanie e-mail i hasłem. Wpisz to samo hasło, aby połączyć Google
                    z tym kontem — potem zalogujesz się tak jak dotąd e-mailem albo przez Google.
                  </p>
                  <form onSubmit={handleCompleteGoogleLink} className={styles.classicLinkForm}>
                    <div className={styles.classicInputGroup}>
                      <label htmlFor="link-email" className={styles.classicLabel}>
                        E-mail
                      </label>
                      <input
                        id="link-email"
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={pendingGoogleLink.email}
                        readOnly
                        className={`${styles.classicInput} ${styles.classicInputReadonly}`}
                        aria-describedby="google-link-desc"
                      />
                    </div>
                    <div className={styles.classicInputGroup}>
                      <label htmlFor="link-password" className={styles.classicLabel}>
                        Hasło do konta
                      </label>
                      <input
                        id="link-password"
                        type="password"
                        name="password"
                        autoComplete="current-password"
                        value={linkPassword}
                        onChange={(e) => setLinkPassword(e.target.value)}
                        className={styles.classicInput}
                        placeholder="Hasło, którego używasz przy logowaniu e-mail"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    {error ? (
                      <div className={styles.classicError} role="alert">
                        {error}
                      </div>
                    ) : null}
                    <div className={styles.classicLinkActions}>
                      <button
                        type="submit"
                        className={styles.classicSubmitButton}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <span className={styles.spinnerWrap}>
                            <span className={styles.spinner} aria-hidden />
                            <span className={styles.srOnly}>Trwa przetwarzanie…</span>
                          </span>
                        ) : (
                          'Połącz Google i zaloguj'
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.classicToggleButton}
                        onClick={cancelPendingGoogleLink}
                        disabled={isLoading}
                      >
                        Anuluj
                      </button>
                    </div>
                  </form>
                </div>
              ) : !isRegistering ? (
                <div className={styles.classicOAuth}>
                  <button
                    type="button"
                    className={styles.googleButton}
                    onClick={handleGoogleSignIn}
                    disabled={isLoading}
                    aria-label="Kontynuuj z Google"
                  >
                    <span className={styles.googleIcon} aria-hidden>
                      <svg width={20} height={20} viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                    </span>
                    <span>Kontynuuj z Google</span>
                  </button>
                  <div className={styles.classicDivider} role="presentation">
                    <span className={styles.classicDividerLine} />
                    <span className={styles.classicDividerText}>lub</span>
                    <span className={styles.classicDividerLine} />
                  </div>
                </div>
              ) : null}

              {(isRegistering || !pendingGoogleLink) ? (
              <form onSubmit={handleSubmit} className={styles.classicForm}>
                {isRegistering && (
                  <>
                    <div className={styles.classicInputGroup}>
                      <label htmlFor="firstName" className={styles.classicLabel}>
                        Imię
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        name="given-name"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={styles.classicInput}
                        placeholder="Wpisz imię"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <div className={styles.classicInputGroup}>
                      <label htmlFor="lastName" className={styles.classicLabel}>
                        Nazwisko
                      </label>
                      <input
                        id="lastName"
                        type="text"
                        name="family-name"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={styles.classicInput}
                        placeholder="Wpisz nazwisko"
                        disabled={isLoading}
                        required
                      />
                    </div>
                    <div className={styles.classicInputGroup}>
                      <label htmlFor="birthYear" className={styles.classicLabel}>
                        Rok urodzenia
                      </label>
                      <input
                        id="birthYear"
                        type="number"
                        name="bday-year"
                        autoComplete="bday-year"
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        className={styles.classicInput}
                        placeholder="np. 2006"
                        disabled={isLoading}
                        required
                        min={1900}
                        max={new Date().getFullYear()}
                        inputMode="numeric"
                      />
                    </div>
                  </>
                )}

                <div className={styles.classicInputGroup}>
                  <label htmlFor="email" className={styles.classicLabel}>
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.classicInput}
                    placeholder="twoj@email.com"
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className={styles.classicInputGroup}>
                  <label htmlFor="password" className={styles.classicLabel}>
                    Hasło
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    autoComplete={isRegistering ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.classicInput}
                    placeholder={isRegistering ? 'Minimum 6 znaków' : 'Twoje hasło'}
                    disabled={isLoading}
                    required
                    minLength={isRegistering ? 6 : undefined}
                  />
                </div>

                {!isRegistering ? (
                  <div className={styles.forgotPasswordRow}>
                    <button
                      type="button"
                      className={styles.forgotPasswordButton}
                      onClick={handlePasswordResetRequest}
                      disabled={isLoading}
                    >
                      Nie pamiętasz hasła? Wyślij link resetujący
                    </button>
                  </div>
                ) : null}

                {error && !pendingGoogleLink ? (
                  <div className={styles.classicError} role="alert">
                    {error}
                  </div>
                ) : null}

                <div className={styles.classicFormActions}>
                  <button
                    type="submit"
                    className={styles.classicSubmitButton}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className={styles.spinnerWrap}>
                        <span className={styles.spinner} aria-hidden />
                        <span className={styles.srOnly}>Trwa przetwarzanie…</span>
                      </span>
                    ) : isRegistering ? (
                      'Utwórz konto'
                    ) : (
                      'Zaloguj się'
                    )}
                  </button>
                </div>

                <div className={styles.classicFooter}>
                  <button
                    type="button"
                    className={styles.classicToggleButton}
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setError(null);
                    }}
                    disabled={isLoading}
                  >
                    {isRegistering ? (
                      <>
                        Masz już konto?{' '}
                        <span className={styles.classicToggleEmphasis}>Zaloguj się</span>
                      </>
                    ) : (
                      <>
                        Nie masz konta?{' '}
                        <span className={styles.classicToggleEmphasis}>
                          Zarejestruj się
                        </span>
                      </>
                    )}
                  </button>
                </div>

                {LANDING_VISIBLE && (
                  <button
                    type="button"
                    className={styles.backToLandingButton}
                    onClick={() => router.push('/login')}
                    disabled={isLoading}
                  >
                    Powrót do strony głównej
                  </button>
                )}
              </form>
              ) : null}
            </div>
          </div>
        </main>
      ) : (
        <main className={styles.landing}>
          <section className={styles.hero}>
            <Image
              src="/logo.png"
              alt="LOOKBALL"
              width={88}
              height={88}
              className={styles.heroLogo}
              priority
              unoptimized
            />
            <p className={styles.badge}>Nowa generacja analizy meczowej</p>
            <h1 className={styles.title}>LOOKBALL.</h1>
            <h2 className={styles.titleSecondary}>Przewaga w każdym detalu.</h2>
            <p className={styles.subtitle}>
              Platforma dla sztabów i akademii, która zamienia surowe akcje meczowe w konkretne decyzje
              treningowe. Szybciej widzisz, co działa, a co kosztuje zespół punkty.
            </p>
            <div className={styles.heroActions}>
              <a href="#pricing" className={styles.primaryAction}>
                Sprawdź dostępność
              </a>
              <a href="#video-demo" className={styles.secondaryAction}>
                Obejrzyj demo <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className={styles.kpiGrid} aria-label="Kluczowe wskaźniki">
              <article>
                <strong>+42%</strong>
                <span>szybsze przygotowanie odprawy</span>
              </article>
              <article>
                <strong>3 min</strong>
                <span>do pełnego raportu meczu</span>
              </article>
              <article>
                <strong>1 panel</strong>
                <span>dla trenera i analityka</span>
              </article>
            </div>
          </section>

          <section className={styles.trustedBySection} aria-label="Zaufali nam">
            <p className={styles.trustedLabel}>Zaufali nam profesjonaliści z:</p>
            <div className={styles.trustedLogos}>
              <div className={styles.trustedLogo}>
                <span className={styles.trustedName}>Akademia Raków Częstochowa</span>
              </div>
              <div className={styles.trustedDivider} aria-hidden="true"></div>
              <div className={styles.trustedLogo}>
                <span className={styles.trustedName}>Polonia Bytom</span>
                <span className={styles.trustedSub}>Pierwszy zespół</span>
              </div>
            </div>
          </section>

          <section id="video-demo" className={styles.videoSection} aria-labelledby="video-section-title">
            <div className={styles.sectionHeaderCenter}>
              <h2 id="video-section-title" className={styles.sectionTitle}>
                Krótkie wideo o aplikacji
              </h2>
              <p className={styles.sectionLead}>
                Zobacz, jak w 90 sekund LOOKBALL zmienia sposób, w jaki patrzysz na mecz.
              </p>
            </div>
            <div className={styles.videoPlaceholder}>
              <div className={styles.playButton} aria-hidden="true">
                ▶
              </div>
              <div className={styles.videoTextContent}>
                <p className={styles.placeholderTitle}>Odtwórz film prezentujący produkt</p>
                <p className={styles.placeholderText}>
                  Poznaj kluczowe funkcje: analizę packingu, wejścia w tercje i profile zawodników.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.featureBand} aria-label="Główne korzyści">
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>🎯</div>
              <h3>Analiza bez chaosu</h3>
              <p>Wszystkie akcje i metryki meczowe masz w jednej spójnej osi czasu. Zero szumu, same konkrety.</p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>⚡️</div>
              <h3>Szybkie decyzje sztabu</h3>
              <p>Najważniejsze sygnały są od razu widoczne, bez ręcznego filtrowania danych w arkuszach.</p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>📊</div>
              <h3>Raport gotowy dla zespołu</h3>
              <p>Jednym kliknięciem przechodzisz od surowych danych do prezentacji gotowej na odprawę.</p>
            </article>
          </section>

          <section className={styles.screenshotsSection} aria-labelledby="screenshots-title">
            <div className={styles.sectionHeaderCenter}>
              <h2 id="screenshots-title" className={styles.sectionTitle}>
                Zaprojektowany dla profesjonalistów.
              </h2>
              <p className={styles.sectionLead}>
                Interfejs, który nie przeszkadza. Skup się na taktyce, nie na oprogramowaniu.
              </p>
            </div>
            <div className={styles.screenshotGrid}>
              <article className={styles.screenshotCard}>
                <div className={styles.screenshotPreview}>WIDOK MECZU</div>
                <div className={styles.screenshotContent}>
                  <h3>Dashboard meczowy</h3>
                  <p>Akcje, timeline i najważniejsze zdarzenia w jednym miejscu.</p>
                </div>
              </article>
              <article className={styles.screenshotCard}>
                <div className={styles.screenshotPreview}>STATYSTYKI</div>
                <div className={styles.screenshotContent}>
                  <h3>Panel taktyczny</h3>
                  <p>Statystyki tercji, przebieg faz gry i porównanie okresów meczu.</p>
                </div>
              </article>
              <article className={styles.screenshotCard}>
                <div className={styles.screenshotPreview}>ZAWODNIK</div>
                <div className={styles.screenshotContent}>
                  <h3>Karta zawodnika</h3>
                  <p>Indywidualna efektywność i trendy dla mikrocyklu treningowego.</p>
                </div>
              </article>
              <article className={styles.screenshotCard}>
                <div className={styles.screenshotPreview}>MAPA</div>
                <div className={styles.screenshotContent}>
                  <h3>Mapa działań</h3>
                  <p>Przestrzenne spojrzenie na decyzje i skuteczność pod pressingiem.</p>
                </div>
              </article>
            </div>
          </section>

          <section className={styles.workflowSection} aria-labelledby="workflow-title">
            <div className={styles.sectionHeaderCenter}>
              <h2 id="workflow-title" className={styles.sectionTitle}>
                Prosty proces. Potężne efekty.
              </h2>
            </div>
            <div className={styles.workflowGrid}>
              <article>
                <span>01</span>
                <h3>Wczytaj dane</h3>
                <p>Podłącz dane meczowe i od razu uzyskaj porządek w kluczowych akcjach.</p>
              </article>
              <article>
                <span>02</span>
                <h3>Analizuj sygnały</h3>
                <p>Wyszukuj wzorce, które realnie wpływają na wynik spotkania.</p>
              </article>
              <article>
                <span>03</span>
                <h3>Wyciągaj decyzje</h3>
                <p>Przekładaj insighty na konkretne wnioski dla zespołu i zawodników.</p>
              </article>
            </div>
          </section>

          <section id="pricing" className={styles.pricingSection} aria-labelledby="pricing-title">
            <div className={styles.pricingHeader}>
              <h2 id="pricing-title" className={styles.sectionTitle}>
                Cennik
              </h2>
              <p className={styles.sectionLead}>
                Najbardziej zaawansowane narzędzie wkrótce dostępne dla Twojego klubu.
              </p>
            </div>
            <div className={styles.pricingCardContainer}>
              <article className={styles.pricingCard}>
                <p className={styles.planName}>Pakiet Pro</p>
                <p className={styles.price}>Wkrótce</p>
                <p className={styles.priceDescription}>
                  Trwają ostatnie testy. Zostaw kontakt, aby otrzymać wczesny dostęp i specjalną ofertę na start.
                </p>
                <a href="#top" className={styles.ctaButton}>
                  Powiadom mnie o starcie
                </a>
              </article>
            </div>
          </section>
        </main>
      )}
    </div>
  );
}