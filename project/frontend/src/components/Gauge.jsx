import React, { useEffect, useRef } from "react";

/**
 * SVG semicircular gauge — exact same geometry as the original.
 */

const CX = 110, CY = 118, R = 80;

function polarPoint(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export default function Gauge({ probability, lowCutoff = 0.3, highCutoff = 0.7 }) {
  const needleRef = useRef(null);
  const fmtPct = (p) => `${(p * 100).toFixed(1)}%`;

  const angleFor = (p) => 180 * (1 - p);

  const genuinePath = arcPath(CX, CY, R, angleFor(0), angleFor(lowCutoff));
  const reviewPath  = arcPath(CX, CY, R, angleFor(lowCutoff), angleFor(highCutoff));
  const suspPath    = arcPath(CX, CY, R, angleFor(highCutoff), angleFor(1));

  const rotation = probability != null ? 180 * probability - 90 : -90;

  useEffect(() => {
    if (needleRef.current) {
      // trigger animation on mount / update
      requestAnimationFrame(() => {
        needleRef.current.style.transform = `rotate(${rotation}deg)`;
      });
    }
  }, [rotation]);

  return (
    <div className="relative flex flex-col items-center">
      <svg className="w-full max-w-[260px] overflow-visible" viewBox="0 0 220 130">
        <path className="gauge-zone gauge-zone-genuine" d={genuinePath} />
        <path className="gauge-zone gauge-zone-review" d={reviewPath} />
        <path className="gauge-zone gauge-zone-suspicious" d={suspPath} />
        <line
          ref={needleRef}
          className="gauge-needle"
          x1="110" y1="118" x2="110" y2="30"
          style={{ transform: "rotate(-90deg)" }}
        />
        <circle cx="110" cy="118" r="6.5" className="gauge-hub" />
      </svg>
      <div className="text-center -mt-3.5">
        <span className="block font-mono text-[30px] font-semibold tracking-[-0.5px]">
          {probability != null ? fmtPct(probability) : "—"}
        </span>
        <span className="text-[11.5px] text-text-muted uppercase tracking-[1px]">
          Suspicious probability
        </span>
      </div>
    </div>
  );
}
