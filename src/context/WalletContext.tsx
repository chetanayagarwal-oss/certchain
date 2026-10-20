import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { ethers } from "ethers";

export type WalletState = {
  address: string | null;
  chainId: number | null;
  isConnected: boolean;
  isConnecting: boolean;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchNetwork: (chainId: number) => Promise<void>;
};

const TARGET_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || "31337");

const CHAIN_PARAMS: Record<number, object> = {
  80002: {
    chainId: "0x13882",
    chainName: "Polygon Amoy",
    nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrls: ["https://rpc-amoy.polygon.technology"],
    blockExplorerUrls: ["https://amoy.polygonscan.com"],
  },
  31337: {
    chainId: "0x7A69",
    chainName: "Hardhat Local",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["http://127.0.0.1:8545"],
    blockExplorerUrls: [],
  },
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress]       = useState<string | null>(null);
  const [chainId, setChainId]       = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [provider, setProvider]     = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner]         = useState<ethers.JsonRpcSigner | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const getProvider = () => {
    if (!window.ethereum) throw new Error("MetaMask not installed");
    return new ethers.BrowserProvider(window.ethereum);
  };

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const p = getProvider();
      await p.send("eth_requestAccounts", []);
      const s   = await p.getSigner();
      const net = await p.getNetwork();
      setProvider(p);
      setSigner(s);
      setAddress(await s.getAddress());
      setChainId(Number(net.chainId));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("rejected") || msg.includes("denied"))
        setError("Connection rejected by user.");
      else if (msg.includes("MetaMask not installed"))
        setError("MetaMask not installed. Please install it from metamask.io.");
      else setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
  }, []);

  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!window.ethereum) return;
    const hexId = "0x" + targetChainId.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: hexId }] });
    } catch (err: unknown) {
      // Chain not added yet — add it
      if ((err as { code?: number }).code === 4902 && CHAIN_PARAMS[targetChainId]) {
        await window.ethereum.request({ method: "wallet_addEthereumChain", params: [CHAIN_PARAMS[targetChainId]] });
      } else throw err;
    }
  }, []);

  // Listen for account / chain changes
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccountsChanged = async (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else {
        const p = getProvider();
        const s = await p.getSigner();
        setProvider(p);
        setSigner(s);
        setAddress(accounts[0]);
      }
    };
    const handleChainChanged = (chainIdHex: string) => {
      setChainId(parseInt(chainIdHex, 16));
      // refresh provider
      const p = getProvider();
      setProvider(p);
      p.getSigner().then(setSigner);
    };
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
    return () => {
      window.ethereum?.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum?.removeListener("chainChanged", handleChainChanged);
    };
  }, [disconnect]);

  // Auto-reconnect if previously connected
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then(async (accounts: string[]) => {
      if (accounts.length > 0) await connect();
    });
  }, [connect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        chainId,
        isConnected: !!address,
        isConnecting,
        provider,
        signer,
        error,
        connect,
        disconnect,
        switchNetwork,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletState {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside <WalletProvider>");
  return ctx;
}

export { TARGET_CHAIN_ID };
