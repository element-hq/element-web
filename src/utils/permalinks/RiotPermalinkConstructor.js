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

import PermalinkConstructor from "./PermalinkConstructor";

/**
 * Generates permalinks that self-reference the running webapp
 */
export default class RiotPermalinkConstructor extends PermalinkConstructor {

    _riotUrl: string;

    constructor(riotUrl: string) {
        super();
        this._riotUrl = riotUrl;
    }

    forEvent(roomId: string, eventId: string, serverCandidates: string[]): string {
        // TODO: Fix URL
        return `${this._riotUrl}/#/${roomId}/${eventId}${this.encodeServerCandidates(serverCandidates)}`;
    }

    forRoom(roomIdOrAlias: string, serverCandidates: string[]): string {
        // TODO: Fix URL
        return `${this._riotUrl}/#/${roomIdOrAlias}${this.encodeServerCandidates(serverCandidates)}`;
    }

    forUser(userId: string): string {
        // TODO: Fix URL
        return `${this._riotUrl}/#/${userId}`;
    }

    forGroup(groupId: string): string {
        // TODO: Fix URL
        return `${this._riotUrl}/#/${groupId}`;
    }

    isPermalinkHost(testHost: string): boolean {
        // TODO: Actual check
        return testHost === this._riotUrl;
    }

    encodeServerCandidates(candidates: string[]) {
        if (!candidates || candidates.length === 0) return '';
        return `?via=${candidates.map(c => encodeURIComponent(c)).join("&via=")}`;
    }
}
