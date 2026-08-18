import React from "react";
import DistChart from "./DistChart";
import DataTable from "./DataTable";
import { getDownloadUrl } from "../lib/api";

/**
 * Batch results view — stat cards, distribution chart, data table.
 */

const fmtPct = (p) => `${(p * 100).toFixed(1)}%`;

export default function BatchResults({ data, onBack }) {
  if (!data) return null;

  const handleDownload = () => {
    if (data.token) {
      window.location.href = getDownloadUrl(data.token);
    }
  };

  return (
    <section className="view-enter">
      <header className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="font-display text-[26px] font-semibold m-0 mb-1.5 tracking-[0.1px]">Batch Analysis Results</h1>
          <p className="text-text-secondary m-0">Overview of scored transactions and risk distributions.</p>
        </div>
        <button
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 border border-paper-border-strong bg-paper text-text-primary rounded-[var(--radius-sm)] px-4 py-2.5 text-[13.5px] font-semibold cursor-pointer transition-all duration-150 hover:bg-[#eeece4] active:translate-y-px"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Upload another CSV
        </button>
      </header>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3.5 mb-5 max-[900px]:grid-cols-2">
        <StatCard label="Total scored" value={data.summary.total} />
        <StatCard label="Genuine" value={data.summary.genuine} color="genuine" />
        <StatCard label="Manual review" value={data.summary.manual_review} color="review" />
        <StatCard label="Suspicious" value={data.summary.suspicious ?? data.summary.fraud ?? 0} color="suspicious" />
      </div>

      {/* Distribution chart */}
      <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] mb-5">
        <h2 className="font-display text-[17px] font-semibold m-0 mb-1">Top risk factor distribution</h2>
        <p className="text-text-secondary text-[12.5px] m-0 mb-3.5">Confirms multiple features drive results, not just one.</p>
        <DistChart distribution={data.top_factor_distribution} />
      </div>

      {/* Data table */}
      <DataTable
        rows={data.rows}
        truncated={data.truncated}
        maxDisplayRows={data.max_display_rows}
        downloadToken={data.token}
        onDownload={handleDownload}
      />

      <p className="text-[11.5px] text-text-muted mt-4 leading-relaxed">
        Predicted_Suspicious is a self-generated risk label, not verified suspicious activity.
        Verdicts use a 3-tier threshold: below {fmtPct(data.low_cutoff)} = Genuine,{" "}
        {fmtPct(data.low_cutoff)}–{fmtPct(data.high_cutoff)} = Manual Review,{" "}
        above {fmtPct(data.high_cutoff)} = Suspicious.
      </p>
    </section>
  );
}

function StatCard({ label, value, color }) {
  const borderColor = {
    genuine: "border-l-genuine",
    review: "border-l-review",
    suspicious: "border-l-suspicious",
  }[color] || "border-l-paper-border-strong";

  const hoverShadow = {
    genuine: "hover:shadow-[0_10px_24px_rgba(31,122,92,0.15)]",
    review: "hover:shadow-[0_10px_24px_rgba(179,120,31,0.15)]",
    suspicious: "hover:shadow-[0_10px_24px_rgba(178,60,51,0.15)]",
  }[color] || "hover:shadow-[0_10px_24px_rgba(23,31,43,0.09)]";

  return (
    <div
      className={`bg-paper-raised border border-paper-border rounded-[var(--radius-md)] px-4 py-4 shadow-[var(--shadow-card)] border-l-[3.5px] ${borderColor} transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-default hover:-translate-y-1 ${hoverShadow} group`}
    >
      <span className="block font-mono text-[26px] font-semibold transition-transform duration-200 group-hover:scale-[1.04]">
        {(value ?? 0).toLocaleString()}
      </span>
      <span className="text-[11.5px] text-text-secondary uppercase tracking-[0.6px]">{label}</span>
    </div>
  );
}
