/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect } from "vitest";
import { CallType } from "@element-hq/web-shared-components";

import { stubClient, TestSDKContext } from "../../../../../../../../test/test-utils";
import { getMockedMember, getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "../../call-mocks";
import { DmOngoingCallTileViewModel } from "./DmOngoingCallTileViewModel";

const roomId = "!my-room:m.org";

describe("DmOngoingCallTileViewModel", () => {
    const sdkContext = new TestSDKContext();
    const legacyCallHandler = sdkContext.legacyCallHandler;

    describe("should compute the correct snapshot", () => {
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
