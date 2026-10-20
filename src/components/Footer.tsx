import React from "react";
import { Shield, Github, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <Shield size={18} />
            <span>CertChain</span>
          </div>
          <p className="footer-tagline">
            Verify any certificate in 5 seconds. No phone calls. No emails. No forgery.
          </p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Platform</h4>
            <Link to="/verify">Verify Certificate</Link>
            <Link to="/issuer">Issue Certificate</Link>
            <Link to="/admin">Admin Panel</Link>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="https://amoy.polygonscan.com" target="_blank" rel="noopener noreferrer">
              Block Explorer <ExternalLink size={11} />
            </a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub <ExternalLink size={11} />
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2024 CertChain — Built for Web3 Hackathon 2024</span>
        <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="footer-github">
          <Github size={16} />
        </a>
      </div>
    </footer>
  );
}
