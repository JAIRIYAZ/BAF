"""
BAF — Transaction Risk Console (backend)
==============================================
Flask API that serves a LightGBM fraud-risk model (trained on a
self-generated, multi-feature balanced risk label — see
RETRAINING_NOTES.md if you have it) and explains predictions with SHAP.

This replaces the previous Streamlit prototype. All scoring logic is
unchanged; only the interface layer is new (JSON API + a static
single-page frontend in /static and /templates).

Required files in this same folder:
    model_pathA.pkl
    scaler_pathA.pkl
    feature_cols_pathA.pkl

Run:
    pip install -r requirements.txt
    python app.py
Then open http://127.0.0.1:5000
"""

from __future__ import annotations

import os

# Must be set before numpy / lightgbm / shap are imported. On Windows in
# particular, numpy/scikit-learn and lightgbm/shap each ship their own copy
# of the Intel OpenMP runtime (libiomp5md.dll). When both get exercised
# heavily in the same process — e.g. running SHAP across a large batch of
# rows right after scikit-learn has used its own copy — they can collide
# and hard-crash the whole Python process (no Python traceback, connection
# just resets). This tells OpenMP to tolerate the duplicate instead of
# aborting. See: https://github.com/dmlc/xgboost/issues/1715 (same root
# cause is common to xgboost/lightgbm/shap on Windows).
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
# Also cap OpenMP's thread pool — most of the crash risk comes from thread
# contention between libraries, not from raw compute, and this workload is
# small enough that single-threaded SHAP is still fast.
os.environ.setdefault("OMP_NUM_THREADS", "1")

import io
import uuid
import gc
import traceback

import numpy as np
import pandas as pd
from flask import Flask, jsonify, request, render_template, send_file, abort

try:
    import joblib
    import shap
    IMPORT_ERROR = None
except Exception as e:  # noqa: BLE001 - missing deps should surface in the UI, not crash the process
    joblib = None
    shap = None
    IMPORT_ERROR = str(e)

# --------------------------------------------------------------------------
# Config
# --------------------------------------------------------------------------

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB upload cap

POP_AMOUNT_MEAN = 297.59
POP_AMOUNT_STD = 291.95

# 3-tier risk thresholds. Tunable — a reasonable starting point, not a
# value discovered from data. Real deployments tune these against a cost
# model (cost of a false block vs. cost of missed fraud).
LOW_RISK_CUTOFF = 0.30
HIGH_RISK_CUTOFF = 0.70

MAX_DISPLAY_ROWS = 2000  # rows returned inline for the table; download has all of them

REQUIRED_COLUMNS = {
    "AccountID": True,
    "TransactionAmount": True,
    "TransactionDate": True,
    "Location": True,
    "DeviceID": True,
    "LoginAttempts": True,
    "AccountBalance": True,
    "TransactionDuration": True,
    "TransactionID": False,
}

# In-memory store for uploaded / scored batches. This is a single-user
# local tool, so a process-lifetime dict is enough — nothing is written
# to disk beyond what the user explicitly downloads.
SESSIONS: dict[str, dict] = {}

# --------------------------------------------------------------------------
# Model loading
# --------------------------------------------------------------------------

MODEL = None
SCALER = None
FEATURE_COLS = None
EXPLAINER = None
LOAD_ERROR = IMPORT_ERROR

if LOAD_ERROR is None:
    try:
        MODEL = joblib.load("model_pathA.pkl")
        SCALER = joblib.load("scaler_pathA.pkl")
        FEATURE_COLS = joblib.load("feature_cols_pathA.pkl")
        EXPLAINER = shap.TreeExplainer(MODEL)
    except Exception as e:  # noqa: BLE001 - surface any load failure to the UI
        LOAD_ERROR = str(e)


# --------------------------------------------------------------------------
# Shared scoring helpers (logic ported 1:1 from the original app)
# --------------------------------------------------------------------------


def classify_risk(proba: float):
    if proba < LOW_RISK_CUTOFF:
        return "Genuine"
    elif proba < HIGH_RISK_CUTOFF:
        return "Manual Review Required"
    else:
        return "Suspicious"


def shap_class1_values(sv, x_scaled_df):
    """Normalize SHAP's output shape across binary-classifier SHAP versions."""
    if isinstance(sv, list):
        return sv[1]
    if sv.ndim == 3:
        return sv[:, :, 1]
    return sv


