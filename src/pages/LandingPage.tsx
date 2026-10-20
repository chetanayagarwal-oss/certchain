import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Shield, ArrowRight, CheckCircle2, Zap, Building2, Globe,
  Upload, Hash, Award, TrendingUp, Lock, Clock
} from "lucide-react";
import { useContract } from "../hooks/useContract";

export default function LandingPage() {
  const { getStats } = useContract();
  const [stats, setStats] = useState({ totalCerts: 0, totalIssuers: 0 });

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  const features = [
    { icon: <Lock size={22} />, title: "Tamper-Proof", desc: "SHA-256 hash stored on-chain — any modification changes the hash, instantly exposing fakes." },
    { icon: <Clock size={22} />, title: "5-Second Verify", desc: "Drag and drop any PDF to verify. No accounts, no phone calls, no waiting." },
    { icon: <Globe size={22} />, title: "Open & Public", desc: "Built on Polygon — anyone can verify, forever. The blockchain is the source of truth." },
    { icon: <Building2 size={22} />, title: "Institute-Controlled", desc: "Only whitelisted institutes can issue certificates. Issuers can revoke anytime." },
  ];

  const steps = [
    {
      num: "01", icon: <Award size={28} />, title: "Institute Issues",
      desc: "A verified institute fills in student details. CertChain generates a professional PDF certificate with a unique ID.",
    },
    {
      num: "02", icon: <Hash size={28} />, title: "Hash Stored On-Chain",
      desc: "The SHA-256 hash of the PDF is computed locally and stored on the Polygon blockchain via a smart contract. IPFS stores the PDF.",
    },
    {
      num: "03", icon: <CheckCircle2 size={28} />, title: "Anyone Verifies",
      desc: "Drop the PDF on the Verify page. The hash is recomputed and checked against the blockchain. Valid, Revoked, or Tampered in seconds.",
    },
  ];

  return (
    <div className="landing">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-chip">
            <Shield size={14} />
            <span>Powered by Polygon Blockchain</span>
          </div>
          <h1 className="hero-title">
            Verify any certificate<br />
            <span className="gradient-text">in 5 seconds.</span>
          </h1>
          <p className="hero-subtitle">
            No phone calls. No emails. No forgery.
            <br />
            CertChain lets verified institutes issue tamper-proof credentials stored cryptographically on-chain.
          </p>
          <div className="hero-actions">
            <Link to="/verify" className="btn-hero-primary">
              <CheckCircle2 size={18} />
              Verify a Certificate
              <ArrowRight size={18} />
            </Link>
            <Link to="/issuer" className="btn-hero-secondary">
              <Upload size={18} />
              Issue Certificates
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="stat-num">{stats.totalCerts.toLocaleString()}</span>
              <span className="stat-label">Certificates Issued</span>
            </div>
            <div className="stat-divider" />
            <div className="hero-stat">
              <span className="stat-num">{stats.totalIssuers}</span>
              <span className="stat-label">Verified Institutes</span>
            </div>
            <div className="stat-divider" />
            <div className="hero-stat">
              <span className="stat-num">100%</span>
              <span className="stat-label">Tamper Detection</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <CertCard />
        </div>
      </section>

      {/* ── How it Works ─────────────────────────────────────── */}
      <section className="section">
        <div className="section-header">
          <div className="chip">Simple Process</div>
          <h2>How CertChain Works</h2>
          <p>Three steps. One immutable record. Infinite trust.</p>
        </div>
        <div className="steps-grid">
          {steps.map((s, i) => (
            <div key={i} className="step-card">
              <div className="step-num">{s.num}</div>
              <div className="step-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
              {i < steps.length - 1 && <div className="step-arrow"><ArrowRight size={20} /></div>}
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────── */}
      <section className="section features-section">
        <div className="section-header">
          <div className="chip">Why CertChain</div>
          <h2>Built for Trust</h2>
          <p>Every design decision prioritises security, openness, and privacy.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div key={i} className="feature-card">
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="cta-content">
          <Zap size={36} className="cta-icon" />
          <h2>Ready to verify?</h2>
          <p>It's free, instant, and requires no account.</p>
          <Link to="/verify" className="btn-hero-primary">
            <CheckCircle2 size={18} /> Start Verifying <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

// Floating certificate card decoration
function CertCard() {
  return (
    <div className="cert-preview-card">
      <div className="cert-preview-header">
        <div className="cert-preview-logo">
          <Shield size={14} />
          <span>CertChain</span>
        </div>
        <span className="cert-badge valid">✓ Verified</span>
      </div>
      <div className="cert-preview-body">
        <p className="cert-preview-label">Certificate of Achievement</p>
        <p className="cert-preview-name">Alexandra Johnson</p>
        <p className="cert-preview-course">BSc Computer Science</p>
        <p className="cert-preview-inst">MIT · Class of 2024</p>
      </div>
      <div className="cert-preview-footer">
        <div className="cert-hash-row">
          <Hash size={12} />
          <code>0x1a2b3c…f9e8d7</code>
        </div>
        <div className="cert-chain-badge">
          <TrendingUp size={12} /> On-chain
        </div>
      </div>
    </div>
  );
}
