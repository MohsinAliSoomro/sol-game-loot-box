"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { useProject } from "@/lib/project-context";
import Loader from "@/app/Components/Loader";
import NotFound from "@/app/Components/NotFound";
import dynamic from "next/dynamic";

// Dynamically import WebsiteTheme to apply branding
const WebsiteTheme = dynamic(
  () => import("@/app/Components/WebsiteTheme"),
  { ssr: false }
);

// Removed BACKEND_API_URL - not needed for public pages

export default function ProjectSlugLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { loadProjectBySlug, currentProject, loading } = useProject();
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const projectSlug = params?.projectSlug as string;
  const isAuthPage = pathname?.endsWith("/auth");

  useEffect(() => {
    if (!projectSlug) {
      router.push("/");
      return;
    }

    // PROJECT PAGES ARE PUBLIC - NO AUTHENTICATION REQUIRED
    // Only load project, don't check authentication
    
    // If on auth page, just load project in background
    if (isAuthPage) {
      setIsLoading(false);
      if (currentProject?.slug !== projectSlug) {
        loadProjectBySlug(projectSlug).catch(err => {
          console.error("Error loading project in layout:", err);
        });
      }
      return;
    }

    // Don't reload if we already have the correct project loaded
    if (currentProject?.slug === projectSlug && !loading) {
      setIsLoading(false);
      setProjectNotFound(false);
      return;
    }

    // Only load if we don't have a project or it's a different slug
    if (currentProject?.slug !== projectSlug) {
      const loadProject = async () => {
        setIsLoading(true);
        setProjectNotFound(false);
        
        const project = await loadProjectBySlug(projectSlug);
        
        if (!project) {
          setProjectNotFound(true);
          setIsLoading(false);
          return;
        }
        
        setIsLoading(false);
      };

      loadProject();
    }
    // Only depend on projectSlug and isAuthPage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectSlug, isAuthPage]);

  // REMOVED: checkAuthentication function
  // Project pages are PUBLIC - no authentication required
  // Authentication is only checked in admin panel layout

  // If on auth page, always render it (don't block on project loading)
  // The auth page will handle its own loading state
  if (isAuthPage) {
    return (
      <>
        <WebsiteTheme />
        {children}
      </>
    );
  }

  // Show loading state while loading project
  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  // Show 404 if project not found
  if (projectNotFound || !currentProject) {
    return <NotFound />;
  }

  // Apply branding and render children
  return (
    <>
      <WebsiteTheme />
      {children}
    </>
  );
}

