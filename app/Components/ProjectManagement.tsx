"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import { 
  createProject, 
  getProjectData, 
  projectExists, 
  generateProjectId,
  deriveProjectPDA,
  RPC_URL 
} from "@/lib/project-service";
import { CONFIG } from "@/lib/config";

export default function ProjectManagement() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    projectId: "",
    feeAmount: "1000000", // 0.001 SOL in lamports
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const connection = new Connection(RPC_URL, "confirmed");

  // Create project handler
  const handleCreateProject = async () => {
    if (!publicKey || !signTransaction || !connected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!formData.name || !formData.description) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const projectId = formData.projectId 
        ? new (await import("@coral-xyz/anchor")).BN(formData.projectId)
        : generateProjectId();

      const wallet = {
        publicKey,
        signTransaction: async (tx: any) => {
          return await signTransaction(tx);
        },
      };

      const result = await createProject(
        connection,
        wallet as any,
        projectId,
        formData.name,
        formData.description,
        new PublicKey(CONFIG.TOKENS.SOL),
        parseInt(formData.feeAmount)
      );

      setSuccess(
        `Project created successfully! PDA: ${result.projectPDA.toString()}\nTransaction: ${result.signature}`
      );
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        projectId: "",
        feeAmount: "1000000",
      });

      // Refresh projects list
      // You can add logic here to fetch and display created projects
    } catch (err: any) {
      setError(err.message || "Failed to create project");
      console.error("Error creating project:", err);
    } finally {
      setLoading(false);
    }
  };

  // View project handler
  const handleViewProject = async () => {
    if (!formData.projectId) {
      setError("Please enter a project ID");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const projectData = await getProjectData(connection, formData.projectId);
      setSuccess(
        `Project Found!\n` +
        `Name: ${projectData.name}\n` +
        `Description: ${projectData.description}\n` +
        `PDA: ${projectData.pda}\n` +
        `Admin: ${projectData.admin}\n` +
        `Fee: ${(parseInt(projectData.feeAmount) / 1e9).toFixed(9)} SOL`
      );
    } catch (err: any) {
      setError(err.message || "Failed to fetch project");
      console.error("Error fetching project:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
        Project Management
      </h2>

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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project Name (max 50 chars)
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            maxLength={50}
            placeholder="My Awesome Project"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description (max 100 chars)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            maxLength={100}
            rows={3}
            placeholder="Project description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Project ID (optional - auto-generated if empty)
          </label>
          <input
            type="text"
            value={formData.projectId}
            onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Leave empty for auto-generation"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Fee Amount (lamports, default: 1000000 = 0.001 SOL)
          </label>
          <input
            type="text"
            value={formData.feeAmount}
            onChange={(e) => setFormData({ ...formData, feeAmount: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="1000000"
          />
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleCreateProject}
            disabled={loading || !connected}
            className="flex-1 px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>

          <button
            onClick={handleViewProject}
            disabled={loading || !formData.projectId}
            className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
          >
            {loading ? "Loading..." : "View Project"}
          </button>
        </div>

        {!connected && (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Please connect your wallet to create or view projects
          </p>
        )}
      </div>

      <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
          How it works:
        </h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
          <li>Each project gets a unique Project ID and PDA (Program Derived Address)</li>
          <li>Projects are stored on-chain and can be viewed on Solana Explorer</li>
          <li>You can create multiple projects under the same program</li>
          <li>Project ID can be auto-generated (timestamp) or manually specified</li>
        </ul>
      </div>
    </div>
  );
}


