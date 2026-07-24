// Serwerowy cache grup ligowych (`.scouting-data/competitions.json`).
// Uzupełniany po udanym fetchCompetitions — pozwala bootstrapować URL rozgrywek bez tokenu.

import fs from 'fs/promises';
import path from 'path';
import type { ScoutingLeagueGroup, Sex } from '@/types/scouting';

const DATA_DIR = path.join(process.cwd(), '.scouting-data');
const DATA_FILE = path.join(DATA_DIR, 'competitions.json');

interface SeasonEntry {
  leagueGroups: ScoutingLeagueGroup[];
  savedAt: string;
}

interface CompetitionsServerStore {
  bySex: Partial<
    Record<
      Sex,
      {
        leagueGroupsBySeason: Record<string, SeasonEntry>;
      }
    >
  >;
}

const emptyStore = (): CompetitionsServerStore => ({ bySex: {} });

const loadStore = async (): Promise<CompetitionsServerStore> => {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CompetitionsServerStore;
    return parsed?.bySex ? parsed : emptyStore();
  } catch {
    return emptyStore();
  }
};

const saveStore = async (store: CompetitionsServerStore): Promise<void> => {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
};

/** Zapisuje grupy lig dla sezonu (nadpisuje poprzedni zapis). */
export const saveServerLeagueGroups = async (
  sex: Sex,
  seasonId: string,
  leagueGroups: ScoutingLeagueGroup[]
): Promise<void> => {
  if (!seasonId || leagueGroups.length === 0) return;
  const store = await loadStore();
  const block = store.bySex[sex] ?? { leagueGroupsBySeason: {} };
  block.leagueGroupsBySeason[seasonId] = {
    leagueGroups,
    savedAt: new Date().toISOString(),
  };
  store.bySex[sex] = block;
  await saveStore(store);
};

/** Odczyt grup lig z serwerowego cache (null gdy brak). */
export const getServerLeagueGroups = async (
  sex: Sex,
  seasonId: string
): Promise<ScoutingLeagueGroup[] | null> => {
  const store = await loadStore();
  const entry = store.bySex[sex]?.leagueGroupsBySeason[seasonId];
  return entry?.leagueGroups?.length ? entry.leagueGroups : null;
};
