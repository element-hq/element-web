/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import * as DateUtils from "../../../src/DateUtils";
import { MessageTimestampViewModel } from "../../../src/viewmodels/room/timeline/event-tile/timestamp/MessageTimestampViewModel";

jest.mock("../../../src/settings/SettingsStore");

describe("MessageTimestampViewModel", () => {
    // Friday Dec 17 2021, 9:09am
    const nowDate = new Date("2021-12-17T08:09:00.000Z");
    const HOUR_MS = 3600000;
    const DAY_MS = HOUR_MS * 24;

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should return the snapshot", () => {
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
        });
        expect(vm.getSnapshot()).toMatchObject({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
        });
    });

    it("should return the snapshot with tsReceivedAt", () => {
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            receivedTs: nowDate.getTime() + DAY_MS,
        });
        expect(vm.getSnapshot()).toMatchObject({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
            tsReceivedAt: "Sat, Dec 18, 2021, 08:09:00",
        });
    });

    it("should return the snapshot without presentation class names", () => {
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
        });
        expect(vm.getSnapshot()).toMatchObject({
            ts: "08:09",
            tsSentAt: "Fri, Dec 17, 2021, 08:09:00",
        });
    });

    it("should use formatRelativeTime when showRelative is true", () => {
        jest.spyOn(DateUtils, "formatFullDate").mockReturnValue("SENT_AT");
        const formatRelativeTimeSpy = jest.spyOn(DateUtils, "formatRelativeTime").mockReturnValue("RELATIVE");

        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            showRelative: true,
            showTwelveHour: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            ts: "RELATIVE",
            tsSentAt: "SENT_AT",
        });
        expect(formatRelativeTimeSpy).toHaveBeenCalledWith(expect.any(Date), true);
    });

    it("should use full date when showFullDate is true and respect showSeconds", () => {
        const formatFullDateSpy = jest
            .spyOn(DateUtils, "formatFullDate")
            .mockImplementation((_date, _showTwelveHour, showSeconds) =>
                showSeconds === false ? "FULL_NO_SECONDS" : "SENT_AT",
            );

        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            showFullDate: true,
            showSeconds: false,
        });

        expect(vm.getSnapshot()).toMatchObject({
            ts: "FULL_NO_SECONDS",
            tsSentAt: "SENT_AT",
        });
        expect(formatFullDateSpy).toHaveBeenCalled();
    });

    it("should use full time when showSeconds is true without full date", () => {
        jest.spyOn(DateUtils, "formatFullDate").mockReturnValue("SENT_AT");
        const formatFullTimeSpy = jest.spyOn(DateUtils, "formatFullTime").mockReturnValue("FULL_TIME");
        const formatTimeSpy = jest.spyOn(DateUtils, "formatTime").mockReturnValue("TIME");

        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            showSeconds: true,
        });

        expect(vm.getSnapshot()).toMatchObject({
            ts: "FULL_TIME",
            tsSentAt: "SENT_AT",
        });
        expect(formatFullTimeSpy).toHaveBeenCalled();
        expect(formatTimeSpy).not.toHaveBeenCalled();
    });

    it("should include tooltip inhibition and href in the snapshot", () => {
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            inhibitTooltip: true,
            href: "https://example.test",
        });

        expect(vm.getSnapshot()).toMatchObject({
            inhibitTooltip: true,
            href: "https://example.test",
        });
    });

    it("updates all props in one batch", () => {
        const onClick = jest.fn();
        const onContextMenu = jest.fn();
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
        });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setProps({
            ts: nowDate.getTime() + HOUR_MS,
            receivedTs: nowDate.getTime() + DAY_MS,
            showTwelveHour: true,
            inhibitTooltip: true,
            href: "https://example.test/event",
            onClick,
            onContextMenu,
        });

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot()).toMatchObject({
            ts: "9:09 AM",
            tsSentAt: "Fri, Dec 17, 2021, 9:09:00 AM",
            tsReceivedAt: "Sat, Dec 18, 2021, 8:09:00 AM",
            inhibitTooltip: true,
            href: "https://example.test/event",
        });
        expect(vm.onClick).toBe(onClick);
        expect(vm.onContextMenu).toBe(onContextMenu);
    });

    it("replaces props and clears omitted optional values", () => {
        const onClick = jest.fn();
        const onContextMenu = jest.fn();
        const vm = new MessageTimestampViewModel({
            ts: nowDate.getTime(),
            receivedTs: nowDate.getTime() + DAY_MS,
            inhibitTooltip: true,
            href: "https://example.test/event",
            onClick,
            onContextMenu,
        });

        vm.setProps({
            ts: nowDate.getTime() + HOUR_MS,
        });

        expect(vm.getSnapshot()).toMatchObject({
            ts: "09:09",
            tsSentAt: "Fri, Dec 17, 2021, 09:09:00",
        });
        expect(vm.getSnapshot().tsReceivedAt).toBeUndefined();
        expect(vm.getSnapshot().inhibitTooltip).toBeUndefined();
        expect(vm.getSnapshot().href).toBeUndefined();
        expect(vm.onClick).toBeUndefined();
        expect(vm.onContextMenu).toBeUndefined();
    });

    it("does not emit an update when batched props are unchanged", () => {
        const props = {
            ts: nowDate.getTime(),
            href: "https://example.test/event",
        };
        const vm = new MessageTimestampViewModel(props);
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setProps(props);

        expect(listener).not.toHaveBeenCalled();
    });
});
