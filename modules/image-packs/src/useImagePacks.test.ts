/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor, act } from "@testing-library/react";

import { useImagePacks } from "./useImagePacks.ts";
import type { PackStoreClient, PackWriters } from "./store.ts";
import type { ResolverClient, ResolverRoom } from "./resolver.ts";
import {
    IMAGE_PACK_EVENT_TYPE,
    LEGACY_USER_IMAGE_PACK_EVENT_TYPE,
    type DiscoverySource,
    type EmoteDefinition,
    type ImagePackDefinition,
} from "./types.ts";

afterEach(cleanup);

const emote: EmoteDefinition = { shortcode: "wave", url: "mxc://example.org/wave" };
const pack: ImagePackDefinition = { displayName: "Pack", images: { wave: emote } };
function mockWriters(): PackWriters {
    return {
        createRoomImagePack: vi.fn().mockResolvedValue(undefined),
        updateRoomImagePackMetadata: vi.fn().mockResolvedValue(undefined),
        deleteRoomImagePack: vi.fn().mockResolvedValue(undefined),
        upsertRoomPackEmote: vi.fn().mockResolvedValue(undefined),
        removeRoomPackEmote: vi.fn().mockResolvedValue(undefined),
        reorderRoomImagePacks: vi.fn().mockResolvedValue(undefined),
        redactRoomImagePack: vi.fn().mockResolvedValue(undefined),
        getRoomImagePackOrder: vi.fn().mockReturnValue(null),
        createUserImagePack: vi.fn().mockResolvedValue(undefined),
        upsertUserImagePack: vi.fn().mockResolvedValue(undefined),
        replaceUserImagePack: vi.fn().mockResolvedValue(undefined),
        deleteUserImagePack: vi.fn().mockResolvedValue(undefined),
        upsertUserPackEmote: vi.fn().mockResolvedValue(undefined),
        removeUserPackEmote: vi.fn().mockResolvedValue(undefined),
        enableGlobalPack: vi.fn().mockResolvedValue(undefined),
        disableGlobalPack: vi.fn().mockResolvedValue(undefined),
    };
}

function mockClient(): PackStoreClient & ResolverClient {
    return {
        getUserId: vi.fn().mockReturnValue("@alice:example.org"),
        getRoom: vi.fn().mockReturnValue(null),
        getAccountData: vi.fn().mockReturnValue(null),
        setAccountData: vi.fn().mockResolvedValue(undefined),
    };
}

const room: ResolverRoom = {
    roomId: "!room:example.org",
    currentState: {
        getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
            if (eventType !== IMAGE_PACK_EVENT_TYPE) return [];
            const event = {
                getStateKey: () => "pack",
                getContent: () => ({ images: { wave: { url: emote.url } }, pack: { display_name: "Pack" } }),
                getId: () => "$event",
            };
            return stateKey === undefined ? [event] : stateKey === "pack" ? event : null;
        }),
    },
};

