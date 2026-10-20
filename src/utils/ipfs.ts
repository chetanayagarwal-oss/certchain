/**
 * IPFS upload via Pinata.
 * Falls back gracefully to a stub if PINATA_JWT is not configured.
 */

const PINATA_JWT     = import.meta.env.VITE_PINATA_JWT as string | undefined;
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

export interface UploadResult {
  cid: string;
  url: string;
  mock: boolean; // true when the JWT is missing and we returned a placeholder
}

/**
 * Upload a Uint8Array (PDF bytes) to IPFS via Pinata.
 * Returns the CID and a public gateway URL.
 */
export async function uploadToIPFS(
  bytes: Uint8Array,
  filename: string,
  metadata?: Record<string, string>
): Promise<UploadResult> {
  // ── Graceful fallback: no Pinata key ──────────────────────────────────────
  if (!PINATA_JWT) {
    console.warn("[IPFS] VITE_PINATA_JWT not set — using mock CID (demo mode).");
    const mockCid = "QmDemoMockCid" + Math.random().toString(36).slice(2, 10).toUpperCase();
    return { cid: mockCid, url: PINATA_GATEWAY + mockCid, mock: true };
  }

  // ── Real upload ────────────────────────────────────────────────────────────
  const blob = new Blob([bytes], { type: "application/pdf" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: filename, keyvalues: metadata ?? {} })
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pinata upload failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  const cid: string = json.IpfsHash;
  return { cid, url: PINATA_GATEWAY + cid, mock: false };
}

/**
 * Return a public HTTP gateway URL for a CID.
 */
export function ipfsUrl(cid: string): string {
  if (!cid || cid.startsWith("http")) return cid;
  return PINATA_GATEWAY + cid;
}
