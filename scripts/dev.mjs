import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

const workspaceRoot = process.cwd();
const windowsStorePem = path.resolve(workspaceRoot, ".certs", "corp-windows-store.pem");
const bundledChainPem = path.resolve(workspaceRoot, ".certs", "corp-chain.pem");
const bundledBundlePem = path.resolve(workspaceRoot, ".certs", "corp-bundle.pem");
const bundledRootPem = path.resolve(workspaceRoot, ".certs", "corp-root.pem");

const env = { ...process.env };

// Work around occasional Turbopack/worker shutdown issues on Windows (EPERM on process.kill)
if (process.platform === "win32" && env.NEXT_DISABLE_TURBOPACK == null) {
  env.NEXT_DISABLE_TURBOPACK = "1";
  console.log("[dev] NEXT_DISABLE_TURBOPACK=1 (Windows default)");
}

const bestPem =
  (fileExists(windowsStorePem) && windowsStorePem) ||
  (fileExists(bundledChainPem) && bundledChainPem) ||
  (fileExists(bundledBundlePem) && bundledBundlePem) ||
  (fileExists(bundledRootPem) && bundledRootPem) ||
  null;

const current = env.NODE_EXTRA_CA_CERTS;
const currentLooksLegacy =
  typeof current === "string" && (current.endsWith("corp-root.pem") || current.endsWith("corp-root.cer"));
const currentMissing = typeof current === "string" && current.length > 0 && !fileExists(current);

if (bestPem && (!current || currentMissing || currentLooksLegacy)) {
  env.NODE_EXTRA_CA_CERTS = bestPem;
  console.log(`[dev] Using NODE_EXTRA_CA_CERTS=${bestPem}`);
} else if (env.NODE_EXTRA_CA_CERTS) {
  console.log(`[dev] NODE_EXTRA_CA_CERTS already set: ${env.NODE_EXTRA_CA_CERTS}`);
} else {
  console.log("[dev] NODE_EXTRA_CA_CERTS not set (no .certs/corp-*.pem found)");
}

const nextBin = path.resolve(workspaceRoot, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);

const wantsTurbopack = args.includes("--turbo") || args.includes("--turbopack");
const wantsWebpack = args.includes("--webpack");

// Next 16 defaults to Turbopack in dev; on Windows this repo has seen:
// - workspace root inference causing Tailwind to resolve from the parent folder
// - process OOM/crashes during that failure mode
// Webpack is more stable here; keep Turbopack opt-in.
const devArgs =
  process.platform === "win32" && !wantsTurbopack && !wantsWebpack
    ? ["--webpack", ...args]
    : args;

const child = spawn(process.execPath, [nextBin, "dev", ...devArgs], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  // If the dev server is stopped intentionally (Ctrl+C / SIGTERM),
  // report a clean exit so tooling doesn't treat it as a crash.
  if (signal === "SIGINT" || signal === "SIGTERM") {
    process.exit(0);
  }

  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
