# Sentinel — Transaction Risk Console

A fraud-risk scoring application for your LightGBM model, with a custom
Flask API backend and a hand-built frontend (no Streamlit). All original
scoring logic — feature engineering, the 3-tier risk threshold, and SHAP
explanations — is unchanged; only the interface is new.

## What's here

```
app.py                     Flask backend + JSON API (all ML logic)
templates/index.html       Single-page frontend markup
static/css/style.css       Design system (navy / brass / paper banking theme)
static/js/app.js           Frontend logic (fetches the API, renders charts)
model_pathA.pkl            Your trained LightGBM model
scaler_pathA.pkl           Your fitted scaler
feature_cols_pathA.pkl     Feature column order
bank_transactions_data_2.csv  Sample data you can use to try Batch Analysis
requirements.txt           Python dependencies (Streamlit removed, Flask added)
```

## Run it

```bash
pip install -r requirements.txt
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## What it does

**Score Transaction** — enter a single transaction's details and get an
instant verdict (Genuine / Manual Review Required / Fraud), a risk gauge,
and a SHAP-based breakdown of which features pushed the score up or down.

**Batch Analysis** — drop in any transaction CSV. Columns are matched to
what the model needs automatically where possible; anything ambiguous is
left for you to confirm before scoring. Results include summary counts,
a chart of which feature drove each verdict most often, a sortable table,
and a CSV download of every scored row (not just what's shown on screen).

Both views use the same 3-tier thresholds as before (below 30% = Genuine,
30–70% = Manual Review, above 70% = Fraud) — shown in the sidebar and
configurable in `app.py` (`LOW_RISK_CUTOFF` / `HIGH_RISK_CUTOFF`).

## Troubleshooting: Batch Analysis fails with "Failed to fetch" / connection reset

This is a known Windows issue, not a bug in the mapping or scoring logic
itself: scikit-learn and lightgbm/shap each bundle their own copy of the
Intel OpenMP runtime (`libiomp5md.dll`), and running SHAP across a large
batch of rows can make them collide and hard-crash the Python process —
with no Python traceback, just a dropped connection. `app.py` now sets
`KMP_DUPLICATE_LIB_OK=TRUE` and `OMP_NUM_THREADS=1` before any ML library
is imported, and computes batch SHAP values in chunks of 250 rows instead
of one large call, both of which avoid this. If you still hit it after
pulling the latest `app.py`, try running via `waitress` instead of the
built-in dev server (`pip install waitress`, then
`waitress-serve --port=5000 app:app`), which tends to be more stable than
Flask's dev server for CPU-heavy requests on Windows.

## Notes

- This is built to run locally / on your own server. Uploaded CSVs are
  held in memory only for the current session (not written to disk) and
  are cleared when the process restarts.
- `Predicted_Fraud` is a self-generated risk label from a composite of
  behavioral signals, not verified fraud — this is carried through into
  the UI's disclaimers exactly as it was in the original app.
