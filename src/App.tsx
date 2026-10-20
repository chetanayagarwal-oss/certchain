import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { WalletProvider } from "./context/WalletContext";
import { DemoProvider } from "./context/DemoContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import DemoBanner from "./components/DemoBanner";
import LandingPage from "./pages/LandingPage";
import VerifyPage from "./pages/VerifyPage";
import IssuerPage from "./pages/IssuerPage";
import AdminPage from "./pages/AdminPage";
import CertificatePage from "./pages/CertificatePage";

export default function App() {
  return (
    <DemoProvider>
      <WalletProvider>
        <BrowserRouter>
          <div className="app-root">
            <DemoBanner />
            <Navbar />
            <main className="main-content">
              <Routes>
                <Route path="/"                   element={<LandingPage />} />
                <Route path="/verify"             element={<VerifyPage />} />
                <Route path="/issuer"             element={<IssuerPage />} />
                <Route path="/admin"              element={<AdminPage />} />
                <Route path="/certificate/:hash"  element={<CertificatePage />} />
              </Routes>
            </main>
            <Footer />
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "#1e1b4b",
                color: "#e0e7ff",
                border: "1px solid rgba(99,102,241,0.3)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              success: { iconTheme: { primary: "#34d399", secondary: "#1e1b4b" } },
              error:   { iconTheme: { primary: "#f87171", secondary: "#1e1b4b" } },
            }}
          />
        </BrowserRouter>
      </WalletProvider>
    </DemoProvider>
  );
}
