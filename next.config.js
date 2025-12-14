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
        config.resolve.alias = {
            ...config.resolve.alias,
            'react-qr-reader': require.resolve('react-qr-reader'),
        };
        
        // Add root node_modules to resolve paths
        config.resolve.modules = [
            ...(config.resolve.modules || []),
            'node_modules',
        ];
        
        return config;
    }
}

module.exports = nextConfig
