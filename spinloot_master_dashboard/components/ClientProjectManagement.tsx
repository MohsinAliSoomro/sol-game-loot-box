'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';
import { createProject, generateProjectId, updateProjectFee } from '@/lib/project-service';
import { BN } from '@coral-xyz/anchor';

interface Project {
  id: number;
  project_id: string | number; // Can be string or number (BIGINT from database)
  project_pda: string;
  name: string;
  description: string;
  client_name: string;
  client_email?: string;
  admin_wallet: string;
  mint_address: string;
  fee_amount: string;
  is_active: boolean;
  created_at: string;
}

interface ProjectStats {
  id: number;
  on_chain_project_id: string;
  name: string;
  client_name: string;
  is_active: boolean;
  total_users: number;
  total_transactions: number;
  total_deposits: number;
  total_withdrawals: number;
  created_at: string;
}

export default function ClientProjectManagement() {
  const { publicKey, sendTransaction, wallet, connected } = useWallet();
  const { connection } = useConnection();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<{ [key: number]: ProjectStats }>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditFeeModal, setShowEditFeeModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');
  const [updatingFee, setUpdatingFee] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    project_name: '',
    project_description: '',
    project_fee: '1000000', // Default 0.001 SOL
    max_lootboxes: '',
    max_jackpots: '',
    token_limit: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      fetchStats();
    }
  }, [projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (err: any) {
      console.error('Error fetching projects:', err);
      setError('Failed to fetch projects: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const projectIds = projects.map(p => p.id);
      const { data, error } = await supabase
        .from('project_stats')
        .select('*')
        .in('id', projectIds);

      if (error) throw error;

      const statsMap: { [key: number]: ProjectStats } = {};
      (data || []).forEach((stat: any) => {
        statsMap[stat.id] = stat;
      });
      setStats(statsMap);
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleCreateProject = async () => {
    if (!publicKey || !sendTransaction || !connected) {
      setError('Please connect your wallet first');
      return;
    }

    if (!formData.client_name) {
      setError('Client name is required');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      const projectName = formData.project_name || `${formData.client_name}'s Project`;
      const projectDescription = formData.project_description || `Project for ${formData.client_name}`;
      const onChainProjectId = generateProjectId();

      // Create wallet adapter wrapper for createProject function
      const walletAdapter = {
        publicKey,
        sendTransaction, // Use sendTransaction directly from wallet adapter
      };

      // Create on-chain project
      const onChainResult = await createProject(
        connection,
        walletAdapter as any,
        onChainProjectId,
        projectName,
        projectDescription,
        new PublicKey('So11111111111111111111111111111111111111112'),
        new BN(formData.project_fee || 1000000)
      );

      // Auto-generate slug from project name or client name
      const baseSlug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      // Ensure slug is unique by checking existing slugs
      let slug = baseSlug;
      let slugCounter = 1;
      while (true) {
        const { data: existing } = await supabase
          .from('projects')
          .select('id')
          .eq('slug', slug)
          .single();

        if (!existing) break; // Slug is unique

        slug = `${baseSlug}-${slugCounter}`;
        slugCounter++;
      }

      // Create off-chain project record
      const { data: dbProject, error: dbError } = await supabase
        .from('projects')
        .insert({
          project_id: onChainProjectId.toString(),
          project_pda: onChainResult.projectPDA.toString(),
          name: projectName,
          description: projectDescription,
          client_name: formData.client_name,
          client_email: formData.client_email || null,
          admin_wallet: publicKey.toString(),
          mint_address: 'So11111111111111111111111111111111111111112',
          fee_amount: formData.project_fee || '1000000',
          is_active: true,
          slug: slug, // Auto-generated slug
          max_lootboxes: formData.max_lootboxes ? parseInt(formData.max_lootboxes) : null,
          max_jackpots: formData.max_jackpots ? parseInt(formData.max_jackpots) : null,
          token_limit: formData.token_limit ? parseInt(formData.token_limit) : null,
        })
        .select()
        .single();

      if (dbError) {
        throw new Error(`Failed to create project in database: ${dbError.message}`);
      }

      setSuccess(
        `Project created successfully!\n` +
        `Client: ${formData.client_name}\n` +
        `Project ID: ${dbProject.id}\n` +
        `On-chain Project ID: ${onChainProjectId.toString()}\n` +
        `PDA: ${onChainResult.projectPDA.toString()}\n` +
        `Transaction: ${onChainResult.signature}`
      );

      // Reset form
      setFormData({
        client_name: '',
        client_email: '',
        project_name: '',
        project_description: '',
        project_fee: '1000000',
        max_lootboxes: '',
        max_jackpots: '',
        token_limit: '',
      });
      setShowCreateModal(false);

      // Refresh projects
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to create project');
      console.error('Error creating project:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleResetProject = async (projectId: number) => {
    if (!confirm('Are you sure you want to reset this project? This will delete all transactions, users, and data for this project. This action cannot be undone.')) {
      return;
    }

    setResetting(projectId);
    setError(null);
    setSuccess(null);

    try {
      const { error } = await supabase.rpc('reset_project_data', {
        target_project_id: projectId,
      });

      if (error) throw error;

      setSuccess(`Project ${projectId} has been reset. All data has been cleared.`);
      await fetchProjects();
    } catch (err: any) {
      setError('Failed to reset project: ' + err.message);
      console.error('Error resetting project:', err);
    } finally {
      setResetting(null);
    }
  };

  const handleUpdateFee = async () => {
    if (!publicKey || !sendTransaction || !connected || !selectedProject) {
      setError('Please connect your wallet first');
      return;
    }

    if (!newFeeAmount || isNaN(Number(newFeeAmount))) {
      setError('Please enter a valid fee amount');
      return;
    }

    setUpdatingFee(true);
    setError(null);
    setSuccess(null);

    try {
      // Create wallet adapter wrapper
      const walletAdapter = {
        publicKey,
        sendTransaction,
      };

      // Update on-chain fee
      const result = await updateProjectFee(
        connection,
        walletAdapter as any,
        selectedProject.project_id,
        new BN(newFeeAmount)
      );

      // Update off-chain project record
      const { error: dbError } = await supabase
        .from('projects')
        .update({ fee_amount: newFeeAmount })
        .eq('id', selectedProject.id);

      if (dbError) {
        throw new Error(`Failed to update project fee in database: ${dbError.message}`);
      }

      setSuccess(`Project fee updated successfully! Transaction: ${result.signature}`);
      setShowEditFeeModal(false);
      setSelectedProject(null);
      setNewFeeAmount('');
      await fetchProjects();
    } catch (err: any) {
      setError(err.message || 'Failed to update project fee');
      console.error('Error updating project fee:', err);
    } finally {
      setUpdatingFee(false);
    }
  };

  const handleToggleActive = async (projectId: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: !currentStatus })
        .eq('id', projectId);

      if (error) throw error;
      await fetchProjects();
    } catch (err: any) {
      setError('Failed to update project status: ' + err.message);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    // Validate confirmation name
    if (deleteConfirmName !== projectToDelete.name) {
      setError(`Project name does not match. Please type "${projectToDelete.name}" to confirm deletion.`);
      return;
    }

    setDeleting(projectToDelete.id);
    setError(null);
    setSuccess(null);

    try {
      const projectId = projectToDelete.id;
      console.log(`🗑️ Starting deletion of project ${projectId} (${projectToDelete.name})...`);

      // Delete in order to respect foreign key constraints
      // Start with tables that have no dependencies, then work up to the project itself

      // 1. Delete products first (they reference projects)
      console.log(`   Deleting products...`);
      const { error: productsError } = await supabase
        .from('products')
        .delete()
        .eq('project_id', projectId);
      if (productsError) {
        console.warn('   Warning deleting products:', productsError);
      }

      // 2. Delete project-specific reward data
      console.log(`   Deleting NFT reward percentages...`);
      await supabase
        .from('nft_reward_percentages')
        .delete()
        .eq('project_id', projectId);

      console.log(`   Deleting token reward percentages...`);
      await supabase
        .from('token_reward_percentages')
        .delete()
        .eq('project_id', projectId);

      // 3. Delete prize wins
      console.log(`   Deleting prize wins...`);
      await supabase
        .from('prizeWin')
        .delete()
        .eq('project_id', projectId);

      // 4. Delete transactions
      console.log(`   Deleting transactions...`);
      await supabase
        .from('transaction')
        .delete()
        .eq('project_id', projectId);

      // 5. Delete ticket purchases
      console.log(`   Deleting ticket purchases...`);
      await supabase
        .from('ticketPurchase')
        .delete()
        .eq('project_id', projectId);

      // 6. Delete jackpot-related data
      console.log(`   Deleting jackpot tickets...`);
      await supabase
        .from('jackpot_tickets')
        .delete()
        .eq('project_id', projectId);

      console.log(`   Deleting jackpot wins...`);
      await supabase
        .from('jackpot_wins')
        .delete()
        .eq('project_id', projectId);

      console.log(`   Deleting jackpot contributions...`);
      await supabase
        .from('jackpot_contribution')
        .delete()
        .eq('project_id', projectId);

      console.log(`   Deleting jackpot pools...`);
      await supabase
        .from('jackpot_pools')
        .delete()
        .eq('project_id', projectId);

      // 7. Delete withdrawals
      console.log(`   Deleting withdrawals...`);
      await supabase
        .from('withdraw')
        .delete()
        .eq('project_id', projectId);

      // 8. Delete project users
      console.log(`   Deleting project users...`);
      await supabase
        .from('project_users')
        .delete()
        .eq('project_id', projectId);

      // 9. Delete project token balances
      console.log(`   Deleting project token balances...`);
      await supabase
        .from('project_token_balances')
        .delete()
        .eq('project_id', projectId);

      // 10. Delete project tokens
      console.log(`   Deleting project tokens...`);
      const { error: tokensError } = await supabase
        .from('project_tokens')
        .delete()
        .eq('project_id', projectId);
      if (tokensError) {
        console.warn('   Warning deleting project tokens:', tokensError);
      }

      // 11. Delete project NFTs
      console.log(`   Deleting project NFTs...`);
      await supabase
        .from('project_nfts')
        .delete()
        .eq('project_id', projectId);

      // 12. Delete project admins
      console.log(`   Deleting project admins...`);
      await supabase
        .from('project_admins')
        .delete()
        .eq('project_id', projectId);

      // 13. Delete project settings
      console.log(`   Deleting project settings...`);
      await supabase
        .from('project_settings')
        .delete()
        .eq('project_id', projectId);

      // 14. Delete slider images
      console.log(`   Deleting slider images...`);
      await supabase
        .from('slider_images')
        .delete()
        .eq('project_id', projectId);

      // 15. Try to use reset_project_data RPC if it exists (optional)
      try {
        console.log(`   Attempting to use reset_project_data RPC...`);
        const { error: resetError } = await supabase.rpc('reset_project_data', {
          target_project_id: projectId
        });
        if (resetError && resetError.code !== '42883') { // 42883 = function does not exist
          console.warn('   Warning from reset_project_data:', resetError);
        }
      } catch (rpcError: any) {
        // RPC function might not exist, that's okay
        if (rpcError.code !== '42883') {
          console.warn('   Warning calling reset_project_data:', rpcError);
        }
      }

      // 16. Finally, delete the project itself
      console.log(`   Deleting project record...`);
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (deleteError) {
        console.error('   Error deleting project:', deleteError);
        throw deleteError;
      }

      console.log(`✅ Successfully deleted project ${projectId}`);

      setSuccess(`Project "${projectToDelete.name}" has been permanently deleted. All associated data has been removed.`);
      setShowDeleteModal(false);
      setProjectToDelete(null);
      setDeleteConfirmName('');
      await fetchProjects();
    } catch (err: any) {
      setError('Failed to delete project: ' + err.message);
      console.error('Error deleting project:', err);
    } finally {
      setDeleting(null);
    }
  };

  const openDeleteModal = (project: Project) => {
    setProjectToDelete(project);
    setDeleteConfirmName('');
    setError(null);
    setShowDeleteModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Client Project Management
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage isolated projects for each client. Each project has its own data and can be reset independently.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 border border-green-400 text-green-700 dark:text-green-200 rounded whitespace-pre-line">
          {success}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
              Create New Client Project
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Name *
                </label>
                <input
                  type="text"
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Client Company Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Client Email
                </label>
                <input
                  type="email"
                  value={formData.client_email}
                  onChange={(e) => setFormData({ ...formData, client_email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="client@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name (optional)
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Auto-generated if empty"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Description (optional)
                </label>
                <textarea
                  value={formData.project_description}
                  onChange={(e) => setFormData({ ...formData, project_description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Auto-generated if empty"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Fee (Lamports)
              </label>
              <input
                type="number"
                value={formData.project_fee}
                onChange={(e) => setFormData({ ...formData, project_fee: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="1000000 (0.001 SOL)"
              />
              <p className="text-xs text-gray-500 mt-1">
                1 SOL = 1,000,000,000 Lamports. Default: 1,000,000 (0.001 SOL)
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-3 text-gray-900 dark:text-white">Project Limits</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Set maximum limits for lootboxes, jackpots, and tokens (leave empty for unlimited)</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Lootboxes
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_lootboxes}
                    onChange={(e) => setFormData({ ...formData, max_lootboxes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Max Jackpots
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.max_jackpots}
                    onChange={(e) => setFormData({ ...formData, max_jackpots: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Token Limit
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.token_limit}
                    onChange={(e) => setFormData({ ...formData, token_limit: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Unlimited"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Max tokens (on-chain + off-chain) for deposit/withdraw
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handleCreateProject}
              disabled={creating || !formData.client_name}
              className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-semibold"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
            <button
              onClick={() => {
                setShowCreateModal(false);
                setFormData({
                  client_name: '',
                  client_email: '',
                  project_name: '',
                  project_description: '',
                  project_fee: '1000000',
                  max_lootboxes: '',
                  max_jackpots: '',
                  token_limit: '',
                });
              }}
              className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && projectToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border-4 border-red-500">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mr-4">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                ⚠️ PERMANENTLY DELETE PROJECT
              </h2>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
                ⚠️ WARNING: This action cannot be undone!
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                Deleting this project will <strong>permanently remove</strong>:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1 ml-4">
                <li>All project data and settings</li>
                <li>All users and their balances</li>
                <li>All transactions and deposits</li>
                <li>All lootboxes and jackpots</li>
                <li>All NFT rewards and prize wins</li>
                <li>All project admins and configurations</li>
                <li>The project record itself</li>
              </ul>
            </div>

            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                <strong>Project to delete:</strong>
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 rounded p-3 mb-4">
                <p className="font-semibold text-gray-900 dark:text-white">
                  {projectToDelete.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Client: {projectToDelete.client_name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ID: {projectToDelete.id}
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                To confirm deletion, type the project name exactly as shown above:
              </label>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                className="w-full px-4 py-2 border-2 border-red-300 dark:border-red-700 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-red-500 focus:ring-2 focus:ring-red-500"
                placeholder={`Type "${projectToDelete.name}" to confirm`}
                autoFocus
              />
              {deleteConfirmName && deleteConfirmName !== projectToDelete.name && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  ❌ Project name does not match
                </p>
              )}
              {deleteConfirmName === projectToDelete.name && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  ✅ Project name matches
                </p>
              )}
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleDeleteProject}
                disabled={deleting === projectToDelete.id || deleteConfirmName !== projectToDelete.name}
                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors"
              >
                {deleting === projectToDelete.id ? 'Deleting...' : '⚠️ DELETE PROJECT PERMANENTLY'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setProjectToDelete(null);
                  setDeleteConfirmName('');
                  setError(null);
                }}
                disabled={deleting === projectToDelete.id}
                className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 rounded-lg font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Fee Modal */}
      {
        showEditFeeModal && selectedProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
                Update Project Fee
              </h2>
              <p className="mb-4 text-gray-600 dark:text-gray-400">
                Update fee for project: <strong>{selectedProject.name}</strong>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    New Fee Amount (Lamports)
                  </label>
                  <input
                    type="number"
                    value={newFeeAmount}
                    onChange={(e) => setNewFeeAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter fee in lamports"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Current Fee: {selectedProject.fee_amount} lamports
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleUpdateFee}
                  disabled={updatingFee || !newFeeAmount}
                  className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-semibold"
                >
                  {updatingFee ? 'Updating...' : 'Update Fee'}
                </button>
                <button
                  onClick={() => {
                    setShowEditFeeModal(false);
                    setSelectedProject(null);
                    setNewFeeAmount('');
                  }}
                  className="flex-1 px-6 py-3 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Projects List */}
      {
        loading ? (
          <div className="text-center py-8">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No projects found. Create your first client project to get started.
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Client Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Project Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      On-chain ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      PDA
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Fee (Lamports)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Stats
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {projects.map((project) => {
                    const projectStat = stats[project.id];
                    return (
                      <tr key={project.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {project.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {project.client_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {project.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                          {String(project.project_id).substring(0, 10)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                          {project.project_pda ? project.project_pda.substring(0, 10) + '...' : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500 dark:text-gray-400">
                          {project.fee_amount}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {projectStat ? (
                            <div className="space-y-1">
                              <div>Users: {projectStat.total_users}</div>
                              <div>Transactions: {projectStat.total_transactions}</div>
                              <div>Deposits: {projectStat.total_deposits.toFixed(2)}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">Loading...</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleActive(project.id, project.is_active)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold ${project.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                          >
                            {project.is_active ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleResetProject(project.id)}
                            disabled={resetting === project.id}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:text-gray-400"
                            title="Reset project data (keeps project record)"
                          >
                            {resetting === project.id ? 'Resetting...' : 'Reset'}
                          </button>
                          <button
                            onClick={() => openDeleteModal(project)}
                            disabled={deleting === project.id}
                            className="text-red-800 hover:text-red-950 dark:text-red-500 dark:hover:text-red-400 disabled:text-gray-400 font-bold"
                            title="Permanently delete project and all data"
                          >
                            {deleting === project.id ? 'Deleting...' : '🗑️ Delete'}
                          </button>
                          <a
                            href={`https://explorer.solana.com/address/${project.project_pda}?cluster=mainnet-beta`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400"
                          >
                            View
                          </a>
                          <button
                            onClick={() => {
                              setSelectedProject(project);
                              setNewFeeAmount(project.fee_amount);
                              setShowEditFeeModal(true);
                            }}
                            className="text-orange-600 hover:text-orange-900 dark:text-orange-400"
                          >
                            Edit Fee
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      }
    </div >
  );
}

