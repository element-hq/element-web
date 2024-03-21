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

import PermalinkConstructor, { PermalinkParts } from "./PermalinkConstructor";

export const host = "matrix.to";
export const baseUrl = `https://${host}`;
export const baseUrlPattern = `^(?:https?://)?${host.replace(".", "\\.")}/#/(.*)`;

/**
 * Generates matrix.to permalinks
 */
export default class MatrixToPermalinkConstructor extends PermalinkConstructor {
    public constructor() {
        super();
    }

    public forEvent(roomId: string, eventId: string, serverCandidates: string[]): string {
        return `${baseUrl}/#/${roomId}/${eventId}${this.encodeServerCandidates(serverCandidates)}`;
    }

    public forRoom(roomIdOrAlias: string, serverCandidates: string[]): string {
        return `${baseUrl}/#/${roomIdOrAlias}${this.encodeServerCandidates(serverCandidates)}`;
    }

    public forUser(userId: string): string {
        return `${baseUrl}/#/${userId}`;
    }

    public forEntity(entityId: string): string {
        return `${baseUrl}/#/${entityId}`;
    }

    public isPermalinkHost(testHost: string): boolean {
        return testHost === host;
    }

    public encodeServerCandidates(candidates: string[]): string {
        if (!candidates || candidates.length === 0) return "";
        return `?via=${candidates.map((c) => encodeURIComponent(c)).join("&via=")}`;
    }

    // Heavily inspired by/borrowed from the matrix-bot-sdk (with permission):
    // https://github.com/turt2live/matrix-js-bot-sdk/blob/7c4665c9a25c2c8e0fe4e509f2616505b5b66a1c/src/Permalinks.ts#L33-L61
    public parsePermalink(fullUrl: string): PermalinkParts {
        if (!fullUrl) {
            throw new Error("Does not appear to be a permalink");
        }

        const matches = [...fullUrl.matchAll(new RegExp(baseUrlPattern, "gi"))][0];

        if (!matches || matches.length < 2) {
            throw new Error("Does not appear to be a permalink");
        }

        const parts = matches[1].split("/");

        const entity = parts[0];
        if (entity[0] === "@") {
            // Probably a user, no further parsing needed.
            return PermalinkParts.forUser(entity);
        } else if (entity[0] === "#" || entity[0] === "!") {
            if (parts.length === 1) {
                // room without event permalink
                const [roomId, query = ""] = entity.split("?");
                const via = query.split(/&?via=/g).filter((p) => !!p);
                return PermalinkParts.forRoom(roomId, via);
            }

            // rejoin the rest because v3 events can have slashes (annoyingly)
            const eventIdAndQuery = parts.length > 1 ? parts.slice(1).join("/") : "";
            const [eventId, query = ""] = eventIdAndQuery.split("?");
            const via = query.split(/&?via=/g).filter((p) => !!p);

            return PermalinkParts.forEvent(entity, eventId, via);
        } else {
            throw new Error("Unknown entity type in permalink");
        }
    }
}
