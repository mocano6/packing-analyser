'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const { login, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      // Dodajemy małe opóźnienie, aby użytkownik zobaczył komunikat o sukcesie
      const timer = setTimeout(() => {
        router.push('/');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Proszę wprowadzić hasło');
      return;
    }
    await login(password);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md p-10 space-y-8 bg-white rounded-2xl shadow-xl transform transition-all hover:scale-[1.02]">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-2">Logowanie</h2>
          <p className="text-lg text-gray-600">
            Wprowadź hasło, aby uzyskać dostęp do aplikacji
          </p>
        </div>
        <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="relative block w-full px-4 py-3 text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:z-10 text-lg transition-all"
              placeholder="Wprowadź hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="relative flex justify-center w-full px-6 py-3 text-lg font-semibold text-white bg-blue-600 border-2 border-transparent rounded-xl group hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 