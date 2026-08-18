import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import ScoreTransaction from "./components/ScoreTransaction";
import BatchUpload from "./components/BatchUpload";
import BatchResults from "./components/BatchResults";
import { fetchConfig } from "./lib/api";

/**
 * App — top-level layout with sidebar + views.
 */
export default function App() {
  const [activeView, setActiveView] = useState("single");
  const [config, setConfig] = useState(null);
  const [globalError, setGlobalError] = useState("");
  const [batchData, setBatchData] = useState(null);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setConfig(cfg);
        if (!cfg.model_loaded) {
          setGlobalError(cfg.load_error || "Model failed to load.");
        }
      })
      .catch((err) => {
        setGlobalError("Could not reach the backend API. Is the Flask server running?");
      });
  }, []);

  const handleNavigate = (view) => {
    setActiveView(view);
    setGlobalError("");
  };

  const handleError = (msg) => {
    setGlobalError(msg);
  };

  const handleBatchResults = (data) => {
    setBatchData(data);
    setActiveView("batch-results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBackToUpload = () => {
    setActiveView("batch");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell grid min-h-screen" style={{ gridTemplateColumns: "232px 1fr" }}>
      <Sidebar activeView={activeView} onNavigate={handleNavigate} config={config} />

      <main className="px-10 py-8 max-w-[1120px] max-[900px]:px-4 max-[900px]:py-5">
        {/* Global error banner */}
        {globalError && (
          <div className="bg-suspicious-bg text-suspicious p-3 rounded-[var(--radius-sm)] text-[13px] mb-4 leading-relaxed">
            {globalError}
          </div>
        )}

        {activeView === "single" && (
          <ScoreTransaction config={config} onError={handleError} />
        )}

        {activeView === "batch" && (
          <BatchUpload onResults={handleBatchResults} onError={handleError} />
        )}

        {activeView === "batch-results" && (
          <BatchResults data={batchData} onBack={handleBackToUpload} />
        )}
      </main>
    </div>
  );
}
