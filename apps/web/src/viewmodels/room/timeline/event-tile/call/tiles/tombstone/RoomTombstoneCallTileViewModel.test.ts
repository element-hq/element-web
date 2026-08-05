/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";

import { getMockedRtcNotificationEvent } from "../../call-mocks";
import { RoomTombstoneCallTileViewModel } from "./RoomTombstoneCallTileViewModel";
import SettingsStore from "../../../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../../../settings/SettingLevel";
import { formatTime } from "../../../../../../../DateUtils";

describe("RoomTombstoneCallTileViewModel", () => {
    it("should compute timestamp correctly", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new RoomTombstoneCallTileViewModel({ mxEvent });
        expect(vm.getSnapshot().timestamp).toStrictEqual(formatTime(new Date(924285348000)));
    });

    it("should calculate time string correctly when configured to use 12 hour format", async () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        const vm = new RoomTombstoneCallTileViewModel({ mxEvent });
        const { timestamp } = vm.getSnapshot();

        expect(timestamp).toStrictEqual(formatTime(new Date(924285348000), true));
        SettingsStore.reset();
    });

    it("should change timestamp format when setting is modified", async () => {
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, false);
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000);
        const vm = new RoomTombstoneCallTileViewModel({ mxEvent });
        expect(vm.getSnapshot().timestamp).toStrictEqual(formatTime(new Date(924285348000)));
        await SettingsStore.setValue("showTwelveHourTimestamps", null, SettingLevel.DEVICE, true);
        await vi.waitFor(() => {
            expect(vm.getSnapshot().timestamp).toStrictEqual(formatTime(new Date(924285348000), true));
        });
        SettingsStore.reset();
    });
});
