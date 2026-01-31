// Empty module stub for webpack
// This is used to replace problematic modules that cause build errors
// This file must work as both CommonJS and ESM

// Named exports that Metaplex might expect (ESM)
export const IrysStorageDriver = class {
    constructor() {
      // Empty stub class
    }
  };
  
  // Type guard function that Metaplex uses to check if something is an IrysStorageDriver
  export const isirysStorageDriver = (value) => {
    return value instanceof IrysStorageDriver || (value && typeof value === 'object');
  };
  
  // Export irysStorage as a function (Metaplex expects it to be callable)
  // This is the key export that corePlugins/plugin.mjs is looking for
  export const irysStorage = () => {
    // Return an empty plugin object that satisfies Metaplex's plugin interface
    return {
      install: () => {
        // Empty install function - Metaplex plugin interface
      }
    };
  };
  
  // ESM default export
  export default {
    IrysStorageDriver,
    isirysStorageDriver,
    irysStorage
  };
  
  // CommonJS exports (for compatibility)
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      IrysStorageDriver,
      isirysStorageDriver,
      irysStorage: irysStorage, // Export as function
      default: {
        IrysStorageDriver,
        isirysStorageDriver,
        irysStorage: irysStorage // Export as function
      }
    };
  }
  