def compute_shap_in_chunks(x_scaled_df: pd.DataFrame, chunk_size: int = 250) -> np.ndarray:
    """Run the SHAP explainer in smaller batches instead of one large call.

    A single call across a large dataframe is the main trigger for the
    OpenMP crash described above (heaviest sustained load on the native
    thread pool). Chunking keeps each call small and releases memory
    between chunks, which is far less likely to crash even without the
    environment-variable workaround.
    """
    n = len(x_scaled_df)
    if n <= chunk_size:
        sv = EXPLAINER.shap_values(x_scaled_df)
        return shap_class1_values(sv, x_scaled_df)

    parts = []
    for start in range(0, n, chunk_size):
        chunk = x_scaled_df.iloc[start:start + chunk_size]
        sv = EXPLAINER.shap_values(chunk)
        parts.append(shap_class1_values(sv, chunk))
        gc.collect()
    return np.concatenate(parts, axis=0)


def get_shap_contributions(x_scaled_df, feature_names):
    sv = EXPLAINER.shap_values(x_scaled_df)
    class1 = shap_class1_values(sv, x_scaled_df)
    row = class1[0]
    df = pd.DataFrame({"feature": feature_names, "impact": row})
    df["abs_impact"] = df["impact"].abs()
    return df.sort_values("abs_impact", ascending=False).drop(columns="abs_impact")


def engineer_features(amount, balance, prev_balance, login_attempts,
                       hours_since_last, duration, location_changed, device_changed):
    amount_to_balance_ratio = amount / balance
    amount_zscore = (amount - POP_AMOUNT_MEAN) / POP_AMOUNT_STD
    impossible_travel = int(location_changed and hours_since_last < 2)
    high_login_attempts = int(login_attempts > 1)
    balance_change_abs = abs(balance - prev_balance)

    return {
        "TransactionAmount": amount,
        "AmountToBalanceRatio": amount_to_balance_ratio,
        "AmountZScore": amount_zscore,
        "My_TimeSinceLastTxn_Hours": hours_since_last,
        "LocationChanged": int(location_changed),
        "DeviceChanged": int(device_changed),
        "ImpossibleTravel": impossible_travel,
        "HighLoginAttempts": high_login_attempts,
        "BalanceChangeAbs": balance_change_abs,
        "LoginAttempts": login_attempts,
        "TransactionDuration": duration,
    }


def engineer_features_batch(df: pd.DataFrame) -> pd.DataFrame:
    d = df.copy()
    d["TransactionDate"] = pd.to_datetime(d["TransactionDate"])
    d = d.sort_values(["AccountID", "TransactionDate"]).reset_index(drop=True)

    prev_date = d.groupby("AccountID")["TransactionDate"].shift(1)
    d["My_TimeSinceLastTxn_Hours"] = (d["TransactionDate"] - prev_date).dt.total_seconds() / 3600
    d["My_TimeSinceLastTxn_Hours"] = d["My_TimeSinceLastTxn_Hours"].fillna(
        d["My_TimeSinceLastTxn_Hours"].median() if d["My_TimeSinceLastTxn_Hours"].notna().any() else 9999
    )

    d["AmountToBalanceRatio"] = d["TransactionAmount"] / d["AccountBalance"]

    acc_mean = d.groupby("AccountID")["TransactionAmount"].transform("mean")
    acc_std = d.groupby("AccountID")["TransactionAmount"].transform("std")
    d["AmountZScore"] = (d["TransactionAmount"] - acc_mean) / acc_std.replace(0, np.nan)
    d["AmountZScore"] = d["AmountZScore"].fillna(0)

    prev_location = d.groupby("AccountID")["Location"].shift(1)
    d["LocationChanged"] = (prev_location.notna() & (d["Location"] != prev_location)).astype(int)
    if "DeviceID" in d.columns:
        prev_device = d.groupby("AccountID")["DeviceID"].shift(1)
        d["DeviceChanged"] = (prev_device.notna() & (d["DeviceID"] != prev_device)).astype(int)
    else:
        d["DeviceChanged"] = 0

    d["ImpossibleTravel"] = (
        (d["LocationChanged"] == 1) & (d["My_TimeSinceLastTxn_Hours"] < 2)
    ).astype(int)
    d["HighLoginAttempts"] = (d["LoginAttempts"] > 1).astype(int)

    prev_balance = d.groupby("AccountID")["AccountBalance"].shift(1)
    d["BalanceChangeAbs"] = (d["AccountBalance"] - prev_balance).abs().fillna(0)

    return d


def best_guess(field, columns):
    if field in columns:
        return field
    lower_map = {c.lower(): c for c in columns}
    if field.lower() in lower_map:
        return lower_map[field.lower()]
    key = field.lower().replace("_", "")
    for c in columns:
        if key in c.lower().replace("_", "").replace(" ", ""):
            return c
    return None


def require_model():
    if LOAD_ERROR is not None:
        abort(503, description=(
            f"Model files could not be loaded: {LOAD_ERROR}. Place model_pathA.pkl, "
            "scaler_pathA.pkl and feature_cols_pathA.pkl next to app.py."
        ))


