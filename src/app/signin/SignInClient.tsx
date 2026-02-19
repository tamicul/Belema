"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function SignInClient() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/app";

  const [email, setEmail] = useState("admin@belema.local");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main style={{ maxWidth: 420, margin: "48px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Belema</h1>
      <p style={{ marginTop: 0, color: "#555" }}>Sign in (dev credentials)</p>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setLoading(true);
          const res = await signIn("credentials", {
            email,
            password,
            callbackUrl,
            redirect: false,
          });
          setLoading(false);
          if (res?.error) setError("Invalid email or password");
          if (res?.ok) window.location.href = callbackUrl;
        }}
      >
        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#333", marginBottom: 4 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
          />
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 12, color: "#333", marginBottom: 4 }}>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
          />
        </label>

        {error ? <p style={{ color: "#b00020" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{ marginTop: 16, width: "100%", padding: 10, borderRadius: 6, border: "1px solid #111" }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
