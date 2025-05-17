const fs = require('fs');
const path = require('path');

// Funkcja do rekurencyjnego przeszukiwania katalogu
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

// Zamiana ścieżek bezwzględnych na względne
function fixPaths(filePath) {
  if (!filePath.endsWith('.html') && !filePath.endsWith('.js') && !filePath.endsWith('.css')) {
    return;
  }

  console.log(`Przetwarzanie: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Zamień ścieżki w pliku HTML
  let newContent = content.replace(/href="\/_next\//g, 'href="./_next/');
  newContent = newContent.replace(/src="\/_next\//g, 'src="./_next/');
  newContent = newContent.replace(/fetchPriority="low" href="\/_next\//g, 'fetchPriority="low" href="./_next/');
  newContent = newContent.replace(/as="font" crossorigin="" type="font\/woff2" href="\/_next\//g, 'as="font" crossorigin="" type="font/woff2" href="./_next/');
  
  // Zamień ścieżki do plików SVG i favicon
  newContent = newContent.replace(/href="\/favicon\.ico"/g, 'href="./favicon.ico"');
  newContent = newContent.replace(/src="\/([^\/]+\.svg)"/g, 'src="./$1"');
  newContent = newContent.replace(/from"\/_next\//g, 'from"./_next/');
  newContent = newContent.replace(/:HL\["\/_next\//g, ':HL["./_next/');
  
  // Zapisz plik tylko jeśli coś się zmieniło
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Zaktualizowano ścieżki w pliku: ${filePath}`);
  }
}

console.log('Rozpoczynam naprawianie ścieżek w plikach dla hostingu VH.PL...');
walkDir('./out', fixPaths);
console.log('Zakończono naprawianie ścieżek w plikach.'); 