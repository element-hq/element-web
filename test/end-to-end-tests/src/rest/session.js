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

const request = require('request-promise-native');
const Logger = require('../logger');
const RestRoom = require('./room');
const {approveConsent} = require('./consent');

module.exports = class RestSession {
    constructor(credentials) {
        this.log = new Logger(credentials.userId);
        this._credentials = credentials;
        this._displayName = null;
        this._rooms = {};
    }

    userId() {
        return this._credentials.userId;
    }

    userName() {
        return this._credentials.userId.split(":")[0].substr(1);
    }

    displayName() {
        return this._displayName;
    }

    async setDisplayName(displayName) {
        this.log.step(`sets their display name to ${displayName}`);
        this._displayName = displayName;
        await this._put(`/profile/${this._credentials.userId}/displayname`, {
            displayname: displayName,
        });
        this.log.done();
    }

    async join(roomIdOrAlias) {
        this.log.step(`joins ${roomIdOrAlias}`);
        const roomId = (await this._post(`/join/${encodeURIComponent(roomIdOrAlias)}`)).room_id;
        this.log.done();
        const room = new RestRoom(this, roomId, this.log);
        this._rooms[roomId] = room;
        this._rooms[roomIdOrAlias] = room;
        return room;
    }

    room(roomIdOrAlias) {
        if (this._rooms.hasOwnProperty(roomIdOrAlias)) {
            return this._rooms[roomIdOrAlias];
        } else {
            throw new Error(`${this._credentials.userId} is not in ${roomIdOrAlias}`);
        }
    }

    async createRoom(name, options) {
        this.log.step(`creates room ${name}`);
        const body = {
            name,
        };
        if (options.invite) {
            body.invite = options.invite;
        }
        if (options.public) {
            body.visibility = "public";
        } else {
            body.visibility = "private";
        }
        if (options.dm) {
            body.is_direct = true;
        }
        if (options.topic) {
            body.topic = options.topic;
        }

        const roomId = (await this._post(`/createRoom`, body)).room_id;
        this.log.done();
        return new RestRoom(this, roomId, this.log);
    }

    _post(csApiPath, body) {
        return this._request("POST", csApiPath, body);
    }

    _put(csApiPath, body) {
        return this._request("PUT", csApiPath, body);
    }

    async _request(method, csApiPath, body) {
        try {
            const responseBody = await request({
                url: `${this._credentials.hsUrl}/_matrix/client/r0${csApiPath}`,
                method,
                headers: {
                    "Authorization": `Bearer ${this._credentials.accessToken}`,
                },
                json: true,
                body,
            });
            return responseBody;
        } catch (err) {
            const responseBody = err.response.body;
            if (responseBody.errcode === 'M_CONSENT_NOT_GIVEN') {
                await approveConsent(responseBody.consent_uri);
                return this._request(method, csApiPath, body);
            } else if (responseBody && responseBody.error) {
                throw new Error(`${method} ${csApiPath}: ${responseBody.error}`);
            } else {
                throw new Error(`${method} ${csApiPath}: ${err.response.statusCode}`);
            }
        }
    }
};
