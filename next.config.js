/** @type {import('next').NextConfig} */
const nextConfig = {
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
    webpack: (config, { isServer }) => {
        // Fix for @keystonehq/sdk nested dependency resolution
        // Ensure react-qr-reader resolves from root node_modules
        const path = require('path');
        
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
        
        return config;
    }
}

module.exports = nextConfig
