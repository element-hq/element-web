/*
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import { exec } from 'child_process';
import request = require('request-promise-native');

import { RestSession } from './session';
import { RestMultiSession } from './multi';

interface ExecResult {
    stdout: string;
    stderr: string;
}

function execAsync(command: string, options: Parameters<typeof exec>[1]): Promise<ExecResult> {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

export interface Credentials {
    accessToken: string;
    homeServer: string;
    userId: string;
    deviceId: string;
    hsUrl: string;
}

export class RestSessionCreator {
    constructor(private readonly synapseSubdir: string, private readonly hsUrl: string, private readonly cwd: string) {}

    public async createSessionRange(usernames: string[], password: string,
        groupName: string): Promise<RestMultiSession> {
        const sessionPromises = usernames.map((username) => this.createSession(username, password));
        const sessions = await Promise.all(sessionPromises);
        return new RestMultiSession(sessions, groupName);
    }

    public async createSession(username: string, password: string): Promise<RestSession> {
        await this.register(username, password);
        console.log(` * created REST user ${username} ... done`);
        const authResult = await this.authenticate(username, password);
        return new RestSession(authResult);
    }

    private async register(username: string, password: string): Promise<void> {
        const registerArgs = [
            '-c homeserver.yaml',
            `-u ${username}`,
            `-p ${password}`,
            '--no-admin',
            this.hsUrl,
        ];
        const registerCmd = `./register_new_matrix_user ${registerArgs.join(' ')}`;
        const allCmds = [
            `cd ${this.synapseSubdir}`,
            ". ./activate",
            registerCmd,
        ].join(' && ');

        await execAsync(allCmds, { cwd: this.cwd, encoding: 'utf-8' });
    }

    private async authenticate(username: string, password: string): Promise<Credentials> {
        const requestBody = {
            "type": "m.login.password",
            "identifier": {
                "type": "m.id.user",
                "user": username,
            },
            "password": password,
        };
        const url = `${this.hsUrl}/_matrix/client/r0/login`;
        const responseBody = await request.post({ url, json: true, body: requestBody });
        return {
            accessToken: responseBody.access_token,
            homeServer: responseBody.home_server,
            userId: responseBody.user_id,
            deviceId: responseBody.device_id,
            hsUrl: this.hsUrl,
        };
    }
}
