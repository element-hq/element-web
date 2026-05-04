/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent, EventType } from "matrix-js-sdk/src/matrix";
import { CallType } from "@element-hq/web-shared-components";
import { waitFor } from "jest-matrix-react";

import { mkEvent } from "../../test-utils";
import { CallStartedTileViewModel } from "../../../src/viewmodels/room/timeline/event-tile/call/CallStartedTileViewModel";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";

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

describe("CallStartedTileViewModel", () => {
    it("should set voice intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365);
        const vm = new CallStartedTileViewModel({ mxEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Voice);
    });

    it("should set video intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 1752583130365, 1752583130365);
        const vm = new CallStartedTileViewModel({ mxEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Video);
    });

    it("should calculate time string correctly", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new CallStartedTileViewModel({ mxEvent });
        const { timestamp } = vm.getSnapshot();
        expect(timestamp).toStrictEqual("17:55");
    });

    it("should calculate time string correctly when configured to use 12 hour format", async () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        const vm = new CallStartedTileViewModel({ mxEvent });
        const { timestamp } = vm.getSnapshot();
        expect(timestamp).toStrictEqual("5:55 PM");
        SettingsStore.reset();
    });

    it("should change timestamp format when setting is modified", async () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new CallStartedTileViewModel({ mxEvent });
        expect(vm.getSnapshot().timestamp).toStrictEqual("17:55");
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        await waitFor(() => {
            expect(vm.getSnapshot().timestamp).toStrictEqual("5:55 PM");
        });
    });
});
