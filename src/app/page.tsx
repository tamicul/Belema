import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "48px auto", padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Belema</h1>
      <p style={{ color: "#555" }}>Reconciliation platform scaffold.</p>

      <ul>
        <li>
          <Link href="/signin">Sign in</Link>
        </li>
        <li>
          <Link href="/app">Go to app</Link>
        </li>
      </ul>

      <hr style={{ margin: "24px 0" }} />
      <p style={{ color: "#777" }}>
        Dev note: run <code>npm run seed</code> to create the default admin user.
      </p>
    </main>
  );
}
