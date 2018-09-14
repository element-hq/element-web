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
const RestRoom = require('./room');
const {approveConsent} = require('./consent');

module.exports = class RestMultiSession {
    constructor(sessions) {
        this.sessions = sessions;
    }

    slice(start, end) {
        return new RestMultiSession(this.sessions.slice(start, end));
    }

    pop(userName) {
        const idx = this.sessions.findIndex((s) => s.userName() === userName);
        if(idx === -1) {
            throw new Error(`user ${userName} not found`);
        }
        const session = this.sessions.splice(idx, 1)[0];
        return session;
    }

    async setDisplayName(fn) {
        await Promise.all(this.sessions.map((s) => s.setDisplayName(fn(s))));
    }

    async join(roomId) {
        const rooms = await Promise.all(this.sessions.map((s) => s.join(roomId)));
        return new RestMultiRoom(rooms);
    }
}

class RestMultiRoom {
    constructor(rooms) {
        this.rooms = rooms;
    }

    async talk(message) {
        await Promise.all(this.rooms.map((r) => r.talk(message)));
    }

    async leave() {
        await Promise.all(this.rooms.map((r) => r.leave()));
    }
}
