import { useMemo } from "react";
import { ethers } from "ethers";
import { useWallet } from "../context/WalletContext";
import { useDemoMode } from "../context/DemoContext";
import { mockRegistry } from "../utils/mockRegistry";

// ABI — inline the minimal ABI needed for the frontend.
// Full ABI is also written by the deploy script to src/contracts/CertificateRegistry.json
const ABI = [
  "function isIssuer(address) view returns (bool)",
  "function getIssuerInfo(address) view returns (string name, bool active, uint256 addedAt)",
  "function issueCertificate(bytes32 certHash, string ipfsCid)",
  "function revokeCertificate(bytes32 certHash)",
  "function verifyCertificate(bytes32 certHash) view returns (bool exists, bool revoked, string issuerName, address issuer, uint256 issuedAt, uint256 revokedAt, string ipfsCid)",
  "function getIssuerCertificates(address issuer) view returns (bytes32[])",
  "function getCertificate(bytes32 certHash) view returns (tuple(bytes32 certHash, address issuer, string issuerName, string ipfsCid, uint256 issuedAt, bool revoked, uint256 revokedAt))",
  "function addIssuer(address issuer, string name)",
  "function removeIssuer(address issuer)",
  "function getAllIssuers() view returns (address[])",
  "function totalCertificates() view returns (uint256)",
  "function totalIssuers() view returns (uint256)",
  "function owner() view returns (address)",
  "event CertificateIssued(bytes32 indexed certHash, address indexed issuer, string ipfsCid, uint256 timestamp)",
  "event CertificateRevoked(bytes32 indexed certHash, address indexed issuer, uint256 timestamp)",
  "event IssuerAdded(address indexed issuer, string name, uint256 timestamp)",
  "event IssuerRemoved(address indexed issuer, uint256 timestamp)",
];

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string;
const RPC_URL          = import.meta.env.VITE_RPC_URL as string || "http://127.0.0.1:8545";

// ── Read-only provider (no wallet needed for verification) ────────────────────
function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export interface VerifyResult {
  exists: boolean;
  revoked: boolean;
  issuerName: string;
  issuer: string;
  issuedAt: number;
  revokedAt: number;
  ipfsCid: string;
}

