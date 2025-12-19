/*
 * Copyright (c) 2025 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { RoomStatusBarViewModel } from "../../../src/viewmodels/room/RoomStatusBar";
import { mkEvent, mkRoom, stubClient } from "../../test-utils";
import {
    SyncState,
    MatrixError,
    ClientEvent,
    MatrixClient,
    Room,
    type MatrixEvent,
    EventStatus,
} from "matrix-js-sdk/src/matrix";
import { RoomStatusBarState } from "@element-hq/web-shared-components";
import { type MockedObject } from "jest-mock";
import { LocalRoom, LocalRoomState } from "../../../src/models/LocalRoom";

const userId = "@example:example.org";

function mkEventWithError(error: MatrixError): MatrixEvent {
    const event = mkEvent({
        event: true,
        user: userId,
        type: "org.example.test",
        content: {},
        status: EventStatus.NOT_SENT,
    });
    event.error = error;
    return event;
}

describe("RoomStatusBarViewModel", () => {
    let client: MockedObject<MatrixClient>;
    let vm: RoomStatusBarViewModel;
    let room: MockedObject<Room>;
    let roomEmitFn!: () => void;
    beforeEach(() => {
        client = stubClient() as MockedObject<MatrixClient>;
        room = mkRoom(client, "!example");
        room.on.mockImplementationOnce((_event, fn) => {
            roomEmitFn = fn as any;
            return room;
        });
        vm = new RoomStatusBarViewModel({
            room,
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should not be visible by default", () => {
        expect(vm.getSnapshot()).toEqual({ state: null });
    });

    it("should resolve state to ConnectionLost on failed sync", () => {
        client.getSyncState.mockReturnValue(SyncState.Error);
        client.emit(ClientEvent.Sync, SyncState.Error, null);
        expect(vm.getSnapshot()).toEqual({ state: RoomStatusBarState.ConnectionLost });
    });

    // Because we expect LoggedInView to pop a toast
    it("should resolve state to nothing if sync error is M_RESOURCE_LIMIT_EXCEEDED ", () => {
        client.getSyncState.mockReturnValue(SyncState.Error);
        client.getSyncStateData.mockReturnValue({ error: new MatrixError({ errcode: "M_RESOURCE_LIMIT_EXCEEDED" }) });
        client.emit(ClientEvent.Sync, SyncState.Error, null);
        expect(vm.getSnapshot()).toEqual({ state: null });
    });

    it("should resolve state to NeedsConsent if a pending event has a M_CONSENT_NOT_GIVEN error", () => {
        room.getPendingEvents.mockReturnValue([
            mkEventWithError(new MatrixError({ errcode: "M_CONSENT_NOT_GIVEN", consent_uri: "https://example.org" })),
        ]);
        roomEmitFn();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.NeedsConsent,
            consentUri: "https://example.org",
        });
    });

    it("should resolve state to UnsentMessages once onTermsAndConditionsClicked is called", () => {
        room.getPendingEvents.mockReturnValue([mkEventWithError(new MatrixError({ errcode: "M_CONSENT_NOT_GIVEN" }))]);
        roomEmitFn();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.NeedsConsent,
        });
        vm.onTermsAndConditionsClicked();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.UnsentMessages,
            isResending: false,
        });
    });

    it("should resolve state to ResourceLimited if a pending event has a M_RESOURCE_LIMIT_EXCEEDED error", () => {
        room.getPendingEvents.mockReturnValue([
            mkEventWithError(
                new MatrixError({
                    errcode: "M_RESOURCE_LIMIT_EXCEEDED",
                    limit_type: "hs_disabled",
                    admin_contact: "https://example.org",
                }),
            ),
        ]);
        roomEmitFn();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.ResourceLimited,
            adminContactHref: "https://example.org",
            resourceLimit: "hs_disabled",
        });
    });

    it("should resolve state to UnsentMessages if there are any other events", () => {
        room.getPendingEvents.mockReturnValue([mkEventWithError(new MatrixError({ errcode: "M_UNKNOWN" }))]);
        roomEmitFn();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.UnsentMessages,
            isResending: false,
        });
    });

    it("should resolve state to isResending=true once onResendAllClick is called", () => {
        room.getPendingEvents.mockReturnValue([mkEventWithError(new MatrixError({ errcode: "M_UNKNOWN" }))]);
        roomEmitFn();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.UnsentMessages,
            isResending: false,
        });
        vm.onResendAllClick();
        expect(vm.getSnapshot()).toEqual({
            state: RoomStatusBarState.UnsentMessages,
            isResending: true,
        });
        expect(client.resendEvent).toHaveBeenCalledTimes(1);
    });

    describe("Local rooms", () => {
        it("should resolve state to LocalRoomFailed if room fails to be created", () => {
            const localRoom = new LocalRoom("!example", client, userId);
            localRoom.state = LocalRoomState.ERROR;
            vm = new RoomStatusBarViewModel({
                room: localRoom,
            });
            expect(vm.getSnapshot()).toEqual({ state: RoomStatusBarState.LocalRoomFailed });
        });
        it("should resolve state to nothing for any other state for localroom", () => {
            const localRoom = new LocalRoom("!example", client, userId);
            localRoom.state = LocalRoomState.NEW;
            vm = new RoomStatusBarViewModel({
                room: localRoom,
            });
            expect(vm.getSnapshot()).toEqual({ state: null });
        });
    });
});
