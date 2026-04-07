'use client';

/**
 * Błędy w root layout (np. problem z providerami). Wymaga własnych tagów html/body.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pl">
      <body className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center antialiased">
        <h1 className="text-xl font-semibold text-red-800">Błąd krytyczny</h1>
        <p className="text-gray-600 max-w-md text-sm" role="alert">
          {error.message || 'Aplikacja nie mogła się uruchomić.'}
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-slate-800 px-4 py-2 text-white text-sm hover:bg-slate-700"
        >
          Załaduj ponownie
        </button>
      </body>
    </html>
  );
}
