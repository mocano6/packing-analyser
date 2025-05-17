const express = require('express');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(compression()); // Kompresja dla lepszej wydajności

// Dodaj nagłówki CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Statyczne serwowanie plików z katalogu out
app.use(express.static(path.join(__dirname, 'out')));

// Przekierowanie wszystkich żądań na index.html dla obsługi Single-Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'out', 'index.html'));
});

// Obsługa błędów
app.use((err, req, res, next) => {
  console.error('Błąd serwera:', err);
  res.status(500).send('Wystąpił błąd serwera. Sprawdź konsolę po więcej informacji.');
});

// Uruchomienie serwera
app.listen(PORT, () => {
  console.log('\n');
  console.log('🚀 Serwer lokalny uruchomiony!');
  console.log(`👉 Otwórz http://localhost:${PORT} w przeglądarce`);
  console.log('🧪 Możesz teraz testować aplikację lokalnie');
  console.log('🛑 Naciśnij Ctrl+C, aby zatrzymać serwer');
  console.log('\n');
});