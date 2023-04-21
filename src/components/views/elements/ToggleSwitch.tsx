/*
Copyright 2019 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from "react";
import classNames from "classnames";

import AccessibleTooltipButton from "./AccessibleTooltipButton";

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
export default ({ checked, disabled = false, onChange, ...props }: IProps): JSX.Element => {
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
        <AccessibleTooltipButton
            {...props}
            className={classes}
            onClick={_onClick}
            role="switch"
            aria-checked={checked}
            aria-disabled={disabled}
        >
            <div className="mx_ToggleSwitch_ball" />
        </AccessibleTooltipButton>
    );
};
