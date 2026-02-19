import Link from "next/link";
import Image from "next/image";
import styles from "./appLayout.module.css";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <Image
              className={styles.logo}
              src="/belema-mark.png"
              alt="Belema"
              width={28}
              height={28}
              priority
            />
            <span>Belema</span>
          </div>

          <nav className={styles.nav}>
            <Link className={styles.pill} href="/app">
              Home
            </Link>
            <Link className={styles.pill} href="/app/runs">
              Runs
            </Link>
            <Link className={styles.pill} href="/app/recon">
              Recon
            </Link>
          </nav>

          <div className={styles.right}>
            <Link className={styles.signout} href="/api/auth/signout">
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.card}>{children}</div>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerRow}>
          <strong>© 2026 Tambo Consulting LLC.</strong>
          <span className={styles.dot}>•</span>
          <span>All rights reserved.</span>
          <span className={styles.dot}>•</span>
          <span>Confidential — do not distribute.</span>
        </div>
      </footer>
    </div>
  );
}

