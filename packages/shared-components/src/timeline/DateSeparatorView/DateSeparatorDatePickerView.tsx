/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useRef, useState } from "react";
import { Root, Submit, Field, TextControl, MenuItem } from "@vector-im/compound-web";

import { formatDateForInput } from "../../core/utils/DateUtils";
import { useI18n } from "../../core/i18n/i18nContext";
import { useViewModel } from "../../core/viewmodel";
import { type DateSeparatorViewModel } from "./DateSeparatorView";
import styles from "./DateSeparatorDatePickerView.module.css";

/**
 * Props for DateSeparatorDatePickerView component.
 */
export interface DateSeparatorDatePickerViewProps {
    /** The date separator view model. */
    vm: DateSeparatorViewModel;
    /** Optional input ref shared with parent for focus management. */
    inputRef?: React.RefObject<HTMLInputElement | null>;
    /** Called after a date has been submitted. */
    onSubmitted?: () => void;
    /** Called when the picker is dismissed without submitting. */
    onDismissed?: () => void;
}

/**
 * Date picker menu item.
 */
export const DateSeparatorDatePickerView: React.FC<DateSeparatorDatePickerViewProps> = ({
    vm,
    inputRef,
    onSubmitted,
    onDismissed,
}): JSX.Element => {
    const snapshot = useViewModel(vm);
    const date = snapshot.jumpFromDate ? new Date(snapshot.jumpFromDate) : new Date();
    const dateInputDefaultValue = formatDateForInput(date);

    const { translate: _t } = useI18n();
    const dateInputId = useId();
    const [dateValue, setDateValue] = useState(dateInputDefaultValue);
    const localDateInputRef = useRef<HTMLInputElement>(null);
    const dateInputRef = inputRef ?? localDateInputRef;
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    const onDateInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === "Tab") {
            if (event.shiftKey) {
                onDismissed?.();
            } else {
                event.preventDefault();
                submitButtonRef.current?.focus();
            }
        }
    };

    const onDateValueInput = (event: React.InputEvent<HTMLInputElement>): void => {
        setDateValue(event.currentTarget.value);
    };

    const submitDate = (): void => {
        vm.onDatePicked?.(dateValue);
        onSubmitted?.();
    };

    const onJumpToDateSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        submitDate();
    };

    const onSubmitButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
        if (event.key === "Tab") {
            if (event.shiftKey) {
                event.preventDefault();
                dateInputRef.current?.focus();
            } else {
                onDismissed?.();
            }
        }

        if (event.key == "Enter" || event.key == " " || event.key == "Spacebar") {
            event.preventDefault();
            submitDate();
        }
    };

    const keepMenuOpenOnSelect = (event: Event): void => {
        event.preventDefault();
    };

    return (
        <MenuItem
            as="div"
            data-testid="jump-to-date-picker"
            label={_t("room|jump_to_date")}
            onSelect={keepMenuOpenOnSelect}
            hideChevron={true}
            className={styles.picker_menu_item}
        >
            <Root className={styles.picker_form} onSubmit={onJumpToDateSubmit}>
                <Field name="jump-to-date-field" className={styles.picker_input}>
                    <TextControl
                        ref={dateInputRef}
                        id={dateInputId}
                        type="date"
                        aria-label={_t("room|jump_to_date_prompt")}
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
                    {_t("action|go")}
                </Submit>
            </Root>
        </MenuItem>
    );
};
