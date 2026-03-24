/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import path from "node:path";
import os from "node:os";
import { getElectronVersionFromInstalled } from "app-builder-lib/out/electron/electronVersion.js";
import childProcess, { type SpawnOptions } from "node:child_process";

import { type Arch, type Target, TARGETS, getHost, isHostId, type TargetId } from "./target.js";

async function getRuntimeVersion(projectRoot: string): Promise<string> {
    const electronVersion = await getElectronVersionFromInstalled(projectRoot);
    if (!electronVersion) {
        throw new Error("Can't determine Electron version");
    }
    return electronVersion;
}

export type Tool = [cmd: string, ...args: string[]];

export default class HakEnv {
    public readonly target: Target;
    public runtime: string = "electron";
    public runtimeVersion?: string;
    public dotHakDir: string;

    public constructor(
        public readonly projectRoot: string,
        targetId: TargetId | null,
    ) {
        const target = targetId ? TARGETS[targetId] : getHost();

        if (!target) {
            throw new Error(`Unknown target ${targetId}!`);
        }
        this.target = target;
        this.dotHakDir = path.join(this.projectRoot, ".hak");
    }

    public async init(): Promise<void> {
        this.runtimeVersion = await getRuntimeVersion(this.projectRoot);
    }

    public getTargetId(): TargetId {
        return this.target.id;
    }

    public isWin(): boolean {
        return this.target.platform === "win32";
    }

    public isMac(): boolean {
        return this.target.platform === "darwin";
    }

    public isLinux(): boolean {
        return this.target.platform === "linux";
    }

    public isFreeBSD(): boolean {
        return this.target.platform === "freebsd";
    }

    public getTargetArch(): Arch {
        return this.target.arch;
    }

    public isHost(): boolean {
        return isHostId(this.target.id);
    }

    public makeGypEnv(): Record<string, string | undefined> {
        return {
            ...process.env,
            npm_config_arch: this.target.arch,
            npm_config_target_arch: this.target.arch,
            npm_config_disturl: "https://electronjs.org/headers",
            npm_config_runtime: this.runtime,
            npm_config_target: this.runtimeVersion,
            npm_config_build_from_source: "true",
            npm_config_devdir: path.join(os.homedir(), ".electron-gyp"),
        };
    }

    public wantsStaticSqlCipher(): boolean {
        return !(this.isLinux() || this.isFreeBSD()) || process.env.SQLCIPHER_BUNDLED == "1";
    }

    public spawn(
        cmd: string,
        args: string[],
        { ignoreWinCmdlet, ...options }: SpawnOptions & { ignoreWinCmdlet?: boolean } = {},
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const proc = childProcess.spawn(cmd + (!ignoreWinCmdlet && this.isWin() ? ".cmd" : ""), args, {
                stdio: "inherit",
                // We need shell mode on Windows to be able to launch `.cmd` executables
                // See https://nodejs.org/en/blog/vulnerability/april-2024-security-releases-2
                shell: this.isWin(),
                ...options,
            });
            proc.on("exit", (code) => {
                if (code) {
                    reject(code);
                } else {
                    resolve();
                }
            });
        });
    }

    public async checkTools(tools: Tool[]): Promise<void> {
        for (const [tool, ...args] of tools) {
            try {
                await this.spawn(tool, args, {
                    ignoreWinCmdlet: true,
                    stdio: ["ignore"],
                    shell: false,
                });
            } catch {
                throw new Error(`Can't find ${tool}`);
            }
        }
    }
}
