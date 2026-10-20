import React, { useState, useEffect, useRef } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2, ExternalLink, Download,
  AlertTriangle, AlertCircle, User, BookOpen, Award, Calendar,
  Image, ChevronDown, ChevronUp, Trash2, Search, RefreshCw, Share2
} from "lucide-react";
import toast from "react-hot-toast";
import Papa from "papaparse";
import { useWallet, TARGET_CHAIN_ID } from "../context/WalletContext";
import { useDemoMode } from "../context/DemoContext";
import { useContract } from "../hooks/useContract";
import { generateCertificatePDF, downloadPDF, generateCertId } from "../utils/pdf";
import type { CertificateData } from "../utils/pdf";
import { hashUint8Array } from "../utils/hash";
import { uploadToIPFS } from "../utils/ipfs";
import { shortAddress } from "../utils/hash";
import { QRCodeSVG as QRCode } from "qrcode.react";

type IssueStep = "idle" | "generating" | "uploading" | "confirming" | "done" | "error";

interface IssuedCert {
  hash: string;
  studentName: string;
  course: string;
  issuedAt: number;
  txHash?: string;
  ipfsCid?: string;
  revoked: boolean;
}

const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://amoy.polygonscan.com";

export default function IssuerPage() {
  const { address, isConnected, chainId, connect, switchNetwork } = useWallet();
  const { isDemoMode, demoAddress }                                = useDemoMode();
  const { checkIsIssuer, issueCertificate, revokeCertificate, getIssuerCertificates, verifyCertificate } = useContract();

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [step, setStep]                 = useState<IssueStep>("idle");
  const [stepMsg, setStepMsg]           = useState("");
  const [successData, setSuccessData]   = useState<{ hash: string; txHash?: string; ipfsCid?: string; pdfBytes?: Uint8Array; certId: string } | null>(null);
  const [myCerts, setMyCerts]           = useState<IssuedCert[]>([]);
  const [loadingCerts, setLoadingCerts] = useState(false);
  const [search, setSearch]             = useState("");
  const [showRevoke, setShowRevoke]     = useState<string | null>(null);
  const [revoking, setRevoking]         = useState(false);
  const [logoDataUrl, setLogoDataUrl]   = useState<string | undefined>();
  const [bulkFile, setBulkFile]         = useState<File | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const logoRef  = useRef<HTMLInputElement>(null);
  const bulkRef  = useRef<HTMLInputElement>(null);

  const effectiveAddress = isDemoMode ? demoAddress : address;

  // Form state
  const [form, setForm] = useState<Omit<CertificateData, "certId" | "hash">>({
    studentName: "", studentId: "", course: "", instituteName: "", grade: "", issueDate: new Date().toISOString().slice(0, 10),
  });
  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Check if wallet is authorized issuer
  useEffect(() => {
    if (!effectiveAddress) { setIsAuthorized(null); return; }
    checkIsIssuer(effectiveAddress)
      .then(setIsAuthorized)
      .catch(() => setIsAuthorized(false));
  }, [effectiveAddress]);

  // Load my issued certs
  useEffect(() => {
    if (!effectiveAddress || !isAuthorized) return;
    loadMyCerts();
  }, [effectiveAddress, isAuthorized]);

  const loadMyCerts = async () => {
    if (!effectiveAddress) return;
    setLoadingCerts(true);
    try {
      const hashes = await getIssuerCertificates(effectiveAddress);
      const certs  = await Promise.all(
        hashes.map(async (h) => {
          const r = await verifyCertificate(h);
          return {
            hash: h, studentName: "", course: "", issuedAt: r.issuedAt,
            revoked: r.revoked, ipfsCid: r.ipfsCid,
          } as IssuedCert;
        })
      );
      setMyCerts(certs.sort((a, b) => b.issuedAt - a.issuedAt));
    } catch (e) { toast.error("Failed to load certificates."); }
    finally { setLoadingCerts(false); }
  };

  // Logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setLogoDataUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Issue single certificate
  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.studentName || !form.course || !form.instituteName) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setStep("generating"); setStepMsg("Generating certificate PDF…"); setSuccessData(null);
    try {
      const certId  = generateCertId();
      const certData: CertificateData = { ...form, certId, logoDataUrl };

      // 1. Generate PDF (first pass — no hash yet)
      setStep("generating");
      const pdfBytes = await generateCertificatePDF(certData);

      // 2. Hash
      const hash = await hashUint8Array(pdfBytes);

      // 3. Upload to IPFS
      setStep("uploading"); setStepMsg("Uploading PDF to IPFS…");
      let ipfsCid = "";
      try {
        const up = await uploadToIPFS(pdfBytes, `cert-${certId}.pdf`, { studentId: form.studentId, certId });
        ipfsCid = up.cid;
        if (up.mock) toast("IPFS keys not set — using mock CID (demo).", { icon: "ℹ️" });
      } catch (err) {
        toast.error("IPFS upload failed — continuing without IPFS link.");
      }

      // 4. On-chain
      setStep("confirming"); setStepMsg("Confirming transaction on blockchain…");
      const receipt = await issueCertificate(hash, ipfsCid);

      setStep("done");
      setSuccessData({ hash, txHash: (receipt as { hash?: string } | null)?.hash, ipfsCid, pdfBytes, certId });
      toast.success("Certificate issued successfully!");
      loadMyCerts();
    } catch (err: unknown) {
      setStep("error");
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("AlreadyExists")) toast.error("This certificate already exists on-chain.");
      else if (msg.includes("rejected")) toast.error("Transaction rejected by user.");
      else toast.error("Error: " + msg);
    }
  };

  // Revoke
  const handleRevoke = async (hash: string) => {
    setRevoking(true);
    try {
      await revokeCertificate(hash);
      toast.success("Certificate revoked.");
      setShowRevoke(null);
      loadMyCerts();
    } catch (err: unknown) {
      toast.error("Revoke failed: " + (err instanceof Error ? err.message : String(err)));
    } finally { setRevoking(false); }
  };

  // Bulk issue from CSV
  const handleBulk = async () => {
    if (!bulkFile) return;
    Papa.parse<Record<string, string>>(bulkFile, {
      header: true, skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        setBulkProgress({ done: 0, total: rows.length });
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          try {
            const certData: CertificateData = {
              certId: generateCertId(),
              studentName: row["studentName"] || row["name"] || "Unknown",
              studentId:   row["studentId"]   || row["id"]   || "",
              course:      row["course"]       || "",
              instituteName: form.instituteName || row["institute"] || "",
              grade:       row["grade"]        || "",
              issueDate:   row["issueDate"]    || new Date().toISOString().slice(0, 10),
            };
            const pdfBytes = await generateCertificatePDF(certData);
            const hash     = await hashUint8Array(pdfBytes);
            let   cid      = "";
            try { const up = await uploadToIPFS(pdfBytes, `cert-${certData.certId}.pdf`); cid = up.cid; } catch (_) {}
            await issueCertificate(hash, cid);
          } catch (err) {
            console.error("Bulk row", i, err);
          }
          setBulkProgress({ done: i + 1, total: rows.length });
          await sleep(500);
        }
        toast.success(`Bulk issue complete: ${rows.length} certificates.`);
        setBulkProgress(null);
        setBulkFile(null);
        loadMyCerts();
      },
    });
  };

  const wrongNetwork = !isDemoMode && isConnected && chainId !== TARGET_CHAIN_ID;

  // ── Not connected ───────────────────────────────────────────────────────────
  if (!isDemoMode && !isConnected) {
    return (
      <div className="page-container center-page">
        <div className="not-connected-card">
          <AlertCircle size={48} className="nc-icon" />
          <h2>Connect Your Wallet</h2>
          <p>You need MetaMask to access the Issuer Dashboard.</p>
          <button className="btn-primary" onClick={connect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  // ── Wrong network ───────────────────────────────────────────────────────────
  if (wrongNetwork) {
    return (
      <div className="page-container center-page">
        <div className="not-connected-card">
          <AlertTriangle size={48} className="nc-icon warning" />
          <h2>Wrong Network</h2>
          <p>Please switch to the correct network (Chain ID: {TARGET_CHAIN_ID}).</p>
          <button className="btn-primary" onClick={() => switchNetwork(TARGET_CHAIN_ID)}>Switch Network</button>
        </div>
      </div>
    );
  }

  // ── Not an issuer ───────────────────────────────────────────────────────────
  if (isAuthorized === false) {
    return (
      <div className="page-container center-page">
        <div className="not-connected-card">
          <AlertTriangle size={48} className="nc-icon warning" />
          <h2>Not an Authorized Issuer</h2>
          <p>Your wallet ({shortAddress(effectiveAddress!)}) is not whitelisted as an issuer.</p>
          <p className="hint-text">Contact the platform admin to get whitelisted.</p>
          <a href="mailto:admin@certchain.xyz" className="btn-outline">Request Access</a>
        </div>
      </div>
    );
  }

  if (isAuthorized === null) {
    return (
      <div className="page-container center-page">
        <Loader2 size={40} className="spin" />
        <p style={{ marginTop: "1rem", color: "var(--muted)" }}>Checking authorization…</p>
      </div>
    );
  }

  const filteredCerts = myCerts.filter((c) =>
    c.hash.includes(search) || c.studentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Issuer Dashboard</h1>
        <p className="page-sub">
          Logged in as <code>{shortAddress(effectiveAddress!)}</code>
          {isDemoMode && <span className="demo-chip">Demo</span>}
        </p>
      </div>

      {/* ── Issue Form ─────────────────────────────────────── */}
      {step === "idle" || step === "error" ? (
        <div className="issue-grid">
          <div className="issue-form-card">
            <h2 className="card-title"><Award size={20} /> Issue New Certificate</h2>
            <div className="privacy-note">
              🔒 <strong>Privacy:</strong> Only a cryptographic hash is stored on-chain. Personal data stays off-chain.
            </div>
            <form onSubmit={handleIssue} className="issue-form">
              <div className="form-row">
                <FormField label="Student Name *" icon={<User size={16}/>} value={form.studentName} onChange={setField("studentName")} placeholder="e.g. Alexandra Johnson" />
                <FormField label="Student ID / Email *" icon={<FileText size={16}/>} value={form.studentId} onChange={setField("studentId")} placeholder="e.g. STU-2024-001" />
              </div>
              <div className="form-row">
                <FormField label="Course / Degree *" icon={<BookOpen size={16}/>} value={form.course} onChange={setField("course")} placeholder="e.g. BSc Computer Science" />
                <FormField label="Institute Name *" icon={<Award size={16}/>} value={form.instituteName} onChange={setField("instituteName")} placeholder="e.g. MIT" />
              </div>
              <div className="form-row">
                <FormField label="Grade / Score" icon={<Award size={16}/>} value={form.grade} onChange={setField("grade")} placeholder="e.g. First Class / 3.9 GPA" />
                <FormField label="Issue Date" icon={<Calendar size={16}/>} type="date" value={form.issueDate} onChange={setField("issueDate")} />
              </div>

              {/* Logo upload */}
              <div className="form-group">
                <label className="form-label"><Image size={16}/> Institute Logo (optional)</label>
                <div className="logo-upload" onClick={() => logoRef.current?.click()}>
                  {logoDataUrl
                    ? <img src={logoDataUrl} alt="logo" className="logo-preview" />
                    : <><Upload size={20}/><span>Click to upload logo (PNG/JPG)</span></>}
                </div>
                <input ref={logoRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </div>

              <button type="submit" className="btn-primary btn-full">
                <Award size={18} /> Issue Certificate
              </button>
            </form>
          </div>

          {/* Bulk issue */}
          <div className="bulk-card">
            <h2 className="card-title"><Upload size={20}/> Bulk Issue from CSV</h2>
            <p className="bulk-hint">Upload a CSV with columns: <code>studentName, studentId, course, grade, issueDate</code></p>
            <div
              className="drop-zone small"
              onClick={() => bulkRef.current?.click()}
            >
              <input ref={bulkRef} type="file" accept=".csv" hidden onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} />
              {bulkFile
                ? <><FileText size={24}/><span>{bulkFile.name}</span></>
                : <><Upload size={24}/><span>Drop CSV here</span></>}
            </div>
            {bulkProgress && (
              <div className="bulk-progress">
                <div className="bulk-bar" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }} />
                <span>{bulkProgress.done} / {bulkProgress.total} issued</span>
              </div>
            )}
            <button
              className="btn-outline btn-full"
              disabled={!bulkFile || !!bulkProgress}
              onClick={handleBulk}
            >
              {bulkProgress ? <Loader2 size={16} className="spin"/> : <Upload size={16}/>}
              {bulkProgress ? "Issuing…" : "Start Bulk Issue"}
            </button>
          </div>
        </div>
      ) : step === "done" && successData ? (
        <SuccessCard
          data={successData}
          onReset={() => { setStep("idle"); setSuccessData(null); }}
        />
      ) : (
        <StepProgress step={step} msg={stepMsg} />
      )}

      {/* ── My Certificates ────────────────────────────────── */}
      <div className="my-certs-section">
        <div className="my-certs-header">
          <h2><FileText size={20}/> My Issued Certificates</h2>
          <div className="certs-actions">
            <div className="search-box">
              <Search size={16}/>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by hash…" />
            </div>
            <button className="btn-ghost" onClick={loadMyCerts}><RefreshCw size={16}/></button>
          </div>
        </div>

        {loadingCerts ? (
          <div className="loading-certs"><Loader2 size={32} className="spin"/></div>
        ) : filteredCerts.length === 0 ? (
          <div className="empty-state">
            <Award size={40}/>
            <p>No certificates issued yet.</p>
          </div>
        ) : (
          <div className="certs-table-wrap">
            <table className="certs-table">
              <thead>
                <tr><th>Hash</th><th>Issued</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredCerts.map((cert) => (
                  <React.Fragment key={cert.hash}>
                    <tr>
                      <td><code className="hash-cell">{cert.hash.slice(0, 14)}…</code></td>
                      <td>{new Date(cert.issuedAt * 1000).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge ${cert.revoked ? "revoked" : "valid"}`}>
                          {cert.revoked ? "Revoked" : "Valid"}
                        </span>
                      </td>
                      <td>
                        <div className="cert-actions">
                          <a href={`/verify?hash=${cert.hash}`} className="icon-btn" title="Verify"><Share2 size={15}/></a>
                          {!cert.revoked && (
                            <button
                              className="icon-btn danger"
                              title="Revoke"
                              onClick={() => setShowRevoke(showRevoke === cert.hash ? null : cert.hash)}
                            >
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {showRevoke === cert.hash && (
                      <tr className="revoke-row">
                        <td colSpan={4}>
                          <div className="revoke-confirm">
                            <AlertTriangle size={16}/>
                            <span>This will permanently revoke this certificate. Are you sure?</span>
                            <button
                              className="btn-danger"
                              disabled={revoking}
                              onClick={() => handleRevoke(cert.hash)}
                            >
                              {revoking ? <Loader2 size={14} className="spin"/> : <Trash2 size={14}/>} Yes, Revoke
                            </button>
                            <button className="btn-ghost" onClick={() => setShowRevoke(null)}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FormField({ label, icon, value, onChange, placeholder, type = "text" }: {
  label: string; icon: React.ReactNode; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="form-group">
      <label className="form-label">{icon} {label}</label>
      <input className="form-input" type={type} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

function StepProgress({ step, msg }: { step: IssueStep; msg: string }) {
  const steps: { key: IssueStep; label: string }[] = [
    { key: "generating", label: "Generating PDF" },
    { key: "uploading",  label: "Uploading to IPFS" },
    { key: "confirming", label: "Confirming on-chain" },
    { key: "done",       label: "Done!" },
  ];
  const currentIdx = steps.findIndex((s) => s.key === step);
  return (
    <div className="step-progress-card">
      <Loader2 size={48} className="spin progress-icon"/>
      <h2>{msg || "Processing…"}</h2>
      <div className="step-track">
        {steps.map((s, i) => (
          <div key={s.key} className={`step-dot-wrap ${i <= currentIdx ? "done" : ""}`}>
            <div className="step-dot">{i < currentIdx ? <CheckCircle2 size={14}/> : i + 1}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuccessCard({ data, onReset }: {
  data: { hash: string; txHash?: string; ipfsCid?: string; pdfBytes?: Uint8Array; certId: string };
  onReset: () => void;
}) {
  const shareUrl = `${window.location.origin}/verify?hash=${data.hash}`;
  const EXPLORER_BASE = import.meta.env.VITE_EXPLORER_URL || "https://amoy.polygonscan.com";
  return (
    <div className="success-card">
      <CheckCircle2 size={56} className="success-icon"/>
      <h2>Certificate Issued! 🎉</h2>
      <p>The certificate hash is now permanently recorded on the blockchain.</p>
      <div className="success-details">
        <div className="sd-row"><span>Hash</span><code>{data.hash.slice(0, 20)}…</code></div>
        <div className="sd-row"><span>Cert ID</span><code>{data.certId}</code></div>
        {data.txHash && (
          <div className="sd-row">
            <span>TX</span>
            <a href={`${EXPLORER_BASE}/tx/${data.txHash}`} target="_blank" rel="noopener noreferrer">
              {data.txHash.slice(0, 16)}… <ExternalLink size={12}/>
            </a>
          </div>
        )}
      </div>
      <div className="success-qr">
        <QRCode value={shareUrl} size={120} level="H" />
        <p className="qr-label">Verification QR Code</p>
      </div>
      <div className="success-actions">
        {data.pdfBytes && (
          <button className="btn-primary" onClick={() => downloadPDF(data.pdfBytes!, `cert-${data.certId}.pdf`)}>
            <Download size={16}/> Download PDF
          </button>
        )}
        <button className="btn-outline" onClick={() => { navigator.clipboard.writeText(shareUrl); toast.success("Link copied!"); }}>
          <Share2 size={16}/> Copy Share Link
        </button>
        <button className="btn-ghost" onClick={onReset}><Award size={16}/> Issue Another</button>
      </div>
    </div>
  );
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
