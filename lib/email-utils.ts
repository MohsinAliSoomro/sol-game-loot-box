/**
 * Generate email from wallet address
 * Uses same format as auth route: hash@wallet.local
 */
export async function generateEmailFromWallet(walletAddress: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side: use Node.js crypto
    const crypto = await import('crypto');
    const hash = crypto.createHash("sha256")
      .update(walletAddress)
      .digest("hex")
      .slice(0, 15);
    return `${hash}@wallet.local`;
  } else {
    // Client-side: use Web Crypto API
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(walletAddress);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data as BufferSource);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const hash = hashHex.slice(0, 15);
      return `${hash}@wallet.local`;
    } catch (error) {
      console.error('Error generating email hash:', error);
      // Fallback: use first 15 chars of wallet address
      return `${walletAddress.slice(0, 15)}@wallet.local`;
    }
  }
}



