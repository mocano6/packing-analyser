'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { ScoutingDebugLog } from '@/types/scouting';
import { formatDebugLogsForCopy } from '@/lib/scouting/debugLog';
import styles from './ScoutingDebugModal.module.css';

interface ScoutingDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ScoutingDebugLog[];
  onClear: () => void;
}

export default function ScoutingDebugModal({ isOpen, onClose, logs, onClear }: ScoutingDebugModalProps) {
  const text = useMemo(() => formatDebugLogsForCopy(logs), [logs]);
  const entryCount = useMemo(() => logs.reduce((n, l) => n + l.entries.length, 0), [logs]);

  const copyAll = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Skopiowano logi do schowka.');
    } catch {
      toast.error('Nie udało się skopiować — zaznacz tekst ręcznie.');
    }
  }, [text]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="scouting-debug-title">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <h2 id="scouting-debug-title">Logi debugowania scoutingu</h2>
            <p className={styles.sub}>
              {logs.length} operacji · {entryCount} wpisów — skopiuj i wklej w czacie, gdy coś nie działa.
            </p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Zamknij">
            ✕
          </button>
        </div>

        <textarea
          className={styles.logArea}
          readOnly
          value={text}
          aria-label="Logi zapytań scoutingu"
          onFocus={(e) => e.target.select()}
        />

        <div className={styles.footer}>
          <button type="button" className={styles.primaryBtn} onClick={copyAll}>
            Kopiuj wszystko
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              if (confirm('Wyczyścić zebrane logi?')) onClear();
            }}
          >
            Wyczyść logi
          </button>
          <button type="button" className={styles.secondaryBtn} onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
