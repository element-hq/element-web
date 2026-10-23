/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    CalendarEventViewStatus,
    type CalendarEventViewSnapshot,
    type CalendarEventViewModel as CalendarEventViewModelInterface,
} from "@element-hq/web-shared-components";

import { _t } from "../../../languageHandler";
import { getUserLanguage } from "../../../i18n/settings";
import { DAY_MS, HOUR_MS, MINUTE_MS, getTwelveHourOptions } from "../../../DateUtils";
import { M_JSCALENDAR_EVENT, type JSCalendarEvent, type JSCalendarRecurrenceRule } from "./JSCalendarEvent";
import { isCallLink, isSafeUri } from "./calendarLinks";

export interface CalendarEventViewModelProps {
    /**
     * The `m.jscalendar.event` state event to show.
     */
    mxEvent: MatrixEvent;
    /**
     * Whether to show times in 12-hour rather than 24-hour format.
     */
    showTwelveHour: boolean;
    /**
     * The current user's ID, used to tell whether they were invited to the event.
     */
    userId?: string;
}

/** A JSCalendar `LocalDateTime`, e.g. `2020-01-15T13:00:00`. */
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/;
/** A JSCalendar `Duration`, e.g. `P1DT2H30M`. */
const DURATION = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;
/** Recurrence rule properties that do not change the summary we show. */
const SUMMARISED_RULE_PROPERTIES = new Set([
    "@type",
    "frequency",
    "interval",
    "byDay",
    "count",
    "until",
    "firstDayOfWeek",
    "rscale",
    "skip",
]);
const WEEKDAYS = ["mo", "tu", "we", "th", "fr", "sa", "su"];
/** 2024-01-01, a Monday. */
const REFERENCE_MONDAY_MS = Date.UTC(2024, 0, 1);

/**
 * Parse a JSCalendar `LocalDateTime` into a `Date` whose UTC fields hold the wall-clock time.
 * Formatting that date in UTC shows the time as written in the event's own time zone.
 */
function parseLocalDateTime(value: unknown): Date | undefined {
    if (typeof value !== "string") return undefined;
    const match = LOCAL_DATE_TIME.exec(value);
    if (!match) return undefined;
    const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    // Reject dates such as 2020-02-31, which Date.UTC would roll over into March.
    return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : undefined;
}

/**
 * Parse a JSCalendar `Duration` into milliseconds. Returns 0 when absent or invalid.
 */
