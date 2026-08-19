import React, { useEffect, useRef, useState } from "react";

/**
 * LandingPage — cinematic full-screen entry with hero, tech showcase, and CTA.
 */

/* ---------- tiny canvas particle layer ---------- */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let particles = [];
    const PARTICLE_COUNT = 60;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // seed particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        r: Math.random() * 1.8 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.15,
      });
    }

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      // draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 140) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(169,124,63,${0.08 * (1 - dist / 140)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      // draw particles
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(169,124,63,${p.opacity})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > w) p.dx *= -1;
        if (p.y < 0 || p.y > h) p.dy *= -1;
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="landing-particles"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

/* ---------- animated counter ---------- */
function AnimCounter({ end, suffix = "", duration = 1800 }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          const startTime = performance.now();
          const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.round(eased * end));
            if (progress < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return (
    <span ref={ref} className="landing-counter">
      {val}
      {suffix}
    </span>
  );
}

/* ---------- scroll reveal wrapper ---------- */
function Reveal({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`landing-reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- main landing ---------- */
export default function LandingPage({ onEnter }) {
  const techCards = [
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
          <rect x="4" y="6" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" />
          <path d="M4 14h32" stroke="currentColor" strokeWidth="1.5" />
          <path d="M12 22h16M12 28h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="9" cy="10" r="1.4" fill="currentColor" />
          <circle cx="14" cy="10" r="1.4" fill="currentColor" />
          <circle cx="19" cy="10" r="1.4" fill="currentColor" />
        </svg>
      ),
      title: "LightGBM Engine",
      desc: "Gradient-boosted decision trees trained on transactional behavioral features for high-accuracy fraud detection with sub-second inference.",
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
          <path d="M20 4L36 12v8c0 10-6.5 16.5-16 19C10.5 36.5 4 30 4 20v-8L20 4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M14 20.5l4 4 8.5-8.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      title: "SHAP Explainability",
      desc: "Every verdict is transparent. SHapley Additive exPlanations break down exactly which features drove each risk score — audit-ready.",
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
          <rect x="5" y="8" width="30" height="6" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5" y="17" width="30" height="6" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5" y="26" width="30" height="6" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 11h8" stroke="#1f7a5c" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 20h14" stroke="#b3781f" strokeWidth="2" strokeLinecap="round" />
          <path d="M10 29h5" stroke="#b23c33" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ),
      title: "3-Tier Risk Engine",
      desc: "Transactions are classified into Genuine, Manual Review, or Suspicious bands with configurable thresholds for operational flexibility.",
    },
    {
      icon: (
        <svg viewBox="0 0 40 40" fill="none" className="w-9 h-9">
          <rect x="5" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="21" y="6" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="5" y="22" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <rect x="21" y="22" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M9 10h6M9 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M25 10h6M25 14h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M9 26h6M9 30h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M25 26h6M25 30h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      ),
      title: "Batch Processing",
      desc: "Upload thousands of transactions via CSV. Smart column mapping, chunked scoring, and full export — built for production-scale analysis.",
    },
  ];

  const steps = [
    {
      num: "01",
      title: "Upload",
      desc: "Drop a CSV or enter a single transaction — column mapping is handled automatically.",
    },
    {
      num: "02",
      title: "Score",
      desc: "LightGBM evaluates behavioral signals and generates a calibrated risk probability in milliseconds.",
    },
    {
      num: "03",
      title: "Explain",
      desc: "SHAP values reveal which features drove each verdict, giving analysts full transparency.",
    },
  ];

  return (
    <div className="landing-root">
      {/* ===== HERO ===== */}
      <section className="landing-hero">
        <ParticleCanvas />

        {/* Decorative grid overlay */}
        <div className="landing-grid-overlay" />

        <div className="landing-hero-content">
          {/* Shield logo */}
          <div className="landing-shield-wrap">
            <svg className="landing-shield" viewBox="0 0 64 64" fill="none">
              <path
                d="M32 4 L56 15 V32 C56 47 44.6 57 32 60 C19.4 57 8 47 8 32 V15 L32 4Z"
                stroke="url(#shieldGrad)"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M22 32.4 L28.8 39.2 L42.6 24.8"
                stroke="url(#shieldGrad)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="shieldGrad" x1="8" y1="4" x2="56" y2="60">
                  <stop offset="0%" stopColor="#c49655" />
                  <stop offset="100%" stopColor="#a97c3f" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <h1 className="landing-title">
            <span className="landing-title-main">BAF</span>
            <span className="landing-title-sub">Transaction Risk Console</span>
          </h1>

          <p className="landing-tagline">
            AI-powered fraud detection with explainable verdicts.
            <br />
            Score transactions in real-time, process batches at scale, and understand
            every decision with SHAP-driven transparency.
          </p>

          {/* Stats ribbon */}
          <div className="landing-stats">
            <div className="landing-stat">
              <span className="landing-stat-value">
                <AnimCounter end={3} />
              </span>
              <span className="landing-stat-label">Risk tiers</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-value">
                {"<"}<AnimCounter end={100} suffix="ms" />
              </span>
              <span className="landing-stat-label">Inference</span>
            </div>
            <div className="landing-stat-divider" />
            <div className="landing-stat">
              <span className="landing-stat-value">
                <AnimCounter end={100} suffix="%" />
              </span>
              <span className="landing-stat-label">Explainable</span>
            </div>
          </div>

          {/* CTA */}
          <button className="landing-cta" onClick={onEnter}>
            <span>Enter Risk Console</span>
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
              <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Scroll indicator */}
        <div className="landing-scroll-hint">
          <span>Scroll to explore</span>
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </section>

      {/* ===== TECH SHOWCASE ===== */}
      <section className="landing-section landing-tech-section">
        <Reveal>
          <div className="landing-section-header">
            <span className="landing-section-label">Technology</span>
            <h2 className="landing-section-title">Built for precision & transparency</h2>
            <p className="landing-section-desc">
              Every layer of BAF is engineered for speed, accuracy, and full auditability.
            </p>
          </div>
        </Reveal>

        <div className="landing-tech-grid">
          {techCards.map((card, i) => (
            <Reveal key={card.title} delay={i * 100}>
              <div className="landing-tech-card">
                <div className="landing-tech-icon">{card.icon}</div>
                <h3 className="landing-tech-card-title">{card.title}</h3>
                <p className="landing-tech-card-desc">{card.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="landing-section landing-steps-section">
        <Reveal>
          <div className="landing-section-header">
            <span className="landing-section-label">Workflow</span>
            <h2 className="landing-section-title">Three steps to a verdict</h2>
          </div>
        </Reveal>

        <div className="landing-steps">
          {steps.map((step, i) => (
            <Reveal key={step.num} delay={i * 140}>
              <div className="landing-step-card">
                <span className="landing-step-num">{step.num}</span>
                <h3 className="landing-step-title">{step.title}</h3>
                <p className="landing-step-desc">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div className="landing-step-connector">
                  <svg viewBox="0 0 40 20" fill="none" className="w-10 h-5">
                    <path d="M0 10h32M28 4l8 6-8 6" stroke="rgba(169,124,63,0.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="landing-section landing-bottom-cta">
        <Reveal>
          <div className="landing-bottom-cta-inner">
            <h2 className="landing-bottom-cta-title">Ready to detect fraud?</h2>
            <p className="landing-bottom-cta-desc">
              Open the Risk Console and start scoring transactions with full AI-powered explainability.
            </p>
            <button className="landing-cta" onClick={onEnter}>
              <span>Launch Console</span>
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="none">
                <path d="M4 10h12M12 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <span>© 2025 BAF · Built for SIH Hackathon</span>
      </footer>
    </div>
  );
}
