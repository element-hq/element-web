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

/**
 * @param cmd - command to execute
 * @param args - arguments to pass to executed command
 * @param suppressOutput - whether to suppress the stdout and stderr resulting from this command.
 * @return Promise which resolves to an object containing the string value of what was
 *         written to stdout and stderr by the executed command.
 */
const exec = (cmd: string, args: string[], suppressOutput = false): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve, reject) => {
        if (!suppressOutput) {
            const log = ["Running command:", cmd, ...args, "\n"].join(" ");
            // When in CI mode we combine reports from multiple runners into a single HTML report
            // which has separate files for stdout and stderr, so we print the executed command to both
            process.stdout.write(log);
            if (process.env.CI) process.stderr.write(log);
        }
        const { stdout, stderr } = childProcess.execFile(cmd, args, { encoding: "utf8" }, (err, stdout, stderr) => {
            if (err) reject(err);
            resolve({ stdout, stderr });
            if (!suppressOutput) {
                process.stdout.write("\n");
                if (process.env.CI) process.stderr.write("\n");
            }
        });
        if (!suppressOutput) {
            stdout.pipe(process.stdout);
            stderr.pipe(process.stderr);
        }
    });
};

export class Docker {
    public id: string;

    async run(opts: { image: string; containerName: string; params?: string[]; cmd?: string[] }): Promise<string> {
        const userInfo = os.userInfo();
        const params = opts.params ?? [];

        const isPodman = await Docker.isPodman();
        if (params.includes("-v") && userInfo.uid >= 0) {
            // Run the docker container as our uid:gid to prevent problems with permissions.
            if (isPodman) {
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

        // Make host.containers.internal work to allow the container to talk to other services via host ports.
        if (isPodman) {
            params.push("--network");
            params.push("slirp4netns:allow_host_loopback=true");
        } else {
            // Docker for Desktop includes a host-gateway mapping on host.docker.internal but to simplify the config
            // we use the Podman variant host.containers.internal in all environments.
            params.push("--add-host");
            params.push("host.containers.internal:host-gateway");
        }

        // Provided we are not running in CI, add a `--rm` parameter.
        // There is no need to remove containers in CI (since they are automatically removed anyway), and
        // `--rm` means that if a container crashes this means its logs are wiped out.
        if (!process.env.CI) params.unshift("--rm");

        const args = [
            "run",
            "--name",
            `${opts.containerName}-${crypto.randomBytes(4).toString("hex")}`,
            "-d",
            ...params,
            opts.image,
        ];

        if (opts.cmd) args.push(...opts.cmd);

        const { stdout } = await exec("docker", args);
        this.id = stdout.trim();
        return this.id;
    }

    async stop(): Promise<void> {
        try {
            await exec("docker", ["stop", this.id]);
        } catch (err) {
            console.error(`Failed to stop docker container`, this.id, err);
        }
    }

    /**
     * @param params - list of parameters to pass to `docker exec`
     * @param suppressOutput - whether to suppress the stdout and stderr resulting from this command.
     */
    async exec(params: string[], suppressOutput = true): Promise<void> {
        await exec("docker", ["exec", this.id, ...params], suppressOutput);
    }

    async getContainerIp(): Promise<string> {
        const { stdout } = await exec("docker", ["inspect", "-f", "{{ .NetworkSettings.IPAddress }}", this.id]);
        return stdout.trim();
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
    static async isPodman(): Promise<boolean> {
        const { stdout } = await exec("docker", ["--help"], true);
        return stdout.toLowerCase().includes("podman");
    }
}
