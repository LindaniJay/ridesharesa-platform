import { spawn } from "node:child_process";
import path from "node:path";

const workspaceRoot = process.cwd();
const env = { ...process.env };

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
      ...options,
    });

    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 1, signal });
    });
  });
}

function runWithCapture(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(chunk);
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(chunk);
    });

    child.on("exit", (code, signal) => {
      resolve({ code: code ?? 1, signal, stdout, stderr });
    });
  });
}

async function runOrExit(command, args, options = {}) {
  const result = await run(command, args, options);
  if (result.signal) process.exit(1);
  if (result.code !== 0) process.exit(result.code);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isPrismaWindowsEngineLocked(text) {
  if (!text) return false;
  return (
    /EPERM: operation not permitted, rename/i.test(text) &&
    /query_engine-windows\.dll\.node\.tmp/i.test(text) &&
    /query_engine-windows\.dll\.node/i.test(text)
  );
}

function printPrismaWindowsEpermHelp() {
  console.log("[build] Prisma engine DLL appears to be locked (Windows EPERM rename).\n");
  console.log("[build] Common causes:");
  console.log("[build] - A running dev server (npm run dev) or Prisma Studio holding the query engine open");
  console.log("[build] - Antivirus / indexing temporarily locking node_modules files\n");
  console.log("[build] Fix:");
  console.log("[build] - Stop any 'npm run dev' terminals/background processes");
  console.log("[build] - Close Prisma Studio (if open)");
  console.log("[build] - Retry 'npm run build' (sometimes a short wait is enough)\n");
}

// Work around occasional Turbopack/worker shutdown issues on Windows (EPERM on process.kill)
if (process.platform === "win32" && env.NEXT_DISABLE_TURBOPACK == null) {
  env.NEXT_DISABLE_TURBOPACK = "1";
  console.log("[build] NEXT_DISABLE_TURBOPACK=1 (Windows default)");
}

const nextBin = path.resolve(workspaceRoot, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);

// Keep Prisma Client types in sync for TS builds (e.g. enums like BookingStatus)
const prismaCli = path.resolve(workspaceRoot, "node_modules", "prisma", "build", "index.js");
console.log("[build] prisma generate");
{
  // Prisma requires DATABASE_URL to be present to parse the datasource in schema/config.
  // Vercel builds can fail if DATABASE_URL is not configured for the Build step.
  // This fallback only exists to allow `prisma generate` (types/client) to run.
  // The deployed app still needs a real DATABASE_URL at runtime.
  if (!env.DATABASE_URL) {
    env.DATABASE_URL = "postgresql://prisma:prisma@localhost:5432/prisma?schema=public";
    console.log("[build] WARNING: DATABASE_URL was not set. Using a placeholder for prisma generate.");
    console.log("[build] Set DATABASE_URL in your Vercel Project Settings for Preview/Production.");
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await runWithCapture(process.execPath, [prismaCli, "generate"]);
    if (!result.signal && result.code === 0) break;

    const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const looksLocked = process.platform === "win32" && isPrismaWindowsEngineLocked(combined);
    if (looksLocked) {
      printPrismaWindowsEpermHelp();
    }

    if (attempt === maxAttempts) {
      if (result.signal) process.exit(1);
      process.exit(result.code);
    }

    // On Windows, prisma generate can fail with EPERM when the query engine DLL is temporarily locked.
    // A short retry usually fixes it (AV / file handles).
    console.log(`[build] prisma generate failed (attempt ${attempt}/${maxAttempts}). Retrying...`);
    await sleep(looksLocked ? 2000 : 600);
  }
}

console.log("[build] next build");
await runOrExit(process.execPath, [nextBin, "build", ...args]);
