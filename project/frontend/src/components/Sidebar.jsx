import React from "react";

/**
 * Sidebar — brand, nav, risk legend, model status.
 */
export default function Sidebar({ activeView, onNavigate, config }) {
  const fmtPct = (p) => `${(p * 100).toFixed(1)}%`;

  const modelLoaded = config?.model_loaded;
  const modelType = config?.model_type;

  return (
    <aside className="sidebar-responsive bg-linear-to-b from-ink-900 to-ink-800 text-text-on-ink px-5 py-7 flex flex-col sticky top-0 h-screen min-w-[232px]">
      {/* Brand */}
      <div className="flex items-center gap-2.5 pb-6 mb-5 border-b border-ink-line">
        <svg className="w-7 h-7 text-brass shrink-0" viewBox="0 0 32 32" fill="none">
          <path d="M16 2 L28 7.5 V16 C28 23.5 22.7 28.5 16 30 C9.3 28.5 4 23.5 4 16 V7.5 L16 2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
          <path d="M11 16.2 L14.4 19.6 L21.3 12.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-lg font-semibold tracking-[0.2px]">BAF</span>
          <span className="text-[10.5px] tracking-[1.4px] uppercase text-text-on-ink-dim mt-0.5">Risk Console</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        <button
          onClick={() => onNavigate("single")}
          className={`flex items-center gap-2.5 bg-transparent border-none text-left px-3 py-2.5 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150
            ${activeView === "single"
              ? "bg-[rgba(169,124,63,0.16)] text-text-on-ink shadow-[inset_2px_0_0_var(--color-brass)]"
              : "text-text-on-ink-dim hover:bg-[rgba(255,255,255,0.05)] hover:text-text-on-ink"
            }`}
        >
          <svg className="w-[17px] h-[17px] shrink-0" viewBox="0 0 20 20" fill="none">
            <path d="M3 10h4l2-6 4 12 2-6h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Score Transaction</span>
        </button>
        <button
          onClick={() => onNavigate("batch")}
          className={`flex items-center gap-2.5 bg-transparent border-none text-left px-3 py-2.5 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150
            ${activeView === "batch" || activeView === "batch-results"
              ? "bg-[rgba(169,124,63,0.16)] text-text-on-ink shadow-[inset_2px_0_0_var(--color-brass)]"
              : "text-text-on-ink-dim hover:bg-[rgba(255,255,255,0.05)] hover:text-text-on-ink"
            }`}
        >
          <svg className="w-[17px] h-[17px] shrink-0" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M3 8h14M7 4v12" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span>Batch Analysis</span>
        </button>
      </nav>

      {/* Footer — risk bands + model status */}
      <div className="sidebar-footer-responsive mt-auto pt-4 border-t border-ink-line">
        <div className="text-[10.5px] uppercase tracking-[1.2px] text-text-on-ink-dim mb-2.5">Risk bands</div>
        <div className="flex items-center gap-2 text-[12.5px] text-text-on-ink-dim py-0.5">
          <span className="w-2 h-2 rounded-full bg-genuine-bright shrink-0" />
          Genuine
          <span className="ml-auto font-mono text-[11.5px] text-text-on-ink">
            {config ? `< ${fmtPct(config.low_cutoff)}` : "< 30%"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-text-on-ink-dim py-0.5">
          <span className="w-2 h-2 rounded-full bg-review-bright shrink-0" />
          Manual review
          <span className="ml-auto font-mono text-[11.5px] text-text-on-ink">
            {config ? `${fmtPct(config.low_cutoff)}–${fmtPct(config.high_cutoff)}` : "30–70%"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-text-on-ink-dim py-0.5">
          <span className="w-2 h-2 rounded-full bg-suspicious-bright shrink-0" />
          Suspicious
          <span className="ml-auto font-mono text-[11.5px] text-text-on-ink">
            {config ? `> ${fmtPct(config.high_cutoff)}` : "> 70%"}
          </span>
        </div>

        <div className="flex items-center gap-[7px] mt-4 text-[11.5px] text-text-on-ink-dim">
          <span
            className={`w-[7px] h-[7px] rounded-full shrink-0 ${
              modelLoaded === true
                ? "bg-genuine-bright shadow-[0_0_0_3px_rgba(79,185,140,0.18)]"
                : modelLoaded === false
                ? "bg-suspicious-bright shadow-[0_0_0_3px_rgba(224,104,92,0.18)]"
                : "bg-text-muted"
            }`}
          />
          <span>
            {modelLoaded === true
              ? `${modelType} · Live`
              : modelLoaded === false
              ? "Model not loaded"
              : "Checking model…"}
          </span>
        </div>
      </div>
    </aside>
  );
}
