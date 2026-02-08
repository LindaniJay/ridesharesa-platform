import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });

    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function getNodeMajor() {
  const raw = process.versions?.node ?? "";
  const major = Number.parseInt(String(raw).split(".")[0] ?? "", 10);
  return Number.isFinite(major) ? major : null;
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

// Keep Prisma Client types in sync for dev (e.g. enums like BookingStatus).
// On Windows, prisma generate can fail with EPERM if the query engine DLL is temporarily locked;
// a short retry usually fixes it.
const prismaCli = path.resolve(workspaceRoot, "node_modules", "prisma", "build", "index.js");
console.log("[dev] prisma generate");
{
  const nodeMajor = getNodeMajor();
  const generatedClientDts = path.resolve(workspaceRoot, "node_modules", ".prisma", "client", "index.d.ts");
  const generatedClientJs = path.resolve(workspaceRoot, "node_modules", ".prisma", "client", "index.js");
  const hasGeneratedClient = fileExists(generatedClientDts) || fileExists(generatedClientJs);

  // Prisma CLI has been seen to crash on non-LTS Node versions (e.g. v23).
  // If we already have a generated client, don't block `next dev` on this step.
  if (nodeMajor != null && nodeMajor >= 23) {
    if (hasGeneratedClient) {
      console.log(
        `[dev] WARNING: Detected Node.js v${process.versions.node}. Skipping prisma generate because Prisma may not support this Node version.`
      );
    } else {
      console.error(
        `[dev] ERROR: Detected Node.js v${process.versions.node} and no generated Prisma client was found.\n` +
          "[dev] Please use an LTS Node version (20 or 22), then run: npm run db:generate"
      );
      process.exit(1);
    }
  } else {
  const maxAttempts = process.platform === "win32" ? 3 : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await run(process.execPath, [prismaCli, "generate"], { env });
    if (!result.signal && result.code === 0) break;

    if (attempt === maxAttempts) {
      // If Prisma generation fails but a previous client exists, allow dev to continue.
      // This keeps `next dev` usable when Prisma CLI is unstable on the current Node.
      if (hasGeneratedClient) {
        console.log(
          `[dev] WARNING: prisma generate failed, but an existing generated client was found. Continuing without regenerating.`
        );
        break;
      }

      if (result.signal) process.exit(1);
      process.exit(result.code);
    }

    console.log(`[dev] prisma generate failed (attempt ${attempt}/${maxAttempts}). Retrying...`);
    await sleep(600);
  }
  }
}

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
