import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Shield, CheckCircle2, AlertTriangle, XCircle,
  Download, ExternalLink, Copy, Linkedin, Loader2, Share2
} from "lucide-react";
import QRCode from "qrcode.react";
import toast from "react-hot-toast";
import { useContract, VerifyResult } from "../hooks/useContract";
import { shortAddress } from "../utils/hash";
import { ipfsUrl } from "../utils/ipfs";

const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://amoy.polygonscan.com";

export default function CertificatePage() {
  const { hash } = useParams<{ hash: string }>();
  const { verifyCertificate } = useContract();
  const [result, setResult]   = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const shareUrl = `${window.location.origin}/certificate/${encodeURIComponent(hash || "")}`;
  const verifyUrl = `${window.location.origin}/verify?hash=${hash}`;

  useEffect(() => {
    if (!hash) { setError("No certificate hash provided."); setLoading(false); return; }
    verifyCertificate(hash)
      .then((r) => { setResult(r); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [hash]);

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };

  if (loading) return (
    <div className="page-container center-page">
      <Loader2 size={48} className="spin"/>
      <p style={{ marginTop: "1rem", color: "var(--muted)" }}>Loading certificate…</p>
    </div>
  );

  if (error || !result) return (
    <div className="page-container center-page">
      <div className="not-connected-card">
        <XCircle size={48} className="nc-icon danger"/>
        <h2>Certificate Not Found</h2>
        <p>{error || "Could not load certificate data."}</p>
        <Link to="/verify" className="btn-primary">Verify a Certificate</Link>
      </div>
    </div>
  );

  if (!result.exists) return (
    <div className="page-container center-page">
      <div className="result-card tampered-card">
        <XCircle size={56} className="result-icon tampered-icon"/>
        <h2>Not Registered ❌</h2>
        <p>This hash has not been registered on CertChain.</p>
        <Link to="/verify" className="btn-ghost mt-4">← Back to Verify</Link>
      </div>
    </div>
  );

  const statusInfo = result.revoked
    ? { label: "Revoked", className: "revoked", Icon: AlertTriangle }
    : { label: "Verified", className: "valid",   Icon: CheckCircle2 };

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  return (
    <div className="page-container">
      <div className="cert-page-grid">
        {/* Left: Details */}
        <div className="cert-detail-card">
          <div className="cert-status-row">
            <span className={`status-badge large ${statusInfo.className}`}>
              <statusInfo.Icon size={16}/> {statusInfo.label}
            </span>
            <Shield size={20} className="chain-icon"/>
          </div>

          <h1 className="cert-page-title">Certificate Details</h1>

          <div className="cert-detail-fields">
            <CertField label="Issued By"      value={result.issuerName} />
            <CertField label="Issuer Address" value={shortAddress(result.issuer, 6)} copy={result.issuer} />
            <CertField label="Issue Date"     value={new Date(result.issuedAt * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
            {result.revoked && (
              <CertField label="Revoked On" value={new Date(result.revokedAt * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
            )}
            <CertField label="Certificate Hash" value={hash?.slice(0, 20) + "…" + hash?.slice(-8) ?? ""} copy={hash} />
            {result.ipfsCid && (
              <div className="cert-field">
                <span className="cert-field-label">PDF on IPFS</span>
                <a href={ipfsUrl(result.ipfsCid)} target="_blank" rel="noopener noreferrer" className="detail-link">
                  View / Download <ExternalLink size={12}/>
                </a>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="cert-page-actions">
            {result.ipfsCid && (
              <a href={ipfsUrl(result.ipfsCid)} target="_blank" rel="noopener noreferrer" className="btn-primary">
                <Download size={16}/> Download PDF
              </a>
            )}
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" className="btn-linkedin">
              <Linkedin size={16}/> Add to LinkedIn
            </a>
            <button className="btn-outline" onClick={() => copy(shareUrl)}>
              <Share2 size={16}/> Copy Share Link
            </button>
            <a href={`/verify?hash=${hash}`} className="btn-ghost">
              <CheckCircle2 size={16}/> Verify Again
            </a>
          </div>
        </div>

        {/* Right: QR code */}
        <div className="cert-qr-card">
          <h2>Verification QR Code</h2>
          <p>Scan to instantly verify this certificate</p>
          <div className="cert-qr-box">
            <QRCode value={verifyUrl} size={200} level="H" includeMargin />
          </div>
          <button className="btn-outline" onClick={() => copy(verifyUrl)}>
            <Copy size={14}/> Copy Verify Link
          </button>
          <div className="cert-hash-display">
            <span>Hash:</span>
            <code>{hash?.slice(0, 18)}…</code>
            <button className="copy-btn" onClick={() => copy(hash ?? "")}><Copy size={12}/></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CertField({ label, value, copy: copyVal }: { label: string; value: string; copy?: string }) {
  const copyFn = () => { navigator.clipboard.writeText(copyVal ?? value); toast.success("Copied!"); };
  return (
    <div className="cert-field">
      <span className="cert-field-label">{label}</span>
      <span className="cert-field-value">
        {value}
        {copyVal && <button className="inline-copy" onClick={copyFn}><Copy size={12}/></button>}
      </span>
    </div>
  );
}
