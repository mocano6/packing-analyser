import type { TeamInfo } from "@/types";

/** Klucz localStorage — musi być zgodny z `video-external/page.tsx`. */
export const EXTERNAL_VIDEO_MATCH_INFO_KEY = "externalVideoMatchInfo";

/** Tylko pola używane przez `/video-external` (player YouTube / Storage). */
export type ExternalVideoMatchInfoPayload = Pick<TeamInfo, "videoUrl" | "videoStorageUrl">;

export function pickExternalVideoMatchInfoPayload(match: TeamInfo): ExternalVideoMatchInfoPayload {
  const payload: ExternalVideoMatchInfoPayload = {};
  if (match.videoUrl) payload.videoUrl = match.videoUrl;
  if (match.videoStorageUrl) payload.videoStorageUrl = match.videoStorageUrl;
  return payload;
}

export function hasExternalVideoSource(match: TeamInfo): boolean {
  return Boolean(
    (match.videoUrl && match.videoUrl.trim() !== "") ||
      (match.videoStorageUrl && match.videoStorageUrl.trim() !== "")
  );
}

/**
 * Zapisuje do localStorage wyłącznie URL-e wideo (bez akcji, strzałów, GPS itd.),
 * żeby uniknąć QuotaExceededError przy pełnym obiekcie TeamInfo.
 */
export function saveExternalVideoMatchInfo(match: TeamInfo): boolean {
  try {
    localStorage.setItem(
      EXTERNAL_VIDEO_MATCH_INFO_KEY,
      JSON.stringify(pickExternalVideoMatchInfoPayload(match))
    );
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      console.warn("saveExternalVideoMatchInfo: przekroczono limit localStorage", e);
    } else {
      console.warn("saveExternalVideoMatchInfo: błąd zapisu", e);
    }
    return false;
  }
}
