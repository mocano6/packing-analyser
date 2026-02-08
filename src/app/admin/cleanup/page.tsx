'use client';

import { useMemo, useState } from 'react';
import { collection, getDocs, doc, setDoc } from '@/lib/firestoreWithMetrics';
import { getDB } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import styles from './cleanup.module.css';

const FORBIDDEN_PII_FIELDS = [
  'firstName',
  'lastName',
  'name',
  'birthYear',
  'number',
  'playerName',
  'senderName',
  'receiverName',
  'assistantName',
  'senderNumber',
  'receiverNumber'
];

const BASE_COLLECTIONS = ['matches', 'gps'];
const ARCHIVE_COLLECTIONS = ['players', 'matches', 'gps', 'actions', 'teams'].map((name) => `${name}_archive`);
const COLLECTIONS_TO_SCAN = [...BASE_COLLECTIONS, ...ARCHIVE_COLLECTIONS];

/** Kolekcja w Firebase na kopie zapasowe przed czyszczeniem PII */
const PII_CLEANUP_BACKUPS_COLLECTION = 'pii_cleanup_backups';

type PiiHit = {
  path: string;
  field: string;
  preview?: string;
};

type PiiDocumentFinding = {
  id: string;
  collection: string;
  hits: PiiHit[];
  data: Record<string, any>;
};

