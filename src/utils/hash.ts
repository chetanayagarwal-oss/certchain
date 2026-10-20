/**
 * Compute the SHA-256 hash of arbitrary bytes using the Web Crypto API.
 * Returns a hex string prefixed with "0x" (32 bytes = 64 hex chars + "0x").
 */
export async function hashBytes(data: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data as BufferSource);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  const hex        = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

/**
 * Hash a File object (e.g. a dropped PDF).
 */
export async function hashFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  return hashBytes(buf);
}

/**
 * Hash a Uint8Array (e.g. generated PDF bytes).
 */
export async function hashUint8Array(bytes: Uint8Array): Promise<string> {
  return hashBytes(bytes);
}

/**
 * Convert a hex hash string (with or without 0x) to a bytes32-compatible string.
 * ethers.js encodes bytes32 as a 66-char hex string; this normalises user input.
 */
export function normaliseHash(raw: string): string {
  const clean = raw.startsWith("0x") ? raw : "0x" + raw;
  if (clean.length !== 66) throw new Error("Invalid hash length — expected 32 bytes (64 hex chars).");
  return clean.toLowerCase();
}

/**
 * Short display form of a hash: "0x1234…abcd".
 */
export function shortHash(hash: string, chars = 8): string {
  return hash.slice(0, chars + 2) + "…" + hash.slice(-chars);
}

/**
 * Short display form of an Ethereum address.
 */
export function shortAddress(addr: string, chars = 4): string {
  return addr.slice(0, chars + 2) + "…" + addr.slice(-chars);
}

/**
 * Convert an IPFS CID to a public HTTP gateway URL.
 * Uses the provided gateway, VITE_IPFS_GATEWAY env variable if set,
 * or defaults to the Cloudflare IPFS gateway.
 */
export function ipfsUrl(
  cid: string,
  gateway = (import.meta.env.VITE_IPFS_GATEWAY as string | undefined) ?? "https://cloudflare-ipfs.com/ipfs"
): string {
  const cleanCid = cid.startsWith("ipfs://") ? cid.slice(7) : cid;
  const base = gateway.endsWith("/") ? gateway.slice(0, -1) : gateway;
  return `${base}/${cleanCid}`;
}
