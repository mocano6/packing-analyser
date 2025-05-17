const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(compression()); // Kompresja dla lepszej wydajności
app.use(cors()); // Umożliwia cross-origin requests

// Statyczne serwowanie plików z katalogu out
app.use(express.static(path.join(__dirname, 'out')));

// Przekierowanie wszystkich żądań na index.html dla obsługi Single-Page Application
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'out', 'index.html'));
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