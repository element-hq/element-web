/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as os from "os";
import * as crypto from "crypto";
import * as childProcess from "child_process";
import * as fse from "fs-extra";

export class Docker {
    public id: string;

    async run(opts: { image: string; containerName: string; params?: string[]; cmd?: string[] }): Promise<string> {
        const userInfo = os.userInfo();
        const params = opts.params ?? [];

        if (params?.includes("-v") && userInfo.uid >= 0) {
            // Run the docker container as our uid:gid to prevent problems with permissions.
            if (await Docker.isPodman()) {
                // Note: this setup is for podman rootless containers.

                // In podman, run as root in the container, which maps to the current
                // user on the host. This is probably the default since Synapse's
                // Dockerfile doesn't specify, but we're being explicit here
                // because it's important for the permissions to work.
                params.push("-u", "0:0");

                // Tell Synapse not to switch UID
                params.push("-e", "UID=0");
                params.push("-e", "GID=0");
            } else {
                params.push("-u", `${userInfo.uid}:${userInfo.gid}`);
            }
        }

        const args = [
            "run",
            "--name",
            `${opts.containerName}-${crypto.randomBytes(4).toString("hex")}`,
            "-d",
            "--rm",
            ...params,
            opts.image,
        ];

        if (opts.cmd) args.push(...opts.cmd);

        this.id = await new Promise<string>((resolve, reject) => {
            childProcess.execFile("docker", args, (err, stdout) => {
                if (err) reject(err);
                resolve(stdout.trim());
            });
        });
        return this.id;
    }

    stop(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            childProcess.execFile("docker", ["stop", this.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    exec(params: string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            childProcess.execFile(
                "docker",
                ["exec", this.id, ...params],
                { encoding: "utf8" },
                (err, stdout, stderr) => {
                    if (err) {
                        console.log(stdout);
                        console.log(stderr);
                        reject(err);
                        return;
                    }
                    resolve();
                },
            );
        });
    }

    rm(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            childProcess.execFile("docker", ["rm", this.id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });
    }

    getContainerIp(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            childProcess.execFile(
                "docker",
                ["inspect", "-f", "{{ .NetworkSettings.IPAddress }}", this.id],
                (err, stdout) => {
                    if (err) reject(err);
                    else resolve(stdout.trim());
                },
            );
        });
    }

    async persistLogsToFile(args: { stdoutFile?: string; stderrFile?: string }): Promise<void> {
        const stdoutFile = args.stdoutFile ? await fse.open(args.stdoutFile, "w") : "ignore";
        const stderrFile = args.stderrFile ? await fse.open(args.stderrFile, "w") : "ignore";
        await new Promise<void>((resolve) => {
            childProcess
                .spawn("docker", ["logs", this.id], {
                    stdio: ["ignore", stdoutFile, stderrFile],
                })
                .once("close", resolve);
        });
        if (args.stdoutFile) await fse.close(<number>stdoutFile);
        if (args.stderrFile) await fse.close(<number>stderrFile);
    }

    /**
     * Detects whether the docker command is actually podman.
     * To do this, it looks for "podman" in the output of "docker --help".
     */
    static isPodman(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            childProcess.execFile("docker", ["--help"], (err, stdout) => {
                if (err) reject(err);
                else resolve(stdout.toLowerCase().includes("podman"));
            });
        });
    }

    /**
     * Supply the right hostname to use to talk to the host machine. On Docker this
     * is "host.docker.internal" and on Podman this is "host.containers.internal".
     */
    static async hostnameOfHost(): Promise<"host.containers.internal" | "host.docker.internal"> {
        return (await Docker.isPodman()) ? "host.containers.internal" : "host.docker.internal";
    }
}
