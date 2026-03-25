import { spawn } from "node:child_process";
import { repoRoot } from "./workspace-utils.mjs";

console.log("Starting Element Web dev server (http://localhost:8080)…");

const child = spawn("pnpm", ["--filter", "element-web", "start"], {
    cwd: repoRoot,
    stdio: "inherit",
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code ?? 0);
});

