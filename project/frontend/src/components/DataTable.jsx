import React, { useState, useMemo } from "react";

/**
 * Scored transactions table with sticky header, sort, and verdict pills.
 */

const TABLE_COLUMNS = [
  { key: "TransactionID", label: "Transaction ID" },
  { key: "AccountID", label: "Account ID" },
  { key: "TransactionAmount", label: "Amount", fmt: (v) => `$${Number(v).toFixed(2)}` },
  { key: "LoginAttempts", label: "Login Attempts" },
  { key: "ImpossibleTravel", label: "Impossible Travel", fmt: (v) => (v ? "Yes" : "No") },
  { key: "HighLoginAttempts", label: "High Logins", fmt: (v) => (v ? "Yes" : "No") },
  { key: "Verdict", label: "Verdict", verdict: true },
  { key: "RiskProbability", label: "Risk", fmt: (v) => `${(v * 100).toFixed(1)}%` },
  { key: "Top_Risk_Factor", label: "Top Factor" },
  { key: "Second_Risk_Factor", label: "2nd Factor" },
];

function verdictClass(v) {
  if (v === "Genuine") return "bg-genuine-bg text-genuine";
  if (v === "Manual Review Required") return "bg-review-bg text-review";
  return "bg-suspicious-bg text-suspicious";
}

export default function DataTable({ rows = [], truncated, maxDisplayRows, downloadToken, onDownload }) {
  const [sortMode, setSortMode] = useState("risk");

  const cols = useMemo(() => {
    if (!rows.length) return [];
    return TABLE_COLUMNS.filter((c) => c.key in rows[0]);
  }, [rows]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      sortMode === "risk"
        ? b.RiskProbability - a.RiskProbability
        : a._OriginalOrder - b._OriginalOrder
    );
  }, [rows, sortMode]);

  return (
    <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
        <h2 className="font-display text-[17px] font-semibold m-0">Scored transactions</h2>
        <div className="flex gap-2.5 items-center">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] px-2.5 py-2 font-body text-[12.5px] cursor-pointer transition-all duration-150 focus:border-brass focus:shadow-[0_0_0_3px_rgba(169,124,63,0.14)] focus:outline-none"
          >
            <option value="risk">Highest risk first</option>
            <option value="original">Original order</option>
          </select>
          <button
            onClick={onDownload}
            className="inline-flex items-center justify-center gap-2 border border-paper-border-strong bg-paper text-text-primary rounded-[var(--radius-sm)] px-4 py-2.5 text-[13.5px] font-semibold cursor-pointer transition-all duration-150 hover:bg-[#eeece4] active:translate-y-px"
          >
            Download scored CSV
          </button>
        </div>
      </div>

      {truncated && (
        <p className="text-[11.5px] text-text-muted my-1">
          Showing the first {maxDisplayRows?.toLocaleString()} rows in this view. The downloaded CSV includes every scored row.
        </p>
      )}

      {/* Table */}
      <div className="max-h-[460px] overflow-auto border border-paper-border rounded-[var(--radius-sm)] mt-2.5">
        <table className="data-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => {
                  if (c.verdict) {
                    return (
                      <td key={c.key}>
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-body ${verdictClass(row[c.key])}`}
                        >
                          {row[c.key]}
                        </span>
                      </td>
                    );
                  }
                  const val = c.fmt ? c.fmt(row[c.key]) : row[c.key];
                  return <td key={c.key}>{val ?? ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
