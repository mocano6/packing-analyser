# Problemy obecnej struktury wielozespołowej

## Problem 1: Jeden numer na wszystkie zespoły
**Obecne**: 
```typescript
players/jan-kowalski = {
  teams: ["rezerwy", "trampkarze-starsze"],
  number: 10  // Ten sam numer w obu zespołach!
}
```

**Problem**: W Rezerwach może grać z numerem 10, ale w Trampenach z numerem 7

## Problem 2: Brak danych specyficznych dla zespołu
- Nie można zapisać różnej pozycji w różnych zespołach
- Brak informacji o dacie dołączenia do konkretnego zespołu
- Nie ma statusu członkostwa (aktywny/wypożyczony/zawieszony)

## Problem 3: Wolne zapytania
```typescript
// Obecne - WOLNE dla dużej ilości danych
query(collection(db, "players"), where("teams", "array-contains", teamId))
```

## Problem 4: Bezpieczeństwo
Trudno kontrolować dostęp na poziomie zespołu w regułach Firestore

## Problem 5: Duplikacja danych specyficznych dla zespołu
```typescript
players/jan-kowalski = {
  actionsSent: {
    "match1": [...], // Ale z którego zespołu był ten mecz?
    "match2": [...]
  },
  matchesInfo: {
    "match1": { position: "LW" } // Pozycja w którym zespole?
  }
}
```

## Praktyczne przypadki w aplikacji:

### Przypadek 1: Transfer w trakcie sezonu
- Zawodnik przechodzi z Rezerw do Trampenów
- W obecnej strukturze: zachowuje wszystkie dane
- **Problem**: Nie wiadomo która akcja z którego okresu

### Przypadek 2: Równoczesna gra w dwóch zespołach
- Junior gra w Trampenach + wypożyczony do Rezerw
- **Problem**: Różne numery, różne pozycje, różne kontrakty

### Przypadek 3: Zawodnik powraca do zespołu
- Grał w Rezerwach → odszedł → wrócił
- **Problem**: Brak historii członkostwa 