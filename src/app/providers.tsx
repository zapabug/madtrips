'use client';

import React, { memo, useEffect } from 'react';
import { ThemeProvider as NextThemeProvider } from "next-themes";
import { NostrProvider } from '../lib/contexts/NostrContext';
import { initMCP } from '../../mcp';

interface ProvidersProps {
  children: React.ReactNode;
}

// Using memo to prevent unnecessary rerenders
const ProvidersComponent = ({ children }: ProvidersProps) => {
  // Initialize MCP when providers are loaded
  useEffect(() => {
    initMCP();
  }, []);

  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <NostrProvider>
        {children}
      </NostrProvider>
    </NextThemeProvider>
  );
};

export const Providers = memo(ProvidersComponent); 