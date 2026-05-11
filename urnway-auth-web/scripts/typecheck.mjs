import { spawn } from "node:child_process";

const env = {
  ...process.env,
  NEXT_IGNORE_INCORRECT_LOCKFILE: "1",
};

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env,
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if ((code ?? 0) === 0) {
        resolve();
        return;
      }

      reject(new Error(`${args.join(" ")} failed with exit code ${code ?? 1}`));
    });
  });
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const tsc = process.platform === "win32" ? "npx.cmd" : "npx";

try {
  await run(npx, ["next", "typegen"]);
  await run(tsc, ["tsc", "--noEmit"]);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