function parseDuration(value: unknown): number {
    if (typeof value !== "string") return 0;
    const match = DURATION.exec(value);
    if (!match) return 0;
    const [weeks, days, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
    return (weeks * 7 + days) * DAY_MS + hours * HOUR_MS + minutes * MINUTE_MS + seconds * 1000;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
}

/**
 * Get the values of a JSCalendar `Id[...]` map, dropping anything that is not an object.
 */
function mapValues(map: unknown): Record<string, unknown>[] {
    if (!map || typeof map !== "object") return [];
    return Object.values(map).filter((value): value is Record<string, unknown> => !!value && typeof value === "object");
}

/**
 * View model for the body of an MSC4569 calendar event (`m.jscalendar.event`).
 *
 * Times are shown as written in the event's own time zone, which is named alongside them, rather than converted to
 * the user's time zone.
 */
export class CalendarEventViewModel
    extends BaseViewModel<CalendarEventViewSnapshot, CalendarEventViewModelProps>
    implements CalendarEventViewModelInterface
{
    /**
     * Whether the event holds a calendar event this view model can show. Events that fail this check should be
     * rendered with a fallback body instead.
     */
    public static isValidEvent(mxEvent: MatrixEvent): boolean {
        return !!parseLocalDateTime(CalendarEventViewModel.getCalendarEvent(mxEvent)?.start);
    }

    private static getCalendarEvent(mxEvent: MatrixEvent): Partial<JSCalendarEvent> | undefined {
        const calendarEvent = M_JSCALENDAR_EVENT.findIn<unknown>(mxEvent.getContent());
        return calendarEvent && typeof calendarEvent === "object" ? calendarEvent : undefined;
    }

    private static computeSnapshot({
        mxEvent,
        showTwelveHour,
        userId,
    }: CalendarEventViewModelProps): CalendarEventViewSnapshot {
        const calendarEvent = CalendarEventViewModel.getCalendarEvent(mxEvent) ?? {};
        const locale = getUserLanguage();

        // Every field is set, even when undefined, so that merging a new snapshot clears stale values.
        return {
            title: typeof calendarEvent.title === "string" ? calendarEvent.title : "",
            description: isNonEmptyString(calendarEvent.description) ? calendarEvent.description : undefined,
            ...CalendarEventViewModel.formatWhen(calendarEvent, showTwelveHour, locale),
            timeZone: isNonEmptyString(calendarEvent.timeZone) ? calendarEvent.timeZone : undefined,
            recurrence: CalendarEventViewModel.formatRecurrence(calendarEvent.recurrenceRules, locale),
            status: CalendarEventViewModel.getStatus(calendarEvent.status),
            locations: CalendarEventViewModel.getLocations(calendarEvent.locations),
            ...CalendarEventViewModel.getLinks(calendarEvent.virtualLocations),
            participantCount: mapValues(calendarEvent.participants).length,
            invitedYou: CalendarEventViewModel.isInvited(calendarEvent.participants, mxEvent.getSender(), userId),
        };
    }

    private static formatWhen(
        calendarEvent: Partial<JSCalendarEvent>,
        showTwelveHour: boolean,
        locale: string,
    ): Pick<CalendarEventViewSnapshot, "date" | "startMonth" | "startDay" | "time"> {
        const start = parseLocalDateTime(calendarEvent.start);
        if (!start) {
            return {
                date: typeof calendarEvent.start === "string" ? calendarEvent.start : "",
                startMonth: undefined,
                startDay: undefined,
                time: undefined,
            };
        }

        // The duration is added in wall-clock time, so an event spanning a daylight saving change may end an hour
        // early or late. This only affects the time shown, not when the event happens.
        const end = new Date(start.getTime() + parseDuration(calendarEvent.duration));
        // An event ending at midnight, including any all-day event, does not take place on the day it ends.
        const lastDay = end > start ? new Date(end.getTime() - 1) : start;

        const dateFormat = new Intl.DateTimeFormat(locale, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "UTC",
        });
        const timeFormat = new Intl.DateTimeFormat(locale, {
            ...getTwelveHourOptions(showTwelveHour),
            hour: "numeric",
            minute: "2-digit",
            timeZone: "UTC",
        });

        // The days are already in the date range, so move the end onto the start day to keep them out of the time
        // range. The end may then be before the start, which formatRange accepts.
        const endOnStartDay = new Date(start.getTime() + (end.getTime() % DAY_MS) - (start.getTime() % DAY_MS));

        return {
            date: dateFormat.formatRange(start, lastDay),
            startMonth: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(start),
            startDay: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(start),
            time: calendarEvent.showWithoutTime === true ? undefined : timeFormat.formatRange(start, endOnStartDay),
        };
    }

    private static formatRecurrence(rules: unknown, locale: string): string | undefined {
        if (!Array.isArray(rules) || rules.length === 0) return undefined;

        const rule = rules[0] as Partial<JSCalendarRecurrenceRule> | null;
        // Anything more complex than a single rule repeating at a fixed interval only gets a generic label.
        if (
            rules.length > 1 ||
            !rule ||
            typeof rule !== "object" ||
            Object.keys(rule).some((property) => !SUMMARISED_RULE_PROPERTIES.has(property))
        ) {
            return _t("timeline|calendar_event|recurrence|custom");
        }

        const count = typeof rule.interval === "number" && rule.interval > 0 ? rule.interval : 1;

        if (rule.byDay !== undefined) {
            const days = Array.isArray(rule.byDay) ? rule.byDay : [];
            const dayIndexes = days.map((nDay) => (nDay?.nthOfPeriod === undefined ? WEEKDAYS.indexOf(nDay?.day) : -1));
            if (rule.frequency !== "weekly" || days.length === 0 || dayIndexes.includes(-1)) {
                return _t("timeline|calendar_event|recurrence|custom");
            }
            const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
            const dayNames = dayIndexes.map((index) => weekdayFormat.format(REFERENCE_MONDAY_MS + index * DAY_MS));
            const daysText = new Intl.ListFormat(locale, { type: "conjunction" }).format(dayNames);
            return _t("timeline|calendar_event|recurrence|weekly_on_days", { count, days: daysText });
        }

        switch (rule.frequency) {
            case "yearly":
                return _t("timeline|calendar_event|recurrence|yearly", { count });
            case "monthly":
                return _t("timeline|calendar_event|recurrence|monthly", { count });
            case "weekly":
                return _t("timeline|calendar_event|recurrence|weekly", { count });
            case "daily":
                return _t("timeline|calendar_event|recurrence|daily", { count });
            default:
                return _t("timeline|calendar_event|recurrence|custom");
        }
    }

    /**
     * Whether the user is a participant of an event someone else sent. MSC4569 keys Matrix participants by user ID.
     */
    private static isInvited(participants: unknown, senderId: string | undefined, userId?: string): boolean {
        if (!userId || userId === senderId || !participants || typeof participants !== "object") return false;
        return Object.hasOwn(participants, userId);
    }

    private static getStatus(status: unknown): CalendarEventViewStatus {
        switch (status) {
            case "cancelled":
                return CalendarEventViewStatus.CANCELLED;
            case "tentative":
                return CalendarEventViewStatus.TENTATIVE;
            default:
                return CalendarEventViewStatus.CONFIRMED;
        }
    }

    private static getLocations(locations: unknown): string[] {
        return mapValues(locations)
            .map(({ name }) => name)
            .filter(isNonEmptyString);
    }

    /**
     * Pick the first call and the first other web page from the event's online locations. The view has room for one
     * of each, so any others are not shown.
     */
    private static getLinks(virtualLocations: unknown): Pick<CalendarEventViewSnapshot, "link" | "callLink"> {
        const uris = mapValues(virtualLocations)
            .map(({ uri }) => uri)
            .filter(isNonEmptyString)
            .filter(isSafeUri);
        return {
            link: uris.find((uri) => !isCallLink(uri)),
            callLink: uris.find(isCallLink),
        };
    }

    public constructor(props: CalendarEventViewModelProps) {
        super(props, CalendarEventViewModel.computeSnapshot(props));
    }

    /**
     * Update the view model with new props, recomputing the snapshot when the event, time format or user changes.
     */
    public setProps(props: CalendarEventViewModelProps): void {
        const changed =
            props.mxEvent !== this.props.mxEvent ||
            props.showTwelveHour !== this.props.showTwelveHour ||
            props.userId !== this.props.userId;
        this.props = props;
        if (changed) this.snapshot.merge(CalendarEventViewModel.computeSnapshot(props));
    }
}
