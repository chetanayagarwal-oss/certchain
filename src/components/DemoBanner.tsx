import React from "react";
import { useDemoMode } from "../context/DemoContext";
import { FlaskConical, X } from "lucide-react";

export default function DemoBanner() {
  const { isDemoMode, toggleDemoMode } = useDemoMode();
  if (!isDemoMode) return null;

  return (
    <div className="demo-banner">
      <FlaskConical size={16} />
      <span>
        <strong>Demo Mode Active</strong> — Using in-memory mock registry. No wallet or testnet
        funds required. All certificates are stored locally.
      </span>
      <button onClick={toggleDemoMode} className="demo-banner-close">
        <X size={14} />
      </button>
    </div>
  );
}
