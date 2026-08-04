"use client";

import React, { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from "@/hooks/useAuth";
import { getScoutHomePath, isScoutPathAllowed } from "@/lib/userRoles";

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
  const { isAuthenticated, isLoading, isPlayer, isScout, userStatus, linkedPlayerId } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const scoutHome = getScoutHomePath();

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== "/login" && pathname !== "/") {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  /**
   * Zalogowany użytkownik nigdy nie powinien zostać na "/" (ekran logowania).
   * Przekierowujemy od razu z poziomu guarda — zanim wyrenderuje się formularz logowania —
   * żeby przy wejściu z aktywną sesją nie migał ekran logowania ani nie było pełnego przeładowania.
   */
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    if (pathname !== "/") return;
    if (isPlayer && userStatus !== "approved") {
      router.replace("/oczekuje");
      return;
    }
    if (isPlayer) {
      router.replace(linkedPlayerId ? `/profile/${linkedPlayerId}` : "/profile");
      return;
    }
    if (isScout) {
      router.replace(scoutHome);
      return;
    }
    router.replace("/analyzer");
  }, [isLoading, isAuthenticated, isPlayer, isScout, userStatus, pathname, router, linkedPlayerId, scoutHome]);

  /* Player: strona startowa = profil zawodnika; tylko profil i oczekuje są dozwolone */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isPlayer) return;
    if (userStatus !== 'approved') return;
    if (!isPathAllowedForPlayer(pathname)) {
      const profilePath = linkedPlayerId ? `/profile/${linkedPlayerId}` : '/profile';
      router.replace(profilePath);
    }
  }, [isLoading, isAuthenticated, isPlayer, userStatus, pathname, router, linkedPlayerId]);

  /* Player zalogowany wchodzi na /analyzer → przekieruj na profil (wejście na "/" obsługuje efekt wyżej) */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isPlayer) return;
    if (userStatus !== 'approved') return;
    if (pathname === "/analyzer") {
      const profilePath = linkedPlayerId ? `/profile/${linkedPlayerId}` : '/profile';
      router.replace(profilePath);
    }
  }, [isLoading, isAuthenticated, isPlayer, userStatus, pathname, router, linkedPlayerId]);

  /* Scout: tylko allowlist (porównywarka, statystyki, profil, GPS, scouting) */
  useEffect(() => {
    if (isLoading || !isAuthenticated || !isScout) return;
    if (!isScoutPathAllowed(pathname)) {
      router.replace(scoutHome);
    }
  }, [isLoading, isAuthenticated, isScout, pathname, router, scoutHome]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (pathname === "/login" || pathname === "/oczekuje" || pathname === "/") {
    /* Zalogowany na "/" jest właśnie przekierowywany (efekt wyżej) — pokaż spinner zamiast
       formularza logowania, żeby nie mignął ekran logowania przed wejściem do aplikacji. */
    if (pathname === "/" && isAuthenticated) {
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

  if (isScout && !isScoutPathAllowed(pathname)) {
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
