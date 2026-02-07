/**
 * Client Project Management Service
 * For master dashboard to create and manage client projects
 */

import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createProject, deriveProjectPDA, generateProjectId } from './project-service';
import { supabase } from './supabase'; // You'll need to set up Supabase client

const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=5a1a852c-3ed9-40ee-bca8-dda4550c3ce8';

/**
 * Create a new client project (both on-chain and off-chain)
 */
export async function createClientProject(
  connection: Connection,
  wallet: {
    publicKey: PublicKey;
    sendTransaction: (tx: Transaction, connection: Connection, options?: any) => Promise<string>;
  },
  clientName: string,
  clientEmail?: string,
  projectName?: string,
  projectDescription?: string
): Promise<{
  projectId: number;
  onChainProjectId: string;
  projectPDA: string;
  signature: string;
}> {
  
  // Generate unique project ID
  const onChainProjectId = generateProjectId();
  const name = projectName || `${clientName}'s Project`;
  const description = projectDescription || `Project for ${clientName}`;

  // Create on-chain project
  const onChainResult = await createProject(
    connection,
    wallet,
    onChainProjectId,
    name,
    description,
    new PublicKey('So11111111111111111111111111111111111111112'), // SOL mint
    1_000_000 // 0.001 SOL fee
  );

  // Create off-chain project record in database
  const { data: dbProject, error } = await supabase
    .from('projects')
    .insert({
      project_id: onChainProjectId.toString(),
      project_pda: onChainResult.projectPDA.toString(),
      name: name,
      description: description,
      client_name: clientName,
      client_email: clientEmail,
      admin_wallet: wallet.publicKey.toString(),
      mint_address: 'So11111111111111111111111111111111111111112',
      fee_amount: '1000000',
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create project in database: ${error.message}`);
  }

  return {
    projectId: dbProject.id,
    onChainProjectId: onChainProjectId.toString(),
    projectPDA: onChainResult.projectPDA.toString(),
    signature: onChainResult.signature,
  };
}

/**
 * Reset project data for a client (fresh start)
 */
export async function resetClientProject(projectId: number): Promise<void> {
  const { error } = await supabase.rpc('reset_project_data', {
    target_project_id: projectId,
  });

  if (error) {
    throw new Error(`Failed to reset project data: ${error.message}`);
  }
}

/**
 * Get all client projects
 */
export async function getAllClientProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

/**
 * Get project statistics
 */
export async function getProjectStats(projectId: number) {
  const { data, error } = await supabase
    .from('project_stats')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update project settings
 */
export async function updateProjectSetting(
  projectId: number,
  key: string,
  value: string
) {
  const { data, error } = await supabase
    .from('project_settings')
    .upsert({
      project_id: projectId,
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get project setting
 */
export async function getProjectSetting(projectId: number, key: string) {
  const { data, error } = await supabase
    .from('project_settings')
    .select('setting_value')
    .eq('project_id', projectId)
    .eq('setting_key', key)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
  return data?.setting_value || null;
}


