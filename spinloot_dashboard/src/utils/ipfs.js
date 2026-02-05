/**
 * Convert IPFS URLs to HTTP gateway URLs
 * @param {string|null|undefined} url - The IPFS URL to convert
 * @returns {string|null} - The converted HTTP URL or null if invalid
 */
export const convertIPFSToHTTP = (url) => {
  if (!url || typeof url !== 'string') return null;

  let convertedUrl = url;

  // Handle ipfs://
  if (convertedUrl.startsWith('ipfs://')) {
    const cid = convertedUrl.replace('ipfs://', '').replace(/^\/+/, '');
    convertedUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  // Handle ipfs/ (relative path)
  else if (convertedUrl.startsWith('ipfs/')) {
    const cid = convertedUrl.replace('ipfs/', '').replace(/^\/+/, '');
    convertedUrl = `https://gateway.pinata.cloud/ipfs/${cid}`;
  }
  // Handle bare CID (Qm...)
  else if (convertedUrl.startsWith('Qm') && convertedUrl.length === 46 && !convertedUrl.includes('/') && !convertedUrl.includes('http')) {
    convertedUrl = `https://gateway.pinata.cloud/ipfs/${convertedUrl}`;
  }
  // Handle arweave.net URLs that might need a gateway (though usually direct)
  else if (convertedUrl.startsWith('ar://')) {
    const txId = convertedUrl.replace('ar://', '');
    convertedUrl = `https://arweave.net/${txId}`;
  }

  // Ensure it's a valid HTTP/HTTPS URL after conversion
  if (convertedUrl.startsWith('http://') || convertedUrl.startsWith('https://')) {
    return convertedUrl;
  }

  return null;
};
