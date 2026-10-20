import React, { useState, useEffect } from "react";
import { Settings, UserPlus, UserMinus, Loader2, AlertCircle, AlertTriangle, RefreshCw, CheckCircle2, Shield } from "lucide-react";
import toast from "react-hot-toast";
import { useWallet } from "../context/WalletContext";
import { useDemoMode } from "../context/DemoContext";
import { useContract } from "../hooks/useContract";
import { shortAddress } from "../utils/hash";

export default function AdminPage() {
  const { address, isConnected, connect } = useWallet();
  const { isDemoMode, demoAddress }       = useDemoMode();
  const { getOwner, getAllIssuers, addIssuer, removeIssuer } = useContract();

  const effectiveAddress = isDemoMode ? demoAddress : address;
  const [owner, setOwner]           = useState<string | null>(null);
  const [issuers, setIssuers]       = useState<Array<{ address: string; name: string }>>([]);
  const [loading, setLoading]       = useState(true);
  const [newAddr, setNewAddr]       = useState("");
  const [newName, setNewName]       = useState("");
  const [adding, setAdding]         = useState(false);
  const [removing, setRemoving]     = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const isOwner = owner && effectiveAddress &&
    owner.toLowerCase() === effectiveAddress.toLowerCase();

  useEffect(() => {
    loadData();
  }, [effectiveAddress]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [o, list] = await Promise.all([getOwner(), getAllIssuers()]);
      setOwner(o);
      setIssuers(list);
    } catch (e) {
      toast.error("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddr.startsWith("0x") || newAddr.length < 10) {
      toast.error("Enter a valid Ethereum address.");
      return;
    }
    if (!newName.trim()) { toast.error("Enter an institute name."); return; }
    setAdding(true);
    try {
      await addIssuer(newAddr, newName);
      toast.success(`${newName} added as issuer.`);
      setNewAddr(""); setNewName("");
      await loadData();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("AlreadyAnIssuer")) toast.error("This address is already an issuer.");
      else toast.error("Failed: " + msg);
    } finally { setAdding(false); }
  };

  const handleRemove = async (addr: string) => {
    setRemoving(addr);
    try {
      await removeIssuer(addr);
      toast.success("Issuer removed.");
      setConfirmRemove(null);
      await loadData();
    } catch (e: unknown) {
      toast.error("Failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setRemoving(null); }
  };

  if (!isDemoMode && !isConnected) {
    return (
      <div className="page-container center-page">
        <div className="not-connected-card">
          <AlertCircle size={48} className="nc-icon"/>
          <h2>Connect Wallet</h2>
          <p>You must be the contract owner to access the admin panel.</p>
          <button className="btn-primary" onClick={connect}>Connect Wallet</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container center-page">
        <Loader2 size={40} className="spin"/>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="page-container center-page">
        <div className="not-connected-card">
          <AlertTriangle size={48} className="nc-icon warning"/>
          <h2>Access Denied</h2>
          <p>Only the contract owner can access the admin panel.</p>
          <p className="hint-text">Connected: {effectiveAddress ? shortAddress(effectiveAddress) : "—"}</p>
          <p className="hint-text">Owner: {owner ? shortAddress(owner) : "—"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Settings size={28} className="page-icon" />
          <h1>Admin Panel</h1>
        </div>
        <p className="page-sub">
          Contract Owner: <code>{shortAddress(owner!)}</code>
          {isDemoMode && <span className="demo-chip">Demo</span>}
        </p>
      </div>

      <div className="admin-grid">
        {/* Add Issuer */}
        <div className="admin-card">
          <h2 className="card-title"><UserPlus size={20}/> Add Verified Issuer</h2>
          <form onSubmit={handleAdd} className="add-issuer-form">
            <div className="form-group">
              <label className="form-label">Wallet Address</label>
              <input
                className="form-input"
                value={newAddr}
                onChange={(e) => setNewAddr(e.target.value)}
                placeholder="0x…"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Institute Name</label>
              <input
                className="form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. MIT"
              />
            </div>
            <button type="submit" className="btn-primary btn-full" disabled={adding}>
              {adding ? <Loader2 size={16} className="spin"/> : <UserPlus size={16}/>}
              {adding ? "Adding…" : "Add Issuer"}
            </button>
          </form>
        </div>

        {/* Issuers list */}
        <div className="admin-card issuers-card">
          <div className="card-header-row">
            <h2 className="card-title"><Shield size={20}/> Verified Issuers ({issuers.length})</h2>
            <button className="btn-ghost" onClick={loadData}><RefreshCw size={16}/></button>
          </div>

          {issuers.length === 0 ? (
            <div className="empty-state small">
              <Shield size={32}/>
              <p>No issuers added yet.</p>
            </div>
          ) : (
            <div className="issuers-list">
              {issuers.map((issuer) => (
                <div key={issuer.address} className="issuer-row">
                  <div className="issuer-info">
                    <span className="issuer-name">{issuer.name}</span>
                    <code className="issuer-addr">{shortAddress(issuer.address)}</code>
                  </div>
                  <div className="issuer-status">
                    <span className="status-badge valid"><CheckCircle2 size={12}/> Active</span>
                    {confirmRemove !== issuer.address ? (
                      <button
                        className="icon-btn danger"
                        onClick={() => setConfirmRemove(issuer.address)}
                        title="Remove Issuer"
                      >
                        <UserMinus size={16}/>
                      </button>
                    ) : (
                      <div className="confirm-row">
                        <button
                          className="btn-danger small"
                          disabled={removing === issuer.address}
                          onClick={() => handleRemove(issuer.address)}
                        >
                          {removing === issuer.address ? <Loader2 size={12} className="spin"/> : "Confirm"}
                        </button>
                        <button className="btn-ghost small" onClick={() => setConfirmRemove(null)}>Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
