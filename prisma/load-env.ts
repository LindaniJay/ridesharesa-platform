import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

function fileExists(p: string) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

export function loadEnvFiles(workspaceRoot = process.cwd()) {
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
