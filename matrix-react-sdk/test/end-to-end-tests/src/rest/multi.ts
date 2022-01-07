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

import { Logger } from '../logger';
import { RestSession } from "./session";
import { RestRoom } from "./room";

export class RestMultiSession {
    readonly log: Logger;

    constructor(public readonly sessions: RestSession[], groupName: string) {
        this.log = new Logger(groupName);
    }

    public slice(groupName: string, start: number, end?: number): RestMultiSession {
        return new RestMultiSession(this.sessions.slice(start, end), groupName);
    }

    public pop(userName: string): RestSession {
        const idx = this.sessions.findIndex((s) => s.userName() === userName);
        if (idx === -1) {
            throw new Error(`user ${userName} not found`);
        }
        const session = this.sessions.splice(idx, 1)[0];
        return session;
    }

    public async setDisplayName(fn: (s: RestSession) => string): Promise<void> {
        this.log.step("set their display name");
        await Promise.all(this.sessions.map(async (s: RestSession) => {
            s.log.mute();
            await s.setDisplayName(fn(s));
            s.log.unmute();
        }));
        this.log.done();
    }

    public async join(roomIdOrAlias: string): Promise<RestMultiRoom> {
        this.log.step(`join ${roomIdOrAlias}`);
        const rooms = await Promise.all(this.sessions.map(async (s) => {
            s.log.mute();
            const room = await s.join(roomIdOrAlias);
            s.log.unmute();
            return room;
        }));
        this.log.done();
        return new RestMultiRoom(rooms, roomIdOrAlias, this.log);
    }

    public room(roomIdOrAlias: string): RestMultiRoom {
        const rooms = this.sessions.map(s => s.room(roomIdOrAlias));
        return new RestMultiRoom(rooms, roomIdOrAlias, this.log);
    }
}

class RestMultiRoom {
    constructor(public readonly rooms: RestRoom[], private readonly roomIdOrAlias: string,
                private readonly log: Logger) {}

    public async talk(message: string): Promise<void> {
        this.log.step(`say "${message}" in ${this.roomIdOrAlias}`);
        await Promise.all(this.rooms.map(async (r: RestRoom) => {
            r.log.mute();
            await r.talk(message);
            r.log.unmute();
        }));
        this.log.done();
    }

    public async leave() {
        this.log.step(`leave ${this.roomIdOrAlias}`);
        await Promise.all(this.rooms.map(async (r) => {
            r.log.mute();
            await r.leave();
            r.log.unmute();
        }));
        this.log.done();
    }
}
