import React, { useEffect, useRef } from "react";

/**
 * Horizontal bar chart showing top risk factor distribution in batch results.
 */
export default function DistChart({ distribution = [] }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !distribution.length) return;
    const fills = containerRef.current.querySelectorAll(".dist-fill");
    const max = Math.max(...distribution.map((d) => d.count));
    fills.forEach((fill, idx) => {
      const targetPct = (distribution[idx].count / max) * 100;
      setTimeout(() => {
        fill.style.width = `${targetPct}%`;
      }, idx * 40);
    });
  }, [distribution]);

  if (!distribution.length) {
    return <p className="text-[11.5px] text-text-muted mt-4">No data.</p>;
  }

  return (
    <div ref={containerRef} className="flex flex-col gap-2">
      {distribution.map((d) => (
        <div
          key={d.feature}
          className="grid items-center gap-2.5 px-1.5 py-1 rounded-[var(--radius-sm)] transition-all duration-150 hover:bg-[rgba(169,124,63,0.08)] hover:translate-x-0.5 group"
          style={{ gridTemplateColumns: "170px 1fr 48px" }}
        >
          <div
            className="font-mono text-[11.5px] text-text-secondary text-right overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-150 group-hover:text-text-primary group-hover:font-semibold"
            title={d.feature}
          >
            {d.feature}
          </div>
          <div className="h-4 bg-[#f0eee6] rounded-[4px] overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
            <div
              className="dist-fill group-hover:brightness-110 group-hover:shadow-[0_0_10px_rgba(169,124,63,0.4)]"
              style={{ width: "0%" }}
            />
          </div>
          <div className="font-mono text-[11.5px] text-text-muted font-semibold">
            {d.count.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
