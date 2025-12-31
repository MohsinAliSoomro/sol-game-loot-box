"use client";

import { useEffect } from "react";
import { useProject } from "@/lib/project-context";
import { getFavicon } from "@/service/websiteSettings";

/**
 * FaviconManager component
 * Dynamically sets the favicon based on the current project's favicon setting
 */
export default function FaviconManager() {
  const { getProjectId } = useProject();
  const projectId = getProjectId();

  useEffect(() => {
    const updateFavicon = async () => {
      try {
        const faviconUrl = await getFavicon(projectId);
        
        if (faviconUrl) {
          // Remove existing favicon links
          const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
          existingLinks.forEach(link => link.remove());

          // Create new favicon link
          const link = document.createElement('link');
          link.rel = 'icon';
          link.type = 'image/x-icon';
          link.href = faviconUrl;
          document.head.appendChild(link);

          // Also add shortcut icon for better browser compatibility
          const shortcutLink = document.createElement('link');
          shortcutLink.rel = 'shortcut icon';
          shortcutLink.href = faviconUrl;
          document.head.appendChild(shortcutLink);
        } else {
          // Fallback to default favicon if no project favicon is set
          const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
          if (existingLinks.length === 0) {
            const link = document.createElement('link');
            link.rel = 'icon';
            link.href = '/favicon.ico';
            document.head.appendChild(link);
          }
        }
      } catch (error) {
        console.error('Error updating favicon:', error);
      }
    };

    updateFavicon();
  }, [projectId]);

  return null; // This component doesn't render anything
}

