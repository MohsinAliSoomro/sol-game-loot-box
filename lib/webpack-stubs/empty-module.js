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
  
  // Export irysStorage plugin object that corePlugins expects
  // This is the key export that corePlugins/plugin.mjs is looking for
  export const irysStorage = {
    install: () => {
      // Empty install function - Metaplex plugin interface
    }
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
      irysStorage,
      default: {
        IrysStorageDriver,
        isirysStorageDriver,
        irysStorage
      }
    };
  }
  