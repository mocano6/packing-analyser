# Struktura obiektów w Firebase

Dokumentacja struktur danych zapisywanych do Firebase dla każdego typu zdarzenia.

## 📍 Lokalizacja w Firebase

Wszystkie obiekty są zapisywane w kolekcji `matches/{matchId}` jako tablice:
- `actions_packing` - akcje PxT (atak)
- `actions_unpacking` - akcje PxT (obrona)
- `actions_regain` - przechwyty
- `actions_loses` - straty
- `pkEntries` - wejścia w pole karne
- `acc8sEntries` - akcje 8s ACC
- `shots` - strzały (xG)

---

## 1. PxT (Action - Packing/Unpacking)

**Kolekcja:** `matches/{matchId}.actions_packing` (atak) lub `matches/{matchId}.actions_unpacking` (obrona)

```typescript
{
  id: string;                    // UUID generowane automatycznie
  matchId: string;               // ID meczu
  teamId: string;                // ID zespołu
  minute: number;                // Minuta akcji (1-90)
  isSecondHalf: boolean;         // Czy druga połowa
  
  // Zawodnicy
  senderId: string;              // ID zawodnika podającego
  senderName?: string;           // Nazwa zawodnika podającego
  senderNumber?: number;         // Numer zawodnika podającego
  receiverId?: string;          // ID zawodnika przyjmującego (opcjonalne dla dryblingu)
  receiverName?: string;         // Nazwa zawodnika przyjmującego
  receiverNumber?: number;       // Numer zawodnika przyjmującego
  
  // Typ akcji
  actionType: string;            // "pass" | "dribble"
  
  // Strefy
  startZone?: string;            // Strefa startowa (np. "A1", "B3")
  endZone?: string | null;       // Strefa końcowa
  fromZone?: string;             // Alias dla startZone (kompatybilność wsteczna)
  toZone?: string;               // Alias dla endZone (kompatybilność wsteczna)
  
  // Wartości xT i PxT
  xTValueStart?: number;         // Wartość xT w strefie startowej
  xTValueEnd?: number;           // Wartość xT w strefie końcowej
  packingPoints?: number;        // Punkty packing (P0=0, P1=1, P2=2, P3=3)
  
  // Flagi Packing
  isP0Start?: boolean;           // P0 na starcie
  isP1Start?: boolean;           // P1 na starcie
  isP2Start?: boolean;           // P2 na starcie
  isP3Start?: boolean;           // P3 na starcie
  isP0?: boolean;                // P0 na końcu
  isP1?: boolean;                // P1 na końcu
  isP2?: boolean;                // P2 na końcu
  isP3?: boolean;                // P3 na końcu
  
  // Kontakty
  isContact1?: boolean;          // 1 kontakt (1T)
  isContact2?: boolean;          // 2 kontakty (2T)
  isContact3Plus?: boolean;      // 3+ kontakty (3T+)
  
  // Efekty akcji
  isShot?: boolean;              // Czy po akcji był strzał
  isGoal?: boolean;              // Czy po akcji był gol
  isPenaltyAreaEntry?: boolean; // Czy wejście w pole karne
  
  // Tryb akcji
  mode?: "attack" | "defense";   // Tryb: atak lub obrona
  
  // Zawodnicy obrony (tylko dla trybu obrona)
  defensePlayers?: string[];     // Lista ID zawodników obrony
  
  // Czas wideo
  videoTimestamp?: number;       // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;    // Surowy czas wideo w sekundach (bez korekty)
}
```

---

## 2. Regain (Action - Przechwyt)

**Kolekcja:** `matches/{matchId}.actions_regain`

