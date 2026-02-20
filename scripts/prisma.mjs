import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function fileExists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function loadEnvFiles(workspaceRoot) {
  // Match Next.js expectations: most devs use `.env.local` for secrets.
  // Do not override already-set process.env values.
  const candidates = [
    ".env.local",
    ".env",
    ".env.development.local",
    ".env.development",
  ];

  for (const filename of candidates) {
    const fullPath = path.resolve(workspaceRoot, filename);
    if (!fileExists(fullPath)) continue;
    dotenv.config({ path: fullPath, override: false });
  }
}

function pickBestCorpPem(workspaceRoot) {
  const windowsStorePem = path.resolve(workspaceRoot, ".certs", "corp-windows-store.pem");
  const bundledChainPem = path.resolve(workspaceRoot, ".certs", "corp-chain.pem");
  const bundledBundlePem = path.resolve(workspaceRoot, ".certs", "corp-bundle.pem");
  const bundledRootPem = path.resolve(workspaceRoot, ".certs", "corp-root.pem");

  return (
    (fileExists(windowsStorePem) && windowsStorePem) ||
    (fileExists(bundledChainPem) && bundledChainPem) ||
    (fileExists(bundledBundlePem) && bundledBundlePem) ||
    (fileExists(bundledRootPem) && bundledRootPem) ||
    null
  );
}

function shouldUseDirectUrl(prismaArgs) {
  const top = prismaArgs[0];
  return top === "migrate" || top === "db" || top === "introspect";
}

const workspaceRoot = process.cwd();
const prismaArgs = process.argv.slice(2);

loadEnvFiles(workspaceRoot);

if (prismaArgs.length === 0) {
  console.error("Usage: node scripts/prisma.mjs <prisma args...>");
  console.error("Example: node scripts/prisma.mjs migrate dev");
  process.exit(1);
}

const env = { ...process.env };

// Windows/corporate proxy TLS helper (matches `scripts/dev.mjs` behavior)
const bestPem = pickBestCorpPem(workspaceRoot);
if (bestPem && !env.NODE_EXTRA_CA_CERTS) {
  env.NODE_EXTRA_CA_CERTS = bestPem;
  console.log(`[prisma] Using NODE_EXTRA_CA_CERTS=${bestPem}`);
}

// Prefer a direct (non-pooled) connection string for migrations.
if (env.DIRECT_URL && shouldUseDirectUrl(prismaArgs)) {
  env.DATABASE_URL = env.DIRECT_URL;
  console.log("[prisma] Using DIRECT_URL for DATABASE_URL");
}

if (!env.DATABASE_URL) {
  if (prismaArgs[0] === "generate") {
    env.DATABASE_URL = "postgresql://prisma:prisma@localhost:5432/prisma?schema=public";
    console.log("[prisma] WARNING: DATABASE_URL was not set. Using a placeholder for prisma generate.");
  } else {
    console.error("[prisma] Missing DATABASE_URL.");
    console.error("[prisma] Set DATABASE_URL (and ideally DIRECT_URL for migrations) in your .env.");
    process.exit(1);
  }
}

const prismaCli = path.resolve(workspaceRoot, "node_modules", "prisma", "build", "index.js");
if (!fileExists(prismaCli)) {
  console.error("[prisma] Prisma CLI not found. Run `npm install` first.");
  process.exit(1);
}

const child = spawn(process.execPath, [prismaCli, ...prismaArgs], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
