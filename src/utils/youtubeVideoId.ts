/** Wyciąga YouTube video ID z URL (watch, youtu.be, embed, live, shorts). */

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function sanitizeVideoId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim().split(/[/?&#]/)[0];
  return YOUTUBE_ID_RE.test(id) ? id : null;
}

function youtubeHostKind(hostname: string): "watch" | "short" | null {
  const host = hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") return "short";
  if (
    host === "youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "music.youtube.com"
  ) {
    return "watch";
  }
  return null;
}

export function extractYouTubeId(url: string): string | null {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  if (YOUTUBE_ID_RE.test(raw)) return raw;

  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  try {
    const parsed = new URL(withProtocol);
    const kind = youtubeHostKind(parsed.hostname);
    if (kind === "short") {
      return sanitizeVideoId(parsed.pathname.replace(/^\//, "").split("/")[0]);
    }
    if (kind === "watch") {
      const fromQuery = sanitizeVideoId(parsed.searchParams.get("v"));
      if (fromQuery) return fromQuery;
      const pathMatch = parsed.pathname.match(/^\/(?:live|embed|v|shorts|e)\/([^/]+)/i);
      if (pathMatch?.[1]) return sanitizeVideoId(pathMatch[1]);
    }
  } catch {
    // fallback regex poniżej
  }

  const match = raw.match(
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|v\/|live\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i
  );
  return match?.[1] ?? null;
}