```typescript
{
  id: string;                    // UUID generowane automatycznie
  matchId: string;               // ID meczu
  teamId: string;               // ID zespołu
  minute: number;                // Minuta akcji (1-90)
  isSecondHalf: boolean;         // Czy druga połowa
  
  // Zawodnicy
  senderId: string;              // ID zawodnika wykonującego przechwyt
  senderName?: string;           // Nazwa zawodnika
  senderNumber?: number;        // Numer zawodnika
  
  // Strefy regain
  regainDefenseZone?: string;   // Strefa obrony (gdzie nastąpił regain)
  regainAttackZone?: string;    // Strefa ataku (opposite zone)
  
  // Wartości xT dla regain
  regainDefenseXT?: number;      // xT w obronie (z regain zone)
  regainAttackXT?: number;       // xT w ataku (z opposite zone)
  
  // Licznik „przeciwnicy za piłką” (0–10) z modala Regain — **aktualne pole zapisu**
  regainOppRosterSquadTallyF1?: number;
  // Stary, dwupolowy model rozkładu (tylko odczyt starych dokumentów; nowe UI zapisują F1 powyżej)
  playersBehindBall?: number;   // (legacy) partnerzy przed piłką
  opponentsBehindBall?: number;  // (legacy) przeciwnicy za piłką
  receptionBackAllyCount?: number;   // (deprecated) odczyt starych zapisów — preferuj regainOppRosterSquadTallyF1
  receptionAllyCountBehindBall?: number; // (deprecated) stary wariant — preferuj F1
  totalPlayersOnField?: number; // Całkowita liczba naszych zawodników na boisku
  totalOpponentsOnField?: number; // Całkowita liczba przeciwników na boisku
  playersLeftField?: number;    // Liczba naszych zawodników, którzy opuścili boisko
  opponentsLeftField?: number;  // Liczba przeciwników, którzy opuścili boisko
  
  // Flagi czasowe
  isBelow8s?: boolean;          // Poniżej 8 sekund
  
  // Flagi Packing (dla regain)
  isP0?: boolean;                // P0
  isP1?: boolean;                // P1
  isP2?: boolean;                // P2
  isP3?: boolean;                // P3
  
  // Kontakty
  isContact1?: boolean;          // 1 kontakt
  isContact2?: boolean;          // 2 kontakty
  isContact3Plus?: boolean;      // 3+ kontakty
  
  // Efekty akcji
  isShot?: boolean;              // Czy po przechwycie był strzał
  isGoal?: boolean;              // Czy po przechwycie był gol
  isPenaltyAreaEntry?: boolean; // Czy wejście w pole karne
  
  // Kontekst ataku/obrony
  isAttack?: boolean;            // Czy to atak (xTValueEnd < 0.02) czy obrona
  
  // Czas wideo
  videoTimestamp?: number;       // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;    // Surowy czas wideo w sekundach (bez korekty)
  
  // Pola kompatybilności wstecznej (DEPRECATED)
  oppositeXT?: number;          // DEPRECATED - użyj regainAttackXT
  oppositeZone?: string;        // DEPRECATED - użyj regainAttackZone
  fromZone?: string;            // DEPRECATED - użyj regainDefenseZone
  toZone?: string;              // DEPRECATED - użyj regainAttackZone
}
```

---

## 3. Loses (Action - Strata)

**Kolekcja:** `matches/{matchId}.actions_loses`

```typescript
{
  id: string;                    // UUID generowane automatycznie
  matchId: string;               // ID meczu
  teamId: string;               // ID zespołu
  minute: number;               // Minuta akcji (1-90)
  isSecondHalf: boolean;        // Czy druga połowa
  
  // Zawodnicy
  senderId: string;             // ID zawodnika tracącego piłkę
  senderName?: string;          // Nazwa zawodnika
  senderNumber?: number;       // Numer zawodnika
  
  // Strefy loses
  losesDefenseZone?: string;    // Strefa obrony (gdzie nastąpiła strata)
  losesAttackZone?: string;    // Strefa ataku (opposite zone)
  
  // Wartości xT dla loses
  losesDefenseXT?: number;      // xT w obronie (z lose zone)
  losesAttackXT?: number;      // xT w ataku (z opposite zone)
  
  // Licznik „przeciwnicy za piłką” (0–10) w momencie straty z modala Loses — **aktualne pole zapisu**
  losesOppRosterSquadTallyF1?: number;
  // Stary, dwupolowy model (tylko odczyt starych dokumentów; nowe UI zapisują F1 powyżej)
  playersBehindBall?: number;  // (legacy) partnerzy przed piłką
  opponentsBehindBall?: number; // (legacy) przeciwnicy za piłką (stary model dwóch pól)
  losesBackAllyCount?: number;    // (deprecated) odczyt starych zapisów — preferuj losesOppRosterSquadTallyF1
  totalPlayersOnField?: number; // Całkowita liczba naszych zawodników na boisku
  totalOpponentsOnField?: number; // Całkowita liczba przeciwników na boisku
  playersLeftField?: number;   // Liczba naszych zawodników, którzy opuścili boisko
  opponentsLeftField?: number; // Liczba przeciwników, którzy opuścili boisko
  
  // Flagi czasowe
  isBelow8s?: boolean;         // Poniżej 8 sekund
  isReaction5s?: boolean;      // Reakcja 5s (kontrpressing do 5s po stracie) - dobre 5s (✓)
  isAut?: boolean;              // Aut
  isBadReaction5s?: boolean;    // Złe 5s - nieudane 5s (✗)
  
  // Flagi Packing (dla loses)
  isP0?: boolean;               // P0
  isP1?: boolean;               // P1
  isP2?: boolean;               // P2
  isP3?: boolean;               // P3
  
  // Kontakty
  isContact1?: boolean;         // 1 kontakt
  isContact2?: boolean;         // 2 kontakty
  isContact3Plus?: boolean;     // 3+ kontakty
  
  // Efekty akcji
  isShot?: boolean;             // Czy po stracie był strzał przeciwnika
  isGoal?: boolean;             // Czy po stracie był gol przeciwnika
  isPenaltyAreaEntry?: boolean; // Czy wejście w pole karne przeciwnika
  
  // Czas wideo
  videoTimestamp?: number;      // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;   // Surowy czas wideo w sekundach (bez korekty)
  
  // Pola kompatybilności wstecznej (DEPRECATED)
  fromZone?: string;            // DEPRECATED - użyj losesDefenseZone
  toZone?: string;              // DEPRECATED - użyj losesAttackZone
}
```

