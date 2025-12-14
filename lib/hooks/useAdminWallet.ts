"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/service/supabase';
import { Keypair } from '@solana/web3.js';

/**
 * Hook to fetch admin wallet address from database
 * Retrieves the admin private key from project_settings table (project-scoped)
 * and converts it to a public key (wallet address)
 */
export const useAdminWallet = () => {
  const [adminWalletAddress, setAdminWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdminWallet();
  }, []);

  const fetchAdminWallet = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get project_id from localStorage
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      // Fetch admin private key from project_settings table (project-scoped)
      // Each project must have its own admin_private_key configured
      // NO fallback to website_settings - each project is isolated
      const { data, error: fetchError } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', parseInt(projectId))
        .eq('setting_key', 'admin_private_key')
        .single();

      // If no project-specific admin key is configured, return null
      // This ensures each project admin must configure their own wallet
      if (fetchError || !data?.setting_value) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      // Convert private key to public key
      try {
        const bs58 = (await import('bs58')).default;
        const privateKeyBytes = bs58.decode(data.setting_value.trim());
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const walletAddress = keypair.publicKey.toString();
        setAdminWalletAddress(walletAddress);
      } catch (decodeError: any) {
        console.error('Error decoding private key:', decodeError);
        setError('Invalid private key format in database');
        setAdminWalletAddress(null);
      }
    } catch (err: any) {
      console.error('Error in fetchAdminWallet:', err);
      setError(err.message);
      setAdminWalletAddress(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAdminWallet = async () => {
    setLoading(true);
    setError(null);

    try {
      const projectId = localStorage.getItem('currentProjectId');
      if (!projectId) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      // Fetch admin private key from project_settings table (project-scoped)
      // Each project must have its own admin_private_key configured
      // NO fallback to website_settings - each project is isolated
      const { data, error: fetchError } = await supabase
        .from('project_settings')
        .select('setting_value')
        .eq('project_id', parseInt(projectId))
        .eq('setting_key', 'admin_private_key')
        .single();

      // If no project-specific admin key is configured, return null
      // This ensures each project admin must configure their own wallet
      if (fetchError || !data?.setting_value) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      const bs58 = (await import('bs58')).default;
      const privateKeyBytes = bs58.decode(data.setting_value.trim());
      const keypair = Keypair.fromSecretKey(privateKeyBytes);
      const walletAddress = keypair.publicKey.toString();
      setAdminWalletAddress(walletAddress);
    } catch (err: any) {
      console.error('Error refreshing admin wallet:', err);
      setError(err.message);
      setAdminWalletAddress(null);
    } finally {
      setLoading(false);
    }
  };

  return {
    adminWalletAddress,
    loading,
    error,
    refreshAdminWallet
  };
};

