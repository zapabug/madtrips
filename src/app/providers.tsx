'use client';

import React, { memo } from 'react';
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { NostrProvider } from '../lib/contexts/NostrContext';

interface ProvidersProps {
  children: React.ReactNode;
}

// Using memo to prevent unnecessary rerenders
const ProvidersComponent = ({ children }: ProvidersProps) => {
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
};

export const Providers = memo(ProvidersComponent); 