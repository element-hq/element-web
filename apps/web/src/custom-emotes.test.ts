/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { describe, expect, it, vi } from "vitest";
import { mkEvent, mkStubRoom, mockStateEventImplementation } from "test-utils";

import {
    createRoomImagePack,
    createUserImagePack,
    decorateCustomEmotes,
    deleteUserImagePack,
    deleteRoomImagePack,
    disableGlobalPack,
    enableGlobalPack,
    getCustomEmotesForRoom,
    getImagePacksForRoom,
    getRoomImagePackOrder,
    IMAGE_PACK_EVENT_TYPE,
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    ROOM_IMAGE_PACK_ORDER_EVENT_TYPE,
    prepareCustomEmotesForEditing,
    redactRoomImagePack,
    removeRoomPackEmote,
    removeUserPackEmote,
    resolveCustomEmoteToken,
    reorderRoomImagePacks,
    runAccountDataTransaction,
    updateRoomImagePackMetadata,
    replaceUserImagePack,
    upsertRoomPackEmote,
    upsertUserImagePack,
    upsertUserPackEmote,
    type CustomEmote,
    type ResolvedImagePack,
} from "./custom-emotes";

const USER_ID = "@alice:example.org";

function packEvent(
    roomId: string,
    stateKey: string,
    content: Record<string, unknown>,
    type = IMAGE_PACK_EVENT_TYPE,
): MatrixEvent {
    return mkEvent({ event: true, type, room: roomId, user: USER_ID, skey: stateKey, content });
}

function accountDataEvent(type: string, content: Record<string, unknown>): MatrixEvent {
    return mkEvent({ event: true, type, user: USER_ID, content });
}

function setStateEvents(room: Room, events: MatrixEvent[]): void {
    vi.mocked(room.currentState.getStateEvents).mockImplementation(mockStateEventImplementation(events));
}

function clientWithRooms(rooms: Room[], accountData: MatrixEvent[] = []): MatrixClient {
    return {
        getUserId: vi.fn(() => USER_ID),
        getRoom: vi.fn((roomId: string) => rooms.find((room) => room.roomId === roomId) ?? null),
        getAccountData: vi.fn((type: string) => accountData.find((event) => event.getType() === type)),
    } as unknown as MatrixClient;
}

function emote(shortcode: string, pack: ResolvedImagePack, packSlug = "pack"): CustomEmote {
    return {
        shortcode,
        url: `mxc://example.org/${shortcode}`,
        body: `${shortcode} description`,
        pack,
        packSlug,
        sendToken: `:${shortcode}:`,
    };
}

