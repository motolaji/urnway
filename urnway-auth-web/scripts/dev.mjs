import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function readHostFromEnvFile(filename) {
  const fullPath = resolve(process.cwd(), filename);

  if (!existsSync(fullPath)) {
    return null;
  }

  const content = readFileSync(fullPath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, "");

    if (key === "HOST" && value) {
      return value;
    }
  }

  return null;
}

const host =
  process.env.HOST ||
  readHostFromEnvFile(".env.local") ||
  readHostFromEnvFile(".env") ||
  "0.0.0.0";

const nextBuildDirectory = resolve(process.cwd(), ".next");

if (existsSync(nextBuildDirectory)) {
  rmSync(nextBuildDirectory, { recursive: true, force: true });
  console.log("Cleared stale .next cache before starting auth-web dev server.");
}

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["next", "dev", "--hostname", host],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
    },
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