---

## 4. Wejścia w PK (PKEntry)

**Kolekcja:** `matches/{matchId}.pkEntries`

```typescript
{
  id: string;                    // UUID generowane automatycznie (format: "pk_entry_{timestamp}_{random}")
  matchId: string;              // ID meczu
  teamId: string;                // ID zespołu (zawsze matchInfo.team, nawet dla przeciwnika)
  timestamp: number;             // Timestamp utworzenia (Date.now())
  
  // Pozycje na boisku (w procentach 0-100)
  startX: number;               // Pozycja X punktu startu
  startY: number;               // Pozycja Y punktu startu
  endX: number;                 // Pozycja X punktu końca
  endY: number;                 // Pozycja Y punktu końca
  
  // Czas meczu
  minute: number;               // Minuta wejścia (1-90)
  isSecondHalf: boolean;        // Czy druga połowa
  
  // Zawodnicy (tylko dla teamContext === "attack")
  senderId?: string;            // ID zawodnika podającego
  senderName?: string;          // Nazwa zawodnika podającego
  receiverId?: string;          // ID zawodnika otrzymującego (opcjonalne dla dryblingu)
  receiverName?: string;        // Nazwa zawodnika otrzymującego
  
  // Typ wejścia
  entryType?: "pass" | "dribble" | "sfg" | "regain"; // Typ akcji (kolor strzałki)
  
  // Kontekst zespołu
  teamContext?: "attack" | "defense"; // "attack" = nasze wejścia, "defense" = wejścia przeciwnika
  
  // Statystyki w PK
  pkPlayersCount?: number;      // Liczba partnerów w PK
  opponentsInPKCount?: number;  // Liczba przeciwników w PK (bez bramkarza)
  isPossible1T?: boolean;       // Możliwe 1T
  
  // Efekty wejścia
  isShot?: boolean;             // Czy po wejściu w PK był strzał
  isGoal?: boolean;            // Czy po wejściu w PK był gol
  isRegain?: boolean;          // Czy był przechwyt piłki
  
  // Czas wideo
  videoTimestamp?: number;      // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;   // Surowy czas wideo w sekundach (bez korekty)
}
```

**Uwaga:** Dla wejść przeciwnika (`teamContext === "defense"`), pola `senderId`, `senderName`, `receiverId`, `receiverName` są puste (nie zapisujemy zawodników przeciwnika).

---

## 5. 8s ACC (Acc8sEntry)

**Kolekcja:** `matches/{matchId}.acc8sEntries`

```typescript
{
  id: string;                    // UUID generowane automatycznie (format: "acc8s_entry_{timestamp}_{random}")
  matchId: string;               // ID meczu
  teamId: string;                // ID zespołu
  timestamp: number;             // Timestamp utworzenia (Date.now())
  
  // Czas meczu
  minute: number;                // Minuta akcji (1-90)
  isSecondHalf: boolean;         // Czy druga połowa
  
  // Kontekst zespołu
  teamContext: "attack" | "defense"; // Zawsze "attack" (tylko nasze akcje)
  
  // Typy akcji 8s
  isShotUnder8s: boolean;       // Strzał do 8s
  isPKEntryUnder8s: boolean;    // Wejście w PK do 8s
  
  // Zawodnicy
  passingPlayerIds: string[];   // Tablica ID zawodników biorących udział w akcji (wielokrotny wybór)
  
  // Czas wideo
  videoTimestamp?: number;      // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;   // Surowy czas wideo w sekundach (bez korekty)
}
```

---

## 6. xG (Shot)

**Kolekcja:** `matches/{matchId}.shots`

