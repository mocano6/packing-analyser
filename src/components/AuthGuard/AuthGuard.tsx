"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";

const LoginForm = dynamic(() => import('@/components/LoginForm/LoginForm'), {
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const SetPasswordForGoogleAccountBanner = dynamic(
  () => import('@/components/SetPasswordForGoogleAccountBanner/SetPasswordForGoogleAccountBanner'),
  { loading: () => null },
);

interface AuthGuardProps {
  children: React.ReactNode;
}

/** Dla roli player dozwolony tylko Profil zawodnika; strona startowa = profil */
function isPathAllowedForPlayer(pathname: string | null): boolean {
  if (!pathname) return true;
  if (pathname === '/oczekuje') return true;
  if (pathname.startsWith('/profile')) return true;
  return false;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, isPlayer, userStatus, linkedPlayerId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login" && pathname !== "/") {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  /* Player: strona startowa = profil zawodnika; tylko profil i oczekuje są dozwolone */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isPlayer) return;
    if (userStatus !== 'approved') return;
    if (!isPathAllowedForPlayer(pathname)) {
      const profilePath = linkedPlayerId ? `/profile/${linkedPlayerId}` : '/profile';
      router.replace(profilePath);
    }
  }, [isLoading, isAuthenticated, isPlayer, userStatus, pathname, router, linkedPlayerId]);

  /* Player zalogowany wchodzi na "/" lub /analyzer → przekieruj na profil */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isPlayer) return;
    if (userStatus !== 'approved') return;
    if (pathname === "/" || pathname === "/analyzer") {
      const profilePath = linkedPlayerId ? `/profile/${linkedPlayerId}` : '/profile';
      router.replace(profilePath);
    }
  }, [isLoading, isAuthenticated, isPlayer, userStatus, pathname, router, linkedPlayerId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pathname === "/login" || pathname === "/oczekuje" || pathname === "/") {
    return (
      <>
        <SetPasswordForGoogleAccountBanner />
        {children}
      </>
    );
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

  return (
    <>
      <SetPasswordForGoogleAccountBanner />
      {children}
    </>
  );
} 