/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, type MatrixClient } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";
import {
    BaseViewModel,
    type CreateCalendarEventViewSnapshot,
    type CreateCalendarEventViewModel as CreateCalendarEventViewModelInterface,
} from "@element-hq/web-shared-components";

import { HOUR_MS } from "../../../DateUtils";
import { M_JSCALENDAR_EVENT, type JSCalendarEvent } from "../../message-body/calendar/JSCalendarEvent";
import { isSafeUri } from "../../message-body/calendar/calendarLinks";

export interface CreateCalendarEventViewModelProps {
    /**
     * The client used to send the event.
     */
    client: MatrixClient;
    /**
     * The room to create the event in.
     */
    roomId: string;
    /**
     * The IANA time zone the event's times are in, e.g. "Europe/London".
     */
    timeZone: string;
    /**
     * Called when the dialog should close.
     * @param created - Whether the event was created.
     */
    onFinished: (created: boolean) => void;
}

/** An `<input type="date">` value. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** An `<input type="time">` value, which may include seconds. */
const TIME = /^(\d{2}):(\d{2})(?::\d{2})?$/;

/**
 * Get the minutes since midnight of an `<input type="time">` value.
 */
function parseTime(time: string): number | undefined {
    const match = TIME.exec(time);
    return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
}

/**
 * Format a number of minutes as a JSCalendar `Duration`, e.g. `PT1H30M`.
 */
function formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `PT${hours ? `${hours}H` : ""}${remainder ? `${remainder}M` : ""}`;
}

/**
 * Suggest the next full hour today, in the given time zone, as the event's start, lasting an hour.
 */
function suggestTimes(timeZone: string): Pick<CreateCalendarEventViewSnapshot, "date" | "startTime" | "endTime"> {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            hourCycle: "h23",
        })
            .formatToParts(new Date())
            .map(({ type, value }) => [type, Number(value)]),
    );
    // A Date whose UTC fields hold the wall-clock time, so the arithmetic ignores daylight saving changes.
    const start = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour + 1));
    const end = new Date(start.getTime() + HOUR_MS);
    const date = start.toISOString().slice(0, 10);
    // The form only has one date, so an event starting at 23:00 ends at the end of that day.
    const endTime = end.toISOString().slice(0, 10) === date ? end.toISOString().slice(11, 16) : "23:59";
    return { date, startTime: start.toISOString().slice(11, 16), endTime };
}

/**
 * View model for the dialog that creates an MSC4569 calendar event (`m.jscalendar.event`) in a room.
 */
export class CreateCalendarEventViewModel
    extends BaseViewModel<CreateCalendarEventViewSnapshot, CreateCalendarEventViewModelProps>
    implements CreateCalendarEventViewModelInterface
{
    public constructor(props: CreateCalendarEventViewModelProps) {
        super(props, {
            title: "",
            description: "",
            allDay: false,
            link: "",
            timeZone: props.timeZone,
            ...suggestTimes(props.timeZone),
        });
    }

    public setTitle = (title: string): void => {
        this.snapshot.merge({ title, isTitleMissing: false });
    };

    public setDescription = (description: string): void => {
        this.snapshot.merge({ description });
    };

    public setDate = (date: string): void => {
        this.snapshot.merge({ date, isDateMissing: false });
    };

    public setAllDay = (allDay: boolean): void => {
        this.snapshot.merge({ allDay, isEndBeforeStart: false });
    };

    public setStartTime = (startTime: string): void => {
        this.snapshot.merge({ startTime, isEndBeforeStart: false });
    };

    public setEndTime = (endTime: string): void => {
        this.snapshot.merge({ endTime, isEndBeforeStart: false });
    };

    public setLink = (link: string): void => {
        this.snapshot.merge({ link, isLinkInvalid: false });
    };

    public create = (): void => {
        void this.createEvent();
    };

    private async createEvent(): Promise<void> {
        const { title, date, allDay, startTime, endTime, link, isCreating } = this.snapshot.current;
        if (isCreating) return;

        const start = parseTime(startTime);
        const end = parseTime(endTime);
        const errors = {
            isTitleMissing: title.trim() === "",
            isDateMissing: !DATE.test(date),
            isEndBeforeStart: !allDay && (start === undefined || end === undefined || end <= start),
            isLinkInvalid: link.trim() !== "" && !isSafeUri(link.trim()),
        };
        this.snapshot.merge(errors);
        if (Object.values(errors).some(Boolean)) return;

        this.snapshot.merge({ isCreating: true, didCreateFail: false });
        try {
            await this.props.client.sendStateEvent(
                this.props.roomId,
                EventType.UnstableCalendarEvent,
                { [M_JSCALENDAR_EVENT.name]: this.buildCalendarEvent() },
                // MSC4569 uses a random state key as the event's JSCalendar `uid`.
                globalThis.crypto.randomUUID(),
            );
        } catch (e) {
            logger.error("Failed to create calendar event", e);
            this.snapshot.merge({ isCreating: false, didCreateFail: true });
            return;
        }
        this.props.onFinished(true);
    }

    /**
     * Build the JSCalendar event from the form. Only call once the form has been checked.
     */
    private buildCalendarEvent(): JSCalendarEvent {
        const { title, description, date, allDay, startTime, endTime, link } = this.snapshot.current;
        const trimmedDescription = description.trim();
        const trimmedLink = link.trim();

        return {
            // Fractional seconds are optional in a JSCalendar UTC date-time, so leave them out.
            updated: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
            title: title.trim(),
            ...(trimmedDescription && { description: trimmedDescription }),
            // All-day events float, so they fall on the same day wherever they are viewed.
            ...(allDay
                ? { start: `${date}T00:00:00`, duration: "P1D", showWithoutTime: true }
                : {
                      start: `${date}T${startTime.slice(0, 5)}:00`,
                      duration: formatDuration(parseTime(endTime)! - parseTime(startTime)!),
                      timeZone: this.props.timeZone,
                  }),
            ...(trimmedLink && {
                virtualLocations: { link: { "@type": "VirtualLocation", "uri": trimmedLink } },
            }),
        };
    }
}
