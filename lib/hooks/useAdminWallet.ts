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
      
      let privateKeyValue: string | null = null;

      // First, try to fetch from project_settings (project-specific)
      if (projectId) {
        console.log('🔍 Fetching admin wallet from project_settings for project:', projectId);
        const { data: projectData, error: projectError } = await supabase
          .from('project_settings')
          .select('setting_value')
          .eq('project_id', parseInt(projectId))
          .eq('setting_key', 'admin_private_key')
          .single();

        if (!projectError && projectData?.setting_value) {
          privateKeyValue = projectData.setting_value;
          console.log('✅ Found project-specific admin wallet');
        } else {
          console.log('⚠️ No project-specific admin wallet found, trying website_settings...');
        }
      }

      // If no project-specific key found, try website_settings (main website admin)
      if (!privateKeyValue) {
        console.log('🔍 Fetching admin wallet from website_settings (main website)');
        const { data: websiteData, error: websiteError } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        if (!websiteError && websiteData?.value) {
          privateKeyValue = websiteData.value;
          console.log('✅ Found main website admin wallet');
        } else {
          console.log('⚠️ No admin wallet found in either project_settings or website_settings');
        }
      }

      // If still no key found, return null
      if (!privateKeyValue) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      // Convert private key to public key
      try {
        const bs58 = (await import('bs58')).default;
        const privateKeyBytes = bs58.decode(privateKeyValue.trim());
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const walletAddress = keypair.publicKey.toString();
        console.log('✅ Admin wallet address derived:', walletAddress);
        setAdminWalletAddress(walletAddress);
      } catch (decodeError: any) {
        console.error('❌ Error decoding private key:', decodeError);
        setError('Invalid private key format in database');
        setAdminWalletAddress(null);
      }
    } catch (err: any) {
      console.error('❌ Error in fetchAdminWallet:', err);
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
      
      let privateKeyValue: string | null = null;

      // First, try to fetch from project_settings (project-specific)
      if (projectId) {
        const { data: projectData, error: projectError } = await supabase
          .from('project_settings')
          .select('setting_value')
          .eq('project_id', parseInt(projectId))
          .eq('setting_key', 'admin_private_key')
          .single();

        if (!projectError && projectData?.setting_value) {
          privateKeyValue = projectData.setting_value;
        }
      }

      // If no project-specific key found, try website_settings (main website admin)
      if (!privateKeyValue) {
        const { data: websiteData, error: websiteError } = await supabase
          .from('website_settings')
          .select('value')
          .eq('key', 'admin_private_key')
          .single();

        if (!websiteError && websiteData?.value) {
          privateKeyValue = websiteData.value;
        }
      }

      // If still no key found, return null
      if (!privateKeyValue) {
        setAdminWalletAddress(null);
        setLoading(false);
        return;
      }

      const bs58 = (await import('bs58')).default;
      const privateKeyBytes = bs58.decode(privateKeyValue.trim());
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

