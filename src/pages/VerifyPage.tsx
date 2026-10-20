import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Upload, Search, Camera, CheckCircle2, XCircle, AlertTriangle,
  Copy, ExternalLink, Shield, RefreshCw, Hash, Loader2, X
} from "lucide-react";
import { hashFile } from "../utils/hash";
import { useContract } from "../hooks/useContract";
import type { VerifyResult } from "../hooks/useContract";
import { ipfsUrl, shortAddress } from "../utils/hash";
import toast from "react-hot-toast";

type TabType = "upload" | "hash" | "camera";
type ResultState = "idle" | "loading" | "valid" | "revoked" | "tampered";

const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://amoy.polygonscan.com";

function shortAddress2(addr: string) {
  if (!addr || addr.startsWith("0xDEMO")) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const { verifyCertificate } = useContract();

  const [tab, setTab]                 = useState<TabType>("upload");
  const [dragging, setDragging]       = useState(false);
  const [hashInput, setHashInput]     = useState("");
  const [resultState, setResultState] = useState<ResultState>("idle");
  const [result, setResult]           = useState<VerifyResult | null>(null);
  const [currentHash, setCurrentHash] = useState<string>("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError]   = useState<string | null>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrRef = useRef<unknown>(null);

  // Auto-verify from URL param
  useEffect(() => {
    const h = searchParams.get("hash");
    if (h) { setHashInput(h); verify(h); }
  }, []);

  const verify = useCallback(async (hash: string) => {
    if (!hash.startsWith("0x") || hash.length !== 66) {
      toast.error("Invalid hash format. Expected 0x + 64 hex chars.");
      return;
    }
    setResultState("loading");
    setResult(null);
    try {
      const r = await verifyCertificate(hash);
      setCurrentHash(hash);
      if (!r.exists)  setResultState("tampered");
      else if (r.revoked) setResultState("revoked");
      else setResultState("valid");
      setResult(r);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Verification failed: " + (e instanceof Error ? e.message : String(e)));
      setResultState("idle");
    }
  }, [verifyCertificate]);

  const handleFileDrop = useCallback(async (file: File) => {
    if (file.type !== "application/pdf") { toast.error("Please upload a PDF file."); return; }
    toast.loading("Hashing PDF…", { id: "hash" });
    try {
      const hash = await hashFile(file);
      toast.success("PDF hashed", { id: "hash" });
      setHashInput(hash);
      setTab("hash");
      await verify(hash);
    } catch (e) {
      toast.error("Failed to read file.", { id: "hash" });
    }
  }, [verify]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileDrop(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileDrop(file);
  };

  // QR camera scanner
  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      await new Promise<void>((res) => setTimeout(res, 100));
      if (!scannerRef.current) return;
      const scanner = new Html5Qrcode("qr-scanner-container");
      html5QrRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (text: string) => {
          const hashMatch = text.match(/hash=(0x[a-fA-F0-9]{64})/);
          if (hashMatch) {
            stopCamera();
            setHashInput(hashMatch[1]);
            setTab("hash");
            verify(hashMatch[1]);
          } else {
            toast.error("QR code doesn't contain a valid certificate hash.");
          }
        },
        undefined
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setCameraError(
        msg.includes("Permission") ? "Camera permission denied." : "Could not start camera: " + msg
      );
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    try {
      if (html5QrRef.current) {
        const s = html5QrRef.current as { stop: () => Promise<void> };
        await s.stop();
        html5QrRef.current = null;
      }
    } catch (_) {}
    setCameraActive(false);
  };

  useEffect(() => () => { stopCamera(); }, []);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  const reset = () => {
    setResultState("idle");
    setResult(null);
    setCurrentHash("");
    setHashInput("");
  };

  return (
    <div className="page-container">
      <div className="verify-hero">
        <div className="chip">Public Verification</div>
        <h1 className="verify-title">Verify a Certificate</h1>
        <p className="verify-subtitle">
          Upload the original PDF, scan the QR code, or paste the hash — no wallet required.
        </p>
      </div>

      {/* Tab bar */}
      <div className="verify-card">
        <div className="tab-bar">
          {([
            { id: "upload", icon: <Upload size={16} />, label: "Upload PDF" },
            { id: "hash",   icon: <Hash   size={16} />, label: "Paste Hash" },
            { id: "camera", icon: <Camera size={16} />, label: "Scan QR" },
          ] as { id: TabType; icon: React.ReactNode; label: string }[]).map((t) => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? "active" : ""}`}
              onClick={() => { setTab(t.id); if (t.id !== "camera") stopCamera(); }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Upload tab */}
        {tab === "upload" && (
          <div
            className={`drop-zone ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handleFileInput} />
            <div className="drop-icon"><Upload size={36} /></div>
            <p className="drop-label">Drop your certificate PDF here</p>
            <p className="drop-hint">or click to browse · Any modification will be detected</p>
          </div>
        )}

        {/* Hash tab */}
        {tab === "hash" && (
          <div className="hash-input-area">
            <div className="hash-field">
              <Hash size={18} className="hash-icon" />
              <input
                type="text"
                className="hash-input"
                placeholder="0x1a2b3c… (64-char SHA-256 hash) or Certificate ID"
                value={hashInput}
                onChange={(e) => setHashInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify(hashInput)}
              />
              {hashInput && (
                <button className="hash-clear" onClick={() => setHashInput("")}>
                  <X size={16} />
                </button>
              )}
            </div>
            <button
              className="btn-primary verify-btn"
              disabled={!hashInput || resultState === "loading"}
              onClick={() => verify(hashInput)}
            >
              {resultState === "loading" ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
              Verify
            </button>
          </div>
        )}

        {/* Camera tab */}
        {tab === "camera" && (
          <div className="camera-area">
            {!cameraActive ? (
              <div className="camera-start">
                <Camera size={48} className="camera-icon" />
                <p>Point your camera at the QR code on the certificate</p>
                {cameraError && <p className="error-text">{cameraError}</p>}
                <button className="btn-primary" onClick={startCamera}>
                  Start Camera
                </button>
              </div>
            ) : (
              <div className="camera-live">
                <div id="qr-scanner-container" ref={scannerRef} className="qr-scanner" />
                <button className="btn-outline" onClick={stopCamera}>
                  <X size={16} /> Stop Camera
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loading */}
      {resultState === "loading" && (
        <div className="result-card loading-card">
          <Loader2 size={48} className="spin result-icon" />
          <h2>Checking Blockchain…</h2>
          <p>Querying the smart contract. This takes just a moment.</p>
        </div>
      )}

      {/* VALID */}
      {resultState === "valid" && result && (
        <div className="result-card valid-card">
          <CheckCircle2 size={56} className="result-icon valid-icon" />
          <h2>Certificate Verified ✅</h2>
          <p className="result-sub">This certificate is authentic and has not been tampered with.</p>
          <div className="result-details">
            <Detail label="Issuer"        value={result.issuerName} />
            <Detail label="Issuer Address" value={shortAddress2(result.issuer)} copy={result.issuer} />
            <Detail label="Issue Date"    value={new Date(result.issuedAt * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
            <Detail label="Certificate Hash" value={currentHash.slice(0, 16) + "…" + currentHash.slice(-8)} copy={currentHash} />
            {result.ipfsCid && (
              <div className="detail-row">
                <span className="detail-label">IPFS PDF</span>
                <a href={ipfsUrl(result.ipfsCid)} target="_blank" rel="noopener noreferrer" className="detail-link">
                  View on IPFS <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
          <div className="result-actions">
            <button className="btn-outline" onClick={() => copy(currentHash)}>
              <Copy size={14} /> Copy Hash
            </button>
            <a href={`/certificate/${encodeURIComponent(currentHash)}`} className="btn-primary">
              <Shield size={14} /> Full Certificate
            </a>
            <button className="btn-ghost" onClick={reset}><RefreshCw size={14} /> Verify Another</button>
          </div>
        </div>
      )}

      {/* REVOKED */}
      {resultState === "revoked" && result && (
        <div className="result-card revoked-card">
          <AlertTriangle size={56} className="result-icon revoked-icon" />
          <h2>Certificate Revoked ⚠️</h2>
          <p className="result-sub">
            This certificate was revoked on{" "}
            {new Date(result.revokedAt * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.
          </p>
          <div className="result-details">
            <Detail label="Issuer"      value={result.issuerName} />
            <Detail label="Issued"      value={new Date(result.issuedAt * 1000).toLocaleDateString()} />
            <Detail label="Revoked"     value={new Date(result.revokedAt * 1000).toLocaleDateString()} />
          </div>
          <button className="btn-ghost mt-4" onClick={reset}><RefreshCw size={14} /> Verify Another</button>
        </div>
      )}

      {/* TAMPERED / NOT FOUND */}
      {resultState === "tampered" && (
        <div className="result-card tampered-card">
          <XCircle size={56} className="result-icon tampered-icon" />
          <h2>Tampered or Not Registered ❌</h2>
          <p className="result-sub">
            This file's hash does not match any certificate registered on the blockchain.
            The file may have been modified or was never issued through CertChain.
          </p>
          <div className="tampered-detail">
            <code>{currentHash.slice(0, 32)}…</code>
            <button className="copy-btn" onClick={() => copy(currentHash)}><Copy size={12} /></button>
          </div>
          <button className="btn-ghost mt-4" onClick={reset}><RefreshCw size={14} /> Try Another</button>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, copy: copyVal }: { label: string; value: string; copy?: string }) {
  const copyFn = () => {
    navigator.clipboard.writeText(copyVal ?? value);
    toast.success("Copied!");
  };
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">
        {value}
        {copyVal && (
          <button className="inline-copy" onClick={copyFn}><Copy size={12} /></button>
        )}
      </span>
    </div>
  );
}
