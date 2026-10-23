/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, type ReactNode } from "react";
import classNames from "classnames";
import { Badge, Button, Text, Tooltip } from "@vector-im/compound-web";
import {
    LinkIcon,
    LocationPinIcon,
    TimeIcon,
    UserIcon,
    VoiceCallSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel } from "../../../../../core/viewmodel/ViewModel";
import { useViewModel } from "../../../../../core/viewmodel/useViewModel";
import { useI18n } from "../../../../../core/i18n/i18nContext";
import { Flex } from "../../../../../core/utils/Flex";
import styles from "./CalendarEventView.module.css";

/**
 * The JSCalendar `status` of an event.
 */
export enum CalendarEventViewStatus {
    /** The event is going ahead. This is the JSCalendar default. */
    CONFIRMED = "CONFIRMED",
    /** The event may still change or be cancelled. */
    TENTATIVE = "TENTATIVE",
    /** The event will not take place. */
    CANCELLED = "CANCELLED",
}

export interface CalendarEventViewSnapshot {
    /**
     * The event title. An empty string shows a generic "Untitled event" label.
     */
    title: string;
    /**
     * Optional plain-text description of the event.
     */
    description?: string;
    /**
     * Formatted date of the event, e.g. "Wednesday, 15 January 2020". For events spanning several days this should
     * be the full range.
     */
    date: string;
    /**
     * Abbreviated month the event starts in, e.g. "Jan". Shown with {@link startDay} in a badge beside the event.
     * The badge is hidden unless both are set.
     */
    startMonth?: string;
    /**
     * Day of the month the event starts on, e.g. "15".
     */
    startDay?: string;
    /**
     * Formatted time range of the event, e.g. "13:00 – 14:00". Omit for all-day events.
     */
    time?: string;
    /**
     * Name of the time zone the event is scheduled in, e.g. "America/New_York".
     */
    timeZone?: string;
    /**
     * Formatted summary of how the event repeats, e.g. "Every week on Monday".
     */
    recurrence?: string;
    /**
     * The event status. Defaults to `CONFIRMED`.
     */
    status?: CalendarEventViewStatus;
    /**
     * Names of the physical locations of the event.
     */
    locations?: string[];
    /**
     * A web page for the event, opened from a link button. The view model must only pass URLs that are safe to open.
     */
    link?: string;
    /**
     * A call to join for the event, opened from a "Join call" button. The view model must only pass URLs that are safe
     * to open.
     */
    callLink?: string;
    /**
     * Number of participants invited to the event. Hidden when absent or zero.
     */
    participantCount?: number;
    /**
     * Whether the current user is a participant invited by the sender, rather than the organiser or an onlooker.
     * Picks the wording of the line naming the `sender`.
     */
    invitedYou?: boolean;
}

/**
 * The view model for {@link CalendarEventView}.
 */
export type CalendarEventViewModel = ViewModel<CalendarEventViewSnapshot>;

interface CalendarEventViewProps {
    /**
     * The view model for the component.
     */
    vm: CalendarEventViewModel;
    /**
     * The sender of the event, typically a user pill. When given, a line naming the sender is shown above the title.
     */
    sender?: ReactNode;
    /**
     * Optional CSS class for host-level styling.
     */
    className?: string;
}

/**
 * Renders a calendar event (MSC4569 `m.jscalendar.event`) in the timeline.
 *
 * Shows who sent the event, the title and status, when the event takes place, where it takes place, how many people
 * are invited, and its description, with buttons to open the event's link and join its call. All dates and times are
 * formatted by the view model.
 *
 * @example
 * ```tsx
 * <CalendarEventView vm={calendarEventViewModel} />
 * ```
 */
