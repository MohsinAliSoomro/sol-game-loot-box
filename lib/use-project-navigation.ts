/**
 * Hook for project-aware navigation
 * Automatically prefixes all routes with the current project slug
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";

export function useProjectNavigation() {
  const params = useParams();
  const router = useRouter();
  const projectSlug = params?.projectSlug as string;

  /**
   * Create a URL with project slug prefix
   */
  const createUrl = useCallback(
    (path: string) => {
      // Remove leading slash if present
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      return `/${projectSlug}/${cleanPath}`;
    },
    [projectSlug]
  );

  /**
   * Navigate to a path within the current project
   */
  const navigate = useCallback(
    (path: string) => {
      router.push(createUrl(path));
    },
    [router, createUrl]
  );

  /**
   * Get the current project slug
   */
  const getProjectSlug = useCallback(() => {
    return projectSlug;
  }, [projectSlug]);

  return {
    createUrl,
    navigate,
    projectSlug,
    getProjectSlug,
  };
}



