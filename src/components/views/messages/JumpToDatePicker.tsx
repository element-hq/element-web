/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useState, type FormEvent } from "react";

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
    const [onFocus, isActive, refCallback] = useRovingTabIndex<HTMLInputElement>();

    const onDateValueInput = (ev: React.ChangeEvent<HTMLInputElement>): void => setDateValue(ev.target.value);
    const onJumpToDateSubmit = (ev: FormEvent): void => {
        ev.preventDefault();
        onDatePicked(dateValue);
    };

    return (
        <form className="mx_JumpToDatePicker_form" onSubmit={onJumpToDateSubmit}>
            <span className="mx_JumpToDatePicker_label">{_t("room|jump_to_date")}</span>
            <Field
                element="input"
                type="date"
                onInput={onDateValueInput}
                value={dateValue}
                // Prevent people from selecting a day in the future (there won't be any
                // events there anyway).
                max={formatDateForInput(new Date())}
                className="mx_JumpToDatePicker_datePicker"
                label={_t("room|jump_to_date_prompt")}
                onFocus={onFocus}
                inputRef={refCallback}
                tabIndex={isActive ? 0 : -1}
            />
            <RovingAccessibleButton
                element="button"
                type="submit"
                kind="primary"
                className="mx_JumpToDatePicker_submitButton"
                onClick={onJumpToDateSubmit}
            >
                {_t("action|go")}
            </RovingAccessibleButton>
        </form>
    );
};

export default JumpToDatePicker;