def jsonify_records(df: pd.DataFrame):
    """Convert a dataframe to JSON-safe records (numpy scalars -> python)."""
    out = df.copy()
    for c in out.columns:
        if pd.api.types.is_datetime64_any_dtype(out[c]):
            out[c] = out[c].astype(str)
    return out.astype(object).where(pd.notnull(out), None).to_dict(orient="records")


# --------------------------------------------------------------------------
# Routes — pages
# --------------------------------------------------------------------------


@app.route("/")
def index():
    # Serve the React production build if it exists
    react_index = os.path.join(app.static_folder, "react", "index.html")
    if os.path.exists(react_index):
        return send_file(react_index)
    # Fallback to old template for dev (when using Vite dev server directly)
    return render_template("index.html")


# --------------------------------------------------------------------------
# Routes — API
# --------------------------------------------------------------------------


@app.route("/api/config")
def api_config():
    return jsonify({
        "model_loaded": LOAD_ERROR is None,
        "load_error": LOAD_ERROR,
        "low_cutoff": LOW_RISK_CUTOFF,
        "high_cutoff": HIGH_RISK_CUTOFF,
        "feature_cols": FEATURE_COLS,
        "model_type": type(MODEL).__name__ if MODEL is not None else None,
        "required_columns": REQUIRED_COLUMNS,
    })


@app.route("/api/score", methods=["POST"])
def api_score():
    require_model()
    payload = request.get_json(force=True, silent=True) or {}

    try:
        amount = float(payload["amount"])
        balance = float(payload["balance"])
        prev_balance = float(payload["prev_balance"])
        login_attempts = int(payload["login_attempts"])
        hours_since_last = float(payload["hours_since_last"])
        duration = float(payload["duration"])
        location_changed = bool(payload["location_changed"])
        device_changed = bool(payload["device_changed"])
    except (KeyError, TypeError, ValueError) as e:
        return jsonify({"error": f"Invalid or missing field: {e}"}), 400

    if balance <= 0:
        return jsonify({"error": "Account balance must be greater than zero."}), 400

    features = engineer_features(
        amount, balance, prev_balance, login_attempts,
        hours_since_last, duration, location_changed, device_changed,
    )

    x_df = pd.DataFrame([[features[c] for c in FEATURE_COLS]], columns=FEATURE_COLS)
    x_scaled = pd.DataFrame(SCALER.transform(x_df), columns=FEATURE_COLS)
    proba = float(MODEL.predict_proba(x_scaled)[0][1])
    verdict = classify_risk(proba)

    shap_df = get_shap_contributions(x_scaled, FEATURE_COLS)
    shap_list = [
        {"feature": r.feature, "impact": float(r.impact)}
        for r in shap_df.itertuples(index=False)
    ]
    top_driver = shap_df.iloc[0]

    return jsonify({
        "probability": proba,
        "verdict": verdict,
        "low_cutoff": LOW_RISK_CUTOFF,
        "high_cutoff": HIGH_RISK_CUTOFF,
        "shap": shap_list,
        "top_factor": {
            "feature": top_driver["feature"],
            "impact": float(top_driver["impact"]),
            "direction": "toward Suspicious" if top_driver["impact"] > 0 else "toward Genuine",
        },
        "top3": shap_df["feature"].head(3).tolist(),
        "engineered_features": features,
    })


@app.route("/api/upload", methods=["POST"])
def api_upload():
    require_model()
    if "file" not in request.files:
        return jsonify({"error": "No file was sent."}), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify({"error": "No file was selected."}), 400

    try:
        raw_df = pd.read_csv(f)
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Could not read this file as a CSV: {e}"}), 400

    if raw_df.empty:
        return jsonify({"error": "The uploaded CSV has no rows."}), 400

    token = uuid.uuid4().hex
    SESSIONS[token] = {"raw_df": raw_df, "filename": f.filename}

    file_columns = raw_df.columns.tolist()
    mapping, confidence = {}, {}
    for field in REQUIRED_COLUMNS:
        guess = best_guess(field, file_columns)
        mapping[field] = guess
        confidence[field] = guess is not None and (
            guess.lower().replace("_", "").replace(" ", "") == field.lower()
        )

    required_fields = [f for f, req in REQUIRED_COLUMNS.items() if req]
    all_required_confident = all(confidence[f] for f in required_fields)

    return jsonify({
        "token": token,
        "filename": f.filename,
        "row_count": int(len(raw_df)),
        "col_count": int(len(raw_df.columns)),
        "columns": file_columns,
        "required_columns": REQUIRED_COLUMNS,
        "mapping": mapping,
        "confidence": confidence,
        "all_required_confident": all_required_confident,
    })


