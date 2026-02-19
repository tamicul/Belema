import { Suspense } from "react";
import SignInClient from "./SignInClient";

export default function SignInPage() {
  // Next.js requires useSearchParams() to be wrapped in Suspense for prerender/build.
  return (
    <Suspense fallback={<div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>Loading…</div>}>
      <SignInClient />
    </Suspense>
  );
}
