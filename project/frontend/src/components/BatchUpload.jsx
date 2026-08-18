import React, { useState, useRef } from "react";
import { uploadCSV, scoreBatch } from "../lib/api";

/**
 * Batch upload view — drag-drop zone, file chip, column mapping.
 */
export default function BatchUpload({ onResults, onError }) {
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState(null);
  const [fileChipText, setFileChipText] = useState("");
  const [mapping, setMapping] = useState({});
  const [processing, setProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef(null);

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setFileChipText(`Uploading ${file.name}…`);
    setUploadData(null);

    try {
      const data = await uploadCSV(file);
      setUploadData(data);
      setFileChipText(`${data.filename} · ${data.row_count.toLocaleString()} rows · ${data.col_count} columns`);

      // Initialize mapping from server suggestion
      setMapping({ ...data.mapping });
    } catch (err) {
      setFileChipText("");
      onError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleMappingChange = (field, value) => {
    setMapping((m) => ({ ...m, [field]: value || null }));
  };

  // Validation
  const requiredFields = uploadData
    ? Object.entries(uploadData.required_columns).filter(([, req]) => req).map(([f]) => f)
    : [];
  const chosen = Object.values(mapping).filter(Boolean);
  const missing = requiredFields.filter((f) => !mapping[f]);
  const dupes = [...new Set(chosen.filter((c) => chosen.filter((x) => x === c).length > 1))];
  const canProceed = missing.length === 0 && dupes.length === 0;

  const handleProceed = async () => {
    if (!uploadData || !canProceed) return;
    setProcessing(true);
    try {
      const data = await scoreBatch(uploadData.token, mapping);
      onResults({ ...data, token: uploadData.token });
    } catch (err) {
      onError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section className="view-enter">
      <header className="mb-6">
        <h1 className="font-display text-[26px] font-semibold m-0 mb-1.5 tracking-[0.1px]">Batch analysis</h1>
        <p className="text-text-secondary m-0 max-w-[62ch]">
          Upload a transaction CSV — even with different column names or extra columns your bank system adds. You'll confirm the column mapping before scoring.
        </p>
      </header>

      {/* Upload card */}
      <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] mb-5">
        <div
          className={`border-[1.5px] border-dashed rounded-[var(--radius-md)] px-5 py-10 text-center cursor-pointer text-text-secondary transition-all duration-150
            ${isDragging ? "border-brass bg-brass-tint" : "border-paper-border-strong hover:border-brass hover:bg-brass-tint"}`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <svg className="w-[30px] h-[30px] mx-auto mb-2.5 text-text-muted" viewBox="0 0 40 40" fill="none">
            <path d="M20 26V10M20 10l-6 6M20 10l6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 28v3a3 3 0 0 0 3 3h18a3 3 0 0 0 3-3v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <p className="m-0 mb-1 text-text-primary"><strong>Drop a CSV file</strong> here, or click to browse</p>
          <span className="text-[11.5px] text-text-muted block max-w-[460px] mx-auto mt-1">
            Required columns: AccountID, TransactionAmount, TransactionDate, Location, DeviceID, LoginAttempts, AccountBalance, TransactionDuration
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => e.target.files.length && handleFile(e.target.files[0])}
          />
        </div>

        {fileChipText && (
          <div className="mt-3.5 inline-flex items-center gap-2 bg-paper border border-paper-border rounded-full px-3.5 py-1.5 font-mono text-xs">
            {fileChipText}
          </div>
        )}
      </div>

      {/* Mapping card */}
      {uploadData && (
        <div className="bg-paper-raised border border-paper-border rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-card)] view-enter">
          <h2 className="font-display text-[17px] font-semibold m-0 mb-1">Column mapping</h2>

          {/* Status banner */}
          {uploadData.all_required_confident ? (
            <div className="bg-genuine-bg text-genuine p-3 rounded-[var(--radius-sm)] text-[13px] mt-3 leading-relaxed">
              All required columns matched automatically. Click <strong>Proceed</strong> to view results.
            </div>
          ) : (
            <div className="bg-review-bg text-review p-3 rounded-[var(--radius-sm)] text-[13px] mt-3 leading-relaxed">
              Some columns couldn't be matched automatically — please confirm mapping below before proceeding.
            </div>
          )}

          {/* Validation errors */}
          {(missing.length > 0 || dupes.length > 0) && (
            <div className="bg-suspicious-bg text-suspicious p-3 rounded-[var(--radius-sm)] text-[13px] mt-2.5 leading-relaxed">
              {missing.length > 0 && `Still need to map: ${missing.join(", ")}. `}
              {dupes.length > 0 && `The same source column is mapped to more than one field: ${dupes.join(", ")}.`}
            </div>
          )}

          {/* Mapping grid */}
          <div className="grid grid-cols-2 gap-x-5 gap-y-3 my-4">
            {Object.entries(uploadData.required_columns).map(([field, required]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <div className="text-xs text-text-secondary">
                  {field}
                  {required ? <span className="text-suspicious ml-1">*</span> : " (optional)"}
                </div>
                <select
                  value={mapping[field] || ""}
                  onChange={(e) => handleMappingChange(field, e.target.value)}
                  className={`border bg-paper rounded-[var(--radius-sm)] px-2.5 py-2 font-body text-[12.5px] cursor-pointer w-full transition-all duration-150 focus:border-brass focus:shadow-[0_0_0_3px_rgba(169,124,63,0.14)] focus:outline-none
                    ${uploadData.confidence[field] ? "border-genuine" : "border-paper-border-strong"}`}
                >
                  <option value="">— not in file —</option>
                  {uploadData.columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Proceed button */}
          <div className="flex justify-end mt-4">
            <button
              onClick={handleProceed}
              disabled={!canProceed || processing}
              className="bg-brass text-white border-none rounded-[var(--radius-sm)] px-4 py-3 text-[13.5px] font-semibold cursor-pointer transition-all duration-150 hover:brightness-[1.06] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? "Processing…" : "Proceed"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
