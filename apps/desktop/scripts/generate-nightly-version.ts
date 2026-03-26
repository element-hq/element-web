#!/usr/bin/env -S npx tsx

/**
 * Script to generate incremental Nightly build versions, based on the latest Nightly build version of that kind.
 * The version format is YYYYMMDDNN where NN is in case we need to do multiple versions in a day.
 *
 * NB. on windows, squirrel will try to parse the version number parts, including this string, into 32-bit integers,
 * which is fine as long as we only add two digits to the end...
 */

import parseArgs from "minimist";

const argv = parseArgs<{
    latest?: string;
}>(process.argv.slice(2), {
    string: ["latest"],
});

function parseVersion(version: string): [Date, number] {
    const year = parseInt(version.slice(0, 4), 10);
    const month = parseInt(version.slice(4, 6), 10);
    const day = parseInt(version.slice(6, 8), 10);
    const num = parseInt(version.slice(8, 10), 10);
    return [new Date(year, month - 1, day), num];
}

const [latestDate, latestNum] = argv.latest ? parseVersion(argv.latest) : [];

const now = new Date();
const month = (now.getMonth() + 1).toString().padStart(2, "0");
const date = now.getDate().toString().padStart(2, "0");
let buildNum = 1;
if (latestDate && new Date(latestDate).getDate().toString().padStart(2, "0") === date) {
    buildNum = latestNum! + 1;
}

if (buildNum > 99) {
    throw new Error("Maximum number of Nightlies exceeded on this day.");
}

console.log(now.getFullYear() + month + date + buildNum.toString().padStart(2, "0"));
