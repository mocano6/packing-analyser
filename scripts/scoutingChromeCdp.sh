#!/usr/bin/env bash
# Opcjonalny awaryjny tryb CDP — NIE jest potrzebny do zwykłego syncu.
# Sync domyślnie sam otwiera Chrome z .scouting-profile.
#
# Użyj tylko gdy zwykły sync + warmup nie pomagają:
#   npm run scouting:chrome-cdp
#   SCOUTING_CDP_URL=http://127.0.0.1:9333 npm run dev

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROFILE="$ROOT/.scouting-profile"
URL="https://www.laczynaspilka.pl/rozgrywki"

echo "Profil: $PROFILE"
echo "CDP:    http://127.0.0.1:9333"
echo "URL:    $URL"
echo ""
echo "Preferuj zwykły sync (bez CDP). Ten skrypt to awaria."
echo "W Chrome: zaakceptuj cookies, upewnij się że NIE ma /404."
echo ""
echo "Potem w drugim terminalu:"
echo "  SCOUTING_CDP_URL=http://127.0.0.1:9333 npm run dev"
echo ""

exec "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9333 \
  --remote-allow-origins=* \
  --user-data-dir="$PROFILE" \
  --disable-blink-features=AutomationControlled \
  "$URL"
