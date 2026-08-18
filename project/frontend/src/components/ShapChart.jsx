import React, { useEffect, useRef } from "react";

/**
 * Diverging horizontal bar chart showing SHAP feature importance.
 * Bars animate in with staggered delay.
 */
export default function ShapChart({ shapList = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const bars = containerRef.current.querySelectorAll(".shap-bar");
    bars.forEach((bar, idx) => {
      const targetWidth = bar.dataset.targetWidth;
      setTimeout(() => {
        bar.style.width = `${targetWidth}%`;
      }, idx * 45);
    });
  }, [shapList]);

  if (!shapList.length) return null;

  const maxAbs = Math.max(...shapList.map((r) => Math.abs(r.impact)), 1e-9);

  return (
    <div ref={containerRef} className="flex flex-col gap-2 mt-1.5">
      {shapList.map((r, idx) => {
        const isSuspicious = r.impact >= 0;
        const formattedImpact = (isSuspicious ? "+" : "") + r.impact.toFixed(3);
        const widthPct = Math.min((Math.abs(r.impact) / maxAbs) * 48, 48);
        const directionText = isSuspicious ? "Pushes toward Suspicious" : "Pushes toward Genuine";

        return (
          <div
            key={r.feature}
            className="grid items-center gap-3 px-1.5 py-1 rounded-[var(--radius-sm)] transition-all duration-150 cursor-default hover:bg-[rgba(169,124,63,0.07)] hover:translate-x-0.5 group"
            style={{ gridTemplateColumns: "160px 1fr 68px" }}
            title={`${r.feature}: ${formattedImpact} (${directionText})`}
          >
            {/* Label */}
            <div className="text-text-secondary text-right whitespace-nowrap overflow-hidden text-ellipsis font-mono text-xs font-medium transition-colors duration-150 group-hover:text-text-primary group-hover:font-semibold">
              {r.feature}
            </div>

            {/* Track */}
            <div className="relative h-[18px] bg-[#eeebe1] rounded-[4px] overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
              <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-paper-border-strong z-[2] -translate-x-1/2" />
              <div
                className={`shap-bar ${isSuspicious ? "toward-suspicious" : "toward-genuine"} ${
                  isSuspicious ? "" : ""
                }`}
                style={{
                  [isSuspicious ? "left" : "right"]: "50%",
                  width: "0%",
                }}
                data-target-width={widthPct}
              />
            </div>

            {/* Value badge */}
            <div
              className={`font-mono text-[11.5px] font-semibold text-center px-1.5 py-0.5 rounded-[4px] tracking-[-0.2px] whitespace-nowrap transition-all duration-150 group-hover:scale-[1.08] group-hover:shadow-md
                ${isSuspicious
                  ? "bg-suspicious-bg text-suspicious border border-[rgba(178,60,51,0.2)]"
                  : "bg-genuine-bg text-genuine border border-[rgba(31,122,92,0.2)]"
                }`}
            >
              {formattedImpact}
            </div>
          </div>
        );
      })}
    </div>
  );
}
