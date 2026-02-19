"use client";

import { useState } from "react";

type Choice = {
  id: string;
  label: string;
};

export default function SelectPairForm(props: {
  shopifyChoices: Choice[];
  bankChoices: Choice[];
  defaultShopifyId?: string;
  defaultBankId?: string;
}) {
  const [shopifyId, setShopifyId] = useState(props.defaultShopifyId || "");
  const [bankId, setBankId] = useState(props.defaultBankId || "");

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720 }}>
      <label>
        Shopify payouts ingest
        <select value={shopifyId} onChange={(e) => setShopifyId(e.target.value)} style={{ width: "100%" }}>
          <option value="">Select…</option>
          {props.shopifyChoices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Bank statement ingest
        <select value={bankId} onChange={(e) => setBankId(e.target.value)} style={{ width: "100%" }}>
          <option value="">Select…</option>
          {props.bankChoices.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="shopifySourceFileId" value={shopifyId} />
      <input type="hidden" name="bankSourceFileId" value={bankId} />

      <button
        type="submit"
        disabled={!shopifyId || !bankId}
        style={{ padding: 10, border: "1px solid #111", borderRadius: 6, width: 220 }}
      >
        Create recon run
      </button>

      <p style={{ color: "#666" }}>
        Tip: if you ingested multiple test files, use <a href="/app/recon/ingests">Ingest history</a> to find the right pair
        by timestamp + id.
      </p>
    </div>
  );
}
