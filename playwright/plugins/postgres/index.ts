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

import { Docker } from "../docker";

export const PG_PASSWORD = "p4S5w0rD";

/**
 * Class to manage a postgres database in docker
 */
export class PostgresDocker extends Docker {
    /**
     * @param key an opaque string to use when naming the docker containers instantiated by this class
     */
    public constructor(private key: string) {
        super();
    }

    private async waitForPostgresReady(): Promise<void> {
        const waitTimeMillis = 30000;
        const startTime = new Date().getTime();
        let lastErr: Error | null = null;
        while (new Date().getTime() - startTime < waitTimeMillis) {
            try {
                await this.exec(["pg_isready", "-U", "postgres"], true);
                lastErr = null;
                break;
            } catch (err) {
                console.log("pg_isready: failed");
                lastErr = err;
            }
        }
        if (lastErr) {
            console.log("rethrowing");
            throw lastErr;
        }
    }

    public async start(): Promise<{
        ipAddress: string;
        containerId: string;
    }> {
        console.log(new Date(), "starting postgres container");
        const containerId = await this.run({
            image: "postgres",
            containerName: `react-sdk-playwright-postgres-${this.key}`,
            params: ["--tmpfs=/pgtmpfs", "-e", "PGDATA=/pgtmpfs", "-e", `POSTGRES_PASSWORD=${PG_PASSWORD}`],
            // Optimise for testing - https://www.postgresql.org/docs/current/non-durability.html
            cmd: ["-c", `fsync=off`, "-c", `synchronous_commit=off`, "-c", `full_page_writes=off`],
        });

        const ipAddress = await this.getContainerIp();
        console.log(new Date(), "postgres container up");

        await this.waitForPostgresReady();
        console.log(new Date(), "postgres container ready");
        return { ipAddress, containerId };
    }
}
