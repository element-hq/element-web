/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixEvent, MatrixEventEvent, RelationType } from "matrix-js-sdk/src/matrix";
import { CallType } from "@element-hq/web-shared-components";
import { waitFor } from "jest-matrix-react";

import { mkEvent, stubClient } from "../../test-utils";
import { CallTileViewModel } from "../../../src/viewmodels/room/timeline/event-tile/call/CallTileViewModel";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";

function getMockedRtcNotificationEvent(intent: string, senderTs: number, serverTs: number): MatrixEvent {
    const mockEvent = mkEvent({
        type: EventType.RTCNotification,
        user: "@foo:m.org",
        content: {
            "m.call.intent": intent,
            "sender_ts": senderTs,
        },
        ts: serverTs,
        event: true,
    });
    return mockEvent;
}

function getMockedRtcDeclineEvent(rtcNotificationEvent: MatrixEvent, sender = "@foo:m.org"): MatrixEvent {
    const mockEvent = mkEvent({
        type: EventType.RTCDecline,
        user: sender,
        content: {
            "m.relates_to": {
                rel_type: "m.reference",
                event_id: rtcNotificationEvent.getId(),
            },
        },
        ts: 924285416000,
        event: true,
    });
    return mockEvent;
}

describe("CallTileViewModel", () => {
    it("should set voice intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365);
        const vm = new CallTileViewModel({ mxEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Voice);
    });

    it("should set video intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 1752583130365, 1752583130365);
        const vm = new CallTileViewModel({ mxEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Video);
    });

    it("should calculate time string correctly", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new CallTileViewModel({ mxEvent });
        const { timestamp } = vm.getSnapshot();
        expect(timestamp).toStrictEqual("17:55");
    });

    it("should calculate time string correctly when configured to use 12 hour format", async () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        const vm = new CallTileViewModel({ mxEvent });
        const { timestamp } = vm.getSnapshot();
        expect(timestamp).toStrictEqual("5:55 PM");
        SettingsStore.reset();
    });

    it("should change timestamp format when setting is modified", async () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new CallTileViewModel({ mxEvent });
        expect(vm.getSnapshot().timestamp).toStrictEqual("17:55");
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        await waitFor(() => {
            expect(vm.getSnapshot().timestamp).toStrictEqual("5:55 PM");
        });
        SettingsStore.reset();
    });

    describe("On call declined", () => {
        it("should calculate isCallDeclined correctly", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365);
            // When there's no decline event, isCallDeclined = false
            const vm1 = new CallTileViewModel({ mxEvent, getRelationsForEvent: jest.fn() });
            expect(vm1.isCallDeclined).toStrictEqual(false);

            // When there's a decline event, isCallDeclined = true
            const declineEvent = getMockedRtcDeclineEvent(mxEvent);
            const getRelationsForEvent = jest.fn().mockReturnValue({
                getRelations: () => [declineEvent],
            });
            const vm2 = new CallTileViewModel({ mxEvent, getRelationsForEvent });
            expect(vm2.isCallDeclined).toStrictEqual(true);
        });

        it("should calculate isCallDeclinedByUs correctly", () => {
            const cli = stubClient();
            cli.getUserId = jest.fn().mockReturnValue("@bar:m.org");

            const mxEvent = getMockedRtcNotificationEvent("audio", 924285348000, 924285348000);
            const declineEvent: MatrixEvent[] = [];
            const getRelationsForEvent = jest.fn().mockReturnValue({
                getRelations: () => declineEvent,
            });

            // Decline event sent by somebody else
            declineEvent.push(getMockedRtcDeclineEvent(mxEvent));
            const vm = new CallTileViewModel({ mxEvent, getRelationsForEvent });
            expect(vm.getSnapshot().isCallDeclinedByUs).toStrictEqual(false);

            // Decline event sent by us
            declineEvent.pop();
            declineEvent.push(getMockedRtcDeclineEvent(mxEvent, MatrixClientPeg.get()!.getUserId()!));
            const vm2 = new CallTileViewModel({ mxEvent, getRelationsForEvent });
            expect(vm2.getSnapshot().isCallDeclinedByUs).toStrictEqual(true);
        });

        it("should recompute state when call is declined", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 924285348000, 924285348000);
            const declineEvent: MatrixEvent[] = [];
            const getRelationsForEvent = jest.fn().mockReturnValue({
                getRelations: () => declineEvent,
            });

            // No decline event yet, so timestamp should be based on rtc notification event.
            const vm = new CallTileViewModel({ mxEvent, getRelationsForEvent });
            expect(vm.getSnapshot().timestamp).toStrictEqual("17:55");

            // Decline event arrives, timestamp should update to be that of the decline event.
            declineEvent.push(getMockedRtcDeclineEvent(mxEvent));
            mxEvent.emit(MatrixEventEvent.RelationsCreated, RelationType.Reference, EventType.RTCDecline);
            expect(vm.getSnapshot().timestamp).toStrictEqual("17:56");
        });
    });
});
