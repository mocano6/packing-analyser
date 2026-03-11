'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PresentationContextType {
  isPresentationMode: boolean;
  togglePresentationMode: () => void;
  maskName: (name: string | null | undefined) => string;
}

const PresentationContext = createContext<PresentationContextType>({
  isPresentationMode: false,
  togglePresentationMode: () => {},
  maskName: (name) => name || '',
});

export const usePresentationMode = () => useContext(PresentationContext);

interface PresentationProviderProps {
  children: ReactNode;
}

export const PresentationProvider: React.FC<PresentationProviderProps> = ({ children }) => {
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Initialize from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('presentationMode');
    if (saved) {
      setIsPresentationMode(saved === 'true');
    }
  }, []);

  const togglePresentationMode = () => {
    setIsPresentationMode(prev => {
      const newValue = !prev;
      localStorage.setItem('presentationMode', String(newValue));
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
      return newValue;
    });
  };

  const maskName = (name: string | null | undefined): string => {
    if (!name) return '';
    if (!isPresentationMode) return name;

    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) {
      const part = parts[0];
      return part.charAt(0) + '*'.repeat(Math.max(2, part.length - 1));
    }

    return parts.map(part => {
      if (part.length <= 1) return part;
      return part.charAt(0) + '*'.repeat(part.length - 1);
    }).join(' ');
  };

  return (
    <PresentationContext.Provider value={{ isPresentationMode, togglePresentationMode, maskName }}>
      {children}
    </PresentationContext.Provider>
  );
};
