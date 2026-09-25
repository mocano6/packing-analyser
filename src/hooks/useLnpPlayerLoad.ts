"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDoc, setDoc } from "@/lib/firestoreWithMetrics";
import type { LnpPlayerLoadState } from "@/types/lnpPlayerLoad";
import {
  createEmptyLnpPlayerLoadState,
  LNP_PLAYER_LOAD_DOC_ID,
  LNP_PLAYER_LOAD_VERSION,
} from "@/types/lnpPlayerLoad";
import {
  buildLnpPlayerLoadDocument,
  migrateLnpPlayerLoadFromFirestore,
} from "@/lib/lnpPlayerLoadFirestore";
import { teamStaffStateDocRef } from "@/lib/teamStaffFirestore";
import toast from "react-hot-toast";

function isAcceptedVersion(v: unknown): boolean {
  if (v === undefined) return true;
  const n = typeof v === "number" ? v : Number(v);
  return n === LNP_PLAYER_LOAD_VERSION;
}

export function useLnpPlayerLoad(teamId: string | null, uid: string | null) {
  const [state, setState] = useState<LnpPlayerLoadState>(createEmptyLnpPlayerLoadState);
  const [loading, setLoading] = useState(true);
  const skipSaveOnce = useRef(false);

  useEffect(() => {
    if (!teamId || !uid) {
      setState(createEmptyLnpPlayerLoadState());
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const teamRef = teamStaffStateDocRef(teamId, LNP_PLAYER_LOAD_DOC_ID);
        const teamSnap = await getDoc(teamRef);
        if (cancelled) return;

        if (teamSnap.exists()) {
          const d = teamSnap.data() as Record<string, unknown>;
          if (isAcceptedVersion(d.version)) {
            try {
              skipSaveOnce.current = true;
              setState(migrateLnpPlayerLoadFromFirestore(d));
            } catch (parseErr) {
              console.error("Parsowanie minut obciążeń:", parseErr);
              skipSaveOnce.current = true;
              setState(createEmptyLnpPlayerLoadState());
            }
          } else {
            skipSaveOnce.current = true;
            setState(createEmptyLnpPlayerLoadState());
          }
          return;
        }

        skipSaveOnce.current = true;
        setState(createEmptyLnpPlayerLoadState());
      } catch (e) {
        console.error("Błąd ładowania minut obciążeń:", e);
        if (!cancelled) {
          skipSaveOnce.current = true;
          setState(createEmptyLnpPlayerLoadState());
          toast.error("Nie udało się wczytać minut meczowych.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, uid]);

  useEffect(() => {
    if (!teamId || !uid || loading) return;
    if (skipSaveOnce.current) {
      skipSaveOnce.current = false;
      return;
    }
    const t = setTimeout(() => {
      const payload = buildLnpPlayerLoadDocument(state, Date.now());
      setDoc(teamStaffStateDocRef(teamId, LNP_PLAYER_LOAD_DOC_ID), payload).catch((e: unknown) => {
        console.error("Zapis minut obciążeń:", e);
        toast.error("Nie udało się zapisać minut meczowych.", {
          id: "lnp-player-load-save-error",
          duration: 6000,
        });
      });
    }, 450);
    return () => clearTimeout(t);
  }, [state, teamId, uid, loading]);

  const setLoadState = useCallback(
    (updater: LnpPlayerLoadState | ((prev: LnpPlayerLoadState) => LnpPlayerLoadState)) => {
      setState(updater);
    },
    []
  );

  return { state, setLoadState, loading };
}
