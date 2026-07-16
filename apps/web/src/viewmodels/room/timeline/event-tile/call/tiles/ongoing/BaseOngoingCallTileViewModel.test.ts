/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { CallDirection, CallType } from "@element-hq/web-shared-components";

import { BaseOngoingCallViewModel } from "./BaseOngoingCallTileViewModel";
import { mkRoom, stubClient } from "../../../../../../../../test/test-utils";
import { CallEvent } from "../../../../../../../models/Call";
import type { RootCallTileViewModel } from "../../RootCallTileViewModel";
import { getMockedMember, getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "../../call-mocks";
import type { EventTimeline, RoomState } from "matrix-js-sdk/src/matrix";
import { placeCall } from "../../../../../../../utils/room/placeCall";
import { PlatformCallType } from "../../../../../../../hooks/room/useRoomCall";
import { SDKContextClass } from "../../../../../../../contexts/SDKContextClass.ts";

/**
 * There's a nasty circular dependency in useRoomCall so that we end up with:
 * BaseOngoingCallViewModel -> useRoomCall -> ... -> EventTileFactory
 * -> RootCallTileViewModel -> RoomOngoingCallTileViewModel -> BaseOngoingCallViewModel
 */
//@ts-ignore
vi.mock(import("../../RootCallTileViewModel"), () => {
    return {
        RootCallTileViewModel: class {} as unknown as RootCallTileViewModel,
    };
});

vi.mock(import("../../../../../../../utils/room/placeCall"), () => {
    return {
        placeCall: vi.fn(),
    };
});

const roomId = "!my-room:m.org";

describe("BaseOngoingCallViewModel", () => {
    const legacyCallHandler = SDKContextClass.instance.legacyCallHandler;

    describe("should compute the correct snapshot", () => {
        it("startedByDisplayName", () => {
            const cli = stubClient();

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const call = MockedCall.create();
            const callStore = MockedCallStore.create(call);

            const vm = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().startedByDisplayName).toStrictEqual("Alice");
        });

        it("isJoined", () => {
            const cli = stubClient();

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");
            const call = MockedCall.create().withParticipants([bob]);
            const callStore = MockedCallStore.create(call);

            // Alice hasn't joined the call yet
            const vm = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().isJoined).toStrictEqual(false);

            // Alice has joined call
            callStore.withActiveCall();
            call.withParticipants([mxEvent.sender, bob]);
            call.emit(CallEvent.Participants, call.participants, new Map());
            expect(vm.getSnapshot().isJoined).toStrictEqual(true);
        });

        it("callDirection", () => {
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@bob:m.org");

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100, "@alice:m.org");
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const call = MockedCall.create();
            const callStore = MockedCallStore.create(call);

            const vm1 = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm1.getSnapshot().callDirection).toStrictEqual(CallDirection.Incoming);

            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const vm2 = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm2.getSnapshot().callDirection).toStrictEqual(CallDirection.Outgoing);
        });

        it("callHasOtherParticipants", () => {
            const cli = stubClient();

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const call = MockedCall.create().withParticipants([mxEvent.sender]);
            const callStore = MockedCallStore.create(call);

            // Call has no other participants other than alice
            const vm = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().callHasOtherParticipants).toStrictEqual(false);

            // Let's say others join
            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");
            const james = getMockedMember(roomId, "@james:m.org", "James");
            call.withParticipants([mxEvent.sender, bob, james]);
            call.emit(CallEvent.Participants, call.participants, new Map());
            expect(vm.getSnapshot().callHasOtherParticipants).toStrictEqual(true);
        });

        it("isJoinable", () => {
            const cli = stubClient();
            const room = mkRoom(cli, roomId);
            // @ts-ignore
            room.getLiveTimeline = (): EventTimeline => {
                return {
                    getState: (): RoomState => {
                        return {
                            mayClientSendStateEvent: () => true,
                        } as unknown as RoomState;
                    },
                } as unknown as EventTimeline;
            };
            cli.getRoom = () => room;

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const call = MockedCall.create();
            const callStore = MockedCallStore.create(call);

            const vm = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().isJoinable).toStrictEqual(true);
        });
    });

    it("should join call on join()", () => {
        const cli = stubClient();

        const mxEvent = getMockedRtcNotificationEvent("video", 100, 100);
        mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

        const call = MockedCall.create().withParticipants([mxEvent.sender]);
        const callStore = MockedCallStore.create(call);
        const vm = new BaseOngoingCallViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });

        vm.join();
        const [_, room, callType, platformCallType] = vi.mocked(placeCall).mock.calls[0];
        expect(room.roomId).toStrictEqual(roomId);
        expect(callType).toStrictEqual(CallType.Video);
        expect(platformCallType).toStrictEqual(PlatformCallType.ElementCall);
    });
});
