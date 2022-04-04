/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { useState, FormEvent } from 'react';

import { _t } from '../../../languageHandler';
import Field from "../elements/Field";
import NativeOnChangeInput from "../elements/NativeOnChangeInput";
import { RovingAccessibleButton, useRovingTabIndex } from "../../../accessibility/RovingTabIndex";

interface IProps {
    ts: number;
    onDatePicked?: (dateString: string) => void;
}

const JumpToDatePicker: React.FC<IProps> = ({ ts, onDatePicked }: IProps) => {
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const dateDefaultValue = `${year}-${month}-${day}`;

    const [dateValue, setDateValue] = useState(dateDefaultValue);
    // Whether or not to automatically navigate to the given date after someone
    // selects a day in the date picker. We want to disable this after someone
    // starts manually typing in the input instead of picking.
    const [navigateOnDatePickerSelection, setNavigateOnDatePickerSelection] = useState(true);

    // Since we're using NativeOnChangeInput with native JavaScript behavior, this
    // tracks the date value changes as they come in.
    const onDateValueInput = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setDateValue(e.target.value);
    };

    // Since we're using NativeOnChangeInput with native JavaScript behavior, the change
    // event listener will trigger when a date is picked from the date picker
    // or when the text is fully filled out. In order to not trigger early
    // as someone is typing out a date, we need to disable when we see keydowns.
    const onDateValueChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setDateValue(e.target.value);

        // Don't auto navigate if they were manually typing out a date
        if (navigateOnDatePickerSelection) {
            onDatePicked(dateValue);
        }
    };

    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLInputElement>();

    const onDateInputKeyDown = (e: React.KeyboardEvent): void => {
        // When we see someone manually typing out a date, disable the auto
        // submit on change.
        setNavigateOnDatePickerSelection(false);
    };

    const onJumpToDateSubmit = (ev: FormEvent): void => {
        ev.preventDefault();

        onDatePicked(dateValue);
    };

    return (
        <form
            className="mx_JumpToDatePicker_form"
            onSubmit={onJumpToDateSubmit}
        >
            <span className="mx_JumpToDatePicker_label">{ _t("Jump to date") }</span>
            <Field
                componentClass={NativeOnChangeInput}
                type="date"
                onChange={onDateValueChange}
                onInput={onDateValueInput}
                onKeyDown={onDateInputKeyDown}
                value={dateValue}
                className="mx_JumpToDatePicker_datePicker"
                label={_t("Pick a date to jump to")}
                onFocus={onFocus}
                inputRef={ref}
                tabIndex={isActive ? 0 : -1}
            />
            <RovingAccessibleButton
                element="button"
                type="submit"
                kind="primary"
                className="mx_JumpToDatePicker_submitButton"
                onClick={onJumpToDateSubmit}
            >
                { _t("Go") }
            </RovingAccessibleButton>
        </form>
    );
};

export default JumpToDatePicker;
