/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { CallType } from "@element-hq/web-shared-components";
import { stubClient, TestSDKContext } from "test-utils";

import { getMockedMember, getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "../../call-mocks";
import { CallEvent } from "../../../../../../../models/Call";
import { DmOngoingCallTileViewModel } from "./DmOngoingCallTileViewModel";

const roomId = "!my-room:m.org";

describe("DmOngoingCallTileViewModel", () => {
    const sdkContext = new TestSDKContext();
    const legacyCallHandler = sdkContext.legacyCallHandler;

    describe("should compute the correct snapshot", () => {
        it("starts the timer when the other side picks up, not while ringing", () => {
            const cli = stubClient();
            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100, "@alice:m.org");
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");
            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");

            // The caller joins twice (a SIP bridge's user and its widget do): still ringing
            const call = MockedCall.create()
                .withParticipants([mxEvent.sender])
                .withMemberships(["@alice:m.org", 1000], ["@alice:m.org", 2000]);
            const callStore = MockedCallStore.create(call);
            const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().durationViewModel).toBeUndefined();

            vi.useFakeTimers();
            vi.setSystemTime(12_000);
            call.withParticipants([bob]).withMemberships(
                ["@alice:m.org", 1000],
                ["@alice:m.org", 2000],
                ["@bob:m.org", 5000],
            );
            call.emit(CallEvent.Participants, call.participants, new Map());
            // Counted from Bob's join at 5 s, not Alice's at 1 s
            expect(vm.getSnapshot().durationViewModel?.getSnapshot().duration).toStrictEqual(7);
            vi.useRealTimers();
        });

        describe("callType", () => {
            it("voice", () => {
                const cli = stubClient();

                const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
                mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

                const call = MockedCall.create().withParticipants([mxEvent.sender]);
                const callStore = MockedCallStore.create(call);
                const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });

                expect(vm.getSnapshot().callType).toStrictEqual(CallType.Voice);
            });

            it("video", () => {
                const cli = stubClient();

                const mxEvent = getMockedRtcNotificationEvent("video", 100, 100);
                mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

                const call = MockedCall.create().withParticipants([mxEvent.sender]);
                const callStore = MockedCallStore.create(call);
                const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });

                expect(vm.getSnapshot().callType).toStrictEqual(CallType.Video);
            });
        });
    });
});
