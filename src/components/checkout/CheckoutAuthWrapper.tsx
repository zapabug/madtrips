'use client';

import React, { useEffect, useState } from 'react';
import { useNostr } from '../../lib/contexts/NostrContext';
import { useCartStore } from '../../lib/store/cart-store';

interface CheckoutAuthWrapperProps {
  children: React.ReactNode;
  requireFullAuth?: boolean; // Set to true for payment pages that require full auth
  onStatusChange?: (isFullyAuthenticated: boolean) => void;
}

const CheckoutAuthWrapper: React.FC<CheckoutAuthWrapperProps> = ({
  children,
  requireFullAuth = false,
  onStatusChange
}) => {
  const { user } = useNostr();

  useEffect(() => {
    onStatusChange?.(!!user);
  }, [user, onStatusChange]);

  return <>{children}</>;
};

export default CheckoutAuthWrapper; 
