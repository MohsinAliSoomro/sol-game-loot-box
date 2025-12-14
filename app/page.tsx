"use client";
// Root home page - shows main project home page (no auth required)
// This is the main/default project that works independently without needing a projects table entry
// It uses legacy tables where project_id IS NULL
import ProjectHomePage from "./[projectSlug]/page";

export default function RootPage() {
  // Main project works independently - no need to load from projects table
  // ProjectHomePage will detect it's the main project by checking params.projectSlug (which will be undefined)
  // and will use legacy tables (project_id IS NULL) automatically
  return <ProjectHomePage />;
}