@app.route("/api/score-batch", methods=["POST"])
def api_score_batch():
    require_model()
    payload = request.get_json(force=True, silent=True) or {}
    token = payload.get("token")
    mapping = payload.get("mapping") or {}

    session = SESSIONS.get(token)
    if session is None:
        return jsonify({"error": "This upload session has expired. Please upload the file again."}), 404

    required_fields = [f for f, req in REQUIRED_COLUMNS.items() if req]
    missing_required = [f for f in required_fields if not mapping.get(f)]
    chosen_cols = [v for v in mapping.values() if v]
    duplicate_cols = sorted({c for c in chosen_cols if chosen_cols.count(c) > 1})

    if missing_required:
        return jsonify({"error": f"Still need to map: {', '.join(missing_required)}"}), 400
    if duplicate_cols:
        return jsonify({
            "error": f"The same source column is mapped to more than one field: {', '.join(duplicate_cols)}"
        }), 400

    raw_df = session["raw_df"]
    rename_map = {v: k for k, v in mapping.items() if v}
    mapped_df = raw_df.rename(columns=rename_map)

    try:
        feat_df = engineer_features_batch(mapped_df)
        x_input = feat_df[FEATURE_COLS]
        x_scaled = pd.DataFrame(SCALER.transform(x_input), columns=FEATURE_COLS)
        proba = MODEL.predict_proba(x_scaled)[:, 1]
    except Exception as e:  # noqa: BLE001
        return jsonify({"error": f"Scoring failed: {e}"}), 400

    feat_df["RiskProbability"] = proba.round(4)
    feat_df["Verdict"] = np.select(
        [proba < LOW_RISK_CUTOFF, proba < HIGH_RISK_CUTOFF],
        ["Genuine", "Manual Review Required"],
        default="Suspicious",
    )

    class1_arr = compute_shap_in_chunks(x_scaled, chunk_size=250)
    top_idx = np.argmax(np.abs(class1_arr), axis=1)
    feat_df["Top_Risk_Factor"] = [FEATURE_COLS[i] for i in top_idx]
    sorted_idx = np.argsort(-np.abs(class1_arr), axis=1)
    feat_df["Second_Risk_Factor"] = [FEATURE_COLS[row[1]] for row in sorted_idx]

    feat_df["_OriginalOrder"] = range(len(feat_df))
    feat_df_sorted = feat_df.sort_values("RiskProbability", ascending=False).reset_index(drop=True)

    SESSIONS[token]["scored_df"] = feat_df_sorted

    suspicious_count = int((feat_df_sorted["Verdict"] == "Suspicious").sum())
    summary = {
        "total": int(len(feat_df_sorted)),
        "genuine": int((feat_df_sorted["Verdict"] == "Genuine").sum()),
        "manual_review": int((feat_df_sorted["Verdict"] == "Manual Review Required").sum()),
        "suspicious": suspicious_count,
        "fraud": suspicious_count,
    }

    top_factor_counts = (
        feat_df_sorted["Top_Risk_Factor"].value_counts().reset_index()
    )
    top_factor_counts.columns = ["feature", "count"]
    top_factor_dist = [
        {"feature": r.feature, "count": int(r.count)} for r in top_factor_counts.itertuples(index=False)
    ]

    display_cols = [c for c in [
        "_OriginalOrder", "TransactionID", "AccountID", "TransactionAmount", "LoginAttempts",
        "ImpossibleTravel", "HighLoginAttempts",
        "Verdict", "RiskProbability", "Top_Risk_Factor", "Second_Risk_Factor",
    ] if c in feat_df_sorted.columns]

    rows_df = feat_df_sorted[display_cols].head(MAX_DISPLAY_ROWS)
    truncated = len(feat_df_sorted) > MAX_DISPLAY_ROWS

    return jsonify({
        "summary": summary,
        "top_factor_distribution": top_factor_dist,
        "rows": jsonify_records(rows_df),
        "truncated": truncated,
        "max_display_rows": MAX_DISPLAY_ROWS,
        "low_cutoff": LOW_RISK_CUTOFF,
        "high_cutoff": HIGH_RISK_CUTOFF,
    })


@app.route("/api/download/<token>")
def api_download(token):
    session = SESSIONS.get(token)
    if session is None or "scored_df" not in session:
        return jsonify({"error": "No scored results found for this session."}), 404

    df = session["scored_df"].drop(columns=["_OriginalOrder"], errors="ignore")
    buf = io.BytesIO()
    buf.write(df.to_csv(index=False).encode("utf-8"))
    buf.seek(0)
    return send_file(
        buf,
        mimetype="text/csv",
        as_attachment=True,
        download_name="scored_transactions.csv",
    )


@app.errorhandler(503)
def service_unavailable(e):
    return jsonify({"error": str(e.description)}), 503


@app.errorhandler(500)
def internal_error(e):
    traceback.print_exc()
    return jsonify({"error": "Internal server error."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
