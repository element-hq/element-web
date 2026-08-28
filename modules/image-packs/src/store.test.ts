/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it } from "vitest";

import {
    addRoomEmote,
    addSource,
    addUserEmote,
    createUserPack,
    createRoomPack,
    deleteRoomPack,
    deleteUserPack,
    disablePackGlobally,
    editRoomEmote,
    editUserEmote,
    enablePackGlobally,
    installPackToRoom,
    listDiscoverySources,
    packJsonToRoomInput,
    removeRoomEmote,
    removeSource,
    removeUserEmote,
    renameRoomPack,
    reorderRoomPacks,
    setUserPack,
    toDraft,
    type PackStoreClient,
    type PackWriters,
} from "./store.ts";
import type { EmoteDefinition, ImagePackDefinition } from "./types.ts";

class FakeWriters implements PackWriters {
    public readonly calls: { op: string; args: unknown[] }[] = [];

    public async createRoomImagePack(roomId: string, stateKey: string, draft: unknown): Promise<void> {
        this.calls.push({ op: "createRoomImagePack", args: [roomId, stateKey, draft] });
    }

    public async updateRoomImagePackMetadata(roomId: string, stateKey: string, draft: unknown): Promise<void> {
        this.calls.push({ op: "updateRoomImagePackMetadata", args: [roomId, stateKey, draft] });
    }

    public async deleteRoomImagePack(roomId: string, stateKey: string): Promise<void> {
        this.calls.push({ op: "deleteRoomImagePack", args: [roomId, stateKey] });
    }

    public async upsertRoomPackEmote(roomId: string, stateKey: string, emote: EmoteDefinition): Promise<void> {
        this.calls.push({ op: "upsertRoomPackEmote", args: [roomId, stateKey, emote] });
    }

    public async removeRoomPackEmote(roomId: string, stateKey: string, shortcode: string): Promise<void> {
        this.calls.push({ op: "removeRoomPackEmote", args: [roomId, stateKey, shortcode] });
    }

    public async reorderRoomImagePacks(roomId: string, orderedKeys: string[]): Promise<void> {
        this.calls.push({ op: "reorderRoomImagePacks", args: [roomId, orderedKeys] });
    }

    public async redactRoomImagePack(roomId: string, eventId: string): Promise<void> {
        this.calls.push({ op: "redactRoomImagePack", args: [roomId, eventId] });
    }

    public getRoomImagePackOrder(_roomId: string): { stateKeys: string[] } | null {
        return null;
    }

    public async upsertUserImagePack(pack: ImagePackDefinition): Promise<void> {
        this.calls.push({ op: "upsertUserImagePack", args: [pack] });
    }

    public async createUserImagePack(pack: ImagePackDefinition): Promise<void> {
        this.calls.push({ op: "createUserImagePack", args: [pack] });
    }

    public async replaceUserImagePack(pack: ImagePackDefinition): Promise<void> {
        this.calls.push({ op: "replaceUserImagePack", args: [pack] });
    }

    public async deleteUserImagePack(): Promise<void> {
        this.calls.push({ op: "deleteUserImagePack", args: [] });
    }

    public async upsertUserPackEmote(emote: EmoteDefinition): Promise<void> {
        this.calls.push({ op: "upsertUserPackEmote", args: [emote] });
    }

    public async removeUserPackEmote(shortcode: string): Promise<void> {
        this.calls.push({ op: "removeUserPackEmote", args: [shortcode] });
    }

    public async enableGlobalPack(reference: { roomId: string; stateKey: string }): Promise<void> {
        this.calls.push({ op: "enableGlobalPack", args: [reference] });
    }

    public async disableGlobalPack(reference: { roomId: string; stateKey: string }): Promise<void> {
        this.calls.push({ op: "disableGlobalPack", args: [reference] });
    }
}

class FakeClient implements PackStoreClient {
    private store = new Map<string, { getContent: () => unknown }>();

    public constructor(initial: Record<string, unknown> = {}) {
        for (const [type, content] of Object.entries(initial)) {
            this.store.set(type, { getContent: () => content });
        }
    }

    public getUserId(): string {
        return "@alice:example.org";
    }

    public getAccountData(eventType: string): { getContent: () => unknown } | null {
        return this.store.get(eventType) ?? null;
    }

    public async setAccountData(eventType: string, content: unknown): Promise<unknown> {
        this.store.set(eventType, { getContent: () => content });
        return {};
    }
}

