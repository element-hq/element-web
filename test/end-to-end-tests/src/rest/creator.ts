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

import request = require('request-promise-native');
import * as crypto from 'crypto';

import { RestSession } from './session';
import { RestMultiSession } from './multi';

export interface Credentials {
    accessToken: string;
    homeServer: string;
    userId: string;
    deviceId: string;
    hsUrl: string;
}

export class RestSessionCreator {
    constructor(private readonly hsUrl: string, private readonly regSecret: string) {}

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
        // get a nonce
        const regUrl = `${this.hsUrl}/_synapse/admin/v1/register`;
        const nonceResp = await request.get({ uri: regUrl, json: true });

        const mac = crypto.createHmac('sha1', this.regSecret).update(
            `${nonceResp.nonce}\0${username}\0${password}\0notadmin`,
        ).digest('hex');

        await request.post({
            uri: regUrl,
            json: true,
            body: {
                nonce: nonceResp.nonce,
                username,
                password,
                mac,
                admin: false,
            },
        });
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
