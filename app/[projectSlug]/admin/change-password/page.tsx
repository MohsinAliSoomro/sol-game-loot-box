"use client";

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useProject } from '@/lib/project-context';

const BACKEND_API_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL

export default function ChangePassword() {
  const router = useRouter();
  const params = useParams();
  const projectSlug = params?.projectSlug as string;
  const { currentProject } = useProject();
  
  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (error) setError('');
    if (success) setSuccess(false);
  };

  const validateForm = () => {
    if (!formData.oldPassword) {
      setError('Please enter your current password');
      return false;
    }
    
    if (!formData.newPassword) {
      setError('Please enter a new password');
      return false;
    }
    
    if (formData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      return false;
    }
    
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      return false;
    }
    
    if (formData.oldPassword === formData.newPassword) {
      setError('New password must be different from current password');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    
    if (!validateForm()) {
      return;
    }

    if (!currentProject) {
      setError('Project not loaded. Please refresh the page.');
      return;
    }

    setLoading(true);

    try {
      // Get the auth token
      const token = localStorage.getItem(`project_${currentProject.id}_token`);
      if (!token) {
        setError('You are not authenticated. Please log in again.');
        router.push(`/${projectSlug}/auth`);
        return;
      }

      // Get user email from stored user data
      const userStr = localStorage.getItem(`project_${currentProject.id}_user`);
      if (!userStr) {
        setError('User data not found. Please log in again.');
        router.push(`/${projectSlug}/auth`);
        return;
      }

      const user = JSON.parse(userStr);
      const email = user.email;

      if (!email) {
        setError('User email not found. Please log in again.');
        router.push(`/${projectSlug}/auth`);
        return;
      }

      // Call backend API to change password
      const response = await fetch(`${BACKEND_API_URL}/api/projects/${currentProject.id}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to change password. Please try again.');
        setLoading(false);
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to change password. Please try again.');
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setFormData({
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      // Optionally log out and redirect to login after a delay
      setTimeout(() => {
        // Clear auth data
        localStorage.removeItem(`project_${currentProject.id}_token`);
        localStorage.removeItem(`project_${currentProject.id}_user`);
        
        // Redirect to login
        router.push(`/${projectSlug}/auth`);
      }, 2000);

    } catch (err: any) {
      console.error('Change password error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-5 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
            <p className="mt-1 text-sm text-gray-500">
              Update your admin account password. You will be logged out after changing your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                Password changed successfully! You will be redirected to login page in a moment...
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  id="oldPassword"
                  name="oldPassword"
                  value={formData.oldPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter your current password"
                  disabled={loading || success}
                />
              </div>

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Enter your new password (min. 6 characters)"
                  disabled={loading || success}
                />
                <p className="mt-1 text-xs text-gray-500">Password must be at least 6 characters long</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                  placeholder="Confirm your new password"
                  disabled={loading || success}
                />
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                  disabled={loading || success}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || success}
                  className="px-6 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Changing Password...' : success ? 'Password Changed!' : 'Change Password'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

