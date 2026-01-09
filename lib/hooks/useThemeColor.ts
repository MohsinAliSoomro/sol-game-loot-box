import { useState, useEffect } from 'react';
import { useProject } from '@/lib/project-context';

/**
 * Hook to get theme primary color immediately from cache
 * Prevents flash by providing theme color synchronously
 */
export function useThemeColor(): string {
  const { currentProject, getProjectId } = useProject();
  const projectId = getProjectId();
  
  // Get theme color synchronously on mount and when project changes
  const getThemeColorSync = (): string => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return currentProject?.primary_color || '#FF6B35';
      }
      
      const keys: string[] = [];
      
      // Try project-specific key first
      if (projectId) {
        keys.push(`website-theme-cache-${projectId}`);
      }
      
      // Try 'main' key
      keys.push('website-theme-cache-main');
      
      // Try generic key
      keys.push('website-theme-cache');
      
      // Try all project-specific keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('website-theme-cache-') && !keys.includes(key)) {
          keys.push(key);
        }
      }
      
      // Try each key
      for (const key of keys) {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const theme = JSON.parse(cached);
            const primaryColor = theme.primaryColor || theme.primary_color;
            if (primaryColor) {
              return primaryColor;
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      // Fallback: Check CSS variable if theme was already applied
      if (typeof window !== 'undefined') {
        const root = document.documentElement;
        const cssVarColor = getComputedStyle(root).getPropertyValue('--theme-primary').trim();
        if (cssVarColor) {
          return cssVarColor;
        }
      }
      
      // Fallback: Use project color if available
      if (currentProject?.primary_color) {
        return currentProject.primary_color;
      }
      
      return '#FF6B35';
    } catch (e) {
      return '#FF6B35';
    }
  };
  
  const [themeColor, setThemeColor] = useState<string>(() => getThemeColorSync());
  
  useEffect(() => {
    // Update when project changes
    const color = getThemeColorSync();
    setThemeColor(color);
    
    // Also listen for theme updates via CSS variable
    const updateFromCSSVar = () => {
      const root = document.documentElement;
      const cssVarColor = getComputedStyle(root).getPropertyValue('--theme-primary').trim();
      if (cssVarColor && cssVarColor !== themeColor) {
        setThemeColor(cssVarColor);
      }
    };
    
    // Check CSS variable periodically (for when theme is applied by WebsiteTheme)
    const intervalId = setInterval(updateFromCSSVar, 100);
    
    return () => clearInterval(intervalId);
  }, [projectId, currentProject?.primary_color, currentProject?.id]);
  
  return themeColor;
}

