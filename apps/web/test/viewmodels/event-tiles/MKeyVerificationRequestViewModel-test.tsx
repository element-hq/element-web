/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient, MatrixEvent, type Room, type RoomMember } from "matrix-js-sdk/src/matrix";

import { MKeyVerificationRequestViewModel } from "../../../src/viewmodels/room/timeline/event-tile/MKeyVerificationRequestViewModel";

describe("MKeyVerificationRequestViewModel", () => {
    const roomId = "!room:example.org";
    const myUserId = "@me:example.org";
    let cli: MatrixClient;
    let room: Room;

    beforeEach(() => {
        room = {
            getMember: jest.fn(),
        } as unknown as Room;
        cli = {
            getSafeUserId: jest.fn().mockReturnValue(myUserId),
            getRoom: jest.fn().mockReturnValue(room),
        } as unknown as MatrixClient;
    });

    const createEvent = (sender?: string, to = myUserId, eventRoomId: string | undefined = roomId): MatrixEvent =>
        new MatrixEvent({
            type: "m.room.message",
            room_id: eventRoomId,
            sender,
            content: {
                msgtype: "m.key.verification.request",
                from_device: "DEVICE",
                methods: ["m.sas.v1"],
                to,
            },
        });

    it("throws if the event has no sender", () => {
        expect(() => new MKeyVerificationRequestViewModel({ cli, mxEvent: createEvent() })).toThrow(
            "Verification request did not include a sender!",
        );
    });

    it("throws if the event has no room", () => {
        expect(
            () =>
                new MKeyVerificationRequestViewModel({
                    cli,
                    mxEvent: createEvent("@alice:example.org", myUserId, ""),
                }),
        ).toThrow("Verification request did not include a room ID!");
    });

    it("renders a request sent by me", () => {
        jest.mocked(room.getMember).mockReturnValue({
            name: "Alice",
        } as RoomMember);

        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent(myUserId, "@alice:example.org"),
        });

        expect(vm.getSnapshot()).toMatchObject({
            title: "You sent a verification request",
            subtitle: "Alice (@alice:example.org)",
        });
    });

    it("renders a request sent by someone else", () => {
        jest.mocked(room.getMember).mockReturnValue({
            name: "Alice",
        } as RoomMember);

        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
        });

        expect(vm.getSnapshot()).toMatchObject({
            title: "Alice wants to verify",
            subtitle: "Alice (@alice:example.org)",
        });
    });

    it("falls back to user ID when no room member is available", () => {
        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
        });

        expect(vm.getSnapshot()).toMatchObject({
            title: "@alice:example.org wants to verify",
            subtitle: "@alice:example.org",
        });
    });

    it("updates the snapshot when the event changes", () => {
        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(createEvent(myUserId, "@bob:example.org"));

        expect(vm.getSnapshot()).toMatchObject({
            title: "You sent a verification request",
            subtitle: "@bob:example.org",
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("updates only timestamp when the timestamp changes", () => {
        const timestamp = <span>14:56</span>;
        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setTimestamp(timestamp);

        expect(vm.getSnapshot().timestamp).toBe(timestamp);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not emit when the event-derived snapshot is unchanged", () => {
        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setEvent(createEvent("@alice:example.org"));

        expect(listener).not.toHaveBeenCalled();
    });

    it("does not emit when the timestamp is unchanged", () => {
        const timestamp = <span>14:56</span>;
        const vm = new MKeyVerificationRequestViewModel({
            cli,
            mxEvent: createEvent("@alice:example.org"),
            timestamp,
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setTimestamp(timestamp);

        expect(listener).not.toHaveBeenCalled();
    });
});
