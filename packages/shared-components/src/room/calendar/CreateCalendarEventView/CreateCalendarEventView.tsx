/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import classNames from "classnames";
import {
    CheckboxControl,
    ErrorMessage,
    Field,
    HelpMessage,
    InlineField,
    Label,
    Root,
    Text,
    TextControl,
} from "@vector-im/compound-web";

import { type ViewModel } from "../../../core/viewmodel/ViewModel";
import { useViewModel } from "../../../core/viewmodel/useViewModel";
import { useI18n } from "../../../core/i18n/i18nContext";
import { Flex } from "../../../core/utils/Flex";
import styles from "./CreateCalendarEventView.module.css";

export interface CreateCalendarEventViewSnapshot {
    /**
     * The event title.
     */
    title: string;
    /**
     * The event description.
     */
    description: string;
    /**
     * The day of the event, as `YYYY-MM-DD`.
     */
    date: string;
    /**
     * Whether the event lasts all day, which hides the start and end times.
     */
    allDay: boolean;
    /**
     * The start time, as `HH:MM`.
     */
    startTime: string;
    /**
     * The end time, as `HH:MM`.
     */
    endTime: string;
    /**
     * A web page or call link for the event.
     */
    link: string;
    /**
     * Name of the time zone the times are in, e.g. "Europe/London".
     */
    timeZone: string;
    /**
     * Whether the title was left empty.
     */
    isTitleMissing?: boolean;
    /**
     * Whether the date was left empty.
     */
    isDateMissing?: boolean;
    /**
     * Whether the end time is not after the start time.
     */
    isEndBeforeStart?: boolean;
    /**
     * Whether the link is not a web address.
     */
    isLinkInvalid?: boolean;
    /**
     * Whether the last attempt to create the event failed.
     */
    didCreateFail?: boolean;
    /**
     * Whether the event is being created.
     */
    isCreating?: boolean;
}

export interface CreateCalendarEventViewActions {
    /**
     * Update the event title.
     */
    setTitle: (title: string) => void;
    /**
     * Update the event description.
     */
    setDescription: (description: string) => void;
    /**
     * Update the day of the event, as `YYYY-MM-DD`.
     */
    setDate: (date: string) => void;
    /**
     * Update whether the event lasts all day.
     */
    setAllDay: (allDay: boolean) => void;
    /**
     * Update the start time, as `HH:MM`.
     */
    setStartTime: (startTime: string) => void;
    /**
     * Update the end time, as `HH:MM`.
     */
    setEndTime: (endTime: string) => void;
    /**
     * Update the link.
     */
    setLink: (link: string) => void;
    /**
     * Check the form and create the event.
     */
    create: () => void;
}

/**
 * The view model for {@link CreateCalendarEventView}.
 */
export type CreateCalendarEventViewModel = ViewModel<CreateCalendarEventViewSnapshot, CreateCalendarEventViewActions>;

interface CreateCalendarEventViewProps {
    /**
     * The view model for the component.
     */
    vm: CreateCalendarEventViewModel;
    /**
     * Optional CSS class for host-level styling.
     */
    className?: string;
}

/**
 * A form to create a calendar event (MSC4569 `m.jscalendar.event`) in a room.
 *
 * It has no buttons of its own, so that the host dialog can place them; submitting the form calls `create`.
 *
 * @example
 * ```tsx
 * <CreateCalendarEventView vm={createCalendarEventViewModel} />
 * ```
 */
export function CreateCalendarEventView({ vm, className }: Readonly<CreateCalendarEventViewProps>): JSX.Element {
    const { translate: _t } = useI18n();
    const {
        title,
        description,
        date,
        allDay,
        startTime,
        endTime,
        link,
        timeZone,
        isTitleMissing,
        isDateMissing,
        isEndBeforeStart,
        isLinkInvalid,
        didCreateFail,
    } = useViewModel(vm);

    return (
        <Root
            className={classNames(styles.form, className)}
            onSubmit={(evt) => {
                evt.preventDefault();
                vm.create();
            }}
        >
            <Field name="title" serverInvalid={isTitleMissing}>
                <Label>{_t("create_calendar_event|title_label")}</Label>
                <TextControl value={title} onChange={(evt) => vm.setTitle(evt.target.value)} />
                {isTitleMissing && <ErrorMessage>{_t("create_calendar_event|title_missing")}</ErrorMessage>}
            </Field>

            <Field name="description">
                <Label>{_t("create_calendar_event|description_label")}</Label>
                <TextControl value={description} onChange={(evt) => vm.setDescription(evt.target.value)} />
            </Field>

            <Field name="date" serverInvalid={isDateMissing}>
                <Label>{_t("create_calendar_event|date_label")}</Label>
                <TextControl type="date" value={date} onChange={(evt) => vm.setDate(evt.target.value)} />
                {isDateMissing && <ErrorMessage>{_t("create_calendar_event|date_missing")}</ErrorMessage>}
            </Field>

            <InlineField
                name="allDay"
                control={<CheckboxControl checked={allDay} onChange={(evt) => vm.setAllDay(evt.target.checked)} />}
            >
                <Label>{_t("create_calendar_event|all_day_label")}</Label>
            </InlineField>

            {!allDay && (
                <Flex direction="column" gap="var(--cpd-space-2x)">
                    <Flex gap="var(--cpd-space-4x)" className={styles.times}>
                        <Field name="startTime" serverInvalid={isEndBeforeStart}>
                            <Label>{_t("create_calendar_event|start_label")}</Label>
                            <TextControl
                                type="time"
                                value={startTime}
                                onChange={(evt) => vm.setStartTime(evt.target.value)}
                            />
                        </Field>
                        <Field name="endTime" serverInvalid={isEndBeforeStart}>
                            <Label>{_t("create_calendar_event|end_label")}</Label>
                            <TextControl
                                type="time"
                                value={endTime}
                                onChange={(evt) => vm.setEndTime(evt.target.value)}
                            />
                        </Field>
                    </Flex>
                    {/* The message sits below both times, so it is tied to the end time by name. */}
                    {isEndBeforeStart ? (
                        <ErrorMessage name="endTime">{_t("create_calendar_event|end_before_start")}</ErrorMessage>
                    ) : (
                        <HelpMessage name="endTime">
                            {_t("create_calendar_event|time_zone_help", { timeZone })}
                        </HelpMessage>
                    )}
                </Flex>
            )}

            <Field name="link" serverInvalid={isLinkInvalid}>
                <Label>{_t("create_calendar_event|link_label")}</Label>
                <TextControl
                    type="url"
                    placeholder="https://"
                    value={link}
                    onChange={(evt) => vm.setLink(evt.target.value)}
                />
                {isLinkInvalid && <ErrorMessage>{_t("create_calendar_event|link_invalid")}</ErrorMessage>}
            </Field>

            {didCreateFail && (
                <Text role="alert" size="sm" className={styles.createFailed}>
                    {_t("create_calendar_event|create_failed")}
                </Text>
            )}
        </Root>
    );
}