```typescript
{
  id: string;                    // UUID generowane automatycznie (format: "shot_{timestamp}_{random}")
  matchId: string;               // ID meczu
  timestamp: number;            // Timestamp utworzenia (Date.now())
  
  // Pozycja na boisku (w procentach 0-100)
  x: number;                    // Pozycja X strzału
  y: number;                     // Pozycja Y strzału
  
  // Zawodnik
  playerId?: string;             // ID zawodnika strzelającego
  playerName?: string;           // Nazwa zawodnika strzelającego
  
  // Czas meczu
  minute: number;               // Minuta strzału (1-90)
  
  // Wartość xG
  xG: number;                   // Wartość expected goals (0.0 - 1.0)
  
  // Typ strzału
  shotType: 'on_target' | 'off_target' | 'blocked' | 'goal'; // Typ strzału
  bodyPart?: 'foot' | 'head' | 'other'; // Część ciała
  
  // Kontekst zespołu
  teamContext: 'attack' | 'defense'; // Atak czy obrona
  teamId: string;               // ID zespołu, który wykonał strzał
  
  // Uwaga: Weryfikacja actionType = 'regain':
  // - Dla strzałów w ataku (teamContext === "attack"): sprawdzamy regains na połowie przeciwnika w 8s przed strzałem
  // - Dla strzałów w obronie (teamContext === "defense"): sprawdzamy straty (actions_loses) na własnej połowie (strefy 1-6, isAut: false) w 8s przed strzałem, bez regainów między stratą a strzałem
  
  // Rodzaj akcji
  actionType?: 'open_play' | 'counter' | 'corner' | 'free_kick' | 
               'direct_free_kick' | 'penalty' | 'throw_in' | 'regain';
  
  // SFG (Standardowe Fragmenty Gry)
  sfgSubtype?: 'direct' | 'combination'; // Podrodzaj SFG: bezpośredni, kombinacyjny
  
  // Zawodnicy na linii/obronie
  blockingPlayers?: string[];   // ID zawodników blokujących strzał
  linePlayers?: string[];       // ID zawodników na linii strzału (obrona)
  linePlayersCount?: number;    // Liczba zawodników na linii strzału (atak)
  pkPlayersCount?: number;      // Liczba zawodników w polu karnym (nie wpływa na xG)
  
  // Kontakty
  isContact1?: boolean;         // 1 kontakt (1T)
  isContact2?: boolean;         // 2 kontakty (2T)
  isContact3Plus?: boolean;     // 3+ kontakty (3T+)
  
  // Asysta (tylko dla goli)
  assistantId?: string;         // ID asystenta
  assistantName?: string;       // Nazwa asystenta
  
  // Dobitki
  previousShotId?: string;      // ID poprzedniego strzału (dla dobitki) - xG jest obliczane jako xG * (1 - xG_previous/100)
  
  // Kontrowersje
  isControversial?: boolean;    // Czy sytuacja jest kontrowersyjna
  controversyNote?: string;     // Notatka analityka dotycząca kontrowersyjnego strzału
  
  // Czas wideo
  videoTimestamp?: number;     // Czas wideo w sekundach (po korekcie -10s)
  videoTimestampRaw?: number;  // Surowy czas wideo w sekundach (bez korekty)
}
```

---

## 📝 Uwagi techniczne

### Usuwanie pól `undefined`
Wszystkie funkcje zapisu usuwają pola `undefined` przed zapisem do Firebase (używają funkcji `removeUndefinedFields` lub podobnych).

### Generowanie ID
- **Action**: UUID v4 (`uuidv4()`)
- **PKEntry**: `pk_entry_{timestamp}_{random}`
- **Acc8sEntry**: `acc8s_entry_{timestamp}_{random}`
- **Shot**: `shot_{timestamp}_{random}`

### Czas wideo
- `videoTimestamp`: Czas po korekcie -10s (dla synchronizacji z meczem)
- `videoTimestampRaw`: Surowy czas bez korekty (dla dokładnej analizy danych)

### Kompatybilność wsteczna
Niektóre pola są oznaczone jako DEPRECATED, ale są zachowane dla kompatybilności ze starymi danymi:
- `oppositeXT` / `oppositeZone` → użyj `regainAttackXT` / `regainAttackZone`
- `fromZone` / `toZone` → użyj odpowiednich pól specyficznych dla kategorii

---

## 🔍 Przykłady zapytań

### Pobierz wszystkie akcje PxT dla meczu
```typescript
const matchDoc = await getDoc(doc(db, "matches", matchId));
const actions = matchDoc.data()?.actions_packing || [];
```

### Pobierz wszystkie przechwyty
```typescript
const regains = matchDoc.data()?.actions_regain || [];
```

### Pobierz wszystkie wejścia w PK w ataku
```typescript
const pkEntries = matchDoc.data()?.pkEntries || [];
const attackEntries = pkEntries.filter(e => e.teamContext === "attack");
```
