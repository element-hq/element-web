/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import classNames from "classnames";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

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

export default class LabelledToggleSwitch extends React.PureComponent<IProps> {
    private readonly id = `mx_LabelledToggleSwitch_${secureRandomString(12)}`;

    public render(): React.ReactNode {
        // This is a minimal version of a SettingsFlag
        const { label, caption } = this.props;
        let firstPart = (
            <span className="mx_SettingsFlag_label">
                <div id={this.id}>{label}</div>
                {caption && <Caption id={`${this.id}_caption`}>{caption}</Caption>}
            </span>
        );
        let secondPart = (
            <ToggleSwitch
                checked={this.props.value}
                disabled={this.props.disabled}
                onChange={this.props.onChange}
                tooltip={this.props.tooltip}
                aria-labelledby={this.id}
                aria-describedby={caption ? `${this.id}_caption` : undefined}
            />
        );

        if (this.props.toggleInFront) {
            [firstPart, secondPart] = [secondPart, firstPart];
        }

        const classes = classNames("mx_SettingsFlag", this.props.className, {
            mx_SettingsFlag_toggleInFront: this.props.toggleInFront,
        });
        return (
            <div data-testid={this.props["data-testid"]} className={classes}>
                {firstPart}
                {secondPart}
            </div>
        );
    }
}
