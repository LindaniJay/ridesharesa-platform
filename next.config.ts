import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const disableTurbopack = (() => {
  const raw = process.env.NEXT_DISABLE_TURBOPACK;
  if (!raw) return false;
  return raw === "1" || raw.toLowerCase() === "true";
})();

const supabaseHost = (() => {
  const raw = process.env.SUPABASE_URL;
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  // Avoid Next.js inferring the parent folder as the workspace root on Windows
  // when multiple lockfiles exist (can break tracing and dependency resolution).
  outputFileTracingRoot: projectRoot,
  ...(disableTurbopack
    ? {}
    : {
        turbopack: {
          // Prevent Next from picking the parent Downloads folder as the workspace root
          root: projectRoot,
        },
      }),
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
