"use client";

import { useProject } from "@/lib/project-context";
import { useState, useEffect } from "react";

export default function ProjectSwitcher() {
  const { currentProject, projects, setCurrentProject, loading } = useProject();
  const [isOpen, setIsOpen] = useState(false);

  if (loading) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
        Loading projects...
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
        No projects available
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {currentProject?.client_name || currentProject?.name || "Select Project"}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Switch Project
              </div>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setCurrentProject(project);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentProject?.id === project.id
                      ? "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="font-medium">{project.client_name || project.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {project.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}


