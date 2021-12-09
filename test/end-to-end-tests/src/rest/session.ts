/*
Copyright 2018 New Vector Ltd

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

import { Logger } from '../logger';
import { RestRoom } from './room';
import { approveConsent } from './consent';
import { Credentials } from "./creator";

interface RoomOptions {
    invite: string;
    public: boolean;
    topic: string;
    dm: boolean;
}

export class RestSession {
    private _displayName: string = null;
    private readonly rooms: Record<string, RestRoom> = {};
    readonly log: Logger;

    constructor(private readonly credentials: Credentials) {
        this.log = new Logger(credentials.userId);
    }

    userId(): string {
        return this.credentials.userId;
    }

    userName(): string {
        return this.credentials.userId.split(":")[0].substr(1);
    }

    displayName(): string {
        return this._displayName;
    }

    async setDisplayName(displayName: string): Promise<void> {
        this.log.step(`sets their display name to ${displayName}`);
        this._displayName = displayName;
        await this.put(`/profile/${this.credentials.userId}/displayname`, {
            displayname: displayName,
        });
        this.log.done();
    }

    async join(roomIdOrAlias: string): Promise<RestRoom> {
        this.log.step(`joins ${roomIdOrAlias}`);
        const roomId = (await this.post(`/join/${encodeURIComponent(roomIdOrAlias)}`)).room_id;
        this.log.done();
        const room = new RestRoom(this, roomId, this.log);
        this.rooms[roomId] = room;
        this.rooms[roomIdOrAlias] = room;
        return room;
    }

    room(roomIdOrAlias: string): RestRoom {
        if (this.rooms.hasOwnProperty(roomIdOrAlias)) {
            return this.rooms[roomIdOrAlias];
        } else {
            throw new Error(`${this.credentials.userId} is not in ${roomIdOrAlias}`);
        }
    }

    async createRoom(name: string, options: RoomOptions): Promise<RestRoom> {
        this.log.step(`creates room ${name}`);
        const body = {
            name,
        };
        if (options.invite) {
            body['invite'] = options.invite;
        }
        if (options.public) {
            body['visibility'] = "public";
        } else {
            body['visibility'] = "private";
        }
        if (options.dm) {
            body['is_direct'] = true;
        }
        if (options.topic) {
            body['topic'] = options.topic;
        }

        const roomId = (await this.post(`/createRoom`, body)).room_id;
        this.log.done();
        return new RestRoom(this, roomId, this.log);
    }

    post(csApiPath: string, body?: any): Promise<any> {
        return this.request("POST", csApiPath, body);
    }

    put(csApiPath: string, body?: any): Promise<any> {
        return this.request("PUT", csApiPath, body);
    }

    async request(method: string, csApiPath: string, body?: any): Promise<any> {
        try {
            return await request({
                url: `${this.credentials.hsUrl}/_matrix/client/r0${csApiPath}`,
                method,
                headers: {
                    "Authorization": `Bearer ${this.credentials.accessToken}`,
                },
                json: true,
                body,
            });
        } catch (err) {
            if (!err.response) {
                throw err;
            }
            const responseBody = err.response.body;
            if (responseBody.errcode === 'M_CONSENT_NOT_GIVEN') {
                await approveConsent(responseBody.consent_uri);
                return this.request(method, csApiPath, body);
            } else if (responseBody && responseBody.error) {
                throw new Error(`${method} ${csApiPath}: ${responseBody.error}`);
            } else {
                throw new Error(`${method} ${csApiPath}: ${err.response.statusCode}`);
            }
        }
    }
}
