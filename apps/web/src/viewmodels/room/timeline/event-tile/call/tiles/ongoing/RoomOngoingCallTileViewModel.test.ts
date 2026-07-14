/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { EventType, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { stubClient } from "../../../../../../../../test/test-utils";
import {
    getMockedMember,
    getMockedRtcDeclineEvent,
    getMockedRtcNotificationEvent,
    MockedCall,
    MockedCallStore,
} from "../../call-mocks";
import { RoomOngoingCallTileViewModel } from "./RoomOngoingCallTileViewModel";
import { CallEvent } from "../../../../../../../models/Call";

const roomId = "!my-room:m.org";

describe("RoomOngoingCallTileViewModel", () => {
    describe("should compute the correct snapshot", () => {
        it("totalParticipants", () => {
            const cli = stubClient();

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");
            const james = getMockedMember(roomId, "@james:m.org", "James");
            const call = MockedCall.create().withParticipants([mxEvent.sender, bob, james]);
            const callStore = MockedCallStore.create(call);
            const vm = new RoomOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId });

            // Call has 3 participants now
            expect(vm.getSnapshot().totalParticipants).toStrictEqual(3);

            // Peter also joins the call
            const peter = getMockedMember(roomId, "@peter:m.org", "Peter");
            call.withParticipants([mxEvent.sender, bob, james, peter]);
            call.emit(CallEvent.Participants, call.participants, new Map());

            // Now there should be 4 participants
            expect(vm.getSnapshot().totalParticipants).toStrictEqual(4);
        });

        it("isCallIgnored", () => {
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const getRelationsForEvent = vi.fn();

            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

            const call = MockedCall.create().withParticipants([mxEvent.sender]);
            const callStore = MockedCallStore.create(call);
            const vm = new RoomOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, getRelationsForEvent });

            // Call hasn't been ignored yet
            expect(vm.getSnapshot().isCallIgnored).toStrictEqual(false);

            // Ignore the call
            const declineEvent = getMockedRtcDeclineEvent(mxEvent, "@alice:m.org");
            getRelationsForEvent.mockReturnValue({ getRelations: () => [declineEvent] });
            mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.reference", EventType.RTCDecline);

            // Call should be ignored
            expect(vm.getSnapshot().isCallIgnored).toStrictEqual(true);
        });
    });
});
