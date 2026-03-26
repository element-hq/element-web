#!/usr/bin/env -S npx tsx --resolveJsonModule

import * as path from "node:path";
import { createWriteStream, promises as fs } from "node:fs";
import * as childProcess from "node:child_process";
import * as tar from "tar";
import * as asar from "@electron/asar";
import { promises as stream } from "node:stream";

import riotDesktopPackageJson from "../package.json";
import { setPackageVersion } from "./set-version.js";

const PUB_KEY_URL = "https://packages.riot.im/element-release-key.asc";
const PACKAGE_URL_PREFIX = "https://github.com/element-hq/element-web/releases/download/";
const DEVELOP_TGZ_URL = "https://develop.element.io/develop.tar.gz";
const ASAR_PATH = "webapp.asar";

async function downloadToFile(url: string, filename: string): Promise<void> {
    console.log("Downloading " + url + "...");

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`unexpected response ${resp.statusText}`);
        if (!resp.body) throw new Error(`unexpected response has no body ${resp.statusText}`);
        await stream.pipeline(resp.body, createWriteStream(filename));
    } catch (e) {
        console.error(e);
        try {
            await fs.unlink(filename);
        } catch {}
        throw e;
    }
}

async function verifyFile(filename: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        childProcess.execFile("gpg", ["--verify", filename + ".asc", filename], (error) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
    });
}

async function main(): Promise<number | undefined> {
    let verify = true;
    let importkey = false;
    let pkgDir = "packages";
    let deployDir = "deploys";
    let cfgDir: string | undefined;
    let targetVersion: string | undefined;
    let filename: string | undefined;
    let url: string | undefined;
    let setVersion = false;

    while (process.argv.length > 2) {
        switch (process.argv[2]) {
            case "--noverify":
                verify = false;
                break;
            case "--importkey":
                importkey = true;
                break;
            case "--packages":
                process.argv.shift();
                pkgDir = process.argv[2];
                break;
            case "--deploys":
                process.argv.shift();
                deployDir = process.argv[2];
                break;
            case "--cfgdir":
            case "-d":
                process.argv.shift();
                cfgDir = process.argv[2];
                break;
            default:
                targetVersion = process.argv[2];
        }
        process.argv.shift();
    }

    if (targetVersion === undefined) {
        targetVersion = "v" + riotDesktopPackageJson.version;
    } else if (targetVersion !== "develop") {
        setVersion = true; // version was specified
    }

    if (targetVersion === "develop") {
        filename = "develop.tar.gz";
        url = DEVELOP_TGZ_URL;
        verify = false; // develop builds aren't signed
    } else if (targetVersion.includes("://")) {
        filename = targetVersion.substring(targetVersion.lastIndexOf("/") + 1);
        url = targetVersion;
        verify = false; // manually verified
    } else {
        filename = `element-${targetVersion}.tar.gz`;
        url = PACKAGE_URL_PREFIX + targetVersion + "/" + filename;
    }

    const haveGpg = await new Promise<boolean>((resolve) => {
        childProcess.execFile("gpg", ["--version"], (error) => {
            resolve(!error);
        });
    });

    if (importkey) {
        if (!haveGpg) {
            console.log("Can't import key without working GPG binary: install GPG and try again");
            return 1;
        }

        await new Promise<boolean>((resolve, reject) => {
            const gpgProc = childProcess.execFile("gpg", ["--import"], (error) => {
                if (error) {
                    console.log("Failed to import key", error);
                } else {
                    console.log("Key imported!");
                }
                resolve(!error);
            });
            fetch(PUB_KEY_URL)
                .then((resp) => {
                    if (!resp.ok) throw new Error(`unexpected response ${resp.statusText}`);
                    if (!resp.body) throw new Error(`unexpected response has no body ${resp.statusText}`);
                    stream.pipeline(resp.body, gpgProc.stdin!).catch(reject);
                })
                .catch(reject);
        });
        return 0;
    }

    if (cfgDir === undefined) {
        console.log("No config directory set");
        console.log("Specify a config directory with --cfgdir or -d");
        console.log("To build with no config (and no auto-update), pass the empty string (-d '')");
        return 1;
    }

    if (verify && !haveGpg) {
        console.log("No working GPG binary: install GPG or pass --noverify to skip verification");
        return 1;
    }

    let haveDeploy = false;
    let expectedDeployDir = path.join(deployDir, path.basename(filename).replace(/\.tar\.gz/, ""));
    try {
        await fs.opendir(expectedDeployDir);
        console.log(expectedDeployDir + "already exists");
        haveDeploy = true;
    } catch {}

    if (!haveDeploy) {
        const outPath = path.join(pkgDir, filename);
        try {
            await fs.stat(outPath);
            console.log("Already have " + filename + ": not redownloading");
        } catch {
            try {
                await downloadToFile(url, outPath);
            } catch (e) {
                console.log("Failed to download " + url, e);
                return 1;
            }
        }

        if (verify) {
            try {
                await fs.stat(outPath + ".asc");
                console.log("Already have " + filename + ".asc: not redownloading");
            } catch {
                try {
                    await downloadToFile(url + ".asc", outPath + ".asc");
                } catch (e) {
                    console.log("Failed to download " + url, e);
                    return 1;
                }
            }

            try {
                await verifyFile(outPath);
                console.log(outPath + " downloaded and verified");
            } catch (e) {
                console.log("Signature verification failed!", e);
                return 1;
            }
        } else {
            console.log(outPath + " downloaded but NOT verified");
        }

        await tar.x({
            file: outPath,
            cwd: deployDir,
            onentry: (entry) => {
                // Find the appropriate extraction path, only needed for `develop` where the dir name is unknown
                if (entry.type === "Directory" && !path.join(deployDir, entry.path).startsWith(expectedDeployDir)) {
                    expectedDeployDir = path.join(deployDir, entry.path);
                }
            },
        });
    }

    try {
        await fs.stat(ASAR_PATH);
        console.log(ASAR_PATH + " already present: removing");
        await fs.unlink(ASAR_PATH);
    } catch {}

    if (cfgDir.length) {
        const configJsonSource = path.join(cfgDir, "config.json");
        const configJsonDest = path.join(expectedDeployDir, "config.json");
        console.log(configJsonSource + " -> " + configJsonDest);
        await fs.copyFile(configJsonSource, configJsonDest);
    } else {
        console.log("Skipping config file");
    }

    console.log("Pack " + expectedDeployDir + " -> " + ASAR_PATH);
    await asar.createPackage(expectedDeployDir, ASAR_PATH);

    if (setVersion) {
        const semVer = (await fs.readFile(path.join(expectedDeployDir, "version"), "utf-8")).trim();
        console.log("Updating version to " + semVer);
        await setPackageVersion(semVer);
    }

    console.log("Done!");
}

main()
    .then((ret) => {
        process.exit(ret);
    })
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
