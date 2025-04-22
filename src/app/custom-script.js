// Skrypt do obsługi przekierowań na GitHub Pages
// Ten skrypt będzie wstrzykiwany przez plugin Next.js do pliku index.html

(function() {
  // Kod przywracający ścieżkę z parametru URL
  var redirect = sessionStorage.redirect;
  delete sessionStorage.redirect;
  
  if (redirect && redirect !== location.href) {
    history.replaceState(null, null, redirect);
  }
  
  // Obsługa parametrów przekierowania z 404.html
  var p = new URLSearchParams(window.location.search).get('p');
  var q = new URLSearchParams(window.location.search).get('q');
  
  if (p) {
    var newUrl = p.replace(/~and~/g, '&');
    if (q) {
      newUrl += '?' + q.replace(/~and~/g, '&');
    }
    window.history.replaceState(null, null, newUrl);
  }
})(); 