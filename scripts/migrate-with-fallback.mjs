import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { loadEnvFiles } from "./load-env.mjs";

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function runNode(args, env) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf-8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return result;
}

function readArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function findLatestMigrationFile(workspaceRoot) {
  const migrationsDir = path.resolve(workspaceRoot, "prisma", "migrations");
  const entries = fs.readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (let i = entries.length - 1; i >= 0; i -= 1) {
    const filePath = path.resolve(migrationsDir, entries[i], "migration.sql");
    if (fileExists(filePath)) return filePath;
  }

  return null;
}

async function executeSqlWithPg(filePath, env) {
  const sql = fs.readFileSync(filePath, "utf-8");
  const connectionString = env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for pooled fallback execution.");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const workspaceRoot = process.cwd();
  loadEnvFiles(workspaceRoot);

  const prismaScript = path.resolve(workspaceRoot, "scripts", "prisma.mjs");
  if (!fileExists(prismaScript)) {
    console.error("[db:migrate:fallback] Missing scripts/prisma.mjs");
    process.exit(1);
  }

  const env = { ...process.env };
  console.log("[db:migrate:fallback] Running migrate deploy (non-interactive)...");
  const migrateResult = runNode([prismaScript, "migrate", "deploy"], env);

  if ((migrateResult.status ?? 1) === 0) {
    console.log("[db:migrate:fallback] migrate deploy succeeded.");
    console.log("[db:migrate:fallback] Regenerating Prisma Client...");
    const generateResult = runNode([prismaScript, "generate"], env);
    if ((generateResult.status ?? 1) !== 0) {
      console.error("[db:migrate:fallback] Prisma client generation failed.");
      process.exit(generateResult.status ?? 1);
    }
    process.exit(0);
  }

  const combinedOutput = `${migrateResult.stdout ?? ""}\n${migrateResult.stderr ?? ""}`;
  if (!combinedOutput.includes("P1001")) {
    console.error("[db:migrate:fallback] migrate deploy failed for a reason other than P1001.");
    process.exit(migrateResult.status ?? 1);
  }

  const explicitFile = readArg("--file");
  const migrationFile = explicitFile
    ? path.resolve(workspaceRoot, explicitFile)
    : findLatestMigrationFile(workspaceRoot);

  if (!migrationFile || !fileExists(migrationFile)) {
    console.error("[db:migrate:fallback] Could not find migration.sql for fallback execution.");
    console.error("[db:migrate:fallback] Pass one explicitly: --file prisma/migrations/<name>/migration.sql");
    process.exit(1);
  }

  console.warn("[db:migrate:fallback] Detected P1001 on DIRECT_URL. Falling back to pooled DATABASE_URL SQL execution.");
  console.warn(`[db:migrate:fallback] Executing: ${path.relative(workspaceRoot, migrationFile)}`);

  const fallbackEnv = { ...env, DIRECT_URL: "" };
  try {
    await executeSqlWithPg(migrationFile, fallbackEnv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db:migrate:fallback] pooled SQL execution failed: ${message}`);
    process.exit(1);
  }

  console.log("[db:migrate:fallback] Regenerating Prisma Client...");
  const generateResult = runNode([prismaScript, "generate"], env);
  if ((generateResult.status ?? 1) !== 0) {
    console.error("[db:migrate:fallback] Prisma client generation failed.");
    process.exit(generateResult.status ?? 1);
  }

  console.log("[db:migrate:fallback] Fallback completed successfully.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[db:migrate:fallback] unexpected failure: ${message}`);
  process.exit(1);
});