export function CalendarEventView({ vm, sender, className }: Readonly<CalendarEventViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        title,
        description,
        date,
        startMonth,
        startDay,
        time,
        timeZone,
        recurrence,
        status = CalendarEventViewStatus.CONFIRMED,
        locations,
        link,
        callLink,
        participantCount,
        invitedYou,
    } = useViewModel(vm);

    const isCancelled = status === CalendarEventViewStatus.CANCELLED;

    return (
        <Flex align="center" gap="var(--cpd-space-3x)" className={classNames(styles.root, className)}>
            {startMonth && startDay && (
                // The full date is in the details below, so screen readers do not need the badge too.
                <Flex direction="column" align="center" className={styles.dateBadge} aria-hidden={true}>
                    <span className={styles.dateBadgeMonth}>{startMonth}</span>
                    <span className={styles.dateBadgeDay}>{startDay}</span>
                </Flex>
            )}
            <Flex direction="column" gap="var(--cpd-space-3x)" className={styles.content}>
                {sender && (
                    <Text as="div" size="sm" className={classNames(styles.secondary, styles.sender)}>
                        {invitedYou
                            ? _t("timeline|calendar_event|invited_you", undefined, { sender: () => sender })
                            : _t("timeline|calendar_event|scheduled", undefined, { sender: () => sender })}
                    </Text>
                )}
                <Flex align="center" gap="var(--cpd-space-2x)" className={styles.header}>
                    <Text
                        as="p"
                        size="md"
                        weight="semibold"
                        className={classNames(styles.title, { [styles.cancelled]: isCancelled })}
                    >
                        {title || _t("timeline|calendar_event|untitled")}
                    </Text>
                    {isCancelled && <Badge kind="red">{_t("timeline|calendar_event|cancelled")}</Badge>}
                    {status === CalendarEventViewStatus.TENTATIVE && (
                        <Badge kind="grey">{_t("timeline|calendar_event|tentative")}</Badge>
                    )}
                </Flex>

                <Flex direction="column" gap="var(--cpd-space-2x)">
                    <Flex gap="var(--cpd-space-2x)" className={styles.detail}>
                        <TimeIcon className={styles.detailIcon} aria-hidden={true} />
                        <Flex direction="column">
                            <Text size="sm">
                                {date} · {time ?? _t("timeline|calendar_event|all_day")}
                            </Text>
                            {timeZone && (
                                <Text size="sm" className={styles.secondary}>
                                    {timeZone}
                                </Text>
                            )}
                            {recurrence && (
                                <Text size="sm" className={styles.secondary}>
                                    {recurrence}
                                </Text>
                            )}
                        </Flex>
                    </Flex>

                    {!!locations?.length && (
                        <Flex gap="var(--cpd-space-2x)" className={styles.detail}>
                            <LocationPinIcon className={styles.detailIcon} aria-hidden={true} />
                            <Text size="sm">{locations.join(", ")}</Text>
                        </Flex>
                    )}

                    {!!participantCount && (
                        <Flex gap="var(--cpd-space-2x)" className={styles.detail}>
                            <UserIcon className={styles.detailIcon} aria-hidden={true} />
                            <Text size="sm">
                                {_t("timeline|calendar_event|n_participants", { count: participantCount })}
                            </Text>
                        </Flex>
                    )}
                </Flex>

                {description && (
                    <Text size="sm" className={classNames(styles.secondary, styles.description)}>
                        {description}
                    </Text>
                )}
            </Flex>
            {(link || callLink) && (
                <Flex align="center" gap="var(--cpd-space-2x)" className={styles.actions}>
                    {link && (
                        <Tooltip description={_t("timeline|calendar_event|open_link")}>
                            <Button
                                as="a"
                                href={link}
                                target="_blank"
                                rel="noreferrer noopener"
                                kind="secondary"
                                size="md"
                                iconOnly={true}
                                Icon={LinkIcon}
                                aria-label={_t("timeline|calendar_event|open_link")}
                            />
                        </Tooltip>
                    )}
                    {callLink && (
                        <Button
                            as="a"
                            href={callLink}
                            target="_blank"
                            rel="noreferrer noopener"
                            kind="primary"
                            size="md"
                            Icon={VoiceCallSolidIcon}
                        >
                            {_t("timeline|calendar_event|join_call")}
                        </Button>
                    )}
                </Flex>
            )}
        </Flex>
    );
}
