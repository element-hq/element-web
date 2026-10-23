/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { CalendarEventViewStatus } from "@element-hq/web-shared-components";
import { describe, expect, it, vi } from "vitest";

import { CalendarEventViewModel } from "./CalendarEventViewModel";

vi.mock("../../../i18n/settings", async (importOriginal) => ({
    ...(await importOriginal()),
    getUserLanguage: (): string => "en-GB",
}));

const createEvent = (calendarEvent: unknown): MatrixEvent =>
    new MatrixEvent({
        type: EventType.UnstableCalendarEvent,
        room_id: "!room:server",
        event_id: "$calendar:server",
        sender: "@alice:server",
        state_key: "a8df6573-0474-496d-8496-033ad45d7fea",
        content: { "de.connect2x.msc4569.jscalendar.event": calendarEvent },
    });

const createViewModel = (calendarEvent: unknown, showTwelveHour = false): CalendarEventViewModel =>
    new CalendarEventViewModel({ mxEvent: createEvent(calendarEvent), showTwelveHour });

/**
 * Get the formatted date and time with all whitespace as plain spaces, since ICU versions differ in which
 * (thin, narrow no-break, …) spaces they use.
 */
const getWhen = (vm: CalendarEventViewModel): { date: string; time?: string } => {
    const { date, time } = vm.getSnapshot();
    const normalise = (text: string): string => text.replace(/\s+/g, " ");
    return { date: normalise(date), time: time === undefined ? undefined : normalise(time) };
};

// The example event from MSC4569.
const exampleEvent = {
    updated: "2020-01-02T18:23:04Z",
    title: "Some event",
    start: "2020-01-15T13:00:00",
    timeZone: "America/New_York",
    duration: "PT1H",
};

