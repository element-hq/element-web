/*
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

/**
 * Interface for classes that actually produce permalinks (strings).
 * TODO: Convert this to a real TypeScript interface
 */
export default class PermalinkConstructor {
    forEvent(roomId: string, eventId: string, serverCandidates: string[]): string {
        throw new Error("Not implemented");
    }

    forRoom(roomIdOrAlias: string, serverCandidates: string[]): string {
        throw new Error("Not implemented");
    }

    forGroup(groupId: string): string {
        throw new Error("Not implemented");
    }

    forUser(userId: string): string {
        throw new Error("Not implemented");
    }

    forEntity(entityId: string): string {
        throw new Error("Not implemented");
    }

    isPermalinkHost(host: string): boolean {
        throw new Error("Not implemented");
    }

    parsePermalink(fullUrl: string): PermalinkParts {
        throw new Error("Not implemented");
    }
}

// Inspired by/Borrowed with permission from the matrix-bot-sdk:
// https://github.com/turt2live/matrix-js-bot-sdk/blob/7c4665c9a25c2c8e0fe4e509f2616505b5b66a1c/src/Permalinks.ts#L1-L6
export class PermalinkParts {
    roomIdOrAlias: string;
    eventId: string;
    userId: string;
    groupId: string;
    viaServers: string[];

    constructor(roomIdOrAlias: string, eventId: string, userId: string, groupId: string, viaServers: string[]) {
        this.roomIdOrAlias = roomIdOrAlias;
        this.eventId = eventId;
        this.groupId = groupId;
        this.userId = userId;
        this.viaServers = viaServers;
    }

    static forUser(userId: string): PermalinkParts {
        return new PermalinkParts(null, null, userId, null, null);
    }

    static forGroup(groupId: string): PermalinkParts {
        return new PermalinkParts(null, null, null, groupId, null);
    }

    static forRoom(roomIdOrAlias: string, viaServers: string[]): PermalinkParts {
        return new PermalinkParts(roomIdOrAlias, null, null, null, viaServers || []);
    }

    static forEvent(roomId: string, eventId: string, viaServers: string[]): PermalinkParts {
        return new PermalinkParts(roomId, eventId, null, null, viaServers || []);
    }
}
