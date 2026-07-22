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
    decorateCustomEmotes,
    getCustomEmotesForRoom,
    getImagePacksForRoom,
    IMAGE_PACK_EVENT_TYPE,
    IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_IMAGE_PACK_EVENT_TYPE,
    LEGACY_IMAGE_PACK_ROOMS_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    prepareCustomEmotesForEditing,
    resolveCustomEmoteToken,
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
