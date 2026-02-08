import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const lockPath = path.join(projectRoot, ".next", "dev", "lock");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function safeIncludes(haystack, needle) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

async function fileExists(filePath) {
  try {
    await fsp.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function findNextDevPidsWindows() {
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    "$procs = Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId, CommandLine",
    "$procs | ConvertTo-Json -Compress",
  ].join("; ");

  const result = run("powershell", ["-NoProfile", "-Command", psScript]);
  if (result.status !== 0) return [];

  const stdout = (result.stdout || "").trim();
  if (!stdout) return [];

  try {
    const parsed = JSON.parse(stdout);
    const list = Array.isArray(parsed) ? parsed : [parsed];

    const nextStartServer = "node_modules\\next\\dist\\server\\lib\\start-server.js";

    return list
      .filter((p) =>
        safeIncludes(p?.CommandLine, projectRoot) &&
        safeIncludes(p?.CommandLine, nextStartServer)
      )
      .map((p) => Number(p.ProcessId))
      .filter((pid) => Number.isFinite(pid));
  } catch {
    return [];
  }
}

function findNextDevPidsPosix() {
  const result = run("ps", ["-A", "-o", "pid=,command="]);
  if (result.status !== 0) return [];

  const nextStartServer = "node_modules/next/dist/server/lib/start-server.js";

  return (result.stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^([0-9]+)\s+(.*)$/.exec(line);
      if (!match) return null;
      return { pid: Number(match[1]), cmd: match[2] };
    })
    .filter(Boolean)
    .filter(
      (p) => safeIncludes(p.cmd, projectRoot) && safeIncludes(p.cmd, nextStartServer)
    )
    .map((p) => p.pid)
    .filter((pid) => Number.isFinite(pid));
}

function killPidWindows(pid) {
  run("taskkill", ["/PID", String(pid), "/T", "/F"]);
}

function killPidPosix(pid) {
  run("kill", ["-9", String(pid)]);
}

async function main() {
  const hasLock = await fileExists(lockPath);
  if (!hasLock) return;

  const pids =
    process.platform === "win32" ? findNextDevPidsWindows() : findNextDevPidsPosix();

  for (const pid of pids) {
    try {
      if (process.platform === "win32") killPidWindows(pid);
      else killPidPosix(pid);
    } catch {
      // best effort
    }
  }

  // Give Windows a beat to release file handles
  await new Promise((r) => setTimeout(r, 300));

  try {
    await fsp.rm(lockPath, { force: true });
  } catch {
    // If lock is still held, dev will still surface the error.
  }
}

await main();
