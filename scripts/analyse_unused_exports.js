#!/usr/bin/env node
"use strict";

const fs = require("fs");
const { exec } = require("node:child_process");

const includeJSSDK = process.argv.includes("--include-js-sdk");
const ignore = [];

ignore.push(...Object.values(JSON.parse(fs.readFileSync(`${__dirname}/../components.json`))));
ignore.push("/index.ts");
// We ignore js-sdk by default as it may export for other non element-web projects
if (!includeJSSDK) ignore.push("matrix-js-sdk");

const command = `yarn ts-prune --ignore "${ignore.join("|")}" | grep -v "(used in module)"`;

exec(command, (error, stdout, stderr) => {
    if (error) throw error;
    // We have to do this as piping the output of ts-prune causes the return
    // code to be 0
    if (stderr) throw Error(stderr);

    let lines = stdout.split("\n");
    // Remove the first line as that is the command that was being run and we
    // log that only in case of an error
    lines.splice(0, 1);
    // Remove the last line as it is empty
    lines.pop();

    // ts-prune has bug where if the unused export is in a dependency, the path
    // won't have an "/" character at the start, so we try to fix that for
    // better UX
    // TODO: This might break on Windows
    lines = lines.reduce((newLines, line) => {
        if (!line.startsWith("/")) newLines.push("/" + line);
        else newLines.push(line);
        return newLines;
    }, []);

    // If an unused export has been found, we error
    if (lines.length > 0) {
        console.log(`Command that was run: ${command}`);
        console.log(lines.join("\n"));
        throw Error("Unused exports found!");
    }

    console.log("Success - no unused exports found!");
});
