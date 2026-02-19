import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence Turbopack workspace-root confusion in monorepo layouts.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
