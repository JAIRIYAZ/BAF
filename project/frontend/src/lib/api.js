/**
 * Sentinel — API client
 * Wraps all Flask backend endpoints.
 */

const BASE = "";  // same origin in production; Vite proxy in dev

export async function fetchConfig() {
  const res = await fetch(`${BASE}/api/config`);
  if (!res.ok) throw new Error("Could not reach the backend API. Is the Flask server running?");
  return res.json();
}

export async function scoreTransaction(payload) {
  const res = await fetch(`${BASE}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Scoring failed.");
  return data;
}

export async function uploadCSV(file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed.");
  return data;
}

export async function scoreBatch(token, mapping) {
  const res = await fetch(`${BASE}/api/score-batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, mapping }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Scoring failed.");
  return data;
}

export function getDownloadUrl(token) {
  return `${BASE}/api/download/${token}`;
}
