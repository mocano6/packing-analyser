// src/components/Instructions/Instructions.tsx
"use client";

import React, { useState, useMemo } from "react";
import styles from "./Instructions.module.css";

export default function Instructions() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState("basic");

  // Używamy useMemo dla sekcji, które nie zmieniają się przy renderowaniu
  const sections = useMemo(
    () => ({
      basic: {
        title: "Podstawy analizy",
        content: (
          <>
            <div className={styles.instructionStep}>
              <div className={styles.stepNumber}>1</div>
              <div className={styles.stepContent}>
                <h4>Przygotowanie meczu</h4>
                <p>Wybierz drużynę i stwórz nowy mecz, wprowadzając przeciwnika i inne dane.</p>
              </div>
            </div>
            
            <div className={styles.instructionStep}>
              <div className={styles.stepNumber}>2</div>
              <div className={styles.stepContent}>
                <h4>Rejestrowanie akcji</h4>
                <ul>
                  <li>Kliknij na <strong>strefę początkową</strong> na boisku (skąd zaczyna się akcja)</li>
                  <li>Następnie kliknij na <strong>strefę końcową</strong> na boisku (gdzie kończy się akcja)</li>
                  <li>W otwartym oknie <strong>wybierz zawodnika rozpoczynającego</strong> akcję</li>
                  <li>Wybierz <strong>zawodnika kończącego</strong> akcję (przy podaniu) lub zaznacz zawodnika dryblującego</li>
                  <li>Ustaw <strong>minutę meczu</strong> (0-90+)</li>
                  <li>Dodaj punkty packing i opcjonalne dodatkowe parametry akcji</li>
                </ul>
              </div>
            </div>
            
            <div className={styles.instructionStep}>
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepContent}>
                <h4>Dodatkowe opcje</h4>
                <ul>
                  <li><strong>P3</strong> - podanie za linię obrony</li>
                  <li><strong>Strzał</strong> - zaznacz, jeśli akcja kończy się strzałem</li>
                  <li><strong>Gol</strong> - zaznacz, jeśli akcja kończy się golem</li>
                  <li><strong>Wejście w pole karne</strong> - podanie lub drybling w pole karne</li>
                </ul>
              </div>
            </div>
          </>
        ),
      },
      scoring: {
        title: "System punktacji",
        content: (
          <>
            <div className={styles.cardInfo}>
              <h4>Punkty Packing</h4>
              <p>Punkty są przyznawane automatycznie w oparciu o:</p>
              <ul>
                <li>Liczbę ominętych zawodników</li>
                <li>Pozycję na boisku (strefy)</li>
                <li>Jakość wykonania podania</li>
              </ul>
            </div>
            
            <div className={styles.cardInfo}>
              <h4>Expected Threat (xT)</h4>
              <p>Wartość odzwierciedlająca potencjał bramkowy danej strefy boiska.</p>
              <ul>
                <li>Wyższe wartości xT bliżej bramki przeciwnika</li>
                <li>Służy jako mnożnik wartości punktów packing</li>
                <li>Pomaga ocenić efektywność akcji w kontekście strategicznym</li>
              </ul>
            </div>
            
            <div className={styles.cardInfo}>
              <h4>Definicje podań P3, P2, P1</h4>
              <ul>
                <li><strong>P3:</strong> W maksymalnie 2 kontakcie zawodnik ma znaleźć się za linią obrony, inaczej P2.</li>
                <li><strong>P2:</strong> Pomiędzy linią obrony, a pomocy. Patrzymy, żeby był za 6ką najbliżej linii obrony.</li>
                <li><strong>P1:</strong> Przestrzeń za napastnikami, ale przed ŚP (środkowym pomocnikiem).</li>
              </ul>
            </div>
            
            <div className={styles.cardInfo}>
              <h4>Dodatkowe metryki</h4>
              <ul>
                <li><strong>Podania P3:</strong> Podania za linię obrony (wyższy współczynnik)</li>
                <li><strong>Wejścia w pole karne:</strong> Akcje kończące się w polu karnym</li>
                <li><strong>Strzały i gole:</strong> Finalizacja akcji</li>
              </ul>
            </div>
          </>
        ),
      },
      data: {
        title: "Zarządzanie danymi",
        content: (
          <>
            <div className={styles.dataSection}>
              <h4>Eksport danych <span className={styles.iconSmall}>📤</span></h4>
              <p>Regularnie eksportuj dane meczu, aby zabezpieczyć swoją pracę:</p>
              <ol>
                <li>Kliknij przycisk <strong>Eksportuj dane</strong> na dole strony</li>
                <li>Plik JSON zostanie pobrany na twoje urządzenie</li>
                <li>Zawiera wszystkie dane meczu, zawodników i akcji</li>
                <li>Plik nazwany jest automatycznie według wzoru: <code>packing_[drużyna]_vs_[przeciwnik]_[data].json</code></li>
              </ol>
            </div>
            
            <div className={styles.dataSection}>
              <h4>Import danych <span className={styles.iconSmall}>📥</span></h4>
              <p>Przywracaj dane z wcześniej zapisanych plików:</p>
              <ol>
                <li>Kliknij przycisk <strong>Importuj dane</strong> na dole strony</li>
                <li>Wybierz plik JSON z eksportowanymi wcześniej danymi</li>
                <li>Dane zostaną zaimportowane do aplikacji</li>
                <li>Istniejące dane nie zostaną nadpisane, tylko uzupełnione</li>
              </ol>
            </div>
            
            <div className={styles.dataNote}>
              <p><strong>Uwaga:</strong> Zalecamy regularne eksportowanie danych po każdym meczu lub nawet w trakcie dłuższych meczów, aby zabezpieczyć się przed utratą danych.</p>
            </div>
          </>
        ),
      },
      methodology: {
        title: "Metodologia Packingu",
        content: (
          <>
            <div className={styles.cardInfo}>
              <h4>Kiedy zaliczamy packing? ✅</h4>
              <div className={styles.methodologyRule}>
                <span className={styles.ruleIcon}>✅</span>
                <p><strong>Podanie do stopy kolegi:</strong> Jeśli podanie (głową, wybicie, czy świadome podanie) trafia bezpośrednio do stopy kolegi z drużyny - packing zaliczamy.</p>
              </div>
              
              <div className={styles.methodologyRule}>
                <span className={styles.ruleIcon}>✅</span>
                <p><strong>Kontakt z inną częścią ciała + stopa:</strong> Jeśli po kontakcie piłki z głową, klatką piersiową, kolanem lub inną częścią ciała, piłka następnie zostanie przyjęta stopą - packing zaliczamy.</p>
              </div>
              
              <div className={styles.methodologyRule}>
                <span className={styles.ruleIcon}>✅</span>
                <p><strong>Przedłużenie głową do kolegi:</strong> Jeśli zawodnik przedłuży piłkę głową, a następny kontakt będzie stopą innego zawodnika z drużyny - packing zaliczamy.</p>
              </div>
            </div>

            <div className={styles.cardInfo}>
              <h4>Kiedy NIE zaliczamy packingu? ❌</h4>
              <div className={styles.methodologyRule}>
                <span className={styles.ruleIcon}>❌</span>
                <p><strong>Brak kontaktu ze stopą:</strong> Jeśli po podaniu nie ma kontaktu ze stopą (tylko głowa, klatka, kolano) i następuje strata piłki - packing NIE zaliczony.</p>
              </div>
            </div>

            <div className={styles.packingNote}>
              <p><strong>Kluczowa zasada:</strong> Packing zaliczamy tylko wtedy, gdy w akcji uczestniczy stopa zawodnika przyjmującego piłkę, niezależnie od tego, czy wcześniej piłka miała kontakt z innymi częściami ciała.</p>
            </div>
          </>
        ),
      },
      tips: {
        title: "Wskazówki",
        content: (
          <>
            <div className={styles.tipsGrid}>
              <div className={styles.tipCard}>
                <span className={styles.tipIcon}>🎯</span>
                <h4>Dokładność analizy</h4>
                <p>Nie liczymy podań, które nie są w przód, i tych, które nie mijają żadnego zawodnika. Liczymy packing i xT na wysokości pola karnego, także w poprzek (w kierunku bramki).</p>
              </div>
              
              <div className={styles.tipCard}>
                <span className={styles.tipIcon}>⏱️</span>
                <h4>Zarządzanie czasem</h4>
                <p>Po zapisaniu akcji minuta pozostaje niezmieniona, co ułatwia wprowadzanie serii podań z tego samego momentu meczu.</p>
              </div>
              
              <div className={styles.tipCard}>
                <span className={styles.tipIcon}>🔄</span>
                <h4>Regularne kopie zapasowe</h4>
                <p>Eksportuj dane po każdym meczu lub w jego trakcie. Import pozwala przywrócić dane w przypadku problemów.</p>
              </div>
              
              <div className={styles.tipCard}>
                <span className={styles.tipIcon}>📊</span>
                <h4>Analiza połączeń</h4>
                <p>Zwracaj uwagę na połączenia między zawodnikami w sekcji statystyk, aby identyfikować najskuteczniejsze schematy podań.</p>
              </div>
            </div>
          </>
        ),
      },
    }),
    []
  );

  // Optymalizacja: wydzielamy komponent przycisków sekcji dla lepszej czytelności
  const SectionTabs = () => (
    <div className={styles.sectionTabs}>
      {Object.entries(sections).map(([key, section]) => (
        <button
          key={key}
          className={`${styles.sectionTab} ${
            activeSection === key ? styles.activeTab : ""
          }`}
          onClick={() => setActiveSection(key)}
        >
          {section.title}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <button
        className={styles.iconButton}
        onClick={() => setIsExpanded(true)}
        aria-label="Pokaż instrukcję"
        title="Pokaż instrukcję"
      >
        <svg 
          className={styles.infoIcon}
          viewBox="0 0 24 24" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="#2196f3" strokeWidth="2" fill="none"/>
          <text 
            x="12" 
            y="18" 
            textAnchor="middle" 
            fill="#2196f3" 
            fontSize="16" 
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            i
          </text>
        </svg>
      </button>

      {isExpanded && (
        <div className={styles.modalOverlay} onClick={() => setIsExpanded(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.modalCloseButton}
              onClick={() => setIsExpanded(false)}
              aria-label="Zamknij instrukcję"
            >
              ×
            </button>
            
            <div className={styles.instructionsContent}>
              <SectionTabs />

              <div className={styles.instructionsList}>
                <h3>{sections[activeSection as keyof typeof sections].title}</h3>
                {sections[activeSection as keyof typeof sections].content}
              </div>

              <div className={styles.instructionFooter}>
                <div className={styles.tip}>
                  <span className={styles.tipIcon}>💡</span>
                  <p>
                    Dokładna i konsekwentna analiza podań pozwoli na uzyskanie
                    wartościowych danych o stylu gry drużyny i skuteczności
                    zawodników.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
