'use client';

import { Inter } from 'next/font/google';
import { ReactNode, useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import ClientLayout from '@/components/ClientLayout/ClientLayout';

const inter = Inter({ subsets: ['latin'] });

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  if (!isClient) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{ 
          width: '40px', 
          height: '40px', 
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }
  
  return (
    <>
      <ClientLayout>{children}</ClientLayout>
      <Toaster position="top-right" />
    </>
  );
} 