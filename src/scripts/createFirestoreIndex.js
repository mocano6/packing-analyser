/**
 * Instrukcja tworzenia indeksu w Firestore
 * 
 * Błąd: FirebaseError: The query requires an index.
 * 
 * Aby rozwiązać ten problem, należy utworzyć indeks w konsoli Firebase:
 * 
 * 1. Otwórz link z komunikatu błędu:
 *    https://console.firebase.google.com/v1/r/project/rakow-academy-657d6/firestore/indexes?create_composite=ClNwcm9qZWN0cy9yYWtvdy1hY2FkZW15LTY1N2Q2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tYXRjaGVzL2luZGV4ZXMvXxABGggKBHRlYW0QARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg
 * 
 * 2. Zaloguj się do swojego konta Firebase.
 * 
 * 3. Strona automatycznie przeniesie Cię do formularza tworzenia indeksu złożonego.
 *    Formularz powinien mieć już wypełnione następujące pola:
 *    - Kolekcja: matches
 *    - Pola indeksu: team (Ascending), date (Ascending), __name__ (Ascending)
 * 
 * 4. Kliknij przycisk "Create index".
 * 
 * 5. Tworzenie indeksu może potrwać kilka minut. Po zakończeniu procesu, 
 *    zapytanie w aplikacji powinno działać poprawnie.
 * 
 * Alternatywnie, możesz utworzyć indeks ręcznie:
 * 
 * 1. Przejdź do konsoli Firebase: https://console.firebase.google.com/
 * 2. Wybierz swój projekt: rakow-academy-657d6
 * 3. Przejdź do "Firestore Database" w menu bocznym
 * 4. Wybierz zakładkę "Indexes"
 * 5. Kliknij "Create index"
 * 6. Wypełnij formularz:
 *    - Collection: matches
 *    - Fields to index:
 *      - team (Ascending)
 *      - date (Ascending)
 *      - __name__ (Ascending) - to pole jest automatycznie dodawane
 * 7. Kliknij "Create index"
 */

// Niestety, tworzenie indeksów w Firestore nie jest możliwe poprzez API JavaScript
// Musisz utworzyć indeks ręcznie w konsoli Firebase lub przy użyciu Firebase CLI
console.log('Aby utworzyć indeks, proszę postępować zgodnie z instrukcjami w pliku createFirestoreIndex.js');
console.log('Lub otwórz bezpośrednio link:');
console.log('https://console.firebase.google.com/v1/r/project/rakow-academy-657d6/firestore/indexes?create_composite=ClNwcm9qZWN0cy9yYWtvdy1hY2FkZW15LTY1N2Q2L2RhdGFiYXNlcy8oZGVmYXVsdCkvY29sbGVjdGlvbkdyb3Vwcy9tYXRjaGVzL2luZGV4ZXMvXxABGggKBHRlYW0QARoICgRkYXRlEAIaDAoIX19uYW1lX18QAg'); 