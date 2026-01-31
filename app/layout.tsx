import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "./Components/ThemeProvider";
import ConditionalFooter from "./Components/ConditionalFooter";
import dynamic from "next/dynamic";
import { ProjectProvider } from "@/lib/project-context";

// Dynamically import heavy components to reduce initial bundle size
const SolanaWalletProvider = dynamic(
  () => import("./Components/SolanaWalletProvider"),
  { ssr: false } // disable SSR because wallet providers usually depend on window
);

const WebsiteTheme = dynamic(
  () => import("./Components/WebsiteTheme"),
  { ssr: false } // disable SSR because theme needs browser APIs
);

const FaviconManager = dynamic(
  () => import("./Components/FaviconManager"),
  { ssr: false } // disable SSR because favicon needs browser APIs
);

// Lazy load cart and modals - only load when needed
const SidebarCart = dynamic(
  () => import("./Components/SidebarCart"),
  { ssr: false }
);

const PurchaseModal = dynamic(
  () => import("./Components/Purchase"),
  { ssr: false }
);

const WithdrawModal = dynamic(
  () => import("./Components/Withdraw"),
  { ssr: false }
);

// const fontSans = Princess_Sofia({
//     subsets: ["latin"],
//     variable: "--font-sans",
//     weight: ["400"],
// });
const myFont = localFont({ src: "../fonts/waltograph/waltographUI.ttf" });
export const metadata: Metadata = {
  title: "Spinloot",
  description: "Welcome to Spinloot",
  icons: {
    icon: [
      { url: "public/favicon.ico", sizes: "any" },
    ],
    shortcut: "public/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
      {/* CRITICAL: This script MUST run BEFORE CSS loads - blocks rendering until theme is applied */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                // STEP 1: Set BLACK immediately during loading (prevents orange flash)
                // This will be replaced by theme color if found
                if (document.documentElement) {
                  var html = document.documentElement;
                  html.style.backgroundColor = '#000000';
                  html.style.setProperty('background-color', '#000000', 'important');
                  html.style.setProperty('--background-color-override', '#000000', 'important');
                  
                  // Inject temporary black style (will be removed when theme is found)
                  var blackStyle = document.createElement('style');
                  blackStyle.id = 'loading-black-screen';
                  blackStyle.textContent = 'html, body, #__next { background-color: #000000 !important; }';
                  if (document.head) {
                    document.head.insertBefore(blackStyle, document.head.firstChild);
                  } else {
                    document.documentElement.insertBefore(blackStyle, document.documentElement.firstChild);
                  }
                  
                  if (document.body) {
                    document.body.style.backgroundColor = '#000000';
                    document.body.style.setProperty('background-color', '#000000', 'important');
                  }
                }
                
                // STEP 2: Check for theme immediately (black is already set, so no flash)
                var primaryColor = null;
                var themeCache = null;
                
                // Find theme cache - check ALL possible keys synchronously
                try {
                  if (typeof localStorage !== 'undefined') {
                    var keys = [];
                    
                    // Try project-specific keys first
                    try {
                      var projectId = localStorage.getItem('currentProjectId');
                      if (projectId) {
                        keys.push('website-theme-cache-' + projectId);
                      }
                    } catch(e) {}
                    
                    // Try 'main' key (used when no project)
                    keys.push('website-theme-cache-main');
                    
                    // Try generic key
                    keys.push('website-theme-cache');
                    
                    // Also check ALL localStorage keys for theme cache
                    for (var i = 0; i < localStorage.length; i++) {
                      try {
                        var key = localStorage.key(i);
                        if (key && key.startsWith('website-theme-cache-') && keys.indexOf(key) === -1) {
                          keys.push(key);
                        }
                      } catch(e) {}
                    }
                    
                    // Try each key until we find a valid theme
                    for (var j = 0; j < keys.length && !themeCache; j++) {
                      try {
                        var cached = localStorage.getItem(keys[j]);
                        if (cached) {
                          themeCache = JSON.parse(cached);
                          primaryColor = themeCache.primaryColor || themeCache.primary_color || null;
                          if (primaryColor) break;
                        }
                      } catch(e) {}
                    }
                  }
                } catch(e) {}
                
                // STEP 3: Apply theme color IMMEDIATELY if found - replace black with theme
                if (primaryColor && document.documentElement) {
                  // Remove black loading screen
                  var blackLoader = document.getElementById('loading-black-screen');
                  if (blackLoader) {
                    blackLoader.remove();
                  }
                  
                  // Apply theme color immediately
                  var html = document.documentElement;
                  html.style.backgroundColor = primaryColor;
                  html.style.setProperty('background-color', primaryColor, 'important');
                  html.style.setProperty('--background-color-override', primaryColor, 'important');
                  html.style.setProperty('--theme-primary', primaryColor, 'important');
                  
                  // Inject theme style tag
                  var style = document.createElement('style');
                  style.id = 'theme-blocking-style';
                  // Check if we're on an admin page - exclude main from theme background
                  var isAdminPage = window.location.pathname && (window.location.pathname.includes('/admin') || window.location.pathname.match(/\/[^\/]+\/[^\/]+\/admin/));
                  var mainBackgroundRule = isAdminPage 
                    ? 'html, body, #__next, [data-nextjs-scroll-focus-boundary] { background-color: ' + primaryColor + ' !important; } main, [role="main"] { background-color: #ffffff !important; }'
                    : 'html, body, #__next, [data-nextjs-scroll-focus-boundary], main, [role="main"] { background-color: ' + primaryColor + ' !important; }';
                  style.textContent = mainBackgroundRule + ' :root { --background-color-override: ' + primaryColor + ' !important; --theme-primary: ' + primaryColor + ' !important; }';
                  
                  // Insert at the very beginning of head
                  if (document.head) {
                    document.head.insertBefore(style, document.head.firstChild);
                  } else if (document.documentElement) {
                    var firstChild = document.documentElement.firstChild;
                    if (firstChild) {
                      document.documentElement.insertBefore(style, firstChild);
                    } else {
                      document.documentElement.appendChild(style);
                    }
                  }
                  
                  // Apply to body
                  if (document.body) {
                    document.body.style.backgroundColor = primaryColor;
                    document.body.style.setProperty('background-color', primaryColor, 'important');
                  }
                  
                  // Apply to orange elements
                  try {
                    document.querySelectorAll('.bg-orange-500, [class*="bg-orange"]').forEach(function(el) {
                      el.style.backgroundColor = primaryColor;
                      el.style.setProperty('background-color', primaryColor, 'important');
                    });
                  } catch(e) {}
                }
                // If no theme found, black screen stays (only during loading - will be replaced by WebsiteTheme component)
                
                // Also apply when body appears (backup)
                var applyToBody = function() {
                  if (primaryColor && document.body) {
                    document.body.style.backgroundColor = primaryColor;
                    document.body.style.setProperty('background-color', primaryColor, 'important');
                  }
                };
                
                if (document.body) {
                  applyToBody();
                } else {
                  // Wait for body
                  var checkBody = setInterval(function() {
                    if (document.body) {
                      applyToBody();
                      clearInterval(checkBody);
                    }
                  }, 10);
                  setTimeout(function() { clearInterval(checkBody); }, 5000);
                }
                
                // Helper function to adjust color brightness for gradients
                var adjustColorBrightness = function(color, percent) {
                  var num = parseInt(color.replace("#", ""), 16);
                  var amt = Math.round(2.55 * percent);
                  var R = (num >> 16) + amt;
                  var G = (num >> 8 & 0x00FF) + amt;
                  var B = (num & 0x0000FF) + amt;
                  return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
                    (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
                };
                
                // Expose function globally so it can be called on navigation
                window.__applyThemeFromCache = function() {
                  try {
                    var navPrimaryColor = null;
                    var navTheme = null;
                    var navKeys = [];
                    
                    try {
                      if (typeof localStorage !== 'undefined') {
                        var navProjectId = localStorage.getItem('currentProjectId');
                        if (navProjectId) {
                          navKeys.push('website-theme-cache-' + navProjectId);
                        }
                        navKeys.push('website-theme-cache-main');
                        navKeys.push('website-theme-cache');
                        
                        for (var k = 0; k < localStorage.length; k++) {
                          var navKey = localStorage.key(k);
                          if (navKey && navKey.startsWith('website-theme-cache-') && navKeys.indexOf(navKey) === -1) {
                            navKeys.push(navKey);
                          }
                        }
                        
                        for (var l = 0; l < navKeys.length && !navPrimaryColor; l++) {
                          try {
                            var navCached = localStorage.getItem(navKeys[l]);
                            if (navCached) {
                              navTheme = JSON.parse(navCached);
                              navPrimaryColor = navTheme.primaryColor || navTheme.primary_color || null;
                              if (navPrimaryColor) break;
                            }
                          } catch(e) {}
                        }
                      }
                    } catch(e) {}
                    
                    if (navPrimaryColor && document.documentElement) {
                      var html = document.documentElement;
                      html.style.backgroundColor = navPrimaryColor;
                      html.style.setProperty('background-color', navPrimaryColor, 'important');
                      if (document.body) {
                        document.body.style.backgroundColor = navPrimaryColor;
                        document.body.style.setProperty('background-color', navPrimaryColor, 'important');
                      }
                      html.style.setProperty('--theme-primary', navPrimaryColor, 'important');
                      html.style.setProperty('--background-color-override', navPrimaryColor, 'important');
                      
                      // Check if we're on an admin page - set main background to white
                      var isNavAdminPage = window.location.pathname && (window.location.pathname.includes('/admin') || window.location.pathname.match(/\/[^\/]+\/[^\/]+\/admin/));
                      if (isNavAdminPage) {
                        document.querySelectorAll('main, [role="main"]').forEach(function(mainEl) {
                          mainEl.style.backgroundColor = '#ffffff';
                          mainEl.style.setProperty('background-color', '#ffffff', 'important');
                        });
                        // Update existing style tag if it exists
                        var existingStyle = document.getElementById('theme-blocking-style');
                        if (existingStyle) {
                          existingStyle.textContent = 'html, body, #__next, [data-nextjs-scroll-focus-boundary] { background-color: ' + navPrimaryColor + ' !important; } main, [role="main"] { background-color: #ffffff !important; } :root { --background-color-override: ' + navPrimaryColor + ' !important; --theme-primary: ' + navPrimaryColor + ' !important; }';
                        }
                      } else {
                        // Update existing style tag to include main for non-admin pages
                        var existingStyle = document.getElementById('theme-blocking-style');
                        if (existingStyle) {
                          existingStyle.textContent = 'html, body, #__next, [data-nextjs-scroll-focus-boundary], main, [role="main"] { background-color: ' + navPrimaryColor + ' !important; } :root { --background-color-override: ' + navPrimaryColor + ' !important; --theme-primary: ' + navPrimaryColor + ' !important; }';
                        }
                      }
                      
                      // Apply to all orange elements IMMEDIATELY - prevents flash
                      if (navTheme) {
                        // Update elements with bg-orange classes
                        document.querySelectorAll('.bg-orange-500, [class*="bg-orange"]').forEach(function(el) {
                          el.style.backgroundColor = navPrimaryColor;
                          el.style.setProperty('background-color', navPrimaryColor, 'important');
                        });
                        
                        // Update gradient buttons
                        document.querySelectorAll('[class*="from-orange-500"], [class*="to-orange-700"]').forEach(function(el) {
                          if (el.className && el.className.includes('from-orange-500')) {
                            var darker = adjustColorBrightness(navPrimaryColor, -20);
                            el.style.background = 'linear-gradient(to right, ' + navPrimaryColor + ', ' + darker + ')';
                          }
                        });
                        
                        // Update border-orange elements
                        document.querySelectorAll('[class*="border-orange"]').forEach(function(el) {
                          var lighter = adjustColorBrightness(navPrimaryColor, 30);
                          el.style.borderColor = lighter;
                        });
                      }
                    }
                  } catch(e) {}
                };
                
                // Intercept navigation to apply theme before new page renders
                var originalPushState = window.history.pushState;
                var originalReplaceState = window.history.replaceState;
                
                window.history.pushState = function() {
                  window.__applyThemeFromCache();
                  originalPushState.apply(window.history, arguments);
                  setTimeout(window.__applyThemeFromCache, 0);
                };
                
                window.history.replaceState = function() {
                  window.__applyThemeFromCache();
                  originalReplaceState.apply(window.history, arguments);
                  setTimeout(window.__applyThemeFromCache, 0);
                };
                
                window.addEventListener('popstate', function() {
                  window.__applyThemeFromCache();
                });
              } catch (e) {
                // Silently fail
              }
            })();
          `,
        }}
      />
      <link rel="icon" href="/favicon.ico" />

      <body
        className={cn(
          "min-h-screen antialiased flex flex-col",
          myFont.className
        )}
      >
        <SolanaWalletProvider>
          <ProjectProvider>
            <ThemeProvider
              attribute="class"
              // defaultTheme="system"
              // enableSystem
              // disableTransitionOnChange
            >
              <FaviconManager />
              <WebsiteTheme />
              <div className="flex-1 flex flex-col">
                {children}
              </div>
              <ConditionalFooter />
              <SidebarCart />
              <PurchaseModal />
              <WithdrawModal />
            </ThemeProvider>
          </ProjectProvider>
        </SolanaWalletProvider>
      </body>
      </head>
   
    </html>
  );
}
