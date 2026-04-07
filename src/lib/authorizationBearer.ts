/** Parsuje nagłówek Authorization: Bearer … (bez zależności od Firebase — testowalne w ts-node). */
export function parseAuthorizationBearer(header: string | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  const t = header.slice("Bearer ".length).trim();
  return t || null;
}
