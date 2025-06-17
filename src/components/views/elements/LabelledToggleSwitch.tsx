/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FC, useId } from "react";
import classNames from "classnames";

import ToggleSwitch from "./ToggleSwitch";
import { Caption } from "../typography/Caption";

interface IProps {
    // The value for the toggle switch
    "value": boolean;
    // The translated label for the switch
    "label": string;
    // The translated caption for the switch
    "caption"?: string;
    // Tooltip to display
    "tooltip"?: string;
    // Whether or not to disable the toggle switch
    "disabled"?: boolean;
    // True to put the toggle in front of the label
    // Default false.
    "toggleInFront"?: boolean;
    // Additional class names to append to the switch. Optional.
    "className"?: string;
    // The function to call when the value changes
    onChange(checked: boolean): void;

    "data-testid"?: string;
}

const LabelledToggleSwitch: FC<IProps> = ({
    label,
    caption,
    value,
    disabled,
    onChange,
    tooltip,
    toggleInFront,
    className,
    "data-testid": testId,
}) => {
    // This is a minimal version of a SettingsFlag
    const generatedId = useId();
    const id = `mx_LabelledToggleSwitch_${generatedId}`;
    let firstPart = (
        <span className="mx_SettingsFlag_label">
            <div id={id}>{label}</div>
            {caption && <Caption id={`${id}_caption`}>{caption}</Caption>}
        </span>
    );
    let secondPart = (
        <ToggleSwitch
            checked={value}
            disabled={disabled}
            onChange={onChange}
            tooltip={tooltip}
            aria-labelledby={id}
            aria-describedby={caption ? `${id}_caption` : undefined}
        />
    );

    if (toggleInFront) {
        [firstPart, secondPart] = [secondPart, firstPart];
    }

    const classes = classNames("mx_SettingsFlag", className, {
        mx_SettingsFlag_toggleInFront: toggleInFront,
    });
    return (
        <div data-testid={testId} className={classes}>
            {firstPart}
            {secondPart}
        </div>
    );
};

export default LabelledToggleSwitch;
