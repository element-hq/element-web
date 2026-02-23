/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useRef, useState } from "react";
import { Root, Submit, Field, TextControl, MenuItem } from "@vector-im/compound-web";

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
    const date = snapshot.jumpFromDate ? new Date(snapshot.jumpFromDate) : new Date();
    const dateInputDefaultValue = formatDateForInput(date);

    const i18n = useI18n();
    const dateInputId = useId();
    const [dateValue, setDateValue] = useState(dateInputDefaultValue);
    const dateInputRef = useRef<HTMLInputElement>(null);
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    const onDateInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Tab" && !event.shiftKey) {
            event.preventDefault();
            submitButtonRef.current?.focus();
        }
    };

    const onDateValueInput = (event: React.InputEvent<HTMLInputElement>): void => {
        setDateValue(event.currentTarget.value);
    };

    const submitDate = (): void => {
        vm.onDatePicked(dateValue);
        onSubmitted?.();
    };

    const onJumpToDateSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        submitDate();
    };

    const onSubmitButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") return;
        event.preventDefault();
        submitDate();
    };

    const keepMenuOpenOnSelect = (event: Event): void => {
        event.preventDefault();
    };

    return (
        <MenuItem
            as="div"
            data-testid="jump-to-date-picker"
            label={null}
            onSelect={keepMenuOpenOnSelect}
            hideChevron={true}
        >
            <Root className={styles.picker_form} onSubmit={onJumpToDateSubmit}>
                <span className={styles.picker_label}>{i18n.translate("room|jump_to_date")}</span>
                <Field name="jump-to-date-field" className={styles.picker_input}>
                    <TextControl
                        ref={dateInputRef}
                        id={dateInputId}
                        type="date"
                        aria-label={i18n.translate("room|jump_to_date_prompt")}
                        onInput={onDateValueInput}
                        onKeyDown={onDateInputKeyDown}
                        value={dateValue}
                        max={formatDateForInput(new Date())}
                        className={styles.picker_input_date}
                    />
                </Field>
                <Submit
                    ref={submitButtonRef}
                    className={styles.picker_button}
                    type="submit"
                    kind="primary"
                    size="sm"
                    onKeyDown={onSubmitButtonKeyDown}
                >
                    {i18n.translate("action|go")}
                </Submit>
            </Root>
        </MenuItem>
    );
};
