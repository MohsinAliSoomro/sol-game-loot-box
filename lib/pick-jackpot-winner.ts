/**
 * Utility functions for picking jackpot winners from contributions
 */

import { supabase } from "@/service/supabase";

export interface Contribution {
  id: number;
  pool_id: number;
  user_id: string;
  amount: number;
  contribution_type: string;
  transaction_hash: string | null;
  created_at: string;
}

/**
 * Pick a random winner from jackpot contributions
 * @param poolId - The jackpot pool ID
 * @returns The winning contribution entry with user_id
 */
export async function pickJackpotWinner(poolId: number): Promise<Contribution | null> {
  try {
    // Use the database function to pick a random winner
    // Note: The function returns JSONB, so we need to handle the response structure
    const { data, error } = await supabase.rpc('select_jackpot_winner', {
      pool_id_param: poolId
    });

    if (error) {
      console.error('❌ Error picking winner using RPC:', {
        error: error,
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      // Fallback: Manual random selection
      return await pickWinnerManually(poolId);
    }

    console.log('📊 RPC function response:', {
      data: data,
      dataType: typeof data,
      hasSuccess: data && typeof data === 'object' && 'success' in data
    });

    // The RPC function returns JSONB with structure: {success, winner: {user_id, amount, ...}}
    if (data && typeof data === 'object' && 'success' in data) {
      if (data.success) {
        const winnerData = (data as any).winner;
        if (winnerData && winnerData.user_id) {
          console.log('✅ RPC function successfully selected winner:', {
            user_id: winnerData.user_id,
            amount: winnerData.amount,
            prize_win_id: (data as any).prize_win_id,
            is_nft: winnerData.is_nft
          });
          // Return in Contribution format
          return {
            id: 0, // Not available from RPC
            pool_id: poolId,
            user_id: winnerData.user_id,
            amount: winnerData.amount || 0,
            contribution_type: 'ticket',
            transaction_hash: null,
            created_at: winnerData.created_at || new Date().toISOString()
          } as Contribution;
        } else {
          console.warn('⚠️ RPC returned success but no winner data:', data);
        }
      } else {
        console.error('❌ RPC function returned error:', {
          success: data.success,
          error: (data as any).error,
          message: (data as any).message
        });
      }
    }

    // If RPC didn't work, try manual fallback
    return await pickWinnerManually(poolId);
  } catch (error) {
    console.error('Error in pickJackpotWinner:', error);
    // Fallback: Manual random selection
    return await pickWinnerManually(poolId);
  }
}

/**
 * Manual fallback: Pick a random winner by fetching all contributions
 */
async function pickWinnerManually(poolId: number): Promise<Contribution | null> {
  try {
    // Get all contributions for this pool
    const { data, error } = await supabase
      .from('jackpot_contribution')
      .select('*')
      .eq('pool_id', poolId);

    if (error) {
      console.error('Error fetching contributions:', error);
      return null;
    }

    if (!data || data.length === 0) {
      console.warn('No contributions found for pool:', poolId);
      return null;
    }

    // Pick a random entry
    const randomIndex = Math.floor(Math.random() * data.length);
    return data[randomIndex] as Contribution;
  } catch (error) {
    console.error('Error in pickWinnerManually:', error);
    return null;
  }
}

/**
 * Get all participants for a jackpot pool
 * @param poolId - The jackpot pool ID
 * @returns Array of participants with ticket counts and total contributions
 */
export async function getJackpotParticipants(poolId: number) {
  try {
    const { data, error } = await supabase.rpc('get_jackpot_participants', {
      pool_id_param: poolId
    });

    if (error) {
      console.error('Error getting participants:', error);
      // Fallback: Manual query
      return await getParticipantsManually(poolId);
    }

    return data || [];
  } catch (error) {
    console.error('Error in getJackpotParticipants:', error);
    return await getParticipantsManually(poolId);
  }
}

/**
 * Manual fallback: Get participants by querying contributions
 */
async function getParticipantsManually(poolId: number) {
  try {
    const { data, error } = await supabase
      .from('jackpot_contribution')
      .select('user_id, amount')
      .eq('pool_id', poolId);

    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }

    // Group by user_id
    const participantMap = new Map<string, { ticket_count: number; total_contributed: number }>();
    
    data.forEach((contribution: any) => {
      const userId = contribution.user_id;
      if (participantMap.has(userId)) {
        const existing = participantMap.get(userId)!;
        existing.ticket_count += 1;
        existing.total_contributed += parseFloat(contribution.amount);
      } else {
        participantMap.set(userId, {
          ticket_count: 1,
          total_contributed: parseFloat(contribution.amount)
        });
      }
    });

    return Array.from(participantMap.entries()).map(([user_id, stats]) => ({
      user_id,
      ...stats
    }));
  } catch (error) {
    console.error('Error in getParticipantsManually:', error);
    return [];
  }
}

/**
 * Get total contributions for a jackpot pool
 * @param poolId - The jackpot pool ID
 * @returns Total contribution amount
 */
export async function getJackpotTotalContributions(poolId: number): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_jackpot_total_contributions', {
      pool_id_param: poolId
    });

    if (error) {
      console.error('Error getting total contributions:', error);
      // Fallback: Manual query
      return await getTotalContributionsManually(poolId);
    }

    return parseFloat(data || '0');
  } catch (error) {
    console.error('Error in getJackpotTotalContributions:', error);
    return await getTotalContributionsManually(poolId);
  }
}

/**
 * Manual fallback: Calculate total contributions
 */
async function getTotalContributionsManually(poolId: number): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('jackpot_contribution')
      .select('amount')
      .eq('pool_id', poolId);

    if (error) {
      console.error('Error fetching contributions:', error);
      return 0;
    }

    const total = data?.reduce((sum, contribution: any) => {
      return sum + parseFloat(contribution.amount || '0');
    }, 0) || 0;

    return total;
  } catch (error) {
    console.error('Error in getTotalContributionsManually:', error);
    return 0;
  }
}

/**
 * Get all contributions for a pool (for admin review)
 * @param poolId - The jackpot pool ID
 * @returns Array of all contributions
 */
export async function getAllContributions(poolId: number): Promise<Contribution[]> {
  try {
    const { data, error } = await supabase
      .from('jackpot_contribution')
      .select('*')
      .eq('pool_id', poolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }

    return (data || []) as Contribution[];
  } catch (error) {
    console.error('Error in getAllContributions:', error);
    return [];
  }
}

