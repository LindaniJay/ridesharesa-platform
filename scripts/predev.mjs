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
  const root = projectRoot.replaceAll("'", "''");
  const psScript = [
    "$ErrorActionPreference = 'SilentlyContinue'",
    `$root = '${root}'`,
    "$needle = 'node_modules\\next\\dist\\server\\lib\\start-server.js'",
    "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\"",
    "| Where-Object { $_.CommandLine -and ($_.CommandLine -like ('*' + $root + '*')) -and ($_.CommandLine -like ('*' + $needle + '*')) }",
    "| Select-Object -ExpandProperty ProcessId",
  ].join("; ");

  const result = run("powershell", ["-NoProfile", "-Command", psScript]);
  if (result.status !== 0) return [];

  const stdout = (result.stdout || "").trim();
  if (!stdout) return [];

  try {
    return stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s))
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
