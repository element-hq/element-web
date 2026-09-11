/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type MatrixClient, RoomEvent, RoomMember } from "matrix-js-sdk/src/matrix";
import { act } from "react";
import { createTestClient, mkStubRoom } from "test-utils";

import { RoomAvatarViewModel } from "./RoomAvatarViewModel";
import { LocalRoom } from "../../models/LocalRoom";
import DMRoomMap from "../../utils/DMRoomMap";
import { DirectoryMember } from "../../utils/direct-messages";

vi.mock("../../customisations/Media", () => ({
    mediaFromMxc: vi.fn(() => ({
        srcHttp: "https://example.org/avatar.png",
        getThumbnailOfSourceHttp: vi.fn(() => "https://example.org/avatar-thumbnail.png"),
    })),
}));

describe("RoomAvatarViewModel", () => {
    let client: MatrixClient;

    beforeEach(() => {
        client = createTestClient();
        DMRoomMap.setShared({
            getUserIdForRoomId: vi.fn().mockReturnValue(undefined),
        } as unknown as DMRoomMap);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("uses the room data in the initial snapshot", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);
        room.name = "Room name";

        const vm = new RoomAvatarViewModel({ room, size: "36px" });

        expect(vm.getSnapshot()).toMatchObject({
            name: "Room name",
            idName: room.roomId,
            type: "round",
            isClickable: false,
        });
    });

    it("updates the snapshot when the room name changes", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);
        room.name = "Room name";

        const vm = new RoomAvatarViewModel({ room, size: "36px" });
        const listener = vi.fn();
        vm.subscribe(listener);

        room.name = "Updated room name";

        act(() => {
            room.emit(RoomEvent.Name, room);
        });

        expect(vm.getSnapshot().name).toBe("Updated room name");
        expect(listener).toHaveBeenCalled();
    });

    it("skips snapshot updates for unchanged values", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);
        room.name = "Room name";

        const vm = new RoomAvatarViewModel({ room, size: "36px" });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setViewProps({ size: "36px" });
        vm.setRoom(room);
        vm.setViewAvatarOnClick(undefined);
        vm.setOnClick(undefined);

        expect(listener).not.toHaveBeenCalled();
    });

    it("derives a DM identity name when available", () => {
        const room = mkStubRoom("!room:example.com", "DM room", client);
        const userId = "@dm_user:example.com";
        vi.spyOn(room, "getMember").mockReturnValue(new RoomMember(room.roomId, userId));

        vi.spyOn(DMRoomMap.shared(), "getUserIdForRoomId").mockReturnValue(userId);
        const vm = new RoomAvatarViewModel({ room, size: "36px" });

        expect(vm.getSnapshot().idName).toBe(userId);
    });

    it("prefers the local room target when there is one", () => {
        const localRoom = new LocalRoom("local+room", client, client.getSafeUserId());
        localRoom.targets.push(new DirectoryMember({ user_id: "@local:example.com" }));

        const vm = new RoomAvatarViewModel({ room: localRoom, size: "36px" });

        expect(vm.getSnapshot().idName).toBe("@local:example.com");
    });

    it("invokes the supplied click handler when avatar lightbox is disabled", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);
        room.name = "Room name";
        const onClick = vi.fn();
        const vm = new RoomAvatarViewModel({ room, size: "36px", onClick });

        vm.onClick();

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("respects an explicit type override", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);

        const vm = new RoomAvatarViewModel({ room, size: "36px", type: "square" });

        expect(vm.getSnapshot().type).toBe("square");
    });

    it("skips snapshot update when setType is called with the same value", () => {
        const room = mkStubRoom("!room:example.com", "Room name", client);

        const vm = new RoomAvatarViewModel({ room, size: "36px", type: "square" });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setType("square");

        expect(listener).not.toHaveBeenCalled();
    });
});
