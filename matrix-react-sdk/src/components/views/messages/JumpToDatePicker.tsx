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

import React, { useState, FormEvent } from "react";

import { _t } from "../../../languageHandler";
import Field from "../elements/Field";
import { RovingAccessibleButton, useRovingTabIndex } from "../../../accessibility/RovingTabIndex";
import { formatDateForInput } from "../../../DateUtils";

interface IProps {
    ts: number;
    onDatePicked: (dateString: string) => void;
}

const JumpToDatePicker: React.FC<IProps> = ({ ts, onDatePicked }: IProps) => {
    const date = new Date(ts);
    const dateInputDefaultValue = formatDateForInput(date);

    const [dateValue, setDateValue] = useState(dateInputDefaultValue);
    const [onFocus, isActive, ref] = useRovingTabIndex<HTMLInputElement>();

    const onDateValueInput = (ev: React.ChangeEvent<HTMLInputElement>): void => setDateValue(ev.target.value);
    const onJumpToDateSubmit = (ev: FormEvent): void => {
        ev.preventDefault();
        onDatePicked(dateValue);
    };

    return (
        <form className="mx_JumpToDatePicker_form" onSubmit={onJumpToDateSubmit}>
            <span className="mx_JumpToDatePicker_label">{_t("Jump to date")}</span>
            <Field
                element="input"
                type="date"
                onInput={onDateValueInput}
                value={dateValue}
                // Prevent people from selecting a day in the future (there won't be any
                // events there anyway).
                max={formatDateForInput(new Date())}
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
                {_t("Go")}
            </RovingAccessibleButton>
        </form>
    );
};

export default JumpToDatePicker;