describe("useImagePacks", () => {
    it("refreshes and delegates all pack and discovery operations", async () => {
        const client = mockClient();
        const writers = mockWriters();
        const result = renderHook(() => useImagePacks({ client, writers, room })).result;

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.packs).toMatchObject([{ roomId: room.roomId, stateKey: "pack", displayName: "Pack" }]);
        expect(result.current.sources).toEqual([]);

        const newEmote = { shortcode: "smile", url: "mxc://example.org/smile", body: "Smile" };
        const newPack = { roomId: room.roomId, stateKey: "new", displayName: "New", images: {} };
        const newSource: DiscoverySource = { id: "source", url: "https://example.org/index.json" };
        act(() => {
            result.current.setNewEmote(newEmote);
            result.current.setNewPack(newPack);
            result.current.setNewSource(newSource);
        });
        expect(result.current.newEmote).toEqual(newEmote);
        expect(result.current.newPack).toEqual(newPack);
        expect(result.current.newSource).toEqual(newSource);

        await act(async () => {
            await result.current.createRoomPack();
            await result.current.renameRoomPack(room.roomId, "pack", "Renamed");
            await result.current.deleteRoomPack(room.roomId, "pack");
            await result.current.redactRoomPack(room.roomId, "$event");
            await result.current.enablePackGlobally(room.roomId, "pack");
            await result.current.disablePackGlobally(room.roomId, "pack");
            await result.current.reorderPacks(["pack"]);
            await result.current.addRoomEmote(room.roomId, "pack", newEmote);
            await result.current.editRoomEmote(room.roomId, "pack", newEmote);
            await result.current.removeRoomEmote(room.roomId, "pack", "smile");
            await result.current.addUserEmote(newEmote);
            await result.current.createUserPack(pack);
            await result.current.editUserEmote(newEmote);
            await result.current.removeUserEmote("smile");
            await result.current.setUserPack(pack);
            await result.current.deleteUserPack();
            await result.current.importPack(
                { images: { wave: { url: emote.url } }, pack: { display_name: "Imported" } },
                room.roomId,
                "imported",
            );
            await result.current.addSource(newSource);
            await result.current.removeSource(newSource.id);
        });

        expect(writers.createRoomImagePack).toHaveBeenCalled();
        expect(writers.updateRoomImagePackMetadata).toHaveBeenCalledWith(room.roomId, "pack", {
            displayName: "Renamed",
        });
        expect(writers.deleteRoomImagePack).toHaveBeenCalledWith(room.roomId, "pack");
        expect(writers.redactRoomImagePack).toHaveBeenCalledWith(room.roomId, "$event");
        expect(writers.enableGlobalPack).toHaveBeenCalledWith({ roomId: room.roomId, stateKey: "pack" });
        expect(writers.disableGlobalPack).toHaveBeenCalledWith({ roomId: room.roomId, stateKey: "pack" });
        expect(writers.reorderRoomImagePacks).toHaveBeenCalledWith(room.roomId, ["pack"]);
        expect(writers.upsertRoomPackEmote).toHaveBeenCalled();
        expect(writers.removeRoomPackEmote).toHaveBeenCalledWith(room.roomId, "pack", "smile");
        expect(writers.upsertUserPackEmote).toHaveBeenCalled();
        expect(writers.createUserImagePack).toHaveBeenCalledWith(pack);
        expect(writers.removeUserPackEmote).toHaveBeenCalledWith("smile");
        expect(writers.replaceUserImagePack).toHaveBeenCalledWith(pack);
        expect(writers.deleteUserImagePack).toHaveBeenCalledOnce();
        expect(writers.createRoomImagePack).toHaveBeenCalledWith(
            room.roomId,
            "imported",
            expect.objectContaining({ displayName: "Imported" }),
        );
        expect(client.setAccountData).toHaveBeenCalled();
        expect(result.current.exportPack(pack)).toContain('"display_name": "Pack"');
    });

    it("exposes resolver results and stores operation errors", async () => {
        const client = mockClient();
        const writers = mockWriters();
        const failing = writers.upsertUserPackEmote as ReturnType<typeof vi.fn>;
        failing.mockRejectedValueOnce(new Error("write failed"));
        const result = renderHook(() => useImagePacks({ client, writers })).result;

        const getRoom = client.getRoom as ReturnType<typeof vi.fn>;
        getRoom.mockReturnValue({
            roomId: "!room:example.org",
            currentState: { getStateEvents: vi.fn().mockReturnValue([]) },
        });
        const accountData = client.getAccountData as ReturnType<typeof vi.fn>;
        accountData.mockReturnValue(null);
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.reorderPacks(["pack"]);
        });

        let caught: unknown;
        await act(async () => {
            try {
                await result.current.addUserEmote(emote);
            } catch (error) {
                caught = error;
            }
        });
        expect(caught).toEqual(new Error("write failed"));
        await waitFor(() => expect(result.current.error).toBe("write failed"));

        accountData.mockImplementation(() => {
            throw new Error("read failed");
        });
        await act(async () => {
            await result.current.refresh();
        });
        expect(result.current.error).toBe("read failed");
    });

    it("refreshes when the host reports a Matrix cache update", async () => {
        const client = mockClient();
        let accountData: Record<string, unknown> | null = null;
        let notifyChange: (() => void) | undefined;
        const unsubscribe = vi.fn();
        const accountDataEvent = { getContent: () => accountData };
        (client.getAccountData as ReturnType<typeof vi.fn>).mockImplementation((eventType: string) =>
            eventType === LEGACY_USER_IMAGE_PACK_EVENT_TYPE && accountData ? accountDataEvent : null,
        );
        client.subscribeToChanges = (listener) => {
            notifyChange = listener;
            return unsubscribe;
        };

        const rendered = renderHook(() => useImagePacks({ client, writers: mockWriters() }));
        await waitFor(() => expect(rendered.result.current.loading).toBe(false));
        expect(rendered.result.current.packs).toEqual([]);

        accountData = {
            images: { wave: { url: emote.url } },
            pack: { display_name: "Updated" },
        };
        act(() => notifyChange?.());
        await waitFor(() =>
            expect(rendered.result.current.packs).toMatchObject([
                { kind: "personal", displayName: "Updated", pack: { images: { wave: { url: emote.url } } } },
            ]),
        );

        rendered.unmount();
        expect(unsubscribe).toHaveBeenCalledOnce();
    });
});
