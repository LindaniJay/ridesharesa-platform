import { spawn } from "node:child_process";
import path from "node:path";

const workspaceRoot = process.cwd();
const env = { ...process.env };

// Work around occasional Turbopack/worker shutdown issues on Windows (EPERM on process.kill)
if (process.platform === "win32" && env.NEXT_DISABLE_TURBOPACK == null) {
  env.NEXT_DISABLE_TURBOPACK = "1";
  console.log("[build] NEXT_DISABLE_TURBOPACK=1 (Windows default)");
}

const nextBin = path.resolve(workspaceRoot, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [nextBin, "build", ...args], {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
