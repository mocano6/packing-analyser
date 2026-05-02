import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/apiRequireAdmin';
import {
  getOppositeXTValueForZone,
  zoneNameToIndex,
  getZoneName,
  zoneNameToString
} from '@/constants/xtValues';

// Funkcja pomocnicza do konwersji strefy
function convertZoneToName(zone: string | number | undefined): string | null {
  if (typeof zone === 'string') {
    return zone.toUpperCase();
  }
  if (typeof zone === 'number') {
    const zoneName = getZoneName(zone);
    return zoneName ? zoneNameToString(zoneName) : null;
  }
  return null;
}

/**
 * Migracja pól oppositeXT / oppositeZone / isAttack dla actions_regain i actions_loses.
 * Wymaga Authorization: Bearer (idToken admina). Używa Admin SDK — działa z produkcyjnymi regułami Firestore.
 */
export async function POST(request: NextRequest) {
  const adminResult = await requireAdminApi(request);
  if (!adminResult.ok) {
    return adminResult.response;
  }
  const { db } = adminResult;

  try {
    const matchesSnapshot = await db.collection('matches').get();

    if (matchesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'Brak meczów do przetworzenia',
        stats: {
          regainUpdated: 0,
          losesUpdated: 0,
          matchesUpdated: 0
        }
      });
    }

    let totalRegainUpdated = 0;
    let totalLosesUpdated = 0;
    let totalMatchesUpdated = 0;
    const errors: string[] = [];

    for (const docSnap of matchesSnapshot.docs) {
      const match = { id: docSnap.id, ...docSnap.data() } as Record<string, unknown>;
      let matchUpdated = false;
      const regainActions = (match.actions_regain as unknown[]) || [];
      const losesActions = (match.actions_loses as unknown[]) || [];

      const updatedRegainActions = regainActions.map((actionRaw) => {
        const action = actionRaw as Record<string, unknown>;
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action;
        }

        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          return action;
        }

        const startZoneName = convertZoneToName(startZone as string | number | undefined);
        if (!startZoneName) {
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
          return action;
        }

        const row = Math.floor(zoneIndex / 12);
        const col = zoneIndex % 12;
        const oppositeRow = 7 - row;
        const oppositeCol = 11 - col;
        const oppositeIndex = oppositeRow * 12 + oppositeCol;
        const oppositeZoneData = getZoneName(oppositeIndex);
        const oppositeZone = oppositeZoneData ? zoneNameToString(oppositeZoneData) : null;

        const oppositeXT = getOppositeXTValueForZone(zoneIndex);

        const receiverXT = (action.xTValueEnd as number) || 0;
        const isAttack = receiverXT < 0.02;

        matchUpdated = true;
        totalRegainUpdated++;

        return {
          ...action,
          oppositeXT,
          oppositeZone,
          isAttack
        };
      });

      const updatedLosesActions = losesActions.map((actionRaw) => {
        const action = actionRaw as Record<string, unknown>;
        if (action.oppositeXT !== undefined && action.oppositeZone && action.isAttack !== undefined) {
          return action;
        }

        const startZone = action.fromZone || action.startZone;
        if (!startZone) {
          return action;
        }

        const startZoneName = convertZoneToName(startZone as string | number | undefined);
        if (!startZoneName) {
          return action;
        }

        const zoneIndex = zoneNameToIndex(startZoneName);
        if (zoneIndex === null) {
          return action;
        }

        const row = Math.floor(zoneIndex / 12);
        const col = zoneIndex % 12;
        const oppositeRow = 7 - row;
        const oppositeCol = 11 - col;
        const oppositeIndex = oppositeRow * 12 + oppositeCol;
        const oppositeZoneData = getZoneName(oppositeIndex);
        const oppositeZone = oppositeZoneData ? zoneNameToString(oppositeZoneData) : null;

        const oppositeXT = getOppositeXTValueForZone(zoneIndex);

        const receiverXT = (action.xTValueEnd as number) || 0;
        const isAttack = receiverXT < 0.02;

        matchUpdated = true;
        totalLosesUpdated++;

        return {
          ...action,
          oppositeXT,
          oppositeZone,
          isAttack
        };
      });

      if (matchUpdated) {
        try {
          await docSnap.ref.update({
            actions_regain: updatedRegainActions,
            actions_loses: updatedLosesActions
          });
          totalMatchesUpdated++;
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          const errorMsg = `Błąd podczas aktualizacji meczu ${docSnap.id}: ${msg}`;
          console.error(`❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Migracja zakończona pomyślnie',
      stats: {
        regainUpdated: totalRegainUpdated,
        losesUpdated: totalLosesUpdated,
        matchesUpdated: totalMatchesUpdated,
        errors: errors.length
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error: unknown) {
    console.error('❌ Błąd podczas migracji:', error);
    const message = error instanceof Error ? error.message : 'Błąd podczas migracji';
    return NextResponse.json(
      {
        success: false,
        message: 'Błąd podczas migracji',
        error: message
      },
      { status: 500 }
    );
  }
}
