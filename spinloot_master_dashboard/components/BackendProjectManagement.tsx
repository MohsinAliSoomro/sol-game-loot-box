'use client';

/**
 * Backend Project Management Component
 * 
 * Manages whitelabel projects via the backend API
 * This is separate from the Solana on-chain project management
 */

import { useState, useEffect } from 'react';
import { projectsAPI, authAPI, type BackendProject, type CreateProjectRequest } from '@/lib/backend-api';
import BackendLogin from './BackendLogin';

export default function BackendProjectManagement() {
  const [projects, setProjects] = useState<BackendProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showEditFeeModal, setShowEditFeeModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<BackendProject | null>(null);
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');
  const [updatingFee, setUpdatingFee] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    full_name: '',
  });
  const [settingAdmin, setSettingAdmin] = useState(false);
  const [formData, setFormData] = useState<CreateProjectRequest>({
    name: '',
    slug: '',
    subdomain: '',
    admin_email: '',
    admin_password: '',
    admin_full_name: '',
    fee_amount: 1000000,
    max_lootboxes: undefined,
    max_jackpots: undefined,
    token_limit: undefined,
  });

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (authAPI.isAuthenticated()) {
        setIsAuthenticated(true);
        await loadProjects();
      } else {
        // Authentication is now handled at app level
        // If we reach here, user should be redirected to login
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await projectsAPI.list();
      if (response.success) {
        setProjects(response.data);
      } else {
        setError('Failed to load projects');
      }
    } catch (err: any) {
      // If token expired, clear authentication to show login form
      if (err.isTokenExpired || err.status === 401 || err.message?.includes('Token expired')) {
        authAPI.logout();
        setIsAuthenticated(false);
        return;
      }
      setError(err.message || 'Failed to load projects');
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);

    try {
      // Auto-generate slug if not provided
      const slug = formData.slug || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const response = await projectsAPI.create({
        ...formData,
        slug,
      });

      if (response.success) {
        // Success! Show the response data
        alert(`Project created successfully!\n\nProject: ${response.data.project.name}\nAdmin Email: ${response.data.admin.email}\nToken: ${response.data.token.substring(0, 20)}...\n\nAccess URLs:\nAPI: ${response.data.access_urls.api}\nDashboard: ${response.data.access_urls.dashboard}`);

        // Reset form and reload projects
        setFormData({
          name: '',
          slug: '',
          subdomain: '',
          admin_email: '',
          admin_password: '',
          admin_full_name: '',
          fee_amount: 1000000,
          max_lootboxes: undefined,
          max_jackpots: undefined,
          token_limit: undefined,
        });
        setShowCreateModal(false);
        await loadProjects();
      } else {
        setError('Failed to create project');
      }
    } catch (err: any) {
      // Show detailed validation errors if available
      if (err.details && Array.isArray(err.details)) {
        const errorMessages = err.details.map((detail: any) => {
          const field = detail.path || detail.param || 'field';
          const message = detail.msg || detail.message || 'Invalid';
          return `${field}: ${message}`;
        }).join('\n');
        const alertMessage = `Validation Failed:\n\n${errorMessages}`;
        alert(alertMessage);
        setError(`Validation failed:\n${errorMessages}`);
        console.error('Validation errors:', err.details);
      } else {
        const errorMessage = err.message || 'Failed to create project';
        alert(`Error: ${errorMessage}`);
        setError(errorMessage);
        console.error('Error creating project:', err);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this project?')) {
      return;
    }

    try {
      const response = await projectsAPI.deactivate(id);
      if (response.success) {
        await loadProjects();
      } else {
        setError('Failed to deactivate project');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to deactivate project');
      console.error('Error deactivating project:', err);
    }
  };

  const handleSetAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setSettingAdmin(true);
    setError(null);

    try {
      const response = await projectsAPI.setAdmin(selectedProject.id, {
        email: adminFormData.email,
        password: adminFormData.password,
        full_name: adminFormData.full_name || undefined,
      });

      if (response.success) {
        alert(
          `Admin credentials ${response.message}!\n\n` +
          `Email: ${response.data.admin.email}\n` +
          `Project: ${response.data.project.name}\n` +
          `Access URL: ${response.data.access_url}\n\n` +
          `Token: ${response.data.token.substring(0, 30)}...`
        );
        setShowAdminModal(false);
        setAdminFormData({ email: '', password: '', full_name: '' });
        setSelectedProject(null);
      } else {
        setError('Failed to set admin credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set admin credentials');
      console.error('Error setting admin:', err);
    } finally {
      setSettingAdmin(false);
    }
  };

  const handleUpdateFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    if (!newFeeAmount || isNaN(Number(newFeeAmount))) {
      setError('Please enter a valid fee amount');
      return;
    }

    setUpdatingFee(true);
    setError(null);

    try {
      const response = await projectsAPI.update(selectedProject.id, {
        fee_amount: parseInt(newFeeAmount)
      });

      if (response.success) {
        alert(`Project fee updated successfully!`);
        setShowEditFeeModal(false);
        setSelectedProject(null);
        setNewFeeAmount('');
        await loadProjects();
      } else {
        setError('Failed to update project fee');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update project fee');
      console.error('Error updating project fee:', err);
    } finally {
      setUpdatingFee(false);
    }
  };

  const openAdminModal = (project: BackendProject) => {
    setSelectedProject(project);
    setAdminFormData({ email: '', password: '', full_name: '' });
    setShowAdminModal(true);
  };

  // Authentication is now handled at app level
  // If not authenticated, this component shouldn't be rendered
  if (!isAuthenticated) {
    return (
      <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 text-center">
        <p className="text-white">Please login to access whitelabel projects</p>
      </div>
    );
  }

  if (loading && projects.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-white">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Whitelabel Projects (Backend API)</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Create New Project
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/30 text-red-200 rounded backdrop-blur-sm">
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="text-center p-8 bg-white/5 backdrop-blur-sm rounded-lg border border-white/20">
          <p className="text-white/90 mb-4">No projects found.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border border-white/20 rounded-lg p-4 hover:shadow-lg transition-shadow bg-white/5 backdrop-blur-sm"
              style={{
                borderLeftColor: project.primary_color,
                borderLeftWidth: '4px',
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs ${project.is_active
                    ? 'bg-green-500/20 text-green-200 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-200 border border-gray-500/30'
                    }`}
                >
                  {project.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="space-y-2 text-sm text-white/90">
                <div>
                  <strong className="text-white">Slug:</strong> <span className="text-white/80">{project.slug}</span>
                </div>
                {project.subdomain && (
                  <div>
                    <strong className="text-white">Subdomain:</strong> <span className="text-white/80">{project.subdomain}</span>
                  </div>
                )}
                <div>
                  <strong className="text-white">Theme:</strong> <span className="text-white/80">{project.theme}</span>
                </div>
                <div className="flex items-center gap-2">
                  <strong className="text-white">Colors:</strong>
                  <div
                    className="w-6 h-6 rounded border border-white/30"
                    style={{ backgroundColor: project.primary_color }}
                    title={project.primary_color}
                  />
                  <div
                    className="w-6 h-6 rounded border border-white/30"
                    style={{ backgroundColor: project.secondary_color }}
                    title={project.secondary_color}
                  />
                </div>
                <div>
                  <strong className="text-white">Created:</strong>{' '}
                  <span className="text-white/80">{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
                <div>
                  <strong className="text-white">Fee:</strong>{' '}
                  <span className="text-white/80">
                    {project.fee_amount !== undefined && project.fee_amount !== null
                      ? `${project.fee_amount.toLocaleString()} lamports (${(project.fee_amount / 1_000_000_000).toFixed(6)} SOL)`
                      : 'Not set (default: 0.001 SOL)'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={() => openAdminModal(project)}
                  className="px-3 py-1 text-sm bg-green-500/20 text-green-200 border border-green-500/30 rounded hover:bg-green-500/30 transition-colors"
                  title="Set or update admin credentials"
                >
                  Set Admin
                </button>
                <button
                  onClick={() => handleDeactivate(project.id)}
                  className="px-3 py-1 text-sm bg-red-500/20 text-red-200 border border-red-500/30 rounded hover:bg-red-500/30 transition-colors"
                >
                  {project.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => {
                    // TODO: Open edit modal
                    alert('Edit functionality coming soon');
                  }}
                  className="px-3 py-1 text-sm bg-blue-500/20 text-blue-200 border border-blue-500/30 rounded hover:bg-blue-500/30 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    setSelectedProject(project);
                    // Use project fee_amount if available, otherwise default to 1,000,000 lamports (0.001 SOL)
                    const currentFee = project.fee_amount !== undefined && project.fee_amount !== null 
                      ? project.fee_amount 
                      : 1000000;
                    setNewFeeAmount(currentFee.toString());
                    setShowEditFeeModal(true);
                  }}
                  className="px-3 py-1 text-sm bg-orange-500/20 text-orange-200 border border-orange-500/30 rounded hover:bg-orange-500/30 transition-colors"
                >
                  Edit Fee
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">Create New Whitelabel Project</h3>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Project Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="My Project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Slug (auto-generated if empty)</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="my-project"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Subdomain (optional)</label>
                <input
                  type="text"
                  value={formData.subdomain}
                  onChange={(e) => setFormData({ ...formData, subdomain: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="myproject"
                />
              </div>

              <div className="border-t border-gray-300 pt-4">
                <h4 className="font-semibold mb-3 text-gray-900">Admin User</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Admin Email *</label>
                    <input
                      type="email"
                      required
                      value={formData.admin_email}
                      onChange={(e) => setFormData({ ...formData, admin_email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="admin@project.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Admin Password *</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={formData.admin_password}
                      onChange={(e) => setFormData({ ...formData, admin_password: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Admin Full Name</label>
                    <input
                      type="text"
                      value={formData.admin_full_name}
                      onChange={(e) => setFormData({ ...formData, admin_full_name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="John Doe"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-4">
                <h4 className="font-semibold mb-3 text-gray-900">Project Settings</h4>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-900">Project Fee (Lamports)</label>
                  <input
                    type="number"
                    value={formData.fee_amount || 1000000}
                    onChange={(e) => setFormData({ ...formData, fee_amount: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="1000000 (0.001 SOL)"
                  />
                  {/* Real-time SOL converter */}
                  {formData.fee_amount && formData.fee_amount > 0 && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-900">
                        <strong>Equivalent:</strong>{' '}
                        <span className="font-mono">
                          {formData.fee_amount.toLocaleString()} lamports = {(formData.fee_amount / 1_000_000_000).toFixed(9)} SOL
                        </span>
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-600 mt-1">
                    1 SOL = 1,000,000,000 Lamports. Default: 1,000,000 (0.001 SOL)
                  </p>
                </div>
              </div>

              <div className="border-t border-gray-300 pt-4">
                <h4 className="font-semibold mb-3 text-gray-900">Project Limits</h4>
                <p className="text-sm text-gray-600 mb-3">Set maximum limits for lootboxes, jackpots, and tokens (leave empty for unlimited)</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Max Lootboxes</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_lootboxes || ''}
                      onChange={(e) => setFormData({ ...formData, max_lootboxes: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Max Jackpots</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_jackpots || ''}
                      onChange={(e) => setFormData({ ...formData, max_jackpots: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Unlimited"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-900">Token Limit</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.token_limit || ''}
                      onChange={(e) => setFormData({ ...formData, token_limit: e.target.value ? parseInt(e.target.value) : undefined })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Unlimited"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max tokens (on-chain + off-chain) for deposit/withdraw
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Fee Modal */}
      {showEditFeeModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">
              Update Project Fee
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Update fee for project: <strong className="text-gray-900">{selectedProject.name}</strong>
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdateFee} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">New Fee Amount (Lamports)</label>
                <input
                  type="number"
                  value={newFeeAmount}
                  onChange={(e) => setNewFeeAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Enter fee in lamports"
                  min="0"
                  step="1"
                />
                {/* Real-time SOL converter */}
                {newFeeAmount && !isNaN(Number(newFeeAmount)) && Number(newFeeAmount) > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Equivalent:</strong>{' '}
                      <span className="font-mono">
                        {Number(newFeeAmount).toLocaleString()} lamports = {(Number(newFeeAmount) / 1_000_000_000).toFixed(9)} SOL
                      </span>
                    </p>
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-700">
                    <strong className="text-gray-900">Current Fee:</strong>{' '}
                    {selectedProject.fee_amount !== undefined && selectedProject.fee_amount !== null
                      ? `${selectedProject.fee_amount.toLocaleString()} lamports (${(selectedProject.fee_amount / 1_000_000_000).toFixed(6)} SOL)`
                      : 'Not set (default: 1,000,000 lamports = 0.001 SOL)'}
                  </p>
                  <p className="text-xs text-gray-600">
                    1 SOL = 1,000,000,000 Lamports
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={updatingFee || !newFeeAmount}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {updatingFee ? 'Updating...' : 'Update Fee'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditFeeModal(false);
                    setSelectedProject(null);
                    setNewFeeAmount('');
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set Admin Modal */}
      {showAdminModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">
              Set Admin Credentials
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Project: <strong className="text-gray-900">{selectedProject.name}</strong> ({selectedProject.slug})
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSetAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Admin Email *</label>
                <input
                  type="email"
                  required
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="admin@project.com"
                />
                <p className="text-xs text-gray-600 mt-1">
                  If email exists for this project, password will be updated. Otherwise, new admin will be created.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Admin Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-900">Full Name (optional)</label>
                <input
                  type="text"
                  value={adminFormData.full_name}
                  onChange={(e) => setAdminFormData({ ...adminFormData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="John Doe"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={settingAdmin}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {settingAdmin ? 'Setting...' : 'Set Admin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAdminModal(false);
                    setSelectedProject(null);
                    setAdminFormData({ email: '', password: '', full_name: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

