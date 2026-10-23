/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { UnstableValue } from "matrix-js-sdk/src/NamespacedValue";

/**
 * The content block of an MSC4569 `m.jscalendar.event` state event.
 */
export const M_JSCALENDAR_EVENT = new UnstableValue("m.jscalendar.event", "de.connect2x.msc4569.jscalendar.event");

/**
 * A JSCalendar `NDay`: a day of the week, optionally the nth one in the period.
 */
export interface JSCalendarNDay {
    day: "mo" | "tu" | "we" | "th" | "fr" | "sa" | "su";
    nthOfPeriod?: number;
}

/**
 * A JSCalendar `RecurrenceRule`. Only the properties the timeline summarises are typed.
 */
export interface JSCalendarRecurrenceRule {
    frequency: "yearly" | "monthly" | "weekly" | "daily" | "hourly" | "minutely" | "secondly";
    interval?: number;
    byDay?: JSCalendarNDay[];
    [property: string]: unknown;
}

/**
 * A JSCalendar `Location`.
 */
export interface JSCalendarLocation {
    name?: string;
    description?: string;
}

/**
 * A JSCalendar `VirtualLocation`.
 */
export interface JSCalendarVirtualLocation {
    "@type"?: "VirtualLocation";
    "name"?: string;
    "uri": string;
}

/**
 * The content of an MSC4569 `m.jscalendar.event` block: a JSCalendar `Event` without `@type`, `uid` and `version`.
 * Only the properties shown in the timeline are typed.
 *
 * @see https://datatracker.ietf.org/doc/draft-ietf-calext-jscalendarbis/
 */
export interface JSCalendarEvent {
    /** When the event was last changed, as a UTC date-time, e.g. `2020-01-02T18:23:04Z`. */
    updated?: string;
    /** Wall-clock start time without an offset, e.g. `2020-01-15T13:00:00`. */
    start: string;
    /** ISO 8601 duration, e.g. `PT1H`. Defaults to `PT0S`. */
    duration?: string;
    /** IANA time zone of `start`. Floating time when absent or null. */
    timeZone?: string | null;
    /** Whether the time of day is not significant, i.e. an all-day event. */
    showWithoutTime?: boolean;
    title?: string;
    description?: string;
    status?: "confirmed" | "cancelled" | "tentative";
    locations?: Record<string, JSCalendarLocation>;
    virtualLocations?: Record<string, JSCalendarVirtualLocation>;
    participants?: Record<string, unknown>;
    recurrenceRules?: JSCalendarRecurrenceRule[];
}

/**
 * The content of an MSC4569 `m.jscalendar.event` state event.
 */
export interface JSCalendarEventContent {
    "de.connect2x.msc4569.jscalendar.event"?: JSCalendarEvent;
    "m.jscalendar.event"?: JSCalendarEvent;
}
