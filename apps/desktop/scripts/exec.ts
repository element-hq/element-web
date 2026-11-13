/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { execFile } from "node:child_process";
import { promisify } from "node:util";

/**
 * Runs a command and resolves with its stdout, rejecting if it exits non-zero.
 */
export type Exec = (file: string, args: string[], env?: NodeJS.ProcessEnv) => Promise<string>;

/**
 * Runs a command using `execFile`.
 * The buffer is raised from the default 1MB as some output, e.g. the symbol versions of the Electron executable or
 * the listing of a package, can exceed it.
 */
export const defaultExec: Exec = async (file, args, env) => {
    const { stdout } = await promisify(execFile)(file, args, { env: env ?? process.env, maxBuffer: 64 * 1024 * 1024 });
    return stdout;
};