export function useContract() {
  const { signer, provider } = useWallet();
  const { isDemoMode, demoAddress } = useDemoMode();

  const readContract = useMemo(() => {
    if (isDemoMode || !CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, getReadProvider());
  }, [isDemoMode]);

  const writeContract = useMemo(() => {
    if (isDemoMode || !signer || !CONTRACT_ADDRESS) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
  }, [signer, isDemoMode]);

  // ── Verify ─────────────────────────────────────────────────────────────────
  async function verifyCertificate(hash: string): Promise<VerifyResult> {
    if (isDemoMode) {
      const cert = mockRegistry.verifyCertificate(hash);
      if (!cert) return { exists: false, revoked: false, issuerName: "", issuer: "", issuedAt: 0, revokedAt: 0, ipfsCid: "" };
      return { exists: true, revoked: cert.revoked, issuerName: cert.issuerName, issuer: cert.issuer, issuedAt: cert.issuedAt, revokedAt: cert.revokedAt, ipfsCid: cert.ipfsCid };
    }
    if (!readContract) throw new Error("Contract not configured. Set VITE_CONTRACT_ADDRESS.");
    const r = await readContract.verifyCertificate(hash);
    return { exists: r.exists, revoked: r.revoked, issuerName: r.issuerName, issuer: r.issuer, issuedAt: Number(r.issuedAt), revokedAt: Number(r.revokedAt), ipfsCid: r.ipfsCid };
  }

  // ── Issue ──────────────────────────────────────────────────────────────────
  async function issueCertificate(hash: string, ipfsCid: string): Promise<ethers.TransactionReceipt | null> {
    if (isDemoMode) {
      await sleep(1500); // simulate tx time
      mockRegistry.issueCertificate(hash, ipfsCid, demoAddress);
      return null;
    }
    if (!writeContract) throw new Error("Wallet not connected.");
    const tx = await writeContract.issueCertificate(hash, ipfsCid);
    return tx.wait();
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  async function revokeCertificate(hash: string): Promise<ethers.TransactionReceipt | null> {
    if (isDemoMode) {
      await sleep(1000);
      const addr = demoAddress;
      mockRegistry.revokeCertificate(hash, addr);
      return null;
    }
    if (!writeContract) throw new Error("Wallet not connected.");
    const tx = await writeContract.revokeCertificate(hash);
    return tx.wait();
  }

  // ── isIssuer ───────────────────────────────────────────────────────────────
  async function checkIsIssuer(address: string): Promise<boolean> {
    if (isDemoMode) return mockRegistry.isIssuer(address);
    if (!readContract) return false;
    return readContract.isIssuer(address);
  }

  // ── getIssuerCertificates ─────────────────────────────────────────────────
  async function getIssuerCertificates(address: string): Promise<string[]> {
    if (isDemoMode) {
      return mockRegistry.getIssuerCertificates(address).map((c) => c.certHash);
    }
    if (!readContract) return [];
    const hashes = await readContract.getIssuerCertificates(address);
    return hashes as string[];
  }

  // ── getCertificate ─────────────────────────────────────────────────────────
  async function getCertificate(hash: string): Promise<VerifyResult> {
    return verifyCertificate(hash);
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  async function getStats(): Promise<{ totalCerts: number; totalIssuers: number }> {
    if (isDemoMode) {
      return { totalCerts: mockRegistry.getTotalCertificates(), totalIssuers: mockRegistry.getTotalIssuers() };
    }
    if (!readContract) return { totalCerts: 0, totalIssuers: 0 };
    const [tc, ti] = await Promise.all([readContract.totalCertificates(), readContract.totalIssuers()]);
    return { totalCerts: Number(tc), totalIssuers: Number(ti) };
  }

  // ── Owner ──────────────────────────────────────────────────────────────────
  async function getOwner(): Promise<string> {
    if (isDemoMode) return demoAddress;
    if (!readContract) return "";
    return readContract.owner();
  }

  // ── Admin: addIssuer ───────────────────────────────────────────────────────
  async function addIssuer(address: string, name: string): Promise<void> {
    if (isDemoMode) { mockRegistry.addIssuer(address, name); return; }
    if (!writeContract) throw new Error("Wallet not connected.");
    const tx = await writeContract.addIssuer(address, name);
    await tx.wait();
  }

  // ── Admin: removeIssuer ────────────────────────────────────────────────────
  async function removeIssuer(address: string): Promise<void> {
    if (isDemoMode) { mockRegistry.removeIssuer(address); return; }
    if (!writeContract) throw new Error("Wallet not connected.");
    const tx = await writeContract.removeIssuer(address);
    await tx.wait();
  }

  // ── Admin: getAllIssuers ────────────────────────────────────────────────────
  async function getAllIssuers(): Promise<Array<{ address: string; name: string }>> {
    if (isDemoMode) return mockRegistry.getAllIssuers();
    if (!readContract) return [];
    const addresses: string[] = await readContract.getAllIssuers();
    const infos = await Promise.all(
      addresses.map(async (addr) => {
        const info = await readContract.getIssuerInfo(addr);
        return { address: addr, name: info.name as string, active: info.active as boolean };
      })
    );
    return infos.filter((i) => i.active);
  }

  return {
    verifyCertificate,
    issueCertificate,
    revokeCertificate,
    checkIsIssuer,
    getIssuerCertificates,
    getCertificate,
    getStats,
    getOwner,
    addIssuer,
    removeIssuer,
    getAllIssuers,
    contractAddress: CONTRACT_ADDRESS,
  };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
