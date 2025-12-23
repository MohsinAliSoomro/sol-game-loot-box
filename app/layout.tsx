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
      <link rel="icon" href="/favicon.ico" />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                // Apply theme immediately from cache before React loads to prevent flash
                const themeKey = 'website-theme-cache';
                const applyThemeFromCache = function() {
                  try {
                    const cachedTheme = localStorage.getItem(themeKey);
                    if (cachedTheme) {
                      const theme = JSON.parse(cachedTheme);
                      const primaryColor = theme.primaryColor || '#FF6B35';
                      
                      // Apply to body if it exists
                      if (document.body) {
                        document.body.style.backgroundColor = primaryColor;
                        document.body.style.setProperty('background-color', primaryColor, 'important');
                      }
                      
                      // Apply to html element
                      const html = document.documentElement;
                      if (html) {
                        html.style.backgroundColor = primaryColor;
                        html.style.setProperty('background-color', primaryColor, 'important');
                      }
                      
                      // Set CSS variables immediately
                      if (html) {
                        html.style.setProperty('--theme-primary', primaryColor);
                        html.style.setProperty('--theme-secondary', theme.secondaryColor || '#004E89');
                        html.style.setProperty('--theme-background', theme.backgroundColor || '#FFFFFF');
                        html.style.setProperty('--theme-text', theme.textColor || '#1F2937');
                      }
                    }
                  } catch (e) {
                    // Silently fail
                  }
                };
                
                // Apply immediately if DOM is ready
                if (document.body) {
                  applyThemeFromCache();
                }
                
                // Wait for DOM ready
                if (document.addEventListener) {
                  document.addEventListener('DOMContentLoaded', applyThemeFromCache);
                  // Also try on load as backup
                  window.addEventListener('load', applyThemeFromCache);
                  // Apply immediately when body appears
                  if (document.readyState === 'loading') {
                    const checkBody = setInterval(function() {
                      if (document.body) {
                        applyThemeFromCache();
                        clearInterval(checkBody);
                      }
                    }, 10);
                    // Clear after 5 seconds to prevent infinite loop
                    setTimeout(function() {
                      clearInterval(checkBody);
                    }, 5000);
                  }
                }
                
                // Expose function globally for route changes
                window.__applyThemeFromCache = applyThemeFromCache;
              } catch (e) {
                // Silently fail
              }
            })();
          `,
        }}
      />

      <body
        className={cn(
          "min-h-screen antialiased",
          myFont.className
        )}
        style={{
          backgroundColor: '#FF6B35' // Default fallback
        }}
      >
        <SolanaWalletProvider>
          <ProjectProvider>
            <ThemeProvider
              attribute="class"
              // defaultTheme="system"
              // enableSystem
              // disableTransitionOnChange
            >
              <WebsiteTheme />
              {children}
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
