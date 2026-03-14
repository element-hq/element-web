import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

import { repoRoot } from "./workspace-utils.mjs";

const runtimeDir = path.join(repoRoot, ".devcontainer", ".runtime");
const pidFile = path.join(runtimeDir, "storybook.pid");
const logFile = path.join(runtimeDir, "storybook.log");

function isRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

fs.mkdirSync(runtimeDir, { recursive: true });

if (fs.existsSync(pidFile)) {
    const currentPid = Number.parseInt(fs.readFileSync(pidFile, "utf8"), 10);
    if (Number.isInteger(currentPid) && isRunning(currentPid)) {
        console.log(`Storybook is already running (pid ${currentPid}).`);
        process.exit(0);
    }
}

const logStream = fs.openSync(logFile, "a");
const child = spawn("pnpm", ["run", "storybook:design"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", logStream, logStream],
});

child.unref();
fs.writeFileSync(pidFile, `${child.pid}\n`);

console.log(`Storybook launch requested (pid ${child.pid}). Logs: ${path.relative(repoRoot, logFile)}`);