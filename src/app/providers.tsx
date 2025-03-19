'use client';

import React from 'react';
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { NostrProvider } from '../lib/contexts/NostrContext';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="dark"
      forcedTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      <NostrProvider>
        {children}
      </NostrProvider>
    </NextThemeProvider>
  );
} 