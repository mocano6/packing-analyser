// Magazyn stanu scoutingu (TYLKO SERWER).
// Na razie zapis lokalny do pliku JSON; interfejs zaprojektowany tak,
// aby w przyszłości podmienić implementację na Firestore bez zmian w logice.

import fs from 'fs/promises';
import path from 'path';
import { seedPlayerFromMatchStat } from './playerNames';
import type { ScoutingState } from '@/types/scouting';

export interface ScoutingStore {
  load(): Promise<ScoutingState>;
  save(state: ScoutingState): Promise<void>;
}

const DATA_DIR = path.join(process.cwd(), '.scouting-data');
const DATA_FILE = path.join(DATA_DIR, 'scouting.json');

export const emptyState = (): ScoutingState => ({
  leagues: {},
  players: {},
});

/** Uzupełnia cache nazwisk z już zapisanych składów meczowych (migracja starych danych). */
export const enrichPlayerNamesFromLeagues = (state: ScoutingState): boolean => {
  const now = new Date().toISOString();
  let changed = false;
  for (const ld of Object.values(state.leagues)) {
    for (const m of ld.matches) {
      for (const p of m.playerStats || []) {
        const hadEntry = !!state.players[p.playerId];
        const hadName = hadEntry && `${state.players[p.playerId].firstname} ${state.players[p.playerId].lastname}`.trim();
        seedPlayerFromMatchStat(state.players, p, now);
        const hasName = `${state.players[p.playerId]?.firstname || ''} ${state.players[p.playerId]?.lastname || ''}`.trim();
        if (!hadEntry || (!hadName && hasName)) changed = true;
      }
    }
  }
  return changed;
};

/** Implementacja lokalna na pliku JSON. */
export class LocalJsonStore implements ScoutingStore {
  private readonly file: string;

  constructor(file: string = DATA_FILE) {
    this.file = file;
  }

  async load(): Promise<ScoutingState> {
    try {
      const raw = await fs.readFile(this.file, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ScoutingState> & Record<string, unknown>;
      return {
        leagues: parsed.leagues && typeof parsed.leagues === 'object' ? parsed.leagues : {},
        players: parsed.players && typeof parsed.players === 'object' ? parsed.players : {},
      };
    } catch (err: unknown) {
      // brak pliku -> pusty stan
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return emptyState();
      throw err;
    }
  }

  async save(state: ScoutingState): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(state, null, 2), 'utf-8');
  }
}

/** Domyślny magazyn używany przez API (łatwo podmienić na FirestoreStore w przyszłości). */
export const getScoutingStore = (): ScoutingStore => new LocalJsonStore();
