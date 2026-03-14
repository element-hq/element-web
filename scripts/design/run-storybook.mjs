import { spawn } from "node:child_process";

import { findSinglePackageByScript, repoRoot } from "./workspace-utils.mjs";

const storybookPackage = findSinglePackageByScript("storybook");

console.log(`Starting Storybook from ${storybookPackage.name} (${storybookPackage.relativeDir}).`);

const child = spawn("pnpm", ["--filter", storybookPackage.name, "run", "storybook"], {
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