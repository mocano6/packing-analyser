'use client';

/**
 * Granica błędów Next.js — niełapie błędów w layout.tsx (wtedy global-error).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold text-red-800">Coś poszło nie tak</h1>
      <p className="text-gray-600 max-w-md text-sm" role="status">
        {error.message || 'Nieoczekiwany błąd aplikacji.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-slate-800 px-4 py-2 text-white text-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
      >
        Spróbuj ponownie
      </button>
    </div>
  );
}
