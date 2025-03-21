/*
Copyright 2019-2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import classNames from "classnames";

import AccessibleButton from "./AccessibleButton";

interface IProps {
    // Whether or not this toggle is in the 'on' position.
    checked: boolean;

    // Title to use
    title?: string;

    // Whether or not the user can interact with the switch
    disabled?: boolean;

    // Tooltip to show
    tooltip?: string;

    // Called when the checked state changes. First argument will be the new state.
    onChange(checked: boolean): void;

    // id to bind with other elements
    id?: string;
}

// Controlled Toggle Switch element, written with Accessibility in mind
export default ({ checked, disabled = false, onChange, title, tooltip, ...props }: IProps): JSX.Element => {
    const _onClick = (): void => {
        if (disabled) return;
        onChange(!checked);
    };

    const classes = classNames({
        mx_ToggleSwitch: true,
        mx_ToggleSwitch_on: checked,
        mx_ToggleSwitch_enabled: !disabled,
    });

    return (
        <AccessibleButton
            {...props}
            className={classes}
            onClick={_onClick}
            role="switch"
            aria-label={title}
            aria-checked={checked}
            aria-disabled={disabled}
            title={tooltip}
        >
            <div className="mx_ToggleSwitch_ball" />
        </AccessibleButton>
    );
};
