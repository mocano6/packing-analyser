import type { Action } from "@/types";
import { getLosesBackAllyCountForDisplay, isLosesBackAllyCountModel } from "@/lib/losesBackAllyDisplay";
import { getReceptionBackAllyCountForDisplay, isRegainReceptionBackCountModel } from "@/lib/regainReceptionDisplay";

export type BypassedOpponentStats = {
  totalBypassed: number;
  avgBypassed: number;
  recordedCount: number;
};

export const REGAIN_ATTACK_DEFENSE_TOOLTIP =
  "Suma xT ze wszystkich przechwytów w obu perspektywach strefowych.\n• xT atak — wartość ze strefy ataku (wybrana przy zapisie).\n• xT obrona — wartość ze strefy obrony (po przekątnej).\nKażdy przechwyt wnosi obie wartości. Waga pokazuje, która suma jest większa.";

export const LOSES_ATTACK_DEFENSE_TOOLTIP =
  "Suma xT ze wszystkich strat w obu perspektywach strefowych.\n• xT atak — wartość ze strefy ataku (wybrana przy zapisie).\n• xT obrona — wartość ze strefy obrony (po przekątnej).\nKażda strata wnosi obie wartości. Waga pokazuje, która suma jest większa.";

export const REGAIN_BYPASSED_TOOLTIP =
  "Zawodnicy przeciwnika oznaczeni jako minięci w analizatorze przy przechwycie (0–10).\nŚrednia = łącznie ÷ liczba przechwytów z oznaczeniem.\nŁącznie = suma miniętych ze wszystkich oznaczonych przechwytów.";

export const LOSES_BYPASSED_TOOLTIP =
  "Zawodnicy przeciwnika oznaczeni jako minięci w analizatorze przy stracie (0–10).\nŚrednia = łącznie ÷ liczba strat z oznaczeniem.\nŁącznie = suma miniętych ze wszystkich oznaczonych strat.";

export function summarizeRegainBypassedOpponents(actions: Action[]): BypassedOpponentStats {
  let totalBypassed = 0;
  let recordedCount = 0;
  for (const action of actions) {
    if (!isRegainReceptionBackCountModel(action)) continue;
    totalBypassed += getReceptionBackAllyCountForDisplay(action);
    recordedCount += 1;
  }
  return {
    totalBypassed,
    avgBypassed: recordedCount > 0 ? totalBypassed / recordedCount : 0,
    recordedCount,
  };
}

export function summarizeLosesBypassedOpponents(actions: Action[]): BypassedOpponentStats {
  let totalBypassed = 0;
  let recordedCount = 0;
  for (const action of actions) {
    if (!isLosesBackAllyCountModel(action)) continue;
    totalBypassed += getLosesBackAllyCountForDisplay(action);
    recordedCount += 1;
  }
  return {
    totalBypassed,
    avgBypassed: recordedCount > 0 ? totalBypassed / recordedCount : 0,
    recordedCount,
  };
}
