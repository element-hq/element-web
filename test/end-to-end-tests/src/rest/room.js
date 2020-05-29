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

const uuidv4 = require('uuid/v4');

/* no pun intented */
module.exports = class RestRoom {
    constructor(session, roomId, log) {
        this.session = session;
        this._roomId = roomId;
        this.log = log;
    }

    async talk(message) {
        this.log.step(`says "${message}" in ${this._roomId}`);
        const txId = uuidv4();
        await this.session._put(`/rooms/${this._roomId}/send/m.room.message/${txId}`, {
            "msgtype": "m.text",
            "body": message,
        });
        this.log.done();
        return txId;
    }

    async leave() {
        this.log.step(`leaves ${this._roomId}`);
        await this.session._post(`/rooms/${this._roomId}/leave`);
        this.log.done();
    }

    roomId() {
        return this._roomId;
    }
};
