import { supabase } from "@/service/supabase";

export interface JackpotPool {
  id: number;
  name: string;
  description: string;
  min_amount: number;
  max_amount: number;
  current_amount: number;
  contribution_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JackpotWin {
  id: number;
  pool_id: number;
  user_id: string;
  amount: number;
  win_type: string;
  is_claimed: boolean;
  created_at: string;
  pool?: JackpotPool;
}

export class JackpotService {
  // Get all active jackpot pools
  static async getActivePools(): Promise<JackpotPool[]> {
    try {
      const { data, error } = await supabase
        .from('jackpot_pools')
        .select('*')
        .eq('is_active', true)
        .order('current_amount', { ascending: false });

      if (error) {
        console.error('Error fetching jackpot pools:', error);
        // Return mock data if table doesn't exist
        if (error.message.includes('relation "jackpot_pools" does not exist')) {
          return [
            {
              id: 1,
              name: 'Mini Jackpot',
              description: 'Small daily jackpot for quick wins',
              min_amount: 0.1,
              max_amount: 10,
              current_amount: 0.5,
              contribution_rate: 0.01,
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ];
        }
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActivePools:', error);
      return [];
    }
  }

  // Get jackpot setting
  static async getSetting(key: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('jackpot_settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error) {
        console.error('Error fetching setting:', error);
        return null;
      }

      return data?.value || null;
    } catch (error) {
      console.error('Error in getSetting:', error);
      return null;
    }
  }

  // Check if user wins jackpot
  static async checkJackpotWin(
    userId: string,
    spinAmount: number
  ): Promise<{ won: boolean; pool?: JackpotPool; winAmount?: number }> {
    try {
      // Get jackpot settings
      const winChance = await this.getSetting('jackpot_win_chance');
      const baseChance = parseFloat(winChance || '0.001'); // 0.1% default

      // Calculate win chance based on spin amount (higher spins = higher chance)
      const adjustedChance = baseChance * (1 + Math.log10(spinAmount + 1));
      const random = Math.random();

      if (random < adjustedChance) {
        // User won! Determine which pool they win
        const pools = await this.getActivePools();
        if (pools.length === 0) {
          return { won: false };
        }

        // Weight pools by their current amount (higher amount = higher chance)
        const totalAmount = pools.reduce((sum, pool) => sum + pool.current_amount, 0);
        let randomPool = Math.random() * totalAmount;
        
        for (const pool of pools) {
          randomPool -= pool.current_amount;
          if (randomPool <= 0) {
            // User wins this pool
            const winAmount = pool.current_amount;
            
            // Record the win
            await this.recordJackpotWin(pool.id, userId, winAmount, 'jackpot');
            
            // Reset pool to minimum amount
            await this.resetPool(pool.id);
            
            return {
              won: true,
              pool,
              winAmount
            };
          }
        }
      }

      return { won: false };
    } catch (error) {
      console.error('Error in checkJackpotWin:', error);
      return { won: false };
    }
  }

  // Record jackpot win
  static async recordJackpotWin(
    poolId: number,
    userId: string,
    amount: number,
    winType: string = 'jackpot'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('jackpot_wins')
        .insert({
          pool_id: poolId,
          user_id: userId,
          amount: amount,
          win_type: winType,
          is_claimed: false
        });

      if (error) {
        console.error('Error recording jackpot win:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in recordJackpotWin:', error);
      return false;
    }
  }

  // Reset pool to minimum amount
  static async resetPool(poolId: number): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('jackpot_pools')
        .update({ current_amount: 0 })
        .eq('id', poolId);

      if (error) {
        console.error('Error resetting pool:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in resetPool:', error);
      return false;
    }
  }

  // Get user's jackpot wins
  static async getUserWins(userId: string): Promise<JackpotWin[]> {
    try {
      const { data, error } = await supabase
        .from('jackpot_wins')
        .select(`
          *,
          jackpot_pools (
            id,
            name,
            description
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user wins:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserWins:', error);
      return [];
    }
  }

  // Auto-contribute to jackpots from spin
  static async autoContributeFromSpin(
    userId: string,
    spinAmount: number,
    transactionHash?: string
  ): Promise<{ contributed: boolean; contributions: number }> {
    try {
      const pools = await this.getActivePools();
      let contributions = 0;

      for (const pool of pools) {
        const contributionAmount = spinAmount * pool.contribution_rate;
        
        if (contributionAmount > 0) {
          const { error } = await supabase
            .from('jackpot_pools')
            .update({ 
              current_amount: pool.current_amount + contributionAmount 
            })
            .eq('id', pool.id);

          if (!error) {
            contributions++;
          }
        }
      }

      return { contributed: contributions > 0, contributions };
    } catch (error) {
      console.error('Error in autoContributeFromSpin:', error);
      return { contributed: false, contributions: 0 };
    }
  }
}

export default JackpotService;
