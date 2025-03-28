# Migracja pól strefy w aplikacji Packing Analyzer

## Wprowadzone zmiany

W schemacie bazy danych i kodzie aplikacji dokonano następujących zmian:

1. **Usunięte pola**:
   - `passZone` (Int)
   - `passZoneValue` (Float)
   - `receiveZone` (Int?) 
   - `receiveZoneValue` (Float?)

2. **Dodane nowe pola**:
   - `senderZone` (String?)
   - `receiverZone` (String?)

3. **Zmiana konwencji nazewnictwa**:
   - Zamiast używać `passZone` i `receiveZone`, używamy teraz `senderZone` i `receiverZone`
   - Zamiast przechowywać numery stref, przechowujemy teraz ich nazwy (np. "A1", "B2", itd.)

## Dlaczego dokonano zmian?

1. **Lepsza semantyka**: Nowe nazwy pól lepiej odpowiadają koncepcji nadawcy (`sender`) i odbiorcy (`receiver`).
2. **Lepsze typy danych**: Przechowywanie nazw stref jako tekst zamiast liczb jest bardziej czytelne i pozwala na elastyczne etykietowanie stref.
3. **Usunięcie redundancji**: Nie ma już potrzeby na oddzielne pola wartości (`passZoneValue`, `receiveZoneValue`), ponieważ wartości XT mogą być uzyskane na podstawie nazw stref.

## Jak to działa?

1. Kiedy użytkownik klika na strefę boiska, funkcja `getZoneName` konwertuje numer strefy (0-95) na nazwę strefy (np. "A1", "B2") używając wartości z `XT_VALUES`.
2. Ta nazwa strefy jest przechowywana w polu `senderZone` lub `receiverZone` w bazie danych.
3. Przy odczycie, frontend może użyć nazwy strefy do wyświetlenia odpowiedniej informacji lub wykonania odpowiednich obliczeń.

## Co należy wiedzieć

1. **Zresetowano dane**: Podczas migracji wszystkie dotychczasowe dane w tabeli `ActionsPacking` zostały usunięte. Jeśli miałeś ważne dane, które nie były jeszcze zapisane na serwerze, zostały one utracone.
2. **Zgodność wsteczna**: Stary kod, który odwoływał się do pól `passZone`, `passZoneValue`, `receiveZone` lub `receiveZoneValue` nie będzie już działał i musi zostać zaktualizowany.
3. **Zmiany typów**: Wartości stref są teraz przechowywane jako ciągi znaków (np. "A1", "B2"), a nie jako liczby całkowite, co może wpływać na kod porównujący lub sortujący strefy.

## Jak przetestować

1. Uruchom aplikację używając `npm run dev`.
2. Dodaj co najmniej 2 zawodników i 1 mecz.
3. Spróbuj dodać akcję z użyciem nowych stref.
4. Sprawdź, czy akcja jest poprawnie zapisywana i wyświetlana.

## Narzędzia pomocnicze

W repozytorium dodano kilka skryptów pomocniczych:

1. `node reset.js` - Resetuje stan aplikacji (usuwa cache i regeneruje Prisma Client).
2. `node clean-app.js` - Bardziej zaawansowany reset, który zatrzymuje też serwer.
3. `node debug-query.js` - Testuje zapytania do bazy danych.
4. `node final-test.js` - Testuje strukturę bazy danych i sprawdza, czy migracja została prawidłowo zastosowana.

## Rozwiązywanie problemów

Jeśli napotkasz problemy po migracji:

1. Uruchom `node clean-app.js` i restart przeglądarki.
2. Sprawdź, czy w konsoli przeglądarki nie ma błędów związanych z polami `passZone`, `passZoneValue`, `receiveZone` lub `receiveZoneValue`.
3. Jeśli występują błędy, to prawdopodobnie niektóre komponenty nadal próbują odwoływać się do starych pól - należy je zaktualizować.

---

W razie pytań lub problemów skontaktuj się z zespołem deweloperskim. 