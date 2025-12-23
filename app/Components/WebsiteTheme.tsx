'use client'
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getThemeSettings, getLootboxSettings, getWheelSettings } from '@/service/websiteSettings';
import { useProject } from '@/lib/project-context';

// Map font names to Google Fonts URLs
const getGoogleFontUrl = (fontName: string): string | null => {
  const fontMap: { [key: string]: string } = {
    'Inter': 'Inter:wght@400;500;600;700',
    'Roboto': 'Roboto:wght@400;500;700',
    'Open Sans': 'Open+Sans:wght@400;600;700',
    'Lato': 'Lato:wght@400;700',
    'Poppins': 'Poppins:wght@400;500;600;700',
    'Montserrat': 'Montserrat:wght@400;500;600;700',
  };

  return fontMap[fontName] || null;
};

// Load Google Font dynamically
const loadGoogleFont = (fontName: string) => {
  const fontUrl = getGoogleFontUrl(fontName);
  if (!fontUrl) return;

  // Check if font is already loaded
  const existingLink = document.querySelector(`link[data-font="${fontName}"]`);
  if (existingLink) return;

  // Create and append Google Fonts link
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${fontUrl}&display=swap`;
  link.setAttribute('data-font', fontName);
  document.head.appendChild(link);
};

// Helper function to adjust color brightness
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

// Function to apply theme to DOM elements
const applyThemeToElements = (theme: any) => {
  const primaryColor = theme.primaryColor || '#FF6B35';
  const textColor = theme.textColor || '#1F2937';
  
  // Update elements with bg-orange-500 (main background) - use !important
  document.querySelectorAll('.bg-orange-500, [class*="bg-orange"]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.backgroundColor = primaryColor;
    htmlEl.style.setProperty('background-color', primaryColor, 'important');
  });
  
  // Update elements with text-white to use text color or white if dark background
  document.querySelectorAll('.text-white').forEach((el: Element) => {
    // Keep white text for better contrast on colored backgrounds
    (el as HTMLElement).style.color = '#FFFFFF';
  });
  
  // Update gradient buttons (from-orange-500 to-orange-700)
  document.querySelectorAll('[class*="from-orange-500"], [class*="to-orange-700"]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    const classes = htmlEl.className;
    if (classes.includes('from-orange-500')) {
      // Create a slightly darker shade for gradient end
      const darker = adjustColorBrightness(primaryColor, -20);
      htmlEl.style.background = `linear-gradient(to right, ${primaryColor}, ${darker})`;
    }
  });
  
  // Update border-orange-300 elements
  document.querySelectorAll('[class*="border-orange"]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    const lighter = adjustColorBrightness(primaryColor, 30);
    htmlEl.style.borderColor = lighter;
  });
  
  // Update text-orange-800, text-orange-700 elements
  document.querySelectorAll('[class*="text-orange"]').forEach((el: Element) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.color = textColor;
  });
};

export default function WebsiteTheme() {
  const pathname = usePathname();
  const { currentProject } = useProject();

  useEffect(() => {
    // Apply project branding if available (takes priority over website settings)
    if (currentProject) {
      const root = document.documentElement;
      const primaryColor = currentProject.primary_color || '#FF6B35';
      const secondaryColor = currentProject.secondary_color || '#004E89';
      
      // Apply project colors
      root.style.setProperty('--theme-primary', primaryColor);
      root.style.setProperty('--theme-secondary', secondaryColor);
      document.body.style.backgroundColor = primaryColor;
      root.style.backgroundColor = primaryColor;
      
      // Apply theme to DOM elements
      applyThemeToElements({
        primaryColor,
        textColor: '#1F2937',
      });
    }
    let isApplying = false; // Flag to prevent concurrent theme applications
    let lastAppliedTheme: string | null = null; // Track last applied theme to avoid re-applying same theme

    const applyTheme = async () => {
      if (isApplying) return; // Prevent concurrent calls
      isApplying = true;

      try {
        // Check cache first for faster application
        // Make cache key project-specific
        const projectId = currentProject?.id || 'main';
        const cacheKey = `website-theme-cache-${projectId}`;
        let theme = null;
        
        // Apply cached theme IMMEDIATELY (synchronously) before async fetch
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            theme = JSON.parse(cached);
            const themeString = JSON.stringify(theme);
            
            // Only apply if theme changed
            if (themeString === lastAppliedTheme) {
              isApplying = false;
              return;
            }
            
            // Apply cached theme immediately - this is synchronous and fast
            const root = document.documentElement;
            const primaryColor = theme.primaryColor || '#FF6B35';
            document.body.style.backgroundColor = primaryColor;
            root.style.backgroundColor = primaryColor;
            
            // Apply all theme properties immediately from cache
            root.style.setProperty('--theme-primary', primaryColor);
            root.style.setProperty('--theme-secondary', theme.secondaryColor || '#004E89');
            root.style.setProperty('--theme-background', theme.backgroundColor || '#FFFFFF');
            root.style.setProperty('--theme-text', theme.textColor || '#1F2937');
            
            // Apply font if not Waltograph
            if (theme.fontFamily && theme.fontFamily !== 'Waltograph') {
              loadGoogleFont(theme.fontFamily);
              document.body.style.fontFamily = theme.fontFamily;
            } else {
              document.body.style.fontFamily = '';
            }
            
            // Apply theme to DOM elements immediately
            applyThemeToElements(theme);
            lastAppliedTheme = themeString;
          }
        } catch (e) {
          // Ignore cache errors
        }
        
        // Fetch fresh theme data (only once, not repeatedly)
        // Pass project ID if available to fetch project-specific theme
        const freshTheme = await getThemeSettings(currentProject?.id || undefined);
        
        if (freshTheme) {
          const themeString = JSON.stringify(freshTheme);
          
          // Only update if theme actually changed
          if (themeString !== lastAppliedTheme) {
            // Cache the theme for next page load
            try {
              localStorage.setItem(cacheKey, JSON.stringify(freshTheme));
            } catch (e) {
              // Ignore localStorage errors
            }
            
            theme = freshTheme;
            lastAppliedTheme = themeString;
            
            // Apply theme using CSS custom properties
            const root = document.documentElement;
            
            // Convert theme colors to CSS variables
            const primaryColor = theme.primaryColor || '#FF6B35';
            const secondaryColor = theme.secondaryColor || '#004E89';
            const backgroundColor = theme.backgroundColor || '#FFFFFF';
            const textColor = theme.textColor || '#1F2937';
            
            root.style.setProperty('--theme-primary', primaryColor);
            root.style.setProperty('--theme-secondary', secondaryColor);
            root.style.setProperty('--theme-background', backgroundColor);
            root.style.setProperty('--theme-text', textColor);
            
            // Apply background color to body/html
            document.body.style.backgroundColor = primaryColor;
            root.style.backgroundColor = primaryColor;
            
            // Apply theme to DOM elements
            applyThemeToElements(theme);
            
            // Apply font family
            if (theme.fontFamily && theme.fontFamily !== 'Waltograph') {
              loadGoogleFont(theme.fontFamily);
              root.style.setProperty('--theme-font-family', theme.fontFamily);
              document.body.style.fontFamily = theme.fontFamily;
            } else {
              document.body.style.fontFamily = '';
              document.querySelectorAll('link[data-font]').forEach(link => {
                if (link.getAttribute('data-font') !== 'Waltograph') {
                  link.remove();
                }
              });
            }
          }
        }
      } catch (error) {
        console.error('Error applying theme:', error);
      } finally {
        isApplying = false;
      }
    };

    // Call global function from inline script if available (only once)
    if (typeof window !== 'undefined' && (window as any).__applyThemeFromCache) {
      (window as any).__applyThemeFromCache();
    }
    
    // Apply theme immediately (only once on mount/navigation)
    applyTheme();
    
    // Lootbox box background color application
    let lastAppliedLootbox: string | null = null;
    const applyLootboxColors = async () => {
      try {
        // Make cache key project-specific
        const projectId = currentProject?.id || 'main';
        const lootboxCacheKey = `website-lootbox-cache-${projectId}`;
        
        // Apply cached lootbox box background color IMMEDIATELY (synchronously)
        try {
          const cached = localStorage.getItem(lootboxCacheKey);
          if (cached) {
            const lootboxSettings = JSON.parse(cached);
            const lootboxString = JSON.stringify(lootboxSettings);
            
            // Only apply if lootbox settings changed
            if (lootboxString !== lastAppliedLootbox) {
              const root = document.documentElement;
              root.style.setProperty('--lootbox-box-bg-color', lootboxSettings.boxBackgroundColor || '#FFFFFF');
              lastAppliedLootbox = lootboxString;
            }
          }
        } catch (e) {
          // Ignore cache errors
        }
        
        // Fetch fresh lootbox settings
        // Pass project ID if available to fetch project-specific settings
        const freshLootboxSettings = await getLootboxSettings(currentProject?.id || undefined);
        if (freshLootboxSettings) {
          const lootboxString = JSON.stringify(freshLootboxSettings);
          
          // Only update if lootbox settings actually changed
          if (lootboxString !== lastAppliedLootbox) {
            // Cache for next page load
            try {
              localStorage.setItem(lootboxCacheKey, JSON.stringify(freshLootboxSettings));
            } catch (e) {
              // Ignore localStorage errors
            }
            
            lastAppliedLootbox = lootboxString;
            
            // Apply lootbox box background color
            const root = document.documentElement;
            root.style.setProperty('--lootbox-box-bg-color', freshLootboxSettings.boxBackgroundColor || '#FFFFFF');
          }
        }
      } catch (error) {
        console.error('Error applying lootbox colors:', error);
      }
    };

    // Apply lootbox colors on mount
    applyLootboxColors();

    // Wheel theme application
    const applyWheelColors = async () => {
      try {
        // Make cache key project-specific
        const projectId = currentProject?.id || 'main';
        const wheelCacheKey = `website-wheel-cache-${projectId}`;
        let lastAppliedWheel: string | null = null;
        
        // Apply cached wheel colors IMMEDIATELY (synchronously)
        try {
          const cached = localStorage.getItem(wheelCacheKey);
          if (cached) {
            const wheelSettings = JSON.parse(cached);
            const wheelString = JSON.stringify(wheelSettings);
            
            // Only apply if wheel settings changed
            if (wheelString !== lastAppliedWheel) {
              const root = document.documentElement;
              root.style.setProperty('--wheel-segment-fill', wheelSettings.segmentFillColor || '#ff914d');
              root.style.setProperty('--wheel-segment-stroke', wheelSettings.segmentStrokeColor || '#f74e14');
              root.style.setProperty('--wheel-button-bg', wheelSettings.buttonBackgroundColor || '#f74e14');
              root.style.setProperty('--wheel-button-hover', wheelSettings.buttonHoverColor || '#e63900');
              root.style.setProperty('--wheel-pointer', wheelSettings.pointerColor || '#f74e14');
              root.style.setProperty('--wheel-text', wheelSettings.textColor || '#ffffff');
              lastAppliedWheel = wheelString;
            }
          }
        } catch (e) {
          // Ignore cache errors
        }
        
        // Fetch fresh wheel settings
        // Fetch fresh wheel settings
        // Pass project ID if available to fetch project-specific settings
        const freshWheelSettings = await getWheelSettings(currentProject?.id || undefined);
        if (freshWheelSettings) {
          const wheelString = JSON.stringify(freshWheelSettings);
          
          // Only update if wheel settings actually changed
          if (wheelString !== lastAppliedWheel) {
            // Cache for next page load
            try {
              localStorage.setItem(wheelCacheKey, JSON.stringify(freshWheelSettings));
            } catch (e) {
              // Ignore localStorage errors
            }
            
            lastAppliedWheel = wheelString;
            
            // Apply wheel colors
            const root = document.documentElement;
            root.style.setProperty('--wheel-segment-fill', freshWheelSettings.segmentFillColor || '#ff914d');
            root.style.setProperty('--wheel-segment-stroke', freshWheelSettings.segmentStrokeColor || '#f74e14');
            root.style.setProperty('--wheel-button-bg', freshWheelSettings.buttonBackgroundColor || '#f74e14');
            root.style.setProperty('--wheel-button-hover', freshWheelSettings.buttonHoverColor || '#e63900');
            root.style.setProperty('--wheel-pointer', freshWheelSettings.pointerColor || '#f74e14');
            root.style.setProperty('--wheel-text', freshWheelSettings.textColor || '#ffffff');
          }
        }
      } catch (error) {
        console.error('Error applying wheel colors:', error);
      }
    };

    // Apply wheel colors on mount
    applyWheelColors();

    // Only watch for new DOM elements being added, not style changes
    // This prevents loops from our own style modifications
    let timeoutId: NodeJS.Timeout;
    const observer = new MutationObserver((mutations) => {
      // Only react if new elements are added, not if attributes change
      const hasNewElements = mutations.some(mutation => 
        mutation.type === 'childList' && mutation.addedNodes.length > 0
      );
      
      if (hasNewElements) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          // Only apply to new elements, don't call full applyTheme
          try {
            // Make cache key project-specific
            const projectId = currentProject?.id || 'main';
            const cacheKey = `website-theme-cache-${projectId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const theme = JSON.parse(cached);
              applyThemeToElements(theme);
            }
          } catch (e) {
            // Ignore errors
          }

          // Re-apply lootbox box background color to new elements
          try {
            // Make cache key project-specific
            const projectId = currentProject?.id || 'main';
            const lootboxCacheKey = `website-lootbox-cache-${projectId}`;
            const cached = localStorage.getItem(lootboxCacheKey);
            if (cached) {
              const lootboxSettings = JSON.parse(cached);
              const root = document.documentElement;
              root.style.setProperty('--lootbox-box-bg-color', lootboxSettings.boxBackgroundColor || '#FFFFFF');
            }
          } catch (e) {
            // Ignore errors
          }

          // Re-apply wheel colors to new elements
          try {
            // Make cache key project-specific
            const projectId = currentProject?.id || 'main';
            const wheelCacheKey = `website-wheel-cache-${projectId}`;
            const cached = localStorage.getItem(wheelCacheKey);
            if (cached) {
              const wheelSettings = JSON.parse(cached);
              const root = document.documentElement;
              root.style.setProperty('--wheel-segment-fill', wheelSettings.segmentFillColor || '#ff914d');
              root.style.setProperty('--wheel-segment-stroke', wheelSettings.segmentStrokeColor || '#f74e14');
              root.style.setProperty('--wheel-button-bg', wheelSettings.buttonBackgroundColor || '#f74e14');
              root.style.setProperty('--wheel-button-hover', wheelSettings.buttonHoverColor || '#e63900');
              root.style.setProperty('--wheel-pointer', wheelSettings.pointerColor || '#f74e14');
              root.style.setProperty('--wheel-text', wheelSettings.textColor || '#ffffff');
            }
          } catch (e) {
            // Ignore errors
          }
        }, 300); // Longer delay to batch changes
      }
    });
    
    // Only observe child additions, not attribute changes
    observer.observe(document.body, {
      childList: true,
      subtree: true
      // Removed attributes observation to prevent loops
    });

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [pathname, currentProject?.id]); // Re-run when pathname or project changes

  return null; // This component doesn't render anything
}

