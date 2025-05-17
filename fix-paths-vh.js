const fs = require('fs');
const path = require('path');

// Katalog out z zbudowaną aplikacją
const outDir = path.join(__dirname, 'out');

// Funkcja do rekurencyjnego przeszukiwania katalogu
function walkDir(dir, callback) {
  try {
    fs.readdirSync(dir).forEach(f => {
      let dirPath = path.join(dir, f);
      let isDirectory = fs.statSync(dirPath).isDirectory();
      isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
  } catch (error) {
    console.error(`Błąd podczas przeszukiwania katalogu ${dir}:`, error);
  }
}

// Zamiana ścieżek bezwzględnych na względne
function fixPaths(filePath) {
  const fileExtension = path.extname(filePath).toLowerCase();
  const allowedExtensions = ['.html', '.js', '.css', '.json', '.map'];
  
  if (!allowedExtensions.includes(fileExtension)) {
    return;
  }

  try {
    console.log(`Przetwarzanie: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    let fileUpdated = false;
    
    // Różne wzorce ścieżek do zastąpienia
    const replacements = [
      // Podstawowe ścieżki
      { pattern: /href="\/_next\//g, replacement: 'href="./_next/' },
      { pattern: /src="\/_next\//g, replacement: 'src="./_next/' },
      { pattern: /"\/_next\//g, replacement: '"./_next/' },
      { pattern: /\(\/_next\//g, replacement: '(./_next/' },
      { pattern: /from"\/_next\//g, replacement: 'from"./_next/' },
      { pattern: /url\(\/_next\//g, replacement: 'url(./_next/' },
      { pattern: /sourceMappingURL=\/_next\//g, replacement: 'sourceMappingURL=./_next/' },
      
      // Poprawienie ścieżek do API
      { pattern: /\/api\//g, replacement: './api/' },
      
      // Poprawienie innych ścieżek absolutnych
      { pattern: /="\/favicon/g, replacement: '="./favicon' },
      { pattern: /="\/assets\//g, replacement: '="./assets/' },
      { pattern: /="\/images\//g, replacement: '="./images/' },
      
      // Naprawianie styli i problemów z czarnym ekranem
      { pattern: /"backgroundColor":"#000"/g, replacement: '"backgroundColor":"#f5f8fa"' },
      { pattern: /"background":"#000"/g, replacement: '"background":"#f5f8fa"' },
      { pattern: /"background-color":"#000"/g, replacement: '"background-color":"#f5f8fa"' },
      { pattern: /background-color:#000/g, replacement: 'background-color:#f5f8fa' },
      { pattern: /background:#000/g, replacement: 'background:#f5f8fa' },
      
      // Poprawianie przedrostków ścieżek dla assetów względnych
      { pattern: /"assetPrefix":""/g, replacement: '"assetPrefix":"."' },
      { pattern: /"buildId":/g, replacement: '"assetPrefix":".","buildId":' }
    ];

    let newContent = content;
    for (const { pattern, replacement } of replacements) {
      const tempContent = newContent.replace(pattern, replacement);
      if (tempContent !== newContent) {
        fileUpdated = true;
        newContent = tempContent;
      }
    }

    if (fileUpdated) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Zaktualizowano: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Błąd podczas przetwarzania pliku ${filePath}:`, error);
  }
}

// Naprawianie styli bezpośrednio w plikach CSS
function fixStyles(filePath) {
  if (!filePath.endsWith('.css')) {
    return;
  }

  try {
    console.log(`Przetwarzanie stylów CSS: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Zastąp czarne tło jaśniejszym
    let newContent = content
      .replace(/background-color:#000/g, 'background-color:#f5f8fa')
      .replace(/background:#000/g, 'background:#f5f8fa')
      .replace(/color:#fff/g, 'color:#333');
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent);
      console.log(`✅ Naprawiono style w: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Błąd podczas naprawiania stylów w ${filePath}:`, error);
  }
}

// Utwórz prosty plik index.php dla integracji z vh.pl
function createPhpIndex() {
  try {
    const phpContent = `<?php
// Przekierowanie dla vh.pl
$uri = $_SERVER['REQUEST_URI'];
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    return false;
} else {
    include_once __DIR__ . '/index.html';
}
?>`;
    fs.writeFileSync(path.join(outDir, 'index.php'), phpContent);
    console.log('✅ Utworzono plik index.php dla vh.pl');
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia pliku index.php:', error);
  }
}

// Funkcja do tworzenia minimalnego HTML do testów
function createTestHtml() {
  try {
    // Minimalna wersja HTML z podstawowymi stylami
    const testHtmlContent = `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Test Packing Analyzer</title>
    <base href=".">
    <style>
        body { 
            font-family: sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f5f8fa; 
            color: #333; 
        }
        .container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
        }
        h1 { color: #2c3e50; }
        p { line-height: 1.6; }
        button { 
            background: #3498db; 
            color: white; 
            border: none; 
            padding: 8px 15px; 
            border-radius: 4px; 
            cursor: pointer; 
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Packing Analyzer - Strona testowa</h1>
        <p>Ta strona służy do weryfikacji, czy podstawowe style i skrypty działają poprawnie.</p>
        <p>Jeśli widzisz ten komunikat, to podstawowe style HTML działają.</p>
        <p><a href="./index.html">Przejdź do głównej aplikacji</a></p>
        <button onclick="testJs()">Testuj JavaScript</button>
        <p id="js-test-result"></p>
    </div>
    
    <script>
        function testJs() {
            document.getElementById('js-test-result').textContent = 'JavaScript działa poprawnie!';
        }
    </script>
</body>
</html>`;
    
    fs.writeFileSync(path.join(outDir, 'test.html'), testHtmlContent);
    console.log('✅ Utworzono stronę testową test.html');
  } catch (error) {
    console.error('❌ Błąd podczas tworzenia strony testowej:', error);
  }
}

// Główna funkcja
console.log('🔍 Rozpoczęto naprawę ścieżek dla wdrożenia na vh.pl...');

// Sprawdź czy katalog out istnieje
if (!fs.existsSync(outDir)) {
  console.error('❌ Katalog out nie istnieje! Najpierw zbuduj aplikację za pomocą "npm run build"');
  process.exit(1);
}

// Napraw ścieżki we wszystkich plikach
walkDir(outDir, fixPaths);

// Napraw style CSS
walkDir(outDir, fixStyles);

// Utwórz plik index.php dla vh.pl
createPhpIndex();

// Utwórz stronę testową
createTestHtml();

// Uruchom skrypt dla ulepszonego index.html
try {
  console.log('🔄 Uruchamianie skryptu enhanced-index.js...');
  require('./enhanced-index.js');
} catch (error) {
  console.error('❌ Błąd podczas uruchamiania enhanced-index.js:', error);
}

console.log('✅ Zakończono naprawę ścieżek! Aplikacja jest gotowa do wdrożenia na vh.pl'); 