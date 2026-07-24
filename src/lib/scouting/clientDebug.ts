import { summarizeData } from '@/lib/scouting/debugLog';
import type { ScoutingDebugLog } from '@/types/scouting';

/** Dołącza wpis z odpowiedzi naszego API (fetch po stronie klienta). */
export const appendClientApiLog = (
  logs: ScoutingDebugLog[],
  label: string,
  res: Response,
  body: unknown
): ScoutingDebugLog[] => {
  const entry = {
    operation: `client:${label}`,
    sessionId: `client-${Date.now()}`,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    entries: [
      {
        at: new Date().toISOString(),
        level: (res.ok ? 'ok' : 'error') as 'ok' | 'error',
        phase: 'client' as const,
        message: `${res.status} ${res.statusText}`,
        status: res.status,
        detail: summarizeData(body),
      },
    ],
  };
  return [...logs, entry];
};

/** Scala logi serwera z odpowiedzi API z logami klienta. */
export const mergeDebugLogs = (
  prev: ScoutingDebugLog[],
  serverLog?: ScoutingDebugLog | null,
  clientLog?: ScoutingDebugLog | null
): ScoutingDebugLog[] => {
  const next = [...prev];
  if (serverLog) next.push(serverLog);
  if (clientLog) next.push(clientLog);
  return next;
};
