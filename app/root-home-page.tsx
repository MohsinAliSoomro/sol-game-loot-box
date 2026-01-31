"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/service/supabase";
import Loader from "./Components/Loader";
import { useThemeColor } from "@/lib/hooks/useThemeColor";
import { ProjectCardSkeleton, ImageSkeleton } from "./Components/Skeleton";

interface Project {
  id: number;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  primary_color?: string;
}

// Component for project logo with skeleton loader
function ProjectLogoWithSkeleton({ logoUrl, name }: { logoUrl: string; name: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  return (
    <div className="w-12 h-12 rounded-lg overflow-hidden">
      {isLoading && !hasError && (
        <ImageSkeleton width={48} height={48} className="rounded-lg" />
      )}
      <img
        src={logoUrl}
        alt={name}
        className={`w-12 h-12 rounded-lg object-cover ${isLoading ? 'hidden' : ''}`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

export default function RootHomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchSlug, setSearchSlug] = useState("");
  const router = useRouter();
  const themeColor = useThemeColor(); // Get theme color immediately
  
  // Helper to create darker shade for gradients
  const adjustColorBrightness = (color: string, percent: number): string => {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  };
  
  const darkerColor = adjustColorBrightness(themeColor, -20); // For gradient end

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, slug, description, logo_url, primary_color")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (slug: string) => {
    router.push(`/${slug}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchSlug.trim()) {
      router.push(`/${searchSlug.trim()}`);
    }
  };

  return (
    <div 
      className="min-h-screen text-white"
      style={{ background: `linear-gradient(to bottom right, ${themeColor}, ${darkerColor})` }}
    >
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4">Welcome to Spinloot</h1>
          <p className="text-xl opacity-90">Choose your project or enter a project slug</p>
        </div>

        {/* Search Form */}
        <div className="max-w-md mx-auto mb-12">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchSlug}
              onChange={(e) => setSearchSlug(e.target.value)}
              placeholder="Enter project slug (e.g., new-project)"
              className="flex-1 px-4 py-3 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
            >
              Go
            </button>
          </form>
        </div>

        {/* Projects List */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {Array.from({ length: 6 }).map((_, index) => (
              <ProjectCardSkeleton key={index} />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => handleProjectSelect(project.slug)}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-6 cursor-pointer hover:bg-white/20 transition-all border border-white/20 hover:border-white/40"
                style={{
                  borderColor: project.primary_color ? `${project.primary_color}80` : undefined,
                }}
              >
                <div className="flex items-center gap-4 mb-3">
                  {project.logo_url ? (
                    <ProjectLogoWithSkeleton logoUrl={project.logo_url} name={project.name} />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl font-bold"
                      style={{
                        backgroundColor: project.primary_color || "#FF6B35",
                      }}
                    >
                      {project.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h3 className="text-xl font-semibold">{project.name}</h3>
                </div>
                {project.description && (
                  <p className="text-sm opacity-80 mb-4 line-clamp-2">{project.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs opacity-60">Slug: {project.slug}</span>
                  <button
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProjectSelect(project.slug);
                    }}
                  >
                    Open →
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-lg opacity-80">No active projects found.</p>
            <p className="text-sm opacity-60 mt-2">Create a project in the master dashboard.</p>
          </div>
        )}
      </div>
    </div>
  );
}



