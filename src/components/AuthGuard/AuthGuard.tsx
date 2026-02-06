"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";
import LoginForm from '@/components/LoginForm/LoginForm';

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Strony dozwolone dla roli player (tylko Statystyki zespołu + Profil zawodnika + strona główna z jednym zawodnikiem) */
const PLAYER_ALLOWED_PATHS = ['/', '/statystyki-zespolu', '/profile', '/oczekuje'] as const;

function isPathAllowedForPlayer(pathname: string | null): boolean {
  if (!pathname) return true;
  if (PLAYER_ALLOWED_PATHS.includes(pathname as any)) return true;
  if (pathname.startsWith('/profile')) return true;
  return false;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isPlayer, userStatus } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isPlayer) return;
    if (userStatus !== 'approved') return;
    if (!isPathAllowedForPlayer(pathname)) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, isPlayer, userStatus, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pathname === '/login' || pathname === '/oczekuje') {
    return <>{children}</>;
  }

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  if (isPlayer && userStatus === 'approved' && !isPathAllowedForPlayer(pathname)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <>{children}</>;
} 