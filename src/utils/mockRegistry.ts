// Demo-mode mock registry — lives in localStorage, mimics the real contract.
// This lets the app run without MetaMask or testnet funds.

export interface MockCertificate {
  certHash: string;
  issuer: string;
  issuerName: string;
  ipfsCid: string;
  issuedAt: number; // unix seconds
  revoked: boolean;
  revokedAt: number;
}

const STORAGE_KEY = "certchain_demo_registry";
const ISSUER_KEY  = "certchain_demo_issuers";

// ── Seeded sample data ────────────────────────────────────────────────────────
// The demo PDF in /public/demo/sample-cert.pdf hashes to this value.
export const DEMO_VALID_HASH =
  "0xa3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8f0a2b4";

export const DEMO_ISSUER_ADDRESS = "0xDEMO0000000000000000000000000000000000001";
export const DEMO_ISSUER_NAME    = "MIT (Demo University)";

const SEED_CERTS: Record<string, MockCertificate> = {
  [DEMO_VALID_HASH]: {
    certHash:   DEMO_VALID_HASH,
    issuer:     DEMO_ISSUER_ADDRESS,
    issuerName: DEMO_ISSUER_NAME,
    ipfsCid:    "QmDemoSampleCertificateIPFSCid",
    issuedAt:   Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
    revoked:    false,
    revokedAt:  0,
  },
};

const SEED_ISSUERS: Record<string, string> = {
  [DEMO_ISSUER_ADDRESS]: DEMO_ISSUER_NAME,
};

// ── Persistence helpers ────────────────────────────────────────────────────────
function loadCerts(): Record<string, MockCertificate> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...SEED_CERTS, ...JSON.parse(raw) } : { ...SEED_CERTS };
  } catch { return { ...SEED_CERTS }; }
}

function saveCerts(certs: Record<string, MockCertificate>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(certs));
}

function loadIssuers(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ISSUER_KEY);
    return raw ? { ...SEED_ISSUERS, ...JSON.parse(raw) } : { ...SEED_ISSUERS };
  } catch { return { ...SEED_ISSUERS }; }
}

function saveIssuers(issuers: Record<string, string>) {
  localStorage.setItem(ISSUER_KEY, JSON.stringify(issuers));
}

// ── Mock contract API ──────────────────────────────────────────────────────────
export const mockRegistry = {
  isIssuer(address: string): boolean {
    const issuers = loadIssuers();
    return address.toLowerCase() in
      Object.fromEntries(Object.keys(issuers).map((k) => [k.toLowerCase(), issuers[k]]));
  },

  getIssuerName(address: string): string {
    const issuers = loadIssuers();
    return (
      Object.entries(issuers).find(([k]) => k.toLowerCase() === address.toLowerCase())?.[1] ?? ""
    );
  },

  issueCertificate(
    certHash: string,
    ipfsCid: string,
    issuerAddress: string
  ): void {
    const certs = loadCerts();
    if (certs[certHash]) throw new Error("CertificateAlreadyExists");
    const issuers = loadIssuers();
    const issuerName =
      Object.entries(issuers).find(([k]) => k.toLowerCase() === issuerAddress.toLowerCase())?.[1] ??
      "Unknown Issuer";
    certs[certHash] = {
      certHash,
      issuer:     issuerAddress,
      issuerName,
      ipfsCid,
      issuedAt:   Math.floor(Date.now() / 1000),
      revoked:    false,
      revokedAt:  0,
    };
    saveCerts(certs);
  },

  revokeCertificate(certHash: string, callerAddress: string): void {
    const certs = loadCerts();
    const cert  = certs[certHash];
    if (!cert) throw new Error("CertificateNotFound");
    if (cert.issuer.toLowerCase() !== callerAddress.toLowerCase())
      throw new Error("NotTheCertificateIssuer");
    if (cert.revoked) throw new Error("CertificateAlreadyRevoked");
    cert.revoked   = true;
    cert.revokedAt = Math.floor(Date.now() / 1000);
    saveCerts(certs);
  },

  verifyCertificate(certHash: string): MockCertificate | null {
    const certs = loadCerts();
    return certs[certHash] ?? null;
  },

  getIssuerCertificates(issuerAddress: string): MockCertificate[] {
    const certs = loadCerts();
    return Object.values(certs).filter(
      (c) => c.issuer.toLowerCase() === issuerAddress.toLowerCase()
    );
  },

  addIssuer(address: string, name: string): void {
    const issuers = loadIssuers();
    issuers[address] = name;
    saveIssuers(issuers);
  },

  removeIssuer(address: string): void {
    const issuers = loadIssuers();
    const key = Object.keys(issuers).find((k) => k.toLowerCase() === address.toLowerCase());
    if (key) { delete issuers[key]; saveIssuers(issuers); }
  },

  getAllIssuers(): Array<{ address: string; name: string }> {
    const issuers = loadIssuers();
    return Object.entries(issuers).map(([address, name]) => ({ address, name }));
  },

  getTotalCertificates(): number {
    return Object.keys(loadCerts()).length;
  },

  getTotalIssuers(): number {
    return Object.keys(loadIssuers()).length;
  },

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ISSUER_KEY);
  },
};
