const fs = require('fs');
const path = require('path');

// Fix for @keystonehq/sdk nested dependency issue
// Ensure react-qr-reader exists in the nested node_modules
const rootReactQrReader = path.join(__dirname, '..', 'node_modules', 'react-qr-reader');
const nestedReactQrReader = path.join(__dirname, '..', 'node_modules', '@keystonehq', 'sdk', 'node_modules', 'react-qr-reader');

if (fs.existsSync(rootReactQrReader) && !fs.existsSync(nestedReactQrReader)) {
    console.log('Fixing @keystonehq/sdk nested dependency: react-qr-reader');
    
    // Create nested directory
    const nestedDir = path.dirname(nestedReactQrReader);
    if (!fs.existsSync(nestedDir)) {
        fs.mkdirSync(nestedDir, { recursive: true });
    }
    
    // Copy react-qr-reader to nested location
    const copyRecursiveSync = (src, dest) => {
        const exists = fs.existsSync(src);
        const stats = exists && fs.statSync(src);
        const isDirectory = exists && stats.isDirectory();
        
        if (isDirectory) {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            fs.readdirSync(src).forEach(childItemName => {
                copyRecursiveSync(
                    path.join(src, childItemName),
                    path.join(dest, childItemName)
                );
            });
        } else {
            fs.copyFileSync(src, dest);
        }
    };
    
    try {
        copyRecursiveSync(rootReactQrReader, nestedReactQrReader);
        console.log('✓ Successfully fixed nested dependency');
    } catch (error) {
        console.error('✗ Error fixing nested dependency:', error.message);
    }
} else if (!fs.existsSync(rootReactQrReader)) {
    console.warn('Warning: react-qr-reader not found in root node_modules');
} else {
    console.log('✓ Nested dependency already exists');
}

