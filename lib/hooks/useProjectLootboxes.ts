"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/service/supabase';
import { useProject } from '@/lib/project-context';

export const useProjectLootboxes = () => {
  const { getProjectId, currentProject } = useProject();
  const projectId = getProjectId();
  
  const [lootboxes, setLootboxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debug: Log project changes
  useEffect(() => {
    console.log(`[LOOTBOXES] Project changed: ${currentProject?.id} (${currentProject?.slug})`);
  }, [currentProject?.id, currentProject?.slug]);

  const fetchLootboxes = useCallback(async () => {
    // Use currentProject.id directly to ensure we have the latest project
    const activeProjectId = currentProject?.id || projectId;
    
    if (!activeProjectId) {
      console.log(`[LOOTBOXES] No active project ID, clearing data`);
      setLootboxes([]);
      setLoading(false);
      return;
    }

    console.log(`[LOOTBOXES] Fetching lootboxes for project ID: ${activeProjectId}`);

    try {
      setLoading(true);
      setError(null);

      // Fetch lootboxes from products table - filtered by project_id
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('created_at', { ascending: false });

      if (productsError) {
        throw productsError;
      }

      // Transform products to lootboxes
      const lootboxData = products?.map((product) => ({
        id: product.id,
        type: 'lootbox',
        name: product.name || `Lootbox #${product.id}`,
        price: parseFloat(product.price) || 0,
        percent: product.percentage || 0,
        image: product.image || null,
        rarity: product.rarity || 'Common',
        description: product.description || '',
        rewardCount: 0
      })) || [];

        // Fetch reward counts for each lootbox - filtered by project_id
        try {
          const { data: rewards, error: rewardsError } = await supabase
            .from('token_reward_percentages')
            .select('product_id')
            .eq('project_id', activeProjectId);
        
        if (!rewardsError && rewards) {
          // Count rewards per product/lootbox
          const rewardCounts = rewards.reduce((acc: any, reward: any) => {
            const productId = reward.product_id;
            acc[productId] = (acc[productId] || 0) + 1;
            return acc;
          }, {});
          
          // Update reward counts for each lootbox
          lootboxData.forEach((lootbox: any) => {
            lootbox.rewardCount = rewardCounts[lootbox.id] || 0;
          });
        }
      } catch (err) {
        console.log('Could not fetch reward counts:', err);
      }

      setLootboxes(lootboxData);

    } catch (error: any) {
      console.error('Error fetching lootboxes:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, projectId]);

  const addLootbox = async (lootboxData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }

    console.log(`[LOOTBOXES] Adding lootbox for project ID: ${activeProjectId}`);

    try {
      // Check max_lootboxes limit if set
      if (currentProject?.max_lootboxes !== null && currentProject?.max_lootboxes !== undefined) {
        // Count existing lootboxes for this project
        const { count, error: countError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', activeProjectId);

        if (countError) {
          console.error('Error counting lootboxes:', countError);
        } else {
          const currentCount = count || 0;
          const maxLimit = currentProject.max_lootboxes;
          
          console.log(`[LOOTBOXES] Current count: ${currentCount}, Max limit: ${maxLimit}`);
          
          if (currentCount >= maxLimit) {
            throw new Error(`Maximum lootbox limit reached. This project allows a maximum of ${maxLimit} lootbox${maxLimit === 1 ? '' : 'es'}. You currently have ${currentCount}.`);
          }
        }
      }
      let imageUrl = null;

      // Handle image upload if provided
      if (lootboxData.image) {
        const fileExt = lootboxData.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, lootboxData.image);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
        } else {
          imageUrl = filePath;
        }
      }

      // Insert into products table with project_id
      const { data, error } = await supabase
        .from('products')
        .insert([
          {
            name: lootboxData.name,
            price: lootboxData.price?.toString() || '0',
            percentage: parseInt(lootboxData.percent) || 0,
            image: imageUrl,
            rarity: lootboxData.rarity || 'Common',
            description: lootboxData.description || '',
            project_id: activeProjectId
          }
        ])
        .select();

      if (error) throw error;

      const newLootbox = {
        id: data[0].id,
        type: 'lootbox',
        name: data[0].name,
        price: parseFloat(data[0].price) || 0,
        percent: data[0].percentage || 0,
        image: data[0].image,
        rarity: data[0].rarity || 'Common',
        description: data[0].description || '',
        rewardCount: 0
      };

      setLootboxes(prev => [newLootbox, ...prev]);
      return newLootbox;

    } catch (error: any) {
      console.error('Error adding lootbox:', error);
      throw error;
    }
  };

  const updateLootbox = async (lootboxId: number, lootboxData: any) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }

    console.log(`[LOOTBOXES] Updating lootbox ${lootboxId} for project ID: ${activeProjectId}`);

    try {
      let imageUrl = lootboxData.image;

      // Handle image upload if a new image is provided
      if (lootboxData.image && lootboxData.image instanceof File) {
        const fileExt = lootboxData.image.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const filePath = `products/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('apes-bucket')
          .upload(filePath, lootboxData.image);

        if (uploadError) {
          console.error('Error uploading image:', uploadError);
          imageUrl = null;
        } else {
          imageUrl = filePath;
        }
      }

      const updateData: any = {
        name: lootboxData.name,
        price: lootboxData.price?.toString() || '0',
        percentage: parseInt(lootboxData.percent) || 0,
        rarity: lootboxData.rarity || 'Common',
        description: lootboxData.description || ''
      };

      // Only update image if we have a new one
      if (imageUrl !== null && lootboxData.image instanceof File) {
        updateData.image = imageUrl;
      }

      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', lootboxId)
        .eq('project_id', activeProjectId) // Ensure we only update this project's lootbox
        .select();

      if (error) throw error;

      // Update the lootbox in local state
      setLootboxes(prev => prev.map(lootbox => 
        lootbox.id === lootboxId 
          ? { 
              ...lootbox, 
              name: data[0].name,
              price: parseFloat(data[0].price) || 0,
              percent: data[0].percentage || 0,
              image: data[0].image,
              rarity: data[0].rarity || 'Common',
              description: data[0].description || ''
            }
          : lootbox
      ));

      return data[0];

    } catch (error: any) {
      console.error('Error updating lootbox:', error);
      throw error;
    }
  };

  const deleteLootbox = async (lootboxId: number) => {
    const activeProjectId = currentProject?.id || projectId;
    if (!activeProjectId) {
      throw new Error('No project ID');
    }

    console.log(`[LOOTBOXES] Deleting lootbox ${lootboxId} for project ID: ${activeProjectId}`);

    try {
      // Delete from products table - ensure it belongs to this project
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', lootboxId)
        .eq('project_id', activeProjectId);

      if (error) throw error;

      // Remove from local state
      setLootboxes(prev => prev.filter(lootbox => lootbox.id !== lootboxId));

    } catch (error: any) {
      console.error('Error deleting lootbox:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Clear data immediately when project changes
    if (!projectId || !currentProject) {
      console.log(`[LOOTBOXES] No project ID or currentProject, clearing data`);
      setLootboxes([]);
      setLoading(false);
      return;
    }
    
    // Double-check: Ensure we're using the correct project ID
    if (currentProject.id !== projectId) {
      console.warn(`[LOOTBOXES] Project ID mismatch! currentProject.id=${currentProject.id}, projectId=${projectId}`);
      setLootboxes([]);
      setLoading(false);
      return;
    }
    
    console.log(`[LOOTBOXES] Fetching lootboxes for project: ${projectId} (${currentProject.slug})`);
    // Fetch lootboxes for the current project
    fetchLootboxes();
  }, [projectId, currentProject?.id, currentProject?.slug, fetchLootboxes]);

  return {
    lootboxes,
    loading,
    error,
    addLootbox,
    updateLootbox,
    deleteLootbox,
    refetch: fetchLootboxes
  };
};