describe("custom emotes", () => {
    it("discovers the legacy personal image pack before referenced room packs", () => {
        const room = mkStubRoom("!room:example.org", "Room");
        const global = mkStubRoom("!global:example.org", "Global");
        setStateEvents(global, [packEvent(global.roomId, "global", { images: { party: { url: "mxc://e/g" } } })]);

        const client = clientWithRooms(
            [room, global],
            [
                accountDataEvent(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {
                    pack: { display_name: "Neofox", usage: ["emoticon"] },
                    images: { neofox: { url: "mxc://e/neofox", usage: ["emoticon"] } },
                }),
                accountDataEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, {
                    rooms: { [global.roomId]: { global: {} } },
                }),
            ],
        );

        expect(getImagePacksForRoom(client, room, () => null)).toMatchObject([
            { roomId: USER_ID, stateKey: LEGACY_USER_IMAGE_PACK_EVENT_TYPE, source: "user", displayName: "Neofox" },
            { roomId: global.roomId, stateKey: "global", source: "global" },
        ]);
    });

    it("discovers global, room, and canonical-space packs in priority order", () => {
        const room = mkStubRoom("!room:example.org", "Room");
        const global = mkStubRoom("!global:example.org", "Global");
        const space = mkStubRoom("!space:example.org", "Space");
        setStateEvents(global, [packEvent(global.roomId, "global", { images: { global: { url: "mxc://e/g" } } })]);
        setStateEvents(room, [packEvent(room.roomId, "room", { images: { room: { url: "mxc://e/r" } } })]);
        setStateEvents(space, [packEvent(space.roomId, "space", { images: { space: { url: "mxc://e/s" } } })]);

        const client = clientWithRooms(
            [room, global, space],
            [accountDataEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, { rooms: { [global.roomId]: { global: {} } } })],
        );
        const parents = new Map([
            [room.roomId, space],
            [space.roomId, room],
        ]);

        expect(getImagePacksForRoom(client, room, (roomId) => parents.get(roomId) ?? null)).toMatchObject([
            { roomId: global.roomId, stateKey: "global", source: "global" },
            { roomId: room.roomId, stateKey: "room", source: "room" },
            { roomId: space.roomId, stateKey: "space", source: "space" },
        ]);
    });

    it("prefers stable events and references while tolerating unavailable rooms", () => {
        const room = mkStubRoom("!room:example.org", "Room");
        const global = mkStubRoom("!global:example.org", "Global");
        setStateEvents(global, [
            packEvent(
                global.roomId,
                "pack",
                { images: { legacy: { url: "mxc://e/legacy" } } },
                LEGACY_IMAGE_PACK_EVENT_TYPE,
            ),
            packEvent(global.roomId, "pack", { images: { stable: { url: "mxc://e/stable" } } }),
        ]);
        const client = clientWithRooms(
            [room, global],
            [
                accountDataEvent(IMAGE_PACK_ROOMS_EVENT_TYPE, {
                    rooms: { [global.roomId]: { pack: {} }, "!missing:example.org": { pack: {} } },
                }),
                accountDataEvent(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, {
                    rooms: { [global.roomId]: { pack: {} } },
                }),
            ],
        );

        const packs = getImagePacksForRoom(client, room, () => null);
        expect(packs).toHaveLength(1);
        expect(Object.keys(packs[0].content.images)).toEqual(["stable"]);
    });

    it("filters pack usage and malformed image URLs without dropping valid images", () => {
        const room = mkStubRoom("!room:example.org", "Room");
        setStateEvents(room, [
            packEvent(room.roomId, "stickers", {
                pack: { usage: ["sticker"] },
                images: { sticker: { url: "mxc://e/sticker" } },
            }),
            packEvent(room.roomId, "mixed", {
                images: { good: { url: "mxc://e/good" }, bad: { url: "https://example.org/bad.png" } },
            }),
        ]);

        const emotes = getCustomEmotesForRoom(clientWithRooms([room]), room, () => null);
        expect(emotes.map(({ shortcode }) => shortcode)).toEqual(["good"]);
    });

    it("creates deterministic qualified tokens for duplicate shortcodes", () => {
        const room = mkStubRoom("!room:example.org", "Room");
        setStateEvents(room, [
            packEvent(room.roomId, "a", {
                pack: { display_name: "Party Pack" },
                images: { wave: { url: "mxc://e/a" } },
            }),
            packEvent(room.roomId, "b", {
                pack: { display_name: "Party Pack" },
                images: { wave: { url: "mxc://e/b" } },
            }),
        ]);

        const emotes = getCustomEmotesForRoom(clientWithRooms([room]), room, () => null);
        expect(emotes.map(({ sendToken }) => sendToken)).toEqual([":wave/party-pack:", ":wave/party-pack-2:"]);
        expect(resolveCustomEmoteToken(":wave:", emotes)).toBeNull();
        expect(resolveCustomEmoteToken(":Wave/party-pack:", emotes)).toBeNull();
        expect(resolveCustomEmoteToken(":wave/party-pack-2:", emotes)?.url).toBe("mxc://e/b");
    });

    it("decorates resolved text outside links and code while preserving plaintext fallbacks", () => {
        const pack: ResolvedImagePack = {
            roomId: "!room:example.org",
            stateKey: "pack",
            displayName: "Pack",
            source: "room",
            content: { images: {} },
        };
        const emotes = [emote("wave", pack)];
        const result = decorateCustomEmotes(
            "Hi :wave/pack: :missing:",
            '<strong>Hi</strong> :wave/pack: <code>:wave:</code> <a href="https://e">:wave:</a> :missing:',
            emotes,
        );

        expect(result.body).toBe("Hi :wave: :missing:");
        expect(result.formattedBody).toContain(
            '<img data-mx-emoticon="" src="mxc://example.org/wave" alt="wave description" title="wave" height="32">',
        );
        expect(result.formattedBody).toContain("<code>:wave:</code>");
        expect(result.formattedBody).toContain('<a href="https://e">:wave:</a>');
        expect(result.formattedBody).toContain(":missing:");
    });

    it("does not decorate tokens inside plaintext URLs", () => {
        const pack: ResolvedImagePack = {
            roomId: "!room:example.org",
            stateKey: "pack",
            displayName: "Pack",
            source: "room",
            content: { images: {} },
        };
        const result = decorateCustomEmotes("https://example.org/:wave:", undefined, [emote("wave", pack)]);
        expect(result).toEqual({
            body: "https://example.org/:wave:",
            formattedBody: undefined,
            hasCustomEmotes: false,
        });
    });

    it("leaves ambiguous unqualified tokens literal", () => {
        const pack: ResolvedImagePack = {
            roomId: "!room:example.org",
            stateKey: "pack",
            displayName: "Pack",
            source: "room",
            content: { images: {} },
        };
        const result = decorateCustomEmotes(":wave:", undefined, [emote("wave", pack), emote("wave", pack, "other")]);
        expect(result).toEqual({ body: ":wave:", formattedBody: undefined, hasCustomEmotes: false });
    });

    it("creates deterministic edit tokens that retain the original MXC", () => {
        const editable = prepareCustomEmotesForEditing(
            '<p>Hi <img data-mx-emoticon src="mxc://example.org/wave" alt="A wave" title="wave" height="32"></p>',
        );
        expect(editable.html).toBe("<p>Hi :wave/edited-1:</p>");
        expect(editable.emotes).toMatchObject([
            {
                shortcode: "wave",
                url: "mxc://example.org/wave",
                body: "A wave",
                sendToken: ":wave/edited-1:",
            },
        ]);
    });
});

