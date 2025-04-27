'use client';

import { ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';

export default function PublicLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      {children}
      <Toaster position="top-right" />
    </>
  );
} 