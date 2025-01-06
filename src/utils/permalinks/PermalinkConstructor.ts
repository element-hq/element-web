/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Interface for classes that actually produce permalinks (strings).
 * TODO: Convert this to a real TypeScript interface
 */
export default class PermalinkConstructor {
    public forEvent(roomId: string, eventId: string, serverCandidates: string[] = []): string {
        throw new Error("Not implemented");
    }

    public forRoom(roomIdOrAlias: string, serverCandidates: string[] = []): string {
        throw new Error("Not implemented");
    }

    public forUser(userId: string): string {
        throw new Error("Not implemented");
    }

    public forEntity(entityId: string): string {
        throw new Error("Not implemented");
    }

    public isPermalinkHost(host: string): boolean {
        throw new Error("Not implemented");
    }

    public parsePermalink(fullUrl: string): PermalinkParts {
        throw new Error("Not implemented");
    }
}

// Inspired by/Borrowed with permission from the matrix-bot-sdk:
// https://github.com/turt2live/matrix-js-bot-sdk/blob/7c4665c9a25c2c8e0fe4e509f2616505b5b66a1c/src/Permalinks.ts#L1-L6
export class PermalinkParts {
    public constructor(
        public readonly roomIdOrAlias: string | null,
        public readonly eventId: string | null,
        public readonly userId: string | null,
        public readonly viaServers: string[] | null,
    ) {}

    public static forUser(userId: string): PermalinkParts {
        return new PermalinkParts(null, null, userId, null);
    }

    public static forRoom(roomIdOrAlias: string, viaServers: string[] = []): PermalinkParts {
        return new PermalinkParts(roomIdOrAlias, null, null, viaServers);
    }

    public static forEvent(roomId: string, eventId: string, viaServers: string[] = []): PermalinkParts {
        return new PermalinkParts(roomId, eventId, null, viaServers);
    }

    public get primaryEntityId(): string | null {
        return this.roomIdOrAlias || this.userId;
    }
}
