#!/usr/bin/env node
/**
 * Stable dev server startup for Windows.
 *
 * - Webpack dev (not Turbopack) avoids manifest ENOENT races on Windows.
 * - Clears .next by default so production `next build` artifacts (standalone,
 *   stale chunks like 5611.js) never corrupt `next dev`.
 * - Frees port 3000 first (required on Windows before deleting .next).
 */
import { spawn, execSync } from "child_process";
import { rmSync, existsSync } from "fs";
import { platform } from "os";

const PORT = process.env.PORT || "3000";
const USE_TURBO = process.argv.includes("--turbo");
const SKIP_CLEAN = process.argv.includes("--fast");

function killPort(port) {
  try {
    if (platform() === "win32") {
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      });
      const pids = new Set();
      for (const line of out.trim().split("\n")) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid)) pids.add(pid);
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`Stopped previous process on port ${port} (PID ${pid})`);
        } catch {
          /* already gone */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { shell: true });
    }
  } catch {
    /* nothing listening */
  }
}

function removeNextCache() {
  if (!existsSync(".next")) return;
  console.log("Removing .next cache (prevents stale/mixed build chunks)...");
  // Windows: retry delete — files may stay locked briefly after taskkill.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      rmSync(".next", { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      execSync("timeout /t 1 /nobreak >nul 2>&1", { shell: true, stdio: "ignore" });
    }
  }
}

function killProjectNextDev() {
  killPort(PORT);
  if (platform() !== "win32") return;

  // Port kill may miss Next.js worker processes that still lock Prisma's query engine DLL.
  try {
    const cwd = process.cwd().replace(/\\/g, "\\\\");
    const ps = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"name = 'node.exe'\\" | Where-Object { $_.CommandLine -match 'next dev|start-server.js' -and $_.CommandLine -match '${cwd}' } | ForEach-Object { $_.ProcessId }"`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
    ).trim();
    for (const pid of ps.split(/\s+/).filter(Boolean)) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
        console.log(`Stopped Next.js worker (PID ${pid})`);
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* no matching processes */
  }
}

function syncPrismaClient() {
  const attempts = SKIP_CLEAN ? 2 : 4;
  for (let i = 0; i < attempts; i++) {
    try {
      execSync("npx prisma generate", { stdio: "inherit", shell: true });
      return;
    } catch {
      if (i === attempts - 1) {
        console.error(
          "\nPrisma client is out of date and could not regenerate (file lock on Windows)."
        );
        console.error("Stop `npm run dev`, then run: npm run db:generate\n");
        process.exit(1);
      }
      execSync("timeout /t 2 /nobreak >nul 2>&1", { shell: true, stdio: "ignore" });
    }
  }
}

function shouldCleanCache() {
  if (SKIP_CLEAN || !existsSync(".next")) return false;
  return true;
}

// Kill dev server BEFORE deleting .next — otherwise Windows file locks cause ENOTEMPTY.
killProjectNextDev();

if (shouldCleanCache()) {
  removeNextCache();
}

console.log("Syncing Prisma client...");
syncPrismaClient();

const args = ["next", "dev", "-p", PORT];
if (USE_TURBO) {
  args.push("--turbopack");
  console.warn(
    "Warning: Turbopack can crash with ENOENT manifest errors on Windows. Use `npm run dev` if that happens."
  );
} else {
  console.log("Using Webpack dev server (stable on Windows).");
  if (platform() === "win32") {
    console.log(
      "Webpack persistent cache disabled on Windows (set WEBPACK_CACHE=1 to re-enable)."
    );
  }
}

console.log(`http://localhost:${PORT}`);

const child = spawn("npx", args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