describe("image pack writer helpers", () => {
    function clientWithRoom(
        room: Room,
        initialAccountData: Record<string, Record<string, unknown>> = {},
        delayAccountDataWrites = false,
    ): MatrixClient {
        const accountData: Record<string, Record<string, unknown>> = { ...initialAccountData };
        const stateEventsByKey: Record<string, Record<string, MatrixEvent>> = {};
        const stateLists: Record<string, MatrixEvent[]> = {};
        const setStateEvent = (roomId: string, type: string, content: unknown, stateKey: string): unknown => {
            const list = (stateLists[type] = stateLists[type] ?? []);
            const event = mkEvent({
                event: true,
                type,
                room: roomId,
                user: USER_ID,
                skey: stateKey,
                content: content as Record<string, unknown>,
            });
            const slot = (stateEventsByKey[type] = stateEventsByKey[type] ?? {});
            slot[stateKey] = event;
            const idx = list.findIndex((e) => e.getStateKey() === stateKey);
            if (idx >= 0) list[idx] = event;
            else list.push(event);
            vi.mocked(room.currentState.getStateEvents).mockImplementation(mockStateEventImplementation(list));
            return { event_id: `$${type}:${stateKey}` };
        };
        const client: MatrixClient = {
            getUserId: vi.fn(() => USER_ID),
            getRoom: vi.fn(() => room),
            getAccountData: vi.fn((type: string) => ({
                getContent: () => accountData[type] ?? {},
            })),
            sendStateEvent: vi.fn(setStateEvent),
            setAccountData: vi.fn(async (type: string, content: unknown) => {
                if (delayAccountDataWrites) await new Promise<void>((resolve) => setTimeout(resolve, 0));
                accountData[type] = content as Record<string, unknown>;
                return {};
            }),
            redactEvent: vi.fn(async (roomId: string, eventId: string) => {
                const match = /^(\$[^:]+):(.+)$/.exec(eventId);
                if (!match) return { event_id: "$redaction" };
                const [, type, stateKey] = match;
                const list = stateLists[type];
                if (list) {
                    const idx = list.findIndex((e) => e.getStateKey() === stateKey);
                    if (idx >= 0) list.splice(idx, 1);
                }
                const slot = stateEventsByKey[type];
                if (slot) delete slot[stateKey];
                vi.mocked(room.currentState.getStateEvents).mockImplementation(
                    mockStateEventImplementation(stateLists[type] ?? []),
                );
                void roomId;
                return { event_id: "$redaction" };
            }),
        } as unknown as MatrixClient;
        return client;
    }

    it("creates a new room pack without inventing usage tags", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await createRoomImagePack(client, room.roomId, "k", {
            displayName: "P",
            images: { wave: { shortcode: "wave", url: "mxc://e/wave" } },
        });
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            {
                images: { wave: { url: "mxc://e/wave" } },
                pack: { display_name: "P" },
            },
            "k",
        );
    });

    it("replaces stale images and preserves an explicit empty usage list", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                pack: { display_name: "Old", usage: ["emoticon"] },
                images: { old: { url: "mxc://e/old" } },
            }),
        ]);
        const client = clientWithRoom(room);
        await createRoomImagePack(client, room.roomId, "k", {
            displayName: "New",
            usage: [],
            images: { fresh: { shortcode: "fresh", url: "mxc://e/fresh" } },
        });
        expect(client.sendStateEvent).toHaveBeenLastCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            {
                pack: { display_name: "New", usage: [] },
                images: { fresh: { url: "mxc://e/fresh" } },
            },
            "k",
        );
    });

    it("upserts an emote into an existing pack without dropping other emotes", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                pack: { display_name: "P", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            }),
        ]);
        const client = clientWithRoom(room);
        await upsertRoomPackEmote(client, room.roomId, "k", { shortcode: "yes", url: "mxc://e/yes" });
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            {
                pack: { display_name: "P", usage: ["emoticon"] },
                images: {
                    wave: { url: "mxc://e/wave" },
                    yes: { url: "mxc://e/yes" },
                },
            },
            "k",
        );
    });

    it("removes an emote from a pack", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                pack: { display_name: "P", usage: ["emoticon"] },
                images: {
                    wave: { url: "mxc://e/wave" },
                    yes: { url: "mxc://e/yes" },
                },
            }),
        ]);
        const client = clientWithRoom(room);
        await removeRoomPackEmote(client, room.roomId, "k", "wave");
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            {
                pack: { display_name: "P", usage: ["emoticon"] },
                images: { yes: { url: "mxc://e/yes" } },
            },
            "k",
        );
    });

    it("updates only metadata when renames happen", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                pack: { display_name: "Old", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            }),
        ]);
        const client = clientWithRoom(room);
        await updateRoomImagePackMetadata(client, room.roomId, "k", { displayName: "New" });
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            {
                pack: { display_name: "New", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            },
            "k",
        );
    });

    it("throws on update when the pack does not exist", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await expect(updateRoomImagePackMetadata(client, room.roomId, "missing", { displayName: "X" })).rejects.toThrow(
            /does not exist/,
        );
    });

    it("stores room ordering in private account data", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await reorderRoomImagePacks(client, room.roomId, ["a", "b", "c"]);
        expect(client.setAccountData).toHaveBeenCalledWith(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE, {
            rooms: { [room.roomId]: ["a", "b", "c"] },
        });
    });

    it("reads back the order marker via getRoomImagePackOrder", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {
            [ROOM_IMAGE_PACK_ORDER_EVENT_TYPE]: { rooms: { [room.roomId]: ["a", "b"] } },
        });
        expect(getRoomImagePackOrder(client, room.roomId)).toEqual({ stateKeys: ["a", "b"] });
    });

    it("redacts a pack by event id", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                pack: { display_name: "P", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            }),
        ]);
        const client = clientWithRoom(room);
        await redactRoomImagePack(client, room.roomId, "$m.room.image_pack:k");
        expect(client.redactEvent).toHaveBeenCalledWith(room.roomId, "$m.room.image_pack:k");
        // The pack event should be gone from current state.
        const events = room.currentState.getStateEvents(IMAGE_PACK_EVENT_TYPE);
        expect(events).toEqual([]);
    });

    it("deleteRoomImagePack is a low-level helper that still writes an empty pack", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await deleteRoomImagePack(client, room.roomId, "k");
        expect(client.sendStateEvent).toHaveBeenCalledWith(
            room.roomId,
            IMAGE_PACK_EVENT_TYPE,
            { images: {}, pack: { usage: ["emoticon"] } },
            "k",
        );
    });

    it("redacts an existing room pack instead of leaving a ghost state event", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        setStateEvents(room, [
            packEvent(room.roomId, "k", {
                images: { wave: { url: "mxc://e/wave" } },
            }),
        ]);
        const client = clientWithRoom(room);
        await deleteRoomImagePack(client, room.roomId, "k");
        expect(client.redactEvent).toHaveBeenCalled();
        expect(client.sendStateEvent).not.toHaveBeenCalled();
    });

    it("enables and disables global pack references via stable and legacy account data", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await enableGlobalPack(client, { roomId: "!g:example.org", stateKey: "k" });
        expect(client.setAccountData).toHaveBeenCalledWith(IMAGE_PACK_ROOMS_EVENT_TYPE, {
            rooms: { "!g:example.org": { k: {} } },
        });
        expect(client.setAccountData).toHaveBeenCalledWith(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, {
            rooms: { "!g:example.org": { k: {} } },
        });
        await disableGlobalPack(client, { roomId: "!g:example.org", stateKey: "k" });
        expect(client.setAccountData).toHaveBeenLastCalledWith(LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE, {
            rooms: {},
        });
    });

    it("preserves overlapping account-data updates", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {}, true);

        await Promise.all([
            enableGlobalPack(client, { roomId: "!g:example.org", stateKey: "one" }),
            enableGlobalPack(client, { roomId: "!g:example.org", stateKey: "two" }),
            upsertUserPackEmote(client, { shortcode: "one", url: "mxc://e/one" }),
            upsertUserPackEmote(client, { shortcode: "two", url: "mxc://e/two" }),
        ]);

        expect(client.getAccountData(IMAGE_PACK_ROOMS_EVENT_TYPE as never)?.getContent()).toEqual({
            rooms: { "!g:example.org": { one: {}, two: {} } },
        });
        expect(client.getAccountData(LEGACY_USER_IMAGE_PACK_EVENT_TYPE as never)?.getContent()).toMatchObject({
            images: {
                one: { url: "mxc://e/one" },
                two: { url: "mxc://e/two" },
            },
        });
    });

    it("preserves overlapping room order updates", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(
            room,
            {
                [ROOM_IMAGE_PACK_ORDER_EVENT_TYPE]: {
                    rooms: {
                        "!one:example.org": ["old-one"],
                        "!two:example.org": ["old-two"],
                    },
                },
            },
            true,
        );

        await Promise.all([
            reorderRoomImagePacks(client, "!one:example.org", ["new-one"]),
            reorderRoomImagePacks(client, "!two:example.org", ["new-two"]),
        ]);

        expect(client.getAccountData(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE as never)?.getContent()).toEqual({
            rooms: {
                "!one:example.org": ["new-one"],
                "!two:example.org": ["new-two"],
            },
        });
    });

    it("refreshes account data before applying a cached transaction update", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const stale = { rooms: { "!stale:example.org": ["stale"] } };
        const remote = { rooms: { "!remote:example.org": ["remote"] } };
        const client = clientWithRoom(room, { [ROOM_IMAGE_PACK_ORDER_EVENT_TYPE]: stale });
        Object.assign(client, {
            getAccountDataFromServer: vi.fn(async () => remote),
        });

        await runAccountDataTransaction(client, async (transaction) => {
            expect(transaction.get(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE)).toEqual(stale);
            await transaction.set(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE, (current) => {
                const rooms =
                    typeof current === "object" && current !== null && "rooms" in current
                        ? (current.rooms as Record<string, string[]>)
                        : {};
                return { rooms: { ...rooms, "!local:example.org": ["local"] } };
            });
        });

        expect(client.setAccountData).toHaveBeenCalledWith(ROOM_IMAGE_PACK_ORDER_EVENT_TYPE, {
            rooms: {
                "!remote:example.org": ["remote"],
                "!local:example.org": ["local"],
            },
        });
    });

    it("writes the user pack to the legacy account-data key for backwards compatibility", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await upsertUserImagePack(client, {
            displayName: "Mine",
            images: { wave: { shortcode: "wave", url: "mxc://e/wave" } },
        });
        expect(client.setAccountData).toHaveBeenCalledWith(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {
            pack: { display_name: "Mine" },
            images: { wave: { url: "mxc://e/wave" } },
        });
    });

    it("does not replace an existing personal pack when creating one", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {
            [LEGACY_USER_IMAGE_PACK_EVENT_TYPE]: {
                pack: { display_name: "Neofox", usage: ["emoticon"] },
                images: { fox: { url: "mxc://e/fox" } },
            },
        });

        await expect(
            createUserImagePack(client, { displayName: "Testing", usage: ["emoticon"], images: {} }),
        ).rejects.toThrow("A personal image pack already exists");
        expect(client.setAccountData).not.toHaveBeenCalled();
    });

    it("replaces the complete personal pack without retaining stale images", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {
            [LEGACY_USER_IMAGE_PACK_EVENT_TYPE]: {
                pack: { display_name: "Old", usage: ["emoticon"] },
                images: { old: { url: "mxc://e/old" } },
            },
        });
        await replaceUserImagePack(client, {
            displayName: "New",
            images: { fresh: { shortcode: "fresh", url: "mxc://e/fresh" } },
            usage: [],
        });
        expect(client.setAccountData).toHaveBeenLastCalledWith(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {
            pack: { display_name: "New", usage: [] },
            images: { fresh: { url: "mxc://e/fresh" } },
        });
    });

    it("adds and removes emotes on the user pack", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {
            [LEGACY_USER_IMAGE_PACK_EVENT_TYPE]: {
                pack: { display_name: "Mine", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            },
        });
        await upsertUserPackEmote(client, { shortcode: "yes", url: "mxc://e/yes" });
        expect(client.setAccountData).toHaveBeenLastCalledWith(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {
            pack: { display_name: "Mine", usage: ["emoticon"] },
            images: {
                wave: { url: "mxc://e/wave" },
                yes: { url: "mxc://e/yes" },
            },
        });
        await removeUserPackEmote(client, "wave");
        expect(client.setAccountData).toHaveBeenLastCalledWith(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {
            pack: { display_name: "Mine", usage: ["emoticon"] },
            images: { yes: { url: "mxc://e/yes" } },
        });
    });

    it("clears the personal pack account data when it is deleted", async () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room);
        await deleteUserImagePack(client);
        expect(client.setAccountData).toHaveBeenCalledWith(LEGACY_USER_IMAGE_PACK_EVENT_TYPE, {});
    });

    it("reads back the user pack as if it were a resolved pack", () => {
        const room = mkStubRoom("!r:example.org", "R");
        const client = clientWithRoom(room, {
            [LEGACY_USER_IMAGE_PACK_EVENT_TYPE]: {
                pack: { display_name: "Mine", usage: ["emoticon"] },
                images: { wave: { url: "mxc://e/wave" } },
            },
        });
        const emotes = getCustomEmotesForRoom(client, room, () => null);
        expect(emotes.map((emote) => emote.shortcode)).toEqual(["wave"]);
        expect(emotes[0].pack.displayName).toBe("Mine");
    });
});
