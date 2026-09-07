/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { EventType, type MatrixClient, MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";
import { vi, describe, it, expect, beforeEach, afterEach, type Mock } from "vitest";

import Modal from "../../../../Modal";
import { RoomAvatarEventViewModel } from "./RoomAvatarEventViewModel";

describe("RoomAvatarEventViewModel", () => {
    const roomId = "!room:example.org";
    let cli: MatrixClient;
    let room: Room;
    let mxcUrlToHttp: Mock;

    beforeEach(() => {
        mxcUrlToHttp = vi.fn().mockReturnValue("https://example.org/_matrix/media/v3/download/avatar");
        room = {
            name: "General",
        } as unknown as Room;
        cli = {
            getRoom: vi.fn().mockReturnValue(room),
            mxcUrlToHttp,
        } as unknown as MatrixClient;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const createEvent = (
        url?: string,
        sender = "@alice:example.org",
        eventRoomId: string | undefined = roomId,
    ): MatrixEvent =>
        new MatrixEvent({
            type: EventType.RoomAvatar,
            room_id: eventRoomId,
            state_key: "",
            sender,
            content: {
                url,
            },
        });

    it("extracts room avatar event details", () => {
        const mxEvent = createEvent("mxc://example.org/avatar");
        mxEvent.sender = { name: "Alice" } as MatrixEvent["sender"];

        const vm = new RoomAvatarEventViewModel({ cli, mxEvent });

        expect(vm.getSnapshot()).toEqual({
            senderDisplayName: "Alice",
            roomName: "General",
            avatarUrl: "mxc://example.org/avatar",
            lightboxLabel: "Alice changed the avatar for General",
            isRemoved: false,
        });
    });

    it("falls back to the sender ID when no sender member is available", () => {
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("mxc://example.org/avatar") });

        expect(vm.getSnapshot().senderDisplayName).toBe("@alice:example.org");
    });

    it("marks the event as removed when no avatar URL is present", () => {
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("") });

        expect(vm.getSnapshot()).toMatchObject({
            avatarUrl: undefined,
            isRemoved: true,
        });
    });

    it("updates the snapshot when the event changes", () => {
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("mxc://example.org/avatar") });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setEvent(createEvent("mxc://example.org/next", "@bob:example.org"));

        expect(vm.getSnapshot()).toMatchObject({
            senderDisplayName: "@bob:example.org",
            avatarUrl: "mxc://example.org/next",
            isRemoved: false,
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit when the event-derived snapshot is unchanged", () => {
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("mxc://example.org/avatar") });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setEvent(createEvent("mxc://example.org/avatar"));

        expect(listener).not.toHaveBeenCalled();
    });

    it("opens the room avatar in the lightbox", () => {
        const dialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({ close: vi.fn() } as any);
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("mxc://example.org/avatar") });

        vm.onAvatarClick();

        expect(mxcUrlToHttp).toHaveBeenCalledWith(
            "mxc://example.org/avatar",
            undefined,
            undefined,
            undefined,
            false,
            true,
        );
        expect(dialogSpy).toHaveBeenCalledWith(
            expect.any(Function),
            {
                src: "https://example.org/_matrix/media/v3/download/avatar",
                name: "@alice:example.org changed the avatar for General",
            },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    });

    it("does not open the lightbox when the event has no avatar URL", () => {
        const dialogSpy = vi.spyOn(Modal, "createDialog").mockReturnValue({ close: vi.fn() } as any);
        const vm = new RoomAvatarEventViewModel({ cli, mxEvent: createEvent("") });

        vm.onAvatarClick();

        expect(dialogSpy).not.toHaveBeenCalled();
    });
});