describe("CalendarEventViewModel", () => {
    it("computes the snapshot for the MSC example event", () => {
        const vm = createViewModel(exampleEvent);
        expect(getWhen(vm)).toEqual({ date: "Wednesday, 15 January 2020", time: "13:00–14:00" });
        expect(vm.getSnapshot()).toEqual({
            title: "Some event",
            description: undefined,
            date: expect.any(String),
            startMonth: "Jan",
            startDay: "15",
            time: expect.any(String),
            timeZone: "America/New_York",
            recurrence: undefined,
            status: CalendarEventViewStatus.CONFIRMED,
            locations: [],
            link: undefined,
            callLink: undefined,
            participantCount: 0,
            invitedYou: false,
        });
    });

    it("reads the stable content block", () => {
        const mxEvent = new MatrixEvent({
            type: "m.jscalendar.event",
            content: { "m.jscalendar.event": exampleEvent },
        });
        const vm = new CalendarEventViewModel({ mxEvent, showTwelveHour: false });
        expect(vm.getSnapshot().title).toBe("Some event");
    });

    it("formats times in 12-hour format", () => {
        expect(getWhen(createViewModel(exampleEvent, true)).time).toBe("1:00 – 2:00 pm");
    });

    it("shows the event's wall-clock time without converting time zones", () => {
        const vm = createViewModel({ ...exampleEvent, timeZone: "Asia/Tokyo", start: "2020-01-15T23:30:00" });
        expect(getWhen(vm)).toEqual({ date: "Wednesday 15 January – Thursday 16 January 2020", time: "23:30–00:30" });
        expect(vm.getSnapshot()).toMatchObject({ startMonth: "Jan", startDay: "15", timeZone: "Asia/Tokyo" });
    });

    it("shows a single time for events without a duration", () => {
        const vm = createViewModel({ start: "2020-01-15T13:00:00" });
        expect(vm.getSnapshot()).toMatchObject({ time: "13:00", timeZone: undefined });
    });

    it("does not count an event ending at midnight as taking place on the next day", () => {
        const vm = createViewModel({ start: "2020-01-15T22:00:00", duration: "PT2H" });
        expect(getWhen(vm)).toEqual({ date: "Wednesday, 15 January 2020", time: "22:00–00:00" });
    });

    it.each([
        ["P1D", "Friday, 25 December 2026"],
        ["P2D", "Friday 25 December – Saturday 26 December 2026"],
        ["P1W", "Friday 25 December – Thursday 31 December 2026"],
        [undefined, "Friday, 25 December 2026"],
    ])("formats all-day events lasting %s", (duration, date) => {
        const vm = createViewModel({ start: "2026-12-25T00:00:00", showWithoutTime: true, duration });
        expect(getWhen(vm)).toEqual({ date, time: undefined });
    });

    it.each([
        ["a participant", "@bob:server", true],
        ["not a participant", "@carol:server", false],
        ["the sender", "@alice:server", false],
        ["unknown", undefined, false],
    ])("tells whether the user is invited when they are %s", (_name, userId, expected) => {
        const mxEvent = createEvent({
            ...exampleEvent,
            participants: {
                "@alice:server": { "@type": "Participant", "roles": { owner: true } },
                "@bob:server": { "@type": "Participant", "roles": { attendee: true } },
            },
        });
        const vm = new CalendarEventViewModel({ mxEvent, showTwelveHour: false, userId });
        expect(vm.getSnapshot().invitedYou).toBe(expected);
    });

    it.each([
        ["cancelled", CalendarEventViewStatus.CANCELLED],
        ["tentative", CalendarEventViewStatus.TENTATIVE],
        ["confirmed", CalendarEventViewStatus.CONFIRMED],
        ["something-else", CalendarEventViewStatus.CONFIRMED],
    ])("maps the %s status", (status, expected) => {
        expect(createViewModel({ ...exampleEvent, status }).getSnapshot().status).toBe(expected);
    });

    it("collects locations, links and participants", () => {
        const vm = createViewModel({
            ...exampleEvent,
            description: "Agenda",
            locations: {
                room: { "@type": "Location", "name": "Meeting room 2" },
                unnamed: { "@type": "Location", "description": "No name" },
                broken: "not a location",
            },
            virtualLocations: {
                script: { "@type": "VirtualLocation", "name": "Bad", "uri": "javascript:alert(1)" },
                phone: { "@type": "VirtualLocation", "name": "Phone", "uri": "tel:+1-555-0100" },
                page: { "@type": "VirtualLocation", "name": "Agenda", "uri": "http://example.org/agenda" },
                call: { "@type": "VirtualLocation", "name": "Video call", "uri": "https://call.element.io/room/#/x" },
                otherPage: { "@type": "VirtualLocation", "uri": "https://example.org/other" },
                otherCall: { "@type": "VirtualLocation", "uri": "https://call.element.io/room/#/y" },
            },
            participants: {
                alice: { "@type": "Participant", "calendarAddress": "matrix:u/alice:server" },
                bob: { "@type": "Participant", "email": "bob@example.org" },
            },
        });

        expect(vm.getSnapshot()).toMatchObject({
            description: "Agenda",
            locations: ["Meeting room 2"],
            link: "http://example.org/agenda",
            callLink: "https://call.element.io/room/#/x",
            participantCount: 2,
        });
    });

    it.each([
        ["only a web page", "https://example.org/page", "https://example.org/page", undefined],
        ["only a call", "https://call.element.io/room/#/x", undefined, "https://call.element.io/room/#/x"],
        [
            "a look-alike call domain",
            "https://call.element.io.example.org/x",
            "https://call.element.io.example.org/x",
            undefined,
        ],
    ])("sorts %s into the link or call link", (_name, uri, link, callLink) => {
        const vm = createViewModel({ ...exampleEvent, virtualLocations: { location: { uri } } });
        expect(vm.getSnapshot()).toMatchObject({ link, callLink });
    });

    it.each([
        [[{ frequency: "daily" }], "Every day"],
        [[{ frequency: "daily", interval: 3 }], "Every 3 days"],
        [[{ frequency: "weekly", count: 10 }], "Every week"],
        [[{ frequency: "monthly", interval: 2 }], "Every 2 months"],
        [[{ frequency: "yearly" }], "Every year"],
        [
            [{ frequency: "weekly", byDay: [{ day: "mo" }, { day: "we" }, { day: "fr" }] }],
            "Every week on Monday, Wednesday and Friday",
        ],
        [[{ frequency: "weekly", interval: 2, byDay: [{ day: "su" }] }], "Every 2 weeks on Sunday"],
        [[{ frequency: "monthly", byDay: [{ day: "mo", nthOfPeriod: 1 }] }], "Repeats"],
        [[{ frequency: "monthly", byMonthDay: [1, 15] }], "Repeats"],
        [[{ frequency: "hourly" }], "Repeats"],
        [[{ frequency: "daily" }, { frequency: "weekly" }], "Repeats"],
        [[], undefined],
    ])("summarises the recurrence rules %j", (recurrenceRules, expected) => {
        expect(createViewModel({ ...exampleEvent, recurrenceRules }).getSnapshot().recurrence).toBe(expected);
    });

    it.each([
        ["a missing content block", undefined, false],
        ["a missing start", { title: "No start" }, false],
        ["an invalid start", { start: "2020-02-31T13:00:00" }, false],
        ["a start with an offset", { start: "2020-01-15T13:00:00Z" }, false],
        ["the MSC example", exampleEvent, true],
    ])("validates an event with %s", (_name, calendarEvent, expected) => {
        expect(CalendarEventViewModel.isValidEvent(createEvent(calendarEvent))).toBe(expected);
    });

    it("tolerates malformed content", () => {
        const vm = createViewModel({ start: 42, title: { text: "x" }, locations: "x", participants: null });
        expect(vm.getSnapshot()).toMatchObject({
            title: "",
            date: "",
            startMonth: undefined,
            startDay: undefined,
            time: undefined,
            locations: [],
            participantCount: 0,
        });
    });

    it("recomputes the snapshot when the event changes", () => {
        const vm = createViewModel({ ...exampleEvent, description: "Old", recurrenceRules: [{ frequency: "daily" }] });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setProps({ mxEvent: createEvent({ ...exampleEvent, title: "Renamed" }), showTwelveHour: false });

        expect(listener).toHaveBeenCalledTimes(1);
        // Fields missing from the new event are cleared rather than kept from the old one.
        expect(vm.getSnapshot()).toMatchObject({ title: "Renamed", description: undefined, recurrence: undefined });
    });

    it("recomputes the snapshot when the user changes", () => {
        const mxEvent = createEvent({ ...exampleEvent, participants: { "@bob:server": {} } });
        const vm = new CalendarEventViewModel({ mxEvent, showTwelveHour: false });

        vm.setProps({ mxEvent, showTwelveHour: false, userId: "@bob:server" });

        expect(vm.getSnapshot().invitedYou).toBe(true);
    });

    it("does not notify when the props are unchanged", () => {
        const mxEvent = createEvent(exampleEvent);
        const vm = new CalendarEventViewModel({ mxEvent, showTwelveHour: false });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setProps({ mxEvent, showTwelveHour: false });

        expect(listener).not.toHaveBeenCalled();
    });
});