describe("pack store", () => {
    it("creates a room pack with the supplied metadata", async () => {
        const writers = new FakeWriters();
        await createRoomPack(writers, {
            roomId: "!r:example.org",
            stateKey: "wave-pack",
            displayName: "Wave Pack",
            images: { wave: { shortcode: "wave", url: "mxc://e/wave" } },
            usage: [],
        });
        expect(writers.calls[0]).toEqual({
            op: "createRoomImagePack",
            args: [
                "!r:example.org",
                "wave-pack",
                {
                    displayName: "Wave Pack",
                    usage: [],
                    images: { wave: { shortcode: "wave", url: "mxc://e/wave" } },
                },
            ],
        });
    });

    it("rejects the reserved legacy order state key", async () => {
        await expect(
            createRoomPack(new FakeWriters(), {
                roomId: "!r:example.org",
                stateKey: "_order",
                displayName: "Order",
            }),
        ).rejects.toThrow();
    });

    it("renames a pack without touching other metadata fields", async () => {
        const writers = new FakeWriters();
        await renameRoomPack(writers, "!r", "p", { displayName: "Renamed" });
        expect(writers.calls[0]).toEqual({
            op: "updateRoomImagePackMetadata",
            args: ["!r", "p", { displayName: "Renamed" }],
        });
    });

    it("deletes a room pack", async () => {
        const writers = new FakeWriters();
        await deleteRoomPack(writers, "!r", "p");
        expect(writers.calls[0]).toEqual({ op: "deleteRoomImagePack", args: ["!r", "p"] });
    });

    it("adds, edits, and removes room emotes", async () => {
        const writers = new FakeWriters();
        const emote: EmoteDefinition = { shortcode: "wave", url: "mxc://e/wave" };
        await addRoomEmote(writers, "!r", "p", emote);
        await editRoomEmote(writers, "!r", "p", { ...emote, body: "A wave" });
        await removeRoomEmote(writers, "!r", "p", "wave");
        expect(writers.calls.map((c) => c.op)).toEqual([
            "upsertRoomPackEmote",
            "upsertRoomPackEmote",
            "removeRoomPackEmote",
        ]);
    });

    it("reorders packs in deterministic order", async () => {
        const writers = new FakeWriters();
        await reorderRoomPacks(writers, "!r", ["a", "b", "c"]);
        expect(writers.calls[0]).toEqual({ op: "reorderRoomImagePacks", args: ["!r", ["a", "b", "c"]] });
    });

    it("enables and disables global pack references", async () => {
        const writers = new FakeWriters();
        await enablePackGlobally(writers, { roomId: "!g", stateKey: "k" });
        await disablePackGlobally(writers, { roomId: "!g", stateKey: "k" });
        expect(writers.calls.map((c) => c.op)).toEqual(["enableGlobalPack", "disableGlobalPack"]);
    });

    it("adds, edits, and removes user emotes", async () => {
        const writers = new FakeWriters();
        const emote: EmoteDefinition = { shortcode: "wave", url: "mxc://e/wave" };
        await addUserEmote(writers, emote);
        await editUserEmote(writers, { ...emote, body: "W" });
        await removeUserEmote(writers, "wave");
        expect(writers.calls.map((c) => c.op)).toEqual([
            "upsertUserPackEmote",
            "upsertUserPackEmote",
            "removeUserPackEmote",
        ]);
    });

    it("deletes the personal pack through its dedicated writer", async () => {
        const writers = new FakeWriters();
        await deleteUserPack(writers);
        expect(writers.calls[0]).toEqual({ op: "deleteUserImagePack", args: [] });
    });

    it("creates a personal pack through its dedicated writer", async () => {
        const writers = new FakeWriters();
        const pack: ImagePackDefinition = { displayName: "New", images: {} };
        await createUserPack(writers, pack);
        expect(writers.calls[0]).toEqual({ op: "createUserImagePack", args: [pack] });
    });

    it("installs a parsed pack into a room", async () => {
        const writers = new FakeWriters();
        const payload = {
            version: 1,
            pack: {
                displayName: "P",
                images: { wave: { url: "mxc://e/wave" } },
            },
        };
        await installPackToRoom(writers, "!r", "wave", payload);
        expect(writers.calls[0]?.op).toBe("createRoomImagePack");
        expect(writers.calls[0]?.args[0]).toBe("!r");
        expect(writers.calls[0]?.args[1]).toBe("wave");
    });

    it("rejects discovery packs that would collide with the legacy order key", async () => {
        await expect(
            installPackToRoom(new FakeWriters(), "!r", "_order", {
                images: { wave: { url: "mxc://e/wave" } },
            }),
        ).rejects.toThrow();
    });

    it("survives non-throwing packJsonToRoomInput conversions", () => {
        const pack: ImagePackDefinition = {
            displayName: "P",
            images: { wave: { shortcode: "wave", url: "mxc://e/wave" } },
            avatarUrl: "mxc://e/avatar",
            attribution: "att",
            usage: [],
        };
        const input = packJsonToRoomInput("!r", "k", pack);
        expect(toDraft(input)).toEqual({
            displayName: "P",
            images: pack.images,
            avatarUrl: "mxc://e/avatar",
            attribution: "att",
            usage: [],
        });
    });

    it("adds and removes discovery sources", async () => {
        const client = new FakeClient({});
        await addSource(client, { id: "s", url: "https://example.org/index.json" });
        const after = await removeSource(client, "s");
        expect(listDiscoverySources(client)).toEqual([]);
        expect(after).toEqual([]);
    });

    it("lists the personal user pack alongside discovery sources", async () => {
        const client = new FakeClient({
            "im.ponies.image_pack_servers": {
                sources: [{ id: "s", url: "https://example.org/index.json" }],
            },
        });
        expect(listDiscoverySources(client).map((s) => s.id)).toEqual(["s"]);
    });

    it("replaces the entire user pack", async () => {
        const writers = new FakeWriters();
        const pack: ImagePackDefinition = { displayName: "All", images: {} };
        await setUserPack(writers, pack);
        expect(writers.calls[0]).toEqual({ op: "replaceUserImagePack", args: [pack] });
    });
});
