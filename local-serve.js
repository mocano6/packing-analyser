const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8000;
const OUT_DIR = path.join(__dirname, 'out');

// Mapowanie rozszerzeń plików do typów MIME
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain'
};

// Tworzenie prostego serwera HTTP
const server = http.createServer((req, res) => {
  // Zapisywanie logów żądań
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  
  // Parsowanie URL
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;
  
  // Ustaw ścieżkę do pliku
  let filePath = path.join(OUT_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // Sprawdź, czy plik istnieje i czy jest to katalog
  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
  } catch (err) {
    // Jeśli plik nie istnieje, spróbuj przekierować na index.html (dla SPA)
    filePath = path.join(OUT_DIR, 'index.html');
  }
  
  // Pobierz rozszerzenie pliku
  const extname = path.extname(filePath).toLowerCase();
  
  // Ustaw typ MIME
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';
  
  // Dodaj nagłówki CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Próbuj odczytać plik
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // Plik nie istnieje, zwróć 404
        console.error(`Plik nie znaleziony: ${filePath}`);
        fs.readFile(path.join(OUT_DIR, '404.html'), (err, content) => {
          if (err) {
            // Nie można znaleźć strony 404, zwróć prostą odpowiedź
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<html><body><h1>404 Nie znaleziono</h1><p>Strona, której szukasz, nie istnieje.</p></body></html>');
          } else {
            // Zwróć stronę 404
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end(content);
          }
        });
      } else {
        // Inny błąd serwera
        console.error(`Błąd serwera: ${err.code}`);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h1>500 Błąd serwera</h1><p>Kod błędu: ${err.code}</p></body></html>`);
      }
    } else {
      // Pomyślnie wczytano plik, zwróć go
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

// Uruchom serwer
server.listen(PORT, () => {
  console.log('\n');
  console.log('🚀 Serwer lokalny uruchomiony!');
  console.log(`👉 Otwórz http://localhost:${PORT} w przeglądarce`);
  console.log('🧪 Możesz teraz testować aplikację lokalnie');
  console.log('🛑 Naciśnij Ctrl+C, aby zatrzymać serwer');
  console.log('\n');
});