const fs = require('fs');
const path = require('path');

// Ścieżka do pliku index.html w katalogu out
const indexPath = path.join(__dirname, 'out', 'index.html');

// Sprawdź czy plik istnieje
if (!fs.existsSync(indexPath)) {
  console.error('❌ Plik index.html nie został znaleziony. Najpierw uruchom next build!');
  process.exit(1);
}

try {
  // Wczytaj zawartość pliku index.html
  const originalContent = fs.readFileSync(indexPath, 'utf8');
  
  // Utwórz nową zawartość z dodatkową obsługą błędów ładowania
  const enhancedContent = `<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Packing Analyzer</title>
    <meta name="description" content="Football data analysis tool" />
    <link rel="icon" href="./favicon.ico" type="image/x-icon" sizes="16x16" />
    <link rel="stylesheet" href="./_next/static/css/050d0908fb8e35e1.css" />
    <link rel="stylesheet" href="./_next/static/css/965c2d918ba47e9b.css" />
    <link rel="stylesheet" href="./_next/static/css/dfe52fc7d0427f30.css" />
    
    <style>
        /* Dodatkowe style do obsługi błędów i zawartości strony */
        body {
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f8fa;
        }
        
        .error-container {
            display: none;
            padding: 20px;
            margin: 20px;
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 4px;
            color: #721c24;
        }

        .app-container {
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        /* Loader */
        .loader {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            width: 100%;
        }

        .spinner {
            border: 4px solid rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #09f;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* Fallback content */
        .fallback-content {
            max-width: 800px;
            margin: 100px auto;
            padding: 30px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            text-align: center;
            display: none;
        }
        
        .fallback-content h1 {
            color: #2c3e50;
            margin-bottom: 20px;
        }
        
        .fallback-content p {
            color: #34495e;
            line-height: 1.6;
            margin-bottom: 15px;
        }
        
        .fallback-btn {
            background-color: #3498db;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 15px;
        }
        
        .fallback-btn:hover {
            background-color: #2980b9;
        }
    </style>
</head>
<body>
    <div id="__next">
        <div class="page_container__aoG4z">
            <div class="loader">
                <div class="spinner"></div>
            </div>
            
            <!-- Fallback content -->
            <div id="fallback-content" class="fallback-content">
                <h1>Packing Analyzer</h1>
                <p>Aplikacja do analizy danych piłkarskich</p>
                <p>Nie udało się załadować aplikacji automatycznie. Przyczyną może być brak niektórych skryptów lub problem z konfiguracją serwera.</p>
                <button class="fallback-btn" onclick="loadAppManually()">Załaduj aplikację ręcznie</button>
            </div>
        </div>
    </div>
    
    <div id="error-container" class="error-container">
        <h3>Wystąpił błąd podczas ładowania aplikacji</h3>
        <p id="error-message">Spróbuj odświeżyć stronę lub skontaktuj się z administratorem.</p>
    </div>

    <script>
        // Funkcja do wykrywania błędów ładowania skryptów
        function handleScriptError(error) {
            console.error('Błąd ładowania skryptu:', error);
            document.getElementById('error-container').style.display = 'block';
            document.getElementById('error-message').textContent = 
                'Nie można załadować niezbędnych skryptów. Sprawdź połączenie internetowe i odśwież stronę.';
            
            // Pokaż fallback content
            document.getElementById('fallback-content').style.display = 'block';
            document.querySelector('.loader').style.display = 'none';
        }

        // Funkcja do dynamicznego ładowania skryptów
        function loadScript(src) {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = src;
                script.async = false; // Zachowaj kolejność ładowania
                script.onload = () => {
                    console.log('Załadowano skrypt:', src);
                    resolve();
                };
                script.onerror = () => {
                    console.error('Błąd ładowania skryptu:', src);
                    reject(new Error(\`Nie można załadować skryptu: \${src}\`));
                };
                document.body.appendChild(script);
            });
        }

        // Ładuj skrypty w odpowiedniej kolejności
        async function loadApp() {
            try {
                // Ładuj główne skrypty aplikacji
                await loadScript('./_next/static/chunks/polyfills-42372ed130431b0a.js');
                await loadScript('./_next/static/chunks/webpack-889089d919370fd1.js');
                await loadScript('./_next/static/chunks/framework-fabc53829daf7685.js');
                await loadScript('./_next/static/chunks/main-4f729480103660ed.js');
                await loadScript('./_next/static/chunks/684-4fddc56f19bead06.js');
                await loadScript('./_next/static/chunks/main-app-42980511748c794c.js');
                
                // Dodatkowe skrypty, które mogą być potrzebne
                await loadScript('./_next/static/chunks/4bd1b696-f4d38166f50d0f75.js');
                await loadScript('./_next/static/chunks/568-47733652601af56a.js');
                await loadScript('./_next/static/chunks/183-4fc111d439006132.js');
                await loadScript('./_next/static/chunks/412-bb43be10cabc4b6e.js');
                
                // Na końcu załaduj główną stronę
                await loadScript('./_next/static/chunks/app/page-a98511c636bcb78e.js');
                
                console.log('Wszystkie skrypty załadowane pomyślnie!');
                
                // Usuń loader po załadowaniu wszystkich skryptów
                document.querySelector('.loader').style.display = 'none';
            } catch (error) {
                handleScriptError(error);
            }
        }
        
        // Funkcja ręcznego ładowania aplikacji
        function loadAppManually() {
            console.log('Ręczne ładowanie aplikacji...');
            document.getElementById('fallback-content').style.display = 'none';
            document.querySelector('.loader').style.display = 'flex';
            
            // Utwórz podstawową strukturę DOM dla aplikacji
            const appRoot = document.createElement('div');
            appRoot.id = 'app-root';
            appRoot.innerHTML = \`
                <div class="Instructions_instructionsContainer__pMI5g">
                    <button class="Instructions_toggleButton__meEul" aria-expanded="false">
                        <span class="Instructions_toggleIcon__At5I7">📖</span>
                        Pokaż instrukcję
                        <span class="Instructions_arrow__vQs0D">▼</span>
                    </button>
                </div>
                <div class="MatchInfoHeader_matchInfoContainer__ikW30">
                    <div class="MatchInfoHeader_headerControls__dCoAR">
                        <div class="MatchInfoHeader_teamSelector__HG8Zx">
                            <select class="TeamsSelector_teamsSelector__kIxmH MatchInfoHeader_teamDropdown__Z_lEg">
                                <option value="89039437-62a7-4eda-b67d-70a4fb24e4ea" selected>Rezerwy</option>
                                <option value="1595da8a-a9d6-463d-a49d-5e2c41ff36be">U19</option>
                                <option value="58f3862c-75d5-4fa7-a18d-0c8e3b00402a">U17</option>
                                <option value="06141fa4-80bc-404e-8fcb-63ef2d0a7815">U16</option>
                                <option value="0ebf0d57-4f2c-4c12-937f-635feb2af332">U15</option>
                            </select>
                        </div>
                        <div class="MatchInfoHeader_controlsContainer__GoNUz">
                            <button class="MatchInfoHeader_addButton__YcFb5">+ Dodaj mecz</button>
                        </div>
                    </div>
                </div>
                <main class="page_content__kDoxQ">
                    <div>Ładowanie zawodników...</div>
                </main>
            \`;
            
            document.querySelector('.page_container__aoG4z').appendChild(appRoot);
            document.querySelector('.loader').style.display = 'none';
            
            // Próbuj ponownie załadować skrypty
            loadApp();
        }

        // Uruchom ładowanie aplikacji po załadowaniu DOM
        document.addEventListener('DOMContentLoaded', loadApp);
        
        // Sprawdź po 5 sekundach, czy aplikacja działa
        setTimeout(() => {
            // Jeśli loader wciąż jest widoczny po 5 sekundach, pokaż fallback content
            if (document.querySelector('.loader').style.display !== 'none') {
                document.getElementById('fallback-content').style.display = 'block';
                document.querySelector('.loader').style.display = 'none';
            }
        }, 5000);

        // Obsługa ogólnych błędów aplikacji
        window.onerror = function(message, source, lineno, colno, error) {
            console.error('Błąd aplikacji:', message, source, lineno, colno, error);
            document.getElementById('error-container').style.display = 'block';
            document.getElementById('error-message').textContent = 
                'Wystąpił nieoczekiwany błąd aplikacji: ' + message;
            return true;
        };
    </script>
</body>
</html>`;

  // Zapisz nową zawartość do pliku index.html
  fs.writeFileSync(indexPath, enhancedContent);
  
  console.log('✅ Pomyślnie wygenerowano wzmocniony plik index.html z obsługą błędów i fallbackiem!');
} catch (error) {
  console.error('❌ Wystąpił błąd podczas przetwarzania pliku index.html:', error);
  process.exit(1);
} 