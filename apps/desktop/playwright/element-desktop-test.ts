/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { _electron as electron, test as base, expect as baseExpect, type ElectronApplication } from "@playwright/test";
import fs from "node:fs/promises";
import path, { dirname } from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";

/**
 * A PassThrough stream that captures all data written to it.
 */
class CapturedPassThrough extends PassThrough {
    private _chunks = [];

    public constructor() {
        super();
        super.on("data", this.onData);
    }

    private onData = (chunk): void => {
        this._chunks.push(chunk);
    };

    public get data(): Buffer {
        return Buffer.concat(this._chunks);
    }
}

interface Fixtures {
    app: ElectronApplication;
    tmpDir: string;
    extraEnv: Record<string, string>;
    extraArgs: string[];

    // Utilities to capture stdout and stderr for tests to make assertions against
    stdout: CapturedPassThrough;
    stderr: CapturedPassThrough;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

export const test = base.extend<Fixtures>({
    extraEnv: {},
    extraArgs: [],

    // eslint-disable-next-line no-empty-pattern
    stdout: async ({}, use) => {
        await use(new CapturedPassThrough());
    },
    // eslint-disable-next-line no-empty-pattern
    stderr: async ({}, use) => {
        await use(new CapturedPassThrough());
    },

    // eslint-disable-next-line no-empty-pattern
    tmpDir: async ({}, use) => {
        const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "element-desktop-tests-"));
        await use(tmpDir);
        await fs.rm(tmpDir, { recursive: true });
    },
    app: async ({ tmpDir, extraEnv, extraArgs, stdout, stderr }, use) => {
        const args = ["--profile-dir", tmpDir, ...extraArgs];

        if (process.env.GITHUB_ACTIONS) {
            if (process.platform === "linux") {
                // GitHub Actions hosted runner lacks dbus and a compatible keyring, so we need to force plaintext storage
                args.push("--storage-mode", "force-plaintext");
            } else if (process.platform === "darwin") {
                // GitHub Actions hosted runner has no working default keychain, so allow plaintext storage
                args.push("--storage-mode", "allow-plaintext");
            }
        }

        const executablePath = process.env["ELEMENT_DESKTOP_EXECUTABLE"];
        if (!executablePath) {
            // Unpackaged mode testing
            args.unshift(path.join(__dirname, "..", "lib", "electron-main.js"));
        }

        console.log(`Launching '${executablePath || "electron"}' with args ${args.join(" ")}`);

        const app = await electron.launch({
            env: {
                ...process.env,
                ...extraEnv,
            },
            executablePath,
            args,
        });

        app.process().stdout.pipe(stdout).pipe(process.stdout);
        app.process().stderr.pipe(stderr).pipe(process.stderr);

        await app.firstWindow();

        // Block matrix.org access to ensure consistent tests
        const context = app.context();
        await context.route("https://matrix.org/**", async (route) => {
            await route.abort();
        });

        await use(app);
    },
    page: async ({ app }, use) => {
        const window = await app.firstWindow();
        await use(window);
        await app.close().catch((e) => {
            console.error(e);
        });
    },
});

export const expect = baseExpect;
