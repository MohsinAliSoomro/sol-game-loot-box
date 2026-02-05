/**
 * Utility functions for IPFS URL conversion
 */

/**
 * Converts IPFS URLs to HTTP gateway URLs
 * @param url - The IPFS URL or any image URL
 * @returns The converted HTTP URL or the original URL if not IPFS
 */
export function convertIPFSToHTTP(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // If it's already an HTTP/HTTPS URL, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Handle IPFS URLs (ipfs://... or ipfs/...)
  if (url.startsWith('ipfs://')) {
    const cid = url.replace('ipfs://', '').replace(/^\/+/, '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  
  if (url.startsWith('ipfs/')) {
    const cid = url.replace('ipfs/', '').replace(/^\/+/, '');
    return `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  
  // If it's just a CID (Qm...), prepend gateway URL
  if (url.startsWith('Qm') && url.length === 46 && !url.includes('/') && !url.includes('http')) {
    return `https://gateway.pinata.cloud/ipfs/${url}`;
  }
  
  // If it's a relative path or contains a CID, try to extract it
  if (!url.startsWith('http') && !url.startsWith('/')) {
    const cidMatch = url.match(/(Qm[a-zA-Z0-9]{44})/);
    if (cidMatch) {
      return `https://gateway.pinata.cloud/ipfs/${cidMatch[1]}`;
    }
  }

  // Return original URL if no IPFS pattern found
  return url;
}
