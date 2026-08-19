import React, { useState } from "react";
import { scoreTransaction } from "../lib/api";
import Gauge from "./Gauge";
import ShapChart from "./ShapChart";

/**
 * Single transaction scoring view — form + result card.
 */

function SegmentedToggle({ name, value, onChange }) {
  return (
    <div className="flex border border-paper-border-strong rounded-[var(--radius-sm)] overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`flex-1 border-none px-0 py-2.5 cursor-pointer text-[13px] font-medium transition-all duration-150
          ${!value ? "bg-ink-900 text-text-on-ink" : "bg-paper text-text-secondary"}`}
      >
        No
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`flex-1 border-none border-l border-paper-border-strong px-0 py-2.5 cursor-pointer text-[13px] font-medium transition-all duration-150
          ${value ? "bg-ink-900 text-text-on-ink" : "bg-paper text-text-secondary"}`}
        style={{ borderLeft: "1px solid var(--color-paper-border-strong)" }}
      >
        Yes
      </button>
    </div>
  );
}

export default function ScoreTransaction({ config, onError }) {
  const [form, setForm] = useState({
    amount: "450.00",
    balance: "3200.00",
    prev_balance: "3200.00",
    login_attempts: "1",
    hours_since_last: "200",
    duration: "120",
    location_changed: false,
    device_changed: false,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const fmtPct = (p) => `${(p * 100).toFixed(1)}%`;

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await scoreTransaction({
        amount: parseFloat(form.amount),
        balance: parseFloat(form.balance),
        prev_balance: parseFloat(form.prev_balance),
        login_attempts: parseInt(form.login_attempts, 10),
        hours_since_last: parseFloat(form.hours_since_last),
        duration: parseFloat(form.duration),
        location_changed: form.location_changed,
        device_changed: form.device_changed,
      });
      setResult(data);
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const verdictBadgeClass = (verdict) => {
    if (verdict === "Genuine") return "bg-genuine-bg text-genuine";
    if (verdict === "Manual Review Required") return "bg-review-bg text-review";
    return "bg-suspicious-bg text-suspicious";
  };

  const verdictIcon = (verdict) => {
    if (verdict === "Genuine") return "✅";
    if (verdict === "Manual Review Required") return "⚠️";
    return "🚫";
  };

  return (
    <section className="view-enter">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-semibold m-0 mb-1.5 tracking-[0.1px]">Score a transaction</h1>
        <p className="text-text-secondary m-0 max-w-[62ch]">
          Enter the details of a single transaction to get an instant, explainable risk verdict.
        </p>
      </header>

      <div className="grid gap-6 items-start" style={{ gridTemplateColumns: "minmax(320px, 440px) 1fr" }}>
        {/* Form card */}
        <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="font-display text-[17px] font-semibold m-0 mb-1">Transaction details</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 mt-4">
            {/* Amount */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Transaction amount</span>
              <div className="flex items-center border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] overflow-hidden transition-all duration-150 focus-within:border-brass focus-within:shadow-[0_0_0_3px_rgba(169,124,63,0.14)]">
                <span className="pl-3 text-text-muted font-mono text-[13.5px]">$</span>
                <input
                  type="number" step="0.01" min="0" required
                  value={form.amount}
                  onChange={(e) => handleChange("amount", e.target.value)}
                  className="border-none bg-transparent shadow-none font-mono text-[13.5px] text-text-primary p-2 w-full focus:outline-none focus:shadow-none"
                />
              </div>
            </label>

            {/* Balance */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Account balance</span>
              <div className="flex items-center border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] overflow-hidden transition-all duration-150 focus-within:border-brass focus-within:shadow-[0_0_0_3px_rgba(169,124,63,0.14)]">
                <span className="pl-3 text-text-muted font-mono text-[13.5px]">$</span>
                <input
                  type="number" step="0.01" min="0.01" required
                  value={form.balance}
                  onChange={(e) => handleChange("balance", e.target.value)}
                  className="border-none bg-transparent shadow-none font-mono text-[13.5px] text-text-primary p-2 w-full focus:outline-none focus:shadow-none"
                />
              </div>
            </label>

            {/* Previous balance */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Previous balance</span>
              <div className="flex items-center border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] overflow-hidden transition-all duration-150 focus-within:border-brass focus-within:shadow-[0_0_0_3px_rgba(169,124,63,0.14)]">
                <span className="pl-3 text-text-muted font-mono text-[13.5px]">$</span>
                <input
                  type="number" step="0.01" min="0" required
                  value={form.prev_balance}
                  onChange={(e) => handleChange("prev_balance", e.target.value)}
                  className="border-none bg-transparent shadow-none font-mono text-[13.5px] text-text-primary p-2 w-full focus:outline-none focus:shadow-none"
                />
              </div>
            </label>

            {/* Login attempts */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Login attempts</span>
              <input
                type="number" step="1" min="1" required
                value={form.login_attempts}
                onChange={(e) => handleChange("login_attempts", e.target.value)}
                className="border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] p-2.5 font-mono text-[13.5px] text-text-primary w-full transition-all duration-150 focus:border-brass focus:shadow-[0_0_0_3px_rgba(169,124,63,0.14)] focus:outline-none"
              />
            </label>

            {/* Hours since last */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Hours since last transaction</span>
              <input
                type="number" step="0.1" min="0" required
                value={form.hours_since_last}
                onChange={(e) => handleChange("hours_since_last", e.target.value)}
                className="border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] p-2.5 font-mono text-[13.5px] text-text-primary w-full transition-all duration-150 focus:border-brass focus:shadow-[0_0_0_3px_rgba(169,124,63,0.14)] focus:outline-none"
              />
            </label>

            {/* Duration */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Transaction duration (sec)</span>
              <input
                type="number" step="1" min="0" required
                value={form.duration}
                onChange={(e) => handleChange("duration", e.target.value)}
                className="border border-paper-border-strong bg-paper rounded-[var(--radius-sm)] p-2.5 font-mono text-[13.5px] text-text-primary w-full transition-all duration-150 focus:border-brass focus:shadow-[0_0_0_3px_rgba(169,124,63,0.14)] focus:outline-none"
              />
            </label>

            {/* Location changed */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Location changed?</span>
              <SegmentedToggle
                name="location_changed"
                value={form.location_changed}
                onChange={(v) => handleChange("location_changed", v)}
              />
            </label>

            {/* Device changed */}
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-text-secondary">Device changed?</span>
              <SegmentedToggle
                name="device_changed"
                value={form.device_changed}
                onChange={(v) => handleChange("device_changed", v)}
              />
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="col-span-2 w-full mt-1.5 bg-brass text-white border-none rounded-[var(--radius-sm)] px-4 py-3 text-[13.5px] font-semibold cursor-pointer transition-all duration-150 hover:brightness-[1.06] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Scoring…" : "Score this transaction"}
            </button>
          </form>
        </div>

        {/* Result card */}
        <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] min-h-[420px] flex flex-col">
          {!result ? (
            <div className="m-auto text-center text-text-muted max-w-[300px] py-8 px-2.5">
              <svg className="w-10 h-10 mx-auto mb-3 text-paper-border-strong" viewBox="0 0 48 48" fill="none">
                <path d="M24 6 L40 12 V24 C40 33.5 33 40 24 43 C15 40 8 33.5 8 24 V12 L24 6Z" stroke="currentColor" strokeWidth="1.4"/>
              </svg>
              <p>Fill in the transaction details and score it to see the risk verdict, gauge, and driving factors here.</p>
            </div>
          ) : (
            <div className="view-enter">
              <Gauge
                probability={result.probability}
                lowCutoff={result.low_cutoff}
                highCutoff={result.high_cutoff}
              />

              {/* Verdict badge */}
              <div className="flex justify-center mt-3.5">
                <span className={`inline-flex items-center gap-[7px] px-4 py-[7px] rounded-full font-semibold text-[13.5px] ${verdictBadgeClass(result.verdict)}`}>
                  {verdictIcon(result.verdict)} {result.verdict} — {fmtPct(result.probability)} risk
                </span>
              </div>

              {/* Review banner */}
              {result.verdict === "Manual Review Required" && (
                <div className="bg-[#eaf1fb] text-[#2a5488] p-3 rounded-[var(--radius-sm)] text-[13px] mt-4 leading-relaxed">
                  This transaction falls in the medium-risk band ({fmtPct(result.low_cutoff)}–{fmtPct(result.high_cutoff)}). It is not auto-approved or auto-blocked — a human analyst should review it.
                </div>
              )}

              {/* Divider */}
              <div className="h-px bg-paper-border my-4" />

              {/* SHAP chart */}
              <h3 className="text-[13px] font-semibold m-0 mb-3 text-text-primary">Why this verdict</h3>
              <ShapChart shapList={result.shap} />

              {/* Top factor */}
              <p className="text-[13px] mt-4 mb-2">
                <strong>Top factor:</strong>{" "}
                <code className="bg-paper border border-paper-border px-1.5 py-px rounded-[4px] font-mono text-xs">
                  {result.top_factor.feature}
                </code>{" "}
                had the largest single influence, pushing the prediction {result.top_factor.direction} (impact: {result.top_factor.impact >= 0 ? "+" : ""}{result.top_factor.impact.toFixed(3)}).
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {result.top3.map((f) => (
                  <span key={f} className="bg-brass-tint text-brass-strong font-mono text-[11px] px-2.5 py-0.5 rounded-full">
                    {f}
                  </span>
                ))}
              </div>

              {/* Engineered features */}
              <details className="mt-3">
                <summary className="cursor-pointer text-[12.5px] text-text-secondary font-medium py-1.5 hover:text-text-primary">
                  Engineered features used for this prediction
                </summary>
                <pre className="mono-block">
                  {JSON.stringify(result.engineered_features, null, 2)}
                </pre>
              </details>

              <p className="text-[11.5px] text-text-muted mt-4 leading-relaxed">
                Predicted_Suspicious is a self-generated risk label built from a capped-weight composite
                of multiple behavioral signals — not verified suspicious activity. This score reflects risk
                assessment, not confirmed suspicious transactions.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
