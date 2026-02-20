/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useRef, useState } from "react";
import { Root, Submit, Field, Label, TextControl } from "@vector-im/compound-web";
import { CalendarIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { formatDateForInput } from "../../utils/DateUtils";
import { useI18n } from "../../utils/i18nContext";
import { useViewModel } from "../../viewmodel";
import { type DateSeparatorViewModel } from "./DateSeparatorView";
import styles from "./DateSeparatorView.module.css";

/**
 * Props for DateSeparatorDatePicker component.
 */
export interface DateSeparatorDatePickerProps {
    /** The date separator view model. */
    vm: DateSeparatorViewModel;
    /** Called after a date has been submitted. */
    onSubmitted?: () => void;
}

/**
 * Date picker menu item.
 */
export const DateSeparatorDatePicker: React.FC<DateSeparatorDatePickerProps> = ({ vm, onSubmitted }): JSX.Element => {
    const snapshot = useViewModel(vm);
    const date = snapshot.jumpToTimestamp ? new Date(snapshot.jumpToTimestamp) : new Date();
    const dateInputDefaultValue = formatDateForInput(date);

    const i18n = useI18n();
    const dateInputId = useId();
    const [dateValue, setDateValue] = useState(dateInputDefaultValue);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const calendarButtonRef = useRef<HTMLButtonElement>(null);
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    const onDateValueInput = (event: React.InputEvent<HTMLInputElement>): void => {
        setDateValue(event.currentTarget.value);
    };

    const onJumpToDateSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        vm.onDatePicked(dateValue);
        onSubmitted?.();
    };

    const onDateInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key !== "Tab") return;
        event.preventDefault();
        calendarButtonRef.current?.focus();
    };

    const onCalendarButtonClick = (): void => {
        const input = dateInputRef.current;
        if (!input) return;

        input.focus();

        try {
            if ("showPicker" in input) {
                input.showPicker();
                return;
            }
        } catch {
            // Some browsers can throw if gesture/context is rejected.
        }

        input.click();
    };

    const onCalendarButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key !== "Tab" || event.shiftKey) return;
        event.preventDefault();
        submitButtonRef.current?.focus();
    };

    return (
        <div data-testid="jump-to-date-picker" className={styles.picker_menuitem}>
            <Root className={styles.picker_form} onSubmit={onJumpToDateSubmit}>
                <span className={styles.picker_label}>{i18n.translate("room|jump_to_date")}</span>
                <Field name="jump-to-date-field" className={styles.picker_input}>
                    <Label className={styles.picker_input_label} htmlFor={dateInputId}>
                        {i18n.translate("room|jump_to_date_prompt")}
                    </Label>
                    <span className={styles.picker_input_floating_label} aria-hidden="true">
                        {i18n.translate("room|jump_to_date_prompt")}
                    </span>
                    <TextControl
                        ref={dateInputRef}
                        id={dateInputId}
                        type="date"
                        onInput={onDateValueInput}
                        onKeyDown={onDateInputKeyDown}
                        value={dateValue}
                        // Prevent people from selecting a day in the future
                        // (there won't be any events there anyway).
                        max={formatDateForInput(new Date())}
                        className={styles.picker_input_date}
                    />
                    <button
                        ref={calendarButtonRef}
                        type="button"
                        className={styles.picker_input_calendar_button}
                        aria-label={i18n.translate("room|jump_to_date")}
                        onClick={onCalendarButtonClick}
                        onKeyDown={onCalendarButtonKeyDown}
                        data-testid="jump-to-date-show-picker"
                    >
                        <CalendarIcon className={styles.picker_input_calendar_icon} aria-hidden="true" />
                    </button>
                </Field>
                <Submit ref={submitButtonRef} className={styles.picker_button} type="submit" kind="primary" size="sm">
                    {i18n.translate("action|go")}
                </Submit>
            </Root>
        </div>
    );
};
