import { useEffect, useState } from 'react';
import { useNostr } from './useNostr';
import { NostrStorage } from '@/lib/nostr-storage';
import { CartState, UserSelections } from '@/types/package-types';

const nostrStorage = new NostrStorage();

export function useNostrStorage() {
  const { user } = useNostr();
  const [cart, setCart] = useState<CartState | null>(null);
  const [savedPackages, setSavedPackages] = useState<string[]>([]);
  const [userSelections, setUserSelections] = useState<UserSelections | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data when user connects
  useEffect(() => {
    async function loadData() {
      if (!user?.npub) {
        setLoading(false);
        return;
      }

      try {
        const [cartData, savedPkgs, selections] = await Promise.all([
          nostrStorage.getCart(user.npub),
          nostrStorage.getSavedPackages(user.npub),
          nostrStorage.getUserSelections(user.npub)
        ]);

        setCart(cartData);
        setSavedPackages(savedPkgs);
        setUserSelections(selections);
      } catch (error) {
        console.error('Error loading Nostr data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user?.npub]);

  // Update cart
  const updateCart = async (newCart: CartState) => {
    if (!user?.npub) return;

    try {
      await nostrStorage.storeCart(user.npub, newCart);
      setCart(newCart);
    } catch (error) {
      console.error('Error updating cart:', error);
    }
  };

  // Update saved packages
  const updateSavedPackages = async (packageIds: string[]) => {
    if (!user?.npub) return;

    try {
      await nostrStorage.storeSavedPackages(user.npub, packageIds);
      setSavedPackages(packageIds);
    } catch (error) {
      console.error('Error updating saved packages:', error);
    }
  };

  // Update user selections
  const updateUserSelections = async (selections: UserSelections) => {
    if (!user?.npub) return;

    try {
      await nostrStorage.storeUserSelections(user.npub, selections);
      setUserSelections(selections);
    } catch (error) {
      console.error('Error updating user selections:', error);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      nostrStorage.close();
    };
  }, []);

  return {
    cart,
    savedPackages,
    userSelections,
    loading,
    updateCart,
    updateSavedPackages,
    updateUserSelections
  };
} 