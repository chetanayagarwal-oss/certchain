import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Menu, X, Zap, FlaskConical } from "lucide-react";
import { useWallet } from "../context/WalletContext";
import { useDemoMode } from "../context/DemoContext";
import { shortAddress } from "../utils/hash";

export default function Navbar() {
  const { address, isConnected, connect, disconnect } = useWallet();
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();

  const links = [
    { to: "/", label: "Home" },
    { to: "/verify", label: "Verify" },
    { to: "/issuer", label: "Issue" },
    { to: "/admin", label: "Admin" },
  ];

  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <div className="logo-icon">
            <Shield size={20} />
          </div>
          <span className="logo-text">CertChain</span>
        </Link>

        {/* Desktop links */}
        <div className="navbar-links">
          {links.map((l) => (
            <Link key={l.to} to={l.to} className={`nav-link ${isActive(l.to) ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="navbar-actions">
          {/* Demo toggle */}
          <button
            onClick={toggleDemoMode}
            className={`demo-toggle ${isDemoMode ? "demo-on" : ""}`}
            title="Toggle Demo Mode"
          >
            <FlaskConical size={14} />
            <span>{isDemoMode ? "Demo ON" : "Demo"}</span>
          </button>

          {/* Wallet */}
          {isConnected ? (
            <button onClick={disconnect} className="btn-wallet connected">
              <div className="wallet-dot" />
              {shortAddress(address!)}
            </button>
          ) : (
            <button onClick={connect} className="btn-wallet">
              <Zap size={14} />
              Connect Wallet
            </button>
          )}

          {/* Mobile menu toggle */}
          <button className="mobile-menu-btn" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="mobile-menu">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`mobile-nav-link ${isActive(l.to) ? "active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
