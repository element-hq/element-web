#!/usr/bin/env -S yarn --silent tsx

import { glob } from "glob";
import path from "node:path";
import { stat } from "node:fs/promises";

async function main() {
    const cwd = path.join(__dirname, "..", "webapp");
    const jsfiles = await glob("**/*.js", { cwd });
    const sizes = await Promise.all(
        jsfiles.map(async (file) => {
            const data = await stat(path.join(cwd, file));
            return data.size;
        }),
    );

    const totalBytes = sizes.reduce((acc, size) => acc + size, 0);

    console.log([
        {
            name: "Total JS bundle size",
            unit: "Megabytes",
            value: totalBytes / 1024 / 1024,
        },
    ]);
}

main();
