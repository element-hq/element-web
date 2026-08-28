/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
    IMAGE_PACK_EVENT_TYPE,
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
    resolveEnabledPacks,
} from "./resolver.ts";
import type { ResolverClient, ResolverRoom } from "./resolver.ts";

interface FakeStateEvent {
    type: string;
    stateKey: string;
    content: Record<string, unknown>;
    getType(): string;
    getStateKey(): string;
    getContent(): Record<string, unknown>;
}

function makeStateEvent(type: string, stateKey: string, content: Record<string, unknown>): FakeStateEvent {
    return {
        type,
        stateKey,
        content,
        getType: () => type,
        getStateKey: () => stateKey,
        getContent: () => content,
    };
}

function makeRoom(roomId: string, events: FakeStateEvent[]): ResolverRoom {
    const byType = new Map<string, FakeStateEvent[]>();
    for (const event of events) {
        const list = byType.get(event.type) ?? [];
        list.push(event);
        byType.set(event.type, list);
    }
    return {
        roomId,
        name: `Room ${roomId}`,
        currentState: {
            getStateEvents(type: string, stateKey?: string) {
                if (stateKey !== undefined) {
                    return byType.get(type)?.find((event) => event.stateKey === stateKey) ?? null;
                }
                return byType.get(type) ?? [];
            },
        },
    };
}

function makeClient(rooms: ResolverRoom[], accountData: Record<string, FakeStateEvent>): ResolverClient {
    return {
        getUserId: () => "@alice:example.org",
        getRoom: (id) => rooms.find((room) => room.roomId === id) ?? null,
        getAccountData: (type) => accountData[type] ?? null,
    };
}

describe("resolveEnabledPacks", () => {
    it("returns personal + global + room + space packs in priority order", () => {
        const globalRoom = makeRoom("!g:example.org", [
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "g", {
                images: { hi: { url: "mxc://e/g-hi" } },
                pack: { display_name: "Global" },
            }),
        ]);
        const room = makeRoom("!r:example.org", [
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "r", {
                images: { hi: { url: "mxc://e/r-hi" } },
                pack: { display_name: "Room" },
            }),
        ]);
        const space = makeRoom("!s:example.org", [
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "s", {
                images: { hi: { url: "mxc://e/s-hi" } },
                pack: { display_name: "Space" },
            }),
        ]);
        const client = makeClient([globalRoom, room, space], {
            [IMAGE_PACK_ROOMS_EVENT_TYPE]: makeStateEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, "", {
                rooms: { [globalRoom.roomId]: { g: {} } },
            }),
            [LEGACY_USER_IMAGE_PACK_EVENT_TYPE]: makeStateEvent(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, "", {
                pack: { display_name: "Personal" },
                images: { hi: { url: "mxc://e/me-hi" } },
            }),
        });

        const out = resolveEnabledPacks(client, room, [space]);
        expect(out.map((entry) => entry.displayName)).toEqual(["Global", "Personal", "Room", "Space"]);
        expect(out.map((entry) => entry.scope)).toEqual(["user", "user", "room", "space"]);
        expect(out.map((entry) => entry.kind)).toEqual(["global", "personal", "room", "space"]);
        expect(out[1]?.pack.images.hi?.url).toBe("mxc://e/me-hi");
    });

    it("deduplicates packs referenced from both stable and legacy account-data", () => {
        const globalRoom = makeRoom("!g:example.org", [
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "g", {
                images: { hi: { url: "mxc://e/g-hi" } },
                pack: { display_name: "Global" },
            }),
        ]);
        const room = makeRoom("!r:example.org", []);
        const client = makeClient([globalRoom, room], {
            [IMAGE_PACK_ROOMS_EVENT_TYPE]: makeStateEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, "", {
                rooms: { [globalRoom.roomId]: { g: {} } },
            }),
            [LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE]: makeStateEvent(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, "", {
                rooms: { [globalRoom.roomId]: { g: {} } },
            }),
        });

        const out = resolveEnabledPacks(client, room, []);
        expect(out).toHaveLength(1);
    });

    it("tolerates rooms where a referenced pack room is no longer available", () => {
        const room = makeRoom("!r:example.org", []);
        const client = makeClient([room], {
            [IMAGE_PACK_ROOMS_EVENT_TYPE]: makeStateEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, "", {
                rooms: { "!missing:example.org": { x: {} } },
            }),
        });
        const out = resolveEnabledPacks(client, room, []);
        expect(out).toEqual([]);
    });

    it("falls back to the legacy room-emotes event for backwards compatibility", () => {
        const room = makeRoom("!r:example.org", [
            makeStateEvent(LEGACY_IMAGE_PACK_EVENT_TYPE, "old", {
                images: { hi: { url: "mxc://e/old" } },
                pack: { display_name: "Legacy" },
            }),
        ]);
        const client = makeClient([room], {});
        const out = resolveEnabledPacks(client, room, []);
        expect(out.map((entry) => entry.displayName)).toEqual(["Legacy"]);
    });

    it("does not crash when the room state lookup returns an empty list for a state key", () => {
        const room = {
            roomId: "!r:example.org",
            currentState: { getStateEvents: () => [] },
        } satisfies ResolverRoom;
        const client = makeClient([room], {});
        expect(resolveEnabledPacks(client, room)).toEqual([]);
    });

    it("applies private per-room ordering without publishing a state event", () => {
        const room = makeRoom("!r:example.org", [
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "a", { images: { a: { url: "mxc://e/a" } } }),
            makeStateEvent(IMAGE_PACK_EVENT_TYPE, "b", { images: { b: { url: "mxc://e/b" } } }),
        ]);
        const client = makeClient([room], {
            [ROOM_IMAGE_PACK_ORDER_EVENT_TYPE]: makeStateEvent(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE, "", {
                rooms: { [room.roomId]: ["b", "a"] },
            }),
        });
        expect(resolveEnabledPacks(client, room).map((pack) => pack.stateKey)).toEqual(["b", "a"]);
    });
});
