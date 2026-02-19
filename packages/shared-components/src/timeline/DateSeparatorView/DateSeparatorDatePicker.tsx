/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useId, useState } from "react";
import { Root, Submit, Field, Label, TextControl } from "@vector-im/compound-web";
import { CalendarIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { useI18n } from "../../utils/i18nContext";
import { type DateSeparatorViewModel } from "./DateSeparatorView";
import styles from "./DateSeparatorView.module.css";

/**
 * Props for DateSeparatorDatePicker component.
 */
export interface DateSeparatorDatePickerProps {
    /** The date separator view model. */
    vm: DateSeparatorViewModel;
}

/**
 * Date picker menu item.
 */
export const DateSeparatorDatePicker: React.FC<DateSeparatorDatePickerProps> = ({ vm }): JSX.Element => {
    const i18n = useI18n();
    const dateInputId = useId();
    const datePrompt = i18n.translate("room|jump_to_date_prompt");
    const dateInputDefaultValue = new Date().toISOString().slice(0, 10);
    const [dateValue, setDateValue] = useState(dateInputDefaultValue);

    const onDateValueInput = (event: React.InputEvent<HTMLInputElement>): void => {
        setDateValue(event.currentTarget.value);
    };

    const onJumpToDateSubmit = (event: React.SubmitEvent<HTMLFormElement>): void => {
        event.preventDefault();
        vm.onDatePicked(dateValue);
    };

    return (
        <div data-testid="jump-to-date-picker" className={styles.picker_menuitem}>
            <Root className={styles.picker_form} onSubmit={onJumpToDateSubmit}>
                <span className={styles.picker_label}>{i18n.translate("room|jump_to_date")}</span>
                <Field name="jump-to-date" className={styles.picker_input}>
                    <Label className={styles.picker_input_label} htmlFor={dateInputId}>
                        {datePrompt}
                    </Label>
                    <span className={styles.picker_input_floating_label} aria-hidden="true">
                        {datePrompt}
                    </span>
                    <TextControl
                        id={dateInputId}
                        type="date"
                        onInput={onDateValueInput}
                        value={dateValue}
                        max={dateInputDefaultValue}
                        className={styles.picker_input_date}
                    />
                    <CalendarIcon className={styles.picker_input_calendar_icon} aria-hidden="true" />
                </Field>
                <Submit className={styles.picker_button} type="submit" kind="primary" size="sm">
                    {i18n.translate("action|go")}
                </Submit>
            </Root>
        </div>
    );
};
