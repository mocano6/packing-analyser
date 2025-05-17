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
      // Dla pełnej kompatybilności z vh.pl, usuń podwójne ukośniki w ścieżkach URL
      { pattern: /https:\/\//g, replacement: 'https:/' },
      { pattern: /http:\/\//g, replacement: 'http:/' },
      // Napraw assetPrefix
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

// Naprawienie plików HTML specjalnie dla vh.pl
function fixHtml(filePath) {
  if (!filePath.endsWith('.html')) {
    return;
  }

  try {
    console.log(`Specjalna naprawa HTML: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Dodaj bazową ścieżkę potrzebną dla vh.pl
    if (!content.includes('<base href="') && !content.includes('<base href=\'')) {
      const headEnd = content.indexOf('</head>');
      if (headEnd !== -1) {
        const baseTag = '<base href=".">\n  ';
        content = content.slice(0, headEnd) + baseTag + content.slice(headEnd);
        console.log('✅ Dodano tag <base href=".">');
      }
    }
    
    fs.writeFileSync(filePath, content);
  } catch (error) {
    console.error(`❌ Błąd podczas naprawy HTML ${filePath}:`, error);
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

// Główna funkcja
console.log('🔍 Rozpoczęto naprawę ścieżek dla wdrożenia na vh.pl...');

// Sprawdź czy katalog out istnieje
if (!fs.existsSync(outDir)) {
  console.error('❌ Katalog out nie istnieje! Najpierw zbuduj aplikację za pomocą "npm run build"');
  process.exit(1);
}

// Napraw ścieżki we wszystkich plikach
walkDir(outDir, fixPaths);

// Napraw pliki HTML dla vh.pl
walkDir(outDir, fixHtml);

// Utwórz plik index.php dla vh.pl
createPhpIndex();

// Uruchom skrypt dla ulepszonego index.html
try {
  console.log('🔄 Uruchamianie skryptu enhanced-index.js...');
  require('./enhanced-index.js');
} catch (error) {
  console.error('❌ Błąd podczas uruchamiania enhanced-index.js:', error);
}

console.log('✅ Zakończono naprawę ścieżek! Aplikacja jest gotowa do wdrożenia na vh.pl'); 