export default function CleanupPage() {
  const { isAdmin } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [findings, setFindings] = useState<PiiDocumentFinding[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const findingsByCollection = useMemo(() => {
    const grouped: Record<string, number> = {};
    findings.forEach((finding) => {
      grouped[finding.collection] = (grouped[finding.collection] || 0) + 1;
    });
    return grouped;
  }, [findings]);

  const scanForPii = (value: any, path: string[] = []): PiiHit[] => {
    const hits: PiiHit[] = [];
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        hits.push(...scanForPii(item, [...path, String(index)]));
      });
      return hits;
    }
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, child]) => {
        const nextPath = [...path, key];
        if (FORBIDDEN_PII_FIELDS.includes(key)) {
          hits.push({
            path: nextPath.join('.'),
            field: key,
            preview: typeof child === 'string' ? child.slice(0, 80) : undefined
          });
        }
        hits.push(...scanForPii(child, nextPath));
      });
    }
    return hits;
  };

  const sanitizeData = (value: any): any => {
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeData(item));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => !FORBIDDEN_PII_FIELDS.includes(key))
          .map(([key, child]) => [key, sanitizeData(child)])
      );
    }
    return value;
  };

  const createBackup = async () => {
    if (!isAdmin) {
      alert('Tylko administratorzy mogą tworzyć kopie zapasowe');
      return;
    }
    if (!confirm('Utworzyć kopię zapasową wszystkich dokumentów z kolekcji matches, gps oraz *_archive?')) return;

    setIsBackingUp(true);
    setLogs([]);
    addLog('📦 Rozpoczynam tworzenie kopii zapasowej...');

    try {
      const backupId = `backup_${Date.now()}`;
      const backupMetaRef = doc(getDB(), PII_CLEANUP_BACKUPS_COLLECTION, backupId);
      let totalDocs = 0;

      for (const collectionName of COLLECTIONS_TO_SCAN) {
        addLog(`📥 Kopiuję kolekcję: ${collectionName}`);
        const snapshot = await getDocs(collection(getDB(), collectionName));
        for (const docSnap of snapshot.docs) {
          const docBackupId = `${collectionName}__${docSnap.id}`.replace(/\//g, '__');
          const backupDocRef = doc(getDB(), PII_CLEANUP_BACKUPS_COLLECTION, backupId, 'documents', docBackupId);
          await setDoc(backupDocRef, {
            sourceCollection: collectionName,
            sourceId: docSnap.id,
            data: docSnap.data(),
          });
          totalDocs += 1;
        }
        addLog(`✅ Zakończono: ${collectionName} (${snapshot.docs.length} dokumentów)`);
      }

      await setDoc(backupMetaRef, {
        backupAt: new Date().toISOString(),
        documentCount: totalDocs,
        source: 'pii_cleanup_manual',
      });
      addLog(`🎉 Kopia zapasowa utworzona: ${PII_CLEANUP_BACKUPS_COLLECTION}/${backupId} (${totalDocs} dokumentów)`);
    } catch (error) {
      console.error('Błąd tworzenia kopii:', error);
      addLog(`❌ Błąd tworzenia kopii: ${String(error)}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const analyzeCollections = async () => {
    if (!isAdmin) {
      alert('Tylko administratorzy mogą analizować dane');
      return;
    }

    setIsAnalyzing(true);
    setFindings([]);
    setSelectedKeys(new Set());
    setLogs([]);
    addLog('🔍 Rozpoczynam analizę PII w kolekcjach matches/gps/archiwach...');

    try {
      const results: PiiDocumentFinding[] = [];
      for (const collectionName of COLLECTIONS_TO_SCAN) {
        addLog(`📥 Skanuję kolekcję: ${collectionName}`);
        const snapshot = await getDocs(collection(getDB(), collectionName));
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const hits = scanForPii(data);
          if (hits.length > 0) {
            results.push({
              id: docSnap.id,
              collection: collectionName,
              hits,
              data
            });
          }
        });
        addLog(`✅ Zakończono: ${collectionName}`);
      }
      setFindings(results);
      addLog(`📊 Wykryto dokumentów z PII: ${results.length}`);
      if (results.length === 0) {
        addLog('✅ Nie znaleziono zabronionych pól PII.');
      }
    } catch (error) {
      console.error('Błąd analizy:', error);
      addLog(`❌ Błąd analizy: ${String(error)}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSelection = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeys(new Set(findings.map((f) => `${f.collection}/${f.id}`)));
  };

  const clearSelection = () => {
    setSelectedKeys(new Set());
  };

  const cleanSelected = async () => {
    if (!isAdmin) {
      alert('Tylko administratorzy mogą czyścić dane');
      return;
    }
    if (selectedKeys.size === 0) {
      alert('Nie wybrano żadnych dokumentów do czyszczenia.');
      return;
    }
    if (!confirm(`Czy na pewno chcesz wyczyścić ${selectedKeys.size} dokumentów? Przed usunięciem zostanie utworzona kopia zapasowa w Firebase.`)) return;

    setIsCleaning(true);
    setLogs([]);
    addLog('🧹 Rozpoczynam czyszczenie PII...');

    try {
      const selectedFindings = findings.filter((f) => selectedKeys.has(`${f.collection}/${f.id}`));
      const backupId = `backup_${Date.now()}`;

      // 1. Kopia zapasowa do Firebase przed usunięciem
      addLog(`📦 Tworzę kopię zapasową w ${PII_CLEANUP_BACKUPS_COLLECTION}/${backupId}...`);
      const backupMetaRef = doc(getDB(), PII_CLEANUP_BACKUPS_COLLECTION, backupId);
      await setDoc(backupMetaRef, {
        backupAt: new Date().toISOString(),
        documentCount: selectedFindings.length,
        source: 'pii_cleanup',
      });
      for (const finding of selectedFindings) {
        const docBackupId = `${finding.collection}__${finding.id}`.replace(/\//g, '__');
        const backupDocRef = doc(getDB(), PII_CLEANUP_BACKUPS_COLLECTION, backupId, 'documents', docBackupId);
        await setDoc(backupDocRef, {
          sourceCollection: finding.collection,
          sourceId: finding.id,
          data: finding.data,
        });
      }
      addLog(`✅ Kopia zapasowa utworzona: ${PII_CLEANUP_BACKUPS_COLLECTION}/${backupId} (${selectedFindings.length} dokumentów)`);

      // 2. Czyszczenie PII w oryginalnych dokumentach
      let cleaned = 0;
      for (const finding of selectedFindings) {
        const key = `${finding.collection}/${finding.id}`;
        const sanitized = sanitizeData(finding.data);
        await setDoc(doc(getDB(), finding.collection, finding.id), sanitized, { merge: false });
        cleaned += 1;
        addLog(`✅ Wyczyszczono ${key} (${finding.hits.length} pól)`);
      }
      addLog(`🎉 Czyszczenie zakończone. Zaktualizowano: ${cleaned} dokumentów`);
    } catch (error) {
      console.error('Błąd czyszczenia:', error);
      addLog(`❌ Błąd czyszczenia: ${String(error)}`);
    } finally {
      setIsCleaning(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.container}>
        <h1>Brak uprawnień</h1>
        <p>Tylko administratorzy mogą korzystać z panelu czyszczenia danych.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1>🧹 Czyszczenie PII w matches/gps/archiwach</h1>

      <div className={styles.section}>
        <h2>Analiza</h2>
        <p>
          Skanuje kolekcje <code>matches</code>, <code>gps</code> oraz wszystkie kolekcje z sufiksem <code>_archive</code> i
          wykrywa pola PII zabronione poza <code>players</code>.
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={createBackup} disabled={isBackingUp} className={styles.button}>
            {isBackingUp ? 'Tworzę kopię...' : '📦 Utwórz kopię zapasową'}
          </button>
          <button onClick={analyzeCollections} disabled={isAnalyzing} className={styles.button}>
            {isAnalyzing ? 'Analizuję...' : '🔍 Skanuj PII'}
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h2>Wyniki</h2>
        {findings.length === 0 ? (
          <p>Brak wyników — uruchom skanowanie.</p>
        ) : (
          <>
            <div className={styles.results}>
              <h3>Podsumowanie</h3>
              <ul>
                <li>Dokumenty z PII: {findings.length}</li>
                {Object.entries(findingsByCollection).map(([name, count]) => (
                  <li key={name}>{name}: {count}</li>
                ))}
              </ul>
            </div>

            <div className={styles.actionsRow}>
              <button type="button" className={styles.button} onClick={selectAll}>
                Zaznacz wszystkie
              </button>
              <button type="button" className={styles.button} onClick={clearSelection}>
                Wyczyść zaznaczenie
              </button>
              <button
                type="button"
                className={`${styles.button} ${styles.dangerButton}`}
                disabled={isCleaning || selectedKeys.size === 0}
                onClick={cleanSelected}
              >
                {isCleaning ? 'Czyszczę...' : `🧹 Wyczyść (${selectedKeys.size})`}
              </button>
            </div>

            <div className={styles.results}>
              <h3>Dokumenty</h3>
              <ul>
                {findings.map((finding) => {
                  const key = `${finding.collection}/${finding.id}`;
                  return (
                    <li key={key}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(key)}
                          onChange={() => toggleSelection(key)}
                          aria-label={`Wybierz ${key}`}
                        />
                        <strong> {key}</strong> — {finding.hits.length} pól
                      </label>
                      <div className={styles.logs}>
                        {finding.hits.slice(0, 6).map((hit, index) => (
                          <div key={`${key}-${index}`} className={styles.logEntry}>
                            {hit.path} ({hit.field}){hit.preview ? `: "${hit.preview}"` : ""}
                          </div>
                        ))}
                        {finding.hits.length > 6 && (
                          <div className={styles.logEntry}>… +{finding.hits.length - 6} więcej</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </div>

      <div className={styles.section}>
        <h2>Logi</h2>
        <div className={styles.logs}>
          {logs.length === 0 ? (
            <p>Brak logów — uruchom skanowanie lub czyszczenie.</p>
          ) : (
            logs.map((log, index) => (
              <div key={index} className={styles.logEntry}>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}