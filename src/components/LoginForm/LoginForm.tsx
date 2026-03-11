'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthService } from '@/utils/authService';
import { getDB } from '@/lib/firebase';
import { doc, setDoc } from '@/lib/firestoreWithMetrics';
import { handleFirestoreError } from '@/utils/firestoreErrorHandler';
import { useAuth } from '@/hooks/useAuth';
import styles from './LoginForm.module.css';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const authService = AuthService.getInstance();
  const isClassicLoginView = searchParams.get('view') === 'login';

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      return;
    }
    if (userRole === 'player' && userStatus !== 'approved') {
      router.push('/oczekuje');
      return;
    }
    router.push('/');
  }, [isAuthenticated, authLoading, userRole, userStatus, router]);

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

        const registeredUser = await authService.registerWithEmail(email, password);
        const db = getDB();
        const userRef = doc(db, "users", registeredUser.uid);

        await setDoc(userRef, {
          email,
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
    } catch (err: any) {
      console.error('Błąd logowania:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Nie znaleziono użytkownika o tym adresie email');
      } else if (err.code === 'auth/wrong-password') {
        setError('Nieprawidłowe hasło');
      } else if (err.code === 'auth/invalid-email') {
        setError('Nieprawidłowy format adresu email');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Konto z tym adresem email już istnieje');
      } else if (err.code === 'auth/weak-password') {
        setError('Hasło jest zbyt słabe. Użyj co najmniej 6 znaków');
      } else {
        setError(err.message || 'Wystąpił błąd podczas logowania');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="top" className={styles.page}>
      {!isClassicLoginView && (
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

      {isClassicLoginView ? (
        <main className={styles.classicLoginMain}>
          <div className={styles.classicLoginContainer}>
            <div className={styles.classicLoginCard}>
              <div className={styles.classicHeader}>
                <h1 className={styles.classicTitle}>Packing Analyzer</h1>
                <p className={styles.classicSubtitle}>
                  {isRegistering ? 'Utwórz nowe konto' : 'Zaloguj się do aplikacji'}
                </p>
              </div>

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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={styles.classicInput}
                    placeholder="wprowadz@email.com"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={styles.classicInput}
                    placeholder="Wprowadź hasło"
                    disabled={isLoading}
                    required
                    minLength={6}
                  />
                </div>

                {error && <div className={styles.classicError}>{error}</div>}

                <button type="submit" className={styles.classicSubmitButton} disabled={isLoading}>
                  {isLoading ? <div className={styles.spinner} /> : isRegistering ? 'Utwórz konto' : 'Zaloguj się'}
                </button>

                <button
                  type="button"
                  className={styles.classicToggleButton}
                  onClick={() => {
                    setIsRegistering(!isRegistering);
                    setError(null);
                  }}
                  disabled={isLoading}
                >
                  {isRegistering ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
                </button>

                <button
                  type="button"
                  className={styles.backToLandingButton}
                  onClick={() => router.push('/login')}
                  disabled={isLoading}
                >
                  Powrót do landing page
                </button>
              </form>
            </div>
          </div>
        </main>
      ) : (
        <main className={styles.landing}>
          <section className={styles.hero}>
            <p className={styles.badge}>Nowa generacja analizy meczowej</p>
            <h1 className={styles.title}>Packing Analyzer.</h1>
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
                Zobacz, jak w 90 sekund Packing Analyzer zmienia sposób, w jaki patrzysz na mecz.
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