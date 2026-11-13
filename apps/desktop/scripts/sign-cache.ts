/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { log } from "electron-builder";
import type {
    CustomWindowsSign,
    CustomWindowsSignTaskConfiguration,
    WindowsSignToolManager,
    WinPackager,
} from "app-builder-lib";

/**
 * Runs a command and resolves with its stdout, rejecting if it exits non-zero.
 */
export type Exec = (file: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<string>;

/**
 * Configuration for the Windows signed file cache.
 */
interface SignCacheOptions {
    /** Public base URL to fetch previously signed files from. */
    url: string;
    /** Local directory to write newly signed files to, in the same layout as `url`, for uploading later. */
    stagingDir?: string;
    /** Thumbprint of the signing certificate, signed files are only reused if signed by this certificate. */
    thumbprint: string;
}

/**
 * File extensions to cache. Executables are generally excluded as electron-builder edits their resources on every build,
 * so they don't match a previous build.
 */
const CACHEABLE_EXTS = [".dll", ".node"];

/**
 * Executables which are shipped unmodified, so can be cached.
 * Squirrel.exe comes as-is from electron-builder's Squirrel.Windows vendor archive.
 */
const CACHEABLE_FILES = ["Squirrel.exe"];

function isCacheable(file: string): boolean {
    return CACHEABLE_EXTS.includes(path.extname(file)) || CACHEABLE_FILES.includes(path.basename(file));
}

const defaultExec: Exec = async (file, args, env) => {
    const { stdout } = await promisify(execFile)(file, args, { env: env ?? process.env });
    return stdout;
};

/**
 * The Authenticode signature of a file, as seen by Windows.
 */
export interface AuthenticodeSignature {
    /** The signature status, e.g. `Valid`, `NotSigned` or `UnknownError` for an untrusted certificate. */
    status: string;
    /** Upper-case thumbprint of the signing certificate, if the file is signed. */
    thumbprint?: string;
}

/**
 * Checks the Authenticode signature of a file using PowerShell's `Get-AuthenticodeSignature`. Windows only.
 * @param file the path of the file to check.
 * @param exec runs external commands, overridable for tests.
 */
export async function getAuthenticodeSignature(file: string, exec: Exec = defaultExec): Promise<AuthenticodeSignature> {
    // Pass the path via the environment to avoid having to quote it for PowerShell
    const stdout = await exec(
        "powershell",
        [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$s = Get-AuthenticodeSignature -LiteralPath $env:ED_SIGN_FILE; " +
                'Write-Output "$($s.Status) $($s.SignerCertificate.Thumbprint)"',
        ],
        { ...process.env, ED_SIGN_FILE: file },
    );
    const [status, thumbprint] = stdout.trim().split(/\s+/);
    return { status, thumbprint: thumbprint?.toUpperCase() || undefined };
}

/**
 * Reads the signed file cache configuration from the environment.
 * @param env the environment to read from.
 * @returns the configuration, or null if the cache is not configured.
 */
function getSignCacheOptions(env: NodeJS.ProcessEnv): SignCacheOptions | null {
    const url = env.ED_SIGN_CACHE_URL;
    const thumbprint = env.ED_SIGNTOOL_THUMBPRINT;
    if (!url || !thumbprint) return null;
    return { url: url.replace(/\/+$/, ""), stagingDir: env.ED_SIGN_CACHE_DIR || undefined, thumbprint };
}

/**
 * Creates a custom signtool `sign` function which reuses previously signed copies of rarely changing files
 * (Electron's DLLs, native modules, Squirrel.exe), as EV code signing is charged per signature.
 *
 * Files are looked up by the signing certificate thumbprint and the SHA-256 of their unsigned contents,
 * as `<url>/<THUMBPRINT>/<sha256><ext>`. A cached file is only used if Windows considers its signature valid
 * and it was signed by our certificate. Anything else falls back to signing the file, and the result is written
 * to the staging directory in the same layout so that it can be uploaded to the cache by a later, trusted job.
 * Cache failures never fail the build, they only cost a signature.
 *
 * @param env the environment to read the configuration from:
 *     ED_SIGN_CACHE_URL - public base URL to fetch previously signed files from,
 *     ED_SIGN_CACHE_DIR - optional local directory to write newly signed files to, for uploading later,
 *     ED_SIGNTOOL_THUMBPRINT - thumbprint of the signing certificate.
 * @param exec runs external commands, overridable for tests.
 * @returns the sign function, or null if the cache is not configured.
 */
export function createCachedSign(
    env: NodeJS.ProcessEnv = process.env,
    exec: Exec = defaultExec,
): CustomWindowsSign | null {
    const options = getSignCacheOptions(env);
    if (!options) return null;

    const thumbprint = options.thumbprint.toUpperCase();

    const verify = async (file: string): Promise<boolean> => {
        const signature = await getAuthenticodeSignature(file, exec);
        return signature.status === "Valid" && signature.thumbprint === thumbprint;
    };

    // Returns whether the cached copy was used
    const restore = async (key: string, file: string): Promise<boolean> => {
        const url = `${options.url}/${key}`;
        const response = await fetch(url);
        if (response.status === 404) {
            // Log the key so that cache misses can be compared between builds
            log.info({ file: log.filePath(file), key }, "no cached signed copy");
            return false;
        }
        if (!response.ok) throw new Error(`Unexpected response ${response.status} from ${url}`);

        const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "sign-cache-"));
        try {
            const cached = path.join(tmpDir, path.basename(file));
            await fsp.writeFile(cached, Buffer.from(await response.arrayBuffer()));
            if (!(await verify(cached))) {
                log.warn({ file: log.filePath(file) }, "ignoring cached signed copy as its signature is not ours");
                return false;
            }
            await fsp.copyFile(cached, file);
            log.info({ file: log.filePath(file), key }, "reused cached signed copy");
            return true;
        } finally {
            await fsp.rm(tmpDir, { recursive: true, force: true });
        }
    };

    return async (config: CustomWindowsSignTaskConfiguration, packager?: WinPackager): Promise<void> => {
        const sign = async (): Promise<void> => {
            const manager = (await packager!.signingManager.value) as WindowsSignToolManager;
            await manager.doSign(config, packager!);
        };

        if (!isCacheable(config.path)) return sign();

        const digest = createHash("sha256")
            .update(await fsp.readFile(config.path))
            .digest("hex");
        const key = `${thumbprint}/${digest}${path.extname(config.path)}`;

        try {
            if (await restore(key, config.path)) return;
        } catch (e) {
            log.warn({ file: log.filePath(config.path), error: String(e) }, "failed to fetch cached signed copy");
        }

        await sign();

        if (options.stagingDir) {
            const staged = path.join(options.stagingDir, key);
            await fsp.mkdir(path.dirname(staged), { recursive: true });
            await fsp.copyFile(config.path, staged);
        }
    };
}
