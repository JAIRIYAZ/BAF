(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Global state
  // ------------------------------------------------------------------
  let CONFIG = null;
  let currentToken = null;
  let currentSummaryRows = []; // last scored rows (as returned, risk-sorted)
  let currentSort = "risk";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtPct = (p) => `${(p * 100).toFixed(1)}%`;

  // ------------------------------------------------------------------
  // Nav switching
  // ------------------------------------------------------------------
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const view = btn.dataset.view;
      $$(".view").forEach((v) => v.classList.remove("is-active"));
      $(`#view-${view}`).classList.add("is-active");
    });
  });

  // ------------------------------------------------------------------
  // Config / model status
  // ------------------------------------------------------------------
  async function loadConfig() {
    try {
      const res = await fetch("/api/config");
      CONFIG = await res.json();
      const statusDot = $(".status-dot");
      const statusText = $("#model-status-text");
      if (CONFIG.model_loaded) {
        statusDot.classList.add("is-ok");
        statusText.textContent = `${CONFIG.model_type} · Live`;
      } else {
        statusDot.classList.add("is-error");
        statusText.textContent = "Model not loaded";
        showGlobalError(CONFIG.load_error || "Model failed to load.");
      }
      $("#legend-low").textContent = `< ${fmtPct(CONFIG.low_cutoff)}`;
      $("#legend-mid").textContent = `${fmtPct(CONFIG.low_cutoff)}\u2013${fmtPct(CONFIG.high_cutoff)}`;
      $("#legend-high").textContent = `> ${fmtPct(CONFIG.high_cutoff)}`;
    } catch (e) {
      showGlobalError("Could not reach the backend API. Is the Flask server running?");
    }
  }

  function showGlobalError(msg) {
    const el = $("#global-error");
    el.textContent = msg;
    el.style.display = "block";
  }

  function clearGlobalError() {
    $("#global-error").style.display = "none";
  }

  // ------------------------------------------------------------------
  // Single transaction — segmented toggles
  // ------------------------------------------------------------------
  $$(".segmented").forEach((group) => {
    $$(".seg-btn", group).forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".seg-btn", group).forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");
      });
    });
  });

  function segValue(name) {
    const group = $(`.segmented[data-name="${name}"]`);
    return $(".seg-btn.is-active", group).dataset.value === "true";
  }

  // ------------------------------------------------------------------
  // Gauge geometry
  // ------------------------------------------------------------------
  const GAUGE_CX = 110, GAUGE_CY = 118, GAUGE_R = 80;

  function polarPoint(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polarPoint(cx, cy, r, startAngle);
    const end = polarPoint(cx, cy, r, endAngle);
    const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
    // sweep=1 draws clockwise on screen as angle decreases (since y is flipped)
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function renderGaugeZones() {
    const low = CONFIG ? CONFIG.low_cutoff : 0.3;
    const high = CONFIG ? CONFIG.high_cutoff : 0.7;
    const angleFor = (p) => 180 * (1 - p);

    $(".gauge-zone-genuine").setAttribute("d", arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, angleFor(0), angleFor(low)));
    $(".gauge-zone-review").setAttribute("d", arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, angleFor(low), angleFor(high)));
    $(".gauge-zone-suspicious").setAttribute("d", arcPath(GAUGE_CX, GAUGE_CY, GAUGE_R, angleFor(high), angleFor(1)));
  }

  function setGaugeValue(p) {
    const rotation = 180 * p - 90;
    $("#gauge-needle").style.transform = `rotate(${rotation}deg)`;
    $("#gauge-value").textContent = fmtPct(p);
  }

  // ------------------------------------------------------------------
  // SHAP diverging bar chart
  // ------------------------------------------------------------------
  function renderShapChart(container, shapList) {
    container.innerHTML = "";
    const maxAbs = Math.max(...shapList.map((r) => Math.abs(r.impact)), 1e-9);

    shapList.forEach((r, idx) => {
      const row = document.createElement("div");
      row.className = "shap-row";
      row.style.setProperty("--row-index", idx);
      const isSuspicious = r.impact >= 0;
      const directionText = isSuspicious ? "Pushes toward Suspicious" : "Pushes toward Genuine";
      const formattedImpact = (isSuspicious ? "+" : "") + r.impact.toFixed(3);

      row.title = `${r.feature}: ${formattedImpact} (${directionText})`;

      const label = document.createElement("div");
      label.className = "shap-label";
      label.textContent = r.feature;

      const track = document.createElement("div");
      track.className = "shap-track";

      const mid = document.createElement("div");
      mid.className = "shap-mid";
      track.appendChild(mid);

      const bar = document.createElement("div");
      const widthPct = Math.min((Math.abs(r.impact) / maxAbs) * 48, 48);
      bar.className = `shap-bar ${isSuspicious ? "toward-suspicious" : "toward-genuine"}`;
      
      if (isSuspicious) {
        bar.style.left = "50%";
        bar.style.width = "0%";
      } else {
        bar.style.right = "50%";
        bar.style.width = "0%";
      }
      track.appendChild(bar);

      const val = document.createElement("div");
      val.className = `shap-val ${isSuspicious ? "val-suspicious" : "val-genuine"}`;
      val.textContent = formattedImpact;

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(val);
      container.appendChild(row);

      requestAnimationFrame(() => {
        setTimeout(() => {
          bar.style.width = `${widthPct}%`;
        }, idx * 45);
      });
    });
  }

  // ------------------------------------------------------------------
  // Single transaction scoring
  // ------------------------------------------------------------------
  const singleForm = $("#single-form");
  singleForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearGlobalError();

    const fd = new FormData(singleForm);
    const payload = {
      amount: parseFloat(fd.get("amount")),
      balance: parseFloat(fd.get("balance")),
      prev_balance: parseFloat(fd.get("prev_balance")),
      login_attempts: parseInt(fd.get("login_attempts"), 10),
      hours_since_last: parseFloat(fd.get("hours_since_last")),
      duration: parseFloat(fd.get("duration")),
      location_changed: segValue("location_changed"),
      device_changed: segValue("device_changed"),
    };

    const btn = $("#score-btn");
    btn.disabled = true;
    btn.querySelector("span").textContent = "Scoring\u2026";

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed.");
      renderSingleResult(data);
    } catch (err) {
      showGlobalError(err.message);
    } finally {
      btn.disabled = false;
      btn.querySelector("span").textContent = "Score this transaction";
    }
  });

  function renderSingleResult(data) {
    $("#result-empty").style.display = "none";
    $("#result-body").style.display = "block";

    renderGaugeZones();
    setGaugeValue(data.probability);

    const badge = $("#verdict-badge");
    const reviewBanner = $("#review-banner");
    reviewBanner.style.display = "none";

    if (data.verdict === "Genuine") {
      badge.className = "verdict-badge genuine";
      badge.textContent = `\u2705 Genuine \u2014 ${fmtPct(data.probability)} risk`;
    } else if (data.verdict === "Manual Review Required") {
      badge.className = "verdict-badge review";
      badge.textContent = `\u26A0\uFE0F Manual Review Required \u2014 ${fmtPct(data.probability)} risk`;
      reviewBanner.style.display = "block";
      reviewBanner.textContent = `This transaction falls in the medium-risk band (${fmtPct(data.low_cutoff)}\u2013${fmtPct(data.high_cutoff)}). It is not auto-approved or auto-blocked \u2014 a human analyst should review it.`;
    } else {
      badge.className = "verdict-badge suspicious";
      badge.textContent = `\uD83D\uDEAB Suspicious \u2014 ${fmtPct(data.probability)} risk`;
    }

    renderShapChart($("#shap-chart"), data.shap);

    $("#top-factor-line").innerHTML =
      `<strong>Top factor:</strong> <code>${data.top_factor.feature}</code> had the largest single influence, ` +
      `pushing the prediction ${data.top_factor.direction} (impact: ${data.top_factor.impact >= 0 ? "+" : ""}${data.top_factor.impact.toFixed(3)}).`;

    const chipRow = $("#top3-chips");
    chipRow.innerHTML = "";
    data.top3.forEach((f) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = f;
      chipRow.appendChild(chip);
    });

    $("#engineered-json").textContent = JSON.stringify(data.engineered_features, null, 2);
  }

  // ------------------------------------------------------------------
  // Batch — upload
  // ------------------------------------------------------------------
  const dropzone = $("#dropzone");
  const fileInput = $("#file-input");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("is-drag"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("is-drag"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("is-drag");
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });
  fileInput.addEventListener("change", () => {
    if (fileInput.files.length) handleFileSelected(fileInput.files[0]);
  });

  async function handleFileSelected(file) {
    clearGlobalError();
    $("#mapping-card").style.display = "none";
    $("#view-batch-results").classList.remove("is-active");

    const chip = $("#file-chip");
    chip.style.display = "inline-flex";
    chip.textContent = `Uploading ${file.name}\u2026`;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");

      currentToken = data.token;
      chip.textContent = `${data.filename} \u00B7 ${data.row_count.toLocaleString()} rows \u00B7 ${data.col_count} columns`;

      renderMapping(data);
    } catch (err) {
      chip.style.display = "none";
      showGlobalError(err.message);
    }
  }

  function renderMapping(data) {
    const card = $("#mapping-card");
    const banner = $("#mapping-banner");
    const grid = $("#mapping-grid");
    const confirmBtn = $("#confirm-mapping-btn");

    card.style.display = "block";
    grid.innerHTML = "";

    const requiredFields = Object.entries(data.required_columns).filter(([, req]) => req).map(([f]) => f);

    if (data.all_required_confident) {
      banner.innerHTML = `<div class="banner banner-success">All required columns matched automatically. Click <strong>Proceed</strong> to view results.</div>`;
    } else {
      banner.innerHTML = `<div class="banner banner-warning">Some columns couldn't be matched automatically \u2014 please confirm mapping below before proceeding.</div><div id="mapping-issue"></div>`;
    }
    confirmBtn.style.display = "inline-flex";
    confirmBtn.textContent = "Proceed";

    const NONE_OPTION = "\u2014 not in file \u2014";

    Object.entries(data.required_columns).forEach(([field, required]) => {
      const wrap = document.createElement("div");
      wrap.className = "map-field" + (data.confidence[field] ? " is-confident" : "");

      const label = document.createElement("div");
      label.className = "map-field-label";
      label.innerHTML = `${field}${required ? ' <span class="req">*</span>' : " (optional)"}`;

      const select = document.createElement("select");
      select.className = "select-input";
      select.dataset.field = field;

      const noneOpt = document.createElement("option");
      noneOpt.value = "";
      noneOpt.textContent = NONE_OPTION;
      select.appendChild(noneOpt);

      data.columns.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        if (data.mapping[field] === col) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", validateMapping);

      wrap.appendChild(label);
      wrap.appendChild(select);
      grid.appendChild(wrap);
    });

    function validateMapping() {
      const mapping = {};
      $$("select", grid).forEach((s) => { mapping[s.dataset.field] = s.value || null; });

      const missing = requiredFields.filter((f) => !mapping[f]);
      const chosen = Object.values(mapping).filter(Boolean);
      const dupes = [...new Set(chosen.filter((c) => chosen.filter((x) => x === c).length > 1))];

      const issueEl = $("#mapping-issue");
      let msg = "";
      if (missing.length) msg += `Still need to map: ${missing.join(", ")}. `;
      if (dupes.length) msg += `The same source column is mapped to more than one field: ${dupes.join(", ")}.`;

      if (issueEl) issueEl.innerHTML = msg ? `<div class="banner banner-danger" style="margin-top:10px;">${msg}</div>` : "";
      confirmBtn.disabled = missing.length > 0 || dupes.length > 0;
      confirmBtn.dataset.mapping = JSON.stringify(mapping);
      return mapping;
    }

    confirmBtn.disabled = false;
    confirmBtn.onclick = () => {
      const mapping = validateMapping();
      runBatchScore(mapping);
    };

    if (!data.all_required_confident) validateMapping();
  }

  // ------------------------------------------------------------------
  // Batch — scoring & results
  // ------------------------------------------------------------------
  async function runBatchScore(mapping) {
    clearGlobalError();
    const confirmBtn = $("#confirm-mapping-btn");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Processing\u2026";

    try {
      const res = await fetch("/api/score-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, mapping }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scoring failed.");

      // Switch view to dedicated results page
      $$(".view").forEach((v) => v.classList.remove("is-active"));
      $("#view-batch-results").classList.add("is-active");

      renderBatchResults(data);
    } catch (err) {
      showGlobalError(err.message);
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Proceed";
    }
  }

  // Handle Back to Upload navigation
  const backBtn = $("#back-to-upload-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      $$(".view").forEach((v) => v.classList.remove("is-active"));
      $("#view-batch").classList.add("is-active");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function renderBatchResults(data) {
    $("#stat-total").textContent = data.summary.total.toLocaleString();
    $("#stat-genuine").textContent = data.summary.genuine.toLocaleString();
    $("#stat-review").textContent = data.summary.manual_review.toLocaleString();
    $("#stat-suspicious").textContent = ((data.summary.suspicious ?? data.summary.fraud) || 0).toLocaleString();

    renderDistChart(data.top_factor_distribution);

    currentSummaryRows = data.rows;
    currentSort = "risk";
    $("#sort-select").value = "risk";
    renderTable(currentSummaryRows);

    $("#truncate-note").style.display = data.truncated ? "block" : "none";
    if (data.truncated) {
      $("#truncate-note").textContent = `Showing the first ${data.max_display_rows.toLocaleString()} rows in this view. The downloaded CSV includes every scored row.`;
    }

    $("#batch-fine-print").innerHTML =
      `Predicted_Suspicious is a self-generated risk label, not verified suspicious activity. ` +
      `Verdicts use a 3-tier threshold: below ${fmtPct(data.low_cutoff)} = Genuine, ` +
      `${fmtPct(data.low_cutoff)}\u2013${fmtPct(data.high_cutoff)} = Manual Review, ` +
      `above ${fmtPct(data.high_cutoff)} = Suspicious.`;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderDistChart(dist) {
    const container = $("#dist-chart");
    container.innerHTML = "";
    if (!dist.length) {
      container.innerHTML = `<p class="fine-print">No data.</p>`;
      return;
    }
    const max = Math.max(...dist.map((d) => d.count));
    dist.forEach((d, idx) => {
      const row = document.createElement("div");
      row.className = "dist-row";
      const targetPct = (d.count / max) * 100;
      row.innerHTML = `
        <div class="dist-label" title="${d.feature}">${d.feature}</div>
        <div class="dist-track"><div class="dist-fill" style="width:0%"></div></div>
        <div class="dist-count">${d.count.toLocaleString()}</div>
      `;
      container.appendChild(row);

      requestAnimationFrame(() => {
        setTimeout(() => {
          const fill = row.querySelector(".dist-fill");
          if (fill) fill.style.width = `${targetPct}%`;
        }, idx * 40);
      });
    });
  }

  const TABLE_COLUMNS = [
    { key: "TransactionID", label: "Transaction ID" },
    { key: "AccountID", label: "Account ID" },
    { key: "TransactionAmount", label: "Amount", fmt: (v) => `$${Number(v).toFixed(2)}` },
    { key: "LoginAttempts", label: "Login Attempts" },
    { key: "ImpossibleTravel", label: "Impossible Travel", fmt: (v) => (v ? "Yes" : "No") },
    { key: "HighLoginAttempts", label: "High Logins", fmt: (v) => (v ? "Yes" : "No") },
    { key: "Verdict", label: "Verdict", verdict: true },
    { key: "RiskProbability", label: "Risk", fmt: (v) => fmtPct(v) },
    { key: "Top_Risk_Factor", label: "Top Factor" },
    { key: "Second_Risk_Factor", label: "2nd Factor" },
  ];

  function verdictClass(v) {
    if (v === "Genuine") return "genuine";
    if (v === "Manual Review Required") return "review";
    return "suspicious";
  }

  function renderTable(rows) {
    const cols = TABLE_COLUMNS.filter((c) => rows.length && c.key in rows[0]);
    const thead = $("#results-thead");
    thead.innerHTML = cols.map((c) => `<th>${c.label}</th>`).join("");

    const tbody = $("#results-tbody");
    const sorted = [...rows].sort((a, b) =>
      currentSort === "risk" ? b.RiskProbability - a.RiskProbability : a._OriginalOrder - b._OriginalOrder
    );

    tbody.innerHTML = sorted
      .map((r) => {
        return (
          "<tr>" +
          cols
            .map((c) => {
              if (c.verdict) {
                return `<td><span class="verdict-pill ${verdictClass(r[c.key])}">${r[c.key]}</span></td>`;
              }
              const val = c.fmt ? c.fmt(r[c.key]) : r[c.key];
              return `<td>${val ?? ""}</td>`;
            })
            .join("") +
          "</tr>"
        );
      })
      .join("");
  }

  $("#sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderTable(currentSummaryRows);
  });

  $("#download-btn").addEventListener("click", () => {
    if (!currentToken) return;
    window.location.href = `/api/download/${currentToken}`;
  });

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  loadConfig().then(renderGaugeZones);
})();
