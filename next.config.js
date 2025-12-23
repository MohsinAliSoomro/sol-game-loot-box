/** @type {import('next').NextConfig} */
const nextConfig = {
    // Only use app directory for pages (ignore src/pages and spinloot_dashboard)
    pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
    // Explicitly tell Next.js to only use app directory, not pages or src/pages
    // Disable pages directory scanning entirely
    distDir: '.next',
    // CRITICAL: Tell Next.js to ONLY use the app directory, ignore pages and src/pages
    // This prevents Next.js from discovering pages in src/pages
    // Next.js 13+ with app directory should not scan for pages directory by default
    // But we need to ensure src/pages is completely ignored
    experimental: {
        // Ensure we're only using app directory
    },
    // CRITICAL: Exclude src/Pages from page discovery
    // Next.js scans for 'pages' directories (case-insensitive on Windows)
    // We need to prevent it from discovering src/Pages
    // Since page discovery happens before webpack, we need to handle this differently
    // The solution is to ensure Next.js only uses the app directory
    images:{
        domains:[
            'zkltmkbmzxvfovsgotpt.supabase.co',
            'lh3.googleusercontent.com',
            'api.dicebear.com',
            'arweave.net',
            'raw.githubusercontent.com',
            'gateway.pinata.cloud',
            'ipfs.io',
            'cloudflare-ipfs.com',
            'dweb.link',
            'nftstorage.link'
        ],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.ipfs.**',
            },
            {
                protocol: 'https',
                hostname: 'gateway.pinata.cloud',
            },
            {
                protocol: 'https',
                hostname: 'ipfs.io',
            },
            {
                protocol: 'https',
                hostname: 'cloudflare-ipfs.com',
            },
            {
                protocol: 'https',
                hostname: 'dweb.link',
            },
            {
                protocol: 'https',
                hostname: 'nftstorage.link',
            }
        ]
    },
    webpack: (config, { isServer, webpack, dev, defaultLoaders }) => {
        // Exclude spinloot_dashboard and root src directory from Next.js build
        // (they are separate React/Vite apps, not Next.js pages)
        const path = require('path');
        const fs = require('fs');
        
        // CRITICAL: Prevent Next.js from discovering src/Pages as a pages directory
        // Next.js auto-discovers 'pages' directories, so we need to intercept this
        // at the webpack level before page collection happens
        
        // Aggressively exclude src and spinloot_dashboard from all webpack operations
        config.watchOptions = {
            ...config.watchOptions,
            ignored: [
                ...(Array.isArray(config.watchOptions?.ignored) ? config.watchOptions.ignored : []),
                '**/spinloot_dashboard/**',
                '**/src/**',
                path.resolve(__dirname, 'src'),
                path.resolve(__dirname, 'spinloot_dashboard'),
            ],
        };
        
        // Add entry point filter to prevent src/Pages from being treated as pages
        if (config.entry && typeof config.entry === 'function') {
            const originalEntry = config.entry;
            config.entry = async () => {
                const entries = await originalEntry();
                // Filter out any entries from src directory
                const filteredEntries = {};
                for (const [key, value] of Object.entries(entries)) {
                    // Skip entries from src directory completely
                    if (key.includes('src/') || key.includes('src\\') || 
                        key.includes('src/pages') || key.includes('src\\pages')) {
                        console.log(`[WEBPACK] Filtering out entry: ${key}`);
                        continue;
                    }
                    if (typeof value === 'string' && !value.includes('\\src\\') && !value.includes('/src/')) {
                        filteredEntries[key] = value;
                    } else if (Array.isArray(value)) {
                        filteredEntries[key] = value.filter(v => 
                            typeof v === 'string' && !v.includes('\\src\\') && !v.includes('/src/')
                        );
                    } else {
                        filteredEntries[key] = value;
                    }
                }
                return filteredEntries;
            };
        }
        
        // Note: We don't need a compilation hook - NormalModuleReplacementPlugin handles src/pages
        // The compilation hook was interfering with CSS loading
        
        // Add a custom plugin to filter out these directories from the compilation
        // CRITICAL: Only exclude JS/TS files, NEVER CSS or other assets
        // We use a more defensive approach - check for CSS/assets FIRST and always allow them
        config.plugins.push(
            new (class {
                apply(compiler) {
                    compiler.hooks.normalModuleFactory.tap('ExcludeDirectories', (nmf) => {
                        nmf.hooks.beforeResolve.tap('ExcludeDirectories', (data) => {
                            if (!data) return;
                            const request = (data.request || '').replace(/\\/g, '/');
                            const context = (data.context || '').replace(/\\/g, '/');
                            
                            // CRITICAL: Check for CSS and assets FIRST - always allow them through
                            // This must be checked BEFORE any other logic
                            const isCSS = /\.(css|scss|sass|less|styl)$/i.test(request);
                            const isAsset = /\.(png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico|webp|mp4|webm|pdf|json)$/i.test(request);
                            
                            // If it's CSS or an asset, ALWAYS allow it through immediately
                            if (isCSS || isAsset) {
                                return; // Allow CSS and assets to pass through - don't check anything else
                            }
                            
                            // Now check if it's a JS/TS file - only block these
                            const isJSOrTS = /\.(js|jsx|ts|tsx|mjs)$/i.test(request);
                            
                            // If it's NOT a JS/TS file, allow it through
                            if (!isJSOrTS) {
                                return; // Allow other non-JS files to pass through
                            }
                            
                            // Only block JS/TS files from src/spinloot_dashboard
                            const lowerRequest = request.toLowerCase();
                            const lowerContext = (context || '').toLowerCase();
                            
                            // Check for src/pages directory (any case) - ONLY for JS/TS files
                            if (lowerRequest.includes('/src/pages/') || 
                                lowerRequest.includes('\\src\\pages\\') ||
                                lowerRequest.includes('/src/pages') ||
                                lowerRequest.includes('\\src\\pages') ||
                                lowerContext.includes('/src/pages/') ||
                                lowerContext.includes('\\src\\pages\\')) {
                                return false; // Skip this JS/TS module from src/pages
                            }
                            
                            // Check for spinloot_dashboard - ONLY for JS/TS files
                            if (lowerRequest.includes('spinloot_dashboard') ||
                                lowerContext.includes('spinloot_dashboard')) {
                                return false; // Skip this JS/TS module from spinloot_dashboard
                            }
                            
                            // Allow all other JS/TS files (including from app directory)
                            return; // Allow through
                        });
                    });
                }
            })()
        );
        
        // Fix for @keystonehq/sdk nested dependency resolution
        // Ensure react-qr-reader resolves from root node_modules
        try {
            // Try to resolve the built file directly (dist/cjs/index.js)
            const reactQrReaderMain = path.join(process.cwd(), 'node_modules', 'react-qr-reader', 'dist', 'cjs', 'index.js');
            const fs = require('fs');
            
            if (fs.existsSync(reactQrReaderMain)) {
                config.resolve.alias = {
                    ...config.resolve.alias,
                    'react-qr-reader': reactQrReaderMain,
                };
            } else {
                // Fallback to require.resolve
                const reactQrReaderPath = require.resolve('react-qr-reader');
                config.resolve.alias = {
                    ...config.resolve.alias,
                    'react-qr-reader': reactQrReaderPath,
                };
            }
        } catch (error) {
            // If react-qr-reader is not found, try to resolve it from a different path
            console.warn('Warning: Could not resolve react-qr-reader, trying alternative path');
            const reactQrReaderPath = path.join(process.cwd(), 'node_modules', 'react-qr-reader');
            config.resolve.alias = {
                ...config.resolve.alias,
                'react-qr-reader': reactQrReaderPath,
            };
        }
        
        // Add root node_modules to resolve paths
        config.resolve.modules = [
            ...(config.resolve.modules || []),
            'node_modules',
        ];
        
        // CRITICAL: Replace ALL src/Pages and src/pages modules with empty module
        // This prevents Next.js from trying to load them and their dependencies
        // Note: This handles the webpack side, but Next.js page discovery happens before webpack
        // So we also need to ensure Next.js doesn't discover src/Pages as a pages directory
        const emptyModulePath = path.resolve(__dirname, 'lib/webpack-stubs/empty-module.js');
        
        // Replace src/Pages (capital P) and src/pages (lowercase) files - case insensitive
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
                /[\/\\]src[\/\\][Pp]ages?[\/\\].*\.(js|jsx|ts|tsx)$/i,
                emptyModulePath
            )
        );
        
        // Redirect @irys/sdk to empty module to prevent build errors
        // This works at the resolve level, before plugins run
        // Note: emptyModulePath is already declared above
        config.resolve.alias = {
            ...config.resolve.alias,
            '@irys/sdk': emptyModulePath,
            // Fix WalletConnect adapter dependency issues
            '@walletconnect/solana-adapter': emptyModulePath,
            '@reown/appkit/networks': emptyModulePath,
            '@solana/wallet-adapter-walletconnect': emptyModulePath,
            // Fix Metaplex IrysStorageDriver import errors
            '@metaplex-foundation/js/dist/esm/plugins/irysStorage/IrysStorageDriver.mjs': emptyModulePath,
            '@metaplex-foundation/js/dist/esm/plugins/irysStorage/plugin.mjs': emptyModulePath,
            '@metaplex-foundation/js/dist/esm/plugins/irysStorage/index.mjs': emptyModulePath,
        };
        
        // Fix for @irys/sdk and arbundles compatibility issue
        // The @irys/sdk package tries to import signers from arbundles that don't exist
        // We'll add fallbacks to prevent build errors
        config.resolve.fallback = {
            ...config.resolve.fallback,
        };
        
        // Add webpack externals or ignore problematic imports from @irys/sdk
        // This prevents the build from failing due to missing arbundles exports
        config.externals = config.externals || [];
        if (Array.isArray(config.externals)) {
            config.externals.push({
                // Ignore problematic arbundles imports that @irys/sdk tries to use
                'arbundles': 'commonjs arbundles',
            });
        } else if (typeof config.externals === 'object') {
            config.externals['arbundles'] = 'commonjs arbundles';
        }
        
        // Ignore src/pages JS/TS files only (NOT CSS or other assets)
        // Using RegExp format for IgnorePlugin (required by Next.js webpack version)
        // Only match JS/TS files in src/pages, not CSS or other files
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /[\/\\]src[\/\\]pages?[\/\\].*\.(js|jsx|ts|tsx|mjs)$/i,
                contextRegExp: /.*/
            })
        );
        
        // Ignore spinloot_dashboard JS/TS files only
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /spinloot_dashboard.*\.(js|jsx|ts|tsx|mjs)$/i,
                contextRegExp: /.*/
            })
        );
        
        // Aggressively ignore entire @irys/sdk package to prevent build errors
        // The @irys/sdk has broken dependencies with arbundles
        // This is only used by Metaplex IrysStorageDriver which we don't need
        // Using RegExp format for IgnorePlugin (required by Next.js webpack version)
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /@irys\/sdk/,
                contextRegExp: /.*/
            })
        );
        
        // Ignore WalletConnect adapter which has broken dependencies
        // We don't use WalletConnect (only Phantom, Solflare, Torus, Trust)
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /@walletconnect\/solana-adapter/,
                contextRegExp: /.*/
            })
        );
        
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /@reown\/appkit\/networks/,
                contextRegExp: /.*/
            })
        );
        
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /@solana\/wallet-adapter-walletconnect/,
                contextRegExp: /.*/
            })
        );
        
        // Replace IrysStorageDriver with empty module to prevent @irys/sdk dependency
        // This allows Metaplex to load without the broken Irys storage driver
        // Note: emptyModulePath is already declared above
        
        // First, replace IrysStorageDriver.mjs itself
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
                /@metaplex-foundation\/js\/dist\/esm\/plugins\/irysStorage\/IrysStorageDriver\.mjs$/,
                emptyModulePath
            )
        );
        
        // Replace plugin.mjs that tries to import IrysStorageDriver
        // This is the file causing the build error: "Attempted import error: 'IrysStorageDriver' is not exported"
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
                /@metaplex-foundation\/js\/dist\/esm\/plugins\/irysStorage\/plugin\.mjs$/,
                emptyModulePath
            )
        );
        
        // Also replace the index export that includes IrysStorageDriver
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
                /@metaplex-foundation\/js\/dist\/esm\/plugins\/irysStorage\/index\.mjs$/,
                emptyModulePath
            )
        );
        
        // Replace the entire irysStorage plugin directory to prevent any imports
        // This is a more aggressive approach to ensure no Irys-related code is loaded
        config.plugins.push(
            new webpack.NormalModuleReplacementPlugin(
                /@metaplex-foundation\/js\/dist\/esm\/plugins\/irysStorage\/.*\.mjs$/,
                emptyModulePath
            )
        );
        
        // Exclude spinloot_dashboard and src directories from webpack processing
        // BUT: Don't modify module.rules in a way that breaks CSS processing
        // Next.js handles CSS automatically, so we only need to exclude JS/TS files
        // We'll handle exclusions through plugins and IgnorePlugin instead
        
        return config;
    }
}

module.exports = nextConfig
