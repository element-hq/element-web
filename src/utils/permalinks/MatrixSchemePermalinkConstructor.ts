/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import PermalinkConstructor, { PermalinkParts } from "./PermalinkConstructor";

/**
 * Generates matrix: scheme permalinks
 */
export default class MatrixSchemePermalinkConstructor extends PermalinkConstructor {
    public constructor() {
        super();
    }

    private encodeEntity(entity: string): string {
        if (entity[0] === "!") {
            return `roomid/${entity.slice(1)}`;
        } else if (entity[0] === "#") {
            return `r/${entity.slice(1)}`;
        } else if (entity[0] === "@") {
            return `u/${entity.slice(1)}`;
        } else if (entity[0] === "$") {
            return `e/${entity.slice(1)}`;
        }

        throw new Error("Cannot encode entity: " + entity);
    }

    public forEvent(roomId: string, eventId: string, serverCandidates: string[]): string {
        return (
            `matrix:${this.encodeEntity(roomId)}` +
            `/${this.encodeEntity(eventId)}${this.encodeServerCandidates(serverCandidates)}`
        );
    }

    public forRoom(roomIdOrAlias: string, serverCandidates: string[]): string {
        return `matrix:${this.encodeEntity(roomIdOrAlias)}${this.encodeServerCandidates(serverCandidates)}`;
    }

    public forUser(userId: string): string {
        return `matrix:${this.encodeEntity(userId)}`;
    }

    public forEntity(entityId: string): string {
        return `matrix:${this.encodeEntity(entityId)}`;
    }

    public isPermalinkHost(testHost: string): boolean {
        // TODO: Change API signature to accept the URL for checking
        return testHost === "";
    }

    public encodeServerCandidates(candidates: string[]): string {
        if (!candidates || candidates.length === 0) return "";
        return `?via=${candidates.map((c) => encodeURIComponent(c)).join("&via=")}`;
    }

    public parsePermalink(fullUrl: string): PermalinkParts {
        if (!fullUrl || !fullUrl.startsWith("matrix:")) {
            throw new Error("Does not appear to be a permalink");
        }

        const url = new URL(fullUrl);
        const parts = url.pathname.split("/");

        const identifier = parts[0];
        const entityNoSigil = parts[1];
        if (identifier === "u") {
            // Probably a user, no further parsing needed.
            return PermalinkParts.forUser(`@${entityNoSigil}`);
        } else if (identifier === "r" || identifier === "roomid") {
            const sigil = identifier === "r" ? "#" : "!";

            if (parts.length === 2) {
                // room without event permalink
                const [roomId, query = ""] = entityNoSigil.split("?");
                const via = query.split(/&?via=/g).filter((p) => !!p);
                return PermalinkParts.forRoom(`${sigil}${roomId}`, via);
            }

            if (parts[2] === "e") {
                // event permalink
                const eventIdAndQuery = parts.length > 3 ? parts.slice(3).join("/") : "";
                const [eventId, query = ""] = eventIdAndQuery.split("?");
                const via = query.split(/&?via=/g).filter((p) => !!p);
                return PermalinkParts.forEvent(`${sigil}${entityNoSigil}`, `$${eventId}`, via);
            }

            throw new Error("Faulty room permalink");
        } else {
            throw new Error("Unknown entity type in permalink");
        }
    }
}
