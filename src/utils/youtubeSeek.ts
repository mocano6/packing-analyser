/**
 * Tolerancja w sekundach. `start` w iframe jest liczbą całkowitą, więc
 * odchylenie poniżej 1 s uznajemy za trafienie. 0 s nie może „trafić” w 1 s.
 */
export const YOUTUBE_SEEK_TOLERANCE_SEC = 0.99;

/** Parametr `start` w playerVars jest liczbą całkowitą sekund. */
export function youtubeEmbedStartSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, Math.floor(seconds));
}

export function isVideoSeekLanded(
  currentSeconds: number,
  targetSeconds: number,
  tolerance = YOUTUBE_SEEK_TOLERANCE_SEC,
): boolean {
  if (!Number.isFinite(currentSeconds) || !Number.isFinite(targetSeconds)) return false;
  return Math.abs(currentSeconds - targetSeconds) <= tolerance;
}

/**
 * Stany, w których IFrame API przyjmuje seekTo.
 * -1 (unstarted) ignoruje seek — stąd pierwsze kliknięcie zostawało na 0.
 */
export async function readYoutubePlayerTime(player: {
  getCurrentTime: () => number | Promise<number>;
}): Promise<number> {
  const value = await player.getCurrentTime();
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function canSeekYoutubePlayer(state: number | null | undefined): boolean {
  return state === 0 || state === 1 || state === 2 || state === 3 || state === 5;
}

/**
 * `start` w playerVars tylko do pierwszego załadowania iframe.
 * Po ready zostawiamy zamrożoną wartość: wyczyszczenie targetu (null) nie może
 * zmienić `start` na brak, bo react-youtube wtedy cue'uje film od początku.
 * Kolejny moment idzie przez seekTo, bez przeładowania playera.
 */
export function resolveYoutubeEmbedStart(options: {
  playerReady: boolean;
  seekTargetSeconds: number | null;
  frozenStart: number | undefined;
}): number | undefined {
  if (
    !options.playerReady &&
    options.seekTargetSeconds != null &&
    Number.isFinite(options.seekTargetSeconds)
  ) {
    return youtubeEmbedStartSeconds(options.seekTargetSeconds);
  }
  return options.frozenStart;
}
