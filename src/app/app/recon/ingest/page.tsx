"use client";

import { useState } from "react";

export default function ReconIngestPage() {
  const [orgId, setOrgId] = useState("");
  const [runId, setRunId] = useState("");
  const [type, setType] = useState<"SHOPIFY" | "BANK">("SHOPIFY");
  const [filename, setFilename] = useState(type === "SHOPIFY" ? "shopify_payouts.csv" : "bank_statement.csv");
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/recon/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orgId, runId: runId || undefined, filename, type, csvText }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP_${res.status}`);
      setResult(j.report);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Recon CSV ingest (dev/demo)</h1>
      <p style={{ opacity: 0.8 }}>
        Paste CSV text below and ingest into Postgres. Requires DB to be running and migrations applied.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Org ID
          <input value={orgId} onChange={(e) => setOrgId(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          Run ID (optional)
          <input value={runId} onChange={(e) => setRunId(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          Type
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value as any;
              setType(t);
              setFilename(t === "SHOPIFY" ? "shopify_payouts.csv" : "bank_statement.csv");
            }}
          >
            <option value="SHOPIFY">Shopify payouts CSV</option>
            <option value="BANK">Bank statement CSV</option>
          </select>
        </label>
        <label>
          Filename
          <input value={filename} onChange={(e) => setFilename(e.target.value)} style={{ width: "100%" }} />
        </label>
        <label>
          CSV text
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={16}
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>

        <button onClick={submit} style={{ width: 200 }}>
          Ingest
        </button>

        {err && <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{err}</pre>}
        {result && <pre style={{ background: "#111", color: "#0f0", padding: 12 }}>{JSON.stringify(result, null, 2)}</pre>}
      </div>
    </div>
  );
}
