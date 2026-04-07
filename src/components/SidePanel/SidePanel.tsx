'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './SidePanel.module.css';
import ExportButton from '../ExportButton/ExportButton';
import ImportButton from '../ImportButton/ImportButton';
import { usePresentationMode } from '@/contexts/PresentationContext';
import { Player, Action, TeamInfo } from '@/types';
import toast from 'react-hot-toast';

interface SidePanelProps {
  players: Player[];
  actions: Action[];
  matchInfo: TeamInfo | null;
  isAdmin: boolean;
  userRole?: 'user' | 'admin' | 'coach' | 'player' | null;
  linkedPlayerId?: string | null;
  selectedTeam: string;
  onRefreshData: () => Promise<void>;
  onImportSuccess: (data: { players: Player[], actions: Action[], matchInfo: any }) => void;
  onImportError: (error: string) => void;
  onLogout: () => void;
}

const SidePanel: React.FC<SidePanelProps> = ({
  players,
  actions,
  matchInfo,
  isAdmin,
  userRole,
  linkedPlayerId,
  selectedTeam,
  onRefreshData,
  onImportSuccess,
  onImportError,
  onLogout
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { isPresentationMode, togglePresentationMode } = usePresentationMode();
  const pathname = usePathname();
  /** Tylko jawna rola `player` — bez `userRole` (undefined) nie zawężamy menu (undefined == null psuło strony bez propsa). */
  const isPlayer = userRole === 'player';

  const handleRefreshClick = async () => {
    try {
      await onRefreshData();
      toast.success("Dane zostały odświeżone z Firebase");
    } catch (error) {
      toast.error("Błąd podczas odświeżania danych");
    }
  };

  return (
    <>
      {/* Trigger button */}
      <div 
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.triggerIcon}>☰</span>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div 
          className={styles.overlay}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Side panel */}
      <div 
        className={`${styles.panel} ${isOpen ? styles.panelOpen : ''}`}
      >
        <div className={styles.header}>
          <Link href={isPlayer && linkedPlayerId ? `/profile/${linkedPlayerId}` : isPlayer ? '/profile' : '/analyzer'} className={styles.homeButton}>
            <svg className={styles.homeIcon} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 1L2 6V14H6V10H10V14H14V6L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </Link>
          <h3>Menu aplikacji</h3>
          <button 
            className={styles.closeButton}
            onClick={() => setIsOpen(false)}
          >
            ×
          </button>
        </div>

        <div className={styles.content}>
          {/* Sekcja Statystyki */}
          <div className={styles.section}>
            <h4>📊 Statystyki</h4>
            {isPlayer ? (
              <Link href={linkedPlayerId ? `/profile/${linkedPlayerId}` : '/profile'} className={styles.menuItem}>
                <span className={styles.icon}>👤</span>
                <span>Profil zawodnika</span>
              </Link>
            ) : (
              <>
                {userRole !== 'coach' && userRole !== 'player' && (
                  <Link href="/zawodnicy" className={styles.menuItem}>
                    <span className={styles.icon}>👥</span>
                    <span>Statystyki zawodników</span>
                  </Link>
                )}
                <Link href="/statystyki-zespolu" className={styles.menuItem}>
                  <span className={styles.icon}>📊</span>
                  <span>Statystyki zespołu</span>
                </Link>
                <Link href="/trendy" className={styles.menuItem}>
                  <span className={styles.icon}>📈</span>
                  <span>Trendy</span>
                </Link>
                <Link href={players.length > 0 ? "/profile" : "/zawodnicy"} className={styles.menuItem}>
                  <span className={styles.icon}>👤</span>
                  <span>Profil zawodnika</span>
                </Link>
                {userRole !== 'player' && (
                  <Link href="/gps" className={styles.menuItem}>
                    <span className={styles.icon}>📍</span>
                    <span>Dane GPS</span>
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Sekcja Admin (tylko dla adminów) */}
          {isAdmin && (
            <div className={styles.section}>
              <h4>⚙️ Administracja</h4>
              <Link href="/lista-zawodnikow" className={styles.menuItem}>
                <span className={styles.icon}>📋</span>
                <span>Lista wszystkich zawodników</span>
              </Link>
              <Link href="/weryfikacja-meczow" className={styles.menuItem}>
                <span className={styles.icon}>🔍</span>
                <span>Weryfikacja meczów</span>
              </Link>
              <Link href="/admin/wiedza" className={styles.menuItem}>
                <span className={styles.icon}>🧠</span>
                <span>Baza Wiedzy</span>
              </Link>
              <Link href="/admin/kpi" className={styles.menuItem}>
                <span className={styles.icon}>🎯</span>
                <span>KPI trendów</span>
              </Link>
              <Link href="/admin" className={styles.menuItem}>
                <span className={styles.icon}>⚙️</span>
                <span>Panel administratora</span>
              </Link>
              <Link href="/admin/zadania" className={styles.menuItem}>
                <span className={styles.icon}>✅</span>
                <span>Zadania</span>
              </Link>
              <button 
                onClick={togglePresentationMode} 
                className={styles.menuItem}
              >
                <span className={styles.icon}>{isPresentationMode ? '👁️' : '🙈'}</span>
                <span>{isPresentationMode ? 'Wyłącz maskowanie' : 'Maskuj dane (Prezentacja)'}</span>
              </button>
            </div>
          )}

          {/* Sekcja Narzędzia - tylko dla admin/user (ukryta dla coach i player) */}
          {!isPlayer && userRole !== 'coach' && userRole !== 'player' && (
            <div className={styles.section}>
              <h4>🔧 Narzędzia</h4>
              <button 
                onClick={handleRefreshClick}
                className={styles.menuItem}
              >
                <span className={styles.icon}>🔄</span>
                <span>Odśwież dane</span>
              </button>
              
              <div className={styles.exportImportWrapper}>
                <ExportButton
                  players={players}
                  actions={actions}
                  matchInfo={matchInfo}
                />
              </div>
              
              <div className={styles.exportImportWrapper}>
                <ImportButton 
                  onImportSuccess={onImportSuccess}
                  onImportError={onImportError}
                />
              </div>
            </div>
          )}

          {/* Sekcja Konto */}
          <div className={styles.section}>
            <h4>👤 Konto</h4>
            <button 
              onClick={onLogout}
              className={`${styles.menuItem} ${styles.logoutItem}`}
            >
              <span className={styles.icon}>🚪</span>
              <span>Wyloguj się</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SidePanel; 