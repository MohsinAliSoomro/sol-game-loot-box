"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

export const useProjectJackpotPools = () => {
  const { getProjectId, currentProject } = useProject();
  const projectId = getProjectId();
  
  const [jackpots, setJackpots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJackpots = useCallback(async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      console.log(`[JACKPOTS] No active project ID, clearing data`);
      setJackpots([]);
      setLoading(false);
      return;
    }

    console.log(`[JACKPOTS] Fetching jackpots for project ID: ${activeProjectId}`);

    try {
      setLoading(true);
      setError(null);

      // Fetch jackpots - filtered by project_id
      const { data, error: fetchError } = await supabase
        .from('jackpot_pools')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('id', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      // Transform the data to match the expected format
      const transformedJackpots = data?.map(jackpot => ({
        id: jackpot.id,
        name: jackpot.name,
        title: jackpot.name,
        description: jackpot.description,
        timer: jackpot.end_time ? new Date(jackpot.end_time).toLocaleString() : 'No end time',
        ticketSold: 0,
        price: jackpot.ticket_price || 0,
        currentAmount: jackpot.current_amount || 0,
        maxTickets: jackpot.max_tickets || 0,
        endTime: jackpot.end_time,
        isActive: jackpot.is_active,
        image: jackpot.image,
        itemPrice: jackpot.item_price || null, // Price in OGX/tokens for item rewards
        createdAt: jackpot.created_at,
        updatedAt: jackpot.updated_at
      })) || [];

      setJackpots(transformedJackpots);

    } catch (error: any) {
      console.error('Error fetching jackpots:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, projectId]);

  const addJackpot = async (jackpotData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }
    console.log(`[JACKPOTS] Adding jackpot for project ID: ${activeProjectId}`);

    try {
      // Check max_jackpots limit if set
      if (currentProject?.max_jackpots !== null && currentProject?.max_jackpots !== undefined) {
        // Count existing jackpots for this project
        const { count, error: countError } = await supabase
          .from('jackpot_pools')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', activeProjectId);

        if (countError) {
          console.error('Error counting jackpots:', countError);
        } else {
          const currentCount = count || 0;
          const maxLimit = currentProject.max_jackpots;
          
          console.log(`[JACKPOTS] Current count: ${currentCount}, Max limit: ${maxLimit}`);
          
          if (currentCount >= maxLimit) {
            throw new Error(`Maximum jackpot limit reached. This project allows a maximum of ${maxLimit} jackpot${maxLimit === 1 ? '' : 's'}. You currently have ${currentCount}.`);
          }
        }
      }
      let imageUrl = null;

      // Handle image upload if provided
      if (jackpotData.image) {
        // Check if it's a File object (image upload) or string (image URL or NFT mint address)
        if (typeof jackpotData.image === 'string') {
          // Check if it's a valid HTTP URL (image URL) or a mint address
          if (jackpotData.image.startsWith('http://') || jackpotData.image.startsWith('https://')) {
            // It's an image URL, use as-is
            imageUrl = jackpotData.image;
          } else if (jackpotData.image.length >= 32 && jackpotData.image.length <= 44 && 
                     !jackpotData.image.includes('/') && !jackpotData.image.includes('.')) {
            // It's an NFT mint address (base58, 32-44 chars, no slashes/dots)
            // Store the mint address - we'll fetch the image when displaying
            imageUrl = jackpotData.image;
          } else {
            // It's some other string, use as-is (might be a file path)
          imageUrl = jackpotData.image;
          }
        } else if (jackpotData.image instanceof File) {
          // It's a file upload
          const fileExt = jackpotData.image.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `jackpots/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('apes-bucket')
            .upload(filePath, jackpotData.image);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
          } else {
            imageUrl = filePath;
          }
        }
      }

      const { data, error } = await supabase
        .from('jackpot_pools')
        .insert([
          {
            name: jackpotData.name,
            description: jackpotData.description,
            current_amount: 0,
            ticket_price: jackpotData.price || 0,
            max_tickets: jackpotData.maxTickets || 1000,
            end_time: jackpotData.endTime || null,
            is_active: jackpotData.isActive !== false,
            image: imageUrl,
            project_id: activeProjectId,
            item_price: jackpotData.itemPrice ? parseFloat(jackpotData.itemPrice) : null // Price in OGX/tokens for item rewards
          }
        ])
        .select();

      if (error) throw error;

      const newJackpot = {
        id: data[0].id,
        name: data[0].name,
        title: data[0].name,
        description: data[0].description,
        timer: data[0].end_time ? new Date(data[0].end_time).toLocaleString() : 'No end time',
        ticketSold: 0,
        price: data[0].ticket_price || 0,
        currentAmount: 0,
        maxTickets: data[0].max_tickets || 0,
        endTime: data[0].end_time,
        isActive: data[0].is_active,
        image: data[0].image,
        itemPrice: data[0].item_price || null, // Price in OGX/tokens for item rewards
        createdAt: data[0].created_at,
        updatedAt: data[0].updated_at
      };

      setJackpots(prev => [newJackpot, ...prev]);
      return newJackpot;

    } catch (error: any) {
      console.error('Error adding jackpot:', error);
      throw error;
    }
  };

  const updateJackpot = async (jackpotId: number, jackpotData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }
    console.log(`[JACKPOTS] Updating jackpot ${jackpotId} for project ID: ${activeProjectId}`);

    try {
      let imageUrl = jackpotData.image;

      // Handle image upload if a new image is provided
      if (jackpotData.image) {
        if (typeof jackpotData.image === 'string') {
          // It's an NFT mint address or existing image path
          imageUrl = jackpotData.image;
        } else if (jackpotData.image instanceof File) {
          // It's a new file upload
          const fileExt = jackpotData.image.name.split('.').pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `jackpots/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('apes-bucket')
            .upload(filePath, jackpotData.image);

          if (uploadError) {
            console.error('Error uploading image:', uploadError);
            imageUrl = null;
          } else {
            imageUrl = filePath;
          }
        }
      }

      const updateData: any = {
        name: jackpotData.name,
        description: jackpotData.description,
        ticket_price: jackpotData.price || 0,
        max_tickets: jackpotData.maxTickets || 1000,
        end_time: jackpotData.endTime || null,
        is_active: jackpotData.isActive !== false,
        item_price: jackpotData.itemPrice ? parseFloat(jackpotData.itemPrice) : null // Price in OGX/tokens for item rewards
      };

      // Only update image if we have a new one
      if (imageUrl !== null) {
        updateData.image = imageUrl;
      }

      const { data, error } = await supabase
        .from('jackpot_pools')
        .update(updateData)
        .eq('id', jackpotId)
        .eq('project_id', activeProjectId) // Ensure we only update this project's jackpot
        .select();

      if (error) throw error;

      setJackpots(prev => prev.map(jackpot => 
        jackpot.id === jackpotId 
          ? { 
              ...jackpot, 
              name: data[0].name,
              title: data[0].name,
              description: data[0].description,
              price: data[0].ticket_price || 0,
              maxTickets: data[0].max_tickets || 0,
              endTime: data[0].end_time,
              isActive: data[0].is_active,
              image: data[0].image,
              itemPrice: data[0].item_price || null, // Price in OGX/tokens for item rewards
              timer: data[0].end_time ? new Date(data[0].end_time).toLocaleString() : 'No end time'
            }
          : jackpot
      ));

      return data[0];

    } catch (error: any) {
      console.error('Error updating jackpot:', error);
      throw error;
    }
  };

  const deleteJackpot = async (jackpotId: number) => {
    if (!projectId) {
      throw new Error('No project ID');
    }

    try {
      const { error } = await supabase
        .from('jackpot_pools')
        .delete()
        .eq('id', jackpotId)
        .eq('project_id', projectId);

      if (error) throw error;

      setJackpots(prev => prev.filter(jackpot => jackpot.id !== jackpotId));

    } catch (error: any) {
      console.error('Error deleting jackpot:', error);
      throw error;
    }
  };

  // Check if an NFT mint address is already used in any jackpot for this project
  const checkNFTExists = async (nftMintAddress: string, excludeJackpotId: number | null = null) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId || !nftMintAddress) return false;

    try {
      let query = supabase
        .from('jackpot_pools')
        .select('id, name, image')
        .eq('image', nftMintAddress)
        .eq('project_id', activeProjectId);
      
      if (excludeJackpotId) {
        query = query.neq('id', excludeJackpotId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error checking NFT existence:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('Error in checkNFTExists:', error);
      return false;
    }
  };

  // Get all NFT mint addresses currently used in jackpots for this project
  const getUsedNFTMints = async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) return [];

    try {
      const { data, error } = await supabase
        .from('jackpot_pools')
        .select('image')
        .eq('project_id', activeProjectId);

      if (error) {
        console.error('Error fetching used NFT mints:', error);
        return [];
      }

      // Filter to only NFT mint addresses
      const usedMints = (data || [])
        .map(jackpot => jackpot.image)
        .filter(image => {
          return image && 
                 typeof image === 'string' && 
                 image.length >= 32 && 
                 image.length <= 44 && 
                 !image.includes('/') &&
                 !image.includes('.');
        });

      return usedMints;
    } catch (error) {
      console.error('Error in getUsedNFTMints:', error);
      return [];
    }
  };

  // Get all NFT mint addresses currently used in lootboxes for this project
  const getLootboxNFTMints = async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) return [];

    try {
      const { data, error } = await supabase
        .from('nft_reward_percentages')
        .select('mint_address, product_id')
        .eq('project_id', activeProjectId);

      if (error) {
        console.error('Error fetching lootbox NFT mints:', error);
        return [];
      }

      const usedMints = (data || [])
        .map(reward => reward.mint_address)
        .filter(Boolean)
        .filter((mint, index, self) => self.indexOf(mint) === index);

      return usedMints;
    } catch (error) {
      console.error('Error in getLootboxNFTMints:', error);
      return [];
    }
  };

  // Get all NFT mint addresses currently in user carts for this project
  const getCartNFTMints = async () => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) return [];

    try {
      const { data, error } = await supabase
        .from('prizeWin')
        .select('mint, isWithdraw, reward_type')
        .eq('isWithdraw', false)
        .eq('reward_type', 'nft')
        .eq('project_id', activeProjectId)
        .not('mint', 'is', null);

      if (error) {
        console.error('Error fetching cart NFT mints:', error);
        return [];
      }

      const cartMints = (data || [])
        .map(prize => prize.mint)
        .filter(Boolean)
        .filter((mint, index, self) => self.indexOf(mint) === index);

      return cartMints;
    } catch (error) {
      console.error('Error in getCartNFTMints:', error);
      return [];
    }
  };

  useEffect(() => {
    // Clear data immediately when project changes
    if (!projectId || !currentProject) {
      console.log(`[JACKPOTS] No project ID or currentProject, clearing data`);
      setJackpots([]);
      setLoading(false);
      return;
    }
    
    // Double-check: Ensure we're using the correct project ID
    if (currentProject.id !== projectId) {
      console.warn(`[JACKPOTS] Project ID mismatch! currentProject.id=${currentProject.id}, projectId=${projectId}`);
      setJackpots([]);
      setLoading(false);
      return;
    }
    
    console.log(`[JACKPOTS] Fetching jackpots for project: ${projectId} (${currentProject.slug})`);
    // Fetch jackpots for the current project
    fetchJackpots();
  }, [projectId, currentProject?.id, currentProject?.slug, fetchJackpots]);

  return {
    jackpots,
    loading,
    error,
    addJackpot,
    updateJackpot,
    deleteJackpot,
    checkNFTExists,
    getUsedNFTMints,
    getLootboxNFTMints,
    getCartNFTMints,
    refetch: fetchJackpots
  };
};

