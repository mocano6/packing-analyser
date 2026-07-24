// Log diagnostyczny operacji scoutingu (zwracany do UI).

export type ScoutingDebugLevel = 'info' | 'ok' | 'warn' | 'error';

export interface ScoutingDebugEntry {
  at: string;
  level: ScoutingDebugLevel;
  phase: 'browser' | 'navigate' | 'token' | 'api' | 'sync' | 'client';
  message: string;
  endpoint?: string;
  status?: number;
  /** Skrócony podgląd odpowiedzi lub szczegół błędu. */
  detail?: string;
}

export interface ScoutingDebugLog {
  operation: string;
  sessionId: string;
  startedAt: string;
  finishedAt: string;
  meta?: Record<string, string>;
  entries: ScoutingDebugEntry[];
}

const MAX_DETAIL = 800;

/** Skrócony opis payloadu (bez wysyłania całych tablic meczów). */
export const summarizeData = (data: unknown): string => {
  if (data === null || data === undefined) return 'null';
  if (Array.isArray(data)) {
    if (data.length === 0) return 'array[0]';
    const first = data[0];
    if (first && typeof first === 'object' && 'matchId' in (first as object)) {
      return `array[${data.length}] matches`;
    }
    if (first && typeof first === 'object' && 'id' in (first as object) && 'name' in (first as object)) {
      return `array[${data.length}] e.g. ${JSON.stringify(first).slice(0, 120)}`;
    }
    return `array[${data.length}]`;
  }
  if (typeof data === 'object') {
    try {
      const s = JSON.stringify(data);
      return s.length <= MAX_DETAIL ? s : s.slice(0, MAX_DETAIL) + '…';
    } catch {
      return 'object';
    }
  }
  return String(data).slice(0, MAX_DETAIL);
};

export class ScoutingDebugLogger {
  private readonly entries: ScoutingDebugEntry[] = [];
  private finished = false;

  constructor(
    readonly operation: string,
    readonly meta: Record<string, string> = {}
  ) {}

  readonly sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  readonly startedAt = new Date().toISOString();

  log(
    level: ScoutingDebugLevel,
    phase: ScoutingDebugEntry['phase'],
    message: string,
    extra?: Pick<ScoutingDebugEntry, 'endpoint' | 'status' | 'detail'>
  ): void {
    if (this.finished) return;
    this.entries.push({
      at: new Date().toISOString(),
      level,
      phase,
      message,
      ...extra,
    });
  }

  info(phase: ScoutingDebugEntry['phase'], message: string, extra?: Pick<ScoutingDebugEntry, 'endpoint' | 'status' | 'detail'>): void {
    this.log('info', phase, message, extra);
  }

  ok(phase: ScoutingDebugEntry['phase'], message: string, extra?: Pick<ScoutingDebugEntry, 'endpoint' | 'status' | 'detail'>): void {
    this.log('ok', phase, message, extra);
  }

  warn(phase: ScoutingDebugEntry['phase'], message: string, extra?: Pick<ScoutingDebugEntry, 'endpoint' | 'status' | 'detail'>): void {
    this.log('warn', phase, message, extra);
  }

  error(phase: ScoutingDebugEntry['phase'], message: string, extra?: Pick<ScoutingDebugEntry, 'endpoint' | 'status' | 'detail'>): void {
    this.log('error', phase, message, extra);
  }

  logApi(endpoint: string, status: number, data: unknown, error?: string): void {
    const level: ScoutingDebugLevel = status === 200 ? 'ok' : status === 0 ? 'error' : 'warn';
    this.log(level, 'api', error || `HTTP ${status}`, {
      endpoint,
      status,
      detail: error || summarizeData(data),
    });
  }

  finish(): ScoutingDebugLog {
    this.finished = true;
    return {
      operation: this.operation,
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      meta: this.meta,
      entries: [...this.entries],
    };
  }
}

/** Tekst do wklejenia w czat (np. do debugowania z agentem). */
export const formatDebugLogsForCopy = (logs: ScoutingDebugLog[]): string => {
  const lines: string[] = [
    '=== SCOUTING DEBUG LOG ===',
    `Wygenerowano: ${new Date().toISOString()}`,
    `Sesje: ${logs.length}`,
    '',
  ];

  for (const log of logs) {
    lines.push(`--- ${log.operation} (${log.sessionId}) ---`);
    lines.push(`Start: ${log.startedAt} | Koniec: ${log.finishedAt}`);
    if (log.meta && Object.keys(log.meta).length > 0) {
      lines.push(`Meta: ${JSON.stringify(log.meta)}`);
    }
    for (const e of log.entries) {
      const ep = e.endpoint ? ` | ${e.endpoint}` : '';
      const st = e.status != null ? ` [${e.status}]` : '';
      lines.push(`[${e.at}] ${e.level.toUpperCase()} ${e.phase}${st}${ep}`);
      lines.push(`  ${e.message}`);
      if (e.detail) lines.push(`  → ${e.detail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
};

export class ScoutingOperationError extends Error {
  readonly debugLog: ScoutingDebugLog;

  constructor(message: string, debugLog: ScoutingDebugLog) {
    super(message);
    this.name = 'ScoutingOperationError';
    this.debugLog = debugLog;
  }
}
