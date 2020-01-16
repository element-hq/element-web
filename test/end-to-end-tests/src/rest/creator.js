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

const {exec} = require('child_process');
const request = require('request-promise-native');
const RestSession = require('./session');
const RestMultiSession = require('./multi');

function execAsync(command, options) {
    return new Promise((resolve, reject) => {
        exec(command, options, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve({stdout, stderr});
            }
        });
    });
}

module.exports = class RestSessionCreator {
    constructor(synapseSubdir, hsUrl, cwd) {
        this.synapseSubdir = synapseSubdir;
        this.hsUrl = hsUrl;
        this.cwd = cwd;
    }

    async createSessionRange(usernames, password, groupName) {
        const sessionPromises = usernames.map((username) => this.createSession(username, password));
        const sessions = await Promise.all(sessionPromises);
        return new RestMultiSession(sessions, groupName);
    }

    async createSession(username, password) {
        await this._register(username, password);
        console.log(` * created REST user ${username} ... done`);
        const authResult = await this._authenticate(username, password);
        return new RestSession(authResult);
    }

    async _register(username, password) {
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

        await execAsync(allCmds, {cwd: this.cwd, encoding: 'utf-8'});
    }

    async _authenticate(username, password) {
        const requestBody = {
            "type": "m.login.password",
            "identifier": {
                "type": "m.id.user",
                "user": username,
            },
            "password": password,
        };
        const url = `${this.hsUrl}/_matrix/client/r0/login`;
        const responseBody = await request.post({url, json: true, body: requestBody});
        return {
            accessToken: responseBody.access_token,
            homeServer: responseBody.home_server,
            userId: responseBody.user_id,
            deviceId: responseBody.device_id,
            hsUrl: this.hsUrl,
        };
    }
};
