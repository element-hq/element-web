/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateCalendarEventViewModel } from "./CreateCalendarEventViewModel";

describe("CreateCalendarEventViewModel", () => {
    let sendStateEvent: ReturnType<typeof vi.fn>;
    let onFinished: ReturnType<typeof vi.fn>;

    const createViewModel = (timeZone = "Europe/London"): CreateCalendarEventViewModel =>
        new CreateCalendarEventViewModel({
            client: { sendStateEvent } as unknown as MatrixClient,
            roomId: "!room:server",
            timeZone,
            onFinished,
        });

    /** Fill in a valid form, keeping the suggested date and times. */
    const fillIn = (vm: CreateCalendarEventViewModel): void => {
        vm.setTitle("  Quarterly planning  ");
        vm.setStartTime("09:00");
        vm.setEndTime("10:30");
    };

    beforeEach(() => {
        // Only fake the clock, so that promises and waitFor still run normally.
        vi.useFakeTimers({ toFake: ["Date"] });
        // 15:20 in London, which is on summer time.
        vi.setSystemTime(new Date("2026-10-23T14:20:30.123Z"));
        sendStateEvent = vi.fn().mockResolvedValue({ event_id: "$event" });
        onFinished = vi.fn();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("suggests the next full hour today in the event's time zone", () => {
        expect(createViewModel().getSnapshot()).toEqual({
            title: "",
            description: "",
            date: "2026-10-23",
            allDay: false,
            startTime: "16:00",
            endTime: "17:00",
            link: "",
            timeZone: "Europe/London",
        });
    });

    it("suggests an event ending at the end of the day when it starts at 23:00", () => {
        vi.setSystemTime(new Date("2026-10-23T21:20:00Z"));
        expect(createViewModel().getSnapshot()).toMatchObject({
            date: "2026-10-23",
            startTime: "23:00",
            endTime: "23:59",
        });
    });

    it("suggests tomorrow when the next full hour is after midnight", () => {
        vi.setSystemTime(new Date("2026-10-23T23:20:00Z"));
        expect(createViewModel("Asia/Tokyo").getSnapshot()).toMatchObject({
            date: "2026-10-24",
            startTime: "09:00",
            endTime: "10:00",
        });
    });

    it("sends a timed event as a calendar state event", async () => {
        const vm = createViewModel();
        fillIn(vm);
        vm.setDescription("  Agenda  ");
        vm.setLink(" https://call.element.io/room/#/planning ");

        vm.create();
        await vi.waitFor(() => expect(onFinished).toHaveBeenCalledWith(true));

        expect(sendStateEvent).toHaveBeenCalledWith(
            "!room:server",
            EventType.UnstableCalendarEvent,
            {
                "de.connect2x.msc4569.jscalendar.event": {
                    updated: "2026-10-23T14:20:30Z",
                    title: "Quarterly planning",
                    description: "Agenda",
                    start: "2026-10-23T09:00:00",
                    duration: "PT1H30M",
                    timeZone: "Europe/London",
                    virtualLocations: {
                        link: { "@type": "VirtualLocation", "uri": "https://call.element.io/room/#/planning" },
                    },
                },
            },
            expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/),
        );
    });

    it.each([
        ["10:00", "PT1H"],
        ["09:45", "PT45M"],
        ["11:15", "PT2H15M"],
    ])("formats an event ending at %s as lasting %s", async (endTime, duration) => {
        const vm = createViewModel();
        fillIn(vm);
        vm.setEndTime(endTime);

        vm.create();
        await vi.waitFor(() => expect(sendStateEvent).toHaveBeenCalled());

        expect(sendStateEvent.mock.calls[0][2]["de.connect2x.msc4569.jscalendar.event"].duration).toBe(duration);
    });

    it("sends an all-day event without a time zone and ignores the times", async () => {
        const vm = createViewModel();
        vm.setTitle("Company holiday");
        vm.setDate("2026-12-25");
        vm.setAllDay(true);
        vm.setEndTime("01:00");

        vm.create();
        await vi.waitFor(() => expect(onFinished).toHaveBeenCalledWith(true));

        expect(sendStateEvent.mock.calls[0][2]).toEqual({
            "de.connect2x.msc4569.jscalendar.event": {
                updated: "2026-10-23T14:20:30Z",
                title: "Company holiday",
                start: "2026-12-25T00:00:00",
                duration: "P1D",
                showWithoutTime: true,
            },
        });
    });

    it("reports every problem with the form and does not send it", () => {
        const vm = createViewModel();
        vm.setTitle("   ");
        vm.setDate("");
        vm.setStartTime("10:00");
        vm.setEndTime("10:00");
        vm.setLink("javascript:alert(1)");

        vm.create();

        expect(vm.getSnapshot()).toMatchObject({
            isTitleMissing: true,
            isDateMissing: true,
            isEndBeforeStart: true,
            isLinkInvalid: true,
        });
        expect(sendStateEvent).not.toHaveBeenCalled();
    });

    it("clears each problem when its field changes", () => {
        const vm = createViewModel();
        vm.setDate("");
        vm.setEndTime("08:00");
        vm.setLink("not a link");
        vm.create();

        vm.setTitle("Planning");
        vm.setDate("2026-10-24");
        vm.setEndTime("17:00");
        vm.setLink("https://example.org");

        expect(vm.getSnapshot()).toMatchObject({
            isTitleMissing: false,
            isDateMissing: false,
            isEndBeforeStart: false,
            isLinkInvalid: false,
        });
    });

    it.each([
        ["start time", (vm: CreateCalendarEventViewModel) => vm.setStartTime("07:00")],
        ["all day", (vm: CreateCalendarEventViewModel) => vm.setAllDay(true)],
    ])("clears the time problem when the %s changes", (_name, change) => {
        const vm = createViewModel();
        vm.setEndTime("08:00");
        vm.create();

        change(vm);

        expect(vm.getSnapshot().isEndBeforeStart).toBe(false);
    });

    it("keeps the dialog open and reports a failure to send", async () => {
        sendStateEvent.mockRejectedValue(new Error("M_FORBIDDEN"));
        const vm = createViewModel();
        fillIn(vm);

        vm.create();
        await vi.waitFor(() => expect(vm.getSnapshot().didCreateFail).toBe(true));

        expect(vm.getSnapshot().isCreating).toBe(false);
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("sends the event only once when created twice", async () => {
        const vm = createViewModel();
        fillIn(vm);

        vm.create();
        expect(vm.getSnapshot().isCreating).toBe(true);
        vm.create();
        await vi.waitFor(() => expect(onFinished).toHaveBeenCalled());

        expect(sendStateEvent).toHaveBeenCalledTimes(1);
    });
});
